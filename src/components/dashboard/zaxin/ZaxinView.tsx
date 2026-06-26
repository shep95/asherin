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
import type { Contact, ScenarioId, ZaxinSnapshot } from "./core/types";

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
  immediate: "bg-emerald-400/80",
  near:      "bg-sky-400/70",
  far:       "bg-amber-400/60",
  unknown:   "bg-foreground/30",
};

const BEHAVIOR_CHIP: Record<string, string> = {
  active:          "text-emerald-300/80 border-emerald-300/20",
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

  const pickDevice = useCallback(async () => {
    setScanErr(null);
    try { await pickOne((adv) => engine.ingest(adv)); }
    catch (e) { setScanErr(e instanceof Error ? e.message : String(e)); }
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
    }
  }, [engine]);

  useEffect(() => () => { compassHandleRef.current?.stop(); }, []);

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
      const pose = await startHeadingStream((deg) => {
        setHeading(deg);
        engine.setHeading(deg);
      });
      poseHandleRef.current = pose;
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
            scanning ? "text-emerald-300/80 border-emerald-300/20 bg-emerald-300/[0.04]"
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
            <Activity className={`h-3 w-3 ${props.scanning ? "text-emerald-300/80 animate-pulse" : ""}`} />
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
          contacts={props.locals}
        />
      </Panel>

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
  const hasBearings = props.contacts.filter((c) => c.bearing != null);

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Panel icon={Camera} title="AR Bluetooth Vision" subtitle="On-device pose + face + hand tracking. Tap a presence on camera to bind it to the strongest Bluetooth signal.">
        {props.arErr && <Note tone="error" icon={AlertTriangle}>{props.arErr}</Note>}
        {bvErr && <Note tone="warn" icon={AlertTriangle}>{bvErr}</Note>}
        <div className="flex flex-wrap gap-2 mt-3">
          {!props.arOn
            ? <ActionButton icon={Play} onClick={props.onStart}>Start AR</ActionButton>
            : <ActionButton icon={Square} tone="danger" onClick={props.onStop}>Stop AR</ActionButton>}
          {props.arOn && Object.keys(bindings).length > 0 && (
            <ActionButton icon={Trash2} onClick={clearBindings}>Unlink All</ActionButton>
          )}
          {props.arOn && (
            <>
              <ActionButton icon={RefreshCw} onClick={props.onFlip}>
                Flip · {props.mainFacing === "environment" ? "Rear" : "Front"}
              </ActionButton>
              {props.scopeAvail && (
                <button onClick={props.onToggleScope}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] tracking-[0.16em] uppercase border ${
                    props.scopeOn
                      ? "bg-emerald-300/[0.08] border-emerald-300/30 text-emerald-200/90"
                      : "bg-foreground/[0.04] border-border/[0.08] text-foreground/70"
                  }`}>
                  <Eye className="h-3 w-3" /> Scope
                </button>
              )}
            </>
          )}
          <div className="ml-auto flex items-center gap-2 text-[9px] tracking-[0.18em] uppercase text-muted-foreground/50">
            <Compass className="h-3 w-3" /> {props.heading != null ? `${props.heading.toFixed(0)}°` : "no heading"}
          </div>
        </div>
        {props.arOn && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["full","face","fingers"] as BodyMode[]).map((m) => (
              <button key={m} onClick={() => toggleMode(m)}
                className={`px-2.5 py-1 rounded-md text-[9px] tracking-[0.14em] uppercase border transition-all ${
                  modes.has(m)
                    ? "bg-emerald-300/[0.08] border-emerald-300/30 text-emerald-200/90"
                    : "border-border/[0.08] text-muted-foreground/55 hover:text-foreground/80"
                }`}>
                {m === "full" ? "Full Body" : m === "face" ? "Face" : "Fingers"}
              </button>
            ))}
            <span className={`ml-auto text-[9px] tracking-[0.18em] uppercase font-mono px-2 py-0.5 rounded border ${
              bvErr ? "text-rose-300/90 border-rose-300/30 bg-rose-300/[0.05]" :
              bvReady ? "text-emerald-300/90 border-emerald-300/30 bg-emerald-300/[0.05]" :
              "text-amber-300/80 border-amber-300/25 bg-amber-300/[0.04]"
            }`}>
              vision · {bvErr ? "failed" : bvReady ? "live" : "loading"}
            </span>
          </div>
        )}
      </Panel>

      <div ref={wrapRef}
        className="relative rounded-2xl overflow-hidden border border-border/[0.1] bg-black min-h-[70vh] sm:min-h-0 sm:aspect-video select-none">
        <video ref={props.videoRef} playsInline muted autoPlay
          className="absolute inset-0 w-full h-full object-cover opacity-95" />
        <canvas ref={canvasRef} onClick={onTap} onTouchStart={onTap}
          className="absolute inset-0 w-full h-full cursor-crosshair" style={{ zIndex: 2 }} />

        {/* Binocular scope: opposite-facing camera, masked into a rectangular cutout pinned to top */}
        {props.arOn && props.scopeOn && props.scopeAvail && (
          <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-[78%] max-w-[560px] pointer-events-none" style={{ zIndex: 3 }}>
            <div className="relative aspect-[16/5] rounded-md overflow-hidden border border-emerald-300/40 bg-black/40 shadow-[0_0_22px_rgba(16,185,129,0.18)]">
              <video ref={props.scopeVideoRef} playsInline muted autoPlay
                className="absolute inset-0 w-full h-full object-cover" />
              {/* corner brackets */}
              <span className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-emerald-300/95" />
              <span className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-emerald-300/95" />
              <span className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-emerald-300/95" />
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-emerald-300/95" />
              {/* center tick */}
              <span className="absolute top-1 left-1/2 -translate-x-1/2 w-px h-2 bg-emerald-300/95" />
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-mono text-emerald-300/90 tracking-[0.2em]">
                {props.mainFacing === "environment" ? "FRONT" : "REAR"} SCOPE
              </span>
            </div>
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 4 }}>
          <div className="absolute top-2 left-2 text-[9px] tracking-[0.18em] uppercase text-emerald-300/70 font-mono">
            LIVE FIELD · {[...modes].map((m) => m === "full" ? "FULL BODY" : m.toUpperCase()).join(" · ") || "—"}
          </div>
        </div>

        {/* Ghost-Recon style HUD: compass strip + minimap, only when AR active */}
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

        {/* In-FOV target reticles (existing behaviour, restyled) */}
        {props.arOn && props.heading != null && hasBearings.map((c) => {
          const delta = bearingDelta(c.bearing!, props.heading!);
          if (Math.abs(delta) > FOV / 2) return null;
          const xPct = 50 + (delta / (FOV / 2)) * 50;
          const opacity = 0.4 + c.bearingConfidence * 0.6;
          const dist = (c as any).distanceM ?? null;
          return (
            <div key={c.id} style={{ left: `${xPct}%`, opacity }}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none">
              <div className="relative w-14 h-10">
                {/* corner brackets */}
                <span className="absolute top-0 left-0 w-2.5 h-2.5 border-t border-l border-emerald-300/90" />
                <span className="absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-emerald-300/90" />
                <span className="absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-emerald-300/90" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 border-b border-r border-emerald-300/90" />
                <span className="absolute inset-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 bg-emerald-300 rounded-full animate-pulse" />
              </div>
              <div className="mt-1 text-[8px] font-mono text-emerald-300/95 bg-black/55 px-1.5 py-0.5 rounded border border-emerald-300/30">
                {c.displayName}{dist != null && <span className="opacity-70"> · {dist.toFixed(1)}m</span>}
              </div>
            </div>
          );
        })}


        {!props.arOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <Camera className="h-6 w-6 text-foreground/30" />
            <div className="mt-2 text-[10px] tracking-[0.18em] uppercase text-foreground/50">Camera idle</div>
            <p className="mt-2 max-w-sm text-[10px] text-muted-foreground/55 font-light leading-relaxed">
              Tap <b>Start AR</b>, grant camera + motion permissions. Body, face and finger landmarks render on the live feed.
              Tap a detected region to bind it to a Bluetooth signal.
            </p>
          </div>
        )}
      </div>

      <div className="text-[9px] tracking-[0.18em] uppercase text-muted-foreground/45 text-center">
        Select a presence on camera, then a Bluetooth signal to link identity.
      </div>
    </div>
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
                r.ok === true ? "text-emerald-300/90" : r.ok === false ? "text-rose-300/85" : "text-foreground/80"
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
      <div className="relative h-9 rounded-md border border-emerald-300/25 bg-black/40 backdrop-blur-sm overflow-hidden">
        {/* tick row */}
        {ticks.map((t, i) => {
          const offset = ((t.deg - h) / (fov / 2)) * 50 + 50;
          if (offset < -2 || offset > 102) return null;
          return (
            <div key={i} style={{ left: `${offset}%` }} className="absolute top-0 -translate-x-1/2">
              <div className={`mx-auto w-px ${t.major ? "h-3 bg-emerald-300/80" : "h-1.5 bg-emerald-300/35"}`} />
              {t.label && (
                <div className="mt-0.5 text-[9px] font-mono text-emerald-300/90 text-center -translate-x-1/2 absolute left-1/2 top-3 whitespace-nowrap">
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
              className="absolute bottom-0.5 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.9)]" />
          );
        })}
        {/* center heading marker */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 h-full w-px bg-emerald-300" />
        <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[4px] border-l-transparent border-r-transparent border-t-emerald-300" />
      </div>
      <div className="mt-1 text-center text-[10px] font-mono text-emerald-300/90 tracking-[0.2em]">
        {heading != null ? `${heading.toFixed(0).padStart(3, "0")}°` : "--- °"}
      </div>
    </div>
  );
}

function MiniMap({ heading, contacts }: {
  heading: number | null;
  contacts: Array<{ id: string; displayName: string; bearing?: number | null; bearingConfidence: number; rssi?: number }>;
}) {
  const size = 96; // px
  const r = size / 2;
  // Convert RSSI to radial distance (closer = stronger). RSSI typ -30..-95
  const rssiToRadius = (rssi?: number) => {
    if (rssi == null) return r * 0.85;
    const t = Math.min(1, Math.max(0, (Math.abs(rssi) - 30) / 65));
    return 8 + t * (r - 12);
  };
  return (
    <div className="absolute bottom-2 left-2 pointer-events-none select-none">
      <div className="relative rounded-full border border-emerald-300/30 bg-black/55 backdrop-blur-sm"
        style={{ width: size, height: size }}>
        {/* rings */}
        <div className="absolute inset-2 rounded-full border border-emerald-300/15" />
        <div className="absolute inset-5 rounded-full border border-emerald-300/10" />
        {/* crosshair */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-emerald-300/20" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-emerald-300/20" />
        {/* sweep gradient (FOV cone) rotated to heading */}
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="absolute left-1/2 top-1/2 w-full h-full -translate-x-1/2 -translate-y-1/2"
            style={{
              transform: `translate(-50%,-50%) rotate(${heading ?? 0}deg)`,
              background:
                "conic-gradient(from -30deg, rgba(110,231,183,0.28) 0deg, rgba(110,231,183,0.05) 60deg, transparent 60deg 360deg)",
            }} />
        </div>
        {/* contacts */}
        {contacts.map((c) => {
          if (c.bearing == null) return null;
          const rel = (((c.bearing - (heading ?? 0)) % 360) + 360) % 360;
          const rad = (rel - 90) * (Math.PI / 180); // 0° = north → up
          const dist = rssiToRadius((c as any).rssi);
          const x = r + Math.cos(rad) * dist;
          const y = r + Math.sin(rad) * dist;
          return (
            <div key={c.id} style={{ left: x, top: y }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_6px_rgba(252,211,77,0.9)]" />
          );
        })}
        {/* operator pip */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.9)]" />
        {/* N label */}
        <div className="absolute left-1/2 top-1 -translate-x-1/2 text-[8px] font-mono text-emerald-300/80">N</div>
      </div>
      <div className="mt-1 text-center text-[8px] font-mono text-emerald-300/70 tracking-[0.18em]">
        {contacts.length} CONTACT{contacts.length === 1 ? "" : "S"}
      </div>
    </div>
  );
}

export default ZaxinView;

