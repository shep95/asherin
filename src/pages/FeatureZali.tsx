import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  Zap, Cpu, Layers, MessageSquare, FileText, Lightbulb,
  ArrowRight, Check, Box, Sparkles, Wrench, Users, ArrowLeft,
} from "lucide-react";

const capabilities = [
  {
    icon: MessageSquare,
    title: "Conversational Design",
    description:
      "Describe what you want to build in natural language. ZALI interprets your intent and generates structured design specifications automatically.",
  },
  {
    icon: Layers,
    title: "Multi-Phase Workflow",
    description:
      "From concept to specification — ZALI guides you through research, ideation, specification, cost analysis, and manufacturing feasibility in a structured pipeline.",
  },
  {
    icon: Lightbulb,
    title: "AI Research Integration",
    description:
      "ZALI pulls relevant research, patents, material properties, and engineering standards to inform your design decisions with real data.",
  },
  {
    icon: FileText,
    title: "Specification Generation",
    description:
      "Automatically generates detailed specifications including dimensions, materials, tolerances, and manufacturing requirements.",
  },
  {
    icon: Wrench,
    title: "Manufacturing Analysis",
    description:
      "Feasibility assessment, cost estimation, and process selection for your designs. Know what it takes to build before you commit.",
  },
  {
    icon: Users,
    title: "Community & Collaboration",
    description:
      "Share designs, get feedback, and collaborate with other engineers and designers in the ZALI community space.",
  },
];

const designTypes = [
  { title: "Mechanical Engineering", desc: "Precision parts, assemblies, and mechanisms with tolerance analysis and material selection." },
  { title: "Product Design", desc: "Consumer products, enclosures, and ergonomic designs with manufacturing feasibility." },
  { title: "Architectural Concepts", desc: "Structural elements, spatial layouts, and building system integration." },
  { title: "Electronics & PCB", desc: "Component placement, thermal management, and connector design specifications." },
];

const FeatureZali = () => {
  useEffect(() => {
    document.title = "ZALI Design Lab — Aureon";
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
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">Design Intelligence</span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight text-foreground">
          Design With AI.
          <br />
          <span className="text-muted-foreground">Engineer With Precision.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          ZALI is an AI-powered design lab that takes you from concept to specification.
          Describe what you want to build — ZALI handles research, specifications, cost analysis, and manufacturing feasibility.
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
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">What ZALI Does</h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 max-w-2xl">
            From napkin sketch to engineering specification — ZALI bridges the gap between idea and executable design.
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

      {/* Design Types */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            Design Domains
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {designTypes.map((dt) => (
              <div key={dt.title} className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 transition-all hover:border-border/40">
                <h3 className="text-base font-light tracking-wide text-foreground mb-3">{dt.title}</h3>
                <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{dt.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
          From Concept to Blueprint. In Minutes.
        </h2>
        <p className="text-sm font-extralight text-muted-foreground mb-8">Available on Pro and Advisor plans.</p>
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

export default FeatureZali;
