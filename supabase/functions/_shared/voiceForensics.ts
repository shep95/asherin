// ═══════════════════════════════════════════════════════════════════════════
// VOICEPRINT — Google Voice Metadata Forensics
// ---------------------------------------------------------------------------
// POSTMARK reads the envelope of a letter. VOICEPRINT reads the envelope of a
// text message.
//
// Google Voice has no public API, but it mirrors every SMS, MMS, voicemail and
// missed call into the linked mailbox as a machine-generated email. That
// mirror carries two independent layers of metadata, and BOTH are intelligence:
//
//   LAYER 1 — the mail envelope Google itself stamped. Authentication verdicts
//   (SPF / DKIM / DMARC), the relay chain, the Message-ID domain, the delivery
//   latency between the Voice switch and the mailbox. A genuine Voice
//   notification is always DMARC-aligned to google.com. A forged one is the
//   single most convincing phishing lure a person can receive, because it
//   arrives inside the thread where their real messages live.
//
//   LAYER 2 — the Voice addressing itself. The envelope local part is
//   `<operator line>.<peer line>.<opaque token>@txt.voice.google.com`, the
//   subject declares the channel ("New text message from …", "New voicemail
//   from …", "Missed call from …"), the Date header carries the mailbox clock
//   offset, and `sizeEstimate` reveals the weight of an MMS attachment.
//
// Everything below is derived from those two layers. NO MESSAGE BODY IS READ,
// requested, parsed or stored by this module — the Gmail read is
// `format=metadata`, which cannot return body content even if asked. What a
// person said stays private; the pattern of who contacted them, from what kind
// of line, in what region, at what hour, at what cadence, does not.
//
// Provenance discipline (inherited from POSTMARK): every derived claim carries
// the header text it rests on, so nothing on the operator's screen is an
// unsourced assertion.
// ═══════════════════════════════════════════════════════════════════════════

import {
  indexHeaders, parseAddress, domainOf, registrableDomain, buildChain,
  type AuthVerdict, type ForensicFlag, type RelayHop,
} from "./emailForensics.ts";

/** Gmail query that isolates the Voice mirror. Matches the harvester in
 *  `phoneMessages.ts` so both surfaces reason over the same population. */
export const VOICE_QUERY =
  "(from:txt.voice.google.com OR to:txt.voice.google.com OR from:voice-noreply@google.com)";

export type VoiceKind = "text" | "mms" | "voicemail" | "missed_call";

/** How the far end of the conversation is provisioned. A shortcode is a
 *  business, a premium line is a toll trap, a foreign line on a domestic
 *  account is a deviation — each carries a different meaning. */
export type LineClass =
  | "shortcode"      // 5–6 digits: A2P bulk / OTP sender, never a person
  | "toll_free"      // 8xx: business inbound
  | "premium_rate"   // 900 / 976: caller is billed
  | "nanp"           // ordinary North American line
  | "international"  // outside +1
  | "unknown";

export interface PeerLine {
  e164: string | null;
  key: string | null;          // digits-only fold key
  name: string | null;         // display name Voice supplied, when it had one
  lineClass: LineClass;
  areaCode: string | null;
  region: string | null;       // state / province / country attributed to the prefix
  tzLabel: string | null;      // dominant timezone of that prefix
  countryCode: string | null;  // E.164 country calling code for international
}

export interface VoiceEnvelope {
  id: string;
  threadId: string | null;
  kind: VoiceKind;
  direction: "in" | "out";
  at: string | null;             // ISO, from the server clock (internalDate)
  internalDate: number | null;
  localHour: number | null;      // hour on the MAILBOX clock, from the Date offset
  utcOffsetMin: number | null;

  operatorLine: string | null;   // the user's own Voice number, from the envelope
  peer: PeerLine;

  subject: string;               // Voice's own machine-written subject
  sizeBytes: number | null;      // envelope weight — proxy for MMS payload size
  hasAttachment: boolean;

  // Layer 1 — is this really from Google?
  spf: AuthVerdict;
  dkim: AuthVerdict;
  dmarc: AuthVerdict;
  authentic: boolean;            // all three aligned to google.com
  fromDomain: string | null;
  messageIdDomain: string | null;
  hops: RelayHop[];
  hopCount: number;
  transitSeconds: number | null; // Voice switch → mailbox delivery latency

  flags: ForensicFlag[];
  riskScore: number;
  verdict: "clean" | "watch" | "suspect" | "hostile";
}

export interface PeerProfile {
  key: string;
  e164: string | null;
  name: string | null;
  lineClass: LineClass;
  region: string | null;
  tzLabel: string | null;

  total: number;
  inbound: number;
  outbound: number;
  kinds: Record<VoiceKind, number>;
  firstSeen: string | null;
  lastSeen: string | null;
  spanDays: number | null;
  medianGapSec: number | null;   // cadence between consecutive contacts
  maxBurst: number;              // most messages inside any 10-minute window
  nightShare: number;            // fraction landing 00:00–05:00 mailbox-local
  reciprocity: number | null;    // outbound / total, null when nothing outbound
  attachmentCount: number;
  totalBytes: number;

  flags: ForensicFlag[];
  riskScore: number;
  verdict: "clean" | "watch" | "suspect" | "hostile";
}

export interface VoiceAggregate {
  analyzed: number;
  window: { first: string | null; last: string | null };
  kinds: Record<VoiceKind, number>;
  directions: { inbound: number; outbound: number };
  peers: number;
  lineClasses: Array<{ lineClass: LineClass; count: number; peers: number }>;
  regions: Array<{ region: string; count: number; peers: number }>;
  hours: number[];               // 24 buckets, in the clock frame below
  clockFrame: { zone: string | null; basis: string; evidence: string };
  /** False when the mirror carries no sent traffic — reply-based findings are
   *  suppressed rather than guessed. */
  outboundVisible: boolean;
  operatorLines: Array<{ line: string; count: number }>;
  auth: { authentic: number; unauthenticated: number; forged: number };
  medianTransitSec: number | null;
  churnClusters: Array<{ prefix: string; region: string | null; numbers: string[]; messages: number }>;
  topFlags: Array<{ code: string; title: string; severity: ForensicFlag["severity"]; count: number }>;

}

