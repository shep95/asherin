/**
 * RIDESHARE INGEST — turning a mailbox into a trip sensor.
 *
 * The rider should never have to paste anything. Uber and Lyft already send a
 * machine-readable trail to the mailbox the rider signed up with: the trip
 * receipt, the "your driver is arriving" notice, and the trip-share forward.
 * This module reads that trail and reconstructs the ride card.
 *
 * Doctrine carried over from the Guardian core:
 *   • Extraction is conservative. A field we are not sure of is left null, and
 *     a null field degrades the verdict toward THIN — it never invents a human.
 *   • Every parsed ride is bound to the Gmail message id that produced it, so
 *     a mailbox re-scan can never double-report the same trip.
 *   • Bodies are untrusted input. Nothing parsed here is ever executed,
 *     followed, or interpolated into a prompt without fencing upstream.
 */

export interface ParsedRideEmail {
  messageId: string;
  platform: "uber" | "lyft";
  at: number;
  driver_name: string | null;
  vehicle: string | null;
  plate: string | null;
  city: string | null;
  pickup_label: string | null;
  /** Where the ride ends — the anchor for the destination area briefing. */
  dropoff_label: string | null;
  trip_url: string | null;
  kind: "dispatch" | "receipt" | "share";
  subject: string;
  /** What the parser could not read — surfaced so the rider sees the gap. */
  gaps: string[];
  /** Bounded excerpt of the rider's own mail, kept so an unreadable card can be
   *  diagnosed without re-reading the mailbox. Never leaves the rider's row. */
  excerpt: string;
}

/** Gmail search expression. Kept narrow: only the two operators' own domains,
 *  plus forwarded share links, and only inside the lookback window. */
export function gmailQuery(lookbackHours: number): string {
  const days = Math.max(1, Math.ceil(lookbackHours / 24));
  return [
    `newer_than:${days}d`,
    "(",
    "from:(uber.com OR uber.us OR lyft.com OR lyftmail.com)",
    "OR",
    '"trip.uber.com" OR "t.uber.com" OR "ride.lyft.com"',
    ")",
  ].join(" ");
}

const strip = (html: string): string =>
  html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|td|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&rsquo;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/** Registration shapes only. A loose token like "2019" must never become a plate. */
const PLATE_RE = /\b([A-Z]{1,3}[- ]?[A-Z0-9]{2,9}|[0-9]{1,3}[- ]?[A-Z]{2,4}[- ]?[0-9]{0,4})\b/;

/**
 * Uber/Lyft vehicles read "2019 Toyota Camry", "Toyota Camry · Silver",
 * "Silver Tesla Model 3" or "Honda CR-V".
 *
 * The previous pattern required a capitalised model token immediately after a
 * make drawn from a 32-entry list. It therefore dropped every hyphenated model
 * (CR-V, MDX), every alphanumeric model (RAV4, CX-5, Model 3, ID.4), every
 * newer marque (Rivian, Lucid, Polestar, Genesis) and every colour-first
 * rendering — and a dropped vehicle is not a cosmetic loss. The assigned car is
 * the field the impersonation check runs on, so losing it is what produced
 * "vehicle: not captured" on a live briefing and disabled the single most
 * important verification a rider performs.
 */
const VEHICLE_RE =
  /\b((?:19|20)\d{2}\s+)?(?:(black|white|silver|grey|gray|red|blue|green|brown|beige|gold|yellow|orange|purple|maroon|tan|charcoal)\s+)?(Toyota|Honda|Nissan|Hyundai|Kia|Ford|Chevrolet|Chevy|Tesla|BMW|Mercedes(?:-Benz)?|Audi|Volkswagen|VW|Mazda|Subaru|Lexus|Acura|Infiniti|Dodge|Chrysler|Jeep|GMC|Buick|Cadillac|Volvo|Mitsubishi|Suzuki|Genesis|Rivian|Lucid|Polestar|Porsche|Jaguar|Land\s?Rover|Mini|Lincoln|Ram|Alfa\s?Romeo|Maserati|Scion|Pontiac|Saturn|Renault|Peugeot|Skoda|Fiat|Seat|Maruti|Tata|Mahindra)\s+([A-Za-z][A-Za-z0-9.\-]{0,14}(?:\s[A-Za-z0-9][A-Za-z0-9.\-]{0,10})?)/i;

