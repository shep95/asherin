// ═══════════════════════════════════════════════════════════════════════════
// PROMPT RELEVANCE ROUTER — what the turn actually needs in the prompt
//
// THE PROBLEM
//
// Aureon's system prompt was unconditional. Every message — "hello", a chart
// read, an OSINT identity lookup — carried the same ~1,000 inline lines of
// identity and doctrine plus every specialist brain the platform owns:
// comedy, gematria, Vedic astrology, forensic linguistics, war-strategy,
// visual dominance, geolocation, the 40KB analytics matrix. Roughly 170KB of
// prefill the model had to read before it could emit its first token, most of
// it irrelevant to the turn that paid for it.
//
// Time-to-first-token is dominated by prefill on a prompt that size, so the
// cost was paid on EVERY message, including the ones that needed none of it.
//
// THE RULE
//
// Classify the turn once, then attach only the modules that can change the
// answer. Two categories are never gated:
//
//   · VOICE — identity, doctrine, secrecy, mode/depth/persona. These are what
//     makes an answer Aureon's rather than a generic assistant's; dropping
//     them to save bytes changes who is speaking, which is not a performance
//     optimisation, it is a different product.
//   · OPERATOR SIGNAL — the user's own brain, memory, vault, overrides. The
//     user put those there deliberately.
//
// Everything else is a specialist and answers to its own domain.
//
// FAILURE MODE THIS AVOIDS
//
// A gate that is too tight is worse than no gate: an answer that silently
// loses a brain it needed is a regression the user experiences as "it got
// dumber", and they cannot see why. So every predicate here is deliberately
// generous — it errs toward INCLUDING a brain on an ambiguous turn — and the
// `deep` escape hatch below turns nearly everything back on for long,
// multi-clause, or research-mode messages, where prefill is a small fraction
// of the total turn cost anyway.
// ═══════════════════════════════════════════════════════════════════════════

export interface TurnRelevance {
  /** Short, simple, conversational turn — the cheapest possible prompt. */
  trivial: boolean;
  /** Long/complex/research turn — specialist gating relaxes. */
  deep: boolean;
  coding: boolean;
  intel: boolean;
  strategic: boolean;
  vedic: boolean;
  gematria: boolean;
  market: boolean;
  visual: boolean;
  social: boolean;
  geo: boolean;
  psychology: boolean;
  linguistics: boolean;
  creative: boolean;
  humor: boolean;
  analytics: boolean;
  /** Human-readable list of the specialists that were attached (for logs). */
  attached: string[];
}

export interface RelevanceSignals {
  /** Last user message text. */
  text: string;
  /** Conversation tail, so a follow-up ("and the second one?") keeps context. */
  recent?: string;
  mode?: string;
  responseDepth?: string;
  hasImageAttachment?: boolean;
  hasChartAttachment?: boolean;
  hasCodeAttachment?: boolean;
  /** Retrieval layers that already fired — a turn with evidence is not trivial. */
  hasEvidence?: boolean;
  /** The jurisdictional/OSINT classifier already said this is an identity turn. */
  isIntelTurn?: boolean;
}

const has = (re: RegExp, s: string) => re.test(s);

const RE = {
  coding:
    /\b(code|coding|compil|function|component|api|endpoint|bug|error|stack ?trace|refactor|typescript|javascript|python|react|sql|schema|deploy|build|repo|git|regex|algorithm|architecture|latency|runtime|null|undefined|exception|test|lint)\w*/i,
  intel:
    /\b(who is|background|dossier|osint|investigat|lookup|records?|arrest|court|deed|property|licen[cs]e|registrat|address|phone|email|profile|trace|identify|verify|sweep|dork|leak|breach|expos)\w*/i,
  strategic:
    /\b(geopolit|conflict|war|escalat|sanction|alliance|nato|defen[cs]e|deterrenc|regime|border|treaty|militar|logistic|supply chain|threat|adversar)\w*/i,
  vedic:
    /\b(vedic|astrolog|horoscope|nakshatra|dasha|rashi|jyotish|natal|transit|zodiac|ascendant|planet|karaka|graha|kundli|birth chart)\w*/i,
  gematria:
    /\b(gematria|numerolog|numeric value|hebrew|kabbal|occult|symbolic|esoteric|ciph|sacred number|synchronic)\w*/i,
  market:
    /\b(market|price|chart|trade|trading|stock|crypto|bitcoin|btc|eth|forex|candle|support|resistance|liquidity|bull|bear|position|entry|target|invest|ticker|earnings)\w*/i,
  visual:
    /\b(image|photo|picture|screenshot|visual|see this|look at|diagram|frame|video|face|logo|colou?r|design)\w*/i,
  social:
    /\b(instagram|twitter|x\.com|facebook|linkedin|tiktok|reddit|youtube|snapchat|telegram|discord|profile|follower|post|handle|@[a-z0-9_.]{3,})\w*/i,
  geo:
    /\b(map|maps|location|coordinate|latitude|longitude|gps|route|distance|nearby|address|city|country|satellite|street|terrain|geofence|where is)\w*/i,
  psychology:
    /\b(psycholog|behaviou?r|motive|intent|manipulat|deceiv|lying|liar|honest|emotion|feel|anxious|trauma|relationship|trust|personality|narciss)\w*/i,
  linguistics:
    /\b(statement|testimony|transcript|interview|deposition|wrote|said|claim|denial|phrasing|wording|tone of|linguistic|analyz(e|ing) (this|the) (text|message|email))\w*/i,
  creative:
    /\b(write|story|script|narrative|essay|blog|poem|lyric|copy|headline|pitch|brand|slogan|caption|draft|rewrite|creative)\w*/i,
  humor:
    /\b(joke|funny|humor|humour|roast|meme|sarcas|witty|laugh|comed)\w*/i,
  analytics:
    /\b(analy[sz]|data|dataset|statistic|regression|correlat|forecast|probabilit|bayes|distribution|metric|kpi|cohort|segment|model|trend|significan|sample|variance|benford)\w*/i,
};

