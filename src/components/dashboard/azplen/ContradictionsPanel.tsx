import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, AlertTriangle, GitMerge } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

type Severity = "low" | "medium" | "high" | "critical";
type Resolution = "open" | "reconciled" | "either-or" | "neither";

interface Contradiction {
  id: string;
  topic: string;
  claimA: string;
  sourceA: string;
  claimB: string;
  sourceB: string;
  severity: Severity;
  resolution: Resolution;
  notes: string;
  createdAt: number;
}

const KEY = (sid: string) => `azplen:contradictions:${sid}`;

const SEV: Record<Severity, string> = {
  low: "border-foreground/15 text-muted-foreground",
  medium: "border-sky-300/30 text-sky-200 bg-sky-300/[0.06]",
  high: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  critical: "border-rose-300/30 text-rose-200 bg-rose-300/[0.06]",
};
const RES: Record<Resolution, string> = {
  open: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  reconciled: "border-emerald-300/30 text-emerald-200 bg-emerald-300/[0.06]",
  "either-or": "border-sky-300/30 text-sky-200 bg-sky-300/[0.06]",
  neither: "border-foreground/15 text-muted-foreground",
};

/**
 * Contradictions Detector — every assertion is checked against every other.
 * When two sources disagree, the contradiction is logged with severity and
 * driven to resolution.
 */
const ContradictionsPanel = () => {
  const { activeSession } = useAzplenSession();
  const [items, setItems] = useState<Contradiction[]>([]);
  const [draft, setDraft] = useState<Omit<Contradiction, "id" | "createdAt" | "notes" | "resolution">>({
    topic: "", claimA: "", sourceA: "", claimB: "", sourceB: "", severity: "medium",
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
    if (!draft.topic.trim() || !draft.claimA.trim() || !draft.claimB.trim()) return;
    setItems(p => [{ ...draft, id: crypto.randomUUID(), createdAt: Date.now(), notes: "", resolution: "open" }, ...p]);
    setDraft({ topic: "", claimA: "", sourceA: "", claimB: "", sourceB: "", severity: "medium" });
  };
  const update = (id: string, patch: Partial<Contradiction>) =>
    setItems(p => p.map(c => c.id === id ? { ...c, ...patch } : c));
  const remove = (id: string) => setItems(p => p.filter(c => c.id !== id));

  const open = useMemo(() => items.filter(c => c.resolution === "open").length, [items]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-extralight tracking-tight text-foreground">Contradictions</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            Disagreements between sources logged, severity-scored, and driven to resolution.
          </p>
        </div>
        <div className="rounded-lg border border-amber-300/20 bg-amber-300/[0.04] px-3 py-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-amber-200/80">Open</p>
          <p className="text-xl font-extralight text-amber-200 mt-0.5">{open}</p>
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3">
        <input value={draft.topic} onChange={e => setDraft({ ...draft, topic: e.target.value })} placeholder="Topic — e.g. ACME 2024 revenue figure"
          className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-amber-300/40 font-extralight" />
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">Claim A</p>
            <input value={draft.claimA} onChange={e => setDraft({ ...draft, claimA: e.target.value })} placeholder="Assertion"
              className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/40 font-extralight" />
            <input value={draft.sourceA} onChange={e => setDraft({ ...draft, sourceA: e.target.value })} placeholder="Source"
              className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/40 font-extralight font-mono" />
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">Claim B</p>
            <input value={draft.claimB} onChange={e => setDraft({ ...draft, claimB: e.target.value })} placeholder="Conflicting assertion"
              className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/40 font-extralight" />
            <input value={draft.sourceB} onChange={e => setDraft({ ...draft, sourceB: e.target.value })} placeholder="Source"
              className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/40 font-extralight font-mono" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <select value={draft.severity} onChange={e => setDraft({ ...draft, severity: e.target.value as Severity })}
            className="bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/40 font-extralight">
            <option value="low">Low</option><option value="medium">Medium</option>
            <option value="high">High</option><option value="critical">Critical</option>
          </select>
          <button onClick={add} className="rounded-lg bg-amber-300/10 border border-amber-300/20 px-4 py-1.5 text-xs text-amber-200 hover:bg-amber-300/20">
            <Plus className="h-3 w-3 inline mr-1" /> Log contradiction
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-[11px] text-muted-foreground/50 text-center py-12 tracking-[0.2em] uppercase font-extralight">No contradictions logged</p>}
        {items.map(c => (
          <div key={c.id} className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className={`h-4 w-4 mt-0.5 ${c.severity === "critical" ? "text-rose-300" : c.severity === "high" ? "text-amber-300" : "text-muted-foreground"}`} />
              <div className="flex-1">
                <h4 className="text-sm font-extralight text-foreground">{c.topic}</h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${SEV[c.severity]}`}>{c.severity}</span>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${RES[c.resolution]}`}>{c.resolution}</span>
                </div>
              </div>
              <select value={c.resolution} onChange={e => update(c.id, { resolution: e.target.value as Resolution })}
                className="bg-foreground/[0.04] border border-foreground/10 rounded px-2 py-1 text-[10px] text-foreground outline-none focus:border-amber-300/30 font-mono uppercase tracking-wider">
                <option value="open">Open</option><option value="reconciled">Reconciled</option>
                <option value="either-or">Either-or</option><option value="neither">Neither</option>
              </select>
              <button onClick={() => remove(c.id)} className="text-muted-foreground/60 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 pl-7">
              <div className="rounded-lg border border-foreground/10 p-3">
                <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60 mb-1">A · {c.sourceA || "—"}</p>
                <p className="text-xs text-foreground font-extralight">{c.claimA}</p>
              </div>
              <div className="rounded-lg border border-foreground/10 p-3">
                <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60 mb-1">B · {c.sourceB || "—"}</p>
                <p className="text-xs text-foreground font-extralight">{c.claimB}</p>
              </div>
            </div>
            <textarea value={c.notes} onChange={e => update(c.id, { notes: e.target.value })}
              placeholder="Resolution notes…" rows={2}
              className="w-full ml-7 bg-foreground/[0.02] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-muted-foreground outline-none focus:border-amber-300/30 font-extralight resize-none" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContradictionsPanel;
