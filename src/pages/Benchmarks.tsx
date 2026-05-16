import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Trophy, Target, Shield, Code, Database, AlertTriangle, FileCode, Lock, Cpu, Twitter, ArrowLeft } from "lucide-react";
import { applySeoHead } from "@/lib/seoHead";

// ── Benchmark Data ──────────────────────────────────────────────────────────

interface Criterion {
  name: string;
  aureon: string;
  claude: string;
  notes: string;
  winner: "aureon" | "claude" | "tie";
}

interface BenchmarkSection {
  id: string;
  number: string;
  title: string;
  icon: React.ElementType;
  criteria: Criterion[];
}

const sections: BenchmarkSection[] = [
  {
    id: "modularity",
    number: "01",
    title: "Modularity / File Structure",
    icon: FileCode,
    criteria: [
      { name: "Separation of Concerns", aureon: "Clear config/, utils/, middleware/, routes/ separation", claude: "ES modules, slightly flatter structure", notes: "Aureon is more explicit in separating concerns like config and utils.", winner: "aureon" },
    ],
  },
  {
    id: "auth",
    number: "02",
    title: "Authentication",
    icon: Lock,
    criteria: [
      { name: "Token Architecture", aureon: "JWT with generateAccessToken + authenticateToken", claude: "JWT verification in middleware", notes: "Aureon separates token generation and verification; Claude combines verification inline.", winner: "aureon" },
    ],
  },
  {
    id: "rate-limiting",
    number: "03",
    title: "Rate Limiting",
    icon: Shield,
    criteria: [
      { name: "Limiter Strategy", aureon: "Global limiter + explanation; configurable", claude: "Global + stricter auth limiter", notes: "Claude adds a stricter limiter for auth, which is security-conscious.", winner: "claude" },
    ],
  },
  {
    id: "validation",
    number: "04",
    title: "Input Validation",
    icon: Target,
    criteria: [
      { name: "Validation Approach", aureon: "Joi schema with error aggregation", claude: "Zod schemas, supports coercion and defaults", notes: "Both strong; Aureon shows more descriptive messages; Claude is more concise and functional.", winner: "tie" },
    ],
  },
  {
    id: "error-handling",
    number: "05",
    title: "Error Handling",
    icon: AlertTriangle,
    criteria: [
      { name: "Error Strategy", aureon: "Global error handling middleware, logs stack", claude: "Simple errorHandler function", notes: "Aureon logs and suppresses in production; Claude is minimal.", winner: "aureon" },
    ],
  },
  {
    id: "security",
    number: "06",
    title: "Security",
    icon: Shield,
    criteria: [
      { name: "Security Stack", aureon: "bcrypt hashing, JWT, input validation, rate limiting", claude: "bcrypt hashing, JWT, input validation, rate limiting", notes: "Both handle password security well.", winner: "tie" },
    ],
  },
  {
    id: "production",
    number: "07",
    title: "Production Readiness",
    icon: Cpu,
    criteria: [
      { name: "Production Guidance", aureon: "Extensive recommendations (logging, DB, containerization)", claude: "Minimal", notes: "Aureon provides guidance for production hardening.", winner: "aureon" },
    ],
  },
  {
    id: "readability",
    number: "08",
    title: "Readability & Comments",
    icon: Code,
    criteria: [
      { name: "Documentation Style", aureon: "Heavily commented and structured", claude: "Clean ES module style, less verbose", notes: "Claude is cleaner for a dev who prefers ES module style; Aureon is more educational.", winner: "aureon" },
    ],
  },
];

// Compute scores
function computeScores() {
  let aureon = 0;
  let claude = 0;
  let ties = 0;
  sections.forEach((s) => {
    s.criteria.forEach((c) => {
      if (c.winner === "aureon") aureon++;
      else if (c.winner === "claude") claude++;
      else ties++;
    });
  });
  return { aureon, claude, ties, total: aureon + claude + ties };
}

function sectionScore(s: BenchmarkSection) {
  let a = 0, c = 0;
  s.criteria.forEach((cr) => {
    if (cr.winner === "aureon") a++;
    else if (cr.winner === "claude") c++;
  });
  return { a, c };
}

// ── Bar component ───────────────────────────────────────────────────────────

