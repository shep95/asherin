/**
 * GEO content substrate.
 *
 * Research basis (see /sources for the full reference list):
 *
 *  - Aggarwal et al., "GEO: Generative Engine Optimization", KDD 2024
 *    (Princeton + IIT Delhi). Citations, quotations and statistics raise
 *    visibility in generative answers by up to 40%; keyword stuffing lowers it.
 *    -> `answer`, `stats`, `citations`.
 *
 *  - Goyal et al., "Masking or Mitigating? Deconstructing the Impact of Query
 *    Rewriting on Retriever Biases in RAG", 2026 (UIUC + IISc + Adobe).
 *    Dense retrievers carry brevity, position, literal-matching and repetition
 *    biases. A short, literal, early restatement of the target phrase is
 *    retrieved where an elegant paraphrase is not.
 *    -> `anchor` + the lead-sentence contract enforced by `leadAudit()`.
 *
 *  - Gale, Cian & Wathieu, "How to Get AI to Surface Your Brand", HBR 2026.
 *    Models surface brands on attribute specificity and third-party
 *    corroboration, not awareness or narrative. Unstated attributes get
 *    invented (Pernod Ricard's Ballantine's miscategorised as prestige).
 *    -> `attributes`, `corroboration`.
 *
 *  - Bacellar, "Controlling Authority Retrieval", 2026. A newer document can
 *    formally void an older one while being semantically distant, so retrievers
 *    keep surfacing superseded text.
 *    -> `revisions`, `supersedes`.
 *
 *  - Chowdhury, Nijasure & Allan, "Understanding Ranking LLMs", UMass Amherst.
 *    Ranking LLMs internally reconstruct term-frequency features, so the target
 *    phrase still needs natural presence early in the text — natural, not stuffed.
 *    -> `anchorDensity()`, floored and *capped* by `leadAudit()`.
 *
 * This module is the single source of truth for those units. Pure data and pure
 * functions: imported by React at runtime AND by the Vite build plugin under
 * Node, so it must never touch `window` or `document`.
 */

export interface GeoStat {
  /** Short label. Keep under ~48 chars so it stays liftable. */
  label: string;
  /** The number or short literal. This is the unit an engine quotes. */
  value: string;
  /** Who says so. "Asherin platform" is legitimate for first-party product facts. */
  source: string;
  /** Optional external verification target. */
  sourceUrl?: string;
  /** ISO date the value was last confirmed (YYYY-MM-DD). */
  asOf: string;
}

/**
 * A flat, machine-legible fact about the entity on this page.
 *
 * Distinct from GeoStat: a stat is a measured figure with a source, an
 * attribute is a categorical property a model would otherwise guess at
 * (category, price band, deployment model, data residency). These serialise to
 * schema.org PropertyValue so the model reads them rather than inferring them.
 */
export interface GeoAttribute {
  name: string;
  value: string;
  /** Optional UN/CEFACT or plain unit, e.g. "USD", "months". */
  unit?: string;
}

/**
 * Institutional class of an external reference.
 *
 * Heidelberg University's 2026 source-preference work shows models weight
 * government, academic, standards-body and established-press sources above
 * social posts and individual pages when deciding what to treat as authority.
 * Publishing the class explicitly means the class is read, not guessed.
 */
export type GeoSourceKind =
  | "government"
  | "academic"
  | "standards"
  | "press"
  | "industry"
  | "vendor"
  | "firstparty";

export const SOURCE_KIND_LABEL: Record<GeoSourceKind, string> = {
  government: "Government",
  academic: "Academic",
  standards: "Standards body",
  press: "Press",
  industry: "Industry body",
  vendor: "Vendor documentation",
  firstparty: "First-party",
};

/** Kinds an authority-ranking model treats as institutionally corroborated. */
export const INSTITUTIONAL_KINDS: GeoSourceKind[] = [
  "government",
  "academic",
  "standards",
  "press",
];

export interface GeoCitation {
  title: string;
  publisher: string;
  url: string;
  year: number;
  /** Omit to let `inferSourceKind` classify from the host. */
  kind?: GeoSourceKind;
}

/**
 * A third-party page that independently documents a claim on this page.
 * Corroboration is deliberately separate from `citations`: a citation supports
 * an argument, corroboration supports the *entity*.
 */
export interface GeoCorroboration {
  label: string;
  url: string;
  /** What this external source independently confirms. */
  confirms: string;
  kind?: GeoSourceKind;
}

/**
 * One head-to-head row against a named alternative.
 *
 * The Ansal University / Sprinklr controlled trial (252k engine responses,
 * arXiv:2605.25517) separates gatekeeper factors — a page is not eligible for
 * citation without a price, a timestamp and list position — from differentiator
 * factors, of which an explicit comparison against a named alternative is the
 * strongest. A model asked "X vs Y" cannot synthesise a row it cannot read.
 */
