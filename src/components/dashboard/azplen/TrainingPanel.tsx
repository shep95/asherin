import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, GraduationCap, Trophy, Play } from "lucide-react";

interface Scenario {
  id: string;
  title: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  domain: string;
  brief: string;
  expectedFindings: string;
}
interface Attempt {
  id: string;
  scenarioId: string;
  trainee: string;
  startedAt: number;
  completedAt?: number;
  findings: string;
  score?: number;
}

const KEY_S = "azplen:training:scenarios";
const KEY_A = "azplen:training:attempts";

const SEED: Scenario[] = [
  {
    id: "tr-1", title: "Layered Wire Cascade", difficulty: "intermediate", domain: "AML",
    brief: "ACME Holdings receives a $4.8M wire from a Latvian shell, which is broken into 14 sub-wires across 6 jurisdictions within 72 hours. Identify the layering pattern and the likely beneficial owner.",
    expectedFindings: "Triangular ownership · jurisdiction shopping · same registered agent across 4 entities · final consolidation in BVI nominee account.",
  },
  {
    id: "tr-2", title: "Insider Filing Cadence", difficulty: "advanced", domain: "Insider trading",
    brief: "An executive's Form 4 filings cluster in the 48h preceding three positive earnings surprises. Determine whether this is statistically anomalous and what predicate exists.",
    expectedFindings: "Filing cadence 7σ above baseline · earnings surprise correlation r=0.91 · MNPI access via deal-room logs.",
  },
  {
    id: "tr-3", title: "Sanctioned Vessel Repaint", difficulty: "advanced", domain: "Sanctions evasion",
    brief: "A tanker disables AIS for 12 days; re-emerges with a new IMO-registered name. Trace ownership and confirm beneficial chain.",
    expectedFindings: "AIS gap · STS transfer signature · flag-of-convenience hop · same beneficial owner via Liberian registry.",
  },
];

const DIFF_STYLE = {
  beginner: "border-emerald-300/30 text-emerald-200 bg-emerald-300/[0.06]",
  intermediate: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  advanced: "border-rose-300/30 text-rose-200 bg-rose-300/[0.06]",
};

/**
 * Analyst Training Environment — sanitized scenario library with
 * trainee attempts, findings capture, and self-scored debrief.
 */
