// asherin.arvision — spatial room.
// Everything the uploaded package does that a browser can honestly do:
// camera positioning against a scanned map, indoor routing with spoken turn by
// turn guidance, a live shared session carrying the same pose messages, and the
// see-through silhouette layer for peers behind geometry.
//
// What a browser cannot do is stated in the room rather than faked: there is no
// scanned collision mesh and no wearable video link, so occlusion uses the
// walkable corridor of the loaded map and the camera is the device camera.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Compass,
  Crosshair,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  Repeat,
  Route,
  Settings2,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";
import MapCanvas from "./MapCanvas";
import ArOverlay from "./ArOverlay";
import { NavigationGraph } from "@/lib/arvision/spatial/navData";
import { SpatialGuidance, type GuidanceState } from "@/lib/arvision/spatial/guidance";
import { GuidanceVoice } from "@/lib/arvision/spatial/voice";
import { SpatialSession, randomVibrantColor } from "@/lib/arvision/spatial/session";
import { getVpsStatus, localizeFrame, frameToBase64, type VpsStatus } from "@/lib/arvision/spatial/vps";
import {
  CALIBRATED_FULL,
  FOV_PRESETS,
  intrinsicsForFov,
  type CameraIntrinsics,
} from "@/lib/arvision/spatial/intrinsics";
import { isNavigationData, type NavigationData, type PeerState, type Quat, type Vec3 } from "@/lib/arvision/spatial/types";
import referenceMap from "@/lib/arvision/spatial/referenceMap.json";

type Panel = "field" | "map" | "route" | "session" | "setup";

const PANELS: { id: Panel; label: string; icon: typeof Camera }[] = [
  { id: "field", label: "field", icon: Camera },
  { id: "map", label: "map", icon: MapPin },
  { id: "route", label: "route", icon: Route },
  { id: "session", label: "session", icon: Users },
  { id: "setup", label: "setup", icon: Settings2 },
];

const card = "rounded-2xl border border-white/10 bg-white/[0.045] backdrop-blur-xl";
const chip =
  "rounded-full border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[11px] font-light text-white/75 transition hover:border-white/25 hover:text-white";
const chipOn = "rounded-full border border-white/45 bg-white/[0.14] px-3 py-1.5 text-[11px] font-light text-white";

function quatFromYaw(yawRad: number): Quat {
  return { x: 0, y: Math.sin(yawRad / 2), z: 0, w: Math.cos(yawRad / 2) };
}

