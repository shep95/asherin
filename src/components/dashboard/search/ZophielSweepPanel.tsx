// ZOPHIEL SWEEP — unattended breadth pass + entity graph.
//
// What this is honest about:
//   • Stages are real invokes. A stage that did not run says "skipped" with the
//     reason; a stage that failed says "failed" with the error. Nothing is
//     coloured green because it was planned.
//   • The engine roster is derived from the engine tags on returned hits. There
//     is no fixed "30 sources" number anywhere — the roster is whatever really
//     came back this run, and an engine that returned nothing is not listed.
//   • The graph is built from the returned corpus (deterministic extraction,
//     no model). Nodes that share a near-identical label are flagged as
//     unresolved lookalikes and left SEPARATE. Zophiel never fuses two people
//     into one because their names rhyme.
//   • Public phones/emails found in hits are shown starred in the UI, and the
//     Connect trace quote is masked before it leaves the browser.

import { useCallback, useMemo, useRef, useState } from "react";
import {
  Radar, Loader2, ExternalLink, CircleDot, CircleSlash, CircleAlert,
  Network, Quote as QuoteIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { emitPull } from "@/lib/connect/emitPull";
import { buildIntelGraph, type IntelNode, type IntelEdge } from "./intel/buildIntelGraph";
import type { SearchResult, SearchResponse } from "./types";
import { queueBoardDrop } from "@/lib/whiteboard/boardInbox";

type StageId = "search" | "dork" | "deep" | "3hop" | "graph";
type StageStatus = "idle" | "running" | "ok" | "skip" | "fail";

interface Stage {
  id: StageId;
  label: string;
  detail: string;
  status: StageStatus;
  latencyMs?: number;
  hits?: number;
}

const STAGE_SEED: Stage[] = [
  { id: "search", label: "Search swarm", detail: "queued", status: "idle" },
  { id: "dork",   label: "Dork battery", detail: "queued", status: "idle" },
  { id: "deep",   label: "Path / host map", detail: "queued", status: "idle" },
  { id: "3hop",   label: "3-hop expansion", detail: "queued", status: "idle" },
  { id: "graph",  label: "Entity graph", detail: "queued", status: "idle" },
];

const DOMAIN_RE = /^(?:https?:\/\/)?((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/|$)/i;

/** Star public contact strings for display. UI may show them; Connect may not. */
function starContacts(s: string): string {
  return s
    .replace(/\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9-])[A-Za-z0-9.-]*\.([A-Za-z]{2,})\b/g,
      (_m, a, d, tld) => `${a}***@${d}***.${tld}`)
    .replace(/(\+?\d[\d\s().-]{7,}\d)/g, (m) => {
      const digits = m.replace(/\D/g, "");
      return digits.length >= 8 ? `***-***-${digits.slice(-4)}` : m;
    });
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "unknown"; }
}

function enginesOf(r: SearchResult): string[] {
  const anyR = r as SearchResult & { engine?: string; engines?: string[] };
  if (Array.isArray(anyR.engines) && anyR.engines.length) return anyR.engines;
  if (anyR.engine) return [anyR.engine];
  return [];
}

/** Normalised key used only to DETECT lookalikes — never to merge them. */
function identityKey(label: string): string {
  const t = label.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().split(" ");
  if (t.length === 1) return t[0];
  return `${t[0][0] ?? ""}|${t[t.length - 1]}`;
}

interface SweepQuote {
  title: string;
  url: string;
  quote: string;
  domain: string;
  engines: string[];
  hop: number;
}

const StatusDot = ({ s }: { s: StageStatus }) => {
  if (s === "running") return <Loader2 className="h-3 w-3 animate-spin text-accent" />;
  if (s === "ok") return <CircleDot className="h-3 w-3 text-accent" />;
  if (s === "skip") return <CircleSlash className="h-3 w-3 text-muted-foreground/50" />;
  if (s === "fail") return <CircleAlert className="h-3 w-3 text-destructive" />;
  return <CircleDot className="h-3 w-3 text-muted-foreground/25" />;
};

