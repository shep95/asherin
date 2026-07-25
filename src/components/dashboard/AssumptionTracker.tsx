import { useState, useEffect } from "react";
import { AlertTriangle, ToggleLeft, ToggleRight, Plus, X, RefreshCw } from "lucide-react";

export interface Assumption {
  id: string;
  text: string;
  active: boolean;
  createdAt: number;
}

interface AssumptionTrackerProps {
  conversationId: string;
  open: boolean;
  onClose: () => void;
  onRequestReAnswer?: (assumptions: Assumption[]) => void;
}

const STORAGE_KEY = "asherin_assumptions";

function loadAll(): Record<string, Assumption[]> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveAll(all: Record<string, Assumption[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

const AssumptionTracker = ({ conversationId, open, onClose, onRequestReAnswer }: AssumptionTrackerProps) => {
  const [assumptions, setAssumptions] = useState<Assumption[]>(() => loadAll()[conversationId] || []);
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");

  useEffect(() => {
    const all = loadAll();
    all[conversationId] = assumptions;
    saveAll(all);
  }, [assumptions, conversationId]);

  const addAssumption = () => {
    if (!newText.trim()) return;
    setAssumptions(prev => [...prev, { id: crypto.randomUUID(), text: newText.trim(), active: true, createdAt: Date.now() }]);
    setNewText("");
    setAdding(false);
  };

  const toggle = (id: string) => {
    setAssumptions(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  };

  const remove = (id: string) => {
    setAssumptions(prev => prev.filter(a => a.id !== id));
  };

  const handleReAnswer = () => {
    onRequestReAnswer?.(assumptions);
  };

  if (!open) return null;

  return (
    <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden animate-scale-in">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500/60" />
          <span className="text-[10px] font-light text-foreground uppercase tracking-wider">Assumptions</span>
          <span className="text-[9px] text-muted-foreground/30">{assumptions.length}</span>
        </div>
        <button onClick={onClose} className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors">
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="max-h-[250px] overflow-y-auto">
        {assumptions.length === 0 && !adding && (
          <div className="text-center py-6">
            <AlertTriangle className="h-5 w-5 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-[10px] text-muted-foreground/40 font-light">No assumptions tracked yet.</p>
          </div>
        )}
        {assumptions.map(a => (
          <div key={a.id} className="group flex items-center gap-2 px-3 py-2 hover:bg-foreground/5 transition-colors">
            <button onClick={() => toggle(a.id)} className="shrink-0">
              {a.active
                ? <ToggleRight className="h-4 w-4 text-accent" />
                : <ToggleLeft className="h-4 w-4 text-muted-foreground/30" />
              }
            </button>
            <span className={`text-[11px] font-light flex-1 ${a.active ? "text-foreground" : "text-muted-foreground/40 line-through"}`}>
              {a.text}
            </span>
            <button onClick={() => remove(a.id)} className="p-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-destructive transition-all">
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {adding && (
          <div className="px-3 py-2 flex items-center gap-2">
            <input
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addAssumption()}
              placeholder="e.g. User has admin access"
              className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none"
              autoFocus
            />
            <button onClick={addAssumption} className="text-accent text-[10px]">Add</button>
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-border/20 flex items-center justify-between">
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
        >
          <Plus className="h-3 w-3" /> Add
        </button>
        {assumptions.length > 0 && (
          <button
            onClick={handleReAnswer}
            className="flex items-center gap-1 text-[10px] text-accent/70 hover:text-accent transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> Re-answer with changes
          </button>
        )}
      </div>
    </div>
  );
};

export default AssumptionTracker;
