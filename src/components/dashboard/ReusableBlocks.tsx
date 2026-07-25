import { useState, useEffect } from "react";
import { Blocks, Plus, Copy, Check, Trash2, Tag, X, Search } from "lucide-react";

export interface SavedBlock {
  id: string;
  content: string;
  label: string;
  category: string;
  createdAt: number;
}

const STORAGE_KEY = "asherin_saved_blocks";

function loadBlocks(): SavedBlock[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveBlocks(blocks: SavedBlock[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
}

interface ReusableBlocksProps {
  onInsert: (content: string) => void;
  contentToSave?: string;
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = ["Table", "Bio", "Policy", "Code", "Template", "Other"];

const ReusableBlocks = ({ onInsert, contentToSave, open, onClose }: ReusableBlocksProps) => {
  const [blocks, setBlocks] = useState<SavedBlock[]>(loadBlocks);
  const [saving, setSaving] = useState(!!contentToSave);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("Other");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => { if (contentToSave) setSaving(true); }, [contentToSave]);

  const handleSave = () => {
    if (!contentToSave || !label.trim()) return;
    const newBlock: SavedBlock = {
      id: crypto.randomUUID(),
      content: contentToSave,
      label: label.trim(),
      category,
      createdAt: Date.now(),
    };
    const updated = [newBlock, ...blocks];
    setBlocks(updated);
    saveBlocks(updated);
    setSaving(false);
    setLabel("");
  };

  const handleDelete = (id: string) => {
    const updated = blocks.filter(b => b.id !== id);
    setBlocks(updated);
    saveBlocks(updated);
  };

  const handleInsert = (block: SavedBlock) => {
    onInsert(block.content);
    setCopiedId(block.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filtered = blocks.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return b.label.toLowerCase().includes(q) || b.category.toLowerCase().includes(q) || b.content.toLowerCase().includes(q);
  });

  if (!open) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 w-80 max-h-[400px] rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden animate-scale-in flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 shrink-0">
        <div className="flex items-center gap-2">
          <Blocks className="h-3.5 w-3.5 text-accent/60" />
          <span className="text-[10px] font-light text-foreground uppercase tracking-wider">Saved Blocks</span>
          <span className="text-[9px] text-muted-foreground/40">{blocks.length}</span>
        </div>
        <button onClick={onClose} className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors">
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Save new block */}
      {saving && contentToSave && (
        <div className="px-3 py-2.5 border-b border-border/20 space-y-2 bg-accent/5">
          <p className="text-[10px] text-muted-foreground/60">Save as reusable block:</p>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Block name…"
            className="w-full bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none border-b border-border/20 pb-1"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="text-[10px] bg-card/30 border border-border/20 rounded-lg px-2 py-1 text-foreground outline-none"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={handleSave} disabled={!label.trim()} className="text-[10px] bg-accent/20 text-accent px-2.5 py-1 rounded-lg disabled:opacity-30 hover:bg-accent/30 transition-colors">Save</button>
            <button onClick={() => setSaving(false)} className="text-[10px] text-muted-foreground/50">Cancel</button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="px-3 py-1.5 border-b border-border/10">
        <div className="flex items-center gap-1.5">
          <Search className="h-3 w-3 text-muted-foreground/40" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search blocks…"
            className="flex-1 bg-transparent text-[11px] font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
          />
        </div>
      </div>

      {/* Block list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="text-center py-6">
            <Blocks className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-[11px] text-muted-foreground/40 font-light">
              {blocks.length === 0 ? "No saved blocks yet. Use \"Save as Block\" on any response." : "No blocks match your search."}
            </p>
          </div>
        ) : (
          <div className="py-1">
            {filtered.map(block => (
              <div key={block.id} className="group px-3 py-2 hover:bg-foreground/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Tag className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                    <span className="text-[11px] font-light text-foreground truncate">{block.label}</span>
                    <span className="text-[9px] text-muted-foreground/30 bg-muted/20 rounded px-1.5 py-0.5 shrink-0">{block.category}</span>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleInsert(block)}
                      className="p-1 text-muted-foreground/50 hover:text-accent transition-colors"
                      title="Insert into input"
                    >
                      {copiedId === block.id ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                    <button onClick={() => handleDelete(block.id)} className="p-1 text-muted-foreground/50 hover:text-destructive transition-colors" title="Delete">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/40 font-light mt-0.5 line-clamp-2 ml-5">{block.content.slice(0, 120)}{block.content.length > 120 ? "…" : ""}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReusableBlocks;
