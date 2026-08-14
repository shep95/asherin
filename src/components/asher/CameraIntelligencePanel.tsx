// CameraIntelligencePanel â the camera intelligence surface for Asherin Maps.
//
// Public agency stills + OSM-tagged devices + URLs the operator pastes.
// Ring / Flock / private NVR live taps need that owner's login â this panel
// does not hijack them. Empty catalogue = gap, never a simulated pin.

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, X, Loader2, RefreshCw, Crosshair, Video, MapPin, Link2 } from "lucide-react";
import { liveFrameUrl, sweepCamerasEscalating, type StreetCamera } from "@/lib/asher/streetCameras";
import { fmtDistance, type Units } from "@/lib/asher/directions";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Sweep anchor â the operator's own fix when we have one, else map centre. */
  anchor: { lat: number; lng: number };
  /** True when `anchor` came from the GPS rather than the viewport. */
  anchorIsOperator: boolean;
  units: Units;
  onResults: (cams: StreetCamera[]) => void;
  onFocus: (c: StreetCamera) => void;
  onFit: (cams: StreetCamera[]) => void;
}

type Phase = "idle" | "loading" | "ready" | "empty" | "error";

const OP_KEY = "asherin-maps-operator-cameras";

function loadOperatorCams(): StreetCamera[] {
  try {
    const rows = JSON.parse(localStorage.getItem(OP_KEY) || "[]");
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function saveOperatorCams(rows: StreetCamera[]) {
  try {
    localStorage.setItem(OP_KEY, JSON.stringify(rows.slice(0, 40)));
  } catch {
    /* quota */
  }
}

const CameraIntelligencePanel = ({
  open,
  onClose,
  anchor,
  anchorIsOperator,
  units,
  onResults,
  onFocus,
  onFit,
}: Props) => {
  const [cams, setCams] = useState<StreetCamera[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [note, setNote] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [radiusM, setRadiusM] = useState<number | null>(null);
  const [pasteUrl, setPasteUrl] = useState("");
  const [pasteName, setPasteName] = useState("");
  const [tick, setTick] = useState(() => Date.now());
  const abortRef = useRef<AbortController | null>(null);

  /* Callbacks arrive as fresh identities every parent render. Held in refs so
     the sweep effect keys on the anchor alone and never re-fires on a repaint. */
  const cbRef = useRef({ onResults, onFit });
  cbRef.current = { onResults, onFit };

  const publish = useCallback((agency: StreetCamera[], extraSources: string[], r: number | null) => {
    const owned = loadOperatorCams();
    const merged = [...owned, ...agency];
    setCams(merged);
    const src = [...new Set([...owned.map((c) => c.source), ...extraSources])];
    setSources(src);
    cbRef.current.onResults(merged);
    if (merged.length) {
      setPhase("ready");
      if (r != null) cbRef.current.onFit(merged);
    }
  }, []);

  const run = useCallback(
    async (center: { lat: number; lng: number }, fit: boolean) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setPhase("loading");
      setNote(null);
      try {
        const sweep = await sweepCamerasEscalating(center, { signal: ctrl.signal, timeoutMs: 30_000 });
        if (ctrl.signal.aborted) return;
        setRadiusM(sweep.radiusM);
        const owned = loadOperatorCams();
        if (sweep.cameras.length || owned.length) {
          publish(sweep.cameras, sweep.sources, fit ? sweep.radiusM : null);
        } else {
          setCams([]);
          setSources(sweep.sources);
          setPhase("empty");
          setNote(sweep.coverageNote || "No agency publishes an open camera feed within 50 km of this point.");
        }
      } catch (e: unknown) {
        if (ctrl.signal.aborted) return;
        const owned = loadOperatorCams();
        if (owned.length) {
          publish([], ["your URL"], null);
          setNote(e instanceof Error ? e.message : "Agency catalogue unavailable â your pasted feeds still show.");
        } else {
          setPhase("error");
          setNote(e instanceof Error ? e.message : "Camera catalogue unavailable.");
        }
      }
    },
    [publish],
  );

  // Auto-run on open and whenever the anchor genuinely moves (>250 m).
  const lastAnchorRef = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!open) return;
    const prev = lastAnchorRef.current;
    const moved = !prev || Math.abs(prev.lat - anchor.lat) > 0.0025 || Math.abs(prev.lng - anchor.lng) > 0.0025;
    if (!moved) return;
    lastAnchorRef.current = { lat: anchor.lat, lng: anchor.lng };
    void run({ lat: anchor.lat, lng: anchor.lng }, true);
  }, [open, anchor.lat, anchor.lng, run]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      lastAnchorRef.current = null;
    }
  }, [open]);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick(Date.now()), 2000);
    return () => window.clearInterval(id);
  }, [open]);

  const addOwnFeed = () => {
    const url = pasteUrl.trim();
    if (!url || !/^https?:\/\//i.test(url)) return;
    const isStream = /\.m3u8(\?|$)/i.test(url) || /rtsp:/i.test(url) || /mjpeg|mjpg/i.test(url);
    const cam: StreetCamera = {
      id: "op-" + Date.now().toString(36),
      lat: anchor.lat,
      lng: anchor.lng,
      name: pasteName.trim() || "your camera",
      source: "operator URL",
      operator: "you",
      imageUrl: isStream ? undefined : url,
      streamUrl: isStream ? url : undefined,
    };
    const next = [cam, ...loadOperatorCams()].slice(0, 40);
    saveOperatorCams(next);
    setPasteUrl("");
    setPasteName("");
    publish(
      cams.filter((c) => !String(c.id).startsWith("op-")),
      ["your URL"],
      null,
    );
  };

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
        {radiusM !== null && <span className="ml-auto text-muted-foreground/60">{fmtDistance(radiusM, units)}</span>}
      </div>

      <div className="space-y-1.5 border-b border-border/15 px-3 py-2">
        <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
          <Link2 className="h-3 w-3" />
          Connect a feed you own
        </p>
        <input
          value={pasteName}
          onChange={(e) => setPasteName(e.target.value)}
          placeholder="label (optional)"
          className="w-full rounded-md border border-border/30 bg-background/40 px-2 py-1 text-[11px] text-foreground outline-none placeholder:text-muted-foreground/50"
        />
        <input
          value={pasteUrl}
          onChange={(e) => setPasteUrl(e.target.value)}
          placeholder="https://â¦ still / mjpeg / .m3u8"
          className="w-full rounded-md border border-border/30 bg-background/40 px-2 py-1 text-[11px] text-foreground outline-none placeholder:text-muted-foreground/50"
        />
        <button
          type="button"
          onClick={addOwnFeed}
          className="rounded-md border border-[#c98b3a]/40 bg-[#c98b3a]/10 px-2 py-1 text-[10px] text-[#e0a955] hover:bg-[#c98b3a]/20"
        >
          Add this URL at the pin
        </button>
        <p className="text-[9px] leading-snug text-muted-foreground/70">
          Public DOT / OSM stills auto-pull. Ring, Flock, and private NVRs only connect if you paste a URL you already
          have â this map does not log into someone else's camera.
        </p>
      </div>

      <div aria-live="polite" className="flex-1 overflow-y-auto">
        {busy && (
          <div className="space-y-2 p-3">
            <p className="text-[10px] font-light text-muted-foreground">
              Sweeping public agency catalogues â widening until a feed answers.
            </p>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-md bg-foreground/5 motion-reduce:animate-none"
                aria-hidden
              />
            ))}
          </div>
        )}

        {phase === "empty" && (
          <div className="space-y-2 p-3">
            <p role="status" className="text-[10px] leading-snug text-amber-400">
              {note}
            </p>
            <p className="text-[10px] leading-snug text-muted-foreground/70">
              Move the map over a corridor covered by a state DOT or city traffic authority and re-run â or paste a feed
              you own above.
            </p>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-2 p-3">
            <p role="alert" className="text-[10px] leading-snug text-red-400">
              {note}
            </p>
            <button
              onClick={() => run({ lat: anchor.lat, lng: anchor.lng }, true)}
              className="rounded-md border border-[#c98b3a]/40 bg-[#c98b3a]/10 px-2 py-1 text-[10px] text-[#e0a955] hover:bg-[#c98b3a]/20"
            >
              Retry sweep
            </button>
          </div>
        )}

        {(phase === "ready" || cams.length > 0) &&
          cams.map((c) => {
            const frame = liveFrameUrl(c, tick);
            return (
              <button
                key={c.id}
                onClick={() => onFocus(c)}
                className="block w-full border-b border-border/10 px-3 py-2 text-left hover:bg-foreground/5"
              >
                {frame && (
                  <img
                    src={frame}
                    alt=""
                    width={300}
                    height={84}
                    className="mb-1.5 h-[84px] w-full rounded-md bg-black/40 object-cover"
                  />
                )}
                <p className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                  {c.streamUrl || c.imageUrl ? (
                    <Video className="h-3 w-3 shrink-0 text-[#c98b3a]" />
                  ) : (
                    <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{c.name}</span>
                </p>
                <p className="mt-0.5 text-[10px] font-light text-muted-foreground">
                  {[c.roadway, c.direction].filter(Boolean).join(" Â· ") || c.source}
                  {c.distanceM !== undefined ? ` Â· ${fmtDistance(c.distanceM, units)}` : ""}
                </p>
                <p className="text-[9px] font-light text-muted-foreground/60">
                  {c.operator || c.source}
                  {c.streamUrl || c.imageUrl ? " Â· live frame available" : " Â· position only"}
                </p>
              </button>
            );
          })}
      </div>

      <p className="border-t border-border/15 px-3 py-1.5 text-[9px] text-muted-foreground/60">
        {phase === "ready" || cams.length
          ? `${cams.length} camera${cams.length === 1 ? "" : "s"} Â· ${sources.join(", ") || "public agency feeds"}`
          : "Public agency CCTV and OSM-tagged devices only â plus URLs you paste."}
      </p>
    </div>
  );
};

export default CameraIntelligencePanel;
