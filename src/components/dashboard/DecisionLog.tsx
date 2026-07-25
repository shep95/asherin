import { useState, useEffect } from "react";
import { Gavel, Plus, Download, X, Clock, ChevronDown, ChevronUp } from "lucide-react";

export interface Decision {
  id: string;
  summary: string;
  rationale: string;
  timestamp: number;
  messageId?: string;
}

interface DecisionLogProps {
  conversationId: string;
  open: boolean;
  onClose: () => void;
}

const STORAGE_KEY = "asherin_decisions";

function loadAll(): Record<string, Decision[]> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveAll(all: Record<string, Decision[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function addDecision(conversationId: string, decision: Omit<Decision, "id" | "timestamp">) {
  const all = loadAll();
  const list = all[conversationId] || [];
  list.push({ ...decision, id: crypto.randomUUID(), timestamp: Date.now() });
  all[conversationId] = list;
  saveAll(all);
}

const DecisionLog = ({ conversationId, open, onClose }: DecisionLogProps) => {
  const [decisions, setDecisions] = useState<Decision[]>(() => loadAll()[conversationId] || []);
  const [adding, setAdding] = useState(false);
  const [summary, setSummary] = useState("");
  const [rationale, setRationale] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const all = loadAll();
    all[conversationId] = decisions;
    saveAll(all);
  }, [decisions, conversationId]);

  const handleAdd = () => {
    if (!summary.trim()) return;
    setDecisions(prev => [...prev, { id: crypto.randomUUID(), summary: summary.trim(), rationale: rationale.trim(), timestamp: Date.now() }]);
    setSummary("");
    setRationale("");
    setAdding(false);
  };

  const handleExport = () => {
    const lines = decisions.map((d, i) =>
      `${i + 1}. [${new Date(d.timestamp).toLocaleString()}] ${d.summary}${d.rationale ? `\n   Rationale: ${d.rationale}` : ""}`
    );
    const text = `# Decision Log\n\n${lines.join("\n\n")}`;
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `decisions-${conversationId.slice(0, 8)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const remove = (id: string) => setDecisions(prev => prev.filter(d => d.id !== id));

  if (!open) return null;

  return (
    <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden animate-scale-in">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Gavel className="h-3.5 w-3.5 text-accent/60" />
          <span className="text-[10px] font-light text-foreground uppercase tracking-wider">Decision Log</span>
          <span className="text-[9px] text-muted-foreground/30">{decisions.length}</span>
        </div>
        <div className="flex items-center gap-1">
          {decisions.length > 0 && (
            <button onClick={handleExport} className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors" title="Export">
              <Download className="h-3 w-3" />
            </button>
          )}
          <button onClick={onClose} className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="max-h-[300px] overflow-y-auto">
        {decisions.length === 0 && !adding && (
          <div className="text-center py-6">
            <Gavel className="h-5 w-5 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground/40 font-light">No decisions recorded yet.</p>
          </div>
        )}
        {decisions.map(d => (
          <div key={d.id} className="group border-b border-border/10 last:border-0">
            <button
              onClick={() => setExpanded(expanded === d.id ? null : d.id)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-foreground/5 transition-colors text-left"
            >
              <Clock className="h-3 w-3 text-muted-foreground/30 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-light text-foreground truncate">{d.summary}</p>
                <p className="text-[9px] text-muted-foreground/30">{new Date(d.timestamp).toLocaleDateString()}</p>
              </div>
              {expanded === d.id ? <ChevronUp className="h-3 w-3 text-muted-foreground/30" /> : <ChevronDown className="h-3 w-3 text-muted-foreground/30" />}
            </button>
            {expanded === d.id && (
              <div className="px-3 pb-2 pl-8">
                {d.rationale && <p className="text-[10px] text-muted-foreground/50 font-light">{d.rationale}</p>}
                <button onClick={() => remove(d.id)} className="mt-1 text-[9px] text-destructive/50 hover:text-destructive transition-colors">Remove</button>
              </div>
            )}
          </div>
        ))}

        {adding && (
          <div className="px-3 py-2 space-y-2 bg-accent/5">
            <input
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Decision summary"
              className="w-full bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none border-b border-border/20 pb-1"
              autoFocus
            />
            <input
              value={rationale}
              onChange={e => setRationale(e.target.value)}
              placeholder="Rationale (optional)"
              className="w-full bg-transparent text-[11px] font-light text-foreground placeholder:text-muted-foreground/30 outline-none border-b border-border/20 pb-1"
            />
            <div className="flex gap-2">
              <button onClick={handleAdd} className="text-[10px] text-accent">Save</button>
              <button onClick={() => setAdding(false)} className="text-[10px] text-muted-foreground/40">Cancel</button>
            </div>
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-border/20">
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" /> Promote to Decision
        </button>
      </div>
    </div>
  );
};

export default DecisionLog;
