import { useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2, Network, ZoomIn, ZoomOut, RotateCcw, ExternalLink, Users, Building2, MapPin, Tag, Calendar, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { SearchResult } from "./types";

interface IntelNode {
  id: string;
  label: string;
  type: "source" | "person" | "organization" | "location" | "topic" | "event";
  tier?: number;
  tierLabel?: string;
  url?: string;
  domain?: string;
  mentions?: number;
  context?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface IntelEdge {
  source: string;
  target: string;
  label: string;
  weight: number;
}

interface IntelMapPanelProps {
  query: string;
  results: SearchResult[];
  onClose: () => void;
}

/* Theme-matched monochrome palette using semantic tokens.
 * All nodes share the card/border aesthetic; type is differentiated by a subtle
 * accent stripe and the icon, not by saturated color. Selected state lights up. */
const NODE_PALETTE: Record<IntelNode["type"], { accent: string; label: string }> = {
  source:       { accent: "hsl(var(--accent))",            label: "Source" },
  person:       { accent: "hsl(265, 60%, 65%)",            label: "Person" },
  organization: { accent: "hsl(200, 55%, 60%)",            label: "Org" },
  location:     { accent: "hsl(160, 45%, 55%)",            label: "Place" },
  topic:        { accent: "hsl(40, 70%, 60%)",             label: "Topic" },
  event:        { accent: "hsl(0, 55%, 62%)",              label: "Event" },
};

const TYPE_ICON: Record<IntelNode["type"], typeof Globe> = {
  source: Globe,
  person: Users,
  organization: Building2,
  location: MapPin,
  topic: Tag,
  event: Calendar,
};

/* Rounded-square node sizing (width × height). Sources slightly larger. */
const NODE_SIZE: Record<IntelNode["type"], { w: number; h: number }> = {
  source:       { w: 64, h: 64 },
  person:       { w: 56, h: 56 },
  organization: { w: 60, h: 60 },
  location:     { w: 52, h: 52 },
  topic:        { w: 48, h: 48 },
  event:        { w: 52, h: 52 },
};
const NODE_RADIUS: Record<IntelNode["type"], number> = {
  source: 32, person: 28, organization: 30, location: 26, topic: 24, event: 26,
};

/* Force-directed layout (lightweight) */
function layoutNodes(nodes: IntelNode[], edges: IntelEdge[], width: number, height: number, iterations = 220): IntelNode[] {
  const cx = width / 2, cy = height / 2;
  const sources = nodes.filter((n) => n.type === "source");
  const others = nodes.filter((n) => n.type !== "source");

  // Init: sources around outer ring, entities clustered toward center
  sources.forEach((n, i) => {
    const a = (i / Math.max(1, sources.length)) * Math.PI * 2 - Math.PI / 2;
    n.x = cx + Math.cos(a) * Math.min(width, height) * 0.38;
    n.y = cy + Math.sin(a) * Math.min(width, height) * 0.38;
    n.vx = 0; n.vy = 0;
  });
  others.forEach((n, i) => {
    const a = (i / Math.max(1, others.length)) * Math.PI * 2;
    const r = 60 + (i % 5) * 35;
    n.x = cx + Math.cos(a) * r;
    n.y = cy + Math.sin(a) * r;
    n.vx = 0; n.vy = 0;
  });

  const idMap = new Map(nodes.map((n) => [n.id, n]));
  const k = 90;          // ideal edge length
  const repulsion = 4200;
  const damping = 0.85;

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = (b.x! - a.x!) || 0.01;
        const dy = (b.y! - a.y!) || 0.01;
        const dist2 = dx * dx + dy * dy;
        const force = repulsion / dist2;
        const dist = Math.sqrt(dist2);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx! -= fx; a.vy! -= fy;
        b.vx! += fx; b.vy! += fy;
      }
    }
    // Spring (edges)
    edges.forEach((e) => {
      const a = idMap.get(e.source); const b = idMap.get(e.target);
      if (!a || !b) return;
      const dx = b.x! - a.x!; const dy = b.y! - a.y!;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const force = (dist - k) * 0.08 * Math.max(0.5, e.weight);
      const fx = (dx / dist) * force; const fy = (dy / dist) * force;
      a.vx! += fx; a.vy! += fy;
      b.vx! -= fx; b.vy! -= fy;
    });
    // Centering
    nodes.forEach((n) => {
      n.vx! += (cx - n.x!) * 0.0025;
      n.vy! += (cy - n.y!) * 0.0025;
      n.vx! *= damping; n.vy! *= damping;
      n.x! += n.vx!; n.y! += n.vy!;
      // Bounds
      const r = NODE_RADIUS[n.type] + 4;
      n.x = Math.max(r, Math.min(width - r, n.x!));
      n.y = Math.max(r, Math.min(height - r, n.y!));
    });
  }

  return nodes;
}

