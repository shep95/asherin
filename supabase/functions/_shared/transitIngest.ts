/**
 * TRANSIT INGEST — one mailbox, every mode of travel.
 *
 * NARRATIVE
 * The rideshare ingest proved the pattern: the operator already writes the
 * journey to the traveller's mailbox, so the traveller should never paste a
 * thing. Airlines, railways, coach lines, ferries and charter-rotor operators
 * all do the same — an itinerary, a check-in notice, a boarding pass, a
 * receipt. The difference is only in which fields exist.
 *
 * FLAWS FOUND IN THE FIRST DRAFT
 *  1. Greedy identifiers. "Seat 12A" and fare class "Y26" both satisfy a naive
 *     flight-number regex. Every identifier here therefore requires a cue word
 *     from its own mode's grammar (see transitModes.ts) before it is accepted.
 *  2. Aggregator confusion. An Expedia itinerary is about an operating carrier
 *     it is not; the sender must never become the operator. Aggregators are
 *     detected and the carrier is read from the flight designator instead.
 *  3. Marketing bleed. "Fly to Miami from $89" trips every cue word. A leg is
 *     only emitted when a concrete identifier OR a concrete booking reference
 *     plus a route is present.
 *  4. Timezone invention. An itinerary prints local times without an offset.
 *     Parsing them as UTC silently shifts a departure by hours, so a time is
 *     only stored when a date and time are read together, and it is stored
 *     with an explicit `time_is_local` marker rather than pretending to be an
 *     absolute instant.
 *  5. Double reporting. Airlines send the itinerary, then check-in, then a gate
 *     change, all for one leg. Folding therefore joins on the identifier and
 *     the calendar day, never on the subject line.
 *
 * Pure module: no network, no Deno APIs. Untrusted input in, structured leg out.
 */

import {
  MODE_LABEL,
  operatorByIata,
  operatorFromSender,
  isAggregatorSender,
  readBookingRef,
  readFlightNumber,
  readTail,
  readTrainNumber,
  type OperatorProfile,
  type TransitMode,
} from "./transitModes.ts";

export interface TransitLeg {
  messageId: string;
  mode: TransitMode;
  /** Operator key from the catalogue, or a lowercase slug when unknown. */
  operator: string;
  operator_label: string;
  /** Flight designator, tail registration, train number or plate. */
  vehicle_ident: string | null;
  /** Free-text vehicle description ("Boeing 787-9", "2019 Toyota Camry"). */
  vehicle: string | null;
  /** Only ever populated for modes that dispatch a named private driver. */
  driver_name: string | null;
  origin_label: string | null;
  destination_label: string | null;
  /** ISO-8601 with no offset when the source printed a local wall clock. */
  depart_at: string | null;
  arrive_at: string | null;
  time_is_local: boolean;
  booking_ref: string | null;
  seat: string | null;
  city: string | null;
  trip_url: string | null;
  kind: "itinerary" | "checkin" | "receipt" | "dispatch" | "disruption";
  subject: string;
  at: number;
  gaps: string[];
  excerpt: string;
}

// ── Text normalisation ─────────────────────────────────────────────────────

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|td|th|h\d|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&rsquo;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&(?:mdash|ndash);/gi, "-")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Promotional mail that quotes routes and prices but books nothing. */
const MARKETING =
  /(unsubscribe from (?:deals|offers)|fare sale|book now and save|% off|earn \d+ (?:miles|points)|deal of the (?:day|week)|limited[- ]time offer)/i;

const NOT_TRAVEL =
  /(password|verify your (?:email|account)|uber\s*eats|food (?:order|delivery)|courier|invite a friend|survey|statement is ready)/i;

// ── Field readers ──────────────────────────────────────────────────────────

const MONTHS =
  "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*";

/**
 * Read a date+time pair printed together, e.g. "Mon, 10 Aug 2026 7:45 AM" or
 * "August 10, 2026 at 7:45 PM". Returns an offset-free ISO string: the source
 * printed a local wall clock and inventing an offset would move the departure.
 */