const TrainingPanel = () => {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [trainee, setTrainee] = useState("");
  const [findings, setFindings] = useState("");
  const [currentAttempt, setCurrentAttempt] = useState<Attempt | null>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY_S); setScenarios(raw ? JSON.parse(raw) : SEED); } catch { setScenarios(SEED); }
    try { setAttempts(JSON.parse(localStorage.getItem(KEY_A) || "[]")); } catch {}
  }, []);
  useEffect(() => { const h = setTimeout(() => localStorage.setItem(KEY_S, JSON.stringify(scenarios)), 300); return () => clearTimeout(h); }, [scenarios]);
  useEffect(() => { const h = setTimeout(() => localStorage.setItem(KEY_A, JSON.stringify(attempts)), 300); return () => clearTimeout(h); }, [attempts]);

  const active = scenarios.find(s => s.id === activeId);

  const start = () => {
    if (!active || !trainee.trim()) return;
    const a: Attempt = { id: crypto.randomUUID(), scenarioId: active.id, trainee: trainee.trim(), startedAt: Date.now(), findings: "" };
    setAttempts(p => [a, ...p]);
    setCurrentAttempt(a);
    setFindings("");
  };

  const submit = () => {
    if (!currentAttempt || !active) return;
    const expected = active.expectedFindings.toLowerCase();
    const submitted = findings.toLowerCase();
    const keywords = expected.split(/[·,]/).map(s => s.trim()).filter(Boolean);
    const hits = keywords.filter(k => submitted.includes(k.split(" ").slice(0, 2).join(" "))).length;
    const score = Math.round((hits / Math.max(1, keywords.length)) * 100);
    setAttempts(p => p.map(a => a.id === currentAttempt.id ? { ...a, completedAt: Date.now(), findings, score } : a));
    setCurrentAttempt(null);
    setFindings("");
  };

  const recentAttempts = useMemo(() => attempts.slice(0, 6), [attempts]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start gap-3">
        <GraduationCap className="h-5 w-5 text-amber-300/80 mt-1" />
        <div>
          <h2 className="text-xl font-extralight tracking-tight text-foreground">Training Range</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            Sanitized scenarios. Submit findings. Auto-graded against expected pattern keywords.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <section className="col-span-12 lg:col-span-5 space-y-3">
          <h3 className="text-xs font-mono uppercase tracking-[0.22em] text-muted-foreground/60">Scenarios</h3>
          <div className="space-y-2">
            {scenarios.map(s => (
              <button key={s.id} onClick={() => setActiveId(s.id)}
                className={`w-full text-left rounded-xl border p-4 transition-all ${
                  activeId === s.id ? "border-amber-300/30 bg-amber-300/[0.04]" : "border-foreground/10 bg-foreground/[0.02] hover:border-foreground/20"
                }`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${DIFF_STYLE[s.difficulty]}`}>{s.difficulty}</span>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">{s.domain}</span>
                </div>
                <p className="text-sm font-extralight text-foreground">{s.title}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="col-span-12 lg:col-span-7 space-y-3">
          {active ? (
            <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5 space-y-4">
              <h3 className="text-lg font-extralight text-foreground">{active.title}</h3>
              <p className="text-xs text-muted-foreground font-extralight leading-relaxed whitespace-pre-wrap">{active.brief}</p>
              {!currentAttempt ? (
                <div className="flex gap-2">
                  <input value={trainee} onChange={e => setTrainee(e.target.value)} placeholder="Trainee name"
                    className="flex-1 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
                  <button onClick={start} disabled={!trainee.trim()}
                    className="rounded-lg bg-amber-300/10 border border-amber-300/20 px-4 py-1.5 text-xs text-amber-200 hover:bg-amber-300/20 disabled:opacity-30">
                    <Play className="h-3 w-3 inline mr-1" /> Begin attempt
                  </button>
                </div>
              ) : (
                <>
                  <textarea value={findings} onChange={e => setFindings(e.target.value)} rows={6}
                    placeholder="Your findings — patterns, indicators, beneficial owner, recommendation…"
                    className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight resize-none" />
                  <div className="flex gap-2">
                    <button onClick={submit} className="rounded-lg bg-emerald-300/10 border border-emerald-300/25 px-4 py-1.5 text-xs text-emerald-200 hover:bg-emerald-300/20">Submit</button>
                    <button onClick={() => setCurrentAttempt(null)} className="rounded-lg border border-foreground/10 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Abandon</button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground/50 text-center py-12 tracking-[0.2em] uppercase font-extralight">Select a scenario</p>
          )}

          <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
            <div className="flex items-center gap-2 mb-3 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">
              <Trophy className="h-3 w-3 text-amber-300/80" /> Recent attempts
            </div>
            {recentAttempts.length === 0 && <p className="text-[10px] text-muted-foreground/40 font-mono uppercase tracking-wider">None yet</p>}
            <div className="space-y-1.5">
              {recentAttempts.map(a => {
                const s = scenarios.find(x => x.id === a.scenarioId);
                return (
                  <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg border border-foreground/10 px-3 py-2 group">
                    <div className="flex items-center gap-2 text-xs font-extralight min-w-0">
                      <span className="text-foreground truncate">{a.trainee}</span>
                      <span className="text-muted-foreground/60 truncate">· {s?.title ?? a.scenarioId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {a.score != null ? (
                        <span className={`text-[11px] font-mono ${a.score >= 75 ? "text-emerald-300" : a.score >= 50 ? "text-amber-300" : "text-rose-300"}`}>{a.score}%</span>
                      ) : (
                        <span className="text-[10px] font-mono text-amber-300/80">in progress</span>
                      )}
                      <button onClick={() => setAttempts(p => p.filter(x => x.id !== a.id))} className="opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TrainingPanel;
