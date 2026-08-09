import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import { ArrowUpRight } from "lucide-react";

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
    title: "Asherin Maps — satellite-first mapping, live traffic cameras, Fast Lane routing & Find-My",
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
    slug: "/blog/how-to-break-any-encryption-theory",
    title: "How To Break Any Encryption Theory — Asherin R&D × Asherin",
    dek: "A research narrative on why post-quantum ciphers still fall: not by attacking the math, but by attacking the runtime that renders the ciphertext into the 3D realm. The Key of Solomon as the master-key metaphor for the code layer beneath the screen.",
    tag: "Research",
    published: "2026-07-12T00:00:00.000Z",
    readTime: "11 min",
    featured: true,
    pinned: true,
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
    slug: "/blog/btc-daily-predictions",
    title: "AXRLEN BTC Daily — Live Long/Short Forecast (auto-updated 07:00 EST)",
    dek: "Every morning at 07:00 EST the AXRLEN engine publishes a 24-hour Bitcoin long/short call with entry, stop loss, take profit, and a running win/loss tally. Live BTC price on page.",
    tag: "Live Prediction",
    published: new Date().toISOString(),
    readTime: "Live",
    featured: true,
    pinned: true,
  },
  {
    slug: "/blog/zaxin-tactical-ble-intelligence",
    title: "Zaxin — Tactical BLE Intelligence, AR HUD & Satellite Recon Inside Asherin",
    dek: "The product briefing for Zaxin — the Web-Bluetooth tactical layer bundled with the Asherin $399 tier. Five-brain stack, Ghost-Recon HUD, Esri satellite recon, AXRLEN BYOK briefs. Includes diagrams and the seven AI fusion theories.",
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
    slug: "/blog/the-crypto-dump-october-2026",
    title: "The Crypto Dump — AXRLEN predicts Bitcoin to $44,500 (Oct 12–19, 2026)",
    dek: "AXRLEN's 88%-confidence call on the October 2026 Bitcoin liquidity event: SBC Vedha collision, Mars–Rahu Mahadasha trigger, 92:8 loser-to-winner ratio, and the BlackRock/Vanguard trap-door mechanism. Live BTC at generation: $62,540.",
    tag: "Prediction",
    published: "2026-06-23T16:38:26.000Z",
    readTime: "9 min",
    featured: true,
  },
  {
    slug: "/blog/aureon-pricing-explained",
    title: "Asherin pricing explained — why $18/mo and $399/mo",
    dek: "A field-level breakdown of how Asherin's subscription is built, how it compares to ChatGPT/Claude/Gemini, and where AI pricing is headed through 2027.",
    tag: "Pricing",
    published: "2026-06-19",
    readTime: "11 min",
  },
  {
    slug: "/blog/predictions/russia-ukraine-war-2026-endgame",
    title: "AXRLEN Prediction — Russia–Ukraine 2026 endgame (Korean-style armistice)",
    dek: "AXRLEN forecasts a frozen front and Korean-style armistice within 24 months under the Symmetric Exhaustion Cycle. De facto Donbas/Crimea partition, security guarantees short of NATO, 55% armistice probability.",
    tag: "Prediction",
    published: "2026-06-23T23:30:00.000Z",
    readTime: "8 min",
    featured: true,
  },
  {
    slug: "/blog/predictions/china-taiwan-2026-flashpoint",
    title: "AXRLEN Prediction — China–Taiwan 2026 flashpoint (blockade-first)",
    dek: "AXRLEN forecasts a 72% Taiwan Strait kinetic-crisis probability in 2026 with a PLA blockade-first escalation path. Thucydides–Mahan Convergence, PLA Target 2027 milestone, US deterrence dissonance.",
    tag: "Prediction",
    published: "2026-06-23T23:31:00.000Z",
    readTime: "8 min",
    featured: true,
  },
  {
    slug: "/blog/predictions/israel-iran-2026-shadow-war",
    title: "AXRLEN Prediction — Israel–Iran 2026 shadow war (nuclear 'Hard Test')",
    dek: "AXRLEN forecasts High-Intensity Intermittency and a singular Israeli strike on Iranian nuclear infrastructure. Hezbollah-first sequencing, three-month proxy spike, forced international mediation.",
    tag: "Prediction",
    published: "2026-06-23T23:32:00.000Z",
    readTime: "8 min",
    featured: true,
  },
  {
    slug: "/blog/predictions/peru-2026-keiko-fujimori",
    title: "AXRLEN Prediction — Keiko Fujimori, future president of Peru (2026)",
    dek: "AXRLEN's Zero-Point Field call on the 2026 Peruvian election: Keiko Fujimori (Fuerza Popular) wins the runoff by exhaustion under the Antivoto Paradox. Weighted matrix, three scenarios, 94% polarized-runoff probability.",
    tag: "Prediction",
    published: "2026-06-22T17:00:00.000Z",
    readTime: "7 min",
    featured: true,
  },
  {
    slug: "/blog/predictions/world-cup-2026-group-matches-0625",
    title: "AXRLEN Forecast — World Cup 2026 picks for the 24 June slate",
    dek: "Six 24 June matches: Switzerland 2–1 Canada, Bosnia 3–1 Qatar, Morocco 3–0 Haiti, Brazil 3–1 Scotland, South Korea 2–1 South Africa, Mexico 2–1 Czechia.",
    tag: "Prediction",
    published: "2026-06-23T23:00:00.000Z",
    readTime: "8 min",
    featured: true,
  },
  {
    slug: "/blog/predictions/world-cup-2026-group-matches-0624",
    title: "AXRLEN Deep Dive — World Cup 2026 structural & historical analysis (23 June slate)",
    dek: "Extended breakdown of the four 23 June matches: squad-structure edges and historical-pattern validation behind the Portugal, England, Croatia, and Colombia picks.",
    tag: "Prediction",
    published: "2026-06-23T22:00:00.000Z",
    readTime: "8 min",
    featured: true,
  },
  {
    slug: "/blog/predictions/world-cup-2026-group-matches-0623",
    title: "AXRLEN Forecast — World Cup 2026 picks for the 23 June slate",
    dek: "Portugal over Uzbekistan, England over Ghana, Croatia over Panama, Colombia over DR Congo. Four AXRLEN picks generated 22 June 2026 for the next day's slate.",
    tag: "Prediction",
    published: "2026-06-22T21:00:00.000Z",
    readTime: "7 min",
    featured: true,
  },
  {
    slug: "/blog/predictions/world-cup-2026-group-matches-0622",
    title: "AXRLEN Forecast — World Cup 2026 picks for the 22 June slate",
    dek: "Argentina over Austria, France over Iraq, Norway over Senegal, Algeria over Jordan. Four live AXRLEN picks generated at 12:25 PM EST on 22 June 2026.",
    tag: "Prediction",
    published: "2026-06-22T16:25:00.000Z",
    readTime: "6 min",
    featured: true,
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

const Blog = () => {
  const [tagFilter, setTagFilter] = useState<string>("All");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

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
    return BLOG_POSTS
      .filter((p) => (tagFilter === "All" ? true : p.tag === tagFilter))
      .filter((p) => {
        const t = Date.parse(toIso(p.published));
        return t >= fromMs && t <= toMs;
      })
      .sort((a, b) => {
        const ta = Date.parse(toIso(a.published));
        const tb = Date.parse(toIso(b.published));
        return sort === "newest" ? tb - ta : ta - tb;
      });
  }, [tagFilter, sort, dateFrom, dateTo]);

  const pinnedPosts = BLOG_POSTS.filter((p) => p.pinned);
  const livePinned = pinnedPosts.filter((p) => p.tag === "Live Prediction");
  const heroPinned = pinnedPosts.filter((p) => p.tag !== "Live Prediction");
  const featured = pinnedPosts[0] ?? BLOG_POSTS.find((p) => p.featured) ?? BLOG_POSTS[0];
  const isFiltering =
    tagFilter !== "All" || sort !== "newest" || dateFrom || dateTo;
  const pinnedSlugs = new Set(pinnedPosts.map((p) => p.slug));
  const listed = filtered.filter((p) => !pinnedSlugs.has(p.slug));

  return (
    <div className="landing-perf min-h-screen bg-background text-foreground">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-24 space-y-16">
        {/* HERO */}
        <header className="space-y-6">
          <div className="inline-block px-3 py-1 rounded-full border border-border/40 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground">
            ◈ Asherin Journal
          </div>
          <h1 className="text-5xl sm:text-6xl font-extralight tracking-tight leading-[1.05] max-w-3xl">
            Field reports from the
            <span className="block text-muted-foreground/70">operator stack.</span>
          </h1>
          <p className="max-w-2xl text-base sm:text-lg font-extralight text-muted-foreground leading-relaxed">
            Long-form comparisons, benchmarks, and intelligence write-ups from
            the Asherin team. No fluff, no affiliate links.
          </p>
        </header>

        {/* AUTOMATED LIVE PREDICTIONS — collapsed compact group */}
        {livePinned.length > 0 && (
          <section aria-label="Automated daily predictions" className="space-y-4">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <div>
                <p className="text-[10px] tracking-[0.4em] uppercase text-accent/80 mb-1">
                  ◈ Auto-Updated · 07:00 EST Daily
                </p>
                <h2 className="text-2xl font-light tracking-tight">Automated daily predictions</h2>
              </div>
              <span className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                {livePinned.length} live feeds
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {livePinned.map((p) => {
                const short = p.title.replace(/^AXRLEN\s+/, "").split(" Daily")[0];
                return (
                  <Link
                    key={p.slug}
                    to={p.slug}
                    className="group flex flex-col gap-2 rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-500/[0.06] via-card/30 to-card/20 hover:border-amber-400/70 hover:shadow-[0_0_24px_-8px_rgba(251,191,36,0.35)] p-4 transition-all"
                  >
                    <span className="inline-flex items-center gap-1.5 text-[9px] tracking-[0.2em] uppercase text-amber-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Live
                    </span>
                    <h3 className="text-sm font-light leading-snug text-foreground">{short}</h3>
                    <div className="mt-auto flex items-center justify-between pt-2 border-t border-amber-400/15">
                      <span className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground">24h call</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-all group-hover:text-amber-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.5} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* PINNED POSTS — full hero cards for non-live pinned articles */}
        {heroPinned.length > 0 && (
          <section aria-label="Pinned articles" className="space-y-5">
            {heroPinned.map((featured) => (
              <Link
                key={featured.slug}
                to={featured.slug}
                className="group block rounded-3xl border border-amber-400/50 bg-gradient-to-br from-amber-500/[0.06] via-card/30 to-card/20 hover:border-amber-400/80 shadow-[0_0_40px_-12px_rgba(251,191,36,0.25)] p-8 sm:p-12 transition-all backdrop-blur-sm"
              >
                <div className="grid sm:grid-cols-[1fr_auto] gap-8 items-end">
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center gap-3 text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-400/60 bg-amber-400/10 text-amber-300">
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>
                        Pinned
                      </span>
                      <span>{featured.tag}</span>
                      <span aria-hidden>·</span>
                      <time dateTime={toIso(featured.published)}>
                        {fmtDate(featured.published)}
                        {fmtTime(featured.published) ? ` · ${fmtTime(featured.published)}` : ""}
                      </time>
                      <span aria-hidden>·</span>
                      <span>{featured.readTime}</span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-extralight tracking-tight leading-[1.15] text-foreground group-hover:text-foreground transition-colors">
                      {featured.title}
                    </h2>
                    <p className="text-base font-extralight text-muted-foreground leading-relaxed max-w-2xl">
                      {featured.dek}
                    </p>
                  </div>
                  <div className="flex items-center justify-end">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-foreground/25 text-foreground transition-all group-hover:bg-foreground group-hover:text-background">
                      <ArrowUpRight className="h-5 w-5" strokeWidth={1.5} />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}


        {/* FILTERS */}
        <section aria-label="Filter articles" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {tags.map((t) => {
              const active = tagFilter === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTagFilter(t)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-medium tracking-[0.25em] uppercase border transition-all ${
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/40 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[10px] font-medium tracking-[0.2em] uppercase text-muted-foreground">
            <label className="flex items-center gap-2">
              <span>From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-card/40 border border-border/40 rounded-md px-2 py-1 text-foreground"
              />
            </label>
            <label className="flex items-center gap-2">
              <span>To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-card/40 border border-border/40 rounded-md px-2 py-1 text-foreground"
              />
            </label>
            <label className="flex items-center gap-2">
              <span>Sort</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
                className="bg-card/40 border border-border/40 rounded-md px-2 py-1 text-foreground"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>
            {isFiltering ? (
              <button
                type="button"
                onClick={() => {
                  setTagFilter("All");
                  setSort("newest");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="ml-1 underline-offset-4 hover:underline text-foreground"
              >
                Reset
              </button>
            ) : null}
            <span className="ml-auto">{filtered.length} matching</span>
          </div>
        </section>

        {/* GRID */}
        {listed.length > 0 ? (
          <section aria-label="All articles" className="space-y-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-light tracking-tight">
                {isFiltering ? "Filtered results" : "All articles"}
              </h2>
              <span className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                ◈ {listed.length} shown
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {listed.map((p) => {
                const time = fmtTime(p.published);
                return (
                  <Link
                    key={p.slug}
                    to={p.slug}
                    className="group flex flex-col gap-4 rounded-2xl border border-border/30 bg-card/10 backdrop-blur-sm p-6 transition-all hover:border-foreground/30 hover:bg-card/30"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[9px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                      <span>{p.tag}</span>
                      <span aria-hidden>·</span>
                      <time dateTime={toIso(p.published)}>{fmtDate(p.published)}</time>
                      {time ? (
                        <>
                          <span aria-hidden>·</span>
                          <span className="tabular-nums">{time}</span>
                        </>
                      ) : null}
                    </div>
                    <h3 className="text-lg font-light tracking-tight text-foreground leading-snug flex-1">
                      {p.title}
                    </h3>
                    <p className="text-sm font-extralight text-muted-foreground leading-relaxed line-clamp-3">
                      {p.dek}
                    </p>
                    <div className="flex items-center justify-between pt-2 border-t border-border/20">
                      <span className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground">
                        {p.readTime}
                      </span>
                      <ArrowUpRight
                        className="h-4 w-4 text-muted-foreground transition-all group-hover:text-foreground group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        strokeWidth={1.5}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-border/40 p-12 text-center">
            <p className="text-sm font-extralight text-muted-foreground">
              No articles match these filters.
            </p>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default Blog;