// ─── NANP prefix attribution ───────────────────────────────────────────────
// Area code → (region, dominant timezone). Offline, deterministic, no lookup
// leaves the function. Attribution is of the NUMBER'S ISSUANCE, not of the
// holder's current location — mobile numbers travel with their owner. The UI
// must say "issued in", never "located in".

const NANP: Record<string, [string, string]> = {
  "201": ["New Jersey", "ET"], "202": ["District of Columbia", "ET"], "203": ["Connecticut", "ET"],
  "204": ["Manitoba", "CT"], "205": ["Alabama", "CT"], "206": ["Washington", "PT"],
  "207": ["Maine", "ET"], "208": ["Idaho", "MT"], "209": ["California", "PT"],
  "210": ["Texas", "CT"], "212": ["New York", "ET"], "213": ["California", "PT"],
  "214": ["Texas", "CT"], "215": ["Pennsylvania", "ET"], "216": ["Ohio", "ET"],
  "217": ["Illinois", "CT"], "218": ["Minnesota", "CT"], "219": ["Indiana", "CT"],
  "224": ["Illinois", "CT"], "225": ["Louisiana", "CT"], "228": ["Mississippi", "CT"],
  "229": ["Georgia", "ET"], "231": ["Michigan", "ET"], "234": ["Ohio", "ET"],
  "239": ["Florida", "ET"], "240": ["Maryland", "ET"], "248": ["Michigan", "ET"],
  "251": ["Alabama", "CT"], "252": ["North Carolina", "ET"], "253": ["Washington", "PT"],
  "254": ["Texas", "CT"], "256": ["Alabama", "CT"], "260": ["Indiana", "ET"],
  "262": ["Wisconsin", "CT"], "267": ["Pennsylvania", "ET"], "269": ["Michigan", "ET"],
  "270": ["Kentucky", "CT"], "276": ["Virginia", "ET"], "281": ["Texas", "CT"],
  "301": ["Maryland", "ET"], "302": ["Delaware", "ET"], "303": ["Colorado", "MT"],
  "304": ["West Virginia", "ET"], "305": ["Florida", "ET"], "306": ["Saskatchewan", "CT"],
  "307": ["Wyoming", "MT"], "308": ["Nebraska", "CT"], "309": ["Illinois", "CT"],
  "310": ["California", "PT"], "312": ["Illinois", "CT"], "313": ["Michigan", "ET"],
  "314": ["Missouri", "CT"], "315": ["New York", "ET"], "316": ["Kansas", "CT"],
  "317": ["Indiana", "ET"], "318": ["Louisiana", "CT"], "319": ["Iowa", "CT"],
  "320": ["Minnesota", "CT"], "321": ["Florida", "ET"], "323": ["California", "PT"],
  "325": ["Texas", "CT"], "330": ["Ohio", "ET"], "331": ["Illinois", "CT"],
  "334": ["Alabama", "CT"], "336": ["North Carolina", "ET"], "337": ["Louisiana", "CT"],
  "339": ["Massachusetts", "ET"], "340": ["U.S. Virgin Islands", "AT"], "343": ["Ontario", "ET"],
  "345": ["Cayman Islands", "ET"], "346": ["Texas", "CT"], "347": ["New York", "ET"],
  "351": ["Massachusetts", "ET"], "352": ["Florida", "ET"], "360": ["Washington", "PT"],
  "361": ["Texas", "CT"], "364": ["Kentucky", "CT"], "365": ["Ontario", "ET"],
  "380": ["Ohio", "ET"], "385": ["Utah", "MT"], "386": ["Florida", "ET"],
  "401": ["Rhode Island", "ET"], "402": ["Nebraska", "CT"], "403": ["Alberta", "MT"],
  "404": ["Georgia", "ET"], "405": ["Oklahoma", "CT"], "406": ["Montana", "MT"],
  "407": ["Florida", "ET"], "408": ["California", "PT"], "409": ["Texas", "CT"],
  "410": ["Maryland", "ET"], "412": ["Pennsylvania", "ET"], "413": ["Massachusetts", "ET"],
  "414": ["Wisconsin", "CT"], "415": ["California", "PT"], "416": ["Ontario", "ET"],
  "417": ["Missouri", "CT"], "418": ["Quebec", "ET"], "419": ["Ohio", "ET"],
  "423": ["Tennessee", "ET"], "424": ["California", "PT"], "425": ["Washington", "PT"],
  "430": ["Texas", "CT"], "431": ["Manitoba", "CT"], "432": ["Texas", "CT"],
  "434": ["Virginia", "ET"], "435": ["Utah", "MT"], "437": ["Ontario", "ET"],
  "438": ["Quebec", "ET"], "440": ["Ohio", "ET"], "441": ["Bermuda", "AT"],
  "442": ["California", "PT"], "443": ["Maryland", "ET"], "450": ["Quebec", "ET"],
  "458": ["Oregon", "PT"], "463": ["Indiana", "ET"], "469": ["Texas", "CT"],
  "470": ["Georgia", "ET"], "475": ["Connecticut", "ET"], "478": ["Georgia", "ET"],
  "479": ["Arkansas", "CT"], "480": ["Arizona", "MT"], "484": ["Pennsylvania", "ET"],
  "501": ["Arkansas", "CT"], "502": ["Kentucky", "ET"], "503": ["Oregon", "PT"],
  "504": ["Louisiana", "CT"], "505": ["New Mexico", "MT"], "506": ["New Brunswick", "AT"],
  "507": ["Minnesota", "CT"], "508": ["Massachusetts", "ET"], "509": ["Washington", "PT"],
  "510": ["California", "PT"], "512": ["Texas", "CT"], "513": ["Ohio", "ET"],
  "514": ["Quebec", "ET"], "515": ["Iowa", "CT"], "516": ["New York", "ET"],
  "517": ["Michigan", "ET"], "518": ["New York", "ET"], "519": ["Ontario", "ET"],
  "520": ["Arizona", "MT"], "530": ["California", "PT"], "531": ["Nebraska", "CT"],
  "534": ["Wisconsin", "CT"], "539": ["Oklahoma", "CT"], "540": ["Virginia", "ET"],
  "541": ["Oregon", "PT"], "548": ["Ontario", "ET"], "551": ["New Jersey", "ET"],
  "559": ["California", "PT"], "561": ["Florida", "ET"], "562": ["California", "PT"],
  "563": ["Iowa", "CT"], "564": ["Washington", "PT"], "567": ["Ohio", "ET"],
  "570": ["Pennsylvania", "ET"], "571": ["Virginia", "ET"], "573": ["Missouri", "CT"],
  "574": ["Indiana", "ET"], "575": ["New Mexico", "MT"], "579": ["Quebec", "ET"],
  "580": ["Oklahoma", "CT"], "581": ["Quebec", "ET"], "585": ["New York", "ET"],
  "586": ["Michigan", "ET"], "587": ["Alberta", "MT"], "601": ["Mississippi", "CT"],
  "602": ["Arizona", "MT"], "603": ["New Hampshire", "ET"], "604": ["British Columbia", "PT"],
  "605": ["South Dakota", "CT"], "606": ["Kentucky", "ET"], "607": ["New York", "ET"],
  "608": ["Wisconsin", "CT"], "609": ["New Jersey", "ET"], "610": ["Pennsylvania", "ET"],
  "612": ["Minnesota", "CT"], "613": ["Ontario", "ET"], "614": ["Ohio", "ET"],
  "615": ["Tennessee", "CT"], "616": ["Michigan", "ET"], "617": ["Massachusetts", "ET"],
  "618": ["Illinois", "CT"], "619": ["California", "PT"], "620": ["Kansas", "CT"],
  "623": ["Arizona", "MT"], "626": ["California", "PT"], "628": ["California", "PT"],
  "629": ["Tennessee", "CT"], "630": ["Illinois", "CT"], "631": ["New York", "ET"],
  "636": ["Missouri", "CT"], "639": ["Saskatchewan", "CT"], "640": ["New Jersey", "ET"],
  "641": ["Iowa", "CT"], "646": ["New York", "ET"], "647": ["Ontario", "ET"],
  "649": ["Turks and Caicos", "ET"], "650": ["California", "PT"], "651": ["Minnesota", "CT"],
  "657": ["California", "PT"], "660": ["Missouri", "CT"], "661": ["California", "PT"],
  "662": ["Mississippi", "CT"], "667": ["Maryland", "ET"], "669": ["California", "PT"],
  "671": ["Guam", "ChST"], "678": ["Georgia", "ET"], "680": ["New York", "ET"],
  "681": ["West Virginia", "ET"], "682": ["Texas", "CT"], "684": ["American Samoa", "SST"],
  "701": ["North Dakota", "CT"], "702": ["Nevada", "PT"], "703": ["Virginia", "ET"],
  "704": ["North Carolina", "ET"], "705": ["Ontario", "ET"], "706": ["Georgia", "ET"],
  "707": ["California", "PT"], "708": ["Illinois", "CT"], "709": ["Newfoundland", "NT"],
  "712": ["Iowa", "CT"], "713": ["Texas", "CT"], "714": ["California", "PT"],
  "715": ["Wisconsin", "CT"], "716": ["New York", "ET"], "717": ["Pennsylvania", "ET"],
  "718": ["New York", "ET"], "719": ["Colorado", "MT"], "720": ["Colorado", "MT"],
  "721": ["Sint Maarten", "AT"], "724": ["Pennsylvania", "ET"], "725": ["Nevada", "PT"],
  "727": ["Florida", "ET"], "731": ["Tennessee", "CT"], "732": ["New Jersey", "ET"],
  "734": ["Michigan", "ET"], "737": ["Texas", "CT"], "740": ["Ohio", "ET"],
  "743": ["North Carolina", "ET"], "747": ["California", "PT"], "754": ["Florida", "ET"],
  "757": ["Virginia", "ET"], "758": ["Saint Lucia", "AT"], "760": ["California", "PT"],
  "762": ["Georgia", "ET"], "763": ["Minnesota", "CT"], "765": ["Indiana", "ET"],
  "769": ["Mississippi", "CT"], "770": ["Georgia", "ET"], "772": ["Florida", "ET"],
  "773": ["Illinois", "CT"], "774": ["Massachusetts", "ET"], "775": ["Nevada", "PT"],
  "778": ["British Columbia", "PT"], "779": ["Illinois", "CT"], "780": ["Alberta", "MT"],
  "781": ["Massachusetts", "ET"], "782": ["Nova Scotia", "AT"], "784": ["St Vincent", "AT"],
  "785": ["Kansas", "CT"], "786": ["Florida", "ET"], "787": ["Puerto Rico", "AT"],
  "801": ["Utah", "MT"], "802": ["Vermont", "ET"], "803": ["South Carolina", "ET"],
  "804": ["Virginia", "ET"], "805": ["California", "PT"], "806": ["Texas", "CT"],
  "807": ["Ontario", "ET"], "808": ["Hawaii", "HT"], "809": ["Dominican Republic", "AT"],
  "810": ["Michigan", "ET"], "812": ["Indiana", "ET"], "813": ["Florida", "ET"],
  "814": ["Pennsylvania", "ET"], "815": ["Illinois", "CT"], "816": ["Missouri", "CT"],
  "817": ["Texas", "CT"], "818": ["California", "PT"], "819": ["Quebec", "ET"],
  "820": ["California", "PT"], "825": ["Alberta", "MT"], "828": ["North Carolina", "ET"],
  "830": ["Texas", "CT"], "831": ["California", "PT"], "832": ["Texas", "CT"],
  "838": ["New York", "ET"], "843": ["South Carolina", "ET"], "845": ["New York", "ET"],
  "847": ["Illinois", "CT"], "848": ["New Jersey", "ET"], "849": ["Dominican Republic", "AT"],
  "850": ["Florida", "CT"], "854": ["South Carolina", "ET"], "856": ["New Jersey", "ET"],
  "857": ["Massachusetts", "ET"], "858": ["California", "PT"], "859": ["Kentucky", "ET"],
  "860": ["Connecticut", "ET"], "862": ["New Jersey", "ET"], "863": ["Florida", "ET"],
  "864": ["South Carolina", "ET"], "865": ["Tennessee", "ET"], "867": ["Yukon / NWT", "MT"],
  "870": ["Arkansas", "CT"], "872": ["Illinois", "CT"], "873": ["Quebec", "ET"],
  "876": ["Jamaica", "ET"], "878": ["Pennsylvania", "ET"], "901": ["Tennessee", "CT"],
  "902": ["Nova Scotia", "AT"], "903": ["Texas", "CT"], "904": ["Florida", "ET"],
  "905": ["Ontario", "ET"], "906": ["Michigan", "ET"], "907": ["Alaska", "AKT"],
  "908": ["New Jersey", "ET"], "909": ["California", "PT"], "910": ["North Carolina", "ET"],
  "912": ["Georgia", "ET"], "913": ["Kansas", "CT"], "914": ["New York", "ET"],
  "915": ["Texas", "MT"], "916": ["California", "PT"], "917": ["New York", "ET"],
  "918": ["Oklahoma", "CT"], "919": ["North Carolina", "ET"], "920": ["Wisconsin", "CT"],
  "925": ["California", "PT"], "928": ["Arizona", "MT"], "929": ["New York", "ET"],
  "930": ["Indiana", "ET"], "931": ["Tennessee", "CT"], "935": ["California", "PT"],
  "936": ["Texas", "CT"], "937": ["Ohio", "ET"], "938": ["Alabama", "CT"],
  "940": ["Texas", "CT"], "941": ["Florida", "ET"], "947": ["Michigan", "ET"],
  "949": ["California", "PT"], "951": ["California", "PT"], "952": ["Minnesota", "CT"],
  "954": ["Florida", "ET"], "956": ["Texas", "CT"], "959": ["Connecticut", "ET"],
  "970": ["Colorado", "MT"], "971": ["Oregon", "PT"], "972": ["Texas", "CT"],
  "973": ["New Jersey", "ET"], "978": ["Massachusetts", "ET"], "979": ["Texas", "CT"],
  "980": ["North Carolina", "ET"], "984": ["North Carolina", "ET"], "985": ["Louisiana", "CT"],
  "986": ["Idaho", "MT"], "989": ["Michigan", "ET"],
};

