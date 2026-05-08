import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  Globe, Shield, Brain, Mail, Calendar, Search,
  ArrowRight, Check, ArrowLeft, Cpu, Users, BarChart3, Eye, Zap,
} from "lucide-react";
import AgentArchitectureDiagram from "@/components/landing/AgentArchitectureDiagram";

const capabilities = [
  {
    icon: Brain,
    title: "AI Digital Twin",
    description:
      "Build a behavioral model from your connected data. Predict your own patterns, optimize routines, and surface insights you'd never notice manually.",
  },
  {
    icon: Mail,
    title: "Email Intelligence",
    description:
      "AI-powered email triage, priority scoring, and automated response drafting. Turn your inbox into an intelligence feed.",
  },
  {
    icon: Calendar,
    title: "Calendar Wizard",
    description:
      "Smart scheduling, conflict detection, and productivity pattern analysis. Your calendar becomes a strategic tool, not just a schedule.",
  },
  {
    icon: Shield,
    title: "Security Intelligence",
    description:
      "Monitor connected app permissions, detect anomalous access patterns, and surface security risks across your Google ecosystem.",
  },
  {
    icon: Users,
    title: "Contact Intelligence",
    description:
      "Relationship mapping, communication frequency analysis, and network graph visualization across your entire contact ecosystem.",
  },
  {
    icon: BarChart3,
    title: "Productivity Analytics",
    description:
      "Deep metrics on how you spend time across apps, meetings, and communications. Actionable insights, not vanity dashboards.",
  },
];

const useCases = [
  "Executives mapping their communication network and relationship strength",
  "Security-conscious users auditing connected app permissions",
  "Productivity optimization through behavioral pattern analysis",
  "Automated email triage and priority-based inbox management",
  "Strategic calendar management with AI-powered scheduling",
];

const FeatureGoogleIntelligence = () => {
  useEffect(() => {
    document.title = "Google Intelligence — Aureon";
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
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">Ecosystem Intelligence</span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Your Data, Weaponized
          <br />
          <span className="text-muted-foreground">For Your Advantage.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          Google Intelligence connects to your Google ecosystem and transforms raw data into actionable intelligence — AI twin modeling, email triage, security audits, and behavioral analytics in one interface.
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
            Every module extracts intelligence from data you already own — no new inputs required.
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
        title="Google Intelligence Architecture"
        subtitle="A multi-account intelligence layer that transforms your existing Google ecosystem into a strategic command center."
        layers={[
          {
            label: "Data Sources",
            nodes: [
              { id: "d1", label: "Gmail", sublabel: "Email corpus, contacts, labels", type: "input", icon: Mail },
              { id: "d2", label: "Calendar", sublabel: "Events, patterns, availability", type: "input", icon: Calendar },
              { id: "d3", label: "Connected Apps", sublabel: "OAuth permissions, access scopes", type: "input", icon: Globe },
            ],
          },
          {
            label: "Processing Layer",
            nodes: [
              { id: "p1", label: "AI Twin Engine", sublabel: "Behavioral modeling & prediction", type: "agent", icon: Brain, accent: "text-accent/70" },
              { id: "p2", label: "Security Scanner", sublabel: "Permission audit & anomaly detection", type: "agent", icon: Shield, accent: "text-accent/70" },
              { id: "p3", label: "Relationship Mapper", sublabel: "Contact graph & frequency analysis", type: "agent", icon: Users, accent: "text-accent/70" },
            ],
          },
          {
            label: "Intelligence Core",
            nodes: [
              { id: "e1", label: "Pattern Engine", sublabel: "Cross-source behavioral analytics", type: "engine", icon: Cpu, accent: "text-accent/60" },
              { id: "e2", label: "Prediction Module", sublabel: "Next-action and trend forecasting", type: "engine", icon: Zap, accent: "text-accent/60" },
            ],
          },
          {
            label: "Output",
            nodes: [
              { id: "o1", label: "Intelligence Dashboard", sublabel: "Unified view of all insights", type: "output", icon: BarChart3 },
              { id: "o2", label: "Automated Actions", sublabel: "Email replies, calendar optimization", type: "output", icon: Eye },
            ],
          },
        ]}
        features={["multi-account", "AI twin", "security audit", "email intelligence", "zero data export"]}
      />

      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            Who Uses Google Intelligence?
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
          Own Your Data. Command It.
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

export default FeatureGoogleIntelligence;
