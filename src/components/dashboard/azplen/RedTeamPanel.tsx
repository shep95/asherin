import { useEffect, useState } from "react";
import { Plus, Trash2, Swords, Target } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

interface Critique {
  id: string;
  finding: string;       // the claim being attacked
  attack: string;        // why it might be wrong
  rebuttal: string;      // why it still holds (or doesn't)
  verdict: "holds" | "weakens" | "breaks" | "undetermined";
  createdAt: number;
}

const KEY = (sid: string) => `azplen:redteam:${sid}`;

const VERDICT: Record<Critique["verdict"], string> = {
  holds: "border-emerald-300/30 text-emerald-200 bg-emerald-300/[0.06]",
  weakens: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  breaks: "border-rose-300/30 text-rose-200 bg-rose-300/[0.06]",
  undetermined: "border-foreground/15 text-muted-foreground bg-foreground/[0.04]",
};

/**
 * Adversarial Red Team — every finding is attacked. The AI plays the
 * adversary: "Here is why your conclusion might be wrong." Strength of
 * the analysis = strength after rebuttal.
 */
const RedTeamPanel = () => {
  const { activeSession } = useAzplenSession();
  const [items, setItems] = useState<Critique[]>([]);
  const [draft, setDraft] = useState({ finding: "", attack: "", rebuttal: "" });

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
    if (!draft.finding.trim() || !draft.attack.trim()) return;
    setItems(p => [{ ...draft, id: crypto.randomUUID(), createdAt: Date.now(), verdict: "undetermined" }, ...p]);
    setDraft({ finding: "", attack: "", rebuttal: "" });
  };
  const update = (id: string, patch: Partial<Critique>) =>
    setItems(p => p.map(c => c.id === id ? { ...c, ...patch } : c));
  const remove = (id: string) => setItems(p => p.filter(c => c.id !== id));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start gap-3">
        <Swords className="h-5 w-5 text-rose-300/80 mt-1" />
        <div>
          <h2 className="text-xl font-extralight tracking-tight text-foreground">Red Team</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            Adversarial critique of every finding. Strength of analysis = strength after rebuttal.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3">
        <input value={draft.finding} onChange={e => setDraft({ ...draft, finding: e.target.value })}
          placeholder="Finding under attack — e.g. ACME is using shell companies to evade sanctions"
          className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-amber-300/40 font-extralight" />
        <textarea value={draft.attack} onChange={e => setDraft({ ...draft, attack: e.target.value })}
          placeholder="Adversary argument — why might this conclusion be wrong?" rows={3}
          className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/40 font-extralight resize-none" />
        <textarea value={draft.rebuttal} onChange={e => setDraft({ ...draft, rebuttal: e.target.value })}
          placeholder="Rebuttal — does the evidence still hold?" rows={2}
          className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/40 font-extralight resize-none" />
        <button onClick={add} className="rounded-lg bg-rose-300/10 border border-rose-300/20 px-4 py-1.5 text-xs text-rose-200 hover:bg-rose-300/20">
          <Plus className="h-3 w-3 inline mr-1" /> Log critique
        </button>
      </div>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-[11px] text-muted-foreground/50 text-center py-12 tracking-[0.2em] uppercase font-extralight">No critiques yet</p>}
        {items.map(c => (
          <div key={c.id} className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <Target className="h-3.5 w-3.5 text-rose-300/80 mt-1" />
                <p className="text-sm font-extralight text-foreground">{c.finding}</p>
              </div>
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${VERDICT[c.verdict]}`}>{c.verdict}</span>
              <button onClick={() => remove(c.id)} className="text-muted-foreground/60 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 pl-5">
              <div className="rounded-lg border border-rose-300/15 bg-rose-300/[0.02] p-3">
                <p className="text-[9px] font-mono uppercase tracking-wider text-rose-300/70 mb-1">Attack</p>
                <p className="text-xs text-foreground font-extralight whitespace-pre-wrap">{c.attack}</p>
              </div>
              <div className="rounded-lg border border-emerald-300/15 bg-emerald-300/[0.02] p-3">
                <p className="text-[9px] font-mono uppercase tracking-wider text-emerald-300/70 mb-1">Rebuttal</p>
                <p className="text-xs text-foreground font-extralight whitespace-pre-wrap">{c.rebuttal || "—"}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 pl-5">
              {(["holds","weakens","breaks","undetermined"] as Critique["verdict"][]).map(v => (
                <button key={v} onClick={() => update(c.id, { verdict: v })}
                  className={`px-2 py-1 rounded-md text-[9px] font-mono uppercase tracking-wider border transition-colors
                    ${c.verdict === v ? VERDICT[v] : "border-foreground/10 text-muted-foreground hover:text-foreground"}`}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RedTeamPanel;
