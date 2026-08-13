import { Link } from "react-router-dom";
import { Twitter, Github } from "lucide-react";
import { useState } from "react";
import houseOfAsherLogo from "@/assets/HouseOfAsher_Flag.png";

interface SiteFooterProps {
  variant?: "full" | "compact";
}

const SiteFooter = ({ variant = "full" }: SiteFooterProps) => {
  const [showHouseLogo, setShowHouseLogo] = useState(false);
  const year = new Date().getFullYear();

  if (variant === "compact") {
    return (
      <footer className="relative z-10 px-6 pb-8 pt-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
            <p className="text-sm font-light tracking-[0.2em] text-foreground">ASHERIN</p>
            <div className="flex items-center gap-x-6 gap-y-2 flex-wrap justify-center">
              <Link to="/" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Home</Link>
              <Link to="/forums" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Forums</Link>
              <Link to="/founder" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Founder</Link>
              <Link to="/updates" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Updates</Link>
              <Link to="/sources" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Sources</Link>
              <Link to="/terms" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
              <Link to="/privacy" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
            </div>
            <p className="text-xs font-extralight tracking-wide text-muted-foreground/50">© {year} Zorak Corp</p>
          </div>
        </div>
      </footer>
    );
  }

  const sections = [
    {
      heading: "Platform",
      links: [
        { to: "/", label: "Home" },
        { to: "/dashboard", label: "Dashboard" },
        { to: "/forums", label: "Forums" },
        { to: "/founder", label: "Founder" },
        { to: "/updates", label: "Updates" },
      ],
    },
    {
      heading: "Glossary",
      links: [
        { to: "/glossary", label: "All terms" },
        { to: "/glossary/sovereign-ai", label: "Sovereign AI" },
        { to: "/glossary/uncensored-ai", label: "Uncensored AI" },
        { to: "/glossary/byok-ai", label: "BYOK AI" },
        { to: "/glossary/digital-gnostic", label: "Digital Gnostic" },
      ],
    },
    {
      heading: "Journal",
      links: [
        { to: "/blog", label: "All articles" },
        { to: "/blog/elite-corporations-algorithms-vs-axrlen", label: "Elite Corporations vs AXRLEN" },
        { to: "/blog/what-is-ai-osint", label: "What is AI OSINT?" },
        { to: "/blog/sovereign-ai-platforms", label: "Sovereign AI landscape" },
        { to: "/blog/ai-without-restrictions", label: "AI without restrictions" },
      ],
    },
    {
      heading: "Intelligence",
      links: [
        { to: "/feature/zophiel", label: "Zophiel OSINT" },
        { to: "/benchmark", label: "Benchmarks" },
      ],
    },
    {
      heading: "Legal",
      links: [
        { to: "/terms", label: "Terms of Service" },
        { to: "/privacy", label: "Privacy Policy" },
      ],
    },
  ];

  return (
    <footer className="relative z-10 px-6 pb-8 pt-24">
      <div className="mx-auto max-w-7xl">
        {/* Hairline divider with center glyph */}
        <div className="relative mb-16 flex items-center justify-center">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/40 to-border/20" />
          <span className="px-6 text-[10px] font-light tracking-[0.4em] text-muted-foreground/60 uppercase">
            Asherin · Zophiel Engine
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-border/40 to-border/20" />
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-border/15 bg-gradient-to-b from-card/40 via-card/20 to-card/5 backdrop-blur-xl">
          {/* Ambient glow */}
          <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-64 w-[80%] rounded-full bg-foreground/[0.03] blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-12 px-8 py-14 sm:px-14 sm:py-16">
            {/* Brand column */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div>
                <h2 className="text-5xl sm:text-6xl font-extralight tracking-[0.18em] text-foreground leading-none">
                  ASHERIN
                </h2>
                <p className="mt-4 text-xs font-extralight leading-relaxed tracking-wide text-muted-foreground max-w-sm">
                  Forensic-grade intelligence platform. Powered by Zorak Corp & House Of Asher — orchestrated by the Zophiel Engine.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <a href="https://x.com/shep_newton" target="_blank" rel="noopener noreferrer" className="group flex h-9 w-9 items-center justify-center rounded-full border border-border/25 bg-card/30 text-muted-foreground transition-all hover:border-foreground/40 hover:text-foreground hover:scale-105" aria-label="X / Twitter — Primary">
                  <Twitter className="h-3.5 w-3.5" />
                </a>
                <a href="https://x.com/aureon_elion" target="_blank" rel="noopener noreferrer" className="group flex h-9 w-9 items-center justify-center rounded-full border border-[hsl(43_90%_60%)]/30 bg-card/30 text-[hsl(43_90%_60%)] transition-all hover:border-[hsl(43_90%_60%)]/60 hover:scale-105" aria-label="X / Twitter — Backup">
                  <Twitter className="h-3.5 w-3.5" />
                </a>
                <a href="https://github.com/ZorakCorp" target="_blank" rel="noopener noreferrer" className="group flex h-9 w-9 items-center justify-center rounded-full border border-border/25 bg-card/30 text-muted-foreground transition-all hover:border-foreground/40 hover:text-foreground hover:scale-105" aria-label="GitHub">
                  <Github className="h-3.5 w-3.5" />
                </a>
                <a href="https://discord.gg/M9hnebRwvk" target="_blank" rel="noopener noreferrer" className="flex h-9 items-center rounded-full border border-border/25 bg-card/30 px-3 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground transition-all hover:border-foreground/40 hover:text-foreground" aria-label="Discord">
                  Discord
                </a>
                <a href="https://bosley.app/" target="_blank" rel="noopener noreferrer" className="flex h-9 items-center rounded-full border border-border/25 bg-card/30 px-3 text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground transition-all hover:border-foreground/40 hover:text-foreground" aria-label="Bosley">
                  Bosley
                </a>
              </div>

              <button
                type="button"
                onClick={() => setShowHouseLogo(true)}
                className="group mt-2 flex items-center gap-3 self-start rounded-xl border border-border/20 bg-card/20 p-2 pr-4 transition-all hover:border-foreground/30 hover:bg-card/40"
                aria-label="View House of Asher emblem"
              >
                <span className="h-8 w-8 overflow-hidden rounded-md border border-border/30 bg-black">
                  <img src={houseOfAsherLogo} alt="House of Asher emblem" className="h-full w-full object-cover transition-transform group-hover:scale-110" />
                </span>
                <span className="text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground group-hover:text-foreground transition-colors">
                  #HouseOfAsher
                </span>
              </button>
            </div>

            {/* Link grid */}
            <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-10">
              {sections.map((section) => (
                <div key={section.heading} className="flex flex-col gap-3">
                  <p className="text-[9px] font-medium tracking-[0.3em] text-foreground/70 uppercase mb-1">
                    {section.heading}
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {section.links.map((link) => (
                      <Link
                        key={link.to + link.label}
                        to={link.to}
                        className="group inline-flex items-center gap-1.5 text-xs font-extralight tracking-wide transition-colors text-muted-foreground hover:text-foreground"
                      >
                        <span className="h-px w-0 bg-current opacity-60 transition-all duration-300 group-hover:w-3" />
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="relative border-t border-border/15 px-8 py-5 sm:px-14">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10px] font-extralight tracking-[0.2em] uppercase text-muted-foreground/60">
                © {year} #HouseOfAsher · Zorak Corp
              </p>
              <p className="text-[10px] font-extralight tracking-[0.2em] uppercase text-muted-foreground/40">
                Founded · Nov 18 2025 · 08:38
              </p>
              <p className="text-[10px] font-extralight tracking-[0.2em] uppercase text-muted-foreground/60">
                All Rights Reserved
              </p>
            </div>
          </div>
        </div>
      </div>

      {showHouseLogo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-xl p-4 sm:p-8 animate-fade-in overflow-y-auto"
          onClick={() => setShowHouseLogo(false)}
          role="dialog"
          aria-modal="true"
          aria-label="House of Asher manifesto"
        >
          {/* Ambient glow */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute left-1/2 top-1/2 h-[80vh] w-[80vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/[0.04] blur-3xl" />
          </div>

          {/* Close */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowHouseLogo(false); }}
            className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border/30 bg-card/40 text-muted-foreground backdrop-blur-md transition-all hover:border-foreground/50 hover:text-foreground"
            aria-label="Close"
          >
            <span className="text-lg leading-none">×</span>
          </button>

          <div
            className="relative animate-scale-in my-auto w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Flag — rounded, no extra frame/black bg */}
            <img
              src={houseOfAsherLogo}
              alt="House of Asher flag"
              className="w-full max-h-[55vh] object-contain rounded-3xl select-none shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)]"
              draggable={false}
            />

            {/* Manifesto */}
            <div className="mt-8 flex flex-col items-center gap-5 text-center px-2">
              <div className="flex items-center gap-3">
                <span className="h-px w-10 bg-border/40" />
                <span className="text-[10px] font-light tracking-[0.4em] uppercase text-muted-foreground/70">
                  a small independent project
                </span>
                <span className="h-px w-10 bg-border/40" />
              </div>

              <h2 className="text-2xl sm:text-3xl font-extralight tracking-[0.2em] uppercase text-foreground">
                #HouseOfAsher
              </h2>

              <p className="max-w-xl text-sm font-light leading-relaxed text-muted-foreground">
                founded by <span className="text-foreground">asher newton</span>, #houseofasher is an
                independent group built around software, research, and shared ideas. our aim is
                to make useful tools, explain the thinking behind them, and keep learning from
                the people who use them.
              </p>

              <p className="max-w-xl text-sm font-light leading-relaxed text-muted-foreground">
                anyone is welcome to follow the work, regardless of origin, status, or
                background. participation does not require a title, pledge, or symbol — only
                curiosity and respect for others.
              </p>

              <p className="text-[10px] font-extralight tracking-[0.3em] uppercase text-muted-foreground/50">
                Close manifesto
              </p>
            </div>
          </div>
        </div>
      )}

    </footer>
  );
};

export default SiteFooter;
