import { useEffect, useMemo, useState } from "react";
import {
  Loader2, X, ExternalLink, Archive, Globe, SlidersHorizontal, Download, AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  applyFilters, resultFacets, type GhostSearchResult, type ResultFilters,
} from "./searchFormat";
import type { BufferSession } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// GHOST ENGINE — result surface.
//
// One ranked list. A shell hit and a payload hit sit side by side because the
// operator asked a question, not a layer. Web hits open the metadata drawer;
// buffer hits open the retained body, rendered as text nodes only.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  results: GhostSearchResult[];
  suggestions: string[];
  elapsedMs: number;
  scanned?: number;
  onOpenRecord: (entityId: string) => void;
  onSuggest: (q: string) => void;
}

interface PayloadState {
  session: BufferSession & { content_text: string };
  download: string | null;
}

const PillFilter = ({
  label, count, active, onClick,
}: { label: string; count?: number; active: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    className={`flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] transition-colors ${
      active
        ? "border-foreground/40 bg-foreground/8 text-foreground"
        : "border-border/15 text-muted-foreground/60 hover:text-foreground/85"
    }`}
  >
    <span className="truncate">{label}</span>
    {count !== undefined && <span className="shrink-0 text-muted-foreground/40">{count}</span>}
  </button>
);

const GhostSearchResults = ({ results, suggestions, elapsedMs, scanned, onOpenRecord, onSuggest }: Props) => {
  const [filters, setFilters] = useState<ResultFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [payload, setPayload] = useState<PayloadState | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  // A filter that survives a new result set silently hides findings. Reset it
  // whenever the underlying corpus changes.
  useEffect(() => { setFilters({}); }, [results]);

  const facets = useMemo(() => resultFacets(results), [results]);
  const shown = useMemo(() => applyFilters(results, filters), [results, filters]);

  const toggle = <K extends keyof ResultFilters>(k: K, v: ResultFilters[K]) =>
    setFilters((f) => ({ ...f, [k]: f[k] === v ? undefined : v }));

  const openPayload = async (sessionId: string) => {
    setOpening(sessionId);
    try {
      const { data, error } = await supabase.functions.invoke("ghost-engine", {
        body: { action: "payload", sessionId },
      });
      if (error) throw new Error(error.message);
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setPayload(data as PayloadState);
    } catch (e) {
      toast({ title: "Could not open session", description: (e as Error).message, variant: "destructive" });
    } finally {
      setOpening(null);
    }
  };

  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div>
      {/* ── Result meter + filter toggle ─────────────────────────────── */}
      <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground/55">
        <span>
          {shown.length} result{shown.length === 1 ? "" : "s"}
          {shown.length !== results.length && ` of ${results.length}`}
          {" · "}{elapsedMs} ms
          {scanned !== undefined && ` · ${scanned} buffered session${scanned === 1 ? "" : "s"} scanned`}
        </span>
        <button
          onClick={() => setShowFilters((s) => !s)}
          className={`ml-auto flex items-center gap-1.5 rounded-md border px-2 py-1 transition-colors ${
            activeCount ? "border-foreground/35 text-foreground" : "border-border/20 hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="h-3 w-3" />
          Filters{activeCount ? ` · ${activeCount}` : ""}
        </button>
      </div>

      {showFilters && (
        <div className="mb-4 space-y-2 rounded-lg border border-border/12 bg-foreground/[0.015] p-3">
          {facets.hosts.length > 1 && (
            <div>
              <p className="mb-1 text-[9px] uppercase tracking-[0.15em] text-muted-foreground/40">Host</p>
              <div className="flex flex-wrap gap-1.5">
                {facets.hosts.map(([h, c]) => (
                  <PillFilter key={h} label={h} count={c} active={filters.host === h} onClick={() => toggle("host", h)} />
                ))}
              </div>
            </div>
          )}
          {facets.sourceTypes.length > 1 && (
            <div>
              <p className="mb-1 text-[9px] uppercase tracking-[0.15em] text-muted-foreground/40">Type</p>
              <div className="flex flex-wrap gap-1.5">
                {facets.sourceTypes.map(([t, c]) => (
                  <PillFilter key={t} label={t} count={c} active={filters.sourceType === t} onClick={() => toggle("sourceType", t)} />
                ))}
              </div>
            </div>
          )}
          {facets.asns.length > 0 && (
            <div>
              <p className="mb-1 text-[9px] uppercase tracking-[0.15em] text-muted-foreground/40">Network</p>
              <div className="flex flex-wrap gap-1.5">
                {facets.asns.map(([a, c]) => (
                  <PillFilter key={a} label={a} count={c} active={filters.asn === a} onClick={() => toggle("asn", a)} />
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <PillFilter
              label="Anomalies only" count={facets.anomalies}
              active={!!filters.onlyAnomalies} onClick={() => toggle("onlyAnomalies", filters.onlyAnomalies ? undefined : true)}
            />
            <PillFilter
              label="Retained bodies only" count={facets.buffered}
              active={!!filters.onlyBuffer} onClick={() => toggle("onlyBuffer", filters.onlyBuffer ? undefined : true)}
            />
          </div>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {shown.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground/50">
            Nothing matches these filters. Clear one and the corpus returns.
          </p>
        )}
        {shown.map((r) => (
          <article key={r.id} className="group">
            <div className="mb-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/45">
              {r.source === "buffer"
                ? <Archive className="h-3 w-3 text-foreground/60" />
                : <Globe className={`h-3 w-3 ${r.source === "lead" ? "opacity-45" : ""}`} />}
              <span className="truncate font-mono">{r.url}</span>
            </div>
            {/*
              A lead was surfaced but not opened, so there is no shell to show.
              Sending it to a record panel that does not exist would be a dead
              click; it opens the target itself instead.
            */}
            {r.source === "lead" ? (
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="block w-full text-left"
              >
                <h3 className="text-[15px] font-light text-foreground/85 underline-offset-4 group-hover:underline">
                  {r.title}
                </h3>
              </a>
            ) : (
              <button
                onClick={() => (r.source === "buffer" && r.session_id
                  ? openPayload(r.session_id)
                  : r.entity_id && onOpenRecord(r.entity_id))}
                className="block w-full text-left"
              >
                <h3 className="flex items-center gap-2 text-[15px] font-light text-foreground/90 underline-offset-4 group-hover:underline">
                  {r.title}
                  {opening === r.session_id && <Loader2 className="h-3 w-3 animate-spin" />}
                </h3>
              </button>
            )}
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground/70">{r.snippet}</p>

            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {r.badges.map((b, i) => (
                <span
                  key={i}
                  className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9.5px] ${
                    /anomal/.test(b)
                      ? "border-foreground/35 text-foreground/90"
                      : "border-border/15 text-muted-foreground/55"
                  }`}
                >
                  {/anomal/.test(b) && <AlertTriangle className="h-2.5 w-2.5" />}
                  {b}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>

      {/* ── Related searches ─────────────────────────────────────────── */}
      {suggestions.length > 0 && (
        <div className="mt-8 border-t border-border/10 pt-4">
          <p className="mb-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/40">Related searches</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onSuggest(s)}
                className="rounded-md border border-border/15 px-2.5 py-1 font-mono text-[10.5px] text-muted-foreground/65 transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Payload drawer ───────────────────────────────────────────── */}
      {payload && (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/60 backdrop-blur-sm" onClick={() => setPayload(null)}>
          <div
            className="flex h-full w-full max-w-2xl flex-col border-l border-border/20 bg-card"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-start gap-3 border-b border-border/15 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-foreground/90">{payload.session.host}</p>
                <p className="truncate font-mono text-[10px] text-muted-foreground/45">{payload.session.url}</p>
                <p className="mt-1 text-[10px] text-muted-foreground/50">
                  {payload.session.source_type} · {Math.max(1, Math.round(payload.session.content_bytes / 1024))} KB
                  {payload.session.truncated && " · truncated"}
                  {payload.session.is_encrypted && " · high entropy"}
                </p>
              </div>
              {payload.download && (
                <a
                  href={payload.download}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex shrink-0 items-center gap-1 rounded border border-border/20 px-2 py-1 text-[10px] text-muted-foreground/70 hover:text-foreground"
                >
                  <Download className="h-3 w-3" /> Raw
                </a>
              )}
              <a
                href={payload.session.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded border border-border/20 p-1.5 text-muted-foreground/60 hover:text-foreground"
                aria-label="Open source"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
              <button onClick={() => setPayload(null)} className="shrink-0 rounded p-1.5 text-muted-foreground/60 hover:text-foreground" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </header>
            <pre className="flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[11px] leading-relaxed text-foreground/80">
              {payload.session.content_text || "No extractable text in this body."}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default GhostSearchResults;
