import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  ArrowLeft, ArrowRight, AlertTriangle, Target, Globe, Flame,
  Shield, Cpu, TrendingUp, Users, Crosshair, Zap, Clock,
  BarChart3, Activity, Skull, Atom, Radar,
} from "lucide-react";

const convergenceFactors = [
  {
    icon: Users,
    title: "Demographic Window Closure",
    description:
      "China's demographic window CLOSES after 2030. Every year past 2030, China gets older, weaker, and less capable of projecting military power. The CCP's own internal studies confirm this. If China is EVER going to take Taiwan, it is in the Late 2026 – Mid 2027 window or NEVER.",
  },
  {
    icon: Cpu,
    title: "TSMC Semiconductor Strangulation",
    description:
      "Taiwan produces 90%+ of the world's advanced chips. U.S. chip sanctions (2022–2025) are slowly strangling China's tech sector. Every month that passes, China falls further behind in AI, weapons, and advanced economy. The longer China waits, the worse its position gets.",
  },
  {
    icon: Crosshair,
    title: "PLAN Amphibious Capacity",
    description:
      "The People's Liberation Army Navy reaches amphibious invasion capacity around 2027–2028. Landing craft, carriers, and satellite-kill weapons are being built at wartime production speed RIGHT NOW. The hardware isn't ready today. It will be by 2027.",
  },
  {
    icon: Globe,
    title: "Multi-Theater Escalation",
    description:
      "China moves on Taiwan → that is the tripwire that pulls Russia, Iran, and North Korea into simultaneous escalation across ALL theaters. Ukraine, Middle East, Korean Peninsula, Pacific — all ignite in a single cascade.",
  },
];

const preWW3Events = [
  { year: "2022", event: "Russia invades Ukraine — the opening shot", icon: Flame },
  { year: "2022", event: "U.S. CHIPS Act + October chip sanctions against China", icon: Cpu },
  { year: "2023", event: "Gaza conflict erupts — Middle East theater activated", icon: AlertTriangle },
  { year: "2023–24", event: "Red Sea shipping attacks — global supply chain pressure", icon: Globe },
  { year: "2024", event: "Taiwan blockade drills — Pacific theater rehearsals", icon: Crosshair },
  { year: "2024–25", event: "SWIFT weaponization + BRICS currency talks — financial decoupling", icon: TrendingUp },
  { year: "2025", event: "Expanded chip sanctions — tech strangulation accelerates", icon: Zap },
];

const planetaryIndicators = [
  {
    indicator: "Mars-Saturn Vedha",
    status: "ACTIVE",
    detail: "Mutual obstruction forming through 2025–2026 transit cycle",
    severity: "critical",
  },
  {
    indicator: "Rahu Affliction",
    status: "ACTIVE",
    detail: "Afflicting the Fiery Triangle (Aries/Leo/Sagittarius) — War Nakshatras lit",
    severity: "critical",
  },
  {
    indicator: "Jupiter Position",
    status: "WEAKENED",
    detail: "Debilitated relative to the Vedha — diplomatic buffer removed",
    severity: "high",
  },
  {
    indicator: "Sankranti Purusha 2025",
    status: "MARS DOMINANT",
    detail: "April 14, 2025 — designates 2025–2026 as a War Year by Solar Map",
    severity: "critical",
  },
];

const trajectoryData = [
  { metric: "Outbreak Window", reading: "Late 2026 — Mid 2027" },
  { metric: "Highest Risk Month", reading: "October 2026 / March 2027" },
  { metric: "Trigger Zone", reading: "Taiwan Strait or expanded Middle East corridor" },
  { metric: "Probability Confidence", reading: "78% trajectory lock" },
  { metric: "Mars-Saturn Vedha Peak", reading: "Saturn enters Aries / Mars activates Fiery Triangle — Q4 2026" },
  { metric: "Eclipse Detonator", reading: "Solar Eclipse visibility over conflict capitals — 2026 alignment" },
];

