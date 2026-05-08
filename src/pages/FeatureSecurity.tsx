import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  Shield, Lock, AlertTriangle, Eye, Activity, FileText,
  ArrowRight, Check, ArrowLeft, Cpu, Globe, Zap,
} from "lucide-react";
import AgentArchitectureDiagram from "@/components/landing/AgentArchitectureDiagram";

const capabilities = [
  {
    icon: Shield,
    title: "Threat Detection",
    description:
      "Real-time monitoring of login attempts, suspicious access patterns, and brute-force attacks. Automatic incident response and IP blocking.",
  },
  {
    icon: Lock,
    title: "Honeypot Traps",
    description:
      "Deploy intelligent honeypot endpoints that detect and log unauthorized access attempts. Every trap captures fingerprint, geolocation, and user agent data.",
  },
  {
    icon: AlertTriangle,
    title: "Incident Response",
    description:
      "Automated incident classification, severity scoring, and response execution. Critical threats trigger immediate lockdown protocols.",
  },
  {
    icon: Activity,
    title: "Security Analytics",
    description:
      "Visualize threat patterns over time with interactive charts. Track blocked IPs, attack vectors, and response effectiveness.",
  },
  {
    icon: Eye,
    title: "Audit Logging",
    description:
      "Every action, access, and modification is logged with full context — user, timestamp, IP, and resource. Complete forensic trail.",
  },
  {
    icon: FileText,
    title: "Compliance Reports",
    description:
      "Generate security posture reports on demand. Document threat response history and security metrics for compliance reviews.",
  },
];

const useCases = [
  "Monitoring and responding to unauthorized access attempts in real-time",
  "Deploying deception-based security layers with honeypot infrastructure",
  "Maintaining complete audit trails for compliance and forensic analysis",
  "Tracking threat actor patterns and attack vector evolution over time",
  "Automated incident response with severity-based escalation protocols",
];

const FeatureSecurity = () => {
  useEffect(() => {
    document.title = "Security Dashboard — Aureon";
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
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">Defensive Intelligence</span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Know Every Threat
          <br />
          <span className="text-muted-foreground">Before It Lands.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          Aureon's Security Dashboard combines real-time threat detection, honeypot traps, and automated incident response into a single defensive intelligence layer.
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
            Every layer of your Aureon environment is monitored, logged, and defended — automatically.
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
        title="Security Architecture"
        subtitle="A multi-layered defensive intelligence system that detects, classifies, and responds to threats autonomously."
        layers={[
          {
            label: "Detection Layer",
            nodes: [
              { id: "d1", label: "Traffic Monitor", sublabel: "Request pattern analysis", type: "input", icon: Activity },
              { id: "d2", label: "Honeypot Network", sublabel: "Deception-based trap endpoints", type: "input", icon: Lock },
            ],
          },
          {
            label: "Analysis Engine",
            nodes: [
              { id: "a1", label: "Threat Classifier", sublabel: "Attack vector identification", type: "agent", icon: AlertTriangle, accent: "text-accent/70" },
              { id: "a2", label: "Fingerprint Engine", sublabel: "Device & browser forensics", type: "agent", icon: Eye, accent: "text-accent/70" },
              { id: "a3", label: "Geo Resolver", sublabel: "IP to location mapping", type: "agent", icon: Globe, accent: "text-accent/70" },
            ],
          },
          {
            label: "Response Core",
            nodes: [
              { id: "e1", label: "Incident Engine", sublabel: "Auto-classify, escalate, resolve", type: "engine", icon: Cpu, accent: "text-accent/60" },
              { id: "e2", label: "Block System", sublabel: "IP ban & rate limiting", type: "engine", icon: Shield, accent: "text-accent/60" },
            ],
          },
          {
            label: "Output",
            nodes: [
              { id: "o1", label: "Threat Dashboard", sublabel: "Real-time security posture", type: "output", icon: Activity },
              { id: "o2", label: "Audit Trail", sublabel: "Complete forensic logging", type: "output", icon: FileText },
              { id: "o3", label: "Incident Reports", sublabel: "Auto-generated response docs", type: "output", icon: Zap },
            ],
          },
        ]}
        features={["real-time monitoring", "honeypot traps", "auto-response", "forensic logging", "IP intelligence"]}
      />

      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            Who Uses Security Dashboard?
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
          Defense Without Compromise.
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

export default FeatureSecurity;
