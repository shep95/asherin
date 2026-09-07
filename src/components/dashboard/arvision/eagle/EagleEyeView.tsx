// eagle.eye — plug-and-play behavioural camera layer.
//
// the premise: an operator with ordinary webcams, phone cameras or usb cameras
// should get the part of an expensive security system that actually matters —
// something watching the patterns a tired human misses — without a server, a
// subscription per camera, or a frame ever leaving the device.
//
// what this is not: it is not identification, it does not read faces, it does
// not decide that anyone is a criminal. it recognises movement and posture
// patterns, scores them, and hands a human a package to look at. every surface
// in this view repeats that boundary because an operator who forgets it will
// misuse the output.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Bluetooth, Camera, CheckCircle2, CircleSlash, Download,
  Eye, Loader2, Maximize2, Play, ShieldAlert, Square, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  createCameraConfig, createDefaultZones, createTemporalStore, processFrame,
  renderAnnotatedScreenshot,
  type CameraConfig, type DetectedObject, type TemporalStore, type ThreatEvent,
  type ThreatTier, type TrackedEntity,
} from "./engine";
import { IouTracker, detectFrame, loadModels, type ModelStatus } from "./detector";
import { grabCanvas, filteredCanvas, FILTER_MODES, type FilterMode } from "./filters";
import { captureContext, cacheFix, contextLine } from "./context";
import {
  buildEvidence, downloadBlob, exportEvidenceZip, manifestFor,
  EVIDENCE_DISCLAIMER, type EvidenceRecord,
} from "./evidence";
import {
  bluetoothSupported, closeStream, listVideoInputs, openCamera, pairBleDevice,
  primePermissions, type BleLink,
} from "./cameras";

const TIER_STYLE: Record<ThreatTier, { ring: string; text: string; chip: string }> = {
  observation: { ring: "#3B82F6", text: "text-sky-300/80", chip: "border-sky-400/25 bg-sky-400/10 text-sky-200/90" },
  elevated: { ring: "#F59E0B", text: "text-amber-300/90", chip: "border-amber-400/25 bg-amber-400/10 text-amber-200/90" },
  high: { ring: "#EF4444", text: "text-rose-300/90", chip: "border-rose-400/25 bg-rose-400/10 text-rose-200/90" },
  critical: { ring: "#7C3AED", text: "text-violet-300/90", chip: "border-violet-400/25 bg-violet-400/10 text-violet-200/90" },
};

const CAPTURE_TIERS: ThreatTier[] = ["elevated", "high", "critical"];
const PER_TRACK_COOLDOWN_MS = 15_000;

interface Runtime {
  video: HTMLVideoElement;
  stream: MediaStream;
  tracker: IouTracker;
  entities: Map<string, TrackedEntity>;
  objects: Map<string, DetectedObject>;
  temporal: TemporalStore;
  config: CameraConfig;
  lastCaptureByTrack: Map<string, number>;
  overlay: HTMLCanvasElement | null;
  lastObjects: DetectedObject[];
  lastInferenceMs: number;
  personCount: number;
}

interface TileState {
  deviceId: string;
  label: string;
  status: "opening" | "live" | "failed";
  error: string | null;
  personCount: number;
  inferenceMs: number;
}

