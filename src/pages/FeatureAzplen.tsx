import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  Database, GitBranch, FileText, BarChart3, Brain, Layers,
  ArrowRight, Check, Upload, Search, Activity, Puzzle, ArrowLeft, Cpu, Network,
} from "lucide-react";
import AgentArchitectureDiagram from "@/components/landing/AgentArchitectureDiagram";

const capabilities = [
  {
    icon: Upload,
    title: "Universal Data Ingestion",
    description:
      "Import CSV, JSON, Excel, and more. Guided prompt-based intake ensures your data is profiled, validated, and ready for analysis in seconds.",
  },
  {
    icon: Search,
    title: "Natural Language Queries",
    description:
      "Ask questions about your data in plain English. Azplen translates your intent into precise analysis — no SQL required.",
  },
  {
    icon: GitBranch,
    title: "Data Branching",
    description:
      "Create branches of your datasets to experiment without touching production. Merge back when you're confident in the results.",
  },
  {
    icon: Brain,
    title: "AI-Powered Insights",
    description:
      "Automated detection of trends, anomalies, correlations, and outliers. Azplen surfaces what matters before you know to look for it.",
  },
  {
    icon: FileText,
    title: "Executive Report Generation",
    description:
      "Generate structured intelligence reports from your data with scheduling support. Board-ready output, on autopilot.",
  },
  {
    icon: Activity,
    title: "Scenario Simulation",
    description:
      "Monte Carlo modeling and what-if analysis. Test hypotheses against your data before making decisions.",
  },
];

const workflow = [
  { step: "01", title: "Ingest", desc: "Upload your dataset. Azplen profiles it automatically — schema detection, quality scoring, anomaly flagging." },
  { step: "02", title: "Explore", desc: "Query your data with natural language. Visualize relationships, distributions, and trends interactively." },
  { step: "03", title: "Analyze", desc: "AI-powered insight generation detects what you'd miss. Entity resolution connects dots across datasets." },
  { step: "04", title: "Report", desc: "Generate structured reports. Schedule recurring analysis. Export findings for stakeholders." },
];

const FeatureAzplen = () => {
  useEffect(() => {
    document.title = "Azplen Data Intelligence — Aureon";
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
      <section className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-6 pt-24 text-center">
        <div className="rounded-full border border-border/20 bg-card/30 backdrop-blur-md px-4 py-1.5 mb-8">
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">Data Intelligence</span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Your Data Talks.
          <br />
          <span className="text-muted-foreground">Azplen Translates.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          A full data intelligence suite — ingest any dataset, analyze with natural language,
          branch for experimentation, and generate executive reports with AI-powered insights.
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
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">What Azplen Does</h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 max-w-2xl">
            From raw data to executive intelligence — Azplen handles the entire pipeline.
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
        title="Azplen Data Intelligence Architecture"
        subtitle="A multi-agent data pipeline from raw ingestion to executive intelligence. Each layer is autonomous — schema profiling, entity resolution, insight generation, and reporting operate concurrently."
        layers={[
          {
            label: "Ingestion Layer",
            nodes: [
              { id: "i1", label: "Universal Ingestor", sublabel: "CSV, JSON, Excel, API feeds", type: "input", icon: Upload },
              { id: "i2", label: "Schema Profiler", sublabel: "Auto-detection, quality scoring, anomaly flagging", type: "input", icon: Database },
            ],
          },
          {
            label: "Specialist Analysis Agents",
            nodes: [
              { id: "a1", label: "Query Agent", sublabel: "Natural language → structured analysis", type: "agent", icon: Search, accent: "text-accent/70" },
              { id: "a2", label: "Entity Resolver", sublabel: "Cross-dataset identity correlation", type: "agent", icon: Network, accent: "text-accent/70" },
              { id: "a3", label: "Scenario Simulator", sublabel: "Monte Carlo & what-if modeling", type: "agent", icon: Activity, accent: "text-accent/70" },
            ],
          },
          {
            label: "Intelligence Core",
            nodes: [
              { id: "e1", label: "Insight Engine", sublabel: "Trend, anomaly & correlation detection", type: "engine", icon: Brain, accent: "text-accent/60" },
              { id: "e2", label: "Branch Manager", sublabel: "Dataset versioning & merge control", type: "engine", icon: GitBranch, accent: "text-accent/60" },
            ],
          },
          {
            label: "Output",
            nodes: [
              { id: "o1", label: "Executive Report", sublabel: "Scheduled, board-ready intelligence", type: "output", icon: FileText },
              { id: "o2", label: "Visual Analytics", sublabel: "Interactive charts & dashboards", type: "output", icon: BarChart3 },
              { id: "o3", label: "Data Lineage Map", sublabel: "Full provenance tracking", type: "output", icon: Layers },
            ],
          },
        ]}
        features={["branch-based versioning", "entity resolution", "natural language queries", "zero SQL required", "automated insights"]}
      />

      {/* Workflow */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            The Azplen Workflow
          </h2>
          <div className="space-y-6">
            {workflow.map((w) => (
              <div key={w.step} className="flex gap-6 rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 transition-all hover:border-border/40">
                <span className="text-3xl font-extralight text-muted-foreground/30 shrink-0">{w.step}</span>
                <div>
                  <h3 className="text-base font-light tracking-wide text-foreground mb-2">{w.title}</h3>
                  <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{w.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
          Turn Raw Data Into Decisions.
        </h2>
        <p className="text-sm font-extralight text-muted-foreground mb-8">Available on Pro plans.</p>
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

export default FeatureAzplen;