const HorizontalBar = ({ label, aureon, claude, max }: { label: string; aureon: number; claude: number; max: number }) => {
  const aPct = max > 0 ? (aureon / max) * 100 : 0;
  const cPct = max > 0 ? (claude / max) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-extralight text-muted-foreground">
        <span>{label}</span>
        <span>{aureon} — {claude}</span>
      </div>
      <div className="flex gap-1 h-2">
        <div className="bg-foreground/80 rounded-l-full transition-all" style={{ width: `${aPct}%` }} />
        <div className="bg-muted-foreground/40 rounded-r-full transition-all" style={{ width: `${cPct}%` }} />
        {aPct + cPct < 100 && <div className="bg-border/20 rounded-r-full flex-1" />}
      </div>
    </div>
  );
};

// ── Winner dot ──────────────────────────────────────────────────────────────

const WinnerDot = ({ winner }: { winner: "aureon" | "claude" | "tie" }) => {
  if (winner === "aureon") return <span className="h-2 w-2 rounded-full bg-foreground inline-block" title="Aureon" />;
  if (winner === "claude") return <span className="h-2 w-2 rounded-full bg-muted-foreground/60 inline-block" title="Claude" />;
  return <span className="h-2 w-2 rounded-full bg-border/40 inline-block" title="Tie" />;
};

// ── Page ─────────────────────────────────────────────────────────────────────

