import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Eye, Brush, Globe2, Loader2, Sparkles, ArrowRight } from "lucide-react";

/**
 * Live "Show, don't tell" demo strip.
 * Three side-by-side mini-demos visitors can poke:
 *   1. Zophiel Search — type a query, watch fake source cards stream in
 *   2. CROSS Live Overlay — animated frame with detection overlays
 *   3. Whiteboard — draggable nodes
 * Pure presentation: no network calls, no AI, no leaking real data.
 */

const PRESET_QUERIES = [
  "Public records on Acme Corp",
  "Domain history aureonai.app",
  "OSINT footprint for @handle",
  "Crypto wallets linked to address 0x42…",
];

const FAKE_SOURCES = [
  { tag: "Public Records", txt: "EDGAR · State filings · Beneficial owner registry" },
  { tag: "Web", txt: "23 archived snapshots · 11 active domains · 4 redirect chains" },
  { tag: "Social", txt: "Twitter, GitHub, LinkedIn, Reddit · 91 mentions in 30d" },
  { tag: "Threat Intel", txt: "0 sanctions hits · 2 historical incidents · clean reputation" },
];

const ZophielDemo = () => {
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<"idle" | "searching" | "done">("idle");
  const [visible, setVisible] = useState(0);
  const placeholderIdx = useRef(0);

  // rotating placeholder when idle
  const [ph, setPh] = useState(PRESET_QUERIES[0]);
  useEffect(() => {
    if (step !== "idle" || query) return;
    const id = setInterval(() => {
      placeholderIdx.current = (placeholderIdx.current + 1) % PRESET_QUERIES.length;
      setPh(PRESET_QUERIES[placeholderIdx.current]);
    }, 2400);
    return () => clearInterval(id);
  }, [step, query]);

  const run = () => {
    if (!query.trim() && step === "idle") {
      setQuery(PRESET_QUERIES[placeholderIdx.current]);
    }
    setStep("searching");
    setVisible(0);
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setVisible(i);
      if (i >= FAKE_SOURCES.length) {
        clearInterval(id);
        setStep("done");
      }
    }, 380);
  };

  const reset = () => {
    setQuery("");
    setStep("idle");
    setVisible(0);
  };

  return (
    <div className="relative flex h-full flex-col gap-3 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-md p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-foreground/70" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">Zophiel Search</span>
        </div>
        <span className="text-[9px] tracking-wider text-muted-foreground/40 uppercase">Demo</span>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-background/40 px-3 py-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (step === "done") reset();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") run();
          }}
          placeholder={ph}
          className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
        />
        <button
          onClick={run}
          className="rounded-lg bg-foreground/10 hover:bg-foreground/20 transition-colors px-2 py-1 text-[10px] tracking-wider text-foreground"
        >
          {step === "searching" ? <Loader2 className="h-3 w-3 animate-spin" /> : "RUN"}
        </button>
      </div>

      <div className="flex-1 space-y-1.5 overflow-hidden">
        {FAKE_SOURCES.slice(0, visible).map((s, i) => (
          <div
            key={i}
            className="rounded-lg border border-border/20 bg-background/30 px-3 py-2 animate-fade-in"
          >
            <div className="text-[9px] uppercase tracking-wider text-foreground/50">{s.tag}</div>
            <div className="mt-0.5 text-[11px] font-light text-foreground/85">{s.txt}</div>
          </div>
        ))}
        {step === "idle" && (
          <div className="flex h-full items-center justify-center text-center text-[11px] font-light text-muted-foreground/40 px-2">
            Try a query — Zophiel ranks 30+ sources in real time.
          </div>
        )}
        {step === "done" && (
          <div className="pt-1 text-[10px] tracking-wide text-emerald-300/80 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Veracity score · 92% · cross-validated
          </div>
        )}
      </div>

      <Link
        to="/zophiel"
        className="mt-1 inline-flex items-center gap-1 text-[10px] tracking-wider uppercase text-muted-foreground/70 hover:text-foreground transition-colors"
      >
        Open full search <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
};

const CrossDemo = () => {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => (x + 1) % 100), 100);
    return () => clearInterval(id);
  }, []);

  // animated waveform bars (deterministic, no random)
  const bars = Array.from({ length: 24 }).map((_, i) => {
    const phase = (t / 100) * Math.PI * 2 + i * 0.4;
    return 30 + Math.abs(Math.sin(phase)) * 60;
  });

  return (
    <div className="relative flex h-full flex-col gap-3 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-md p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-foreground/70" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">CROSS Live Frame</span>
        </div>
        <span className="flex items-center gap-1 text-[9px] tracking-wider text-emerald-300/80">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          ANALYZING
        </span>
      </div>

      {/* fake video viewport with overlays */}
      <div className="relative flex-1 overflow-hidden rounded-xl border border-border/30 bg-gradient-to-br from-foreground/5 via-foreground/[0.02] to-background/40">
        {/* scanline */}
        <div
          className="pointer-events-none absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-300/40 to-transparent"
          style={{ top: `${t}%`, transition: "top 0.1s linear" }}
        />
        {/* fake "subject" rectangle */}
        <div className="absolute left-[18%] top-[22%] h-[55%] w-[40%] rounded-md border border-emerald-300/40">
          <div className="absolute -top-5 left-0 text-[9px] tracking-wider text-emerald-300/80">SUBJECT 01 · 0.94</div>
        </div>
        <div className="absolute right-[14%] top-[34%] h-[40%] w-[26%] rounded-md border border-amber-300/50">
          <div className="absolute -top-5 left-0 text-[9px] tracking-wider text-amber-300/80">SUBJECT 02 · 0.81</div>
        </div>
        {/* readouts */}
        <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between text-[9px] uppercase tracking-wider text-foreground/60">
          <div className="flex items-end gap-px">
            {bars.map((h, i) => (
              <div
                key={i}
                className="w-[3px] rounded-sm bg-foreground/40"
                style={{ height: `${h * 0.35}px` }}
              />
            ))}
          </div>
          <div className="text-right">
            <div>tilt 12°</div>
            <div>focus 96%</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5 text-[10px] font-light">
        <div className="rounded-md border border-border/20 bg-background/30 px-2 py-1.5">
          <div className="text-muted-foreground/50 text-[9px] uppercase tracking-wider">Sentiment</div>
          <div className="text-foreground/90">Neutral · steady</div>
        </div>
        <div className="rounded-md border border-border/20 bg-background/30 px-2 py-1.5">
          <div className="text-muted-foreground/50 text-[9px] uppercase tracking-wider">Micro-expr.</div>
          <div className="text-foreground/90">Brow flash · 0.4s</div>
        </div>
        <div className="rounded-md border border-border/20 bg-background/30 px-2 py-1.5">
          <div className="text-muted-foreground/50 text-[9px] uppercase tracking-wider">Stress</div>
          <div className="text-foreground/90">Low · 18%</div>
        </div>
      </div>
    </div>
  );
};

