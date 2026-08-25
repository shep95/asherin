// asherin.eye — one globe, live public signals, honest gaps.
//
// Narrative before code: the operator opens this room to see the planet as it
// is right now, not a decorated illustration. So the globe owns the screen, it
// spins on drag, and every dot on it came from a public feed that answered in
// this session. When a feed refuses (rate limit, outage, blocked network) the
// layer says so in plain words instead of drawing nothing and pretending the
// sky is empty.
//
// Flaws guarded here: no unbounded fetch (each feed has an AbortController and
// a hard timeout), no state writes after unmount, no full re-render per frame
// (points live in a ref, the canvas is the only thing that moves), no
// devicePixelRatio blur, and no animation when the operator prefers reduced
// motion.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Globe2, Loader2, RefreshCw } from "lucide-react";
import { emitPull } from "@/lib/connect/emitPull";

type LayerId = "quakes" | "flights" | "iss";

interface Point {
  lat: number;
  lon: number;
  layer: LayerId;
  label: string;
}

interface LayerState {
  id: LayerId;
  label: string;
  source: string;
  on: boolean;
  status: "idle" | "loading" | "ok" | "fail";
  count: number;
  note: string;
}

const LAYER_COLOR: Record<LayerId, string> = {
  quakes: "rgba(248,113,113,0.85)",
  flights: "rgba(212,175,55,0.75)",
  iss: "rgba(125,211,252,0.95)",
};

const INITIAL_LAYERS: LayerState[] = [
  { id: "quakes", label: "earthquakes · past day", source: "usgs", on: true, status: "idle", count: 0, note: "" },
  { id: "flights", label: "public flights", source: "opensky", on: true, status: "idle", count: 0, note: "" },
  { id: "iss", label: "iss position", source: "wheretheiss.at", on: true, status: "idle", count: 0, note: "" },
];

async function getJson(url: string, timeoutMs = 12000): Promise<unknown> {
  const ctl = new AbortController();
  const timer = window.setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal });
    if (!res.ok) throw new Error(`${res.status}`);
    const type = res.headers.get("content-type") || "";
    if (!type.includes("json")) throw new Error("not json");
    return await res.json();
  } finally {
    window.clearTimeout(timer);
  }
}

