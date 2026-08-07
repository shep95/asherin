/**
 * GeoAuditView — Priority 4 surface.
 *
 * Measures two different things and never conflates them:
 *
 *   Readiness  — what a JS-less generative crawler receives from the published
 *                site right now. Fetched live from asherin.com, so it verifies
 *                the shipped build rather than the source tree.
 *   Retrieval  — whether asherin.com appears in a live search for a prompt,
 *                and at what rank. Retrieval gates absorption: an engine can
 *                only quote a page it fetched.
 *
 * Both run through the geo-audit edge function. Nothing here is precomputed.
 */
import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GEO_CONTENT } from "@/lib/geo/geoContent";
import { Loader2, RefreshCw, Check, X, ExternalLink } from "lucide-react";

interface RouteCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}
interface RouteScore {
  route: string;
  url: string;
  status: number;
  score: number;
  maxScore: number;
  checks: RouteCheck[];
}
/**
 * Selection is "the engine fetched the page". Absorption is "the engine's
 * answer carries the page's own language and figures". They move independently,
 * so the table reports them as separate columns rather than one blended score.
 */
interface AbsorptionResult {
  ran: boolean;
  reason?: string;
  attributed: boolean;
  coverage: number;
  liftedFigures: string[];
  answerExcerpt: string;
}
interface CitationResult {
  prompt: string;
  found: boolean;
  rank: number | null;
  matchedUrl: string | null;
  totalResults: number;
  competitors: string[];
  absorption: AbsorptionResult;
}
interface ProbeSummary {
  selectionRate: number;
  absorptionMeasured: number;
  attributionRate: number | null;
  meanCoverage: number | null;
}

const DEFAULT_PROMPTS = [
  "uncensored ai chat platform",
  "best byok ai platform",
  "ai osint tool for analysts",
  "sovereign ai platform pricing",
  "predictive intelligence ai software",
];

const Bar = ({ score, max }: { score: number; max: number }) => {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-[120px]">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-foreground/70 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-[11px] text-muted-foreground">
        {score}/{max}
      </span>
    </div>
  );
};

