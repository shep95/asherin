// Zaxin — five-brain BLE tactical scanner UI.
// Theory by Asher · #houseofasher. Built browser-native (Web Bluetooth + DeviceOrientation).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bluetooth, Radar, ShieldAlert, Network, AlertTriangle, Eye,
  Smartphone, Play, Square, Trash2, RefreshCw, Star, Compass, Camera, Download, Upload,
  Activity, Radio, ChevronRight, Cpu,
} from "lucide-react";
import { TacticalEngine, SCENARIOS } from "./core/tactical";
import { startScan, pickOne, detectScanMode, listPaired, type RawAdvert, type ScanMode } from "./core/scanner";
import { HopBrain } from "./core/hop";
import { startHeadingStream, startCamera, stopCamera, bearingDelta, flipFacing } from "./core/posesense";
import { startBodyVision, POSE_EDGES, HAND_EDGES, type BodyMode, type BodyFrame, type PoseHit } from "./core/bodyvision";
import { BearingSlam, VisualAnchors, classifyBehavior, startChirpDetector, type ChirpHandle, type DeviceBehavior } from "./core/visionAi";
import { startOpticalScan, type OpticalContact, type OpticalHandle } from "./core/opticalContacts";
import { rssiToDistance } from "./core/bleRanging";
import type { Contact, ScenarioId, ZaxinSnapshot } from "./core/types";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";
import { Link } from "react-router-dom";
import { Mic, MicOff } from "lucide-react";

type Tab = "scan" | "tactical" | "ar" | "hops" | "diag";

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "scan",     label: "Scan",        icon: Radar },
  { id: "tactical", label: "Tactical",    icon: ShieldAlert },
  { id: "ar",       label: "AR Vision",   icon: Camera },
  { id: "hops",     label: "Hop Mesh",    icon: Network },
  { id: "diag",     label: "Diagnostics", icon: Cpu },
];

function randomNodeId() {
  return "node-" + Math.random().toString(36).slice(2, 8);
}

const ZONE_DOT: Record<string, string> = {
  immediate: "bg-[#c69a4a]/80",
  near:      "bg-sky-400/70",
  far:       "bg-amber-400/60",
  unknown:   "bg-foreground/30",
};

const BEHAVIOR_CHIP: Record<string, string> = {
  active:          "text-[#c69a4a]/80 border-[#c69a4a]/20",
  lost:            "text-foreground/40 border-border/20",
  resurrected:     "text-amber-300/80 border-amber-300/25",
  "clone-suspect": "text-rose-300/90 border-rose-300/30",
};

const SOURCE_LABEL: Record<string, string> = {
  broadcast: "broadcast",
  paired:    "paired",
  gatt:      "GATT",
  inferred:  "inferred",
  "id-suffix": "id-tail",
};

const ZaxinView = () => {
  const [tab, setTab] = useState<Tab>("scan");

  // engine
  const engineRef = useRef<TacticalEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new TacticalEngine({
      scenario: "standard",
      nodeId: randomNodeId(),
      nodeLabel: typeof navigator !== "undefined" ? (navigator.userAgent.includes("Mobi") ? "Mobile" : "Desktop") : "Node",
    });
  }
  const engine = engineRef.current!;

  // hop brain
  const hopRef = useRef<HopBrain | null>(null);
  if (!hopRef.current) hopRef.current = new HopBrain();
  const hop = hopRef.current!;

  const [snap, setSnap] = useState<ZaxinSnapshot>(() => engine.snapshot());
  const [mode, setMode] = useState<ScanMode>(() => detectScanMode());
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const scanHandleRef = useRef<{ stop: () => Promise<void> } | null>(null);

  // tactical subscription + tick loop
  useEffect(() => {
    const unsub = engine.subscribe(setSnap);
    const t = window.setInterval(() => engine.tick(), 2_000);
    return () => { unsub(); clearInterval(t); };
  }, [engine]);

  // hop brain
  useEffect(() => {
    hop.start(() => engine.emitHopReport(), (r) => engine.ingestHop(r));
    return () => hop.stop();
  }, [hop, engine]);

  // initial + recurring paired load — picks up OS-paired devices without user re-tap
  useEffect(() => {
    const pull = () =>
      listPaired().then((rows) => rows.forEach((r) => engine.ingest(r))).catch(() => {/* */});
    pull();
    const t = window.setInterval(pull, 8_000);
    return () => clearInterval(t);
  }, [engine]);

  // auto-naming: for any local contact with a GATT handle and no intel yet, pull
  // identity in the background (skips Silent Observe scenario — engine enforces).
  const autoPulledRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const c of snap.contacts) {
      if (c.source !== "local") continue;
      if (c.intel) continue;
      if (autoPulledRef.current.has(c.id)) continue;
      if (!(c as any).__device) continue;
      autoPulledRef.current.add(c.id);
      engine.pullIntel(c.id).catch(() => autoPulledRef.current.delete(c.id));
    }
  }, [snap.contacts, engine]);

  /* ------------- scan controls ------------- */
  const startSweep = useCallback(async () => {
    setScanErr(null);
    try {
      const h = await startScan((adv: RawAdvert) => engine.ingest(adv));
      scanHandleRef.current = h;
      setMode(h.mode);
      setScanning(true);
    } catch (e) {
      setScanErr(e instanceof Error ? e.message : String(e));
    }
  }, [engine]);

  const stopSweep = useCallback(async () => {
    await scanHandleRef.current?.stop();
    scanHandleRef.current = null;
    setScanning(false);
  }, []);

  // Rapid auto-pair: re-opens the OS chooser after every successful pair until
  // the user cancels. The OS picker itself can't be removed — browsers force a
  // human gesture per device — but this collapses the loop to a single tap each.
  const autoPairRef = useRef(false);
  const pickDevice = useCallback(async () => {
    setScanErr(null);
    autoPairRef.current = true;
    while (autoPairRef.current) {
      try {
        await pickOne((adv) => engine.ingest(adv));
        await new Promise((r) => setTimeout(r, 350));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        autoPairRef.current = false;
        if (/cancell?ed|NotFoundError|chooser/i.test(msg)) {
          // user closed the OS sheet — silent exit
          return;
        }
        if (/connection attempt failed|GATT/i.test(msg)) {
          setScanErr("Device refused the connection. Move closer, wake the device, then tap Add Device again.");
          return;
        }
        setScanErr(msg);
        return;
      }
    }
  }, [engine]);

  useEffect(() => () => { scanHandleRef.current?.stop(); }, []);

  /* ------------- AR pose ------------- */
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scopeVideoRef = useRef<HTMLVideoElement | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [arOn, setArOn] = useState(false);
  const [arErr, setArErr] = useState<string | null>(null);
  const [mainFacing, setMainFacing] = useState<"environment" | "user">("environment");
  const [scopeOn, setScopeOn] = useState(true);
  const [scopeAvail, setScopeAvail] = useState(true);
  const camStreamRef = useRef<MediaStream | null>(null);
  const scopeStreamRef = useRef<MediaStream | null>(null);
  const poseHandleRef = useRef<{ stop: () => void } | null>(null);
  const compassHandleRef = useRef<{ stop: () => void } | null>(null);
  const [compassOn, setCompassOn] = useState(false);
  const [compassErr, setCompassErr] = useState<string | null>(null);

  const enableCompass = useCallback(async () => {
    if (compassHandleRef.current) return;
    setCompassErr(null);
    try {
      const h = await startHeadingStream((deg) => {
        setHeading(deg);
        engine.setHeading(deg);
      });
      compassHandleRef.current = h;
      setCompassOn(true);
    } catch (e) {
      setCompassErr(e instanceof Error ? e.message : String(e));
      setCompassOn(false);
    }
  }, [engine]);

  useEffect(() => () => { compassHandleRef.current?.stop(); }, []);

  // Manual heading fallback — used when the device has no orientation
  // sensor (desktops, most laptops). Driven by a slider in the AR HUD.
  const setManualHeading = useCallback((deg: number) => {
    const norm = ((deg % 360) + 360) % 360;
    setHeading(norm);
    engine.setHeading(norm);
  }, [engine]);

  const openMain = useCallback(async (facing: "environment" | "user") => {
    if (!videoRef.current) throw new Error("Camera surface not ready.");
    stopCamera(camStreamRef.current); camStreamRef.current = null;
    const stream = await startCamera(videoRef.current, facing);
    camStreamRef.current = stream;
  }, []);

  const openScope = useCallback(async (facing: "environment" | "user") => {
    if (!scopeVideoRef.current) return;
    stopCamera(scopeStreamRef.current); scopeStreamRef.current = null;
    try {
      const stream = await startCamera(scopeVideoRef.current, facing);
      scopeStreamRef.current = stream;
      setScopeAvail(true);
    } catch {
      // Most laptops only have one camera; mark scope unavailable.
      setScopeAvail(false);
    }
  }, []);

  const startAr = useCallback(async () => {
    setArErr(null);
    try {
      await openMain(mainFacing);
      // Try to also open the opposite-facing camera for the binoc scope.
      await openScope(flipFacing(mainFacing));
      // Try to start a heading stream — but never fail AR if the sensor
      // is missing. Surface as compassErr so the manual slider appears.
      if (!poseHandleRef.current && !compassHandleRef.current) {
        try {
          const pose = await startHeadingStream((deg) => {
            setHeading(deg);
            engine.setHeading(deg);
          });
          poseHandleRef.current = pose;
          setCompassOn(true);
        } catch (e) {
          setCompassErr(e instanceof Error ? e.message : String(e));
          setCompassOn(false);
          // Seed heading to 0° so the HUD compass + reticles render
          // immediately; user can drag the slider to adjust.
          if (heading == null) {
            setHeading(0);
            engine.setHeading(0);
          }
        }
      }
      engine.setPose(true, null);
      setArOn(true);
    } catch (e) {
      setArErr(e instanceof Error ? e.message : String(e));
      stopCamera(camStreamRef.current); camStreamRef.current = null;
      stopCamera(scopeStreamRef.current); scopeStreamRef.current = null;
    }
  }, [engine, mainFacing, openMain, openScope]);

  const stopAr = useCallback(() => {
    poseHandleRef.current?.stop(); poseHandleRef.current = null;
    stopCamera(camStreamRef.current); camStreamRef.current = null;
    stopCamera(scopeStreamRef.current); scopeStreamRef.current = null;
    engine.setPose(false, null);
    setArOn(false);
  }, [engine]);

  const flipMain = useCallback(async () => {
    if (!arOn) return;
    const next = flipFacing(mainFacing);
    setMainFacing(next);
    try {
      await openMain(next);
      await openScope(flipFacing(next));
    } catch (e) {
      setArErr(e instanceof Error ? e.message : String(e));
    }
  }, [arOn, mainFacing, openMain, openScope]);

  /* ------------- AR resilience: recover from blackouts ------------- */
  // Mobile browsers kill or freeze video tracks on visibility loss, thermal
  // throttling, or stream re-allocation. Watch for dead tracks / paused video
  // and re-acquire the camera so the AR feed never stays black.
  useEffect(() => {
    if (!arOn) return;
    let killed = false;

    const reviveMain = async () => {
      if (killed) return;
      try {
        const v = videoRef.current;
        const tracks = camStreamRef.current?.getVideoTracks() ?? [];
        const dead = tracks.length === 0 || tracks.every((t) => t.readyState === "ended" || !t.enabled);
        if (dead) {
          await openMain(mainFacing);
        } else if (v && v.paused) {
          try { await v.play(); } catch { /* ignore */ }
        }
      } catch (e) {
        setArErr(e instanceof Error ? e.message : String(e));
      }
    };
    const reviveScope = async () => {
      if (killed) return;
      try {
        const v = scopeVideoRef.current;
        const tracks = scopeStreamRef.current?.getVideoTracks() ?? [];
        const dead = tracks.length === 0 || tracks.every((t) => t.readyState === "ended" || !t.enabled);
        if (dead && scopeAvail) {
          await openScope(flipFacing(mainFacing));
        } else if (v && v.paused) {
          try { await v.play(); } catch { /* ignore */ }
        }
      } catch { /* scope is optional */ }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        reviveMain(); reviveScope();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Watch track health
    const wireTrackWatchers = () => {
      camStreamRef.current?.getVideoTracks().forEach((t) => {
        t.onended = reviveMain;
        t.onmute = reviveMain;
      });
      scopeStreamRef.current?.getVideoTracks().forEach((t) => {
        t.onended = reviveScope;
        t.onmute = reviveScope;
      });
    };
    wireTrackWatchers();

    // Poll every 3s — cheap safety net for silent black frames.
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (v && (v.readyState < 2 || v.paused)) reviveMain();
      const s = scopeVideoRef.current;
      if (s && scopeAvail && (s.readyState < 2 || s.paused)) reviveScope();
      wireTrackWatchers();
    }, 3000);

    return () => {
      killed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(id);
    };
  }, [arOn, mainFacing, scopeAvail, openMain, openScope]);

  useEffect(() => () => {
    poseHandleRef.current?.stop();
    stopCamera(camStreamRef.current);
    stopCamera(scopeStreamRef.current);
  }, []);

  /* ------------- derived ------------- */
  const locals = useMemo(() => snap.contacts.filter((c) => c.source === "local"), [snap]);
  const remotes = useMemo(() => snap.contacts.filter((c) => c.source !== "local"), [snap]);
  const peerCount = Object.keys(snap.peers).length;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* top bar */}
      <div className="shrink-0 border-b border-border/[0.06] px-4 sm:px-5 py-2.5 flex items-center justify-between backdrop-blur-md bg-background/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-foreground/[0.04] border border-border/[0.08] flex items-center justify-center shrink-0">
            <Bluetooth className="h-3.5 w-3.5 text-foreground/60" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[11px] font-light tracking-[0.16em] text-foreground/90 uppercase truncate">Zaxin</h1>
            <p className="text-[8px] text-muted-foreground/40 tracking-[0.18em] uppercase truncate">
              Five-brain BLE tactical scanner · #houseofasher
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] tracking-[0.18em] uppercase px-2 py-1 rounded-md border ${
            scanning ? "text-[#c69a4a]/80 border-[#c69a4a]/20 bg-[#c69a4a]/[0.04]"
                     : "text-foreground/40 border-border/20"
          }`}>
            {scanning ? (mode === "continuous" ? "Sweeping" : "Picker") : "Idle"}
          </span>
          {peerCount > 0 && (
            <span className="text-[9px] tracking-[0.18em] uppercase px-2 py-1 rounded-md border text-sky-300/80 border-sky-300/20 bg-sky-300/[0.04]">
              {peerCount} hop{peerCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* tabs */}
      <div className="shrink-0 border-b border-border/[0.06] bg-background/30 backdrop-blur-md overflow-x-auto">
        <div className="flex items-center gap-1 px-2 sm:px-4 py-1.5 min-w-max">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-[0.14em] uppercase transition-all ${
                tab === t.id
                  ? "bg-foreground/[0.06] text-foreground/90 border border-border/[0.1]"
                  : "text-muted-foreground/50 hover:text-foreground/70 hover:bg-foreground/[0.02] border border-transparent"
              }`}
            >
              <t.icon className="h-3 w-3" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-7">
        {tab === "scan" && (
          <ScanTab
            mode={mode} scanning={scanning} scanErr={scanErr}
            scenario={snap.scenario}
            onStart={startSweep} onStop={stopSweep} onPick={pickDevice}
            onClear={() => engine.clear()}
            onScenario={(s) => engine.setScenario(s)}
            locals={locals} remotes={remotes}
            onToggleWatch={(id) => engine.toggleWatch(id)}
            onPullIntel={(id) => engine.pullIntel(id)}
            heading={heading} compassOn={compassOn} compassErr={compassErr}
            onEnableCompass={enableCompass}
          />
        )}
        {tab === "tactical" && (
          <TacticalTab snap={snap} engine={engine} />
        )}
        {tab === "ar" && (
          <ArTab
            videoRef={videoRef} scopeVideoRef={scopeVideoRef}
            arOn={arOn} arErr={arErr} heading={heading}
            mainFacing={mainFacing} scopeOn={scopeOn} scopeAvail={scopeAvail}
            onToggleScope={() => setScopeOn((v) => !v)} onFlip={flipMain}
            contacts={locals}
            onStart={startAr} onStop={stopAr}
            compassOn={compassOn} onEnableCompass={enableCompass} compassErr={compassErr}
            onManualHeading={setManualHeading}
          />
        )}
        {tab === "hops" && (
          <HopsTab snap={snap} hop={hop} />
        )}
        {tab === "diag" && <DiagTab mode={mode} snap={snap} scanning={scanning} arOn={arOn} heading={heading} />}
      </div>
    </div>
  );
};

