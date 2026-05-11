import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Lock, MessageSquare, X, AlertOctagon, ArrowUpRight, Sparkles, Shield, Github } from "lucide-react";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import ZophielEngineView from "@/components/dashboard/ZophielEngineView";
import AureonFreeChat from "@/components/zophiel-free/AureonFreeChat";
import ZophielSourcePulse from "@/components/zophiel-free/ZophielSourcePulse";
import ZophielStatusBar from "@/components/zophiel-free/ZophielStatusBar";

const ZophielFree = () => {
  const [hasSearched, setHasSearched] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // SEO — kept identical to prior version. Title <60, description <160.
  useEffect(() => {
    document.title = "Zophiel Search — Free Private AI Search Engine | Aureon";

    const setMeta = (selector: string, attr: string, value: string, create: () => HTMLElement) => {
      let el = document.querySelector(selector) as HTMLElement | null;
      if (!el) { el = create(); document.head.appendChild(el); }
      el.setAttribute(attr, value);
    };

    setMeta(
      'meta[name="description"]',
      "content",
      "Free private AI search with source-credibility tiers, instant answers, deep research, image OSINT, and intel mapping. No tracking. No login.",
      () => { const m = document.createElement("meta"); m.setAttribute("name", "description"); return m; },
    );

    setMeta(
      'link[rel="canonical"]',
      "href",
      `${window.location.origin}/zophiel`,
      () => { const l = document.createElement("link"); l.setAttribute("rel", "canonical"); return l; },
    );

    const og: Array<[string, string]> = [
      ["og:title", "Zophiel Search — Free Private AI Search Engine"],
      ["og:description", "Source-tier credibility, instant answers, deep research, image OSINT, intel mapping. Zero tracking."],
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

    const tw: Array<[string, string]> = [
      ["twitter:card", "summary_large_image"],
      ["twitter:title", "Zophiel Search — Free Private AI Search"],
      ["twitter:description", "Credibility-ranked search, deep research, image OSINT, intel mapping. Zero tracking."],
    ];
    tw.forEach(([name, content]) => {
      setMeta(
        `meta[name="${name}"]`,
        "content",
        content,
        () => { const m = document.createElement("meta"); m.setAttribute("name", name); return m; },
      );
    });

    const ldId = "zophiel-jsonld";
    document.getElementById(ldId)?.remove();
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = ldId;
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Zophiel Search",
      url: `${window.location.origin}/zophiel`,
      potentialAction: {
        "@type": "SearchAction",
        target: `${window.location.origin}/zophiel?q={query}`,
        "query-input": "required name=query",
      },
    });
    document.head.appendChild(ld);
  }, []);

  // Lock body scroll while drawer is open
  useEffect(() => {
    if (chatOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [chatOpen]);

  return (
    <LandingBackground>
      <Header />

      {/* Status bar — top-right, always visible. Replaces the noisy "Free" pill. */}
      <div className="fixed top-20 right-4 sm:right-6 z-30 animate-fade-in">
        <ZophielStatusBar />
      </div>


      {/* Engine — full-bleed, no tab gymnastics */}
      <main className="relative z-10 pt-24 min-h-screen">
        <h1 className="sr-only">
          Zophiel — Free Private AI Search Engine
        </h1>

        {/* Pre-search hero overlay — sits above the engine's empty state.
            Once the user searches, the engine takes over the full viewport. */}
        {!hasSearched && (
          <div className="pointer-events-none absolute inset-x-0 top-24 z-[5] flex flex-col items-center px-4">
            {/* Aurora glow */}
            <div aria-hidden className="absolute -top-10 left-1/2 -translate-x-1/2 w-[80vw] max-w-[1100px] h-[420px] zophiel-aurora rounded-full" />

            {/* Orbital reticle behind badge */}
            <div className="relative">
              <div aria-hidden className="absolute -inset-3 rounded-full opacity-50">
                <div className="absolute inset-0 rounded-full zophiel-orbit-ring [mask:radial-gradient(circle,transparent_55%,black_56%,black_70%,transparent_71%)]" />
              </div>
              <div className="relative inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/50 backdrop-blur-xl px-3.5 py-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                </span>
                <Sparkles className="h-2.5 w-2.5 text-foreground/70" strokeWidth={1.5} />
                <span className="text-[9px] font-light tracking-[0.4em] text-foreground/70 uppercase">
                  Aureon Intelligence · Live
                </span>
              </div>
            </div>

            <div className="text-center mt-6 relative">
              <h2 className="text-[2.75rem] sm:text-6xl md:text-7xl font-extralight tracking-tight leading-[1.05] zophiel-shimmer-text">
                See what others miss.
              </h2>

              {/* Soft prompt arrow toward the search bar */}
              <div aria-hidden className="mt-8 flex flex-col items-center gap-1.5 opacity-60">
                <div className="h-px w-px rounded-full bg-foreground/40 animate-ping" />
                <div className="text-[8px] font-light tracking-[0.4em] text-muted-foreground/50 uppercase">
                  Ask anything
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="h-[calc(100vh-7rem)]">
          <ZophielEngineView onSearchedChange={setHasSearched} />
        </div>
      </main>

      {/* Ambient source pulse — only pre-search, full width, behind everything */}
      {!hasSearched && (
        <div className="fixed inset-x-0 bottom-24 z-[4] pointer-events-none">
          <ZophielSourcePulse />
          <div className="mt-4 flex items-center justify-center gap-x-6 gap-y-2 text-[10px] font-light tracking-[0.22em] text-muted-foreground/40 uppercase pointer-events-auto">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3 w-3" /> No tracking
            </span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
            <span>Source tiers</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
            <span>Cross-validated</span>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/20" />
            <Link
              to="/pricing"
              className="text-foreground/60 hover:text-foreground underline-offset-4 hover:underline transition-colors"
            >
              Plans
            </Link>
          </div>
        </div>
      )}

      {/* Floating chat trigger — bottom-right, discreet */}
      {!chatOpen && (
        <button
          onClick={() => setChatOpen(true)}
          className="zophiel-sheen group fixed bottom-6 right-20 z-40 inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border border-border/40 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur-xl pl-3 pr-2 py-2 text-[10px] font-light tracking-[0.24em] uppercase text-foreground/85 hover:text-foreground hover:border-foreground/30 transition-all shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] hover:shadow-[0_14px_50px_-10px_rgba(0,0,0,0.8)] hover:-translate-y-0.5"
          aria-label="Open Aureon chat"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <MessageSquare className="h-3.5 w-3.5" strokeWidth={1.5} />
          Talk to Aureon
          <span className="ml-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground/10 group-hover:bg-foreground/20 transition-colors">
            <ArrowUpRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.6} />
          </span>
        </button>
      )}

      {/* Chat drawer — slides in from the right */}
      {chatOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setChatOpen(false)}
            aria-hidden
          />
          <aside
            ref={drawerRef}
            className="fixed inset-y-0 right-0 z-50 w-full sm:w-[28rem] md:w-[32rem] border-l border-border/30 bg-card/80 backdrop-blur-2xl shadow-[0_0_60px_rgba(0,0,0,0.5)] flex flex-col animate-slide-in-right"
            role="dialog"
            aria-label="Aureon chat"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5 text-foreground/70" />
                <span className="text-[10px] font-light tracking-[0.25em] uppercase text-foreground/80">
                  Aureon Chat
                </span>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="rounded-full p-1.5 hover:bg-foreground/10 transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Close chat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AureonFreeChat />
            </div>
          </aside>
        </>
      )}

      {/* Disclaimer footer */}
      <footer className="relative z-10 border-t border-border/20 bg-gradient-to-r from-background/60 via-card/40 to-background/60 backdrop-blur-xl px-4 py-2.5">
        <div className="mx-auto max-w-5xl flex items-center justify-center gap-2 text-center">
          <AlertOctagon className="h-3 w-3 text-foreground/50 shrink-0" />
          <p className="text-[10px] font-light tracking-wide text-foreground/60">
            <span className="font-medium text-foreground/80">#HouseOfAsher</span> isn't responsible for how you use Aureon.
          </p>
        </div>
      </footer>
    </LandingBackground>
  );
};

export default ZophielFree;
