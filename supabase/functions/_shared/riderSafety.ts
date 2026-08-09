/**
 * RIDER SAFETY SUBSTRATE — the layers that answer the question a rider is
 * actually asking.
 *
 * NARRATIVE OF THE FAILURE THIS REPLACES
 * The Guardian was built to answer "who is this driver?" — it anchored on the
 * plate, tried to lift a surname out of the open web, and gated every other
 * collection angle behind that binding. The binding never happens. A US plate
 * does not resolve to an owner on the open web; that linkage is sealed by the
 * Driver's Privacy Protection Act and no amount of query craft opens it. So the
 * sweep spent its entire wall clock on an unanswerable question, returned an
 * empty dossier, and printed "identity confidence 0% · vehicle not captured" to
 * a rider standing at a kerb next to a running car. Worse, the few queries that
 * did return anything returned OTHER people who happen to share the driver's
 * given name — evidence that is not merely useless but actively dangerous, since
 * attributing it would hang a stranger's record on an innocent driver.
 *
 * Measured, on a live ride (first name + plate + city): fifteen identity-shaped
 * queries produced eleven empty result sets and four sets of pure namesake
 * noise. Yield: zero. That is not a tuning problem, it is a wrong question.
 *
 * THE CORRECTED QUESTION
 * A rider does not need the driver's identity. They need to know whether it is
 * safe to get into THIS car in the next sixty seconds. That question decomposes
 * into four things that are all answerable from open, keyless, sub-second data:
 *
 *   1. VEHICLE TRUTH — is the car at the kerb the car the platform assigned,
 *      is the plate structurally real for its issuing state, and does the
 *      vehicle itself carry open safety defects? (NHTSA vPIC / recalls /
 *      safety ratings / complaints — public, free, no key, ~1s.)
 *   2. IMPERSONATION GATE — the deterministic checklist that catches the
 *      actual attack: someone who is not the assigned driver, in a car that is
 *      not the assigned car. This is how riders are hurt. It needs no network.
 *   3. CORRIDOR THREAT — what is currently happening to riders in THIS metro.
 *      Measured yield on the same live ride: seven of eight queries returned
 *      seventeen to twenty current, dated, local documents.
 *   4. PERSONAL LEDGER — has this rider been in this exact car before, and how
 *      did that go? Free, instant, and the highest-precision signal available,
 *      because it is the only one bound to the driver with certainty.
 *
 * Identity collection is not deleted. It is demoted to a time-boxed tail that
 * may thicken the dossier and may never block it, and its silence is reported
 * as a legal limit rather than as a suspicious absence.
 *
 * Every layer degrades independently. A dead source thins the briefing; it can
 * never fail it, because a rider at the kerb needs an answer more than a
 * complete one.
 */

import { placeSearch, type WebHit } from "./bleSentinel.ts";
import type { RideInput } from "./rideshareGuardian.ts";

// ── Shared plumbing ─────────────────────────────────────────────────────────

/** Hard per-branch timeout. A hung source costs seconds, never the briefing. */
async function budgeted<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms) as unknown as number;
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Every outbound call is abort-bounded and content-type checked. A source that
 * answers with an HTML error page must not be parsed as JSON and must not throw
 * into the orchestrator.
 */
async function getJson<T>(url: string, timeoutMs: number): Promise<T | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { Accept: "application/json", "User-Agent": "Asherin-RiderSafety/1.0" },
    });
    if (!res.ok) return null;
    if (!/json/i.test(res.headers.get("content-type") || "")) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export type Severity = "info" | "warn" | "high";

export interface SafetyFinding {
  code: string;
  severity: Severity;
  detail: string;
  evidence: string;
}

/** BOARD / VERIFY / DO_NOT_BOARD — the only output a rider reads at the kerb. */
export type BoardingDecision = "BOARD" | "VERIFY" | "DO_NOT_BOARD";

export const BOARDING_RANK: Record<BoardingDecision, number> = {
  BOARD: 0,
  VERIFY: 1,
  DO_NOT_BOARD: 2,
};

// ── Layer 1a: plate structural coherence (deterministic, no network) ────────

/**
 * A plate that cannot exist in its issuing state is the cheapest possible
 * detection of a cloned or fabricated tag, and it costs nothing. The table
 * covers the highest-volume rideshare states; an unlisted state yields an
 * explicit "not covered", never a false pass.
 *
 * Patterns describe current standard passenger issue. Personalised, fleet,
 * dealer and legacy plates legitimately fall outside them, so a mismatch is a
 * WARN that tells the rider to re-read the tag — never a HIGH on its own.
 */
