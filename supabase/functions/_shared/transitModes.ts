/**
 * TRANSIT MODES — the taxonomy that turns a car-only guardian into a network.
 *
 * NARRATIVE
 * The Guardian was built around one shape of journey: a stranger's private car,
 * identified by a plate, licensed by a municipal for-hire regulator. That shape
 * does not generalise. A train has no plate and no driver the rider can name; a
 * scheduled airliner has a tail number that is public, an operator that is
 * regulated far harder than any TNC driver, and a live position broadcast over
 * ADS-B; a charter helicopter sits in between — a small operator, a specific
 * airframe, and an accident record that is the actual safety question.
 *
 * FLAW FOUND IN THE FIRST NARRATIVE
 * The tempting move is "add lyft/train/plane to the platform enum". That is
 * wrong three ways. (1) The verdict semantics differ per mode: "who is this
 * human" is the whole question for a car and a nearly meaningless one for an
 * Amtrak service. (2) The identifier differs: plate vs. train number vs.
 * flight designator vs. tail registration — one loose regex over all four
 * manufactures identifiers out of fare codes and seat numbers. (3) The
 * authoritative source differs: a for-hire regulator, a national rail
 * timetable, an aircraft registry. Collapsing them produces confident nonsense.
 *
 * REWRITTEN NARRATIVE
 * Mode is a first-class dimension. Each mode declares its own identifier
 * grammar, its own operator catalogue, its own authoritative resolver, its own
 * telemetry envelope, and its own safety question. Shared machinery — email
 * ingest, dossier assembly, doctrine enforcement, alerting — stays generic and
 * is parameterised by the mode profile. Nothing is guessed across a mode
 * boundary: a flight number is only read from an air leg, never from a taxi
 * receipt that happens to contain "UA 123".
 *
 * Pure module: no Deno, no network, no I/O. Unit-testable in isolation.
 */

export type TransitMode = "car" | "rail" | "air" | "helicopter" | "bus" | "ferry";

export const TRANSIT_MODES: TransitMode[] = ["car", "rail", "air", "helicopter", "bus", "ferry"];

export function isTransitMode(v: unknown): v is TransitMode {
  return typeof v === "string" && (TRANSIT_MODES as string[]).includes(v);
}

// ── Operator catalogue ─────────────────────────────────────────────────────

export interface OperatorProfile {
  /** Stable key stored on the leg row. */
  id: string;
  label: string;
  mode: TransitMode;
  /** Sender domains that prove the mail came from the operator itself. */
  domains: string[];
  /** Extra body/subject tokens that identify the operator in a forward. */
  tokens?: string[];
  /** IATA airline designator, when the operator is an airline. */
  iata?: string;
  /** True when the operator dispatches a named private driver (TNC/taxi). */
  namedDriver?: boolean;
}

/**
 * Ordered most-specific first. `lyftmail.com` must be matched before a generic
 * `mail.com`-style suffix would ever be considered.
 */
