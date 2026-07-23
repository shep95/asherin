// FalconOverlay — draws plate + fingerprint + hotlist chips over vehicle bboxes
// on the AR canvas. Owns its own ALPR handle so ZaxinView stays thin.
import { useCallback, useEffect, useRef, useState } from "react";
import type { VehicleTrack } from "./core/vehicleTracking";
import { startFalconAlpr, type FalconHandle, type FalconRead } from "@/lib/zaxin/falcon/alpr";
import { logSighting } from "@/lib/zaxin/falcon/sightings";
import { warmHotlist } from "@/lib/zaxin/falcon/hotlist";

interface Props {
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  tracks: VehicleTrack[];
  arOn: boolean;
  falconOn: boolean;
  projectBbox: (b: { x: number; y: number; w: number; h: number }) => {
    leftPct: number; topPct: number; widthPct: number; heightPct: number;
  } | null;
  heading: number | null;
  geo: { lat: number | null; lng: number | null };
}

export default function FalconOverlay(props: Props) {
  const [reads, setReads] = useState<Map<string, FalconRead>>(new Map());
  const handleRef = useRef<FalconHandle | null>(null);
  const tracksRef = useRef<VehicleTrack[]>([]);
  tracksRef.current = props.tracks;

  useEffect(() => {
    let cancelled = false;
    warmHotlist();
    if (!props.arOn || !props.falconOn || !props.videoRef.current) return;
    (async () => {
      try {
        const h = await startFalconAlpr({
          video: props.videoRef.current!,
          getTracks: () => tracksRef.current,
          onUpdate: (m) => { if (!cancelled) setReads(new Map(m)); },
        });
        if (cancelled) { h.stop(); return; }
        handleRef.current = h;
        // Log sighting on every newly confirmed plate read.
        h.onHit(() => { /* handled inline below */ });
      } catch (e) {
        console.warn("[falcon-overlay] failed to start ALPR", e);
      }
    })();
    return () => {
      cancelled = true;
      handleRef.current?.stop();
      handleRef.current = null;
      setReads(new Map());
    };
  }, [props.arOn, props.falconOn, props.videoRef]);

  // Log sightings whenever a NEW confirmed plate appears
  const loggedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const r of reads.values()) {
      if (!r.confirmedTs || !r.plate || !r.plateHash) continue;
      const key = `${r.plateHash}:${r.confirmedTs}`;
      if (loggedRef.current.has(key)) continue;
      loggedRef.current.add(key);
      logSighting({
        plateHash: r.plateHash,
        plate: r.plate,
        ts: r.confirmedTs,
        lat: props.geo.lat ?? undefined,
        lng: props.geo.lng ?? undefined,
        bearingDeg: props.heading ?? null,
        color: r.fingerprint?.colorName,
        bodyClass: r.fingerprint?.bodyClass,
      });
    }
  }, [reads, props.geo.lat, props.geo.lng, props.heading]);

  if (!props.arOn || !props.falconOn) return null;

  return (
    <>
      {props.tracks.map((t) => {
        const p = props.projectBbox({ x: t.x, y: t.y, w: t.w, h: t.h });
        if (!p) return null;
        const r = reads.get(t.id);
        if (!r) return null;
        const isHit = !!r.hotlist;
        const stroke = isHit
          ? (r.hotlist!.severity === "critical" ? "rgba(248,113,113,0.95)" : "rgba(251,146,60,0.95)")
          : (r.confirmedTs ? "rgba(232,198,132,0.9)" : "rgba(160,160,160,0.6)");
        const glow = isHit ? "0 0 20px -2px rgba(248,113,113,0.6)" : "none";
        return (
          <div
            key={`falcon-${t.id}`}
            className="absolute pointer-events-none transition-[left,top,width,height] duration-150 ease-out"
            style={{
              left: `${p.leftPct}%`, top: `${p.topPct}%`,
              width: `${p.widthPct}%`, height: `${p.heightPct}%`,
              zIndex: 5,
              boxShadow: glow,
            }}
          >
            {/* Chip stack anchored to the bbox — bottom-right so it doesn't
                overlap the vehicleTracking speed/range chip on top-left. */}
            <div className="absolute -bottom-[38px] right-0 flex flex-col items-end gap-0.5">
              {isHit && (
                <div className="text-[9px] font-mono tracking-[0.15em] uppercase px-1.5 py-0.5 rounded-sm bg-rose-500/70 text-white border border-rose-200/70 animate-pulse">
                  ⚠ HOTLIST · {r.hotlist!.severity.toUpperCase()}
                </div>
              )}
              <div className="text-[9px] font-mono tracking-[0.12em] px-1.5 py-0.5 rounded-sm bg-black/85 leading-tight" style={{ color: stroke }}>
                {r.plate ? `⌘ ${r.plate}` : (r.reads > 0 ? "⌘ reading…" : "⌘ scanning…")}
              </div>
              {r.fingerprint && (
                <div className="text-[8px] font-mono tracking-[0.12em] px-1.5 py-0.5 rounded-sm bg-black/70 text-foreground/80 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-sm border border-white/30" style={{ background: r.fingerprint.hex }} />
                  {r.fingerprint.colorName} · {r.fingerprint.bodyClass}
                </div>
              )}
              {isHit && (
                <div className="text-[8px] font-mono tracking-[0.1em] px-1.5 py-0.5 rounded-sm bg-black/80 text-rose-100 max-w-[180px] whitespace-normal">
                  {r.hotlist!.reason}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
