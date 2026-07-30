import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Centralized per-route SEO.
 * Updates <title>, meta description, canonical, og:* on every route change.
 * Skipped paths (/asher, /dashboard, /asher-dashboard) are left untouched.
 */

const ORIGIN = "https://aureonai.app";
const DEFAULT_OG_IMAGE = "https://aureonai.app/og-image.png";
const JSONLD_ID = "route-seo-jsonld";

type SeoEntry = {
  title: string;
  description: string;
  ogType?: "website" | "article" | "product";
  noindex?: boolean;
};

// Per-route metadata. Keep titles <60 chars, descriptions <160 chars.
const SEO: Record<string, SeoEntry> = {
  "/": {
    title: "Asherin — Predictive Intelligence Platform for Operators",
    description:
      "Asherin is the predictive intelligence stack for analysts, traders, and operators. Forecast events, model timelines, and act before the wire.",
  },
  "/pricing": {
    title: "Pricing — Asherin, Pro & Enterprise Plans",
    description:
      "Asherin is $18/mo for the core platform and $399/mo for Asherin Pro (Azplen, NOMAD, Briefings, Zophiel Pro). Enterprise on request.",
  },
  "/terms": {
    title: "Terms of Service — Asherin",
    description: "Asherin's Terms of Service. Read the rules of engagement for using the platform.",
  },
  "/software": {
    title: "Software — Every Asherin Tool | Asherin",
    description:
      "Every Asherin tool — OSINT search, predictive engines, IDE, whiteboard, e-book, file scrapper — on the $18/mo and $399/mo plans.",
  },

  "/benchmark": {
    title: "Asherin Benchmark — Cheap Models, Groomed to Outperform",
    description:
      "Asherin vs Opus 4.8 vs GPT-5.5 on a thread-safe LRU cache: prompts, code, and scored results in the open.",
  },
  "/asher": {
    title: "Asher — Operator Workspace | Asherin",
    description:
      "Asher: the operator workspace inside Aureon. Encrypted channels, intelligence modules, and live collaboration.",
  },
  "/privacy": {
    title: "Privacy Policy — Asherin",
    description: "How Asherin handles your data: storage, encryption, retention, and your rights.",
  },
  "/founder": {
    title: "Founder — Asher Newton, Architect of Asherin",
    description:
      "The story behind Asherin: Asher Newton, House of Asher, and the doctrine that built a predictive intelligence platform.",
  },
  "/hosrad": {
    title: "HOSRAD — House Of Asher Research & Development",
    description:
      "HOSRAD is the House Of Asher R&D division — a private DARPA for the Asher Empire. Full-spectrum research across AI, quantum, military, and civilian safety technology.",
  },
  "/prompt-engineering": {
    title: "Prompt Engineering Protocols — Zophiel Doctrine",
    description:
      "The Zophiel prompt-engineering protocols: 45 sections of elite techniques for turning LLMs into surgical intelligence operators.",
  },
  "/features": {
    title: "Features — Every Asherin Intelligence Module",
    description:
      "Every Asherin module: Zophiel OSINT, AXRLEN predictive engine, NOMAD dossiers, ZALI design, ZERLAL security, and the full operator stack.",
  },
  "/benchmarks": {
    title: "Benchmarks — Asherin Model & Engine Performance",
    description: "Live benchmarks across Asherin's intelligence engines, model consensus, and predictive performance.",
  },
  "/nda": {
    title: "NDA — Asherin Confidentiality Agreement",
    description: "Asherin's standard non-disclosure agreement for partners, testers, and contractors.",
  },
  "/llm-models": {
    title: "Supported LLM Models — BYOK Catalog | Asherin",
    description:
      "Every model Asherin supports via BYOK: Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, xAI, OpenRouter, and more.",
  },
  "/blog": {
    title: "Asherin Blog — Field Reports from the Operator Stack",
    description:
      "Long-form comparisons, benchmarks, and intelligence write-ups from the Asherin team. No fluff, no affiliate links.",
  },
  "/blog/comparison": {
    title: "Asherin vs ChatGPT vs Claude — Honest 2026 Comparison",
    description:
      "Side-by-side: price, censorship, BYOK, OSINT, IDE, simulation, and privacy across Asherin, ChatGPT Plus, and Claude Pro.",
    ogType: "article",
  },
  "/blog/venice-integration": {
    title: "Venice AI in Asherin — Unfiltered, Zero Setup",
    description:
      "How Asherin routes free and BYOK traffic through Venice AI for uncensored, vision-capable answers with no key, no account, no subscription.",
    ogType: "article",
  },
  "/blog/aureon-legal-advisor-multi-jurisdictional": {
    title: "Asherin Legal Advisor (LAW Mode) — Multi-Jurisdictional AI Legal Research",
    description:
      "How Asherin and Asher's LAW mode runs deep legal research across any country, state, or province — surfacing older statutes that supersede newer law without fabricating citations.",
    ogType: "article",
  },

  // Blog satellites (Theory 8 — Nested Fractal Content Architecture)
  "/blog/what-is-ai-osint": {
    title: "What is AI OSINT? The Analyst's Complete Guide | Asherin",
    description:
      "AI OSINT defined: the four-stage pipeline, the cross-validation requirement, and how to spot a search wrapper pretending to be intelligence.",
    ogType: "article",
  },
  "/blog/sovereign-ai-platforms": {
    title: "The 2026 Sovereign AI Platform Landscape | Asherin",
    description:
      "Eight serious sovereign AI platforms, four architecture patterns, and the four-layer test that eliminates 60% of sovereignty claims on first inspection.",
    ogType: "article",
  },
  "/blog/ai-without-restrictions": {
    title: "AI Without Restrictions — Operator Workflow Guide | Asherin",
    description:
      "Model choice, prompt discipline, refusal-detection, and the three workflow patterns that survive long sessions on uncensored AI.",
    ogType: "article",
  },
  "/blog/predictions/world-cup-2026-group-matches-0622": {
    title: "AXRLEN Forecast — World Cup 2026 Group Matches (22 June) | Asherin",
    description:
      "AXRLEN picks for the 22 June 2026 World Cup slate: Argentina over Austria, France over Iraq, Norway over Senegal, Algeria over Jordan.",
    ogType: "article",
  },
  "/blog/predictions/world-cup-2026-group-matches-0623": {
    title: "AXRLEN Forecast — World Cup 2026 Group Matches (23 June) | Asherin",
    description:
      "AXRLEN picks for the 23 June 2026 World Cup slate: Portugal over Uzbekistan, England over Ghana, Croatia over Panama, Colombia over DR Congo.",
    ogType: "article",
  },
  "/blog/predictions/world-cup-2026-group-matches-0624": {
    title: "AXRLEN Deep Dive — World Cup 2026 (23 June)",
    description:
      "Structural and historical AXRLEN analysis behind the 23 June 2026 picks: Portugal, England, Croatia, and Colombia.",
    ogType: "article",
  },
  "/blog/predictions/world-cup-2026-group-matches-0625": {
    title: "AXRLEN Forecast — World Cup 2026 Group Matches (24 June) | Asherin",
    description:
      "AXRLEN picks for the 24 June 2026 World Cup slate: Switzerland, Bosnia, Morocco, Brazil, South Korea, Mexico — with modal scorelines and confidence weights.",
    ogType: "article",
  },
  "/blog/predictions/peru-2026-keiko-fujimori": {
    title: "AXRLEN — Keiko Fujimori, Peru 2026 President",
    description:
      "AXRLEN predicts Keiko Fujimori wins the 2026 Peru runoff under the Antivoto Paradox. Three scenarios, 94% polarized runoff probability.",
    ogType: "article",
  },
  "/blog/predictions/russia-ukraine-war-2026-endgame": {
    title: "AXRLEN — Russia–Ukraine 2026 Endgame Forecast",
    description:
      "AXRLEN forecasts a Korean-style armistice along the current line of contact within 24 months. Symmetric Exhaustion Cycle, 55% armistice probability, de facto Donbas/Crimea partition.",
    ogType: "article",
  },
  "/blog/predictions/china-taiwan-2026-flashpoint": {
    title: "AXRLEN — China–Taiwan 2026 Flashpoint Forecast",
    description:
      "AXRLEN forecasts a 72% Taiwan Strait kinetic-crisis probability in 2026 with a PLA blockade-first escalation path. Thucydides–Mahan Convergence and US deterrence dissonance.",
    ogType: "article",
  },
  "/blog/predictions/israel-iran-2026-shadow-war": {
    title: "AXRLEN — Israel–Iran 2026 Shadow War Forecast",
    description:
      "AXRLEN forecasts High-Intensity Intermittency and a singular Israeli 'Hard Test' strike on Iranian nuclear infrastructure. Hezbollah-first sequencing, three-month proxy spike, forced mediation.",
    ogType: "article",
  },
  "/blog/the-crypto-dump-october-2026": {
    title: "The Crypto Dump — BTC to $44,500 (Oct 2026)",
    description:
      "AXRLEN predicts a Bitcoin liquidity event Oct 12–19, 2026 with a $44,500 floor at 88% confidence. SBC Vedha collision and Mars–Rahu trigger.",
    ogType: "article",
  },
  "/blog/elite-corporations-algorithms-vs-axrlen": {
    title: "Elite Algorithms vs #HouseOfAsher — AXRLEN",
    description:
      "Aladdin controls the present. AXRLEN sees the future. A direct comparison between BlackRock's engine and #HouseOfAsher's predictive algorithm.",
    ogType: "article",
  },
  "/blog/btc-daily-predictions": {
    title: "AXRLEN BTC Daily — Live Long/Short Forecast | Asherin",
    description:
      "Daily 07:00 EST AXRLEN Bitcoin forecast. Live BTC price, long/short call with entry, stop loss, take profit, and a running win/loss tally.",
    ogType: "article",
  },
  "/blog/aureon-pricing-explained": {
    title: "Asherin Pricing Explained — Why $18/mo and $399/mo (2026)",
    description:
      "The full breakdown of Asherin's $18/mo and $399/mo subscription tiers, how they compare to ChatGPT/Claude/Gemini, and where AI pricing is headed through 2027.",
    ogType: "article",
  },

  // Glossary cluster (Theory 12 — Sovereign Niche Monopoly)
  "/glossary": {
    title: "Asherin Glossary — Sovereign AI Vocabulary | Asherin",
    description:
      "Definitive, citable explanations of the terms operators actually use — sovereign AI, BYOK AI, uncensored AI, digital gnostic.",
  },
  "/glossary/sovereign-ai": {
    title: "Sovereign AI — Definition, Origin, and Why It Matters | Asherin",
    description:
      "Sovereign AI: a four-layer definition (key, model, refusal, data), how it differs from BYOK and uncensored, and how to verify it in 60 seconds.",
    ogType: "article",
  },
  "/glossary/uncensored-ai": {
    title: "Uncensored AI — The Precise Definition | Asherin",
    description:
      "Uncensored AI is a model whose refusal behavior is set at the operator layer, not the vendor layer. Three failure modes of fake claims and a 60-second test.",
    ogType: "article",
  },
  "/glossary/byok-ai": {
    title: "BYOK AI — Bring Your Own Key, Defined | Asherin",
    description:
      "BYOK AI: how it works, the economics, the nine providers Asherin supports natively, and why BYOK is necessary but not sufficient for sovereignty.",
    ogType: "article",
  },
  "/glossary/digital-gnostic": {
    title: "Digital Gnostic — Operator Demographic Defined | Asherin",
    description:
      "The Digital Gnostic operator: 2-4M in 2026, high willingness to pay, search vocabulary, and why their tooling differs from consumer AI users.",
    ogType: "article",
  },

  // Feature pages
  "/feature/zophiel": {
    title: "Zophiel — 30-Source OSINT & Truth Engine | Asherin",
    description:
      "Zophiel cross-validates 30+ live OSINT sources, scores veracity, and surfaces verified intelligence with citations.",
  },
  "/feature/nomad": {
    title: "NOMAD — 14-Pass Intelligence Dossier Suite | Asherin",
    description:
      "NOMAD generates persistent intelligence dossiers across 30 OSINT sources with a 14-pass analysis tree.",
  },
  "/feature/azplen": {
    title: "Azplen Foundry — 20-Tab Data Intelligence Suite | Asherin",
    description: "Azplen Foundry: a 20-tab data suite for live analysis, transformation, and intelligence operations.",
  },
  "/feature/briefings": {
    title: "Intelligence Briefings — Truth Extraction | Asherin",
    description:
      "Generate publication-ready intelligence briefings with triple-fallback parsing and verified source citations.",
  },
  "/feature/personas": {
    title: "Personas — Custom AI Operators | Asherin",
    description: "Create, store, and deploy custom AI personas with metadata, voice, and persistent context.",
  },
  "/feature/zali": {
    title: "ZALI Design Suite — FEA, Thermal, Material Generation | Asherin",
    description:
      "ZALI Design Suite: AI-driven FEA simulation, thermal analysis, material selection, and assembly generation.",
  },
  "/feature/zahten": {
    title: "Zahten — Adversarial Intelligence Module | Asherin",
    description: "Zahten: adversarial simulation and counter-intelligence modeling for hostile environment analysis.",
  },
  "/feature/predictive": {
    title: "Predictive Intelligence — Corporate Event Forecasting | Asherin",
    description: "Forecast corporate events, market dislocations, and policy moves with Monte Carlo modeling.",
  },
  "/feature/ide": {
    title: "Asherin IDE — In-Dashboard Monaco Development | Asherin",
    description:
      "A full Monaco-based IDE inside Asherin: BYOK across 9 providers, sandboxed iframe preview, and custom tabs.",
  },
  "/feature/imagine-intelligence": {
    title: "Imagine Intelligence — Generative Reasoning Engine | Asherin",
    description: "Imagine Intelligence: generative reasoning with multi-modal input and cross-domain synthesis.",
  },
  "/feature/notebooks": {
    title: "Intelligence Notebooks — SQL + AI Analysis | Asherin",
    description:
      "Intelligence Notebooks: live SQL execution, AI reasoning, and 800ms-debounced query analysis with SECURITY DEFINER.",
  },
  "/feature/video-intelligence": {
    title: "Video Intelligence — FACS Behavioral Tracking | Asherin",
    description:
      "Video Intelligence: FACS behavioral tracking, micro-expression analysis, and object locus mapping.",
  },
  "/feature/byok": {
    title: "BYOK — Bring Your Own Model & Key | Asherin",
    description:
      "Bring your own API key for Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, xAI, OpenRouter — Asherin supports them all.",
  },
  "/feature/zerlal": {
    title: "ZERLAL — Vulnerability & Exploit Intelligence | Asherin",
    description:
      "ZERLAL: fault-tolerant vulnerability scanning, Cyber Kill Chain mapping, and exploit-feasibility analysis.",
  },
  "/feature/zeeion": {
    title: "Zeeion — Trustless AI Arbitration & Forensics | Asherin",
    description:
      "Zeeion: trustless AI arbitration, evidence validation, platform forensics, and workforce optimization.",
  },
  "/feature/aziion": {
    title: "Aziion — Autonomous Trading Intelligence | Asherin",
    description: "Aziion: live trading intelligence on Hyperliquid with 60%-confidence signal gating.",
  },
  "/feature/axrlen": {
    title: "AXRLEN — NEXUS-PRIME Predictive Engine | Asherin",
    description:
      "AXRLEN NEXUS-PRIME: multi-side predictive engine with probabilistic scenarios, timeline divergences, and brain-backed corpora.",
  },
  "/feature/cross": {
    title: "CROSS — 17-Mode Analytical Platform | Asherin",
    description:
      "CROSS: 17 analytical modes, WebM screen recording, micro-expression analysis, and 5-level intelligence hierarchy.",
  },
  "/feature/zaplen": {
    title: "Zaplen — Dual-AI War Scenario Engine | Asherin",
    description: "Zaplen: dual-AI chess-style war scenario engine for adversarial modeling. Admin-only.",
  },
  "/feature/cipher": {
    title: "Cipher — AES-256-GCM Vault Intelligence | Asherin",
    description: "Cipher: end-to-end encrypted vault with AES-256-GCM, chrooted file access, and admin RLS partitions.",
  },
  "/feature/pattern-analysis": {
    title: "Pattern Analysis — Pro Forecasting & Recharts | Asherin",
    description:
      "Pattern Analysis: pro-tier forecasting with Recharts visualizations and pattern-recognition on live data.",
  },
  "/feature/file-scrapper": {
    title: "File Scrapper — Unstructured Document Extraction | Asherin",
    description: "File Scrapper: extract structured intelligence from PDFs, images, and unstructured documents.",
  },
  "/feature/ebook": {
    title: "E-book Generator — Long-Form Content | Asherin",
    description:
      "Generate full e-books from multi-session text uploads with 500-word chapters and AI-generated cover art.",
  },
  "/feature/plugin-marketplace": {
    title: "Plugin Marketplace — Third-Party Integrations | Asherin",
    description: "Live execution engine for third-party plugins and integrations inside Aureon.",
  },
  "/feature/coding-laws": {
    title: "Coding Laws — Asherin's Engineering Doctrine | Asherin",
    description:
      "The Asherin coding laws: production-hardened patterns, session persistence, race-condition discipline, and security defaults.",
  },
  "/feature/memory-center": {
    title: "Memory Center — Persistent AI Context | Asherin",
    description: "Memory Center: persistent context, semantic recall, and cross-session intelligence continuity.",
  },
  "/feature/brains": {
    title: "Brains — Global Knowledge Corpora | Asherin",
    description:
      "Brains: globally addressable knowledge corpora — admin-controlled axrlen_brains and user-scoped brain stacks.",
  },
  "/feature/library": {
    title: "Library — Project Knowledge Management | Asherin",
    description:
      "Library: project folders, intelligence graph, and structured knowledge management for live operations.",
  },
  "/feature/whiteboard-info": {
    title: "Whiteboard — Infinite Canvas Intelligence | Asherin",
    description:
      "Asherin Whiteboard: infinite canvas, Photoshop-style layer stack, snap grids, and intelligence-aware drawing.",
  },
  "/feature/vedic": {
    title: "Vedic Intelligence — Jyotish-Driven Analysis | Asherin",
    description:
      "Vedic Intelligence: Jyotish-driven analytical layer fused with live astronomical and biographical data.",
  },

  // Standalone tools / experiences
  "/vedic-astrology": {
    title: "Vedic Astrology — Live Jyotish Chart Engine | Asherin",
    description:
      "Generate live Vedic astrology charts, dashas, and yogas with precise astronomical computation.",
  },
  "/vedic": {
    title: "Vedic Jyotish — Moon-Driven Transit Forecasts | Asherin",
    description:
      "Asherin Vedic: sidereal Moon transits, house ingresses, and dasha-aware forecasts computed to the minute in your local time.",
  },
  "/zophiel": {
    title: "Zophiel Free — Public OSINT & Truth Engine | Asherin",
    description:
      "Zophiel Free: 30-source OSINT search, veracity scoring, and verified intelligence. Public, no login.",
  },
  "/search": {
    title: "Zophiel Search — Verified OSINT Intelligence | Asherin",
    description: "Search 30+ live OSINT sources with cross-validation and citation-grade veracity scoring.",
  },
  "/axrlen": {
    title: "AXRLEN — Free Predictive AI Engine (BYOK) | Asherin",
    description:
      "AXRLEN is a free predictive intelligence engine. Bring any model key (Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, xAI). 7/7 launch hits.",
  },
  "/ww3": {
    title: "WW3 Tracker — Live Conflict Intelligence | Asherin",
    description: "Live tracker for global conflict signals, sovereign posture changes, and escalation vectors.",
  },
  "/houseofasher-ventures": {
    title: "House of Asher Ventures — Operator-Grade Intelligence",
    description: "House of Asher Ventures: the operator collective behind Asherin and the Zophiel doctrine.",
  },
  "/proj-aureon": {
    title: "Project Asherin — Origin Brief",
    description: "Project Asherin: the origin brief, doctrine, and roadmap of the Asherin intelligence platform.",
  },
  "/whiteboard": {
    title: "Whiteboard — Infinite Intelligence Canvas | Asherin",
    description: "Asherin Whiteboard: infinite canvas with intelligence-aware drawing and snap-grid precision.",
  },
  "/forums": {
    title: "Forums — Asherin Operator Community",
    description: "Asherin Forums: live discussion among operators, analysts, and predictive intelligence builders.",
  },
  "/avapicks": {
    title: "AvaPicks — Curated Intelligence Picks | Asherin",
    description: "AvaPicks: curated daily intelligence picks across markets, geopolitics, and policy.",
  },
  "/openvpn": {
    title: "OpenVPN — Asherin Secure Access",
    description: "OpenVPN setup and configuration for Asherin secure access.",
  },
  "/elite": {
    title: "Elite Suite — Operator-Tier Access | Asherin",
    description: "Asherin Elite Suite: operator-tier tools, restricted modules, and pro intelligence surfaces.",
    noindex: true,
  },
  "/analytics": {
    title: "Analytics — Asherin Internal Telemetry",
    description: "Internal analytics surface for Asherin operators.",
    noindex: true,
  },
  "/unsubscribe": {
    title: "Unsubscribe — Asherin",
    description: "Unsubscribe from Asherin notifications.",
    noindex: true,
  },
};

