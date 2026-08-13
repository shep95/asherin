// Shared per-route SEO source of truth.
// Consumed at runtime by src/components/RouteSeo.tsx and at build time by
// scripts/seoPrerenderPlugin.ts, which bakes these tags into static per-route
// HTML so non-JS crawlers (social previews, plain fetchers) see them too.

export const ORIGIN = "https://asherin.com";
export const DEFAULT_OG_IMAGE = "https://asherin.com/og-image.png";

export type SeoEntry = {
  title: string;
  description: string;
  ogType?: "website" | "article" | "product";
  /** ISO date (YYYY-MM-DD) — required for editorial routes so Article JSON-LD is valid. */
  datePublished?: string;
  dateModified?: string;
  noindex?: boolean;
};

export const ROUTE_SEO: Record<string, SeoEntry> = {
  "/": {
    title: "Asherin | Private AI Intelligence Platform for Analysts",
    description:
      "Private AI platform for analysts, traders and researchers. Uncensored chat, live OSINT search, jurisdictional records, event forecasting, BYOK keys, no training on your data.",
  },
  "/pricing": {
    title: "Pricing | Asherin, Pro & Enterprise Plans",
    description:
      "Asherin is $18/mo for the core platform and $399/mo for Asherin Pro (Azplen, Asherin Engine, Briefings, Zophiel Pro). Enterprise on request.",
  },
  "/terms": {
    title: "Terms of Service | Asherin",
    description: "Asherin's Terms of Service. Read the rules of engagement for using the platform.",
  },
  "/sources": {
    title: "Sources & References | Asherin",
    description:
      "Every research paper, third-party document and first-party figure Asherin cites, each with the date it was last verified.",
  },
  "/software": {
    title: "Software | Every Asherin Tool | Asherin",
    description:
      "Every Asherin tool, OSINT search, predictive engines, IDE, whiteboard, e-book, file scrapper, on the $18/mo and $399/mo plans.",
  },

  "/benchmark": {
    title: "Asherin Benchmark | Cheap Models, Groomed to Outperform",
    description:
      "Asherin vs Opus 4.8 vs GPT-5.5 on a thread-safe LRU cache: prompts, code, and scored results in the open.",
  },
  "/asher": {
    title: "Asher | Operator Workspace | Asherin",
    description:
      "Asher: the operator workspace inside Asherin. Encrypted channels, intelligence modules, and live collaboration.",
  },
  "/privacy": {
    title: "Privacy Policy | Asherin",
    description: "How Asherin handles your data: storage, encryption, retention, and your rights.",
  },
  "/founder": {
    title: "Founder | Asher Newton of Asherin",
    description:
      "Asher Newton, founder of Asherin, and his book The Book of Asher Aureon Elion, readable in full.",
  },

  "/prompt-engineering": {
    title: "Prompt Engineering Protocols | Zophiel Doctrine",
    description:
      "The Zophiel prompt-engineering protocols: 45 sections of elite techniques for turning LLMs into surgical intelligence operators.",
  },
  "/benchmarks": {
    title: "Benchmarks | Asherin Model & Engine Performance",
    description: "Live benchmarks across Asherin's intelligence engines, model consensus, and predictive performance.",
  },
  "/nda": {
    title: "NDA | Asherin Confidentiality Agreement",
    description: "Asherin's standard non-disclosure agreement for partners, testers, and contractors.",
  },
  "/llm-models": {
    title: "Supported LLM Models | BYOK Catalog | Asherin",
    description:
      "Every model Asherin supports via BYOK: Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, xAI, OpenRouter, and more.",
  },
  "/blog": {
    title: "Asherin Blog | Field Reports from the Operator Stack",
    description:
      "Long-form comparisons, benchmarks, and intelligence write-ups from the Asherin team. No fluff, no affiliate links.",
  },
  "/blog/comparison": {
    title: "Asherin vs ChatGPT vs Claude | Honest 2026 Comparison",
    description:
      "Side-by-side: price, censorship, BYOK, OSINT, IDE, simulation, and privacy across Asherin, ChatGPT Plus, and Claude Pro.",
    ogType: "article",
    datePublished: "2026-06-17",
  },
  "/blog/venice-integration": {
    title: "Venice AI in Asherin | Unfiltered, Zero Setup",
    description:
      "How Asherin routes free and BYOK traffic through Venice AI for uncensored, vision-capable answers with no key, no account, no subscription.",
    ogType: "article",
    datePublished: "2026-06-17",
  },
  "/blog/aureon-legal-advisor-multi-jurisdictional": {
    title: "Asherin LAW Mode | Multi-Jurisdictional Legal Research",
    description:
      "How Asherin and Asher's LAW mode runs deep legal research across any country, state, or province, surfacing older statutes that supersede newer law without fabricating citations.",
    ogType: "article",
    datePublished: "2026-07-08",
  },

  // Blog satellites (Theory 8 — Nested Fractal Content Architecture)
  "/blog/what-is-ai-osint": {
    title: "What is AI OSINT? The Analyst's Complete Guide | Asherin",
    description:
      "AI OSINT defined: the four-stage pipeline, the cross-validation requirement, and how to spot a search wrapper pretending to be intelligence.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/blog/sovereign-ai-platforms": {
    title: "The 2026 Sovereign AI Platform Landscape | Asherin",
    description:
      "Eight serious sovereign AI platforms, four architecture patterns, and the four-layer test that eliminates 60% of sovereignty claims on first inspection.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/blog/ai-without-restrictions": {
    title: "AI Without Restrictions | Operator Workflow Guide | Asherin",
    description:
      "Model choice, prompt discipline, refusal-detection, and the three workflow patterns that survive long sessions on uncensored AI.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/blog/elite-corporations-algorithms-vs-axrlen": {
    title: "Elite Algorithms vs #HouseOfAsher | AXRLEN",
    description:
      "Aladdin controls the present. AXRLEN sees the future. A direct comparison between BlackRock's engine and #HouseOfAsher's predictive algorithm.",
    ogType: "article",
    datePublished: "2026-06-24",
  },
  "/blog/aureon-pricing-explained": {
    title: "Asherin Pricing Explained | Why $18/mo and $399/mo (2026)",
    description:
      "The full breakdown of Asherin's $18/mo and $399/mo subscription tiers, how they compare to ChatGPT/Claude/Gemini, and where AI pricing is headed through 2027.",
    ogType: "article",
    datePublished: "2026-06-19",
  },

  // Glossary cluster (Theory 12 — Sovereign Niche Monopoly)
  "/glossary": {
    title: "Asherin Glossary | Sovereign AI Vocabulary | Asherin",
    description:
      "Definitive, citable explanations of the terms operators actually use, sovereign AI, BYOK AI, uncensored AI, digital gnostic.",
  },
  "/glossary/sovereign-ai": {
    title: "Sovereign AI | Definition and Why It Matters",
    description:
      "Sovereign AI: a four-layer definition (key, model, refusal, data), how it differs from BYOK and uncensored, and how to verify it in 60 seconds.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/glossary/uncensored-ai": {
    title: "Uncensored AI | The Precise Definition | Asherin",
    description:
      "Uncensored AI is a model whose refusal behavior is set at the operator layer, not the vendor layer. Three failure modes of fake claims and a 60-second test.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/glossary/byok-ai": {
    title: "BYOK AI | Bring Your Own Key, Defined | Asherin",
    description:
      "BYOK AI: how it works, the economics, the nine providers Asherin supports natively, and why BYOK is necessary but not sufficient for sovereignty.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/glossary/digital-gnostic": {
    title: "Digital Gnostic | Operator Demographic Defined | Asherin",
    description:
      "The Digital Gnostic operator: 2-4M in 2026, high willingness to pay, search vocabulary, and why their tooling differs from consumer AI users.",
    ogType: "article",
    datePublished: "2026-06-19",
  },

  // Feature pages
  "/feature/zophiel": {
    title: "Zophiel | 30-Source OSINT & Truth Engine | Asherin",
    description:
      "Zophiel cross-validates 30+ live OSINT sources, scores veracity, and surfaces verified intelligence with citations.",
  },
  "/feature/azplen": {
    title: "Azplen Foundry | 20-Tab Data Intelligence Suite | Asherin",
    description: "Azplen Foundry: a 20-tab data suite for live analysis, transformation, and intelligence operations.",
  },
  "/feature/briefings": {
    title: "Intelligence Briefings | Truth Extraction | Asherin",
    description:
      "Generate publication-ready intelligence briefings with triple-fallback parsing and verified source citations.",
  },
  "/feature/personas": {
    title: "Personas | Custom AI Operators | Asherin",
    description: "Create, store, and deploy custom AI personas with metadata, voice, and persistent context.",
  },
  "/feature/zali": {
    title: "ZALI Design Suite | FEA, Thermal & Materials",
    description:
      "ZALI Design Suite: AI-driven FEA simulation, thermal analysis, material selection, and assembly generation.",
  },
  "/feature/zahten": {
    title: "Zahten | Adversarial Intelligence Module | Asherin",
    description: "Zahten: adversarial simulation and counter-intelligence modeling for hostile environment analysis.",
  },
  "/feature/predictive": {
    title: "Predictive Intelligence | Event Forecasting",
    description: "Forecast corporate events, market dislocations, and policy moves with Monte Carlo modeling.",
  },
  "/feature/ide": {
    title: "Asherin IDE | In-Dashboard Monaco Development | Asherin",
    description:
      "A full Monaco-based IDE inside Asherin: BYOK across 9 providers, sandboxed iframe preview, and custom tabs.",
  },
  "/feature/imagine-intelligence": {
    title: "Imagine Intelligence | Generative Reasoning Engine | Asherin",
    description: "Imagine Intelligence: generative reasoning with multi-modal input and cross-domain synthesis.",
  },
  "/feature/notebooks": {
    title: "Intelligence Notebooks | SQL + AI Analysis | Asherin",
    description:
      "Intelligence Notebooks: live SQL execution, AI reasoning, and 800ms-debounced query analysis with SECURITY DEFINER.",
  },
  "/feature/byok": {
    title: "BYOK | Bring Your Own Model & Key | Asherin",
    description:
      "Bring your own API key for Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, xAI, OpenRouter, Asherin supports them all.",
  },
  "/feature/zerlal": {
    title: "ZERLAL | Vulnerability & Exploit Intelligence | Asherin",
    description:
      "ZERLAL: fault-tolerant vulnerability scanning, Cyber Kill Chain mapping, and exploit-feasibility analysis.",
  },
  "/feature/zeeion": {
    title: "Zeeion | Trustless AI Arbitration & Forensics | Asherin",
    description:
      "Zeeion: trustless AI arbitration, evidence validation, platform forensics, and workforce optimization.",
  },
  "/feature/aziion": {
    title: "Aziion | Autonomous Trading Intelligence | Asherin",
    description: "Aziion: live trading intelligence on Hyperliquid with 60%-confidence signal gating.",
  },
  "/feature/axrlen": {
    title: "AXRLEN | NEXUS-PRIME Predictive Engine | Asherin",
    description:
      "AXRLEN NEXUS-PRIME: multi-side predictive engine with probabilistic scenarios, timeline divergences, and brain-backed corpora.",
  },
  "/feature/zaplen": {
    title: "Zaplen | Dual-AI War Scenario Engine | Asherin",
    description: "Zaplen: dual-AI chess-style war scenario engine for adversarial modeling. Admin-only.",
  },
  "/feature/pattern-analysis": {
    title: "Pattern Analysis | Pro Forecasting & Recharts | Asherin",
    description:
      "Pattern Analysis: pro-tier forecasting with Recharts visualizations and pattern-recognition on live data.",
  },
  "/feature/file-scrapper": {
    title: "File Scrapper | Unstructured Document Extraction | Asherin",
    description: "File Scrapper: extract structured intelligence from PDFs, images, and unstructured documents.",
  },
  "/feature/ebook": {
    title: "E-book Generator | Long-Form Content | Asherin",
    description:
      "Generate full e-books from multi-session text uploads with 500-word chapters and AI-generated cover art.",
  },
  "/feature/coding-laws": {
    title: "Coding Laws | Asherin's Engineering Doctrine | Asherin",
    description:
      "The Asherin coding laws: production-hardened patterns, session persistence, race-condition discipline, and security defaults.",
  },
  "/feature/memory-center": {
    title: "Memory Center | Persistent AI Context | Asherin",
    description: "Memory Center: persistent context, semantic recall, and cross-session intelligence continuity.",
  },
  "/feature/brains": {
    title: "Brains | Global Knowledge Corpora | Asherin",
    description:
      "Brains: globally addressable knowledge corpora, admin-controlled axrlen_brains and user-scoped brain stacks.",
  },
  "/feature/library": {
    title: "Library | Project Knowledge Management | Asherin",
    description:
      "Library: project folders, intelligence graph, and structured knowledge management for live operations.",
  },
  "/feature/whiteboard-info": {
    title: "Whiteboard | Infinite Canvas Intelligence | Asherin",
    description:
      "Asherin Whiteboard: infinite canvas, Photoshop-style layer stack, snap grids, and intelligence-aware drawing.",
  },
  "/feature/vedic": {
    title: "Vedic Intelligence | Jyotish-Driven Analysis | Asherin",
    description:
      "Vedic Intelligence: Jyotish-driven analytical layer fused with live astronomical and biographical data.",
  },

  // Standalone tools / experiences
  "/vedic-astrology": {
    title: "Vedic Astrology | Live Jyotish Chart Engine | Asherin",
    description:
      "Generate live Vedic astrology charts, dashas, and yogas with precise astronomical computation.",
  },
  "/vedic": {
    title: "Vedic Jyotish | Moon-Driven Transit Forecasts | Asherin",
    description:
      "Asherin Vedic: sidereal Moon transits, house ingresses, and dasha-aware forecasts computed to the minute in your local time.",
  },
  "/axrlen": {
    title: "AXRLEN | Free Predictive AI Engine (BYOK) | Asherin",
    description:
      "AXRLEN is a free predictive intelligence engine. Bring any model key (Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, xAI). 7/7 launch hits.",
  },
  "/ww3": {
    title: "WW3 Tracker | Live Conflict Intelligence | Asherin",
    description: "Live tracker for global conflict signals, sovereign posture changes, and escalation vectors.",
  },
  "/houseofasher-ventures": {
    title: "House of Asher Ventures | Operator-Grade Intelligence",
    description: "House of Asher Ventures: the operator collective behind Asherin and the Zophiel doctrine.",
  },
  "/proj-aureon": {
    title: "Project Asherin | Origin Brief",
    description: "Project Asherin: the origin brief, doctrine, and roadmap of the Asherin intelligence platform.",
  },
  "/forums": {
    title: "Forums | Asherin Operator Community",
    description: "Asherin Forums: live discussion among operators, analysts, and predictive intelligence builders.",
  },
  "/avapicks": {
    title: "AvaPicks | Curated Intelligence Picks | Asherin",
    description: "AvaPicks: curated daily intelligence picks across markets, geopolitics, and policy.",
  },
  "/openvpn": {
    title: "OpenVPN | Asherin Secure Access",
    description: "OpenVPN setup and configuration for Asherin secure access.",
  },
  "/elite": {
    title: "Elite Suite | Operator-Tier Access | Asherin",
    description: "Asherin Elite Suite: operator-tier tools, restricted modules, and pro intelligence surfaces.",
    noindex: true,
  },
  "/analytics": {
    title: "Analytics | Asherin Internal Telemetry",
    description: "Internal analytics surface for Asherin operators.",
    noindex: true,
  },
  // --- Editorial satellites (previously falling back to the homepage head) ---
  "/blog/ai-vulnerability-scanning-explained": {
    title: "AI Vulnerability Scanning, Explained | Asherin",
    description:
      "How AI-assisted vulnerability scanning actually works: signal collection, exploit-path reasoning, false-positive suppression, and confidence scoring.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/blog/vulnerability-chaining-explained": {
    title: "Vulnerability Chaining, Explained | Asherin",
    description:
      "Single findings rarely matter. Vulnerability chaining shows how low-severity issues combine into a full compromise path, with worked examples.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/blog/how-ai-predictive-forecasting-works": {
    title: "How AI Predictive Forecasting Works | Asherin",
    description:
      "Inside AXRLEN-style forecasting: signal fusion, scenario branching, probability weighting, and why calibration matters more than confidence.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/blog/how-aureon-uses-c-seo-research": {
    title: "How Asherin Uses Conversational SEO Research",
    description:
      "The C-SEO research loop behind Asherin's content: entity clustering, answer-shaped pages, and measuring citations inside AI search engines.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/blog/how-we-make-aureon-sound-human": {
    title: "How We Make Asherin Sound Human",
    description:
      "The editing doctrine behind Asherin's voice: cadence, specificity, refusal of filler, and the review passes every published page survives.",
    ogType: "article",
    datePublished: "2026-07-01",
  },
  "/blog/ai-stack-for-indian-startups": {
    title: "The AI Stack for Indian Startups That Can't Afford to Fail | Asherin",
    description:
      "How early-stage founders in India use AI to compete with funded companies at 1/10th the cost. The real bottleneck is not compute or budget, it is workflow logic.",
    ogType: "article",
    datePublished: "2026-08-10",
  },
  "/blog/code-narrative-quantum-collapse": {
    title: "Code-to-Narrative & Quantum Candidate Collapse",
    description:
      "The Asherin build doctrine: convert prompts into narrative, hunt flaws across nine dimensions, then collapse candidates into one shipped answer.",
    ogType: "article",
    datePublished: "2026-07-01",
  },
  "/blog/the-truth-and-reality-of-wars": {
    title: "The Truth and Reality of Wars | Asherin",
    description:
      "A structural read of modern conflict: incentive maps, resource clocks, and the exhaustion cycles that decide wars long before treaties do.",
    ogType: "article",
    datePublished: "2026-06-24",
  },
  "/blog/zaxin-tactical-ble-intelligence": {
    title: "Zaxin | Tactical BLE Intelligence | Asherin",
    description:
      "Zaxin turns Bluetooth Low Energy noise into tactical intelligence: device fingerprinting, proximity tracking, and optical/AI overlay fusion.",
    ogType: "article",
    datePublished: "2026-06-26",
  },

  // --- Glossary entries that were missing metadata ---
  "/glossary/operator-stack": {
    title: "Operator Stack | Definition | Asherin Glossary",
    description:
      "The operator stack: the tool chain an intelligence operator runs end-to-end, collection, validation, prediction, and delivery, defined precisely.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/glossary/zero-day-confidence-scoring": {
    title: "Zero-Day Confidence Scoring | Definition",
    description:
      "Zero-day confidence scoring: how unverified vulnerability signals are weighted, ranked, and reported without overstating certainty.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/glossary/predictive-intelligence-ai": {
    title: "Predictive Intelligence AI | Definition",
    description:
      "Predictive intelligence AI: forecasting events from live signals rather than summarizing the past, and the calibration test that separates the two.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/glossary/conversational-seo": {
    title: "Conversational SEO (C-SEO) | Definition",
    description:
      "Conversational SEO: optimizing for citation inside AI answers instead of blue links, entity clarity, answer shape, and verifiable sourcing.",
    ogType: "article",
    datePublished: "2026-06-19",
  },

  // --- Standalone public pages ---
  "/updates": {
    title: "Updates | Asherin Release Log",
    description:
      "Every meaningful Asherin release: new intelligence modules, engine upgrades, and platform changes, logged as they ship.",
  },
  "/ziaassets": {
    title: "ZIA Assets | Restricted",
    description: "Restricted internal asset vault for Asherin operators.",
    noindex: true,
  },
  "/unsubscribe": {
    title: "Unsubscribe | Asherin",
    description: "Unsubscribe from Asherin notifications.",
    noindex: true,
  },
};

// NOTE: /asher is intentionally NOT skipped — it has a SEO entry and is in the sitemap;
// skipping it caused the static index.html canonical (pointing to "/") to leak through,
// making crawlers treat /asher as a duplicate of the homepage and drop it.
export const SKIP_PREFIXES = ["/dashboard", "/asher-dashboard"];
