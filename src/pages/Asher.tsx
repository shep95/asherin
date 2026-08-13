import { useEffect } from "react";
import { Link } from "react-router-dom";
import { applySeoHead } from "@/lib/seoHead";
import {
  ArrowLeft, ArrowRight, Crosshair, Radar, Satellite, Shield,
  BookLock, Archive, Lock, FileCheck2, ServerCog, Eye, Brain, Activity,
} from "lucide-react";
import LandingBackground from "@/components/LandingBackground";
import Header from "@/components/Header";

/* ─────────────────────────────────────────────────────────────
   ASHER — Defense Intelligence Architecture Diagram
   Six satellite nodes around a central pulsing core.
   Theme-driven SVG, no deps.
   ───────────────────────────────────────────────────────────── */

const satellites = [
  { id: "s1", x: 180, y: 90,  label: "Theater Brief",   sub: "Multi-source" },
  { id: "s2", x: 620, y: 90,  label: "Targeting Aid",   sub: "Decision support" },
  { id: "s3", x: 90,  y: 240, label: "SIGINT Fusion",   sub: "Signal priority" },
  { id: "s4", x: 710, y: 240, label: "GEOINT Layer",    sub: "Intel + Imagery" },
  { id: "s5", x: 180, y: 390, label: "Doctrine Recall", sub: "Reference corpus" },
  { id: "s6", x: 620, y: 390, label: "Audit Vault",     sub: "Chain-of-custody" },
];

