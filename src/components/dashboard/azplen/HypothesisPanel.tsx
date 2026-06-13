import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

type Status = "active" | "confirmed" | "refuted" | "suspended";
type Stance = "for" | "against";

interface Evidence { id: string; text: string; stance: Stance; }
interface Hypothesis {
  id: string;
  statement: string;
  status: Status;
  evidence: Evidence[];
}

const storageKey = (sid: string) => `azplen:hypotheses:${sid}`;

const STATUS_STYLE: Record<Status, string> = {
  active: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  confirmed: "border-emerald-300/30 text-emerald-200 bg-emerald-300/[0.06]",
  refuted: "border-rose-300/30 text-rose-200 bg-rose-300/[0.06]",
  suspended: "border-foreground/15 text-muted-foreground bg-foreground/[0.04]",
};

/**
 * Hypothesis Testing — record competing hypotheses with evidence for/against.
 * Computes a naive probability estimate (for / for+against) as the leading
 * indicator. Real ACH analysis remains in the AI panel; this is the operator's
 * structured workspace.
 */
const HypothesisPanel = () => {
  const { activeSession } = useAzplenSession();
  const [items, setItems] = useState<Hypothesis[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newStmt, setNewStmt] = useState("");

  useEffect(() => {
    if (!activeSession) return;
    try {
      const raw = localStorage.getItem(storageKey(activeSession.id));
      setItems(raw ? JSON.parse(raw) : []);
    } catch { setItems([]); }
  }, [activeSession?.id]);

  useEffect(() => {
    if (!activeSession) return;
    const h = setTimeout(() => {
      try { localStorage.setItem(storageKey(activeSession.id), JSON.stringify(items)); } catch {}
    }, 300);
    return () => clearTimeout(h);
  }, [items, activeSession?.id]);

  const add = () => {
    if (!newStmt.trim()) return;
    setItems((prev) => [...prev, { id: crypto.randomUUID(), statement: newStmt.trim(), status: "active", evidence: [] }]);
    setNewStmt("");
  };
  const remove = (id: string) => setItems((prev) => prev.filter((h) => h.id !== id));
  const setStatus = (id: string, status: Status) => setItems((prev) => prev.map((h) => h.id === id ? { ...h, status } : h));
  const addEvidence = (id: string, stance: Stance) => {
    const text = window.prompt(`Evidence ${stance.toUpperCase()} this hypothesis`)?.trim();
    if (!text) return;
    setItems((prev) => prev.map((h) => h.id === id ? { ...h, evidence: [...h.evidence, { id: crypto.randomUUID(), text, stance }] } : h));
  };
  const removeEvidence = (hid: string, eid: string) =>
    setItems((prev) => prev.map((h) => h.id === hid ? { ...h, evidence: h.evidence.filter((e) => e.id !== eid) } : h));

  const leading = useMemo(() => {
    let best: { id: string; score: number } | null = null;
    for (const h of items) {
      if (h.status !== "active") continue;
      const f = h.evidence.filter((e) => e.stance === "for").length;
      const a = h.evidence.filter((e) => e.stance === "against").length;
      const score = f + a > 0 ? f / (f + a) : 0;
      if (!best || score > best.score) best = { id: h.id, score };
    }
    return best;
  }, [items]);

  if (!activeSession) {
    return <div className="flex h-full items-center justify-center text-muted-foreground text-sm">Select a session to track hypotheses.</div>;
  }

  return (
    <div className="space-y-5 p-6 max-w-4xl mx-auto">
      {/* New hypothesis */}
      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5">
        <label className="block text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60 mb-2">New Hypothesis</label>
        <div className="flex gap-2">
          <input
            value={newStmt}
            onChange={(e) => setNewStmt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder='e.g. "Org A is funding Org B through intermediary C"'
            className="flex-1 bg-transparent border border-foreground/10 rounded-lg px-3 py-2 text-sm font-extralight focus:outline-none focus:border-amber-300/40"
          />
          <button onClick={add} className="px-4 py-2 rounded-lg border border-amber-300/30 bg-amber-300/[0.06] text-amber-100 text-xs uppercase tracking-[0.2em] hover:bg-amber-300/[0.12]">
            <Plus className="inline h-3 w-3 mr-1" />Add
          </button>
        </div>
      </div>

      {/* List */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-foreground/10 p-8 text-center text-muted-foreground/60 text-xs">
          No hypotheses recorded yet. Define the first one above.
        </div>
      ) : items.map((h) => {
        const isOpen = expanded[h.id] ?? true;
        const f = h.evidence.filter((e) => e.stance === "for").length;
        const a = h.evidence.filter((e) => e.stance === "against").length;
        const total = f + a;
        const prob = total === 0 ? 0 : Math.round((f / total) * 100);
        const isLeading = leading?.id === h.id;
        return (
          <div key={h.id} className={`rounded-xl border bg-foreground/[0.02] ${isLeading ? "border-amber-300/40" : "border-foreground/10"}`}>
            <div className="flex items-start gap-3 p-4">
              <button onClick={() => setExpanded((e) => ({ ...e, [h.id]: !isOpen }))} className="mt-0.5 text-muted-foreground/60 hover:text-foreground">
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {isLeading && <span className="text-[8px] font-mono uppercase tracking-[0.22em] rounded px-1.5 py-0.5 border border-amber-300/40 bg-amber-300/[0.08] text-amber-200">Leading</span>}
                  <span className="text-sm font-extralight text-foreground">{h.statement}</span>
                </div>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-300">FOR: {f}</span>
                  <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-rose-300">AGAINST: {a}</span>
                  <span className="text-[10px] font-mono tabular-nums text-muted-foreground">→ {prob}% supported</span>
                </div>
              </div>
              <select
                value={h.status}
                onChange={(e) => setStatus(h.id, e.target.value as Status)}
                className={`text-[10px] font-mono uppercase tracking-[0.18em] rounded-md border px-2 py-1 bg-transparent ${STATUS_STYLE[h.status]}`}
              >
                <option value="active">active</option>
                <option value="confirmed">confirmed</option>
                <option value="refuted">refuted</option>
                <option value="suspended">suspended</option>
              </select>
              <button onClick={() => remove(h.id)} className="text-muted-foreground/40 hover:text-rose-300">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {isOpen && (
              <div className="border-t border-foreground/10 p-4 space-y-2">
                <div className="flex gap-2">
                  <button onClick={() => addEvidence(h.id, "for")} className="text-[10px] uppercase tracking-[0.2em] rounded-md border border-emerald-300/30 text-emerald-200 px-2.5 py-1 hover:bg-emerald-300/[0.06]">
                    + Evidence FOR
                  </button>
                  <button onClick={() => addEvidence(h.id, "against")} className="text-[10px] uppercase tracking-[0.2em] rounded-md border border-rose-300/30 text-rose-200 px-2.5 py-1 hover:bg-rose-300/[0.06]">
                    + Evidence AGAINST
                  </button>
                </div>
                {h.evidence.length === 0 ? (
                  <div className="text-[11px] italic text-muted-foreground/50 py-2">No evidence recorded.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {h.evidence.map((e) => (
                      <li key={e.id} className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${e.stance === "for" ? "border-emerald-300/20 bg-emerald-300/[0.04]" : "border-rose-300/20 bg-rose-300/[0.04]"}`}>
                        <span className={`text-[8px] font-mono uppercase tracking-[0.22em] mt-1 ${e.stance === "for" ? "text-emerald-300" : "text-rose-300"}`}>{e.stance}</span>
                        <span className="flex-1 font-extralight text-foreground/90">{e.text}</span>
                        <button onClick={() => removeEvidence(h.id, e.id)} className="text-muted-foreground/40 hover:text-foreground">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default HypothesisPanel;
