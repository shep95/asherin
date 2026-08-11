// HOSRAD — House Of Asher Research & Development.
// New public page announcing the R&D division. Theme-matched (monochrome +
// gilt accent + glassmorphic containers), SEO metadata via RouteSeo, workflow
// cards, three inline diagrams (SVG, no third-party deps), and a form
// placeholder that will be filled in later per user's instruction.
//
// Design intent: read as a doctrine drop, not a marketing page. Big display
// type, wide letter-spacing, quiet chrome, sparse gilt underlines. Every card
// is a claim you can defend, not a feature bullet.

import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import {
  ArrowLeft, ArrowRight, Atom, Cpu, Shield, Radar, Zap, FlaskConical,
  Users, Lock, Target, Layers, Compass, Sparkles, Beaker, Rocket, Brain,
  Building2, ClipboardList,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────────────
 * DIAGRAM 1 — Empire R&D Doctrine
 * A horizontal timeline: Rome → America (DARPA) → Asherin Empire (HOSRAD)
 * Purely SVG, uses semantic tokens for colors so it inherits dark theme.
 * ──────────────────────────────────────────────────────────────────── */
function EmpireDoctrineDiagram() {
  const nodes = [
    { label: "early institutions", sub: "architects · engineers", era: "historical" },
    { label: "scientific societies", sub: "shared research", era: "early modern" },
    { label: "public research groups", sub: "darpa · bell labs · nasa", era: "modern" },
    { label: "asherin research", sub: "hosrad", era: "2026 — present", accent: true },
  ];
  return (
    <div className="relative rounded-2xl border border-foreground/10 bg-card/30 backdrop-blur-xl p-6 sm:p-8">
      <div className="mb-4 flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-foreground/50">
        <Compass className="h-3 w-3" /> a short history of organized research
      </div>
      <div className="relative grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* connecting rail */}
        <div className="hidden md:block absolute top-6 left-[6%] right-[6%] h-px bg-gradient-to-r from-foreground/10 via-foreground/30 to-amber-400/60" />
        {nodes.map((n) => (
          <div key={n.label} className="relative">
            <div className={`h-3 w-3 rounded-full ring-4 ring-background mx-auto mb-3 ${n.accent ? "bg-amber-400 shadow-[0_0_20px_hsl(45_100%_60%/0.5)]" : "bg-foreground/40"}`} />
            <div className="text-center">
              <div className={`text-[11px] tracking-[0.15em] uppercase ${n.accent ? "text-amber-300/90" : "text-foreground/80"}`}>{n.label}</div>
              <div className="text-[10px] text-foreground/50 mt-1">{n.sub}</div>
              <div className="text-[9px] font-mono text-foreground/30 mt-1">{n.era}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * DIAGRAM 2 — HOSRAD Research Loop (Theory → Prototype → Battle-Test → Ship)
 * ──────────────────────────────────────────────────────────────────── */
function ResearchLoopDiagram() {
  const steps = [
    { icon: Brain, label: "Theory", desc: "First-principle drop, no citation worship." },
    { icon: FlaskConical, label: "Prototype", desc: "Minimum viable artifact in weeks, not quarters." },
    { icon: Shield, label: "Battle-Test", desc: "Adversarial red team + real-world load." },
    { icon: Rocket, label: "Ship", desc: "Into House Of Asher production. No shelf-ware." },
  ];
  return (
    <div className="rounded-2xl border border-foreground/10 bg-card/30 backdrop-blur-xl p-6 sm:p-8">
      <div className="mb-5 flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-foreground/50">
        <Layers className="h-3 w-3" /> Workflow · The HOSRAD Loop
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {steps.map((s, i) => (
          <div key={s.label} className="relative rounded-xl border border-foreground/10 bg-background/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <s.icon className="h-4 w-4 text-amber-300/80" strokeWidth={1.4} />
              <span className="text-[9px] font-mono text-foreground/30">0{i + 1}</span>
            </div>
            <div className="text-sm font-light tracking-wide text-foreground">{s.label}</div>
            <div className="text-[11px] text-foreground/55 mt-1 leading-relaxed">{s.desc}</div>
            {i < steps.length - 1 && (
              <ArrowRight className="hidden lg:block absolute top-1/2 -right-3 h-3 w-3 text-foreground/25 -translate-y-1/2" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────
 * DIAGRAM 3 — Research Domains (Radial "atom" of active domains)
 * ──────────────────────────────────────────────────────────────────── */
function DomainsRadial() {
  const domains = [
    { icon: Brain, label: "AI Cognition" },
    { icon: Atom, label: "Quantum Computing" },
    { icon: Shield, label: "Military Systems" },
    { icon: Radar, label: "OSINT · Sensors" },
    { icon: Zap, label: "Civilian Safety" },
    { icon: Cpu, label: "Silicon · Firmware" },
    { icon: Beaker, label: "Bio · Materials" },
    { icon: Lock, label: "Cryptography" },
  ];
  return (
    <div className="rounded-2xl border border-foreground/10 bg-card/30 backdrop-blur-xl p-6 sm:p-8">
      <div className="mb-5 flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-foreground/50">
        <Target className="h-3 w-3" /> Research Domains · Full Spectrum
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {domains.map((d) => (
          <div key={d.label} className="group rounded-xl border border-foreground/10 bg-background/30 p-4 flex flex-col items-center gap-2 hover:border-amber-400/40 hover:bg-background/50 transition-all">
            <d.icon className="h-4 w-4 text-foreground/70 group-hover:text-amber-300/90 transition-colors" strokeWidth={1.4} />
            <div className="text-[11px] tracking-wide text-center text-foreground/80">{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────── */

export default function Hosrad() {
  // JSON-LD for the R&D division. Global title/description handled by RouteSeo
  // once /hosrad is added to its map. Adding Organization schema here so
  // "House Of Asher · Research & Development" is a citable entity.
  useEffect(() => {
    const id = "hosrad-jsonld";
    document.getElementById(id)?.remove();
    const s = document.createElement("script");
    s.type = "application/ld+json";
    s.id = id;
    s.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "HOSRAD — House Of Asher Research & Development",
      alternateName: "HOSRAD",
      url: "https://asherin.com/hosrad",
      parentOrganization: {
        "@type": "Organization",
        name: "House Of Asher",
        url: "https://asherin.com",
      },
      description:
        "HOSRAD is the research & development division of the House Of Asher. Advanced research across AI, quantum computing, military systems, and civilian safety technology.",
    });
    document.head.appendChild(s);
    return () => { document.getElementById(id)?.remove(); };
  }, []);

  return (
    <div className="min-h-screen text-foreground relative">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-32">
        {/* Back nav */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-foreground/50 hover:text-foreground/80 transition-colors mb-10"
        >
          <ArrowLeft className="h-3 w-3" /> Return
        </Link>

        {/* ── HERO ─────────────────────────────────────────────────── */}
        <header className="mb-16">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.35em] uppercase text-amber-300/70 mb-5">
            <span className="h-px w-8 bg-amber-400/40" />
            House Of Asher · Division IV
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-extralight tracking-[0.02em] text-foreground leading-[0.95]">
            HOSRAD
          </h1>
          <p className="mt-4 text-[13px] tracking-[0.15em] uppercase text-foreground/60">
            Research & Development
          </p>
          <p className="mt-8 max-w-3xl text-base sm:text-lg font-light leading-relaxed text-foreground/75">
            hosrad is the house of asher research and development group. it studies
            ideas that may support useful technology and, where practical,{" "}
            <span className="text-amber-300/90">turns that research into testable prototypes</span>.
          </p>
          <p className="mt-4 max-w-3xl text-sm font-light leading-relaxed text-foreground/60">
            the group learns from public laboratories, universities, independent
            researchers, and earlier institutions while remaining honest about the
            limited scale and early stage of its own work.
          </p>
        </header>

        {/* ── DOCTRINE DIAGRAM ────────────────────────────────────── */}
        <section className="mb-14">
          <EmpireDoctrineDiagram />
        </section>

        {/* ── MISSION CARDS ───────────────────────────────────────── */}
        <section className="mb-14 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: Sparkles,
              tag: "Mandate",
              title: "study emerging questions",
              body:
                "we explore questions that appear useful, including work that may not yet receive broad attention.",
            },
            {
              icon: Building2,
              tag: "Structure",
              title: "independent and accountable",
              body:
                "a small team can test ideas carefully, document limitations, and share useful results without unnecessary process.",
            },
            {
              icon: Users,
              tag: "Selection",
              title: "Talent over credentials",
              body:
                "formal education is one path among many. applications are reviewed through demonstrated work, clear reasoning, honesty, and respect for others.",
            },
          ].map((c) => (
            <article key={c.title} className="rounded-2xl border border-foreground/10 bg-card/30 backdrop-blur-xl p-6">
              <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-foreground/45 mb-4">
                <c.icon className="h-3 w-3" /> {c.tag}
              </div>
              <h2 className="text-lg font-light tracking-wide text-foreground mb-2">{c.title}</h2>
              <p className="text-[13px] font-light leading-relaxed text-foreground/60">{c.body}</p>
            </article>
          ))}
        </section>

        {/* ── RESEARCH LOOP DIAGRAM ───────────────────────────────── */}
        <section className="mb-14">
          <ResearchLoopDiagram />
        </section>

        {/* ── DOMAINS DIAGRAM ─────────────────────────────────────── */}
        <section className="mb-14">
          <DomainsRadial />
        </section>

        {/* ── COMPETITIVE STANCE ──────────────────────────────────── */}
        <section className="mb-14 rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-400/5 to-transparent p-8">
          <div className="flex items-start gap-4">
            <div className="h-8 w-8 rounded-lg border border-amber-400/40 bg-amber-400/5 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-amber-300" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-light tracking-wide text-foreground mb-2">
                applications are reviewed carefully and respectfully.
              </h2>
              <p className="text-sm font-light leading-relaxed text-foreground/70">
                a degree, former employer, or government contract does not decide
                an application. we look for careful work, sound reasoning, and
                honesty. please complete the application below truthfully; each
                submission receives the same review standard.
              </p>
            </div>
          </div>
        </section>

        {/* ── APPLICATION FORM PLACEHOLDER ────────────────────────── */}
        <section id="apply" className="mb-8">
          <div className="rounded-2xl border border-foreground/15 bg-card/40 backdrop-blur-xl p-8">
            <div className="flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-foreground/45 mb-3">
              <ClipboardList className="h-3 w-3" /> Application · Coming Online Shortly
            </div>
            <h2 className="text-2xl font-light tracking-wide text-foreground mb-3">
              HOSRAD Application
            </h2>
            <p className="text-sm font-light text-foreground/60 max-w-2xl leading-relaxed">
              The application form will be published here in a subsequent
              release. When it opens, submissions route directly to the HOSRAD
              intake channel — reviewed by House Of Asher leadership, not a
              recruiter pipeline.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3 text-[11px] text-foreground/40">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Intake channel: pending
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1">
                Selection: rolling
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-foreground/15 px-3 py-1">
                Scope: full-spectrum R&D
              </span>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
