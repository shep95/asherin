import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  Newspaper, Clock, Target, Globe, Download, Bell,
  ArrowRight, Check, MessageSquare, Layers, ArrowLeft, Cpu, Search, Brain,
} from "lucide-react";
import AgentArchitectureDiagram from "@/components/landing/AgentArchitectureDiagram";

const capabilities = [
  {
    icon: MessageSquare,
    title: "Conversational Onboarding",
    description:
      "No forms. Tell Aureon about your business, competitors, and interests in natural conversation. It builds your intelligence profile from the dialogue.",
  },
  {
    icon: Clock,
    title: "Rolling Intelligence Window",
    description:
      "Each briefing synthesizes the last 24–48 hours of activity across your tracked vectors — competitors, markets, regulations, and key people.",
  },
  {
    icon: Target,
    title: "Structured Priority Levels",
    description:
      "Every item is classified: Critical → Significant → Monitoring → Market Signals. You see what demands action first.",
  },
  {
    icon: Globe,
    title: "100+ Source Synthesis",
    description:
      "Briefings pull from news wires, regulatory filings, financial data, social signals, and domain-specific intelligence feeds simultaneously.",
  },
  {
    icon: Download,
    title: "Full Export",
    description:
      "Download any briefing as a structured markdown file. Archive your intelligence history or share with stakeholders.",
  },
  {
    icon: Bell,
    title: "Configurable Delivery",
    description:
      "Set your preferred delivery time with timezone support. Your briefing lands when you need it — before your day starts.",
  },
];

const profileVectors = [
  "Competitors — Track unlimited competitors across any market",
  "Key Markets — Monitor specific regions, sectors, or verticals",
  "Technology Stack — Stay ahead of shifts in your tech landscape",
  "Regulatory Bodies — Policy changes that affect your operations",
  "Tracked Individuals — Executives, investors, regulators, key hires",
  "Investment Interests — Funding rounds, M&A activity, market movements",
];

const FeatureBriefings = () => {
  useEffect(() => {
    document.title = "Daily Intelligence Briefings — Aureon";
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
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">Intelligence Briefings</span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Your Morning Brief.
          <br />
          <span className="text-muted-foreground">Synthesized By AI.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          Personalized intelligence briefings synthesized from 100+ sources every morning.
          Competitors, markets, regulations, and key people — structured by priority level.
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
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">How Briefings Work</h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 max-w-2xl">
            Set up once through conversation. Receive structured intelligence every morning — tailored to your exact business vectors.
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
        title="Briefing Engine Architecture"
        subtitle="An automated intelligence pipeline that wakes at your configured delivery time, scans 100+ source vectors, synthesizes priorities, and delivers a structured briefing before your day starts."
        layers={[
          {
            label: "Profile Layer",
            nodes: [
              { id: "p1", label: "Intelligence Profile", sublabel: "Competitors, markets, people, tech stack", type: "input", icon: Target },
              { id: "p2", label: "Delivery Schedule", sublabel: "Time zone-aware briefing window", type: "input", icon: Clock },
            ],
          },
          {
            label: "Parallel Source Agents",
            nodes: [
              { id: "a1", label: "News Wire Agent", sublabel: "Real-time press & media signals", type: "agent", icon: Newspaper, accent: "text-accent/70" },
              { id: "a2", label: "Regulatory Scanner", sublabel: "Policy filings & compliance signals", type: "agent", icon: Search, accent: "text-accent/70" },
              { id: "a3", label: "Market Data Agent", sublabel: "Financial movements & funding rounds", type: "agent", icon: Globe, accent: "text-accent/70" },
            ],
          },
          {
            label: "Synthesis Core",
            nodes: [
              { id: "e1", label: "Priority Classifier", sublabel: "Critical → Significant → Monitoring → Signal", type: "engine", icon: Brain, accent: "text-accent/60" },
              { id: "e2", label: "Narrative Engine", sublabel: "Plain-language synthesis with context", type: "engine", icon: MessageSquare, accent: "text-accent/60" },
            ],
          },
          {
            label: "Delivery",
            nodes: [
              { id: "o1", label: "Daily Briefing", sublabel: "Structured in-app intelligence report", type: "output", icon: Layers },
              { id: "o2", label: "Markdown Export", sublabel: "Portable archive & sharing format", type: "output", icon: Download },
              { id: "o3", label: "Alert Notifications", sublabel: "Critical items trigger instant push", type: "output", icon: Bell },
            ],
          },
        ]}
        features={["100+ sources", "automated delivery", "priority classification", "configurable timezone", "full export"]}
      />

      {/* Profile Vectors */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            Your Intelligence Profile
          </h2>
          <div className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 sm:p-12">
            <p className="text-sm font-extralight text-muted-foreground mb-6">
              Every briefing is shaped by your profile — the intelligence vectors you care about:
            </p>
            <ul className="space-y-4">
              {profileVectors.map((v) => (
                <li key={v} className="flex items-start gap-3 text-sm font-extralight text-foreground/80">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400/60" />
                  {v}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
          Start Every Day With Intelligence.
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

export default FeatureBriefings;