const TOLL_FREE = new Set(["800", "833", "844", "855", "866", "877", "888"]);

/** Country calling codes we can name without a network lookup. Unlisted codes
 *  still classify as international — they simply carry no country label rather
 *  than a guessed one. */
const CC: Record<string, string> = {
  "20": "Egypt", "27": "South Africa", "30": "Greece", "31": "Netherlands", "32": "Belgium",
  "33": "France", "34": "Spain", "36": "Hungary", "39": "Italy", "40": "Romania",
  "41": "Switzerland", "43": "Austria", "44": "United Kingdom", "45": "Denmark", "46": "Sweden",
  "47": "Norway", "48": "Poland", "49": "Germany", "51": "Peru", "52": "Mexico",
  "53": "Cuba", "54": "Argentina", "55": "Brazil", "56": "Chile", "57": "Colombia",
  "58": "Venezuela", "60": "Malaysia", "61": "Australia", "62": "Indonesia", "63": "Philippines",
  "64": "New Zealand", "65": "Singapore", "66": "Thailand", "81": "Japan", "82": "South Korea",
  "84": "Vietnam", "86": "China", "90": "Turkey", "91": "India", "92": "Pakistan",
  "93": "Afghanistan", "94": "Sri Lanka", "95": "Myanmar", "98": "Iran",
  "212": "Morocco", "213": "Algeria", "216": "Tunisia", "218": "Libya", "220": "Gambia",
  "233": "Ghana", "234": "Nigeria", "251": "Ethiopia", "254": "Kenya", "255": "Tanzania",
  "256": "Uganda", "260": "Zambia", "263": "Zimbabwe", "351": "Portugal", "352": "Luxembourg",
  "353": "Ireland", "354": "Iceland", "358": "Finland", "359": "Bulgaria", "370": "Lithuania",
  "371": "Latvia", "372": "Estonia", "375": "Belarus", "380": "Ukraine", "381": "Serbia",
  "385": "Croatia", "386": "Slovenia", "420": "Czechia", "421": "Slovakia", "886": "Taiwan",
  "961": "Lebanon", "962": "Jordan", "963": "Syria", "964": "Iraq", "965": "Kuwait",
  "966": "Saudi Arabia", "971": "United Arab Emirates", "972": "Israel", "974": "Qatar",
  "977": "Nepal", "992": "Tajikistan", "994": "Azerbaijan", "995": "Georgia", "998": "Uzbekistan",
  "7": "Russia / Kazakhstan",
};