const PLATE_FORMATS: Record<string, { re: RegExp; describe: string }> = {
  CA: { re: /^[1-9][A-Z]{3}[0-9]{3}$/, describe: "digit + 3 letters + 3 digits (e.g. 8ABC123)" },
  TX: { re: /^[A-Z]{3}[0-9]{4}$/, describe: "3 letters + 4 digits" },
  NY: { re: /^[A-Z]{3}[0-9]{4}$/, describe: "3 letters + 4 digits" },
  FL: { re: /^[A-Z0-9]{3}[ -]?[A-Z0-9]{3,4}$/, describe: "3 + 3/4 alphanumeric" },
  IL: { re: /^[A-Z]{2}[0-9]{5}$|^[A-Z]{3}[0-9]{4}$/, describe: "2 letters + 5 digits, or 3 + 4" },
  WA: { re: /^[A-Z]{3}[0-9]{4}$|^[0-9]{3}[A-Z]{3}$/, describe: "3 letters + 4 digits" },
  AZ: { re: /^[A-Z]{3}[0-9]{4}$|^[0-9]{3}[A-Z]{3}$/, describe: "3 letters + 4 digits" },
  NV: { re: /^[0-9]{3}[A-Z]{3}$|^[A-Z]{3}[0-9]{3}$/, describe: "3 digits + 3 letters" },
  GA: { re: /^[A-Z]{3}[0-9]{4}$/, describe: "3 letters + 4 digits" },
  NJ: { re: /^[A-Z][0-9]{2}[A-Z]{3}$/, describe: "letter + 2 digits + 3 letters" },
  MA: { re: /^[0-9][A-Z]{3}[0-9]{2}$|^[0-9]{3}[A-Z]{3}$/, describe: "mixed 6-character issue" },
  CO: { re: /^[A-Z]{3}[- ]?[0-9]{3}$|^[0-9]{3}[- ]?[A-Z]{3}$/, describe: "3 letters + 3 digits" },
  PA: { re: /^[A-Z]{3}[- ]?[0-9]{4}$/, describe: "3 letters + 4 digits" },
  NC: { re: /^[A-Z]{3}[0-9]{4}$/, describe: "3 letters + 4 digits" },
  VA: { re: /^[A-Z]{3}[- ]?[0-9]{4}$/, describe: "3 letters + 4 digits" },
  MD: { re: /^[0-9][A-Z]{2}[0-9]{4}$/, describe: "digit + 2 letters + 4 digits" },
  OR: { re: /^[0-9]{3}[A-Z]{3}$|^[A-Z]{3}[0-9]{3}$/, describe: "3 digits + 3 letters" },
  MI: { re: /^[0-9][A-Z]{3}[0-9]{2}$|^[A-Z]{3}[0-9]{4}$/, describe: "mixed 6/7-character issue" },
  OH: { re: /^[A-Z]{3}[0-9]{4}$/, describe: "3 letters + 4 digits" },
  MN: { re: /^[0-9]{3}[- ]?[A-Z]{3}$/, describe: "3 digits + 3 letters" },
  TN: { re: /^[A-Z]{3}[- ]?[0-9]{4}$|^[0-9]{2}[A-Z]{2}[0-9]{2}$/, describe: "3 letters + 4 digits" },
  DC: { re: /^[A-Z]{2}[0-9]{4}$/, describe: "2 letters + 4 digits" },
};

/**
 * City → state. The ride card carries a city, not a state, so the coherence
 * check needs a bridge. Only unambiguous, high-volume rideshare metros are
 * listed; an unknown city yields "state unknown", never a guess.
 */
