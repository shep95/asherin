import { useEffect, useState } from "react";
import { Search, TrendingUp, Scale, ShieldAlert, FileSearch, Eye, Lock, Activity } from "lucide-react";

const USE_CASES = [
  { icon: Search, label: "OSINT" },
  { icon: TrendingUp, label: "Trading" },
  { icon: Scale, label: "Legal Discovery" },
  { icon: ShieldAlert, label: "Threat Intel" },
  { icon: FileSearch, label: "Forensics" },
  { icon: Eye, label: "Surveillance" },
  { icon: Lock, label: "Cyber Defense" },
  { icon: Activity, label: "Predictive Analytics" },
];

interface Testimonial {
  badge: string;
  tool: string;
  quote: string;
  initials: string;
  role: string;
  meta: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    badge: "Beta Operator",
    tool: "Aureon Chat",
    quote: "Every other model gave me caveats. Aureon gave me a forensic dossier — sourced, ranked, cross-validated, and ready to brief. Two hours of OSINT in twelve minutes.",
    initials: "D.K.",
    role: "Independent Investigator",
    meta: "Pro Tier · 6 months",
  },
  {
    badge: "Field Analyst",
    tool: "Zophiel Search",
    quote: "Thirty sources, cross-validated in one pass. What used to be a week of tab-juggling is now a single query with a veracity score on every claim.",
    initials: "M.R.",
    role: "OSINT Analyst",
    meta: "Aureon Tier · 4 months",
  },
  {
    badge: "Threat Hunter",
    tool: "NOMAD OSINT",
    quote: "The 14-pass dossier tree found a shell-company link on pass eleven that I would have missed entirely. It builds the case for you.",
    initials: "S.V.",
    role: "Corporate Investigator",
    meta: "Pro Tier · 9 months",
  },
  {
    badge: "Quant",
    tool: "Predictive Intelligence",
    quote: "Monte Carlo on corporate events with calibrated confidence bands. I stopped pretending my spreadsheet model was 'good enough'.",
    initials: "J.P.",
    role: "Hedge Fund Analyst",
    meta: "Pro Tier · 3 months",
  },
  {
    badge: "Red Team",
    tool: "ZERLAL Cyber",
    quote: "Domain recon, blast radius, kill chain — all stitched into one report. It thinks like an attacker, not a checklist.",
    initials: "A.T.",
    role: "Offensive Security",
    meta: "Pro Tier · 5 months",
  },
  {
    badge: "Designer",
    tool: "Vibe Imager",
    quote: "I storyboarded an entire campaign in an afternoon. The prompts feel like talking to an art director, not a slot machine.",
    initials: "L.C.",
    role: "Creative Director",
    meta: "Aureon Tier · 7 months",
  },
  {
    badge: "Architect",
    tool: "ZANOEM Design Lab",
    quote: "FEA and thermal sim wired straight into the chat loop. I iterate three concepts before lunch and the math actually checks out.",
    initials: "R.H.",
    role: "Mechanical Engineer",
    meta: "Aureon Tier · 5 months",
  },
  {
    badge: "Operator",
    tool: "Whiteboard",
    quote: "Infinite canvas with a Photoshop-grade layer stack and an AI that can read what I drew. It's the war-room I always wanted.",
    initials: "N.E.",
    role: "Strategy Consultant",
    meta: "Lifetime · 8 months",
  },
  {
    badge: "Author",
    tool: "E-book Generator",
    quote: "I dropped a folder of half-written chapters and got a clean manuscript back — voice intact, grammar fixed, no rewrites I didn't ask for.",
    initials: "T.B.",
    role: "Non-Fiction Writer",
    meta: "Aureon Tier · 2 months",
  },
  {
    badge: "Builder",
    tool: "Aureon IDE",
    quote: "Imagine-to-Code is unreal. I sketched a UI, it scaffolded the components, and I shipped the prototype the same evening.",
    initials: "K.W.",
    role: "Indie Founder",
    meta: "Lifetime · 11 months",
  },
];

const ROTATE_MS = 6000;

const TrustBand = () => {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % TESTIMONIALS.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused]);

  return (
    <div className="relative z-10 px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <p className="text-center text-[10px] font-medium tracking-[0.3em] text-muted-foreground/50 uppercase mb-8">
          Operators run Aureon for
        </p>

        {/* Marquee */}
        <div className="relative overflow-hidden mask-fade">
          <div className="flex gap-10 animate-marquee whitespace-nowrap">
            {[...USE_CASES, ...USE_CASES, ...USE_CASES].map((u, i) => {
              const Icon = u.icon;
              return (
                <div key={i} className="inline-flex items-center gap-2.5 shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground/60" />
                  <span className="text-sm font-light tracking-[0.2em] text-foreground/80 uppercase">{u.label}</span>
                  <span className="text-foreground/20 text-lg leading-none">·</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Testimonial slideshow (fade in/out) */}
        <div
          className="mt-14 max-w-3xl mx-auto"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="relative h-[300px] sm:h-[280px]">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                aria-hidden={i !== idx}
                className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                  i === idx ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                <div className="relative h-full rounded-2xl border border-border/30 bg-card/30 backdrop-blur-md px-8 py-10 sm:px-12 sm:py-12 flex flex-col justify-between">
                  <div className="absolute -top-3 left-8 flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full border border-border/30 bg-background/80 backdrop-blur text-[9px] tracking-[0.3em] uppercase text-muted-foreground/70">
                      {t.badge}
                    </span>
                    <span className="px-3 py-1 rounded-full border border-amber-300/30 bg-background/80 backdrop-blur text-[9px] tracking-[0.3em] uppercase text-amber-200/80">
                      {t.tool}
                    </span>
                  </div>
                  <p className="text-base sm:text-xl font-extralight leading-relaxed tracking-wide text-foreground/90 italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <div className="mt-6 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-foreground/10 border border-border/30 flex items-center justify-center text-[10px] tracking-[0.2em] text-foreground/70">
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-xs font-light tracking-wide text-foreground">{t.role}</p>
                      <p className="text-[10px] tracking-wider text-muted-foreground/60 uppercase">{t.meta}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Dots */}
          <div className="mt-5 flex items-center justify-center gap-1.5">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Show testimonial ${i + 1}`}
                className={`h-1 rounded-full transition-all ${
                  i === idx ? "w-6 bg-foreground/80" : "w-1.5 bg-foreground/20 hover:bg-foreground/40"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrustBand;