const SpatialView = () => {
  const [panel, setPanel] = useState<Panel>("map");
  const [graph, setGraph] = useState<NavigationGraph>(() => new NavigationGraph(referenceMap as NavigationData));
  const [mapLabel, setMapLabel] = useState("reference map from the uploaded package");
  const [mapError, setMapError] = useState<string | null>(null);

  const [position, setPosition] = useState<Vec3 | null>(null);
  const [poseSource, setPoseSource] = useState<PoseSource>("none");
  const [yawDeg, setYawDeg] = useState(0);
  const [headingSensor, setHeadingSensor] = useState<"off" | "live" | "unavailable">("off");

  // live positioning from the device's own receiver
  const [liveOn, setLiveOn] = useState(false);
  const [liveNote, setLiveNote] = useState<string | null>(null);
  const [liveBusy, setLiveBusy] = useState(false);
  const [fixAccuracy, setFixAccuracy] = useState<number | null>(null);
  const [fixAt, setFixAt] = useState<number | null>(null);
  const [anchor, setAnchor] = useState<GeoAnchor | null>(null);
  const [speedMs, setSpeedMs] = useState<number | null>(null);


  const [guidanceState, setGuidanceState] = useState<GuidanceState | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [routeNotice, setRouteNotice] = useState<string | null>(null);

  const [camOn, setCamOn] = useState(false);
  const [camFacing, setCamFacing] = useState<"environment" | "user">("environment");
  const [camError, setCamError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  const [vps, setVps] = useState<VpsStatus | null>(null);
  const [localizing, setLocalizing] = useState(false);
  const [localizeNote, setLocalizeNote] = useState<string | null>(null);
  const [mapCode, setMapCode] = useState<string>((referenceMap as NavigationData).mapCode);
  const [fovId, setFovId] = useState("wide90");
  const [useCalibrated, setUseCalibrated] = useState(false);

  const [playerName, setPlayerName] = useState("operator");
  const [roomCode, setRoomCode] = useState("");
  const [sessionStatus, setSessionStatus] = useState("not connected");
  const [sessionLive, setSessionLive] = useState(false);
  const [joining, setJoining] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [showSilhouettes, setShowSilhouettes] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const voiceRef = useRef<GuidanceVoice>(new GuidanceVoice());
  const guidanceRef = useRef<SpatialGuidance | null>(null);
  const sessionRef = useRef<SpatialSession | null>(null);
  const colorRef = useRef(randomVibrantColor());
  const [videoSize, setVideoSize] = useState({ width: 1280, height: 720 });

  // guidance engine, rebuilt whenever the loaded map changes
  useEffect(() => {
    const voice = voiceRef.current;
    const engine = new SpatialGuidance(graph, {
      onState: setGuidanceState,
      onInstruction: (instruction, force) => voice.play(instruction, force),
    });
    guidanceRef.current = engine;
    setGuidanceState(engine.getState());
    return () => engine.stop();
  }, [graph]);

  // shared session
  useEffect(() => {
    const session = new SpatialSession({
      onPeers: setPeers,
      onStatus: (status, connected) => {
        setSessionStatus(status);
        setSessionLive(connected);
      },
    });
    sessionRef.current = session;
    return () => {
      void session.leave();
      sessionRef.current = null;
    };
  }, []);

  useEffect(() => {
    voiceRef.current.setEnabled(voiceOn);
  }, [voiceOn]);

  useEffect(() => {
    let cancelled = false;
    getVpsStatus()
      .then((status) => {
        if (!cancelled) setVps(status);
      })
      .catch(() => {
        if (!cancelled) setVps({ configured: false, message: "positioning service unreachable" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rotation = useMemo(() => quatFromYaw((yawDeg * Math.PI) / 180), [yawDeg]);

  const intrinsics: CameraIntrinsics = useMemo(() => {
    if (useCalibrated) return CALIBRATED_FULL;
    const preset = FOV_PRESETS.find((p) => p.id === fovId) ?? FOV_PRESETS[1];
    return intrinsicsForFov(videoSize.width, videoSize.height, preset.fov, preset.label);
  }, [useCalibrated, fovId, videoSize]);

  // push pose into guidance and out to the session
  const applyPose = useCallback(
    (next: Vec3, source: "camera positioning" | "placed by hand", nextRotation?: Quat) => {
      setPosition(next);
      setPoseSource(source);
      const rot = nextRotation ?? quatFromYaw((yawDeg * Math.PI) / 180);
      guidanceRef.current?.updatePosition(next, rot);
      sessionRef.current?.sendPose({ position: next, rotation: rot, isLocalized: source === "camera positioning" });
    },
    [yawDeg],
  );

  // heading from the device compass when the user grants it
  const enableHeading = useCallback(async () => {
    const anyOrientation = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
    try {
      if (typeof anyOrientation?.requestPermission === "function") {
        const granted = await anyOrientation.requestPermission();
        if (granted !== "granted") {
          setHeadingSensor("unavailable");
          return;
        }
      }
    } catch {
      setHeadingSensor("unavailable");
      return;
    }

    const handler = (event: DeviceOrientationEvent & { webkitCompassHeading?: number }) => {
      const heading = typeof event.webkitCompassHeading === "number"
        ? event.webkitCompassHeading
        : typeof event.alpha === "number"
          ? 360 - event.alpha
          : null;
      if (heading === null) return;
      setHeadingSensor("live");
      setYawDeg(Math.round(heading));
    };
    window.addEventListener("deviceorientation", handler, true);
    setHeadingSensor("live");
    return () => window.removeEventListener("deviceorientation", handler, true);
  }, []);

  // repeat the pose to peers at the package's rate while a session is live
  useEffect(() => {
    if (!sessionLive || !position) return;
    const timer = setInterval(() => {
      sessionRef.current?.sendPose({
        position,
        rotation,
        isLocalized: poseSource === "camera positioning",
      });
    }, 50);
    return () => clearInterval(timer);
  }, [sessionLive, position, rotation, poseSource]);

  const stopCam = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamOn(false);
  }, []);

  const startCam = useCallback(
    async (facing: "environment" | "user"): Promise<boolean> => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
          const settings = stream.getVideoTracks()[0]?.getSettings();
          setVideoSize({
            width: settings?.width ?? video.videoWidth ?? 1280,
            height: settings?.height ?? video.videoHeight ?? 720,
          });
        }
        setCamOn(true);
        setCamError(null);
        return true;
      } catch (error) {
        setCamError(error instanceof Error ? error.message : "camera unavailable");
        setCamOn(false);
        return false;
      }
    },
    [],
  );

  const flipCam = useCallback(async () => {
    if (switching) return;
    setSwitching(true);
    const next = camFacing === "environment" ? "user" : "environment";
    const ok = await startCam(next);
    if (ok) setCamFacing(next);
    else await startCam(camFacing);
    setSwitching(false);
  }, [camFacing, startCam, switching]);

  useEffect(() => () => stopCam(), [stopCam]);

  const runLocalize = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !camOn) {
      setLocalizeNote("start the camera first");
      return;
    }
    setLocalizing(true);
    setLocalizeNote(null);
    try {
      const frame = frameToBase64(video, 1080);
      if (!frame) {
        setLocalizeNote("could not read a frame from the camera");
        return;
      }
      const result = await localizeFrame({
        imageBase64: frame.base64,
        intrinsics: useCalibrated
          ? CALIBRATED_FULL
          : intrinsicsForFov(frame.width, frame.height, FOV_PRESETS.find((p) => p.id === fovId)?.fov ?? 90, "capture"),
        mapCode: mapCode.trim() || undefined,
      });
      if (result.poseFound && result.position && result.rotation) {
        applyPose(result.position, "camera positioning", result.rotation);
        setLocalizeNote(`pose found, confidence ${(result.confidence * 100).toFixed(0)}%`);
      } else {
        setLocalizeNote(result.message);
      }
    } finally {
      setLocalizing(false);
    }
  }, [applyPose, camOn, fovId, mapCode, useCalibrated]);

  const loadMapFile = useCallback(async (file: File) => {
    setMapError(null);
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!isNavigationData(parsed)) {
        setMapError("that file is not a navigation export. it needs mapCode, bounds, pois, waypoints and paths");
        return;
      }
      setGraph(new NavigationGraph(parsed));
      setMapCode(parsed.mapCode);
      setMapLabel(`${file.name}`);
      setPosition(null);
      setPoseSource("none");
    } catch {
      setMapError("that file could not be read as json");
    }
  }, []);

  const startRoute = useCallback((poiId: number) => {
    const reason = guidanceRef.current?.start(poiId) ?? "guidance is not ready";
    setRouteNotice(reason);
    if (!reason) setPanel("route");
  }, []);

  const joinSession = useCallback(async () => {
    if (!sessionRef.current) return;
    setJoining(true);
    setSessionError(null);
    const color = colorRef.current;
    const error = await sessionRef.current.join(roomCode, {
      playerName: playerName.trim() || "operator",
      colorR: color.r,
      colorG: color.g,
      colorB: color.b,
    });
    setSessionError(error);
    setJoining(false);
  }, [playerName, roomCode]);

  const leaveSession = useCallback(async () => {
    await sessionRef.current?.leave();
  }, []);

  const instruction = guidanceState?.instruction ?? null;
  const instructionText = instruction ? GuidanceVoice.phrase(instruction) : "no active route";

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#0a0a0b] text-white">
      {/* header */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/8 px-3 py-2 sm:px-4">
        <span className="text-[13px] font-light tracking-tight text-white/85">spatial</span>
        <span className="truncate text-[11px] font-light text-white/45">{mapLabel}</span>
        <span className="ml-auto flex items-center gap-2 text-[11px] font-light text-white/55">
          <Crosshair className="h-3.5 w-3.5" />
          {position ? `${poseSource}` : "no position"}
        </span>
      </div>

      {/* panel tabs, top on desktop */}
      <div className="hidden shrink-0 gap-1.5 px-4 py-2 sm:flex">
        {PANELS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setPanel(id)} className={panel === id ? chipOn : chip}>
            <span className="flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-2 sm:px-4">
        {panel === "field" && (
          <div className="flex h-full min-h-[60vh] flex-col gap-3">
            <div className={`relative flex-1 overflow-hidden ${card}`}>
              <video
                ref={videoRef}
                playsInline
                muted
                className={`h-full w-full object-cover ${camFacing === "user" ? "-scale-x-100" : ""}`}
              />
              {!camOn && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <Camera className="h-6 w-6 text-white/40" />
                  <p className="max-w-sm text-[12px] font-light leading-relaxed text-white/55">
                    the field view uses this device camera. peers in a live session are drawn over it, solid in clear line of
                    sight and as a silhouette when the route corridor says something is between you.
                  </p>
                  {camError && <p className="text-[11px] font-light text-white/70">{camError}</p>}
                </div>
              )}
              {camOn && (
                <ArOverlay
                  graph={graph}
                  viewerPosition={position}
                  viewerRotation={rotation}
                  intrinsics={intrinsics}
                  peers={peers}
                  showSilhouettes={showSilhouettes}
                />
              )}
              {camOn && instruction && (
                <div className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-white/12 bg-black/55 px-4 py-1.5 text-[12px] font-light backdrop-blur">
                  {instructionText}
                  {guidanceState?.isNavigating ? ` · ${guidanceState.remainingDistance.toFixed(1)}m` : ""}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={camOn ? chipOn : chip}
                onClick={() => (camOn ? stopCam() : void startCam(camFacing))}
              >
                <span className="flex items-center gap-1.5">
                  {camOn ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                  {camOn ? "stop camera" : "start camera"}
                </span>
              </button>
              <button type="button" className={chip} onClick={flipCam} disabled={!camOn || switching}>
                <span className="flex items-center gap-1.5">
                  <Repeat className="h-3.5 w-3.5" />
                  {switching ? "switching" : camFacing === "environment" ? "front camera" : "back camera"}
                </span>
              </button>
              <button type="button" className={chip} onClick={runLocalize} disabled={localizing}>
                <span className="flex items-center gap-1.5">
                  {localizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  localize from camera
                </span>
              </button>
              <button type="button" className={showSilhouettes ? chipOn : chip} onClick={() => setShowSilhouettes((v) => !v)}>
                see through walls
              </button>
            </div>

            {(localizeNote || vps) && (
              <p className="text-[11px] font-light leading-relaxed text-white/50">
                {localizeNote ?? vps?.message}
              </p>
            )}
          </div>
        )}

        {panel === "map" && (
          <div className="flex h-full min-h-[60vh] flex-col gap-3">
            <div className={`relative min-h-[46vh] flex-1 ${card}`}>
              <MapCanvas
                graph={graph}
                position={position}
                headingRad={(yawDeg * Math.PI) / 180}
                path={guidanceState?.path ?? null}
                destinationId={guidanceState?.destination?.id ?? null}
                peers={peers}
                onPlace={(next) => applyPose(next, "placed by hand")}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={chip} onClick={() => void enableHeading()}>
                <span className="flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5" />
                  {headingSensor === "live" ? `heading ${yawDeg}deg` : "use device compass"}
                </span>
              </button>
              <label className="flex items-center gap-2 text-[11px] font-light text-white/55">
                heading
                <input
                  type="range"
                  min={0}
                  max={359}
                  value={yawDeg}
                  onChange={(event) => setYawDeg(Number(event.target.value))}
                  className="h-1 w-32 accent-white/70 sm:w-48"
                  aria-label="viewer heading in degrees"
                />
              </label>
              {headingSensor === "unavailable" && (
                <span className="text-[11px] font-light text-white/45">compass not available on this device</span>
              )}
            </div>
            <p className="text-[11px] font-light leading-relaxed text-white/45">
              tap the plan to place yourself on the nearest walkable point. camera positioning replaces this the moment the
              map service is configured.
            </p>
          </div>
        )}

        {panel === "route" && (
          <div className="flex flex-col gap-3">
            <div className={`${card} p-4`}>
              <p className="text-[11px] font-light uppercase tracking-[0.16em] text-white/40">guidance</p>
              <p className="mt-1 text-[20px] font-extralight tracking-tight">{instructionText}</p>
              {guidanceState?.isNavigating && guidanceState.destination && (
                <p className="mt-1 text-[12px] font-light text-white/55">
                  {guidanceState.destination.name} · {guidanceState.remainingDistance.toFixed(1)}m · waypoint{" "}
                  {Math.min(guidanceState.currentWaypointIndex + 1, guidanceState.totalWaypoints)} of{" "}
                  {guidanceState.totalWaypoints}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={voiceOn ? chipOn : chip} onClick={() => setVoiceOn((v) => !v)}>
                  <span className="flex items-center gap-1.5">
                    {voiceOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                    spoken guidance
                  </span>
                </button>
                <button
                  type="button"
                  className={chip}
                  onClick={() => {
                    guidanceRef.current?.stop();
                    voiceRef.current.stop();
                  }}
                >
                  stop route
                </button>
              </div>
              {routeNotice && <p className="mt-2 text-[11px] font-light text-white/60">{routeNotice}</p>}
            </div>

            <div className={`${card} divide-y divide-white/6`}>
              {graph.getPOIs().map((poi) => (
                <button
                  key={poi.id}
                  type="button"
                  onClick={() => startRoute(poi.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04]"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-light">{poi.name}</span>
                    <span className="block truncate text-[11px] font-light text-white/45">
                      {poi.type || "point of interest"}
                      {position ? ` · ${Math.hypot(poi.position.x - position.x, poi.position.z - position.z).toFixed(1)}m` : ""}
                    </span>
                  </span>
                  <Navigation className="h-4 w-4 shrink-0 text-white/45" />
                </button>
              ))}
            </div>
          </div>
        )}

        {panel === "session" && (
          <div className="flex flex-col gap-3">
            <div className={`${card} space-y-3 p-4`}>
              <p className="text-[11px] font-light uppercase tracking-[0.16em] text-white/40">shared session</p>
              <p className="text-[11px] font-light leading-relaxed text-white/50">
                everyone joins the same room key and shares position at twenty updates a second. the original package used a
                local wifi link between phones and glasses; the web room carries the same messages over your account instead.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={playerName}
                  onChange={(event) => setPlayerName(event.target.value.slice(0, 32))}
                  placeholder="your call sign"
                  className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-[13px] font-light outline-none placeholder:text-white/30 focus:border-white/30"
                />
                <input
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.slice(0, 48))}
                  placeholder="room key"
                  className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-[13px] font-light outline-none placeholder:text-white/30 focus:border-white/30"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className={sessionLive ? chip : chipOn} onClick={joinSession} disabled={joining || sessionLive}>
                  {joining ? "joining" : "join session"}
                </button>
                <button type="button" className={chip} onClick={leaveSession} disabled={!sessionLive}>
                  leave
                </button>
                <span className="text-[11px] font-light text-white/50">{sessionStatus}</span>
              </div>
              {sessionError && <p className="text-[11px] font-light text-white/70">{sessionError}</p>}
            </div>

            <div className={`${card} p-4`}>
              <p className="text-[11px] font-light uppercase tracking-[0.16em] text-white/40">peers</p>
              {peers.length === 0 ? (
                <p className="mt-2 text-[12px] font-light text-white/45">nobody else is in this room yet</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {peers.map((peer) => (
                    <li key={peer.peerId} className="flex items-center gap-2 text-[12px] font-light text-white/75">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          background: `rgb(${Math.round(peer.colorR * 255)},${Math.round(peer.colorG * 255)},${Math.round(peer.colorB * 255)})`,
                        }}
                      />
                      {peer.playerName}
                      <span className="text-white/40">
                        {peer.pose
                          ? `${peer.pose.isLocalized ? "localized" : "placed"} · ${peer.pose.position.x.toFixed(1)}, ${peer.pose.position.z.toFixed(1)}`
                          : "no position yet"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {panel === "setup" && (
          <div className="flex flex-col gap-3">
            <div className={`${card} space-y-3 p-4`}>
              <p className="text-[11px] font-light uppercase tracking-[0.16em] text-white/40">map</p>
              <p className="text-[12px] font-light text-white/60">{mapLabel}</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className={`${chip} cursor-pointer`}>
                  load navigation export
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void loadMapFile(file);
                      event.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  className={chip}
                  onClick={() => {
                    setGraph(new NavigationGraph(referenceMap as NavigationData));
                    setMapCode((referenceMap as NavigationData).mapCode);
                    setMapLabel("reference map from the uploaded package");
                    setPosition(null);
                    setPoseSource("none");
                  }}
                >
                  reset to reference map
                </button>
              </div>
              {mapError && <p className="text-[11px] font-light text-white/70">{mapError}</p>}
              <p className="text-[11px] font-light text-white/40">
                {graph.data.waypoints.length} waypoints · {graph.getPOIs().length} destinations ·{" "}
                {graph.data.paths.length} precomputed routes · spacing {graph.data.waypointSpacing}m
              </p>
            </div>

            <div className={`${card} space-y-3 p-4`}>
              <p className="text-[11px] font-light uppercase tracking-[0.16em] text-white/40">camera positioning</p>
              <p className="text-[12px] font-light leading-relaxed text-white/55">
                {vps ? vps.message : "checking the positioning service"}
              </p>
              <input
                value={mapCode}
                onChange={(event) => setMapCode(event.target.value.slice(0, 64))}
                placeholder="map code"
                className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2 text-[13px] font-light outline-none placeholder:text-white/30 focus:border-white/30"
              />
              <div className="flex flex-wrap gap-2">
                <button type="button" className={useCalibrated ? chipOn : chip} onClick={() => setUseCalibrated(true)}>
                  calibrated wearable lens
                </button>
                {FOV_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={!useCalibrated && fovId === preset.id ? chipOn : chip}
                    onClick={() => {
                      setUseCalibrated(false);
                      setFovId(preset.id);
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <p className="text-[11px] font-light text-white/40">
                current intrinsics fx {intrinsics.fx.toFixed(1)} · fy {intrinsics.fy.toFixed(1)} · {intrinsics.width}x
                {intrinsics.height}
              </p>
            </div>

            <div className={`${card} space-y-2 p-4`}>
              <p className="text-[11px] font-light uppercase tracking-[0.16em] text-white/40">what this room cannot do</p>
              <p className="text-[12px] font-light leading-relaxed text-white/55">
                there is no scanned wall mesh in a browser, so a peer counts as hidden when the straight line to them leaves the
                walkable corridor of the loaded map. wearable glasses stream over a native link this page cannot open, so the
                field view uses this device camera. camera positioning only works once the map service credentials are set,
                and until then position is placed by hand on the plan.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* panel tabs, bottom on mobile */}
      <div className="flex shrink-0 justify-around border-t border-white/10 bg-black/70 px-2 py-2 backdrop-blur-xl sm:hidden">
        {PANELS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPanel(id)}
            className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-light transition ${
              panel === id ? "bg-white/10 text-white" : "text-white/55"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SpatialView;