const NAME_PATTERNS: RegExp[] = [
  // "You rode with Jordan" / "Thanks for riding with Jordan"
  /(?:you rode with|thanks for riding with|riding with|ride with)\s+([A-Z][a-zA-Z'’-]{1,20}(?:\s[A-Z][a-zA-Z'’-]{1,20})?)/i,
  // "Jordan is arriving now" / "Jordan is on the way"
  /\b([A-Z][a-zA-Z'’-]{1,20})\s+is\s+(?:arriving|on the way|nearby|almost there)/i,
  // Receipt block: "Driver: Jordan M."
  /\bdriver\s*[:\-]\s*([A-Z][a-zA-Z'’.-]{1,20}(?:\s[A-Z][a-zA-Z'’.-]{1,20})?)/i,
  // Lyft: "Your driver Jordan"
  /\byour driver\s+([A-Z][a-zA-Z'’-]{1,20}(?:\s[A-Z][a-zA-Z'’-]{1,20})?)/i,
];

/** Words that look like names in the patterns above but never are. */
const NAME_STOPWORDS = new Set([
  "uber", "lyft", "your", "the", "driver", "trip", "ride", "receipt", "thanks",
  "today", "tonight", "support", "help", "team", "account", "eats", "rewards",
]);

function pickName(text: string): string | null {
  for (const re of NAME_PATTERNS) {
    const m = text.match(re);
    const raw = m?.[1]?.trim();
    if (!raw) continue;
    const first = raw.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, "");
    if (NAME_STOPWORDS.has(first) || first.length < 2) continue;
    return raw.replace(/\s+/g, " ").slice(0, 60);
  }
  return null;
}

function pickPlate(text: string): string | null {
  const labelled = text.match(/(?:license\s*plate|plate|licence)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\- ]{3,10})/i);
  const candidate = labelled?.[1]?.toUpperCase().trim();
  if (!candidate) return null;
  const m = candidate.match(PLATE_RE);
  return m ? m[1].replace(/\s+/g, "").slice(0, 12) : null;
}

/** Corporate words that mean the capture grabbed the entity line, not a city. */
const CITY_NOISE = /uber|lyft|inc\b|llc|technologies|support|receipt|total/i;

