import { useEffect } from "react";
import SiteFooter from "@/components/SiteFooter";

/**
 * asherin.acatalepsy
 * A private, no-tracking route for acatalepsy research.
 * No analytics or background services execute here.
 */
const AsherinAcatalepsy = () => {
  useEffect(() => {
    document.title = "asherin.acatalepsy";
  }, []);

  return (
    <div className="relative min-h-screen bg-background text-foreground selection:bg-foreground selection:text-background">
      {/* 
        Minimal layout to ensure no background services (like LandingBackground's 
        Ripple or WallpaperSwitcher) are mounted. 
      */}
      <main className="relative z-10 mx-auto max-w-3xl px-6 py-32 sm:py-48">
        <h1 className="font-display text-4xl font-light tracking-tight sm:text-6xl">
          asherin.acatalepsy
        </h1>
        <p className="mt-8 text-lg font-extralight leading-relaxed text-muted-foreground">
          incomprehensibility. the doctrine that human knowledge can never reach 
          to the certainty of truth, but only to probability.
        </p>
        <div className="mt-16 space-y-12">
          <section>
            <h2 className="text-sm font-light uppercase tracking-[0.3em] text-foreground/60">status</h2>
            <p className="mt-4 font-mono text-xs tracking-widest text-muted-foreground">
              [ PRIVACY MODE ACTIVE ]<br />
              [ ANALYTICS EXCLUDED ]<br />
              [ DAEMONS SUSPENDED ]
            </p>
          </section>
        </div>
      </main>
      <div className="relative z-10">
        <SiteFooter />
      </div>
    </div>
  );
};

export default AsherinAcatalepsy;