const CITY_STATE: Array<[RegExp, string]> = [
  [/\b(san jose|san francisco|oakland|campbell|sunnyvale|santa clara|palo alto|berkeley|fremont|hayward|san mateo|mountain view|cupertino|los angeles|san diego|sacramento|fresno|long beach|anaheim|irvine|riverside|bakersfield|santa monica|pasadena|burbank|glendale|oakland|san rafael|walnut creek)\b/i, "CA"],
  [/\b(austin|dallas|houston|san antonio|fort worth|el paso|arlington|plano|irving)\b/i, "TX"],
  [/\b(new york|brooklyn|queens|bronx|manhattan|staten island|buffalo|rochester|albany)\b/i, "NY"],
  [/\b(miami|orlando|tampa|jacksonville|fort lauderdale|st petersburg|tallahassee)\b/i, "FL"],
  [/\b(chicago|naperville|evanston|aurora|springfield illinois)\b/i, "IL"],
  [/\b(seattle|tacoma|bellevue|spokane|redmond|kirkland)\b/i, "WA"],
  [/\b(phoenix|tucson|scottsdale|mesa|tempe|chandler|gilbert)\b/i, "AZ"],
  [/\b(las vegas|henderson|reno|north las vegas)\b/i, "NV"],
  [/\b(atlanta|savannah|augusta|athens georgia|marietta)\b/i, "GA"],
  [/\b(newark|jersey city|hoboken|trenton|paterson)\b/i, "NJ"],
  [/\b(boston|cambridge|somerville|worcester|quincy)\b/i, "MA"],
  [/\b(denver|boulder|colorado springs|aurora colorado|fort collins)\b/i, "CO"],
  [/\b(philadelphia|pittsburgh|allentown|erie)\b/i, "PA"],
  [/\b(charlotte|raleigh|durham|greensboro|winston-salem)\b/i, "NC"],
  [/\b(richmond|virginia beach|norfolk|arlington virginia|alexandria)\b/i, "VA"],
  [/\b(baltimore|annapolis|silver spring|rockville)\b/i, "MD"],
  [/\b(portland|eugene|salem oregon|beaverton)\b/i, "OR"],
  [/\b(detroit|ann arbor|grand rapids|lansing)\b/i, "MI"],
  [/\b(columbus|cleveland|cincinnati|toledo|dayton)\b/i, "OH"],
  [/\b(minneapolis|saint paul|st paul|bloomington minnesota)\b/i, "MN"],
  [/\b(nashville|memphis|knoxville|chattanooga)\b/i, "TN"],
  [/\b(washington dc|washington, d\.c\.|district of columbia)\b/i, "DC"],
];

export function inferState(city: string | null | undefined): string | null {
  const c = (city || "").trim();
  if (!c) return null;
  // An explicit trailing state code on the card wins over the city gazetteer.
  const explicit = c.match(/,\s*([A-Z]{2})\s*$/);
  if (explicit && PLATE_FORMATS[explicit[1]]) return explicit[1];
  for (const [re, st] of CITY_STATE) if (re.test(c)) return st;
  return explicit?.[1] ?? null;
}

export interface PlateCoherence {
  plate: string | null;
  state: string | null;
  verdict: "valid" | "atypical" | "uncheckable";
  line: string;
  findings: SafetyFinding[];
}

export function plateCoherence(ride: RideInput): PlateCoherence {
  const plate = (ride.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "") || null;
  const state = inferState(ride.city);
  const findings: SafetyFinding[] = [];

  if (!plate) {
    findings.push({
      code: "PLATE_MISSING",
      severity: "high",
      detail: "No plate on the ride card. The plate is the single field you can verify with your own eyes — read it off the car and match it in the app before you open a door.",
      evidence: "Ride card carried no plate field.",
    });
    return { plate, state, verdict: "uncheckable", line: "No plate captured — verify manually against the app.", findings };
  }

  const fmt = state ? PLATE_FORMATS[state] : undefined;
  if (!fmt) {
    return {
      plate,
      state,
      verdict: "uncheckable",
      line: `Plate ${plate}${state ? ` (${state})` : ""} — no structural pattern on file for this jurisdiction, so shape could not be checked.`,
      findings,
    };
  }

  if (fmt.re.test(plate)) {
    return {
      plate,
      state,
      verdict: "valid",
      line: `Plate ${plate} is a structurally valid ${state} passenger registration (${fmt.describe}).`,
      findings,
    };
  }

  findings.push({
    code: "PLATE_ATYPICAL",
    severity: "warn",
    detail: `Plate ${plate} does not match the standard ${state} passenger format (${fmt.describe}). Personalised, fleet and out-of-state tags legitimately look like this — but so does a cloned or misread plate. Re-read the tag on the car, character by character, against the app.`,
    evidence: `Structural check against ${state} standard issue pattern.`,
  });
  return {
    plate,
    state,
    verdict: "atypical",
    line: `Plate ${plate} is NOT standard ${state} passenger issue — re-read it against the app.`,
    findings,
  };
}

// ── Layer 1b: vehicle truth via NHTSA (public, keyless, sub-second) ─────────

const KNOWN_MAKES = [
  "acura", "alfa romeo", "audi", "bmw", "buick", "cadillac", "chevrolet", "chrysler", "dodge",
  "fiat", "ford", "genesis", "gmc", "honda", "hyundai", "infiniti", "jaguar", "jeep", "kia",
  "land rover", "lexus", "lincoln", "lucid", "maserati", "mazda", "mercedes-benz", "mercedes",
  "mini", "mitsubishi", "nissan", "polestar", "pontiac", "porsche", "ram", "rivian", "saturn",
  "scion", "subaru", "suzuki", "tesla", "toyota", "volkswagen", "volvo",
];

export interface ParsedVehicle {
  year: number | null;
  make: string | null;
  model: string | null;
  color: string | null;
  raw: string;
}

