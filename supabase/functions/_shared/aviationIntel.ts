/**
 * AVIATION INTEL — the airframe is the identity.
 *
 * NARRATIVE
 * For a car, the safety question is "who is this human". For an aircraft it is
 * not: crew are anonymous, licensed to a far higher standard, and speculating
 * about them would be both useless and defamatory. What matters, and what is
 * genuinely public, is the machine and the operator — which registration is
 * flying this designator, who holds it, what type it is, where it actually is
 * right now, and whether the route it is flying matches the ticket.
 *
 * FLAWS FOUND
 *  1. The obvious source (the FAA registry web form) is edge-blocked to
 *     server-side clients — it returns 403, and a resolver that depends on it
 *     silently degrades to "unresolved" forever. Verified before adoption.
 *  2. OpenSky's anonymous API now refuses unauthenticated state queries, so it
 *     cannot be a hard dependency either. Verified before adoption.
 *  3. A designator is IATA on a ticket ("UA1") and ICAO on the wire ("UAL1").
 *     Querying ADS-B with the ticket string returns nothing and looks like an
 *     absent aircraft rather than a translation failure.
 *  4. "No ADS-B contact" is not a red flag. A flight that has not pushed back
 *     is not broadcasting. Absence must degrade the dossier, never escalate it.
 *
 * REWRITTEN NARRATIVE
 * Two keyless, live-verified primary sources: adsb.lol for real-time airframe
 * state keyed on callsign or registration, and hexdb.io for the registration →
 * owner/type binding and the published route for a callsign. Both are fetched
 * against a fixed host allow-list, timeboxed, size-capped and failure-isolated.
 * Every derived flag cites the source that produced it, and the absence of a
 * source is reported as a gap, never as a finding.
 */

export interface AircraftState {
  hex: string | null;
  registration: string | null;
  type: string | null;
  callsign: string | null;
  lat: number | null;
  lon: number | null;
  alt_baro: number | null;
  ground_speed_kt: number | null;
  squawk: string | null;
  emergency: string | null;
  seen_pos_sec: number | null;
}

export interface AirframeRecord {
  registration: string | null;
  hex: string | null;
  manufacturer: string | null;
  type: string | null;
  owner: string | null;
  operator_flag: string | null;
  source_url: string;
}

export interface AviationFlag {
  code: string;
  severity: "info" | "warn" | "high";
  detail: string;
  evidence: string;
}

export interface AviationDossier {
  designator: string | null;
  icao_callsign: string | null;
  state: AircraftState | null;
  airframe: AirframeRecord | null;
  published_route: { from: string; to: string; source_url: string } | null;
  flags: AviationFlag[];
  queried: string[];
  gaps: string[];
  block: string;
}

// ── Fetch discipline ───────────────────────────────────────────────────────

/** Fixed allow-list. No caller-supplied host ever reaches fetch(). */
const HOSTS = {
  adsb: "https://api.adsb.lol",
  hexdb: "https://hexdb.io",
} as const;

const UA = "AsherinTransitGuardian/1.0 (traveller-safety; open-data)";
const MAX_BYTES = 512_000;

async function getJson<T>(url: string, timeoutMs = 8000): Promise<T | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      redirect: "error",
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const text = (await res.text()).slice(0, MAX_BYTES);
    return JSON.parse(text) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Designator translation ─────────────────────────────────────────────────

/**
 * ADS-B carries the ICAO callsign, tickets carry the IATA designator. Only
 * carriers we can translate deterministically are translated; an unknown
 * prefix is reported as a gap rather than guessed at, because a wrong callsign
 * silently resolves to another airline's aircraft.
 */