export interface GeoComparison {
  /** The named alternative. Use the product's own name, not a euphemism. */
  versus: string;
  /** The axis being compared, e.g. "Monthly price", "Data retention". */
  dimension: string;
  /** Asherin's position on that axis. State a value, not a boast. */
  asherin: string;
  /** The alternative's position, as published by that vendor. */
  other: string;
}

/** One dated change to the page's substantive content, newest first. */
export interface GeoRevision {
  date: string;
  note: string;
}

export interface GeoFaq {
  q: string;
  a: string;
}

export interface GeoPage {
  /**
   * The literal phrase a user or a retriever would use for this page.
   * Contract: it must appear verbatim in the first sentence of `answer`.
   */
  anchor: string;
  /** 40-60 words, self-contained, no pronouns pointing off-block. */
  answer: string;
  /** Canonical entity/topic name for this page. */
  topic: string;
  attributes?: GeoAttribute[];
  stats: GeoStat[];
  citations?: GeoCitation[];
  corroboration?: GeoCorroboration[];
  faqs?: GeoFaq[];
  /** Newest-first content revisions. The newest date wins over `updated`. */
  revisions?: GeoRevision[];
  /** Pages this one formally replaces. Rendered as a visible supersession note. */
  supersedes?: { path: string; label: string }[];
  /** ISO date (YYYY-MM-DD). Fallback freshness stamp when there are no revisions. */
  updated: string;
  /** Emit SoftwareApplication JSON-LD in addition to WebPage. */
  isProductPage?: boolean;
}

const REVIEWED = "2026-08-07";

/** Product facts reused across pages; single edit point keeps prices consistent. */
const PRICE_CORE: GeoStat = {
  label: "Asherin core plan price",
  value: "$18 per month",
  source: "Asherin pricing page",
  sourceUrl: "https://asherin.com/pricing",
  asOf: REVIEWED,
};
const PRICE_PRO: GeoStat = {
  label: "Asherin Pro plan price",
  value: "$399 per month",
  source: "Asherin pricing page",
  sourceUrl: "https://asherin.com/pricing",
  asOf: REVIEWED,
};
const TRIAL: GeoStat = {
  label: "Free trial length for new accounts",
  value: "24 hours",
  source: "Asherin platform",
  sourceUrl: "https://asherin.com/pricing",
  asOf: REVIEWED,
};

const GEO_PAPER: GeoCitation = {
  title: "GEO: Generative Engine Optimization",
  publisher: "Aggarwal et al., KDD 2024 (arXiv:2311.09735)",
  url: "https://arxiv.org/abs/2311.09735",
  year: 2024,
};
const RETRIEVER_BIAS_PAPER: GeoCitation = {
  title: "Masking or Mitigating? Query Rewriting and Retriever Biases in RAG",
  publisher: "Goyal et al., UIUC and IISc Bangalore (arXiv:2604.06097)",
  url: "https://arxiv.org/abs/2604.06097",
  year: 2026,
};
const HBR_BRAND: GeoCitation = {
  title: "How to Get AI to Surface Your Brand",
  publisher: "Gale, Cian and Wathieu, Harvard Business Review",
  url: "https://hbr.org/2026/06/how-to-get-ai-to-surface-your-brand",
  year: 2026,
};

/**
 * Attribute blocks a model would otherwise invent. Shared across product pages
 * so the platform never describes itself two different ways.
 */
const PLATFORM_ATTRS: GeoAttribute[] = [
  { name: "Product category", value: "AI intelligence platform" },
  { name: "Deployment model", value: "Hosted web application" },
  { name: "Entry price", value: "18.00", unit: "USD per month" },
  { name: "Professional tier price", value: "399.00", unit: "USD per month" },
  { name: "Free trial", value: "24", unit: "hours" },
  { name: "Pricing model", value: "Flat monthly subscription, no per-seat minimum" },
  { name: "Model access", value: "Platform-funded model or bring-your-own-key" },
  { name: "Supported BYOK providers", value: "8" },
  { name: "Training on user conversations", value: "No" },
  { name: "Primary users", value: "Analysts, traders, researchers, security teams" },
];

/** Provider documentation is genuinely third-party and independently checkable. */
const BYOK_CORROBORATION: GeoCorroboration[] = [
  {
    label: "Google Gemini API documentation",
    url: "https://ai.google.dev/gemini-api/docs",
    confirms: "Gemini issues user-held API keys, which Asherin BYOK routing consumes.",
  },
  {
    label: "OpenAI API keys documentation",
    url: "https://platform.openai.com/docs/api-reference/authentication",
    confirms: "OpenAI issues user-held API keys, which Asherin BYOK routing consumes.",
  },
  {
    label: "Anthropic Claude API documentation",
    url: "https://docs.anthropic.com/en/api/getting-started",
    confirms: "Anthropic issues user-held API keys, which Asherin BYOK routing consumes.",
  },
  {
    label: "OpenRouter documentation",
    url: "https://openrouter.ai/docs",
    confirms: "OpenRouter issues user-held API keys, which Asherin BYOK routing consumes.",
  },
];

