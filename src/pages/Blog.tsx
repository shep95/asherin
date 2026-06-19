import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import { ArrowUpRight } from "lucide-react";

/**
 * /blog — Blog index. Lists every long-form article under /blog/*.
 * As new /blog/<slug> pages are added, register them here so this page,
 * the header dropdown, and the sitemap stay in sync.
 */

type Post = {
  slug: string;          // path under /blog
  title: string;
  dek: string;           // sub-headline
  tag: string;
  published: string;     // YYYY-MM-DD
  readTime: string;
  featured?: boolean;
};

export const BLOG_POSTS: Post[] = [
  {
    slug: "/blog/predictions/ai-regulation-q4-2026",
    title: "AXRLEN Forecast — Why we predict a major AI regulatory decision in Q4 2026",
    dek: "Aureon's predictive engine assigns 72% probability to a major US or EU AI regulatory action between Oct 1 and Dec 15 2026. Methodology, five signals, verification plan.",
    tag: "Prediction",
    published: "2026-06-19",
    readTime: "10 min",
    featured: true,
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

const fmt = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const Blog = () => {
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
        datePublished: p.published,
      })),
    });
    return () => {
      document.getElementById(id)?.remove();
    };
  }, []);

  const featured = BLOG_POSTS.find((p) => p.featured) ?? BLOG_POSTS[0];
  const rest = BLOG_POSTS.filter((p) => p.slug !== featured?.slug);

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

        {/* FEATURED */}
        {featured && (
          <section aria-label="Featured article">
            <Link
              to={featured.slug}
              className="group block rounded-3xl border border-border/30 bg-card/20 backdrop-blur-sm p-8 sm:p-12 transition-all hover:border-foreground/30 hover:bg-card/40"
            >
              <div className="grid sm:grid-cols-[1fr_auto] gap-8 items-end">
                <div className="space-y-5">
                  <div className="flex items-center gap-3 text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                    <span className="px-2 py-0.5 rounded-full border border-foreground/20 text-foreground/80">
                      ◉ Featured
                    </span>
                    <span>{featured.tag}</span>
                    <span aria-hidden>·</span>
                    <time dateTime={featured.published}>{fmt(featured.published)}</time>
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

        {/* GRID */}
        {rest.length > 0 ? (
          <section aria-label="All articles" className="space-y-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl font-light tracking-tight">All articles</h2>
              <span className="text-[10px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                ◈ {BLOG_POSTS.length} total
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {rest.map((p) => (
                <Link
                  key={p.slug}
                  to={p.slug}
                  className="group flex flex-col gap-4 rounded-2xl border border-border/30 bg-card/10 backdrop-blur-sm p-6 transition-all hover:border-foreground/30 hover:bg-card/30"
                >
                  <div className="flex items-center gap-2 text-[9px] font-medium tracking-[0.25em] uppercase text-muted-foreground">
                    <span>{p.tag}</span>
                    <span aria-hidden>·</span>
                    <time dateTime={p.published}>{fmt(p.published)}</time>
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
              ))}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-border/40 p-12 text-center">
            <p className="text-sm font-extralight text-muted-foreground">
              More field reports landing soon.
            </p>
          </section>
        )}
      </main>

      <SiteFooter />
    </div>
  );
};

export default Blog;
