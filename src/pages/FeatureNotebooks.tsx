import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  BookOpen, Code, Play, Users, GitBranch, MessageSquare,
  ArrowRight, Check, ArrowLeft, Cpu, BarChart3, Shield, Zap,
} from "lucide-react";
import AgentArchitectureDiagram from "@/components/landing/AgentArchitectureDiagram";

const capabilities = [
  {
    icon: Code,
    title: "Multi-Language Cells",
    description:
      "Write and execute code cells in Python, SQL, and JavaScript. Mix languages within a single notebook for cross-domain analysis.",
  },
  {
    icon: Play,
    title: "Live Execution",
    description:
      "Run cells instantly with real-time output rendering. No external kernel required — everything executes within the Aureon environment.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description:
      "Share notebooks with granular permissions — view, comment, or edit. Real-time collaboration with threaded cell-level comments.",
  },
  {
    icon: GitBranch,
    title: "Version Control",
    description:
      "Every save creates a version snapshot. Browse history, compare diffs, and restore any previous state with one click.",
  },
  {
    icon: MessageSquare,
    title: "Inline Comments",
    description:
      "Add threaded discussions to any cell. Review findings, debate methodology, and document decisions without leaving the notebook.",
  },
  {
    icon: BarChart3,
    title: "Scheduled Execution",
    description:
      "Set notebooks to run on a schedule — hourly, daily, or weekly. Automate reporting pipelines and data monitoring workflows.",
  },
];

const useCases = [
  "Building automated data analysis pipelines with scheduled execution",
  "Collaborative intelligence reporting with team-based notebooks",
  "Prototyping algorithms and models with live code execution",
  "Creating versioned analytical workflows with full audit history",
  "Cross-team knowledge sharing through documented, executable notebooks",
];

const FeatureNotebooks = () => {
  useEffect(() => {
    document.title = "Notebooks — Aureon";
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

      <section className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-6 pt-24 text-center">
        <div className="rounded-full border border-border/20 bg-card/30 backdrop-blur-md px-4 py-1.5 mb-8">
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">Analytical Workspace</span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Think In Code.
          <br />
          <span className="text-muted-foreground">Execute On Demand.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          Aureon Notebooks combine live code execution, team collaboration, and version control into a single analytical workspace. Build, share, and automate intelligence workflows.
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

      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            Core Capabilities
          </h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 max-w-2xl">
            Everything you need to build, execute, and share analytical workflows — with full version history and team access.
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

      <AgentArchitectureDiagram
        title="Notebooks Architecture"
        subtitle="A collaborative analytical workspace with live execution, version control, and automated scheduling — built for intelligence teams."
        layers={[
          {
            label: "Input Layer",
            nodes: [
              { id: "i1", label: "Code Cells", sublabel: "Python, SQL, JavaScript", type: "input", icon: Code },
              { id: "i2", label: "Data Sources", sublabel: "Datasets, APIs, live feeds", type: "input", icon: BarChart3 },
            ],
          },
          {
            label: "Execution Engine",
            nodes: [
              { id: "e1", label: "Runtime", sublabel: "Sandboxed cell execution", type: "agent", icon: Play, accent: "text-accent/70" },
              { id: "e2", label: "Scheduler", sublabel: "Cron-based automated runs", type: "agent", icon: Zap, accent: "text-accent/70" },
              { id: "e3", label: "Version Manager", sublabel: "Snapshot & diff engine", type: "agent", icon: GitBranch, accent: "text-accent/70" },
            ],
          },
          {
            label: "Collaboration Core",
            nodes: [
              { id: "c1", label: "Sharing Engine", sublabel: "Team permissions & access control", type: "engine", icon: Users, accent: "text-accent/60" },
              { id: "c2", label: "Comment System", sublabel: "Threaded cell-level discussions", type: "engine", icon: MessageSquare, accent: "text-accent/60" },
            ],
          },
          {
            label: "Output",
            nodes: [
              { id: "o1", label: "Live Results", sublabel: "Real-time cell output rendering", type: "output", icon: Cpu },
              { id: "o2", label: "Versioned History", sublabel: "Full audit trail & restore", type: "output", icon: BookOpen },
              { id: "o3", label: "Scheduled Reports", sublabel: "Automated pipeline output", type: "output", icon: Shield },
            ],
          },
        ]}
        features={["live execution", "version control", "team sharing", "scheduled runs", "cell-level comments"]}
      />

      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            Who Uses Notebooks?
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

      <section className="relative z-10 px-6 py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
          From Hypothesis To Execution.
        </h2>
        <p className="text-sm font-extralight text-muted-foreground mb-8">Included in every Aureon plan.</p>
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

export default FeatureNotebooks;
