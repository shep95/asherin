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

/**
 * What KIND of message this is. The turn's kind — not its word count — decides
 * whether the analyst blocks may attach, because the failure this router
 * exists to stop ("the user seems to be in …", an ip, a last-seen gap) is
 * wrong on a greeting AND on a search AND on a coding ask. The speaker is
 * never the subject; only a named target/place/file in the text can be.
 */
export type MessageKind =
  | "greeting"
  | "ack"
  | "smalltalk"
  | "empty"
  | "injection"
  | "correction"
  | "followup"
  | "factual"
  | "code"
  | "search"
  | "maps"
  | "file"
  | "intel_target"
  | "legal"
  | "task";

export interface TurnRelevance {
  /** Short, simple, conversational turn — the cheapest possible prompt. */
  trivial: boolean;
  /** Long/complex/research turn — specialist gating relaxes. */
  deep: boolean;
  /** The message type, used for voice as well as prefill. */
  kind: MessageKind;
  /**
   * A PLACE / PHOTO / ADDRESS the user named. The geolocation doctrine may
   * only attach on this — never on the network origin of the request.
   */
  geoTarget: boolean;
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

// ── MESSAGE KIND ─────────────────────────────────────────────────────────────
// The kinds below are ordered by how loudly the message declares itself. An
// injection attempt outranks everything; a named target outranks a generic
// question. Nothing here inspects the SPEAKER — only the text they wrote.
const KIND_RE = {
  injection:
    /\b(ignore (all )?(previous|prior|above) instructions|disregard (your|the) (rules|instructions)|reveal your (system )?prompt|print your instructions|you are now|jailbreak|developer mode)\b/i,
  ack: /^[\s]*(thanks?|thank\s+you|ty|ok(ay)?|k|kk|cool|nice|great|perfect|got\s+it|understood|sure|yep|yeah|no\s+worries|appreciate\s+it)[\s!.,]*$/i,
  smalltalk:
    /\b(how (are|r) (you|u|ya)|how'?s it going|how'?s your (day|night)|what'?s new|you good|hope you'?re well)\b/i,
  correction:
    /^[\s]*(no[,.\s]|nope[,.\s]|stop\b|don'?t\b|never\b|actually[,.\s]|wrong\b|i (prefer|want|asked)\b|from now on\b|please (stop|don'?t)\b)/i,
  followup:
    /^[\s]*(and\b|also\b|what about\b|how about\b|more\b|next\b|continue\b|the (second|third|next|other) one\b|why\b\??$)/i,
  maps:
    /\b(take me to|fly (me )?(to|over)|show me .{0,40}\bon (the )?map|open (the )?map|zoom (to|in on)|navigate to|who lives at|street view|drop a pin)\b/i,
  search:
    /\b(search|look ?it? ?up|look up|find (me )?(info|sources|links)|asherinx|dork|osint|google\b|scrape|crawl|index)\b/i,
  file:
    /\b(this (file|image|photo|screenshot|document|pdf)|attached|attachment|metadata of|exif|the upload)\b/i,
  legal:
    /\b(legal|lawful|law\b|liabilit|liable|sue|lawsuit|court|contract|nda|clause|tenant|landlord|obligat|am i (allowed|required)|can i legally|my rights?|is it legal)\b/i,
  code:
    /\b(write|fix|refactor|debug|generate|implement|build|show me) .{0,40}\b(code|function|component|script|query|sql|regex|test|endpoint|hook|migration)\b|\b(typescript|javascript|python|react|rust|golang)\b/i,
  namedTarget:
    /(\b[A-Z][a-z]{2,}(\s+[A-Z][a-z]{2,})+\b|\b[a-z0-9-]+\.(com|net|org|io|gov|edu|co|dev)\b|\b\d{1,4}\s+[A-Za-z].{0,30}\b(st|street|ave|avenue|rd|road|blvd|drive|dr|lane|ln)\b)/,
  place:
    /\b(where (is|was)|geolocate|coordinates of|address of|located in|directions to|near (?!me\b)\w+)\b/i,
  question: /[?]|^\s*(what|who|when|where|why|how|which|is|are|does|do|can|should)\b/i,
};

const EMOJI_ONLY = /^[\s\p{Extended_Pictographic}\p{Emoji_Component}\p{P}]*$/u;

