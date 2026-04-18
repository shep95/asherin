import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Lock, Zap } from "lucide-react";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import ZophielEngineView from "@/components/dashboard/ZophielEngineView";

const ZophielFree = () => {
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    // Title — keyword-front, <60 chars
    document.title = "Zophiel Search — Free Private AI Search Engine | Aureon";

    const setMeta = (selector: string, attr: string, value: string, create: () => HTMLElement) => {
      let el = document.querySelector(selector) as HTMLElement | null;
      if (!el) { el = create(); document.head.appendChild(el); }
      el.setAttribute(attr, value);
    };

    // Description — <160 chars
    setMeta(
      'meta[name="description"]',
      "content",
      "Free private AI search with source-credibility tiers, instant answers, deep research, image geo-location, and Palantir-style intel mapping. No tracking.",
      () => { const m = document.createElement("meta"); m.setAttribute("name", "description"); return m; },
    );

    // Canonical
    setMeta(
      'link[rel="canonical"]',
      "href",
      `${window.location.origin}/zophiel`,
      () => { const l = document.createElement("link"); l.setAttribute("rel", "canonical"); return l; },
    );

    // Open Graph
    const og: Array<[string, string]> = [
      ["og:title", "Zophiel Search — Free Private AI Search Engine"],
      ["og:description", "Source-tier credibility, instant answers, deep research, image OSINT, and intel mapping. No tracking. No login."],
      ["og:type", "website"],
      ["og:url", `${window.location.origin}/zophiel`],
      ["og:site_name", "Aureon"],
    ];
    og.forEach(([property, content]) => {
      setMeta(
        `meta[property="${property}"]`,
        "content",
        content,
        () => { const m = document.createElement("meta"); m.setAttribute("property", property); return m; },
      );
    });

    // Twitter
    const tw: Array<[string, string]> = [
      ["twitter:card", "summary_large_image"],
      ["twitter:title", "Zophiel Search — Free Private AI Search"],
      ["twitter:description", "Credibility-ranked search, deep research, image geo-location, intel mapping. Zero tracking."],
    ];
    tw.forEach(([name, content]) => {
      setMeta(
        `meta[name="${name}"]`,
        "content",
        content,
        () => { const m = document.createElement("meta"); m.setAttribute("name", name); return m; },
      );
    });

    // JSON-LD: WebSite + SearchAction + SoftwareApplication
    const ldId = "zophiel-jsonld";
    document.getElementById(ldId)?.remove();
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = ldId;
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          name: "Zophiel Search",
          url: `${window.location.origin}/zophiel`,
          potentialAction: {
            "@type": "SearchAction",
            target: `${window.location.origin}/zophiel?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        },
        {
          "@type": "SoftwareApplication",
          name: "Zophiel Search Engine",
          applicationCategory: "SearchApplication",
          operatingSystem: "Web",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          description:
            "Free privacy-first AI search engine with source credibility tiers, deep research, image geo-location, and intelligence mapping.",
          featureList: [
            "Source credibility tiers",
            "Instant answer cards",
            "Deep research mode",
            "Image geo-location (Imagine Intelligence)",
            "Palantir-style intel mapping",
            "Privacy-first, zero tracking",
          ],
        },
      ],
    });
    document.head.appendChild(ld);

    return () => {
      document.getElementById(ldId)?.remove();
    };
  }, []);

  // Detect when user has searched by watching the engine's DOM state via a mutation observer on body
  // Simpler: poll localStorage recent searches OR listen to clicks on the form. We use a window event.
  useEffect(() => {
    const handler = () => setHasSearched(true);
    window.addEventListener("zophiel:searched", handler);
    return () => window.removeEventListener("zophiel:searched", handler);
  }, []);

  return (
    <LandingBackground>
      <Header />

      {/* Floating "Free" pill — only shown pre-search, top-right */}
      {!hasSearched && (
        <div className="fixed top-20 right-4 sm:right-6 z-30 animate-fade-in">
          <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 backdrop-blur-md px-3 py-1.5">
            <Sparkles className="h-3 w-3 text-emerald-300" />
            <span className="text-[10px] font-light tracking-[0.15em] text-emerald-200/80 uppercase">
              Free Forever
            </span>
          </div>
        </div>
      )}

      {/* Engine — full-bleed, no box, no border */}
      <main className="relative z-10 pt-16 min-h-screen">
        <div className="h-[calc(100vh-4rem)]">
          <ZophielEngineView onSearchedChange={setHasSearched} />
        </div>
      </main>

      {/* Trust strip — only shown pre-search */}
      {!hasSearched && (
        <section className="relative z-10 px-4 sm:px-6 pb-10 -mt-24 sm:-mt-20 pointer-events-none">
          <div className="mx-auto max-w-3xl">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] font-light tracking-[0.2em] text-muted-foreground/40 uppercase">
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3 w-3" /> No tracking
              </span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
              <span className="inline-flex items-center gap-1.5">
                <Zap className="h-3 w-3" /> Instant answers
              </span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
              <span>Source tiers</span>
              <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
              <span>Intel mapping</span>
            </div>
            <p className="mt-6 text-center text-[10px] font-extralight tracking-[0.2em] text-muted-foreground/40 uppercase pointer-events-auto">
              Want personas, voice, agents, and the full Aureon suite?{" "}
              <Link
                to="/pricing"
                className="text-foreground/70 hover:text-foreground underline-offset-4 hover:underline"
              >
                See plans
              </Link>
            </p>
          </div>
        </section>
      )}
    </LandingBackground>
  );
};

export default ZophielFree;
