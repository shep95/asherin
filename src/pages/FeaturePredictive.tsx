import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  Brain, TrendingUp, AlertTriangle, Search, BarChart3, Shield,
  ArrowRight, Check, Zap, Activity, Target, Globe, FileText,
  ArrowLeft, Cpu, Database, Network, Users,
} from "lucide-react";
import AgentArchitectureDiagram from "@/components/landing/AgentArchitectureDiagram";

const capabilities = [
  {
    icon: Search,
    title: "Real-Time Signal Detection",
    description:
      "Continuously scans 100+ web sources — news, filings, social, patents — to detect early indicators of major corporate events before they happen.",
  },
  {
    icon: Brain,
    title: "AI Reasoning Chains",
    description:
      "Every prediction includes a full reasoning chain explaining how signals were weighted, correlated, and synthesized into a confidence score.",
  },
  {
    icon: BarChart3,
    title: "Confidence Scoring",
    description:
      "Multi-factor confidence model combining signal strength, source credibility, temporal recency, and historical accuracy for each prediction.",
  },
  {
    icon: AlertTriangle,
    title: "Event Type Coverage",
    description:
      "Covers regulatory actions, executive departures, M&A activity, earnings surprises, product launches, legal actions, and funding rounds.",
  },
  {
    icon: Activity,
    title: "Historical Backtesting",
    description:
      "Compare predictions against historical outcomes to measure and continuously improve accuracy across event categories.",
  },
  {
    icon: Shield,
    title: "Signal Library",
    description:
      "19+ pre-configured signal definitions with customizable keywords, search queries, and detection frequencies tuned per event type.",
  },
];

const useCases = [
  "Predict regulatory actions against competitors before public announcements",
  "Detect executive departure signals weeks before press releases",
  "Forecast earnings surprises by tracking sentiment and insider activity",
  "Monitor M&A activity through patent filings and leadership changes",
  "Track product launch timelines via job postings and supply chain signals",
  "Anticipate funding rounds through investor activity and hiring patterns",
];

