import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Brain, Tag, Search, Star } from "lucide-react";
import { useAzplenSession } from "./AzplenSessionContext";

type MemoryKind = "entity" | "source" | "pattern" | "playbook";
interface Memory {
  id: string;
  kind: MemoryKind;
  title: string;
  body: string;
  tags: string[];
  confidence: number; // 0..1
  promoted: boolean; // team-level
  outdated: boolean;
  sessionId: string;
  createdAt: number;
}

const KEY = "azplen:memory:global";

const KIND_META: Record<MemoryKind, { label: string; color: string }> = {
  entity:   { label: "Entity",   color: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]" },
  source:   { label: "Source",   color: "border-sky-300/30 text-sky-200 bg-sky-300/[0.06]" },
  pattern:  { label: "Pattern",  color: "border-violet-300/30 text-violet-200 bg-violet-300/[0.06]" },
  playbook: { label: "Playbook", color: "border-emerald-300/30 text-emerald-200 bg-emerald-300/[0.06]" },
};

/**
 * Operator Memory Engine — persistent, cross-session knowledge base of
 * entities, sources, patterns, and playbooks. Survives every session and
 * surfaces relevant prior knowledge in new investigations.
 */
const MemoryPanel = () => {
  const { activeSession } = useAzplenSession();
  const [items, setItems] = useState<Memory[]>([]);
  const [query, setQuery] = useState("");
  const [filterKind, setFilterKind] = useState<MemoryKind | "all">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<Omit<Memory, "id" | "createdAt" | "sessionId" | "promoted" | "outdated">>({
    kind: "entity", title: "", body: "", tags: [], confidence: 0.7,
  });
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); setItems(raw ? JSON.parse(raw) : []); } catch { setItems([]); }
  }, []);
  useEffect(() => {
    const h = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {} }, 300);
    return () => clearTimeout(h);
  }, [items]);

  const filtered = useMemo(() => items
    .filter(m => filterKind === "all" || m.kind === filterKind)
    .filter(m => !query ||
      m.title.toLowerCase().includes(query.toLowerCase()) ||
      m.body.toLowerCase().includes(query.toLowerCase()) ||
      m.tags.some(t => t.toLowerCase().includes(query.toLowerCase())))
    .sort((a, b) => Number(b.promoted) - Number(a.promoted) || b.createdAt - a.createdAt),
    [items, query, filterKind]);

  const relevant = useMemo(() => {
    if (!activeSession) return [] as Memory[];
    const ctx = (activeSession.companyName || activeSession.name).toLowerCase();
    return items
      .filter(m => m.sessionId !== activeSession.id)
      .filter(m => m.title.toLowerCase().includes(ctx) || m.tags.some(t => ctx.includes(t.toLowerCase())))
      .slice(0, 3);
  }, [items, activeSession]);

  const add = () => {
    if (!draft.title.trim() || !activeSession) return;
    setItems(prev => [{
      ...draft, id: crypto.randomUUID(), createdAt: Date.now(),
      sessionId: activeSession.id, promoted: false, outdated: false,
    }, ...prev]);
    setDraft({ kind: "entity", title: "", body: "", tags: [], confidence: 0.7 });
    setShowCreate(false);
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    setDraft(d => ({ ...d, tags: Array.from(new Set([...d.tags, t])) }));
    setTagInput("");
  };

  const toggle = (id: string, k: "promoted" | "outdated") =>
    setItems(prev => prev.map(m => m.id === id ? { ...m, [k]: !m[k] } : m));
  const remove = (id: string) => setItems(prev => prev.filter(m => m.id !== id));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-extralight tracking-tight text-foreground">Operator Memory</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            Persistent knowledge across every session — entities, sources, patterns, playbooks.
          </p>
        </div>
        <button onClick={() => setShowCreate(s => !s)}
          className="flex items-center gap-1.5 rounded-lg border border-amber-300/20 bg-amber-300/[0.04] px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-300/10 transition-colors">
          <Plus className="h-3 w-3" /> New memory
        </button>
      </div>

      {relevant.length > 0 && (
        <div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.03] p-4">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-amber-200/80 mb-2">
            <Brain className="h-3 w-3" /> Surfaced for this session
          </div>
          <div className="space-y-2">
            {relevant.map(m => (
              <div key={m.id} className="text-xs text-foreground/90 font-extralight">
                <span className="text-amber-300/80">·</span> {m.title}
                <span className="text-muted-foreground/60 ml-2 text-[10px]">{KIND_META[m.kind].label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showCreate && (
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3">
          <div className="flex gap-2">
            {(Object.keys(KIND_META) as MemoryKind[]).map(k => (
              <button key={k} onClick={() => setDraft(d => ({ ...d, kind: k }))}
                className={`px-2.5 py-1 rounded-md border text-[10px] font-mono uppercase tracking-wider transition-colors
                  ${draft.kind === k ? KIND_META[k].color : "border-foreground/10 text-muted-foreground hover:text-foreground"}`}>
                {KIND_META[k].label}
              </button>
            ))}
          </div>
          <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
            placeholder="Title — e.g. Triangular ownership pattern (Cyprus shells)"
            className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-amber-300/40 font-extralight" />
          <textarea value={draft.body} onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
            placeholder="Body — what was learned, how it manifests, confidence rationale…"
            rows={4}
            className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-amber-300/40 font-extralight resize-none" />
          <div className="flex flex-wrap items-center gap-2">
            {draft.tags.map(t => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-foreground/[0.04] px-2 py-0.5 text-[10px] text-muted-foreground">
                <Tag className="h-2.5 w-2.5" />{t}
                <button onClick={() => setDraft(d => ({ ...d, tags: d.tags.filter(x => x !== t) }))} className="hover:text-foreground">×</button>
              </span>
            ))}
            <div className="flex items-center gap-1">
              <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="add tag…"
                className="w-28 bg-foreground/[0.04] border border-foreground/10 rounded-md px-2 py-1 text-[10px] text-foreground outline-none focus:border-amber-300/30 font-extralight" />
            </div>
            <label className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground">
              Confidence
              <input type="range" min={0} max={1} step={0.05}
                value={draft.confidence} onChange={e => setDraft(d => ({ ...d, confidence: parseFloat(e.target.value) }))} />
              <span className="font-mono text-amber-200/80 w-8 text-right">{Math.round(draft.confidence * 100)}%</span>
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={add}
              className="rounded-lg bg-amber-300/10 border border-amber-300/20 px-4 py-1.5 text-xs text-amber-200 hover:bg-amber-300/20 transition-colors">
              Save memory
            </button>
            <button onClick={() => setShowCreate(false)}
              className="rounded-lg border border-foreground/10 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search memories…"
            className="w-full pl-9 pr-3 py-2 bg-foreground/[0.02] border border-foreground/10 rounded-lg text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-amber-300/30 font-extralight" />
        </div>
        <div className="flex gap-1">
          <button onClick={() => setFilterKind("all")}
            className={`px-2.5 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider border transition-colors
              ${filterKind === "all" ? "border-amber-300/30 bg-amber-300/[0.06] text-amber-200" : "border-foreground/10 text-muted-foreground hover:text-foreground"}`}>
            All
          </button>
          {(Object.keys(KIND_META) as MemoryKind[]).map(k => (
            <button key={k} onClick={() => setFilterKind(k)}
              className={`px-2.5 py-1.5 rounded-md text-[10px] font-mono uppercase tracking-wider border transition-colors
                ${filterKind === k ? KIND_META[k].color : "border-foreground/10 text-muted-foreground hover:text-foreground"}`}>
              {KIND_META[k].label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-[11px] text-muted-foreground/50 text-center py-12 tracking-[0.2em] uppercase font-extralight">
            No memories yet
          </p>
        )}
        {filtered.map(m => (
          <div key={m.id}
            className={`rounded-xl border bg-foreground/[0.02] p-4 group ${m.outdated ? "opacity-50" : ""}
              ${m.promoted ? "border-amber-300/25" : "border-foreground/10"}`}>
            <div className="flex items-start gap-3">
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${KIND_META[m.kind].color}`}>
                {KIND_META[m.kind].label}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-extralight text-foreground truncate">{m.title}</h4>
                  {m.promoted && <Star className="h-3 w-3 text-amber-300 fill-amber-300/30" />}
                </div>
                {m.body && <p className="text-xs text-muted-foreground font-extralight mt-1 leading-relaxed">{m.body}</p>}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {m.tags.map(t => (
                    <span key={t} className="text-[9px] text-muted-foreground/60 font-mono uppercase tracking-wider">#{t}</span>
                  ))}
                  <span className="ml-auto text-[9px] text-muted-foreground/40 font-mono">
                    {Math.round(m.confidence * 100)}% · {new Date(m.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => toggle(m.id, "promoted")} title="Promote to team"
                  className="p-1 rounded text-muted-foreground/60 hover:text-amber-300 transition-colors">
                  <Star className="h-3 w-3" />
                </button>
                <button onClick={() => toggle(m.id, "outdated")} title="Mark outdated"
                  className="p-1 rounded text-muted-foreground/60 hover:text-foreground transition-colors text-[10px] font-mono">
                  ⌀
                </button>
                <button onClick={() => remove(m.id)}
                  className="p-1 rounded text-muted-foreground/60 hover:text-destructive transition-colors">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MemoryPanel;
