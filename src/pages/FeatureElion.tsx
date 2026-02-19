import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  ScanLine, Shield, Globe, Network, Search, Lock,
  ArrowRight, ArrowLeft, MessageSquare, Zap, Database,
  Eye, AlertTriangle, ServerCrash, Wifi, Code2, Cpu, Filter,
} from "lucide-react";
import AgentArchitectureDiagram from "@/components/landing/AgentArchitectureDiagram";

const capabilities = [
  {
    icon: Shield,
    title: "Security Score Audit",
    description:
      "Receive a 0–100 security score for any domain — evaluating HTTPS posture, header configuration, SSL certificates, and known vulnerability signals.",
  },
  {
    icon: Network,
    title: "Subdomain Intelligence",
    description:
      "Map the full attack surface of a domain. Discover subdomains, enumerate exposed services, and identify entry points across an organization's infrastructure.",
  },
  {
    icon: ScanLine,
    title: "Full Domain Scan",
    description:
      "Run all forensic modules in parallel. A single domain input triggers security scoring and subdomain recon simultaneously — delivering a complete picture in one shot.",
  },
  {
    icon: MessageSquare,
    title: "Aureon Chat Integration",
    description:
      "Ask questions, cross-reference findings, and explore link data through a full Aureon chat interface embedded directly in Elion — same power as the main assistant.",
  },
  {
    icon: Eye,
    title: "OSINT Surface Analysis",
    description:
      "Elion correlates public intelligence signals — WHOIS records, DNS history, IP ownership, and certificate transparency logs — into actionable forensic context.",
  },
  {
    icon: Lock,
    title: "Ghost Mode",
    description:
      "Activate Ghost Mode for stealth reconnaissance. All queries are anonymised and routed through privacy-preserving channels before reaching the target domain.",
  },
];

const useCases = [
  {
    icon: AlertTriangle,
    title: "Pre-Partnership Due Diligence",
    desc: "Before engaging a vendor, partner, or acquisition target — scan their domain infrastructure. Know the security posture before you sign.",
  },
  {
    icon: ServerCrash,
    title: "Threat Surface Mapping",
    desc: "Identify exposed subdomains, orphaned services, and misconfigured endpoints across an organization's digital estate before adversaries do.",
  },
  {
    icon: Wifi,
    title: "Continuous Security Monitoring",
    desc: "Run recurring full scans on owned domains to detect infrastructure drift, new subdomain registrations, and degraded security scores over time.",
  },
  {
    icon: Code2,
    title: "Penetration Test Reconnaissance",
    desc: "Use Elion's subdomain and OSINT modules to rapidly build a target profile for authorized red team engagements — structured output ready for your methodology.",
  },
];

const workflow = [
  { step: "01", label: "Input Domain", desc: "Enter any domain into the Elion toolkit." },
  { step: "02", label: "Select Module", desc: "Choose Security Score, Subdomain Scan, or Full Scan." },
  { step: "03", label: "Parallel Execution", desc: "Full Scan runs all modules simultaneously via parallel edge function calls." },
  { step: "04", label: "Chat & Investigate", desc: "Query your results through the embedded Aureon chat — ask anything about the data." },
];

