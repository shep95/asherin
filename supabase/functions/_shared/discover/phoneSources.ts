// phone sources — normalisation plus the public surfaces that will answer.
//
// carrier lookup and cnam are paid apis; they surface unmeasured with the exact
// key name rather than a guess. what we can do for free and honestly: parse the
// number into e.164, derive the nanp region from the area code (a published
// allocation fact, not an inference about the person), and sweep public indexes
// for the number's common written forms.

import type { IdResult, IdRow } from "./identitySources.ts";
import { fetchJson, extractIdentifiers } from "./httpJson.ts";
import { runSurfaceWave } from "../surfaceRetrieval.ts";

export interface PhoneShape {
  e164: string | null;
  countryCode: string | null;
  nanpAreaCode: string | null;
  variants: string[];
}

// nanp area code → region. published allocation table (subset kept current for
// the ranges we can state as fact; unknown codes report as unknown, not guessed)
const NANP_REGIONS: Record<string, string> = {
  "201": "new jersey", "202": "washington dc", "203": "connecticut", "205": "alabama", "206": "washington",
  "207": "maine", "208": "idaho", "209": "california", "210": "texas", "212": "new york city",
  "213": "los angeles", "214": "dallas", "215": "philadelphia", "216": "cleveland", "217": "illinois",
  "218": "minnesota", "224": "illinois", "225": "louisiana", "228": "mississippi", "229": "georgia",
  "231": "michigan", "234": "ohio", "239": "florida", "240": "maryland", "248": "michigan",
  "251": "alabama", "252": "north carolina", "253": "washington", "254": "texas", "256": "alabama",
  "260": "indiana", "262": "wisconsin", "267": "philadelphia", "269": "michigan", "270": "kentucky",
  "276": "virginia", "281": "houston", "301": "maryland", "302": "delaware", "303": "denver",
  "304": "west virginia", "305": "miami", "307": "wyoming", "308": "nebraska", "309": "illinois",
  "310": "los angeles", "312": "chicago", "313": "detroit", "314": "st louis", "315": "new york",
  "316": "kansas", "317": "indianapolis", "318": "louisiana", "319": "iowa", "320": "minnesota",
  "321": "florida", "323": "los angeles", "325": "texas", "330": "ohio", "331": "illinois",
  "334": "alabama", "336": "north carolina", "337": "louisiana", "339": "massachusetts", "347": "new york city",
  "351": "massachusetts", "352": "florida", "360": "washington", "361": "texas", "364": "kentucky",
  "380": "ohio", "385": "utah", "386": "florida", "401": "rhode island", "402": "nebraska",
  "404": "atlanta", "405": "oklahoma city", "406": "montana", "407": "orlando", "408": "san jose",
  "409": "texas", "410": "maryland", "412": "pittsburgh", "413": "massachusetts", "414": "milwaukee",
  "415": "san francisco", "417": "missouri", "419": "ohio", "423": "tennessee", "424": "los angeles",
  "425": "washington", "430": "texas", "432": "texas", "434": "virginia", "435": "utah",
  "440": "ohio", "442": "california", "443": "maryland", "469": "dallas", "470": "atlanta",
  "475": "connecticut", "478": "georgia", "479": "arkansas", "480": "phoenix", "484": "pennsylvania",
  "501": "arkansas", "502": "louisville", "503": "portland", "504": "new orleans", "505": "new mexico",
  "507": "minnesota", "508": "massachusetts", "509": "washington", "510": "oakland", "512": "austin",
  "513": "cincinnati", "515": "des moines", "516": "long island", "517": "michigan", "518": "new york",
  "520": "arizona", "530": "california", "531": "nebraska", "534": "wisconsin", "539": "oklahoma",
  "540": "virginia", "541": "oregon", "551": "new jersey", "559": "california", "561": "florida",
  "562": "california", "563": "iowa", "567": "ohio", "570": "pennsylvania", "571": "virginia",
  "573": "missouri", "574": "indiana", "575": "new mexico", "580": "oklahoma", "585": "rochester",
  "586": "michigan", "601": "mississippi", "602": "phoenix", "603": "new hampshire", "605": "south dakota",
  "606": "kentucky", "607": "new york", "608": "wisconsin", "609": "new jersey", "610": "pennsylvania",
  "612": "minneapolis", "614": "columbus", "615": "nashville", "616": "michigan", "617": "boston",
  "618": "illinois", "619": "san diego", "620": "kansas", "623": "arizona", "626": "california",
  "628": "san francisco", "629": "tennessee", "630": "illinois", "631": "long island", "636": "missouri",
  "641": "iowa", "646": "new york city", "650": "san mateo", "651": "st paul", "657": "california",
  "660": "missouri", "661": "california", "662": "mississippi", "667": "maryland", "669": "san jose",
  "678": "atlanta", "681": "west virginia", "682": "texas", "701": "north dakota", "702": "las vegas",
  "703": "virginia", "704": "charlotte", "706": "georgia", "707": "california", "708": "illinois",
  "712": "iowa", "713": "houston", "714": "orange county", "715": "wisconsin", "716": "buffalo",
  "717": "pennsylvania", "718": "new york city", "719": "colorado", "720": "denver", "724": "pennsylvania",
  "725": "las vegas", "727": "florida", "731": "tennessee", "732": "new jersey", "734": "michigan",
  "737": "austin", "740": "ohio", "743": "north carolina", "747": "los angeles", "754": "florida",
  "757": "virginia", "760": "california", "762": "georgia", "763": "minnesota", "765": "indiana",
  "769": "mississippi", "770": "georgia", "772": "florida", "773": "chicago", "774": "massachusetts",
  "775": "nevada", "779": "illinois", "781": "massachusetts", "785": "kansas", "786": "miami",
  "801": "salt lake city", "802": "vermont", "803": "south carolina", "804": "richmond", "805": "california",
  "806": "texas", "808": "hawaii", "810": "michigan", "812": "indiana", "813": "tampa",
  "814": "pennsylvania", "815": "illinois", "816": "kansas city", "817": "fort worth", "818": "los angeles",
  "828": "north carolina", "830": "texas", "831": "california", "832": "houston", "843": "south carolina",
  "845": "new york", "847": "illinois", "848": "new jersey", "850": "florida", "854": "south carolina",
  "856": "new jersey", "857": "boston", "858": "san diego", "859": "kentucky", "860": "connecticut",
  "862": "new jersey", "863": "florida", "864": "south carolina", "865": "tennessee", "870": "arkansas",
  "872": "chicago", "878": "pennsylvania", "901": "memphis", "903": "texas", "904": "jacksonville",
  "906": "michigan", "907": "alaska", "908": "new jersey", "909": "california", "910": "north carolina",
  "912": "georgia", "913": "kansas", "914": "westchester", "915": "el paso", "916": "sacramento",
  "917": "new york city", "918": "tulsa", "919": "raleigh", "920": "wisconsin", "925": "california",
  "928": "arizona", "929": "new york city", "930": "indiana", "931": "tennessee", "934": "new york",
  "936": "texas", "937": "ohio", "938": "alabama", "940": "texas", "941": "florida",
  "947": "michigan", "949": "orange county", "951": "california", "952": "minnesota", "954": "fort lauderdale",
  "956": "texas", "959": "connecticut", "970": "colorado", "971": "oregon", "972": "dallas",
  "973": "new jersey", "978": "massachusetts", "979": "texas", "980": "north carolina", "984": "north carolina",
  "985": "louisiana", "989": "michigan",
  // canada
  "204": "manitoba", "226": "ontario", "236": "british columbia", "249": "ontario", "250": "british columbia",
  "289": "ontario", "306": "saskatchewan", "343": "ontario", "365": "ontario", "367": "quebec",
  "403": "alberta", "416": "toronto", "418": "quebec", "431": "manitoba", "437": "toronto",
  "438": "montreal", "450": "quebec", "506": "new brunswick", "514": "montreal", "519": "ontario",
  "579": "quebec", "581": "quebec", "587": "alberta", "604": "vancouver", "613": "ottawa",
  "639": "saskatchewan", "647": "toronto", "672": "british columbia", "705": "ontario", "709": "newfoundland",
  "742": "ontario", "778": "british columbia", "780": "alberta", "782": "nova scotia", "807": "ontario",
  "819": "quebec", "825": "alberta", "867": "northern canada", "873": "quebec", "902": "nova scotia",
  "905": "ontario",
};

