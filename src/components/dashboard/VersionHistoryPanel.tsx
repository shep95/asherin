import { useState } from "react";
import { History, RotateCcw, Eye, X } from "lucide-react";

interface Version {
  id: string;
  content: string;
  timestamp: Date;
  label: string;
}

interface VersionHistoryPanelProps {
  versions: Version[];
  onRestore: (content: string) => void;
  open: boolean;
  onClose: () => void;
}

const VersionHistoryPanel = ({ versions, onRestore, open, onClose }: VersionHistoryPanelProps) => {
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);

  if (!open || versions.length === 0) return null;

  return (
    <div className="mt-2 rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm overflow-hidden animate-scale-in">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
        <div className="flex items-center gap-2">
          <History className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="text-[10px] font-light text-muted-foreground/60 uppercase tracking-wider">Version History</span>
          <span className="text-[9px] text-muted-foreground/30">{versions.length} versions</span>
        </div>
        <button onClick={onClose} className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors">
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="max-h-[200px] overflow-y-auto">
        {versions.map((v, idx) => (
          <div key={v.id} className="group px-3 py-2 border-b border-border/10 last:border-0 hover:bg-foreground/5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground/40">{v.label}</span>
                <span className="text-[9px] text-muted-foreground/30">{v.timestamp.toLocaleTimeString()}</span>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => setPreviewIdx(previewIdx === idx ? null : idx)}
                  className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors"
                  title="Preview"
                >
                  <Eye className="h-3 w-3" />
                </button>
                <button
                  onClick={() => onRestore(v.content)}
                  className="p-1 text-muted-foreground/40 hover:text-accent transition-colors"
                  title="Restore this version"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>
            </div>
            {previewIdx === idx && (
              <pre className="mt-1.5 text-[10px] text-muted-foreground/50 font-light leading-4 max-h-[100px] overflow-y-auto whitespace-pre-wrap">
                {v.content.slice(0, 500)}{v.content.length > 500 ? "…" : ""}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VersionHistoryPanel;
