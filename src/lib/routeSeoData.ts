// Shared per-route SEO source of truth.
//
// Consumed at runtime by src/components/RouteSeo.tsx and at build time by
// scripts/seoPrerenderPlugin.ts, which bakes these tags into static per-route
// HTML so non-JS crawlers (social previews, plain HTTP fetchers) see them too.
//
// Rules for this file:
//  - only paths that render a real public page live here. A path in this map
//    becomes a physical prerendered index.html, so listing a retired or
//    redirect-only path would manufacture a soft-404 with a marketing title.
//  - titles are short and match the visible page. No category sentences, no
//    keyword stacks, no "operator stack" costume, no Aureon.
//  - descriptions state what the page is, in one plain line.

export const ORIGIN = "https://asherin.com";
export const DEFAULT_OG_IMAGE = "https://asherin.com/og-image.png?v=20260813-stars";

export type SeoEntry = {
  title: string;
  description: string;
  ogType?: "website" | "article" | "product";
  /** ISO date (YYYY-MM-DD) — required for editorial routes so Article JSON-LD is valid. */
  datePublished?: string;
  dateModified?: string;
  noindex?: boolean;
  /** Public page, but deliberately kept out of sitemap.xml. */
  excludeFromSitemap?: boolean;
};

export const ROUTE_SEO: Record<string, SeoEntry> = {
  "/": {
    title: "asherin — look a little closer.",
    description:
      "asherin is a sourced research workspace: chat, asherinx.eng, asherin.maps, asherin.defender, asherin.arvision. $18/mo, $79/mo pro. honest about what it does not know.",
  },

  // --- Product / company ---
  "/pricing": {
    title: "Pricing | asherin",
    description:
      "asherin is $18/mo. asherin pro is $79/mo. monthly, in USD, cancel in one click. enterprise on request.",
  },
  "/software": {
    title: "software | asherin",
    description:
      "the rooms on a seat: chat, asherinx.eng, asherin.maps, asherin.defender, asherin.arvision, library, projects, memory, vault, whiteboard, connect, team. $18/mo, $79/mo pro.",
  },
  "/founder": {
    title: "Founder | asherin",
    description: "asher newton, who built asherin, and the book he wrote alongside it.",
  },
  "/asher": {
    title: "Asher | asherin",
    description: "asher: the shared workspace inside asherin, with encrypted channels and project rooms.",
  },
  "/updates": {
    title: "Updates | asherin",
    description: "what shipped, when it shipped, and what changed with it.",
  },
  "/sources": {
    title: "Sources | asherin",
    description: "the papers, documents and first-party figures asherin cites, each with the date it was checked.",
  },
  "/forums": {
    title: "Forums | asherin",
    description: "open discussion between people using asherin.",
  },

  // --- Legal ---
  "/privacy": {
    title: "Privacy | asherin",
    description: "how asherin stores, encrypts and retains your data, and what you can ask us to delete.",
  },
  "/terms": {
    title: "Terms | asherin",
    description: "the terms of service for using asherin.",
  },
  "/security-policy": {
    title: "Security Policy | asherin",
    description: "how to report a vulnerability in asherin, and what we do when you do.",
  },

  // --- Blog index ---
  "/blog": {
    title: "Blog | asherin",
    description: "long-form write-ups on how the parts of asherin work, and what they cannot do yet.",
  },

  // --- Blog posts ---
  "/blog/venice-integration": {
    title: "Venice AI in asherin",
    description: "how asherin routes traffic through venice ai when you have not brought your own key.",
    ogType: "article",
    datePublished: "2026-06-17",
  },
  "/blog/what-is-ai-osint": {
    title: "What is AI OSINT?",
    description: "the four stages of an osint pipeline, and how to tell one apart from a search wrapper.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/blog/sovereign-ai-platforms": {
    title: "The 2026 sovereign AI landscape",
    description: "four architecture patterns, and the four-layer test for whether a sovereignty claim holds.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/blog/ai-without-restrictions": {
    title: "Working without vendor refusal defaults",
    description: "model choice, prompt discipline, and refusal detection over long sessions.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/blog/elite-corporations-algorithms-vs-axrlen": {
    title: "Institutional algorithms and AXRLEN",
    description: "how large allocation engines model the present, and where a forecasting engine differs.",
    ogType: "article",
    datePublished: "2026-06-24",
  },
  "/blog/aureon-pricing-explained": {
    title: "Why asherin costs $18 and $79",
    description: "the reasoning behind the two subscription tiers, and what each one actually pays for.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/blog/ai-vulnerability-scanning-explained": {
    title: "AI vulnerability scanning, explained",
    description: "signal collection, exploit-path reasoning, false-positive suppression, confidence scoring.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/blog/vulnerability-chaining-explained": {
    title: "Vulnerability chaining, explained",
    description: "how low-severity findings combine into one compromise path, with worked examples.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/blog/how-ai-predictive-forecasting-works": {
    title: "How AI forecasting actually works",
    description: "signal fusion, scenario branching, probability weighting, and why calibration beats confidence.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/blog/how-aureon-uses-c-seo-research": {
    title: "How asherin uses conversational SEO research",
    description: "entity clustering, answer-shaped pages, and measuring citations inside AI answers.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/blog/how-we-make-aureon-sound-human": {
    title: "How we make asherin sound human",
    description: "cadence, specificity, refusal of filler, and the review passes every page survives.",
    ogType: "article",
    datePublished: "2026-07-01",
  },
  "/blog/ai-stack-for-indian-startups": {
    title: "An AI stack for early-stage Indian startups",
    description: "the bottleneck is workflow logic, not compute or budget.",
    ogType: "article",
    datePublished: "2026-08-10",
  },
  "/blog/code-narrative-quantum-collapse": {
    title: "Code-to-narrative and candidate collapse",
    description: "turn a prompt into a narrative, hunt the flaws, then collapse the candidates into one answer.",
    ogType: "article",
    datePublished: "2026-07-01",
  },
  "/blog/the-truth-and-reality-of-wars": {
    title: "The truth and reality of wars",
    description: "incentive maps, resource clocks, and the exhaustion cycles that decide conflicts.",
    ogType: "article",
    datePublished: "2026-06-24",
  },
  "/blog/zaxin-tactical-ble-intelligence": {
    title: "Zaxin and bluetooth signal intelligence",
    description: "what bluetooth low energy noise can and cannot tell you about what is nearby.",
    ogType: "article",
    datePublished: "2026-06-26",
  },
  "/blog/asherin-engine-deep-time": {
    title: "The asherin engine and deep time",
    description: "reading long cycles instead of headlines, and where that reading breaks.",
    ogType: "article",
    datePublished: "2026-08-02",
  },
  "/blog/cloud-intelligence-suite": {
    title: "Cloud intelligence in asherin",
    description: "connecting a google account, and what asherin does with the mail, files and calendar it reads.",
    ogType: "article",
    datePublished: "2026-08-03",
  },
  "/blog/asherin-maps-find-my": {
    title: "asherin maps and finding your own devices",
    description: "how the map layer handles your locations, and who can see them.",
    ogType: "article",
    datePublished: "2026-08-04",
  },
  "/blog/transit-guardian": {
    title: "Transit guardian",
    description: "watching a route while it is being travelled, and what happens when it deviates.",
    ogType: "article",
    datePublished: "2026-08-05",
  },
  "/blog/bulwark-counter-surveillance": {
    title: "Counter-surveillance notes",
    description: "what a browser can legitimately observe about the devices and trackers around it.",
    ogType: "article",
    datePublished: "2026-08-06",
    // Research notes, not a sold product surface — kept out of the sitemap.
    excludeFromSitemap: true,
  },
  "/blog/autonomous-intelligence-loop": {
    title: "The autonomous intelligence loop",
    description: "a loop that collects, checks and revises itself, and where a human still has to sit.",
    ogType: "article",
    datePublished: "2026-08-07",
  },
  "/blog/aureon-legal-advisor-multi-jurisdictional": {
    title: "Multi-jurisdictional legal research in asherin",
    description: "researching statute across jurisdictions without inventing citations.",
    ogType: "article",
    datePublished: "2026-07-08",
  },
  "/blog/asherin-agent-sovereign-intelligence-layer": {
    title: "The asherin agent layer",
    description: "how the agent decides which tool to reach for, and what it refuses to do unattended.",
    ogType: "article",
    datePublished: "2026-08-11",
  },
  "/blog/personalities-are-not-thinking-patterns": {
    title: "Personalities are not thinking patterns",
    description: "why a persona is not a reasoning procedure, and what we replaced ours with.",
    ogType: "article",
    datePublished: "2026-08-12",
  },

  // --- Glossary ---
  "/glossary": {
    title: "Glossary | asherin",
    description: "plain definitions of the terms used across asherin.",
  },
  "/glossary/sovereign-ai": {
    title: "Sovereign AI | asherin glossary",
    description: "a four-layer definition: key, model, refusal, data.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/glossary/uncensored-ai": {
    title: "Uncensored AI | asherin glossary",
    description: "a model whose refusal behaviour is set at the operator layer, not the vendor layer.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/glossary/byok-ai": {
    title: "BYOK AI | asherin glossary",
    description: "bring your own key: how it works, and why it is necessary but not sufficient.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/glossary/digital-gnostic": {
    title: "Digital gnostic | asherin glossary",
    description: "the operator demographic the term describes, and how their tooling differs.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/glossary/operator-stack": {
    title: "Operator stack | asherin glossary",
    description: "the chain an analyst runs end to end: collection, validation, prediction, delivery.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/glossary/zero-day-confidence-scoring": {
    title: "Zero-day confidence scoring | asherin glossary",
    description: "how unverified vulnerability signals are weighted and reported without overstating certainty.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/glossary/predictive-intelligence-ai": {
    title: "Predictive intelligence AI | asherin glossary",
    description: "forecasting from live signals rather than summarising the past, and the calibration test.",
    ogType: "article",
    datePublished: "2026-06-19",
  },
  "/glossary/conversational-seo": {
    title: "Conversational SEO | asherin glossary",
    description: "being cited inside AI answers instead of ranking for blue links.",
    ogType: "article",
    datePublished: "2026-06-19",
  },

  // --- Feature pages ---
  "/feature/zophiel": {
    title: "Zophiel | asherin",
    description: "zophiel cross-checks live sources, scores what it finds, and shows the citations.",
  },
  "/feature/zerlal": {
    title: "ZERLAL | asherin",
    description:
      "zerlal reads dns, tls, headers and subdomains, then matches disclosed versions against public advisory indexes. it does not authenticate or exploit.",
  },
  "/feature/axrlen": {
    title: "AXRLEN | asherin",
    description: "axrlen writes probabilistic forecasts with a stated verification plan.",
  },
  "/feature/byok": {
    title: "BYOK | asherin",
    description: "bring your own key for gemini, openai, claude, groq, deepseek, mistral, xai or openrouter.",
  },
};

// /asher is intentionally NOT skipped — it has an SEO entry and is in the
// sitemap; skipping it let the static homepage canonical leak through and made
// crawlers read /asher as a duplicate of "/".
export const SKIP_PREFIXES = ["/dashboard", "/asher-dashboard"];

/** Public routes that belong in sitemap.xml. */
export function sitemapPaths(): string[] {
  return Object.entries(ROUTE_SEO)
    .filter(([, e]) => !e.noindex && !e.excludeFromSitemap)
    .map(([path]) => path);
}