/** Digits-only canonical key, identical to the fold used by `phoneMessages.ts`
 *  so a peer profile here joins the ledger row there without translation. */
export function phoneKey(raw: string): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  if (d.length > 15) return d.slice(-15);
  return d;
}

export function classifyLine(raw: string | null): PeerLine {
  const digits = String(raw ?? "").replace(/\D/g, "");
  const plus = String(raw ?? "").trim().startsWith("+");
  const key = phoneKey(digits);

  if (!digits) {
    return { e164: null, key: null, name: null, lineClass: "unknown", areaCode: null, region: null, tzLabel: null, countryCode: null };
  }

  // Shortcodes never reach 7 digits. They are always automated senders.
  if (digits.length >= 4 && digits.length <= 6) {
    return { e164: digits, key, name: null, lineClass: "shortcode", areaCode: null, region: "Application-to-person sender", tzLabel: null, countryCode: null };
  }

  const nanp = digits.length === 10 ? digits : digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : null;
  if (nanp) {
    const npa = nanp.slice(0, 3);
    const hit = NANP[npa];
    const lineClass: LineClass =
      TOLL_FREE.has(npa) ? "toll_free" : npa === "900" || npa === "976" ? "premium_rate" : "nanp";
    return {
      e164: `+1${nanp}`,
      key,
      name: null,
      lineClass,
      areaCode: npa,
      region: hit?.[0] ?? (lineClass === "toll_free" ? "Toll-free (no geography)" : null),
      tzLabel: hit?.[1] ?? null,
      countryCode: "1",
    };
  }

  // Anything else that is long enough to be a real line is foreign. Match the
  // longest known calling code first so +1-vs-+12x style prefixes cannot fight.
  const cc = ["7", "20", "27", "30"].concat(Object.keys(CC))
    .sort((a, b) => b.length - a.length)
    .find((code) => digits.startsWith(code)) ?? null;
  return {
    e164: plus ? `+${digits}` : `+${digits}`,
    key,
    name: null,
    lineClass: "international",
    areaCode: null,
    region: cc ? (CC[cc] ?? null) : null,
    tzLabel: null,
    countryCode: cc,
  };
}