const FeatureElion = () => {
  useEffect(() => {
    document.title = "Elion / Zohar Toolkit — Aureon";
  }, []);

  return (
    <LandingBackground>
      <Header />

      <div className="relative z-10 pt-24 px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-light tracking-wide text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
      </div>

      {/* Hero */}
      <section className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-6 pt-24 text-center">
        <div className="rounded-full border border-border/20 bg-card/30 backdrop-blur-md px-4 py-1.5 mb-8">
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">
            Domain Forensics & OSINT
          </span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight text-foreground">
          Domain Reconnaissance.
          <br />
          <span className="text-muted-foreground">Forensic Precision.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          Elion / Zohar Toolkit is Aureon's domain forensics engine. Input any domain — receive a
          structured security audit, full subdomain attack surface map, and the ability to
          interrogate all findings through a live Aureon chat session.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/pricing"
            className="group flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90"
          >
            Get Access <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            to="/features"
            className="rounded-xl border border-border/30 px-8 py-3 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/5"
          >
            All Features
          </Link>
        </div>
      </section>

      {/* Workflow */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            How It Works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {workflow.map((w) => (
              <div
                key={w.step}
                className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-6 transition-all hover:border-border/40 hover:bg-card/30"
              >
                <span className="text-3xl font-extralight text-muted-foreground/30 tracking-widest">{w.step}</span>
                <h3 className="mt-3 text-sm font-light tracking-wide text-foreground">{w.label}</h3>
                <p className="mt-2 text-xs font-extralight leading-relaxed text-muted-foreground">{w.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            Core Capabilities
          </h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 max-w-2xl">
            Every module is built for precision reconnaissance — from security posture scoring to
            full attack surface enumeration and AI-powered result analysis.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((cap) => (
              <div
                key={cap.title}
                className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 transition-all hover:border-border/40 hover:bg-card/30"
              >
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
            Use Cases
          </h2>
          <div className="space-y-6">
            {useCases.map((uc) => (
              <div
                key={uc.title}
                className="flex items-start gap-6 rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 transition-all hover:border-border/40"
              >
                <div className="mt-0.5 shrink-0 rounded-xl border border-border/20 bg-card/40 p-3">
                  <uc.icon className="h-5 w-5 text-foreground/70" />
                </div>
                <div>
                  <h3 className="text-base font-light tracking-wide text-foreground mb-2">{uc.title}</h3>
                  <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{uc.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <AgentArchitectureDiagram
        title="Elion Agent Architecture"
        subtitle="A multi-layer reconnaissance engine. Input propagates through parallel forensic modules — each operating independently before results converge in the intelligence layer."
        layers={[
          {
            label: "Input Gateway",
            nodes: [
              { id: "in1", label: "Domain Input", sublabel: "Any target domain or IP", type: "input", icon: Globe },
              { id: "in2", label: "Query Intent", sublabel: "Module selection & scope definition", type: "input", icon: Filter },
            ],
          },
          {
            label: "Parallel Forensic Modules",
            nodes: [
              { id: "m1", label: "Security Scorer", sublabel: "HTTPS, SSL, header audit", type: "agent", icon: Shield, accent: "text-accent/70" },
              { id: "m2", label: "Subdomain Recon", sublabel: "Attack surface enumeration", type: "agent", icon: Network, accent: "text-accent/70" },
              { id: "m3", label: "OSINT Correlator", sublabel: "WHOIS, DNS, cert transparency", type: "agent", icon: Eye, accent: "text-accent/70" },
            ],
          },
          {
            label: "Intelligence Engine",
            nodes: [
              { id: "e1", label: "Zophiel Reasoning Core", sublabel: "Cross-module synthesis & threat correlation", type: "engine", icon: Cpu, accent: "text-accent/60" },
              { id: "e2", label: "Ghost Routing Layer", sublabel: "Privacy-preserving query anonymization", type: "engine", icon: Lock, accent: "text-accent/60" },
            ],
          },
          {
            label: "Output Interface",
            nodes: [
              { id: "o1", label: "Security Score Report", sublabel: "0–100 posture rating", type: "output", icon: ScanLine },
              { id: "o2", label: "Subdomain Map", sublabel: "Full attack surface visualization", type: "output", icon: Network },
              { id: "o3", label: "Aureon Chat", sublabel: "Live interrogation of findings", type: "output", icon: MessageSquare },
            ],
          },
        ]}
        features={["parallel execution", "ghost mode", "zero data retention", "end-to-end encrypted", "forensic grade"]}
      />

      {/* Tier badge */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-3xl rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-12 text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/20 bg-card/30 px-4 py-1.5">
            <Database className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-light tracking-[0.25em] text-muted-foreground uppercase">Pro & Advisor</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            Intelligence Built For Operators.
          </h2>
          <p className="text-sm font-extralight text-muted-foreground mb-8 max-w-xl mx-auto">
            Elion / Zohar Toolkit is available on Pro and Advisor plans. Ghost Mode, full parallel
            scanning, and Aureon chat integration are included with every access tier.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/pricing"
              className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90"
            >
              View Plans <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/features"
              className="rounded-xl border border-border/30 px-8 py-3 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/5"
            >
              All Features
            </Link>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/10 py-8 text-center">
        <p className="text-xs font-extralight text-muted-foreground/50">
          © {new Date().getFullYear()} Aureon. All rights reserved.
        </p>
      </footer>
    </LandingBackground>
  );
};

export default FeatureElion;