export function shapePhone(raw: string): PhoneShape {
  const digits = raw.replace(/[^\d+]/g, "");
  let e164: string | null = null;
  let countryCode: string | null = null;
  let nanpAreaCode: string | null = null;

  if (/^\+\d{8,15}$/.test(digits)) {
    e164 = digits;
  } else {
    const only = digits.replace(/\D/g, "");
    if (only.length === 10) { e164 = `+1${only}`; }
    else if (only.length === 11 && only.startsWith("1")) { e164 = `+${only}`; }
    else if (only.length >= 8 && only.length <= 15) { e164 = `+${only}`; }
  }
  if (e164?.startsWith("+1") && e164.length === 12) {
    countryCode = "1";
    nanpAreaCode = e164.slice(2, 5);
  } else if (e164) {
    countryCode = e164.slice(1, 3);
  }

  const bare = (e164 ?? raw).replace(/\D/g, "");
  const last10 = bare.slice(-10);
  const variants = new Set<string>([raw.trim()]);
  if (e164) variants.add(e164);
  if (last10.length === 10) {
    variants.add(last10);
    variants.add(`(${last10.slice(0, 3)}) ${last10.slice(3, 6)}-${last10.slice(6)}`);
    variants.add(`${last10.slice(0, 3)}-${last10.slice(3, 6)}-${last10.slice(6)}`);
    variants.add(`${last10.slice(0, 3)}.${last10.slice(3, 6)}.${last10.slice(6)}`);
  }
  return { e164, countryCode, nanpAreaCode, variants: [...variants].filter(Boolean) };
}