const FeaturePredictive = () => {
  useEffect(() => {
    document.title = "Predictive Intelligence — Aureon";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "AI-powered predictive intelligence — detect signals from web sources and forecast corporate events before they happen. Available on Pro plans.");
  }, []);

  return (
    <LandingBackground>
      <Header />

      {/* Back link */}
      <div className="relative z-10 pt-24 px-6">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-light tracking-wide text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
      </div>

      {/* Hero */}
      <section className="relative z-10 flex min-h-[60vh] flex-col items-center justify-center px-6 pt-8 text-center">
        <div className="rounded-full border border-accent/20 bg-accent/5 backdrop-blur-md px-4 py-1.5 mb-8">
          <span className="text-[10px] font-light tracking-[0.3em] text-accent uppercase">Pro & Advisor</span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Predict Events
          <br />
          <span className="text-muted-foreground">Before They Happen.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          Predictive Intelligence scans the web for early signals — regulatory filings, insider activity,
          executive movements — and forecasts corporate events with AI-powered confidence scoring and
          full reasoning transparency.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link to="/pricing" className="group flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90">
            Get Pro Access <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link to="/features" className="rounded-xl border border-border/30 px-8 py-3 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/5">
            All Features
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center mb-16">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            How It Works
          </h2>
          <p className="text-sm font-extralight text-muted-foreground max-w-2xl mx-auto">
            Three steps from raw web data to actionable predictions.
          </p>
        </div>
        <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: "01", icon: Target, title: "Target a Company", desc: "Enter any company name. The engine scans its signal library across 19+ event categories." },
            { step: "02", icon: Globe, title: "Signal Detection", desc: "Searches 100+ web sources for matching keywords, sentiment shifts, and anomaly patterns." },
            { step: "03", icon: TrendingUp, title: "Prediction Output", desc: "Generates predictions with confidence scores, reasoning chains, and estimated timelines." },
          ].map(({ step, icon: Icon, title, desc }) => (
            <div key={step} className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 text-center">
              <span className="text-3xl font-extralight text-foreground/20">{step}</span>
              <Icon className="h-6 w-6 text-foreground/80 mx-auto mt-4 mb-3" />
              <h3 className="text-base font-light tracking-wide text-foreground mb-3">{title}</h3>
              <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <AgentArchitectureDiagram
        title="Predictive Intelligence Architecture"
        subtitle="A continuous signal detection pipeline. Web-crawling agents feed raw signals into a multi-factor reasoning engine that produces predictions with full confidence scoring and transparent reasoning chains."
        layers={[
          {
            label: "Signal Collection",
            nodes: [
              { id: "s1", label: "Web Crawler Network", sublabel: "100+ sources — news, filings, social, patents", type: "input", icon: Globe },
              { id: "s2", label: "Event Target Definition", sublabel: "Company · sector · 19+ event categories", type: "input", icon: Target },
            ],
          },
          {
            label: "Specialist Signal Agents",
            nodes: [
              { id: "a1", label: "Regulatory Agent", sublabel: "Policy filings, enforcement signals", type: "agent", icon: Shield, accent: "text-accent/70" },
              { id: "a2", label: "Market Agent", sublabel: "Financial anomalies & insider patterns", type: "agent", icon: TrendingUp, accent: "text-accent/70" },
              { id: "a3", label: "Leadership Agent", sublabel: "Executive movement & org change signals", type: "agent", icon: Users, accent: "text-accent/70" },
            ],
          },
          {
            label: "Reasoning & Scoring Core",
            nodes: [
              { id: "e1", label: "Confidence Engine", sublabel: "Signal strength × source credibility × recency", type: "engine", icon: Brain, accent: "text-accent/60" },
              { id: "e2", label: "Reasoning Chain Builder", sublabel: "Transparent multi-step inference trail", type: "engine", icon: Cpu, accent: "text-accent/60" },
            ],
          },
          {
            label: "Prediction Output",
            nodes: [
              { id: "o1", label: "Event Prediction", sublabel: "Typed event with confidence score & timeline", type: "output", icon: AlertTriangle },
              { id: "o2", label: "Reasoning Transcript", sublabel: "Full signal-to-conclusion chain", type: "output", icon: FileText },
              { id: "o3", label: "Historical Accuracy", sublabel: "Backtested against confirmed events", type: "output", icon: BarChart3 },
            ],
          },
        ]}
        features={["continuous scanning", "confidence scoring", "full reasoning chain", "19+ event types", "backtested accuracy"]}
      />

      {/* Capabilities */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            Core Capabilities
          </h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 max-w-2xl">
            Built for intelligence professionals who need to act on predictions, not react to news.
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
            Intelligence Applications
          </h2>
          <div className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 sm:p-12">
            <ul className="space-y-4">
              {useCases.map((uc) => (
                <li key={uc} className="flex items-start gap-3 text-sm font-extralight text-foreground/80">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400/60" />
                  {uc}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Event Categories */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12">
            Event Categories
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              "Regulatory Actions", "Executive Departures", "M&A Activity",
              "Earnings Surprises", "Product Launches", "Legal Actions",
              "Funding Rounds", "Market Expansion", "Data Breaches",
              "Partnership Announcements",
            ].map((cat) => (
              <span key={cat} className="rounded-full border border-border/20 bg-card/30 backdrop-blur-md px-5 py-2 text-xs font-light tracking-wide text-foreground/80">
                {cat}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
          Stop Reacting. Start Predicting.
        </h2>
        <p className="text-sm font-extralight text-muted-foreground mb-8">Available on Pro plans.</p>
        <Link to="/pricing" className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90">
          View Plans <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/10 py-8 text-center">
        <div className="flex items-center justify-center gap-6 mb-4">
          <Link to="/" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Home</Link>
          <Link to="/features" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Features</Link>
          <Link to="/pricing" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
        </div>
        <p className="text-xs font-extralight text-muted-foreground/50">© {new Date().getFullYear()} Aureon. All rights reserved.</p>
      </footer>
    </LandingBackground>
  );
};

export default FeaturePredictive;
