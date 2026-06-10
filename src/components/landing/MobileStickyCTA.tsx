import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Fixed bottom CTA bar — appears on mobile after the visitor scrolls past the hero.
 * Captures users who scroll without ever returning to the top CTA.
 */
const MobileStickyCTA = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // Show after ~80% of one viewport scrolled (past hero)
      setVisible(window.scrollY > window.innerHeight * 0.8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={`md:hidden fixed inset-x-0 bottom-0 z-[55] pointer-events-none transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
      }`}
    >
      <div
        className="pointer-events-auto mx-3 mb-3 rounded-2xl border border-amber-300/30 bg-background/80 backdrop-blur-xl px-3 py-2.5 flex items-center justify-between gap-3 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.6)]"
        style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
      >
        <div className="min-w-0">
          <div className="text-[10px] font-mono tracking-[0.28em] uppercase text-amber-300/90">
            Aureon · Free
          </div>
          <div className="text-[13px] font-light text-foreground/90 truncate">
            No card. No catch. Start now.
          </div>
        </div>
        <Link
          to="/dashboard"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-amber-400 text-black px-4 py-2.5 text-xs font-semibold tracking-wide hover:bg-amber-300 transition-colors min-h-[44px]"
        >
          Start Free
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
};

export default MobileStickyCTA;
