import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  Users, Search, Scale, Code, Swords, Aperture, Shield,
  PenTool, BookOpen, ArrowRight, Check, Plus, Brain, ArrowLeft, Cpu, Layers, MessageSquare, Database,
} from "lucide-react";
import AgentArchitectureDiagram from "@/components/landing/AgentArchitectureDiagram";

const builtInPersonas = [
  { icon: Search, name: "The Analyst", desc: "Cold, data-driven intelligence analysis. Strips opinion, delivers structure." },
  { icon: Scale, name: "The Strategist", desc: "Long-term thinking and systems-level reasoning. Connects dots across domains." },
  { icon: Code, name: "The Engineer", desc: "Pure technical execution. Production-grade code, architecture planning, debugging." },
  { icon: Swords, name: "The Code Forge", desc: "7-phase code audit pipeline. Scout, hunt, refactor, optimize — systematic code surgery." },
  { icon: Aperture, name: "The UI Forge", desc: "9-phase UI audit. Accessibility, responsiveness, performance — pixel-level precision." },
  { icon: Shield, name: "The Truth Engine", desc: "Uncensored. Direct. No emotional padding. Delivers the answer others won't." },
  { icon: PenTool, name: "The Writer", desc: "Voice-matched creative output. Maintains your tone, style, and editorial standards." },
  { icon: BookOpen, name: "The Researcher", desc: "Source-heavy, citation-driven analysis. Academic rigor applied to any topic." },
];

const customFeatures = [
  "Define custom system prompts that shape how Aureon thinks and responds",
  "Create unlimited personas for different workflows, clients, or projects",
  "Switch between personas mid-conversation with one click",
  "Personas persist across sessions — your configurations are never lost",
  "Custom persona context is injected into every response automatically",
  "Share persona configurations with your team on Pro plans",
];

const FeaturePersonas = () => {
  useEffect(() => {
    document.title = "Multi-Persona System — Aureon";
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
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">AI Personas</span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          One AI.
          <br />
          <span className="text-muted-foreground">Eight Minds. Infinite Custom.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          Switch between specialized AI personalities tuned for different tasks.
          Create unlimited custom personas with system prompts that shape how Aureon thinks.
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

      {/* Built-in Personas */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">Built-In Personas</h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 max-w-2xl">
            Eight specialized AI personalities, each tuned for a different cognitive mode.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {builtInPersonas.map((p) => (
              <div key={p.name} className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-6 transition-all hover:border-border/40 hover:bg-card/30">
                <p.icon className="h-5 w-5 text-foreground/80 mb-3" />
                <h3 className="text-sm font-light tracking-wide text-foreground mb-2">{p.name}</h3>
                <p className="text-xs font-extralight leading-relaxed text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <AgentArchitectureDiagram
        title="Persona System Architecture"
        subtitle="A context-injection framework that reshapes how the core intelligence engine thinks, reasons, and responds — without changing its underlying capability. The same power, infinite cognitive modes."
        layers={[
          {
            label: "Persona Definition",
            nodes: [
              { id: "p1", label: "Built-In Persona Library", sublabel: "8 pre-tuned cognitive modes", type: "input", icon: Users },
              { id: "p2", label: "Custom Persona Engine", sublabel: "User-defined system prompts & behaviours", type: "input", icon: Brain },
            ],
          },
          {
            label: "Context Injection Layer",
            nodes: [
              { id: "c1", label: "Prompt Constructor", sublabel: "Injects persona context into every request", type: "agent", icon: Cpu, accent: "text-accent/70" },
              { id: "c2", label: "Tone Calibrator", sublabel: "Voice, depth, and reasoning mode control", type: "agent", icon: Layers, accent: "text-accent/70" },
              { id: "c3", label: "Session Memory", sublabel: "Persona state persisted across conversations", type: "agent", icon: Database, accent: "text-accent/70" },
            ],
          },
          {
            label: "Intelligence Core",
            nodes: [
              { id: "e1", label: "Zophiel Reasoning Engine", sublabel: "Interprets persona context at inference time", type: "engine", icon: Shield, accent: "text-accent/60" },
            ],
          },
          {
            label: "Response Output",
            nodes: [
              { id: "o1", label: "Persona-Shaped Response", sublabel: "Same intelligence, different cognitive frame", type: "output", icon: MessageSquare },
              { id: "o2", label: "One-Click Switching", sublabel: "Change persona mid-conversation instantly", type: "output", icon: Search },
            ],
          },
        ]}
        features={["8 built-in personas", "unlimited custom", "session persistence", "one-click switching", "team sharing"]}
      />

      {/* Custom Personas */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            Build Your Own
          </h2>
          <div className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 sm:p-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="rounded-xl bg-foreground/5 p-2.5">
                <Plus className="h-5 w-5 text-foreground/80" />
              </div>
              <div>
                <h3 className="text-base font-light tracking-wide text-foreground">Custom Persona Engine</h3>
                <p className="text-xs font-extralight text-muted-foreground">Create personas as unique as your workflow</p>
              </div>
            </div>
            <ul className="space-y-4">
              {customFeatures.map((f) => (
                <li key={f} className="flex items-start gap-3 text-sm font-extralight text-foreground/80">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400/60" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
          Stop Switching Tools. Switch Minds.
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

export default FeaturePersonas;