// ─── envelope parsing ──────────────────────────────────────────────────────

/** Display names Voice supplies about ITSELF. Never a correspondent. */
const GENERIC_NAMES = new Set([
  "google voice", "voice", "google", "unknown", "unknown caller",
  "no caller id", "anonymous", "restricted", "private",
]);

/** Timezone label → IANA zone, so the local hour is computed with real DST
 *  rules rather than a fixed offset that is wrong half the year. */
const IANA: Record<string, string> = {
  ET: "America/New_York", CT: "America/Chicago", MT: "America/Denver",
  PT: "America/Los_Angeles", AT: "America/Halifax", NT: "America/St_Johns",
  AKT: "America/Anchorage", HT: "Pacific/Honolulu", ChST: "Pacific/Guam",
  SST: "Pacific/Pago_Pago",
};

const flag = (
  code: string, severity: ForensicFlag["severity"], title: string, detail: string, evidence: string,
): ForensicFlag => ({ code, severity, title, detail, evidence: evidence.slice(0, 400) });


function verdictOf(score: number): VoiceEnvelope["verdict"] {
  return score >= 70 ? "hostile" : score >= 40 ? "suspect" : score >= 15 ? "watch" : "clean";
}

function authVerdict(authResults: string[], mech: "spf" | "dkim" | "dmarc"): AuthVerdict {
  for (const line of authResults) {
    const m = new RegExp(`\\b${mech}=([a-z]+)`, "i").exec(line);
    if (m) {
      const v = m[1].toLowerCase();
      if (["pass", "fail", "softfail", "neutral", "none", "temperror", "permerror"].includes(v)) return v as AuthVerdict;
    }
  }
  return "unknown";
}

export interface VoiceRawMessage {
  id: string;
  threadId?: string | null;
  internalDate?: string | number | null;
  sizeEstimate?: number | null;
  labelIds?: string[] | null;
  payload?: { headers?: Array<{ name?: string; value?: string }> } | null;
}

/**
 * Reads ONE Voice envelope. Returns null when the message is not a Voice
 * mirror, so an ordinary email swept up by a loose query can never be
 * mislabelled as a text message.
 */