/* ============================ SCAN TAB ============================ */

function ScanTab(props: {
  mode: ScanMode; scanning: boolean; scanErr: string | null; scenario: ScenarioId;
  onStart: () => void; onStop: () => void; onPick: () => void; onClear: () => void;
  onScenario: (s: ScenarioId) => void;
  locals: Contact[]; remotes: Contact[];
  onToggleWatch: (id: string) => void;
  onPullIntel: (id: string) => void;
  heading: number | null; compassOn: boolean; compassErr: string | null;
  onEnableCompass: () => void;
}) {
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Panel icon={Radar} title="Sweep Control" subtitle="Browser-native scan. No install. No server.">
        {props.mode === "unsupported" && (
          <Note tone="error" icon={Smartphone}>
            This browser has no Web Bluetooth. Use Chrome on Android (or Bluefy on iOS).
          </Note>
        )}
        {props.mode === "picker" && (
          <Note tone="info" icon={Eye}>
            <span className="block mb-1 font-medium text-foreground/80">Your browser shows the system pair sheet — it cannot be replaced.</span>
            Web Bluetooth on iOS / Bluefy / desktop Chrome forces the OS-level "Pick a device" chooser for every scan. Only <strong>Chrome on Android</strong> with <code className="text-[9px]">chrome://flags#enable-experimental-web-platform-features</code> turned on can list BLE devices directly inside this app (continuous sweep). Devices you confirm via the chooser will appear in the list below and stay paired across sessions.
          </Note>
        )}
        {props.scanErr && <Note tone="error" icon={AlertTriangle}>{props.scanErr}</Note>}

        <div className="flex flex-wrap gap-2 mt-3">
          {props.mode === "continuous" && !props.scanning && (
            <ActionButton onClick={props.onStart} icon={Play}>Start Sweep</ActionButton>
          )}
          {props.mode === "continuous" && props.scanning && (
            <ActionButton onClick={props.onStop} icon={Square} tone="danger">Stop Sweep</ActionButton>
          )}
          {props.mode !== "unsupported" && (
            <ActionButton onClick={props.onPick} icon={Bluetooth}>
              {props.mode === "picker" ? "Add Device (OS prompt)" : "Pick Device"}
            </ActionButton>
          )}
          <ActionButton onClick={props.onClear} icon={Trash2}>Clear</ActionButton>
          <div className="ml-auto flex items-center gap-2 text-[9px] tracking-[0.18em] uppercase text-muted-foreground/50">
            <Activity className={`h-3 w-3 ${props.scanning ? "text-[#c69a4a]/80 animate-pulse" : ""}`} />
            {props.locals.length} local · {props.remotes.length} via hops
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {(Object.keys(SCENARIOS) as ScenarioId[]).map((sid) => (
            <button
              key={sid}
              title={SCENARIOS[sid].blurb}
              onClick={() => props.onScenario(sid)}
              className={`px-2.5 py-1 rounded-md text-[9px] tracking-[0.14em] uppercase border transition-all ${
                props.scenario === sid
                  ? "bg-foreground/[0.08] border-border/30 text-foreground/90"
                  : "border-border/[0.08] text-muted-foreground/60 hover:text-foreground/80 hover:bg-foreground/[0.03]"
              }`}
            >{SCENARIOS[sid].label}</button>
          ))}
        </div>
      </Panel>

      <Panel icon={Radar} title="Live Radar" subtitle="Device heading is up. Contacts plotted by bearing (RSSI gradient) and distance (signal strength).">
        <RadarMap
          heading={props.heading}
          compassOn={props.compassOn}
          compassErr={props.compassErr}
          onEnableCompass={props.onEnableCompass}
          contacts={[...props.locals, ...props.remotes]}
          onPick={props.onPick}
          mode={props.mode}
        />
      </Panel>

      <Panel icon={Compass} title="Satellite Overhead" subtitle="Live operator location · Esri World Imagery · zoom 10–20">
        <SatelliteMap
          heading={props.heading}
          contacts={[...props.locals, ...props.remotes]}
          onPick={props.onPick}
        />
      </Panel>

      <VisionTheoriesPanel />
      <AiBriefPanel contacts={[...props.locals, ...props.remotes]} scenario={props.scenario} />



      <ContactList rows={props.locals} title="Local Contacts" onToggleWatch={props.onToggleWatch} onPullIntel={props.onPullIntel} />
      {props.remotes.length > 0 && (
        <ContactList rows={props.remotes} title="Reported via Hop Mesh" onToggleWatch={props.onToggleWatch} onPullIntel={() => {}} compact />
      )}
    </div>
  );
}

/* ============================ TACTICAL TAB ============================ */

