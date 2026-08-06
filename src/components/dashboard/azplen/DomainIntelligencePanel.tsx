import { useCallback, useEffect, useMemo, useState } from "react";
import { Layers, RefreshCw, ShieldAlert, Target, AlertOctagon, Boxes } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAzplenSession } from "./AzplenSessionContext";

/**
 * DOMAIN INTELLIGENCE
 * ---------------------------------------------------------------------------
 * Ingest is not a financial sweep. Every landed dataset is classified against
 * an industry pack, its columns are bound to real-world objects, its
 * sensitivity and regulation are registered on arrival, and the platform
 * declares what the operator still *cannot* answer.
 *
 * This panel is a read surface over the server-computed `domain_profile`. It
 * never recomputes or guesses client-side — a number shown here exists in a
 * row, or it is not shown.
 */

interface DomainProfile {
  packId: string;
  packLabel: string;
  mission: string;
  confidence: number;
  alternates: { packId: string; label: string; confidence: number }[];
  objects: string[];
  bindings: { column: string; object: string; property: string; confidence: number }[];
  unmappedColumns: string[];
  sensitiveFields: { column: string; cls: string; regulations: string[] }[];
  sensitivityClasses: string[];
  regulations: string[];
  retentionMonths: number;
  standards: string[];
  findings: { code: string; severity: string; message: string; evidence: string; remediation: string }[];
  kpisReady: { name: string; formula: string }[];
  kpisBlocked: { name: string; formula: string; missing: string[] }[];
  decisions: string[];
  collectionGaps: string[];
  riskScore: number;
  riskGrade: "LOW" | "MODERATE" | "ELEVATED" | "SEVERE";
  briefing: string;
}

interface Row {
  id: string;
  file_name: string;
  status: string;
  row_count: number | null;
  col_count: number | null;
  quality_score: number | null;
  created_at: string;
  domain_profile: DomainProfile | null;
}

const GRADE: Record<string, string> = {
  LOW: "border-foreground/15 text-muted-foreground",
  MODERATE: "border-sky-300/30 text-sky-200 bg-sky-300/[0.06]",
  ELEVATED: "border-amber-300/30 text-amber-200 bg-amber-300/[0.06]",
  SEVERE: "border-rose-300/30 text-rose-200 bg-rose-300/[0.06]",
};
const SEV: Record<string, string> = {
  low: "border-foreground/15 text-muted-foreground",
  medium: "border-sky-300/30 text-sky-200",
  high: "border-amber-300/30 text-amber-200",
  critical: "border-rose-300/30 text-rose-200",
};

