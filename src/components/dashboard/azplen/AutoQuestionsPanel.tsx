import { useEffect, useMemo, useState } from "react";
import { Sparkles, RefreshCw, Plus, Trash2, ArrowRight } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

interface Question {
  id: string;
  text: string;
  category: "gap" | "verification" | "expansion" | "contradiction";
  priority: number; // 0..1
  source: string;
  promotedToPlan: boolean;
  createdAt: number;
}

const KEY = (sid: string) => `azplen:auto-q:${sid}`;
const PLAN_KEY = (sid: string) => `azplen:plan:${sid}`;

const CAT_STYLE: Record<Question["category"], string> = {
  gap: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  verification: "border-emerald-300/30 text-emerald-200 bg-emerald-300/[0.06]",
  expansion: "border-sky-300/30 text-sky-200 bg-sky-300/[0.06]",
  contradiction: "border-rose-300/30 text-rose-200 bg-rose-300/[0.06]",
};

/**
 * Generate intelligence questions deterministically from the local
 * artifact graph: memory + plan + hypotheses + contradictions + entities.
 * No network call — pure introspection across what exists in this session.
 */
const generate = (sid: string): Omit<Question, "id" | "promotedToPlan" | "createdAt">[] => {
  const out: Omit<Question, "id" | "promotedToPlan" | "createdAt">[] = [];

  const read = (k: string, fb: unknown = []) => {
    try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : fb; } catch { return fb; }
  };

  const plan = read(PLAN_KEY(sid), { objective: "", questions: [] }) as { objective: string; questions: { text: string; status: string }[] };
  const hypotheses = read(`azplen:hypotheses:${sid}`, []) as { statement: string; status: string; evidence: { stance: string }[] }[];
  const contradictions = read(`azplen:contradictions:${sid}`, []) as { topic: string; resolution: string }[];
  const memory = read("azplen:memory:global", []) as { kind: string; title: string; sessionId: string }[];
  const fusionSignals = read(`azplen:fusion:signals:${sid}`, []) as { domain: string; text: string }[];
  const flows = read(`azplen:flows:${sid}`, []) as { source: string; target: string; channel: string }[];
  const evidence = read(`azplen:evidence:${sid}`, []) as { label: string; sourceType: string }[];

  // Gaps from plan
  plan.questions.filter(q => q.status === "open").forEach(q => out.push({
    text: `Plan-question still open: "${q.text}" — what specifically blocks closure?`,
    category: "gap", priority: 0.85, source: "collection plan",
  }));

  // Hypotheses lacking evidence
  hypotheses.filter(h => h.evidence.length < 2 && h.status === "active").forEach(h => out.push({
    text: `Hypothesis under-evidenced: "${h.statement}" — what additional source would tip this?`,
    category: "verification", priority: 0.75, source: "hypothesis",
  }));

  // Open contradictions
  contradictions.filter(c => c.resolution === "open").forEach(c => out.push({
    text: `Contradiction open on "${c.topic}" — which source carries higher authority and why?`,
    category: "contradiction", priority: 0.9, source: "contradictions",
  }));

  // Memory cross-references
  memory.filter(m => m.kind === "pattern").slice(0, 3).forEach(m => out.push({
    text: `Pattern "${m.title}" was observed previously — does the current evidence trace match?`,
    category: "expansion", priority: 0.6, source: "operator memory",
  }));

  // Flow-graph leaves
  const targets = new Set(flows.map(f => f.target));
  const sources = new Set(flows.map(f => f.source));
  const leaves = Array.from(targets).filter(t => !sources.has(t)).slice(0, 3);
  leaves.forEach(l => out.push({
    text: `Terminal counterparty "${l}" has no downstream — who is the beneficial owner?`,
    category: "expansion", priority: 0.7, source: "flow graph",
  }));

  // Fusion domain coverage
  const domains = new Set(fusionSignals.map(s => s.domain));
  ["financial", "behavioral", "communications", "geospatial", "regulatory", "osint"].forEach(d => {
    if (!domains.has(d)) out.push({
      text: `No signal recorded in the "${d}" domain — what would a 30-minute sweep yield?`,
      category: "gap", priority: 0.55, source: "fusion coverage",
    });
  });

  // Evidence freshness
  if (evidence.length === 0) out.push({
    text: "No evidence has been sealed in the vault — what artifacts should be hashed before review?",
    category: "gap", priority: 0.8, source: "evidence vault",
  });

  return out.slice(0, 20);
};

