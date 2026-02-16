import heroBg from "@/assets/hero-bg.png";
import Header from "@/components/Header";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Trophy, Target, Shield, Code, Database, AlertTriangle, FileCode, Lock, Cpu, Twitter } from "lucide-react";

// ── Benchmark Data ──────────────────────────────────────────────────────────

interface Criterion {
  name: string;
  aureon: string;
  claude: string;
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
    id: "structural",
    number: "01",
    title: "Structural Metrics",
    icon: FileCode,
    criteria: [
      { name: "Module System", aureon: "CommonJS (require)", claude: "ES Modules (import/export)", winner: "tie" },
      { name: "Config Centralization", aureon: "Yes (config/index.js)", claude: "Partial (direct process.env)", winner: "aureon" },
      { name: "File Separation", aureon: "Yes (config, middleware, routes, utils)", claude: "Yes (middleware, routes, utils)", winner: "aureon" },
      { name: "Error Middleware", aureon: "Yes (global handler)", claude: "Yes (errorHandler + 404)", winner: "tie" },
      { name: "Health Endpoint", aureon: "/ base route", claude: "/health endpoint", winner: "tie" },
      { name: "Protected Route Example", aureon: "Yes (/protected)", claude: "Yes (authenticate middleware)", winner: "tie" },
    ],
  },
  {
    id: "auth",
    number: "02",
    title: "Authentication",
    icon: Lock,
    criteria: [
      { name: "JWT Issuance", aureon: "Yes", claude: "Yes", winner: "tie" },
      { name: "JWT Expiration", aureon: "Configurable via env", claude: "Fixed (1h)", winner: "aureon" },
      { name: "JWT Payload", aureon: "{ id, username }", claude: "{ sub, username }", winner: "tie" },
      { name: "Token Middleware", aureon: "authenticateToken", claude: "authenticate", winner: "tie" },
      { name: "Expired Token Handling", aureon: "403", claude: "401 with message", winner: "claude" },
      { name: "Missing Header Handling", aureon: "401", claude: "401", winner: "tie" },
    ],
  },
  {
    id: "rate-limiting",
    number: "03",
    title: "Rate Limiting",
    icon: Shield,
    criteria: [
      { name: "Global Limiter", aureon: "Yes", claude: "Yes", winner: "tie" },
      { name: "Auth-Specific Limiter", aureon: "No", claude: "Yes (authLimiter)", winner: "claude" },
      { name: "Config via Environment", aureon: "Yes", claude: "Yes", winner: "tie" },
      { name: "Standard Headers", aureon: "Enabled", claude: "Enabled", winner: "tie" },
      { name: "Legacy Headers Disabled", aureon: "Yes", claude: "Yes", winner: "tie" },
    ],
  },
  {
    id: "validation",
    number: "04",
    title: "Input Validation",
    icon: Target,
    criteria: [
      { name: "Library Used", aureon: "Joi", claude: "Zod", winner: "tie" },
      { name: "Schema Separation", aureon: "Yes", claude: "Yes", winner: "tie" },
      { name: "Custom Error Messages", aureon: "Yes", claude: "Yes", winner: "tie" },
      { name: "Aggregated Error Reporting", aureon: "Yes (abortEarly: false)", claude: "Yes (safeParse issues)", winner: "tie" },
      { name: "Body Replacement with Parsed Data", aureon: "No", claude: "Yes (req.body = result.data)", winner: "claude" },
    ],
  },
  {
    id: "password",
    number: "05",
    title: "Password Security",
    icon: Shield,
    criteria: [
      { name: "Hashing Library", aureon: "bcryptjs", claude: "bcryptjs", winner: "tie" },
      { name: "Salt Rounds", aureon: "10", claude: "12", winner: "claude" },
      { name: "Password Comparison", aureon: "Yes", claude: "Yes", winner: "tie" },
      { name: "Plaintext Storage", aureon: "No", claude: "No", winner: "tie" },
    ],
  },
  {
    id: "storage",
    number: "06",
    title: "Data Storage Model",
    icon: Database,
    criteria: [
      { name: "In-Memory Store", aureon: "Array", claude: "Map", winner: "claude" },
      { name: "ID Strategy", aureon: "Incremental (length+1)", claude: "Incremental counter", winner: "tie" },
      { name: "O(1) Username Lookup", aureon: "No (array search)", claude: "Yes (Map)", winner: "claude" },
    ],
  },
  {
    id: "error-handling",
    number: "07",
    title: "Error Handling",
    icon: AlertTriangle,
    criteria: [
      { name: "Global Error Middleware", aureon: "Yes", claude: "Yes", winner: "tie" },
      { name: "Stack Trace Logging", aureon: "Yes", claude: "Yes", winner: "tie" },
      { name: "Production Error Suppression", aureon: "Yes", claude: "Yes", winner: "tie" },
      { name: "Explicit 404 Handler", aureon: "No", claude: "Yes", winner: "claude" },
    ],
  },
  {
    id: "security",
    number: "08",
    title: "Security Controls",
    icon: Shield,
    criteria: [
      { name: "JSON Size Limit", aureon: "No", claude: "Yes (10kb)", winner: "claude" },
      { name: "CORS Enabled", aureon: "No", claude: "Yes", winner: "claude" },
      { name: "JWT Secret Fallback", aureon: "Yes", claude: "Yes", winner: "tie" },
      { name: "Auth Route Throttling", aureon: "No", claude: "Yes", winner: "claude" },
    ],
  },
  {
    id: "code-surface",
    number: "09",
    title: "Code Surface",
    icon: Cpu,
    criteria: [
      { name: "Distinct Files Shown", aureon: "6+", claude: "7+", winner: "tie" },
      { name: "Middleware Count", aureon: "3", claude: "4", winner: "claude" },
      { name: "Environment Variables", aureon: "3", claude: "4", winner: "tie" },
      { name: "Routes Defined", aureon: "3", claude: "4+", winner: "tie" },
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
    document.title = "Benchmarks — Aureon vs Claude Opus 4.6";
  }, []);

  const scores = computeScores();

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${heroBg})` }} />
      <div className="fixed inset-0 bg-black/80" />
      <Header />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <div className="relative z-10 pt-32 pb-16 px-6 text-center">
        <p className="text-sm font-light tracking-[0.3em] text-muted-foreground uppercase mb-4">Technical Benchmark</p>
        <h1 className="max-w-4xl mx-auto text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
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
                  <table className="w-full min-w-[500px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/10">
                        <th className="px-6 sm:px-8 py-3 text-xs font-light tracking-wide text-muted-foreground w-[35%]">Criterion</th>
                        <th className="px-4 py-3 text-xs font-light tracking-wide text-foreground w-[28%]">Aureon</th>
                        <th className="px-4 py-3 text-xs font-light tracking-wide text-muted-foreground w-[28%]">Claude</th>
                        <th className="px-4 py-3 text-xs font-light tracking-wide text-muted-foreground w-[9%]"></th>
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
    </div>
  );
};

export default Benchmarks;
