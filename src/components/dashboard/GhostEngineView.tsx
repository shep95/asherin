import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ghost, Loader2, ArrowRight, Fingerprint, AlertTriangle, Network, Clock, Layers, Download, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { exportJSON } from "@/lib/exportEngine";
import GhostRecordPanel from "./ghost/GhostRecordPanel";
import GhostGraph from "./ghost/GhostGraph";
import GhostBufferConsole from "./ghost/GhostBufferConsole";
import { SEVERITY_STYLE, type GhostRecord, type GhostResponse } from "./ghost/types";

type Tab = "records" | "entities" | "graph" | "timeline" | "anomalies" | "facets" | "buffer";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "records", label: "Shells", icon: Layers },
  { id: "entities", label: "Entities", icon: Fingerprint },
  { id: "graph", label: "Graph", icon: Network },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "anomalies", label: "Anomalies", icon: AlertTriangle },
  { id: "facets", label: "Facets", icon: Ghost },
  { id: "buffer", label: "Buffer", icon: Archive },
];

const CAPTURE_KEY = "ghost_engine_capture";


const RECENT_KEY = "ghost_engine_recent";

const fmt = (iso: string | null) => (iso ? iso.replace("T", " ").slice(0, 16) + "Z" : "—");

const GhostEngineView = () => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GhostResponse | null>(null);
  const [tab, setTab] = useState<Tab>("records");
  const [selected, setSelected] = useState<GhostRecord | null>(null);
  const [capture, setCapture] = useState<boolean>(() => localStorage.getItem(CAPTURE_KEY) === "1");
  const [bufferNonce, setBufferNonce] = useState(0);
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]").slice(0, 6); } catch { return []; }
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q || loading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 90_000);

    setLoading(true);
    setSelected(null);
    try {
      const { data: res, error } = await supabase.functions.invoke("ghost-engine", {
        body: { query: q, limit: 12, capture },
      });

      if (controller.signal.aborted) return;

      if (error) {
        const detail = "context" in error && error.context ? await error.context.text().catch(() => "") : "";
        const denied = /403|Pro/.test(detail) || /403/.test(error.message);
        toast({
          title: denied ? "Ghost Engine is an Asherin Pro surface" : "Sweep failed",
          description: denied
            ? "Metadata-only indexing is included with the $399 plan and its 6-month term."
            : detail.slice(0, 240) || error.message,
          variant: "destructive",
        });
        return;
      }

      const payload = res as GhostResponse;
      setData(payload);
      setTab(payload.index?.anomalies.length ? "anomalies" : "records");
      if (payload.error) toast({ title: "No targets resolved", description: payload.error });

      // A capture that silently kept nothing is worse than no capture at all —
      // say what landed on the shelf, and refresh the console so its count is
      // never stale behind the sweep that produced it.
      if (payload.buffer) {
        setBufferNonce((n) => n + 1);
        toast({
          title: payload.buffer.captured
            ? `${payload.buffer.captured} session${payload.buffer.captured === 1 ? "" : "s"} buffered`
            : "Nothing retained",
          description: payload.buffer.captured
            ? `Bodies are searchable for ~${payload.buffer.ttlMinutes} minutes, then destroyed.`
            : payload.buffer.errors[0] || "No target returned a retainable body.",
        });
      }

      setRecent((prev) => {
        const next = [q, ...prev.filter((r) => r !== q)].slice(0, 6);
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
        return next;
      });
    } catch (e) {
      if (!controller.signal.aborted) {
        toast({ title: "Sweep failed", description: (e as Error).message, variant: "destructive" });
      } else {
        toast({ title: "Sweep timed out", description: "The probe exceeded 90 seconds.", variant: "destructive" });
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [loading, capture]);


  const index = data?.index ?? null;
  const recordById = useMemo(
    () => new Map((index?.records ?? []).map((r) => [r.entity_id, r])),
    [index],
  );

  const counts = useMemo(() => ({
    records: index?.records.length ?? 0,
    entities: index?.cards.length ?? 0,
    graph: index?.graph.nodes.length ?? 0,
    timeline: index?.timeline.length ?? 0,
    anomalies: index?.anomalies.length ?? 0,
    facets: index?.facets.length ?? 0,
    // The buffer's size is owned by the buffer console, which polls it live.
    // Showing a stale sweep-time number next to a self-expiring shelf would lie.
    buffer: undefined,
  }), [index]) as Record<Tab, number | undefined>;


  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Command bar ─────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-border/15 px-5 py-4">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 flex items-center gap-2">
            <Ghost className="h-4 w-4 text-foreground/70" />
            <h1 className="text-sm font-normal tracking-wide text-foreground">Asherin Ghost Engine</h1>
            <span className="rounded border border-border/25 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.15em] text-muted-foreground/50">
              Metadata only
            </span>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); run(query); }}
            className="flex items-center gap-2 rounded-xl border border-border/20 bg-foreground/[0.03] px-3 py-2 focus-within:border-foreground/30"
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Target a domain, URL, or describe a corpus to sweep…"
              aria-label="Ghost Engine query"
              className="flex-1 bg-transparent text-sm font-light text-foreground outline-none placeholder:text-muted-foreground/35"
            />
            <button
              type="button"
              role="switch"
              aria-checked={capture}
              onClick={() => setCapture((c) => { localStorage.setItem(CAPTURE_KEY, c ? "0" : "1"); return !c; })}
              title="Retain each session body in a self-expiring buffer so it can be reopened and searched"
              className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors ${
                capture
                  ? "border-foreground/40 bg-foreground/8 text-foreground"
                  : "border-border/25 text-muted-foreground/60 hover:text-foreground/80"
              }`}
            >
              <Archive className="h-3.5 w-3.5" />
              Retain bodies
            </button>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex items-center gap-1.5 rounded-lg border border-border/25 px-3 py-1.5 text-xs text-foreground/80 transition-colors hover:bg-foreground/5 disabled:opacity-35"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
              {loading ? "Probing" : "Sweep"}
            </button>
          </form>


          {!data && recent.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recent.map((r) => (
                <button
                  key={r}
                  onClick={() => { setQuery(r); run(r); }}
                  className="rounded-md border border-border/15 px-2 py-1 text-[10px] text-muted-foreground/60 transition-colors hover:text-foreground"
                >
                  {r}
                </button>
              ))}
            </div>
          )}

          {index && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground/50">
              <span>{data?.mode === "target" ? "Direct probe" : "Discovery sweep"}</span>
              <span>{index.coverage.indexed} shells</span>
              <span>{index.coverage.withContainer} with container metadata</span>
              <span>{index.coverage.withGeo} geotagged</span>
              <span>{index.coverage.failed} unreachable</span>
              <span>{data?.elapsedMs} ms</span>
              <button
                onClick={() => exportJSON(
                  `ghost-sweep-${Date.now()}`,
                  index.records.map((r) => ({
                    title: r.host || r.url,
                    url: r.url,
                    snippet: `${r.status ?? "unreachable"} · ${r.source_type}`,
                    metadata: r as unknown as Record<string, unknown>,
                  })),
                  { query: data?.query, mode: data?.mode, coverage: index.coverage },
                )}
                className="ml-auto flex items-center gap-1 rounded border border-border/20 px-2 py-1 transition-colors hover:text-foreground"
              >
                <Download className="h-3 w-3" /> Export shells
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto max-w-4xl">
          {!data && !loading && (
            <div className="mt-16 text-center">
              <Ghost className="mx-auto mb-4 h-8 w-8 text-foreground/20" />
              <p className="text-sm font-light text-muted-foreground/70">It touches everything and reads nothing.</p>
              <p className="mx-auto mt-3 max-w-lg text-xs leading-relaxed text-muted-foreground/45">
                The Ghost Engine indexes the shell around information — transport headers, DNS and ASN posture,
                redirect topology, EXIF capture fields, document producers, timestamps — and never the content
                itself. Three indexes are built over every sweep: inverted facets, a shared-dimension graph, and
                a phonetic identity fold that survives spelling drift.
              </p>
            </div>
          )}

          {loading && !data && (
            <div className="space-y-2" aria-live="polite">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg border border-border/10 bg-foreground/[0.02]" />
              ))}
            </div>
          )}

          {index && (
            <>
              <div className="mb-4 flex flex-wrap gap-1 border-b border-border/10 pb-2">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    aria-current={tab === id}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] transition-colors ${
                      tab === id ? "bg-foreground/8 text-foreground" : "text-muted-foreground/55 hover:text-foreground/80"
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {label}
                    <span className="text-muted-foreground/35">{counts[id]}</span>
                  </button>
                ))}
              </div>

              {tab === "records" && (
                <div className="space-y-2">
                  {index.records.map((r) => (
                    <button
                      key={r.entity_id}
                      onClick={() => setSelected(r)}
                      className="w-full rounded-lg border border-border/12 bg-foreground/[0.015] px-3 py-2.5 text-left transition-colors hover:border-foreground/25"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-xs text-foreground/90">{r.host || r.url}</span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground/40">
                          {r.status ?? "×"} · {r.response_ms ?? "?"}ms
                        </span>
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground/40">{r.url}</p>
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground/55">
                        <span>{r.source_type}</span>
                        {r.server && <span>{r.server}</span>}
                        {r.asn && <span>{r.asn}</span>}
                        {r.author && <span>author: {r.author}</span>}
                        {r.device_id && <span>device: {r.device_id}</span>}
                        {r.created_at && <span>created {fmt(r.created_at)}</span>}
                        {r.geo_source === "exif" && <span className="text-foreground/80">EXIF GPS</span>}
                        {!r.tls && <span className="text-foreground/80">no TLS</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {tab === "entities" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {index.cards.length === 0 && <p className="text-xs text-muted-foreground/45">No repeating identity dimension surfaced in this corpus.</p>}
                  {index.cards.map((c) => (
                    <div key={`${c.kind}:${c.key}`} className="rounded-lg border border-border/12 bg-foreground/[0.015] p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-xs text-foreground/90">{c.key}</span>
                        <span className="shrink-0 text-[9px] uppercase tracking-wider text-muted-foreground/45">{c.kind}</span>
                      </div>
                      <div className="mt-2 space-y-0.5 text-[10px] text-muted-foreground/60">
                        <p>{c.documents} document{c.documents === 1 ? "" : "s"} · first {fmt(c.first_seen)} · last {fmt(c.last_seen)}</p>
                        {c.activity_window && <p>Activity band: {c.activity_window}</p>}
                        {c.devices.length > 0 && <p>Devices: {c.devices.join(", ")}</p>}
                        {c.software.length > 0 && <p>Software: {c.software.join(", ")}</p>}
                        {c.geo_clusters.length > 0 && (
                          <p>Geo clusters: {c.geo_clusters.map((g) => g.label || `${g.lat.toFixed(2)},${g.lng.toFixed(2)}`).join(" · ")}</p>
                        )}
                        {c.hosts.length > 0 && <p className="truncate">Hosts: {c.hosts.join(", ")}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "graph" && (
                <div className="rounded-lg border border-border/12 bg-foreground/[0.015] p-3">
                  <GhostGraph
                    nodes={index.graph.nodes}
                    edges={index.graph.edges}
                    onSelect={(n) => { const r = recordById.get(n.id); if (r) setSelected(r); }}
                  />
                  {index.keystones.length > 0 && (
                    <div className="mt-3 border-t border-border/10 pt-3">
                      <p className="mb-1.5 text-[10px] uppercase tracking-[0.15em] text-muted-foreground/45">Keystone dimensions</p>
                      <div className="flex flex-wrap gap-1.5">
                        {index.keystones.map((k) => (
                          <span key={k.id} className="rounded border border-border/20 px-2 py-0.5 text-[10px] text-foreground/75">
                            {k.kind}: {k.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === "timeline" && (
                <ol className="relative space-y-2 border-l border-border/15 pl-4">
                  {index.timeline.length === 0 && <p className="text-xs text-muted-foreground/45">No timestamps survived publication in this corpus.</p>}
                  {index.timeline.map((e, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[21px] top-2 h-1.5 w-1.5 rounded-full bg-foreground/45" />
                      <button
                        onClick={() => { const r = recordById.get(e.entity_id); if (r) setSelected(r); }}
                        className="w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-foreground/5"
                      >
                        <span className="font-mono text-[10px] text-muted-foreground/50">{fmt(e.at)}</span>
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground/40">{e.kind}</span>
                        <p className="truncate text-xs text-foreground/85">{e.label}</p>
                        <p className="truncate text-[10px] text-muted-foreground/40">{e.host}</p>
                      </button>
                    </li>
                  ))}
                </ol>
              )}

              {tab === "anomalies" && (
                <div className="space-y-2">
                  {index.anomalies.length === 0 && (
                    <p className="text-xs text-muted-foreground/45">
                      No contradictions in the shell. Absence of anomalies is not absence of activity — it usually means the
                      publisher strips metadata on upload.
                    </p>
                  )}
                  {index.anomalies.map((a, i) => (
                    <button
                      key={i}
                      onClick={() => { const r = a.entity_id ? recordById.get(a.entity_id) : null; if (r) setSelected(r); }}
                      className={`w-full rounded-lg border-l-2 border-y border-r border-y-border/10 border-r-border/10 bg-foreground/[0.015] px-3 py-2 text-left transition-colors hover:bg-foreground/[0.04] ${SEVERITY_STYLE[a.severity]}`}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/45">{a.severity}</span>
                        <span className="text-xs">{a.title}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/65">{a.detail}</p>
                    </button>
                  ))}
                </div>
              )}

              {tab === "facets" && (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {index.facets.map((f) => (
                    <div key={`${f.field}:${f.value}`} className="flex items-baseline justify-between gap-3 rounded-md border border-border/10 px-2.5 py-1.5">
                      <div className="min-w-0">
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/40">{f.field}</span>
                        <p className="truncate font-mono text-[11px] text-foreground/80">{f.value}</p>
                      </div>
                      <span className="shrink-0 text-[11px] text-muted-foreground/50">{f.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selected && <GhostRecordPanel record={selected} onClose={() => setSelected(null)} />}
    </div>
  );
};

export default GhostEngineView;
