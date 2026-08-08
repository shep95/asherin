// CameraIntelligencePanel — the camera intelligence surface for Asherin Maps.
//
// Why this exists: the camera control used to be a bare toggle that fired a
// fixed 4 km sweep around whatever the map happened to be centred on, then
// dropped pins and said nothing. Off the operator's own ground that sweep
// returns zero cameras, the only feedback was a toast that had usually
// already faded, and a slow agency catalogue left the button disabled with a
// 14px spinner inside it. From the operator's chair: "I clicked cameras and
// nothing happened."
//
// This panel makes the sweep legible:
//  · runs automatically the moment it opens, anchored on the operator fix
//  · escalates 4 km → 15 km → 50 km rather than reporting a false silence
//  · always ends in one of four explicit states: loading / results / empty
//    with the coverage reason / error with a retry
//  · lists every camera with operator, roadway, bearing and distance, and
//    hands focus and live-frame playback back to the map.

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, X, Loader2, RefreshCw, Crosshair, Video, MapPin } from "lucide-react";
import { sweepCamerasEscalating, type StreetCamera } from "@/lib/asher/streetCameras";
import { fmtDistance, type Units } from "@/lib/asher/directions";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Sweep anchor — the operator's own fix when we have one, else map centre. */
  anchor: { lat: number; lng: number };
  /** True when `anchor` came from the GPS rather than the viewport. */
  anchorIsOperator: boolean;
  units: Units;
  onResults: (cams: StreetCamera[]) => void;
  onFocus: (c: StreetCamera) => void;
  onFit: (cams: StreetCamera[]) => void;
}

type Phase = "idle" | "loading" | "ready" | "empty" | "error";

