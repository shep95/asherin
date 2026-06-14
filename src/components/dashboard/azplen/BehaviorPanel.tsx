import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Brain, AlertCircle } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

type Category = "routine" | "anomaly" | "deception";
interface Behavior {
  id: string;
  actor: string;
  signal: string;
  baseline: string;
  observed: string;
  deviationPct: number;
  category: Category;
  notes: string;
  createdAt: number;
}

const KEY = (sid: string) => `azplen:behavior:${sid}`;

const CAT: Record<Category, string> = {
  routine: "border-emerald-300/30 text-emerald-200 bg-emerald-300/[0.06]",
  anomaly: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  deception: "border-rose-300/30 text-rose-200 bg-rose-300/[0.06]",
};

const DECEPTION_INDICATORS = [
  "structural smurfing", "round-amount clustering", "off-hours batching",
  "shell layering", "tx velocity spike", "narrative inconsistency",
  "unusual counterparty introduction", "abnormal corporate filing cadence",
];

/**
 * Behavioral Pattern + Deception Detection — baseline vs observed.
 * Deviation > 50% flagged as anomaly; > 100% flagged as deception.
 */
const BehaviorPanel = () => {
  const { activeSession } = useAzplenSession();
  const [items, setItems] = useState<Behavior[]>([]);
  const [draft, setDraft] = useState({ actor: "", signal: "", baseline: "", observed: "", notes: "" });

  useEffect(() => {
    if (!activeSession) return;
    try { setItems(JSON.parse(localStorage.getItem(KEY(activeSession.id)) || "[]")); } catch { setItems([]); }
  }, [activeSession?.id]);
  useEffect(() => {
    if (!activeSession) return;
    const h = setTimeout(() => localStorage.setItem(KEY(activeSession.id), JSON.stringify(items)), 300);
    return () => clearTimeout(h);
  }, [items, activeSession?.id]);

  const categorize = (devPct: number): Category =>
    devPct >= 100 ? "deception" : devPct >= 50 ? "anomaly" : "routine";

  const add = () => {
    if (!draft.actor.trim() || !draft.signal.trim()) return;
    const b = parseFloat(draft.baseline) || 0;
    const o = parseFloat(draft.observed) || 0;
    const devPct = b === 0 ? 0 : Math.abs((o - b) / b) * 100;
    setItems(p => [{
      id: crypto.randomUUID(), actor: draft.actor.trim(), signal: draft.signal.trim(),
      baseline: draft.baseline, observed: draft.observed, deviationPct: devPct,
      category: categorize(devPct), notes: draft.notes.trim(), createdAt: Date.now(),
    }, ...p]);
    setDraft({ actor: "", signal: "", baseline: "", observed: "", notes: "" });
  };

  const counts = useMemo(() => {
    const c: Record<Category, number> = { routine: 0, anomaly: 0, deception: 0 };
    items.forEach(i => c[i.category]++);
    return c;
  }, [items]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start gap-3">
        <Brain className="h-5 w-5 text-amber-300/80 mt-1" />
        <div>
          <h2 className="text-xl font-extralight tracking-tight text-foreground">Behavioral Patterns</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            Baseline vs. observed. Deviation &gt; 50% surfaces anomaly. &gt; 100% surfaces deception.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {(["routine","anomaly","deception"] as Category[]).map(c => (
          <div key={c} className={`rounded-xl border p-4 ${CAT[c]}`}>
            <p className="text-[10px] font-mono uppercase tracking-[0.22em]">{c}</p>
            <p className="text-2xl font-extralight mt-1">{counts[c]}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3">
        <div className="grid grid-cols-12 gap-2">
          <input value={draft.actor} onChange={e => setDraft({ ...draft, actor: e.target.value })} placeholder="Actor / entity"
            className="col-span-3 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <input value={draft.signal} onChange={e => setDraft({ ...draft, signal: e.target.value })} placeholder="Signal — e.g. avg tx size"
            className="col-span-4 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <input value={draft.baseline} onChange={e => setDraft({ ...draft, baseline: e.target.value })} placeholder="Baseline" type="number"
            className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-mono" />
          <input value={draft.observed} onChange={e => setDraft({ ...draft, observed: e.target.value })} placeholder="Observed" type="number"
            className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-mono" />
          <button onClick={add} className="col-span-1 rounded-lg bg-amber-300/10 border border-amber-300/20 text-xs text-amber-200 hover:bg-amber-300/20">
            <Plus className="h-3 w-3 mx-auto" />
          </button>
        </div>
        <input value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes (context, source, period)…"
          className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60 mr-1">Deception indicators:</span>
          {DECEPTION_INDICATORS.map(i => (
            <button key={i} onClick={() => setDraft({ ...draft, signal: i })}
              className="rounded-md border border-foreground/10 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-rose-200 hover:border-rose-300/30 transition-colors">
              {i}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-[11px] text-muted-foreground/50 text-center py-12 tracking-[0.2em] uppercase font-extralight">No observations</p>}
        {items.map(b => (
          <div key={b.id} className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className={`h-4 w-4 mt-0.5 ${b.category === "deception" ? "text-rose-300" : b.category === "anomaly" ? "text-amber-300" : "text-emerald-300"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-extralight text-foreground">{b.actor}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/60">·</span>
                  <span className="text-xs font-extralight text-muted-foreground">{b.signal}</span>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${CAT[b.category]}`}>{b.category}</span>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div><p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60">Baseline</p><p className="text-xs font-mono text-foreground">{b.baseline}</p></div>
                  <div><p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60">Observed</p><p className="text-xs font-mono text-foreground">{b.observed}</p></div>
                  <div><p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60">Deviation</p><p className={`text-xs font-mono ${b.category === "deception" ? "text-rose-300" : b.category === "anomaly" ? "text-amber-300" : "text-emerald-300"}`}>{b.deviationPct.toFixed(0)}%</p></div>
                </div>
                {b.notes && <p className="text-[11px] text-muted-foreground mt-2 font-extralight">{b.notes}</p>}
              </div>
              <button onClick={() => setItems(p => p.filter(x => x.id !== b.id))} className="text-muted-foreground/60 hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BehaviorPanel;
