import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bluetooth, Radar, Radio, ShieldAlert, Network, Cpu, BookOpen, Plug,
  Activity, MapPin, Trash2, Play, Square, AlertTriangle, Sparkles,
  Smartphone, ChevronRight, Eye, RefreshCw, Search,
} from "lucide-react";
import {
  ZaxinBridge,
  startWebBleScan,
  pickWebBleDevice,
  webBleSupported,
  webBleScanSupported,
  type ScanSnapshot,
  type WebBleDevice,
  type ScannedDevice,
  type ScenarioId,
} from "./bluetoothClient";
import {
  ALL_THEORIES,
  CATEGORY_COUNTS,
  TOTAL_THEORIES,
  searchTheories,
  type Category,
  type TheoryRecord,
} from "./upstream/theories";


type Tab = "live" | "bridge" | "tactical" | "theories" | "guide";

const TABS: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "live",     label: "Live Scan",    icon: Radar },
  { id: "bridge",   label: "Local Bridge", icon: Plug },
  { id: "tactical", label: "Tactical",     icon: ShieldAlert },
  { id: "theories", label: "Theories",     icon: BookOpen },
  { id: "guide",    label: "Field Guide",  icon: Sparkles },
];

const SCENARIOS: Array<{ id: ScenarioId; label: string; blurb: string }> = [
  { id: "standard",       label: "Standard",       blurb: "Continuous sweep, balanced GATT pulls." },
  { id: "perimeter",      label: "Perimeter",      blurb: "Watch range edges. Alerts on new arrivals." },
  { id: "asset_recovery", label: "Asset Recovery", blurb: "Aggressive triangulation on watchlist." },
  { id: "silent_observe", label: "Silent Observe", blurb: "Passive only. No GATT connect. No trace." },
  { id: "deep_pull",      label: "Deep Pull",      blurb: "Exhaustive GATT enumeration per device." },
];

const CATEGORY_LABELS: Record<Category | "all", string> = {
  all: "All",
  tactical: "Tactical",
  passive: "Passive",
  gatt: "GATT",
  security: "Security",
  architecture: "Architecture",
  "screen-relay": "Screen Relay",
  "wifi-pose": "WiFi Pose",
};


const TIER_COLOR: Record<string, string> = {
  friendly: "text-emerald-300/80 border-emerald-300/20",
  known:    "text-sky-300/80 border-sky-300/20",
  unknown:  "text-foreground/60 border-border/30",
  priority: "text-amber-300/80 border-amber-300/30",
  breach:   "text-rose-300/90 border-rose-300/30",
};