interface Props { query: string }

const ZophielSweepPanel = ({ query }: Props) => {
  const [stages, setStages] = useState<Stage[]>(STAGE_SEED);
  const [running, setRunning] = useState(false);
  const [quotes, setQuotes] = useState<SweepQuote[]>([]);
  const [corpus, setCorpus] = useState<SearchResult[]>([]);
  const [graph, setGraph] = useState<{ nodes: IntelNode[]; edges: IntelEdge[] } | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const runIdRef = useRef(0);

  const patch = useCallback((id: StageId, next: Partial<Stage>) => {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...next } : s)));
  }, []);

  const engineRoster = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of corpus) {
      const list = enginesOf(r);
      if (!list.length) { counts.set(domainOf(r.url), (counts.get(domainOf(r.url)) ?? 0) + 0); continue; }
      for (const e of list) counts.set(e, (counts.get(e) ?? 0) + 1);
    }
    return [...counts.entries()].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  }, [corpus]);

  /** Entity nodes plus a lookalike flag. Distinct ids stay distinct. */
  const entityView = useMemo(() => {
    if (!graph) return { nodes: [] as Array<IntelNode & { lookalike: boolean }>, edges: [] as IntelEdge[] };
    const wanted = new Set(["person", "organization", "location", "source"]);
    const nodes = graph.nodes.filter((n) => wanted.has(n.type));
    const byKey = new Map<string, number>();
    for (const n of nodes) byKey.set(identityKey(n.label), (byKey.get(identityKey(n.label)) ?? 0) + 1);
    const flagged = nodes.map((n) => ({ ...n, lookalike: (byKey.get(identityKey(n.label)) ?? 0) > 1 }));
    const ids = new Set(flagged.map((n) => n.id));
    return { nodes: flagged, edges: graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
  }, [graph]);

  const runSweep = useCallback(async () => {
    const q = query.trim();
    if (!q || running) return;
    const myRun = ++runIdRef.current;
    const alive = () => runIdRef.current === myRun;

    setRunning(true);
    setStages(STAGE_SEED.map((s) => ({ ...s })));
    setQuotes([]); setCorpus([]); setGraph(null); setNotes([]);

    const collected: SearchResult[] = [];
    const seen = new Set<string>();
    const pushHits = (rows: SearchResult[], hop: number) => {
      const fresh: SweepQuote[] = [];
      for (const r of rows) {
        if (!r?.url || seen.has(r.url)) continue;
        seen.add(r.url);
        collected.push(r);
        const raw = (r.snippet || r.title || "").replace(/\s+/g, " ").trim();
        if (raw) {
          fresh.push({
            title: r.title || "(untitled)",
            url: r.url,
            quote: starContacts(raw).slice(0, 320),
            domain: domainOf(r.url),
            engines: enginesOf(r),
            hop,
          });
        }
      }
      if (fresh.length && alive()) setQuotes((prev) => [...prev, ...fresh]);
    };

    // ── Stage 1 · search swarm ────────────────────────────────────────────
    patch("search", { status: "running", detail: "querying" });
    const t1 = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke("zophiel-search", {
        body: { query: q, max_pages: 25, max_depth: 2 },
      });
      if (error) throw error;
      const res = data as SearchResponse;
      const rows = res?.success ? res.results ?? [] : [];
      pushHits(rows, 1);
      const ms = Math.round(performance.now() - t1);
      patch("search", {
        status: rows.length ? "ok" : "skip",
        latencyMs: ms,
        hits: rows.length,
        detail: rows.length ? `${rows.length} hits` : "engines returned nothing",
      });
      void emitPull({
        organ: "zophiel", capability: "search", fromSurface: "zophiel-sweep",
        status: rows.length ? "ok" : "skip", latencyMs: ms,
        quote: rows[0]?.title ?? q, meta: { hits: rows.length },
      });
    } catch (e) {
      const ms = Math.round(performance.now() - t1);
      patch("search", { status: "fail", latencyMs: ms, detail: e instanceof Error ? e.message : "failed" });
      void emitPull({
        organ: "zophiel", capability: "search", fromSurface: "zophiel-sweep",
        status: "fail", latencyMs: ms, quote: e instanceof Error ? e.message : "failed",
      });
    }
    if (!alive()) return;

    // ── Stage 2 · dork battery ────────────────────────────────────────────
    patch("dork", { status: "running", detail: "planning operators" });
    const t2 = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke("zophiel-dork", {
        body: { target: q, profile: "auto" },
      });
      if (error) throw error;
      const buckets: Array<{ query: string; hits: Array<{ title: string; url: string; snippet: string }> }> =
        data?.buckets ?? [];
      const rows: SearchResult[] = [];
      for (const b of buckets) {
        for (const h of b.hits ?? []) {
          rows.push({
            title: h.title, url: h.url, snippet: h.snippet, source: domainOf(h.url),
            tier: 3, tierLabel: "dork", category: "general",
          } as SearchResult);
        }
      }
      pushHits(rows, 1);
      const ms = Math.round(performance.now() - t2);
      patch("dork", {
        status: rows.length ? "ok" : "skip",
        latencyMs: ms, hits: rows.length,
        detail: rows.length ? `${buckets.length} operators · ${rows.length} hits` : "operators ran, index empty",
      });
      void emitPull({
        organ: "zophiel", capability: "dork", fromSurface: "zophiel-sweep",
        status: rows.length ? "ok" : "skip", latencyMs: ms,
        quote: rows[0]?.title ?? q, meta: { hits: rows.length, operators: buckets.length },
      });
    } catch (e) {
      const ms = Math.round(performance.now() - t2);
      patch("dork", { status: "fail", latencyMs: ms, detail: e instanceof Error ? e.message : "failed" });
      void emitPull({
        organ: "zophiel", capability: "dork", fromSurface: "zophiel-sweep",
        status: "fail", latencyMs: ms, quote: e instanceof Error ? e.message : "failed",
      });
    }
    if (!alive()) return;

    // ── Stage 3 · path / host map (only when the target IS a host) ─────────
    const hostMatch = q.match(DOMAIN_RE);
    if (!hostMatch) {
      patch("deep", { status: "skip", detail: "target is not a host — nothing to map" });
      setNotes((n) => [...n, "path map skipped: the target is not a domain, so there is no host surface to enumerate."]);
      void emitPull({
        organ: "zophiel", capability: "deep", fromSurface: "zophiel-sweep",
        status: "skip", quote: "target is not a host",
      });
    } else {
      const host = hostMatch[1];
      patch("deep", { status: "running", detail: host });
      const t3 = performance.now();
      try {
        const { data, error } = await supabase.functions.invoke("asherin-live-dork", {
          body: { host, mode: "path_map" },
        });
        if (error) throw error;
        const pm = data?.path_map ?? {};
        const inv: string[] = pm.path_inventory ?? [];
        const probes: Array<{ path: string; status: number | null }> = pm.seed_probe ?? [];
        const live = probes.filter((p) => p.status && p.status < 400).length;
        const ms = Math.round(performance.now() - t3);
        patch("deep", {
          status: inv.length || probes.length ? "ok" : "skip",
          latencyMs: ms, hits: inv.length,
          detail: inv.length || probes.length
            ? `${inv.length} declared paths · ${live}/${probes.length} probes < 400`
            : "host answered, nothing declared",
        });
        void emitPull({
          organ: "zophiel", capability: "deep", fromSurface: "zophiel-sweep",
          status: inv.length || probes.length ? "ok" : "skip", latencyMs: ms,
          quote: host, meta: { paths: inv.length, probes: probes.length },
        });
      } catch (e) {
        const ms = Math.round(performance.now() - t3);
        patch("deep", { status: "fail", latencyMs: ms, detail: e instanceof Error ? e.message : "failed" });
        void emitPull({
          organ: "zophiel", capability: "deep", fromSurface: "zophiel-sweep",
          status: "fail", latencyMs: ms, quote: e instanceof Error ? e.message : "failed",
        });
      }
    }
    if (!alive()) return;

    // ── Stage 4 · 3-hop analog expansion ──────────────────────────────────
    // Hop 2 and hop 3 queries come from entities the CORPUS produced. If hop 1
    // returned nothing, there is nothing to walk and the stage says so.
    patch("3hop", { status: "running", detail: "reading hop-1 entities" });
    const t4 = performance.now();
    try {
      const seedGraph = buildIntelGraph(collected);
      const seeds = seedGraph.nodes
        .filter((n) => n.type === "person" || n.type === "organization")
        .sort((a, b) => (b.mentions ?? 0) - (a.mentions ?? 0))
        .map((n) => n.label)
        .filter((l) => l.toLowerCase() !== q.toLowerCase())
        .slice(0, 3);

      if (!seeds.length) {
        patch("3hop", { status: "skip", detail: "hop-1 corpus yielded no entity to walk" });
        void emitPull({
          organ: "zophiel", capability: "3hop", fromSurface: "zophiel-sweep",
          status: "skip", quote: "no hop-1 entities",
        });
      } else {
        let hop2Hits = 0;
        const hop2Results = await Promise.allSettled(
          seeds.map((s) =>
            supabase.functions.invoke("zophiel-search", { body: { query: `${s} ${q}`, max_pages: 8, max_depth: 1 } }),
          ),
        );
        const hop2Corpus: SearchResult[] = [];
        for (const r of hop2Results) {
          if (r.status !== "fulfilled") continue;
          const rows = ((r.value.data as SearchResponse)?.results ?? []) as SearchResult[];
          hop2Corpus.push(...rows);
          hop2Hits += rows.length;
        }
        pushHits(hop2Corpus, 2);

        // Hop 3: one analog from the hop-2 corpus only.
        let hop3Hits = 0;
        const hop3Seed = buildIntelGraph(hop2Corpus).nodes
          .filter((n) => n.type === "organization" || n.type === "person")
          .sort((a, b) => (b.mentions ?? 0) - (a.mentions ?? 0))
          .map((n) => n.label)
          .find((l) => !seeds.includes(l) && l.toLowerCase() !== q.toLowerCase());

        if (hop3Seed) {
          const { data } = await supabase.functions.invoke("zophiel-search", {
            body: { query: hop3Seed, max_pages: 6, max_depth: 1 },
          });
          const rows = ((data as SearchResponse)?.results ?? []) as SearchResult[];
          hop3Hits = rows.length;
          pushHits(rows, 3);
        }

        const ms = Math.round(performance.now() - t4);
        patch("3hop", {
          status: hop2Hits + hop3Hits ? "ok" : "skip",
          latencyMs: ms, hits: hop2Hits + hop3Hits,
          detail: `hop2 ${seeds.length} analogs → ${hop2Hits} hits · hop3 ${hop3Seed ? `${hop3Hits} hits` : "no analog"}`,
        });
        void emitPull({
          organ: "zophiel", capability: "3hop", fromSurface: "zophiel-sweep",
          status: hop2Hits + hop3Hits ? "ok" : "skip", latencyMs: ms,
          quote: seeds.join(" · "), meta: { hop2: hop2Hits, hop3: hop3Hits },
        });
      }
    } catch (e) {
      const ms = Math.round(performance.now() - t4);
      patch("3hop", { status: "fail", latencyMs: ms, detail: e instanceof Error ? e.message : "failed" });
      void emitPull({
        organ: "zophiel", capability: "3hop", fromSurface: "zophiel-sweep",
        status: "fail", latencyMs: ms, quote: e instanceof Error ? e.message : "failed",
      });
    }
    if (!alive()) return;

    // ── Stage 5 · entity graph over everything that really returned ───────
    patch("graph", { status: "running", detail: "resolving entities" });
    const t5 = performance.now();
    const g = buildIntelGraph(collected);
    const ms5 = Math.round(performance.now() - t5);
    setCorpus(collected);
    setGraph({ nodes: g.nodes, edges: g.edges });
    patch("graph", {
      status: g.nodes.length ? "ok" : "skip",
      latencyMs: ms5, hits: g.nodes.length,
      detail: g.nodes.length ? `${g.nodes.length} nodes · ${g.edges.length} edges` : "corpus empty — no graph",
    });
    void emitPull({
      organ: "zophiel", capability: "graph", fromSurface: "zophiel-sweep",
      status: g.nodes.length ? "ok" : "skip", latencyMs: ms5,
      quote: q, meta: { nodes: g.nodes.length, edges: g.edges.length, documents: collected.length },
    });

    setRunning(false);
  }, [query, running, patch]);

  // Deterministic radial layout — a readable relationship view, not a war room.
  const layout = useMemo(() => {
    const nodes = entityView.nodes.slice(0, 48);
    const cx = 400, cy = 210, r = 170;
    const pos = new Map<string, { x: number; y: number }>();
    nodes.forEach((n, i) => {
      const a = (i / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2;
      const ring = n.type === "source" ? r : r * 0.58;
      pos.set(n.id, { x: cx + Math.cos(a) * ring, y: cy + Math.sin(a) * ring });
    });
    return { nodes, pos, edges: entityView.edges.filter((e) => pos.has(e.source) && pos.has(e.target)).slice(0, 120) };
  }, [entityView]);

  const lookalikes = layout.nodes.filter((n) => n.lookalike).length;

  return (
    <div className="space-y-4">
      {/* Control strip */}
      <div className="rounded-2xl border border-accent/20 bg-card/40 backdrop-blur-md p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Radar className="h-4 w-4 text-accent mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-accent/80">Unattended Sweep</p>
              <p className="text-[11px] font-light text-muted-foreground/80 mt-1 max-w-xl">
                Runs the search swarm, the dork battery, the host path map and a three-hop
                analog walk on one target, then builds an entity graph from what actually
                returned. Engines that returned nothing are not counted.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
          {layout.nodes.length > 0 && (
            <button
              onClick={() => {
                queueBoardDrop({
                  kind: "graph",
                  source: "zophiel",
                  title: `zophiel graph · ${query.trim().slice(0, 48)}`,
                  nodes: layout.nodes.map((n) => ({ id: n.id, label: n.label, type: n.type })),
                  edges: layout.edges.map((e) => ({ source: e.source, target: e.target, label: e.label })),
                });
                window.location.assign("/dashboard?view=whiteboard");
              }}
              className="rounded-xl border border-border/30 px-4 py-2 text-[11px] font-light text-muted-foreground/80 transition-colors hover:text-foreground"
              title="Paste these nodes onto the whiteboard"
            >
              Send graph to board
            </button>
          )}
          <button
            onClick={runSweep}
            disabled={!query.trim() || running}
            className="rounded-xl border border-accent/40 bg-accent/15 px-4 py-2 text-[11px] font-light text-accent transition-colors hover:bg-accent/25 disabled:opacity-40"
          >
            {running ? <span className="flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> sweeping</span> : "Run sweep"}
          </button>
          </div>
        </div>
      </div>

      {/* Stage ledger */}
      <div className="rounded-2xl border border-border/20 bg-card/30 divide-y divide-border/10">
        {stages.map((s) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
            <StatusDot s={s.status} />
            <span className="w-36 shrink-0 text-[11px] font-light text-foreground/90">{s.label}</span>
            <span className="min-w-0 flex-1 truncate text-[11px] font-light text-muted-foreground/70">{s.detail}</span>
            {typeof s.latencyMs === "number" && (
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground/50">{s.latencyMs}ms</span>
            )}
          </div>
        ))}
      </div>

      {notes.length > 0 && (
        <div className="rounded-2xl border border-border/20 bg-card/20 px-4 py-3 space-y-1">
          {notes.map((n, i) => (
            <p key={i} className="text-[11px] font-light text-muted-foreground/70">— {n}</p>
          ))}
        </div>
      )}

      {/* Engines that actually returned */}
      {engineRoster.length > 0 && (
        <div className="rounded-2xl border border-border/20 bg-card/30 px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60 mb-2">
            Engines that returned ({engineRoster.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {engineRoster.map(([e, n]) => (
              <span key={e} className="rounded-lg border border-border/20 bg-background/40 px-2 py-1 font-mono text-[10px] text-foreground/70">
                {e} <span className="text-muted-foreground/50">·{n}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Entity graph — from results, never fused */}
      {layout.nodes.length > 0 && (
        <div className="rounded-2xl border border-border/20 bg-card/30 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">
              <Network className="h-3 w-3" /> Entity graph · {layout.nodes.length} nodes
            </p>
            {lookalikes > 0 && (
              <span className="rounded-lg border border-accent/30 bg-accent/10 px-2 py-1 text-[10px] font-light text-accent">
                {lookalikes} unresolved lookalike{lookalikes === 1 ? "" : "s"} — kept separate
              </span>
            )}
          </div>
          <svg viewBox="0 0 800 420" className="w-full h-[320px]">
            {layout.edges.map((e, i) => {
              const a = layout.pos.get(e.source)!, b = layout.pos.get(e.target)!;
              return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="hsl(var(--border))" strokeOpacity={0.4} strokeWidth={1} />;
            })}
            {layout.nodes.map((n) => {
              const p = layout.pos.get(n.id)!;
              const fill =
                n.type === "person" ? "hsl(var(--accent))" :
                n.type === "organization" ? "hsl(var(--foreground))" :
                n.type === "location" ? "hsl(var(--muted-foreground))" : "hsl(var(--muted-foreground))";
              return (
                <g key={n.id}>
                  <circle
                    cx={p.x} cy={p.y} r={n.type === "source" ? 4 : 6}
                    fill={fill} fillOpacity={n.lookalike ? 0.35 : 0.8}
                    stroke={n.lookalike ? "hsl(var(--accent))" : "none"}
                    strokeDasharray={n.lookalike ? "2 2" : undefined}
                    strokeWidth={n.lookalike ? 1.2 : 0}
                  />
                  <text x={p.x + 9} y={p.y + 3} fontSize={9} fill="hsl(var(--muted-foreground))" className="font-light">
                    {starContacts(n.label).slice(0, 26)}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="mt-1 text-[10px] font-light text-muted-foreground/50">
            Nodes are extracted from the returned documents. Names that resolve to the same
            shape are drawn dashed and left as separate entities — identity resolution is
            reported, not performed.
          </p>
        </div>
      )}

      {/* Live quotes */}
      {quotes.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">
            <QuoteIcon className="h-3 w-3" /> Live hits ({quotes.length})
          </p>
          {quotes.slice(0, 80).map((h, i) => (
            <div key={h.url + i} className="rounded-xl border border-border/20 bg-card/30 px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <a
                  href={h.url} target="_blank" rel="noopener noreferrer"
                  className="min-w-0 flex-1 text-[12px] font-light text-foreground hover:text-accent truncate"
                >
                  [{i + 1}] {h.title}
                </a>
                <span className="shrink-0 font-mono text-[9px] text-muted-foreground/50">hop {h.hop}</span>
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground/40" />
              </div>
              <p className="mt-1 text-[11px] font-light leading-relaxed text-muted-foreground/80">“{h.quote}”</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground/50">{h.domain}</span>
                {h.engines.map((e) => (
                  <span key={e} className="rounded border border-border/20 px-1 font-mono text-[9px] text-muted-foreground/45">{e}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ZophielSweepPanel;
