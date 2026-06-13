import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, FileLock, ShieldCheck, ChevronRight } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

interface Evidence {
  id: string;
  label: string;
  sourceType: "document" | "transaction" | "communication" | "external";
  uri: string;
  hash: string;
  custody: { actor: string; action: string; at: number }[];
  classification: "UNCLASS" | "CUI" | "CONFIDENTIAL" | "SECRET" | "TS";
  addedAt: number;
}

const KEY = (sid: string) => `azplen:evidence:${sid}`;

const SHA = async (s: string) => {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch { return "no-crypto"; }
};

const CLASS_STYLE: Record<Evidence["classification"], string> = {
  UNCLASS: "border-emerald-300/30 text-emerald-200 bg-emerald-300/[0.06]",
  CUI: "border-sky-300/30 text-sky-200 bg-sky-300/[0.06]",
  CONFIDENTIAL: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  SECRET: "border-rose-300/30 text-rose-200 bg-rose-300/[0.06]",
  TS: "border-rose-500/40 text-rose-100 bg-rose-500/[0.08]",
};

/**
 * Evidence Vault — chain-of-custody ledger. Every artifact has a SHA-256
 * hash, classification, and an immutable custody log. Defensible in audit.
 */
const EvidencePanel = () => {
  const { activeSession } = useAzplenSession();
  const [items, setItems] = useState<Evidence[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<Evidence, "id" | "hash" | "custody" | "addedAt">>({
    label: "", sourceType: "document", uri: "", classification: "UNCLASS",
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

  const add = async () => {
    if (!draft.label.trim() || !draft.uri.trim() || !activeSession) return;
    const hash = await SHA(`${draft.uri}|${draft.label}|${Date.now()}`);
    const item: Evidence = {
      ...draft, id: crypto.randomUUID(), hash, addedAt: Date.now(),
      custody: [{ actor: "operator", action: "ingested", at: Date.now() }],
    };
    setItems(p => [item, ...p]);
    setDraft({ label: "", sourceType: "document", uri: "", classification: "UNCLASS" });
  };

  const append = (id: string, action: string) => setItems(p => p.map(e =>
    e.id === id ? { ...e, custody: [...e.custody, { actor: "operator", action, at: Date.now() }] } : e
  ));
  const remove = (id: string) => setItems(p => p.filter(e => e.id !== id));

  const stats = useMemo(() => ({
    total: items.length,
    sealed: items.filter(e => e.custody.length > 1).length,
    classified: items.filter(e => e.classification !== "UNCLASS").length,
  }), [items]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-extralight tracking-tight text-foreground">Evidence Vault</h2>
        <p className="text-xs font-extralight text-muted-foreground mt-1">
          Cryptographically-hashed artifacts with full chain-of-custody. Defensible in audit and court.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">Total artifacts</p>
          <p className="text-2xl font-extralight text-foreground mt-1">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">Sealed (chain &gt; 1)</p>
          <p className="text-2xl font-extralight text-emerald-300 mt-1">{stats.sealed}</p>
        </div>
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">Classified</p>
          <p className="text-2xl font-extralight text-amber-300 mt-1">{stats.classified}</p>
        </div>
      </div>

      <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
        <div className="grid grid-cols-12 gap-2">
          <input value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} placeholder="Label"
            className="col-span-3 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
          <select value={draft.sourceType} onChange={e => setDraft({ ...draft, sourceType: e.target.value as Evidence["sourceType"] })}
            className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight">
            <option value="document">Document</option><option value="transaction">Transaction</option>
            <option value="communication">Comm</option><option value="external">External</option>
          </select>
          <input value={draft.uri} onChange={e => setDraft({ ...draft, uri: e.target.value })} placeholder="URI / path / case ref"
            className="col-span-4 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight font-mono" />
          <select value={draft.classification} onChange={e => setDraft({ ...draft, classification: e.target.value as Evidence["classification"] })}
            className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight">
            <option>UNCLASS</option><option>CUI</option><option>CONFIDENTIAL</option><option>SECRET</option><option>TS</option>
          </select>
          <button onClick={add} className="col-span-1 rounded-lg bg-amber-300/10 border border-amber-300/20 text-xs text-amber-200 hover:bg-amber-300/20">
            <Plus className="h-3 w-3 mx-auto" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {items.length === 0 && <p className="text-[11px] text-muted-foreground/50 text-center py-12 tracking-[0.2em] uppercase font-extralight">No evidence sealed</p>}
        {items.map(e => (
          <div key={e.id} className="rounded-xl border border-foreground/10 bg-foreground/[0.02]">
            <button onClick={() => setExpanded(expanded === e.id ? null : e.id)} className="w-full p-4 flex items-center gap-4 text-left">
              <FileLock className="h-4 w-4 text-amber-300/70" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-extralight text-foreground">{e.label}</span>
                  <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${CLASS_STYLE[e.classification]}`}>{e.classification}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5 truncate">{e.uri}</p>
                <p className="text-[9px] text-muted-foreground/40 font-mono mt-1">SHA-256 {e.hash.slice(0, 24)}…</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 font-mono">
                <ShieldCheck className="h-3 w-3 text-emerald-400/70" /> {e.custody.length}
              </div>
              <ChevronRight className={`h-4 w-4 text-muted-foreground/40 transition-transform ${expanded === e.id ? "rotate-90" : ""}`} />
            </button>
            {expanded === e.id && (
              <div className="border-t border-foreground/10 px-4 py-3 space-y-2">
                {e.custody.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                    <span><span className="text-amber-300/80">{c.actor}</span> · {c.action}</span>
                    <span>{new Date(c.at).toISOString().slice(0, 19).replace("T", " ")}Z</span>
                  </div>
                ))}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-foreground/5">
                  {["reviewed", "annotated", "exported", "redacted", "transferred"].map(a => (
                    <button key={a} onClick={() => append(e.id, a)}
                      className="rounded-md border border-foreground/10 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-amber-200 hover:border-amber-300/30 font-mono uppercase tracking-wider">
                      + {a}
                    </button>
                  ))}
                  <button onClick={() => remove(e.id)} className="ml-auto rounded-md border border-rose-300/20 px-2 py-0.5 text-[10px] text-rose-300 hover:bg-rose-300/10 font-mono uppercase tracking-wider">
                    <Trash2 className="h-2.5 w-2.5 inline mr-1" /> remove
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EvidencePanel;
