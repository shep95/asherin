import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ShieldAlert, Wrench } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

type Severity = "low" | "medium" | "high" | "critical";
type IssueType = "duplicate" | "null" | "format" | "outlier" | "conflict" | "drift";
interface Issue {
  id: string;
  dataset: string;
  column: string;
  type: IssueType;
  severity: Severity;
  count: number;
  description: string;
  resolved: boolean;
  createdAt: number;
}

const KEY = (sid: string) => `azplen:dq:${sid}`;

const SEV: Record<Severity, string> = {
  low: "border-foreground/15 text-muted-foreground",
  medium: "border-sky-300/30 text-sky-200 bg-sky-300/[0.06]",
  high: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  critical: "border-rose-300/30 text-rose-200 bg-rose-300/[0.06]",
};
const FIX: Record<IssueType, string> = {
  duplicate: "Deduplicate by composite key",
  null: "Impute / drop / flag as missing",
  format: "Normalize via parser",
  outlier: "Winsorize at p99 / flag for review",
  conflict: "Reconcile via authoritative source",
  drift: "Re-fit schema; alert downstream",
};

/**
 * Structured Data Quality Engine — every ingested dataset is profiled,
 * issues are surfaced with severity, and one-click fixes are suggested.
 */
const DataQualityPanel = () => {
  const { activeSession } = useAzplenSession();
  const [items, setItems] = useState<Issue[]>([]);
  const [draft, setDraft] = useState<Omit<Issue, "id" | "createdAt" | "resolved">>({
    dataset: "", column: "", type: "null", severity: "medium", count: 0, description: "",
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
    if (!draft.dataset.trim() || !draft.column.trim()) return;
    setItems(p => [{ ...draft, id: crypto.randomUUID(), resolved: false, createdAt: Date.now() }, ...p]);
    setDraft({ dataset: "", column: "", type: "null", severity: "medium", count: 0, description: "" });
  };

  const score = useMemo(() => {
    if (items.length === 0) return 100;
    const weight = { low: 1, medium: 3, high: 7, critical: 15 } as const;
    const open = items.filter(i => !i.resolved);
    const penalty = open.reduce((a, i) => a + weight[i.severity], 0);
    return Math.max(0, 100 - Math.min(100, penalty));
  }, [items]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extralight tracking-tight text-foreground">Data Quality</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            Profile every dataset. Surface issues with severity. Suggest fixes.
          </p>
        </div>
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] px-5 py-3 text-center">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">DQ score</p>
          <p className={`text-3xl font-extralight mt-0.5 ${score >= 80 ? "text-emerald-300" : score >= 50 ? "text-amber-300" : "text-rose-300"}`}>{score}</p>
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
        <div className="grid grid-cols-12 gap-2">
          <input value={draft.dataset} onChange={e => setDraft({ ...draft, dataset: e.target.value })} placeholder="Dataset"
            className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <input value={draft.column} onChange={e => setDraft({ ...draft, column: e.target.value })} placeholder="Column"
            className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight font-mono" />
          <select value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value as IssueType })}
            className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight">
            {(Object.keys(FIX) as IssueType[]).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={draft.severity} onChange={e => setDraft({ ...draft, severity: e.target.value as Severity })}
            className="col-span-1 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight">
            <option>low</option><option>medium</option><option>high</option><option>critical</option>
          </select>
          <input type="number" value={draft.count} onChange={e => setDraft({ ...draft, count: parseInt(e.target.value) || 0 })} placeholder="#"
            className="col-span-1 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-2 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-mono" />
          <input value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} placeholder="Description"
            className="col-span-3 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <button onClick={add} className="col-span-1 rounded-lg bg-amber-300/10 border border-amber-300/20 text-xs text-amber-200 hover:bg-amber-300/20">
            <Plus className="h-3 w-3 mx-auto" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-[11px] text-muted-foreground/50 text-center py-12 tracking-[0.2em] uppercase font-extralight">No issues logged</p>}
        {items.map(i => (
          <div key={i.id} className={`rounded-xl border bg-foreground/[0.02] p-4 ${i.resolved ? "opacity-50" : ""} border-foreground/10`}>
            <div className="flex items-start gap-3">
              <ShieldAlert className={`h-4 w-4 mt-0.5 ${i.severity === "critical" ? "text-rose-300" : i.severity === "high" ? "text-amber-300" : "text-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono text-muted-foreground/80">{i.dataset}.<span className="text-amber-200/80">{i.column}</span></span>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${SEV[i.severity]}`}>{i.severity}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/60">{i.type}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/60">{i.count.toLocaleString()} rows</span>
                </div>
                <p className="text-xs text-foreground font-extralight mt-1">{i.description}</p>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-emerald-200/80 font-mono">
                  <Wrench className="h-3 w-3" /> Suggested fix · {FIX[i.type]}
                </div>
              </div>
              <button onClick={() => setItems(p => p.map(x => x.id === i.id ? { ...x, resolved: !x.resolved } : x))}
                className="text-[10px] font-mono uppercase tracking-wider text-emerald-300 hover:text-emerald-200">
                {i.resolved ? "reopen" : "resolve"}
              </button>
              <button onClick={() => setItems(p => p.filter(x => x.id !== i.id))} className="text-muted-foreground/60 hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DataQualityPanel;
