import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import { Check, ArrowRight, Zap, Search, Brain, Code, Shield, Users, Globe, BarChart3, Lock, Server, Cpu, Database, Network, Eye, Newspaper, TrendingUp, ArrowLeft, ScanLine } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect } from "react";
import { getPublicPlans, TIER_FEATURE_CARDS } from "@/config/subscriptionPlans";
import TierFeatureTabs from "@/components/subscription/TierFeatureTabs";

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
    document.title = "Pricing — Aureon | Uncensored AI Intelligence";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Aureon pricing: $47/mo Chat, $199/mo Aureon, $740/mo Pro. No free tier. Full access from day one.");
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
        <h1 className="max-w-3xl mx-auto text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
          Choose Your Intelligence Level.
        </h1>
        <p className="mt-6 max-w-xl mx-auto text-base font-extralight leading-relaxed text-muted-foreground">
          No free tiers. No data harvesting. You pay for the tool — the tool works for you.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="relative z-10 px-6 pb-24">
        <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 items-start">
          {tiers.map((tier) => (
            <div
key={tier.id}
              className={`rounded-2xl border backdrop-blur-md p-8 sm:p-10 transition-all flex flex-col ${
                tier.highlight
                  ? "border-accent/30 bg-accent/5 shadow-[0_0_60px_-15px_hsl(var(--accent)/0.15)]"
                  : "border-border/20 bg-card/30"
              }`}
            >
              {tier.highlight && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 mb-6 w-fit">
                  <Zap className="h-3 w-3 text-accent" />
                  <span className="text-[10px] font-medium tracking-[0.2em] text-accent uppercase">Full Suite</span>
                </div>
              )}

              <p className="text-xs font-light tracking-[0.25em] text-muted-foreground uppercase">{tier.tagline}</p>
              <h2 className="mt-2 text-lg font-light tracking-[0.15em] text-foreground">{tier.name}</h2>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl sm:text-5xl font-extralight tracking-tight text-foreground">{tier.price}</span>
                <span className="text-lg text-muted-foreground font-extralight">{tier.period}</span>
              </div>

              <p className="mt-4 text-sm font-extralight leading-relaxed text-muted-foreground">{tier.description}</p>

              <button
                className={`group mt-8 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-light tracking-wide transition-all ${
                  tier.highlight
                    ? "bg-accent text-accent-foreground hover:bg-accent/90"
                    : "bg-foreground text-background hover:bg-foreground/90"
                }`}
              >
                {tier.cta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>

              <div className="my-8 h-px bg-border/15" />

              <ul className="space-y-3 flex-1">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm font-extralight text-foreground/85">
                    <Check className={`h-4 w-4 mt-0.5 shrink-0 ${tier.highlight ? "text-accent" : "text-emerald-400"}`} />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
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
              { q: "What are the message limits?", a: "Aureon: 200 messages per 3 hours (shared between Chat & IDE). Pro: 200 per 3 hours. All limits reset automatically." },
              { q: "What payment methods do you accept?", a: "All major credit cards and wire transfers for Advisor. Billing is handled securely — we never store card details." },
              { q: "Can I use my own AI models?", a: "Yes — all tiers support Bring Your Own Key. Connect API keys from Google, OpenAI, Anthropic, Meta, Venice, xAI, Mistral, or DeepSeek and switch models from Settings." },
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

      {/* Footer */}
      <footer className="relative z-10 px-6 pb-8 pt-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
            <p className="text-sm font-light tracking-[0.2em] text-foreground">AUREON</p>
            <div className="flex items-center gap-6 flex-wrap justify-center">
              <Link to="/" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Home</Link>
              <Link to="/features" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Features</Link>
              <Link to="/benchmarks" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Benchmarks</Link>
              <Link to="/terms" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
            </div>
            <p className="text-xs font-extralight tracking-wide text-muted-foreground/50">© {new Date().getFullYear()} Zorak Corp</p>
          </div>
        </div>
      </footer>
    </LandingBackground>
  );
};

export default Pricing;