export function phoneAllocation(shape: PhoneShape): IdResult {
  if (!shape.e164) return { available: false, reason: "number could not be parsed into e.164", rows: [] };
  const rows: IdRow[] = [];
  if (shape.nanpAreaCode) {
    const region = NANP_REGIONS[shape.nanpAreaCode];
    rows.push({
      source: "nanp.allocation",
      kind: "allocation",
      url: `https://nationalnanpa.com/enas/area_code_query.do?method=display&areaCode=${shape.nanpAreaCode}`,
      summary: region
        ? `area code ${shape.nanpAreaCode} is allocated to ${region} — the allocation is a fact about the code, not proof of where the holder lives (numbers port)`
        : `area code ${shape.nanpAreaCode} is a valid nanp code; the published allocation for it is not in the local table`,
      discovered: [],
    });
  } else {
    rows.push({
      source: "nanp.allocation",
      kind: "allocation",
      summary: `parsed as ${shape.e164}; country code +${shape.countryCode ?? "?"} is outside the nanp so no area-code table applies`,
      discovered: [],
    });
  }
  return { available: true, rows };
}

/** free public breach index accepts a phone as the check value. */
export async function leakCheckPhone(shape: PhoneShape): Promise<IdResult> {
  const value = shape.e164?.replace("+", "") ?? null;
  if (!value) return { available: false, reason: "no e.164 form to check", rows: [] };
  const r = await fetchJson<{ success?: boolean; found?: number; sources?: Array<{ name: string; date?: string }>; error?: string }>(
    `https://leakcheck.io/api/public?check=${encodeURIComponent(value)}`,
    12_000,
  );
  if (!r.ok) return { available: false, reason: r.reason ?? "leakcheck unavailable", rows: [] };
  const j = r.value;
  if (!j?.success) return { available: true, rows: [] };
  const sources = j.sources ?? [];
  return {
    available: true,
    rows: sources.slice(0, 25).map((s) => ({
      source: "leakcheck.public",
      kind: "breach",
      url: "https://leakcheck.io/",
      summary: `this number appears in the public breach index for ${s.name}${s.date ? ` (${s.date})` : ""}`,
      discovered: [],
    })),
  };
}

export async function phoneOpenWeb(shape: PhoneShape): Promise<IdResult> {
  const forms = shape.variants.slice(0, 3).map((v) => `"${v}"`).join(" OR ");
  if (!forms) return { available: true, rows: [] };
  try {
    const wave = await runSurfaceWave(forms, { limit: 10, yieldFloor: 3, providerFloor: 1 });
    if (wave.hits.length === 0 && wave.liveProviders === 0) {
      return { available: false, reason: `open web index did not answer (${wave.telemetry.find((t) => !t.ok)?.reason ?? "blocked"})`, rows: [] };
    }
    return {
      available: true,
      rows: wave.hits.slice(0, 10).map((h) => ({
        source: "open-web",
        kind: "mention",
        url: h.url,
        summary: `a public page carries this number: ${h.title || h.url}`,
        evidence: h.snippet?.slice(0, 300),
        discovered: extractIdentifiers(`${h.title} ${h.snippet}`),
      })),
    };
  } catch (e) {
    return { available: false, reason: e instanceof Error ? e.message : "open web sweep failed", rows: [] };
  }
}

export function phoneUnmeasured(): Record<string, { available: false; reason: string }> {
  return {
    "carrier.numverify": { available: false, reason: "requires NUMVERIFY_API_KEY" },
    "opencnam": { available: false, reason: "requires OPENCNAM credentials" },
    "twilio.lookup": { available: false, reason: "requires TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN" },
    "reverse.directory": { available: false, reason: "no free reverse-directory api exists; the open-web sweep covers indexed listings instead" },
  };
}