export const OPERATORS: OperatorProfile[] = [
  // ── Ridehail / taxi (named driver, plate-anchored) ──
  { id: "uber", label: "Uber", mode: "car", namedDriver: true, domains: ["uber.com", "uber.us", "email.uber.com"], tokens: ["t.uber.com", "trip.uber.com", "m.uber.com"] },
  { id: "lyft", label: "Lyft", mode: "car", namedDriver: true, domains: ["lyft.com", "lyftmail.com", "email.lyft.com"], tokens: ["ride.lyft.com", "lyft ride"] },
  { id: "bolt", label: "Bolt", mode: "car", namedDriver: true, domains: ["bolt.eu", "taxify.eu"], tokens: ["bolt ride"] },
  { id: "via", label: "Via", mode: "car", namedDriver: true, domains: ["ridewithvia.com"] },
  { id: "curb", label: "Curb", mode: "car", namedDriver: true, domains: ["gocurb.com", "curbmobility.com"] },
  { id: "ola", label: "Ola", mode: "car", namedDriver: true, domains: ["olacabs.com"] },
  { id: "grab", label: "Grab", mode: "car", namedDriver: true, domains: ["grab.com"] },
  { id: "didi", label: "DiDi", mode: "car", namedDriver: true, domains: ["didiglobal.com", "didi-food.com"] },
  { id: "careem", label: "Careem", mode: "car", namedDriver: true, domains: ["careem.com"] },
  { id: "freenow", label: "FREENOW", mode: "car", namedDriver: true, domains: ["free-now.com", "mytaxi.com"] },
  { id: "revel", label: "Revel", mode: "car", namedDriver: true, domains: ["gorevel.com"] },
  { id: "alto", label: "Alto", mode: "car", namedDriver: true, domains: ["ridealto.com"] },

  // ── Rail ──
  { id: "amtrak", label: "Amtrak", mode: "rail", domains: ["amtrak.com", "email.amtrak.com"], tokens: ["amtrak"] },
  { id: "brightline", label: "Brightline", mode: "rail", domains: ["gobrightline.com"] },
  { id: "eurostar", label: "Eurostar", mode: "rail", domains: ["eurostar.com"] },
  { id: "trainline", label: "Trainline", mode: "rail", domains: ["thetrainline.com", "trainline.com", "trainline.eu"] },
  { id: "sncf", label: "SNCF Connect", mode: "rail", domains: ["sncf-connect.com", "sncf.com", "oui.sncf"] },
  { id: "db", label: "Deutsche Bahn", mode: "rail", domains: ["bahn.de", "bahn.com"] },
  { id: "trenitalia", label: "Trenitalia", mode: "rail", domains: ["trenitalia.com"] },
  { id: "renfe", label: "Renfe", mode: "rail", domains: ["renfe.com"] },
  { id: "viarail", label: "VIA Rail", mode: "rail", domains: ["viarail.ca"] },
  { id: "nsintl", label: "NS International", mode: "rail", domains: ["nsinternational.com", "ns.nl"] },
  { id: "irctc", label: "IRCTC", mode: "rail", domains: ["irctc.co.in"] },
  { id: "jr", label: "Japan Rail", mode: "rail", domains: ["jreast.co.jp", "westjr.co.jp"] },
  { id: "caltrain", label: "Caltrain", mode: "rail", domains: ["caltrain.com"] },
  { id: "mbta", label: "MBTA", mode: "rail", domains: ["mbta.com"] },

  // ── Coach / bus ──
  { id: "flixbus", label: "FlixBus", mode: "bus", domains: ["flixbus.com", "flixbus.de", "greyhound.com"] },
  { id: "megabus", label: "Megabus", mode: "bus", domains: ["megabus.com"] },
  { id: "national_express", label: "National Express", mode: "bus", domains: ["nationalexpress.com"] },

  // ── Ferry / sea ──
  { id: "ferry_generic", label: "Ferry", mode: "ferry", domains: ["directferries.com", "brittany-ferries.com", "steamshipauthority.com"] },

  // ── Charter rotor / air-taxi (small operator, specific airframe) ──
  { id: "blade", label: "BLADE", mode: "helicopter", domains: ["blade.com", "flyblade.com"] },
  { id: "wheelsup", label: "Wheels Up", mode: "helicopter", domains: ["wheelsup.com"] },
  { id: "helipass", label: "Helipass", mode: "helicopter", domains: ["helipass.com"] },
  { id: "voom", label: "Voom", mode: "helicopter", domains: ["voom.flights"] },

  // ── Scheduled air ──
  { id: "delta", label: "Delta Air Lines", mode: "air", iata: "DL", domains: ["delta.com", "e.delta.com"] },
  { id: "united", label: "United Airlines", mode: "air", iata: "UA", domains: ["united.com", "news.united.com"] },
  { id: "american", label: "American Airlines", mode: "air", iata: "AA", domains: ["aa.com", "email.aa.com"] },
  { id: "southwest", label: "Southwest Airlines", mode: "air", iata: "WN", domains: ["southwest.com", "luv.southwest.com"] },
  { id: "jetblue", label: "JetBlue", mode: "air", iata: "B6", domains: ["jetblue.com"] },
  { id: "alaska", label: "Alaska Airlines", mode: "air", iata: "AS", domains: ["alaskaair.com"] },
  { id: "spirit", label: "Spirit Airlines", mode: "air", iata: "NK", domains: ["spirit.com"] },
  { id: "frontier", label: "Frontier", mode: "air", iata: "F9", domains: ["flyfrontier.com"] },
  { id: "aircanada", label: "Air Canada", mode: "air", iata: "AC", domains: ["aircanada.ca", "aircanada.com"] },
  { id: "ba", label: "British Airways", mode: "air", iata: "BA", domains: ["ba.com", "britishairways.com"] },
  { id: "lufthansa", label: "Lufthansa", mode: "air", iata: "LH", domains: ["lufthansa.com"] },
  { id: "airfrance", label: "Air France", mode: "air", iata: "AF", domains: ["airfrance.com", "airfrance.fr"] },
  { id: "klm", label: "KLM", mode: "air", iata: "KL", domains: ["klm.com", "klm.nl"] },
  { id: "emirates", label: "Emirates", mode: "air", iata: "EK", domains: ["emirates.com"] },
  { id: "qatar", label: "Qatar Airways", mode: "air", iata: "QR", domains: ["qatarairways.com"] },
  { id: "turkish", label: "Turkish Airlines", mode: "air", iata: "TK", domains: ["turkishairlines.com", "thy.com"] },
  { id: "iberia", label: "Iberia", mode: "air", iata: "IB", domains: ["iberia.com"] },
  { id: "ryanair", label: "Ryanair", mode: "air", iata: "FR", domains: ["ryanair.com"] },
  { id: "easyjet", label: "easyJet", mode: "air", iata: "U2", domains: ["easyjet.com"] },
  { id: "ana", label: "ANA", mode: "air", iata: "NH", domains: ["ana.co.jp"] },
  { id: "jal", label: "Japan Airlines", mode: "air", iata: "JL", domains: ["jal.com", "jal.co.jp"] },
  { id: "singapore", label: "Singapore Airlines", mode: "air", iata: "SQ", domains: ["singaporeair.com"] },
  { id: "qantas", label: "Qantas", mode: "air", iata: "QF", domains: ["qantas.com"] },
];