const IATA_TO_ICAO: Record<string, string> = {
  DL: "DAL", UA: "UAL", AA: "AAL", WN: "SWA", B6: "JBU", AS: "ASA", NK: "NKS",
  F9: "FFT", AC: "ACA", BA: "BAW", LH: "DLH", AF: "AFR", KL: "KLM", EK: "UAE",
  QR: "QTR", TK: "THY", IB: "IBE", FR: "RYR", U2: "EZY", NH: "ANA", JL: "JAL",
  SQ: "SIA", QF: "QFA", VS: "VIR", EI: "EIN", SK: "SAS", LX: "SWR", OS: "AUA",
  AZ: "ITY", TP: "TAP", LO: "LOT", AY: "FIN", SU: "AFL", CX: "CPA", KE: "KAL",
  OZ: "AAR", CI: "CAL", BR: "EVA", TG: "THA", MH: "MAS", GA: "GIA", ET: "ETH",
  SA: "SAA", MS: "MSR", SV: "SVA", AI: "AIC", "6E": "IGO", WS: "WJA", PD: "POE",
};

export function toIcaoCallsign(designator: string): string | null {
  const m = designator.toUpperCase().replace(/\s+/g, "").match(/^([A-Z0-9]{2})(\d{1,4})([A-Z]?)$/);
  if (!m) return null;
  const icao = IATA_TO_ICAO[m[1]];
  if (!icao) return null;
  return `${icao}${parseInt(m[2], 10)}${m[3]}`;
}

// ── Primary lookups ────────────────────────────────────────────────────────

interface AdsbAircraft {
  hex?: string; r?: string; t?: string; flight?: string;
  lat?: number; lon?: number; alt_baro?: number | string; gs?: number;
  squawk?: string; emergency?: string; seen_pos?: number;
}

function toState(ac: AdsbAircraft): AircraftState {
  const alt = typeof ac.alt_baro === "number" ? ac.alt_baro : null;
  return {
    hex: ac.hex?.toUpperCase() ?? null,
    registration: ac.r?.trim().toUpperCase() ?? null,
    type: ac.t?.trim() ?? null,
    callsign: ac.flight?.trim() ?? null,
    lat: typeof ac.lat === "number" ? ac.lat : null,
    lon: typeof ac.lon === "number" ? ac.lon : null,
    alt_baro: alt,
    ground_speed_kt: typeof ac.gs === "number" ? Math.round(ac.gs) : null,
    squawk: ac.squawk ?? null,
    emergency: ac.emergency && ac.emergency !== "none" ? ac.emergency : null,
    seen_pos_sec: typeof ac.seen_pos === "number" ? Math.round(ac.seen_pos) : null,
  };
}

export async function stateByCallsign(callsign: string): Promise<AircraftState | null> {
  const safe = callsign.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (safe.length < 3) return null;
  const data = await getJson<{ ac?: AdsbAircraft[] }>(`${HOSTS.adsb}/v2/callsign/${safe}`);
  const ac = data?.ac?.[0];
  return ac ? toState(ac) : null;
}

export async function stateByRegistration(reg: string): Promise<AircraftState | null> {
  const safe = reg.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 10);
  if (safe.length < 3) return null;
  const data = await getJson<{ ac?: AdsbAircraft[] }>(`${HOSTS.adsb}/v2/registration/${safe}`);
  const ac = data?.ac?.[0];
  return ac ? toState(ac) : null;
}

interface HexdbAircraft {
  ModeS?: string; Registration?: string; Manufacturer?: string;
  ICAOTypeCode?: string; Type?: string; RegisteredOwners?: string; OperatorFlagCode?: string;
}

export async function airframeByHex(hex: string): Promise<AirframeRecord | null> {
  const safe = hex.toUpperCase().replace(/[^A-F0-9]/g, "").slice(0, 6);
  if (safe.length !== 6) return null;
  const url = `${HOSTS.hexdb}/api/v1/aircraft/${safe}`;
  const d = await getJson<HexdbAircraft>(url);
  if (!d || !d.Registration) return null;
  return {
    registration: d.Registration?.toUpperCase() ?? null,
    hex: d.ModeS?.toUpperCase() ?? safe,
    manufacturer: d.Manufacturer ?? null,
    type: d.Type ?? d.ICAOTypeCode ?? null,
    owner: d.RegisteredOwners ?? null,
    operator_flag: d.OperatorFlagCode ?? null,
    source_url: url,
  };
}

