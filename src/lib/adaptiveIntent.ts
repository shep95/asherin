// adaptiveIntent.ts — per-message intent classifier for the Asherin chat composer.
//
// PROBLEM THIS SOLVES
// The composer used to depend on sticky, manually-toggled directives (LAW / NAR).
// Once LAW was on it wrapped EVERY subsequent send — including "thanks", a code
// paste, or a market question — in a 60-line comparative-law directive, which
// warped unrelated answers and could not be discovered by a user who does not
// know the button exists. This module classifies the CURRENT message only and
// lets the composer arm the right directive automatically, then stand down on
// the very next message when the signal disappears.
//
// Design constraints:
//  - Pure, synchronous, no network, no storage side effects (callers persist).
//  - O(n) over the message with a bounded, anchored pattern set — no catastrophic
//    backtracking (no nested quantifiers, no unbounded alternation on .*).
//  - Never sticky: classification of turn N never inherits from turn N-1.
//  - Conservative: a domain only fires on explicit lexical evidence.

export type IntentDomain =
  | "legal"
  | "code"
  | "market"
  | "osint"
  | "maps"
  | "astrology"
  | "imagine"
  | "research"
  | "security"
  | "howto"
  | "quickintel"
  | "smalltalk"
  | "general";

export interface DomainHit {
  domain: IntentDomain;
  score: number;
  evidence: string[];
}

export interface IntentReading {
  /** Highest-scoring domain, or "general" when nothing scored. */
  primary: IntentDomain;
  /** All domains that cleared their floor, strongest first. */
  domains: DomainHit[];
  /** 0-1 confidence in `primary`. */
  confidence: number;
  /** True when the message reads like someone who does not know the product. */
  novice: boolean;
  /** True when the message is banter/acknowledgement — never wrap these. */
  smalltalk: boolean;
  /** Tool surfaces the message is reaching for, by dashboard route id. */
  toolTargets: string[];
  /** Convenience: legal score (0-1), used by the composer's AUTO LAW arming. */
  legalScore: number;
}

// ── Pattern table ─────────────────────────────────────────────────────────
// Each entry: [weight, regex]. Weights sum, then normalise against the domain
// ceiling. Regexes are word-anchored and quantifier-flat by construction.
type Rule = [number, RegExp];