export function analyzeVoiceEnvelope(msg: VoiceRawMessage): VoiceEnvelope | null {
  const H = indexHeaders(msg.payload?.headers);
  const one = (k: string) => H.get(k)?.[0] ?? null;
  const all = (k: string) => H.get(k) ?? [];

  const fromRaw = one("from") ?? "";
  const toRaw = one("to") ?? "";
  const subject = (one("subject") ?? "").slice(0, 300);
  const envelope = `${fromRaw} ${toRaw}`;

  const isTxtDomain = /txt\.voice\.google\.com/i.test(envelope);
  const isVoiceNoreply = /voice-noreply@google\.com/i.test(envelope);
  if (!isTxtDomain && !isVoiceNoreply) return null;

  // `voice-noreply` also carries account admin notices. Those are not
  // conversation and must not be filed against whatever number their body
  // mentions — the same guard the ingest harvester applies.
  const looksLikeMessage = /(text message|voicemail|missed call|mms|multimedia)/i.test(subject);
  if (!isTxtDomain && !looksLikeMessage) return null;

  const lower = subject.toLowerCase();
  const kind: VoiceKind =
    lower.includes("voicemail") ? "voicemail"
      : lower.includes("missed call") ? "missed_call"
        : /\.mms|picture|image|multimedia/i.test(lower) ? "mms"
          : "text";

  const labels = msg.labelIds ?? [];
  const direction: "in" | "out" =
    labels.includes("SENT") || /txt\.voice\.google\.com/i.test(toRaw) ? "out" : "in";

  // Envelope local part: <operator line>.<peer line>.<token>. The FIRST numeric
  // segment is the operator's own Voice number — reading it as the peer would
  // file every conversation on earth under the operator themselves.
  const voiceAddr = /txt\.voice\.google\.com/i.test(fromRaw) ? fromRaw : toRaw;
  const localPart = voiceAddr.match(/<?([^<>@\s]+)@txt\.voice\.google\.com/i)?.[1] ?? "";
  const segs = localPart.split(".").filter((s) => phoneKey(s).length >= 7);
  const operatorLine = segs.length ? classifyLine(segs[0]).e164 : null;
  const localPeer = segs.length > 1 ? segs[1] : "";

  const parsedFrom = parseAddress(fromRaw);
  const quoted = parsedFrom.name ?? "";
  const quotedIsNumber = !!quoted && phoneKey(quoted).length >= 7;
  const subjectNumber = /(\+?\d[\d\s().-]{5,20}\d)/.exec(subject)?.[1] ?? "";

  const peerSource = quotedIsNumber ? quoted : (localPeer || subjectNumber);
  const peer = classifyLine(peerSource);
  const nameMatch = /(?:from|to)\s+([A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+){0,3})/u.exec(subject);
  const rawName = ((quoted && !quotedIsNumber ? quoted : (nameMatch?.[1] ?? "")) || "")
    .replace(/\s*\((?:SMS|MMS|Voicemail|Text)\)\s*$/i, "").trim().slice(0, 120);
  // On missed-call and voicemail envelopes the display name is Google's own
  // service label, not the caller. Adopting it names every stranger who ever
  // rang the line "Google Voice".
  peer.name = rawName && !GENERIC_NAMES.has(rawName.toLowerCase()) ? rawName : null;


  if (!peer.key && kind === "text" && !operatorLine) return null;

  // ── Layer 1: is the notification itself genuine? ──
  const authResults = [...all("authentication-results"), ...all("arc-authentication-results")];
  const spf = authVerdict(authResults, "spf") !== "unknown"
    ? authVerdict(authResults, "spf")
    : (/\b(pass|fail|softfail|neutral|none)\b/i.exec(one("received-spf") ?? "")?.[1].toLowerCase() as AuthVerdict) ?? "unknown";
  const dkim = authVerdict(authResults, "dkim");
  const dmarc = authVerdict(authResults, "dmarc");

  const fromDomain = registrableDomain(domainOf(parsedFrom.address));
  const messageIdDomain = registrableDomain(
    (one("message-id") ?? "").split("@")[1]?.replace(/[<>]/g, "").trim() || null,
  );
  const googleOrigin = fromDomain === "google.com" || fromDomain === "txt.voice.google.com" ||
    (fromDomain ?? "").endsWith("google.com");
  const authentic = googleOrigin && spf !== "fail" && dkim === "pass" && dmarc !== "fail";

  const hops = buildChain(all("received"));
  const internalDate = msg.internalDate != null ? Number(msg.internalDate) : null;
  const at = internalDate && Number.isFinite(internalDate) && internalDate > 0
    ? new Date(internalDate).toISOString() : null;

  // Mailbox-clock hour. The Date header offset is the clock Google stamped for
  // this mailbox, which is the operator's own frame of reference — the only
  // honest basis for calling something a 3am message.
  const dateHeader = one("date");
  const offMatch = dateHeader ? /([+-])(\d{2})(\d{2})\s*$/.exec(dateHeader.trim()) : null;
  const utcOffsetMin = offMatch
    ? (offMatch[1] === "-" ? -1 : 1) * (Number(offMatch[2]) * 60 + Number(offMatch[3]))
    : null;
  const localHour = internalDate != null && Number.isFinite(internalDate)
    ? new Date(internalDate + (utcOffsetMin ?? 0) * 60_000).getUTCHours()
    : null;

  const senderMs = dateHeader ? Date.parse(dateHeader) : NaN;
  const transitSeconds = Number.isFinite(senderMs) && internalDate
    ? Math.max(0, Math.round((internalDate - senderMs) / 1000))
    : null;

  const sizeBytes = msg.sizeEstimate != null ? Number(msg.sizeEstimate) : null;
  // A pure text mirror is a small plaintext+html envelope. Weight well beyond
  // that is a carried attachment, which is inferable without opening it.
  const hasAttachment = (sizeBytes ?? 0) > 60_000 || kind === "mms" || kind === "voicemail";

  const flags: ForensicFlag[] = [];
  let risk = 0;

  if (!googleOrigin) {
    flags.push(flag("VOICE_FORGED_ORIGIN", "critical", "Not sent by Google",
      "This notification presents as Google Voice but did not originate from a google.com domain. Treat any link or callback number in it as hostile.",
      `From: ${fromRaw}`));
    risk += 70;
  } else if (dkim !== "pass" || dmarc === "fail" || spf === "fail") {
    flags.push(flag("VOICE_AUTH_FAIL", "critical", "Voice notification failed authentication",
      `Genuine Voice mail is always DKIM-signed and DMARC-aligned to google.com. This one reads spf=${spf} dkim=${dkim} dmarc=${dmarc}.`,
      authResults[0] ?? one("received-spf") ?? "no authentication headers present"));
    risk += 55;
  }
  if (messageIdDomain && !messageIdDomain.endsWith("google.com")) {
    flags.push(flag("VOICE_MESSAGEID_DRIFT", "high", "Message-ID not issued by Google",
      `The Message-ID was minted under ${messageIdDomain}, not a Google mail host.`,
      one("message-id") ?? ""));
    risk += 25;
  }
  if (peer.lineClass === "premium_rate") {
    flags.push(flag("PREMIUM_RATE_LINE", "high", "Premium-rate line",
      "Contact from a 900/976 line. Returning the call or text bills the operator.",
      peer.e164 ?? subject));
    risk += 35;
  }
  if (peer.lineClass === "shortcode") {
    flags.push(flag("A2P_SHORTCODE", "info", "Automated sender",
      "Shortcode traffic is application-to-person — a platform, not a person. Common for one-time codes and marketing.",
      peer.e164 ?? subject));
  }
  if (peer.lineClass === "international" && direction === "in") {
    flags.push(flag("FOREIGN_LINE", "medium", "Foreign line",
      `Inbound contact from a line issued outside the North American plan${peer.region ? ` (${peer.region})` : ""}.`,
      peer.e164 ?? subject));
    risk += 12;
  }
  // NOTE: the overnight-contact finding is NOT raised here. Google stamps the
  // Voice mirror in UTC, so at this point `localHour` is a UTC hour wearing a
  // local label — judging "3am" on it would libel every daytime message from a
  // western operator. The finding is raised in applyClockFrame(), once the
  // operator's real timezone has been established from their own Voice line.

  if (transitSeconds != null && transitSeconds > 600) {
    flags.push(flag("DELIVERY_LAG", "low", "Delayed mirror",
      `${Math.round(transitSeconds / 60)} minutes between the Voice switch stamping the message and the mailbox accepting it.`,
      dateHeader ?? ""));
  }

  return {
    id: msg.id,
    threadId: msg.threadId ?? null,
    kind, direction, at, internalDate, localHour, utcOffsetMin,
    operatorLine, peer, subject, sizeBytes, hasAttachment,
    spf, dkim, dmarc, authentic, fromDomain, messageIdDomain,
    hops, hopCount: hops.length, transitSeconds,
    flags, riskScore: Math.min(100, risk), verdict: verdictOf(risk),
  };
}

// ─── peer profiling ────────────────────────────────────────────────────────

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
};

const NIGHT = (h: number | null) => h != null && h >= 0 && h < 5;

export interface ClockFrame {
  zone: string | null;        // IANA zone the hours are expressed in
  basis: "operator_line" | "peer_majority" | "utc_fallback";
  evidence: string;           // the number or prefix the zone was derived from
}

/**
 * Establishes WHOSE clock the timeline is told on, then restates every hour in
 * it.
 *
 * Google stamps the Voice mirror with a UTC Date header, so the raw envelope
 * carries no local frame at all. Left uncorrected, a Pacific operator's 5pm
 * traffic reads as midnight and the overnight-contact finding fires on ordinary
 * afternoon conversation. The operator's own Voice line is the correct frame:
 * they chose its area code, and it is present in the envelope addressing.
 *
 * Mutates in place and returns the frame so the UI can name its own basis.
 */
