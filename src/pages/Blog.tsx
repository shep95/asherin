import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ArticleShell from "@/components/seo/ArticleShell";
import { ArticleJsonLd, BreadcrumbJsonLd, FaqJsonLd } from "@/components/seo/SeoJsonLd";
import RelatedLinks from "@/components/seo/RelatedLinks";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import { ArrowUpRight, Search, SlidersHorizontal } from "lucide-react";

/**
 * /blog — Blog index. Lists every long-form article under /blog/*.
 * As new /blog/<slug> pages are added, register them here so this page,
 * the header dropdown, and the sitemap stay in sync.
 *
 * `published` is a full ISO-8601 datetime (UTC) for time-stamped posts so
 * the exact generation hour/min/sec is visible. Date-only strings are
 * still supported for legacy posts.
 */

import { BLOG_POSTS, type BlogPost, getArticleDisclosure } from "@/data/blogCatalog";

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

const ALL_TAGS = (posts: BlogPost[]) => Array.from(new Set(posts.map((p) => p.tag))).sort();

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
    return BLOG_POSTS.filter((p) => (tagFilter === "All" ? true : p.tag === tagFilter))
      .filter((p) => {
        const t = Date.parse(toIso(p.published));
        return t >= fromMs && t <= toMs;
      })
      .filter((p) => (q ? `${p.title} ${p.dek} ${p.tag} ${getArticleDisclosure(p.slug).statusLabel}`.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        const ta = Date.parse(toIso(a.published));
        const tb = Date.parse(toIso(b.published));
        return sort === "newest" ? tb - ta : ta - tb;
      });
  }, [tagFilter, sort, dateFrom, dateTo, query]);

  const pinnedPosts = BLOG_POSTS.filter((p) => p.pinned);
  const heroPinned = pinnedPosts.filter((p) => p.tag !== "Live Prediction");
  // One lead story carries the page. The rest of the pinned set becomes a
  // quiet secondary row — three equal gold hero cards was three focal points
  // competing for the same eye, which is no hierarchy at all.
  const lead = heroPinned[0] ?? null;
  const secondaryPinned = heroPinned.slice(1);

  const isFiltering = tagFilter !== "All" || sort !== "newest" || !!dateFrom || !!dateTo || !!query.trim();
  const pinnedSlugs = new Set(pinnedPosts.map((p) => p.slug));
  const listed = filtered.filter((p) => !pinnedSlugs.has(p.slug));

  // Group the feed into month buckets so a 30-item list reads as a timeline
  // rather than an undifferentiated wall.
  const buckets = useMemo(() => {
    const map = new Map<string, BlogPost[]>();
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
    <div className="journal-surface landing-perf min-h-screen">
      <Header />

      <main className="mx-auto max-w-7xl px-5 pb-24 pt-28 sm:px-8 lg:px-12">
        {/* MASTHEAD */}
        <header className="grid gap-8 border-b journal-rule pb-10 lg:grid-cols-[1fr_22rem] lg:items-end">
          <div>
            <p className="journal-muted text-[10px] font-medium uppercase tracking-[0.4em]">asherin journal</p>
            <h1 className="mt-5 max-w-5xl font-display text-6xl font-normal leading-[0.9] sm:text-7xl lg:text-9xl">
              public notes,<span className="block italic">with boundaries.</span>
            </h1>
          </div>
          <div className="border-l-2 border-foreground pl-5">
            <p className="journal-muted text-sm font-light leading-[1.75]">
              current functions, archived concepts, method notes, and the limits that keep each claim honest.
            </p>
            <span className="text-[10px] font-light tracking-[0.28em] uppercase text-muted-foreground/60 tabular-nums">
              {BLOG_POSTS.length} entries
            </span>
          </div>
        </header>

        {/* LEAD STORY */}
        {lead && (
          <section aria-label="Lead article" className="mt-12">
            <Link
              to={lead.slug}
              className="group grid gap-6 border-b journal-rule pb-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/40 lg:grid-cols-[12rem_1fr]"
            >
              <div className="flex flex-wrap content-start items-center gap-x-3 gap-y-2 text-[10px] font-medium uppercase tracking-[0.26em] journal-muted">
                <span>Lead record</span>
                <span aria-hidden className="text-border">
                  /
                </span>
                <span>{lead.tag}</span>
                <span aria-hidden className="text-border">
                  /
                </span>
                <time dateTime={toIso(lead.published)}>{fmtDate(lead.published)}</time>
                <span aria-hidden className="text-border">
                  /
                </span>
                <span>{lead.readTime}</span>
                <span className="w-full pt-4 text-foreground">{getArticleDisclosure(lead.slug).statusLabel}</span>
              </div>
              <div>
                <h2 className="font-display text-4xl font-normal leading-[1.02] sm:text-5xl lg:text-6xl">{lead.title}</h2>
                <p className="journal-muted mt-5 max-w-2xl text-base font-light leading-[1.8]">{lead.dek}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.24em]">read the record <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" strokeWidth={1.5} /></span>
              </div>
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
                    <span aria-hidden className="text-border">
                      /
                    </span>
                    <span>{p.tag}</span>
                    <span aria-hidden className="text-border">
                      /
                    </span>
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

        {/* CONTROLS, search first, chips scroll on one line, the rarely used
            date range hides behind a disclosure instead of shouting. */}
        <section aria-label="Filter articles" className="mt-14 border-t border-border/25 pt-6">
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
                className="w-full rounded-full border border-foreground/10 bg-foreground/[0.04] backdrop-blur-xl py-2 pl-9 pr-4 text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none transition-colors focus:border-foreground/40"
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
            <div className="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-foreground/10 bg-foreground/[0.03] backdrop-blur-md px-4 py-3 text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground">
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
                  <h3 className="font-display text-2xl font-normal leading-tight sm:text-3xl">
                              {p.title}
                            </h3>
                            <p className="journal-muted mt-2 text-sm font-light leading-relaxed line-clamp-2">
                              {p.dek}
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-x-2.5 text-[9px] font-light tracking-[0.24em] uppercase text-muted-foreground/60">
                              <span>{p.tag}</span>
                              <span aria-hidden className="text-border">
                                /
                              </span>
                              <span>{p.readTime}</span>
                              <span aria-hidden className="text-border">/</span>
                              <span className="text-foreground">{getArticleDisclosure(p.slug).statusLabel}</span>
                              <span className="sm:hidden" aria-hidden>
                                /
                              </span>
                              <time dateTime={toIso(p.published)} className="sm:hidden">
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
            <p className="text-sm font-extralight text-muted-foreground">No articles match these filters.</p>
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

export function PaidSeatFreeDoor() {
  const URL = "https://asherin.com/blog/paid-seat-free-door";
  const TITLE = "the current asherin plans";
  const DEK =
    "asherin is $18 monthly, pro is $79 monthly, team is $39 monthly plus $24 per member with a two-member minimum, and enterprise is custom. saved provider keys are supported; there is no free trial.";
  const PUBLISHED = "2026-08-15";
  const FAQ = [
    {
      q: "is asherin free if i bring my own key?",
      a: "no. saved provider keys are supported, but the current public plans are paid subscriptions and there is no free trial.",
    },
    {
      q: "what are the current individual plans?",
      a: "asherin is $18 per month and asherin pro is $79 per month. the live pricing and checkout pages are authoritative if this dated article differs.",
    },
    {
      q: "what does team cost?",
      a: "team is $39 per month plus $24 per member, with a two-member minimum. enterprise terms are custom.",
    },
  ];
  return (
    <ArticleShell eyebrow="Product" title={TITLE} dek={DEK} publishedLabel="Aug 15 2026" readTime="4 min">
      <ArticleJsonLd
        id="paid-seat-free-door"
        url={URL}
        headline={TITLE}
        description={DEK}
        datePublished={PUBLISHED}
        keywords={["asherin pricing", "bring your own key", "byok", "asherin team", "$18", "$79"]}
      />
      <BreadcrumbJsonLd
        id="paid-seat-free-door"
        items={[
          { name: "Asherin", url: "/" },
          { name: "Blog", url: "/blog" },
          { name: TITLE, url: "/blog/paid-seat-free-door" },
        ]}
      />
      <h2>the plans</h2>
      <p>
        asherin is $18 per month. asherin pro is $79 per month. team is $39 per month plus $24 per member, with a two-member minimum. enterprise terms are custom.
      </p>
      <h2>saved provider keys</h2>
      <p>
        you can save compatible provider keys and select supported models. provider availability, modality support, and policy can change, so the live model picker is the current source of truth.
      </p>
      <h2>the boundary</h2>
      <p>
        there is no free trial. a subscription does not override provider limits or make every external source available. the live pricing and checkout pages control if this dated article ever differs.
      </p>
      <FaqJsonLd id="paid-seat-free-door" items={FAQ} />
      <RelatedLinks
        heading="related"
        links={[
          {
            to: "/for",
            label: "who asherin is for",
            description: "five desks. one public-index look. first click is look.",
          },
          { to: "/pricing", label: "pricing", description: "individual, team, and enterprise plans." },
          { to: "/software", label: "software", description: "the current public room catalogue." },
        ]}
      />
    </ArticleShell>
  );
}