const Chip = ({ children, cls = "" }: { children: React.ReactNode; cls?: string }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.18em] ${cls || "border-foreground/15 text-muted-foreground"}`}>
    {children}
  </span>
);

const DomainIntelligencePanel = () => {
  const { activeSession } = useAzplenSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reprofiling, setReprofiling] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeSession) { setRows([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("asha_datasets")
      .select("id,file_name,status,row_count,col_count,quality_score,created_at,domain_profile")
      .eq("session_id", activeSession.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (err) { setError(err.message); setRows([]); }
    else setRows((data ?? []) as unknown as Row[]);
    setLoading(false);
  }, [activeSession]);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) ?? rows.find((r) => r.domain_profile) ?? rows[0] ?? null,
    [rows, selectedId],
  );

  const mix = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = r.domain_profile?.packLabel ?? "Unprofiled";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const reprofile = async (id: string) => {
    setReprofiling(id);
    try {
      const { error: err } = await supabase.functions.invoke("asha-analyze", { body: { datasetId: id } });
      if (err) throw err;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-profile failed");
    } finally {
      setReprofiling(null);
    }
  };

  if (!activeSession) {
    return <p className="text-xs text-muted-foreground/70">Open a session to profile landed data.</p>;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-light tracking-tight text-foreground">
            <Layers className="h-4 w-4 opacity-60" /> Domain Intelligence
          </h3>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-muted-foreground/70">
            Every landed dataset is classified against an industry pack, bound to real-world objects, and governed on
            arrival. Blocked KPIs and collection gaps state what this data cannot yet answer.
          </p>
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-md border border-foreground/12 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </header>

      {error && (
        <div className="rounded-md border border-rose-300/25 bg-rose-300/[0.04] px-3 py-2 text-[11px] text-rose-200">{error}</div>
      )}

      {loading && !rows.length && (
        <div className="space-y-2" aria-live="polite">
          {[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-md border border-foreground/8 bg-foreground/[0.02]" />)}
        </div>
      )}

      {!loading && !rows.length && (
        <div className="rounded-md border border-foreground/10 bg-foreground/[0.015] px-4 py-6 text-center">
          <p className="text-xs text-muted-foreground">No datasets landed in this session.</p>
          <p className="mt-1 text-[11px] text-muted-foreground/60">Land a file in Ingest — profiling runs automatically on arrival.</p>
        </div>
      )}

      {!!rows.length && (
        <div className="flex flex-wrap gap-1.5">
          {mix.map(([label, n]) => <Chip key={label}>{label} ×{n}</Chip>)}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
        {!!rows.length && (
          <ul className="space-y-1.5">
            {rows.map((r) => {
              const active = selected?.id === r.id;
              return (
                <li key={r.id}>
                  <button
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full rounded-md border px-3 py-2 text-left transition-colors ${active ? "border-foreground/25 bg-foreground/[0.05]" : "border-foreground/8 hover:border-foreground/18"}`}
                  >
                    <p className="truncate text-[11px] text-foreground">{r.file_name}</p>
                    <p className="mt-0.5 text-[10px] font-mono text-muted-foreground/60">
                      {r.row_count ?? "?"}×{r.col_count ?? "?"} · {r.domain_profile?.packLabel ?? "unprofiled"}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {selected && (
          <section className="space-y-4 rounded-lg border border-foreground/10 bg-foreground/[0.015] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-light text-foreground">{selected.file_name}</h4>
                <p className="mt-0.5 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/60">
                  {selected.row_count ?? "?"} rows · {selected.col_count ?? "?"} cols · quality {selected.quality_score ?? "?"}/100
                </p>
              </div>
              {selected.domain_profile && (
                <div className="flex items-center gap-1.5">
                  <Chip cls={GRADE[selected.domain_profile.riskGrade]}>
                    Risk {selected.domain_profile.riskScore}/100 {selected.domain_profile.riskGrade}
                  </Chip>
                  <Chip>{Math.round(selected.domain_profile.confidence * 100)}% match</Chip>
                </div>
              )}
            </div>

            {!selected.domain_profile ? (
              <div className="rounded-md border border-foreground/10 px-3 py-4">
                <p className="text-[11px] text-muted-foreground">
                  This dataset has no domain profile — it landed before the pack engine, or it is non-tabular.
                </p>
                <button
                  onClick={() => void reprofile(selected.id)}
                  disabled={reprofiling === selected.id}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-foreground/15 px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-[0.2em] text-foreground transition-colors hover:border-foreground/30 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${reprofiling === selected.id ? "animate-spin" : ""}`} />
                  {reprofiling === selected.id ? "Profiling" : "Run profile"}
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-md border border-foreground/10 bg-background/40 p-3">
                  <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">{selected.domain_profile.packLabel}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-foreground/85">{selected.domain_profile.mission}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selected.domain_profile.standards.map((s) => <Chip key={s}>{s}</Chip>)}
                    {selected.domain_profile.sensitivityClasses.map((s) => <Chip key={s} cls="border-amber-300/30 text-amber-200">{s}</Chip>)}
                  </div>
                  {!!selected.domain_profile.alternates.length && (
                    <p className="mt-2 text-[10px] text-muted-foreground/60">
                      Alternates considered: {selected.domain_profile.alternates.map((a) => `${a.label} ${Math.round(a.confidence * 100)}%`).join(", ")}
                    </p>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-foreground/10 p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">
                      <Boxes className="h-3 w-3" /> Ontology bindings
                    </p>
                    <ul className="mt-2 space-y-1">
                      {selected.domain_profile.bindings.slice(0, 14).map((b) => (
                        <li key={b.column} className="flex items-baseline justify-between gap-2 text-[11px]">
                          <span className="truncate font-mono text-foreground/85">{b.column}</span>
                          <span className="shrink-0 text-muted-foreground/70">{b.object}.{b.property}</span>
                        </li>
                      ))}
                      {!selected.domain_profile.bindings.length && <li className="text-[11px] text-muted-foreground/60">No columns bound.</li>}
                    </ul>
                    {!!selected.domain_profile.unmappedColumns.length && (
                      <p className="mt-2 text-[10px] text-muted-foreground/55">
                        Unmapped: {selected.domain_profile.unmappedColumns.slice(0, 10).join(", ")}
                      </p>
                    )}
                  </div>

                  <div className="rounded-md border border-foreground/10 p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">
                      <Target className="h-3 w-3" /> Decision readiness
                    </p>
                    <ul className="mt-2 space-y-1 text-[11px]">
                      {selected.domain_profile.kpisReady.map((k) => (
                        <li key={k.name} className="text-emerald-200/80">✓ {k.name} <span className="text-muted-foreground/55">— {k.formula}</span></li>
                      ))}
                      {selected.domain_profile.kpisBlocked.map((k) => (
                        <li key={k.name} className="text-amber-200/80">✗ {k.name} <span className="text-muted-foreground/55">— needs {k.missing.join(" + ")}</span></li>
                      ))}
                      {!selected.domain_profile.kpisReady.length && !selected.domain_profile.kpisBlocked.length && (
                        <li className="text-muted-foreground/60">No KPIs defined for this pack.</li>
                      )}
                    </ul>
                  </div>
                </div>

                <div className="rounded-md border border-foreground/10 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">
                    <ShieldAlert className="h-3 w-3" /> Contract findings
                  </p>
                  <ul className="mt-2 space-y-2">
                    {selected.domain_profile.findings.map((f) => (
                      <li key={f.code} className="rounded border border-foreground/8 px-2.5 py-2">
                        <div className="flex items-center gap-2">
                          <Chip cls={SEV[f.severity] ?? ""}>{f.severity}</Chip>
                          <span className="font-mono text-[10px] text-muted-foreground/60">{f.code}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-foreground/85">{f.message}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground/60">Evidence: {f.evidence}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground/70">Fix: {f.remediation}</p>
                      </li>
                    ))}
                    {!selected.domain_profile.findings.length && (
                      <li className="text-[11px] text-muted-foreground/60">No governance findings — the contract holds.</li>
                    )}
                  </ul>
                </div>

                <div className="rounded-md border border-foreground/10 p-3">
                  <p className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">
                    <AlertOctagon className="h-3 w-3" /> Collection gaps
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-muted-foreground/80">
                    {selected.domain_profile.collectionGaps.map((g) => <li key={g}>{g}</li>)}
                    {!selected.domain_profile.collectionGaps.length && <li>No open gaps for this pack's decision set.</li>}
                  </ul>
                  <p className="mt-3 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground/60">Decisions this data serves</p>
                  <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[11px] text-foreground/80">
                    {selected.domain_profile.decisions.map((d) => <li key={d}>{d}</li>)}
                  </ul>
                </div>

                <p className="whitespace-pre-wrap rounded-md border border-foreground/10 bg-background/40 p-3 text-[11px] leading-relaxed text-muted-foreground/80">
                  {selected.domain_profile.briefing}
                </p>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default DomainIntelligencePanel;