interface DragNode {
  id: string;
  x: number;
  y: number;
  label: string;
  color: string;
}

const WhiteboardDemo = () => {
  const [nodes, setNodes] = useState<DragNode[]>([
    { id: "a", x: 18, y: 22, label: "ENTITY", color: "border-foreground/40 bg-foreground/10" },
    { id: "b", x: 60, y: 18, label: "DOMAIN", color: "border-emerald-300/40 bg-emerald-300/10" },
    { id: "c", x: 30, y: 58, label: "WALLET", color: "border-amber-300/40 bg-amber-300/10" },
    { id: "d", x: 70, y: 64, label: "ALIAS", color: "border-rose-300/40 bg-rose-300/10" },
  ]);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const r = surface.getBoundingClientRect();
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    dragRef.current = {
      id,
      offsetX: e.clientX - (r.left + (node.x / 100) * r.width),
      offsetY: e.clientY - (r.top + (node.y / 100) * r.height),
    };
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const surface = surfaceRef.current;
    if (!drag || !surface) return;
    const r = surface.getBoundingClientRect();
    const x = ((e.clientX - drag.offsetX - r.left) / r.width) * 100;
    const y = ((e.clientY - drag.offsetY - r.top) / r.height) * 100;
    setNodes((prev) =>
      prev.map((n) => (n.id === drag.id ? { ...n, x: Math.max(2, Math.min(92, x)), y: Math.max(4, Math.min(88, y)) } : n))
    );
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const links: Array<[string, string]> = [
    ["a", "b"],
    ["a", "c"],
    ["b", "d"],
    ["c", "d"],
  ];

  return (
    <div className="relative flex h-full flex-col gap-3 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-md p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brush className="h-3.5 w-3.5 text-foreground/70" />
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">Whiteboard · Drag</span>
        </div>
        <span className="text-[9px] tracking-wider text-muted-foreground/40 uppercase">Try it</span>
      </div>
      <div
        ref={surfaceRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="relative flex-1 overflow-hidden rounded-xl border border-border/30 bg-[radial-gradient(circle_at_1px_1px,_rgba(255,255,255,0.08)_1px,_transparent_0)] [background-size:14px_14px] bg-background/30 cursor-grab"
      >
        {/* edges */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none">
          {links.map(([a, b], i) => {
            const A = nodes.find((n) => n.id === a)!;
            const B = nodes.find((n) => n.id === b)!;
            return (
              <line
                key={i}
                x1={`${A.x + 7}%`}
                y1={`${A.y + 7}%`}
                x2={`${B.x + 7}%`}
                y2={`${B.y + 7}%`}
                stroke="rgba(255,255,255,0.18)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            );
          })}
        </svg>

        {nodes.map((n) => (
          <div
            key={n.id}
            onPointerDown={(e) => onPointerDown(e, n.id)}
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
            className={`absolute select-none rounded-lg border ${n.color} px-2.5 py-1 text-[10px] tracking-[0.15em] font-light text-foreground/90 backdrop-blur-sm shadow-md cursor-grab active:cursor-grabbing touch-none`}
          >
            {n.label}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-light text-muted-foreground/50">4 nodes · 4 edges</span>
        <Link
          to="/whiteboard"
          className="inline-flex items-center gap-1 text-[10px] tracking-wider uppercase text-muted-foreground/70 hover:text-foreground transition-colors"
        >
          Open canvas <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
};

const LiveDemoStrip = () => {
  return (
    <div className="relative z-10 px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/40 backdrop-blur-md px-3 py-1 mb-5">
            <Globe2 className="h-3 w-3 text-foreground/70" />
            <span className="text-[9px] font-medium tracking-[0.25em] text-muted-foreground/60 uppercase">Live · Touch Anything</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            Don't take our word for it.
            <br />
            <span className="text-muted-foreground">Poke the platform.</span>
          </h2>
          <p className="mt-5 max-w-xl mx-auto text-sm sm:text-base font-extralight leading-relaxed text-muted-foreground">
            These are not screenshots. Type, drag, watch — three real Aureon modules running right here in your browser.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[440px]">
          <ZophielDemo />
          <CrossDemo />
          <WhiteboardDemo />
        </div>
      </div>
    </div>
  );
};

export default LiveDemoStrip;
