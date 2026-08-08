/**
 * RIDESHARE REGISTRY — authoritative plate→licensee resolution.
 *
 * NARRATIVE
 * The old pivot asked the open web who owns a plate. The open web does not
 * know: state DMV registration is statutorily closed (DPPA), so every
 * plate-first query landed on scraper spam, then a regex lifted whatever
 * capitalised token followed the driver's first name out of that spam and a
 * Bayesian score dressed the noise up as a posterior. The result was the two
 * failures the rider actually sees — "unresolved" when the spam said nothing,
 * and "inaccurate" when it said something irrelevant.
 *
 * What the open web *does* publish, in machine-readable form and under an open
 * data licence, is the for-hire licensing register itself. A TNC/for-hire
 * vehicle is not a private car: to carry a paying passenger it must appear on a
 * public regulator roster that names the licensee, the plate, the VIN, the
 * base, and the licence status. That is a primary source, it is keyless, and it
 * answers the exact question — who is licensed to drive this specific car.
 *
 * So resolution is inverted again: query the regulator first, deterministically,
 * on the plate; only fall back to probabilistic web recombination when no
 * regulator covers the jurisdiction. A registry hit is not a candidate to be
 * weighed, it is a record to be verified — against the first name the app
 * disclosed, against the car at the kerb (via free VIN decode), and against the
 * licence's own expiry. Disagreement between those is itself the highest-value
 * rider-safety signal this system can produce: the car in front of you is
 * licensed to somebody else.
 *
 * Every adapter is independent, timeboxed and failure-isolated. A regulator
 * that is down thins the dossier; it never fails the sweep.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface RegistryRecord {
  source: string;
  source_url: string;
  jurisdiction: string;
  /** "First Last" when the licensee is a human; null when it is a fleet entity. */
  person_name: string | null;
  /** Exactly as published, e.g. "UPPAL, ARSHDEEP" or "PSST CAB LLC". */
  raw_name: string;
  is_entity: boolean;
  license_type: string | null;
  license_number: string | null;
  status: string | null;
  expiration: string | null;
  plate: string | null;
  vin: string | null;
  vehicle_year: string | null;
  base_name: string | null;
  base_phone: string | null;
  base_address: string | null;
}

export interface VinDecode {
  vin: string;
  make: string;
  model: string;
  year: string;
  body_class: string;
  manufacturer: string;
  plant_country: string;
}

export interface RegistryFlag {
  code: string;
  severity: "info" | "warn" | "high";
  detail: string;
  evidence: string;
}

export interface RegistryResult {
  records: RegistryRecord[];
  vin: VinDecode | null;
  flags: RegistryFlag[];
  /** Human licensee that the regulator binds to this plate, if any. */
  best_name: string | null;
  /** Deterministic binding strength for that name. */
  confidence: number;
  /** True when a regulator that covers this jurisdiction was actually queried. */
  covered: boolean;
  queried: string[];
  block: string;
}

// ── Fetch discipline ───────────────────────────────────────────────────────

const UA = "AsherinRideshareGuardian/2.0 (rider-safety; open-data)";

async function getJson<T>(url: string, timeoutMs: number): Promise<T | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export const normPlateStrict = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

