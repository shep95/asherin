import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  Moon, Star, Compass, Clock, Layers, TrendingUp,
  ArrowRight, ArrowLeft, Sparkles, Globe2,
} from "lucide-react";

const capabilities = [
  {
    icon: Clock,
    title: "Dasha Timing Intelligence",
    description:
      "Map planetary periods (Mahadasha, Antardasha, Pratyantardasha) onto your real calendar so you know when conditions favor expansion, retreat, contracts, or conflict.",
  },
  {
    icon: Compass,
    title: "Lagna Relationship Engine",
    description:
      "Calibrate decisions against ascendant geometry — house lords, aspects, and yogas — to expose hidden leverage points other strategy tools miss.",
  },
  {
    icon: Layers,
    title: "Wealth & House Analysis",
    description:
      "Domain-specific reads on the 2nd, 5th, 9th, 10th, and 11th houses for capital, intuition, fortune, career, and gains — translated into operating moves.",
  },
  {
    icon: Globe2,
    title: "Global Predictions",
    description:
      "Country, market, and macro-event projections derived from sidereal transits and historical congruence — surfaced as actionable timing windows.",
  },
  {
    icon: TrendingUp,
    title: "Compatibility & Alliances",
    description:
      "Score partnerships, hires, co-founders, and counterparties across personality, timing, and karmic-load axes before you commit.",
  },
  {
    icon: Sparkles,
    title: "Custom Chart Builder",
    description:
      "Build natal, horary, and event charts with sidereal accuracy — instantly cross-referenced against the AUREON intelligence stack.",
  },
];

const FeatureVedic = () => {
  useEffect(() => {
    document.title = "Vedic Strategy — Aureon";
  }, []);

  return (
    <LandingBackground>
      <Header />

      <div className="relative z-10 pt-24 px-6">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-light tracking-wide text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
      </div>

      {/* Hero */}
      <section className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-6 pt-20 text-center">
        <div className="rounded-full border border-border/20 bg-card/30 backdrop-blur-md px-4 py-1.5 mb-8 inline-flex items-center gap-2">
          <Moon className="h-3 w-3 text-foreground/70" />
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">Astro-Temporal Intelligence</span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Vedic Strategy.
          <br />
          <span className="text-muted-foreground">Time the Decision, Not Just the Move.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          A sidereal intelligence layer for Aureon — dasha cycles, lagna analysis, house-by-house
          domain reads, and global predictions fused with the rest of the platform.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link to="/pricing" className="group flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90">
            Get Aureon — $199/mo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link to="/features" className="rounded-xl border border-border/30 px-8 py-3 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/5">
            All Features
          </Link>
        </div>
      </section>

      {/* Capabilities */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">What Vedic Strategy Does</h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 max-w-2xl">
            Six engines, one strategic surface — engineered for operators who want temporal context,
            not horoscopes.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((cap) => (
              <div key={cap.title} className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 transition-all hover:border-border/40 hover:bg-card/30">
                <cap.icon className="h-6 w-6 text-foreground/80 mb-4" />
                <h3 className="text-base font-light tracking-wide text-foreground mb-3">{cap.title}</h3>
                <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{cap.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            Operator Use Cases
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[
              { title: "Capital Allocation", desc: "Identify favorable periods for raises, deployment, and exits using dasha-aligned wealth-house reads." },
              { title: "Negotiation Windows", desc: "Pinpoint when counterparties are structurally weak or open — before scheduling the meeting." },
              { title: "Hiring & Partnerships", desc: "Score compatibility across operator, advisor, and co-founder relationships." },
              { title: "Macro Positioning", desc: "Cross-reference global predictions with your portfolio to anticipate volatility shifts." },
            ].map((uc) => (
              <div key={uc.title} className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 transition-all hover:border-border/40">
                <Star className="h-4 w-4 text-foreground/60 mb-3" />
                <h3 className="text-base font-light tracking-wide text-foreground mb-3">{uc.title}</h3>
                <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
          Strategy With a Time-Axis.
        </h2>
        <p className="text-sm font-extralight text-muted-foreground mb-8">Included in the Aureon $199/mo tier and above.</p>
        <Link to="/pricing" className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90">
          View Plans <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </section>

      <footer className="relative z-10 border-t border-border/10 py-8 text-center">
        <p className="text-xs font-extralight text-muted-foreground/50">© {new Date().getFullYear()} Aureon. All rights reserved.</p>
      </footer>
    </LandingBackground>
  );
};

export default FeatureVedic;
