import { useEffect, useState } from "react";
import { Plus, Trash2, Play, BookOpen, GripVertical } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

interface Step { id: string; title: string; detail: string; done: boolean; }
interface Playbook {
  id: string;
  name: string;
  domain: string; // e.g. "Sanctions evasion", "Shell network", "Insider threat"
  steps: Step[];
  createdAt: number;
}

const KEY = "azplen:playbooks:global";

const SEED: Playbook[] = [
  {
    id: "seed-shell",
    name: "Shell Company Network Sweep",
    domain: "Counterparty risk",
    createdAt: Date.now(),
    steps: [
      { id: "1", title: "Pull beneficial-ownership filings", detail: "OpenCorporates + national registries; flag opaque chains > 2 levels.", done: false },
      { id: "2", title: "Cluster shared registered agents", detail: "Same agent across ≥ 5 entities = signature.", done: false },
      { id: "3", title: "Cross-ref sanctions/PEP lists", detail: "OFAC SDN + EU CFSP + UN consolidated.", done: false },
      { id: "4", title: "Map directorship overlaps", detail: "Identify triangular control structures.", done: false },
      { id: "5", title: "Score & escalate", detail: "Triangular + opaque + sanction-adjacent → critical.", done: false },
    ],
  },
];

/**
 * Investigation Playbooks — reusable, step-by-step procedures distilled
 * from prior investigations. Operators clone, customise, and execute.
 */
const PlaybooksPanel = () => {
  const { activeSession } = useAzplenSession();
  const [items, setItems] = useState<Playbook[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ name: "", domain: "" });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      setItems(raw ? JSON.parse(raw) : SEED);
    } catch { setItems(SEED); }
  }, []);
  useEffect(() => {
    const h = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} }, 300);
    return () => clearTimeout(h);
  }, [items]);

  const active = items.find(p => p.id === activeId) ?? null;

  const create = () => {
    if (!draft.name.trim()) return;
    const p: Playbook = {
      id: crypto.randomUUID(), name: draft.name.trim(),
      domain: draft.domain.trim() || "General", steps: [], createdAt: Date.now(),
    };
    setItems(prev => [p, ...prev]);
    setActiveId(p.id);
    setDraft({ name: "", domain: "" });
    setShowCreate(false);
  };

  const updateActive = (fn: (p: Playbook) => Playbook) =>
    setItems(prev => prev.map(p => p.id === activeId ? fn(p) : p));

  const addStep = () => updateActive(p => ({
    ...p, steps: [...p.steps, { id: crypto.randomUUID(), title: "New step", detail: "", done: false }],
  }));
  const updateStep = (sid: string, patch: Partial<Step>) => updateActive(p => ({
    ...p, steps: p.steps.map(s => s.id === sid ? { ...s, ...patch } : s),
  }));
  const removeStep = (sid: string) => updateActive(p => ({ ...p, steps: p.steps.filter(s => s.id !== sid) }));

  const execute = (p: Playbook) => {
    if (!activeSession) return;
    const runs = JSON.parse(localStorage.getItem(`azplen:playbook-runs:${activeSession.id}`) || "[]");
    runs.unshift({ playbookId: p.id, name: p.name, startedAt: Date.now() });
    localStorage.setItem(`azplen:playbook-runs:${activeSession.id}`, JSON.stringify(runs));
    setActiveId(p.id);
    updateActive(pp => ({ ...pp, steps: pp.steps.map(s => ({ ...s, done: false })) }));
  };

  return (
    <div className="grid grid-cols-12 gap-4 p-6 h-full">
      <aside className="col-span-12 md:col-span-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extralight tracking-wide text-foreground flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5 text-amber-300/80" /> Playbooks
          </h2>
          <button onClick={() => setShowCreate(s => !s)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]">
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {showCreate && (
          <div className="space-y-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
            <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="Playbook name" autoFocus
              className="w-full bg-foreground/[0.04] border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
            <input value={draft.domain} onChange={e => setDraft({ ...draft, domain: e.target.value })}
              placeholder="Domain (Sanctions, Fraud, …)"
              className="w-full bg-foreground/[0.04] border border-foreground/10 rounded px-2 py-1.5 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
            <button onClick={create}
              className="w-full rounded bg-amber-300/10 border border-amber-300/20 py-1.5 text-xs text-amber-200 hover:bg-amber-300/20 transition-colors">
              Create
            </button>
          </div>
        )}
        <div className="space-y-1.5">
          {items.map(p => (
            <button key={p.id} onClick={() => setActiveId(p.id)}
              className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all ${
                activeId === p.id
                  ? "border-amber-300/30 bg-amber-300/[0.04]"
                  : "border-foreground/10 bg-foreground/[0.02] hover:border-foreground/20"
              }`}>
              <p className="text-xs font-extralight text-foreground truncate">{p.name}</p>
              <p className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider mt-0.5">
                {p.domain} · {p.steps.length} steps
              </p>
            </button>
          ))}
        </div>
      </aside>

      <section className="col-span-12 md:col-span-8 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5 overflow-y-auto">
        {!active ? (
          <div className="h-full flex items-center justify-center text-[11px] text-muted-foreground/50 tracking-[0.2em] uppercase font-extralight">
            Select a playbook
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-lg font-extralight text-foreground">{active.name}</h3>
                <p className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider mt-1">{active.domain}</p>
              </div>
              <button onClick={() => execute(active)}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-300/25 bg-emerald-300/[0.05] px-3 py-1.5 text-xs text-emerald-200 hover:bg-emerald-300/10 transition-colors">
                <Play className="h-3 w-3" /> Run in session
              </button>
            </div>
            <div className="space-y-2">
              {active.steps.map((s, idx) => (
                <div key={s.id} className="flex items-start gap-3 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3 group">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 mt-1 flex-shrink-0" />
                  <input type="checkbox" checked={s.done} onChange={e => updateStep(s.id, { done: e.target.checked })}
                    className="mt-1 accent-amber-300" />
                  <div className="flex-1 min-w-0">
                    <input value={s.title} onChange={e => updateStep(s.id, { title: e.target.value })}
                      className="w-full bg-transparent border-none outline-none text-sm text-foreground font-extralight" />
                    <textarea value={s.detail} onChange={e => updateStep(s.id, { detail: e.target.value })}
                      placeholder="Procedure details…" rows={1}
                      className="w-full bg-transparent border-none outline-none text-xs text-muted-foreground placeholder:text-muted-foreground/40 font-extralight resize-none mt-1" />
                  </div>
                  <span className="text-[9px] text-muted-foreground/40 font-mono mt-1">#{idx + 1}</span>
                  <button onClick={() => removeStep(s.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button onClick={addStep}
                className="w-full rounded-lg border border-dashed border-foreground/15 py-2 text-xs text-muted-foreground hover:text-amber-200 hover:border-amber-300/30 transition-colors">
                + Add step
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default PlaybooksPanel;