const WW3 = () => {
  useEffect(() => {
    document.title = "WW3 Trajectory Analysis — Aureon";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Aureon Predictive Intelligence WW3 trajectory analysis — Sanghatta Rashi Protocol + geopolitical convergence modeling. Eyes Only.");
  }, []);

  return (
    <LandingBackground>
      <Header />

      {/* Back link */}
      <div className="relative z-10 pt-24 px-6">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-light tracking-wide text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
      </div>

      {/* Hero */}
      <section className="relative z-10 flex min-h-[60vh] flex-col items-center justify-center px-6 pt-8 text-center">
        <div className="rounded-full border border-destructive/30 bg-destructive/5 backdrop-blur-md px-4 py-1.5 mb-8">
          <span className="text-[10px] font-light tracking-[0.3em] text-destructive uppercase">🔴 Eyes Only — Classified Intelligence</span>
        </div>
        <h1 className="max-w-4xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight text-foreground">
          WW3 Trajectory
          <br />
          <span className="text-muted-foreground">Analysis.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          Pre-WW3 already started. You are living in it. It began <span className="text-foreground font-light">February 24, 2022</span>.
          Everything since — Ukraine, Gaza, Red Sea attacks, Taiwan drills, chip sanctions, SWIFT weaponization,
          BRICS currency talks — that is ALL pre-WW3. You are in the warm-up round right now.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link to="/feature/predictive" className="group flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90">
            Predictive Intelligence <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link to="/pricing" className="rounded-xl border border-border/30 px-8 py-3 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/5">
            Get Access
          </Link>
        </div>
      </section>

      {/* How Our Algorithm Predicts This */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center mb-16">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            How The Prediction Algorithm Works
          </h2>
          <p className="text-sm font-extralight text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Aureon's prediction engine fuses two independent signal systems: <span className="text-foreground">geopolitical convergence modeling</span> (material reality — demographics, economics, military capacity) and the <span className="text-foreground">Sanghatta Rashi Protocol</span> (astrological trajectory analysis — Mars-Saturn Vedha, Shoola Chakra, Eclipse Detonators). When both systems independently converge on the same window, the confidence lock exceeds 75%.
          </p>
        </div>
        <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step: "01", icon: Radar, title: "Signal Detection", desc: "Scans geopolitical, financial, and military data sources alongside planetary transit calculations to detect convergence patterns." },
            { step: "02", icon: Atom, title: "Dual-System Correlation", desc: "The Sanghatta Rashi Protocol (Mars-Saturn Vedha, Rahu affliction) is cross-referenced with material indicators (demographics, chip supply, military readiness)." },
            { step: "03", icon: Target, title: "Trajectory Lock", desc: "When both systems point to the same 24-month window, the algorithm outputs a probability lock with confidence scoring and timeline estimation." },
          ].map(({ step, icon: Icon, title, desc }) => (
            <div key={step} className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 text-center">
              <div className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/40 mb-4">{step}</div>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
                <Icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-sm font-light tracking-wide text-foreground mb-2">{title}</h3>
              <p className="text-xs font-extralight text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pre-WW3 Timeline */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center mb-16">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            Pre-WW3 Timeline
          </h2>
          <p className="text-sm font-extralight text-muted-foreground max-w-2xl mx-auto">
            The opening shots already happened. Here is the sequence.
          </p>
        </div>
        <div className="mx-auto max-w-3xl space-y-3">
          {preWW3Events.map((e, i) => (
            <div key={i} className="flex items-start gap-4 rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 border border-destructive/20">
                <e.icon className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <span className="text-[10px] font-light tracking-[0.2em] text-muted-foreground/50 uppercase">{e.year}</span>
                <p className="text-sm font-light text-foreground mt-0.5">{e.event}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Convergence Factors */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center mb-16">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            Why China. Why Taiwan. Why 2027–2029.
          </h2>
          <p className="text-sm font-extralight text-muted-foreground max-w-2xl mx-auto">
            The trigger is not a speech or a declaration. The trigger is a calculation. The moment Beijing calculates
            that waiting costs MORE than acting — that is the day.
          </p>
        </div>
        <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6">
          {convergenceFactors.map((f, i) => (
            <div key={i} className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
                <f.icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-sm font-light tracking-wide text-foreground mb-3">{f.title}</h3>
              <p className="text-xs font-extralight text-muted-foreground leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Planetary War Indicators */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center mb-16">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            Sanghatta Rashi Protocol — Planetary War Indicators
          </h2>
          <p className="text-sm font-extralight text-muted-foreground max-w-2xl mx-auto">
            The 2025–2027 transit window. Running Sanghatta Rashi Protocol + Shoola Chakra + Trajectory Analysis simultaneously.
          </p>
        </div>
        <div className="mx-auto max-w-3xl space-y-3">
          {planetaryIndicators.map((p, i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-5">
              <div className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-light tracking-wider uppercase ${
                p.severity === "critical"
                  ? "bg-destructive/10 text-destructive border border-destructive/20"
                  : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
              }`}>
                {p.status}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-light text-foreground">{p.indicator}</p>
                <p className="text-xs font-extralight text-muted-foreground mt-0.5">{p.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Trajectory Output Table */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center mb-16">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            Strategic Prediction Output
          </h2>
          <p className="text-sm font-extralight text-muted-foreground max-w-2xl mx-auto">
            Probability Cloud — derived from dual-system convergence analysis.
          </p>
        </div>
        <div className="mx-auto max-w-3xl rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md overflow-hidden">
          {trajectoryData.map((row, i) => (
            <div key={i} className={`flex items-center justify-between px-6 py-4 ${i < trajectoryData.length - 1 ? "border-b border-border/10" : ""}`}>
              <span className="text-xs font-light text-muted-foreground">{row.metric}</span>
              <span className="text-xs font-light text-foreground text-right max-w-[60%]">{row.reading}</span>
            </div>
          ))}
        </div>
      </section>

      {/* The Deep State Decode */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 backdrop-blur-md p-8 sm:p-12">
            <div className="flex items-center gap-3 mb-6">
              <Skull className="h-5 w-5 text-destructive" />
              <h2 className="text-lg font-light tracking-wide text-foreground">The Deep State Decode</h2>
            </div>
            <div className="space-y-4 text-sm font-extralight leading-relaxed text-muted-foreground">
              <p>
                The media says: <span className="text-foreground italic">"Tensions are high but diplomacy is working. Leaders are meeting. There is no imminent global war."</span>
              </p>
              <p className="text-foreground font-light">The Physics say otherwise.</p>
              <p>
                A missile traveling at Mach 5 toward a city does not need a press conference to announce impact. The Physics dictate the outcome.
              </p>
              <p className="text-xs text-muted-foreground/60 mt-6">
                Current Momentum Vectors: NATO expansion pressure → unresolved kinetic loop · Taiwan Strait military buildup → escalation trajectory unchanged · Middle East proxy war → resource war already active · Nuclear posture changes (multiple nations) → Shoola (Spear) pointed East.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Divine Logic */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-6">
            The Divine Logic
          </h2>
          <p className="text-sm font-extralight text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            The Kali Yuga compression cycle is accelerating. The Archon-managed entropy system requires
            a controlled demolition of the old financial/political order. WW3 is not a "war" — it is a
            <span className="text-foreground font-light"> System Reboot</span> executed through kinetic force.
          </p>
        </div>
      </section>

      {/* Strategic Action */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl text-center mb-16">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            Strategic Action For The Seeker
          </h2>
        </div>
        <div className="mx-auto max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: TrendingUp,
              title: "Resource Positioning",
              desc: "Gold (Sun/Leo transit spike incoming), Oil (Saturn/Scorpio affliction = supply disruption). Position before the macro window opens.",
            },
            {
              icon: Globe,
              title: "Geographic Awareness",
              desc: "The Shoola (Spear) is pointed East — Pacific theater is the primary ignition zone. Adjust geographic exposure accordingly.",
            },
            {
              icon: Activity,
              title: "Personal Dasha Cross-Reference",
              desc: "Run your personal Dasha against the Q4 2026 macro window. Where your Dasha aligns with the macro war window = maximum signal strength.",
            },
          ].map((a, i) => (
            <div key={i} className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
                <a.icon className="h-5 w-5 text-accent" />
              </div>
              <h3 className="text-sm font-light tracking-wide text-foreground mb-2">{a.title}</h3>
              <p className="text-xs font-extralight text-muted-foreground leading-relaxed">{a.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-24 text-center">
        <div className="mx-auto max-w-2xl">
          <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground/40 uppercase mb-6">
            ZOPHIEL — Intelligence Of The North · Aureon Truth Engine
          </p>
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-6">
            Access The Full Prediction Engine.
          </h2>
          <Link to="/pricing" className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90">
            Get Access <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      {/* Footer spacing */}
      <div className="h-24" />
    </LandingBackground>
  );
};

export default WW3;
