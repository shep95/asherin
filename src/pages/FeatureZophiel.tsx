import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  Search, Shield, Globe, FileText, Filter, Layers, Eye,
  ArrowRight, Check, Zap, BookOpen, Lock, BarChart3, ArrowLeft, Cpu, Database,
} from "lucide-react";
import AgentArchitectureDiagram from "@/components/landing/AgentArchitectureDiagram";

const capabilities = [
  {
    icon: Shield,
    title: "Source Credibility Tiers",
    description:
      "Every result is ranked by reliability — Verified, Established, Community, or Unverified. You always know how much to trust what you're reading.",
  },
  {
    icon: Zap,
    title: "Instant Answer Cards",
    description:
      "Get synthesized answers at the top of your results — no clicking through ten blue links. Intelligence, not noise.",
  },
  {
    icon: Eye,
    title: "Full Page Preview",
    description:
      "Preview any page without leaving the app. Read, evaluate, and extract — all in one interface.",
  },
  {
    icon: Filter,
    title: "Advanced Search Operators",
    description:
      "Boolean logic, domain filtering, date ranges, and content-type selectors built directly into the search bar.",
  },
  {
    icon: Globe,
    title: "Multi-Mode Search",
    description:
      "Switch between Web, Academic, News, and Code search modes. Each mode surfaces results from domain-specific indexes.",
  },
  {
    icon: Lock,
    title: "Privacy-First Design",
    description:
      "Your queries are never logged, never sold, and never used to build advertising profiles. Search without surveillance.",
  },
];

const useCases = [
  "Competitive intelligence gathering with source verification",
  "Academic research with peer-reviewed source prioritization",
  "Real-time news monitoring with credibility scoring",
  "Technical documentation search across code repositories",
  "Due diligence research with transparent source grading",
];

const FeatureZophiel = () => {
  useEffect(() => {
    document.title = "Zophiel Search Engine — Aureon";
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
      <section className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-6 pt-24 text-center">
        <div className="rounded-full border border-border/20 bg-card/30 backdrop-blur-md px-4 py-1.5 mb-8">
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">Search Intelligence</span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Search That Ranks By
          <br />
          <span className="text-muted-foreground">Truth, Not Ads.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          Zophiel is a privacy-first search intelligence engine that grades every source by credibility tier.
          Academic papers and verified documents surface first — not sponsored content.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link to="/pricing" className="group flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90">
            Get Access <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link to="/features" className="rounded-xl border border-border/30 px-8 py-3 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/5">
            All Features
          </Link>
        </div>
      </section>

      {/* Capabilities */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            Core Capabilities
          </h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 max-w-2xl">
            Every component of Zophiel is designed to give you verified intelligence faster than any traditional search engine.
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

      {/* Architecture */}
      <AgentArchitectureDiagram
        title="Zophiel Search Architecture"
        subtitle="A privacy-first search pipeline that grades every source before surfacing results. No query logging. No ad profiling. Every result earns its rank."
        layers={[
          {
            label: "Query Layer",
            nodes: [
              { id: "q1", label: "Query Parser", sublabel: "Boolean operators, filters, intent detection", type: "input", icon: Search },
              { id: "q2", label: "Mode Router", sublabel: "Web · Academic · News · Code", type: "input", icon: Layers },
            ],
          },
          {
            label: "Multi-Index Retrieval",
            nodes: [
              { id: "r1", label: "Web Index", sublabel: "Real-time crawled results", type: "agent", icon: Globe, accent: "text-accent/70" },
              { id: "r2", label: "Academic Index", sublabel: "Peer-reviewed & verified sources", type: "agent", icon: BookOpen, accent: "text-accent/70" },
              { id: "r3", label: "Domain Filter", sublabel: "Custom site & exclusion rules", type: "agent", icon: Filter, accent: "text-accent/70" },
            ],
          },
          {
            label: "Credibility Engine",
            nodes: [
              { id: "e1", label: "Source Tier Grader", sublabel: "Verified → Established → Community → Unverified", type: "engine", icon: Shield, accent: "text-accent/60" },
              { id: "e2", label: "Synthesis Core", sublabel: "Instant answer card generation", type: "engine", icon: Cpu, accent: "text-accent/60" },
            ],
          },
          {
            label: "Delivery",
            nodes: [
              { id: "o1", label: "Ranked Results", sublabel: "Truth-first ordering", type: "output", icon: BarChart3 },
              { id: "o2", label: "Page Preview", sublabel: "In-app full document view", type: "output", icon: Eye },
              { id: "o3", label: "Instant Answer", sublabel: "Synthesized top-of-results card", type: "output", icon: Zap },
            ],
          },
        ]}
        features={["no query logging", "source credibility tiers", "privacy-first", "multi-mode", "zero ad tracking"]}
      />

      {/* Use Cases */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            Who Uses Zophiel?
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

      {/* CTA */}
      <section className="relative z-10 px-6 py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
          Stop Searching. Start Knowing.
        </h2>
        <p className="text-sm font-extralight text-muted-foreground mb-8">Included in every Aureon plan.</p>
        <Link to="/pricing" className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90">
          View Plans <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/10 py-8 text-center">
        <p className="text-xs font-extralight text-muted-foreground/50">© {new Date().getFullYear()} Aureon. All rights reserved.</p>
      </footer>
    </LandingBackground>
  );
};

export default FeatureZophiel;
