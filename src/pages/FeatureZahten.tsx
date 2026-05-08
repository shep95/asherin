import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  Workflow, Cpu, Layers, MessageSquare, FileText, Shield,
  ArrowRight, Box, Wrench, ArrowLeft, Search, Database, Zap, Bot, Webhook, Clock,
} from "lucide-react";
import AgentArchitectureDiagram from "@/components/landing/AgentArchitectureDiagram";

const capabilities = [
  {
    icon: MessageSquare,
    title: "Mission Console",
    description:
      "Describe the agent's mission in natural language. Zahten interprets intent, scopes the operation, and assembles a hardened execution plan.",
  },
  {
    icon: Layers,
    title: "Scope Assessor",
    description:
      "Auto-evaluates blast radius, data sensitivity, and required permissions before any agent is deployed. No silent privilege escalation.",
  },
  {
    icon: Bot,
    title: "Autonomous Agent Builder",
    description:
      "Scaffold production-grade agents with memory, tool use, retry logic, and exponential backoff baked in. Every agent is hardened by default.",
  },
  {
    icon: Webhook,
    title: "Multi-Channel Delivery",
    description:
      "Agents push results through webhooks, email, in-app notifications, or published tabs. Integrate with anything that speaks HTTP.",
  },
  {
    icon: Clock,
    title: "Scheduled Execution",
    description:
      "Cron-style triggers, interval polling, and event-driven activation. Agents run on your timetable without supervision.",
  },
  {
    icon: Shield,
    title: "Published Tab Sandbox",
    description:
      "Each agent's output renders in an isolated, signed tab. No cross-tab leakage, no DOM pollution, fully chrooted execution surface.",
  },
];

const agentTypes = [
  { title: "Intelligence Sweepers", desc: "Continuous OSINT collection across 30+ sources with deduped, scored output streams." },
  { title: "Monitoring Sentinels", desc: "Watch competitors, regulatory filings, market signals, and individuals — alert on deviation." },
  { title: "Workflow Orchestrators", desc: "Chain LLM reasoning, tool calls, and external APIs into autonomous multi-step pipelines." },
  { title: "Custom Mission Agents", desc: "BYOK-driven specialist agents you define from scratch — your prompt, your tools, your logic." },
];

const FeatureZahten = () => {
  useEffect(() => {
    document.title = "Zahten Agent Forge — Aureon";
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
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">Autonomous Agents</span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Forge Autonomous Agents.
          <br />
          <span className="text-muted-foreground">Operate Without Supervision.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          Zahten is Aureon's agent foundry. Describe a mission — Zahten scopes it, hardens it,
          and deploys a production-grade autonomous agent that runs on its own with scheduled triggers,
          multi-channel delivery, and full audit trails.
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
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">What Zahten Does</h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 max-w-2xl">
            From mission brief to deployed autonomous operator — Zahten compresses agent engineering into a guided console.
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
        title="Zahten Agent Forge Architecture"
        subtitle="A hardened pipeline from mission intent to autonomous execution. Every agent passes through scope assessment, capability scaffolding, and a sandboxed publishing layer before activation."
        layers={[
          {
            label: "Intent Layer",
            nodes: [
              { id: "i1", label: "Mission Console", sublabel: "Natural language → structured mission", type: "input", icon: MessageSquare },
              { id: "i2", label: "Scope Assessor", sublabel: "Blast radius · permissions · sensitivity", type: "input", icon: Layers },
            ],
          },
          {
            label: "Forge Core",
            nodes: [
              { id: "a1", label: "Capability Scaffolder", sublabel: "Tool wiring, memory, retry logic", type: "agent", icon: Wrench, accent: "text-accent/70" },
              { id: "a2", label: "Hardening Engine", sublabel: "Backoff, sandboxing, signed output", type: "agent", icon: Shield, accent: "text-accent/70" },
              { id: "a3", label: "Source Binder", sublabel: "OSINT feeds, APIs, BYOK keys", type: "agent", icon: Database, accent: "text-accent/70" },
            ],
          },
          {
            label: "Execution Layer",
            nodes: [
              { id: "e1", label: "Mission Runtime", sublabel: "Scheduled · event-driven · on-demand", type: "engine", icon: Cpu, accent: "text-accent/60" },
              { id: "e2", label: "Reasoning Loop", sublabel: "Plan → Act → Verify → Refine", type: "engine", icon: Zap, accent: "text-accent/60" },
            ],
          },
          {
            label: "Output",
            nodes: [
              { id: "o1", label: "Published Tab", sublabel: "Sandboxed signed render surface", type: "output", icon: Box },
              { id: "o2", label: "Webhook Delivery", sublabel: "Multi-channel push to any endpoint", type: "output", icon: Webhook },
              { id: "o3", label: "Audit Trail", sublabel: "Full execution log & decision record", type: "output", icon: FileText },
            ],
          },
        ]}
        features={["autonomous execution", "scope hardening", "multi-channel delivery", "scheduled triggers", "signed output"]}
      />

      {/* Agent Types */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            Agent Classes
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {agentTypes.map((dt) => (
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
          Mission to Agent. In Minutes.
        </h2>
        <p className="text-sm font-extralight text-muted-foreground mb-8">Available on Chat ($47/mo) and above. Bring your own AI key.</p>
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

export default FeatureZahten;
