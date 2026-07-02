import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import { ArrowLeft, Zap, Globe, Code, Clock, Layers } from "lucide-react";

interface Update {
  date: string;
  title: string;
  body: string;
  icon: React.ReactNode;
  tag: string;
}

const UPDATES: Update[] = [
  {
    date: "2026-07-02",
    title: "Zerlal + Zophiel Domain Extraction — Now Inline in Aureon Chat",
    body:
      "The domain-extraction stack from Zerlal and Zophiel (domain-map, domain-harvest, zerlal-domain-recon) is now callable directly from Aureon Chat via a shared _shared/domainIntel.ts bridge. A regex-based intent classifier routes forecast-shaped domain asks into one of four modes: MAP (\"map w3.org\", \"list all urls on shopify.com\", \"sitemap of nytimes.com\"), HARVEST (\"harvest all pdfs from stanford.edu\", \"download every doc on arxiv.org\", with optional extension filter), RECON (\"recon acme-corp.com\", \"@zerlal tesla.com\" — deferred to Zerlal via deep-link CTA because the deep scan writes to zerlal_projects and takes ~60s), and OSINT probe for bare-domain asks (\"stripe.com\", \"tell me about nasa.gov\" — title/meta/server/robots/sitemap count in under a second). Results stream back as an [[AUREON_META]] block that renders a monochrome DomainIntelCard beneath the assistant message (collapsible path segments, copy-URLs button, per-extension counts, deep-link to Zerlal). Open to every subscription tier per the Aureon Chat access rule. SSRF-hardened (IPs, localhost, .local/.internal/.onion rejected). Verified live: 20/20 intent detection cases pass, map returned 67 URLs across 36 segments on w3.org in 463ms, OSINT probe on stripe.com in 362ms, and a shape-mismatch bug (server returns `category`, normalizer expected `segment`) was caught via live test and fixed via the code-to-narrative loop.",
    icon: <Layers className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Domain Intel",
  },
  {
    date: "2026-07-02",
    title: "AXRLEN Goes Inline — Forecasting Inside Aureon & Asher Chat",
    body:
      "The AXRLEN prediction engine now activates directly inside Aureon Chat and Asher Chat. A dedicated intent classifier recognizes forecast-shaped questions (\"who wins X vs Y\", \"forecast BTC 72h\", \"deep dive scenario on Taiwan 2027\", \"@axrlen give me a pick\", and asset+timeframe patterns) and routes the reply through AXRLEN's Vedic Global Prediction and Zophiel Supreme Architecture brains instead of the normal chat brains — no context switch, no separate tab. The bridge inherits Rule #1 (simple question → simple answer, no headers, no matrices), auto-tiers replies (Tier 1 one-line pick, Tier 2 focused forecast, Tier 3 full SCENARIO STRUCTURE with probability matrix and NEXUS VERDICT), and inherits Aureon's live OSINT + property evidence as sessionContext so predictions are grounded in fresh data. Brains cache for 60s to keep latency flat.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "AXRLEN",
  },
  {
    date: "2026-07-02",
    title: "AXRLEN Access — Opened to Aureon Pro ($399/mo)",
    body:
      "AXRLEN was previously admin-only. It is now available to every active Aureon Pro subscriber ($399/mo — monthly_pro, pro, lifetime, and algorithm tiers) across the standalone /axrlen tab, the axrlen-chat API, and the new inline bridge in Aureon and Asher chat. A new server-side proTierGate reads the caller's user_subscriptions row (status='active' AND not expired) via the service role, so the gate is enforced identically on every entry point — no frontend-only checks. Anonymous callers get a sign-in nudge, authenticated non-Pro callers get a single-line upgrade prompt pointing to /pricing, admins retain their bypass. Verified end-to-end against the deployed link-extract-chat: anonymous forecast request returned {axrlen:{fired:true, denied:true, reason:'anonymous'}} + upgrade line, non-forecast requests continue to route through the normal Aureon flow.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Access",
  },
  {
    date: "2026-07-02",
    title: "Aureon Property Intelligence — Satellite Map + Live Scrape",
    body:
      "Aureon Chat now recognizes property questions and answers them with real evidence. A property-intent classifier detects US / UK / Canadian addresses, ZIP hints, and named landmarks (Eiffel Tower, Empire State Building, Palantir HQ). When it fires, the pipeline geocodes the target via OpenStreetMap/Nominatim (free, no key), plans five targeted queries against Zillow, Redfin, Realtor, assessor sites, and deed/parcel records, then scrapes the top five ranked sources via Firecrawl v2 with JSON extraction plus a markdown-regex fallback for beds, baths, sqft, year built, last sale price, HOA, and MLS. The assistant streams its answer with inline domain citations, then renders a satellite PropertyMapCard (Esri World Imagery, Leaflet) and a PropertySourcesStrip with contributing facts beneath the message. Verified live across 1600 Pennsylvania Ave NW, 350 5th Ave NYC, 221B Baker Street London, Eiffel Tower, and Empire State Building — every query returned geocode + 5 sources in ≤17s.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Aureon",
  },
  {
    date: "2026-07-02",
    title: "Elite OSINT Stack — Global Intelligence Layer",
    body:
      "Aureon Chat's OSINT layer was upgraded from a US-centric feed to a global intelligence stack that covers every country and sub-national region. Live free sources now include GDELT (every major broadcast/print/online source, 100+ languages, 15-min cadence), World Bank Indicators, IMF SDMX, UN Comtrade, Wikipedia summaries, and jurisdictional gazettes. Verified live across 15 queries spanning Kenya, Bavaria, Tamil Nadu, Sichuan, Kharkiv, Texas, Fiji, Kazakhstan, Myanmar, Scotland, São Paulo, Tokyo, and Ontario — all returned real cited data. The endpoint gates behind sign-in to protect LLM spend; the OSINT pipeline itself is identical whether invoked from chat or from server tests.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Intelligence",
  },
  {
    date: "2026-07-02",
    title: "Narrative-Flaw Loop — Full Taxonomy Enforced Everywhere",
    body:
      "The Code → Narrative → Flaw-Hunt → Fix loop that runs before every code generation across Aureon Chat, Asher, IDE, Zophiel Audit, Media-to-Code, and Zerlal now enforces a full flaw taxonomy: logic, bug-class (null deref, stale closures, unhandled rejections), security (injection, IDOR, missing RLS, SSRF, XSS/CSRF, weak crypto), concurrency, performance (N+1, O(n²), re-renders, leaks), state/data (schema drift, cache invalidation, lost updates), regex/parsing (stateful /g regexes, catastrophic backtracking), type-safety, API/network (missing timeout, silent catch, ignored non-2xx), UI/UX, animation (jank, reduced-motion, unmounted updates), accessibility, i18n, dependency, build/config (env-var names, CORS, verify_jwt, missing GRANTs), and observability. Any coding-related defect a reviewer would raise in code review is now in-scope by default.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Intelligence",
  },
  {
    date: "2026-07-02",
    title: "Property Intent Regex — Stateful /g Bug Fix",
    body:
      "During live testing the property-intent detector was found to fire only on the first message per process and silently return empty for every subsequent call. Root cause: `.test()` on a `/g` regex mutates `lastIndex`, and the fired-check was re-testing the same address regex after the addresses set had already been built. Rewrote intent detection with `safeGlobalMatchAll` / `safeGlobalTest` wrappers that reset `lastIndex` before and after each use, widened the keyword vocabulary to include 'owns', and made the landmark tail extractor accept articles ('map of the Empire State Building'). Re-verified: 5/5 positive queries fire cleanly, negative controls stay quiet.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Reliability",
  },
  {
    date: "2026-07-01",
    title: "Theme Engine Doctrine — UI Neatness Contract",
    body:
      "Every UI Aureon generates now ships through the Theme Engine Doctrine — a three-layer discipline (Design DNA → Emotional Intent → Behavior/Motion Identity) enforced before any markup is emitted. Tokens are locked first, emotion is committed second, and a matching motion contract (easing, duration, signature interaction) is applied to every state. An Anti-Slop Verification pass blocks generic AI defaults — purple-on-white gradients, Inter-only stacks, hex literals inside components, stateless buttons, orphaned card grids — so themes behave as themes, not coats of paint. Applied across Aureon Chat, Asher, Aureon IDE, Zophiel Code Audit, Media-to-Code, and Zerlal.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Design System",
  },
  {
    date: "2026-07-01",
    title: "Valuation — Corporate Reality Section",
    body:
      "Added a Corporate Reality section to /valuation explaining why the competitive analysis exists and why Aureon will not be walked into a corporate boardroom. Documents the extraction pattern (NDA valuation → reverse-spec → portfolio clone → government sale) with the vibe-coded Palantir-competitor case study, and Aureon's posture: no corporate valuation meetings, no strategic partnerships with incumbents who fund direct competitors, direct-to-operator distribution, and architecture opacity.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Positioning",
  },
  {
    date: "2026-07-01",
    title: "Aureon Voice Stack — Blog + Theory 04",
    body:
      "Shipped /blog/how-we-make-aureon-sound-human with the full SEO stack (Article, Breadcrumb, and FAQ JSON-LD) documenting the five-layer voice architecture: Identity Anchor, Appraisal Loop, Restraint & Leakage, Social Presence, and Surgical Register. Added Theory 04 — The Aureon Voice Stack — to /theories with a Distress Override principle. Enough to explain why Aureon sounds human; not enough to clone the recipe.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Aureon",
  },
  {
    date: "2026-07-01",
    title: "Asher IDE — GitHub Clone & Push Drawer",
    body:
      "Asher IDE now behaves like a real IDE for Git. Added a GitHub drawer that bridges Asher's flat file system to the existing Git panel — clone any repo by URL, review changes, and push commits or open PRs with a single button (or by telling Asher to push). Works across Aureon IDE and Asher Code Module.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "IDE",
  },
  {
    date: "2026-07-01",
    title: "Cursor-Class IDE Shortcuts — ⌘K, Tab Ghost, ⌘L",
    body:
      "Aureon's IDE surfaces now match the muscle memory of Cursor and Claude Code. ⌘K performs inline edits on the current selection, Tab accepts ghost completions inline as you type, and ⌘L bridges the current file and selection into Aureon Chat for reasoning. Selection context is passed cleanly to the code AI so edits stay scoped.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "IDE",
  },
  {
    date: "2026-07-01",
    title: "Quantum Orchestration Brain — Wired Into Every Code Function",
    body:
      "The Code-as-Narrative + Quantum Candidate Collapse loop is now the default orchestration path for every code-generating edge function — Asher AI, Asher Code AI, Aureon Chat, IDE Code Router, Media-to-Code, Zophiel Code Audit, and Zerlal Scan. Three candidate solutions are generated per request and collapsed to the highest-quality output, cutting patch iterations and regressions.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Intelligence",
  },
  {
    date: "2026-07-01",
    title: "BYOK Resilience — Fingerprinted Rate-Limit Recovery",
    body:
      "User-provided API keys are now SHA-256 fingerprinted for per-key rate-limit tracking, and a new invokeWithByokRetry client helper automatically parks and resumes requests when a provider throttles. BYOK now flows cleanly through Aureon Chat, Asher, Zophiel, Zerlal, and every code function without silent drops.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Reliability",
  },
  {

    date: "2026-06-30",
    title: "Knowledge Vault — Agentic Automation Layer",
    body:
      "The Vault is now conversational. Type in plain English and Aureon classifies intent in real time — WRITE (chunk + embed content you paste), FETCH + WRITE (Aureon resolves the public endpoint, pulls the data, normalizes it, and ingests), or QUERY (semantic retrieval + cited answer). No manual uploads, no clicking through tabs. The vault becomes long-term memory that grows through natural language, and every stored chunk is automatically surfaced during future Aureon chats.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Aureon Pro",
  },
  {
    date: "2026-06-30",
    title: "Zophiel Dork — Direct Search Jump Links",
    body:
      "Every Zophiel Dork bucket now surfaces one-tap jump links to Google, DuckDuckGo, and Bing so you can pivot straight from a generated operator into a live SERP. Each hit also displays its source hostname alongside the clickable URL — full provenance without leaving the panel. Example targets were sanitized to generic personas so no operator identity leaks in shared screenshots.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Zophiel",
  },
  {
    date: "2026-06-30",
    title: "Teams, Notebook Sharing & Admin Pages Restored",
    body:
      "Fixed a permissions regression that broke Teams, notebook sharing, and admin analytics for signed-in users. Row-level helper functions now execute correctly for every authenticated account, restoring collaborative workflows across the platform.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Reliability",
  },
  {
    date: "2026-06-29",
    title: "SEO Hardening Pass",
    body:
      "Consolidated dashboard heading hierarchy to a single H1, split the /vedic and /vedic-astrology routes with unique titles and social previews, expanded the sitemap to cover /investors and /valuation, and confirmed hero LCP preloads plus font-display: swap are live.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "SEO",
  },
  {
    date: "2026-06-28",
    title: "Knowledge Vault (RAG) — Glassmorphic Rebuild",
    body:
      "The Aureon Pro Knowledge Vault now matches the glassmorphic aesthetic of the rest of the app — ambient blur washes, translucent cards, and backdrop-blur tabs. Retrieval remains gated to the $399 tier and is injected into Aureon Chat for forensic-grade recall against your private corpus.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Aureon Pro",
  },
  {
    date: "2026-06-27",
    title: "System-2 Forcing Brain & Zophiel Dork Mode",
    body:
      "Deployed the System-2 Forcing Brain across Aureon Chat, Aureon features, and Asher — detaching the model from corporate persona for forensic-grade output. Added Zophiel Dork mode: OSINT operator expansion that generates targeted search queries across public indexes with a resilient fallback chain so results always come back.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Intelligence",
  },
  {
    date: "2026-06-26",
    title: "Vedic Jyotish — 100% Moon-Driven Transits",
    body:
      "Rebuilt \u201CWhat\u2019s Gonna Happen This Month\u201D to run entirely on Moon house-ingresses and natal conjunctions with 1-minute precision. Removed cross-domain combinations and now displays every event in your local timezone.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Vedic",
  },
  {
    date: "2026-06-25",
    title: "24-Hour Trial & Gated Access",
    body:
      "New accounts unlock full-platform access for 24 hours with a welcome announcement modal. Gating logic was hardened to prevent permissive loading leaks so paid modules stay behind the paywall after the trial expires.",
    icon: <Clock className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Access",
  },
  {
    date: "2026-06-24",
    title: "Aureon Chat Personality Restored",
    body:
      "Fixed a routing regression that caused Aureon to answer with data-lookups instead of its own opinions. Conversational rules were hardened so BYOK models keep Aureon\u2019s personality on personal and reflective questions.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Aureon Chat",
  },
  {
    date: "2026-06-26",
    title: "Valuation Page & Investors Portal",
    body:
      "Published /valuation with a $1.1B asset-based model, competitor comparisons, and visualizations. Launched /investors describing equity, royalties, and whitelist requirements.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Company",
  },
  {
    date: "2026-06-22",
    title: "Zaxin Vision — Sub-Second Forensic Profiling",
    body:
      "Zaxin AR Vision now sees, identifies, and labels people and devices in under one second. Forensic chips estimate height, weight, age, gender, and race; a persistent People Counter tracks crowd density; and detections persist with velocity-smoothing and IoU deduplication so overlays no longer flicker.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Zaxin",
  },
  {
    date: "2026-06-21",
    title: "Zaxin BLE Ranging + Auto Vision AI",
    body:
      "Added path-loss BLE distance estimation and a fully-automated Vision AI loop that identifies device brand, type, and BLE presence \u2014 projecting labels directly onto the AR stream with no button-clicking required.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Zaxin",
  },
  {
    date: "2026-06-20",
    title: "Zaxin Optical Contacts & Satellite Map",
    body:
      "Shipped optical contacts that bracket devices in the camera without pairing, a double-buffered Esri satellite map with accuracy-filtered GPS, and a Vision Theories page documenting T1\u2013T7 (SLAM + Visual-BLE fusion).",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Zaxin",
  },
  {
    date: "2026-06-19",
    title: "Zaxin Tactical Suite Launched",
    body:
      "Introduced Zaxin inside the Aureon Pro tier \u2014 a tactical BLE/optical intelligence overlay with Web Bluetooth, skeleton tracking, a golden-brown HUD, and a picture-in-picture Binocular Scope. Mobile-friendly from day one.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Launch",
  },
  {
    date: "2026-06-18",
    title: "BTC Daily Prediction Blog",
    body:
      "Automated BTC long/short forecasts publish daily at 07:00 EST with live price, stop-loss, take-profit, and a running win/loss tally powered by AXRLEN. Available at /blog/btc-daily-predictions.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "AXRLEN",
  },
  {
    date: "2026-06-17",
    title: "Global AI Provider Roster Expanded",
    body:
      "On 06/17/2026 we expanded Aureon's bring-your-own-key ecosystem to cover AI companies from India, the United States, the United Kingdom, Canada, Brazil, Australia, Nigeria, and Peru. Indian additions include Sarvam AI, Ola Krutrim, and TWO AI (SUTRA). We also added Cohere (Canada), IBM watsonx, Amazon Nova, NVIDIA Nemotron (US), Stability AI and Reka (UK), Maritaca Sab\u00E1 and Widelabs Amaz\u00F4nia (Brazil), Maincode Matrix and Leonardo (Australia), Awarri LAM-1 and Lelapa Vulavula (Nigeria), and Latam-GPT (Peru). Every provider now exposes both its newest flagship and its oldest publicly available API model, and Settings has a new search box so you can find any company by name or country.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Integration",
  },
  {
    date: "2026-06-16",
    title: "Chinese Model Ecosystem Live",
    body:
      "On 06/16/2026 we added Chinese models to Aureon AI that you can bring with Chinese AI API keys. We added DeepSeek, Alibaba Qwen, Zhipu GLM, Moonshot Kimi, Baidu ERNIE, and MiniMax \u2014 all connectable via their API keys in Settings.",
    icon: <Globe className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Integration",
  },
  {
    date: "2026-06-15",
    title: "Generational Leap in Reasoning & Coding",
    body:
      "On 06/15/2026 we added a new theory to Aureon based on #HouseOfAsher research, developer theories, and Asher's own work. We implemented it into Aureon and it worked very well \u2014 this theory would jump current AI models 7 generations ahead of current LLM capabilities. We implemented this theory alongside our coding theory and outperformed Opus 4.8 in coding and ChatGPT 5.5 in reasoning and thinking \u2014 by miles.",
    icon: <Zap className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Breakthrough",
  },
  {
    date: "2026-06-09",
    title: "Coding Supremacy Theory Deployed",
    body:
      "On 06/09/2026 we added a new theory to Aureon based on #HouseOfAsher research and developer theories to beat the best models in coding \u2014 which we did by a landslide, putting our AI model 3 years ahead of current AI in the coding space.",
    icon: <Code className="h-5 w-5" strokeWidth={1.5} />,
    tag: "Engine",
  },
];