function readDateTime(text: string): string | null {
  const patterns: RegExp[] = [
    new RegExp(`(${MONTHS})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})[^\\n]{0,12}?(\\d{1,2}):(\\d{2})\\s*(AM|PM)?`, "i"),
    new RegExp(`(\\d{1,2})\\s+(${MONTHS})\\.?\\s+(\\d{4})[^\\n]{0,12}?(\\d{1,2}):(\\d{2})\\s*(AM|PM)?`, "i"),
  ];
  const monthIndex = (name: string) =>
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
      .indexOf(name.slice(0, 3).toLowerCase());

  for (const [i, re] of patterns.entries()) {
    const m = text.match(re);
    if (!m) continue;
    const mon = monthIndex(i === 0 ? m[1] : m[2]);
    const day = parseInt(i === 0 ? m[2] : m[1], 10);
    const year = parseInt(m[3], 10);
    let hour = parseInt(m[4], 10);
    const minute = parseInt(m[5], 10);
    const mer = m[6]?.toUpperCase();
    if (mon < 0 || !Number.isFinite(day) || !Number.isFinite(year)) continue;
    if (day < 1 || day > 31 || minute > 59) continue;
    if (mer === "PM" && hour < 12) hour += 12;
    if (mer === "AM" && hour === 12) hour = 0;
    if (hour > 23) continue;
    if (year < 2000 || year > 2100) continue;
    const p = (n: number) => String(n).padStart(2, "0");
    return `${year}-${p(mon + 1)}-${p(day)}T${p(hour)}:${p(minute)}:00`;
  }
  return null;
}

/** IATA city pair: "JFK → LHR", "JFK to LHR", "JFK - LHR". */
function readAirportPair(text: string): { from: string; to: string } | null {
  const m = text.match(/\b([A-Z]{3})\s*(?:→|->|—|–|-|to|›)\s*([A-Z]{3})\b/);
  if (!m) return null;
  if (m[1] === m[2]) return null;
  // Guard against date fragments and currency codes masquerading as codes.
  if (/^(USD|EUR|GBP|CAD|AUD|SAT|SUN|MON|TUE|WED|THU|FRI)$/.test(m[1])) return null;
  return { from: m[1], to: m[2] };
}

/** Named station/terminal pair: "London St Pancras to Paris Gare du Nord". */
function readNamedPair(text: string): { from: string; to: string } | null {
  const m = text.match(
    /\b(?:from|departing|depart)\s*[:\-]?\s*([A-Z][\w'’.\- ]{2,44}?)\s+(?:to|→|->|arriving(?: at| in)?)\s+([A-Z][\w'’.\- ]{2,44})(?=[\n,.]|$)/,
  );
  if (!m) return null;
  const clean = (s: string) => s.trim().replace(/\s{2,}/g, " ");
  const from = clean(m[1]);
  const to = clean(m[2]);
  if (from.toLowerCase() === to.toLowerCase()) return null;
  return { from, to };
}

function readSeat(text: string): string | null {
  const m = text.match(/\bseat\s*[:#-]?\s*([0-9]{1,3}\s?[A-Z]|[A-Z]{1,2}\s?[0-9]{1,3})\b/i);
  return m ? m[1].toUpperCase().replace(/\s+/g, "") : null;
}

function readCoach(text: string): string | null {
  const m = text.match(/\b(?:coach|car|carriage|voiture)\s*[:#-]?\s*([0-9]{1,2}|[A-Z])\b/i);
  return m ? `Coach ${m[1].toUpperCase()}` : null;
}

/** Aircraft type as printed on an itinerary: "Boeing 787-9", "Airbus A320". */
function readAircraftType(text: string): string | null {
  const m = text.match(
    /\b((?:Boeing|Airbus|Embraer|Bombardier|Sikorsky|Bell|Airbus Helicopters|Robinson|Leonardo|Agusta|De Havilland|ATR)\s+[A-Z0-9][A-Za-z0-9-]{1,10}(?:\s?-\s?\d{1,3})?)/,
  );
  return m ? m[1].replace(/\s{2,}/g, " ").slice(0, 60) : null;
}

const SHARE_URL_RE =
  /https:\/\/(?:t\.uber\.com|trip\.uber\.com|m\.uber\.com|ride\.lyft\.com|www\.lyft\.com)\/[A-Za-z0-9._~\-\/?=&%]+/;

function classify(subject: string, text: string): TransitLeg["kind"] {
  const h = `${subject}\n${text}`;
  if (/\b(cancelled|canceled|delayed|delay of|diverted|schedule change|disruption|rebooked)\b/i.test(h)) return "disruption";
  if (/\b(boarding pass|check[- ]in|checked in|gate \d)/i.test(h)) return "checkin";
  if (/\b(receipt|total charged|fare breakdown|you rode with|invoice)\b/i.test(h)) return "receipt";
  if (/\b(is arriving|is on the way|driver assigned|your driver)\b/i.test(h)) return "dispatch";
  return "itinerary";
}

// ── Mode resolution ────────────────────────────────────────────────────────

/**
 * Mode is decided by the operator when the sender is the operator, and by the
 * shape of the identifiers when it is an aggregator or a forward. Content
 * evidence never overrides a known operator: an Amtrak mail that mentions the
 * word "flight" in a partner advert is still a rail leg.
 */
function resolveMode(op: OperatorProfile | null, text: string): TransitMode | null {
  if (op) return op.mode;
  if (/\b(flight|boarding pass|gate|terminal \d|aircraft|airline)\b/i.test(text)) return "air";
  if (/\b(helicopter|rotor|heliport|helipad)\b/i.test(text)) return "helicopter";
  if (/\b(train|rail|platform \d|station|coach \d|carriage)\b/i.test(text)) return "rail";
  if (/\b(ferry|vessel|sailing|port of)\b/i.test(text)) return "ferry";
  if (/\b(coach|bus terminal|bus stop)\b/i.test(text)) return "bus";
  if (/\b(driver|plate|licence plate|license plate|pickup)\b/i.test(text)) return "car";
  return null;
}

const DRIVER_PATTERNS: RegExp[] = [
  /(?:you rode with|thanks for riding with|riding with)\s+([A-Z][a-zA-Z'’-]{1,20}(?:\s[A-Z][a-zA-Z'’-]{1,20})?)/i,
  /\byour driver\s+(?:is\s+)?([A-Z][a-zA-Z'’-]{1,20}(?:\s[A-Z][a-zA-Z'’-]{1,20})?)/i,
  /\bdriver\s*[:\-]\s*([A-Z][a-zA-Z'’.-]{1,20}(?:\s[A-Z][a-zA-Z'’.-]{1,20})?)/i,
  /\b([A-Z][a-zA-Z'’-]{1,20})\s+is\s+(?:arriving|on the way|nearby|almost there)/i,
];
const NAME_STOPWORDS = new Set([
  "uber", "lyft", "bolt", "your", "the", "driver", "trip", "ride", "receipt",
  "thanks", "today", "tonight", "support", "help", "team", "account",
]);

function readDriver(text: string): string | null {
  for (const re of DRIVER_PATTERNS) {
    const raw = text.match(re)?.[1]?.trim();
    if (!raw) continue;
    const first = raw.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "");
    if (first.length < 2 || NAME_STOPWORDS.has(first)) continue;
    return raw.replace(/\s+/g, " ").slice(0, 60);
  }
  return null;
}

function readPlate(text: string): string | null {
  const m = text.match(/(?:licen[sc]e\s*plate|plate|registration)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\- ]{3,10})/i);
  const candidate = m?.[1]?.toUpperCase().trim().replace(/\s+/g, "");
  if (!candidate) return null;
  return /^[A-Z0-9-]{4,12}$/.test(candidate) ? candidate.slice(0, 12) : null;
}