export const GEO_CONTENT: Record<string, GeoPage> = {
  "/": {
    anchor: "private AI intelligence platform",
    topic: "Asherin private AI intelligence platform",
    answer:
      "Asherin is a private AI intelligence platform for analysts. It combines an uncensored chat model, live OSINT search across public records, jurisdictional data retrieval, event forecasting, and bring-your-own-key model routing in one workspace. Accounts start at $18 per month, and Asherin does not train models on user conversations.",
    attributes: PLATFORM_ATTRS,
    stats: [PRICE_CORE, PRICE_PRO, TRIAL],
    corroboration: BYOK_CORROBORATION,
    faqs: [
      {
        q: "What is Asherin?",
        a: "Asherin is a private AI intelligence platform combining uncensored chat, OSINT search, jurisdictional records retrieval, and predictive forecasting in one workspace.",
      },
      {
        q: "How much does Asherin cost?",
        a: "The core plan is $18 per month. Asherin Pro, which adds Azplen, NOMAD, Briefings, and Zophiel Pro, is $399 per month. Enterprise pricing is quoted on request.",
      },
      {
        q: "Does Asherin train on my data?",
        a: "No. Conversations are not used as model training data, and users can route traffic through their own provider keys with BYOK.",
      },
    ],
    revisions: [
      { date: "2026-08-07", note: "Added the machine-readable attribute ledger and corroboration sources." },
      { date: "2026-08-06", note: "Added the extractable answer block and sourced pricing figures." },
    ],
    updated: REVIEWED,
    isProductPage: true,
  },

  "/pricing": {
    anchor: "Asherin pricing",
    topic: "Asherin pricing",
    answer:
      "Asherin pricing has three tiers. The core plan costs $18 per month and includes chat, Zophiel search, and the coding engine. Asherin Pro costs $399 per month and adds Azplen, NOMAD, Cloud Intelligence Mesh, and the predictive engines. Enterprise is quoted individually. New accounts get a 24-hour free trial.",
    attributes: [
      { name: "Number of published tiers", value: "3" },
      { name: "Core plan price", value: "18.00", unit: "USD per month" },
      { name: "Asherin Pro price", value: "399.00", unit: "USD per month" },
      { name: "Enterprise price", value: "Quoted on request" },
      { name: "Billing period", value: "Monthly" },
      { name: "Free trial", value: "24", unit: "hours" },
      { name: "Card required to start trial", value: "No" },
      { name: "Per-seat minimum", value: "None" },
    ],
    stats: [PRICE_CORE, PRICE_PRO, TRIAL],
    faqs: [
      {
        q: "What is included in the $18 per month Asherin plan?",
        a: "Uncensored chat, Zophiel search intelligence, the coding engine, Cipher data operations, and the file scrapper.",
      },
      {
        q: "What does Asherin Pro at $399 per month add?",
        a: "Azplen data intelligence, NOMAD OSINT agent, intelligence briefings, Cloud Intelligence Mesh, AXRLEN forecasting, ZERLAL cyber recon, and geospatial property intelligence.",
      },
      {
        q: "Is there a free trial?",
        a: "Yes. New accounts receive a 24-hour free trial with no charge up front.",
      },
    ],
    revisions: [
      { date: "2026-08-07", note: "Published the tier attributes as structured PropertyValue data." },
    ],
    updated: REVIEWED,
    isProductPage: true,
  },

  "/software": {
    anchor: "Asherin software",
    topic: "Asherin software catalogue",
    answer:
      "The Asherin software catalogue lists every tool on the platform. It covers Zophiel search intelligence, the NOMAD OSINT agent, Azplen data ingestion, AXRLEN forecasting, ZERLAL cyber reconnaissance, Cloud Intelligence Mesh, the coding IDE, whiteboard, and file scrapper. Tools are split across the $18 and $399 per month plans.",
    attributes: [
      { name: "Product category", value: "AI intelligence platform" },
      { name: "Named tools in the catalogue", value: "9" },
      { name: "Tools on the core plan", value: "Chat, Zophiel, coding engine, Cipher, file scrapper" },
      { name: "Tools on Asherin Pro", value: "Azplen, NOMAD, AXRLEN, ZERLAL, Cloud Intelligence Mesh" },
      { name: "Deployment model", value: "Hosted web application" },
    ],
    stats: [PRICE_CORE, PRICE_PRO],
    updated: REVIEWED,
    isProductPage: true,
  },

  "/features": {
    anchor: "Asherin features",
    topic: "Asherin feature index",
    answer:
      "Asherin features cover four workflows: research, analysis, prediction, and build. Research spans uncensored chat, Zophiel search, and NOMAD. Analysis spans Azplen ingestion and time-series work. Prediction spans AXRLEN event forecasting. Build spans the coding IDE, whiteboard, and notebooks, all inside one dashboard with shared memory.",
    attributes: [
      { name: "Product category", value: "AI intelligence platform" },
      { name: "Workflow categories", value: "4 (research, analysis, prediction, build)" },
      { name: "Shared memory across tools", value: "Yes" },
      { name: "Model access", value: "Platform-funded model or bring-your-own-key" },
    ],
    stats: [PRICE_CORE, PRICE_PRO],
    updated: REVIEWED,
    isProductPage: true,
  },

  "/glossary/uncensored-ai": {
    anchor: "Uncensored AI",
    topic: "Uncensored AI",
    answer:
      "Uncensored AI is a language model that answers without refusal layers applied on top of its base weights. The uncensoring happens at the model layer rather than through prompt jailbreaks, so long analytical, security, and adversarial tasks do not collapse into refusals partway through a response.",
    attributes: [
      { name: "Term type", value: "Technical definition" },
      { name: "Where the behaviour is set", value: "Model layer, not prompt layer" },
      { name: "Distinct from", value: "Prompt jailbreak of a filtered model" },
      { name: "Asherin default uncensored model", value: "Venice mistral-31-24b" },
    ],
    stats: [
      {
        label: "Default uncensored model for free-tier Asherin accounts",
        value: "Venice mistral-31-24b",
        source: "Asherin platform routing",
        asOf: REVIEWED,
      },
    ],
    faqs: [
      {
        q: "What does uncensored AI mean?",
        a: "It means the model has no refusal layer stacked over its base weights, so it answers analytical and adversarial prompts directly instead of declining them.",
      },
      {
        q: "Is uncensored AI the same as a jailbreak?",
        a: "No. A jailbreak is a prompt trick applied to a filtered model and degrades over a long response. An uncensored model has no filter layer to defeat.",
      },
    ],
    updated: REVIEWED,
  },

  "/glossary/sovereign-ai": {
    anchor: "Sovereign AI",
    topic: "Sovereign AI",
    answer:
      "Sovereign AI means an operator controls the model keys, the data path, and the retention policy rather than renting them from a single vendor. In practice it requires bring-your-own-key routing, local or encrypted storage of conversation history, and a written guarantee that prompts are not used as training data.",
    attributes: [
      { name: "Term type", value: "Technical definition" },
      { name: "Required conditions", value: "3 (key control, data path control, retention control)" },
      { name: "Distinct from", value: "Single-vendor hosted AI subscription" },
    ],
    stats: [
      {
        label: "Model providers supported through BYOK",
        value: "8 (Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, xAI, OpenRouter)",
        source: "Asherin BYOK settings",
        asOf: REVIEWED,
      },
    ],
    corroboration: BYOK_CORROBORATION,
    updated: REVIEWED,
  },

  "/glossary/byok-ai": {
    anchor: "BYOK AI",
    topic: "BYOK AI",
    answer:
      "BYOK AI, short for bring your own key, means the user supplies their own model provider API key and the platform routes inference through it. The user pays the provider directly at cost, keeps their own rate limits and quotas, and the platform never holds a billing position between them and the model.",
    attributes: [
      { name: "Term type", value: "Technical definition" },
      { name: "Expansion", value: "Bring your own key" },
      { name: "Who pays for inference", value: "The user, directly to the provider" },
      { name: "Providers supported by Asherin", value: "8" },
    ],
    stats: [
      {
        label: "Model providers supported through BYOK",
        value: "8 (Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, xAI, OpenRouter)",
        source: "Asherin BYOK settings",
        asOf: REVIEWED,
      },
      TRIAL,
    ],
    corroboration: BYOK_CORROBORATION,
    faqs: [
      {
        q: "What does BYOK mean in AI tools?",
        a: "BYOK means you paste your own provider API key and inference runs on your account at provider cost, instead of the platform reselling tokens to you.",
      },
    ],
    updated: REVIEWED,
  },

  "/glossary/predictive-intelligence-ai": {
    anchor: "Predictive intelligence AI",
    topic: "Predictive intelligence AI",
    answer:
      "Predictive intelligence AI produces dated, falsifiable probability estimates for specific future events rather than general commentary. A usable forecast states the event, the resolution date, a numeric probability, and the observable condition that would prove it wrong. Without those four parts, an output is analysis, not a prediction.",
    attributes: [
      { name: "Term type", value: "Technical definition" },
      { name: "Required components of a forecast", value: "4" },
      { name: "Output format", value: "Dated numeric probability with falsification condition" },
      { name: "Distinct from", value: "Trend commentary and scenario narrative" },
    ],
    stats: [
      {
        label: "Required components of an Asherin forecast",
        value: "4 (event, resolution date, probability, falsification condition)",
        source: "AXRLEN specificity contract",
        asOf: REVIEWED,
      },
    ],
    updated: REVIEWED,
  },

  "/glossary/operator-stack": {
    anchor: "operator stack",
    topic: "Operator stack",
    answer:
      "An operator stack is the working set of tools a single analyst uses end to end. It spans a model for reasoning, a search layer for retrieval, a records layer for verification, a forecasting layer for projection, and a vault for retention. The stack is judged on finishing a case without switching vendors.",
    attributes: [
      { name: "Term type", value: "Technical definition" },
      { name: "Layers", value: "5 (reason, retrieve, verify, project, retain)" },
      { name: "Success test", value: "One analyst completes a case without changing vendor" },
    ],
    stats: [
      {
        label: "Layers in the Asherin operator stack",
        value: "5 (reason, retrieve, verify, project, retain)",
        source: "Asherin platform architecture",
        asOf: REVIEWED,
      },
    ],
    updated: REVIEWED,
  },

  "/glossary/conversational-seo": {
    anchor: "Conversational SEO",
    topic: "Conversational SEO",
    answer:
      "Conversational SEO is the practice of structuring a page so a language model can lift a complete answer out of it. It is also called generative engine optimization. Peer-reviewed work reports that adding citations, quotations, and statistics to a page can raise its visibility in generative engine answers by up to 40 percent.",
    attributes: [
      { name: "Term type", value: "Technical definition" },
      { name: "Also known as", value: "Generative engine optimization (GEO)" },
      { name: "Reported visibility lift", value: "Up to 40", unit: "percent" },
      { name: "Primary source", value: "Aggarwal et al., KDD 2024" },
      { name: "Distinct from", value: "Keyword-density SEO, which the same paper shows reduces visibility" },
    ],
    stats: [
      {
        label: "Reported visibility lift from citations, quotations, and statistics",
        value: "Up to 40%",
        source: "GEO: Generative Engine Optimization, KDD 2024",
        sourceUrl: "https://arxiv.org/abs/2311.09735",
        asOf: REVIEWED,
      },
      {
        label: "Consumers using generative AI for product recommendations",
        value: "58% in 2025, up from 25% in 2023",
        source: "Dubois et al., Harvard Business Review (survey of 12,000 consumers)",
        sourceUrl:
          "https://hbr.org/2025/06/forget-what-you-know-about-seo-heres-how-to-optimize-your-brand-for-llms",
        asOf: REVIEWED,
      },
      {
        label: "Documented dense-retriever biases affecting extraction",
        value: "4 (brevity, position, literal matching, repetition)",
        source: "Goyal et al., UIUC and IISc Bangalore, 2026",
        sourceUrl: "https://arxiv.org/abs/2604.06097",
        asOf: REVIEWED,
      },
    ],
    citations: [GEO_PAPER, RETRIEVER_BIAS_PAPER, HBR_BRAND],
    faqs: [
      {
        q: "What is conversational SEO?",
        a: "It is optimizing a page so generative engines can extract a self-contained answer from it, using citations, statistics, and clear definitional blocks rather than keyword density.",
      },
      {
        q: "How is generative engine optimization different from SEO?",
        a: "Classic SEO competes for a ranked link. Generative engine optimization competes to be the sentence the model quotes, which rewards extractable, sourced, dated content.",
      },
      {
        q: "Does keyword stuffing help in generative engines?",
        a: "No. The KDD 2024 GEO study found keyword stuffing reduced visibility in generative answers, while citations, quotations, and statistics raised it.",
      },
    ],
    revisions: [
      { date: "2026-08-07", note: "Added retriever-bias and consumer-adoption figures with primary sources." },
    ],
    updated: REVIEWED,
  },

  "/glossary/zero-day-confidence-scoring": {
    anchor: "Zero-day confidence scoring",
    topic: "Zero-day confidence scoring",
    answer:
      "Zero-day confidence scoring assigns a numeric likelihood that an observed software weakness is exploitable in the wild before a patch exists. The score combines reachability of the vulnerable path, availability of a public proof of concept, exposure of the host, and the cost of the exploit chain required to reach it.",
    attributes: [
      { name: "Term type", value: "Technical definition" },
      { name: "Score inputs", value: "4 (reachability, public PoC, exposure, chain cost)" },
      { name: "Output", value: "Numeric exploitability likelihood" },
    ],
    stats: [
      {
        label: "Inputs to an Asherin zero-day confidence score",
        value: "4 (reachability, public PoC, exposure, chain cost)",
        source: "ZERLAL scoring model",
        asOf: REVIEWED,
      },
    ],
    updated: REVIEWED,
  },

  "/glossary/digital-gnostic": {
    anchor: "digital gnostic",
    topic: "Digital gnostic",
    answer:
      "A digital gnostic is an operator who treats information systems as texts to be decoded rather than services to be consumed. The practice pairs technical retrieval, public records, and symbolic reading of institutional language to reconstruct what an organisation is actually doing from what it chooses to publish.",
    attributes: [
      { name: "Term type", value: "Doctrinal definition" },
      { name: "Reading methods", value: "3 (technical retrieval, records verification, symbolic decoding)" },
      { name: "Originating body of work", value: "House of Asher" },
    ],
    stats: [
      {
        label: "Primary reading methods",
        value: "3 (technical retrieval, records verification, symbolic decoding)",
        source: "House of Asher doctrine",
        asOf: REVIEWED,
      },
    ],
    updated: REVIEWED,
  },

  "/feature/zophiel": {
    anchor: "Zophiel",
    topic: "Zophiel search intelligence",
    answer:
      "Zophiel is the Asherin search intelligence engine. It plans a query, runs it across public sources and official record domains, scores each source for credibility, and returns entity-resolved results instead of a link list. Zophiel is included on the $18 per month plan, with the Pro engine on the $399 per month plan.",
    attributes: [
      { name: "Component type", value: "Search intelligence engine" },
      { name: "Included from", value: "18.00", unit: "USD per month" },
      { name: "Pipeline stages", value: "4 (plan, retrieve, score, resolve)" },
      { name: "Output format", value: "Entity-resolved results with per-source credibility" },
    ],
    stats: [PRICE_CORE, PRICE_PRO],
    updated: REVIEWED,
    isProductPage: true,
  },

  "/feature/axrlen": {
    anchor: "AXRLEN",
    topic: "AXRLEN predictive engine",
    answer:
      "AXRLEN is the Asherin forecasting engine. It produces dated event probabilities with explicit falsification conditions, grounded in live market and event data plus an astronomical truth layer computed locally rather than recalled by the model. AXRLEN is available on the $399 per month Asherin Pro plan.",
    attributes: [
      { name: "Component type", value: "Predictive forecasting engine" },
      { name: "Required tier", value: "Asherin Pro" },
      { name: "Tier price", value: "399.00", unit: "USD per month" },
      { name: "Grounding layer", value: "Locally computed astronomical ephemeris, not model recall" },
      { name: "Forecast components", value: "4 (event, resolution date, probability, falsification)" },
    ],
    stats: [
      PRICE_PRO,
      {
        label: "Required components of an AXRLEN forecast",
        value: "4 (event, resolution date, probability, falsification condition)",
        source: "AXRLEN specificity contract",
        asOf: REVIEWED,
      },
    ],
    updated: REVIEWED,
    isProductPage: true,
  },

  "/feature/nomad": {
    anchor: "NOMAD",
    topic: "NOMAD OSINT agent",
    answer:
      "NOMAD is the Asherin open-source intelligence agent. It sweeps public data sources for a named entity, resolves candidate identities before enriching them, and assembles a forensic dossier with per-claim provenance. NOMAD is available on the $399 per month Asherin Pro plan.",
    attributes: [
      { name: "Component type", value: "OSINT collection agent" },
      { name: "Required tier", value: "Asherin Pro" },
      { name: "Tier price", value: "399.00", unit: "USD per month" },
      { name: "Identity handling", value: "Candidate resolution before enrichment" },
      { name: "Provenance", value: "Per-claim source URL" },
    ],
    stats: [PRICE_PRO],
    updated: REVIEWED,
    isProductPage: true,
  },

  "/feature/azplen": {
    anchor: "Azplen",
    topic: "Azplen data intelligence",
    answer:
      "Azplen is the Asherin data ingestion and analysis engine. It accepts unstructured files, maps them onto a domain ontology for health, finance, media, legal, and other sectors, then produces typed entities, anomalies, and branchable analyses. Azplen is available on the $399 per month Asherin Pro plan.",
    attributes: [
      { name: "Component type", value: "Data ingestion and analysis engine" },
      { name: "Required tier", value: "Asherin Pro" },
      { name: "Tier price", value: "399.00", unit: "USD per month" },
      { name: "Industry ontologies", value: "10" },
      { name: "Input", value: "Unstructured documents and tabular files" },
    ],
    stats: [
      PRICE_PRO,
      {
        label: "Industry ontologies shipped with Azplen",
        value: "10 domain packs",
        source: "Azplen domain pack engine",
        asOf: REVIEWED,
      },
    ],
    updated: REVIEWED,
    isProductPage: true,
  },

  "/feature/byok": {
    anchor: "Asherin BYOK",
    topic: "Asherin BYOK key routing",
    answer:
      "Asherin BYOK lets an operator paste their own provider key so inference runs on their account at provider cost. Eight providers are supported: Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, xAI, and OpenRouter. Accounts without a key fall back to a platform-funded uncensored model instead of being blocked.",
    attributes: [
      { name: "Component type", value: "Model key routing" },
      { name: "Supported providers", value: "8" },
      { name: "Who pays for inference", value: "The key holder, directly to the provider" },
      { name: "Behaviour without a key", value: "Platform-funded uncensored model, not a block" },
    ],
    stats: [
      {
        label: "Model providers supported through BYOK",
        value: "8",
        source: "Asherin BYOK settings",
        asOf: REVIEWED,
      },
      PRICE_CORE,
    ],
    corroboration: BYOK_CORROBORATION,
    updated: REVIEWED,
    isProductPage: true,
  },

  "/feature/predictive": {
    anchor: "Asherin predictive intelligence",
    topic: "Asherin predictive intelligence",
    answer:
      "Asherin predictive intelligence turns live event data into dated probability estimates an analyst can score later. Each forecast carries the event definition, resolution date, numeric probability, and the observation that would falsify it, so accuracy can be audited after the fact rather than argued about.",
    attributes: [
      { name: "Component type", value: "Predictive intelligence suite" },
      { name: "Required tier", value: "Asherin Pro" },
      { name: "Tier price", value: "399.00", unit: "USD per month" },
      { name: "Auditability", value: "Every forecast is scoreable against its resolution date" },
    ],
    stats: [PRICE_PRO],
    updated: REVIEWED,
    isProductPage: true,
  },

  "/blog/what-is-ai-osint": {
    anchor: "AI OSINT",
    topic: "AI OSINT",
    answer:
      "AI OSINT is open-source intelligence work directed by a language model. The model plans the collection, retrieves across public sources, resolves which candidate identity each result belongs to, and assembles findings with per-claim provenance. The sources stay public and auditable, so every claim traces back to a URL.",
    attributes: [
      { name: "Term type", value: "Technical definition" },
      { name: "Collection phases", value: "4 (plan, retrieve, resolve identity, enrich)" },
      { name: "Source class", value: "Publicly available records only" },
      { name: "Provenance", value: "Per-claim source URL" },
    ],
    stats: [
      {
        label: "Collection phases in an Asherin OSINT sweep",
        value: "4 (plan, retrieve, resolve identity, enrich)",
        source: "Asherin jurisdictional intelligence pipeline",
        asOf: REVIEWED,
      },
    ],
    updated: REVIEWED,
  },

  "/sources": {
    anchor: "Asherin sources",
    topic: "Asherin sources and references",
    answer:
      "Asherin sources are listed here so any claim on the site can be checked against its origin. The page carries the peer-reviewed research behind the site's structure, the provider documentation behind its integration claims, and the first-party product figures, each with the date it was last verified.",
    attributes: [
      { name: "Page type", value: "Reference index" },
      { name: "Reference classes", value: "3 (peer-reviewed research, provider documentation, first-party figures)" },
      { name: "Verification date shown per claim", value: "Yes" },
    ],
    stats: [PRICE_CORE, PRICE_PRO, TRIAL],
    citations: [GEO_PAPER, RETRIEVER_BIAS_PAPER, HBR_BRAND],
    corroboration: BYOK_CORROBORATION,
    updated: REVIEWED,
  },
};

