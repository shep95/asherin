// ZANOEM Autopilot Decision Log — read every decision ZANOEM made on your
// behalf, see the options it had, and override any of them with one click.
import { useEffect, useState } from "react";
import { ScrollText, X, Loader2, RotateCcw, Check, ChevronDown, ChevronRight } from "lucide-react";
import { listDecisions, overrideDecision, type ZanoemDecisionRow, type ZanoemSurface } from "@/lib/zanoem/decisionLog";
import { toast } from "sonner";

interface Props {
  open: boolean;
  surface: ZanoemSurface;
  projectRef?: string | null;
  /** Called when user picks a different option. Surface should re-run from this point. */
  onOverride?: (decision: ZanoemDecisionRow, newChoice: string) => void;
  onClose: () => void;
}

export default function ZanoemDecisionLog({ open, surface, projectRef, onOverride, onClose }: Props) {
  const [rows, setRows] = useState<ZanoemDecisionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [customChoice, setCustomChoice] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listDecisions(surface, projectRef ?? null).then((r) => { setRows(r); setLoading(false); });
  }, [open, surface, projectRef]);

  if (!open) return null;

  const handleOverride = async (decision: ZanoemDecisionRow, newChoice: string) => {
    const trimmed = newChoice.trim();
    if (!trimmed) { toast.error("Pick or type an option first"); return; }
    const ok = await overrideDecision(decision.id, trimmed);
    if (!ok) { toast.error("Override failed"); return; }
    setRows((prev) => prev.map((r) => r.id === decision.id ? { ...r, status: "overridden", override_choice: trimmed, overridden_at: new Date().toISOString() } : r));
    onOverride?.(decision, trimmed);
    toast.success("Decision overridden — ZANOEM will re-run from this point");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-[760px] max-w-full max-h-[85vh] rounded-lg border border-border/30 bg-card/95 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-4 py-3 border-b border-border/20">
          <div className="flex items-center gap-2">
            <ScrollText className="size-3.5 text-muted-foreground/80" />
            <h3 className="text-[11px] font-light tracking-[0.2em] uppercase">ZANOEM Decision Log</h3>
            <span className="text-[9px] px-1.5 py-0.5 rounded border border-border/30 opacity-60">{rows.length} decision{rows.length === 1 ? "" : "s"}</span>
          </div>
          <button onClick={onClose} className="opacity-60 hover:opacity-100" aria-label="Close"><X className="size-3.5" /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground py-4">
              <Loader2 className="size-3 animate-spin" /> Loading decisions…
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div className="text-[11px] text-muted-foreground py-8 text-center font-light">
              No autopilot decisions yet. Enable <span className="text-foreground/80">You Decide ZANOEM</span> in the chat to let ZANOEM decide for you.
            </div>
          )}
          {!loading && rows.map((d) => {
            const isOpen = !!expanded[d.id];
            return (
              <div key={d.id} className={`rounded border ${d.status === "overridden" ? "border-foreground/30 bg-foreground/5" : "border-border/30 bg-card/40"}`}>
                <button
                  className="w-full flex items-start gap-2 px-3 py-2 text-left"
                  onClick={() => setExpanded((s) => ({ ...s, [d.id]: !isOpen }))}
                >
                  {isOpen ? <ChevronDown className="size-3 mt-0.5 opacity-60" /> : <ChevronRight className="size-3 mt-0.5 opacity-60" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">Round {d.round}</span>
                      <span className="text-[9px] text-muted-foreground/50">{new Date(d.created_at).toLocaleString()}</span>
                      {d.status === "overridden" && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded border border-foreground/40 bg-foreground/10 text-foreground/90 uppercase tracking-wider">Overridden</span>
                      )}
                    </div>
                    <div className="text-[11px] text-foreground/90 truncate">
                      <span className="text-muted-foreground/70">Picked:</span>{" "}
                      <span className="font-light">{d.chosen_option || "(no marker — see reply)"}</span>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 space-y-3 border-t border-border/15">
                    <section className="pt-2">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70 mb-1">ZANOEM asked</div>
                      <pre className="text-[10.5px] font-mono whitespace-pre-wrap leading-relaxed bg-background/40 rounded px-2 py-1.5 max-h-40 overflow-y-auto">{d.trigger_excerpt}</pre>
                    </section>

                    {d.options.length > 0 && (
                      <section>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70 mb-1">Options it had</div>
                        <ul className="space-y-1">
                          {d.options.map((o, i) => {
                            const isPicked = d.chosen_option && d.chosen_option.toLowerCase().includes(o.label.toLowerCase().slice(0, 20));
                            return (
                              <li key={i} className={`flex items-start gap-2 rounded border px-2 py-1.5 ${isPicked ? "border-foreground/40 bg-foreground/10" : "border-border/20 bg-card/30"}`}>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] text-foreground/90 font-light">{o.label}</div>
                                  {o.excerpt && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{o.excerpt}</div>}
                                </div>
                                {isPicked && <Check className="size-3 text-foreground/80 mt-0.5" />}
                                <button
                                  onClick={() => handleOverride(d, o.label)}
                                  disabled={d.status === "overridden"}
                                  className="text-[9px] px-2 py-0.5 rounded border border-border/30 hover:border-foreground/40 hover:bg-foreground/10 disabled:opacity-40 whitespace-nowrap"
                                  title="Re-run ZANOEM from this point with this option"
                                >
                                  <RotateCcw className="size-2.5 inline mr-1" />Use this
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    )}

                    {d.rationale && (
                      <section>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70 mb-1">Rationale</div>
                        <p className="text-[10.5px] text-foreground/75 leading-relaxed">{d.rationale}</p>
                      </section>
                    )}

                    <section>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70 mb-1">Change this decision</div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Type a different choice…"
                          value={customChoice[d.id] || ""}
                          onChange={(e) => setCustomChoice((s) => ({ ...s, [d.id]: e.target.value }))}
                          className="flex-1 rounded border border-border/30 bg-background/40 px-2 py-1 text-[11px] focus:border-foreground/40 focus:outline-none"
                        />
                        <button
                          onClick={() => handleOverride(d, customChoice[d.id] || "")}
                          disabled={d.status === "overridden" || !(customChoice[d.id] || "").trim()}
                          className="text-[10px] px-2 py-1 rounded border border-foreground/40 bg-foreground/10 text-foreground hover:bg-foreground/20 disabled:opacity-40"
                        >
                          Override & re-run
                        </button>
                      </div>
                    </section>

                    {d.status === "overridden" && d.override_choice && (
                      <div className="rounded border border-foreground/30 bg-foreground/5 px-2 py-1.5 text-[10.5px]">
                        <span className="text-muted-foreground/70 uppercase tracking-wider text-[9px] mr-2">Now:</span>
                        <span className="text-foreground/90 font-light">{d.override_choice}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
