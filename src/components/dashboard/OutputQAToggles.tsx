import { useState, useEffect } from "react";
import { Shield, X } from "lucide-react";

export interface QAFlags {
  noFluff: boolean;
  strictJson: boolean;
  legalSafe: boolean;
  citeEverything: boolean;
  askBeforeAssuming: boolean;
  includeEdgeCases: boolean;
}

const DEFAULT_FLAGS: QAFlags = {
  noFluff: false,
  strictJson: false,
  legalSafe: false,
  citeEverything: false,
  askBeforeAssuming: false,
  includeEdgeCases: false,
};

const FLAG_LABELS: { key: keyof QAFlags; label: string; description: string }[] = [
  { key: "noFluff", label: "No Fluff", description: "Eliminate filler, be direct" },
  { key: "strictJson", label: "Strict JSON", description: "Output valid JSON only" },
  { key: "legalSafe", label: "Legal-Safe", description: "Avoid liability-prone language" },
  { key: "citeEverything", label: "Cite Everything", description: "Include source for every claim" },
  { key: "askBeforeAssuming", label: "Ask First", description: "Ask before making assumptions" },
  { key: "includeEdgeCases", label: "Edge Cases", description: "Include boundary conditions" },
];

interface OutputQATogglesProps {
  conversationId: string;
  open: boolean;
  onClose: () => void;
  onFlagsChange?: (flags: QAFlags) => void;
}

const STORAGE_KEY = "asherin_qa_flags";

const OutputQAToggles = ({ conversationId, open, onClose, onFlagsChange }: OutputQATogglesProps) => {
  const [flags, setFlags] = useState<QAFlags>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return { ...DEFAULT_FLAGS, ...saved[conversationId] };
    } catch { return DEFAULT_FLAGS; }
  });

  useEffect(() => {
    try {
      const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      all[conversationId] = flags;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    } catch { /* ignore */ }
    onFlagsChange?.(flags);
  }, [flags, conversationId, onFlagsChange]);

  const toggle = (key: keyof QAFlags) => setFlags(prev => ({ ...prev, [key]: !prev[key] }));
  const activeCount = Object.values(flags).filter(Boolean).length;

  if (!open) return null;

  return (
    <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden animate-scale-in">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-accent/60" />
          <span className="text-[10px] font-light text-foreground uppercase tracking-wider">Output QA</span>
          {activeCount > 0 && <span className="text-[9px] bg-accent/20 text-accent rounded-full px-1.5 py-0.5">{activeCount}</span>}
        </div>
        <button onClick={onClose} className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors">
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="py-1">
        {FLAG_LABELS.map(f => (
          <button
            key={f.key}
            onClick={() => toggle(f.key)}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-foreground/5 transition-colors"
          >
            <div className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all ${
              flags[f.key] ? "border-accent bg-accent/20" : "border-border/30"
            }`}>
              {flags[f.key] && <span className="text-accent text-[10px]">✓</span>}
            </div>
            <div className="text-left min-w-0">
              <p className="text-[11px] font-light text-foreground">{f.label}</p>
              <p className="text-[9px] text-muted-foreground/40">{f.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default OutputQAToggles;
export { DEFAULT_FLAGS };
