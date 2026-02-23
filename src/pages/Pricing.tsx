import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import { Check, ArrowRight, Zap, Search, Brain, Code, Shield, Users, Globe, BarChart3, Lock, Server, Cpu, Database, Network, Eye, Newspaper, TrendingUp, ArrowLeft, ScanLine } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect } from "react";

const tiers = [
  {
    id: "aureon",
    name: "AUREON",
    tagline: "AI Intelligence",
    price: "$199",
    period: "/ month",
    description: "Full access to Aureon AI — uncensored, unfiltered. 200 messages per 3-hour window across Chat & IDE. Resets automatically.",
    cta: "Get Aureon Access",
    highlight: false,
    features: [
      "Uncensored AI responses on any topic",
      "200 messages per 3-hour window (Chat + IDE shared)",
      "Aureon IDE — full cloud development environment",
      "Elite coding engine",
      "Zophiel Search Engine",
      "Persistent memory across all sessions",
      "Context intelligence & intent detection",
      "Multi-persona system",
      "Live web search integration",
      "Code Snippets Vault",
      "End-to-end encryption",
      "Data never sold or used for training",
      "Slideshow Generator",
      "PDF Generator",
      "Cancel anytime — one click",
    ],
  },
  {
    id: "pro",
    name: "AUREON PRO",
    tagline: "Full Dashboard Access",
    price: "$740",
    period: "/ month",
    description: "Complete access to every tool in the dashboard — IDE, Google Intelligence, Asha, NOMAD, Predictive Intelligence, and more.",
    cta: "Get Pro Access",
    highlight: false,
    features: [
      "Everything in Aureon — expanded",
      "200 messages per 3-hour window (Chat + IDE shared)",
      "Aureon IDE — full cloud development environment",
      "Google Intelligence Suite — multi-account analysis",
      "Elion / Zohar Toolkit — domain forensics & OSINT",
      "Full Domain Scan — security score + subdomain recon",
      "Predictive Intelligence — AI event forecasting",
      "Imagine To Code — pixel art & SVG editor with AUREON AI",
      "ZALI Design Intelligence Lab",
      "ZALI Community — questions, requests & feature votes",
      "Asha Data Intelligence Platform",
      "NOMAD Public Intelligence Agent",
      "Daily Intelligence Briefings",
      "Intelligence Notebooks with versioning",
      "Team Workspace with RBAC & email invites",
      "Time-Series Intelligence & forecasting",
      "Geospatial analysis & location mapping",
      "Plugin Marketplace (20+ plugins)",
      "Audit Trail for compliance",
      "Entity resolution & relationship mapping",
      "Scenario Simulator & threat modeling",
      "Pattern Analysis Engine",
      "Security Dashboard — WAF, honeypots & threat intel",
      "Company & competitor tracking",
      "Priority model access",
    ],
  },
];
const Pricing = () => {
  useEffect(() => {
    document.title = "Pricing — Aureon | Uncensored AI Intelligence";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Aureon pricing: $199/mo Aureon, $740/mo Pro. No free tier. Full access from day one.");
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
        <div className="mx-auto max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
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

      {/* What's Included Breakdown */}
      <div className="relative z-10 px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-16">
            What Powers Each Tier.
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Brain, label: "Aureon AI", desc: "Uncensored intelligence engine with persistent memory and calibration.", tier: "All tiers" },
              { icon: Code, label: "Elite Coding", desc: "Multi-file architecture, debugging, and production-grade output.", tier: "All tiers" },
              { icon: Shield, label: "End-to-End Encryption", desc: "Every message encrypted. Never stored as training data.", tier: "All tiers" },
              { icon: Search, label: "Zophiel Search", desc: "Privacy-first search with source credibility tiers and page preview.", tier: "All tiers" },
              { icon: Cpu, label: "Aureon IDE", desc: "Full cloud development environment with AI chat, terminals, sessions, undo/redo, and ZIP export.", tier: "All tiers" },
              { icon: Globe, label: "Google Intelligence", desc: "Multi-account Google data analysis — email, calendar, contacts, YouTube, Chrome, and more.", tier: "Pro & Advisor" },
              { icon: TrendingUp, label: "Predictive Intelligence", desc: "AI-powered event forecasting with signal detection and confidence scoring.", tier: "Pro & Advisor" },
              { icon: Code, label: "Imagine To Code", desc: "AI-powered pixel art & SVG editor — draw, upload images, or ask AUREON to design directly on the canvas.", tier: "Pro & Advisor" },
              { icon: Eye, label: "NOMAD OSINT", desc: "Public intelligence agent across 40+ data sources with dossier output.", tier: "Pro & Advisor" },
              { icon: BarChart3, label: "Asha Intelligence", desc: "Full data intelligence platform — ingest, analyze, branch, and visualize.", tier: "Pro & Advisor" },
              { icon: Newspaper, label: "Daily Briefings", desc: "Personalized intelligence briefings delivered every morning.", tier: "Pro & Advisor" },
              { icon: ScanLine, label: "Elion / Zohar Toolkit", desc: "Domain forensics, security scoring, subdomain recon, and full attack surface mapping.", tier: "Pro & Advisor" },
              { icon: Database, label: "Security Dashboard", desc: "WAF, honeypots, threat intelligence feeds, and behavioral analytics.", tier: "Pro & Advisor" },
            ].map(({ icon: Icon, label, desc, tier: tierLabel }) => (
              <div key={label} className={`rounded-xl border p-5 backdrop-blur-md ${tierLabel === "Advisor Only" ? "border-purple-500/15 bg-purple-500/5" : tierLabel === "Pro & Advisor" ? "border-accent/15 bg-accent/5" : "border-border/20 bg-card/30"}`}>
                <div className="flex items-center gap-3 mb-2">
                  <Icon className={`h-5 w-5 ${tierLabel === "Advisor Only" ? "text-purple-400" : tierLabel === "Pro & Advisor" ? "text-accent" : "text-foreground"}`} />
                  <h3 className="text-sm font-light tracking-wide text-foreground">{label}</h3>
                </div>
                <p className="text-xs font-extralight leading-relaxed text-muted-foreground">{desc}</p>
                <div className="mt-3">
                  <span className={`text-[10px] tracking-wider uppercase ${tierLabel === "Advisor Only" ? "text-purple-400/70" : tierLabel === "Pro & Advisor" ? "text-accent/70" : "text-emerald-400/70"}`}>{tierLabel}</span>
                </div>
              </div>
            ))}
          </div>
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
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button className="group flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background hover:bg-foreground/90 transition-all">
                Start With Aureon — $199/mo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button className="group flex items-center gap-2 rounded-xl border border-border/30 bg-card/30 px-8 py-3 text-sm font-light tracking-wide text-foreground hover:bg-card/50 transition-all">
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