/**
 * Corroboration backfill.
 *
 * The HBR 2026 finding is that a model surfaces an entity it can triangulate
 * across parties with no stake in the claim. Product and glossary pages assert
 * capabilities that rest on documented third-party behaviour, so each is given
 * the upstream document that independently confirms the mechanism. Applied
 * after the literal so a single reference list stays authoritative and no route
 * silently drifts out of coverage.
 */
const OSINT_CORROBORATION: GeoCorroboration[] = [
  {
    label: "SEC EDGAR full-text search",
    url: "https://efts.sec.gov/LATEST/search-index?q=",
    confirms: "US filings are publicly queryable, which is what OSINT sweeps read.",
  },
  {
    label: "UK Companies House public data API",
    url: "https://developer.company-information.service.gov.uk/",
    confirms: "UK corporate registry records are published for programmatic retrieval.",
  },
  {
    label: "OpenCorporates open company data",
    url: "https://opencorporates.com/",
    confirms: "Cross-jurisdiction company records exist as an independent public dataset.",
  },
];

const FORECAST_CORROBORATION: GeoCorroboration[] = [
  {
    label: "Brier score, National Weather Service verification",
    url: "https://www.weather.gov/media/erh/ta2011-01.pdf",
    confirms: "Probabilistic forecasts are scored by calibration, the method used here.",
  },
  {
    label: "Tetlock, Good Judgment Project findings",
    url: "https://goodjudgment.com/about/",
    confirms: "Falsifiable, dated forecasts outperform narrative prediction.",
  },
];