const GeoAuditView = () => {
  const allRoutes = useMemo(() => Object.keys(GEO_CONTENT), []);
  const [selected, setSelected] = useState<string[]>(() => allRoutes.slice(0, 8));
  const [routeScores, setRouteScores] = useState<RouteScore[] | null>(null);
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [promptText, setPromptText] = useState(DEFAULT_PROMPTS.join("\n"));
  const [citations, setCitations] = useState<CitationResult[] | null>(null);
  const [probeLoading, setProbeLoading] = useState(false);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [withAbsorption, setWithAbsorption] = useState(true);
  const [probeSummary, setProbeSummary] = useState<ProbeSummary | null>(null);
  const [openPrompt, setOpenPrompt] = useState<string | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);

  const runReadiness = useCallback(async () => {
    if (selected.length === 0) {
      setRoutesError("Select at least one route.");
      return;
    }
    setRoutesLoading(true);
    setRoutesError(null);
    try {
      const { data, error } = await supabase.functions.invoke("geo-audit", {
        body: { mode: "readiness", routes: selected },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRouteScores(data.routes ?? []);
      setRanAt(data.ranAt ?? null);
    } catch (e) {
      setRoutesError(e instanceof Error ? e.message : "Audit failed");
    } finally {
      setRoutesLoading(false);
    }
  }, [selected]);

  const runProbe = useCallback(async () => {
    const prompts = promptText
      .split("\n")
      .map((p) => p.trim())
      .filter(Boolean);
    if (prompts.length === 0) {
      setProbeError("Enter at least one prompt.");
      return;
    }
    setProbeLoading(true);
    setProbeError(null);
    try {
      const { data, error } = await supabase.functions.invoke("geo-audit", {
        body: { mode: "citation", prompts, absorption: withAbsorption },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCitations(data.results ?? []);
      setProbeSummary(data.summary ?? null);
      setRanAt(data.ranAt ?? null);
    } catch (e) {
      setProbeError(e instanceof Error ? e.message : "Probe failed");
    } finally {
      setProbeLoading(false);
    }
  }, [promptText, withAbsorption]);

  const totals = useMemo(() => {
    if (!routeScores?.length) return null;
    const score = routeScores.reduce((a, r) => a + r.score, 0);
    const max = routeScores.reduce((a, r) => a + r.maxScore, 0);
    return { score, max, pct: max ? Math.round((score / max) * 100) : 0 };
  }, [routeScores]);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-8">
      <header className="space-y-2">
        <p className="text-[10px] font-medium tracking-[0.3em] uppercase text-muted-foreground">
          ◈ GEO Measurement
        </p>
        <h1 className="text-2xl font-light tracking-tight text-foreground">
          Generative Engine Readiness
        </h1>
        <p className="max-w-2xl text-sm font-extralight leading-relaxed text-muted-foreground">
          Readiness measures what a crawler without JavaScript receives from the published site.
          Retrieval measures whether asherin.com shows up in a live search at all. A page must pass
          both before a generative engine can quote it.
        </p>
        {ranAt && (
          <p className="font-mono text-[11px] text-muted-foreground/70">
            Last run {new Date(ranAt).toLocaleString()}
          </p>
        )}
      </header>

      {/* ── Readiness ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-border/40 bg-card/30 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-light tracking-[0.15em] uppercase text-foreground">
            Absorption readiness
          </h2>
          <div className="flex items-center gap-3">
            {totals && (
              <span className="font-mono text-xs text-muted-foreground">
                {totals.pct}% of checks passing
              </span>
            )}
            <button
              onClick={runReadiness}
              disabled={routesLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-background/60 px-3 py-1.5 text-xs font-light text-foreground transition-colors hover:bg-foreground/10 disabled:opacity-50"
            >
              {routesLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Audit {selected.length} route{selected.length === 1 ? "" : "s"}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {allRoutes.map((r) => {
            const on = selected.includes(r);
            return (
              <button
                key={r}
                onClick={() =>
                  setSelected((prev) =>
                    prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r].slice(0, 25),
                  )
                }
                aria-pressed={on}
                className={`rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors ${
                  on
                    ? "border-foreground/40 bg-foreground/10 text-foreground"
                    : "border-border/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>

        {routesError && (
          <p role="alert" className="text-xs text-destructive">
            {routesError}
          </p>
        )}

        {routesLoading && !routeScores && (
          <div className="space-y-2" aria-live="polite">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        )}

        {routeScores && routeScores.length === 0 && (
          <p className="text-xs text-muted-foreground">No routes returned. Select routes and run again.</p>
        )}

        {routeScores && routeScores.length > 0 && (
          <div className="divide-y divide-border/30 rounded-lg border border-border/30">
            {routeScores.map((r) => (
              <div key={r.route}>
                <button
                  onClick={() => setExpanded(expanded === r.route ? null : r.route)}
                  className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-foreground/5"
                  aria-expanded={expanded === r.route}
                >
                  <span className="font-mono text-xs text-foreground truncate">{r.route}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-muted-foreground/70">
                      HTTP {r.status || "ERR"}
                    </span>
                    <Bar score={r.score} max={r.maxScore} />
                  </span>
                </button>
                {expanded === r.route && (
                  <ul className="space-y-1.5 border-t border-border/20 bg-background/30 px-4 py-3">
                    {r.checks.map((c) => (
                      <li key={c.id} className="flex items-start gap-2 text-xs">
                        {c.pass ? (
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/70" />
                        ) : (
                          <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                        )}
                        <span className="font-extralight text-muted-foreground">
                          <span className={c.pass ? "text-foreground/80" : "text-foreground"}>
                            {c.label}
                          </span>
                          <span className="text-muted-foreground/60"> — {c.detail}</span>
                        </span>
                      </li>
                    ))}
                    <li>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Open live page <ExternalLink className="h-3 w-3" />
                      </a>
                    </li>
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Retrieval probe ───────────────────────────────────────── */}
      <section className="rounded-xl border border-border/40 bg-card/30 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-light tracking-[0.15em] uppercase text-foreground">
            Retrieval probe
          </h2>
          <label className="flex items-center gap-2 text-[11px] font-light text-muted-foreground">
            <input
              type="checkbox"
              checked={withAbsorption}
              onChange={(e) => setWithAbsorption(e.target.checked)}
              className="h-3.5 w-3.5 accent-current"
            />
            Measure absorption (slower)
          </label>
          <button
            onClick={runProbe}
            disabled={probeLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-border/50 bg-background/60 px-3 py-1.5 text-xs font-light text-foreground transition-colors hover:bg-foreground/10 disabled:opacity-50"
          >
            {probeLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Run probe
          </button>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Prompts, one per line (max 10)
          </span>
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={5}
            className="w-full resize-y rounded-lg border border-border/40 bg-background/50 p-3 font-mono text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-foreground/40"
          />
        </label>

        {probeError && (
          <p role="alert" className="text-xs text-destructive">
            {probeError}
          </p>
        )}

        {probeLoading && !citations && (
          <div className="space-y-2" aria-live="polite">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        )}

        {citations && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/30 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  <th scope="col" className="py-2 pr-3 font-normal">Prompt</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Retrieved</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Rank</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Absorbed</th>
                  <th scope="col" className="py-2 font-normal">Domains competing</th>
                </tr>
              </thead>
              <tbody>
                {citations.map((c) => (
                  <tr key={c.prompt} className="border-b border-border/15 align-top">
                    <td className="py-2.5 pr-3 font-mono text-[11px] text-foreground">{c.prompt}</td>
                    <td className="py-2.5 pr-3">
                      {c.found ? (
                        <span className="text-foreground">Yes</span>
                      ) : (
                        <span className="text-muted-foreground">No</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-muted-foreground">
                      {c.rank ?? "—"}
                      <span className="text-muted-foreground/50"> / {c.totalResults}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      {c.absorption.ran ? (
                        <button
                          onClick={() => setOpenPrompt(openPrompt === c.prompt ? null : c.prompt)}
                          aria-expanded={openPrompt === c.prompt}
                          className="text-left font-mono text-[11px] text-foreground underline-offset-2 hover:underline"
                        >
                          {c.absorption.attributed ? "named" : "unnamed"}
                          <span className="text-muted-foreground/60">
                            {" "}
                            · {(c.absorption.coverage * 100).toFixed(1)}%
                          </span>
                        </button>
                      ) : (
                        <span className="font-extralight text-muted-foreground/60">
                          {c.absorption.reason ?? "not measured"}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 font-extralight text-muted-foreground/80">
                      {c.competitors.join(", ") || "none returned"}
                    </td>
                  </tr>
                ))}
                {citations
                  .filter((c) => c.absorption.ran && openPrompt === c.prompt)
                  .map((c) => (
                    <tr key={`${c.prompt}-detail`} className="border-b border-border/15 bg-background/30">
                      <td colSpan={5} className="px-1 py-3">
                        <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          Synthesised answer excerpt
                        </p>
                        <p className="max-w-3xl font-extralight leading-relaxed text-muted-foreground">
                          {c.absorption.answerExcerpt}
                        </p>
                        <p className="mt-2 font-mono text-[11px] text-muted-foreground/70">
                          Figures lifted from the page:{" "}
                          {c.absorption.liftedFigures.join(", ") || "none"}
                        </p>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {probeSummary && (
              <p className="mt-3 font-mono text-[11px] text-muted-foreground/80">
                Selection {(probeSummary.selectionRate * 100).toFixed(0)}%
                {probeSummary.absorptionMeasured > 0 && (
                  <>
                    {" · "}absorption measured on {probeSummary.absorptionMeasured} prompt
                    {probeSummary.absorptionMeasured === 1 ? "" : "s"}
                    {probeSummary.attributionRate !== null &&
                      ` · named in ${(probeSummary.attributionRate * 100).toFixed(0)}%`}
                    {probeSummary.meanCoverage !== null &&
                      ` · mean phrase coverage ${(probeSummary.meanCoverage * 100).toFixed(1)}%`}
                  </>
                )}
              </p>
            )}
            {citations.every((c) => !c.found) && (
              <p className="mt-3 text-xs font-extralight text-muted-foreground">
                Not retrieved for any prompt yet. Retrieval follows indexing, which lags publishing
                by days to weeks. Re-run after the next crawl.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
};

export default GeoAuditView;
