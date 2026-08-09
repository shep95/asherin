import { useCallback, useEffect, useState } from "react";
import {
  History, Loader2, Trash2, RefreshCw, ChevronRight, Radar,
  Plus, Minus, ArrowUpDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { GhostHistoryEntity, GhostHistoryRun } from "./searchFormat";

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY RAIL — the second half of the dual sidebar.
//
// INTERCEPT answers "what is coming back right now". HISTORY answers "what has
// this engine ever seen about this entity". They are different questions, so
// they get different surfaces: the rail lists entities (not query strings),
// each entity expands into its runs, and each run carries the ranked list it
// produced at the time. That is what makes a second lookup a *comparison*
// rather than a repetition.
// ─────────────────────────────────────────────────────────────────────────────

const KIND_GLYPH: Record<string, string> = {
  email: "✉", phone: "☎", domain: "◈", name: "◉", handle: "@", freeform: "?",
};

const rel = (iso: string) => {
  const d = Date.now() - Date.parse(iso);
  if (!Number.isFinite(d)) return "—";
  const m = Math.round(d / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

interface Props {
  /** Bumped by the parent after each successful search so the rail refetches. */
  nonce: number;
  activeKey?: string;
  onReplay: (query: string) => void;
  onOpenRun: (run: GhostHistoryRun) => void;
}

const GhostHistoryRail = ({ nonce, activeKey, onReplay, onOpenRun }: Props) => {
  const [entities, setEntities] = useState<GhostHistoryEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [runs, setRuns] = useState<Record<string, GhostHistoryRun[]>>({});
  const [runLoading, setRunLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase.functions.invoke("ghost-engine", {
        body: { action: "history" },
      });
      if (e) throw new Error(e.message);
      setEntities((data?.entities ?? []) as GhostHistoryEntity[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, nonce]);

  const expand = async (key: string) => {
    if (openKey === key) { setOpenKey(null); return; }
    setOpenKey(key);
    if (runs[key]) return;
    setRunLoading(key);
    try {
      const { data, error: e } = await supabase.functions.invoke("ghost-engine", {
        body: { action: "historyDetail", query: key },
      });
      if (e) throw new Error(e.message);
      setRuns((prev) => ({ ...prev, [key]: (data?.runs ?? []) as GhostHistoryRun[] }));
    } catch (e) {
      toast({ title: "History unavailable", description: (e as Error).message, variant: "destructive" });
    } finally {
      setRunLoading(null);
    }
  };

  const forget = async (key: string) => {
    try {
      const { error: e } = await supabase.functions.invoke("ghost-engine", {
        body: { action: "forget", query: key },
      });
      if (e) throw new Error(e.message);
      setEntities((prev) => prev.filter((x) => x.entity_key !== key));
      setRuns((prev) => { const n = { ...prev }; delete n[key]; return n; });
      toast({ title: "Trace cleared", description: "Every run recorded for that entity is gone." });
    } catch (e) {
      toast({ title: "Could not clear", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border/15 px-3 py-2.5">
        <History className="h-3.5 w-3.5 text-foreground/60" />
        <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">History</span>
        <button
          onClick={() => void load()}
          aria-label="Refresh history"
          className="ml-auto rounded p-1 text-muted-foreground/45 transition-colors hover:text-foreground"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && entities.length === 0 && (
          <div className="space-y-2 p-3" aria-live="polite">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-foreground/[0.05]" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="p-3 text-[11px] leading-relaxed text-muted-foreground/60">
            History could not be read: {error}
            <button onClick={() => void load()} className="mt-2 block text-foreground/70 underline underline-offset-2">
              Retry
            </button>
          </div>
        )}

        {!loading && !error && entities.length === 0 && (
          <p className="p-3 text-[11px] leading-relaxed text-muted-foreground/50">
            No entity has been looked up yet. Every selector you search is recorded here with
            what it returned, so the next sweep can be compared against this one.
          </p>
        )}

        <ul>
          {entities.map((e) => {
            const open = openKey === e.entity_key;
            const active = activeKey === e.entity_key;
            return (
              <li key={e.entity_key} className="border-b border-border/10">
                <div
                  className={`group flex items-start gap-2 px-3 py-2 transition-colors ${
                    active ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]"
                  }`}
                >
                  <button
                    onClick={() => void expand(e.entity_key)}
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 items-start gap-2 text-left"
                  >
                    <span className="mt-0.5 w-3 shrink-0 text-center text-[11px] text-muted-foreground/50">
                      {KIND_GLYPH[e.entity_kind] ?? "?"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] text-foreground/85">{e.entity_label}</span>
                      <span className="block text-[10px] text-muted-foreground/45">
                        {e.runs} run{e.runs === 1 ? "" : "s"} · {e.total_leads} leads
                        {e.total_anomalies ? ` · ${e.total_anomalies} anomalies` : ""} · {rel(e.last_seen)}
                      </span>
                    </span>
                    <ChevronRight
                      className={`mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/35 transition-transform ${open ? "rotate-90" : ""}`}
                    />
                  </button>
                </div>

                {open && (
                  <div className="bg-foreground/[0.02] px-3 pb-2.5">
                    {runLoading === e.entity_key && (
                      <div className="flex items-center gap-2 py-2 text-[10.5px] text-muted-foreground/55">
                        <Loader2 className="h-3 w-3 animate-spin" /> Reading trace…
                      </div>
                    )}
                    <ul className="space-y-1">
                      {(runs[e.entity_key] ?? []).map((r) => (
                        <li key={r.id}>
                          <button
                            onClick={() => onOpenRun(r)}
                            className="w-full rounded px-2 py-1 text-left text-[10.5px] text-muted-foreground/65 transition-colors hover:bg-foreground/5 hover:text-foreground"
                          >
                            <span className="block truncate">{r.query}</span>
                            <span className="block text-[9.5px] text-muted-foreground/40">
                              {new Date(r.created_at).toLocaleString()} · {r.probed} probed / {r.leads_found} leads
                              · {(r.elapsed_ms / 1000).toFixed(1)}s
                            </span>
                          </button>

                          {/* ── Run-over-run diff ─────────────────────────
                              An operator re-sweeps an entity to learn what
                              MOVED, and the rail only ever offered them two
                              forty-row lists to eyeball side by side. The
                              delta is the finding, so the delta is what the
                              rail states. */}
                          {r.diff && (r.diff.counts.appeared || r.diff.counts.vanished || r.diff.counts.changed) ? (
                            <div className="ml-2 mt-0.5 border-l border-border/15 pl-2">
                              <p className="text-[9.5px] text-muted-foreground/40">
                                vs. {r.diff.since ? rel(r.diff.since) : "previous run"}
                                {r.diff.counts.anomalyDelta !== 0 && (
                                  <span className="text-foreground/70">
                                    {" "}· {r.diff.counts.anomalyDelta > 0 ? "+" : ""}
                                    {r.diff.counts.anomalyDelta} anomal
                                    {Math.abs(r.diff.counts.anomalyDelta) === 1 ? "y" : "ies"}
                                  </span>
                                )}
                              </p>
                              {r.diff.appeared.slice(0, 4).map((d) => (
                                <p key={`a${d.url}`} className="flex items-start gap-1 text-[9.5px] text-foreground/70">
                                  <Plus className="mt-[1px] h-2.5 w-2.5 shrink-0 opacity-70" />
                                  <span className="min-w-0 truncate">{d.host || d.title}</span>
                                </p>
                              ))}
                              {r.diff.vanished.slice(0, 3).map((d) => (
                                <p key={`v${d.url}`} className="flex items-start gap-1 text-[9.5px] text-muted-foreground/45">
                                  <Minus className="mt-[1px] h-2.5 w-2.5 shrink-0 opacity-70" />
                                  <span className="min-w-0 truncate line-through">{d.host || d.title}</span>
                                </p>
                              ))}
                              {r.diff.changed.slice(0, 2).map((d) => (
                                <p key={`c${d.url}`} className="flex items-start gap-1 text-[9.5px] text-muted-foreground/55">
                                  <ArrowUpDown className="mt-[1px] h-2.5 w-2.5 shrink-0 opacity-70" />
                                  <span className="min-w-0 truncate">
                                    {d.title} · {d.from} → {d.to}
                                  </span>
                                </p>
                              ))}
                              {r.diff.counts.appeared + r.diff.counts.vanished > 7 && (
                                <p className="text-[9px] text-muted-foreground/35">
                                  {r.diff.counts.appeared} appeared · {r.diff.counts.vanished} gone ·{" "}
                                  {r.diff.counts.changed} re-ranked
                                </p>
                              )}
                            </div>
                          ) : r.diff ? (
                            <p className="ml-2 mt-0.5 border-l border-border/15 pl-2 text-[9.5px] text-muted-foreground/35">
                              No change since {rel(r.diff.since ?? r.created_at)} — the record held still.
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => onReplay(e.queries[0] || e.entity_label)}
                        className="flex items-center gap-1 rounded border border-border/20 px-2 py-1 text-[10px] text-muted-foreground/65 transition-colors hover:text-foreground"
                      >
                        <Radar className="h-3 w-3" /> Re-intercept
                      </button>
                      <button
                        onClick={() => void forget(e.entity_key)}
                        className="flex items-center gap-1 rounded border border-border/20 px-2 py-1 text-[10px] text-muted-foreground/50 transition-colors hover:text-foreground"
                      >
                        <Trash2 className="h-3 w-3" /> Forget
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default GhostHistoryRail;
