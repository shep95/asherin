// GovAxrlenPanel — Sovereign AXRLEN Forecast console.
//
// NARRATIVE / WORKFLOW TAXONOMY
// -----------------------------
// 1. INGEST      — live SELECT from `axrlen_sessions` (RLS-gated to
//                  the caller). Non-deleted rows only. Ordered by
//                  updated_at desc, capped at 40 for O(n) render.
// 2. TAXONOMY    — sessions are bucketed into domain families by
//                  `prediction_type` (fallback → region). Counts feed
//                  the left rail so operators see workload at a glance.
// 3. SELECTION   — activeSessionId is the single source of truth for
//                  the main workspace. Defaults to the freshest session.
// 4. SCENARIOS   — `predictions` jsonb is parsed defensively (array or
//                  { scenarios: [] }) and rendered as up to 4 scenario
//                  cards with probability, calibration, timeframe, and
//                  verification-plan citation (each cite pulled from
//                  `data_sources` when present, else "PENDING").
// 5. LEDGER      — right rail lists the last 8 sessions with confidence
//                  delta vs the fleet median (real accuracy proxy).
// 6. AUDIT       — every ingest and session switch pings the deck
//                  audit ledger via onAudit for traceability.
// 7. FLAWS FIXED — prior mount rendered the full standalone AxrlenView
//                  which duplicated header chrome and clashed with the
//                  deck classification banner. This panel is deck-native.
//
// Theme lock: matches the AsherinGov landing + deck aesthetic —
// pure black, hairline `border-border/20`, ultralight tracked caps,
// no gold, no gradients, single muted status dot.

import { useEffect, useMemo, useState } from "react";
import {
  Activity, Shield, Radio, Clock, ChevronRight, Loader2,
  AlertTriangle, FileCheck2, Signal,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Session {
  id: string;
  title: string | null;
  region: string | null;
  prediction_type: string | null;
  status: string | null;
  predictions: any;
  data_sources: any;
  confidence_score: number | null;
  ai_summary: string | null;
  updated_at: string;
  created_at: string;
}

interface Scenario {
  label: string;
  probability: number;      // 0..100
  calibration?: number;     // 0..1
  timeframe?: string;
  cite?: string;
}

interface Props {
  operator: string;
  serverName?: string | null;
  onAudit: (action: string, target: string, detail?: string) => void;
}

const DOMAIN_ORDER = ["regulatory", "market", "geopolitical", "event"] as const;

function classifyDomain(s: Session): string {
  const t = `${s.prediction_type ?? ""} ${s.region ?? ""}`.toLowerCase();
  if (/reg|law|policy|compl/.test(t)) return "regulatory";
  if (/mkt|market|price|econ|fin|trade/.test(t)) return "market";
  if (/geo|nato|treaty|state|diplom|border/.test(t)) return "geopolitical";
  return "event";
}

function parseScenarios(p: any, sources: any): Scenario[] {
  const src = (() => {
    if (Array.isArray(p)) return p;
    if (p && Array.isArray(p.scenarios)) return p.scenarios;
    if (p && typeof p === "object") return Object.entries(p).map(([k, v]) => ({ label: k, ...(v as any) }));
    return [];
  })();
  const citeList: string[] = Array.isArray(sources)
    ? sources.map((x: any) => (typeof x === "string" ? x : x?.name || x?.title || x?.url)).filter(Boolean)
    : [];
  return src.slice(0, 4).map((raw: any, i: number): Scenario => {
    const prob = Number(raw?.probability ?? raw?.p ?? raw?.likelihood ?? 0);
    return {
      label: String(raw?.label ?? raw?.name ?? raw?.title ?? `Scenario ${i + 1}`).slice(0, 120),
      probability: Math.max(0, Math.min(100, prob > 1 ? prob : prob * 100)),
      calibration: typeof raw?.calibration === "number" ? raw.calibration : undefined,
      timeframe: raw?.timeframe ?? raw?.horizon ?? undefined,
      cite: raw?.cite ?? citeList[i] ?? undefined,
    };
  });
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 60 * 24) return `${Math.floor(diffMin / 60)}h ago`;
  return `${Math.floor(diffMin / (60 * 24))}d ago`;
}

