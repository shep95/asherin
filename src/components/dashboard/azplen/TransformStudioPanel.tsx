import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, GripVertical, Play, Wrench } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

type StepKind = "filter" | "join" | "transform" | "aggregate" | "enrich" | "output";
interface Step { id: string; kind: StepKind; expr: string; }
interface Pipeline { id: string; name: string; source: string; steps: Step[]; lastRun?: number; createdAt: number; }

const KEY = (sid: string) => `azplen:pipelines:${sid}`;

const KIND_STYLE: Record<StepKind, string> = {
  filter: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  join: "border-sky-300/30 text-sky-200 bg-sky-300/[0.06]",
  transform: "border-violet-300/30 text-violet-200 bg-violet-300/[0.06]",
  aggregate: "border-emerald-300/30 text-emerald-200 bg-emerald-300/[0.06]",
  enrich: "border-rose-300/30 text-rose-200 bg-rose-300/[0.06]",
  output: "border-foreground/15 text-muted-foreground bg-foreground/[0.04]",
};

const KIND_PLACEHOLDER: Record<StepKind, string> = {
  filter: 'WHERE amount > 10000 AND counterparty IS NOT NULL',
  join: 'LEFT JOIN counterparties ON ledger.cp_id = counterparties.id',
  transform: 'cast(amount as numeric), upper(counterparty)',
  aggregate: 'SUM(amount) BY counterparty, month',
  enrich: 'lookup(counterparty, "sanctions_list")',
  output: 'TO TABLE flagged_transactions',
};

/**
 * Data Transformation Studio — chain filter/join/transform/aggregate/
 * enrich/output steps into reusable, replayable pipelines.
 */
const TransformStudioPanel = () => {
  const { activeSession } = useAzplenSession();
  const [items, setItems] = useState<Pipeline[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: "", source: "" });

  useEffect(() => {
    if (!activeSession) return;
    try { setItems(JSON.parse(localStorage.getItem(KEY(activeSession.id)) || "[]")); } catch { setItems([]); }
  }, [activeSession?.id]);
  useEffect(() => {
    if (!activeSession) return;
    const h = setTimeout(() => localStorage.setItem(KEY(activeSession.id), JSON.stringify(items)), 300);
    return () => clearTimeout(h);
  }, [items, activeSession?.id]);

  const active = items.find(p => p.id === activeId) ?? null;

  const create = () => {
    if (!draft.name.trim()) return;
    const p: Pipeline = {
      id: crypto.randomUUID(), name: draft.name.trim(),
      source: draft.source.trim() || "ledger", steps: [], createdAt: Date.now(),
    };
    setItems(prev => [p, ...prev]);
    setActiveId(p.id);
    setDraft({ name: "", source: "" });
  };
  const update = (fn: (p: Pipeline) => Pipeline) =>
    setItems(prev => prev.map(p => p.id === activeId ? fn(p) : p));
  const addStep = (k: StepKind) => update(p => ({
    ...p, steps: [...p.steps, { id: crypto.randomUUID(), kind: k, expr: "" }],
  }));
  const run = () => update(p => ({ ...p, lastRun: Date.now() }));

  return (
    <div className="grid grid-cols-12 gap-4 p-6 h-full">
      <aside className="col-span-12 md:col-span-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extralight tracking-wide text-foreground flex items-center gap-2">
            <Wrench className="h-3.5 w-3.5 text-amber-300/80" /> Pipelines
          </h2>
        </div>
        <div className="space-y-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
          <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} placeholder="Pipeline name"
            className="w-full bg-foreground/[0.04] border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <input value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value })} placeholder="Source table"
            className="w-full bg-foreground/[0.04] border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-amber-300/30 font-mono" />
          <button onClick={create} className="w-full rounded bg-amber-300/10 border border-amber-300/20 py-1.5 text-xs text-amber-200 hover:bg-amber-300/20">
            <Plus className="h-3 w-3 inline mr-1" /> New pipeline
          </button>
        </div>
        <div className="space-y-1.5">
          {items.map(p => (
            <button key={p.id} onClick={() => setActiveId(p.id)}
              className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all ${
                activeId === p.id ? "border-amber-300/30 bg-amber-300/[0.04]" : "border-foreground/10 bg-foreground/[0.02] hover:border-foreground/20"
              }`}>
              <p className="text-xs font-extralight text-foreground truncate">{p.name}</p>
              <p className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider mt-0.5">
                {p.source} · {p.steps.length} steps
              </p>
            </button>
          ))}
        </div>
      </aside>

      <section className="col-span-12 md:col-span-8 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5 overflow-y-auto">
        {!active ? (
          <div className="h-full flex items-center justify-center text-[11px] text-muted-foreground/50 tracking-[0.2em] uppercase font-extralight">
            Select a pipeline
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-lg font-extralight text-foreground">{active.name}</h3>
                <p className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider mt-1">
                  FROM {active.source} {active.lastRun && `· last run ${new Date(active.lastRun).toLocaleTimeString()}`}
                </p>
              </div>
              <button onClick={run} disabled={active.steps.length === 0}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-300/25 bg-emerald-300/[0.05] px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-30">
                <Play className="h-3 w-3" /> Run
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {(Object.keys(KIND_STYLE) as StepKind[]).map(k => (
                <button key={k} onClick={() => addStep(k)}
                  className={`rounded-md border px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider hover:opacity-100 opacity-80 ${KIND_STYLE[k]}`}>
                  + {k}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {active.steps.map((s, idx) => (
                <div key={s.id} className="flex items-start gap-3 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3 group">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 mt-1.5" />
                  <span className="text-[9px] font-mono text-muted-foreground/40 mt-1.5">#{idx + 1}</span>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider mt-1 ${KIND_STYLE[s.kind]}`}>{s.kind}</span>
                  <input value={s.expr} onChange={e => update(p => ({ ...p, steps: p.steps.map(x => x.id === s.id ? { ...x, expr: e.target.value } : x) }))}
                    placeholder={KIND_PLACEHOLDER[s.kind]}
                    className="flex-1 bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground/40 font-mono" />
                  <button onClick={() => update(p => ({ ...p, steps: p.steps.filter(x => x.id !== s.id) }))}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {active.steps.length === 0 && (
                <p className="text-[11px] text-muted-foreground/50 text-center py-8 tracking-[0.2em] uppercase font-extralight">Add a step</p>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default TransformStudioPanel;