export async function routeByCallsign(callsign: string): Promise<{ from: string; to: string; source_url: string } | null> {
  const safe = callsign.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (safe.length < 3) return null;
  const url = `${HOSTS.hexdb}/api/v1/route/icao/${safe}`;
  const d = await getJson<{ route?: string }>(url);
  const parts = d?.route?.split("-").map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (!parts || parts.length < 2) return null;
  return { from: parts[0], to: parts[parts.length - 1], source_url: url };
}

// ── ICAO ↔ IATA airport reconciliation ─────────────────────────────────────

/**
 * hexdb publishes ICAO airport codes (KSFO), tickets print IATA (SFO). A naive
 * string compare marks every correct route as a mismatch. For the common case
 * the ICAO code is the IATA code with a single regional prefix letter, so the
 * comparison is made on that suffix and is skipped entirely when the shapes do
 * not permit a safe reduction.
 */
export function airportCodesAgree(icaoOrIata: string, iata: string): boolean | null {
  const a = icaoOrIata.toUpperCase();
  const b = iata.toUpperCase();
  if (a === b) return true;
  if (a.length === 4 && b.length === 3) {
    if (/^[KCP]/.test(a)) return a.slice(1) === b; // North America: reducible
    return null; // Elsewhere ICAO is not a prefixed IATA — cannot compare
  }
  return null;
}

// ── Dossier ────────────────────────────────────────────────────────────────

/**
 * Assemble everything knowable about an air or rotorcraft leg from keyless
 * primary sources. Never throws: any dead source thins the dossier.
 */