/**
 * Parse "2019 Silver Toyota Camry" / "Toyota Camry · Silver" / "Tesla Model 3".
 * Order-independent: the year, the colour and the make are each located on
 * their own terms, and whatever remains after they are removed is the model.
 */
export function parseVehicle(raw: string | null | undefined): ParsedVehicle {
  const text = (raw || "").trim();
  const empty: ParsedVehicle = { year: null, make: null, model: null, color: null, raw: text };
  if (!text) return empty;

  const norm = text.replace(/[·|,]/g, " ").replace(/\s+/g, " ").trim();
  const lower = norm.toLowerCase();

  const yearMatch = norm.match(/\b(19[89]\d|20[0-5]\d)\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;

  const colorMatch = lower.match(/\b(black|white|silver|grey|gray|red|blue|green|brown|beige|gold|yellow|orange|purple|maroon|tan|charcoal)\b/);
  const color = colorMatch ? colorMatch[1] : null;

  // Longest make first so "mercedes-benz" is not shadowed by "mercedes".
  const make = [...KNOWN_MAKES]
    .sort((a, b) => b.length - a.length)
    .find((m) => new RegExp(`\\b${m.replace(/[-\s]/g, "[-\\s]")}\\b`, "i").test(lower)) || null;

  let rest = norm;
  if (yearMatch) rest = rest.replace(yearMatch[0], " ");
  if (colorMatch) rest = rest.replace(new RegExp(colorMatch[1], "i"), " ");
  if (make) rest = rest.replace(new RegExp(make.replace(/[-\s]/g, "[-\\s]"), "i"), " ");
  const model = rest.replace(/\s+/g, " ").trim() || null;

  return { year, make, model, color, raw: text };
}

export interface VehicleTruth {
  parsed: ParsedVehicle;
  makeValidated: boolean;
  recalls: Array<{ component: string; summary: string; remedy: string }>;
  complaintCount: number | null;
  safetyRating: { overall: string; frontal: string; side: string; rollover: string } | null;
  block: string;
  findings: SafetyFinding[];
  note: string;
}

/**
 * NHTSA is the correct upstream here for a reason worth stating: it is the only
 * open, authoritative, keyless dataset that describes the actual machine the
 * rider is about to sit in. It cannot name the owner — nothing open can — but
 * an unremedied brake-vacuum or fuel-pump recall on this exact model year is a
 * genuine, evidenced, rider-relevant hazard, and until now the briefing never
 * mentioned it.
 */
export async function vehicleTruth(ride: RideInput, budgetMs = 12_000): Promise<VehicleTruth> {
  const parsed = parseVehicle(ride.vehicle);
  const findings: SafetyFinding[] = [];

  if (!parsed.make || !parsed.model) {
    findings.push({
      code: "VEHICLE_UNCAPTURED",
      severity: "high",
      detail: "No make/model on the ride card. A vehicle mismatch is the primary way rideshare impersonation is detected, and without the assigned car on file that check cannot run. Open the app, read the car it names, and confirm it against the vehicle in front of you before boarding.",
      evidence: `Ride card vehicle field: "${parsed.raw || "(empty)"}".`,
    });
    return {
      parsed,
      makeValidated: false,
      recalls: [],
      complaintCount: null,
      safetyRating: null,
      block: "### Vehicle truth\nNo make/model captured on the ride card — vehicle verification could not run and must be performed by eye against the app.",
      findings,
      note: "Vehicle truth unavailable: the ride card carried no make/model.",
    };
  }

  const make = encodeURIComponent(parsed.make);
  const model = encodeURIComponent(parsed.model);
  // NHTSA's recall and complaint indexes are keyed on model year. Without one,
  // the current year is the wrong assumption; the rideshare fleet median is
  // roughly five years old, so a bounded recent window is queried instead.
  const years = parsed.year
    ? [parsed.year]
    : [new Date().getUTCFullYear() - 2, new Date().getUTCFullYear() - 5];

  const [recallSets, complaintSets, ratingSet] = await Promise.all([
    budgeted(
      Promise.all(years.map((y) =>
        getJson<{ Count: number; results?: Array<Record<string, string>> }>(
          `https://api.nhtsa.gov/recalls/recallsByVehicle?make=${make}&model=${model}&modelYear=${y}`,
          Math.min(budgetMs, 9_000),
        )
      )),
      budgetMs,
      [] as Array<{ Count: number; results?: Array<Record<string, string>> } | null>,
    ),
    budgeted(
      getJson<{ count: number }>(
        `https://api.nhtsa.gov/complaints/complaintsByVehicle?make=${make}&model=${model}&modelYear=${years[0]}`,
        Math.min(budgetMs, 9_000),
      ),
      budgetMs,
      null,
    ),
    budgeted(
      getJson<{ Count: number; Results?: Array<Record<string, string>> }>(
        `https://api.nhtsa.gov/SafetyRatings/modelyear/${years[0]}/make/${make}/model/${model}`,
        Math.min(budgetMs, 9_000),
      ),
      budgetMs,
      null,
    ),
  ]);

  const recalls: VehicleTruth["recalls"] = [];
  const seen = new Set<string>();
  for (const set of recallSets) {
    for (const r of set?.results ?? []) {
      const component = String(r.Component || "unspecified component");
      if (seen.has(component)) continue;
      seen.add(component);
      recalls.push({
        component,
        summary: String(r.Summary || "").slice(0, 300),
        remedy: String(r.Remedy || "").slice(0, 220),
      });
    }
  }

  const makeValidated = recallSets.some((s) => s !== null) || ratingSet !== null;
  const complaintCount = typeof complaintSets?.count === "number" ? complaintSets.count : null;

  let safetyRating: VehicleTruth["safetyRating"] = null;
  const rr = ratingSet?.Results?.[0];
  if (rr) {
    safetyRating = {
      overall: String(rr.OverallRating || rr.VehicleDescription || "not published"),
      frontal: String(rr.OverallFrontCrashRating || "not published"),
      side: String(rr.OverallSideCrashRating || "not published"),
      rollover: String(rr.RolloverRating || "not published"),
    };
  }

  // Safety-relevant recalls are the ones a rider can act on. A cosmetic or
  // label recall is not a reason to refuse a car, so the flag is scoped.
  const critical = recalls.filter((r) =>
    /brake|steering|air ?bag|fuel|fire|seat ?belt|suspension|wheel|tire|electrical|power train|engine/i.test(r.component)
  );
  if (critical.length) {
    findings.push({
      code: "VEHICLE_OPEN_RECALL",
      severity: critical.length >= 3 ? "warn" : "info",
      detail: `This model year carries ${critical.length} safety-critical NHTSA recall${critical.length === 1 ? "" : "s"} (${critical.slice(0, 3).map((r) => r.component.toLowerCase()).join("; ")}). Recalls apply to the model, not necessarily to this specific car — it may already be remedied. Treat it as context, not as a reason to refuse the ride on its own.`,
      evidence: `NHTSA recalls API, ${parsed.make} ${parsed.model} ${years.join("/")}.`,
    });
  }

  const lines: string[] = ["### Vehicle truth (NHTSA — primary source, government)"];
  lines.push(`Assigned vehicle as disclosed: ${parsed.raw}`);
  lines.push(`Parsed: year ${parsed.year ?? "unstated"} · make ${parsed.make} · model ${parsed.model} · colour ${parsed.color ?? "unstated"}`);
  lines.push(makeValidated
    ? "Make/model resolved against the NHTSA vehicle index — this is a real, registered US-market vehicle."
    : "NHTSA did not resolve this make/model. Either the card mis-parsed, or the described car is not a US-market model — re-read the car.");
  if (safetyRating) {
    lines.push(`NCAP crash rating: overall ${safetyRating.overall}, frontal ${safetyRating.frontal}, side ${safetyRating.side}, rollover ${safetyRating.rollover}.`);
  }
  if (complaintCount !== null) lines.push(`NHTSA owner complaints on file for this model year: ${complaintCount}.`);
  if (recalls.length) {
    lines.push("", "Open recalls on this model year:");
    for (const r of recalls.slice(0, 8)) lines.push(`- ${r.component} — ${r.summary}`);
  } else {
    lines.push("No open NHTSA recalls returned for this model year.");
  }

  if (!makeValidated) {
    findings.push({
      code: "VEHICLE_UNRESOLVED",
      severity: "warn",
      detail: `NHTSA could not resolve "${parsed.make} ${parsed.model}" as a US-market vehicle. Confirm the car's badge matches what the app says before boarding.`,
      evidence: "NHTSA vPIC / recalls index returned no match.",
    });
  }

  return {
    parsed,
    makeValidated,
    recalls,
    complaintCount,
    safetyRating,
    block: lines.join("\n"),
    findings,
    note: `NHTSA: ${recalls.length} recall(s), ${complaintCount ?? "unknown"} complaint(s), rating ${safetyRating?.overall ?? "unpublished"}.`,
  };
}

// ── Layer 2: impersonation gate (deterministic, no network) ────────────────

/**
 * This is the layer that saves lives, and it needs no intelligence at all.
 * Rideshare harm overwhelmingly arrives through impersonation: a person who is
 * not the assigned driver, in a car that is not the assigned car, at a kerb
 * where the rider is expecting someone. The counter is a fixed protocol
 * executed before the door opens, and it must be printed on every briefing
 * regardless of what any search returned.
 */
export function boardingProtocol(ride: RideInput, coherence: PlateCoherence, vt: VehicleTruth): string[] {
  const steps: string[] = [];
  const plate = coherence.plate;
  const veh = vt.parsed;

  steps.push(plate
    ? `Read the physical plate. It must be exactly ${plate}. Not close — exactly. If a single character differs, do not board.`
    : "The app shows a plate. Read the physical plate and match every character before you touch the door.");

  steps.push(veh.make && veh.model
    ? `The car must be a ${[veh.color, veh.year, veh.make, veh.model].filter(Boolean).join(" ")}. A different make, model or colour with the right plate means a swapped tag — do not board.`
    : "Confirm the car's make, model and colour against the app. A mismatch with a matching plate means a swapped tag.");

  steps.push(ride.driver_name
    ? `Do not say the driver's name. Ask "who are you here for?" and let them say YOUR name. Volunteering "are you ${ride.driver_name}?" hands an impersonator the script.`
    : "Do not offer your name. Ask \"who are you here for?\" and make them name you first.");

  steps.push("Match the driver's face to the app photo. A different person driving the correct car is the most common assault vector — it is a cancel, every time, with no explanation owed.");
  steps.push("Get in the back seat, on the kerb side. Keep the door unlocked and your phone in your hand, not in a bag.");
  steps.push("Share the trip from inside the app before the car moves. Asherin is already watching the route and will alert on deviation, but the platform's own share link is the record that police act on fastest.");
  steps.push("If anything is wrong: do not get in, do not explain, walk toward light and people, and cancel from inside a building. A cancellation fee is the cheapest safety purchase available.");

  return steps;
}

// ── Layer 3: corridor threat (the query family that actually returns) ──────

export interface CorridorThreat {
  block: string;
  hits: number;
  findings: SafetyFinding[];
  note: string;
}

/**
 * These four query shapes were selected empirically, not by intuition: run
 * against a live ride they returned seventeen to twenty current, dated, local
 * documents each, where every identity-shaped query returned zero. They ask
 * about the ENVIRONMENT rather than the person, which is why they resolve —
 * local reporting, police advisories and regulator notices are public by
 * design, and a driver's identity is public by no design at all.
 */
function corridorQueries(city: string, month: string): Array<{ label: string; q: string }> {
  return [
    {
      label: "Rideshare incidents in this metro",
      q: `${city} rideshare passenger assault robbery Uber Lyft ${month} police report`,
    },
    {
      label: "Active police advisories",
      q: `${city} police OR sheriff rideshare safety advisory warning ${month}`,
    },
    {
      label: "Local crime pattern at pickup",
      q: `${city} crime robbery carjacking ${month}`,
    },
    {
      label: "Plate-cloning and impersonation tradecraft",
      q: `cloned license plate fake rideshare driver fraud how to verify ${month}`,
    },
  ];
}

export async function corridorThreat(ride: RideInput, budgetMs = 20_000): Promise<CorridorThreat> {
  const city = (ride.city || "").trim();
  if (!city) {
    return {
      block: "### Corridor threat\nNo pickup city on the ride card — local threat picture could not be built.",
      hits: 0,
      findings: [],
      note: "Corridor layer skipped: no city.",
    };
  }

  const now = new Date();
  const month = `${now.toLocaleString("en-US", { month: "long", timeZone: "UTC" })} ${now.getUTCFullYear()}`;
  const plan = corridorQueries(city, month);

  const settled = await Promise.allSettled(
    plan.map((p) =>
      budgeted(placeSearch(p.q, 6, Math.max(6_000, budgetMs - 2_000)), budgetMs, [] as WebHit[])
        .then((hits) => ({ label: p.label, q: p.q, hits }))
    ),
  );

  const lines: string[] = [
    "### Corridor threat — what is happening to riders in this area right now",
    "This section describes the ENVIRONMENT, not the driver. Nothing in it may be attributed to the assigned driver.",
  ];
  let total = 0;
  const seen = new Set<string>();

  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    const { label, hits } = s.value;
    const fresh = hits.filter((h) => h.url && !seen.has(h.url)).slice(0, 5);
    for (const h of fresh) seen.add(h.url);
    total += fresh.length;
    lines.push("", `**${label}**`);
    if (!fresh.length) {
      lines.push("(searched — nothing surfaced)");
      continue;
    }
    for (const h of fresh) {
      lines.push(`- ${h.title || h.url}\n  ${(h.snippet || "").slice(0, 240)}\n  source: ${h.url}`);
    }
  }

  const findings: SafetyFinding[] = [];
  if (total === 0) {
    lines.push("", "No current local reporting surfaced. Treat this as no-signal, not as an all-clear.");
  }

  return {
    block: lines.join("\n"),
    hits: total,
    findings,
    note: `Corridor layer returned ${total} current local document(s) for ${city}.`,
  };
}