/**
 * Openers that are unambiguously conversational, not a task.
 *
 * The old regex only matched a message that WAS a single opener token, so
 * "hey, asherin. you there bud" fell through to the generic word-count rule
 * and the model was handed a ping while wearing the analyst prompt. A ping is
 * an opener plus, optionally: the product name, a presence check, and a term
 * of address. Nothing in this pattern can absorb a task, because a task needs
 * a verb or an object and every alternative below is a closed vocabulary.
 */
const ADDRESS = "(asherin|asher|bud|buddy|bro|man|dude|mate|friend|there)";
const PRESENCE = "((are\\s+|r\\s+)?(you|u|ya)\\s*(there|around|up|awake|alive|online|here|listening)|still\\s+(there|around|here))";
const OPENER =
  "(hi|hey+|hello+|yo+|sup|wsup|whats\\s*up|what's\\s*up|howdy|good\\s+(morning|afternoon|evening|night)|" +
  "thanks?|thank\\s+you|ty|ok(ay)?|cool|nice|got\\s+it|great|lol|haha+|yes|no|yeah|yep|nope|sure|please|" +
  "continue|go\\s+on|more|again|morning|evening)";
// One to four conversational atoms separated by nothing more than punctuation.
// A greeting is an opener OR a bare presence check; either may carry addresses.
const GREETING = new RegExp(
  `^[\\s]*(${OPENER}|${PRESENCE})` +
  `([\\s!.?,'-]+(${OPENER}|${PRESENCE}|${ADDRESS})){0,4}` +
  `[\\s!.?,'-]*$`,
  "i",
);


export function classifyTurnRelevance(sig: RelevanceSignals): TurnRelevance {
  const text = String(sig.text ?? "").slice(0, 4000);
  // The tail is included so a two-word follow-up inherits the topic of the
  // turn it is following up on — gating on the last message alone is how a
  // conversation loses its specialist halfway through.
  const probe = `${text}\n${String(sig.recent ?? "").slice(-2500)}`;

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const trivial =
    !sig.hasEvidence &&
    !sig.hasImageAttachment &&
    !sig.hasChartAttachment &&
    !sig.isIntelTurn &&
    (GREETING.test(text.trim()) || (words <= 6 && !/[?]/.test(text) && !has(RE.coding, text)));

  // A deep turn relaxes gating: at this length the model's own generation and
  // any retrieval dominate the clock, so prefill thrift buys nothing and a
  // missing brain costs real answer quality.
  const deep =
    !trivial &&
    (words >= 60 ||
      sig.mode === "research" ||
      sig.responseDepth === "deep" ||
      sig.responseDepth === "exhaustive" ||
      (text.match(/[?]/g)?.length ?? 0) >= 3);

  const on = (re: RegExp) => has(re, probe);

  const r: TurnRelevance = {
    trivial,
    deep,
    coding: !trivial && (Boolean(sig.hasCodeAttachment) || on(RE.coding) || deep),
    intel: !trivial && (Boolean(sig.isIntelTurn) || on(RE.intel) || deep),
    strategic: !trivial && (on(RE.strategic) || deep),
    // Astrology and gematria are opt-in domains: they are never implied by a
    // long message, only by their own vocabulary. Attaching them to every deep
    // turn is exactly the noise this router exists to remove.
    vedic: !trivial && on(RE.vedic),
    gematria: !trivial && on(RE.gematria),
    market: !trivial && (Boolean(sig.hasChartAttachment) || on(RE.market)),
    visual: !trivial && (Boolean(sig.hasImageAttachment) || Boolean(sig.hasChartAttachment) || on(RE.visual)),
    social: !trivial && on(RE.social),
    geo: !trivial && on(RE.geo),
    psychology: !trivial && (on(RE.psychology) || deep),
    linguistics: !trivial && (on(RE.linguistics) || on(RE.psychology)),
    creative: !trivial && (on(RE.creative) || deep),
    humor: !trivial && on(RE.humor),
    analytics: !trivial && (on(RE.analytics) || deep),
    attached: [],
  };

  r.attached = (Object.keys(r) as (keyof TurnRelevance)[])
    .filter((k) => k !== "attached" && k !== "trivial" && k !== "deep" && r[k] === true)
    .map(String);

  return r;
}