export default function EagleEyeView() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [permission, setPermission] = useState<"unknown" | "granted" | "denied">("unknown");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [tiles, setTiles] = useState<TileState[]>([]);
  const [running, setRunning] = useState(false);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [modelError, setModelError] = useState<string | null>(null);
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [openRecord, setOpenRecord] = useState<EvidenceRecord | null>(null);
  const [openVariant, setOpenVariant] = useState(0);
  const [ble, setBle] = useState<BleLink[]>([]);
  const [preview, setPreview] = useState<FilterMode>("clean");
  const [quad, setQuad] = useState(false);
  // a camera that just recorded something flashes until a human looks at it.
  const [alerted, setAlerted] = useState<Record<string, number>>({});
  const [full, setFull] = useState<{ deviceId: string; mode: FilterMode } | null>(null);
  const [captureFrom, setCaptureFrom] = useState<ThreatTier>("elevated");
  const [exporting, setExporting] = useState(false);
  const [contextNote, setContextNote] = useState<string>("capture context resolves on the first recorded event");

  const runtimes = useRef<Map<string, Runtime>>(new Map());
  const loopRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const runningRef = useRef(false);
  const capturingRef = useRef(false);

  const captureThresholdIndex = CAPTURE_TIERS.indexOf(captureFrom);

  // ---- devices ------------------------------------------------------------
  const refreshDevices = useCallback(async () => {
    const list = await listVideoInputs();
    setDevices(list);
    return list;
  }, []);

  useEffect(() => {
    void refreshDevices();
    const handler = () => void refreshDevices();
    navigator.mediaDevices?.addEventListener?.("devicechange", handler);
    // a live gps watch keeps a fresh fix ready so a capture is never delayed
    // waiting on the platform while the behaviour is still in frame.
    let watchId: number | null = null;
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(cacheFix, () => undefined, { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 });
    }
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", handler);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [refreshDevices]);

  const grantPermission = useCallback(async () => {
    const res = await primePermissions();
    setPermission(res.granted ? "granted" : "denied");
    setPermissionError(res.error);
    if (res.granted) await refreshDevices();
    else toast.error("camera access refused", { description: res.error ?? "the browser blocked this site's camera request" });
  }, [refreshDevices]);

  // ---- camera lifecycle ---------------------------------------------------
  const attachCamera = useCallback(async (device: MediaDeviceInfo) => {
    if (runtimes.current.has(device.deviceId)) return;
    const label = device.label || `camera ${runtimes.current.size + 1}`;
    setTiles((t) => [...t, { deviceId: device.deviceId, label, status: "opening", error: null, personCount: 0, inferenceMs: 0 }]);
    try {
      const stream = await openCamera(device.deviceId);
      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      runtimes.current.set(device.deviceId, {
        video,
        stream,
        tracker: new IouTracker(),
        entities: new Map(),
        objects: new Map(),
        temporal: createTemporalStore(),
        config: createCameraConfig(device.deviceId.slice(0, 12) || label, label, "pending", 0, 0, Intl.DateTimeFormat().resolvedOptions().timeZone, createDefaultZones(w, h)),
        lastCaptureByTrack: new Map(),
        overlay: null,
        lastObjects: [],
        lastInferenceMs: 0,
        personCount: 0,
      });
      setTiles((t) => t.map((x) => (x.deviceId === device.deviceId ? { ...x, status: "live" } : x)));
      setPermission("granted");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "camera could not be opened";
      setTiles((t) => t.map((x) => (x.deviceId === device.deviceId ? { ...x, status: "failed", error: msg } : x)));
      toast.error(`${label} did not open`, { description: msg });
    }
  }, []);

  const detachCamera = useCallback((deviceId: string) => {
    const rt = runtimes.current.get(deviceId);
    if (rt) {
      closeStream(rt.stream);
      rt.video.srcObject = null;
      runtimes.current.delete(deviceId);
    }
    setTiles((t) => t.filter((x) => x.deviceId !== deviceId));
  }, []);

  useEffect(() => () => {
    runningRef.current = false;
    if (loopRef.current) window.clearTimeout(loopRef.current);
    runtimes.current.forEach((rt) => { closeStream(rt.stream); rt.video.srcObject = null; });
    runtimes.current.clear();
  }, []);

  // ---- evidence -----------------------------------------------------------
  const recordEvent = useCallback(async (deviceId: string, rt: Runtime, event: ThreatEvent, entity: TrackedEntity, frame: HTMLCanvasElement) => {
    const ctx = await captureContext();
    setContextNote(contextLine(ctx));
    // the engine's camera config carries whatever the platform actually gave
    // us; unknown stays unknown rather than becoming a zero coordinate.
    rt.config = {
      ...rt.config,
      locationCoords: ctx.coords ? { lat: ctx.coords.lat, lng: ctx.coords.lng } : rt.config.locationCoords,
      ipAddress: ctx.ipAddress ?? "unavailable",
      timezone: ctx.timezone,
    };
    let annotated: string | undefined;
    try {
      annotated = await renderAnnotatedScreenshot(frame.toDataURL("image/jpeg", 0.9), entity, event, frame.width, frame.height);
    } catch {
      annotated = undefined;
    }
    const record = await buildEvidence({
      event: { ...event, locationCoords: rt.config.locationCoords, ipAddress: rt.config.ipAddress, timezone: ctx.timezone },
      frame,
      annotatedDataUrl: annotated,
      context: ctx,
      cameraLabel: rt.config.label,
    });
    setRecords((r) => [record, ...r].slice(0, 200));
    setAlerted((a) => ({ ...a, [deviceId]: Date.now() }));
    toast.warning(`${event.threatTier} pattern on ${rt.config.label}`, {
      description: `${event.patternsTriggered.slice(0, 3).join(", ") || "pattern set recorded"} — captured for human review`,
    });
  }, []);

  // ---- inference loop -----------------------------------------------------
  const tick = useCallback(async () => {
    if (!runningRef.current || busyRef.current) return;
    busyRef.current = true;
    try {
      const models = await loadModels();
      for (const [deviceId, rt] of runtimes.current) {
        if (!runningRef.current) break;
        const vw = rt.video.videoWidth;
        const vh = rt.video.videoHeight;
        if (!vw || !vh) continue;
        const frame = grabCanvas(rt.video, vw, vh, 960);
        const det = await detectFrame(frame, rt.tracker, models, rt.objects);
        rt.lastInferenceMs = det.inferenceMs;
        rt.personCount = det.persons.length;

        const out = processFrame(
          {
            frameBase64: "",
            frameTimestamp: Date.now(),
            camera: rt.config,
            detectedPersons: det.persons.map((p) => ({
              trackId: p.trackId,
              boundingBox: p.boundingBox,
              poseLandmarks: p.poseLandmarks,
              estimatedSpeed: p.estimatedSpeed,
            })),
            detectedObjects: [...det.objects, ...det.vehicles],
            temporalStore: rt.temporal,
          },
          rt.entities,
        );
        rt.entities = out.updatedEntities;
        rt.lastObjects = [...det.objects, ...det.vehicles];
        drawOverlay(rt, det.persons.map((p) => ({ trackId: p.trackId, box: p.boundingBox })), frame.width, frame.height);

        if (!capturingRef.current) {
          for (const ev of out.newThreatEvents) {
            const idx = CAPTURE_TIERS.indexOf(ev.threatTier);
            if (idx < 0 || idx < captureThresholdIndex) continue;
            const last = rt.lastCaptureByTrack.get(ev.trackId) ?? 0;
            if (Date.now() - last < PER_TRACK_COOLDOWN_MS) continue;
            const entity = rt.entities.get(ev.trackId);
            if (!entity) continue;
            rt.lastCaptureByTrack.set(ev.trackId, Date.now());
            capturingRef.current = true;
            try {
              await recordEvent(deviceId, rt, ev, entity, frame);
            } finally {
              capturingRef.current = false;
            }
            break; // one package per camera per cycle keeps the loop responsive
          }
        }

        setTiles((t) => t.map((x) => (x.deviceId === deviceId ? { ...x, personCount: rt.personCount, inferenceMs: Math.round(rt.lastInferenceMs) } : x)));
      }
    } catch (e) {
      setModelError(e instanceof Error ? e.message : "the detection pass failed");
    } finally {
      busyRef.current = false;
      if (runningRef.current) loopRef.current = window.setTimeout(() => void tick(), 220);
    }
  }, [captureThresholdIndex, recordEvent]);

  const drawOverlay = (rt: Runtime, boxes: Array<{ trackId: string; box: { x: number; y: number; width: number; height: number } }>, w: number, h: number) => {
    const canvas = rt.overlay;
    if (!canvas) return;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    for (const b of boxes) {
      const entity = rt.entities.get(b.trackId);
      const tier: ThreatTier = entity?.threatTier ?? "observation";
      ctx.strokeStyle = TIER_STYLE[tier].ring;
      ctx.lineWidth = tier === "observation" ? 1.5 : 2.5;
      ctx.strokeRect(b.box.x, b.box.y, b.box.width, b.box.height);
      const label = `${b.trackId.slice(0, 10)} · ${tier}${entity ? ` ${entity.threatScore}` : ""}`;
      ctx.font = "12px ui-monospace, monospace";
      const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(b.box.x, Math.max(0, b.box.y - 18), tw, 17);
      ctx.fillStyle = TIER_STYLE[tier].ring;
      ctx.fillText(label, b.box.x + 5, Math.max(11, b.box.y - 5));
    }
    // the object pass the optical hud draws too: coco-ssd classes with the
    // engine's abandoned flag. objects are named, never people.
    for (const obj of rt.lastObjects) {
      const box = obj.boundingBox;
      const warn = obj.isAbandoned;
      ctx.strokeStyle = warn ? "#F59E0B" : "rgba(255,255,255,0.5)";
      ctx.lineWidth = warn ? 2 : 1.2;
      ctx.setLineDash(warn ? [] : [5, 4]);
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.setLineDash([]);
      const label = warn ? `${obj.label} · unattended` : obj.label;
      ctx.font = "11px ui-monospace, monospace";
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(box.x, box.y + box.height + 2, tw, 15);
      ctx.fillStyle = warn ? "#FBBF24" : "rgba(255,255,255,0.75)";
      ctx.fillText(label, box.x + 4, box.y + box.height + 13);
    }
  };

  const start = useCallback(async () => {
    if (runtimes.current.size === 0) {
      toast.error("no camera attached", { description: "attach at least one camera before starting the watch" });
      return;
    }
    setModelStatus("loading");
    setModelError(null);
    try {
      await loadModels();
      setModelStatus("ready");
    } catch (e) {
      setModelStatus("failed");
      setModelError(e instanceof Error ? e.message : "the on-device models could not load");
      toast.error("detection models did not load", { description: "eagle.eye will not guess without them" });
      return;
    }
    runningRef.current = true;
    setRunning(true);
    void tick();
  }, [tick]);

  const stop = useCallback(() => {
    runningRef.current = false;
    setRunning(false);
    if (loopRef.current) window.clearTimeout(loopRef.current);
  }, []);

  // ---- review + export ----------------------------------------------------
  const review = (recordId: string, state: EvidenceRecord["reviewState"]) => {
    setRecords((r) => r.map((x) => (x.recordId === recordId ? { ...x, reviewState: state, reviewedAtMs: Date.now() } : x)));
    setOpenRecord((cur) => (cur && cur.recordId === recordId ? { ...cur, reviewState: state, reviewedAtMs: Date.now() } : cur));
  };

  const exportAll = async (subset: EvidenceRecord[], name: string) => {
    if (subset.length === 0) { toast.error("nothing to export yet"); return; }
    setExporting(true);
    try {
      const blob = await exportEvidenceZip(subset);
      downloadBlob(blob, name);
      toast.success("evidence package written", { description: `${subset.length} event${subset.length === 1 ? "" : "s"} with manifest, hashes and printable report` });
    } catch (e) {
      toast.error("export failed", { description: e instanceof Error ? e.message : "the package could not be written" });
    } finally {
      setExporting(false);
    }
  };

  const attachedIds = useMemo(() => new Set(tiles.map((t) => t.deviceId)), [tiles]);
  const confirmed = records.filter((r) => r.reviewState === "confirmed");

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-3 p-3 text-white/85">
      {/* command strip */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
        <span className="flex items-center gap-2 text-[13px] font-light tracking-wide">
          <Eye className="h-4 w-4 text-white/60" /> eagle.eye
        </span>
        <span className="text-[11px] font-light text-white/40">behavioural watch on cameras you already own · all inference stays on this device</span>
        <div className="ml-auto flex items-center gap-2">
          {!running ? (
            <Button size="sm" onClick={() => void start()} className="h-8 rounded-full bg-white/10 text-[12px] font-light hover:bg-white/15">
              {modelStatus === "loading" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1.5 h-3.5 w-3.5" />} start watch
            </Button>
          ) : (
            <Button size="sm" onClick={stop} className="h-8 rounded-full bg-rose-500/15 text-[12px] font-light text-rose-200 hover:bg-rose-500/25">
              <Square className="mr-1.5 h-3.5 w-3.5" /> stop watch
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={exporting || records.length === 0} onClick={() => void exportAll(records, `eagle-eye-evidence-${Date.now()}.zip`)} className="h-8 rounded-full text-[12px] font-light">
            {exporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />} export all
          </Button>
          <Button size="sm" variant="ghost" disabled={exporting || confirmed.length === 0} onClick={() => void exportAll(confirmed, `eagle-eye-confirmed-${Date.now()}.zip`)} className="h-8 rounded-full text-[12px] font-light">
            police package ({confirmed.length})
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-3">
        {/* left: cameras */}
        <div className="flex min-h-0 w-[230px] shrink-0 flex-col gap-2 overflow-y-auto rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">cameras</div>
          {permission !== "granted" && (
            <button onClick={() => void grantPermission()} className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-left text-[12px] font-light text-white/70 hover:bg-white/[0.07]">
              <Camera className="mb-1 h-3.5 w-3.5" />
              <div>allow camera access</div>
              <div className="text-[10.5px] text-white/40">{permissionError ?? "device names stay hidden until one grant happens"}</div>
            </button>
          )}
          {devices.length === 0 && <div className="text-[11.5px] font-light text-white/40">no video input is exposed by this device</div>}
          {devices.map((d, i) => {
            const on = attachedIds.has(d.deviceId);
            return (
              <button
                key={d.deviceId || i}
                onClick={() => (on ? detachCamera(d.deviceId) : void attachCamera(d))}
                className={`rounded-xl border px-3 py-2 text-left text-[12px] font-light transition ${on ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100/90" : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]"}`}
              >
                <div className="truncate">{d.label || `camera ${i + 1}`}</div>
                <div className="text-[10.5px] text-white/40">{on ? "attached — tap to release" : "tap to attach"}</div>
              </button>
            );
          })}

          <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/35">bluetooth</div>
          <button
            disabled={!bluetoothSupported()}
            onClick={async () => {
              try {
                const link = await pairBleDevice();
                setBle((b) => [...b.filter((x) => x.id !== link.id), link]);
                await refreshDevices();
                toast.success(`paired ${link.name}`, { description: link.note });
              } catch (e) {
                toast.error("pairing cancelled or unavailable", { description: e instanceof Error ? e.message : "no device was paired" });
              }
            }}
            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-[12px] font-light text-white/70 disabled:opacity-40 hover:bg-white/[0.06]"
          >
            <Bluetooth className="mb-1 h-3.5 w-3.5" />
            <div>{bluetoothSupported() ? "pair a device" : "web bluetooth unavailable here"}</div>
            <div className="text-[10.5px] text-white/40">control and status channel. video appears above only when the system also exposes it as a camera input.</div>
          </button>
          {ble.map((l) => (
            <div key={l.id} className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[11.5px] font-light text-white/65">
              <div className="truncate">{l.name}</div>
              <div className="text-[10.5px] text-white/40">{l.connected ? "connected" : "paired, not connected"}{l.batteryPercent !== null ? ` · battery ${l.batteryPercent}%` : ""}</div>
            </div>
          ))}

          <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/35">capture from</div>
          <div className="flex flex-wrap gap-1.5">
            {CAPTURE_TIERS.map((t) => (
              <button key={t} onClick={() => setCaptureFrom(t)} className={`rounded-full border px-2.5 py-1 text-[11px] font-light ${captureFrom === t ? TIER_STYLE[t].chip : "border-white/10 bg-white/[0.03] text-white/55"}`}>{t}</button>
            ))}
          </div>

          <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-white/35">live view</div>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_MODES.map((f) => (
              <button key={f.id} onClick={() => setPreview(f.id)} title={f.note} className={`rounded-full border px-2.5 py-1 text-[11px] font-light ${preview === f.id ? "border-white/25 bg-white/12 text-white/90" : "border-white/10 bg-white/[0.03] text-white/55"}`}>{f.label}</button>
            ))}
          </div>
          <div className="text-[10.5px] font-light leading-relaxed text-white/35">every recorded event stores the clean frame plus all of these renderings, whichever one is on screen.</div>
        </div>

        {/* centre: grid */}
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2">
            {tiles.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                <Camera className="h-6 w-6 text-white/25" />
                <div className="text-[13px] font-light text-white/60">attach a camera to begin</div>
                <div className="max-w-md text-[11.5px] font-light leading-relaxed text-white/35">
                  eagle.eye turns ordinary cameras into a watched perimeter. it reads movement, dwell, posture and object placement — never faces, never identity.
                </div>
              </div>
            )}
            {tiles.map((t) => (
              <CameraTile
                key={t.deviceId}
                tile={t}
                preview={preview}
                running={running}
                bind={(overlay, mount) => {
                  const rt = runtimes.current.get(t.deviceId);
                  if (!rt) return;
                  rt.overlay = overlay;
                  if (mount && rt.video.parentElement !== mount) {
                    mount.replaceChildren(rt.video);
                    rt.video.className = "h-full w-full object-contain";
                  }
                }}
                getFrame={() => {
                  const rt = runtimes.current.get(t.deviceId);
                  if (!rt || !rt.video.videoWidth) return null;
                  return grabCanvas(rt.video, rt.video.videoWidth, rt.video.videoHeight, 960);
                }}
                onDetach={() => detachCamera(t.deviceId)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 text-[11px] font-light text-white/45">
            <span>{running ? "watching" : "idle"} · {tiles.filter((t) => t.status === "live").length} live camera{tiles.length === 1 ? "" : "s"}</span>
            <span>models {modelStatus}{modelError ? ` — ${modelError}` : ""}</span>
            <span className="truncate">{contextNote}</span>
          </div>
        </div>

        {/* right: events */}
        <div className="flex min-h-0 w-[300px] shrink-0 flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">recorded events</div>
            {records.length > 0 && (
              <button onClick={() => setRecords([])} className="text-white/35 hover:text-white/70"><Trash2 className="h-3.5 w-3.5" /></button>
            )}
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-2.5 py-2 text-[10.5px] font-light leading-relaxed text-amber-100/75">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>patterns are a prompt to look, never a finding of intent or guilt. confirm an event yourself before it leaves this device.</span>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
            {records.length === 0 && <div className="pt-6 text-center text-[11.5px] font-light text-white/35">nothing recorded yet</div>}
            {records.map((r) => (
              <button
                key={r.recordId}
                onClick={() => { setOpenRecord(r); setOpenVariant(0); }}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-2 text-left hover:bg-white/[0.06]"
              >
                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] ${TIER_STYLE[r.tier].chip}`}>{r.tier}</span>
                  <span className="text-[10.5px] text-white/40">{new Date(r.createdAtMs).toLocaleTimeString()}</span>
                  {r.reviewState === "confirmed" && <CheckCircle2 className="ml-auto h-3.5 w-3.5 text-emerald-300/80" />}
                  {r.reviewState === "dismissed" && <CircleSlash className="ml-auto h-3.5 w-3.5 text-white/30" />}
                </div>
                <div className="mt-1 line-clamp-2 text-[11.5px] font-light text-white/70">{r.reason}</div>
                <div className="mt-1 truncate text-[10.5px] text-white/35">{r.cameraLabel} · {r.patterns.slice(0, 3).join(", ") || "pattern set recorded"}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {openRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" onClick={() => setOpenRecord(null)}>
          <div className="flex max-h-full w-full max-w-4xl flex-col gap-3 overflow-y-auto rounded-2xl border border-white/12 bg-[#0b0b0d] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-2 py-0.5 text-[11px] ${TIER_STYLE[openRecord.tier].chip}`}>{openRecord.tier} · score {openRecord.score}</span>
              <span className="text-[12px] font-light text-white/60">{openRecord.cameraLabel}</span>
              <button className="ml-auto text-white/40 hover:text-white/80" onClick={() => setOpenRecord(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {openRecord.variants.map((v, i) => (
                <button key={v.key} onClick={() => setOpenVariant(i)} className={`rounded-full border px-2.5 py-1 text-[11px] font-light ${openVariant === i ? "border-white/25 bg-white/12 text-white/90" : "border-white/10 bg-white/[0.03] text-white/55"}`}>{v.label}</button>
              ))}
            </div>
            <img src={openRecord.variants[openVariant]?.dataUrl} alt={openRecord.variants[openVariant]?.label ?? "recorded frame"} className="w-full rounded-xl border border-white/10" />
            <div className="text-[11px] font-light leading-relaxed text-white/45">
              {openRecord.variants[openVariant]?.note} · sha-256 {openRecord.variants[openVariant]?.sha256.slice(0, 32)}…
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-[11.5px] font-light leading-relaxed text-white/65">
              <div>{openRecord.reason}</div>
              <div className="mt-2 text-white/40">{contextLine(openRecord.context)}</div>
              <div className="mt-2 text-white/40">patterns: {openRecord.patterns.join(", ") || "none recorded"}</div>
              <div className="mt-2 flex items-start gap-2 text-white/35"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{EVIDENCE_DISCLAIMER}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => review(openRecord.recordId, "confirmed")} className="h-8 rounded-full bg-emerald-500/15 text-[12px] font-light text-emerald-200 hover:bg-emerald-500/25">confirm for reporting</Button>
              <Button size="sm" variant="ghost" onClick={() => review(openRecord.recordId, "dismissed")} className="h-8 rounded-full text-[12px] font-light">dismiss</Button>
              <Button size="sm" variant="ghost" onClick={() => void exportAll([openRecord], `${openRecord.recordId}.zip`)} className="h-8 rounded-full text-[12px] font-light"><Download className="mr-1.5 h-3.5 w-3.5" /> export this event</Button>
              <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard.writeText(JSON.stringify(manifestFor(openRecord), null, 2)); toast.success("manifest copied"); }} className="h-8 rounded-full text-[12px] font-light">copy manifest</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CameraTile({
  tile, preview, running, bind, getFrame, onDetach,
}: {
  tile: TileState;
  preview: FilterMode;
  running: boolean;
  bind: (overlay: HTMLCanvasElement | null, mount: HTMLDivElement | null) => void;
  getFrame: () => HTMLCanvasElement | null;
  onDetach: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const filterRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { bind(overlayRef.current, mountRef.current); }, [bind]);

  // the filtered preview re-renders from the same frames the detector reads, so
  // what the operator watches is what the evidence will contain.
  useEffect(() => {
    if (preview === "clean") return;
    let alive = true;
    const paint = () => {
      if (!alive) return;
      const frame = getFrame();
      const target = filterRef.current;
      if (frame && target) {
        const out = filteredCanvas(frame, preview);
        if (target.width !== out.width || target.height !== out.height) { target.width = out.width; target.height = out.height; }
        target.getContext("2d")?.drawImage(out, 0, 0);
      }
      window.setTimeout(paint, 140);
    };
    paint();
    return () => { alive = false; };
  }, [preview, getFrame]);

  return (
    <div className="relative min-h-[180px] overflow-hidden rounded-2xl border border-white/10 bg-black/50">
      <div ref={mountRef} className={`absolute inset-0 ${preview === "clean" ? "" : "invisible"}`} />
      {preview !== "clean" && <canvas ref={filterRef} className="absolute inset-0 h-full w-full object-contain" />}
      <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
      <div className="absolute left-2 top-2 flex items-center gap-2 rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[10.5px] font-light text-white/70">
        <span className={`h-1.5 w-1.5 rounded-full ${tile.status === "live" ? (running ? "bg-emerald-400" : "bg-white/40") : "bg-rose-400"}`} />
        <span className="max-w-[160px] truncate">{tile.label}</span>
        <span className="text-white/35">{tile.personCount} tracked · {tile.inferenceMs}ms</span>
      </div>
      <button onClick={onDetach} className="absolute right-2 top-2 rounded-full border border-white/10 bg-black/55 p-1 text-white/50 hover:text-white/90"><X className="h-3.5 w-3.5" /></button>
      {tile.status === "failed" && (
        <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-[11.5px] font-light text-rose-200/80">{tile.error}</div>
      )}
    </div>
  );
}