const ArchitectureDiagram = () => {
  const cx = 400;
  const cy = 240;
  return (
    <div className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-6 sm:p-8">
      <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-6">
        Asher — Defense Intelligence Architecture
      </p>
      <div className="w-full overflow-x-auto">
        <svg viewBox="0 0 800 480" className="w-full h-auto min-w-[640px]" style={{ maxHeight: 520 }}>
          <defs>
            <radialGradient id="asher-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%"  stopColor="hsl(0 70% 55%)" stopOpacity="0.32" />
              <stop offset="100%" stopColor="hsl(0 70% 55%)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="asher-edge" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="hsl(var(--border))" stopOpacity="0.1" />
              <stop offset="50%"  stopColor="hsl(0 70% 55%)"      stopOpacity="0.55" />
              <stop offset="100%" stopColor="hsl(var(--border))" stopOpacity="0.1" />
            </linearGradient>
            <pattern id="asher-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="hsl(var(--border))" strokeOpacity="0.08" strokeWidth="1" />
            </pattern>
          </defs>

          <rect width="800" height="480" fill="url(#asher-grid)" />
          <circle cx={cx} cy={cy} r="190" fill="url(#asher-glow)" />

          {satellites.map((n) => (
            <line key={`e-${n.id}`} x1={cx} y1={cy} x2={n.x} y2={n.y}
              stroke="url(#asher-edge)" strokeWidth="1" />
          ))}

          {/* Central core */}
          <circle cx={cx} cy={cy} r="68" fill="hsl(var(--card))" stroke="hsl(0 70% 55% / 0.55)" strokeWidth="1.5">
            <animate attributeName="r" values="66;72;66" dur="3.5s" repeatCount="indefinite" />
            <animate attributeName="stroke-opacity" values="0.45;0.85;0.45" dur="3.5s" repeatCount="indefinite" />
          </circle>
          <circle cx={cx} cy={cy} r="54" fill="none" stroke="hsl(0 70% 55% / 0.25)" strokeWidth="1" />
          <text x={cx} y={cy - 4} textAnchor="middle" fill="hsl(var(--foreground))"
            style={{ font: "300 14px Inter", letterSpacing: "0.18em" }}>ASHER</text>
          <text x={cx} y={cy + 14} textAnchor="middle" fill="hsl(var(--muted-foreground))"
            style={{ font: "300 9px Inter", letterSpacing: "0.3em" }}>DEFENSE</text>

          {/* Satellites */}
          {satellites.map((n) => (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r="44" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1" />
              <circle cx={n.x + 32} cy={n.y - 32} r="3" fill="hsl(0 80% 55%)">
                <animate attributeName="opacity" values="1;0.3;1" dur="2.2s" repeatCount="indefinite" />
              </circle>
              <text x={n.x} y={n.y - 2} textAnchor="middle" fill="hsl(var(--foreground))"
                style={{ font: "300 11px Inter", letterSpacing: "0.05em" }}>{n.label}</text>
              <text x={n.x} y={n.y + 14} textAnchor="middle" fill="hsl(var(--muted-foreground))"
                style={{ font: "300 9px Inter", letterSpacing: "0.08em" }}>{n.sub}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

const capabilities = [
  { icon: Crosshair, name: "Threat Assessment",     desc: "Multi-source fusion to surface adversarial posture and intent." },
  { icon: Brain,     name: "Strategic Planning",    desc: "Doctrine-aware reasoning over operational and theater geometry." },
  { icon: Radar,     name: "Intelligence Synthesis", desc: "Cross-domain SIGINT / GEOINT / HUMINT correlation." },
  { icon: Activity,  name: "Real-time Analysis",    desc: "Sub-second response on streaming intelligence feeds." },
  { icon: ServerCog, name: "Secure Deployment",     desc: "Air-gapped, on-premise, hardened runtime." },
  { icon: FileCheck2, name: "Audit Trail",          desc: "Immutable chain-of-custody for every inference." },
];

const Asher = () => {
  useEffect(() => {
    applySeoHead({
      title: "Asher — Military Intelligence Model | Asherin",
      description: "Asher — Asherin's forthcoming AI model purpose-built for defense, intelligence services, and military command. Restricted, audited deployment.",
      path: "/asher",
    });
  }, []);

  return (
    <LandingBackground>
      <Header />

      {/* HERO */}
      <section className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center pt-24">
        <Link to="/" className="absolute top-24 left-6 sm:left-10 inline-flex items-center gap-2 text-xs font-extralight tracking-[0.15em] text-muted-foreground/60 hover:text-foreground transition-colors uppercase">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
        </Link>

        <p className="text-[10px] sm:text-xs font-extralight tracking-[0.4em] text-muted-foreground/60 uppercase mb-8">
          Military Intelligence — In Development
        </p>

        <h1 className="text-7xl sm:text-8xl md:text-[10rem] font-extralight tracking-tight leading-none text-foreground">
          ASHER <span className="block text-2xl sm:text-3xl md:text-4xl mt-4 tracking-[0.2em] text-muted-foreground/80 uppercase">Military Intelligence Model</span>
        </h1>

        <p className="mt-10 max-w-[600px] text-base sm:text-lg font-extralight leading-relaxed text-muted-foreground/80">
          Our forthcoming model purpose-built for defense, intelligence services, and military command.
          Asher is being trained for restricted, audited deployment — not for the public web.
        </p>

        <div className="mt-10 inline-flex items-center gap-2.5 rounded-full border border-border/40 bg-card/60 backdrop-blur-md px-4 py-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
          </span>
          <span className="text-[10px] font-light tracking-[0.3em] text-foreground/80 uppercase">
            In Active Development
          </span>
        </div>
      </section>

      {/* ARCHITECTURE */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-24">
        <ArchitectureDiagram />
      </section>

      {/* CAPABILITIES */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-10 text-center">
          Core Capabilities
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {capabilities.map((c) => (
            <div key={c.name} className="rounded-2xl border border-border/15 bg-card/30 backdrop-blur-md p-6 hover:border-border/30 transition-colors">
              <c.icon className="h-5 w-5 text-foreground/70 mb-4" strokeWidth={1.25} />
              <h2 className="text-sm font-light tracking-wide text-foreground mb-2">{c.name}</h2>
              <p className="text-xs font-extralight leading-relaxed text-muted-foreground/80">{c.desc}</p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-[9px] font-light tracking-[0.25em] text-red-400/70 uppercase">
                <span className="h-1 w-1 rounded-full bg-red-500" /> In Development
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECURITY & COMPLIANCE */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-10 text-center">
          Built for Restricted Deployment
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-border/15 bg-card/30 backdrop-blur-md p-8">
            <h2 className="text-base font-light tracking-wide text-foreground mb-6 flex items-center gap-2">
              <Shield className="h-4 w-4 text-foreground/60" strokeWidth={1.25} /> Security Posture
            </h2>
            <ul className="space-y-3 text-sm font-extralight text-muted-foreground/85">
              {[
                "Air-gapped deployment — no public network egress",
                "Encrypted operator comms with per-device identity keys",
                "Append-only audit logging of every inference",
                "Role-based access controls with multi-party authorization",
                "Tamper-evident model weights and config bundles",
              ].map((s) => (
                <li key={s} className="flex items-start gap-3">
                  <Lock className="h-3.5 w-3.5 mt-0.5 text-foreground/40 flex-shrink-0" strokeWidth={1.5} />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border/15 bg-card/30 backdrop-blur-md p-8">
            <h2 className="text-base font-light tracking-wide text-foreground mb-6 flex items-center gap-2">
              <BookLock className="h-4 w-4 text-foreground/60" strokeWidth={1.25} /> Compliance Targets
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {["FedRAMP High", "DoD IL5", "ITAR Compliant", "NIST 800-171", "CMMC Level 3", "SOC 2 Type II"].map((b) => (
                <div key={b} className="rounded-lg border border-border/20 bg-background/40 px-3 py-3 text-center">
                  <p className="text-[11px] font-light tracking-[0.1em] text-foreground/85">{b}</p>
                  <p className="mt-1 text-[8px] font-light tracking-[0.25em] text-muted-foreground/50 uppercase">In Progress</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SPECIFICATIONS */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 py-16">
        <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-10 text-center">
          Model Specifications
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-px rounded-2xl overflow-hidden border border-border/15 bg-border/15">
          {[
            { k: "Parameters",    v: "Classified" },
            { k: "Training Data", v: "Restricted datasets" },
            { k: "Deployment",    v: "On-premise only" },
            { k: "Access",        v: "Authorized personnel" },
            { k: "Latency",       v: "Sub-second response" },
            { k: "Availability",  v: "Q3 2026" },
          ].map((s) => (
            <div key={s.k} className="bg-card/40 backdrop-blur-md p-6">
              <p className="text-[9px] font-light tracking-[0.3em] text-muted-foreground/60 uppercase mb-2">{s.k}</p>
              <p className="text-base font-extralight tracking-wide text-foreground">{s.v}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ACCESS REQUEST */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 py-24">
        <div className="rounded-3xl border border-border/25 bg-card/40 backdrop-blur-md p-10 sm:p-14 text-center">
          <Archive className="h-6 w-6 text-foreground/50 mx-auto mb-6" strokeWidth={1.25} />
          <h2 className="text-3xl sm:text-4xl font-extralight tracking-wide text-foreground mb-4">Request Access</h2>
          <p className="max-w-xl mx-auto text-sm font-extralight leading-relaxed text-muted-foreground/80 mb-8">
            ASHER is available only to authorized defense and intelligence agencies.
            All requests are vetted under restricted credentialing protocols.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
            <a href="mailto:asher@asherin.com?subject=ASHER%20Access%20Request" className="group inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-6 py-3 text-xs font-light tracking-[0.2em] text-red-200 uppercase transition-all hover:bg-red-500/20">
              Submit Access Request
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a href="mailto:security@asherin.com" className="text-xs font-light tracking-[0.15em] text-muted-foreground hover:text-foreground transition-colors uppercase">
              Contact Our Security Team
            </a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-border/15 mt-12">
        <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
          <div>
            <p className="text-base font-extralight tracking-[0.25em] text-foreground">ASHERIN</p>
            <p className="mt-1 text-[10px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase">Military Intelligence Systems</p>
          </div>
          <div className="flex items-center justify-center gap-5 text-[11px] font-light tracking-[0.15em] text-muted-foreground uppercase">
            <Link to="/dashboard" className="hover:text-foreground">Dashboard</Link>
            <Link to="/terms" className="hover:text-foreground">Compliance</Link>
            <a href="mailto:asher@asherin.com" className="hover:text-foreground">Contact</a>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-light tracking-[0.3em] text-red-400/70 uppercase">Classification: Restricted</p>
            <p className="mt-1 text-[10px] font-light tracking-[0.15em] text-muted-foreground/50">© {new Date().getFullYear()} Asherin. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </LandingBackground>
  );
};

export default Asher;
