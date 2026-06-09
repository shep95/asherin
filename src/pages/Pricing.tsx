import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { applySeoHead } from "@/lib/seoHead";
import FreeManifesto from "@/components/FreeManifesto";
import SiteFooter from "@/components/SiteFooter";

const Pricing = () => {
  useEffect(() => {
    applySeoHead({
      title: "Aureon is Free — No Subscriptions, No Paywalls",
      description:
        "Aureon is free to use, forever. No tiers. No paywalls. Built by Asher Newton because corporations should not value money over human life. Donations welcome — Stripe or crypto.",
      path: "/pricing",
    });
  }, []);

  return (
    <LandingBackground>
      <Header />

      <div className="relative z-10 pt-24 px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-light tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
      </div>

      {/* Hero */}
      <div className="relative z-10 pt-8 pb-12 px-6 text-center">
        <p className="text-sm font-light tracking-[0.3em] text-muted-foreground uppercase mb-4">
          Pricing
        </p>
        <h1 className="max-w-3xl mx-auto text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          There is no pricing.
        </h1>
        <p className="mt-6 max-w-xl mx-auto text-base font-extralight leading-relaxed text-muted-foreground">
          Aureon is free. Every module, every engine, every tool — yours from day one.
        </p>
      </div>

      {/* Manifesto + Donation */}
      <div className="relative z-10 px-6 pb-24">
        <FreeManifesto />
      </div>

      <SiteFooter variant="compact" />
    </LandingBackground>
  );
};

export default Pricing;