function pickCity(text: string): string | null {
  // Receipts carry the operating line, e.g. "Uber Technologies in Chicago, IL".
  // The first regex hit is often the whole phrase, so every candidate is tried
  // and the corporate prefix is trimmed off rather than failing the field.
  const withState = text.matchAll(/([A-Za-z .'-]{2,40}),\s*([A-Z]{2})\b(?:\s+\d{5}(?:-\d{4})?)?/g);
  for (const m of withState) {
    const tail = m[1].trim().split(/\s+(?:in|at|near)\s+/i).pop()!.trim();
    if (!tail || tail.length < 2 || CITY_NOISE.test(tail)) continue;
    if (!/^[A-Z]/.test(tail)) continue;
    return `${tail}, ${m[2]}`;
  }
  const plain = text.match(/\bin\s+([A-Z][a-zA-Z .'-]{2,28})\s+(?:on|at)\b/);
  if (plain && !CITY_NOISE.test(plain[1])) return plain[1].trim();
  return null;
}

function pickPickup(text: string): string | null {
  const m = text.match(/\b(?:pick ?up|picked up at|from)\s*[:\-]?\s*([0-9][^\n]{4,70})/i);
  return m ? m[1].trim().replace(/\s{2,}/g, " ").slice(0, 160) : null;
}

/**
 * Where the trip ENDS. Operators phrase it four ways across dispatch notices,
 * receipts and share forwards, so all four are tried in order of reliability.
 * The label is the only destination signal available when the handset is off,
 * which makes it the anchor for the destination area briefing.
 */
function pickDropoff(text: string): string | null {
  const patterns: RegExp[] = [
    /\b(?:drop ?off|dropped off at|destination|arriving at|to)\s*[:\-]?\s*([0-9][^\n]{4,70})/i,
    /\bdrop ?off\s*[:\-]?\s*([A-Z][^\n]{4,70})/,
    /\bdestination\s*[:\-]?\s*([A-Z][^\n]{4,70})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    const v = m?.[1]?.trim().replace(/\s{2,}/g, " ");
    if (v && v.length >= 5) return v.slice(0, 160);
  }
  return null;
}


const SHARE_URL_RE =
  /https:\/\/(?:t\.uber\.com|trip\.uber\.com|m\.uber\.com|ride\.lyft\.com)\/[A-Za-z0-9._~\-\/?=&%]+/;

function classify(subject: string, text: string): ParsedRideEmail["kind"] {
  if (SHARE_URL_RE.test(text)) return "share";
  if (/receipt|trip with (?:uber|lyft)|your trip|you rode with|trip summary|ride receipt/i.test(subject) ||
      /you rode with|total\s*\$|trip fare/i.test(text)) return "receipt";
  return "dispatch";
}

/**
 * Reconstruct a ride card from one operator email.
 * Returns null when the message is not about a trip (promotions, Uber Eats,
 * password resets) — the cheapest way to keep noise out of the desk.
 */
export function parseRideEmail(msg: {
  id: string;
  subject: string;
  at: number;
  body: string;
  from?: string;
}): ParsedRideEmail | null {
  const subject = (msg.subject || "").slice(0, 300);
  const text = strip(msg.body || "").slice(0, 60_000);
  const haystack = `${subject}\n${text}`;

  // Hard excludes before anything else: food delivery and account mail share
  // the sender domain but are not rides.
  if (/uber\s*eats|order (?:receipt|confirmed)|courier|password|verify your|promo|% off|invite a friend/i.test(haystack)) {
    return null;
  }

  const isLyft = /lyft/i.test(`${msg.from || ""} ${haystack}`);
  const isTrip =
    /\b(trip|ride|driver|arriving|pickup|picked you up|dropoff)\b/i.test(haystack);
  if (!isTrip) return null;

  const kind = classify(subject, haystack);
  const driver_name = pickName(haystack);
  const shareUrl = haystack.match(SHARE_URL_RE)?.[0] ?? null;
  // Groups: 1 year · 2 colour · 3 make · 4 model. Colour is preserved because
  // "the plate matched but the car was black, not silver" is exactly the
  // discrepancy a swapped-tag check is looking for.
  const vehicleMatch = haystack.match(VEHICLE_RE);
  const vehicle = vehicleMatch
    ? [vehicleMatch[1], vehicleMatch[2], vehicleMatch[3], vehicleMatch[4]]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80)
    : null;
  const plate = pickPlate(haystack);
  const city = pickCity(haystack);
  const pickup_label = pickPickup(haystack);
  const dropoff_label = pickDropoff(haystack);

  // A trip email with neither a name nor a plate tells us nothing actionable.
  if (!driver_name && !plate && !shareUrl) return null;

  const gaps: string[] = [];
  if (!driver_name) gaps.push("driver name");
  if (!plate) gaps.push("plate");
  if (!vehicle) gaps.push("vehicle");
  if (!city) gaps.push("city");

  return {
    messageId: msg.id,
    platform: isLyft ? "lyft" : "uber",
    at: msg.at,
    driver_name,
    vehicle,
    plate,
    city,
    pickup_label,
    dropoff_label,
    trip_url: shareUrl,
    kind,
    subject,
    gaps,
    excerpt: text.slice(0, 800),
  };
}

/**
 * Fold several emails about the SAME trip into one card.
 *
 * The dispatch notice carries the plate and vehicle; the receipt carries the
 * city and the full route. Uber sends them minutes apart, so time proximity
 * plus an agreeing identifier is the join key — never the subject line, which
 * is localised and changes without notice.
 */
export function foldRides(parsed: ParsedRideEmail[]): ParsedRideEmail[] {
  const sorted = [...parsed].sort((a, b) => a.at - b.at);
  const out: ParsedRideEmail[] = [];
  const WINDOW_MS = 3 * 60 * 60 * 1000; // one trip cannot span more than this

  for (const p of sorted) {
    const host = out.find((o) => {
      if (o.platform !== p.platform) return false;
      if (Math.abs(o.at - p.at) > WINDOW_MS) return false;
      const nameAgrees =
        o.driver_name && p.driver_name &&
        o.driver_name.split(" ")[0].toLowerCase() === p.driver_name.split(" ")[0].toLowerCase();
      const plateAgrees = o.plate && p.plate && o.plate === p.plate;
      // No shared identifier means we cannot prove it is the same trip.
      return Boolean(nameAgrees || plateAgrees);
    });

    if (!host) { out.push({ ...p }); continue; }

    host.driver_name ??= p.driver_name;
    host.vehicle ??= p.vehicle;
    host.plate ??= p.plate;
    host.city ??= p.city;
    host.pickup_label ??= p.pickup_label;
    host.dropoff_label ??= p.dropoff_label;
    host.trip_url ??= p.trip_url;
    // The receipt is the authoritative record of the completed trip.
    if (p.kind === "receipt") host.kind = "receipt";
    host.gaps = [
      !host.driver_name && "driver name",
      !host.plate && "plate",
      !host.vehicle && "vehicle",
      !host.city && "city",
    ].filter(Boolean) as string[];
  }
  return out;
}
