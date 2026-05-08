import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2, Network, ZoomIn, ZoomOut, RotateCcw, ExternalLink, Users, Building2, MapPin, Tag, Calendar, Globe, Plus, Zap, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { acquireIntelSlot } from "@/lib/intelJobQueue";
import { getActiveIntelMapByok, isIntelMapByokEnabled, getProviderSpec } from "@/lib/intelMapByok";
import IntelMapByokPanel from "./IntelMapByokPanel";
import IntelMapChatPopover from "./IntelMapChatPopover";
import SocialPostEmbed, { isSocialUrl } from "./SocialPostEmbed";
import LocationMapPanel from "./LocationMapPanel";
import { decodeHtmlEntities } from "@/lib/htmlDecode";
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
  /** Optional: re-run the underlying Zophiel search with a refined query string. */
  onRefineQuery?: (q: string) => void;
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

/* Distinct shape per entity type. Each returns an SVG element centered at (0,0). */
type ShapeKind = "rounded-square" | "circle" | "hexagon" | "diamond" | "pill" | "shield";
const NODE_SHAPE: Record<IntelNode["type"], ShapeKind> = {
  source: "rounded-square",
  person: "circle",
  organization: "hexagon",
  location: "shield",
  topic: "pill",
  event: "diamond",
};

