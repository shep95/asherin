import { useState, useMemo } from "react";
import { AlertTriangle, XCircle, Info, Sparkles, FileCode } from "lucide-react";
import type { IdeFile } from "./IdeFileTree";

interface Problem {
  id: string;
  type: "error" | "warning" | "info";
  file: string;
  line: number;
  message: string;
}

interface Props {
  files: IdeFile[];
  onAiFix?: (problem: string) => void;
}

function flattenFiles(files: IdeFile[]): IdeFile[] {
  const result: IdeFile[] = [];
  for (const f of files) {
    if (f.type === "file") result.push(f);
    if (f.children) result.push(...flattenFiles(f.children));
  }
  return result;
}

// Basic static analysis for common issues
function analyzeFiles(files: IdeFile[]): Problem[] {
  const flat = flattenFiles(files);
  const problems: Problem[] = [];

  for (const file of flat) {
    if (!file.content) continue;
    const lines = file.content.split("\n");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // console.log warnings
      if (line.includes("console.log") && (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx")) {
        problems.push({ id: `${file.id}-${i}-console`, type: "warning", file: file.name, line: i + 1, message: "console.log detected — remove before production" });
      }

      // TODO comments
      if (line.match(/\/\/\s*TODO/i)) {
        problems.push({ id: `${file.id}-${i}-todo`, type: "info", file: file.name, line: i + 1, message: `TODO: ${line.trim().replace(/.*TODO:?\s*/i, "").slice(0, 60)}` });
      }

      // any type usage
      if (line.match(/:\s*any\b/) && (ext === "ts" || ext === "tsx")) {
        problems.push({ id: `${file.id}-${i}-any`, type: "warning", file: file.name, line: i + 1, message: "Avoid using 'any' type — use specific types" });
      }

      // Empty catch block
      if (line.match(/catch\s*\(\s*\w*\s*\)\s*\{\s*\}/) || (line.match(/catch/) && i + 1 < lines.length && lines[i + 1].trim() === "}")) {
        problems.push({ id: `${file.id}-${i}-catch`, type: "warning", file: file.name, line: i + 1, message: "Empty catch block — handle or log the error" });
      }
    }
  }

  return problems;
}

const ICONS = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const COLORS = {
  error: "text-destructive",
  warning: "text-amber-400",
  info: "text-accent/60",
};

const IdeProblemsPanel = ({ files, onAiFix }: Props) => {
  const [filter, setFilter] = useState<"all" | "error" | "warning" | "info">("all");
  const problems = useMemo(() => analyzeFiles(files), [files]);

  const filtered = filter === "all" ? problems : problems.filter(p => p.type === filter);
  const errorCount = problems.filter(p => p.type === "error").length;
  const warnCount = problems.filter(p => p.type === "warning").length;
  const infoCount = problems.filter(p => p.type === "info").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-2 sm:px-3 py-1.5 bg-card/20 border-b border-border/10">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3 w-3 text-amber-400/60" />
          <span className="text-[10px] font-light tracking-widest text-muted-foreground/50 uppercase">Problems</span>
          <span className="text-[9px] text-muted-foreground/30">({problems.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setFilter("all")} className={`px-1.5 py-0.5 rounded text-[9px] font-light transition-colors ${filter === "all" ? "bg-accent/20 text-accent" : "text-muted-foreground/40"}`}>
            All
          </button>
          <button onClick={() => setFilter("error")} className={`px-1.5 py-0.5 rounded text-[9px] font-light transition-colors ${filter === "error" ? "bg-destructive/20 text-destructive" : "text-muted-foreground/40"}`}>
            <span className="flex items-center gap-0.5"><XCircle className="h-2.5 w-2.5" /> {errorCount}</span>
          </button>
          <button onClick={() => setFilter("warning")} className={`px-1.5 py-0.5 rounded text-[9px] font-light transition-colors ${filter === "warning" ? "bg-amber-500/20 text-amber-400" : "text-muted-foreground/40"}`}>
            <span className="flex items-center gap-0.5"><AlertTriangle className="h-2.5 w-2.5" /> {warnCount}</span>
          </button>
          <button onClick={() => setFilter("info")} className={`px-1.5 py-0.5 rounded text-[9px] font-light transition-colors ${filter === "info" ? "bg-accent/20 text-accent" : "text-muted-foreground/40"}`}>
            <span className="flex items-center gap-0.5"><Info className="h-2.5 w-2.5" /> {infoCount}</span>
          </button>
          {problems.length > 0 && onAiFix && (
            <button
              onClick={() => onAiFix(problems.map(p => `${p.type}: ${p.file}:${p.line} — ${p.message}`).join("\n"))}
              className="flex items-center gap-1 ml-1 px-2 py-0.5 rounded-md bg-accent/10 text-accent text-[9px] font-light hover:bg-accent/20 transition-colors"
            >
              <Sparkles className="h-2.5 w-2.5" /> Fix All
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto text-[10px] font-light min-h-0">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground/30 text-[10px]">
            {problems.length === 0 ? "No problems detected ✓" : "No problems match filter"}
          </div>
        ) : (
          filtered.map(p => {
            const Icon = ICONS[p.type];
            return (
              <div key={p.id} className="flex items-start gap-2 px-3 py-1.5 hover:bg-foreground/5 transition-colors group">
                <Icon className={`h-3 w-3 shrink-0 mt-0.5 ${COLORS[p.type]}`} />
                <div className="flex-1 min-w-0">
                  <span className="text-foreground/80">{p.message}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <FileCode className="h-2.5 w-2.5 text-muted-foreground/30" />
                  <span className="text-muted-foreground/40">{p.file}:{p.line}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default IdeProblemsPanel;