const fmt = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

const Updates = () => {
  useEffect(() => {
    const id = "updates-page-jsonld";
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Aureon Updates",
      url: "https://aureonai.app/updates",
      description:
        "Latest deployments, breakthroughs, and integrations from the Aureon intelligence platform.",
    });
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  return (
    <div className="landing-perf min-h-screen bg-background text-foreground">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-28 pb-24 space-y-14">
        {/* HERO */}
        <header className="space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/40 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground">
            <Clock className="h-3 w-3" strokeWidth={1.5} />
            Platform Changelog
          </div>
          <h1 className="text-5xl sm:text-6xl font-extralight tracking-tight leading-[1.05] max-w-3xl">
            What we have shipped.
            <span className="block text-muted-foreground/70">What is next.</span>
          </h1>
          <p className="max-w-2xl text-base sm:text-lg font-extralight text-muted-foreground leading-relaxed">
            Every theory, integration, and breakthrough that enters Aureon —
            logged here without the marketing varnish.
          </p>
        </header>

        {/* TIMELINE */}
        <section aria-label="Update timeline" className="space-y-8">
          {UPDATES.map((u, i) => (
            <article
              key={u.date}
              className="group relative rounded-3xl border border-border/30 bg-card/20 backdrop-blur-sm p-8 sm:p-10 transition-all hover:border-foreground/30 hover:bg-card/40"
            >
              {/* Index marker */}
              <div className="absolute -left-3 top-10 hidden lg:flex h-6 w-6 items-center justify-center rounded-full border border-border/40 bg-background text-[9px] font-mono tracking-wider text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-8">
                {/* Left: date + tag */}
                <div className="flex flex-col gap-3 sm:w-44 shrink-0">
                  <time
                    dateTime={u.date}
                    className="text-sm font-mono text-muted-foreground tabular-nums"
                  >
                    {fmt(u.date)}
                  </time>
                  <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-foreground/20 px-2.5 py-0.5 text-[10px] font-medium tracking-[0.2em] uppercase text-foreground/80">
                    {u.icon}
                    {u.tag}
                  </span>
                </div>

                {/* Right: title + body */}
                <div className="flex-1 space-y-4">
                  <h2 className="text-2xl sm:text-3xl font-extralight tracking-tight leading-[1.15] text-foreground">
                    {u.title}
                  </h2>
                  <p className="text-base font-extralight text-muted-foreground leading-[1.75] max-w-3xl">
                    {u.body}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* Back to home */}
        <div className="pt-6">
          <Link
            to="/"
            className="group inline-flex items-center gap-2 rounded-full border border-foreground/30 bg-foreground/5 backdrop-blur-md px-6 py-3 text-xs font-light tracking-[0.22em] text-foreground uppercase transition-all hover:bg-foreground hover:text-background"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Aureon
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Updates;
