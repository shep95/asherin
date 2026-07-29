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
    title: "Aureon — Predictive Intelligence Platform for Operators",
    description:
      "Aureon is the predictive intelligence stack for analysts, traders, and operators. Forecast events, model timelines, and act before the wire.",
  },
  "/pricing": {
    title: "Pricing — Aureon, Pro & Enterprise Plans",
    description:
      "Asherin is $18/mo for the core platform and $399/mo for Asherin Pro (Azplen, NOMAD, Briefings, Zophiel Pro). Enterprise on request.",
  },
  "/terms": {
    title: "Terms of Service — Aureon",
    description: "Aureon's Terms of Service. Read the rules of engagement for using the platform.",
  },
  "/software": {
    title: "Software — Every Aureon Tool | Aureon",
    description:
      "Every Aureon tool — OSINT search, predictive engines, IDE, whiteboard, e-book, file scrapper — on the $18/mo and $399/mo plans.",
  },

  "/benchmark": {
    title: "Aureon Benchmark — Cheap Models, Groomed to Outperform",
    description:
      "Aureon vs Opus 4.8 vs GPT-5.5 on a thread-safe LRU cache: prompts, code, and scored results in the open.",
  },
  "/asher": {
    title: "Asher — Operator Workspace | Aureon",
    description:
      "Asher: the operator workspace inside Aureon. Encrypted channels, intelligence modules, and live collaboration.",
  },
  "/privacy": {
    title: "Privacy Policy — Aureon",
    description: "How Aureon handles your data: storage, encryption, retention, and your rights.",
  },
  "/founder": {
    title: "Founder — Asher Newton, Architect of Aureon",
    description:
      "The story behind Aureon: Asher Newton, House of Asher, and the doctrine that built a predictive intelligence platform.",
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
    title: "Features — Every Aureon Intelligence Module",
    description:
      "Every Aureon module: Zophiel OSINT, AXRLEN predictive engine, NOMAD dossiers, ZALI design, ZERLAL security, and the full operator stack.",
  },
  "/benchmarks": {
    title: "Benchmarks — Aureon Model & Engine Performance",
    description: "Live benchmarks across Aureon's intelligence engines, model consensus, and predictive performance.",
  },
  "/nda": {
    title: "NDA — Aureon Confidentiality Agreement",
    description: "Aureon's standard non-disclosure agreement for partners, testers, and contractors.",
  },
  "/llm-models": {
    title: "Supported LLM Models — BYOK Catalog | Aureon",
    description:
      "Every model Aureon supports via BYOK: Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, xAI, OpenRouter, and more.",
  },
  "/blog": {
    title: "Aureon Blog — Field Reports from the Operator Stack",
    description:
      "Long-form comparisons, benchmarks, and intelligence write-ups from the Aureon team. No fluff, no affiliate links.",
  },
  "/blog/comparison": {
    title: "Aureon vs ChatGPT vs Claude — Honest 2026 Comparison",
    description:
      "Side-by-side: price, censorship, BYOK, OSINT, IDE, simulation, and privacy across Aureon, ChatGPT Plus, and Claude Pro.",
    ogType: "article",
  },
  "/blog/venice-integration": {
    title: "Venice AI in Aureon — Unfiltered, Zero Setup",
    description:
      "How Aureon routes free and BYOK traffic through Venice AI for uncensored, vision-capable answers with no key, no account, no subscription.",
    ogType: "article",
  },
  "/blog/aureon-legal-advisor-multi-jurisdictional": {
    title: "Aureon Legal Advisor (LAW Mode) — Multi-Jurisdictional AI Legal Research",
    description:
      "How Aureon and Asher's LAW mode runs deep legal research across any country, state, or province — surfacing older statutes that supersede newer law without fabricating citations.",
    ogType: "article",
  },

  // Blog satellites (Theory 8 — Nested Fractal Content Architecture)
  "/blog/what-is-ai-osint": {
    title: "What is AI OSINT? The Analyst's Complete Guide | Aureon",
    description:
      "AI OSINT defined: the four-stage pipeline, the cross-validation requirement, and how to spot a search wrapper pretending to be intelligence.",
    ogType: "article",
  },
  "/blog/sovereign-ai-platforms": {
    title: "The 2026 Sovereign AI Platform Landscape | Aureon",
    description:
      "Eight serious sovereign AI platforms, four architecture patterns, and the four-layer test that eliminates 60% of sovereignty claims on first inspection.",
    ogType: "article",
  },
  "/blog/ai-without-restrictions": {
    title: "AI Without Restrictions — Operator Workflow Guide | Aureon",
    description:
      "Model choice, prompt discipline, refusal-detection, and the three workflow patterns that survive long sessions on uncensored AI.",
    ogType: "article",
  },
  "/blog/predictions/world-cup-2026-group-matches-0622": {
    title: "AXRLEN Forecast — World Cup 2026 Group Matches (22 June) | Aureon",
    description:
      "AXRLEN picks for the 22 June 2026 World Cup slate: Argentina over Austria, France over Iraq, Norway over Senegal, Algeria over Jordan.",
    ogType: "article",
  },
  "/blog/predictions/world-cup-2026-group-matches-0623": {
    title: "AXRLEN Forecast — World Cup 2026 Group Matches (23 June) | Aureon",
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
    title: "AXRLEN Forecast — World Cup 2026 Group Matches (24 June) | Aureon",
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
    title: "AXRLEN BTC Daily — Live Long/Short Forecast | Aureon",
    description:
      "Daily 07:00 EST AXRLEN Bitcoin forecast. Live BTC price, long/short call with entry, stop loss, take profit, and a running win/loss tally.",
    ogType: "article",
  },
  "/blog/aureon-pricing-explained": {
    title: "Aureon Pricing Explained — Why $18/mo and $399/mo (2026)",
    description:
      "The full breakdown of Aureon's $18/mo and $399/mo subscription tiers, how they compare to ChatGPT/Claude/Gemini, and where AI pricing is headed through 2027.",
    ogType: "article",
  },

  // Glossary cluster (Theory 12 — Sovereign Niche Monopoly)
  "/glossary": {
    title: "Aureon Glossary — Sovereign AI Vocabulary | Aureon",
    description:
      "Definitive, citable explanations of the terms operators actually use — sovereign AI, BYOK AI, uncensored AI, digital gnostic.",
  },
  "/glossary/sovereign-ai": {
    title: "Sovereign AI — Definition, Origin, and Why It Matters | Aureon",
    description:
      "Sovereign AI: a four-layer definition (key, model, refusal, data), how it differs from BYOK and uncensored, and how to verify it in 60 seconds.",
    ogType: "article",
  },
  "/glossary/uncensored-ai": {
    title: "Uncensored AI — The Precise Definition | Aureon",
    description:
      "Uncensored AI is a model whose refusal behavior is set at the operator layer, not the vendor layer. Three failure modes of fake claims and a 60-second test.",
    ogType: "article",
  },
  "/glossary/byok-ai": {
    title: "BYOK AI — Bring Your Own Key, Defined | Aureon",
    description:
      "BYOK AI: how it works, the economics, the nine providers Aureon supports natively, and why BYOK is necessary but not sufficient for sovereignty.",
    ogType: "article",
  },
  "/glossary/digital-gnostic": {
    title: "Digital Gnostic — Operator Demographic Defined | Aureon",
    description:
      "The Digital Gnostic operator: 2-4M in 2026, high willingness to pay, search vocabulary, and why their tooling differs from consumer AI users.",
    ogType: "article",
  },

  // Feature pages
  "/feature/zophiel": {
    title: "Zophiel — 30-Source OSINT & Truth Engine | Aureon",
    description:
      "Zophiel cross-validates 30+ live OSINT sources, scores veracity, and surfaces verified intelligence with citations.",
  },
  "/feature/nomad": {
    title: "NOMAD — 14-Pass Intelligence Dossier Suite | Aureon",
    description:
      "NOMAD generates persistent intelligence dossiers across 30 OSINT sources with a 14-pass analysis tree.",
  },
  "/feature/azplen": {
    title: "Azplen Foundry — 20-Tab Data Intelligence Suite | Aureon",
    description: "Azplen Foundry: a 20-tab data suite for live analysis, transformation, and intelligence operations.",
  },
  "/feature/briefings": {
    title: "Intelligence Briefings — Truth Extraction | Aureon",
    description:
      "Generate publication-ready intelligence briefings with triple-fallback parsing and verified source citations.",
  },
  "/feature/personas": {
    title: "Personas — Custom AI Operators | Aureon",
    description: "Create, store, and deploy custom AI personas with metadata, voice, and persistent context.",
  },
  "/feature/zali": {
    title: "ZALI Design Suite — FEA, Thermal, Material Generation | Aureon",
    description:
      "ZALI Design Suite: AI-driven FEA simulation, thermal analysis, material selection, and assembly generation.",
  },
  "/feature/zahten": {
    title: "Zahten — Adversarial Intelligence Module | Aureon",
    description: "Zahten: adversarial simulation and counter-intelligence modeling for hostile environment analysis.",
  },
  "/feature/predictive": {
    title: "Predictive Intelligence — Corporate Event Forecasting | Aureon",
    description: "Forecast corporate events, market dislocations, and policy moves with Monte Carlo modeling.",
  },
  "/feature/ide": {
    title: "Aureon IDE — In-Dashboard Monaco Development | Aureon",
    description:
      "A full Monaco-based IDE inside Aureon: BYOK across 9 providers, sandboxed iframe preview, and custom tabs.",
  },
  "/feature/imagine-intelligence": {
    title: "Imagine Intelligence — Generative Reasoning Engine | Aureon",
    description: "Imagine Intelligence: generative reasoning with multi-modal input and cross-domain synthesis.",
  },
  "/feature/notebooks": {
    title: "Intelligence Notebooks — SQL + AI Analysis | Aureon",
    description:
      "Intelligence Notebooks: live SQL execution, AI reasoning, and 800ms-debounced query analysis with SECURITY DEFINER.",
  },
  "/feature/video-intelligence": {
    title: "Video Intelligence — FACS Behavioral Tracking | Aureon",
    description:
      "Video Intelligence: FACS behavioral tracking, micro-expression analysis, and object locus mapping.",
  },
  "/feature/byok": {
    title: "BYOK — Bring Your Own Model & Key | Aureon",
    description:
      "Bring your own API key for Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, xAI, OpenRouter — Aureon supports them all.",
  },
  "/feature/zerlal": {
    title: "ZERLAL — Vulnerability & Exploit Intelligence | Aureon",
    description:
      "ZERLAL: fault-tolerant vulnerability scanning, Cyber Kill Chain mapping, and exploit-feasibility analysis.",
  },
  "/feature/zeeion": {
    title: "Zeeion — Trustless AI Arbitration & Forensics | Aureon",
    description:
      "Zeeion: trustless AI arbitration, evidence validation, platform forensics, and workforce optimization.",
  },
  "/feature/aziion": {
    title: "Aziion — Autonomous Trading Intelligence | Aureon",
    description: "Aziion: live trading intelligence on Hyperliquid with 60%-confidence signal gating.",
  },
  "/feature/axrlen": {
    title: "AXRLEN — NEXUS-PRIME Predictive Engine | Aureon",
    description:
      "AXRLEN NEXUS-PRIME: multi-side predictive engine with probabilistic scenarios, timeline divergences, and brain-backed corpora.",
  },
  "/feature/cross": {
    title: "CROSS — 17-Mode Analytical Platform | Aureon",
    description:
      "CROSS: 17 analytical modes, WebM screen recording, micro-expression analysis, and 5-level intelligence hierarchy.",
  },
  "/feature/zaplen": {
    title: "Zaplen — Dual-AI War Scenario Engine | Aureon",
    description: "Zaplen: dual-AI chess-style war scenario engine for adversarial modeling. Admin-only.",
  },
  "/feature/cipher": {
    title: "Cipher — AES-256-GCM Vault Intelligence | Aureon",
    description: "Cipher: end-to-end encrypted vault with AES-256-GCM, chrooted file access, and admin RLS partitions.",
  },
  "/feature/pattern-analysis": {
    title: "Pattern Analysis — Pro Forecasting & Recharts | Aureon",
    description:
      "Pattern Analysis: pro-tier forecasting with Recharts visualizations and pattern-recognition on live data.",
  },
  "/feature/file-scrapper": {
    title: "File Scrapper — Unstructured Document Extraction | Aureon",
    description: "File Scrapper: extract structured intelligence from PDFs, images, and unstructured documents.",
  },
  "/feature/ebook": {
    title: "E-book Generator — Long-Form Content | Aureon",
    description:
      "Generate full e-books from multi-session text uploads with 500-word chapters and AI-generated cover art.",
  },
  "/feature/plugin-marketplace": {
    title: "Plugin Marketplace — Third-Party Integrations | Aureon",
    description: "Live execution engine for third-party plugins and integrations inside Aureon.",
  },
  "/feature/coding-laws": {
    title: "Coding Laws — Aureon's Engineering Doctrine | Aureon",
    description:
      "The Aureon coding laws: production-hardened patterns, session persistence, race-condition discipline, and security defaults.",
  },
  "/feature/memory-center": {
    title: "Memory Center — Persistent AI Context | Aureon",
    description: "Memory Center: persistent context, semantic recall, and cross-session intelligence continuity.",
  },
  "/feature/brains": {
    title: "Brains — Global Knowledge Corpora | Aureon",
    description:
      "Brains: globally addressable knowledge corpora — admin-controlled axrlen_brains and user-scoped brain stacks.",
  },
  "/feature/library": {
    title: "Library — Project Knowledge Management | Aureon",
    description:
      "Library: project folders, intelligence graph, and structured knowledge management for live operations.",
  },
  "/feature/whiteboard-info": {
    title: "Whiteboard — Infinite Canvas Intelligence | Aureon",
    description:
      "Aureon Whiteboard: infinite canvas, Photoshop-style layer stack, snap grids, and intelligence-aware drawing.",
  },
  "/feature/vedic": {
    title: "Vedic Intelligence — Jyotish-Driven Analysis | Aureon",
    description:
      "Vedic Intelligence: Jyotish-driven analytical layer fused with live astronomical and biographical data.",
  },

  // Standalone tools / experiences
  "/vedic-astrology": {
    title: "Vedic Astrology — Live Jyotish Chart Engine | Aureon",
    description:
      "Generate live Vedic astrology charts, dashas, and yogas with precise astronomical computation.",
  },
  "/vedic": {
    title: "Vedic Jyotish — Moon-Driven Transit Forecasts | Aureon",
    description:
      "Aureon Vedic: sidereal Moon transits, house ingresses, and dasha-aware forecasts computed to the minute in your local time.",
  },
  "/zophiel": {
    title: "Zophiel Free — Public OSINT & Truth Engine | Aureon",
    description:
      "Zophiel Free: 30-source OSINT search, veracity scoring, and verified intelligence. Public, no login.",
  },
  "/search": {
    title: "Zophiel Search — Verified OSINT Intelligence | Aureon",
    description: "Search 30+ live OSINT sources with cross-validation and citation-grade veracity scoring.",
  },
  "/axrlen": {
    title: "AXRLEN — Free Predictive AI Engine (BYOK) | Aureon",
    description:
      "AXRLEN is a free predictive intelligence engine. Bring any model key (Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, xAI). 7/7 launch hits.",
  },
  "/ww3": {
    title: "WW3 Tracker — Live Conflict Intelligence | Aureon",
    description: "Live tracker for global conflict signals, sovereign posture changes, and escalation vectors.",
  },
  "/houseofasher-ventures": {
    title: "House of Asher Ventures — Operator-Grade Intelligence",
    description: "House of Asher Ventures: the operator collective behind Aureon and the Zophiel doctrine.",
  },
  "/proj-aureon": {
    title: "Project Aureon — Origin Brief",
    description: "Project Aureon: the origin brief, doctrine, and roadmap of the Aureon intelligence platform.",
  },
  "/whiteboard": {
    title: "Whiteboard — Infinite Intelligence Canvas | Aureon",
    description: "Aureon Whiteboard: infinite canvas with intelligence-aware drawing and snap-grid precision.",
  },
  "/forums": {
    title: "Forums — Aureon Operator Community",
    description: "Aureon Forums: live discussion among operators, analysts, and predictive intelligence builders.",
  },
  "/avapicks": {
    title: "AvaPicks — Curated Intelligence Picks | Aureon",
    description: "AvaPicks: curated daily intelligence picks across markets, geopolitics, and policy.",
  },
  "/openvpn": {
    title: "OpenVPN — Aureon Secure Access",
    description: "OpenVPN setup and configuration for Aureon secure access.",
  },
  "/elite": {
    title: "Elite Suite — Operator-Tier Access | Aureon",
    description: "Aureon Elite Suite: operator-tier tools, restricted modules, and pro intelligence surfaces.",
    noindex: true,
  },
  "/analytics": {
    title: "Analytics — Aureon Internal Telemetry",
    description: "Internal analytics surface for Aureon operators.",
    noindex: true,
  },
  "/unsubscribe": {
    title: "Unsubscribe — Aureon",
    description: "Unsubscribe from Aureon notifications.",
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
