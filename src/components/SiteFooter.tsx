import { Link } from "react-router-dom";
import { useState } from "react";
import houseOfAsherLogo from "@/assets/HouseOfAsher_Flag.png";

interface SiteFooterProps {
  variant?: "full" | "compact";
}

const LINKS = [
  { to: "/", label: "asherin" },
  { to: "/pricing", label: "pricing" },
  { to: "/forums", label: "forums" },
  { to: "/founder", label: "founder" },
  { to: "/blog", label: "blog" },
  { to: "/privacy", label: "privacy" },
  { to: "/terms", label: "terms" },
];

const SOCIALS = [
  { href: "https://x.com/shep_newton", label: "x" },
  { href: "https://www.instagram.com/asher_united", label: "instagram" },
  { href: "https://www.linkedin.com/in/asher-newton", label: "linkedin" },
  { href: "https://discord.gg/M9hnebRwvk", label: "discord" },
];

const SiteFooter = ({ variant = "full" }: SiteFooterProps) => {
  const [showHouseLogo, setShowHouseLogo] = useState(false);
  const year = new Date().getFullYear();

  return (
    <footer className={`relative z-10 px-6 pb-10 ${variant === "compact" ? "pt-6" : "pt-16"}`}>
      <div className="mx-auto max-w-5xl">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-border/40 to-transparent" />

        <div className="flex flex-col gap-6 pt-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-3">
            <p className="text-sm font-extralight tracking-[0.28em] text-foreground">asherin</p>
            <p className="max-w-xs text-xs font-extralight leading-relaxed text-muted-foreground">
              a small independent project. chat with sources, files, maps, and a vault, and
              honest about what it does not know.
            </p>
            <button
              type="button"
              onClick={() => setShowHouseLogo(true)}
              className="mt-1 flex items-center gap-2.5 self-start text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground transition-colors hover:text-foreground"
              aria-label="View House of Asher note"
            >
              <span className="h-6 w-6 overflow-hidden rounded-md border border-border/30 bg-black">
                <img src={houseOfAsherLogo} alt="House of Asher emblem" className="h-full w-full object-cover" />
              </span>
              #houseofasher
            </button>
          </div>

          <nav className="flex flex-wrap gap-x-5 gap-y-2 sm:max-w-sm sm:justify-end" aria-label="Footer">
            {LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="text-xs font-extralight tracking-wide text-muted-foreground transition-colors hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-border/15 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {SOCIALS.map((s) => (
              <a
                key={s.href}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] font-extralight tracking-[0.2em] uppercase text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                {s.label}
              </a>
            ))}
          </div>
          <p className="text-[10px] font-extralight tracking-[0.2em] uppercase text-muted-foreground/50">
            © {year} zorak corp
          </p>
        </div>
      </div>

      {showHouseLogo && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-xl animate-fade-in sm:p-8"
          onClick={() => setShowHouseLogo(false)}
          role="dialog"
          aria-modal="true"
          aria-label="House of Asher note"
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowHouseLogo(false); }}
            className="absolute right-5 top-5 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-border/30 bg-card/40 text-muted-foreground backdrop-blur-md transition-all hover:border-foreground/50 hover:text-foreground"
            aria-label="Close"
          >
            <span className="text-lg leading-none">×</span>
          </button>

          <div className="relative my-auto w-full max-w-3xl animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <img
              src={houseOfAsherLogo}
              alt="House of Asher flag"
              className="max-h-[55vh] w-full select-none rounded-3xl object-contain shadow-[0_40px_120px_-20px_rgba(0,0,0,0.8)]"
              draggable={false}
            />

            <div className="mt-8 flex flex-col items-center gap-5 px-2 text-center">
              <span className="text-[10px] font-light tracking-[0.4em] uppercase text-muted-foreground/70">
                a small independent project
              </span>

              <h2 className="text-2xl font-extralight uppercase tracking-[0.2em] text-foreground sm:text-3xl">
                #houseofasher
              </h2>

              <p className="max-w-xl text-sm font-light leading-relaxed text-muted-foreground">
                founded by <span className="text-foreground">asher newton</span>, #houseofasher is an
                independent group built around software, research, and shared ideas. our aim is
                to make useful tools, explain the thinking behind them, and keep learning from
                the people who use them.
              </p>

              <p className="max-w-xl text-sm font-light leading-relaxed text-muted-foreground">
                anyone is welcome to follow the work, regardless of origin, status, or
                background. participation does not require a title, pledge, or symbol, only
                curiosity and respect for others.
              </p>
            </div>
          </div>
        </div>
      )}
    </footer>
  );
};

export default SiteFooter;