const CameraIntelligencePanel = ({
  open, onClose, anchor, anchorIsOperator, units, onResults, onFocus, onFit,
}: Props) => {
  const [cams, setCams] = useState<StreetCamera[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [note, setNote] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [radiusM, setRadiusM] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* Callbacks arrive as fresh identities every parent render. Held in refs so
     the sweep effect keys on the anchor alone and never re-fires on a repaint. */
  const cbRef = useRef({ onResults, onFit });
  cbRef.current = { onResults, onFit };

  const run = useCallback(async (center: { lat: number; lng: number }, fit: boolean) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setPhase("loading");
    setNote(null);
    try {
      const sweep = await sweepCamerasEscalating(center, { signal: ctrl.signal, timeoutMs: 30_000 });
      if (ctrl.signal.aborted) return;
      setCams(sweep.cameras);
      setSources(sweep.sources);
      setRadiusM(sweep.radiusM);
      cbRef.current.onResults(sweep.cameras);
      if (sweep.cameras.length) {
        setPhase("ready");
        if (fit) cbRef.current.onFit(sweep.cameras);
      } else {
        setPhase("empty");
        setNote(sweep.coverageNote || "No agency publishes an open camera feed within 50 km of this point.");
      }
    } catch (e: unknown) {
      if (ctrl.signal.aborted) return;
      setPhase("error");
      setNote(e instanceof Error ? e.message : "Camera catalogue unavailable.");
    }
  }, []);

  // Auto-run on open and whenever the anchor genuinely moves (>250 m).
  const lastAnchorRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const prev = lastAnchorRef.current;
    const moved =
      !prev ||
      Math.abs(prev.lat - anchor.lat) > 0.0025 ||
      Math.abs(prev.lng - anchor.lng) > 0.0025;
    if (!moved) return;
    lastAnchorRef.current = { lat: anchor.lat, lng: anchor.lng };
    void run({ lat: anchor.lat, lng: anchor.lng }, true);
  }, [open, anchor.lat, anchor.lng, run]);

  // Closing the panel must cancel the flight, not leave it writing into a
  // component the operator has already dismissed.
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      lastAnchorRef.current = null;
    }
  }, [open]);
  useEffect(() => () => abortRef.current?.abort(), []);

  if (!open) return null;

  const busy = phase === "loading";

  return (
    <div className="flex max-h-[calc(100vh-8rem)] w-[340px] flex-col overflow-hidden rounded-xl border border-[#c98b3a]/25 bg-card/95 backdrop-blur-xl shadow-[0_18px_50px_-12px_rgba(0,0,0,.85)]">
      <div className="flex items-center gap-2 border-b border-border/15 px-3 py-2.5">
        <CameraIcon className="h-4 w-4 text-[#c98b3a]" strokeWidth={1.6} />
        <p className="flex-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Camera intelligence
        </p>
        <button
          onClick={() => run({ lat: anchor.lat, lng: anchor.lng }, true)}
          disabled={busy}
          aria-label="Re-run camera sweep"
          className="rounded p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground disabled:opacity-40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin motion-reduce:animate-none" : ""}`} />
        </button>
        <button
          onClick={onClose}
          aria-label="Close camera intelligence"
          className="rounded p-0.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-border/15 px-3 py-2 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
        <Crosshair className="h-3 w-3 text-[#c98b3a]" />
        <span>{anchorIsOperator ? "Operator position" : "Map centre"}</span>
        <span className="text-muted-foreground/50">
          {anchor.lat.toFixed(4)}, {anchor.lng.toFixed(4)}
        </span>
        {radiusM !== null && (
          <span className="ml-auto text-muted-foreground/60">{fmtDistance(radiusM, units)}</span>
        )}
      </div>

      <div aria-live="polite" className="flex-1 overflow-y-auto">
        {busy && (
          <div className="space-y-2 p-3">
            <p className="text-[10px] font-light text-muted-foreground">
              Sweeping public agency catalogues — widening until a feed answers.
            </p>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-foreground/5 motion-reduce:animate-none" aria-hidden />
            ))}
          </div>
        )}

        {phase === "empty" && (
          <div className="space-y-2 p-3">
            <p role="status" className="text-[10px] leading-snug text-amber-400">{note}</p>
            <p className="text-[10px] leading-snug text-muted-foreground/70">
              Move the map over a corridor covered by a state DOT or city traffic authority and re-run.
            </p>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-2 p-3">
            <p role="alert" className="text-[10px] leading-snug text-red-400">{note}</p>
            <button
              onClick={() => run({ lat: anchor.lat, lng: anchor.lng }, true)}
              className="rounded-md border border-[#c98b3a]/40 bg-[#c98b3a]/10 px-2 py-1 text-[10px] text-[#e0a955] hover:bg-[#c98b3a]/20"
            >
              Retry sweep
            </button>
          </div>
        )}

        {phase === "ready" && cams.map((c) => (
          <button
            key={c.id}
            onClick={() => onFocus(c)}
            className="block w-full border-b border-border/10 px-3 py-2 text-left hover:bg-foreground/5"
          >
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
              {c.streamUrl || c.imageUrl
                ? <Video className="h-3 w-3 shrink-0 text-[#c98b3a]" />
                : <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />}
              <span className="truncate">{c.name}</span>
            </p>
            <p className="mt-0.5 text-[10px] font-light text-muted-foreground">
              {[c.roadway, c.direction].filter(Boolean).join(" · ") || c.source}
              {c.distanceM !== undefined ? ` · ${fmtDistance(c.distanceM, units)}` : ""}
            </p>
            <p className="text-[9px] font-light text-muted-foreground/60">
              {c.operator || c.source}
              {c.streamUrl || c.imageUrl ? " · live frame available" : " · position only"}
            </p>
          </button>
        ))}
      </div>

      <p className="border-t border-border/15 px-3 py-1.5 text-[9px] text-muted-foreground/60">
        {phase === "ready"
          ? `${cams.length} camera${cams.length === 1 ? "" : "s"} · ${sources.join(", ") || "public agency feeds"}`
          : "Public agency CCTV and OSM-tagged devices only."}
      </p>
    </div>
  );
};

export default CameraIntelligencePanel;
