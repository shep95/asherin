import { useEffect, useState } from "react";
import { Plus, Trash2, CheckCircle2, Circle, CircleDashed } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

interface Question {
  id: string;
  text: string;
  source: string;
  status: "open" | "partial" | "complete";
}
interface Plan {
  objective: string;
  questions: Question[];
}

const storageKey = (sid: string) => `azplen:plan:${sid}`;

/**
 * Collection Plan — structured spec of intelligence questions and the data
 * sources that answer them. Per-session, persisted locally.
 */
const CollectionPlanPanel = () => {
  const { activeSession } = useAzplenSession();
  const [plan, setPlan] = useState<Plan>({ objective: "", questions: [] });
  const [draft, setDraft] = useState({ text: "", source: "" });

  useEffect(() => {
    if (!activeSession) return;
    try {
      const raw = localStorage.getItem(storageKey(activeSession.id));
      setPlan(raw ? JSON.parse(raw) : { objective: "", questions: [] });
    } catch { setPlan({ objective: "", questions: [] }); }
  }, [activeSession?.id]);

  useEffect(() => {
    if (!activeSession) return;
    const h = setTimeout(() => {
      try { localStorage.setItem(storageKey(activeSession.id), JSON.stringify(plan)); } catch {}
    }, 300);
    return () => clearTimeout(h);
  }, [plan, activeSession?.id]);

  const add = () => {
    if (!draft.text.trim()) return;
    setPlan((p) => ({ ...p, questions: [...p.questions, { id: crypto.randomUUID(), text: draft.text.trim(), source: draft.source.trim(), status: "open" }] }));
    setDraft({ text: "", source: "" });
  };
  const cycle = (id: string) => {
    const next: Record<Question["status"], Question["status"]> = { open: "partial", partial: "complete", complete: "open" };
    setPlan((p) => ({ ...p, questions: p.questions.map((q) => q.id === id ? { ...q, status: next[q.status] } : q) }));
  };
  const remove = (id: string) => setPlan((p) => ({ ...p, questions: p.questions.filter((q) => q.id !== id) }));

  const StatusIcon = ({ s }: { s: Question["status"] }) => {
    if (s === "complete") return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
    if (s === "partial") return <CircleDashed className="h-4 w-4 text-amber-300" />;
    return <Circle className="h-4 w-4 text-muted-foreground/40" />;
  };

  const coverage = plan.questions.length
    ? Math.round((plan.questions.filter((q) => q.status === "complete").length / plan.questions.length) * 100)
    : 0;

  if (!activeSession) {
    return <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Select a session to define a collection plan.</div>;
  }

  return (
    <div className="space-y-5 p-6 max-w-4xl mx-auto">
      {/* Objective */}
      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5">
        <label className="block text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60 mb-2">Investigation Objective</label>
        <textarea
          value={plan.objective}
          onChange={(e) => setPlan((p) => ({ ...p, objective: e.target.value }))}
          rows={3}
          placeholder="In plain English: what is this investigation trying to determine?"
          className="w-full bg-transparent border border-foreground/10 rounded-lg px-3 py-2 text-sm font-extralight text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-amber-300/40"
        />
      </div>

      {/* Coverage */}
      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-light tracking-wide text-foreground">Coverage</h3>
          <span className="text-[11px] font-mono tabular-nums text-amber-200">{coverage}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-400/60 to-emerald-400/60 transition-all" style={{ width: `${coverage}%` }} />
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-2">{plan.questions.length} intelligence questions defined</p>
      </div>

      {/* New question */}
      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5">
        <div className="flex flex-col gap-2">
          <input
            value={draft.text}
            onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
            placeholder="Intelligence question — what do we need to answer?"
            className="w-full bg-transparent border border-foreground/10 rounded-lg px-3 py-2 text-sm font-extralight focus:outline-none focus:border-amber-300/40"
          />
          <div className="flex gap-2">
            <input
              value={draft.source}
              onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
              placeholder="Data source(s) that would answer it"
              className="flex-1 bg-transparent border border-foreground/10 rounded-lg px-3 py-2 text-sm font-extralight focus:outline-none focus:border-amber-300/40"
            />
            <button onClick={add} className="px-4 py-2 rounded-lg border border-amber-300/30 bg-amber-300/[0.06] text-amber-100 text-xs uppercase tracking-[0.2em] hover:bg-amber-300/[0.12]">
              <Plus className="inline h-3 w-3 mr-1" />Add
            </button>
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-2">
        {plan.questions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-foreground/10 p-8 text-center text-muted-foreground/60 text-xs">
            No questions defined yet. Add the first one above.
          </div>
        ) : plan.questions.map((q) => (
          <div key={q.id} className="flex items-start gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
            <button onClick={() => cycle(q.id)} title="Cycle status" className="mt-0.5">
              <StatusIcon s={q.status} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-extralight text-foreground">{q.text}</div>
              {q.source && <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60 mt-1">Source: {q.source}</div>}
            </div>
            <button onClick={() => remove(q.id)} className="text-muted-foreground/40 hover:text-rose-300">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CollectionPlanPanel;
