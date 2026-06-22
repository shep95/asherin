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
};

export const BLOG_POSTS: Post[] = [
  {
    slug: "/blog/aureon-pricing-explained",
    title: "Aureon pricing explained — why $18/mo and $399/mo",
    dek: "A field-level breakdown of how Aureon's subscription is built, how it compares to ChatGPT/Claude/Gemini, and where AI pricing is headed through 2027.",
    tag: "Pricing",
    published: "2026-06-19",
    readTime: "11 min",
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
    slug: "/blog/how-aureon-uses-c-seo-research",
    title: "How Aureon uses C-SEO research — practicing what the paper recommends",
    dek: "The C-SEO Bench paper formalized the discipline of ranking inside AI search engines. This is how Aureon's llms.txt, structural markup, and crawler policy implement its findings.",
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
    title: "Aureon vs ChatGPT vs Claude — the honest 2026 comparison",
    dek: "Side-by-side across price, censorship, BYOK, OSINT, IDE, simulation, and privacy. Includes the model-vs-model radar.",
    tag: "Comparison",
    published: "2026-06-14",
    readTime: "9 min",
  },
  {
    slug: "/blog/venice-integration",
    title: "Venice AI integration in Aureon — unfiltered intelligence, zero setup",
    dek: "How Aureon ships Venice's uncensored stack to every operator by default — no key, no account, no monthly subscription.",
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
      name: "Aureon Blog",
      url: "https://aureonai.app/blog",
      blogPost: BLOG_POSTS.map((p) => ({
        "@type": "BlogPosting",
        headline: p.title,
        description: p.dek,
        url: `https://aureonai.app${p.slug}`,
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

  const featured = BLOG_POSTS.find((p) => p.featured) ?? BLOG_POSTS[0];
  const isFiltering =
    tagFilter !== "All" || sort !== "newest" || dateFrom || dateTo;
  const listed = isFiltering ? filtered : filtered.filter((p) => p.slug !== featured?.slug);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-24 space-y-16">
        {/* HERO */}
        <header className="space-y-6">
          <div className="inline-block px-3 py-1 rounded-full border border-border/40 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground">
            ◈ Aureon Journal
          </div>
          <h1 className="text-5xl sm:text-6xl font-extralight tracking-tight leading-[1.05] max-w-3xl">
            Field reports from the
            <span className="block text-muted-foreground/70">operator stack.</span>
          </h1>
          <p className="max-w-2xl text-base sm:text-lg font-extralight text-muted-foreground leading-relaxed">
            Long-form comparisons, benchmarks, and intelligence write-ups from
            the Aureon team. No fluff, no affiliate links.
          </p>
        </header>

        {/* FEATURED (hidden while user is actively filtering) */}
        {featured && !isFiltering && (
          <section aria-label="Featured article">
            <Link
              to={featured.slug}
              className="group block rounded-3xl border border-border/30 bg-card/20 backdrop-blur-sm p-8 sm:p-12 transition-all hover:border-foreground/30 hover:bg-card/40"
            >
              <div className="grid sm:grid-cols-[1fr_auto] gap-8 items-end">
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-3 text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                    <span className="px-2 py-0.5 rounded-full border border-foreground/20 text-foreground/80">
                      ◉ Featured
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