const ENTITY_RE = /\b(LLC|L\.L\.C|INC|CORP|CO|COMPANY|LTD|LP|LLP|CAB|TAXI|LEASING|MANAGEMENT|HOLDINGS|GROUP|ENTERPRISES?|SERVICES?|TRANS(PORT(ATION)?)?)\b/i;

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])([a-z'’\-]*)/g, (_, a: string, b: string) => a.toUpperCase() + b)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Regulator rosters publish "LAST, FIRST MIDDLE". A naive split produces
 * "Uppal Arshdeep" and every downstream query then searches for a person who
 * does not exist, which is one of the ways the old dossier came back wrong.
 */
export function parseLicenseeName(raw: string): { person: string | null; entity: boolean } {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return { person: null, entity: false };
  if (ENTITY_RE.test(cleaned)) return { person: null, entity: true };

  if (cleaned.includes(",")) {
    const [last, rest] = cleaned.split(",", 2);
    const first = (rest || "").trim().split(/\s+/)[0] || "";
    if (!first || !last.trim()) return { person: null, entity: false };
    return { person: `${titleCase(first)} ${titleCase(last.trim())}`, entity: false };
  }
  const parts = cleaned.split(/\s+/);
  if (parts.length < 2) return { person: null, entity: false };
  return { person: titleCase(`${parts[0]} ${parts[parts.length - 1]}`), entity: false };
}

// ── Adapter: NYC TLC (Socrata, keyless) ────────────────────────────────────

const NYC_FHV = "8wbx-tsch";       // For-Hire Vehicles — Active (Uber/Lyft/black car)
const NYC_MEDALLION = "rhe8-mgbb"; // Medallion (yellow) vehicles — authorized

/** NYC TLC plates are format-distinctive, which lets us detect jurisdiction from the plate alone. */
const NYC_PLATE_RE = /^[TY]\d{5,6}C$/;

async function nycSocrata(
  dataset: string,
  plate: string,
  timeoutMs: number,
): Promise<Record<string, string>[]> {
  const where = encodeURIComponent(
    `upper(replace(replace(dmv_license_plate_number,' ',''),'-','')) = '${plate}'`,
  );
  const url = `https://data.cityofnewyork.us/resource/${dataset}.json?$where=${where}&$limit=5`;
  const rows = await getJson<Record<string, string>[]>(url, timeoutMs);
  return Array.isArray(rows) ? rows : [];
}

function fromNycFhv(r: Record<string, string>): RegistryRecord {
  const { person, entity } = parseLicenseeName(r.name || "");
  return {
    source: "NYC TLC — Active For-Hire Vehicles register",
    source_url: `https://data.cityofnewyork.us/resource/${NYC_FHV}.json?dmv_license_plate_number=${encodeURIComponent(r.dmv_license_plate_number || "")}`,
    jurisdiction: "New York City",
    person_name: person,
    raw_name: r.name || "",
    is_entity: entity,
    license_type: r.license_type || "For Hire Vehicle",
    license_number: r.vehicle_license_number || null,
    status: r.active === "YES" ? "ACTIVE" : r.active ? `INACTIVE (${r.active})` : null,
    expiration: r.expiration_date ? r.expiration_date.slice(0, 10) : null,
    plate: r.dmv_license_plate_number || null,
    vin: r.vehicle_vin_number || null,
    vehicle_year: r.vehicle_year || null,
    base_name: r.base_name || null,
    base_phone: r.base_telephone_number || null,
    base_address: r.base_address || null,
  };
}

function fromNycMedallion(r: Record<string, string>): RegistryRecord {
  const { person, entity } = parseLicenseeName(r.name || "");
  return {
    source: "NYC TLC — Authorized Medallion Vehicles register",
    source_url: `https://data.cityofnewyork.us/resource/${NYC_MEDALLION}.json?dmv_license_plate_number=${encodeURIComponent(r.dmv_license_plate_number || "")}`,
    jurisdiction: "New York City",
    person_name: person,
    raw_name: r.name || "",
    is_entity: entity,
    license_type: `Medallion (${r.medallion_type || "unspecified"})`,
    license_number: r.license_number || null,
    status: r.current_status || null,
    expiration: r.type ? String(r.type).slice(0, 10) : null, // dataset ships expiry under "type"
    plate: r.dmv_license_plate_number || null,
    vin: r.vehicle_vin_number || null,
    vehicle_year: r.model_year || null,
    base_name: r.agent_name || null,
    base_phone: null,
    base_address: null,
  };
}

// ── Adapter: NHTSA vPIC VIN decode (keyless, federal) ──────────────────────

export async function decodeVin(vin: string, timeoutMs = 7000): Promise<VinDecode | null> {
  const clean = vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "");
  if (clean.length !== 17) return null;
  const data = await getJson<{ Results?: Record<string, string>[] }>(
    `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${clean}?format=json`,
    timeoutMs,
  );
  const r = data?.Results?.[0];
  if (!r || !(r.Make || r.Model)) return null;
  return {
    vin: clean,
    make: r.Make || "",
    model: r.Model || "",
    year: r.ModelYear || "",
    body_class: r.BodyClass || "",
    manufacturer: r.Manufacturer || "",
    plant_country: r.PlantCountry || "",
  };
}

// ── Cross-checks ───────────────────────────────────────────────────────────

const STOP_VEH = new Set(["car", "sedan", "suv", "the", "and"]);

function vehicleTokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP_VEH.has(t));
}

/**
 * A licensee whose given name is not the name the app showed is the single most
 * actionable thing this module can find. It is reported as a fact about the
 * documents, not as an accusation: fleet-owned cars legitimately carry a
 * company licensee, and only a *person* mismatch warrants the high flag.
 */