function TacticalTab({ snap, engine }: { snap: ZaxinSnapshot; engine: TacticalEngine }) {
  const watchCount = snap.watchlist.length;
  const breachAlerts = snap.alerts.filter((a) => a.level === "breach").length;
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Panel icon={Cpu} title={SCENARIOS[snap.scenario].label} subtitle={SCENARIOS[snap.scenario].blurb}>
        <div className="grid sm:grid-cols-3 gap-2 mt-3">
          <Stat label="Contacts" value={String(snap.contacts.length)} sub={`${snap.contacts.filter((c) => c.behavior === "active").length} active`} />
          <Stat label="Watchlist" value={String(watchCount)} sub="Tagged ids" />
          <Stat label="Breach Alerts" value={String(breachAlerts)} sub="Lifetime" />
        </div>
      </Panel>

      <Panel icon={AlertTriangle} title="Mission Alerts">
        {snap.alerts.length === 0 ? (
          <Note tone="info" icon={ChevronRight}>No alerts yet. Start a sweep on the Scan tab.</Note>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {snap.alerts.slice(0, 30).map((a, i) => (
              <li key={i} className="text-[10px] tracking-wide text-foreground/70 flex gap-2">
                <span className="text-muted-foreground/40 font-mono shrink-0">
                  {new Date(a.ts).toLocaleTimeString()}
                </span>
                <span className={`shrink-0 px-1.5 rounded border text-[8px] tracking-[0.14em] uppercase ${
                  a.level === "breach" ? "text-rose-300/90 border-rose-300/30" :
                  a.level === "warn"   ? "text-amber-300/80 border-amber-300/30" :
                                          "text-foreground/50 border-border/20"
                }`}>{a.level}</span>
                <span className="flex-1">{a.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {watchCount > 0 && (
        <Panel icon={Star} title="Watchlist">
          <ul className="mt-3 space-y-1">
            {snap.watchlist.map((id) => {
              const c = snap.contacts.find((x) => x.id === id);
              return (
                <li key={id} className="flex items-center justify-between text-[10px]">
                  <span className="text-foreground/80 truncate">{c?.displayName ?? id}</span>
                  <button onClick={() => engine.toggleWatch(id)} className="text-[9px] tracking-[0.16em] uppercase text-rose-300/70 hover:text-rose-300/100">Remove</button>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}

/* ============================ AR TAB ============================ */

function ArTab(props: {
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  scopeVideoRef: React.MutableRefObject<HTMLVideoElement | null>;
  arOn: boolean; arErr: string | null; heading: number | null;
  mainFacing: "environment" | "user";
  scopeOn: boolean; scopeAvail: boolean;
  onToggleScope: () => void; onFlip: () => void;
  contacts: Contact[];
  onStart: () => void; onStop: () => void;
  compassOn: boolean; onEnableCompass: () => void; compassErr: string | null;
  onManualHeading: (deg: number) => void;
}) {
  const FOV = 60;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const bvHandleRef = useRef<{ stop: () => void; setModes: (m: Set<BodyMode>) => void } | null>(null);
  const frameRef = useRef<BodyFrame>({ hits: [], ts: 0 });
  const [bvErr, setBvErr] = useState<string | null>(null);
  const [bvReady, setBvReady] = useState(false);
  const [modes, setModes] = useState<Set<BodyMode>>(() => new Set<BodyMode>(["full", "face", "fingers"]));
  const [bindings, setBindings] = useState<Record<string, string>>({});

  const toggleMode = (m: BodyMode) => {
    setModes((prev) => {
      const next = new Set(prev);
      next.has(m) ? next.delete(m) : next.add(m);
      bvHandleRef.current?.setModes(next);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!props.arOn || !props.videoRef.current) return;
      setBvErr(null); setBvReady(false);
      try {
        const h = await startBodyVision(props.videoRef.current, (f) => { frameRef.current = f; }, modes);
        if (cancelled) { h.stop(); return; }
        bvHandleRef.current = h;
        setBvReady(true);
      } catch (e) {
        setBvErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      bvHandleRef.current?.stop();
      bvHandleRef.current = null;
      setBvReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.arOn]);

  useEffect(() => {
    if (!props.arOn) return;
    let raf = 0;
    const draw = () => {
      const cvs = canvasRef.current;
      const vid = props.videoRef.current;
      if (cvs && vid && vid.videoWidth) {
        const rect = wrapRef.current?.getBoundingClientRect();
        const W = Math.floor(rect?.width ?? cvs.clientWidth);
        const H = Math.floor(rect?.height ?? cvs.clientHeight);
        if (cvs.width !== W) cvs.width = W;
        if (cvs.height !== H) cvs.height = H;
        const ctx = cvs.getContext("2d")!;
        ctx.clearRect(0, 0, W, H);
        drawFrame(ctx, frameRef.current, W, H, bindings, props.contacts);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [props.arOn, bindings, props.contacts]);

  const onTap = (e: React.MouseEvent | React.TouchEvent) => {
    const cvs = canvasRef.current; if (!cvs) return;
    const rect = cvs.getBoundingClientRect();
    const pt = "touches" in e
      ? { x: (e.touches[0]?.clientX ?? 0) - rect.left, y: (e.touches[0]?.clientY ?? 0) - rect.top }
      : { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
    const nx = pt.x / rect.width, ny = pt.y / rect.height;
    const hits = frameRef.current.hits;
    let chosen: PoseHit | null = null;
    for (const h of hits) {
      const b = h.bbox;
      if (nx >= b.x && nx <= b.x + b.w && ny >= b.y && ny <= b.y + b.h) {
        if (!chosen || (h.bbox.w * h.bbox.h) < (chosen.bbox.w * chosen.bbox.h)) chosen = h;
      }
    }
    if (!chosen) return;
    const linked = new Set(Object.values(bindings));
    const candidate = [...props.contacts]
      .filter((c) => !linked.has(c.id))
      .sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999))[0];
    if (!candidate) {
      setBvErr("No unlinked Bluetooth contacts to bind. Start a sweep first.");
      return;
    }
    setBvErr(null);
    setBindings((prev) => ({ ...prev, [chosen!.kind]: candidate.id }));
  };

  const clearBindings = () => setBindings({});

  // ---- Live AI subsystems (T2 SLAM, T5 behavior, T6 anchors, T7 chirp) ----
  const slamRef = useRef<BearingSlam | null>(null);
  if (!slamRef.current) slamRef.current = new BearingSlam();
  const anchorsRef = useRef<VisualAnchors | null>(null);
  if (!anchorsRef.current) anchorsRef.current = new VisualAnchors();

  const smoothedContacts = useMemo(
    () => slamRef.current!.apply(props.contacts),
    [props.contacts],
  );
  useEffect(() => {
    anchorsRef.current!.update(smoothedContacts, props.heading, FOV);
  }, [smoothedContacts, props.heading]);

  const hasBearings = smoothedContacts.filter((c) => c.bearing != null);
  const ghosts = anchorsRef.current!.ghosts(smoothedContacts, props.heading, FOV);

  // T7 — ultrasonic chirp detector (mic FFT 18–22 kHz)
  const [chirpOn, setChirpOn] = useState(false);
  const [chirpActive, setChirpActive] = useState(false);
  const [chirpLevel, setChirpLevel] = useState(0);
  const [chirpErr, setChirpErr] = useState<string | null>(null);
  const chirpRef = useRef<ChirpHandle | null>(null);
  const toggleChirp = async () => {
    if (chirpRef.current) {
      chirpRef.current.stop(); chirpRef.current = null;
      setChirpOn(false); setChirpActive(false); setChirpLevel(0); return;
    }
    try {
      setChirpErr(null);
      const h = await startChirpDetector((a, l) => { setChirpActive(a); setChirpLevel(l); });
      chirpRef.current = h; setChirpOn(true);
    } catch (e) {
      setChirpErr(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => () => { chirpRef.current?.stop(); chirpRef.current = null; }, []);

  // ---- Optical Contacts (T3-PASSIVE) — pairing-free device detection ----
  // Runs MediaPipe Object Detector on the rear-camera frame. Anything
  // looking like personal electronics (phone, laptop, remote, tv, mouse,
  // keyboard, book/tablet, clock) — or a person — gets a reticle pinned
  // directly on its pixels. Zero pairing, zero radio, zero compass.
  const [opticalOn, setOpticalOn] = useState(true);
  const [optical, setOptical] = useState<OpticalContact[]>([]);
  const [opticalErr, setOpticalErr] = useState<string | null>(null);
  const [opticalReady, setOpticalReady] = useState(false);
  const opticalRef = useRef<OpticalHandle | null>(null);

  // Streamed identifications from the BYOK Vision panel — drawn as labeled boxes on the camera.
  const [visionIdents, setVisionIdents] = useState<VisionIdent[]>([]);


  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!props.arOn || !opticalOn || !props.videoRef.current) return;
      setOpticalErr(null); setOpticalReady(false);
      try {
        const h = await startOpticalScan({
          video: props.videoRef.current,
          onFrame: (c) => setOptical(c),
          hz: 8,
        });

        if (cancelled) { h.stop(); return; }
        opticalRef.current = h;
        setOpticalReady(true);
      } catch (e) {
        setOpticalErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
      opticalRef.current?.stop();
      opticalRef.current = null;
      setOpticalReady(false);
      setOptical([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.arOn, opticalOn]);

  // object-cover math: video is scaled to MAX(W/vw, H/vh) and centered.
  // Convert normalized video coords → on-screen % of the wrapper.
  const projectBbox = useCallback((b: { x: number; y: number; w: number; h: number }) => {
    const wrap = wrapRef.current; const v = props.videoRef.current;
    if (!wrap || !v || !v.videoWidth) return null;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    const vw = v.videoWidth, vh = v.videoHeight;
    const scale = Math.max(W / vw, H / vh);
    const dispW = vw * scale, dispH = vh * scale;
    const offX = (W - dispW) / 2, offY = (H - dispH) / 2;
    const px = b.x * vw * scale + offX;
    const py = b.y * vh * scale + offY;
    const pw = b.w * vw * scale, ph = b.h * vh * scale;
    return {
      leftPct: (px / W) * 100,
      topPct:  (py / H) * 100,
      widthPct:  (pw / W) * 100,
      heightPct: (ph / H) * 100,
    };
  }, [props.videoRef]);




  return (
    <div className="max-w-5xl mx-auto space-y-3">
      {/* Floating glass control rail — icons + minimal text */}
      <div className="relative rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-xl px-3 py-2.5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-2 flex-wrap">
          {!props.arOn ? (
            <button onClick={props.onStart}
              className="group flex items-center gap-2 pl-2.5 pr-3.5 py-1.5 rounded-full bg-[#c69a4a]/95 text-black text-[11px] font-medium tracking-[0.08em] shadow-[0_0_20px_-2px_rgba(198,154,74,0.6)] active:scale-[0.98] transition">
              <Play className="h-3.5 w-3.5" /> Activate
            </button>
          ) : (
            <button onClick={props.onStop}
              className="flex items-center gap-2 pl-2.5 pr-3.5 py-1.5 rounded-full bg-rose-400/15 border border-rose-300/40 text-rose-200 text-[11px] font-medium tracking-[0.08em] active:scale-[0.98] transition">
              <Square className="h-3.5 w-3.5" /> Stop
            </button>
          )}

          {props.arOn && (
            <>
              <IconChip onClick={props.onFlip} icon={RefreshCw} label={props.mainFacing === "environment" ? "R" : "F"} />
              {props.scopeAvail && (
                <IconChip onClick={props.onToggleScope} icon={Eye} active={props.scopeOn} />
              )}
              {Object.keys(bindings).length > 0 && (
                <IconChip onClick={clearBindings} icon={Trash2} tone="danger" />
              )}
              <div className="mx-1 h-5 w-px bg-white/[0.08]" />
              {(["full","face","fingers"] as BodyMode[]).map((m) => (
                <button key={m} onClick={() => toggleMode(m)}
                  className={`px-2.5 py-1 rounded-full text-[10px] tracking-[0.06em] transition ${
                    modes.has(m)
                      ? "bg-[#c69a4a]/15 text-[#e8c684] border border-[#c69a4a]/40"
                      : "text-foreground/45 border border-white/[0.06] hover:text-foreground/80"
                  }`}>
                  {m === "full" ? "Body" : m === "face" ? "Face" : "Hand"}
                </button>
              ))}
            </>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {props.arOn && (
              <span className={`text-[9px] tracking-[0.16em] font-mono px-2 py-0.5 rounded-full ${
                bvErr ? "text-rose-200 bg-rose-400/10" :
                bvReady ? "text-[#e8c684] bg-[#c69a4a]/10" :
                "text-amber-200 bg-amber-400/10 animate-pulse"
              }`}>
                {bvErr ? "ERR" : bvReady ? "LIVE" : "INIT"}
              </span>
            )}
            {props.arOn && !props.compassOn ? (
              <button onClick={props.onEnableCompass}
                className="flex items-center gap-1 text-[10px] tracking-[0.1em] font-mono text-[#d4a85a] px-2 py-0.5 rounded-full bg-[#6b4a18]/30 border border-[#c69a4a]/40 hover:bg-[#6b4a18]/50 active:scale-[0.97] transition">
                <Compass className="h-3 w-3" /> Enable
              </button>
            ) : (
              <span className={`flex items-center gap-1 text-[10px] tracking-[0.1em] font-mono px-2 py-0.5 rounded-full ${props.compassOn ? "text-[#e8c684] bg-[#6b4a18]/30 border border-[#c69a4a]/40" : "text-foreground/60 bg-white/[0.04] border border-white/[0.05]"}`}>
                <Compass className="h-3 w-3" /> {props.heading != null ? `${props.heading.toFixed(0)}°` : "—"}
              </span>
            )}
          </div>
        </div>
        {(props.arErr || bvErr) && (
          <div className="mt-2 text-[10px] text-rose-300/90 truncate">{props.arErr || bvErr}</div>
        )}
        {props.arOn && !props.compassOn && (
          <div className="mt-2 flex items-center gap-2 text-[10px] font-mono text-[#e8c684]/80">
            <span className="tracking-[0.16em] uppercase">Manual heading</span>
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              value={Math.round(props.heading ?? 0)}
              onChange={(e) => props.onManualHeading(Number(e.target.value))}
              className="flex-1 accent-[#c69a4a]"
              aria-label="Manual compass heading in degrees"
            />
            <span className="w-10 text-right tabular-nums">{Math.round(props.heading ?? 0)}°</span>
          </div>
        )}
        {props.arOn && !props.compassOn && props.compassErr && (
          <div className="mt-1 text-[10px] text-[#c69a4a]/70 truncate">{props.compassErr}</div>
        )}
      </div>

      {/* Camera surface */}
      <div ref={wrapRef}
        className="relative rounded-3xl overflow-hidden border border-[#c69a4a]/15 bg-black min-h-[70vh] sm:min-h-0 sm:aspect-video select-none shadow-[0_20px_60px_-20px_rgba(198,154,74,0.25)]">
        <video ref={props.videoRef} playsInline muted autoPlay
          className="absolute inset-0 w-full h-full object-cover" />
        <canvas ref={canvasRef} onClick={onTap} onTouchStart={onTap}
          className="absolute inset-0 w-full h-full cursor-crosshair" style={{ zIndex: 2 }} />

        {/* edge vignette for depth */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: "radial-gradient(120% 80% at 50% 50%, transparent 60%, rgba(0,0,0,0.55) 100%)",
          zIndex: 1,
        }} />

        {/* Binocular scope — minimal frameless cutout */}
        {props.arOn && props.scopeOn && props.scopeAvail && (
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-[72%] max-w-[520px] pointer-events-none" style={{ zIndex: 3 }}>
            <div className="relative aspect-[16/5] rounded-2xl overflow-hidden bg-black/30 ring-1 ring-[#c69a4a]/40 shadow-[0_0_24px_-6px_rgba(198,154,74,0.45)]">
              <video ref={props.scopeVideoRef} playsInline muted autoPlay
                className="absolute inset-0 w-full h-full object-cover" />
              <span className="absolute top-1 left-1 w-2 h-2 rounded-full bg-[#e8c684] shadow-[0_0_6px_rgba(232,198,132,0.9)]" />
              <span className="absolute bottom-1 right-1.5 text-[7px] font-mono text-[#e8c684]/85 tracking-[0.22em]">
                {props.mainFacing === "environment" ? "FRONT" : "REAR"}
              </span>
            </div>
          </div>
        )}

        {/* Top compass strip + reticles */}
        {props.arOn && (
          <>
            <CompassStrip
              heading={props.heading}
              contacts={hasBearings}
              fov={FOV}
            />
            <MiniMap
              heading={props.heading}
              contacts={props.contacts}
            />
          </>
        )}

        {/* In-FOV target reticles (T1 + T2 Kalman + T5 behavior) */}
        {props.arOn && props.heading != null && hasBearings.map((c) => {
          const delta = bearingDelta(c.bearing!, props.heading!);
          if (Math.abs(delta) > FOV / 2) return null;
          const xPct = 50 + (delta / (FOV / 2)) * 50;
          const conf = c.bearingConfidence ?? 0.4;
          const opacity = 0.4 + conf * 0.6;
          const ring = 1 + Math.round(conf * 3); // T2: thickness ∝ confidence
          const dist = (c as { distanceM?: number | null }).distanceM ?? null;
          const behavior: DeviceBehavior = classifyBehavior(c);
          const behaviorTone =
            behavior === "vehicle-mounted" ? "text-rose-200/90 border-rose-300/40" :
            behavior === "carried-on-person" ? "text-[#f0d59a] border-[#c69a4a]/40" :
            behavior === "stationary-beacon" ? "text-sky-200/85 border-sky-300/35" :
            "text-foreground/55 border-white/[0.08]";
          return (
            <div key={c.id} style={{ left: `${xPct}%`, opacity, zIndex: 4, borderWidth: ring }}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
              <div className="relative w-12 h-12 rounded-full backdrop-blur-[2px] shadow-[0_0_12px_-2px_rgba(198,154,74,0.55)]"
                   style={{ border: `${ring}px solid rgba(198,154,74,0.8)` }}>
                <span className="absolute inset-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 bg-[#e8c684] rounded-full animate-pulse shadow-[0_0_8px_rgba(232,198,132,0.95)]" />
              </div>
              <div className="mt-1 text-[8px] font-mono text-[#f0d59a] bg-black/45 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                {c.displayName}{dist != null && <span className="opacity-60"> · {dist.toFixed(1)}m</span>}
              </div>
              <div className={`mt-0.5 text-[7px] tracking-[0.16em] uppercase px-1.5 py-[1px] rounded-full bg-black/40 border ${behaviorTone}`}>
                {behavior === "unknown" ? "—" : behavior.replace(/-/g, " ")}
              </div>
            </div>
          );
        })}

        {/* T6 — Out-of-FOV ghost edges (visual anchors) */}
        {props.arOn && props.heading != null && ghosts.map((g) => {
          const delta = bearingDelta(g.bearing, props.heading!);
          const onLeft = delta < 0;
          const ageS = (Date.now() - g.ts) / 1000;
          const opacity = Math.max(0.18, 0.65 - ageS / 60);
          const c = smoothedContacts.find((x) => x.id === g.contactId);
          return (
            <div key={`ghost-${g.contactId}`} style={{ opacity, zIndex: 3 }}
              className={`absolute top-1/2 -translate-y-1/2 pointer-events-none ${onLeft ? "left-1" : "right-1"} flex flex-col items-center`}>
              <div className="w-3.5 h-3.5 rounded-full border border-[#c69a4a]/60 bg-[#c69a4a]/20" />
              <div className="text-[7px] font-mono text-[#e8c684]/80 mt-0.5">
                {onLeft ? "◀" : "▶"} {Math.abs(delta).toFixed(0)}°
              </div>
              {c && <div className="text-[7px] font-mono text-[#f0d59a]/70 max-w-[60px] truncate">{c.displayName}</div>}
            </div>
          );
        })}

        {/* OPTICAL CONTACTS — pairing-free, drawn directly on detected pixels.
            If the AI Vision panel has returned an identification paired to this
            bbox (matched_optical_id === "opt:i"), we override the label with the
            refined brand/model/type and a BLE pip. */}
        {props.arOn && opticalOn && optical.map((o, idx) => {
          const p = projectBbox(o);
          if (!p) return null;
          const ai = visionIdents.find((vi) => vi.matched_optical_id === `opt:${idx}`);
          const isDevice = (ai?.has_bluetooth === true) || o.kind === "device";
          const stroke = isDevice ? "rgba(232,198,132,0.95)" : "rgba(180,180,180,0.55)";
          const glow = isDevice ? "0 0 14px -2px rgba(232,198,132,0.55)" : "none";
          const label = ai?.label || o.label;
          const sub = ai
            ? [ai.brand, ai.device_type, ai.est_distance_m != null ? `${ai.est_distance_m.toFixed(1)}m` : null]
                .filter(Boolean).join(" · ")
            : `${(o.score * 100).toFixed(0)}%`;
          return (
            <div
              key={`opt-${o.id}`}
              style={{
                left: `${p.leftPct}%`, top: `${p.topPct}%`,
                width: `${p.widthPct}%`, height: `${p.heightPct}%`,
                border: `${isDevice ? 2 : 1}px solid ${stroke}`,
                boxShadow: glow, zIndex: 4,
              }}
              className="absolute rounded-md pointer-events-none transition-[left,top,width,height] duration-100 ease-out"
            >
              <span className="absolute -top-px -left-px w-2.5 h-2.5 border-t-2 border-l-2" style={{ borderColor: stroke }} />
              <span className="absolute -top-px -right-px w-2.5 h-2.5 border-t-2 border-r-2" style={{ borderColor: stroke }} />
              <span className="absolute -bottom-px -left-px w-2.5 h-2.5 border-b-2 border-l-2" style={{ borderColor: stroke }} />
              <span className="absolute -bottom-px -right-px w-2.5 h-2.5 border-b-2 border-r-2" style={{ borderColor: stroke }} />
              <div className="absolute -top-[34px] left-0 flex items-center gap-1 max-w-[260px]">
                <div className="text-[9px] font-mono tracking-[0.14em] uppercase px-1.5 py-0.5 rounded-sm bg-black/75 truncate"
                     style={{ color: isDevice ? "#f0d59a" : "rgba(255,255,255,0.7)" }}>
                  {label}
                </div>
                {ai?.has_bluetooth ? (
                  <div className="text-[8px] font-mono tracking-[0.16em] uppercase px-1 py-0.5 rounded-sm bg-[#6b4a18]/80 text-[#f0d59a] border border-[#c69a4a]/60">
                    BLE
                  </div>
                ) : null}
              </div>
              <div className="absolute -bottom-[18px] left-0 text-[8px] font-mono tracking-[0.14em] uppercase px-1.5 py-0.5 rounded-sm bg-black/65 text-foreground/75 truncate max-w-[260px]">
                {sub}
              </div>
            </div>
          );
        })}

        {/* AI-ONLY IDENT BOXES — items the COCO detector missed but the BYOK vision model spotted */}
        {props.arOn && visionIdents.map((it, i) => {
          if (it.matched_optical_id || !it.bbox_pct) return null;
          const b = it.bbox_pct;
          // bbox_pct is in PERCENT of the video frame; convert to normalized for projectBbox.
          const proj = projectBbox({ x: b.x / 100, y: b.y / 100, w: b.w / 100, h: b.h / 100 });
          if (!proj) return null;
          const isBle = it.has_bluetooth === true;
          const stroke = isBle ? "rgba(232,198,132,0.9)" : "rgba(170,170,170,0.55)";
          return (
            <div
              key={`ai-${i}`}
              style={{
                left: `${proj.leftPct}%`, top: `${proj.topPct}%`,
                width: `${proj.widthPct}%`, height: `${proj.heightPct}%`,
                border: `${isBle ? 2 : 1}px dashed ${stroke}`,
                zIndex: 4,
              }}
              className="absolute rounded-md pointer-events-none"
            >
              <div className="absolute -top-[18px] left-0 flex items-center gap-1 max-w-[240px]">
                <div className="text-[9px] font-mono tracking-[0.14em] uppercase px-1.5 py-0.5 rounded-sm bg-black/75 truncate"
                     style={{ color: isBle ? "#f0d59a" : "rgba(255,255,255,0.7)" }}>
                  {it.label || "device"}{it.brand ? ` · ${it.brand}` : ""}
                </div>
                {isBle ? (
                  <div className="text-[8px] font-mono tracking-[0.16em] uppercase px-1 py-0.5 rounded-sm bg-[#6b4a18]/80 text-[#f0d59a] border border-[#c69a4a]/60">
                    BLE
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}



        {/* T7 — Ultrasonic chirp pill */}
        {props.arOn && (
          <button onClick={toggleChirp} style={{ zIndex: 5 }}
            className={`absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-mono tracking-[0.14em] border transition ${
              !chirpOn ? "bg-black/45 text-foreground/60 border-white/[0.08] hover:text-foreground/85" :
              chirpActive ? "bg-[#6b4a18]/55 text-[#e8c684] border-[#c69a4a]/60 shadow-[0_0_10px_rgba(232,198,132,0.45)]" :
              "bg-black/45 text-[#e8c684]/70 border-[#c69a4a]/30"
            }`}>
            {chirpOn ? <Mic className="h-3 w-3" /> : <MicOff className="h-3 w-3" />}
            <span>{!chirpOn ? "CHIRP OFF" : chirpActive ? "CHIRP DETECTED" : `${(chirpLevel * 100).toFixed(0)}%`}</span>
          </button>
        )}
        {props.arOn && chirpErr && (
          <div className="absolute bottom-10 right-2 text-[9px] text-rose-300/85 bg-black/55 px-1.5 py-0.5 rounded" style={{ zIndex: 5 }}>
            {chirpErr}
          </div>
        )}

        {/* OPTICAL pill — pairing-free contact source */}
        {props.arOn && (
          <button
            onClick={() => setOpticalOn((v) => !v)}
            style={{ zIndex: 5 }}
            className={`absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-mono tracking-[0.14em] border transition ${
              !opticalOn ? "bg-black/45 text-foreground/60 border-white/[0.08] hover:text-foreground/85" :
              opticalErr ? "bg-black/45 text-rose-200 border-rose-300/40" :
              opticalReady ? "bg-[#6b4a18]/55 text-[#e8c684] border-[#c69a4a]/60 shadow-[0_0_10px_rgba(232,198,132,0.45)]" :
              "bg-black/45 text-[#e8c684]/70 border-[#c69a4a]/30 animate-pulse"
            }`}
            title="Pairing-free optical detection of phones, laptops, remotes, TVs and people in the camera frame."
          >
            <Eye className="h-3 w-3" />
            <span>
              {!opticalOn ? "OPTICAL OFF"
                : opticalErr ? "OPTICAL ERR"
                : opticalReady ? `OPTICAL · ${optical.length}`
                : "OPTICAL INIT"}
            </span>
          </button>
        )}
        {props.arOn && opticalOn && opticalErr && (
          <div className="absolute bottom-10 left-2 max-w-[60%] text-[9px] text-rose-300/85 bg-black/55 px-1.5 py-0.5 rounded truncate" style={{ zIndex: 5 }}>
            {opticalErr}
          </div>
        )}




        {!props.arOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 z-10">
            <div className="w-14 h-14 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md flex items-center justify-center">
              <Camera className="h-5 w-5 text-foreground/40" />
            </div>
            <div className="mt-3 text-[10px] tracking-[0.22em] uppercase text-foreground/45">Tap activate</div>
          </div>
        )}
      </div>

      {/* AI Vision Identify — BYOK Gemini/OpenAI vision over current frame + RSSI ranging */}
      <AiVisionIdentifyPanel
        videoRef={props.videoRef}
        optical={optical}
        contacts={smoothedContacts}
        arOn={props.arOn}
      />
    </div>
  );
}

function IconChip({ icon: Icon, onClick, active, tone, label }: {
  icon: any; onClick: () => void; active?: boolean; tone?: "danger"; label?: string;
}) {
  const base = "flex items-center justify-center gap-1 h-8 min-w-[2rem] px-2 rounded-full border text-[10px] font-mono transition active:scale-[0.95]";
  const cls = tone === "danger"
    ? "border-rose-300/30 text-rose-200 bg-rose-400/10 hover:bg-rose-400/15"
    : active
      ? "border-[#c69a4a]/40 text-[#e8c684] bg-[#c69a4a]/10"
      : "border-white/[0.08] text-foreground/70 bg-white/[0.02] hover:bg-white/[0.05]";
  return (
    <button onClick={onClick} className={`${base} ${cls}`}>
      <Icon className="h-3.5 w-3.5" />
      {label && <span className="tracking-[0.1em]">{label}</span>}
    </button>
  );
}


function drawFrame(
  ctx: CanvasRenderingContext2D, frame: BodyFrame, W: number, H: number,
  bindings: Record<string, string>, contacts: Contact[],
) {
  for (const hit of frame.hits) {
    const color =
      hit.kind === "body"       ? "rgba(74,222,128,0.9)" :
      hit.kind === "face"       ? "rgba(125,211,252,0.85)" :
      hit.kind === "left-hand"  ? "rgba(251,191,36,0.9)" :
                                  "rgba(74,222,128,0.9)";
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = hit.kind === "body" ? 2.5 : 1.5;
    const edges =
      hit.kind === "body" ? POSE_EDGES :
      hit.kind === "left-hand" || hit.kind === "right-hand" ? HAND_EDGES : [];
    for (const [a, b] of edges) {
      const pa = hit.points[a], pb = hit.points[b];
      if (!pa || !pb) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x * W, pa.y * H);
      ctx.lineTo(pb.x * W, pb.y * H);
      ctx.stroke();
    }
    if (hit.kind === "face") {
      ctx.fillStyle = "rgba(125,211,252,0.7)";
      for (let i = 0; i < hit.points.length; i += 4) {
        const p = hit.points[i];
        ctx.fillRect(p.x * W, p.y * H, 1, 1);
      }
    } else {
      for (const p of hit.points) {
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const boundId = bindings[hit.kind];
    if (boundId) {
      const c = contacts.find((x) => x.id === boundId);
      const label = c?.displayName ?? boundId.slice(0, 10);
      const bx = hit.bbox.x * W, by = hit.bbox.y * H;
      ctx.font = "10px ui-monospace, monospace";
      const tw = ctx.measureText(label).width + 10;
      ctx.fillStyle = "rgba(16,185,129,0.92)";
      ctx.fillRect(bx, Math.max(0, by - 16), tw, 14);
      ctx.fillStyle = "#000";
      ctx.fillText(label, bx + 5, Math.max(11, by - 5));
    } else {
      ctx.strokeStyle = "rgba(74,222,128,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(hit.bbox.x * W, hit.bbox.y * H, hit.bbox.w * W, hit.bbox.h * H);
    }

    // Anthropometric estimate readout for body hits.
    if (hit.kind === "body" && hit.metrics) {
      const m = hit.metrics;
      const ft = m.heightM * 3.28084;
      const feet = Math.floor(ft);
      const inch = Math.round((ft - feet) * 12);
      const lbs = Math.round(m.weightKg * 2.20462);
      const line1 = `H ${m.heightM.toFixed(2)}m · ${feet}'${inch}"`;
      const line2 = `W ~${m.weightKg}kg · ${lbs}lb`;
      const line3 = `${Math.round(m.confidence * 100)}% · ${m.anchor}`;
      ctx.font = "10px ui-monospace, monospace";
      const tw = Math.max(
        ctx.measureText(line1).width,
        ctx.measureText(line2).width,
        ctx.measureText(line3).width,
      ) + 10;
      const bx = hit.bbox.x * W;
      const by = (hit.bbox.y + hit.bbox.h) * H + 4;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(bx, by, tw, 44);
      ctx.strokeStyle = "rgba(74,222,128,0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, tw, 44);
      ctx.fillStyle = "rgba(167,243,208,0.95)";
      ctx.fillText(line1, bx + 5, by + 12);
      ctx.fillText(line2, bx + 5, by + 25);
      ctx.fillStyle = "rgba(125,211,252,0.85)";
      ctx.fillText(line3, bx + 5, by + 38);
    }
  }
}

/* ============================ HOPS TAB ============================ */

function HopsTab({ snap, hop }: { snap: ZaxinSnapshot; hop: HopBrain }) {
  const [importText, setImportText] = useState("");
  const [exportText, setExportText] = useState("");
  const [importErr, setImportErr] = useState<string | null>(null);

  const doExport = () => setExportText(hop.exportSnapshotBlob());
  const doImport = () => {
    setImportErr(null);
    try { hop.importSnapshot(importText); setImportText(""); }
    catch (e) { setImportErr(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Panel icon={Network} title="Cooperative Hop Mesh" subtitle="Same-origin tabs sync automatically via BroadcastChannel. Cross-device: export → import a snapshot.">
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <Stat label="Local node" value={(hop as any).produce?.()?.nodeId ?? "—"} sub="Auto-broadcasts every 5s" />
          <Stat label="Active peers" value={String(Object.keys(snap.peers).length)} sub="Same-origin only" />
        </div>
        {Object.entries(snap.peers).length > 0 && (
          <ul className="mt-4 space-y-1">
            {Object.entries(snap.peers).map(([id, p]) => (
              <li key={id} className="flex items-center justify-between text-[10px]">
                <span className="font-mono text-foreground/80">{id}</span>
                <span className="text-muted-foreground/50">{p.label} · {p.count} contacts · {new Date(p.lastSeen).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel icon={Download} title="Export Snapshot" subtitle="Hand-carry to another device that can't reach this origin.">
        <div className="flex gap-2 mt-3">
          <ActionButton icon={Download} onClick={doExport}>Generate</ActionButton>
          {exportText && (
            <ActionButton icon={RefreshCw} onClick={() => navigator.clipboard?.writeText(exportText).catch(() => {})}>
              Copy
            </ActionButton>
          )}
        </div>
        {exportText && (
          <textarea readOnly value={exportText}
            className="mt-3 w-full h-32 rounded-lg bg-background/60 border border-border/[0.1] p-3 text-[10px] font-mono text-foreground/80 outline-none" />
        )}
      </Panel>

      <Panel icon={Upload} title="Import Hop Snapshot">
        <textarea value={importText} onChange={(e) => setImportText(e.target.value)}
          placeholder='Paste the JSON exported from another Zaxin node…'
          className="mt-3 w-full h-32 rounded-lg bg-background/60 border border-border/[0.1] p-3 text-[10px] font-mono text-foreground/80 outline-none focus:border-border/30" />
        {importErr && <Note tone="error" icon={AlertTriangle}>{importErr}</Note>}
        <div className="mt-2">
          <ActionButton icon={Upload} onClick={doImport}>Merge Into Mission</ActionButton>
        </div>
      </Panel>
    </div>
  );
}

/* ============================ DIAGNOSTICS ============================ */

function DiagTab({ mode, snap, scanning, arOn, heading }: {
  mode: ScanMode; snap: ZaxinSnapshot; scanning: boolean; arOn: boolean; heading: number | null;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const nav = typeof navigator !== "undefined" ? navigator : ({} as any);
  const bt = (nav as any).bluetooth;
  const hasBT = !!bt;
  const hasLEScan = typeof bt?.requestLEScan === "function";
  const hasGetDevices = typeof bt?.getDevices === "function";
  const hasMedia = !!nav?.mediaDevices?.getUserMedia;
  const hasOrient = typeof window !== "undefined" && "DeviceOrientationEvent" in window;
  const hasBroadcast = typeof BroadcastChannel !== "undefined";
  const isSecure = typeof window !== "undefined" && window.isSecureContext;
  const inIframe = typeof window !== "undefined" && window.self !== window.top;

  const lastAdvert = snap.contacts.reduce((m, c) => Math.max(m, c.lastSeen ?? 0), 0);
  const since = lastAdvert ? Math.round((now - lastAdvert) / 1000) : null;

  const rows: Array<{ k: string; v: string; ok: boolean | null }> = [
    { k: "Secure context (HTTPS)", v: isSecure ? "yes" : "no", ok: isSecure },
    { k: "Running inside iframe",  v: inIframe ? "yes — host must allow bluetooth/camera" : "no", ok: !inIframe },
    { k: "navigator.bluetooth",    v: hasBT ? "present" : "missing", ok: hasBT },
    { k: "requestLEScan (sweep)",  v: hasLEScan ? "available" : "not available", ok: hasLEScan },
    { k: "getDevices (paired)",    v: hasGetDevices ? "available" : "not available", ok: hasGetDevices },
    { k: "getUserMedia (camera)",  v: hasMedia ? "available" : "not available", ok: hasMedia },
    { k: "DeviceOrientationEvent", v: hasOrient ? "present" : "missing", ok: hasOrient },
    { k: "BroadcastChannel (mesh)",v: hasBroadcast ? "present" : "missing", ok: hasBroadcast },
    { k: "Detected scan mode",     v: mode, ok: mode !== "unsupported" },
    { k: "Sweep state",            v: scanning ? "RUNNING" : "idle", ok: scanning || null },
    { k: "AR pose",                v: arOn ? `on · heading ${heading?.toFixed(0) ?? "?"}°` : "off", ok: arOn || null },
    { k: "Contacts tracked",       v: String(snap.contacts.length), ok: null },
    { k: "Mesh peers",             v: String(Object.keys(snap.peers).length), ok: null },
    { k: "Alerts emitted",         v: String(snap.alerts.length), ok: null },
    { k: "Last advertisement",     v: since == null ? "—" : `${since}s ago`, ok: null },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Panel icon={Cpu} title="Live Runtime Diagnostics" subtitle="Real browser capabilities, real engine state. No simulation.">
        <div className="mt-3 rounded-xl border border-border/[0.08] overflow-hidden">
          {rows.map((r, i) => (
            <div key={r.k} className={`flex items-center justify-between gap-3 px-3 py-2 text-[11px] ${i % 2 ? "bg-foreground/[0.015]" : ""}`}>
              <span className="text-muted-foreground/65 font-light">{r.k}</span>
              <span className={`font-mono ${
                r.ok === true ? "text-[#c69a4a]/90" : r.ok === false ? "text-rose-300/85" : "text-foreground/80"
              }`}>{r.v}</span>
            </div>
          ))}
        </div>
      </Panel>

      {inIframe && (
        <Note tone="warn" icon={AlertTriangle}>
          Web Bluetooth, camera and motion sensors are blocked inside cross-origin iframes unless the host page sets
          a Permissions-Policy. Open this dashboard in a standalone tab (or your published URL) to grant the hardware.
        </Note>
      )}
    </div>
  );
}


/* ============================ shared UI ============================ */

function ContactList({
  rows, title, onToggleWatch, onPullIntel, compact,
}: {
  rows: Contact[]; title: string;
  onToggleWatch: (id: string) => void;
  onPullIntel: (id: string) => void;
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/[0.1] p-8 text-center">
        <Radio className="h-5 w-5 mx-auto text-muted-foreground/30" />
        <div className="mt-2 text-[10px] tracking-[0.18em] uppercase text-muted-foreground/40">{title}</div>
        <div className="mt-1 text-[10px] text-muted-foreground/35 font-light">No contacts yet.</div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.015] overflow-hidden">
      <div className="px-4 py-2 border-b border-border/[0.06] text-[9px] tracking-[0.18em] uppercase text-muted-foreground/45 flex items-center justify-between">
        <span>{title}</span>
        <span className="font-mono text-muted-foreground/40">{rows.length}</span>
      </div>
      <ul className="divide-y divide-border/[0.05]">
        {rows.map((c) => (
          <li key={c.id} className="px-4 py-3">
            <div className="flex items-start gap-3">
              <span className={`mt-1.5 inline-block w-1.5 h-1.5 rounded-full ${ZONE_DOT[c.zone] ?? ZONE_DOT.unknown}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] text-foreground/90 font-light truncate">{c.displayName}</span>
                  <span className={`text-[8px] tracking-[0.14em] uppercase px-1.5 py-0.5 rounded border ${BEHAVIOR_CHIP[c.behavior]}`}>
                    {c.behavior}
                  </span>
                  {c.watchlisted && (
                    <span className="text-[8px] tracking-[0.14em] uppercase px-1.5 py-0.5 rounded border text-amber-300/90 border-amber-300/30">watch</span>
                  )}
                </div>
                <div className="text-[9px] font-mono text-muted-foreground/45 truncate">
                  {c.id} · {SOURCE_LABEL[c.nameSource]}{c.manufacturer ? ` · ${c.manufacturer}` : ""}{c.inferredKind ? ` · ${c.inferredKind}` : ""}
                </div>
                <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground/60">
                  <span className="font-mono text-foreground/70">{c.rssi != null ? `${c.rssi} dBm` : "—"}</span>
                  <span>{c.distanceLabel}</span>
                  <span>{c.zone}</span>
                  {c.bearing != null && <span className="font-mono">bearing {c.bearing.toFixed(0)}°</span>}
                </div>
                {c.intel && (
                  <div className="mt-2 text-[10px] text-foreground/70 border-l-2 border-border/20 pl-2 space-y-0.5">
                    {c.intel.gattName     && <div><span className="text-muted-foreground/40">name·</span>{c.intel.gattName}</div>}
                    {c.intel.manufacturer && <div><span className="text-muted-foreground/40">mfr·</span>{c.intel.manufacturer}</div>}
                    {c.intel.modelNumber  && <div><span className="text-muted-foreground/40">model·</span>{c.intel.modelNumber}</div>}
                    {c.intel.firmwareRev  && <div><span className="text-muted-foreground/40">fw·</span>{c.intel.firmwareRev}</div>}
                    {c.intel.batteryLevel != null && <div><span className="text-muted-foreground/40">batt·</span>{c.intel.batteryLevel}%</div>}
                    {c.intel.services.length > 0 && (
                      <div className="font-mono text-muted-foreground/50 break-all">{c.intel.services.join(" · ")}</div>
                    )}
                    {c.intel.errors.length > 0 && <div className="text-rose-300/80">err · {c.intel.errors.join("; ")}</div>}
                  </div>
                )}
              </div>
              {!compact && (
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => onToggleWatch(c.id)}
                    className={`text-[9px] tracking-[0.14em] uppercase px-2 py-1 rounded border ${
                      c.watchlisted
                        ? "border-amber-300/30 text-amber-300/90 bg-amber-300/[0.05]"
                        : "border-border/10 text-muted-foreground/60 hover:text-foreground/80 hover:bg-foreground/[0.03]"
                    }`}
                  >{c.watchlisted ? "Unwatch" : "Watch"}</button>
                  <button
                    onClick={() => onPullIntel(c.id)}
                    className="text-[9px] tracking-[0.14em] uppercase px-2 py-1 rounded border border-border/10 text-muted-foreground/60 hover:text-foreground/80 hover:bg-foreground/[0.03]"
                  >Pull Intel</button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Panel({ icon: Icon, title, subtitle, children }: {
  icon: React.ElementType; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/[0.08] bg-foreground/[0.015] backdrop-blur-md p-4 sm:p-5">
      <header className="flex items-start gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-foreground/[0.04] border border-border/[0.08] flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-foreground/60" />
        </div>
        <div className="min-w-0">
          <h2 className="text-[11px] tracking-[0.16em] uppercase text-foreground/85">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[10px] text-muted-foreground/50 font-light">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function Note({ tone, icon: Icon, children }: {
  tone: "info" | "warn" | "error"; icon: React.ElementType; children: React.ReactNode;
}) {
  const cls =
    tone === "error" ? "border-rose-300/20 bg-rose-300/[0.04] text-rose-200/80" :
    tone === "warn"  ? "border-amber-300/20 bg-amber-300/[0.04] text-amber-200/80" :
                       "border-border/[0.08] bg-foreground/[0.02] text-muted-foreground/70";
  return (
    <div className={`mt-3 flex gap-2 items-start text-[10px] leading-relaxed rounded-lg border p-2.5 ${cls}`}>
      <Icon className="h-3 w-3 mt-0.5 shrink-0 opacity-70" />
      <div className="font-light">{children}</div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border/[0.06] bg-foreground/[0.02] p-3">
      <div className="text-[9px] tracking-[0.18em] uppercase text-muted-foreground/45">{label}</div>
      <div className="mt-1 text-sm font-light text-foreground/90 truncate">{value}</div>
      {sub && <div className="mt-0.5 text-[9px] text-muted-foreground/40 font-light">{sub}</div>}
    </div>
  );
}


function ActionButton({ icon: Icon, children, onClick, tone }: {
  icon: React.ElementType; children: React.ReactNode; onClick: () => void; tone?: "danger";
}) {
  const cls = tone === "danger"
    ? "bg-rose-400/[0.08] hover:bg-rose-400/[0.14] text-rose-300/90 border-rose-300/20"
    : "bg-foreground/[0.06] hover:bg-foreground/[0.1] text-foreground/80 border-border/[0.08]";
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-[0.16em] uppercase border ${cls}`}>
      <Icon className="h-3 w-3" /> {children}
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────
// Ghost-Recon style HUD
// ───────────────────────────────────────────────────────────────────

function CompassStrip({ heading, contacts, fov }: {
  heading: number | null;
  contacts: Array<{ id: string; displayName: string; bearing?: number | null; bearingConfidence: number }>;
  fov: number;
}) {
  const h = heading ?? 0;
  // Build ticks covering ±fov from heading
  const ticks: Array<{ deg: number; major: boolean; label?: string }> = [];
  const start = Math.floor((h - fov / 2) / 5) * 5;
  for (let d = start; d <= h + fov / 2; d += 5) {
    const norm = ((d % 360) + 360) % 360;
    const major = norm % 30 === 0;
    let label: string | undefined;
    if (major) {
      if (norm === 0) label = "N"; else if (norm === 90) label = "E";
      else if (norm === 180) label = "S"; else if (norm === 270) label = "W";
      else label = String(norm);
    }
    ticks.push({ deg: d, major, label });
  }
  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-[88%] max-w-[520px] pointer-events-none">
      <div className="relative h-9 rounded-md border border-[#c69a4a]/30 bg-gradient-to-b from-[#1a1208]/70 to-black/55 backdrop-blur-md overflow-hidden shadow-[inset_0_0_18px_-6px_rgba(198,154,74,0.35)]">
        {/* tick row */}
        {ticks.map((t, i) => {
          const offset = ((t.deg - h) / (fov / 2)) * 50 + 50;
          if (offset < -2 || offset > 102) return null;
          return (
            <div key={i} style={{ left: `${offset}%` }} className="absolute top-0 -translate-x-1/2">
              <div className={`mx-auto w-px ${t.major ? "h-3 bg-[#e8c684]" : "h-1.5 bg-[#c69a4a]/45"}`} />
              {t.label && (
                <div className="mt-0.5 text-[9px] font-mono text-[#e8c684] text-center -translate-x-1/2 absolute left-1/2 top-3 whitespace-nowrap">
                  {t.label}
                </div>
              )}
            </div>
          );
        })}
        {/* contact pips on the strip */}
        {heading != null && contacts.map((c) => {
          const delta = bearingDelta(c.bearing!, heading);
          if (Math.abs(delta) > fov / 2) return null;
          const x = 50 + (delta / (fov / 2)) * 50;
          return (
            <div key={c.id} style={{ left: `${x}%` }}
              className="absolute bottom-0.5 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#f0d59a] shadow-[0_0_6px_rgba(240,213,154,0.95)]" />
          );
        })}
        {/* center heading marker */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 h-full w-px bg-[#e8c684]" />
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-[#e8c684]" />
      </div>
      <div className="mt-1 text-center text-[10px] font-mono text-[#e8c684] tracking-[0.2em]">
        {heading != null ? `${heading.toFixed(0).padStart(3, "0")}°` : "--- °"}
      </div>
    </div>
  );
}

function MiniMap({ heading, contacts }: {
  heading: number | null;
  contacts: Array<{ id: string; displayName: string; bearing?: number | null; bearingConfidence: number; rssi?: number }>;
}) {
  const size = 124;
  const r = size / 2;
  const rssiToRadius = (rssi?: number) => {
    if (rssi == null) return r * 0.85;
    const t = Math.min(1, Math.max(0, (Math.abs(rssi) - 30) / 65));
    return 10 + t * (r - 16);
  };
  // All BT contacts shown — pinless ones placed by hashed angle so even no-bearing devices appear on the compass
  const placed = contacts.map((c) => {
    let angle: number;
    if (c.bearing != null) {
      angle = (((c.bearing - (heading ?? 0)) % 360) + 360) % 360;
    } else {
      let hash = 0; for (let i = 0; i < c.id.length; i++) hash = (hash * 31 + c.id.charCodeAt(i)) >>> 0;
      angle = hash % 360;
    }
    const rad = (angle - 90) * (Math.PI / 180);
    const dist = rssiToRadius((c as any).rssi);
    return { ...c, x: r + Math.cos(rad) * dist, y: r + Math.sin(rad) * dist, dim: c.bearing != null ? 1 : 0.55 };
  });
  return (
    <div className="absolute bottom-3 left-3 pointer-events-none select-none" style={{ zIndex: 5 }}>
      <div className="relative rounded-full bg-gradient-to-br from-[#1a1208]/70 to-black/55 backdrop-blur-xl ring-1 ring-[#c69a4a]/35 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.7),inset_0_0_30px_-10px_rgba(198,154,74,0.45)]"
        style={{ width: size, height: size }}>
        {/* concentric range arcs */}
        <div className="absolute inset-2 rounded-full border border-[#c69a4a]/20" />
        <div className="absolute inset-5 rounded-full border border-[#c69a4a]/15" />
        <div className="absolute inset-8 rounded-full border border-[#c69a4a]/10" />
        {/* cross */}
        <div className="absolute left-1/2 top-1.5 bottom-1.5 w-px bg-[#c69a4a]/20" />
        <div className="absolute top-1/2 left-1.5 right-1.5 h-px bg-[#c69a4a]/20" />
        {/* FOV cone (forward direction = up) */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="absolute inset-0"
            style={{ background: "conic-gradient(from -30deg, rgba(232,198,132,0.32) 0deg, rgba(232,198,132,0.05) 60deg, transparent 60deg 360deg)" }} />
        </div>
        {/* Bluetooth contacts */}
        {placed.map((c) => (
          <div key={c.id} className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: c.x, top: c.y, opacity: c.dim }}>
            <span className="block w-1.5 h-1.5 rounded-full bg-[#f0d59a] shadow-[0_0_8px_rgba(240,213,154,0.95)]" />
          </div>
        ))}
        {/* operator pip + forward arrow */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#e8c684] shadow-[0_0_10px_rgba(232,198,132,0.95)]" />
        </div>
        <div className="absolute left-1/2 top-1 -translate-x-1/2 text-[8px] font-mono text-[#e8c684] tracking-[0.16em]">N</div>
        {/* contact count bubble */}
        <div className="absolute -top-1.5 -right-1.5 text-[8px] font-mono px-1.5 py-px rounded-full bg-[#c69a4a] text-black tracking-wider shadow-[0_0_8px_-1px_rgba(198,154,74,0.7)]">
          {contacts.length}
        </div>
      </div>
    </div>
  );
}


/* ============================ FULL-SIZE RADAR (SCAN TAB) ============================ */

function RadarMap({
  heading, compassOn, compassErr, onEnableCompass, contacts, onPick, mode,
}: {
  heading: number | null;
  compassOn: boolean;
  compassErr: string | null;
  onEnableCompass: () => void;
  contacts: Contact[];
  onPick: () => void;
  mode: ScanMode;
}) {
  const SIZE = 280;
  const R = SIZE / 2;
  const h = heading ?? 0;

  // RSSI -> radial distance from center (closer = stronger)
  const rssiToRadius = (rssi?: number) => {
    if (rssi == null) return R * 0.78;
    const t = Math.min(1, Math.max(0, (Math.abs(rssi) - 30) / 65));
    return 14 + t * (R - 24);
  };

  // Sweep animation angle (CSS-only via animate-spin would override transform; do JS lite)
  const [sweep, setSweep] = useState(0);
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = t - last; last = t;
      setSweep((s) => (s + dt * 0.12) % 360); // ~30s per rev
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const cardinals = [
    { l: "N", a: 0 }, { l: "E", a: 90 }, { l: "S", a: 180 }, { l: "W", a: 270 },
  ];

  return (
    <div className="mt-4 flex flex-col items-center gap-3">
      {/* heading readout */}
      <div className="flex items-center gap-2 text-[9px] font-mono tracking-[0.18em] uppercase text-foreground/60">
        <span className={`px-2 py-0.5 rounded border ${compassOn ? "border-[#c69a4a]/30 text-[#c69a4a]/90" : "border-border/20"}`}>
          HDG {heading != null ? Math.round(heading).toString().padStart(3, "0") : "---"}°
        </span>
        <span className="text-muted-foreground/40">
          {contacts.length} contact{contacts.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        {/* outer ring */}
        <div className="absolute inset-0 rounded-full border border-[#c69a4a]/25 bg-black/60 backdrop-blur-sm" />
        {/* range rings */}
        <div className="absolute inset-[14%] rounded-full border border-[#c69a4a]/15" />
        <div className="absolute inset-[32%] rounded-full border border-[#c69a4a]/12" />
        <div className="absolute inset-[52%] rounded-full border border-[#c69a4a]/10" />
        {/* crosshairs */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#c69a4a]/15" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-[#c69a4a]/15" />

        {/* world layer: rotates opposite of heading so "up" is the device's forward direction */}
        <div
          className="absolute inset-0"
          style={{ transform: `rotate(${-h}deg)`, transformOrigin: "50% 50%" }}
        >
          {/* cardinal markers (in world coordinates) */}
          {cardinals.map((c) => {
            const rad = (c.a - 90) * (Math.PI / 180);
            const x = R + Math.cos(rad) * (R - 10);
            const y = R + Math.sin(rad) * (R - 10);
            return (
              <div
                key={c.l}
                className="absolute text-[10px] font-mono font-medium text-[#c69a4a]/80"
                style={{
                  left: x, top: y,
                  transform: `translate(-50%,-50%) rotate(${h}deg)`,
                }}
              >{c.l}</div>
            );
          })}

          {/* contacts (bearing is world-absolute compass degrees) */}
          {contacts.map((c) => {
            const bearing = c.bearing;
            const rssi = (c as any).rssi as number | undefined;
            // If no bearing yet, place by RSSI only at a stable angle from id hash
            let angleDeg: number;
            if (bearing != null) {
              angleDeg = bearing;
            } else {
              let hash = 0;
              for (let i = 0; i < c.id.length; i++) hash = (hash * 31 + c.id.charCodeAt(i)) >>> 0;
              angleDeg = hash % 360;
            }
            const rad = (angleDeg - 90) * (Math.PI / 180);
            const dist = rssiToRadius(rssi);
            const x = R + Math.cos(rad) * dist;
            const y = R + Math.sin(rad) * dist;
            const conf = c.bearingConfidence ?? 0;
            const dim = bearing == null ? 0.45 : 0.55 + Math.min(0.45, conf);
            const label = c.displayName || c.id.slice(0, 8);
            return (
              <div key={c.id} className="absolute" style={{ left: x, top: y, transform: "translate(-50%,-50%)" }}>
                <div
                  className="w-2 h-2 rounded-full bg-amber-300"
                  style={{ boxShadow: "0 0 10px rgba(252,211,77,0.85)", opacity: dim }}
                />
                <div
                  className="mt-0.5 text-[8px] font-mono tracking-wide text-amber-200/80 whitespace-nowrap"
                  style={{ transform: `translateX(-50%) translateX(6px) rotate(${h}deg)`, transformOrigin: "0 0", opacity: dim }}
                >{label}</div>
              </div>
            );
          })}
        </div>

        {/* radar sweep — relative to device (always points up) */}
        <div
          className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
          style={{ transform: `rotate(${sweep}deg)` }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: "conic-gradient(from -90deg, rgba(198,154,74,0.32) 0deg, rgba(198,154,74,0.04) 40deg, transparent 60deg 360deg)",
            }}
          />
        </div>

        {/* device pointer (always up) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[14px] border-l-transparent border-r-transparent border-b-#c69a4a -translate-y-3 drop-shadow-[0_0_6px_rgba(198,154,74,0.9)]" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#c69a4a]/90 shadow-[0_0_10px_rgba(198,154,74,0.95)]" />
        </div>

        {/* empty-state overlay */}
        {contacts.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-6 pointer-events-none">
            <div className="pointer-events-auto flex flex-col items-center gap-2 px-3 py-2 rounded-lg bg-black/55 border border-[#c69a4a]/15 backdrop-blur-sm">
              <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-[#c69a4a]/70">No contacts</span>
              <span className="text-[8px] text-muted-foreground/70 tracking-wide text-center max-w-[200px] leading-relaxed">
                {mode === "unsupported"
                  ? "Browser has no Web Bluetooth"
                  : "Pair a BLE device via the OS chooser to plot it on the radar"}
              </span>
              {mode !== "unsupported" && (
                <button
                  onClick={onPick}
                  className="mt-0.5 px-2.5 py-1 rounded-md text-[9px] tracking-[0.18em] uppercase border border-[#c69a4a]/30 text-[#e8c684]/90 hover:bg-[#c69a4a]/[0.06]"
                >+ Add Device</button>
              )}
            </div>
          </div>
        )}
      </div>


      {/* compass controls */}
      {!compassOn ? (
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={onEnableCompass}
            className="px-3 py-1.5 rounded-md text-[10px] tracking-[0.18em] uppercase border border-[#c69a4a]/30 text-[#e8c684]/90 hover:bg-[#c69a4a]/[0.06]"
          >Enable Compass</button>
          <span className="text-[8px] text-muted-foreground/45 tracking-[0.14em] uppercase">
            iOS requires a one-time motion permission tap
          </span>
          {compassErr && <span className="text-[9px] text-rose-300/80">{compassErr}</span>}
        </div>
      ) : (
        <span className="text-[8px] tracking-[0.18em] uppercase text-[#c69a4a]/60">
          Compass live · move your device to rotate the map
        </span>
      )}
    </div>
  );
}

/* ============================ SATELLITE MAP ============================ */
// Uses Esri World Imagery (no API key). Browser geolocation → bbox export.
// Contacts are overlaid as amber pips around operator, distanced by RSSI.

function SatelliteMap({
  heading,
  contacts,
  onPick,
}: {
  heading: number | null;
  contacts: Contact[];
  onPick?: () => void;
}) {
  const [pos, setPos] = useState<{ lat: number; lon: number; acc: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState(18); // 10 wide → 20 close
  const [showLabels, setShowLabels] = useState(true);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setErr("Geolocation not available in this browser.");
      return;
    }
    const w = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
      (e) => setErr(e.message),
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(w);
  }, []);

  // half-extent in degrees — finer per zoom step so + actually zooms in noticeably
  const halfDeg = useMemo(() => {
    // ~40m at z20, doubles every step out → ~40km at z10
    const meters = 40 * Math.pow(2, 20 - zoom);
    return meters / 111_320;
  }, [zoom]);

  const tileUrl = useMemo(() => {
    if (!pos) return null;
    const { lat, lon } = pos;
    const minLon = lon - halfDeg;
    const minLat = lat - halfDeg;
    const maxLon = lon + halfDeg;
    const maxLat = lat + halfDeg;
    const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
    return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&imageSR=3857&size=720,540&format=jpg&transparent=false&f=image`;
  }, [pos, halfDeg]);

  // operator-relative pixel offset for a contact. Uses estimated bearing if present,
  // otherwise hash-stable angle. Radius scales with RSSI distance AND current zoom
  // (closer pips spread out as you zoom in — what the user expects from a map).
  const pipFor = (c: Contact, i: number) => {
    const rssi = c.rssi ?? -85;
    const norm = Math.max(0, Math.min(1, (rssi + 100) / 60)); // -100..-40 → 0..1
    const distMeters = c.distanceMeters ?? (1 + (1 - norm) * 60);
    // meters per pixel at current bbox (map is 720 wide rendering into container)
    const halfMeters = halfDeg * 111_320;
    const pxPerMeter = 180 / Math.max(halfMeters, 1); // 180 ≈ container half-width fudge
    const radiusPx = Math.min(180, distMeters * pxPerMeter);
    const bearingDeg = c.bearing ?? ((parseInt(c.id.slice(-4), 36) || i * 47) % 360);
    const rad = ((bearingDeg - (heading ?? 0)) * Math.PI) / 180;
    return {
      x: Math.sin(rad) * radiusPx,
      y: -Math.cos(rad) * radiusPx,
    };
  };

  return (
    <div className="mt-3 space-y-2">
      {err && (
        <div className="text-[10px] text-rose-300/80 border border-rose-300/20 rounded-md px-2 py-1.5">
          {err} · enable location to render satellite imagery
        </div>
      )}
      <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-[#c69a4a]/20 bg-black">
        {tileUrl ? (
          <img
            key={tileUrl}
            src={tileUrl}
            alt="Satellite imagery centered on operator"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-[10px] tracking-[0.18em] uppercase text-muted-foreground/60">
            {err ? "no satellite fix" : "acquiring GPS…"}
          </div>
        )}

        {/* operator + heading cone */}
        {pos && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div
              className="absolute left-1/2 top-1/2"
              style={{
                width: 120, height: 120,
                background: "conic-gradient(from -30deg, rgba(232,198,132,0.35), transparent 60deg)",
                transform: `translate(-50%,-50%) rotate(${heading ?? 0}deg)`,
                clipPath: "polygon(50% 50%, 0 0, 100% 0)",
                borderRadius: "50%",
              }}
            />
            <div className="relative h-3 w-3 rounded-full bg-[#e8c684] shadow-[0_0_12px_rgba(232,198,132,0.9)] ring-2 ring-black/40" />
          </div>
        )}

        {/* contact pips around operator */}
        {pos && contacts.slice(0, 48).map((c, i) => {
          const { x, y } = pipFor(c, i);
          const dim = c.behavior === "lost" ? "opacity-40" : "";
          return (
            <div
              key={c.id}
              className="absolute left-1/2 top-1/2 pointer-events-none"
              style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
            >
              <div className={`h-2.5 w-2.5 rounded-full bg-[#c69a4a] shadow-[0_0_10px_rgba(198,154,74,0.95)] ring-1 ring-black/40 ${dim}`} />
              {showLabels && (
                <div className="absolute left-3 top-1/2 -translate-y-1/2 whitespace-nowrap px-1.5 py-0.5 rounded bg-black/60 border border-[#c69a4a]/25 text-[8px] font-mono tracking-wider text-[#e8c684]/90">
                  {c.displayName.slice(0, 18)} · {c.rssi ?? "—"}dBm
                </div>
              )}
            </div>
          );
        })}

        {/* empty-state add device */}
        {pos && contacts.length === 0 && onPick && (
          <button
            onClick={onPick}
            className="absolute left-1/2 bottom-3 -translate-x-1/2 px-3 py-1.5 rounded-md bg-black/70 border border-[#c69a4a]/40 text-[10px] tracking-[0.18em] uppercase text-[#e8c684] hover:bg-[#c69a4a]/[0.12]"
          >
            + Add Device
          </button>
        )}

        {/* zoom controls */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <button onClick={() => setZoom((z) => Math.min(20, z + 1))} className="h-8 w-8 rounded-md bg-black/65 border border-[#c69a4a]/30 text-[#e8c684] text-base leading-none">+</button>
          <button onClick={() => setZoom((z) => Math.max(10, z - 1))} className="h-8 w-8 rounded-md bg-black/65 border border-[#c69a4a]/30 text-[#e8c684] text-base leading-none">−</button>
          <button
            onClick={() => setShowLabels((s) => !s)}
            className="h-8 w-8 rounded-md bg-black/65 border border-[#c69a4a]/30 text-[#e8c684] text-[9px] tracking-wider"
            title="Toggle labels"
          >{showLabels ? "LBL" : "•"}</button>
        </div>

        {/* readout */}
        {pos && (
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 border border-[#c69a4a]/20 text-[9px] font-mono tracking-wider text-[#e8c684]/90">
            {pos.lat.toFixed(5)}, {pos.lon.toFixed(5)} · ±{Math.round(pos.acc)}m · z{zoom} · {contacts.length} pip{contacts.length === 1 ? "" : "s"}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ ZAXIN VISION THEORIES ============================ */

const VISION_THEORIES: Array<{ id: string; title: string; body: string }> = [
  {
    id: "T1",
    title: "RSSI → Camera Reticle",
    body: "Rear camera = world plane. Project each contact's RSSI-derived bearing onto a ~65° FOV. x = (Δbearing / FOV) × width. Pip size scales inversely with distanceMeters. Ghost-Recon overlay without extra hardware.",
  },
  {
    id: "T2",
    title: "Inverse-RSSI SLAM",
    body: "Buffer 30s of (heading, rssi) per device. A tiny on-device Kalman/TF.js head solves for most-likely (bearing, range) and tracks through operator motion. Confidence drives reticle thickness.",
  },
  {
    id: "T3",
    title: "Visual ↔ BLE Fusion",
    body: "MediaPipe detects people, phones, watches, earbuds, AirTag shapes. When a detection's screen position overlaps a BLE reticle within tolerance, AI binds them: 'Pixel 8 at 4 m → person at center-frame'. IoU tracking persists names across frames.",
  },
  {
    id: "T4",
    title: "AXRLEN Threat Narrator",
    body: "Every 5 s feed {contacts, alerts, scenario, fusion bindings} to AXRLEN for a one-sentence tactical brief: 'Clone-suspect AirPods at 8 o'clock, closing 1.2 m/s — likely tail.' Rendered as HUD ticker.",
  },
  {
    id: "T5",
    title: "Behavior Fingerprinting",
    body: "Small classifier over RSSI time-series + manufacturer + service UUIDs labels device intent: stationary beacon vs. carried-on-person vs. vehicle-mounted. Auto-drives threatTier.",
  },
  {
    id: "T6",
    title: "Photogrammetric Anchor",
    body: "When the camera sees a landmark (door, car, signpost) co-located with a strong BLE pip, the contact is anchored to that visual feature — stays pinned even when the operator turns away. True AR persistence without ARKit.",
  },
  {
    id: "T7",
    title: "Ultrasonic Cross-Check",
    body: "Many BLE peripherals also emit 18–22 kHz chirps during pairing. Mic FFT detecting a pulse simultaneous with a new advert hardens the visual ↔ BLE fusion binding.",
  },
];

function VisionTheoriesPanel() {
  return (
    <Panel icon={Eye} title="Zaxin Vision — AI Integration Theories" subtitle="Seven blueprints for fusing camera, BLE, audio, and AXRLEN into one tactical picture">
      <div className="mt-3 grid sm:grid-cols-2 gap-2">
        {VISION_THEORIES.map((t) => (
          <div key={t.id} className="rounded-md border border-[#c69a4a]/15 bg-black/30 p-3">
            <div className="flex items-baseline gap-2">
              <span className="text-[9px] tracking-[0.22em] uppercase text-[#c69a4a]/70">{t.id}</span>
              <h4 className="text-[12px] text-[#e8c684]">{t.title}</h4>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-foreground/70">{t.body}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ============================ AI BRIEF (BYOK) ============================ */
// Generates a Ghost-Recon-style tactical brief from the current contact picture.
// Uses the user's BYOK key from Zophiel Engine settings — no platform key fallback.

function AiBriefPanel({ contacts, scenario }: { contacts: Contact[]; scenario: ScenarioId }) {
  const [brief, setBrief] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const byok = getActiveIntelMapByok();

  const summarizeContacts = () =>
    contacts.slice(0, 24).map((c) => ({
      name: c.displayName,
      kind: c.inferredKind ?? "unknown",
      rssi: c.rssi,
      dist: c.distanceLabel,
      zone: c.zone,
      bearing: c.bearing,
      behavior: c.behavior,
      source: c.source,
    }));

  const run = async () => {
    setErr(null); setBusy(true); setBrief("");
    try {
      if (!byok) throw new Error("No BYOK key active. Add yours in Dashboard → Zophiel Engine → BYOK.");

      const payload = { scenario, contacts: summarizeContacts() };
      const prompt =
        "You are AXRLEN, a tactical RF/BLE intelligence officer. Given the JSON contact picture, " +
        "produce a four-line Ghost-Recon-style brief: (1) one-sentence situational summary, " +
        "(2) highest-priority threat or anomaly, (3) recommended action, " +
        "(4) confidence (low/med/high). No moralizing, no preamble. " +
        "JSON:\n" + JSON.stringify(payload);

      let text = "";
      if (byok.provider === "google") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(byok.model)}:generateContent?key=${encodeURIComponent(byok.apiKey)}`;
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message ?? `Gemini ${r.status}`);
        text = j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
      } else if (byok.provider === "openai") {
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${byok.apiKey}` },
          body: JSON.stringify({ model: byok.model, messages: [{ role: "user", content: prompt }] }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message ?? `OpenAI ${r.status}`);
        text = j?.choices?.[0]?.message?.content ?? "";
      } else {
        throw new Error(`Provider "${byok.provider}" is not yet wired for in-browser briefs. Switch your Zophiel BYOK to Google or OpenAI for the Zaxin AI Brief.`);
      }
      setBrief(text.trim() || "(empty response)");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel
      icon={Cpu}
      title="AXRLEN Tactical Brief"
      subtitle={byok ? `BYOK active · ${byok.provider} · ${byok.model}` : "Bring-your-own-key required"}
    >
      {!byok && (
        <div className="mt-3 rounded-md border border-[#c69a4a]/25 bg-black/40 p-3 text-[11px] text-foreground/75">
          The Zaxin AI Brief uses <strong>your own API key</strong> — no platform fallback. Add a key in{" "}
          <Link to="/dashboard/zophiel-engine" className="underline text-[#e8c684]">
            Dashboard → Zophiel Engine → BYOK
          </Link>{" "}
          (Google, OpenAI, Anthropic, xAI, DeepSeek, Mistral, or Perplexity). Google or OpenAI are wired for in-browser briefs today.
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={run}
          disabled={busy || !byok}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[10px] tracking-[0.18em] uppercase border border-[#c69a4a]/30 text-[#e8c684] hover:bg-[#c69a4a]/[0.08] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Activity className="h-3.5 w-3.5" />
          {busy ? "Composing…" : "Generate Brief"}
        </button>
        <span className="text-[9px] tracking-[0.18em] uppercase text-muted-foreground/55">
          {contacts.length} contact{contacts.length === 1 ? "" : "s"} in scope · scenario {SCENARIOS[scenario].label}
        </span>
      </div>
      {err && (
        <div className="mt-2 text-[10px] rounded-md border border-rose-300/25 bg-rose-500/[0.06] text-rose-200/90 px-2 py-1.5">
          {err}
        </div>
      )}
      {brief && (
        <pre className="mt-3 rounded-md border border-[#c69a4a]/20 bg-black/45 p-3 text-[11px] leading-relaxed text-[#e8c684]/95 whitespace-pre-wrap font-mono">
{brief}
        </pre>
      )}
    </Panel>
  );
}

/* ====================== AI VISION IDENTIFY (BYOK) ====================== */
// Sends a single camera frame + the current optical bboxes + BLE-ranged contacts
// to the user's BYOK vision model (Google Gemini or OpenAI). The model returns
// refined identifications ("AirPods Pro case", "iPhone 15", "MacBook Air") and
// optionally pairs each visual object to a BLE contact id. We sort the result
// by RSSI-derived distance (closest first) so the operator sees a ranked
// "who is in the room" list — labeled, identified, and distance-ordered.

export type VisionIdent = {
  label: string;            // refined human label, e.g. "iPhone 15 Pro, black case"
  brand?: string | null;    // best-guess brand, e.g. "Apple"
  device_type?: string | null; // phone|laptop|tablet|earbuds|watch|tv|speaker|router|camera|person|other
  has_bluetooth?: boolean | null;
  matched_optical_id?: string | null;
  matched_ble_id?: string | null;
  // bbox in PERCENT of the frame — supplied by the AI when no optical pair exists
  bbox_pct?: { x: number; y: number; w: number; h: number } | null;
  est_distance_m?: number | null;
  confidence?: number | null; // 0..1
  note?: string | null;
};

function AiVisionIdentifyPanel(props: {
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  optical: OpticalContact[];
  contacts: Contact[];
  arOn: boolean;
  onIdents?: (idents: VisionIdent[]) => void;
}) {
  const byok = getActiveIntelMapByok();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [idents, setIdents] = useState<VisionIdent[]>([]);
  // Automated by default — no clicking required.
  const [autoOn, setAutoOn] = useState(true);
  const timerRef = useRef<number | null>(null);
  const busyRef = useRef(false);

  // Snapshot the current video frame to a base64 JPEG (max 768px on the long edge).
  const grabFrame = (): string | null => {
    const v = props.videoRef.current;
    if (!v || !v.videoWidth) return null;
    const MAX = 768;
    const scale = Math.min(1, MAX / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.floor(v.videoWidth * scale);
    const h = Math.floor(v.videoHeight * scale);
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d"); if (!ctx) return null;
    ctx.drawImage(v, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.78);
  };

  const buildPayload = () => {
    const opt = props.optical.slice(0, 16).map((o, i) => ({
      id: `opt:${i}`,
      label: o.label,
      score: Number(o.score.toFixed(2)),
      bbox_pct: { x: +(o.x * 100).toFixed(1), y: +(o.y * 100).toFixed(1), w: +(o.w * 100).toFixed(1), h: +(o.h * 100).toFixed(1) },
    }));
    const ble = props.contacts.slice(0, 24).map((c) => {
      const rssi = c.rssi ?? null;
      const dist = rssi != null ? +rssiToDistance(rssi).toFixed(2) : null;
      return {
        id: c.id,
        name: c.displayName,
        kind: c.inferredKind ?? "unknown",
        rssi, est_distance_m: dist,
        bearing_deg: c.bearing ?? null,
        zone: c.zone,
      };
    });
    return { optical: opt, ble };
  };

  const prompt = (payload: object) =>
    "You are AXRLEN Vision, a tactical sensor-fusion analyst. You are given:\n" +
    "1) ONE camera frame from a body-worn rear camera.\n" +
    "2) An OPTICAL list — bounding boxes from a generic COCO detector (coarse labels) in PERCENT of frame.\n" +
    "3) A BLE list — Bluetooth contacts with RSSI-derived distance estimates (meters).\n\n" +
    "For EVERY visible electronic device, accessory, or notable object in the IMAGE, return one entry. " +
    "Refine the label well beyond the COCO term (e.g. 'cell phone' → 'iPhone 15 Pro, black case'; " +
    "'remote' → 'Apple TV Siri Remote'; 'tv' → 'LG OLED C3 65\"'; an object COCO missed but you can see → still include it). " +
    "Always fill: brand (Apple, Samsung, Sony, Bose, Logitech, etc. — null if unknown); " +
    "device_type (one of: phone, laptop, tablet, earbuds, headphones, watch, tv, speaker, router, camera, console, keyboard, mouse, remote, appliance, vehicle, person, other); " +
    "has_bluetooth (true if this device class typically transmits Bluetooth/BLE — phones, laptops, earbuds, watches, speakers, remotes, consoles, keyboards, mice, modern TVs, AirTags = true; basic appliances, books, bottles = false). " +
    "When confident, pair to one optical bbox via matched_optical_id and/or to one BLE id via matched_ble_id (use BLE name + bearing + distance vs your visual range estimate). " +
    "If the item is NOT in the optical list, provide bbox_pct {x,y,w,h} in PERCENT of the frame so we can draw a box on it. " +
    "Set est_distance_m from the BLE pair if matched, otherwise from visual scale. Confidence is 0..1.\n\n" +
    "Return ONLY this JSON, no prose, no markdown:\n" +
    `{"identifications":[{"label":"","brand":null,"device_type":null,"has_bluetooth":null,"matched_optical_id":null,"matched_ble_id":null,"bbox_pct":null,"est_distance_m":null,"confidence":0,"note":null}]}\n\n` +
    "Context JSON:\n" + JSON.stringify(payload);

  const parseJson = (text: string): VisionIdent[] => {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return [];
    try {
      const j = JSON.parse(m[0]);
      const arr = j?.identifications;
      return Array.isArray(arr) ? arr.slice(0, 32) : [];
    } catch { return []; }
  };

  const onIdentsRef = useRef(props.onIdents);
  useEffect(() => { onIdentsRef.current = props.onIdents; }, [props.onIdents]);

  const run = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setErr(null); setBusy(true);
    try {
      if (!byok) throw new Error("No BYOK key active. Add yours in Dashboard → Zophiel Engine → BYOK.");
      const dataUrl = grabFrame();
      if (!dataUrl) throw new Error("Camera frame not ready — activate AR first.");
      const payload = buildPayload();
      const p = prompt(payload);

      let text = "";
      if (byok.provider === "google") {
        const base64 = dataUrl.split(",")[1] ?? "";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(byok.model)}:generateContent?key=${encodeURIComponent(byok.apiKey)}`;
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [
                { text: p },
                { inline_data: { mime_type: "image/jpeg", data: base64 } },
              ],
            }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message ?? `Gemini ${r.status}`);
        text = j?.candidates?.[0]?.content?.parts?.map((q: { text?: string }) => q.text ?? "").join("") ?? "";
      } else if (byok.provider === "openai") {
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${byok.apiKey}` },
          body: JSON.stringify({
            model: byok.model,
            response_format: { type: "json_object" },
            messages: [{
              role: "user",
              content: [
                { type: "text", text: p },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            }],
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error?.message ?? `OpenAI ${r.status}`);
        text = j?.choices?.[0]?.message?.content ?? "";
      } else {
        throw new Error(`Provider "${byok.provider}" is not wired for in-browser vision. Switch BYOK to Google or OpenAI.`);
      }

      const arr = parseJson(text);
      arr.sort((a, b) => {
        const da = a.est_distance_m ?? 9999;
        const db = b.est_distance_m ?? 9999;
        return da - db;
      });
      setIdents(arr);
      onIdentsRef.current?.(arr);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [byok]);

  // Auto-loop every 4s while AR is active and a BYOK key is configured.
  // No buttons required — identifications stream in and project onto the camera as labeled boxes.
  useEffect(() => {
    if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
    if (!autoOn || !props.arOn || !byok) return;
    const kick = window.setTimeout(() => { run(); }, 400);
    timerRef.current = window.setInterval(() => { run(); }, 4000);
    return () => {
      window.clearTimeout(kick);
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [autoOn, props.arOn, byok, run]);

  useEffect(() => {
    if (!props.arOn) { setIdents([]); onIdentsRef.current?.([]); }
  }, [props.arOn]);

  return (
    <Panel
      icon={Eye}
      title="AI Vision Identify"
      subtitle={byok ? `BYOK active · ${byok.provider} · ${byok.model}` : "Bring-your-own-key required"}
    >
      {!byok && (
        <div className="mt-3 rounded-md border border-[#c69a4a]/25 bg-black/40 p-3 text-[11px] text-foreground/75">
          AI Vision uses <strong>your own API key</strong>. Add one in{" "}
          <Link to="/dashboard/zophiel-engine" className="underline text-[#e8c684]">
            Dashboard → Zophiel Engine → BYOK
          </Link>{" "}
          — Google Gemini or OpenAI (must be a vision-capable model).
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[9px] font-mono tracking-[0.18em] uppercase border ${
            !byok ? "text-foreground/45 border-white/[0.08]"
              : !props.arOn ? "text-foreground/55 border-white/[0.10]"
              : busy ? "bg-[#6b4a18]/55 text-[#e8c684] border-[#c69a4a]/60 animate-pulse"
              : autoOn ? "bg-[#6b4a18]/55 text-[#e8c684] border-[#c69a4a]/60"
              : "text-foreground/65 border-white/[0.10]"
          }`}
          title="Automated identification runs every 4 seconds while AR is active. No clicks required."
        >
          <Activity className="h-3 w-3" />
          {!byok ? "BYOK REQUIRED"
            : !props.arOn ? "AR OFF"
            : busy ? "IDENTIFYING…"
            : autoOn ? "AUTO · LIVE"
            : "AUTO PAUSED"}
        </span>
        <button
          onClick={() => setAutoOn((v) => !v)}
          disabled={!byok || !props.arOn}
          className="text-[9px] tracking-[0.18em] uppercase text-foreground/55 hover:text-[#e8c684] underline-offset-2 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
          title="Toggle automated identification."
        >
          {autoOn ? "pause" : "resume"}
        </button>
        <button
          onClick={run}
          disabled={busy || !byok || !props.arOn}
          className="text-[9px] tracking-[0.18em] uppercase text-foreground/55 hover:text-[#e8c684] underline-offset-2 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
          title="Force one identification pass right now."
        >
          rerun
        </button>
        <span className="ml-auto text-[9px] tracking-[0.18em] uppercase text-muted-foreground/55">
          {props.optical.length} optical · {props.contacts.length} BLE · {idents.length} ident
        </span>
      </div>

      {err && (
        <div className="mt-2 text-[10px] rounded-md border border-rose-300/25 bg-rose-500/[0.06] text-rose-200/90 px-2 py-1.5">
          {err}
        </div>
      )}

      {idents.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {idents.map((it, i) => (
            <li key={i} className="flex items-start gap-2 rounded-md border border-[#c69a4a]/20 bg-black/40 px-2.5 py-1.5">
              <span className="text-[10px] font-mono text-[#e8c684]/80 min-w-[3rem]">
                {it.est_distance_m != null ? `${it.est_distance_m.toFixed(1)}m` : "—"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-foreground/90 truncate flex items-center gap-1.5">
                  <span className="truncate">{it.label || "(unlabeled)"}</span>
                  {it.brand ? <span className="text-foreground/45 shrink-0">· {it.brand}</span> : null}
                  {it.has_bluetooth ? (
                    <span className="shrink-0 text-[8px] font-mono tracking-[0.16em] uppercase px-1 py-0.5 rounded-sm border border-[#c69a4a]/40 text-[#e8c684]/85 bg-[#6b4a18]/35">
                      BLE
                    </span>
                  ) : null}
                </div>
                <div className="text-[9px] tracking-wide uppercase text-muted-foreground/55 truncate">
                  {it.device_type ?? "device"}
                  {it.matched_ble_id ? ` · paired ${it.matched_ble_id.slice(0, 10)}` : ""}
                  {it.matched_optical_id ? ` · ${it.matched_optical_id}` : ""}
                  {it.confidence != null ? ` · conf ${(it.confidence * 100).toFixed(0)}%` : ""}
                </div>
                {it.note && (
                  <div className="text-[10px] text-foreground/55 mt-0.5 line-clamp-2">{it.note}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        !err && !busy && (
          <div className="mt-3 text-[10px] tracking-wide uppercase text-muted-foreground/55">
            Activate AR and point the camera. Identifications will stream onto the camera as labeled boxes automatically.
          </div>
        )
      )}
    </Panel>
  );
}

export default ZaxinView;