const RULES: Record<Exclude<IntentDomain, "general" | "smalltalk">, Rule[]> = {
  legal: [
    [3, /\b(is it (legal|illegal|lawful)|am i allowed|can (i|they|he|she) legally|do i have (the )?right)\b/i],
    [3, /\b(sue|suing|lawsuit|subpoena|indict(ed|ment)?|felony|misdemeanor|deposition|litigation|plaintiff|defendant)\b/i],
    [3, /\b(statute|ordinance|case law|precedent|jurisdiction|due process|habeas|tort|liab(le|ility))\b/i],
    [3, /\b(landlord|tenant|evict(ed|ion)?|custody|divorce|alimony|child support|restraining order)\b/i],
    [3, /\b(breach of contract|non-?compete|nda|licen[cs]e agreement|terms of service)\b/i],
    [2, /\b(contract|lease|clause|indemnit|arbitration|liab(le|ility) waiver)\b/i],
    [2, /\b(my rights|police (stop|search|report)|miranda|warrant|expunge|parole|probation)\b/i],
    [2, /\b(copyright|trademark|patent|infringement|defamation|libel|slander)\b/i],
    [1, /\b(law|legal|attorney|lawyer|court|judge|statutory|regulation)\b/i],
  ],
  code: [
    [3, /```/],
    [3, /\b(stack ?trace|typeerror|referenceerror|null pointer|segfault|compile error|build fail(ed|ure)?)\b/i],
    [2, /\b(debug|refactor|unit test|typescript|python|react|sql query|api endpoint|edge function)\b/i],
    [2, /\b(why (is|does) (my|this) (code|function|component|query))\b/i],
    [1, /\b(function|const |import |class |=>|npm |git )\b/],
  ],
  market: [
    [3, /\b(price target|support and resistance|liquidity sweep|order block|fair value gap|measured move)\b/i],
    [3, /\b(will (btc|bitcoin|eth|ethereum|spy|nasdaq|gold|oil|[a-z]{1,5}) (go|hit|reach|drop|pump|dump))\b/i],
    [2, /\b(bull(ish)?|bear(ish)?|long|short|entry|stop loss|take profit|breakout|retrace)\b/i],
    [2, /\b(ticker|stock|crypto|forex|futures|options|chart|candle)\b/i],
    [1, /\$[A-Z]{1,5}\b/],
  ],
  osint: [
    [3, /\b(background check|dossier|intelligence report|find (everything|info|details) (on|about)|look ?up this (person|guy|woman))\b/i],
    [3, /\b(osint|skip trace|people search|reverse (phone|image|email) (lookup|search))\b/i],
    [3, /\b(find (someone|somebody|a person)('| )?s? (address|phone|email|info)|track down (someone|somebody|a person))\b/i],
    [2, /\b(who is|whois|address history|relatives|known associates|phone number|email address)\b/i],
    [2, /\b(license plate|plate number|vin|driver'?s licen[cs]e)\b/i],
    [1, /\b(investigate|profile|trace|records)\b/i],
  ],
  maps: [
    [3, /\b(take me to|show me on the map|navigate to|route to|fastest route|drop a (pin|marker))\b/i],
    [2, /\b(satellite (view|imagery)|street ?view|traffic cam(era)?s?|coordinates|lat(itude)?\/?long)\b/i],
    [2, /\b(where is my (laptop|phone|device|airpods|tag)|find my (device|phone|laptop))\b/i],
    [1, /\b(map|nearby|distance from|directions)\b/i],
  ],
  astrology: [
    [3, /\b(natal chart|birth chart|vimshottari|dasha|nakshatra|ascendant|rising sign|transit(s)? (over|through))\b/i],
    [2, /\b(vedic|astrolog|horoscope|retrograde|eclipse|zodiac|mercury|saturn return)\b/i],
    [1, /\b(sign|chart|planet)\b/i],
  ],
  imagine: [
    [3, /\b(generate an? image|create an? (image|picture|poster|logo)|draw me|render an?)\b/i],
    [2, /\b(what('| i)?s in this (photo|image|picture)|analy[sz]e this (photo|image|screenshot))\b/i],
    [1, /\b(image|photo|picture|screenshot)\b/i],
  ],
  research: [
    [3, /\b(cite (your )?sources|with sources|latest news (on|about)|what happened (to|with|in))\b/i],
    [2, /\b(research|fact ?check|verify|according to|studies (show|say)|published)\b/i],
    [1, /\b(news|report|article|paper)\b/i],
  ],
  security: [
    [3, /\b(am i being (hacked|tracked|followed|watched)|someone (changed|reset) my password|my account (was|got) (hacked|breached))\b/i],
    [2, /\b(stalker|surveillance|bluetooth tracker|airtag|evil twin|wifi (sentinel|intrusion)|phishing)\b/i],
    [2, /\b(vpn|ip address|leak(ed)? (data|credentials)|data breach|breached|2fa|mfa)\b/i],
    [1, /\b(security|secure|privacy|protect)\b/i],
  ],
  quickintel: [
    [3, /\b(is|are)\b[^?\n]{0,60}\b(open|closed|still open|open now)\b/i],
    [3, /\b(open (now|today|late)|what time (do|does|are) [a-z ]{0,30}(open|close)|hours of operation|opening hours|closing time)\b/i],
    [3, /\b(near me|nearby|closest|nearest|around (here|me)|in my area|walking distance)\b/i],
    [2, /\b(look (this|that|it) up|search the web|check online)\b/i],
    [2, /\b(find|look up|search)\b[^?\n]{0,60}\b(on the web|online|on google)\b/i],
    [2, /\b(wait time|in stock|available (now|today|tonight)|any (tables|appointments|slots)|reservation)\b/i],
    [2, /\b(weather|forecast|traffic (on|to)|flight status|is it raining)\b/i],
    [1, /\b(right now|tonight|today|currently)\b/i],
  ],
  howto: [
    [3, /\b(how (do|can) i (use|start|begin|find|get)|where (is|do i find)|what (can|does) (you|this|asherin|aureon) do)\b/i],
    [3, /\b(i('| a)?m new|i don'?t know (how|where|what)|help me get started|walk me through|show me how)\b/i],
    [2, /\b(is there a (tool|feature|tab|button)|which (tool|tab|feature) (should|do) i)\b/i],
    [1, /\b(tutorial|guide|explain how|getting started)\b/i],
  ],
};

const DOMAIN_CEILING: Record<string, number> = {
  legal: 6,
  code: 7,
  market: 7,
  osint: 7,
  maps: 6,
  astrology: 5,
  imagine: 5,
  research: 5,
  security: 6,
  howto: 6,
  quickintel: 6,
};

const TOOL_TARGETS: Partial<Record<IntentDomain, string[]>> = {
  osint: ["zophiel-search", "nomad", "cloud-intelligence"],
  maps: ["asherin-maps", "zaxin"],
  astrology: ["vedic"],
  market: ["imagine"],
  imagine: ["imagine"],
  security: ["bulwark", "cloud-intelligence"],
  code: ["development-suite"],
  research: ["zophiel-search"],
  quickintel: ["zophiel-search", "asherin-maps"],
  legal: [],
};

const SMALLTALK = /^(?:(?:hi|hey|hello|yo|sup|thanks|thank you|ty|ok(?:ay)?|k|cool|nice|lol|lmao|haha|got it|makes sense|no worries|bye|gn|gm|please|yes|no|yep|nope|sure|same|true|facts|right|word|fair|indeed|ikr|damn|wow|great|perfect|awesome)[\s!.,?]*)+$/i;

/** Cap analysed length so a 200 KB paste cannot stall the composer. */
const MAX_SCAN = 4000;

export function classifyMessage(raw: string): IntentReading {
  const text = (raw || "").slice(0, MAX_SCAN).trim();
  const empty: IntentReading = {
    primary: "general",
    domains: [],
    confidence: 0,
    novice: false,
    smalltalk: false,
    toolTargets: [],
    legalScore: 0,
  };
  if (!text) return empty;

  if (SMALLTALK.test(text) || text.length < 4) {
    return { ...empty, primary: "smalltalk", smalltalk: true };
  }

  const hits: DomainHit[] = [];
  for (const [domain, rules] of Object.entries(RULES)) {
    let score = 0;
    const evidence: string[] = [];
    for (const [weight, re] of rules) {
      const m = re.exec(text);
      if (m) {
        score += weight;
        evidence.push(m[0].trim().slice(0, 48));
      }
    }
    if (score <= 0) continue;
    const norm = Math.min(1, score / (DOMAIN_CEILING[domain] || 6));
    // Floor: a single weight-1 keyword is never enough to route on.
    if (score < 2) continue;
    hits.push({ domain: domain as IntentDomain, score: norm, evidence });
  }

  hits.sort((a, b) => b.score - a.score);
  const primary = hits[0]?.domain ?? "general";
  const top = hits[0]?.score ?? 0;
  const runnerUp = hits[1]?.score ?? 0;
  // Confidence penalises a crowded field: two equally-strong domains is ambiguous.
  const confidence = top === 0 ? 0 : Math.max(0, Math.min(1, top - runnerUp * 0.5));

  const noviceHit = hits.find((h) => h.domain === "howto");
  const legal = hits.find((h) => h.domain === "legal");

  const toolTargets = Array.from(
    new Set(hits.flatMap((h) => TOOL_TARGETS[h.domain] || [])),
  ).slice(0, 4);

  return {
    primary,
    domains: hits,
    confidence,
    novice: Boolean(noviceHit) || /\?$/.test(text) && text.split(/\s+/).length <= 6 && hits.length === 0,
    smalltalk: false,
    toolTargets,
    legalScore: legal?.score ?? 0,
  };
}

/**
 * AUTO-LAW gate. The legal directive is heavy; it only earns its place when the
 * message is clearly a legal question AND legal is the dominant read. A code
 * paste that happens to say "license" must not trigger it.
 */
export const AUTO_LEGAL_THRESHOLD = 0.5;

export function shouldAutoArmLegal(reading: IntentReading): boolean {
  if (reading.smalltalk) return false;
  if (reading.primary !== "legal") return false;
  return reading.legalScore >= AUTO_LEGAL_THRESHOLD;
}

export type LawSwitch = "auto" | "on" | "off";

const LAW_SWITCH_KEY = "asherin_law_switch";

export function loadLawSwitch(): LawSwitch {
  try {
    const v = localStorage.getItem(LAW_SWITCH_KEY);
    if (v === "on" || v === "off" || v === "auto") return v;
    // Migrate the legacy boolean toggle: previously-on users keep an explicit ON.
    const legacy = localStorage.getItem("aureon_legal_mode");
    if (legacy === "true") return "on";
  } catch { /* storage unavailable — fall through to auto */ }
  return "auto";
}

export function saveLawSwitch(v: LawSwitch) {
  try { localStorage.setItem(LAW_SWITCH_KEY, v); } catch { /* non-fatal */ }
}

export function cycleLawSwitch(v: LawSwitch): LawSwitch {
  return v === "auto" ? "on" : v === "on" ? "off" : "auto";
}

/**
 * Compact routing hint handed to the model alongside the message. It tells the
 * model what the operator is reaching for and — critically — that the operator
 * may not know the product, so it must name the exact surface instead of
 * assuming familiarity. Kept short so it never crowds the real question.
 */
export function buildRoutingHint(reading: IntentReading): string {
  if (reading.smalltalk || reading.primary === "general") return "";
  const parts = [`intent=${reading.primary}`, `confidence=${reading.confidence.toFixed(2)}`];
  if (reading.toolTargets.length) parts.push(`surfaces=${reading.toolTargets.join(",")}`);
  if (reading.novice) parts.push("operator_familiarity=low");
  return `[ADAPTIVE ROUTER] ${parts.join(" | ")}`;
}