export function applyClockFrame(envelopes: VoiceEnvelope[]): ClockFrame {
  const tally = (pick: (e: VoiceEnvelope) => string | null) => {
    const m = new Map<string, number>();
    for (const e of envelopes) {
      const v = pick(e);
      if (v) m.set(v, (m.get(v) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  };

  const dominantLine = tally((e) => e.operatorLine);
  const lineNpa = dominantLine ? phoneKey(dominantLine).slice(0, 3) : null;
  const peerTz = tally((e) => e.peer.tzLabel);

  let zone: string | null = null;
  let basis: ClockFrame["basis"] = "utc_fallback";
  let evidence = "no local frame available — hours shown in UTC";

  if (lineNpa && NANP[lineNpa]) {
    zone = IANA[NANP[lineNpa][1]] ?? null;
    if (zone) { basis = "operator_line"; evidence = `operator Voice line ${dominantLine}`; }
  }
  if (!zone && peerTz && IANA[peerTz]) {
    zone = IANA[peerTz];
    basis = "peer_majority";
    evidence = `majority of correspondents issued in ${peerTz}`;
  }

  const hourIn = (ms: number): number => {
    if (!zone) return new Date(ms).getUTCHours();
    try {
      return Number(new Intl.DateTimeFormat("en-US", {
        timeZone: zone, hour: "numeric", hour12: false,
      }).format(new Date(ms))) % 24;
    } catch {
      return new Date(ms).getUTCHours();
    }
  };

  for (const e of envelopes) {
    // Drop any hour-derived finding from the uncorrected pass before restating.
    e.flags = e.flags.filter((f) => f.code !== "OFF_HOURS_CONTACT");
    if (e.internalDate == null || !Number.isFinite(e.internalDate)) { e.localHour = null; continue; }
    e.localHour = hourIn(e.internalDate);
    if (NIGHT(e.localHour) && e.direction === "in") {
      e.flags.push(flag("OFF_HOURS_CONTACT", "low", "Overnight contact",
        `Landed at ${String(e.localHour).padStart(2, "0")}:00 in ${zone ?? "UTC"} — the operator's own timezone, taken from ${evidence}.`,
        e.at ?? ""));
      e.riskScore = Math.min(100, e.riskScore + 5);
      e.verdict = verdictOf(e.riskScore);
    }
  }

  return { zone, basis, evidence };
}

/**
 * Behavioural read of each correspondent. One message tells you someone texted.
 * The distribution over time tells you what the relationship is.
 *
 * `hasOutboundEvidence` is load-bearing: Google Voice only mirrors a REPLY into
 * the mailbox when the operator answered by email. Replies typed in the Voice
 * app itself never appear. A corpus with zero outbound is therefore a corpus
 * that is blind to replies, not a corpus proving the operator never answered —
 * asserting "never answered" from it would flag every friend they text back.
 */
export function profilePeers(
  envelopes: VoiceEnvelope[],
  opts: { hasOutboundEvidence?: boolean } = {},
): PeerProfile[] {
  const outboundVisible = opts.hasOutboundEvidence ?? envelopes.some((e) => e.direction === "out");

  const byPeer = new Map<string, VoiceEnvelope[]>();
  for (const e of envelopes) {
    const key = e.peer.key || (e.peer.e164 ?? "");
    if (!key) continue;
    const bucket = byPeer.get(key);
    if (bucket) bucket.push(e); else byPeer.set(key, [e]);
  }

  const out: PeerProfile[] = [];
  for (const [key, list] of byPeer) {
    list.sort((a, b) => (a.internalDate ?? 0) - (b.internalDate ?? 0));
    const stamps = list.map((e) => e.internalDate).filter((n): n is number => !!n);
    const gaps: number[] = [];
    for (let i = 1; i < stamps.length; i++) gaps.push(Math.round((stamps[i] - stamps[i - 1]) / 1000));

    // Largest count inside any rolling 10-minute window — O(n) over a sorted
    // list, not the O(n²) pairwise scan the naive read invites.
    let maxBurst = stamps.length ? 1 : 0;
    for (let lo = 0, hi = 0; hi < stamps.length; hi++) {
      while (stamps[hi] - stamps[lo] > 600_000) lo++;
      maxBurst = Math.max(maxBurst, hi - lo + 1);
    }

    const kinds: Record<VoiceKind, number> = { text: 0, mms: 0, voicemail: 0, missed_call: 0 };
    let inbound = 0, outbound = 0, night = 0, attachments = 0, bytes = 0;
    for (const e of list) {
      kinds[e.kind]++;
      if (e.direction === "in") inbound++; else outbound++;
      if (NIGHT(e.localHour)) night++;
      if (e.hasAttachment) attachments++;
      bytes += e.sizeBytes ?? 0;
    }

    const first = stamps.length ? new Date(stamps[0]).toISOString() : null;
    const last = stamps.length ? new Date(stamps[stamps.length - 1]).toISOString() : null;
    const spanDays = stamps.length > 1
      ? Math.round((stamps[stamps.length - 1] - stamps[0]) / 86_400_000) : 0;

    const head = list[0];
    const flags: ForensicFlag[] = [];
    let risk = 0;

    // Carry the worst per-message finding up to the peer — a forged envelope is
    // a property of the correspondent, not of one message.
    const worstMsg = list.reduce((a, b) => (b.riskScore > a.riskScore ? b : a), list[0]);
    if (worstMsg.riskScore >= 40) {
      flags.push(...worstMsg.flags.filter((f) => f.severity === "critical" || f.severity === "high"));
      risk += Math.min(60, worstMsg.riskScore);
    }

    const total = list.length;
    if (head.peer.lineClass !== "shortcode") {
      if (outboundVisible && outbound === 0 && inbound >= 5) {
        flags.push(flag("ONE_WAY_INBOUND", "medium", "Never answered",
          `${inbound} inbound contacts, zero replies. Either unwanted contact or an automated sender on a normal-looking line.`,
          `${inbound} in / 0 out`));
        risk += 15;
      }
      if (maxBurst >= 8) {
        flags.push(flag("BURST_TRAFFIC", "medium", "Burst pattern",
          `${maxBurst} messages inside a ten-minute window — flooding rather than conversation.`,
          `max burst ${maxBurst} / 10 min`));
        risk += 12;
      }
      if (total >= 6 && night / total >= 0.4) {
        flags.push(flag("NOCTURNAL_PATTERN", "medium", "Overnight-weighted",
          `${Math.round((night / total) * 100)}% of contact from this line lands between midnight and 05:00 on the mailbox clock.`,
          `${night}/${total} overnight`));
        risk += 10;
      }
      if (kinds.missed_call >= 3 && kinds.text === 0 && kinds.voicemail === 0) {
        flags.push(flag("RING_AND_DROP", "high", "Ring-and-drop pattern",
          `${kinds.missed_call} missed calls with no message ever left. This is the signature of a callback-toll (wangiri) scam or a probe for a live line.`,
          `${kinds.missed_call} missed calls, 0 voicemail`));
        risk += 25;
      }
      // A long silence followed by fresh traffic is the classic profile of a
      // recycled or resold number, and of a re-activated pressure campaign.
      const bigGap = gaps.length ? Math.max(...gaps) : 0;
      if (bigGap >= 90 * 86_400 && stamps.length >= 3) {
        flags.push(flag("DORMANT_REACTIVATED", "low", "Dormant then reactivated",
          `Silent for ${Math.round(bigGap / 86_400)} days before contact resumed.`,
          `max gap ${Math.round(bigGap / 86_400)}d`));
        risk += 8;
      }
    }

    out.push({
      key,
      e164: head.peer.e164,
      name: list.find((e) => e.peer.name)?.peer.name ?? null,
      lineClass: head.peer.lineClass,
      region: head.peer.region,
      tzLabel: head.peer.tzLabel,
      total, inbound, outbound, kinds,
      firstSeen: first, lastSeen: last, spanDays,
      medianGapSec: median(gaps),
      maxBurst,
      nightShare: total ? night / total : 0,
      // Null, not zero, when the channel cannot observe replies at all.
      reciprocity: outboundVisible && total ? outbound / total : null,

      attachmentCount: attachments,
      totalBytes: bytes,
      flags,
      riskScore: Math.min(100, risk),
      verdict: verdictOf(risk),
    });
  }

  return out.sort((a, b) => b.riskScore - a.riskScore || b.total - a.total);
}

/** Cross-peer patterns no single correspondent can reveal. */
export function aggregateVoice(
  envelopes: VoiceEnvelope[],
  peers: PeerProfile[],
  frame: ClockFrame = { zone: null, basis: "utc_fallback", evidence: "frame not resolved" },
): VoiceAggregate {

  const kinds: Record<VoiceKind, number> = { text: 0, mms: 0, voicemail: 0, missed_call: 0 };
  const hours = new Array(24).fill(0);
  const classCount = new Map<LineClass, { count: number; peers: Set<string> }>();
  const regionCount = new Map<string, { count: number; peers: Set<string> }>();
  const lines = new Map<string, number>();
  const flagCount = new Map<string, { title: string; severity: ForensicFlag["severity"]; count: number }>();
  const transits: number[] = [];
  let inbound = 0, outbound = 0, authentic = 0, unauth = 0, forged = 0;
  let first: number | null = null, last: number | null = null;

  for (const e of envelopes) {
    kinds[e.kind]++;
    if (e.direction === "in") inbound++; else outbound++;
    if (e.localHour != null) hours[e.localHour]++;
    if (e.transitSeconds != null) transits.push(e.transitSeconds);
    if (e.authentic) authentic++; else unauth++;
    if (e.flags.some((f) => f.code === "VOICE_FORGED_ORIGIN" || f.code === "VOICE_AUTH_FAIL")) forged++;
    if (e.operatorLine) lines.set(e.operatorLine, (lines.get(e.operatorLine) ?? 0) + 1);
    if (e.internalDate) {
      first = first == null ? e.internalDate : Math.min(first, e.internalDate);
      last = last == null ? e.internalDate : Math.max(last, e.internalDate);
    }

    const pk = e.peer.key ?? "";
    const c = classCount.get(e.peer.lineClass) ?? { count: 0, peers: new Set<string>() };
    c.count++; if (pk) c.peers.add(pk); classCount.set(e.peer.lineClass, c);
    if (e.peer.region) {
      const r = regionCount.get(e.peer.region) ?? { count: 0, peers: new Set<string>() };
      r.count++; if (pk) r.peers.add(pk); regionCount.set(e.peer.region, r);
    }
    for (const f of e.flags) {
      const prior = flagCount.get(f.code);
      if (prior) prior.count++;
      else flagCount.set(f.code, { title: f.title, severity: f.severity, count: 1 });
    }
  }
  for (const p of peers) {
    for (const f of p.flags) {
      const prior = flagCount.get(f.code);
      if (prior) prior.count++;
      else flagCount.set(f.code, { title: f.title, severity: f.severity, count: 1 });
    }
  }

  // Neighbour spoofing: several distinct numbers sharing one NPA-NXX block is
  // how a spam farm makes itself look local. Three or more is not coincidence.
  const byPrefix = new Map<string, { numbers: Set<string>; messages: number; region: string | null }>();
  for (const p of peers) {
    if (p.lineClass !== "nanp" || !p.key || p.key.length < 6) continue;
    const prefix = p.key.slice(0, 6);
    const b = byPrefix.get(prefix) ?? { numbers: new Set<string>(), messages: 0, region: p.region };
    b.numbers.add(p.e164 ?? p.key);
    b.messages += p.total;
    byPrefix.set(prefix, b);
  }
  const churnClusters = [...byPrefix.entries()]
    .filter(([, b]) => b.numbers.size >= 3)
    .map(([prefix, b]) => ({
      prefix: `${prefix.slice(0, 3)}-${prefix.slice(3)}`,
      region: b.region,
      numbers: [...b.numbers].slice(0, 12),
      messages: b.messages,
    }))
    .sort((a, b) => b.numbers.length - a.numbers.length);

  return {
    analyzed: envelopes.length,
    window: { first: first ? new Date(first).toISOString() : null, last: last ? new Date(last).toISOString() : null },
    kinds,
    directions: { inbound, outbound },
    peers: peers.length,
    lineClasses: [...classCount.entries()]
      .map(([lineClass, v]) => ({ lineClass, count: v.count, peers: v.peers.size }))
      .sort((a, b) => b.count - a.count),
    regions: [...regionCount.entries()]
      .map(([region, v]) => ({ region, count: v.count, peers: v.peers.size }))
      .sort((a, b) => b.count - a.count).slice(0, 20),
    hours,
    clockFrame: frame,
    outboundVisible: outbound > 0,

    operatorLines: [...lines.entries()].map(([line, count]) => ({ line, count })).sort((a, b) => b.count - a.count),
    auth: { authentic, unauthenticated: unauth, forged },
    medianTransitSec: median(transits),
    churnClusters,
    topFlags: [...flagCount.entries()]
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => b.count - a.count).slice(0, 12),
  };
}
