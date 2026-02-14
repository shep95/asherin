import heroBg from "@/assets/hero-bg.png";
import Header from "@/components/Header";
import { Check, ArrowRight, Zap, Search, Brain, Code, Shield, Users, Globe, BarChart3, Lock, Server, Cpu, Database, Network, Eye } from "lucide-react";
import { Link } from "react-router-dom";

const tiers = [
  {
    id: "aureon",
    name: "AUREON",
    tagline: "AI Intelligence",
    price: "$18",
    period: "/ month",
    description: "Full access to Aureon AI — uncensored, unfiltered, built for individuals who demand the truth.",
    cta: "Get Aureon Access",
    highlight: false,
    features: [
      "Uncensored AI responses on any topic",
      "Elite coding engine — outperforms leading models",
      "Persistent memory across all sessions",
      "Context intelligence & intent detection",
      "Calibration feedback — AI adapts to you",
      "Multi-persona system (Analyst, Strategist, Engineer, Writer)",
      "Live web search integration",
      "Multi-language output",
      "End-to-end encryption",
      "Data never sold or used for training",
      "Cancel anytime — one click",
    ],
  },
  {
    id: "enterprise",
    name: "ZIALIEL ENTERPRISE",
    tagline: "Full Intelligence Suite",
    price: "$5,000",
    period: "/ week",
    description: "The complete intelligence platform. Aureon AI + ZIALIEL Search Engine + backend OSINT tooling + data analysis infrastructure.",
    cta: "Contact For Access",
    highlight: true,
    features: [
      "Everything in Aureon — unlimited",
      "ZIALIEL Search Engine — full deployment",
      "Source credibility intelligence (4-tier system)",
      "Backend OSINT tool for applications",
      "Real-time data analysis pipeline",
      "Custom data extraction & scraping infrastructure",
      "Dedicated intelligence API endpoints",
      "Priority model access — zero queue",
      "Custom persona & workflow engineering",
      "Team workspace — unlimited seats",
      "Private deployment option",
      "24/7 direct engineering support",
      "Custom integrations & white-label licensing",
      "SLA-backed uptime guarantee",
    ],
  },
];

const Pricing = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Background */}
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${heroBg})` }} />
      <div className="fixed inset-0 bg-black/80" />

      <Header />

      {/* Hero */}
      <div className="relative z-10 pt-32 pb-16 px-6 text-center">
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
        <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-2xl border backdrop-blur-md p-8 sm:p-10 transition-all ${
                tier.highlight
                  ? "border-accent/30 bg-accent/5 shadow-[0_0_60px_-15px_hsl(var(--accent)/0.15)]"
                  : "border-border/20 bg-card/30"
              }`}
            >
              {/* Badge */}
              {tier.highlight && (
                <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 mb-6">
                  <Zap className="h-3 w-3 text-accent" />
                  <span className="text-[10px] font-medium tracking-[0.2em] text-accent uppercase">Full Suite</span>
                </div>
              )}

              {/* Tier name */}
              <p className="text-xs font-light tracking-[0.25em] text-muted-foreground uppercase">{tier.tagline}</p>
              <h2 className="mt-2 text-lg font-light tracking-[0.15em] text-foreground">{tier.name}</h2>

              {/* Price */}
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-5xl sm:text-6xl font-extralight tracking-tight text-foreground">{tier.price}</span>
                <span className="text-lg text-muted-foreground font-extralight">{tier.period}</span>
              </div>

              {/* Description */}
              <p className="mt-4 text-sm font-extralight leading-relaxed text-muted-foreground">{tier.description}</p>

              {/* CTA */}
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

              {/* Divider */}
              <div className="my-8 h-px bg-border/15" />

              {/* Features */}
              <ul className="space-y-3">
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
              { icon: Brain, label: "Aureon AI", desc: "Uncensored intelligence engine with persistent memory and calibration.", both: true },
              { icon: Code, label: "Elite Coding", desc: "Multi-file architecture, debugging, and production-grade output.", both: true },
              { icon: Shield, label: "End-to-End Encryption", desc: "Every message encrypted. Never stored as training data.", both: true },
              { icon: Search, label: "ZIALIEL Search", desc: "Privacy-first search with source credibility tiers and page preview.", enterprise: true },
              { icon: Eye, label: "OSINT Backend", desc: "Intelligence gathering infrastructure for applications and workflows.", enterprise: true },
              { icon: BarChart3, label: "Data Analysis", desc: "Real-time data pipelines, extraction, and structured analysis.", enterprise: true },
              { icon: Network, label: "API Access", desc: "Dedicated API endpoints with priority queue and zero latency.", enterprise: true },
              { icon: Users, label: "Team Workspace", desc: "Unlimited seats, shared threads, and collaborative intelligence.", enterprise: true },
              { icon: Server, label: "Private Deployment", desc: "On-premise or private cloud deployment for maximum control.", enterprise: true },
            ].map(({ icon: Icon, label, desc, both, enterprise }) => (
              <div key={label} className={`rounded-xl border p-5 backdrop-blur-md ${enterprise && !both ? "border-accent/15 bg-accent/5" : "border-border/20 bg-card/30"}`}>
                <div className="flex items-center gap-3 mb-2">
                  <Icon className={`h-5 w-5 ${enterprise && !both ? "text-accent" : "text-foreground"}`} />
                  <h3 className="text-sm font-light tracking-wide text-foreground">{label}</h3>
                </div>
                <p className="text-xs font-extralight leading-relaxed text-muted-foreground">{desc}</p>
                <div className="mt-3">
                  {both ? (
                    <span className="text-[10px] tracking-wider text-emerald-400/70 uppercase">Both tiers</span>
                  ) : (
                    <span className="text-[10px] tracking-wider text-accent/70 uppercase">Enterprise only</span>
                  )}
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
              Because free tiers turn users into products. Every "free" AI is harvesting your prompts to improve their model. ZIALIEL gives you full access from day one — your data stays yours. That's the only honest model.
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
              { q: "Can I upgrade from Aureon to Enterprise?", a: "Yes. Contact us and your access is upgraded immediately. No downtime, no data migration needed." },
              { q: "What payment methods do you accept?", a: "All major credit cards and wire transfers for Enterprise. Billing is handled securely — we never store card details." },
              { q: "Is there a contract for Enterprise?", a: "Weekly billing. No long-term contract unless you want one. Cancel anytime with 7 days notice." },
              { q: "What does the OSINT backend tool include?", a: "A full intelligence gathering infrastructure — automated data extraction, entity resolution, network mapping, and structured output APIs designed for integration into your existing applications." },
              { q: "Can I get a demo of Enterprise?", a: "Yes. Reach out and we'll run a live session tailored to your use case. No slidedecks. Working tools." },
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
                Start With Aureon — $18/mo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button className="group flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-8 py-3 text-sm font-light tracking-wide text-accent hover:bg-accent/20 transition-all">
                Enterprise Access
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
            <p className="text-sm font-light tracking-[0.2em] text-foreground">ZIALIEL</p>
            <div className="flex items-center gap-6">
              <Link to="/" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Home</Link>
              <Link to="/terms" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
            </div>
            <p className="text-xs font-extralight tracking-wide text-muted-foreground/50">© {new Date().getFullYear()} Zorak Corp</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
