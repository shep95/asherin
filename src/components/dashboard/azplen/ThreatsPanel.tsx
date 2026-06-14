import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ShieldAlert, Target } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

type Vector = "sanctions" | "fraud" | "filing" | "cyber" | "supply-chain" | "regulatory";
interface Threat {
  id: string;
  vector: Vector;
  target: string;
  scenario: string;
  likelihood: number; // 0..1
  impact: number; // 0..1
  horizonDays: number;
  indicators: string;
  createdAt: number;
}

const KEY = (sid: string) => `azplen:threats:${sid}`;

const VEC: Record<Vector, string> = {
  sanctions: "border-rose-300/30 text-rose-200 bg-rose-300/[0.06]",
  fraud: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  filing: "border-sky-300/30 text-sky-200 bg-sky-300/[0.06]",
  cyber: "border-violet-300/30 text-violet-200 bg-violet-300/[0.06]",
  "supply-chain": "border-emerald-300/30 text-emerald-200 bg-emerald-300/[0.06]",
  regulatory: "border-foreground/15 text-muted-foreground bg-foreground/[0.04]",
};

const score = (t: Threat) => Math.round(t.likelihood * t.impact * 100);

/**
 * Predictive Threat + Regulatory Filing Intelligence — score forward-looking
 * threats by likelihood × impact, with horizon and indicator-of-warning list.
 */
const ThreatsPanel = () => {
  const { activeSession } = useAzplenSession();
  const [items, setItems] = useState<Threat[]>([]);
  const [draft, setDraft] = useState<Omit<Threat, "id" | "createdAt">>({
    vector: "fraud", target: "", scenario: "", likelihood: 0.5, impact: 0.5, horizonDays: 30, indicators: "",
  });

  useEffect(() => {
    if (!activeSession) return;
    try { setItems(JSON.parse(localStorage.getItem(KEY(activeSession.id)) || "[]")); } catch { setItems([]); }
  }, [activeSession?.id]);
  useEffect(() => {
    if (!activeSession) return;
    const h = setTimeout(() => localStorage.setItem(KEY(activeSession.id), JSON.stringify(items)), 300);
    return () => clearTimeout(h);
  }, [items, activeSession?.id]);

  const add = () => {
    if (!draft.target.trim() || !draft.scenario.trim()) return;
    setItems(p => [{ ...draft, id: crypto.randomUUID(), createdAt: Date.now() }, ...p]);
    setDraft({ ...draft, target: "", scenario: "", indicators: "" });
  };

  const sorted = useMemo(() => [...items].sort((a, b) => score(b) - score(a)), [items]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-rose-300/80 mt-1" />
        <div>
          <h2 className="text-xl font-extralight tracking-tight text-foreground">Threat Forecast</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            Predictive threat intelligence + regulatory filing analysis. Likelihood × impact = priority.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3">
        <div className="grid grid-cols-12 gap-2">
          <select value={draft.vector} onChange={e => setDraft({ ...draft, vector: e.target.value as Vector })}
            className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight">
            {(Object.keys(VEC) as Vector[]).map(v => <option key={v} value={v}>{v}</option>)}
          </select>
          <input value={draft.target} onChange={e => setDraft({ ...draft, target: e.target.value })} placeholder="Target"
            className="col-span-3 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <input value={draft.scenario} onChange={e => setDraft({ ...draft, scenario: e.target.value })} placeholder="Scenario"
            className="col-span-5 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <input type="number" value={draft.horizonDays} onChange={e => setDraft({ ...draft, horizonDays: parseInt(e.target.value) || 0 })} placeholder="Days"
            className="col-span-1 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-2 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-mono" />
          <button onClick={add} className="col-span-1 rounded-lg bg-rose-300/10 border border-rose-300/20 text-xs text-rose-200 hover:bg-rose-300/20">
            <Plus className="h-3 w-3 mx-auto" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
            Likelihood
            <input type="range" min={0} max={1} step={0.05} value={draft.likelihood}
              onChange={e => setDraft({ ...draft, likelihood: parseFloat(e.target.value) })} className="flex-1" />
            <span className="font-mono text-amber-200/80 w-8 text-right">{Math.round(draft.likelihood * 100)}%</span>
          </label>
          <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
            Impact
            <input type="range" min={0} max={1} step={0.05} value={draft.impact}
              onChange={e => setDraft({ ...draft, impact: parseFloat(e.target.value) })} className="flex-1" />
            <span className="font-mono text-rose-200/80 w-8 text-right">{Math.round(draft.impact * 100)}%</span>
          </label>
        </div>
        <input value={draft.indicators} onChange={e => setDraft({ ...draft, indicators: e.target.value })}
          placeholder="Indicators of warning (comma-separated)"
          className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
      </div>

      <div className="space-y-2">
        {sorted.length === 0 && <p className="text-[11px] text-muted-foreground/50 text-center py-12 tracking-[0.2em] uppercase font-extralight">No threats forecast</p>}
        {sorted.map(t => {
          const s = score(t);
          return (
            <div key={t.id} className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
              <div className="flex items-start gap-3">
                <Target className={`h-4 w-4 mt-0.5 ${s >= 60 ? "text-rose-300" : s >= 30 ? "text-amber-300" : "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${VEC[t.vector]}`}>{t.vector}</span>
                    <span className="text-sm font-extralight text-foreground">{t.target}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/60">· next {t.horizonDays}d</span>
                  </div>
                  <p className="text-xs text-muted-foreground font-extralight mt-1">{t.scenario}</p>
                  {t.indicators && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {t.indicators.split(",").map(i => i.trim()).filter(Boolean).map(i => (
                        <span key={i} className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">· {i}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60">Priority</p>
                  <p className={`text-2xl font-extralight ${s >= 60 ? "text-rose-300" : s >= 30 ? "text-amber-300" : "text-muted-foreground"}`}>{s}</p>
                </div>
                <button onClick={() => setItems(p => p.filter(x => x.id !== t.id))} className="text-muted-foreground/60 hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ThreatsPanel;