const IntelMapPanel = ({ query, results, onClose }: IntelMapPanelProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<IntelNode[]>([]);
  const [edges, setEdges] = useState<IntelEdge[]>([]);
  const [scrapedCount, setScrapedCount] = useState(0);
  const [totalSources, setTotalSources] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, px: 0, py: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setSize({ w: Math.max(400, rect.width), h: Math.max(400, rect.height) });
      }
    };
    update();
    const obs = new ResizeObserver(update);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true); setError(null);
      try {
        const { data, error: err } = await supabase.functions.invoke("zophiel-intelmap", {
          body: {
            query,
            results: results.slice(0, 8).map((r) => ({
              title: r.title, url: r.url, snippet: r.snippet,
              source: r.source, tier: r.tier, tierLabel: r.tierLabel,
            })),
          },
        });
        if (cancelled) return;
        if (err) throw err;
        if (!data?.success) throw new Error(data?.error || "Failed to build intel map");
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
        setScrapedCount(data.scrapedCount || 0);
        setTotalSources(data.totalSources || 0);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Could not build intel map");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [query, results]);

  // Run layout when nodes/size change
  const laidOut = useMemo(() => {
    if (nodes.length === 0) return [];
    const cloned = nodes.map((n) => ({ ...n }));
    return layoutNodes(cloned, edges, size.w, size.h);
  }, [nodes, edges, size.w, size.h]);

  const idMap = useMemo(() => new Map(laidOut.map((n) => [n.id, n])), [laidOut]);
  const selected = selectedId ? idMap.get(selectedId) : null;

  // Connected nodes for highlight
  const connectedIds = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const set = new Set<string>([selectedId]);
    edges.forEach((e) => {
      if (e.source === selectedId) set.add(e.target);
      if (e.target === selectedId) set.add(e.source);
    });
    return set;
  }, [selectedId, edges]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.3, Math.min(3, z * delta)));
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("[data-node]")) return;
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, px: pan.x, py: pan.y });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: dragStart.px + (e.clientX - dragStart.x), y: dragStart.py + (e.clientY - dragStart.y) });
  };
  const onMouseUp = () => setDragging(false);

  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); setSelectedId(null); };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    laidOut.forEach((n) => { c[n.type] = (c[n.type] || 0) + 1; });
    return c;
  }, [laidOut]);

  return (
    <div className="flex flex-col h-full bg-background border-l border-border/20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/15 bg-card/30 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <Network className="h-4 w-4 text-accent shrink-0" />
          <div className="min-w-0">
            <div className="text-xs font-light tracking-[0.2em] uppercase text-muted-foreground">Intel Map</div>
            <div className="text-sm font-light text-foreground truncate">{query}</div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setZoom((z) => Math.min(3, z * 1.2))} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors" title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button onClick={() => setZoom((z) => Math.max(0.3, z * 0.85))} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors" title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button onClick={reset} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors" title="Reset view">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors" title="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && !error && laidOut.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-border/10 bg-card/10 text-[10px] font-light tracking-wider uppercase text-muted-foreground/70 overflow-x-auto">
          <span>{scrapedCount}/{totalSources} scraped</span>
          <span className="text-border/40">·</span>
          {(["source", "person", "organization", "location", "topic", "event"] as const).map((t) =>
            counts[t] ? (
              <span key={t} className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: NODE_PALETTE[t].stroke }} />
                {counts[t]} {t}
              </span>
            ) : null,
          )}
          <span className="text-border/40">·</span>
          <span>{edges.length} links</span>
        </div>
      )}

      {/* Body */}
      <div ref={containerRef} className="relative flex-1 overflow-hidden bg-gradient-to-br from-background via-background to-card/20"
        onWheel={handleWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ cursor: dragging ? "grabbing" : "grab" }}
      >
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-accent" />
            <p className="text-xs font-light tracking-wide">Scraping sources & extracting entities…</p>
            <p className="text-[10px] font-light text-muted-foreground/50">Reading {results.length} pages, mapping connections</p>
          </div>
        )}

        {error && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <Network className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-light text-foreground">Could not build map</p>
            <p className="text-xs font-extralight text-muted-foreground">{error}</p>
          </div>
        )}

        {!loading && !error && laidOut.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Network className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-light">No entities extracted from these sources.</p>
          </div>
        )}

        {!loading && !error && laidOut.length > 0 && (
          <svg width="100%" height="100%" className="select-none">
            <defs>
              <marker id="intel-arrow" viewBox="0 -5 10 10" refX="14" refY="0" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M0,-4L10,0L0,4" fill="hsl(var(--muted-foreground))" opacity="0.5" />
              </marker>
              <radialGradient id="intel-bg-glow" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.06" />
                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
              </radialGradient>
            </defs>

            <rect x="0" y="0" width="100%" height="100%" fill="url(#intel-bg-glow)" />

            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* Edges */}
              {edges.map((e, i) => {
                const a = idMap.get(e.source); const b = idMap.get(e.target);
                if (!a || !b) return null;
                const isHighlighted = !selectedId || (connectedIds.has(e.source) && connectedIds.has(e.target));
                const isMention = e.label === "mentions";
                const opacity = isHighlighted ? (isMention ? 0.25 : 0.55) : 0.08;
                const stroke = isMention ? "hsl(var(--muted-foreground))" : "hsl(var(--accent))";
                const dash = isMention ? "3 4" : undefined;
                const mx = (a.x! + b.x!) / 2; const my = (a.y! + b.y!) / 2;
                return (
                  <g key={i} opacity={opacity}>
                    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={isMention ? 1 : 1.5} strokeDasharray={dash} markerEnd={isMention ? undefined : "url(#intel-arrow)"} />
                    {!isMention && isHighlighted && selectedId && connectedIds.has(e.source) && connectedIds.has(e.target) && (
                      <text x={mx} y={my - 4} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))" fontWeight="300" className="pointer-events-none">
                        {e.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Nodes */}
              {laidOut.map((n) => {
                const palette = NODE_PALETTE[n.type];
                const r = NODE_RADIUS[n.type];
                const Icon = TYPE_ICON[n.type];
                const isSelected = selectedId === n.id;
                const isDimmed = selectedId && !connectedIds.has(n.id);
                const opacity = isDimmed ? 0.25 : 1;
                return (
                  <g
                    key={n.id}
                    data-node
                    transform={`translate(${n.x}, ${n.y})`}
                    style={{ cursor: "pointer", opacity }}
                    onClick={(e) => { e.stopPropagation(); setSelectedId(isSelected ? null : n.id); }}
                  >
                    {isSelected && (
                      <circle r={r + 6} fill="none" stroke={palette.ring} strokeWidth="1.5" opacity="0.6">
                        <animate attributeName="r" from={r + 4} to={r + 10} dur="1.6s" repeatCount="indefinite" />
                        <animate attributeName="opacity" from="0.6" to="0" dur="1.6s" repeatCount="indefinite" />
                      </circle>
                    )}
                    <circle r={r} fill={palette.fill} stroke={palette.stroke} strokeWidth={isSelected ? 2 : 1.2} />
                    <foreignObject x={-8} y={-8} width="16" height="16" className="pointer-events-none">
                      <Icon className="h-4 w-4" style={{ color: palette.text }} />
                    </foreignObject>
                    <text x={0} y={r + 12} textAnchor="middle" fontSize="10" fontWeight="300" fill={palette.text} className="pointer-events-none">
                      {n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label}
                    </text>
                    {n.type === "source" && n.tierLabel && (
                      <text x={0} y={r + 24} textAnchor="middle" fontSize="8" fill="hsl(var(--muted-foreground))" opacity="0.7" className="pointer-events-none">
                        {n.tierLabel}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {/* Selected node detail */}
        {selected && (
          <div className="absolute bottom-3 left-3 right-3 max-w-md rounded-xl border border-border/20 bg-card/80 backdrop-blur-xl p-3 shadow-xl">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: NODE_PALETTE[selected.type].stroke }} />
                <span className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground">{selected.type}</span>
              </div>
              <button onClick={() => setSelectedId(null)} className="p-0.5 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="text-sm font-light text-foreground mb-1">{selected.label}</div>
            {selected.context && (
              <p className="text-xs font-extralight text-muted-foreground leading-relaxed mb-2">{selected.context}</p>
            )}
            {selected.url && (
              <a href={selected.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
                Open source <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {selected.mentions !== undefined && selected.type !== "source" && (
              <div className="text-[10px] text-muted-foreground/60 mt-1">Mentioned in {selected.mentions} source{selected.mentions === 1 ? "" : "s"}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default IntelMapPanel;