const AutoQuestionsPanel = () => {
  const { activeSession } = useAzplenSession();
  const [items, setItems] = useState<Question[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!activeSession) return;
    try { setItems(JSON.parse(localStorage.getItem(KEY(activeSession.id)) || "[]")); } catch { setItems([]); }
  }, [activeSession?.id]);
  useEffect(() => {
    if (!activeSession) return;
    const h = setTimeout(() => localStorage.setItem(KEY(activeSession.id), JSON.stringify(items)), 300);
    return () => clearTimeout(h);
  }, [items, activeSession?.id]);

  const run = async () => {
    if (!activeSession) return;
    setGenerating(true);
    await new Promise(r => setTimeout(r, 400)); // visual breathing room
    const fresh = generate(activeSession.id);
    const existing = new Set(items.map(i => i.text));
    const additions: Question[] = fresh.filter(q => !existing.has(q.text)).map(q => ({
      ...q, id: crypto.randomUUID(), promotedToPlan: false, createdAt: Date.now(),
    }));
    setItems(p => [...additions, ...p]);
    setGenerating(false);
  };

  const promote = (id: string) => {
    if (!activeSession) return;
    const q = items.find(x => x.id === id);
    if (!q) return;
    try {
      const raw = localStorage.getItem(PLAN_KEY(activeSession.id));
      const plan = raw ? JSON.parse(raw) : { objective: "", questions: [] };
      plan.questions = [...(plan.questions || []), {
        id: crypto.randomUUID(), text: q.text, source: q.source, status: "open",
      }];
      localStorage.setItem(PLAN_KEY(activeSession.id), JSON.stringify(plan));
      setItems(p => p.map(x => x.id === id ? { ...x, promotedToPlan: true } : x));
    } catch { /* ignore */ }
  };

  const sorted = useMemo(() =>
    [...items].sort((a, b) => Number(a.promotedToPlan) - Number(b.promotedToPlan) || b.priority - a.priority),
    [items]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-amber-300/80 mt-1" />
          <div>
            <h2 className="text-xl font-extralight tracking-tight text-foreground">Auto-Questions</h2>
            <p className="text-xs font-extralight text-muted-foreground mt-1">
              Intelligence questions derived from the session's artifact graph. One-click promote to Collection Plan.
            </p>
          </div>
        </div>
        <button onClick={run} disabled={generating || !activeSession}
          className="flex items-center gap-1.5 rounded-lg border border-amber-300/25 bg-amber-300/[0.05] px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-300/10 disabled:opacity-30">
          <RefreshCw className={`h-3 w-3 ${generating ? "animate-spin" : ""}`} /> Generate
        </button>
      </div>

      <div className="space-y-2">
        {sorted.length === 0 && (
          <div className="rounded-xl border border-dashed border-foreground/15 p-8 text-center">
            <p className="text-[11px] text-muted-foreground/60 tracking-[0.2em] uppercase font-extralight">No questions yet</p>
            <p className="text-[10px] text-muted-foreground/40 mt-2">Click Generate to derive questions from current session state.</p>
          </div>
        )}
        {sorted.map(q => (
          <div key={q.id} className={`rounded-xl border bg-foreground/[0.02] p-4 ${q.promotedToPlan ? "opacity-60 border-emerald-300/15" : "border-foreground/10"}`}>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-1">
                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${CAT_STYLE[q.category]}`}>{q.category}</span>
                <span className="text-[9px] font-mono text-muted-foreground/60">P{Math.round(q.priority * 100)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-extralight">{q.text}</p>
                <p className="text-[10px] text-muted-foreground/60 font-mono uppercase tracking-wider mt-1">source · {q.source}</p>
              </div>
              {q.promotedToPlan ? (
                <span className="text-[10px] font-mono text-emerald-300 uppercase tracking-wider">in plan</span>
              ) : (
                <button onClick={() => promote(q.id)}
                  className="flex items-center gap-1 rounded-md border border-amber-300/25 bg-amber-300/[0.05] px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-amber-200 hover:bg-amber-300/10">
                  promote <ArrowRight className="h-2.5 w-2.5" />
                </button>
              )}
              <button onClick={() => setItems(p => p.filter(x => x.id !== q.id))} className="text-muted-foreground/60 hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AutoQuestionsPanel;