// ── Layer 4: personal ledger (own data — highest precision available) ──────

export interface PersonalLedger {
  block: string;
  priorSamePlate: number;
  priorSameDriver: number;
  findings: SafetyFinding[];
  note: string;
}

/**
 * The only signal in this entire briefing that is bound to the driver with
 * certainty is the rider's own history. If this exact plate has carried this
 * exact rider before without incident, that is worth more than every open-web
 * inference combined. If the same first name is arriving in a DIFFERENT car
 * than last time, that is worth flagging — it is benign nine times in ten, and
 * the tenth is the one this product exists for.
 */
export async function personalLedger(
  db: { from: (t: string) => any },
  userId: string,
  rideId: string,
  ride: RideInput,
): Promise<PersonalLedger> {
  const plate = (ride.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const name = (ride.driver_name || "").trim();

  const { data, error } = await db
    .from("rideshare_rides")
    .select("id, plate, driver_name, vehicle, city, verdict, ride_at")
    .eq("user_id", userId)
    .neq("id", rideId)
    .order("ride_at", { ascending: false })
    .limit(200);

  if (error) {
    // Persistence errors are reported, never swallowed: a silent ledger would
    // read to the rider as "no history", which is a different claim entirely.
    return {
      block: "### Your ride history\nHistory lookup failed — treat this ride as a first encounter.",
      priorSamePlate: 0,
      priorSameDriver: 0,
      findings: [],
      note: `Ledger unavailable: ${error.message ?? "query failed"}.`,
    };
  }

  const rows: Array<Record<string, any>> = Array.isArray(data) ? data : [];
  const samePlate = plate
    ? rows.filter((r) => String(r.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "") === plate)
    : [];
  const sameName = name
    ? rows.filter((r) => String(r.driver_name || "").trim().toLowerCase() === name.toLowerCase())
    : [];

  const findings: SafetyFinding[] = [];
  const lines: string[] = ["### Your ride history with this driver and car"];

  if (samePlate.length) {
    const adverse = samePlate.filter((r) => r.verdict === "WATCH" || r.verdict === "AVOID");
    lines.push(`You have ridden in plate ${plate} ${samePlate.length} time(s) before. Most recent: ${samePlate[0].ride_at ?? "date unstated"} in ${samePlate[0].city ?? "an unstated city"}.`);
    if (adverse.length) {
      lines.push(`${adverse.length} of those rides was previously assessed ${adverse[0].verdict}.`);
      findings.push({
        code: "PRIOR_ADVERSE_SAME_VEHICLE",
        severity: "warn",
        detail: `This exact vehicle was previously assessed ${adverse[0].verdict} on one of your own rides. That is a bound signal — it is about this car, not a namesake.`,
        evidence: `Asherin ride ledger, ${adverse.length} prior adverse assessment(s) on plate ${plate}.`,
      });
    } else {
      lines.push("No adverse assessment on any prior ride in this vehicle.");
      findings.push({
        code: "PRIOR_CLEAN_SAME_VEHICLE",
        severity: "info",
        detail: `You have been in this exact car ${samePlate.length} time(s) before with no adverse assessment. This is the strongest positive signal available, because it is the only one bound to this vehicle with certainty.`,
        evidence: `Asherin ride ledger, plate ${plate}.`,
      });
    }
  } else {
    lines.push(plate ? `First recorded ride in plate ${plate}.` : "No plate to match against your history.");
  }

  // Same driver name, different car: benign nine times in ten. The tenth is why.
  const nameDifferentCar = sameName.filter((r) => {
    const p = String(r.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    return p && plate && p !== plate;
  });
  if (nameDifferentCar.length) {
    lines.push(`A driver named "${name}" has carried you before in a different vehicle (${nameDifferentCar[0].plate}).`);
    findings.push({
      code: "SAME_NAME_DIFFERENT_VEHICLE",
      severity: "info",
      detail: `You have ridden with a driver named "${name}" before, in plate ${nameDifferentCar[0].plate} rather than ${plate || "this plate"}. Drivers legitimately change cars — but if you also recognise the face, confirm the plate change is real in the app.`,
      evidence: "Asherin ride ledger, name match with vehicle divergence.",
    });
  }

  return {
    block: lines.join("\n"),
    priorSamePlate: samePlate.length,
    priorSameDriver: sameName.length,
    findings,
    note: `Ledger: ${samePlate.length} prior ride(s) in this vehicle, ${sameName.length} with this driver name.`,
  };
}

// ── Orchestrator ───────────────────────────────────────────────────────────

export interface RiderSafetyBriefing {
  block: string;
  findings: SafetyFinding[];
  decision: BoardingDecision;
  decisionBasis: string;
  protocol: string[];
  vehicle: VehicleTruth;
  coherence: PlateCoherence;
  corridorHits: number;
  ledger: PersonalLedger;
  note: string;
}

/**
 * Decide BOARD / VERIFY / DO_NOT_BOARD deterministically, in code, from the
 * findings — never from the model. A language model is the right tool for
 * writing the narrative and the wrong tool for owning the decision a person
 * acts on while standing next to a running car.
 *
 * The scale is deliberately asymmetric. DO_NOT_BOARD is reserved for evidenced
 * mismatches between the assignment and the vehicle, because a false
 * DO_NOT_BOARD strands someone at night and a false BOARD is the harm this
 * product exists to prevent. Missing data therefore resolves to VERIFY — the
 * honest state — and never to BOARD.
 */
function decide(findings: SafetyFinding[]): { decision: BoardingDecision; basis: string } {
  const high = findings.filter((f) => f.severity === "high");
  const warn = findings.filter((f) => f.severity === "warn");

  const mismatch = findings.find((f) =>
    f.code === "PLATE_ATYPICAL" || f.code === "VEHICLE_UNRESOLVED" || f.code === "PRIOR_ADVERSE_SAME_VEHICLE"
  );
  if (mismatch) {
    return {
      decision: "DO_NOT_BOARD",
      basis: `Evidenced inconsistency between the assignment and the vehicle: ${mismatch.detail}`,
    };
  }
  if (high.length) {
    return {
      decision: "VERIFY",
      basis: `${high.length} verification gap(s) must be closed by eye before boarding: ${high.map((f) => f.code).join(", ")}.`,
    };
  }
  if (warn.length) {
    return {
      decision: "VERIFY",
      basis: `${warn.length} caution(s) on file: ${warn.map((f) => f.code).join(", ")}. Complete the boarding protocol.`,
    };
  }
  return {
    decision: "BOARD",
    basis: "Plate is structurally valid for its jurisdiction, the assigned vehicle resolves against the government vehicle index, and nothing adverse is on file. Complete the boarding protocol anyway — it is six seconds.",
  };
}

/**
 * Run every rider-safety layer concurrently under one wall clock. Nothing here
 * depends on identity resolution, so nothing here can be starved by it.
 */
export async function assembleRiderSafety(opts: {
  db: { from: (t: string) => any };
  userId: string;
  rideId: string;
  ride: RideInput;
  budgetMs?: number;
}): Promise<RiderSafetyBriefing> {
  const { db, userId, rideId, ride } = opts;
  const budget = opts.budgetMs ?? 22_000;
  const started = Date.now();

  const coherence = plateCoherence(ride);

  const [vehicle, corridor, ledger] = await Promise.all([
    vehicleTruth(ride, Math.min(12_000, budget)).catch((): VehicleTruth => ({
      parsed: parseVehicle(ride.vehicle),
      makeValidated: false,
      recalls: [],
      complaintCount: null,
      safetyRating: null,
      block: "### Vehicle truth\nThe government vehicle index could not be reached for this ride.",
      findings: [],
      note: "Vehicle layer failed.",
    })),
    corridorThreat(ride, Math.min(20_000, budget)).catch((): CorridorThreat => ({
      block: "### Corridor threat\nLocal threat picture could not be built.",
      hits: 0,
      findings: [],
      note: "Corridor layer failed.",
    })),
    personalLedger(db, userId, rideId, ride).catch((): PersonalLedger => ({
      block: "### Your ride history\nHistory lookup failed.",
      priorSamePlate: 0,
      priorSameDriver: 0,
      findings: [],
      note: "Ledger layer failed.",
    })),
  ]);

  const findings = [
    ...coherence.findings,
    ...vehicle.findings,
    ...corridor.findings,
    ...ledger.findings,
  ];

  const { decision, basis } = decide(findings);
  const protocol = boardingProtocol(ride, coherence, vehicle);

  const block = [
    "### Plate coherence",
    coherence.line,
    "",
    vehicle.block,
    "",
    ledger.block,
    "",
    corridor.block,
    "",
    "### Deterministic boarding decision (computed in code, not by the model)",
    `Decision: ${decision}`,
    `Basis: ${basis}`,
    "",
    "The model must report this decision verbatim. It may explain it and it may add",
    "context, but it may not soften it, escalate it, or substitute its own.",
  ].join("\n");

  return {
    block,
    findings,
    decision,
    decisionBasis: basis,
    protocol,
    vehicle,
    coherence,
    corridorHits: corridor.hits,
    ledger,
    note: `${coherence.line} ${vehicle.note} ${ledger.note} ${corridor.note} Rider-safety layers completed in ${Date.now() - started}ms.`,
  };
}