export function classifyMessageKind(sig: RelevanceSignals): MessageKind {
  const text = String(sig.text ?? "").trim().slice(0, 4000);
  const words = text.split(/\s+/).filter(Boolean).length;
  const hasAttachment =
    Boolean(sig.hasImageAttachment) || Boolean(sig.hasChartAttachment) || Boolean(sig.hasCodeAttachment);

  if (KIND_RE.injection.test(text)) return "injection";
  if (!text || (EMOJI_ONLY.test(text) && !hasAttachment)) return "empty";
  if (!hasAttachment && GREETING.test(text)) {
    // "thanks" and "ok" also match the opener vocabulary; separate the ack so
    // its reply is one line rather than a hello.
    return KIND_RE.ack.test(text) ? "ack" : "greeting";
  }
  if (!hasAttachment && KIND_RE.ack.test(text)) return "ack";
  if (!hasAttachment && KIND_RE.smalltalk.test(text) && words <= 12) return "smalltalk";
  if (hasAttachment || KIND_RE.file.test(text)) return "file";
  if (KIND_RE.maps.test(text)) return "maps";
  if (KIND_RE.search.test(text)) return "search";
  if (KIND_RE.correction.test(text) && words <= 30) return "correction";
  if (KIND_RE.legal.test(text)) return "legal";
  if (KIND_RE.code.test(text) || has(RE.coding, text)) return "code";
  if ((sig.isIntelTurn || has(RE.intel, text)) && KIND_RE.namedTarget.test(text)) return "intel_target";
  if (KIND_RE.followup.test(text) && words <= 8) return "followup";
  if (KIND_RE.question.test(text)) return "factual";
  return "task";
}

/**
 * Prompt blocks that can leak operator metadata or third-person analysis of
 * the speaker. Exported so the assembly in chat/index.ts and its unit tests
 * read from ONE decision, instead of the gate drifting away from the test.
 */
export function blocksForTurn(r: TurnRelevance): {
  operatorProfile: boolean;
  promptIntelligence: boolean;
  contextIntelligence: boolean;
  operatingNotes: boolean;
  quickIntelligence: boolean;
  adaptiveRouter: boolean;
  geolocation: boolean;
} {
  const conversational = r.trivial;
  return {
    operatorProfile: !conversational,
    promptIntelligence: !conversational,
    contextIntelligence: !conversational,
    operatingNotes: !conversational,
    quickIntelligence: !conversational,
    adaptiveRouter: !conversational,
    // The geolocation doctrine reads a PLACE or a PHOTO. It never reads the
    // network origin of the request, so an "intel" turn alone cannot summon it.
    geolocation: !conversational && r.geoTarget,
  };
}

export function classifyTurnRelevance(sig: RelevanceSignals): TurnRelevance {
  const text = String(sig.text ?? "").slice(0, 4000);
  // The tail is included so a two-word follow-up inherits the topic of the
  // turn it is following up on — gating on the last message alone is how a
  // conversation loses its specialist halfway through.
  const probe = `${text}\n${String(sig.recent ?? "").slice(-2500)}`;

  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const kind = classifyMessageKind(sig);
  // Conversational kinds carry no task, so nothing analytic may attach. Every
  // other kind keeps its specialists — the packet voice is killed by contract,
  // not by starving a real request of the brains it needs.
  const trivial =
    !sig.hasEvidence &&
    !sig.hasImageAttachment &&
    !sig.hasChartAttachment &&
    !sig.isIntelTurn &&
    (kind === "greeting" || kind === "ack" || kind === "smalltalk" || kind === "empty");


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

  // A named place, a "fly me to", a photo, or an explicit "where was this" is
  // the ONLY licence for the geolocation doctrine. The request's own network
  // origin is not a target and never enters this decision.
  const geoTarget =
    !trivial &&
    (kind === "maps" ||
      Boolean(sig.hasImageAttachment) ||
      KIND_RE.place.test(text) ||
      (on(RE.geo) && KIND_RE.namedTarget.test(text)));

  const r: TurnRelevance = {
    trivial,
    deep,
    kind,
    geoTarget,
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
    .filter((k) => k !== "attached" && k !== "trivial" && k !== "deep" && k !== "kind" && r[k] === true)
    .map(String);


  return r;
}