function renderShape(kind: ShapeKind, w: number, h: number, fill: string, stroke: string, strokeWidth: number) {
  const hx = w / 2, hy = h / 2;
  switch (kind) {
    case "circle":
      return <circle cx={0} cy={0} r={Math.min(hx, hy)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
    case "hexagon": {
      const r = Math.min(hx, hy);
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        return `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
      }).join(" ");
      return <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />;
    }
    case "diamond": {
      const r = Math.min(hx, hy);
      return <polygon points={`0,${-r} ${r},0 0,${r} ${-r},0`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />;
    }
    case "pill":
      return <rect x={-hx} y={-hy * 0.7} width={w} height={h * 0.7} rx={hy * 0.7} ry={hy * 0.7} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
    case "shield": {
      const r = Math.min(hx, hy);
      // Rounded shield: top flat with rounded corners, bottom point.
      const d = `M ${-r},${-r * 0.85} Q ${-r},${-r} ${-r * 0.7},${-r} L ${r * 0.7},${-r} Q ${r},${-r} ${r},${-r * 0.85} L ${r},${r * 0.2} Q ${r},${r * 0.7} 0,${r} Q ${-r},${r * 0.7} ${-r},${r * 0.2} Z`;
      return <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" />;
    }
    case "rounded-square":
    default:
      return <rect x={-hx} y={-hy} width={w} height={h} rx={14} ry={14} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  }
}

/* Lightweight country / US-state detector. Scans label + context for known names
 * and returns the matching flag emoji. Uses anchored regexes so 'Iran' doesn't
 * match 'Iranian-American'. Order matters: longer/more specific names first. */
const COUNTRY_FLAGS: Array<[RegExp, string]> = [
  [/\b(united states|u\.s\.a?\.?|usa|america)\b/i, "🇺🇸"],
  [/\b(united kingdom|u\.k\.|britain|england|scotland|wales)\b/i, "🇬🇧"],
  [/\b(north korea|dprk)\b/i, "🇰🇵"], [/\b(south korea|korea)\b/i, "🇰🇷"],
  [/\bsaudi arabia\b/i, "🇸🇦"], [/\bunited arab emirates|uae\b/i, "🇦🇪"],
  [/\b(russia|russian federation)\b/i, "🇷🇺"], [/\bchina|prc\b/i, "🇨🇳"],
  [/\biran\b/i, "🇮🇷"], [/\bisrael\b/i, "🇮🇱"], [/\bukraine\b/i, "🇺🇦"],
  [/\bgermany\b/i, "🇩🇪"], [/\bfrance\b/i, "🇫🇷"], [/\bspain\b/i, "🇪🇸"],
  [/\bitaly\b/i, "🇮🇹"], [/\bjapan\b/i, "🇯🇵"], [/\bindia\b/i, "🇮🇳"],
  [/\bcanada\b/i, "🇨🇦"], [/\bmexico\b/i, "🇲🇽"], [/\bbrazil\b/i, "🇧🇷"],
  [/\baustralia\b/i, "🇦🇺"], [/\bturkey|türkiye\b/i, "🇹🇷"],
  [/\bsyria\b/i, "🇸🇾"], [/\biraq\b/i, "🇮🇶"], [/\byemen\b/i, "🇾🇪"],
  [/\begypt\b/i, "🇪🇬"], [/\bvenezuela\b/i, "🇻🇪"], [/\bcuba\b/i, "🇨🇺"],
  [/\bpakistan\b/i, "🇵🇰"], [/\btaiwan\b/i, "🇹🇼"], [/\bvietnam\b/i, "🇻🇳"],
  [/\bafghanistan\b/i, "🇦🇫"], [/\blibya\b/i, "🇱🇾"], [/\bsudan\b/i, "🇸🇩"],
  [/\bnigeria\b/i, "🇳🇬"], [/\bsouth africa\b/i, "🇿🇦"],
];
// US state → regional indicator emoji (state flags don't exist as single glyph; use 🏛 as fallback marker)
const US_STATES: Array<[RegExp, string]> = [
  [/\b(california|los angeles|san francisco|sacramento)\b/i, "🇺🇸"],
  [/\b(new york|nyc|manhattan|brooklyn|albany)\b/i, "🇺🇸"],
  [/\b(texas|austin|houston|dallas)\b/i, "🇺🇸"],
  [/\b(florida|miami|tampa|orlando)\b/i, "🇺🇸"],
  [/\b(washington d\.?c\.?|d\.c\.|district of columbia)\b/i, "🇺🇸"],
];

function detectFlag(node: IntelNode): string | null {
  const hay = `${node.label} ${node.context || ""}`;
  for (const [rx, flag] of COUNTRY_FLAGS) if (rx.test(hay)) return flag;
  for (const [rx, flag] of US_STATES) if (rx.test(hay)) return flag;
  return null;
}

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
  // Increased spacing so node bodies + their labels (which sit ~26px below) don't overlap.
  const k = 160;         // ideal edge length
  const repulsion = 9500;
  const damping = 0.85;
  const minSeparation = 110; // hard floor between any two node centers

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

  // Final hard collision pass — guarantees node centers are at least minSeparation apart
  // so labels (which sit below each node) cannot stack on top of neighboring nodes.
  for (let pass = 0; pass < 12; pass++) {
    let moved = false;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = (b.x! - a.x!) || 0.01;
        const dy = (b.y! - a.y!) || 0.01;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const need = Math.max(minSeparation, NODE_RADIUS[a.type] + NODE_RADIUS[b.type] + 50);
        if (dist < need) {
          const push = (need - dist) / 2;
          const ux = dx / dist, uy = dy / dist;
          a.x! -= ux * push; a.y! -= uy * push;
          b.x! += ux * push; b.y! += uy * push;
          moved = true;
        }
      }
    }
    // Reapply bounds
    nodes.forEach((n) => {
      const r = NODE_RADIUS[n.type] + 4;
      n.x = Math.max(r, Math.min(width - r, n.x!));
      n.y = Math.max(r, Math.min(height - r, n.y!));
    });
    if (!moved) break;
  }

  return nodes;
}

const IntelMapPanel = ({ query, results, onClose, onRefineQuery }: IntelMapPanelProps) => {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<IntelNode[]>([]);
  const [edges, setEdges] = useState<IntelEdge[]>([]);
  const [scrapedCount, setScrapedCount] = useState(0);
  const [totalSources, setTotalSources] = useState(0);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totalAvailable, setTotalAvailable] = useState(0);
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

  const [queueInfo, setQueueInfo] = useState<{ position: number; running: number } | null>(null);
  const [byokOpen, setByokOpen] = useState(false);
  const [byokActive, setByokActive] = useState<boolean>(() => isIntelMapByokEnabled());
  const refreshByok = useCallback(() => setByokActive(isIntelMapByokEnabled()), []);

  // Slide-out map / social embed state — triggered from selected entity actions.
  const [mapQuery, setMapQuery] = useState<string | null>(null);

  // Send the FULL list of results — server slices [offset, offset+12). This way
  // subsequent "Scrape More" calls have the URL list to continue from.
  const allResultsPayload = useMemo(
    () =>
      results.map((r) => ({
        title: r.title, url: r.url, snippet: r.snippet,
        source: r.source, tier: r.tier, tierLabel: r.tierLabel,
      })),
    [results],
  );

  // Shared runner used by both initial load and "Scrape More".
  const runBatch = useCallback(
    async (offset: number, append: boolean) => {
      const ac = new AbortController();
      let stopHeartbeat: (() => void) | null = null;
      let releaseSlot: ((s?: boolean) => Promise<void>) | null = null;

      // Read BYOK fresh on each run so toggling the panel mid-session takes effect.
      const byok = getActiveIntelMapByok();
      const skipQueue = !!byok;

      try {
        if (append) setLoadingMore(true); else { setLoading(true); setError(null); setQueueInfo(null); }

        if (!skipQueue) {
          const { release, startHeartbeat } = await acquireIntelSlot({
            jobType: "intelmap",
            maxConcurrent: 2,
            signal: ac.signal,
            onProgress: (p) => {
              if (p.status === "waiting") setQueueInfo({ position: p.position, running: p.runningCount });
              else setQueueInfo(null);
            },
          });
          releaseSlot = release;
          stopHeartbeat = startHeartbeat();
        }

        const { data, error: err } = await supabase.functions.invoke("zophiel-intelmap", {
          body: {
            query,
            results: allResultsPayload,
            offset,
            ...(byok ? { byok } : {}),
          },
        });
        if (err) throw err;
        if (!data?.success) throw new Error(data?.error || "Failed to build intel map");

        const newNodes: IntelNode[] = data.nodes || [];
        const newEdges: IntelEdge[] = data.edges || [];

        if (append) {
          // Merge: dedupe nodes by id, then add edges (server prefixes batch IDs so collisions are rare).
          setNodes((prev) => {
            const seen = new Set(prev.map((n) => n.id));
            return [...prev, ...newNodes.filter((n) => !seen.has(n.id))];
          });
          setEdges((prev) => [...prev, ...newEdges]);
          setScrapedCount((c) => c + (data.scrapedCount || 0));
          setTotalSources((c) => c + (data.totalSources || 0));
        } else {
          setNodes(newNodes);
          setEdges(newEdges);
          setScrapedCount(data.scrapedCount || 0);
          setTotalSources(data.totalSources || 0);
        }
        setNextOffset(Number(data.nextOffset || 0));
        setHasMore(!!data.hasMore);
        setTotalAvailable(Number(data.totalAvailable || results.length));
        if (releaseSlot) { await releaseSlot(true); releaseSlot = null; }
      } catch (e: any) {
        const msg = e?.message || "Could not build intel map";
        setError(msg);
        if (releaseSlot) { await releaseSlot(false); releaseSlot = null; }
      } finally {
        if (stopHeartbeat) stopHeartbeat();
        setLoading(false);
        setLoadingMore(false);
        setQueueInfo(null);
      }
    },
    [query, allResultsPayload, results.length],
  );

  // Initial load — guarded against React re-render storms.
  // Uses a ref so re-creating `runBatch` (e.g. from results identity changes)
  // never enqueues a second job for the same query.
  const initialLoadRef = useRef<string | null>(null);
  useEffect(() => {
    if (initialLoadRef.current === query) return;
    initialLoadRef.current = query;
    void runBatch(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const onScrapeMore = useCallback(() => {
    if (loadingMore || loading || !hasMore) return;
    setError(null);
    void runBatch(nextOffset, true);
  }, [loadingMore, loading, hasMore, nextOffset, runBatch]);

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
    if ((e.target as HTMLElement).closest("[data-node]") || (e.target as HTMLElement).closest("[data-detail-panel]")) return;
    // Click on empty canvas → deselect any open detail card
    if (selectedId) setSelectedId(null);
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY, px: pan.x, py: pan.y });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: dragStart.px + (e.clientX - dragStart.x), y: dragStart.py + (e.clientY - dragStart.y) });
  };
  const onMouseUp = () => setDragging(false);

  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); setSelectedId(null); };

  // Escape to close the open detail card (or the map overlay if open)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (mapQuery) { setMapQuery(null); return; }
      if (selectedId) { setSelectedId(null); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mapQuery, selectedId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    laidOut.forEach((n) => { c[n.type] = (c[n.type] || 0) + 1; });
    return c;
  }, [laidOut]);

  return (
    <div className="relative flex flex-col h-full bg-transparent border-l border-border/20 overflow-hidden">
      {/* ── COMMAND-DECK HEADER ─────────────────────────────────────────── */}
      <div className="relative border-b border-border/15 bg-gradient-to-b from-card/40 to-card/10 backdrop-blur-2xl">
        {/* classification ribbon */}
        <div className="flex items-center justify-between px-4 pt-2.5 pb-1 text-[9px] font-light tracking-[0.32em] uppercase text-muted-foreground/60">
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-accent animate-pulse" />
            Zophiel · Intel Map
          </span>
          <span>Classification · Operator Eyes Only</span>
        </div>
        <div className="flex items-center justify-between px-4 pb-3 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg border border-border/30 bg-foreground/[0.04]">
              <Network className="h-4 w-4 text-accent" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground/70">Subject</div>
              <div className="text-sm font-light text-foreground truncate max-w-[42ch]">{query}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setByokOpen(true)}
              className={`group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-light tracking-wider uppercase transition-colors ${
                byokActive
                  ? "border-foreground/40 bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1]"
                  : "border-border/30 bg-foreground/[0.02] text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05]"
              }`}
              title={byokActive ? "Using your own API key — queue bypassed" : "Bring your own API key to skip the queue"}
            >
              {byokActive ? <Zap className="h-3 w-3" /> : <KeyRound className="h-3 w-3" />}
              <span className="hidden sm:inline">{byokActive ? "Skipping queue" : "Skip queue"}</span>
            </button>
            <button onClick={onClose} className="p-1.5 ml-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors" title="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* BYOK active banner */}
      {byokActive && (() => {
        const cfg = getActiveIntelMapByok();
        const spec = cfg ? getProviderSpec(cfg.provider) : null;
        return (
          <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border/10 bg-foreground/[0.03] text-[10px] font-light tracking-wider text-foreground/70">
            <Zap className="h-3 w-3 text-foreground/80" />
            <span className="uppercase tracking-[0.18em] text-muted-foreground">Engine via your key</span>
            <span className="text-border/40">·</span>
            <span className="normal-case tracking-normal">
              {spec?.name || cfg?.provider} → <span className="text-foreground/85">{cfg?.model}</span>
            </span>
            <button onClick={() => setByokOpen(true)} className="ml-auto normal-case tracking-normal text-muted-foreground/70 hover:text-foreground transition-colors">
              Manage
            </button>
          </div>
        );
      })()}

      {/* Inline error banner */}
      {error && !loading && laidOut.length > 0 && (
        <div className="px-4 py-2 border-b border-destructive/30 bg-destructive/5 text-[11px] font-light text-destructive flex items-center justify-between gap-2">
          <span className="truncate">{error}</span>
          <button onClick={() => setError(null)} className="p-0.5 rounded hover:bg-destructive/10 shrink-0" aria-label="Dismiss">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* ── BODY: left rail · canvas · right dock ──────────────────────── */}
      <div className="flex-1 min-h-0 flex">
        {/* LEFT RAIL — vertical legend / counts */}
        {!loading && laidOut.length > 0 && (
          <aside className="hidden md:flex w-[148px] shrink-0 flex-col border-r border-border/15 bg-card/10 backdrop-blur-xl">
            <div className="px-3 pt-3 pb-2 text-[9px] font-light tracking-[0.28em] uppercase text-muted-foreground/60">Entities</div>
            <div className="flex-1 overflow-y-auto px-2 space-y-2">
              {(["source", "person", "organization", "location", "topic", "event"] as const).map((t) => {
                if (!counts[t]) return null;
                const Icon = TYPE_ICON[t];
                const entities = laidOut.filter((n) => n.type === t);
                return (
                  <div key={t}>
                    <div className="flex items-center gap-2 px-2 py-1 text-[9px] font-light tracking-[0.22em] uppercase text-muted-foreground/60">
                      <svg width="10" height="10" viewBox="-5 -5 10 10" className="shrink-0">
                        {renderShape(NODE_SHAPE[t], 10, 10, NODE_PALETTE[t].accent, "transparent", 0)}
                      </svg>
                      <Icon className="h-3 w-3 text-muted-foreground/60" strokeWidth={1.5} />
                      <span className="capitalize flex-1">{t}</span>
                      <span className="tabular-nums text-muted-foreground/60">{counts[t]}</span>
                    </div>
                    <ul className="space-y-0.5 mb-1">
                      {entities.slice(0, 12).map((n) => (
                        <li key={n.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedId(n.id);
                              // Center the camera on the selected node so the user
                              // sees what they clicked instead of just the dossier.
                              if (n.x != null && n.y != null) {
                                setPan({ x: size.w / 2 - n.x * zoom, y: size.h / 2 - n.y * zoom });
                              }
                            }}
                            className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded-md text-[11px] font-light truncate transition-colors ${
                              selectedId === n.id
                                ? "bg-foreground/10 text-foreground ring-1 ring-foreground/20"
                                : "text-foreground/75 hover:text-foreground hover:bg-foreground/[0.05]"
                            }`}
                            title={n.label}
                          >
                            <span className="h-1 w-1 rounded-full shrink-0" style={{ background: NODE_PALETTE[t].accent }} />
                            <span className="truncate">{n.label}</span>
                          </button>
                        </li>
                      ))}
                      {entities.length > 12 && (
                        <li className="px-2 py-0.5 text-[9px] font-light text-muted-foreground/50">
                          + {entities.length - 12} more
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border/15 px-3 py-2.5 space-y-1 text-[9px] font-light tracking-[0.18em] uppercase text-muted-foreground/60">
              <div className="flex justify-between"><span>Scraped</span><span className="text-foreground/80 tabular-nums normal-case tracking-normal">{scrapedCount}/{totalAvailable || totalSources}</span></div>
              <div className="flex justify-between"><span>Links</span><span className="text-foreground/80 tabular-nums normal-case tracking-normal">{edges.length}</span></div>
              {hasMore && totalAvailable > 0 && (
                <div className="flex justify-between"><span>Queue</span><span className="text-foreground/80 tabular-nums normal-case tracking-normal">{totalAvailable - nextOffset}</span></div>
              )}
            </div>
            {hasMore && (
              <div className="p-2 border-t border-border/15">
                <button
                  onClick={onScrapeMore}
                  disabled={loadingMore}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md border border-border/30 bg-foreground/[0.04] hover:bg-foreground/[0.08] hover:border-border/50 text-[10px] font-light tracking-wider uppercase text-foreground/85 transition-colors disabled:opacity-50 disabled:cursor-wait"
                  title={`Scrape next batch (${Math.min(12, totalAvailable - nextOffset)} more pages)`}
                >
                  {loadingMore ? <><Loader2 className="h-3 w-3 animate-spin" /> Scraping</> : <><Plus className="h-3 w-3" /> Scrape +{Math.min(12, totalAvailable - nextOffset)}</>}
                </button>
              </div>
            )}
          </aside>
        )}

        {/* CANVAS */}
        <div ref={containerRef} className="relative flex-1 min-w-0 overflow-hidden bg-background/10 backdrop-blur-2xl"
          onWheel={handleWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          style={{ cursor: dragging ? "grabbing" : "grab" }}
        >
          {/* dotted grid backdrop — whiteboard aesthetic */}
          <div
            className="absolute inset-0 opacity-[0.18] pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(hsl(var(--foreground) / 0.55) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              maskImage: "radial-gradient(ellipse at center, black 35%, transparent 85%)",
              WebkitMaskImage: "radial-gradient(ellipse at center, black 35%, transparent 85%)",
            }}
          />
          {/* soft center highlight */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(60% 50% at 50% 45%, hsl(var(--foreground) / 0.05), transparent 70%)",
            }}
          />
          {/* corner brackets */}
          <div className="pointer-events-none absolute inset-0">
            {[
              "top-3 left-3 border-t border-l",
              "top-3 right-3 border-t border-r",
              "bottom-3 left-3 border-b border-l",
              "bottom-3 right-3 border-b border-r",
            ].map((cls) => (
              <div key={cls} className={`absolute h-3 w-3 border-foreground/20 ${cls}`} />
            ))}
          </div>

          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
              {queueInfo ? (
                <>
                  <p className="text-xs font-light tracking-wide">Engine busy — you are #{queueInfo.position} in line</p>
                  <p className="text-[10px] font-light text-muted-foreground/50">{queueInfo.running} active session{queueInfo.running === 1 ? "" : "s"} · holding your slot</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-light tracking-wide">Scraping sources & extracting entities…</p>
                  <p className="text-[10px] font-light text-muted-foreground/50">Reading {results.length} pages, mapping connections</p>
                </>
              )}
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
              <g transform={`translate(${pan.x + size.w / 2 - (size.w / 2) * zoom}, ${pan.y + size.h / 2 - (size.h / 2) * zoom})`}>
                {/* Whiteboard-style edges: thin dashed gray, no arrowheads */}
                {edges.map((e, i) => {
                  const a = idMap.get(e.source); const b = idMap.get(e.target);
                  if (!a || !b) return null;
                  const ax = a.x! * zoom, ay = a.y! * zoom;
                  const bx = b.x! * zoom, by = b.y! * zoom;
                  const isHighlighted = !selectedId || (connectedIds.has(e.source) && connectedIds.has(e.target));
                  const opacity = isHighlighted ? 0.45 : 0.08;
                  const mx = (ax + bx) / 2; const my = (ay + by) / 2;
                  return (
                    <g key={i} opacity={opacity}>
                      <line
                        x1={ax} y1={ay} x2={bx} y2={by}
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth={1}
                        strokeDasharray="3 5"
                        strokeLinecap="round"
                      />
                      {isHighlighted && selectedId && connectedIds.has(e.source) && connectedIds.has(e.target) && (
                        <text x={mx} y={my - 4} textAnchor="middle" fontSize="9" fill="hsl(var(--muted-foreground))" fontWeight="300" className="pointer-events-none">{e.label}</text>
                      )}
                    </g>
                  );
                })}
                {/* Whiteboard-style nodes: colored pill, thin border, label inside */}
                {laidOut.map((n) => {
                  const basePalette = NODE_PALETTE[n.type];
                  const isOnionSource = n.type === "source" && n.tier === 5;
                  const palette = isOnionSource ? { ...basePalette, accent: "hsl(25, 90%, 60%)" } : basePalette;
                  const isSelected = selectedId === n.id;
                  const isDimmed = selectedId && !connectedIds.has(n.id);
                  const opacity = isDimmed ? 0.25 : 1;
                  // Pill geometry sized to label
                  const labelText = (n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label).toUpperCase();
                  const charW = 6.2;          // approximate uppercase char width @ 10px
                  const padX = 14;
                  const pillH = 28;
                  const pillW = Math.max(64, Math.round(labelText.length * charW + padX * 2));
                  const rx = pillH / 2;
                  return (
                    <g key={n.id} data-node transform={`translate(${n.x! * zoom}, ${n.y! * zoom})`}
                       style={{ cursor: "pointer", opacity, transition: "opacity 200ms ease" }}
                       onClick={(e) => { e.stopPropagation(); setSelectedId(isSelected ? null : n.id); }}>
                      {/* selection halo */}
                      {isSelected && (
                        <rect
                          x={-pillW / 2 - 5} y={-pillH / 2 - 5}
                          width={pillW + 10} height={pillH + 10}
                          rx={rx + 5} ry={rx + 5}
                          fill="none" stroke={palette.accent} strokeWidth={1} opacity={0.5}
                        >
                          <animate attributeName="opacity" values="0.5;0.15;0.5" dur="2s" repeatCount="indefinite" />
                        </rect>
                      )}
                      {/* pill body — translucent fill tinted by accent, thin colored border */}
                      <rect
                        x={-pillW / 2} y={-pillH / 2}
                        width={pillW} height={pillH}
                        rx={rx} ry={rx}
                        fill="hsl(var(--background) / 0.85)"
                        stroke={palette.accent}
                        strokeWidth={isSelected ? 1.4 : 1}
                        opacity={1}
                      />
                      {/* tinted glow underlay */}
                      <rect
                        x={-pillW / 2} y={-pillH / 2}
                        width={pillW} height={pillH}
                        rx={rx} ry={rx}
                        fill={palette.accent}
                        opacity={isSelected ? 0.16 : 0.08}
                        className="pointer-events-none"
                      />
                      {/* label */}
                      {n.url ? (
                        <a href={n.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                          <text x={0} y={3.5} textAnchor="middle"
                                fontSize="10"
                                fontWeight="500"
                                fill={palette.accent}
                                style={{ letterSpacing: "0.08em" }}>
                            {labelText}
                          </text>
                        </a>
                      ) : (
                        <text x={0} y={3.5} textAnchor="middle"
                              fontSize="10"
                              fontWeight="500"
                              fill={palette.accent}
                              style={{ letterSpacing: "0.08em" }}
                              className="pointer-events-none">
                          {labelText}
                        </text>
                      )}
                      {/* country flag — bottom-right corner indicator */}
                      {(() => {
                        const flag = detectFlag(n);
                        if (!flag) return null;
                        return (
                          <foreignObject
                            x={pillW / 2 - 14} y={pillH / 2 - 6}
                            width={16} height={14}
                            className="pointer-events-none"
                          >
                            <div className="flex items-center justify-center w-full h-full" style={{ fontSize: "11px", lineHeight: 1 }}>{flag}</div>
                          </foreignObject>
                        );
                      })()}
                    </g>
                  );
                })}
              </g>
            </svg>
          )}

          {/* FLOATING CONTROL DOCK — bottom-center */}
          {!loading && laidOut.length > 0 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-full border border-border/30 bg-card/60 backdrop-blur-2xl shadow-2xl px-1 py-1">
              <button onClick={() => setZoom((z) => Math.min(3, z * 1.2))} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors" title="Zoom in">
                <ZoomIn className="h-4 w-4" />
              </button>
              <button onClick={() => setZoom((z) => Math.max(0.3, z * 0.85))} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors" title="Zoom out">
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="mx-1 text-[10px] font-light tabular-nums text-muted-foreground/70 px-1.5 select-none">{Math.round(zoom * 100)}%</span>
              <button onClick={reset} className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-colors" title="Reset view">
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* RIGHT DOCK — entity detail (replaces floating bottom card) */}
        {selected && (() => {
          const linkedSources = (() => {
            if (selected.type === "source") return selected.url ? [selected] : [];
            const sourceIds = new Set<string>();
            edges.forEach((e) => {
              if (e.source === selected.id) sourceIds.add(e.target);
              if (e.target === selected.id) sourceIds.add(e.source);
            });
            return laidOut.filter((n) => n.type === "source" && sourceIds.has(n.id) && n.url);
          })();
          const selectedLabel = decodeHtmlEntities(selected.label);
          const selectedContext = decodeHtmlEntities(selected.context);
          const selectedIsSocial = selected.url ? isSocialUrl(selected.url) : false;
          const selectedIsLocation = selected.type === "location";

          return (
            <aside data-detail-panel className="hidden md:flex w-[360px] lg:w-[400px] shrink-0 flex-col border-l border-border/20 bg-card/30 backdrop-blur-2xl animate-fade-in">
              {/* dossier header strip */}
              <div className="relative px-4 pt-3 pb-2.5 border-b border-border/15">
                <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${NODE_PALETTE[selected.type].accent}, transparent)` }} />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <svg width="14" height="14" viewBox="-7 -7 14 14" className="shrink-0">
                      {renderShape(NODE_SHAPE[selected.type], 14, 14, NODE_PALETTE[selected.type].accent, "transparent", 0)}
                    </svg>
                    <span className="text-[9px] font-light tracking-[0.3em] uppercase text-muted-foreground">Dossier · {selected.type}</span>
                    {(() => { const f = detectFlag(selected); return f ? <span className="text-sm leading-none ml-1">{f}</span> : null; })()}
                  </div>
                  <button onClick={() => setSelectedId(null)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors" title="Close dossier">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 text-[15px] font-light text-foreground leading-snug">{selectedLabel}</div>
                {selected.mentions !== undefined && selected.type !== "source" && (
                  <div className="mt-1 text-[10px] font-light tracking-wider uppercase text-muted-foreground/60">
                    Mentioned in {selected.mentions} source{selected.mentions === 1 ? "" : "s"}
                  </div>
                )}
              </div>

              {/* scrollable body */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                {selectedContext && (
                  <div className="px-4 py-3 border-b border-border/10">
                    <div className="text-[9px] font-light tracking-[0.28em] uppercase text-muted-foreground/60 mb-1.5">Context</div>
                    <blockquote className="pl-3 border-l-2 border-border/30 text-xs font-extralight text-muted-foreground/90 leading-relaxed italic">
                      "{selectedContext}"
                    </blockquote>
                  </div>
                )}

                {(selectedIsLocation || selectedIsSocial) && (
                  <div className="px-4 py-3 border-b border-border/10 flex flex-wrap gap-2">
                    {selectedIsLocation && (
                      <button onClick={() => setMapQuery(selectedLabel)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-foreground/[0.05] hover:bg-foreground/[0.1] hover:border-border/50 px-2.5 py-1 text-[10px] font-light text-foreground/85 transition-colors">
                        <MapPin className="h-3 w-3" /> View on map
                      </button>
                    )}
                  </div>
                )}

                {selectedIsSocial && selected.url && (
                  <div className="px-4 py-3 border-b border-border/10">
                    <div className="text-[9px] font-light tracking-[0.28em] uppercase text-muted-foreground/60 mb-2">Live post</div>
                    <SocialPostEmbed url={selected.url} />
                  </div>
                )}

                {!selectedIsSocial && selected.type === "source" && selected.url && (
                  <div className="px-4 py-3 border-b border-border/10">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[9px] font-light tracking-[0.28em] uppercase text-muted-foreground/60">Page preview</div>
                      <a href={selected.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] font-light text-muted-foreground/60 hover:text-foreground transition-colors">
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <div className="rounded-xl overflow-hidden border border-border/20 bg-card/60">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/15 bg-foreground/[0.04] text-[10px] font-light text-muted-foreground/70 uppercase tracking-[0.15em]">
                        <Globe className="h-3 w-3" />
                        <span className="truncate">{selected.domain || "preview"}</span>
                      </div>
                      <div className="relative w-full h-[300px]" style={{ background: "hsl(var(--card))", colorScheme: "dark" }}>
                        <iframe src={selected.url} title={`Preview · ${selected.label}`} loading="lazy" referrerPolicy="no-referrer"
                          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                          className="absolute inset-0 w-full h-full border-0"
                          style={{ colorScheme: "dark", background: "hsl(var(--card))" }} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="h-3 w-3 text-accent" />
                    <span className="text-[9px] font-light tracking-[0.28em] uppercase text-muted-foreground/70">
                      {linkedSources.length > 0 ? `${linkedSources.length} linked source${linkedSources.length === 1 ? "" : "s"}` : "No linked sources"}
                    </span>
                  </div>
                  {linkedSources.length === 0 ? (
                    <p className="text-[11px] font-extralight text-muted-foreground/50 italic">No origin source extracted for this entity.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {linkedSources.map((src) => (
                        <li key={src.id}>
                          <a href={src.url} target="_blank" rel="noopener noreferrer"
                            className="group flex items-start gap-2 rounded-lg px-2.5 py-2 bg-foreground/[0.03] hover:bg-foreground/[0.06] border border-border/15 hover:border-border/30 transition-all">
                            <span className="mt-0.5 h-1.5 w-1.5 rounded-[2px] shrink-0" style={{ background: NODE_PALETTE.source.accent }} />
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-light text-foreground truncate group-hover:text-accent transition-colors">{src.label}</div>
                              {src.domain && (
                                <div className="text-[9px] font-extralight tracking-wider text-muted-foreground/60 truncate">{src.domain}{src.tierLabel ? ` · ${src.tierLabel}` : ""}</div>
                              )}
                            </div>
                            <ExternalLink className="h-3 w-3 text-muted-foreground/50 group-hover:text-accent shrink-0 mt-0.5 transition-colors" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </aside>
          );
        })()}
      </div>

      {/* Floating draggable + resizable Intel Chat (viewport-fixed popout). */}
      <IntelMapChatPopover mapQuery={query} onOpenByokPanel={() => setByokOpen(true)} onRefineQuery={onRefineQuery} />

      <IntelMapByokPanel open={byokOpen} onClose={() => setByokOpen(false)} onChange={refreshByok} />

      {mapQuery && <LocationMapPanel query={mapQuery} onClose={() => setMapQuery(null)} />}
    </div>
  );
};

export default IntelMapPanel;