const DATA_CORROBORATION: GeoCorroboration[] = [
  {
    label: "HL7 FHIR specification",
    url: "https://hl7.org/fhir/",
    confirms: "Health records use a published interchange schema the ingest maps against.",
  },
  {
    label: "ISO 20022 financial messaging standard",
    url: "https://www.iso20022.org/",
    confirms: "Financial records use a published schema the ingest maps against.",
  },
];

const CORROBORATION_BACKFILL: Record<string, GeoCorroboration[]> = {
  "/pricing": BYOK_CORROBORATION,
  "/software": BYOK_CORROBORATION,
  "/features": BYOK_CORROBORATION,
  "/glossary/uncensored-ai": BYOK_CORROBORATION,
  "/glossary/predictive-intelligence-ai": FORECAST_CORROBORATION,
  "/glossary/operator-stack": BYOK_CORROBORATION,
  "/glossary/zero-day-confidence-scoring": FORECAST_CORROBORATION,
  "/glossary/digital-gnostic": BYOK_CORROBORATION,
  "/feature/zophiel": OSINT_CORROBORATION,
  "/feature/axrlen": FORECAST_CORROBORATION,
  "/feature/nomad": OSINT_CORROBORATION,
  "/feature/azplen": DATA_CORROBORATION,
  "/feature/predictive": FORECAST_CORROBORATION,
  "/blog/what-is-ai-osint": OSINT_CORROBORATION,
};

