import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  ArrowLeft, ArrowRight, Cpu, Eye, Grid3X3, Layers, MessageSquare,
  Paintbrush, RefreshCw, Sparkles, Upload, Wand2, Zap, Code2, Image,
} from "lucide-react";
import AgentArchitectureDiagram from "@/components/landing/AgentArchitectureDiagram";

const capabilities = [
  {
    icon: Grid3X3,
    title: "Micro-Pixel Canvas",
    description:
      "Work at resolutions up to 1,000,000 pixels — precise enough for professional icon design, sprite creation, and high-fidelity concept art — all rendered in real time.",
  },
  {
    icon: Upload,
    title: "Image Import & Background Removal",
    description:
      "Upload any reference image and the system automatically strips white and off-white backgrounds via threshold filtering, leaving clean asset-ready artwork.",
  },
  {
    icon: Wand2,
    title: "AUREON Design Partner",
    description:
      "Describe your visual intent in plain language. AUREON autonomously executes iterative Look-Edit-Fix loops — up to 12 self-correction cycles — to converge on your goal.",
  },
  {
    icon: RefreshCw,
    title: "Autonomous Iteration",
    description:
      "AUREON reviews its own output after each cycle, identifies divergence from your intent, and self-corrects — without you writing a single prompt after the first instruction.",
  },
  {
    icon: Code2,
    title: "SVG & Code Export",
    description:
      "Every design exports as production-ready SVG or pixel art data structures — copy-paste ready for web, mobile, or game engines.",
  },
  {
    icon: Layers,
    title: "Persistent Session Management",
    description:
      "All sessions are saved to your account automatically. Revisit, modify, and version your canvas at any point without losing a single pixel.",
  },
];

const useCases = [
  { title: "Icon & Logo Design", desc: "Create pixel-perfect icons and logos with autonomous refinement. Export as SVG for any resolution." },
  { title: "Game Sprite Creation", desc: "Design character sprites, tile sets, and UI elements with precise per-pixel control and AI assistance." },
  { title: "Brand Asset Generation", desc: "Rapid iteration on brand marks and visual identities with AUREON acting as a creative co-pilot." },
  { title: "Concept Visualisation", desc: "Translate abstract design briefs into visual prototypes through natural language — no design tools required." },
];

const FeatureImagineToCode = () => {
  useEffect(() => {
    document.title = "Imagine To Code — Aureon";
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
        <div className="rounded-full border border-border/20 bg-card/30 backdrop-blur-md px-4 py-1.5 mb-6">
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">Visual Intelligence</span>
        </div>

        {/* ZALI attribution badge */}
        <div className="rounded-full border border-border/15 bg-card/20 backdrop-blur-md px-4 py-1 mb-8 flex items-center gap-2">
          <Sparkles className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-[10px] font-extralight tracking-[0.25em] text-muted-foreground/70 uppercase">
            Created by{" "}
            <a
              href="https://zalisoft.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground/80 hover:text-foreground underline underline-offset-2 transition-colors"
            >
              ZALI Software
            </a>
          </span>
        </div>

        <h1 className="max-w-4xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Paint an Idea.
          <br />
          <span className="text-muted-foreground">AUREON Builds It.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          Imagine To Code is a high-resolution pixel art and SVG editor powered by an autonomous AI co-pilot.
          Describe what you want — AUREON iterates, self-corrects, and refines until the canvas matches your vision.
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
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">What Imagine To Code Does</h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 max-w-2xl">
            A canvas that thinks. Every pixel placed intentionally — by you, or by AUREON on your behalf.
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
        title="Imagine To Code — Intelligence Pipeline"
        subtitle="Visual intent flows from natural language through autonomous planning, pixel-level execution, and iterative self-correction — converging on production-ready output without human re-prompting."
        layers={[
          {
            label: "Intent Layer",
            nodes: [
              { id: "i1", label: "Visual Intent Parser", sublabel: "Natural language → design constraints", type: "input", icon: MessageSquare },
              { id: "i2", label: "Canvas Initialiser", sublabel: "Grid resolution · colour space · bounds", type: "input", icon: Grid3X3 },
            ],
          },
          {
            label: "Autonomous Design Agents",
            nodes: [
              { id: "a1", label: "Composition Agent", sublabel: "Layout planning & spatial reasoning", type: "agent", icon: Eye, accent: "text-accent/70" },
              { id: "a2", label: "Render Agent", sublabel: "Pixel-level colour and form execution", type: "agent", icon: Paintbrush, accent: "text-accent/70" },
              { id: "a3", label: "Critique Agent", sublabel: "Look-Edit-Fix loop — up to 12 cycles", type: "agent", icon: RefreshCw, accent: "text-accent/70" },
            ],
          },
          {
            label: "Synthesis Core",
            nodes: [
              { id: "e1", label: "Convergence Engine", sublabel: "Delta scoring against target intent", type: "engine", icon: Cpu, accent: "text-accent/60" },
              { id: "e2", label: "Background Filter", sublabel: "RGB threshold — white removal pipeline", type: "engine", icon: Image, accent: "text-accent/60" },
            ],
          },
          {
            label: "Output",
            nodes: [
              { id: "o1", label: "SVG Export", sublabel: "Resolution-independent vector asset", type: "output", icon: Code2 },
              { id: "o2", label: "Pixel Art Data", sublabel: "Structured pixel map — game & web ready", type: "output", icon: Grid3X3 },
              { id: "o3", label: "Saved Session", sublabel: "Persistent canvas — resume anytime", type: "output", icon: Layers },
            ],
          },
        ]}
        features={["autonomous iteration", "look-edit-fix loops", "micro-pixel precision", "svg export", "background removal"]}
      />

      {/* Use Cases */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            What You Can Build
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {useCases.map((uc) => (
              <div key={uc.title} className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 transition-all hover:border-border/40">
                <h3 className="text-base font-light tracking-wide text-foreground mb-3">{uc.title}</h3>
                <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{uc.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ZALI credit section */}
      <section className="relative z-10 px-6 py-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-10 text-center">
          <Sparkles className="h-6 w-6 text-foreground/50 mx-auto mb-5" />
          <h3 className="text-lg font-extralight tracking-wide text-foreground mb-3">
            Built by{" "}
            <a
              href="https://zalisoft.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4 hover:text-foreground/70 transition-colors"
            >
              ZALI Software
            </a>
          </h3>
          <p className="text-sm font-extralight leading-relaxed text-muted-foreground max-w-xl mx-auto">
            Imagine To Code was engineered by ZALI Software — a specialist AI engineering studio building intelligence tools
            for creative and technical workflows. The autonomous iteration engine, pixel-level rendering pipeline, and
            SVG export system were all designed in-house as part of the ZALI toolkit, integrated natively into the Aureon platform.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
          From Imagination to Production. In One Canvas.
        </h2>
        <p className="text-sm font-extralight text-muted-foreground mb-8">Available on Pro and Advisor plans.</p>
        <Link to="/pricing" className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90">
          View Plans <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </section>

      <footer className="relative z-10 border-t border-border/10 py-8 text-center">
        <p className="text-xs font-extralight text-muted-foreground/50">
          © {new Date().getFullYear()} Aureon. Imagine To Code is a product of{" "}
          <a href="https://zalisoft.com" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground transition-colors underline underline-offset-2">
            ZALI Software
          </a>
          . All rights reserved.
        </p>
      </footer>
    </LandingBackground>
  );
};

export default FeatureImagineToCode;
