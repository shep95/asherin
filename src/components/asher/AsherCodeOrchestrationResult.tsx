import { useState } from "react";
import { X, Trophy, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { CallAsherCodeResult } from "@/lib/asherCode/aiClient";
import { extractCodeBlock } from "@/lib/asherCode/aiClient";

interface Props {
  result: CallAsherCodeResult;
  onClose: () => void;
  onInsert: (code: string) => void;
}

/**
 * AsherCodeOrchestrationResult — renders responses from N models with the
 * judge-ranked winner highlighted. User picks which to insert into the editor.
 */
export default function AsherCodeOrchestrationResult({ result, onClose, onInsert }: Props) {
  const successful = (result.responses || []).filter((r) => !r.error && r.content);
  const ranking = result.ranking || successful.map((_, i) => i);
  const ranked = ranking.map((idx) => successful[idx]).filter(Boolean);
  const failed = (result.responses || []).filter((r) => r.error);

  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const cur = ranked[active];

  function copyCode() {
    if (!cur) return;
    const code = extractCodeBlock(cur.content);
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-md p-4">
      <div className="w-full max-w-6xl h-[85vh] rounded-2xl border border-border/20 bg-card/70 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/20 bg-card/40">
          <div>
            <p className="text-[9px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">Multi-Model Orchestration</p>
            <p className="text-xs font-light mt-0.5">{ranked.length} successful · {failed.length} failed · {result.timing?.totalMs}ms</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Ranked sidebar */}
          <aside className="w-72 flex-shrink-0 border-r border-border/15 bg-card/20 overflow-y-auto">
            <div className="px-3 py-2 border-b border-border/15">
              <span className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">Ranked Solutions</span>
            </div>
            {ranked.map((r, i) => (
              <div key={i}
                onClick={() => setActive(i)}
                className={`px-3 py-2.5 border-b border-border/10 cursor-pointer hover:bg-foreground/5 ${active === i ? "bg-foreground/10" : ""}`}>
                <div className="flex items-center gap-2">
                  {i === 0 && <Trophy className="h-3 w-3 text-amber-400" />}
                  <span className={`text-[10px] tracking-[0.2em] uppercase ${i === 0 ? "text-amber-300/90" : "text-muted-foreground"}`}>
                    #{i + 1} {i === 0 ? "Best" : ""}
                  </span>
                </div>
                <p className="text-[11px] font-light mt-1">{r.provider}</p>
                <p className="text-[9px] text-muted-foreground/60 mt-0.5">{r.model}</p>
                <p className="text-[9px] text-muted-foreground/40 mt-0.5">{r.latencyMs}ms · {r.keySource}</p>
              </div>
            ))}
            {failed.length > 0 && (
              <>
                <div className="px-3 py-2 border-b border-t border-border/15 mt-2">
                  <span className="text-[9px] font-light tracking-[0.25em] text-red-400/70 uppercase">Failed ({failed.length})</span>
                </div>
                {failed.map((r, i) => (
                  <div key={i} className="px-3 py-2 border-b border-border/10 opacity-60">
                    <p className="text-[10px]">{r.provider} / {r.model}</p>
                    <p className="text-[9px] text-red-400/80 mt-0.5 line-clamp-2">{r.error}</p>
                  </div>
                ))}
              </>
            )}
          </aside>

          {/* Active response */}
          <div className="flex-1 overflow-auto px-5 py-4">
            {cur ? (
              <div className="prose prose-sm prose-invert max-w-none prose-pre:bg-background/60 prose-pre:border prose-pre:border-border/20">
                <ReactMarkdown>{cur.content}</ReactMarkdown>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-xs">No successful responses</div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-border/20 bg-card/40">
          <button onClick={copyCode} disabled={!cur} className="inline-flex items-center gap-1.5 rounded-md border border-border/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] hover:bg-foreground/5 disabled:opacity-40">
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />} Copy Code
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-border/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] hover:bg-foreground/5">Close</button>
            <button onClick={() => cur && onInsert(extractCodeBlock(cur.content))} disabled={!cur} className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-40">
              Insert into File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