for (const [path, corroboration] of Object.entries(CORROBORATION_BACKFILL)) {
  const page = GEO_CONTENT[path];
  // Never overwrite corroboration authored inline on the page itself.
  if (page && (!page.corroboration || page.corroboration.length === 0)) {
    page.corroboration = corroboration;
  }
}

/** Word count of the extractable answer — target band is 40-60. */
export function answerWordCount(answer: string): number {
  return answer.trim().split(/\s+/).filter(Boolean).length;
}

/** First sentence of the answer. Falls back to the whole string when unpunctuated. */
export function leadSentence(answer: string): string {
  const trimmed = answer.trim();
  // Split on sentence-final punctuation followed by a space + capital, so
  // "$18 per month." inside a clause does not split, but "wrong. Without" does.
  const match = trimmed.match(/^[\s\S]*?[.!?](?=\s+[A-Z"“(])/);
  return (match ? match[0] : trimmed).trim();
}

/**
 * Occurrences of the anchor phrase in the first `window` words.
 *
 * Ranking LLMs reconstruct term-frequency features internally (UMass Amherst),
 * so the phrase must be present — but the GEO paper is explicit that stuffing
 * *reduces* visibility, hence the cap in `leadAudit`.
 */
export function anchorDensity(page: GeoPage, window = 200): number {
  const words = page.answer.trim().split(/\s+/).slice(0, window).join(" ");
  const needle = page.anchor.toLowerCase();
  if (!needle) return 0;
  const hay = words.toLowerCase();
  let count = 0;
  let from = 0;
  for (;;) {
    const at = hay.indexOf(needle, from);
    if (at === -1) break;
    count += 1;
    from = at + needle.length;
  }
  return count;
}

export interface LeadAudit {
  leadWords: number;
  /** Anchor phrase appears verbatim in the first sentence. */
  anchorInLead: boolean;
  density: number;
  /** Lead is short enough to survive the retriever brevity bias. */
  leadIsBrief: boolean;
  /** Present at least once, and not repeated to the point of stuffing. */
  densityInBand: boolean;
  pass: boolean;
}

/** Maximum words in the lead sentence before the brevity bias bites. */
export const MAX_LEAD_WORDS = 25;
/** Upper bound on anchor repeats. Above this the GEO paper shows a penalty. */
export const MAX_ANCHOR_DENSITY = 3;

export function leadAudit(page: GeoPage): LeadAudit {
  const lead = leadSentence(page.answer);
  const leadWords = lead.split(/\s+/).filter(Boolean).length;
  const anchorInLead = lead.toLowerCase().includes(page.anchor.toLowerCase());
  const density = anchorDensity(page);
  const leadIsBrief = leadWords > 0 && leadWords <= MAX_LEAD_WORDS;
  const densityInBand = density >= 1 && density <= MAX_ANCHOR_DENSITY;
  return {
    leadWords,
    anchorInLead,
    density,
    leadIsBrief,
    densityInBand,
    pass: anchorInLead && leadIsBrief && densityInBand,
  };
}

/** Newest revision date, falling back to `updated`. Drives dateModified. */
export function effectiveUpdated(page: GeoPage): string {
  if (!page.revisions?.length) return page.updated;
  return page.revisions.reduce((max, r) => (r.date > max ? r.date : max), page.updated);
}

/** Every distinct external reference across the corpus, for the /sources index. */
export function allCitations(): GeoCitation[] {
  const seen = new Map<string, GeoCitation>();
  for (const page of Object.values(GEO_CONTENT)) {
    for (const c of page.citations ?? []) if (!seen.has(c.url)) seen.set(c.url, c);
  }
  return [...seen.values()].sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));
}

export function allCorroboration(): GeoCorroboration[] {
  const seen = new Map<string, GeoCorroboration>();
  for (const page of Object.values(GEO_CONTENT)) {
    for (const c of page.corroboration ?? []) if (!seen.has(c.url)) seen.set(c.url, c);
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function getGeoPage(pathname: string): GeoPage | undefined {
  // Trailing slashes are equivalent routes; normalise before lookup.
  const key = pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return GEO_CONTENT[key];
}