// Paths that should be left untouched entirely (authenticated app shell).
// NOTE: /asher is intentionally NOT skipped — it has a SEO entry and is in the sitemap;
// skipping it caused the static index.html canonical (pointing to "/") to leak through,
// making crawlers treat /asher as a duplicate of the homepage and drop it.
const SKIP_PREFIXES = ["/dashboard", "/asher-dashboard"];

function upsertMeta(selector: string, attr: string, value: string, build: () => HTMLElement) {
  let el = document.head.querySelector(selector) as HTMLElement | null;
  if (!el) {
    el = build();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

function removeMeta(selector: string) {
  document.head.querySelector(selector)?.remove();
}

function applySeo(entry: SeoEntry, path: string) {
  document.title = entry.title;

  upsertMeta('meta[name="description"]', "content", entry.description, () => {
    const m = document.createElement("meta");
    m.setAttribute("name", "description");
    return m;
  });

  const canonical = `${ORIGIN}${path}`;
  upsertMeta('link[rel="canonical"]', "href", canonical, () => {
    const l = document.createElement("link");
    l.setAttribute("rel", "canonical");
    return l;
  });

  upsertMeta('meta[property="og:title"]', "content", entry.title, () => {
    const m = document.createElement("meta");
    m.setAttribute("property", "og:title");
    return m;
  });
  upsertMeta('meta[property="og:description"]', "content", entry.description, () => {
    const m = document.createElement("meta");
    m.setAttribute("property", "og:description");
    return m;
  });
  upsertMeta('meta[property="og:url"]', "content", canonical, () => {
    const m = document.createElement("meta");
    m.setAttribute("property", "og:url");
    return m;
  });
  upsertMeta('meta[property="og:type"]', "content", entry.ogType ?? "website", () => {
    const m = document.createElement("meta");
    m.setAttribute("property", "og:type");
    return m;
  });

  // Twitter
  upsertMeta('meta[name="twitter:card"]', "content", "summary_large_image", () => {
    const m = document.createElement("meta");
    m.setAttribute("name", "twitter:card");
    return m;
  });
  upsertMeta('meta[name="twitter:title"]', "content", entry.title, () => {
    const m = document.createElement("meta");
    m.setAttribute("name", "twitter:title");
    return m;
  });
  upsertMeta('meta[name="twitter:description"]', "content", entry.description, () => {
    const m = document.createElement("meta");
    m.setAttribute("name", "twitter:description");
    return m;
  });

  // og:image + twitter:image — parity with index.html landing page
  upsertMeta('meta[property="og:image"]', "content", DEFAULT_OG_IMAGE, () => {
    const m = document.createElement("meta");
    m.setAttribute("property", "og:image");
    return m;
  });
  upsertMeta('meta[property="og:image:width"]', "content", "1920", () => {
    const m = document.createElement("meta");
    m.setAttribute("property", "og:image:width");
    return m;
  });
  upsertMeta('meta[property="og:image:height"]', "content", "1080", () => {
    const m = document.createElement("meta");
    m.setAttribute("property", "og:image:height");
    return m;
  });
  upsertMeta('meta[name="twitter:image"]', "content", DEFAULT_OG_IMAGE, () => {
    const m = document.createElement("meta");
    m.setAttribute("name", "twitter:image");
    return m;
  });

  // Per-route JSON-LD WebPage structured data (in addition to sitewide Organization)
  let ld = document.getElementById(JSONLD_ID) as HTMLScriptElement | null;
  if (!ld) {
    ld = document.createElement("script");
    ld.id = JSONLD_ID;
    ld.type = "application/ld+json";
    document.head.appendChild(ld);
  }
  ld.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: entry.title,
    description: entry.description,
    url: canonical,
    isPartOf: {
      "@type": "WebSite",
      name: "Asherin",
      url: ORIGIN,
    },
  });

  if (entry.noindex) {
    upsertMeta('meta[name="robots"]', "content", "noindex,nofollow", () => {
      const m = document.createElement("meta");
      m.setAttribute("name", "robots");
      return m;
    });
  } else {
    removeMeta('meta[name="robots"]');
  }
}

export default function RouteSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return; // Do not touch /asher or /dashboard heads.
    }
    const entry = SEO[pathname];
    if (!entry) return; // Unknown route → leave existing head intact.
    applySeo(entry, pathname);
  }, [pathname]);

  return null;
}