function ZoneDot({ zone }: { zone: string }) {
  const cls =
    zone === "immediate" ? "bg-emerald-400/80" :
    zone === "near"      ? "bg-sky-400/70" :
    zone === "far"       ? "bg-amber-400/60" :
                           "bg-foreground/30";
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${cls}`} />;
}

const ZaxinView = () => {
  const [tab, setTab] = useState<Tab>("live");

  /* ---------------- LIVE (Web Bluetooth) ---------------- */
  const [webDevices, setWebDevices] = useState<Record<string, WebBleDevice>>({});
  const [webScanning, setWebScanning] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);
  const scanHandleRef = useRef<{ stop: () => void } | null>(null);
  const supported = webBleSupported();
  const liveScanSupported = webBleScanSupported();

  const startLive = useCallback(async () => {
    setWebError(null);
    try {
      if (liveScanSupported) {
        const h = await startWebBleScan((d) => {
          setWebDevices((m) => ({ ...m, [d.id]: d }));
        });
        scanHandleRef.current = h;
        setWebScanning(true);
      } else {
        // Fallback: one-shot picker
        const d = await pickWebBleDevice();
        setWebDevices((m) => ({ ...m, [d.id]: d }));
      }
    } catch (e) {
      setWebError(e instanceof Error ? e.message : String(e));
    }
  }, [liveScanSupported]);

  const stopLive = useCallback(() => {
    scanHandleRef.current?.stop();
    scanHandleRef.current = null;
    setWebScanning(false);
  }, []);

  useEffect(() => () => scanHandleRef.current?.stop(), []);

  /* ---------------- BRIDGE (Python server) ---------------- */
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:8765");
  const [snap, setSnap] = useState<ScanSnapshot | null>(null);
  const [bridgeErr, setBridgeErr] = useState<string | null>(null);
  const [bridgeOn, setBridgeOn] = useState(false);
  const bridge = useMemo(() => new ZaxinBridge(baseUrl), [baseUrl]);
  const pollRef = useRef<number | null>(null);

  const poll = useCallback(async () => {
    try { setSnap(await bridge.devices()); setBridgeErr(null); }
    catch (e) { setBridgeErr(e instanceof Error ? e.message : String(e)); }
  }, [bridge]);

  const connectBridge = useCallback(async () => {
    setBridgeErr(null);
    try {
      const h = await bridge.health();
      if (!h.ready) throw new Error(h.message);
      await bridge.start();
      setBridgeOn(true);
      await poll();
      pollRef.current = window.setInterval(poll, 1500);
    } catch (e) {
      setBridgeErr(e instanceof Error ? e.message : String(e));
    }
  }, [bridge, poll]);

  const disconnectBridge = useCallback(async () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    try { await bridge.stop(); } catch {/* */}
    setBridgeOn(false);
  }, [bridge]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const setScenario = async (id: ScenarioId) => {
    try { await bridge.setScenario(id); } catch (e) {
      setBridgeErr(e instanceof Error ? e.message : String(e));
    }
  };

  /* ---------------- DERIVED ---------------- */
  const liveList = useMemo(
    () => Object.values(webDevices).sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999)),
    [webDevices],
  );
  const bridgeDevices: ScannedDevice[] = snap?.devices ?? [];
  const tactical = snap?.tactical;

  /* ---------------- UI ---------------- */
  return (
    <div className="h-full flex flex-col bg-background">
      {/* Top bar */}
      <div className="shrink-0 border-b border-border/[0.06] px-4 sm:px-5 py-2.5 flex items-center justify-between backdrop-blur-md bg-background/40">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-foreground/[0.04] border border-border/[0.08] flex items-center justify-center shrink-0">
            <Bluetooth className="h-3.5 w-3.5 text-foreground/60" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[11px] font-light tracking-[0.16em] text-foreground/90 uppercase truncate">Zaxin</h1>
            <p className="text-[8px] text-muted-foreground/40 tracking-[0.18em] uppercase truncate">
              Tactical BLE Discovery · #houseofasher
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[9px] tracking-[0.18em] uppercase px-2 py-1 rounded-md border ${
            webScanning || bridgeOn
              ? "text-emerald-300/80 border-emerald-300/20 bg-emerald-300/[0.04]"
              : "text-foreground/40 border-border/20"
          }`}>
            {webScanning ? "Live" : bridgeOn ? "Bridge" : "Idle"}
          </span>
        </div>
      </div>

      {/* Tabs */}
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

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 sm:py-7">
        {tab === "live" && (
          <div className="max-w-4xl mx-auto space-y-5">
            <Panel
              icon={Radar}
              title="Live BLE Scan"
              subtitle="Browser-native scan via Web Bluetooth. Works on Android Chrome and most desktops."
            >
              {!supported && (
                <Note tone="warn" icon={Smartphone}>
                  This browser doesn't expose Web Bluetooth. On iOS use the Bluefy browser, or switch to
                  the <button onClick={() => setTab("bridge")} className="underline">Local Bridge</button> tab.
                </Note>
              )}
              {supported && !liveScanSupported && (
                <Note tone="info" icon={Eye}>
                  Continuous scan needs Chrome on Android with <code className="text-foreground/80">chrome://flags → Experimental Web Platform features</code> enabled.
                  Without it you can still pick a single device.
                </Note>
              )}
              {webError && <Note tone="error" icon={AlertTriangle}>{webError}</Note>}

              <div className="flex flex-wrap gap-2 mt-3">
                {!webScanning ? (
                  <button
                    onClick={startLive}
                    disabled={!supported}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] text-[10px] tracking-[0.16em] uppercase text-foreground/80 disabled:opacity-40 disabled:cursor-not-allowed border border-border/[0.08]"
                  >
                    <Play className="h-3 w-3" /> {liveScanSupported ? "Start Sweep" : "Pick Device"}
                  </button>
                ) : (
                  <button
                    onClick={stopLive}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-400/[0.08] hover:bg-rose-400/[0.14] text-[10px] tracking-[0.16em] uppercase text-rose-300/90 border border-rose-300/20"
                  >
                    <Square className="h-3 w-3" /> Stop
                  </button>
                )}
                <button
                  onClick={() => setWebDevices({})}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-foreground/[0.04] text-[10px] tracking-[0.16em] uppercase text-muted-foreground/60 border border-border/[0.06]"
                >
                  <Trash2 className="h-3 w-3" /> Clear
                </button>
                <div className="ml-auto flex items-center gap-2 text-[9px] tracking-[0.18em] uppercase text-muted-foreground/50">
                  <Activity className={`h-3 w-3 ${webScanning ? "text-emerald-300/80 animate-pulse" : ""}`} />
                  {liveList.length} devices
                </div>
              </div>
            </Panel>

            <DeviceTable rows={liveList.map((d) => ({
              id: d.id, name: d.name, rssi: d.rssi, zone: d.proximityZone,
              distance: d.distanceLabel, tier: "unknown", detail: d.manufacturer ?? "",
            }))} />
          </div>
        )}

        {tab === "bridge" && (
          <div className="max-w-4xl mx-auto space-y-5">
            <Panel
              icon={Plug}
              title="Local Bridge"
              subtitle="Connect to the houseofasher bluetooth_software Python server (full hop graph, GATT pull, mission HUD)."
            >
              <div className="grid sm:grid-cols-[1fr_auto] gap-2 mt-3">
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  spellCheck={false}
                  className="bg-background/60 border border-border/[0.1] rounded-lg px-3 py-2 text-[11px] font-mono text-foreground/80 outline-none focus:border-border/30"
                  placeholder="http://127.0.0.1:8765"
                />
                {!bridgeOn ? (
                  <button
                    onClick={connectBridge}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-foreground/[0.06] hover:bg-foreground/[0.1] text-[10px] tracking-[0.16em] uppercase text-foreground/80 border border-border/[0.08]"
                  >
                    <Play className="h-3 w-3" /> Connect
                  </button>
                ) : (
                  <button
                    onClick={disconnectBridge}
                    className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-rose-400/[0.08] hover:bg-rose-400/[0.14] text-[10px] tracking-[0.16em] uppercase text-rose-300/90 border border-rose-300/20"
                  >
                    <Square className="h-3 w-3" /> Disconnect
                  </button>
                )}
              </div>
              {bridgeErr && <Note tone="error" icon={AlertTriangle}>{bridgeErr}</Note>}
              {!bridgeOn && (
                <Note tone="info" icon={ChevronRight}>
                  Run the bridge locally: <code className="text-foreground/80">git clone https://github.com/houseofasher/bluetooth_software &amp;&amp; pip install -r requirements.txt &amp;&amp; python ble-scan-server.py</code>
                </Note>
              )}

              {bridgeOn && (
                <>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {SCENARIOS.map((s) => (
                      <button
                        key={s.id}
                        title={s.blurb}
                        onClick={() => setScenario(s.id)}
                        className={`px-2.5 py-1 rounded-md text-[9px] tracking-[0.14em] uppercase border transition-all ${
                          tactical?.scenario.id === s.id
                            ? "bg-foreground/[0.08] border-border/30 text-foreground/90"
                            : "border-border/[0.08] text-muted-foreground/60 hover:text-foreground/80 hover:bg-foreground/[0.03]"
                        }`}
                      >{s.label}</button>
                    ))}
                    <button
                      onClick={poll}
                      className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] tracking-[0.14em] uppercase border border-border/[0.08] text-muted-foreground/60 hover:text-foreground/80"
                    >
                      <RefreshCw className="h-2.5 w-2.5" /> Refresh
                    </button>
                  </div>

                  {snap?.scannerLocation?.addressShort && (
                    <div className="mt-3 flex items-center gap-1.5 text-[9px] tracking-[0.16em] uppercase text-muted-foreground/50">
                      <MapPin className="h-3 w-3" /> {snap.scannerLocation.addressShort}
                    </div>
                  )}
                </>
              )}
            </Panel>

            {bridgeOn && (
              <DeviceTable rows={bridgeDevices.map((d) => ({
                id: d.id, name: d.displayName || d.name, rssi: d.rssi, zone: d.proximityZone,
                distance: d.distanceLabel, tier: d.threatTier ?? "unknown",
                detail: d.manufacturer ?? d.inferredDetail ?? "",
              }))} />
            )}
          </div>
        )}

        {tab === "tactical" && (
          <div className="max-w-4xl mx-auto space-y-5">
            {!tactical ? (
              <Panel icon={ShieldAlert} title="Tactical HUD" subtitle="Connect via Local Bridge to load the mission feed.">
                <Note tone="info" icon={ChevronRight}>
                  The mission phases, chrono blackbox, watchlist, and domino breach paths are computed by the
                  Python server. Connect on the Local Bridge tab.
                </Note>
              </Panel>
            ) : (
              <>
                <Panel icon={Cpu} title={tactical.missionLabel} subtitle={`Mission ${tactical.missionId} · Phase ${tactical.missionPhase}`}>
                  <div className="grid sm:grid-cols-3 gap-2 mt-3">
                    <Stat label="Scenario" value={tactical.scenario.label} sub={tactical.scenario.description} />
                    <Stat label="Interference" value={tactical.interference.label} sub={`Score ${tactical.interference.score}`} />
                    <Stat label="Watchlist" value={String(tactical.watchlist.length)} sub="Tagged MACs" />
                  </div>
                  {tactical.ticker && (
                    <div className="mt-4 text-[10px] tracking-[0.14em] uppercase text-foreground/60 border-l-2 border-foreground/10 pl-3">
                      {tactical.ticker}
                    </div>
                  )}
                </Panel>

                {tactical.alerts.length > 0 && (
                  <Panel icon={AlertTriangle} title="Alerts">
                    <ul className="mt-3 space-y-1.5">
                      {tactical.alerts.slice(0, 12).map((a, i) => (
                        <li key={i} className="text-[10px] tracking-wide text-foreground/70 flex gap-2">
                          <span className="text-muted-foreground/40 font-mono shrink-0">
                            {new Date(a.ts * 1000).toLocaleTimeString()}
                          </span>
                          <span className="flex-1">{a.message}</span>
                          {a.mac && <span className="font-mono text-muted-foreground/40">{a.mac}</span>}
                        </li>
                      ))}
                    </ul>
                  </Panel>
                )}

                {tactical.dominoBreaches.length > 0 && (
                  <Panel icon={Network} title="Domino Breach Chains">
                    <ul className="mt-3 space-y-2">
                      {tactical.dominoBreaches.slice(0, 8).map((b, i) => (
                        <li key={i} className="border border-border/[0.06] rounded-lg p-3 bg-foreground/[0.02]">
                          <div className="flex items-center justify-between text-[10px] tracking-[0.14em] uppercase">
                            <span className="text-foreground/80">{b.target}</span>
                            <span className="text-rose-300/80">{b.breachLabel} · {b.hopDepth} hops</span>
                          </div>
                          <div className="mt-1.5 text-[9px] font-mono text-muted-foreground/50 break-all">
                            {b.path.join("  ›  ")}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Panel>
                )}
              </>
            )}
          </div>
        )}

        {tab === "theories" && (
          <div className="max-w-4xl mx-auto space-y-5">
            <Panel icon={BookOpen} title="Theory Chains" subtitle="Narrative → flaw → fix → code. Selected highlights from the 101-deep Zaxin codex.">
              <ul className="mt-4 grid sm:grid-cols-2 gap-2">
                {THEORIES.map((t) => (
                  <li key={t.n} className="border border-border/[0.06] rounded-lg p-3 bg-foreground/[0.02]">
                    <div className="flex items-center gap-2 text-[10px] tracking-[0.16em] uppercase">
                      <span className="text-muted-foreground/40 font-mono">#{String(t.n).padStart(3, "0")}</span>
                      <span className="text-foreground/85">{t.title}</span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground/70 font-light">{t.body}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        )}

        {tab === "guide" && (
          <div className="max-w-3xl mx-auto space-y-5">
            <Panel icon={Sparkles} title="Field Guide" subtitle="What Zaxin does, and how to use it from your phone.">
              <ol className="mt-4 space-y-3 text-[11px] leading-relaxed text-foreground/75 font-light">
                <Step n={1} title="Two scan modes">
                  <b className="text-foreground/90">Live Scan</b> uses your phone or laptop's own Bluetooth radio (no install, no server). <b className="text-foreground/90">Local Bridge</b> connects to the Python <code>ble-scan-server.py</code> running on your machine for the full tactical HUD, hop graph, GATT pull, and theory engine.
                </Step>
                <Step n={2} title="On Android">
                  Open Chrome → enable <code>chrome://flags#enable-experimental-web-platform-features</code>. Then tap <b className="text-foreground/90">Start Sweep</b> on Live Scan and grant Bluetooth + Location permission.
                </Step>
                <Step n={3} title="On iPhone">
                  Safari doesn't expose Web Bluetooth. Either use the free <b className="text-foreground/90">Bluefy</b> browser, or run the Local Bridge on a Mac and connect from your phone over LAN.
                </Step>
                <Step n={4} title="Reading the room">
                  Green dot = within arm's reach (immediate). Blue = same room (near). Amber = at the edge of range (far). Names follow honest sourcing: broadcast → paired → GATT → inferred → MAC.
                </Step>
                <Step n={5} title="Mission scenarios">
                  Switch scenarios on the Local Bridge tab to retune what Zaxin watches for: <b className="text-foreground/90">Silent Observe</b> never connects, <b className="text-foreground/90">Asset Recovery</b> triangulates your watchlist, <b className="text-foreground/90">Deep Pull</b> enumerates every GATT service it can reach.
                </Step>
              </ol>
              <div className="mt-5 pt-4 border-t border-border/[0.06] text-[9px] tracking-[0.18em] uppercase text-muted-foreground/40">
                Source · houseofasher/bluetooth_software · MIT
              </div>
            </Panel>
          </div>
        )}
      </div>
    </div>
  );
};

/* ---------- subcomponents ---------- */

function Panel({
  icon: Icon, title, subtitle, children,
}: { icon: React.ElementType; title: string; subtitle?: string; children: React.ReactNode }) {
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

function Note({ tone, icon: Icon, children }:
  { tone: "info" | "warn" | "error"; icon: React.ElementType; children: React.ReactNode }) {
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
      <div className="mt-1 text-sm font-light text-foreground/90">{value}</div>
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

interface Row {
  id: string; name: string; rssi: number | null; zone: string;
  distance: string; tier: string; detail: string;
}
function DeviceTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/[0.1] p-8 text-center">
        <Radio className="h-5 w-5 mx-auto text-muted-foreground/30" />
        <div className="mt-2 text-[10px] tracking-[0.18em] uppercase text-muted-foreground/40">No devices yet</div>
        <div className="mt-1 text-[10px] text-muted-foreground/35 font-light">Start a sweep to populate the grid.</div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.015] overflow-hidden">
      <div className="hidden sm:grid grid-cols-[1.4fr_0.6fr_0.6fr_0.6fr_0.8fr] gap-3 px-4 py-2 border-b border-border/[0.06] text-[9px] tracking-[0.18em] uppercase text-muted-foreground/40">
        <div>Device</div><div>RSSI</div><div>Zone</div><div>Distance</div><div>Tier</div>
      </div>
      <ul className="divide-y divide-border/[0.05]">
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-2.5 sm:grid sm:grid-cols-[1.4fr_0.6fr_0.6fr_0.6fr_0.8fr] sm:gap-3 sm:items-center">
            <div className="min-w-0">
              <div className="text-[12px] text-foreground/85 font-light truncate">{r.name}</div>
              <div className="text-[9px] font-mono text-muted-foreground/40 truncate">{r.id}{r.detail ? ` · ${r.detail}` : ""}</div>
            </div>
            <div className="text-[10px] font-mono text-foreground/70 mt-1 sm:mt-0">{r.rssi != null ? `${r.rssi} dBm` : "—"}</div>
            <div className="text-[10px] text-muted-foreground/60 mt-0.5 sm:mt-0 flex items-center gap-1.5">
              <ZoneDot zone={r.zone} /> {r.zone}
            </div>
            <div className="text-[10px] text-muted-foreground/60 mt-0.5 sm:mt-0">{r.distance}</div>
            <div className="mt-1 sm:mt-0">
              <span className={`text-[9px] tracking-[0.14em] uppercase px-1.5 py-0.5 rounded border ${TIER_COLOR[r.tier] ?? TIER_COLOR.unknown}`}>
                {r.tier}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ZaxinView;
