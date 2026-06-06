import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import { Check, ArrowRight, Zap, Search, Brain, Code, Shield, Users, Globe, BarChart3, Lock, Server, Cpu, Database, Network, Eye, Newspaper, TrendingUp, ArrowLeft, ScanLine } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { applySeoHead } from "@/lib/seoHead";
import { getPublicPlans, TIER_FEATURE_CARDS } from "@/config/subscriptionPlans";
import TierFeatureTabs from "@/components/subscription/TierFeatureTabs";
import PricingComparisonTable from "@/components/subscription/PricingComparisonTable";
import SiteFooter from "@/components/SiteFooter";

const tiers = getPublicPlans().map(p => ({
  id: p.id,
  name: p.name,
  tagline: p.tagline,
  price: p.price,
  period: p.period,
  description: p.description,
  cta: p.cta,
  highlight: p.highlight,
  features: [...p.featureLabels, ...(p.id === "aureon" ? ["Cancel anytime — one click"] : [])],
}));
const Pricing = () => {
  useEffect(() => {
    applySeoHead({
      title: "Pricing — Aureon | Uncensored AI Intelligence",
      description:
        "Aureon pricing: $47/mo Chat, $199/mo Aureon, $740/mo Pro. No free tier. Full access from day one.",
      path: "/pricing",
    });
    const faqs = [
      { q: "Can I upgrade from Aureon to Pro or Advisor?", a: "Yes. Upgrade anytime from your dashboard. Changes take effect immediately with prorated billing." },
      { q: "What are the message limits?", a: "Unlimited messages on every paid tier. You bring your own AI key, so usage is bound only by your provider's quota." },
      { q: "What payment methods do you accept?", a: "All major credit cards and wire transfers for Advisor. Billing is handled securely — we never store card details." },
      { q: "Can I use my own AI models?", a: "Yes — all tiers support Bring Your Own Key. Connect API keys from Google, OpenAI, Anthropic, Meta, Venice, xAI, Mistral, DeepSeek, or Perplexity and switch models from Settings." },
      { q: "What do Daily Intelligence Briefings include?", a: "Personalized morning reports covering your competitors, industry, key markets, regulatory changes, and news — generated from 100+ sources and delivered in-app." },
    ];
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = "pricing-faq-jsonld";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    });
    document.head.appendChild(ld);
    return () => { document.getElementById("pricing-faq-jsonld")?.remove(); };
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
      <div className="relative z-10 pt-8 pb-16 px-6 text-center">
        <p className="text-sm font-light tracking-[0.3em] text-muted-foreground uppercase mb-4">Pricing</p>
        <h1 className="max-w-3xl mx-auto text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Choose Your Intelligence Level.
        </h1>
        <p className="mt-6 max-w-xl mx-auto text-base font-extralight leading-relaxed text-muted-foreground">
          No free tiers. No data harvesting. You pay for the tool — the tool works for you.
        </p>
      </div>

      {/* Pricing Comparison Table */}
      <div className="relative z-10 px-6 pb-24">
        <div className="mx-auto max-w-7xl">
          <PricingComparisonTable />
        </div>
      </div>

      {/* What's Included — Tier Tabs */}
      <div className="relative z-10 px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12">
            What Powers Each Tier.
          </h2>
          <TierFeatureTabs />
        </div>
      </div>

      {/* Why No Free Tier */}
      <div className="relative z-10 px-6 pb-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-10">
            <Lock className="h-8 w-8 text-foreground mx-auto mb-4" />
            <p className="text-lg font-extralight tracking-wide text-foreground italic">"Why no free tier?"</p>
            <p className="mt-4 text-sm font-extralight leading-relaxed text-muted-foreground">
              Because free tiers turn users into products. Every "free" AI is harvesting your prompts to improve their model. Aureon gives you full access from day one — your data stays yours. That's the only honest model.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="relative z-10 px-6 pb-24">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12">
            Common Questions.
          </h2>
          <div className="space-y-3">
            {[
              { q: "Can I upgrade from Aureon to Pro or Advisor?", a: "Yes. Upgrade anytime from your dashboard. Changes take effect immediately with prorated billing." },
              { q: "What are the message limits?", a: "Unlimited messages on every paid tier. You bring your own AI key, so usage is bound only by your provider's quota." },
              { q: "What payment methods do you accept?", a: "All major credit cards and wire transfers for Advisor. Billing is handled securely — we never store card details." },
              { q: "Can I use my own AI models?", a: "Yes — all tiers support Bring Your Own Key. Connect API keys from Google, OpenAI, Anthropic, Meta, Venice, xAI, Mistral, DeepSeek, or Perplexity and switch models from Settings." },
              { q: "What do Daily Intelligence Briefings include?", a: "Personalized morning reports covering your competitors, industry, key markets, regulatory changes, and news — generated from 100+ sources and delivered in-app." },
              
            ].map(({ q, a }) => (
              <details key={q} className="group rounded-xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden">
                <summary className="flex items-center justify-between px-6 py-4 cursor-pointer text-sm font-light tracking-wide text-foreground list-none">
                  {q}
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                </summary>
                <div className="px-6 pb-5">
                  <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="relative z-10 px-6 pb-16">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md px-8 py-10 sm:px-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground">
              Ready To Use AI That Actually Works For You?
            </h2>
            <p className="mt-4 text-sm font-extralight text-muted-foreground">No free trial. Full access. Day one.</p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
              <button className="group flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-light tracking-wide text-background hover:bg-foreground/90 transition-all">
                Algorithm — $10/mo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button className="group flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-light tracking-wide text-background hover:bg-foreground/90 transition-all">
                Lifetime — $470
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button className="group flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-light tracking-wide text-background hover:bg-foreground/90 transition-all">
                Chat — $47/mo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button className="group flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-light tracking-wide text-background hover:bg-foreground/90 transition-all">
                Aureon — $199/mo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button className="group flex items-center gap-2 rounded-xl border border-border/30 bg-card/30 px-5 py-3 text-sm font-light tracking-wide text-foreground hover:bg-card/50 transition-all">
                Go Pro — $740/mo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter variant="compact" />
    </LandingBackground>
  );
};

export default Pricing;