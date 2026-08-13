import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import { ArrowUpRight, Search, SlidersHorizontal } from "lucide-react";

/**
 * /blog — Blog index. Lists every long-form article under /blog/*.
 * As new /blog/<slug> pages are added, register them here so this page,
 * the header dropdown, and the sitemap stay in sync.
 *
 * `published` is a full ISO-8601 datetime (UTC) for AXRLEN-engine posts so
 * the exact generation hour/min/sec is visible. Date-only strings are
 * still supported for legacy posts.
 */

type Post = {
  slug: string;
  title: string;
  dek: string;
  tag: string;
  published: string; // ISO-8601: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ
  readTime: string;
  featured?: boolean;
  pinned?: boolean;
};

export const BLOG_POSTS: Post[] = [
  {
    slug: "/blog/asherin-agent-sovereign-intelligence-layer",
    title: "the asherin agent — a personal sovereign intelligence layer you can download free",
    dek: "104 files, 43 thinking-pattern documents, 16 hook runners, and a doctrine that sits at the root of reasoning instead of on top of the output. full teardown of the package, its self-modification loop, its on-disk operator memory, and its honest limitations — with the whole archive free to download.",
    tag: "Release",
    published: "2026-08-12T02:12:50.000Z",
    readTime: "14 min",
    featured: true,
    pinned: true,
  },
  {
    slug: "/blog/personalities-are-not-thinking-patterns",
    title: "personalities are not thinking patterns",
    dek: "the exact conversion, piece by piece: identity lines become capability text, domain lists become recognition lenses, tier ladders become reasoning budgets, and conduct moves from character morality to forbidden reasoning patterns. with diagrams of both loops.",
    tag: "Method",
    published: "2026-08-11T00:00:00.000Z",
    readTime: "9 min",
    featured: true,

  },
  {
    slug: "/blog/ai-stack-for-indian-startups",
    title: "The AI stack for Indian startups that can't afford to fail",
    dek: "How early-stage founders in India use AI to compete with funded companies at 1/10th the cost. The real bottleneck is not compute or budget, it is instruction overhead.",
    tag: "Founder Notes",
    published: "2026-08-10T00:00:00.000Z",
    readTime: "7 min",
    featured: true,
    pinned: true,
  },
  {
    slug: "/blog/autonomous-intelligence-loop",
    title: "The Autonomous Intelligence Loop — how Asherin researches without being told to",
    dek: "Asherin no longer waits for a tool selection. The loop detects research intent, recalls the memory graph, fans out across collection surfaces, cross-verifies, persists what it proves, and shows the reasoning chain while it works.",
    tag: "Product",
    published: "2026-08-07T00:00:00.000Z",
    readTime: "12 min",
    featured: true,
  },
  {
    slug: "/blog/bulwark-counter-surveillance",
    title: "BULWARK — Bluetooth stalker detection, Wi-Fi sentinel & account-compromise forensics",
    dek: "The counter-surveillance layer: persistent-follower detection across disjoint locations, Wi-Fi network audits with segment neighbours and portal behaviour, and credential-change reconstruction with physics-based VPN assessment.",
    tag: "Security",
    published: "2026-08-06T00:00:00.000Z",
    readTime: "11 min",
    featured: true,
  },
  {
    slug: "/blog/transit-guardian",
    title: "Transit Guardian — rideshare driver checks, trip telemetry & multi-modal travel safety",
    dek: "Plate-anchored driver dossiers before you get in, full-drive telemetry — speeding, swerve, harsh braking, corridor deviation — while you ride, and the same guarantees extended from cars to rail, bus, air, and sea.",
    tag: "Product",
    published: "2026-08-05T00:00:00.000Z",
    readTime: "11 min",
    featured: true,
  },
  {
    slug: "/blog/asherin-maps-find-my",
    title: "Asherin Maps — satellite-first mapping, live traffic cameras, Fast Lane routing & Bluetooth recovery",
    dek: "Satellite by default, a resizable layer tree, 2,700+ live public DOT camera feeds, OSRM fastest-path routing, device-mesh battery and position telemetry, and RSSI-fused recovery rings for lost Bluetooth hardware.",
    tag: "Product",
    published: "2026-08-04T00:00:00.000Z",
    readTime: "10 min",
    featured: true,
  },
  {
    slug: "/blog/cloud-intelligence-suite",
    title: "Cloud Intelligence — turning your inbox, messages and calls into graded intelligence",
    dek: "POSTMARK email header forensics, VOICEPRINT call metadata, SIGNAL unified message comprehension, Meet Vault recordings, and contact dossiers written to professional analytic standards — BLUF, confidence matrix, competing hypotheses, ranked PIRs.",
    tag: "Product",
    published: "2026-08-03T00:00:00.000Z",
    readTime: "13 min",
    featured: true,
  },
  {
    slug: "/blog/asherin-engine-deep-time",
    title: "Asherin Engine — metadata-first search, DEEP TIME retrieval & identifier sweeps",
    dek: "One query becomes sixteen retrieval legs across five time eras. Host-lifespan tracking, PDF metadata extraction, redirect-chain origin forensics, and a deduped 'seen on N surfaces' exposure map for any email or phone number.",
    tag: "Product",
    published: "2026-08-02T00:00:00.000Z",
    readTime: "12 min",
    featured: true,
  },
  
  {
    slug: "/blog/aureon-legal-advisor-multi-jurisdictional",
    title: "Asherin Legal Advisor (LAW Mode) — multi-jurisdictional AI legal research",
    dek: "The July 8, 2026 ship: a per-message LAW toggle in Asherin and Asher that wraps prompts in a strict legal-research directive — hunts modern statutes, colonial carryovers, uncodified common law, and binding precedent across any country, state, or province, and refuses to fabricate citations.",
    tag: "Product",
    published: "2026-07-08T00:00:00.000Z",
    readTime: "8 min",
    featured: true,
  },
  {
    slug: "/blog/code-narrative-quantum-collapse",
    title: "Code-as-Narrative × Quantum Candidate Collapse — sub-60-second bug patches on the cheapest Gemini",
    dek: "How two #HouseOfAsher theories — Code-as-Narrative and Quantum Candidate Collapse — let Asherin patch logical, workflow, and UI bugs in under a minute on gemini-flash-lite, a fix cycle that normally takes 30+ minutes. Three-year jump on the narrative axis, ten-generation jump on the collapse axis. Wired into every Asherin module.",
    tag: "Engineering",
    published: "2026-07-01T00:00:00.000Z",
    readTime: "12 min",
    featured: true,
  },
  {
    slug: "/blog/the-truth-and-reality-of-wars",
    title: "The Truth and Reality of Wars — Occult Scripture, Fiat Slavery, and the Elite Civil War",
    dek: "Wars are scripted. The Bible calls it scripture for a reason. The field manual on how the elite use occultism to direct conflict, why fiat currency is the slave-collar you're conscripted to defend, and why every world war is an elite civil war dressed in flags.",
    tag: "Geopolitics",
    published: "2026-06-24T00:00:00.000Z",
    readTime: "14 min",
    featured: true,
    pinned: true,
  },
  
  {
    slug: "/blog/zaxin-tactical-ble-intelligence",
    title: "Zaxin — Tactical BLE Intelligence, AR HUD & Satellite Recon Inside Asherin",
    dek: "The product briefing for Zaxin — the Web-Bluetooth tactical layer bundled with the Asherin $79 tier. Five-brain stack, Ghost-Recon HUD, Esri satellite recon, AXRLEN BYOK briefs. Includes diagrams and the seven AI fusion theories.",
    tag: "Product",
    published: "2026-06-26T00:00:00.000Z",
    readTime: "11 min",
    featured: true,
  },

  {
    slug: "/blog/elite-corporations-algorithms-vs-axrlen",
    title: "Elite Corporations' Algorithms vs #HouseOfAsher Algorithm — AXRLEN",
    dek: "Aladdin controls the present through markets and satellites. AXRLEN sees the future before it happens. A symbolic comparison of 45/9 versus 74/11.",
    tag: "Analysis",
    published: "2026-06-24T14:00:00.000Z",
    readTime: "5 min",
    featured: true,
  },
  
  {
    slug: "/blog/aureon-pricing-explained",
    title: "Asherin pricing explained — why $18/mo and $79/mo",
    dek: "A field-level breakdown of how Asherin's subscription is built, how it compares to ChatGPT/Claude/Gemini, and where AI pricing is headed through 2027.",
    tag: "Pricing",
    published: "2026-06-19",
    readTime: "11 min",
  },
  
  
  
  
  
  
  
  
  {
    slug: "/blog/ai-vulnerability-scanning-explained",
    title: "AI vulnerability scanning, explained — beyond legacy SAST/DAST",
    dek: "What AI-powered vulnerability scanning actually means, how it differs from legacy SAST/DAST, where it adds real signal, and the named limitations to know before deploying.",
    tag: "Security",
    published: "2026-06-19",
    readTime: "9 min",
  },
  {
    slug: "/blog/vulnerability-chaining-explained",
    title: "Vulnerability chaining, explained — when 3 mediums equal 1 critical",
    dek: "Most critical real-world exploits are 2-4 low or medium findings combined. The anatomy of a chain, why isolated findings miss it, and how AI scanners surface it.",
    tag: "Security",
    published: "2026-06-19",
    readTime: "8 min",
  },
  {
    slug: "/blog/how-ai-predictive-forecasting-works",
    title: "How AI predictive forecasting actually works",
    dek: "Probability, window, signal fusion, verification plan — the four ingredients real forecasts need, and how to evaluate any AI forecasting platform against them.",
    tag: "Predictive",
    published: "2026-06-19",
    readTime: "9 min",
  },
  {
    slug: "/blog/how-we-make-aureon-sound-human",
    title: "How we make Asherin sound so human — the voice stack",
    dek: "A behind-the-scenes look at the layered persona architecture — appraisal, restraint, timing, leakage — that turns a generic model into a voice with weight.",
    tag: "Voice Design",
    published: "2026-07-01",
    readTime: "9 min",
  },
  {
    slug: "/blog/how-aureon-uses-c-seo-research",
    title: "How Asherin uses C-SEO research — practicing what the paper recommends",
    dek: "The C-SEO Bench paper formalized the discipline of ranking inside AI search engines. This is how Asherin's llms.txt, structural markup, and crawler policy implement its findings.",
    tag: "AI Search",
    published: "2026-06-19",
    readTime: "10 min",
  },
  {
    slug: "/blog/sovereign-ai-platforms",
    title: "The 2026 sovereign AI platform landscape",
    dek: "Eight serious platforms, four architecture patterns, and the four-layer test that eliminates 60% of sovereignty claims on first inspection.",
    tag: "Landscape",
    published: "2026-06-19",
    readTime: "11 min",
  },
  {
    slug: "/blog/what-is-ai-osint",
    title: "What is AI OSINT? The analyst's complete guide",
    dek: "The four-stage pipeline, the cross-validation requirement, and how to spot a search wrapper pretending to be AI OSINT.",
    tag: "Guide",
    published: "2026-06-19",
    readTime: "9 min",
  },
  {
    slug: "/blog/ai-without-restrictions",
    title: "AI without restrictions — the operator workflow",
    dek: "Model choice, prompt discipline, refusal-detection, and the three workflow patterns that survive long sessions.",
    tag: "Operator Guide",
    published: "2026-06-19",
    readTime: "8 min",
  },
  {
    slug: "/blog/comparison",
    title: "Asherin vs ChatGPT vs Claude — the honest 2026 comparison",
    dek: "Side-by-side across price, censorship, BYOK, OSINT, IDE, simulation, and privacy. Includes the model-vs-model radar.",
    tag: "Comparison",
    published: "2026-06-14",
    readTime: "9 min",
  },
  {
    slug: "/blog/venice-integration",
    title: "Venice AI integration in Asherin — unfiltered intelligence, zero setup",
    dek: "How Asherin ships Venice's uncensored stack to every operator by default — no key, no account, no monthly subscription.",
    tag: "Integration",
    published: "2026-06-14",
    readTime: "6 min",
  },
];