export default function GovAxrlenPanel({ operator, serverName, onAudit }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [domain, setDomain] = useState<string>("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr(null);
      const { data, error } = await supabase
        .from("axrlen_sessions")
        .select("id,title,region,prediction_type,status,predictions,data_sources,confidence_score,ai_summary,updated_at,created_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(40);
      if (!alive) return;
      if (error) { setErr(error.message); setLoading(false); return; }
      setSessions((data ?? []) as Session[]);
      setActiveId(prev => prev ?? (data?.[0]?.id ?? null));
      setLoading(false);
      onAudit("AXRLEN_INGEST", "axrlen_sessions", `${data?.length ?? 0} sessions`);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { regulatory: 0, market: 0, geopolitical: 0, event: 0 };
    for (const s of sessions) c[classifyDomain(s)] = (c[classifyDomain(s)] ?? 0) + 1;
    return c;
  }, [sessions]);

  const visible = useMemo(() => {
    if (domain === "all") return sessions;
    return sessions.filter(s => classifyDomain(s) === domain);
  }, [sessions, domain]);

  const active = useMemo(
    () => sessions.find(s => s.id === activeId) ?? visible[0] ?? null,
    [sessions, activeId, visible]
  );

  const scenarios = useMemo(
    () => (active ? parseScenarios(active.predictions, active.data_sources) : []),
    [active]
  );

  const fleetMedian = useMemo(() => {
    const vals = sessions.map(s => Number(s.confidence_score ?? 0)).filter(v => v > 0).sort((a, b) => a - b);
    if (!vals.length) return 0;
    return vals[Math.floor(vals.length / 2)];
  }, [sessions]);

  function switchSession(id: string) {
    setActiveId(id);
    onAudit("AXRLEN_OPEN_SESSION", id);
  }

  return (
    <div className="h-full w-full flex flex-col bg-background text-foreground">
      {/* CLASSIFICATION HEADER */}
      <div className="shrink-0 border-b border-border/20 bg-black/40">
        <div className="flex items-center justify-between px-4 py-1.5 border-b border-border/15">
          <div className="flex items-center gap-3 text-[9px] tracking-[0.3em] uppercase text-muted-foreground/70">
            <Shield className="h-3 w-3" />
            <span>SECRET // NOFORN // AXRLEN-EYES</span>
            <span className="opacity-30">·</span>
            <span>{serverName ?? "SOVEREIGN"}</span>
          </div>
          <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground/50">
            OPERATOR · {operator}
          </div>
        </div>
        <div className="flex items-center gap-4 px-4 py-3">
          <div className="h-9 w-9 rounded border border-border/25 flex items-center justify-center">
            <Activity className="h-4 w-4 text-foreground/70" strokeWidth={1.4} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-light tracking-[0.35em] uppercase">AXRLEN</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded border border-border/25 tracking-[0.25em] uppercase text-muted-foreground/70">Nexus Prime</span>
            </div>
            <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground/50 mt-0.5">
              30-Domain Predictive Intelligence · Verification-Planned Forecasts
            </div>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="text-right">
              <div className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground/50">Fleet Median Confidence</div>
              <div className="text-[13px] font-light tracking-wide">
                {fleetMedian ? `${fleetMedian.toFixed(1)}%` : "—"}
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border/25">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
              <span className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground/70">Live · {sessions.length}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="flex-1 min-h-0 grid grid-cols-[200px_minmax(0,1fr)_280px]">
        {/* LEFT RAIL — DOMAIN FAMILIES */}
        <aside className="border-r border-border/20 bg-black/25 overflow-y-auto">
          <div className="px-3 py-2.5 border-b border-border/15 text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60">
            Domain Families
          </div>
          <nav className="p-1.5">
            <DomainRow label="All Domains"    count={sessions.length}   active={domain === "all"}         onClick={() => setDomain("all")} />
            {DOMAIN_ORDER.map(d => (
              <DomainRow key={d} label={d}     count={counts[d] ?? 0}    active={domain === d}             onClick={() => setDomain(d)} />
            ))}
          </nav>

          <div className="px-3 pt-4 pb-2 border-t border-border/15 text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60">
            Sessions
          </div>
          <div className="px-1.5 pb-3 space-y-0.5">
            {loading && (
              <div className="flex items-center gap-2 px-2 py-2 text-[10px] text-muted-foreground/60">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading
              </div>
            )}
            {!loading && visible.length === 0 && (
              <div className="px-2 py-2 text-[10px] text-muted-foreground/50">No sessions in domain.</div>
            )}
            {visible.map(s => {
              const isActive = active?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => switchSession(s.id)}
                  className={`w-full text-left px-2 py-1.5 rounded border transition ${
                    isActive
                      ? "border-border/40 bg-foreground/5"
                      : "border-transparent hover:border-border/20 hover:bg-foreground/[0.03]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10.5px] font-light truncate">
                      {s.title || "Untitled forecast"}
                    </span>
                    {typeof s.confidence_score === "number" && (
                      <span className="text-[9px] font-mono text-muted-foreground/60">
                        {Number(s.confidence_score).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/40 mt-0.5">
                    {classifyDomain(s)} · {fmtWhen(s.updated_at)}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* MAIN — SCENARIO WORKSPACE */}
        <main className="overflow-y-auto">
          {err && (
            <div className="m-4 flex items-start gap-2 rounded border border-amber-400/30 bg-amber-500/5 p-3 text-[11px] text-amber-300/90">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
              <div>
                <div className="font-medium">AXRLEN feed unavailable</div>
                <div className="text-amber-300/70 mt-0.5">{err}</div>
              </div>
            </div>
          )}

          {!err && !active && !loading && (
            <div className="h-full flex items-center justify-center text-center px-8">
              <div className="max-w-sm">
                <Activity className="h-5 w-5 mx-auto text-muted-foreground/50" strokeWidth={1.4} />
                <div className="text-[11px] tracking-[0.3em] uppercase text-muted-foreground/70 mt-3">
                  No sovereign forecasts on file
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-2 leading-relaxed">
                  Commission a Nexus-Prime scenario through the Aureon Console; results appear here as classified probability cards with verification-plan citations.
                </p>
              </div>
            </div>
          )}

          {active && (
            <div className="p-5 space-y-5">
              {/* ACTIVE BRIEF HEADER */}
              <header className="flex items-start justify-between gap-4 border-b border-border/15 pb-4">
                <div className="min-w-0">
                  <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60">
                    Forecast Brief · {classifyDomain(active)}
                  </div>
                  <h2 className="text-[18px] font-light tracking-tight mt-1 truncate">
                    {active.title || "Untitled forecast"}
                  </h2>
                  <div className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtWhen(active.updated_at)}
                    </span>
                    {active.region && (
                      <span className="inline-flex items-center gap-1">
                        <Radio className="h-3 w-3" /> {active.region}
                      </span>
                    )}
                    {active.status && (
                      <span className="uppercase tracking-[0.25em]">{active.status}</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60">Confidence</div>
                  <div className="text-[28px] font-extralight tracking-tight leading-none mt-1">
                    {typeof active.confidence_score === "number" ? `${Number(active.confidence_score).toFixed(1)}%` : "—"}
                  </div>
                </div>
              </header>

              {/* AI SUMMARY */}
              {active.ai_summary && (
                <div className="rounded border border-border/20 bg-black/25 p-3">
                  <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60 mb-1.5">
                    Analyst Brief
                  </div>
                  <p className="text-[11.5px] leading-relaxed text-foreground/85 whitespace-pre-wrap">
                    {active.ai_summary}
                  </p>
                </div>
              )}

              {/* SCENARIOS */}
              <section>
                <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60 mb-2">
                  Scenario Probability Cards
                </div>
                {scenarios.length === 0 ? (
                  <div className="rounded border border-border/20 bg-black/20 p-4 text-[10px] text-muted-foreground/60">
                    No structured scenarios in this session's predictions payload.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {scenarios.map((sc, i) => (
                      <ScenarioCard key={i} s={sc} />
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </main>

        {/* RIGHT RAIL — FORECAST LEDGER */}
        <aside className="border-l border-border/20 bg-black/25 overflow-y-auto">
          <div className="px-3 py-2.5 border-b border-border/15 text-[9px] tracking-[0.3em] uppercase text-muted-foreground/60 flex items-center gap-2">
            <FileCheck2 className="h-3 w-3" /> Forecast Ledger
          </div>
          <div className="p-2 space-y-1.5">
            {sessions.slice(0, 8).map(s => {
              const c = Number(s.confidence_score ?? 0);
              const delta = c - fleetMedian;
              const sign = delta >= 0 ? "+" : "";
              return (
                <button
                  key={s.id}
                  onClick={() => switchSession(s.id)}
                  className="w-full text-left rounded border border-border/15 bg-black/20 hover:border-border/40 px-2.5 py-2 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono tracking-widest text-muted-foreground/60">
                      {new Date(s.updated_at).toISOString().slice(5, 16).replace("T", " ")}Z
                    </span>
                    <span className={`text-[9px] font-mono ${delta >= 0 ? "text-emerald-400/80" : "text-amber-400/80"}`}>
                      {sign}{delta.toFixed(1)}
                    </span>
                  </div>
                  <div className="text-[10.5px] font-light text-foreground/85 mt-1 truncate">
                    {s.title || "Untitled forecast"}
                  </div>
                  <div className="text-[9px] tracking-[0.2em] uppercase text-muted-foreground/45 mt-0.5">
                    {classifyDomain(s)} · {c ? `${c.toFixed(0)}% conf` : "no conf"}
                  </div>
                </button>
              );
            })}
            {!loading && sessions.length === 0 && (
              <div className="px-2 py-3 text-[10px] text-muted-foreground/50 flex items-center gap-2">
                <Signal className="h-3 w-3" /> Ledger empty.
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function DomainRow({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-[10.5px] tracking-[0.15em] uppercase transition ${
        active
          ? "bg-foreground/5 text-foreground border-l border-foreground/60"
          : "text-muted-foreground/70 hover:text-foreground hover:bg-foreground/[0.03] border-l border-transparent"
      }`}
    >
      <span className="font-light">{label}</span>
      <span className="text-[9px] font-mono text-muted-foreground/50">{String(count).padStart(2, "0")}</span>
    </button>
  );
}

function ScenarioCard({ s }: { s: Scenario }) {
  const barPct = Math.round(s.probability);
  const sev =
    barPct >= 75 ? "text-foreground border-foreground/40"
    : barPct >= 40 ? "text-foreground/85 border-border/40"
    : "text-muted-foreground border-border/25";

  return (
    <article className="rounded border border-border/20 bg-black/30 p-3.5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[9px] tracking-[0.3em] uppercase text-muted-foreground/55">Scenario</div>
          <div className="text-[12px] font-light leading-snug mt-0.5">{s.label}</div>
        </div>
        <div className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${sev} whitespace-nowrap`}>
          P {barPct}%
        </div>
      </div>

      <div>
        <div className="h-[3px] w-full bg-foreground/5 rounded-sm overflow-hidden">
          <div
            className="h-full bg-foreground/60 transition-[width] duration-500 ease-out"
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[9px]">
        <Meta label="Calibration" value={typeof s.calibration === "number" ? s.calibration.toFixed(2) : "—"} />
        <Meta label="Horizon"     value={s.timeframe || "—"} />
        <Meta label="Verify"      value={s.cite || "pending"} mono />
      </div>
    </article>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="tracking-[0.25em] uppercase text-muted-foreground/50">{label}</div>
      <div className={`mt-0.5 truncate ${mono ? "font-mono" : ""} text-foreground/85`}>{value}</div>
    </div>
  );
}