// ── Parser ─────────────────────────────────────────────────────────────────

export function parseTransitEmail(msg: {
  id: string;
  subject: string;
  at: number;
  body: string;
  from?: string;
}): TransitLeg | null {
  const subject = (msg.subject || "").slice(0, 300);
  const text = stripHtml(msg.body || "").slice(0, 60_000);
  const haystack = `${subject}\n${text}`;
  const from = msg.from || "";

  if (NOT_TRAVEL.test(haystack)) return null;

  const senderOp = operatorFromSender(from);
  const aggregator = !senderOp && isAggregatorSender(from);

  // Marketing is only rejected when nothing concrete was booked. A genuine
  // itinerary often carries a promotional footer.
  const hasBooking = /\b(confirmation|record locator|booking reference|reservation|e-?ticket|pnr)\b/i.test(haystack);
  if (MARKETING.test(haystack) && !hasBooking) return null;

  const mode = resolveMode(senderOp, haystack);
  if (!mode) return null;

  const flight = mode === "air" || mode === "helicopter" ? readFlightNumber(haystack) : null;
  const tail = mode === "air" || mode === "helicopter" ? readTail(haystack) : null;
  const train = mode === "rail" || mode === "bus" ? readTrainNumber(haystack) : null;
  const plate = mode === "car" ? readPlate(haystack) : null;
  const booking_ref = readBookingRef(haystack);

  // Carrier is read from the designator when the sender is an aggregator or a
  // forward — the booking site is not the operating carrier.
  const carrierFromFlight = flight ? operatorByIata(flight.slice(0, 2)) : null;
  const op = senderOp ?? carrierFromFlight;
  const operator = op?.id ?? (aggregator ? "aggregator" : "unknown");
  const operator_label =
    op?.label ?? (aggregator ? (from.match(/@([A-Za-z0-9.-]+)/)?.[1] ?? "Booking agent") : "Unknown operator");

  const pair = readAirportPair(haystack) ?? readNamedPair(haystack);
  const depart_at = readDateTime(haystack);
  const vehicle_ident = flight ?? tail ?? train ?? plate ?? null;

  // A leg must be concrete. Either we can name the vehicle/service, or we have
  // a booking reference AND a route. Anything less is an advert.
  if (!vehicle_ident && !(booking_ref && pair)) return null;

  const seat = readSeat(haystack) ?? readCoach(haystack);
  const vehicle = readAircraftType(haystack) ?? (mode === "car" ? readVehicleModel(haystack) : null);
  const driver_name = op?.namedDriver || mode === "car" ? readDriver(haystack) : null;
  const trip_url = haystack.match(SHARE_URL_RE)?.[0] ?? null;

  const gaps: string[] = [];
  if (!vehicle_ident) gaps.push(mode === "car" ? "plate" : "service identifier");
  if (!pair) gaps.push("route");
  if (!depart_at) gaps.push("departure time");
  if (mode === "air" && !tail) gaps.push("aircraft registration");
  if (mode === "car" && !driver_name) gaps.push("driver name");

  return {
    messageId: msg.id,
    mode,
    operator,
    operator_label,
    vehicle_ident,
    vehicle,
    driver_name,
    origin_label: pair?.from ?? null,
    destination_label: pair?.to ?? null,
    depart_at,
    arrive_at: null,
    time_is_local: Boolean(depart_at),
    booking_ref,
    seat,
    city: null,
    trip_url,
    kind: classify(subject, text),
    subject,
    at: msg.at,
    gaps,
    excerpt: text.slice(0, 800),
  };
}