// Normalize any published string to a full ISO timestamp.
const toIso = (s: string) => (s.includes("T") ? s : `${s}T00:00:00Z`);

const hasTime = (s: string) => s.includes("T");

const fmtDate = (iso: string) =>
  new Date(toIso(iso)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

// Precise hh:mm:ss UTC stamp (e.g. "15:57:54 UTC"). Returns null for date-only posts.
const fmtTime = (iso: string) => {
  if (!hasTime(iso)) return null;
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss} UTC`;
};

const ALL_TAGS = (posts: Post[]) =>
  Array.from(new Set(posts.map((p) => p.tag))).sort();

/** Month-year bucket key, e.g. "August 2026" — used to group the reading feed. */
const fmtBucket = (iso: string) =>
  new Date(toIso(iso)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });

const Blog = () => {
  const [tagFilter, setTagFilter] = useState<string>("All");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [refineOpen, setRefineOpen] = useState<boolean>(false);

  useEffect(() => {
    const id = "blog-index-jsonld";
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Blog",
      name: "Asherin Blog",
      url: "https://asherin.com/blog",
      blogPost: BLOG_POSTS.map((p) => ({
        "@type": "BlogPosting",
        headline: p.title,
        description: p.dek,
        url: `https://asherin.com${p.slug}`,
        datePublished: toIso(p.published),
      })),
    });
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  const tags = useMemo(() => ["All", ...ALL_TAGS(BLOG_POSTS)], []);

  const filtered = useMemo(() => {
    const fromMs = dateFrom ? Date.parse(`${dateFrom}T00:00:00Z`) : -Infinity;
    const toMs = dateTo ? Date.parse(`${dateTo}T23:59:59Z`) : Infinity;
    const q = query.trim().toLowerCase();
    return BLOG_POSTS
      .filter((p) => (tagFilter === "All" ? true : p.tag === tagFilter))
      .filter((p) => {
        const t = Date.parse(toIso(p.published));
        return t >= fromMs && t <= toMs;
      })
      .filter((p) =>
        q
          ? `${p.title} ${p.dek} ${p.tag}`.toLowerCase().includes(q)
          : true,
      )
      .sort((a, b) => {
        const ta = Date.parse(toIso(a.published));
        const tb = Date.parse(toIso(b.published));
        return sort === "newest" ? tb - ta : ta - tb;
      });
  }, [tagFilter, sort, dateFrom, dateTo, query]);

  const pinnedPosts = BLOG_POSTS.filter((p) => p.pinned);
  const livePinned = pinnedPosts.filter((p) => p.tag === "Live Prediction");
  const heroPinned = pinnedPosts.filter((p) => p.tag !== "Live Prediction");
  // One lead story carries the page. The rest of the pinned set becomes a
  // quiet secondary row — three equal gold hero cards was three focal points
  // competing for the same eye, which is no hierarchy at all.
  const lead = heroPinned[0] ?? null;
  const secondaryPinned = heroPinned.slice(1);

  const isFiltering =
    tagFilter !== "All" || sort !== "newest" || !!dateFrom || !!dateTo || !!query.trim();
  const pinnedSlugs = new Set(pinnedPosts.map((p) => p.slug));
  const listed = filtered.filter((p) => !pinnedSlugs.has(p.slug));

  // Group the feed into month buckets so a 30-item list reads as a timeline
  // rather than an undifferentiated wall.
  const buckets = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of listed) {
      const k = fmtBucket(p.published);
      const arr = map.get(k);
      if (arr) arr.push(p);
      else map.set(k, [p]);
    }
    return Array.from(map.entries());
  }, [listed]);

  const resetAll = () => {
    setTagFilter("All");
    setSort("newest");
    setDateFrom("");
    setDateTo("");
    setQuery("");
  };

  return (
    <div className="landing-perf min-h-screen bg-background text-foreground">
      <Header />

      <main className="max-w-5xl mx-auto px-5 sm:px-6 pt-28 pb-24">
        {/* MASTHEAD */}
        <header className="border-b border-border/25 pb-10">
          <p className="text-[10px] font-light tracking-[0.4em] uppercase text-muted-foreground/70">
            Asherin Journal
          </p>
          <h1 className="mt-5 font-display text-5xl sm:text-6xl md:text-7xl font-light tracking-[-0.03em] leading-[0.95] max-w-3xl">
            Field reports from the
            <span className="block italic text-muted-foreground/60">operator stack.</span>
          </h1>
          <div className="mt-7 flex flex-wrap items-end justify-between gap-4">
            <p className="max-w-xl text-sm sm:text-base font-extralight text-muted-foreground leading-[1.75]">
              Long-form comparisons, benchmarks, and intelligence write-ups.
              No fluff, no affiliate links.
            </p>
            <span className="text-[10px] font-light tracking-[0.28em] uppercase text-muted-foreground/60 tabular-nums">
              {BLOG_POSTS.length} entries
            </span>
          </div>
        </header>

        {/* LIVE TICKER — a slim strip, not a card grid. The accent is spent
            here and on the pinned marker only, so it still means something. */}
        {livePinned.length > 0 && (
          <section aria-label="Automated daily predictions" className="mt-8">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-accent/25 bg-accent/[0.04] px-5 py-3.5">
              <span className="inline-flex items-center gap-2 text-[10px] font-light tracking-[0.28em] uppercase text-accent">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                </span>
                Live · 07:00 EST daily
              </span>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {livePinned.map((p) => {
                  const short = p.title.replace(/^AXRLEN\s+/, "").split(" Daily")[0];
                  return (
                    <Link
                      key={p.slug}
                      to={p.slug}
                      className="group inline-flex items-center gap-2 text-sm font-light text-foreground/85 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 rounded"
                    >
                      {short}
                      <ArrowUpRight
                        className="h-3.5 w-3.5 text-muted-foreground/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        strokeWidth={1.5}
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* LEAD STORY */}
        {lead && (
          <section aria-label="Lead article" className="mt-12">
            <Link
              to={lead.slug}
              className="group block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 rounded-2xl"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[10px] font-light tracking-[0.26em] uppercase text-muted-foreground">
                <span className="text-accent">Pinned</span>
                <span aria-hidden className="text-border">/</span>
                <span>{lead.tag}</span>
                <span aria-hidden className="text-border">/</span>
                <time dateTime={toIso(lead.published)}>{fmtDate(lead.published)}</time>
                <span aria-hidden className="text-border">/</span>
                <span>{lead.readTime}</span>
              </div>
              <h2 className="mt-5 font-display text-3xl sm:text-4xl md:text-5xl font-light tracking-[-0.025em] leading-[1.08] text-foreground">
                {lead.title}
              </h2>
              <p className="mt-5 max-w-2xl text-base font-extralight text-muted-foreground leading-[1.8]">
                {lead.dek}
              </p>
              <span className="mt-6 inline-flex items-center gap-2 text-[11px] font-light tracking-[0.24em] uppercase text-foreground/80">
                Read the report
                <ArrowUpRight
                  className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  strokeWidth={1.5}
                />
              </span>
            </Link>
          </section>
        )}

        {/* SECONDARY PINNED */}
        {secondaryPinned.length > 0 && (
          <section aria-label="Also pinned" className="mt-12 border-t border-border/25 pt-8">
            <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              {secondaryPinned.map((p) => (
                <Link
                  key={p.slug}
                  to={p.slug}
                  className="group block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 rounded-xl"
                >
                  <div className="flex flex-wrap items-center gap-x-2.5 text-[9px] font-light tracking-[0.26em] uppercase text-muted-foreground">
                    <span className="text-accent">Pinned</span>
                    <span aria-hidden className="text-border">/</span>
                    <span>{p.tag}</span>
                    <span aria-hidden className="text-border">/</span>
                    <span>{p.readTime}</span>
                  </div>
                  <h3 className="mt-3 text-xl font-light tracking-[-0.015em] leading-snug text-foreground/95 transition-colors group-hover:text-foreground">
                    {p.title}
                  </h3>
                  <p className="mt-2.5 text-sm font-extralight text-muted-foreground leading-relaxed line-clamp-2">
                    {p.dek}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* CONTROLS — search first, chips scroll on one line, the rarely used
            date range hides behind a disclosure instead of shouting. */}
        <section
          aria-label="Filter articles"
          className="mt-14 border-t border-border/25 pt-6"
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
                strokeWidth={1.5}
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the archive"
                aria-label="Search articles"
                className="w-full rounded-full border border-border/40 bg-card/20 py-2 pl-9 pr-4 text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-foreground/40"
              />
            </div>
            <button
              type="button"
              onClick={() => setRefineOpen((v) => !v)}
              aria-expanded={refineOpen}
              className="inline-flex items-center gap-2 rounded-full border border-border/40 px-4 py-2 text-[10px] font-light tracking-[0.24em] uppercase text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
              Refine
            </button>
            <span className="text-[10px] font-light tracking-[0.24em] uppercase text-muted-foreground/70 tabular-nums">
              {filtered.length} matching
            </span>
          </div>

          <div className="mt-4 -mx-5 px-5 sm:mx-0 sm:px-0 overflow-x-auto sm:overflow-visible scrollbar-none">
            <div className="flex w-max sm:w-auto sm:flex-wrap items-center gap-2 pb-1">

              {tags.map((t) => {
                const active = tagFilter === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTagFilter(t)}
                    aria-pressed={active}
                    className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-light tracking-[0.22em] uppercase border transition-colors ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-border/35 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          {refineOpen && (
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-border/30 bg-card/10 px-4 py-3 text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground">
              <label className="flex items-center gap-2">
                <span>From</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="rounded-md border border-border/40 bg-background/60 px-2 py-1 text-foreground outline-none focus:border-foreground/40"
                />
              </label>
              <label className="flex items-center gap-2">
                <span>To</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="rounded-md border border-border/40 bg-background/60 px-2 py-1 text-foreground outline-none focus:border-foreground/40"
                />
              </label>
              <label className="flex items-center gap-2">
                <span>Sort</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
                  className="rounded-md border border-border/40 bg-background/60 px-2 py-1 text-foreground outline-none focus:border-foreground/40"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </label>
              {isFiltering && (
                <button
                  type="button"
                  onClick={resetAll}
                  className="ml-auto text-foreground underline-offset-4 hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
          )}
        </section>

        {/* FEED */}
        {listed.length > 0 ? (
          <section aria-label="All articles" className="mt-10">
            {buckets.map(([bucket, posts]) => (
              <div key={bucket} className="mb-10 last:mb-0">
                <div className="sticky top-20 z-10 -mx-5 mb-1 bg-background/90 px-5 py-2 backdrop-blur-sm sm:mx-0 sm:px-0">
                  <h2 className="text-[10px] font-light tracking-[0.32em] uppercase text-muted-foreground/60">
                    {bucket}
                  </h2>
                </div>
                <ul className="divide-y divide-border/20 border-t border-border/20">
                  {posts.map((p) => {
                    // Midnight-UTC stamps carry no information — they are the
                    // default for date-only posts, so suppress them as noise.
                    const rawTime = fmtTime(p.published);
                    const time = rawTime === "00:00:00 UTC" ? null : rawTime;

                    return (
                      <li key={p.slug}>
                        <Link
                          to={p.slug}
                          className="group -mx-4 flex gap-5 rounded-xl px-4 py-5 transition-colors hover:bg-foreground/[0.025] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 sm:gap-8"
                        >
                          <div className="hidden w-16 shrink-0 pt-1 text-right sm:block">
                            <time
                              dateTime={toIso(p.published)}
                              className="block text-[10px] font-light tracking-[0.16em] uppercase text-muted-foreground/70 tabular-nums"
                            >
                              {fmtDate(p.published).replace(/,.*$/, "")}
                            </time>
                            {time && (
                              <span className="mt-1 block text-[9px] font-light text-muted-foreground/40 tabular-nums">
                                {time.replace(" UTC", "")}
                              </span>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-light tracking-[-0.01em] leading-snug text-foreground/95 transition-colors group-hover:text-foreground sm:text-xl">
                              {p.title}
                            </h3>
                            <p className="mt-2 text-sm font-extralight leading-relaxed text-muted-foreground line-clamp-2">
                              {p.dek}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-x-2.5 text-[9px] font-light tracking-[0.24em] uppercase text-muted-foreground/60">
                              <span>{p.tag}</span>
                              <span aria-hidden className="text-border">/</span>
                              <span>{p.readTime}</span>
                              <span className="sm:hidden" aria-hidden>
                                /
                              </span>
                              <time
                                dateTime={toIso(p.published)}
                                className="sm:hidden"
                              >
                                {fmtDate(p.published)}
                              </time>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-start pt-1">
                            <ArrowUpRight
                              className="h-4 w-4 text-muted-foreground/40 transition-all group-hover:text-foreground group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                              strokeWidth={1.5}
                            />
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>
        ) : (
          <section className="mt-10 rounded-2xl border border-dashed border-border/40 p-14 text-center">
            <p className="text-sm font-extralight text-muted-foreground">
              No articles match these filters.
            </p>
            {isFiltering && (
              <button
                type="button"
                onClick={resetAll}
                className="mt-4 text-[10px] font-light tracking-[0.24em] uppercase text-foreground underline-offset-4 hover:underline"
              >
                Clear filters
              </button>
            )}
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default Blog;

