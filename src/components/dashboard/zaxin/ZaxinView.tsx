// Zaxin — five-brain BLE tactical scanner UI.
// Theory by Asher · #houseofasher. Built browser-native (Web Bluetooth + DeviceOrientation).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bluetooth, Radar, ShieldAlert, Network, Sparkles, AlertTriangle, Eye,
  Smartphone, Play, Square, Trash2, RefreshCw, Star, Compass, Camera, Download, Upload,
  Activity, Radio, ChevronRight, Cpu, MapPin,
} from "lucide-react";
import { TacticalEngine, SCENARIOS } from "./core/tactical";
import { startScan, pickOne, detectScanMode, listPaired, type RawAdvert, type ScanMode } from "./core/scanner";
import { HopBrain } from "./core/hop";
import { startHeadingStream, startCamera, stopCamera, bearingDelta } from "./core/posesense";
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

  // initial paired load
  useEffect(() => {
    listPaired().then((rows) => rows.forEach((r) => engine.ingest(r))).catch(() => {/* */});
  }, [engine]);

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
  const [heading, setHeading] = useState<number | null>(null);
  const [arOn, setArOn] = useState(false);
  const [arErr, setArErr] = useState<string | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const poseHandleRef = useRef<{ stop: () => void } | null>(null);

  const startAr = useCallback(async () => {
    setArErr(null);
    try {
      if (!videoRef.current) throw new Error("Camera surface not ready.");
      const stream = await startCamera(videoRef.current);
      camStreamRef.current = stream;
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
    }
  }, [engine]);

  const stopAr = useCallback(() => {
    poseHandleRef.current?.stop(); poseHandleRef.current = null;
    stopCamera(camStreamRef.current); camStreamRef.current = null;
    engine.setPose(false, null);
    setArOn(false);
  }, [engine]);

  useEffect(() => () => { poseHandleRef.current?.stop(); stopCamera(camStreamRef.current); }, []);

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
          />
        )}
        {tab === "tactical" && (
          <TacticalTab snap={snap} engine={engine} />
        )}
        {tab === "ar" && (
          <ArTab
            videoRef={videoRef} arOn={arOn} arErr={arErr} heading={heading}
            contacts={locals}
            onStart={startAr} onStop={stopAr}
          />
        )}
        {tab === "hops" && (
          <HopsTab snap={snap} hop={hop} />
        )}
        {tab === "guide" && <GuideTab mode={mode} />}
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
            Continuous sweep needs Chrome on Android with <code>chrome://flags#enable-experimental-web-platform-features</code>.
            Without it you can add contacts one at a time via the picker.
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
            <ActionButton onClick={props.onPick} icon={Bluetooth}>Pick Device</ActionButton>
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
  arOn: boolean; arErr: string | null; heading: number | null;
  contacts: Contact[];
  onStart: () => void; onStop: () => void;
}) {
  const hasBearings = props.contacts.filter((c) => c.bearing != null);
  const FOV = 60; // degrees of horizontal field of view we render

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Panel icon={Camera} title="AR Bluetooth Vision" subtitle="Walk a few steps with the camera up — bearings refine as RSSI gradient + heading samples fuse.">
        {props.arErr && <Note tone="error" icon={AlertTriangle}>{props.arErr}</Note>}
        <div className="flex flex-wrap gap-2 mt-3">
          {!props.arOn
            ? <ActionButton icon={Play} onClick={props.onStart}>Start AR</ActionButton>
            : <ActionButton icon={Square} tone="danger" onClick={props.onStop}>Stop AR</ActionButton>}
          <div className="ml-auto flex items-center gap-2 text-[9px] tracking-[0.18em] uppercase text-muted-foreground/50">
            <Compass className="h-3 w-3" /> {props.heading != null ? `${props.heading.toFixed(0)}°` : "no heading"}
          </div>
        </div>
      </Panel>

      <div className="relative rounded-2xl overflow-hidden border border-border/[0.1] bg-black aspect-[3/4] sm:aspect-video">
        <video
          ref={props.videoRef}
          playsInline muted autoPlay
          className="absolute inset-0 w-full h-full object-cover opacity-90"
        />
        {/* HUD grid */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-y-0 left-1/2 w-px bg-emerald-300/30" />
          <div className="absolute inset-x-0 top-1/2 h-px bg-emerald-300/20" />
          <div className="absolute top-2 left-2 text-[9px] tracking-[0.18em] uppercase text-emerald-300/70 font-mono">
            ZAXIN · POSE-SENSE
          </div>
          {props.arOn && props.heading != null && (
            <div className="absolute top-2 right-2 text-[9px] tracking-[0.18em] uppercase text-emerald-300/70 font-mono">
              HDG {props.heading.toFixed(0)}°
            </div>
          )}
        </div>

        {/* Bearing markers */}
        {props.arOn && props.heading != null && hasBearings.map((c) => {
          const delta = bearingDelta(c.bearing!, props.heading!);
          if (Math.abs(delta) > FOV / 2) return null;
          const xPct = 50 + (delta / (FOV / 2)) * 50;
          const opacity = 0.4 + c.bearingConfidence * 0.6;
          return (
            <div
              key={c.id}
              style={{ left: `${xPct}%`, opacity }}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            >
              <div className="w-10 h-10 rounded-full border-2 border-emerald-300/80 animate-pulse" />
              <div className="mt-1 text-[9px] font-mono tracking-[0.1em] text-emerald-300/90 bg-black/50 px-1.5 py-0.5 rounded">
                {c.displayName}
              </div>
              <div className="text-[8px] font-mono text-emerald-300/60">
                {c.distanceLabel} · conf {(c.bearingConfidence * 100).toFixed(0)}%
              </div>
            </div>
          );
        })}

        {!props.arOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
            <Camera className="h-6 w-6 text-foreground/30" />
            <div className="mt-2 text-[10px] tracking-[0.18em] uppercase text-foreground/50">Camera idle</div>
            <p className="mt-2 max-w-sm text-[10px] text-muted-foreground/55 font-light leading-relaxed">
              Tap <b>Start AR</b>, grant camera + motion permissions, then walk a few steps with a live sweep running.
              Markers appear once the RSSI gradient picks a direction.
            </p>
          </div>
        )}
      </div>

      <div className="text-[9px] tracking-[0.18em] uppercase text-muted-foreground/40 text-center">
        Bearings are estimates from RSSI gradient — Zaxin does not see through walls.
      </div>
    </div>
  );
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

