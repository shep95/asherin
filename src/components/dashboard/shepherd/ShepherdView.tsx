// asherin.shepherd — evidence reasoning surface.
//
// The screen is laid out the way the engine reasons: seed, then the anchor
// gate, then live collection, then findings that each carry their own chain.
// There is no summary score anywhere in this file, by design.

import { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  ChevronRight,
  CircleSlash,
  Clock,
  Loader2,
  Radar,
  ShieldQuestion,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { parseSeed } from "./seed";
import { TIER_CEILING, TIER_LABEL } from "./engine";
import { SOURCES, TIER_FAILURE_MODES } from "./sources";
import { runTraversal } from "./traversal";
import type { Certainty, EvidenceObject, Finding, Tier, Token } from "./types";

const CERTAINTY_STYLE: Record<Certainty, { dot: string; text: string; label: string }> = {
  confirmed: { dot: "bg-emerald-400", text: "text-emerald-300/90", label: "confirmed" },
  corroborated: { dot: "bg-sky-400", text: "text-sky-300/90", label: "corroborated" },
  inferred: { dot: "bg-amber-400", text: "text-amber-300/90", label: "inferred" },
  estimated: { dot: "bg-muted-foreground/50 ring-1 ring-dashed", text: "text-muted-foreground", label: "estimated" },
  conditional: { dot: "bg-amber-400/40 ring-1 ring-amber-400/60", text: "text-amber-200/80", label: "conditional" },
};

const CATEGORY_ORDER: Finding["category"][] = [
  "identity",
  "government",
  "location",
  "communications",
  "platforms",
  "network",
  "breach",
  "timeline",
];

const STATE_TONE: Record<string, string> = {
  querying: "text-foreground/70",
  returned: "text-emerald-300/80",
  null: "text-muted-foreground/60",
  "rate-limited": "text-amber-300/80",
  failed: "text-red-300/70",
  "not-connected": "text-muted-foreground/40",
  blocked: "text-muted-foreground/40",
  queued: "text-muted-foreground/40",
  idle: "text-muted-foreground/30",
};

const Panel = ({
  title,
  sub,
  children,
  className,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <section
    className={cn(
      "rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-xl",
      "shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.04)]",
      className,
    )}
  >
    <header className="px-4 pt-3.5 pb-2.5 border-b border-border/[0.06]">
      <h2 className="text-[10px] uppercase tracking-[0.2em] text-foreground/70 font-light">{title}</h2>
      {sub && <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/50">{sub}</p>}
    </header>
    <div className="p-4">{children}</div>
  </section>
);

const Weight = ({ value }: { value: number }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="h-1 w-14 rounded-full bg-foreground/[0.08] overflow-hidden">
      <span className="block h-full bg-foreground/40" style={{ width: `${Math.round(value * 100)}%` }} />
    </span>
    <span className="tabular-nums text-[10px] text-muted-foreground/70">{value.toFixed(2)}</span>
  </span>
);

const TokenRow = ({ token }: { token: Token }) => (
  <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/[0.04] last:border-0">
    <div className="min-w-0">
      <p className="text-[11px] text-foreground/80 truncate">{token.value}</p>
      <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground/40">
        {token.type}
        {token.precision ? ` · ${token.precision}` : ""} ·{" "}
        {token.originTier === null ? "seed · unverified" : TIER_LABEL[token.originTier]}
        {token.corroborations.length ? ` · ${token.corroborations.length} corroboration` : ""}
        {token.conflicts.length ? " · in conflict" : ""}
      </p>
    </div>
    <Weight value={token.weight} />
  </div>
);

const FindingCard = ({ finding, tokens }: { finding: Finding; tokens: Token[] }) => {
  const [open, setOpen] = useState(false);
  const style = CERTAINTY_STYLE[finding.certainty];
  const chain = finding.chain
    .map((id) => tokens.find((t) => t.id === id))
    .filter((t): t is Token => !!t);
  return (
    <article className="rounded-xl border border-border/[0.07] bg-foreground/[0.015] p-3">
      <div className="flex items-start gap-2.5">
        <span className={cn("mt-1.5 h-1.5 w-1.5 rounded-full shrink-0", style.dot)} />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] leading-snug text-foreground/85">{finding.label}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/60 whitespace-pre-line">
            {finding.detail}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] uppercase tracking-[0.14em]">
            <span className={style.text}>{style.label}</span>
            <span className="text-muted-foreground/40">{TIER_LABEL[finding.tier]}</span>
            <span className="text-muted-foreground/40">{finding.sourceName}</span>
            <span className="text-muted-foreground/50 tabular-nums normal-case tracking-normal">
              joint {finding.joint.toFixed(3)}
            </span>
            {finding.unresolvable && <span className="text-amber-300/70">unresolvable — chain in conflict</span>}
            <button
              onClick={() => setOpen((v) => !v)}
              className="ml-auto inline-flex items-center gap-1 text-muted-foreground/50 hover:text-foreground/70 transition-colors"
            >
              chain <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
            </button>
          </div>

          {finding.notice && (
            <div className="mt-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.04] p-2.5">
              <p className="text-[9px] uppercase tracking-[0.18em] text-amber-200/70">dependency notice</p>
              <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground/70">
                flows through <span className="text-foreground/75">{finding.notice.throughLabel}</span> at weight{" "}
                {finding.notice.weight.toFixed(2)}. resolved by {finding.notice.resolvedBy}. if that token is wrong,{" "}
                {finding.notice.ifWrong}.
              </p>
            </div>
          )}

          {open && (
            <ol className="mt-2 space-y-1">
              {chain.map((t, i) => (
                <li key={t.id} className="flex items-center gap-2 text-[10px] text-muted-foreground/60">
                  <span className="tabular-nums text-muted-foreground/30">{i + 1}</span>
                  <span className="text-foreground/70">{t.value}</span>
                  <span className="text-muted-foreground/35">
                    {t.originTier === null ? "seed" : `T${t.originTier}`}
                  </span>
                  <Weight value={t.weight} />
                </li>
              ))}
              {finding.url && (
                <li className="pt-1">
                  <a
                    href={finding.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="text-[10px] text-foreground/50 hover:text-foreground/80 underline underline-offset-2 break-all"
                  >
                    {finding.url}
                  </a>
                </li>
              )}
            </ol>
          )}
        </div>
      </div>
    </article>
  );
};

const ShepherdView = () => {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [evidence, setEvidence] = useState<EvidenceObject | null>(null);
  const [running, setRunning] = useState(false);
  const [parallel, setParallel] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const preview = useMemo(() => (query.trim().length > 2 ? parseSeed(query) : null), [query]);

  const start = useCallback(async () => {
    const q = query.trim();
    if (q.length < 3 || running) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setRunning(true);
    setEvidence(null);
    try {
      await runTraversal(q, {
        onUpdate: (ev) => setEvidence(ev),
        signal: ctrl.signal,
        parallelCandidates: parallel,
      });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast({
          title: "traversal stopped",
          description: (e as Error).message?.slice(0, 200) ?? "the retrieval layer refused the run",
          variant: "destructive",
        });
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [query, running, parallel, toast]);

  const stop = () => abortRef.current?.abort();

  const grouped = useMemo(() => {
    const map = new Map<Finding["category"], Finding[]>();
    for (const f of evidence?.findings ?? []) {
      map.set(f.category, [...(map.get(f.category) ?? []), f]);
    }
    for (const list of map.values()) list.sort((a, b) => b.joint - a.joint);
    return map;
  }, [evidence]);

  const elapsed = evidence ? Math.round(((evidence.finishedAt ?? Date.now()) - evidence.startedAt) / 1000) : 0;

  return (
    <div className="h-full min-h-0 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1400px] px-5 py-5 space-y-4">
        {/* header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[13px] font-light tracking-[0.18em] uppercase text-foreground/90">asherin.shepherd</h1>
            <p className="mt-1 text-[10.5px] leading-relaxed text-muted-foreground/50 max-w-2xl">
              a keyword-graph evidence engine. evidence earns its weight through independent corroboration, never
              through the reputation of the source that produced it first. no summary score is produced anywhere in
              this room.
            </p>
          </div>
          {evidence && (
            <div className="text-right shrink-0">
              <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/40">elapsed</p>
              <p className="text-[13px] tabular-nums text-foreground/70">
                {Math.floor(elapsed / 60)}m {String(elapsed % 60).padStart(2, "0")}s
              </p>
            </div>
          )}
        </div>

        {/* seed */}
        <Panel
          title="seed layer"
          sub="the query is parsed once into typed tokens at provisional weight, then discarded. nothing you type is treated as verified."
        >
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void start();
            }}
            rows={2}
            placeholder="who is jane q analyst, ~34, broward county florida"
            className="w-full resize-none rounded-xl border border-border/[0.08] bg-foreground/[0.02] px-3.5 py-2.5 text-[12.5px] text-foreground/85 placeholder:text-muted-foreground/30 outline-none focus:border-border/20 transition-colors"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => void start()}
              disabled={running || query.trim().length < 3}
              className="inline-flex items-center gap-2 rounded-lg border border-border/[0.1] bg-foreground/[0.05] px-3.5 py-1.5 text-[11px] text-foreground/80 hover:bg-foreground/[0.09] disabled:opacity-30 transition-colors"
            >
              {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Radar className="h-3 w-3" />}
              {running ? "traversing" : "run anchor gate"}
            </button>
            {running && (
              <button
                onClick={stop}
                className="inline-flex items-center gap-2 rounded-lg border border-border/[0.1] px-3 py-1.5 text-[11px] text-muted-foreground/70 hover:text-foreground/80 transition-colors"
              >
                <Square className="h-3 w-3" /> stop
              </button>
            )}
            <label className="inline-flex items-center gap-2 text-[10px] text-muted-foreground/50">
              <input
                type="checkbox"
                checked={parallel}
                onChange={(e) => setParallel(e.target.checked)}
                className="accent-foreground/60"
              />
              run split candidates in parallel, output partitioned
            </label>
            <span className="text-[10px] text-muted-foreground/35">
              a compliant traversal takes minutes, not seconds — rate limits are respected, not raced.
            </span>
          </div>

          {preview && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/40 mb-1.5">
                  seed token map
                </p>
                {preview.tokens.length ? (
                  preview.tokens.map((t) => <TokenRow key={t.id} token={t} />)
                ) : (
                  <p className="text-[10.5px] text-muted-foreground/40">no typed tokens extracted yet.</p>
                )}
              </div>
              <div className="space-y-2">
                {preview.warnings.map((w) => (
                  <p key={w} className="flex gap-2 text-[10.5px] leading-relaxed text-amber-200/70">
                    <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                    {w}
                  </p>
                ))}
                <div>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/40 mb-1">
                    would most efficiently disambiguate
                  </p>
                  <ol className="space-y-0.5">
                    {preview.discriminators.slice(0, 5).map((d, i) => (
                      <li key={d} className="text-[10.5px] text-muted-foreground/60">
                        {i + 1}. {d}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </div>
          )}
        </Panel>

        {evidence && (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4 min-w-0">
              {/* anchor gate */}
              <Panel
                title="anchor gate"
                sub="nothing below T1 may establish identity. traversal does not begin until this passes."
              >
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/40">state</p>
                    <p
                      className={cn(
                        "text-[12px]",
                        evidence.anchor.state === "anchored" ? "text-emerald-300/85" : "text-amber-200/80",
                      )}
                    >
                      {evidence.anchor.state}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/40">anchor confidence</p>
                    <Weight value={evidence.anchor.confidence} />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/40">t1 candidates</p>
                    <p className="text-[12px] tabular-nums text-foreground/75">{evidence.candidates.length}</p>
                  </div>
                </div>
                <p className="mt-2.5 text-[10.5px] leading-relaxed text-muted-foreground/60">{evidence.anchor.note}</p>

                {evidence.candidates.length > 1 && (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {evidence.candidates.map((c) => (
                      <div key={c.id} className="rounded-xl border border-amber-400/15 bg-amber-400/[0.03] p-3">
                        <p className="text-[9px] uppercase tracking-[0.18em] text-amber-200/60">{c.id}</p>
                        <p className="mt-1 text-[11.5px] text-foreground/80">{c.label}</p>
                        <p className="mt-1 text-[10.5px] text-muted-foreground/55 line-clamp-3">{c.snippet}</p>
                        <p className="mt-1.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground/40">
                          {c.sourceName}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {evidence.anchor.nonDiscriminating.length > 0 && (
                  <p className="mt-3 text-[10.5px] text-muted-foreground/55">
                    non-discriminating across candidates: {evidence.anchor.nonDiscriminating.join(", ")}. these cannot
                    confirm either identity because they match both.
                  </p>
                )}
                {evidence.anchor.state !== "anchored" && (
                  <ol className="mt-2 space-y-0.5">
                    {evidence.anchor.wouldResolve.slice(0, 5).map((d, i) => (
                      <li key={d} className="text-[10.5px] text-muted-foreground/60">
                        {i + 1}. {d}
                      </li>
                    ))}
                  </ol>
                )}
              </Panel>

              {/* findings */}
              {CATEGORY_ORDER.filter((c) => grouped.get(c)?.length).map((cat) => (
                <Panel key={cat} title={cat} sub={`${grouped.get(cat)?.length ?? 0} finding(s), each with its own chain`}>
                  <div className="space-y-2.5">
                    {(grouped.get(cat) ?? []).map((f) => (
                      <FindingCard key={f.id} finding={f} tokens={evidence.tokens} />
                    ))}
                  </div>
                </Panel>
              ))}

              {/* conflicts */}
              <Panel title="conflict register" sub="the higher tier does not silently win. conflicts stay open.">
                {evidence.conflicts.length ? (
                  <div className="space-y-2">
                    {evidence.conflicts.map((c) => (
                      <div key={c.id} className="rounded-lg border border-border/[0.07] p-2.5">
                        <p className="text-[11px] text-foreground/80">
                          {c.left.value} <span className="text-muted-foreground/40">vs</span> {c.right.value}
                        </p>
                        <p className="text-[10px] text-muted-foreground/50">
                          {c.left.sourceName} (T{c.left.tier}) against {c.right.sourceName} (T{c.right.tier}) · resolved
                          by {c.resolvedBy}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10.5px] text-muted-foreground/45">no open conflicts.</p>
                )}
              </Panel>

              {/* absences */}
              <Panel title="absence register" sub="a null return is a finding. its meaning is set by the tier that produced it.">
                {evidence.absences.length ? (
                  <div className="space-y-1.5">
                    {evidence.absences.map((a) => (
                      <div key={a.sourceId} className="flex items-start gap-2">
                        <CircleSlash className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/35" />
                        <p className="text-[10.5px] leading-relaxed text-muted-foreground/60">
                          <span className="text-foreground/70">{a.sourceName}</span> · T{a.tier} — {a.meaning}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10.5px] text-muted-foreground/45">no null returns recorded yet.</p>
                )}
              </Panel>

              {/* timeline */}
              {evidence.timeline.length > 0 && (
                <Panel title="timeline" sub="every event carries how it is known, not just when.">
                  <div className="space-y-1.5">
                    {evidence.timeline
                      .slice()
                      .sort((a, b) => (a.when < b.when ? 1 : -1))
                      .map((t) => (
                        <div key={t.id} className="flex items-start gap-2">
                          <Clock className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/30" />
                          <p className="text-[10.5px] leading-relaxed text-muted-foreground/60">
                            <span className="tabular-nums text-foreground/70">{t.when.slice(0, 10)}</span> — {t.label}{" "}
                            <span className="text-muted-foreground/35">
                              [{t.evidence} · {t.sourceName}]
                            </span>
                          </p>
                        </div>
                      ))}
                  </div>
                </Panel>
              )}
            </div>

            {/* right rail */}
            <div className="space-y-4 min-w-0">
              <Panel title="live source feed" sub="collection completeness is visible, so partial data is never mistaken for a clean run.">
                <div className="space-y-1">
                  {([1, 2, 3, 4] as Tier[]).map((layer) => (
                    <div key={layer} className="pb-2">
                      <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground/35 mb-1">
                        layer {layer} · ceiling {TIER_CEILING[layer].toFixed(2)}
                      </p>
                      {evidence.sources
                        .filter((s) => s.layer === layer)
                        .map((s) => (
                          <div key={s.id} className="flex items-center gap-2 py-0.5">
                            <span
                              className={cn(
                                "h-1 w-1 rounded-full shrink-0",
                                s.state === "returned"
                                  ? "bg-emerald-400"
                                  : s.state === "querying"
                                    ? "bg-foreground/60 animate-pulse"
                                    : s.state === "rate-limited"
                                      ? "bg-amber-400"
                                      : s.state === "failed"
                                        ? "bg-red-400/70"
                                        : "bg-muted-foreground/25",
                              )}
                            />
                            <span className="text-[10.5px] text-foreground/70 truncate flex-1">{s.name}</span>
                            <span className={cn("text-[9px] uppercase tracking-[0.12em]", STATE_TONE[s.state])}>
                              {s.state}
                            </span>
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              </Panel>

              <Panel title="token graph" sub="every claim above traces back to a node here.">
                <div className="max-h-[420px] overflow-y-auto pr-1">
                  {evidence.tokens
                    .slice()
                    .sort((a, b) => b.weight - a.weight)
                    .slice(0, 60)
                    .map((t) => (
                      <TokenRow key={t.id} token={t} />
                    ))}
                </div>
              </Panel>

              <Panel title="what shepherd refuses to conclude">
                <ul className="space-y-2">
                  {evidence.refusals.map((r) => (
                    <li key={r} className="flex gap-2 text-[10.5px] leading-relaxed text-muted-foreground/55">
                      <Ban className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground/30" />
                      {r}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        )}

        {!evidence && (
          <Panel
            title="source reliability taxonomy"
            sub="classification is permanent and set before a source is ever queried. it caps every token that source can birth."
          >
            <div className="grid gap-3 md:grid-cols-2">
              {([1, 2, 3, 4] as Tier[]).map((tier) => (
                <div key={tier} className="rounded-xl border border-border/[0.07] p-3">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-foreground/70">{TIER_LABEL[tier]}</p>
                    <p className="text-[10px] tabular-nums text-muted-foreground/50">
                      ceiling {TIER_CEILING[tier].toFixed(2)}
                    </p>
                  </div>
                  <p className="mt-1.5 text-[10.5px] leading-relaxed text-muted-foreground/55">
                    {SOURCES.filter((s) => s.tier === tier)
                      .map((s) => s.name)
                      .join(" · ")}
                  </p>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground/40">
                    known failure modes: {TIER_FAILURE_MODES[tier]}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 flex gap-2 text-[10.5px] leading-relaxed text-muted-foreground/50">
              <ShieldQuestion className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/30" />
              direct probe binaries (maigret, holehe, dehashed) are not wired into this deployment. they appear in the
              live feed as not-connected and produce no absence tokens — a source that was never asked is not a source
              that found nothing.
            </p>
          </Panel>
        )}
      </div>
    </div>
  );
};

export default ShepherdView;