function crossCheck(
  records: RegistryRecord[],
  vin: VinDecode | null,
  disclosedName: string | null,
  disclosedVehicle: string | null,
): { flags: RegistryFlag[]; bestName: string | null; confidence: number } {
  const flags: RegistryFlag[] = [];
  const person = records.find((r) => r.person_name);
  const firstDisclosed = (disclosedName || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
  let bestName: string | null = person?.person_name ?? null;
  let confidence = 0;

  if (person?.person_name) {
    const regFirst = person.person_name.split(/\s+/)[0].toLowerCase();
    if (!firstDisclosed) {
      confidence = 0.7;
      flags.push({
        code: "REGISTRY_LICENSEE",
        severity: "info",
        detail: `Regulator binds this plate to ${person.person_name}. No app-disclosed name was captured to verify it against.`,
        evidence: `${person.source} — licence ${person.license_number ?? "n/a"}`,
      });
    } else if (regFirst === firstDisclosed) {
      confidence = 0.95;
      flags.push({
        code: "REGISTRY_NAME_MATCH",
        severity: "info",
        detail: `Licensed operator ${person.person_name} matches the first name shown in the app.`,
        evidence: `${person.source} — plate ${person.plate}, licence ${person.license_number ?? "n/a"}`,
      });
    } else {
      confidence = 0.6;
      flags.push({
        code: "REGISTRY_NAME_MISMATCH",
        severity: "high",
        detail: `The app says "${disclosedName}" but this plate is licensed to ${person.person_name}. Either the wrong car pulled up or an unlicensed person is driving it. Confirm the plate and the driver's face against the app before boarding.`,
        evidence: `${person.source} — plate ${person.plate}, licensee "${person.raw_name}"`,
      });
    }
  }

  const entityOnly = records.length > 0 && !person;
  if (entityOnly) {
    const e = records[0];
    flags.push({
      code: "REGISTRY_FLEET_VEHICLE",
      severity: "info",
      detail: `This plate is licensed to the fleet entity "${e.raw_name}", not to an individual, so the regulator does not name the person at the wheel.`,
      evidence: `${e.source} — licence ${e.license_number ?? "n/a"}`,
    });
  }

  for (const r of records) {
    if (r.status && !/^(ACTIVE|CUR)/i.test(r.status)) {
      flags.push({
        code: "LICENCE_NOT_ACTIVE",
        severity: "high",
        detail: `The for-hire licence on this vehicle is recorded as "${r.status}" rather than active.`,
        evidence: `${r.source} — plate ${r.plate}`,
      });
    }
    if (r.expiration) {
      const exp = Date.parse(r.expiration);
      if (Number.isFinite(exp) && exp < Date.now()) {
        flags.push({
          code: "LICENCE_EXPIRED",
          severity: "high",
          detail: `The vehicle's for-hire licence expired on ${r.expiration}.`,
          evidence: `${r.source} — plate ${r.plate}`,
        });
      }
    }
  }

  if (vin && disclosedVehicle) {
    const declared = vehicleTokens(disclosedVehicle);
    const decoded = vehicleTokens(`${vin.make} ${vin.model}`);
    const overlap = declared.some((t) => decoded.some((d) => d.includes(t) || t.includes(d)));
    if (declared.length && decoded.length && !overlap) {
      flags.push({
        code: "VEHICLE_MISMATCH",
        severity: "high",
        detail: `The app describes a ${disclosedVehicle}, but the VIN registered to this plate decodes to a ${vin.year} ${vin.make} ${vin.model}. Do not board until the car matches.`,
        evidence: `NHTSA vPIC decode of VIN ${vin.vin} (registry-sourced)`,
      });
      confidence = Math.min(confidence, 0.5);
    } else if (overlap) {
      flags.push({
        code: "VEHICLE_CONFIRMED",
        severity: "info",
        detail: `The car matches the registered VIN: ${vin.year} ${vin.make} ${vin.model}.`,
        evidence: `NHTSA vPIC decode of VIN ${vin.vin}`,
      });
    }
  }

  return { flags, bestName, confidence };
}

// ── Public entry ───────────────────────────────────────────────────────────

function looksNyc(city: string | null | undefined, plate: string): boolean {
  const c = (city || "").toLowerCase();
  if (NYC_PLATE_RE.test(plate)) return true;
  return /new york|nyc|manhattan|brooklyn|queens|bronx|staten island|jfk|laguardia|newark/.test(c);
}

/**
 * Deterministic registry resolution for a plate. Returns `covered: false` when
 * no regulator in our adapter set publishes for this jurisdiction — the caller
 * uses that to decide whether probabilistic web recombination is even worth
 * running, instead of presenting spam as an identity.
 */
export async function resolveFromRegistries(input: {
  plate?: string | null;
  city?: string | null;
  driver_name?: string | null;
  vehicle?: string | null;
}, budgetMs = 12_000): Promise<RegistryResult> {
  const plateRaw = (input.plate || "").trim();
  const plate = normPlateStrict(plateRaw);
  const queried: string[] = [];

  if (!plate) {
    return {
      records: [], vin: null, flags: [], best_name: null, confidence: 0,
      covered: false, queried,
      block: "### Regulator registry check\nNo plate was captured, so the licensing register could not be queried. The plate is the only field that uniquely identifies this car — read it off the vehicle and add it.",
    };
  }

  const perCall = Math.max(4000, Math.floor(budgetMs / 3));
  const records: RegistryRecord[] = [];
  let covered = false;

  if (looksNyc(input.city, plate)) {
    covered = true;
    queried.push("NYC TLC FHV (8wbx-tsch)", "NYC TLC Medallion (rhe8-mgbb)");
    const [fhv, med] = await Promise.allSettled([
      nycSocrata(NYC_FHV, plate, perCall),
      nycSocrata(NYC_MEDALLION, plate, perCall),
    ]);
    if (fhv.status === "fulfilled") records.push(...fhv.value.map(fromNycFhv));
    if (med.status === "fulfilled") records.push(...med.value.map(fromNycMedallion));
  }

  const vinStr = records.find((r) => r.vin)?.vin;
  const vin = vinStr ? await decodeVin(vinStr, perCall) : null;
  if (vinStr) queried.push("NHTSA vPIC VIN decode");

  const { flags, bestName, confidence } = crossCheck(records, vin, input.driver_name ?? null, input.vehicle ?? null);

  // ── Evidence block ───────────────────────────────────────────────────────
  const lines: string[] = ["### Regulator registry check (primary source, deterministic)"];
  if (!covered) {
    lines.push(
      `Plate ${plateRaw}: no open for-hire licensing register is published for this jurisdiction${input.city ? ` (${input.city})` : ""}, and state DMV registration is closed under the DPPA.`,
      "Treat any surname that appears below from open-web material as unverified recombination, never as a registry fact.",
    );
  } else if (!records.length) {
    lines.push(
      `Plate ${plateRaw}: queried ${queried.join(", ")} — no active for-hire licence is on file for this plate.`,
      "For a ride that was actually dispatched by a platform, an absent licence is itself a finding: the car may be operating outside the for-hire register.",
    );
  } else {
    lines.push(`Plate ${plateRaw}: ${records.length} authoritative record(s).`);
    for (const r of records) {
      lines.push(
        `- ${r.source}`,
        `  licensee: ${r.raw_name}${r.person_name ? ` (person: ${r.person_name})` : " (entity)"}`,
        `  licence: ${r.license_type ?? "n/a"} #${r.license_number ?? "n/a"} — status ${r.status ?? "n/a"}, expires ${r.expiration ?? "n/a"}`,
        `  vehicle: ${r.vehicle_year ?? ""} VIN ${r.vin ?? "n/a"}${r.base_name ? `, base ${r.base_name}` : ""}${r.base_phone ? ` ${r.base_phone}` : ""}`,
        `  source: ${r.source_url}`,
      );
    }
  }
  if (vin) {
    lines.push("", `VIN decode (NHTSA vPIC): ${vin.year} ${vin.make} ${vin.model} — ${vin.body_class}, built by ${vin.manufacturer} in ${vin.plant_country}.`);
  }
  if (flags.length) {
    lines.push("", "Registry cross-checks:");
    for (const f of flags) lines.push(`- [${f.severity.toUpperCase()}] ${f.code}: ${f.detail} (${f.evidence})`);
  }
  if (bestName) {
    lines.push(
      "",
      `REGISTRY-BOUND IDENTITY: ${bestName} at binding confidence ${confidence.toFixed(2)}. This name came from a government licensing register keyed on the plate, not from open-web inference — prefer it over any probabilistic candidate below.`,
    );
  }

  return { records, vin, flags, best_name: bestName, confidence, covered, queried, block: lines.join("\n") };
}
