import { useEffect, useMemo, useState } from "react";
import { Plus, Folder, Calendar, AlertCircle } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

type Status = "intake" | "active" | "review" | "closed";
type Priority = "low" | "medium" | "high" | "critical";

interface Case {
  id: string;
  title: string;
  caseNumber: string;
  status: Status;
  priority: Priority;
  owner: string;
  dueAt?: number;
  description: string;
  createdAt: number;
}

const KEY = "azplen:cases:global";

const STATUS: Record<Status, string> = {
  intake: "border-sky-300/30 text-sky-200 bg-sky-300/[0.06]",
  active: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  review: "border-violet-300/30 text-violet-200 bg-violet-300/[0.06]",
  closed: "border-foreground/15 text-muted-foreground bg-foreground/[0.04]",
};
const PRIO: Record<Priority, string> = {
  low: "text-muted-foreground",
  medium: "text-sky-300",
  high: "text-amber-300",
  critical: "text-rose-300",
};

/**
 * Case Management — formal case file lifecycle: intake → active → review → closed.
 * Every case threads to sessions, evidence, and reports. Audit-trailed.
 */
const CasesPanel = () => {
  const { activeSession } = useAzplenSession();
  const [items, setItems] = useState<Case[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [draft, setDraft] = useState<Omit<Case, "id" | "createdAt" | "caseNumber">>({
    title: "", status: "intake", priority: "medium", owner: "", description: "",
  });

  useEffect(() => { try { const raw = localStorage.getItem(KEY); setItems(raw ? JSON.parse(raw) : []); } catch { setItems([]); } }, []);
  useEffect(() => {
    const h = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} }, 300);
    return () => clearTimeout(h);
  }, [items]);

  const filtered = useMemo(() => items.filter(c => filter === "all" || c.status === filter)
    .sort((a, b) => b.createdAt - a.createdAt), [items, filter]);

  const create = () => {
    if (!draft.title.trim()) return;
    const yr = new Date().getFullYear();
    const num = `AZ-${yr}-${String(items.length + 1).padStart(4, "0")}`;
    setItems(prev => [{ ...draft, id: crypto.randomUUID(), caseNumber: num, createdAt: Date.now() }, ...prev]);
    setDraft({ title: "", status: "intake", priority: "medium", owner: "", description: "" });
    setShowCreate(false);
  };

  const update = (id: string, patch: Partial<Case>) =>
    setItems(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));

  const counts = useMemo(() => {
    const c: Record<Status, number> = { intake: 0, active: 0, review: 0, closed: 0 };
    items.forEach(i => { c[i.status]++; });
    return c;
  }, [items]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extralight tracking-tight text-foreground">Case Management</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            Formal case file lifecycle — every investigation has a number, a status, an owner.
          </p>
        </div>
        <button onClick={() => setShowCreate(s => !s)}
          className="flex items-center gap-1.5 rounded-lg border border-amber-300/20 bg-amber-300/[0.04] px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-300/10">
          <Plus className="h-3 w-3" /> Open case
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {(["intake","active","review","closed"] as Status[]).map(s => (
          <div key={s} className={`rounded-xl border p-4 ${STATUS[s]}`}>
            <p className="text-[10px] font-mono uppercase tracking-[0.22em]">{s}</p>
            <p className="text-2xl font-extralight mt-1">{counts[s]}</p>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3">
          <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })}
            placeholder="Case title — e.g. ACME Corp wire anomaly review"
            className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-amber-300/40 font-extralight" autoFocus />
          <textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}
            placeholder="Background, scope, predicate…" rows={3}
            className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/40 font-extralight resize-none" />
          <div className="grid grid-cols-3 gap-2">
            <input value={draft.owner} onChange={e => setDraft({ ...draft, owner: e.target.value })}
              placeholder="Owner"
              className="bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/40 font-extralight" />
            <select value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value as Priority })}
              className="bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/40 font-extralight">
              <option value="low">Low</option><option value="medium">Medium</option>
              <option value="high">High</option><option value="critical">Critical</option>
            </select>
            <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Status })}
              className="bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/40 font-extralight">
              <option value="intake">Intake</option><option value="active">Active</option>
              <option value="review">Review</option><option value="closed">Closed</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={create} className="rounded-lg bg-amber-300/10 border border-amber-300/20 px-4 py-1.5 text-xs text-amber-200 hover:bg-amber-300/20">Open case</button>
            <button onClick={() => setShowCreate(false)} className="rounded-lg border border-foreground/10 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex gap-1">
        {(["all","intake","active","review","closed"] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider border transition-colors
              ${filter === s ? "border-amber-300/30 bg-amber-300/[0.06] text-amber-200" : "border-foreground/10 text-muted-foreground hover:text-foreground"}`}>
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-[11px] text-muted-foreground/50 text-center py-12 tracking-[0.2em] uppercase font-extralight">No cases</p>
        )}
        {filtered.map(c => (
          <div key={c.id} className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
            <div className="flex items-start gap-4">
              <Folder className={`h-4 w-4 mt-0.5 ${PRIO[c.priority]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">{c.caseNumber}</span>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${STATUS[c.status]}`}>{c.status}</span>
                  <span className={`text-[9px] font-mono uppercase tracking-wider ${PRIO[c.priority]}`}>{c.priority}</span>
                </div>
                <h4 className="text-sm font-extralight text-foreground mt-1">{c.title}</h4>
                {c.description && <p className="text-xs text-muted-foreground font-extralight mt-1 line-clamp-2">{c.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/60 font-mono">
                  {c.owner && <span>Owner: {c.owner}</span>}
                  <span>Opened {new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <select value={c.status} onChange={e => update(c.id, { status: e.target.value as Status })}
                className="bg-foreground/[0.04] border border-foreground/10 rounded px-2 py-1 text-[10px] text-foreground outline-none focus:border-amber-300/30 font-mono uppercase tracking-wider">
                <option value="intake">Intake</option><option value="active">Active</option>
                <option value="review">Review</option><option value="closed">Closed</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CasesPanel;