/* ============================ GUIDE ============================ */

function GuideTab({ mode }: { mode: ScanMode }) {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <Panel icon={Sparkles} title="Field Guide" subtitle="What Zaxin sees, and how to read it.">
        <ol className="mt-4 space-y-3 text-[11px] leading-relaxed text-foreground/75 font-light">
          <Step n={1} title="Five brains, one mission">
            <b>Scanner</b> listens. <b>Naming</b> turns radios into names. <b>Intel</b> pulls GATT data on demand.
            <b> Tactical</b> tracks behaviour and alerts. <b>Hop Mesh</b> stitches in peer scanners.
          </Step>
          <Step n={2} title="Current scan mode">
            {mode === "continuous"
              ? "Continuous sweep is available — your browser supports requestLEScan."
              : mode === "picker"
                ? "Picker mode only. Each tap on Pick Device adds one contact."
                : "No Web Bluetooth in this browser."}
          </Step>
          <Step n={3} title="Reading proximity">
            Green = arm's reach (immediate). Sky = same room (near). Amber = edge of range (far).
            Distances are RSSI estimates with txPower −59 dBm and path-loss exponent 2.0.
          </Step>
          <Step n={4} title="Behaviour states">
            <b>Active</b> = seen this sweep. <b>Lost</b> = no advert past the scenario window.
            <b> Resurrected</b> = lost then returned. <b>Clone-suspect</b> = a second id wearing the same name.
          </Step>
          <Step n={5} title="AR Vision">
            Open the AR tab, grant camera and motion permission, then walk. Each step feeds an RSSI gradient
            into the heading samples. After a few seconds the bearing for each contact stabilises and a marker
            anchors in the camera view at that compass bearing.
          </Step>
          <Step n={6} title="Hop mesh, honestly">
            We use BroadcastChannel for same-origin tabs — no fake peer-to-peer. To bring in a phone in another room,
            export a snapshot, send it over your usual channel, paste it on the receiving node.
          </Step>
        </ol>
        <div className="mt-5 pt-4 border-t border-border/[0.06] text-[9px] tracking-[0.18em] uppercase text-muted-foreground/40">
          Theory by Asher · #houseofasher
        </div>
      </Panel>
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

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="shrink-0 w-6 h-6 rounded-md border border-border/[0.1] bg-foreground/[0.03] flex items-center justify-center text-[10px] font-mono text-muted-foreground/60">{n}</span>
      <div>
        <div className="text-[11px] tracking-[0.1em] uppercase text-foreground/85">{title}</div>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/70 font-light">{children}</p>
      </div>
    </li>
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

export default ZaxinView;
