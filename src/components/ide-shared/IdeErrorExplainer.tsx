// IDE Pain Point #13/#14: AI Bug Doctor — explains an error in plain English.
import { useEffect, useState } from "react";
import { Stethoscope, X, Loader2, Wand2, Copy } from "lucide-react";
import { explainError, type ExplainedError } from "@/lib/ide";
import { toast } from "sonner";

interface Props {
  open: boolean;
  message: string;
  contextCode?: string;
  onClose: () => void;
  onApplyFix?: (code: string) => void;
}

export default function IdeErrorExplainer({ open, message, contextCode, onClose, onApplyFix }: Props) {
  const [data, setData] = useState<ExplainedError | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !message) return;
    setLoading(true);
    setData(null);
    explainError(message, contextCode)
      .then(setData)
      .finally(() => setLoading(false));
  }, [open, message, contextCode]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-[640px] max-w-full max-h-[80vh] rounded-lg border border-border/30 bg-card/95 shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/20">
          <div className="flex items-center gap-2">
            <Stethoscope className="size-3.5 text-amber-400/80" />
            <h3 className="text-[11px] font-light tracking-wide uppercase">Bug Doctor</h3>
            {data?.source === "local" && <span className="text-[9px] px-1.5 py-0.5 rounded border border-border/30 opacity-60">instant</span>}
            {data?.source === "ai" && <span className="text-[9px] px-1.5 py-0.5 rounded border border-border/30 opacity-60">AI</span>}
          </div>
          <button onClick={onClose} className="opacity-60 hover:opacity-100"><X className="size-3.5" /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="rounded border border-rose-500/30 bg-rose-500/5 px-3 py-2">
            <div className="text-[9px] uppercase tracking-wider text-rose-400/70 mb-1">Error</div>
            <pre className="text-[11px] text-rose-200/90 whitespace-pre-wrap font-mono leading-relaxed">{message}</pre>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-4">
              <Loader2 className="size-3 animate-spin" /> Diagnosing…
            </div>
          )}

          {data && !loading && (
            <>
              <section>
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70 mb-1">In plain English</div>
                <p className="text-[12px] leading-relaxed text-foreground/90">{data.plainEnglish}</p>
              </section>

              {data.rootCause && (
                <section>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70 mb-1">Root cause</div>
                  <p className="text-[11px] leading-relaxed text-foreground/75">{data.rootCause}</p>
                </section>
              )}

              {data.fixes.length > 0 && (
                <section>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70 mb-2">Suggested fixes</div>
                  <ul className="space-y-2">
                    {data.fixes.map((f, i) => (
                      <li key={i} className="rounded border border-border/30 bg-card/40 p-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="text-[11px] font-medium flex items-center gap-1.5">
                            <Wand2 className="size-3 text-emerald-400/70" /> {f.title}
                          </div>
                          {f.code && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => { navigator.clipboard.writeText(f.code!); toast.success("Copied"); }}
                                className="opacity-60 hover:opacity-100 p-1"
                                title="Copy"
                              >
                                <Copy className="size-2.5" />
                              </button>
                              {onApplyFix && (
                                <button
                                  onClick={() => { onApplyFix(f.code!); onClose(); }}
                                  className="text-[9px] px-2 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                                >
                                  Apply
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {f.code && (
                          <pre className="text-[10px] font-mono bg-background/60 rounded px-2 py-1.5 overflow-x-auto">{f.code}</pre>
                        )}
                        <p className="text-[10px] text-muted-foreground/80 leading-relaxed mt-1">{f.description}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
