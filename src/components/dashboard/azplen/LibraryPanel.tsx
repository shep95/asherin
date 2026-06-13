import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Library, Search, Share2 } from "lucide-react";

type Kind = "entity" | "report" | "playbook" | "dataset" | "pattern";
interface Asset {
  id: string;
  kind: Kind;
  title: string;
  description: string;
  ownerTeam: string;
  classification: "team" | "org" | "public";
  tags: string[];
  citations: number;
  createdAt: number;
}

const KEY = "azplen:library:global";

const KIND: Record<Kind, string> = {
  entity: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  report: "border-sky-300/30 text-sky-200 bg-sky-300/[0.06]",
  playbook: "border-emerald-300/30 text-emerald-200 bg-emerald-300/[0.06]",
  dataset: "border-violet-300/30 text-violet-200 bg-violet-300/[0.06]",
  pattern: "border-foreground/15 text-muted-foreground bg-foreground/[0.04]",
};

/**
 * Shared Intelligence Library — finished products, entity profiles,
 * playbooks, datasets, and patterns published for team / org reuse.
 * Cited assets accrue weight.
 */
const LibraryPanel = () => {
  const [items, setItems] = useState<Asset[]>([]);
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState<Omit<Asset, "id" | "createdAt" | "citations">>({
    kind: "entity", title: "", description: "", ownerTeam: "", classification: "team", tags: [],
  });
  const [tagInput, setTagInput] = useState("");

  useEffect(() => { try { setItems(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch {} }, []);
  useEffect(() => { const h = setTimeout(() => localStorage.setItem(KEY, JSON.stringify(items)), 300); return () => clearTimeout(h); }, [items]);

  const filtered = useMemo(() =>
    items.filter(a => !q ||
      a.title.toLowerCase().includes(q.toLowerCase()) ||
      a.tags.some(t => t.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.citations - a.citations || b.createdAt - a.createdAt),
    [items, q]);

  const create = () => {
    if (!draft.title.trim()) return;
    setItems(p => [{ ...draft, id: crypto.randomUUID(), createdAt: Date.now(), citations: 0 }, ...p]);
    setDraft({ kind: "entity", title: "", description: "", ownerTeam: "", classification: "team", tags: [] });
    setShowCreate(false);
  };
  const cite = (id: string) => setItems(p => p.map(a => a.id === id ? { ...a, citations: a.citations + 1 } : a));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-extralight tracking-tight text-foreground flex items-center gap-2">
            <Library className="h-4 w-4 text-amber-300/80" /> Intelligence Library
          </h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            Finished products published for team and org reuse. Cited assets accrue weight.
          </p>
        </div>
        <button onClick={() => setShowCreate(s => !s)}
          className="rounded-lg border border-amber-300/20 bg-amber-300/[0.04] px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-300/10">
          <Plus className="h-3 w-3 inline mr-1" /> Publish
        </button>
      </div>

      {showCreate && (
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 space-y-3">
          <div className="grid grid-cols-12 gap-2">
            <select value={draft.kind} onChange={e => setDraft({ ...draft, kind: e.target.value as Kind })}
              className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight">
              <option value="entity">Entity</option><option value="report">Report</option>
              <option value="playbook">Playbook</option><option value="dataset">Dataset</option>
              <option value="pattern">Pattern</option>
            </select>
            <input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="Title"
              className="col-span-6 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
            <input value={draft.ownerTeam} onChange={e => setDraft({ ...draft, ownerTeam: e.target.value })} placeholder="Owner team"
              className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
            <select value={draft.classification} onChange={e => setDraft({ ...draft, classification: e.target.value as Asset["classification"] })}
              className="col-span-2 bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight">
              <option value="team">Team</option><option value="org">Org</option><option value="public">Public</option>
            </select>
          </div>
          <textarea value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })}
            placeholder="Description" rows={2}
            className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight resize-none" />
          <div className="flex flex-wrap items-center gap-2">
            {draft.tags.map(t => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-foreground/[0.04] px-2 py-0.5 text-[10px] text-muted-foreground">
                #{t}
                <button onClick={() => setDraft(d => ({ ...d, tags: d.tags.filter(x => x !== t) }))} className="hover:text-foreground">×</button>
              </span>
            ))}
            <input value={tagInput} onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && tagInput.trim()) { e.preventDefault(); setDraft(d => ({ ...d, tags: [...d.tags, tagInput.trim()] })); setTagInput(""); } }}
              placeholder="add tag…"
              className="w-28 bg-foreground/[0.04] border border-foreground/10 rounded-md px-2 py-1 text-[10px] text-foreground outline-none focus:border-amber-300/30 font-extralight" />
            <button onClick={create} className="ml-auto rounded-lg bg-amber-300/10 border border-amber-300/20 px-4 py-1.5 text-xs text-amber-200 hover:bg-amber-300/20">Publish</button>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search library…"
          className="w-full pl-9 pr-3 py-2 bg-foreground/[0.02] border border-foreground/10 rounded-lg text-xs text-foreground outline-none focus:border-amber-300/30 font-extralight" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.length === 0 && <p className="col-span-2 text-[11px] text-muted-foreground/50 text-center py-12 tracking-[0.2em] uppercase font-extralight">Library empty</p>}
        {filtered.map(a => (
          <div key={a.id} className="rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 group">
            <div className="flex items-start justify-between gap-3">
              <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[9px] font-mono uppercase tracking-wider ${KIND[a.kind]}`}>{a.kind}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground/60">{a.citations} cites</span>
                <button onClick={() => cite(a.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-amber-200" title="Cite">
                  <Share2 className="h-3 w-3" />
                </button>
                <button onClick={() => setItems(p => p.filter(x => x.id !== a.id))} className="opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
            <h4 className="text-sm font-extralight text-foreground mt-2">{a.title}</h4>
            {a.description && <p className="text-xs text-muted-foreground font-extralight mt-1 line-clamp-2">{a.description}</p>}
            <div className="flex items-center gap-2 mt-2 text-[9px] text-muted-foreground/60 font-mono">
              <span>{a.ownerTeam || "—"}</span>
              <span>·</span>
              <span className="uppercase tracking-wider">{a.classification}</span>
              {a.tags.length > 0 && <span className="ml-auto truncate">{a.tags.map(t => `#${t}`).join(" ")}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LibraryPanel;
