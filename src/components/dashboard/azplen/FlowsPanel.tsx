import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, ArrowRight, GitBranch } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

type Channel = "wire" | "ach" | "swift" | "crypto" | "cash" | "email" | "call" | "meeting";
interface Flow {
  id: string;
  channel: Channel;
  source: string;
  target: string;
  amount?: number;
  count: number;
  firstAt: string;
  lastAt: string;
  notes: string;
}

const KEY = (sid: string) => `azplen:flows:${sid}`;

const CHANNEL_STYLE: Record<Channel, string> = {
  wire: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  ach: "border-amber-300/20 text-amber-200/80 bg-amber-300/[0.04]",
  swift: "border-violet-300/30 text-violet-200 bg-violet-300/[0.06]",
  crypto: "border-rose-300/30 text-rose-200 bg-rose-300/[0.06]",
  cash: "border-foreground/15 text-muted-foreground bg-foreground/[0.04]",
  email: "border-sky-300/30 text-sky-200 bg-sky-300/[0.06]",
  call: "border-sky-300/20 text-sky-200/80 bg-sky-300/[0.04]",
  meeting: "border-emerald-300/30 text-emerald-200 bg-emerald-300/[0.06]",
};

const FIN: Channel[] = ["wire", "ach", "swift", "crypto", "cash"];

/**
 * Flow Intelligence — financial and communications flows between
 * counterparties. Aggregates by edge; renders a left→right flow ledger.
 */
const FlowsPanel = () => {
  const { activeSession } = useAzplenSession();
  const [items, setItems] = useState<Flow[]>([]);
  const [draft, setDraft] = useState<Omit<Flow, "id">>({
    channel: "wire", source: "", target: "", amount: 0, count: 1,
    firstAt: new Date().toISOString().slice(0, 10), lastAt: new Date().toISOString().slice(0, 10), notes: "",
  });
  const [mode, setMode] = useState<"all" | "financial" | "communications">("all");

  useEffect(() => {
    if (!activeSession) return;
    try { setItems(JSON.parse(localStorage.getItem(KEY(activeSession.id)) || "[]")); } catch { setItems([]); }
  }, [activeSession?.id]);
  useEffect(() => {
    if (!activeSession) return;
    const h = setTimeout(() => localStorage.setItem(KEY(activeSession.id), JSON.stringify(items)), 300);
    return () => clearTimeout(h);
  }, [items, activeSession?.id]);

  const filtered = useMemo(() => {
    if (mode === "financial") return items.filter(f => FIN.includes(f.channel));
    if (mode === "communications") return items.filter(f => !FIN.includes(f.channel));
    return items;
  }, [items, mode]);

  const totals = useMemo(() => {
    const finTotal = items.filter(f => FIN.includes(f.channel)).reduce((s, f) => s + (f.amount ?? 0), 0);
    const commCount = items.filter(f => !FIN.includes(f.channel)).reduce((s, f) => s + f.count, 0);
    return { finTotal, commCount };
  }, [items]);

  const add = () => {
    if (!draft.source.trim() || !draft.target.trim()) return;
    setItems(p => [{ ...draft, id: crypto.randomUUID() }, ...p]);
    setDraft({ ...draft, source: "", target: "", amount: 0, count: 1, notes: "" });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start gap-3">
        <GitBranch className="h-5 w-5 text-amber-300/80 mt-1" />
        <div>
          <h2 className="text-xl font-extralight tracking-tight text-foreground">Flow Intelligence</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            Financial and communications flows between counterparties. Aggregated by edge.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">Financial volume</p>
          <p className="text-2xl font-extralight text-amber-200 mt-1">${totals.finTotal.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">Communications events</p>
          <p className="text-2xl font-extralight text-sky-200 mt-1">{totals.commCount}</p>
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3">
        <div className="grid grid-cols-12 gap-2">
          <select value={draft.channel} onChange={e => setDraft({ ...draft, channel: e.target.value as Channel })}
            className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight">
            {(Object.keys(CHANNEL_STYLE) as Channel[]).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value })} placeholder="Source"
            className="col-span-3 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <input value={draft.target} onChange={e => setDraft({ ...draft, target: e.target.value })} placeholder="Target"
            className="col-span-3 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <input type="number" value={draft.amount} onChange={e => setDraft({ ...draft, amount: parseFloat(e.target.value) || 0 })} placeholder="Amount"
            className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-mono" />
          <input type="number" value={draft.count} onChange={e => setDraft({ ...draft, count: parseInt(e.target.value) || 1 })} placeholder="#"
            className="col-span-1 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-2 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-mono" />
          <button onClick={add} className="col-span-1 rounded-lg bg-amber-300/10 border border-amber-300/20 text-xs text-amber-200 hover:bg-amber-300/20">
            <Plus className="h-3 w-3 mx-auto" />
          </button>
        </div>
        <input value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })} placeholder="Period / context / classification reasons…"
          className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
      </div>

      <div className="flex gap-1">
        {(["all","financial","communications"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`px-3 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider border transition-colors
              ${mode === m ? "border-amber-300/30 bg-amber-300/[0.06] text-amber-200" : "border-foreground/10 text-muted-foreground hover:text-foreground"}`}>
            {m}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <p className="text-[11px] text-muted-foreground/50 text-center py-12 tracking-[0.2em] uppercase font-extralight">No flows</p>}
        {filtered.map(f => (
          <div key={f.id} className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${CHANNEL_STYLE[f.channel]}`}>{f.channel}</span>
              <span className="text-sm font-extralight text-foreground">{f.source}</span>
              <ArrowRight className="h-3 w-3 text-amber-300/60" />
              <span className="text-sm font-extralight text-foreground">{f.target}</span>
              <div className="ml-auto flex items-center gap-4 text-[11px] font-mono">
                {f.amount ? <span className="text-amber-200">${f.amount.toLocaleString()}</span> : null}
                <span className="text-muted-foreground/60">×{f.count}</span>
                <span className="text-muted-foreground/40">{f.firstAt} → {f.lastAt}</span>
                <button onClick={() => setItems(p => p.filter(x => x.id !== f.id))} className="text-muted-foreground/60 hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
            {f.notes && <p className="text-[11px] text-muted-foreground font-extralight mt-2 pl-1">{f.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FlowsPanel;
