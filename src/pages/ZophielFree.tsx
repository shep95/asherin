import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Sparkles, Lock, Zap } from "lucide-react";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import ZophielEngineView from "@/components/dashboard/ZophielEngineView";

const ZophielFree = () => {
  useEffect(() => {
    document.title = "Zophiel Search — Free AI Intelligence Engine | Aureon";
    const meta =
      document.querySelector('meta[name="description"]') ||
      (() => {
        const m = document.createElement("meta");
        m.setAttribute("name", "description");
        document.head.appendChild(m);
        return m;
      })();
    meta.setAttribute(
      "content",
      "Free AI-powered search with source-tier credibility, instant answers, deep research, and Palantir-style intel mapping. No tracking. No login.",
    );

    // Canonical
    const linkRel =
      document.querySelector('link[rel="canonical"]') ||
      (() => {
        const l = document.createElement("link");
        l.setAttribute("rel", "canonical");
        document.head.appendChild(l);
        return l;
      })();
    linkRel.setAttribute("href", `${window.location.origin}/zophiel`);
  }, []);

  return (
    <LandingBackground>
      <Header />

      {/* Back link */}
      <div className="relative z-10 pt-24 px-4 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-light tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
      </div>

      {/* Free banner */}
      <section className="relative z-10 px-4 sm:px-6 pt-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 backdrop-blur-md px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 p-2">
                <Sparkles className="h-4 w-4 text-emerald-300" />
              </div>
              <div>
                <p className="text-sm font-light tracking-wide text-foreground">
                  Zophiel Search — <span className="text-emerald-300">Free Forever</span>
                </p>
                <p className="text-[11px] font-extralight text-muted-foreground mt-0.5">
                  Full intelligence engine. No login. No tracking. No profiling.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase">
              <Lock className="h-3 w-3" />
              <span>Private</span>
              <span className="mx-1 h-1 w-1 rounded-full bg-muted-foreground/30" />
              <Zap className="h-3 w-3" />
              <span>AI-Powered</span>
            </div>
          </div>
        </div>
      </section>

      {/* Engine Container — gives it a fixed-ish height inside the landing flow */}
      <section className="relative z-10 px-2 sm:px-6 pt-6 pb-12">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-xl overflow-hidden shadow-2xl">
            <div className="h-[78vh] min-h-[640px]">
              <ZophielEngineView />
            </div>
          </div>

          {/* Capability strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { label: "Instant Answers", desc: "Stocks · Weather · Crypto · Definitions" },
              { label: "Source Tiers", desc: "T1 Primary → T4 Community ranking" },
              { label: "Deep Research", desc: "Multi-pass synthesis with citations" },
              { label: "Intel Map", desc: "Palantir-style entity graph from results" },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-xl border border-border/15 bg-card/20 backdrop-blur-md p-4"
              >
                <p className="text-xs font-light tracking-wide text-foreground">{c.label}</p>
                <p className="text-[10px] font-extralight text-muted-foreground mt-1 leading-relaxed">
                  {c.desc}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-[10px] font-extralight tracking-[0.2em] text-muted-foreground/40 uppercase">
            Want personas, voice, agents, and the full Aureon suite?{" "}
            <Link to="/pricing" className="text-foreground/70 hover:text-foreground underline-offset-4 hover:underline">
              See plans
            </Link>
          </p>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/10 py-8 text-center">
        <p className="text-xs font-extralight text-muted-foreground/50">
          © {new Date().getFullYear()} Aureon. Zophiel Search is free for everyone.
        </p>
      </footer>
    </LandingBackground>
  );
};

export default ZophielFree;