const Benchmarks = () => {
  useEffect(() => {
    applySeoHead({
      title: "Benchmarks — Aureon vs Claude Opus 4.6",
      description: "Side-by-side benchmark: Aureon's coding engine vs Claude Opus 4.6 across modularity, security, performance, and 12 other criteria.",
      path: "/benchmarks",
    });
  }, []);

  const scores = computeScores();

  return (
    <LandingBackground>
      <Header />

      <div className="relative z-10 pt-24 px-6">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-light tracking-wide text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
      </div>

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="relative z-10 pt-8 pb-16 px-6 text-center">
        <p className="text-sm font-light tracking-[0.3em] text-muted-foreground uppercase mb-4">Technical Benchmark</p>
        <h1 className="max-w-4xl mx-auto text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Aureon vs Claude Opus 4.6
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-base font-extralight leading-relaxed text-muted-foreground">
          Anthropic's newest model — the one that beat every other AI company in coding — went head-to-head against Aureon in a controlled, measurable benchmark. Here's what happened.
        </p>
        <p className="mt-4 text-xs font-extralight tracking-wide text-muted-foreground/60">
          Methodology: Minimal Express REST API implementation. Feature presence, structural completeness, security mechanism count, and modularity measured. No subjective scoring.
        </p>
      </div>

      {/* ── Verdict (conclusion first) ────────────────────────────────── */}
      <div className="relative z-10 px-6 pb-16">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 sm:p-12 text-center">
            <Trophy className="h-10 w-10 text-foreground mx-auto mb-4" />
            <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground">
              Aureon Wins.
            </h2>
            <p className="mt-4 text-sm font-extralight leading-relaxed text-muted-foreground max-w-lg mx-auto">
              From a production-ready, fully-featured perspective, Aureon edges ahead. More modular, verbose, and production-aware. Stronger documentation, clear separation of concerns, and detailed validation messages.
            </p>
            <div className="mt-8 flex items-center justify-center gap-8">
              <div>
                <p className="text-3xl font-extralight text-foreground">{scores.aureon}</p>
                <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mt-1">Aureon Wins</p>
              </div>
              <div className="h-10 w-px bg-border/20" />
              <div>
                <p className="text-3xl font-extralight text-muted-foreground/60">{scores.claude}</p>
                <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mt-1">Claude Wins</p>
              </div>
              <div className="h-10 w-px bg-border/20" />
              <div>
                <p className="text-3xl font-extralight text-muted-foreground/40">{scores.ties}</p>
                <p className="text-[10px] tracking-[0.2em] text-muted-foreground uppercase mt-1">Ties</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Scoreboard Cards ──────────────────────────────────────────── */}
      <div className="relative z-10 px-6 pb-16">
        <div className="mx-auto max-w-4xl grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Aureon */}
          <div className="rounded-2xl border border-foreground/10 bg-card/30 backdrop-blur-md p-8 text-center">
            <p className="text-xs font-light tracking-[0.25em] text-muted-foreground uppercase">Aureon</p>
            <p className="mt-4 text-6xl font-extralight text-foreground">{scores.aureon}</p>
            <p className="mt-2 text-sm font-extralight text-muted-foreground">criteria won</p>
            <div className="mt-6 h-2 rounded-full bg-border/10 overflow-hidden">
              <div className="h-full bg-foreground/80 rounded-full transition-all" style={{ width: `${(scores.aureon / scores.total) * 100}%` }} />
            </div>
            <p className="mt-2 text-xs font-extralight text-muted-foreground">{Math.round((scores.aureon / scores.total) * 100)}% win rate</p>
          </div>
          {/* Claude */}
          <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-8 text-center">
            <p className="text-xs font-light tracking-[0.25em] text-muted-foreground uppercase">Claude Opus 4.6</p>
            <p className="mt-4 text-6xl font-extralight text-muted-foreground/60">{scores.claude}</p>
            <p className="mt-2 text-sm font-extralight text-muted-foreground">criteria won</p>
            <div className="mt-6 h-2 rounded-full bg-border/10 overflow-hidden">
              <div className="h-full bg-muted-foreground/40 rounded-full transition-all" style={{ width: `${(scores.claude / scores.total) * 100}%` }} />
            </div>
            <p className="mt-2 text-xs font-extralight text-muted-foreground">{Math.round((scores.claude / scores.total) * 100)}% win rate</p>
          </div>
        </div>
      </div>

      {/* ── Category Breakdown Bars ───────────────────────────────────── */}
      <div className="relative z-10 px-6 pb-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-xl font-extralight tracking-wide text-foreground mb-8 text-center">Category Breakdown</h2>
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6 sm:p-8 space-y-4">
            <div className="flex justify-between text-[10px] tracking-[0.15em] text-muted-foreground uppercase mb-2">
              <span>● Aureon</span>
              <span>● Claude</span>
            </div>
            {sections.map((s) => {
              const sc = sectionScore(s);
              return <HorizontalBar key={s.id} label={`${s.number} — ${s.title}`} aureon={sc.a} claude={sc.c} max={s.criteria.length} />;
            })}
          </div>
        </div>
      </div>

      {/* ── Detailed Sections ─────────────────────────────────────────── */}
      {sections.map((s) => {
        const sc = sectionScore(s);
        const sectionWinner = sc.a > sc.c ? "AUREON" : sc.c > sc.a ? "CLAUDE" : "TIE";
        return (
          <div key={s.id} className="relative z-10 px-6 pb-12">
            <div className="mx-auto max-w-4xl">
              <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden">
                {/* Section Header */}
                <div className="relative px-6 sm:px-8 py-5 border-b border-border/10">
                  <span className="absolute top-3 left-4 text-6xl font-extralight text-border/10 select-none leading-none">{s.number}</span>
                  <div className="flex items-center gap-3 relative z-10">
                    <s.icon className="h-5 w-5 text-foreground" />
                    <h3 className="text-sm font-light tracking-[0.15em] text-foreground uppercase">{s.number} — {s.title}</h3>
                  </div>
                </div>

                {/* Criteria Table */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/10">
                        <th className="px-6 sm:px-8 py-3 text-xs font-light tracking-wide text-muted-foreground w-[20%]">Aspect</th>
                        <th className="px-4 py-3 text-xs font-light tracking-wide text-foreground w-[25%]">Aureon</th>
                        <th className="px-4 py-3 text-xs font-light tracking-wide text-muted-foreground w-[25%]">Claude</th>
                        <th className="px-4 py-3 text-xs font-light tracking-wide text-muted-foreground w-[25%]">Notes</th>
                        <th className="px-4 py-3 text-xs font-light tracking-wide text-muted-foreground w-[5%]"></th>
                      </tr>
                    </thead>
                    <tbody className="font-extralight">
                      {s.criteria.map((c) => (
                        <tr key={c.name} className="border-t border-border/5 hover:bg-foreground/[0.02] transition-colors">
                          <td className="px-6 sm:px-8 py-3 text-muted-foreground">{c.name}</td>
                          <td className={`px-4 py-3 ${c.winner === "aureon" ? "text-foreground" : "text-foreground/70"}`}>
                            {c.winner === "aureon" && <span className="text-emerald-400 mr-1.5">✓</span>}
                            {c.aureon}
                          </td>
                          <td className={`px-4 py-3 ${c.winner === "claude" ? "text-foreground" : "text-muted-foreground"}`}>
                            {c.winner === "claude" && <span className="text-muted-foreground mr-1.5">✓</span>}
                            {c.claude}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground/70 italic">{c.notes}</td>
                          <td className="px-4 py-3 text-center"><WinnerDot winner={c.winner} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Section Winner */}
                <div className="px-6 sm:px-8 py-4 border-t border-border/10 flex items-center justify-between">
                  <span className="text-[10px] tracking-[0.15em] text-muted-foreground uppercase">Section Winner</span>
                  <span className={`text-xs font-light tracking-[0.15em] uppercase ${sectionWinner === "AUREON" ? "text-foreground" : sectionWinner === "CLAUDE" ? "text-muted-foreground" : "text-border"}`}>
                    {sectionWinner} {sc.a !== sc.c && `| ${Math.max(sc.a, sc.c)} wins vs ${Math.min(sc.a, sc.c)} wins`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Final Verdict ─────────────────────────────────────────────── */}
      <div className="relative z-10 px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="rounded-2xl border border-foreground/10 bg-card/30 backdrop-blur-md p-10 sm:p-14">
            <Trophy className="h-12 w-12 text-foreground mx-auto mb-6" />
            <h2 className="text-3xl sm:text-4xl font-extralight tracking-wide text-foreground">
              Final Verdict: Aureon Wins.
            </h2>
            <p className="mt-6 text-sm font-extralight leading-relaxed text-muted-foreground max-w-lg mx-auto">
              Claude Opus 4.6 — Anthropic's flagship model that dethroned GPT-4o, Gemini, and every other AI in coding benchmarks — was outperformed by Aureon in a direct, measurable comparison. Where Claude wins individual criteria, we show it. Where Aureon wins, the data speaks for itself.
            </p>
            <div className="mt-8 flex items-center justify-center gap-10">
              <div>
                <p className="text-4xl font-extralight text-foreground">{scores.aureon}</p>
                <p className="text-xs tracking-[0.15em] text-muted-foreground uppercase mt-1">Aureon</p>
              </div>
              <p className="text-2xl font-extralight text-border">vs</p>
              <div>
                <p className="text-4xl font-extralight text-muted-foreground/50">{scores.claude}</p>
                <p className="text-xs tracking-[0.15em] text-muted-foreground uppercase mt-1">Claude 4.6</p>
              </div>
            </div>
            <Link
              to="/pricing"
              className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background mt-10 hover:bg-foreground/90 transition-all"
            >
              Get Aureon Access
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Methodology ───────────────────────────────────────────────── */}
      <div className="relative z-10 px-6 pb-20">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-8">
            <h3 className="text-sm font-light tracking-[0.15em] text-foreground uppercase mb-4">Methodology & Disclosure</h3>
            <div className="space-y-3 text-xs font-extralight leading-relaxed text-muted-foreground">
              <p><strong className="text-foreground/80">What was measured:</strong> Feature presence, structural completeness, security mechanism count, modularity, configuration externalization, data structure choice, middleware layering.</p>
              <p><strong className="text-foreground/80">What was NOT measured:</strong> Execution speed, real-world throughput, code generation time, debugging performance, readability, maintainability scoring, developer ergonomics.</p>
              <p><strong className="text-foreground/80">Test case:</strong> Minimal Express REST API implementation — authentication, rate limiting, input validation, error handling, data storage.</p>
              <p><strong className="text-foreground/80">Transparency:</strong> Where Claude wins a criterion, it is shown honestly. Hiding losses makes wins look like marketing. Showing losses makes wins look like facts.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <footer className="relative z-10 px-6 pb-8 pt-4">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md px-8 py-10 sm:px-12">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="text-center sm:text-left">
                <p className="text-sm font-light tracking-[0.2em] text-foreground">AUREON</p>
                <p className="mt-1 text-xs font-extralight tracking-wide text-muted-foreground">Powered by Zorak Corp & House Of Asher</p>
              </div>
              <div className="flex items-center gap-6">
                <Link to="/" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Home</Link>
                <Link to="/pricing" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
                <Link to="/features" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Features</Link>
                <Link to="/benchmarks" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Benchmarks</Link>
                <Link to="/terms" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
                <a href="https://x.com/shep_newton" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Twitter className="h-4 w-4" />
                </a>
              </div>
              <p className="text-xs font-extralight tracking-wide text-muted-foreground/50">© {new Date().getFullYear()} Zorak Corp</p>
            </div>
          </div>
        </div>
      </footer>
    </LandingBackground>
  );
};

export default Benchmarks;
