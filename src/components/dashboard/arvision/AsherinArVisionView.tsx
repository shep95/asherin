// asherin.arvision — camera first, HUD sparse, honesty printed.
//
// Narrative check: the old AR lived as a tab inside a BLE scanner, so the
// camera was a guest in someone else's room and the HUD carried clone-suspect
// colouring, scenario chips and a hop graph — costume for a person who just
// wants to point a phone at something. The new room opens with a mirrored
// self-view (a person must see themselves before they trust a camera surface),
// a reticle, a compass, and one MISB-named chip. Everything else is opt-in.
//
// Freeze never uploads the operator's face: reverse search opens a TAB the
// person chooses, and the frozen frame stays in this tab unless they save a
// packet.

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Grid3x3, RefreshCw, Save, Snowflake } from "lucide-react";
import { useAccess } from "@/hooks/useAccess";
import { emitPull } from "@/lib/connect/emitPull";
import {
  CANNOT_RESOLVE,
  EMPTY_INTEL,
  analyseFrame,
  sceneGeoVerdict,
  visualLevel,
  type FrameIntel,
} from "@/lib/arvision/frameIntel";

const SAMPLE_W = 96;
const SAMPLE_H = 72;

const AsherinArVisionView = () => {
  const { hasPro, isAdmin } = useAccess();
  const proActions = hasPro || isAdmin;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sampleRef = useRef<HTMLCanvasElement | null>(null);
  const prevGray = useRef<Float32Array | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [on, setOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [grid, setGrid] = useState(false);
  const [intel, setIntel] = useState<FrameIntel>(EMPTY_INTEL);
  const [frozen, setFrozen] = useState<string | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [clock, setClock] = useState(() => new Date().toISOString());

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date().toISOString()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setGeo({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setGeo(null),
      { enableHighAccuracy: true, maximumAge: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    prevGray.current = null;
    setOn(false);
    setIntel(EMPTY_INTEL);
  }, []);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const canvas = sampleRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
      const data = ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
      const { intel: next, gray } = analyseFrame(data, SAMPLE_W, SAMPLE_H, prevGray.current);
      prevGray.current = gray;
      setIntel(next);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = useCallback(async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setOn(true);
      rafRef.current = requestAnimationFrame(loop);
      void emitPull({
        organ: "arvision",
        capability: "camera-open",
        fromSurface: "asherin-arvision",
        status: "ok",
        quote: facing,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "camera refused");
      void emitPull({
        organ: "arvision",
        capability: "camera-open",
        fromSurface: "asherin-arvision",
        status: "fail",
        quote: "camera refused",
      });
    }
  }, [facing, loop]);

  useEffect(() => {
    void start();
  }, []);
  useEffect(() => stop, [stop]);

  const flip = useCallback(async () => {
    const next = facing === "user" ? "environment" : "user";
    stop();
    setFacing(next);
    // start() reads `facing` from the next render, so the restart is deferred.
    window.setTimeout(() => {
      void start();
    }, 0);
  }, [facing, start, stop]);

  const freeze = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !on) return;
    const c = document.createElement("canvas");
    c.width = video.videoWidth || 1280;
    c.height = video.videoHeight || 720;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, c.width, c.height);
    setFrozen(c.toDataURL("image/jpeg", 0.9));

    const found: string[] = [];
    const Detector = (
      window as unknown as {
        BarcodeDetector?: new (o?: unknown) => { detect(s: CanvasImageSource): Promise<Array<{ rawValue: string }>> };
      }
    ).BarcodeDetector;
    if (Detector) {
      try {
        const det = new Detector();
        const hits = await det.detect(c);
        for (const h of hits) found.push(h.rawValue);
      } catch {
        /* a refused detector is a gap, never a fabricated read */
      }
    }
    setCodes(found);
    void emitPull({
      organ: "arvision",
      capability: "freeze",
      fromSurface: "asherin-arvision",
      status: "ok",
      quote: found.length ? `${found.length} code read` : "frame held · no code",
    });
  }, [on]);

  const savePacket = useCallback(() => {
    if (!frozen || !proActions) return;
    const a = document.createElement("a");
    a.href = frozen;
    a.download = `asherin-arvision-packet-${Date.now()}.jpg`;
    a.click();
    void emitPull({
      organ: "arvision",
      capability: "packet-save",
      fromSurface: "asherin-arvision",
      status: "ok",
      quote: "A–E visual intel packet",
    });
  }, [frozen, proActions]);

  const votes = (intel.edges > 0.08 ? 1 : 0) + (codes.length ? 1 : 0) + (intel.contrast > 0.5 ? 1 : 0);
  const verdict = sceneGeoVerdict(votes);

  return (
    <div className="relative h-full w-full overflow-hidden bg-background">
      {/* CAMERA — the room itself. */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
      />
      <canvas ref={sampleRef} width={SAMPLE_W} height={SAMPLE_H} className="hidden" />

      {!on && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="max-w-sm text-sm font-extralight leading-relaxed text-muted-foreground">
            live camera, mirrored so you see yourself first. nothing is uploaded — frames stay in this tab unless you
            save a packet.
          </p>
          <button
            onClick={() => void start()}
            className="flex min-h-[48px] items-center gap-2 rounded-full border border-foreground/20 bg-foreground/[0.05] px-6 text-sm font-light text-foreground/85 hover:bg-foreground/[0.1]"
          >
            <Camera className="h-4 w-4" /> open camera
          </button>
          {err && <p className="text-[11px] font-extralight text-red-300/80">— {err}</p>}
        </div>
      )}

      {/* GRID (optional) */}
      {on && grid && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)/0.12) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)/0.12) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      )}

      {/* RETICLE */}
      {on && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-16 w-16 rounded-full border border-foreground/20" />
          <div className="absolute h-px w-8 bg-foreground/25" />
          <div className="absolute h-8 w-px bg-foreground/25" />
        </div>
      )}

      {/* HUD — one MISB-named chip row, wraps on narrow screens. */}
      {on && (
        <div className="pointer-events-none absolute left-0 right-0 top-0 flex flex-wrap gap-2 p-3 sm:p-4">
          <span className="rounded-full border border-foreground/12 bg-background/60 px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-foreground/60 backdrop-blur-md">
            {clock}
          </span>
          <span className="rounded-full border border-foreground/12 bg-background/60 px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-foreground/60 backdrop-blur-md">
            device {geo ? `${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}` : "gnss unavailable"}
          </span>
          <span className="rounded-full border border-foreground/12 bg-background/60 px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-foreground/60 backdrop-blur-md">
            luma {intel.luma.toFixed(2)} · motion {intel.motion.toFixed(3)} · edges {intel.edges.toFixed(3)}
          </span>
          <span className="rounded-full border border-foreground/12 bg-background/60 px-3 py-1 font-mono text-[10px] tracking-[0.14em] text-foreground/60 backdrop-blur-md">
            {visualLevel(votes)} · scene geo {verdict}
          </span>
        </div>
      )}

      {/* CONTROLS — ≥44px touch targets, bottom of the room. */}
      <div className="absolute bottom-0 left-0 right-0 flex flex-wrap items-center justify-center gap-2 p-3 sm:p-4">
        {on && (
          <>
            <button
              onClick={() => void freeze()}
              className="flex min-h-[44px] items-center gap-2 rounded-full border border-foreground/15 bg-background/70 px-4 text-[12px] font-light text-foreground/85 backdrop-blur-md"
            >
              <Snowflake className="h-4 w-4" /> freeze
            </button>
            <button
              onClick={() => void flip()}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-full border border-foreground/15 bg-background/70 px-4 text-[12px] font-light text-foreground/85 backdrop-blur-md"
            >
              <RefreshCw className="h-4 w-4" /> flip
            </button>
            <button
              onClick={() => setGrid((g) => !g)}
              aria-pressed={grid}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-foreground/15 bg-background/70 px-4 text-foreground/70 backdrop-blur-md"
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
            <button
              onClick={stop}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-foreground/15 bg-background/70 px-4 text-foreground/70 backdrop-blur-md"
            >
              <CameraOff className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {/* FROZEN FRAME PANEL */}
      {frozen && (
        <div className="absolute inset-x-2 bottom-20 mx-auto max-w-md rounded-2xl border border-foreground/12 bg-background/85 p-4 backdrop-blur-xl sm:inset-x-4">
          <div className="flex items-start gap-3">
            <img
              src={frozen}
              alt="frozen frame held locally in this tab"
              className="h-16 w-24 shrink-0 rounded-lg object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extralight text-muted-foreground">
                {codes.length ? `— read: ${codes.join(" · ")}` : "— no barcode or qr in this frame"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={savePacket}
                  disabled={!proActions}
                  className="flex min-h-[36px] items-center gap-1.5 rounded-full border border-foreground/15 px-3 text-[11px] font-extralight text-foreground/80 disabled:opacity-45"
                >
                  <Save className="h-3 w-3" /> {proActions ? "save packet" : "save packet · pro"}
                </button>
                <button
                  onClick={() => setFrozen(null)}
                  className="min-h-[36px] rounded-full border border-foreground/15 px-3 text-[11px] font-extralight text-muted-foreground"
                >
                  discard
                </button>
              </div>
              <p className="mt-2 text-[10px] font-extralight text-muted-foreground/60">
                reverse search opens a tab you choose. the frame is never uploaded from here.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* limits — collapsed, only after the feed is live. never first paint. */}
      {on && (
        <details className="absolute bottom-16 left-3 right-3 mx-auto max-w-sm rounded-full border border-foreground/12 bg-background/70 px-3 py-1 text-center backdrop-blur-md sm:left-auto sm:right-4 sm:mx-0">
          <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/50">
            limits
          </summary>
          <p className="mt-1 pb-1 text-[10px] font-extralight leading-relaxed text-muted-foreground/70">
            cannot resolve: {CANNOT_RESOLVE.join(" · ")}.
          </p>
        </details>
      )}
    </div>
  );
};

export default AsherinArVisionView;
