import { useEffect } from "react";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import VedicAstrologyView from "@/components/dashboard/VedicAstrologyView";

const VedicAstrology = () => {
  useEffect(() => {
    document.title = "Vedic Astrology — Free Chart, Dasha & Transit Forecast | Aureon";

    const setMeta = (selector: string, attr: string, value: string, create: () => HTMLElement) => {
      let el = document.querySelector(selector) as HTMLElement | null;
      if (!el) { el = create(); document.head.appendChild(el); }
      el.setAttribute(attr, value);
    };

    setMeta(
      'meta[name="description"]',
      "content",
      "Free sidereal Vedic astrology: birth chart, Vimshottari Dasha, monthly transit forecast with AM/PM timing, wealth vs soulmate sequence.",
      () => { const m = document.createElement("meta"); m.setAttribute("name", "description"); return m; },
    );

    setMeta(
      'link[rel="canonical"]',
      "href",
      `${window.location.origin}/vedic-astrology`,
      () => { const l = document.createElement("link"); l.setAttribute("rel", "canonical"); return l; },
    );
  }, []);

  return (
    <LandingBackground>
      <Header />
      <main className="pt-20 pb-12">
        <div className="max-w-[1400px] mx-auto px-4">
          <header className="mb-6">
            <h1 className="text-3xl md:text-4xl font-extralight tracking-[0.18em] text-foreground/90 uppercase">
              Vedic Astrology
            </h1>
            <p className="mt-2 text-xs tracking-[0.2em] uppercase text-muted-foreground/60">
              Sidereal Charts · Dasha Timelines · Transit Forecasts — Free
            </p>
          </header>
          <div className="rounded-2xl border border-border/[0.08] bg-background/40 backdrop-blur-xl overflow-hidden">
            <VedicAstrologyView />
          </div>
        </div>
      </main>
    </LandingBackground>
  );
};

export default VedicAstrology;