const AsherinEyeView = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const rotationRef = useRef({ lon: 12, lat: 18 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const aliveRef = useRef(true);

  const [layers, setLayers] = useState<LayerState[]>(INITIAL_LAYERS);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  const enabled = useMemo(() => new Set(layers.filter((l) => l.on).map((l) => l.id)), [layers]);

  const patch = useCallback((id: LayerId, next: Partial<LayerState>) => {
    if (!aliveRef.current) return;
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...next } : l)));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const started = performance.now();
    const collected: Point[] = [];

    const jobs: Array<Promise<void>> = [
      (async () => {
        patch("quakes", { status: "loading", note: "" });
        try {
          const data = (await getJson(
            "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
          )) as { features?: Array<{ geometry?: { coordinates?: number[] }; properties?: { title?: string } }> };
          const pts = (data.features ?? [])
            .map((f) => {
              const c = f.geometry?.coordinates;
              if (!c || c.length < 2) return null;
              return { lon: c[0], lat: c[1], layer: "quakes" as const, label: f.properties?.title ?? "quake" };
            })
            .filter(Boolean) as Point[];
          collected.push(...pts);
          patch("quakes", { status: "ok", count: pts.length, note: "" });
        } catch (e) {
          patch("quakes", { status: "fail", count: 0, note: `usgs did not answer — ${(e as Error).message}` });
        }
      })(),
      (async () => {
        patch("flights", { status: "loading", note: "" });
        try {
          const data = (await getJson("https://opensky-network.org/api/states/all")) as {
            states?: Array<Array<string | number | boolean | null>>;
          };
          const pts = (data.states ?? [])
            .slice(0, 1200)
            .map((s) => {
              const lon = s[5] as number | null;
              const lat = s[6] as number | null;
              if (typeof lat !== "number" || typeof lon !== "number") return null;
              return {
                lat,
                lon,
                layer: "flights" as const,
                label: String(s[1] ?? "").trim() || String(s[0] ?? "aircraft"),
              };
            })
            .filter(Boolean) as Point[];
          collected.push(...pts);
          patch("flights", { status: "ok", count: pts.length, note: "" });
        } catch (e) {
          patch("flights", {
            status: "fail",
            count: 0,
            note: `opensky is rate-limited or unreachable right now — ${(e as Error).message}. this is unsure, not empty sky.`,
          });
        }
      })(),
      (async () => {
        patch("iss", { status: "loading", note: "" });
        try {
          const d = (await getJson("https://api.wheretheiss.at/v1/satellites/25544")) as {
            latitude?: number;
            longitude?: number;
          };
          if (typeof d.latitude !== "number" || typeof d.longitude !== "number") throw new Error("no fix");
          collected.push({ lat: d.latitude, lon: d.longitude, layer: "iss", label: "iss (zarya)" });
          patch("iss", { status: "ok", count: 1, note: "" });
        } catch (e) {
          patch("iss", { status: "fail", count: 0, note: `no station fix — ${(e as Error).message}` });
        }
      })(),
    ];

    await Promise.allSettled(jobs);
    if (!aliveRef.current) return;
    pointsRef.current = collected;
    setFetchedAt(new Date());
    setLoading(false);

    void emitPull({
      organ: "maps",
      capability: "eye.globe.refresh",
      fromSurface: "asherin.eye",
      status: collected.length ? "ok" : "fail",
      latencyMs: Math.round(performance.now() - started),
      quote: `${collected.length} live points`,
    });
  }, [patch]);

  useEffect(() => {
    aliveRef.current = true;
    void load();
    return () => {
      aliveRef.current = false;
    };
  }, [load]);

  // Draw loop — orthographic projection, points in a ref so React never
  // re-renders per frame.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.max(40, Math.min(w, h) / 2 - 24);

      ctx.clearRect(0, 0, w, h);

      // limb
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.018)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.10)";
      ctx.lineWidth = 1;
      ctx.stroke();

      const rot = rotationRef.current;
      const latRad = (rot.lat * Math.PI) / 180;
      const sinL = Math.sin(latRad);
      const cosL = Math.cos(latRad);

      const project = (lat: number, lon: number) => {
        const p = (lat * Math.PI) / 180;
        const l = ((lon - rot.lon) * Math.PI) / 180;
        const cosC = sinL * Math.sin(p) + cosL * Math.cos(p) * Math.cos(l);
        if (cosC <= 0) return null; // far side
        return {
          x: cx + r * Math.cos(p) * Math.sin(l),
          y: cy - r * (cosL * Math.sin(p) - sinL * Math.cos(p) * Math.cos(l)),
        };
      };

      // graticule
      ctx.strokeStyle = "rgba(255,255,255,0.055)";
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 3) {
          const pt = project(lat, lon);
          if (!pt) { started = false; continue; }
          if (!started) { ctx.moveTo(pt.x, pt.y); started = true; } else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }
      for (let lon = -180; lon < 180; lon += 30) {
        ctx.beginPath();
        let started = false;
        for (let lat = -90; lat <= 90; lat += 3) {
          const pt = project(lat, lon);
          if (!pt) { started = false; continue; }
          if (!started) { ctx.moveTo(pt.x, pt.y); started = true; } else ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
      }

      for (const p of pointsRef.current) {
        if (!enabled.has(p.layer)) continue;
        const pt = project(p.lat, p.lon);
        if (!pt) continue;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, p.layer === "iss" ? 3.2 : p.layer === "quakes" ? 2 : 1.2, 0, Math.PI * 2);
        ctx.fillStyle = LAYER_COLOR[p.layer];
        ctx.fill();
      }

      if (!reduced && !dragRef.current) rotationRef.current = { ...rot, lon: rot.lon + 0.06 };
      raf = window.requestAnimationFrame(draw);
    };

    raf = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [enabled]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const start = dragRef.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    dragRef.current = { x: e.clientX, y: e.clientY };
    const rot = rotationRef.current;
    rotationRef.current = {
      lon: rot.lon - dx * 0.35,
      lat: Math.max(-85, Math.min(85, rot.lat + dy * 0.35)),
    };
  };
  const endDrag = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 px-5 py-3 border-b border-border/[0.06] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-foreground/[0.04] border border-border/[0.08] flex items-center justify-center">
            <Globe2 className="h-3.5 w-3.5 text-foreground/60" />
          </div>
          <div>
            <h1 className="text-[11px] font-light tracking-[0.12em] text-foreground/90 lowercase">asherin.eye</h1>
            <p className="text-[9px] text-muted-foreground/40 lowercase">
              {fetchedAt ? `live public signals · read ${fetchedAt.toLocaleTimeString()}` : "reading public feeds…"}
            </p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/[0.06] text-[10px] text-foreground/60 hover:bg-foreground/[0.1] transition-colors disabled:opacity-40 lowercase"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          refresh
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <div className="flex-1 min-h-[320px] relative">
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        </div>

        <aside className="lg:w-[300px] shrink-0 border-t lg:border-t-0 lg:border-l border-border/[0.06] p-4 space-y-2 overflow-y-auto">
          {layers.map((l) => (
            <div key={l.id} className="rounded-xl border border-border/[0.07] bg-foreground/[0.02] p-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={l.on}
                  onChange={() => patch(l.id, { on: !l.on })}
                  className="accent-foreground/60"
                />
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: LAYER_COLOR[l.id] }}
                  aria-hidden
                />
                <span className="text-[10.5px] text-foreground/75 lowercase">{l.label}</span>
              </label>
              <div className="mt-1.5 pl-6 text-[9.5px] text-muted-foreground/45 lowercase">
                {l.status === "loading" && "reading…"}
                {l.status === "ok" && `${l.count} live · ${l.source}`}
                {l.status === "fail" && l.note}
                {l.status === "idle" && "waiting"}
              </div>
            </div>
          ))}
          <p className="text-[9px] text-muted-foreground/35 leading-relaxed lowercase pt-1">
            drag the globe to turn it. every dot came from a public feed that answered in this session — nothing here
            is drawn from cache or invented. a layer that fails says so rather than showing an empty sky.
          </p>
        </aside>
      </div>
    </div>
  );
};

export default AsherinEyeView;