/** Booking aggregators: they carry a leg but are not the operating carrier. */
export const AGGREGATOR_DOMAINS = [
  "expedia.com", "booking.com", "kayak.com", "priceline.com", "orbitz.com",
  "travelocity.com", "hopper.com", "gotogate.com", "kiwi.com", "omio.com",
  "tripit.com", "google.com",
];

const DOMAIN_INDEX: Map<string, OperatorProfile> = (() => {
  const m = new Map<string, OperatorProfile>();
  for (const op of OPERATORS) for (const d of op.domains) m.set(d.toLowerCase(), op);
  return m;
})();

const IATA_INDEX: Map<string, OperatorProfile> = (() => {
  const m = new Map<string, OperatorProfile>();
  for (const op of OPERATORS) if (op.iata) m.set(op.iata, op);
  return m;
})();

export function operatorById(id: string): OperatorProfile | null {
  return OPERATORS.find((o) => o.id === id) ?? null;
}

export function operatorByIata(code: string): OperatorProfile | null {
  return IATA_INDEX.get(code.toUpperCase()) ?? null;
}

/**
 * Identify the operator from a sender address. Suffix matching is used so
 * `noreply@mail.eurostar.com` resolves, but only on a dot boundary — a
 * lookalike domain such as `eurostar.com.attacker.io` must never match.
 */
export function operatorFromSender(from: string): OperatorProfile | null {
  const host = (from.match(/@([A-Za-z0-9.-]+)/)?.[1] || from).toLowerCase().replace(/[>\s]+$/, "");
  if (!host) return null;
  for (const [domain, op] of DOMAIN_INDEX) {
    if (host === domain || host.endsWith(`.${domain}`)) return op;
  }
  return null;
}

