import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Users, Activity } from "lucide-react";

interface Analyst { id: string; name: string; capacity: number; }
interface Assignment { id: string; analystId: string; case: string; effort: number; priority: "low"|"medium"|"high"|"critical"; }

const KEY_A = "azplen:workload:analysts";
const KEY_X = "azplen:workload:assignments";

const PRIO_W = { low: 1, medium: 2, high: 4, critical: 8 } as const;

/**
 * Analyst Workload Management — see who is loaded, who has bandwidth,
 * and where critical work is queued. Capacity scoring drives routing.
 */
const WorkloadPanel = () => {
  const [analysts, setAnalysts] = useState<Analyst[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [aName, setAName] = useState("");
  const [aCap, setACap] = useState(40);
  const [draft, setDraft] = useState<Omit<Assignment, "id">>({ analystId: "", case: "", effort: 4, priority: "medium" });

  useEffect(() => {
    try { setAnalysts(JSON.parse(localStorage.getItem(KEY_A) || "[]")); } catch {}
    try { setAssignments(JSON.parse(localStorage.getItem(KEY_X) || "[]")); } catch {}
  }, []);
  useEffect(() => { const h = setTimeout(() => localStorage.setItem(KEY_A, JSON.stringify(analysts)), 300); return () => clearTimeout(h); }, [analysts]);
  useEffect(() => { const h = setTimeout(() => localStorage.setItem(KEY_X, JSON.stringify(assignments)), 300); return () => clearTimeout(h); }, [assignments]);

  const addAnalyst = () => {
    if (!aName.trim()) return;
    setAnalysts(p => [...p, { id: crypto.randomUUID(), name: aName.trim(), capacity: aCap }]);
    setAName(""); setACap(40);
  };
  const removeAnalyst = (id: string) => {
    setAnalysts(p => p.filter(a => a.id !== id));
    setAssignments(p => p.filter(x => x.analystId !== id));
  };
  const addAssignment = () => {
    if (!draft.analystId || !draft.case.trim()) return;
    setAssignments(p => [...p, { ...draft, id: crypto.randomUUID(), case: draft.case.trim() }]);
    setDraft({ analystId: "", case: "", effort: 4, priority: "medium" });
  };

  const load = useMemo(() => {
    return analysts.map(a => {
      const own = assignments.filter(x => x.analystId === a.id);
      const used = own.reduce((s, x) => s + x.effort * PRIO_W[x.priority], 0);
      const pct = a.capacity > 0 ? Math.min(150, Math.round((used / a.capacity) * 100)) : 0;
      return { analyst: a, own, used, pct };
    });
  }, [analysts, assignments]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-extralight tracking-tight text-foreground">Analyst Workload</h2>
        <p className="text-xs font-extralight text-muted-foreground mt-1">
          Capacity vs. weighted load — route critical work to operators with bandwidth.
        </p>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
        <div className="flex items-center gap-2 mb-3 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">
          <Users className="h-3 w-3 text-amber-300/80" /> Team
        </div>
        <div className="flex gap-2 mb-3">
          <input value={aName} onChange={e => setAName(e.target.value)} placeholder="Analyst name"
            className="flex-1 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <input type="number" value={aCap} onChange={e => setACap(parseInt(e.target.value) || 0)} placeholder="Capacity (hrs/wk)"
            className="w-32 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <button onClick={addAnalyst} className="rounded-lg bg-amber-300/10 border border-amber-300/20 px-3 py-2 text-xs text-amber-200 hover:bg-amber-300/20">
            <Plus className="h-3 w-3" />
          </button>
        </div>
        <div className="space-y-2">
          {load.length === 0 && <p className="text-[11px] text-muted-foreground/50 text-center py-4 font-extralight">No analysts yet</p>}
          {load.map(({ analyst, used, pct, own }) => (
            <div key={analyst.id} className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extralight text-foreground">{analyst.name}</span>
                    <span className="text-[10px] font-mono text-muted-foreground/60">{own.length} assignments · {used}/{analyst.capacity}</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-foreground/[0.04] overflow-hidden">
                    <div className={`h-full transition-all ${pct >= 100 ? "bg-rose-400/80" : pct >= 75 ? "bg-amber-300/80" : "bg-emerald-400/70"}`}
                      style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                </div>
                <span className={`text-[10px] font-mono w-12 text-right ${pct >= 100 ? "text-rose-300" : pct >= 75 ? "text-amber-300" : "text-emerald-300"}`}>{pct}%</span>
                <button onClick={() => removeAnalyst(analyst.id)} className="text-muted-foreground/60 hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
        <div className="flex items-center gap-2 mb-3 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">
          <Activity className="h-3 w-3 text-amber-300/80" /> Assignments
        </div>
        <div className="grid grid-cols-12 gap-2 mb-3">
          <select value={draft.analystId} onChange={e => setDraft({ ...draft, analystId: e.target.value })}
            className="col-span-3 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight">
            <option value="">Analyst…</option>
            {analysts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input value={draft.case} onChange={e => setDraft({ ...draft, case: e.target.value })} placeholder="Case / task"
            className="col-span-5 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <input type="number" value={draft.effort} onChange={e => setDraft({ ...draft, effort: parseInt(e.target.value) || 0 })}
            className="col-span-1 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-2 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <select value={draft.priority} onChange={e => setDraft({ ...draft, priority: e.target.value as Assignment["priority"] })}
            className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight">
            <option value="low">Low</option><option value="medium">Medium</option>
            <option value="high">High</option><option value="critical">Critical</option>
          </select>
          <button onClick={addAssignment} className="col-span-1 rounded-lg bg-amber-300/10 border border-amber-300/20 text-xs text-amber-200 hover:bg-amber-300/20">
            <Plus className="h-3 w-3 mx-auto" />
          </button>
        </div>
        <div className="space-y-1.5">
          {assignments.map(x => {
            const a = analysts.find(an => an.id === x.analystId);
            return (
              <div key={x.id} className="flex items-center justify-between rounded-lg border border-foreground/10 bg-foreground/[0.02] px-3 py-2">
                <div className="flex items-center gap-3 text-xs font-extralight">
                  <span className="text-foreground">{x.case}</span>
                  <span className="text-muted-foreground/60">→ {a?.name ?? "—"}</span>
                  <span className="text-[10px] font-mono text-muted-foreground/60">{x.effort}h · {x.priority}</span>
                </div>
                <button onClick={() => setAssignments(p => p.filter(y => y.id !== x.id))} className="text-muted-foreground/60 hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WorkloadPanel;