export async function aviationDossier(input: {
  designator?: string | null;
  registration?: string | null;
  ticket_from?: string | null;
  ticket_to?: string | null;
}): Promise<AviationDossier> {
  const flags: AviationFlag[] = [];
  const queried: string[] = [];
  const gaps: string[] = [];

  const designator = input.designator?.toUpperCase().replace(/\s+/g, "") ?? null;
  const icao = designator ? toIcaoCallsign(designator) : null;
  if (designator && !icao) gaps.push(`No ICAO translation for carrier prefix "${designator.slice(0, 2)}" — live position not queried.`);

  let state: AircraftState | null = null;
  if (input.registration) {
    queried.push("adsb.lol/registration");
    state = await stateByRegistration(input.registration);
  }
  if (!state && icao) {
    queried.push("adsb.lol/callsign");
    state = await stateByCallsign(icao);
  }
  if (!state) gaps.push("No live ADS-B contact — the aircraft is not airborne or not in receiver coverage. This is normal before pushback and is not a safety signal.");

  let airframe: AirframeRecord | null = null;
  const hex = state?.hex ?? null;
  if (hex) {
    queried.push("hexdb.io/aircraft");
    airframe = await airframeByHex(hex);
  }
  if (!airframe) gaps.push("Airframe owner/type not resolved — registry binding requires a live Mode-S contact.");

  let published_route: AviationDossier["published_route"] = null;
  if (icao) {
    queried.push("hexdb.io/route");
    published_route = await routeByCallsign(icao);
  }

  // ── Deterministic findings ──
  if (state?.emergency) {
    flags.push({
      code: "EMERGENCY_SQUAWK",
      severity: "high",
      detail: `Aircraft is transmitting an emergency condition (${state.emergency}).`,
      evidence: `adsb.lol emergency=${state.emergency}, squawk=${state.squawk ?? "n/a"}`,
    });
  } else if (state?.squawk && ["7500", "7600", "7700"].includes(state.squawk)) {
    flags.push({
      code: "EMERGENCY_SQUAWK",
      severity: "high",
      detail: `Aircraft is squawking ${state.squawk}, an emergency code.`,
      evidence: `adsb.lol squawk=${state.squawk}`,
    });
  }

  if (input.registration && state?.registration && input.registration.toUpperCase() !== state.registration) {
    flags.push({
      code: "REGISTRATION_MISMATCH",
      severity: "warn",
      detail: `The ticket names ${input.registration.toUpperCase()} but the aircraft answering this flight is ${state.registration}. An equipment swap is routine; verify at the gate if it matters to you.`,
      evidence: `ticket=${input.registration.toUpperCase()} adsb=${state.registration}`,
    });
  }

  if (published_route && input.ticket_from && input.ticket_to) {
    const fromAgrees = airportCodesAgree(published_route.from, input.ticket_from);
    const toAgrees = airportCodesAgree(published_route.to, input.ticket_to);
    if (fromAgrees === false || toAgrees === false) {
      flags.push({
        code: "ROUTE_MISMATCH",
        severity: "warn",
        detail: `Published route for this designator is ${published_route.from}→${published_route.to}, the ticket reads ${input.ticket_from}→${input.ticket_to}. Confirm you are on the right service.`,
        evidence: published_route.source_url,
      });
    } else if (fromAgrees === null || toAgrees === null) {
      gaps.push("Published route uses ICAO codes that cannot be safely reduced to the ticket's IATA codes — route not cross-checked.");
    }
  }

  if (airframe?.owner) {
    flags.push({
      code: "AIRFRAME_RESOLVED",
      severity: "info",
      detail: `Airframe ${airframe.registration ?? "?"} (${airframe.type ?? "type unknown"}) is registered to ${airframe.owner}.`,
      evidence: airframe.source_url,
    });
  }

  return {
    designator,
    icao_callsign: icao,
    state,
    airframe,
    published_route,
    flags,
    queried,
    gaps,
    block: renderBlock({ designator, icao, state, airframe, published_route, flags, gaps }),
  };
}

function renderBlock(d: {
  designator: string | null;
  icao: string | null;
  state: AircraftState | null;
  airframe: AirframeRecord | null;
  published_route: { from: string; to: string } | null;
  flags: AviationFlag[];
  gaps: string[];
}): string {
  const lines: string[] = ["AIRFRAME & FLIGHT CHECK (primary sources: adsb.lol, hexdb.io)"];
  lines.push(`Designator: ${d.designator ?? "(none)"}${d.icao ? ` (ICAO ${d.icao})` : ""}`);
  if (d.state) {
    lines.push(
      `Live contact: reg ${d.state.registration ?? "?"}, type ${d.state.type ?? "?"}, ` +
      `${d.state.alt_baro !== null ? `${d.state.alt_baro} ft` : "altitude unknown"}, ` +
      `${d.state.ground_speed_kt !== null ? `${d.state.ground_speed_kt} kt` : "speed unknown"}` +
      `${d.state.lat !== null && d.state.lon !== null ? `, at ${d.state.lat.toFixed(3)}/${d.state.lon.toFixed(3)}` : ""}` +
      `${d.state.seen_pos_sec !== null ? `, ${d.state.seen_pos_sec}s old` : ""}`,
    );
  }
  if (d.airframe) {
    lines.push(`Registry: ${d.airframe.registration ?? "?"} — ${d.airframe.manufacturer ?? "?"} ${d.airframe.type ?? ""} — held by ${d.airframe.owner ?? "unknown holder"}`);
  }
  if (d.published_route) lines.push(`Published route: ${d.published_route.from} → ${d.published_route.to}`);
  for (const f of d.flags) lines.push(`[${f.severity.toUpperCase()}] ${f.code}: ${f.detail} (${f.evidence})`);
  for (const g of d.gaps) lines.push(`GAP: ${g}`);
  return lines.join("\n");
}