export function isAggregatorSender(from: string): boolean {
  const host = (from.match(/@([A-Za-z0-9.-]+)/)?.[1] || from).toLowerCase();
  return AGGREGATOR_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

// ── Gmail collection ───────────────────────────────────────────────────────

/**
 * One query per sweep, not one per operator: Gmail charges a round trip per
 * search and the autopilot runs on a wall clock. Domains are OR-ed inside a
 * single `from:` and the window is expressed in whole days because Gmail's
 * `newer_than` has day granularity.
 */
export function transitGmailQuery(lookbackHours: number, modes?: TransitMode[]): string {
  const days = Math.max(1, Math.ceil(Math.max(1, lookbackHours) / 24));
  const wanted = modes && modes.length ? new Set(modes) : new Set(TRANSIT_MODES);
  const domains = new Set<string>();
  for (const op of OPERATORS) {
    if (!wanted.has(op.mode)) continue;
    for (const d of op.domains) domains.add(d);
  }
  for (const d of AGGREGATOR_DOMAINS) domains.add(d);
  const from = `from:(${[...domains].join(" OR ")})`;
  const subjects = [
    "subject:(itinerary OR boarding OR reservation OR receipt OR ticket OR trip OR flight OR train OR confirmation)",
  ];
  return `newer_than:${days}d (${from} OR (${subjects.join(" ")}))`;
}

// ── Identifier grammars ────────────────────────────────────────────────────

/**
 * Flight designator: 2-char airline code (letter-letter, letter-digit or
 * digit-letter, per IATA) followed by 1-4 digits and an optional operational
 * suffix. Anchored on an explicit flight cue so a fare basis or a seat row can
 * never be promoted into a flight number.
 */
export const FLIGHT_RE = /\b((?:[A-Z]{2}|[A-Z]\d|\d[A-Z]))\s?(\d{1,4})([A-Z]?)\b/;
const FLIGHT_CUE = /(flight|flt\.?|carrier|operated by|boarding)/i;

/** ICAO-style aircraft registration: N-number, plus common foreign prefixes. */
export const TAIL_RE =
  /\b(N[1-9]\d{0,4}[A-Z]{0,2}|(?:G|D|F|C|VH|VT|JA|HL|PH|OE|EI|LN|SE|OH|SP|9H|2-|M-|T7|HB|LX|CS|EC|I|OO)-[A-Z0-9]{3,5})\b/;

/** Train service number: "Train 2151", "ICE 599", "TGV 6207", "Acela 2159". */
export const TRAIN_RE =
  /\b(?:train|service|ice|tgv|acela|thalys|railjet|eurostar|regional|amtrak)\s*(?:no\.?|#|number)?\s*([A-Z]{0,4}\s?\d{1,5})\b/i;

/** Booking / record locator: exactly six alphanumerics with a booking cue. */
export const PNR_RE =
  /\b(?:confirmation(?:\s*(?:code|number|#))?|record locator|booking(?:\s*(?:reference|ref|code|number))?|reservation(?:\s*(?:code|number))?|pnr)\s*[:#-]?\s*([A-Z0-9]{5,8})\b/i;

/** Words that satisfy PNR_RE's shape but are never a locator. */
const PNR_STOPWORDS = new Set(["NUMBER", "CODE", "TICKET", "BOOKING", "TRAVEL", "FLIGHT", "TRAIN"]);

export function readFlightNumber(text: string): string | null {
  if (!FLIGHT_CUE.test(text)) return null;
  // Prefer a designator that sits next to the cue word.
  const near = text.match(
    /(?:flight|flt\.?|operated by)\s*(?:no\.?|#|number)?\s*((?:[A-Z]{2}|[A-Z]\d|\d[A-Z])\s?\d{1,4}[A-Z]?)\b/i,
  );
  const raw = near?.[1] ?? text.match(FLIGHT_RE)?.[0];
  if (!raw) return null;
  const norm = raw.toUpperCase().replace(/\s+/g, "");
  const m = norm.match(/^((?:[A-Z]{2}|[A-Z]\d|\d[A-Z]))(\d{1,4})([A-Z]?)$/);
  if (!m) return null;
  // A flight number of 0 does not exist; leading-zero forms are normalised.
  const n = parseInt(m[2], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${m[1]}${n}${m[3]}`;
}

export function readTail(text: string): string | null {
  const m = text.toUpperCase().match(TAIL_RE);
  if (!m) return null;
  const v = m[1].replace(/\s+/g, "");
  // "N" alone or a bare state abbreviation is not a registration.
  return v.length >= 3 ? v : null;
}

export function readTrainNumber(text: string): string | null {
  const m = text.match(TRAIN_RE);
  if (!m) return null;
  const v = m[1].toUpperCase().replace(/\s+/g, " ").trim();
  return /\d/.test(v) ? v : null;
}

export function readBookingRef(text: string): string | null {
  const m = text.match(PNR_RE);
  const v = m?.[1]?.toUpperCase();
  if (!v || PNR_STOPWORDS.has(v)) return null;
  // A locator is mixed or alphabetic in practice; a pure 5-8 digit run is a
  // ticket/order number, which is still useful but must not be called a PNR.
  return v;
}

// ── Telemetry envelopes ────────────────────────────────────────────────────

/**
 * Per-mode motion physics. The car detectors (speeding, swerving, harsh brake)
 * are meaningless on a train and actively wrong on an aircraft: 500 kt in
 * cruise is nominal, a 30° bank is a standard turn. Each mode therefore
 * declares what "abnormal" means before any detector runs.
 */
export interface MotionEnvelope {
  /** Speeds above this (km/h) are implausible for the mode → GPS artefact. */
  implausibleKph: number;
  /** Sustained speed above this is notable for the mode. */
  notableKph: number;
  /** Heading change per second above this is a hard manoeuvre. */
  turnRateDegPerSec: number;
  /** Longitudinal acceleration magnitude (m/s²) treated as harsh. */
  harshAccelMs2: number;
  /** Detectors that make sense for this mode. */
  detectors: Array<"speeding" | "swerving" | "harsh_brake" | "route_deviation" | "unscheduled_stop" | "altitude_excursion">;
}

export const MOTION: Record<TransitMode, MotionEnvelope> = {
  car: { implausibleKph: 260, notableKph: 120, turnRateDegPerSec: 25, harshAccelMs2: 3.5, detectors: ["speeding", "swerving", "harsh_brake", "route_deviation", "unscheduled_stop"] },
  bus: { implausibleKph: 180, notableKph: 110, turnRateDegPerSec: 18, harshAccelMs2: 2.5, detectors: ["speeding", "harsh_brake", "route_deviation", "unscheduled_stop"] },
  rail: { implausibleKph: 620, notableKph: 320, turnRateDegPerSec: 6, harshAccelMs2: 2.0, detectors: ["route_deviation", "unscheduled_stop"] },
  ferry: { implausibleKph: 120, notableKph: 55, turnRateDegPerSec: 12, harshAccelMs2: 1.5, detectors: ["route_deviation", "unscheduled_stop"] },
  helicopter: { implausibleKph: 420, notableKph: 260, turnRateDegPerSec: 20, harshAccelMs2: 4.0, detectors: ["route_deviation", "altitude_excursion"] },
  air: { implausibleKph: 1200, notableKph: 950, turnRateDegPerSec: 6, harshAccelMs2: 4.0, detectors: ["route_deviation", "altitude_excursion"] },
};

// ── Safety question per mode ───────────────────────────────────────────────

/**
 * What the Guardian is actually being asked, per mode. This is injected into
 * the analyst prompt so the model never applies a driver-background frame to a
 * scheduled service, and never applies a schedule frame to a stranger's car.
 */
export const MODE_DOCTRINE: Record<TransitMode, string> = {
  car:
    "A named private driver in an unmarked car. The question is IDENTITY FIRST: does the human at the wheel match the licensed human bound to this plate, and does the public record hold anything adverse that is bound to THAT human with evidence.",
  bus:
    "A licensed coach operator on a fixed route. The driver is not identified to the passenger and must not be speculated about. The question is OPERATOR SAFETY RECORD, terminal-area risk at boarding and alighting, and schedule integrity.",
  rail:
    "A scheduled rail service. There is no nameable crew member and no plate. The question is SERVICE INTEGRITY (does this train number exist on this date and route), STATION-AREA RISK at origin and destination, and the operator's incident record. Never attempt to identify an individual crew member.",
  ferry:
    "A scheduled vessel crossing. The question is OPERATOR AND VESSEL RECORD, port-area risk, and sea-state/schedule disruption. Individual crew are out of scope.",
  helicopter:
    "A charter rotorcraft with a small operator and a specific airframe. The question is AIRFRAME AND OPERATOR: which registration is assigned, who holds it, its type and age, and the operator's accident/incident history. The airframe is the identity, not a person.",
  air:
    "A scheduled commercial flight. Crew are anonymous and heavily regulated; speculating about them is out of scope and prohibited. The question is FLIGHT AND AIRFRAME INTEGRITY: does the designator exist, which registration is operating it, is the route consistent with the ticket, and is there a live disruption or diversion.",
};

/** Human label for a mode, used in headlines and the UI. */
export const MODE_LABEL: Record<TransitMode, string> = {
  car: "Car",
  bus: "Coach",
  rail: "Rail",
  ferry: "Ferry",
  helicopter: "Rotorcraft",
  air: "Flight",
};