const VEHICLE_RE =
  /\b((?:19|20)\d{2}\s+)?(Toyota|Honda|Nissan|Hyundai|Kia|Ford|Chevrolet|Chevy|Tesla|BMW|Mercedes(?:-Benz)?|Audi|Volkswagen|VW|Mazda|Subaru|Lexus|Acura|Infiniti|Dodge|Chrysler|Jeep|GMC|Buick|Cadillac|Volvo|Mitsubishi|Skoda|Fiat|Seat|Renault|Peugeot)\s+([A-Z][A-Za-z0-9-]{1,14})/;

function readVehicleModel(text: string): string | null {
  const m = text.match(VEHICLE_RE);
  return m ? `${m[1] ?? ""}${m[2]} ${m[3]}`.replace(/\s+/g, " ").trim().slice(0, 80) : null;
}

// ── Folding ────────────────────────────────────────────────────────────────

/** Calendar day of a local ISO string, or of the message timestamp. */
function dayKey(leg: TransitLeg): string {
  if (leg.depart_at) return leg.depart_at.slice(0, 10);
  return new Date(leg.at).toISOString().slice(0, 10);
}

/**
 * Fold the itinerary, the check-in and the gate change into one leg. The join
 * key is (mode, identifier or booking ref, calendar day) — never the subject,
 * which is localised and rewritten by the operator without notice.
 */
export function foldLegs(legs: TransitLeg[]): TransitLeg[] {
  const sorted = [...legs].sort((a, b) => a.at - b.at);
  const out: TransitLeg[] = [];

  for (const leg of sorted) {
    const host = out.find((o) => {
      if (o.mode !== leg.mode) return false;
      if (dayKey(o) !== dayKey(leg)) return false;
      const identAgrees = Boolean(o.vehicle_ident && leg.vehicle_ident && o.vehicle_ident === leg.vehicle_ident);
      const refAgrees = Boolean(o.booking_ref && leg.booking_ref && o.booking_ref === leg.booking_ref);
      return identAgrees || refAgrees;
    });

    if (!host) { out.push({ ...leg }); continue; }

    host.vehicle_ident ??= leg.vehicle_ident;
    host.vehicle ??= leg.vehicle;
    host.driver_name ??= leg.driver_name;
    host.origin_label ??= leg.origin_label;
    host.destination_label ??= leg.destination_label;
    host.depart_at ??= leg.depart_at;
    host.arrive_at ??= leg.arrive_at;
    host.booking_ref ??= leg.booking_ref;
    host.seat ??= leg.seat;
    host.trip_url ??= leg.trip_url;
    host.time_is_local = host.time_is_local || leg.time_is_local;
    // A disruption is the most operationally important state and wins; a
    // receipt closes the leg out; check-in beats a bare itinerary.
    const rank: Record<TransitLeg["kind"], number> = {
      itinerary: 0, dispatch: 1, checkin: 2, receipt: 3, disruption: 4,
    };
    if (rank[leg.kind] > rank[host.kind]) host.kind = leg.kind;
    host.gaps = [
      !host.vehicle_ident && (host.mode === "car" ? "plate" : "service identifier"),
      !host.origin_label && "route",
      !host.depart_at && "departure time",
      host.mode === "car" && !host.driver_name && "driver name",
    ].filter(Boolean) as string[];
  }
  return out;
}

/** One-line summary used in alerts and list rows. */
export function legHeadline(leg: TransitLeg): string {
  const route = leg.origin_label && leg.destination_label
    ? `${leg.origin_label} → ${leg.destination_label}`
    : leg.destination_label ?? leg.origin_label ?? "route unread";
  const ident = leg.vehicle_ident ? ` ${leg.vehicle_ident}` : "";
  return `${MODE_LABEL[leg.mode]} · ${leg.operator_label}${ident} · ${route}`;
}
