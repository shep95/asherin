import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, FileText, Loader2, MapPin, Network, Power, RefreshCw, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { type LeakScoreBreakdown, bandColor } from "@/lib/aureonShield/leakScore";
import { listFixes, clearFixes, haversineKm, type GeoFix } from "@/lib/aureonShield/locationHistory";

// ────────────────────────────────────────────────────────────────────────────
// Multi-hop relay chain
//
// Real CORS proxies, chained sequentially. The target URL is wrapped in proxy
// 1, whose result is then wrapped by proxy 2, etc. Each hop adds a real
// network egress point between the user and the destination.

const HOPS: { id: string; label: string; build: (inner: string) => string }[] = [
  { id: "allorigins", label: "AllOrigins (DE)",  build: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
  { id: "corsproxy",  label: "corsproxy.io (US)", build: (u) => `https://corsproxy.io/?${encodeURIComponent(u)}` },
  { id: "corslol",    label: "cors.lol (NL)",     build: (u) => `https://api.cors.lol/?url=${encodeURIComponent(u)}` },
];

function buildChain(target: string, hops: string[]): string {
  let url = target;
  for (let i = hops.length - 1; i >= 0; i--) {
    const hop = HOPS.find((h) => h.id === hops[i]);
    if (hop) url = hop.build(url);
  }
  return url;
}

// ────────────────────────────────────────────────────────────────────────────

interface RelayCanaryTabProps {
  leakScore: LeakScoreBreakdown;
  recentGeo?: { lat: number; lon: number; acc: number; ts: number } | null;
}

export const RelayCanaryTab = ({ leakScore, recentGeo }: RelayCanaryTabProps) => {
  // === Multi-hop ===
  const [target, setTarget] = useState("https://check.torproject.org");
  const [selected, setSelected] = useState<string[]>(["allorigins", "corsproxy"]);
  const [chainOut, setChainOut] = useState<{ url: string; status: number; bytes: number; ms: number } | null>(null);
  const [chainBusy, setChainBusy] = useState(false);

  const toggleHop = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const runChain = useCallback(async () => {
    let t = target.trim();
    if (!t) return;
    if (!/^https?:\/\//i.test(t)) t = "https://" + t;
    if (selected.length === 0) { toast.error("Select at least one hop"); return; }
    setChainBusy(true);
    const chained = buildChain(t, selected);
    const t0 = performance.now();
    try {
      const r = await fetch(chained, { redirect: "follow" });
      const buf = await r.arrayBuffer();
      setChainOut({ url: chained, status: r.status, bytes: buf.byteLength, ms: Math.round(performance.now() - t0) });
      toast.success(`Chain returned ${r.status} · ${buf.byteLength} B in ${Math.round(performance.now() - t0)}ms`);
    } catch (e: any) {
      toast.error(`Chain failed: ${e.message}`);
      setChainOut(null);
    } finally {
      setChainBusy(false);
    }
  }, [target, selected]);

  // === Kill Switch (Service Worker) ===
  const [swReady, setSwReady] = useState(false);
  const [armed, setArmed] = useState(false);
  const [allowlistText, setAllowlistText] = useState("aureonai.app, ipapi.co, 1.1.1.1, api.pwnedpasswords.com");
  const swRef = useRef<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/aureon-killswitch-sw.js", { scope: "/" })
      .then(async (reg) => {
        await navigator.serviceWorker.ready;
        swRef.current = reg.active || reg.waiting || reg.installing || null;
        setSwReady(true);
        // Query state
        navigator.serviceWorker.controller?.postMessage({ type: "STATUS" });
      })
      .catch((e) => console.warn("[Aureon] SW register failed", e));

    const onMsg = (ev: MessageEvent) => {
      const d = ev.data || {};
      if (d.type === "ARMED") { setArmed(true); toast.success("Kill switch armed — non-allowlisted requests will be blocked"); }
      else if (d.type === "DISARMED") { setArmed(false); toast.info("Kill switch disarmed"); }
      else if (d.type === "STATUS") { setArmed(!!d.armed); }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  const armKillSwitch = useCallback(() => {
    const list = allowlistText.split(",").map((s) => s.trim()).filter(Boolean);
    navigator.serviceWorker.controller?.postMessage({ type: "ARM", allowlist: list });
  }, [allowlistText]);

  const disarm = useCallback(() => {
    navigator.serviceWorker.controller?.postMessage({ type: "DISARM" });
  }, []);

  // === Location history (IndexedDB) ===
  const [history, setHistory] = useState<GeoFix[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const reloadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try { setHistory(await listFixes(200)); }
    catch (e: any) { toast.error(`History read failed: ${e.message}`); }
    finally { setLoadingHistory(false); }
  }, []);

  useEffect(() => { reloadHistory(); }, [reloadHistory, recentGeo?.ts]);

  const jumps = useMemo(() => {
    if (history.length < 2) return [];
    const out: { from: GeoFix; to: GeoFix; km: number; minutes: number; speedKmh: number }[] = [];
    for (let i = 0; i < history.length - 1; i++) {
      const to = history[i], from = history[i + 1];
      const km = haversineKm(from, to);
      const minutes = (to.ts - from.ts) / 60000;
      const speed = minutes > 0 ? (km / (minutes / 60)) : 0;
      if (speed > 200 || km > 50) out.push({ from, to, km, minutes, speedKmh: speed });
    }
    return out;
  }, [history]);

  const wipeHistory = useCallback(async () => {
    await clearFixes();
    setHistory([]);
    toast.success("Location history wiped");
  }, []);

  // === Warrant canary ===
  const [canary, setCanary] = useState<any>(null);
  const [canaryBusy, setCanaryBusy] = useState(false);
  const [canaryError, setCanaryError] = useState<string | null>(null);

  const fetchCanary = useCallback(async () => {
    setCanaryBusy(true); setCanaryError(null);
    try {
      const r = await fetch("/aureon-canary.json", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      setCanary(j);
    } catch (e: any) {
      setCanaryError(e.message);
      setCanary(null);
    } finally { setCanaryBusy(false); }
  }, []);

  useEffect(() => { fetchCanary(); }, [fetchCanary]);

  const canaryAge = canary?.issued_at ? Math.round((Date.now() - new Date(canary.issued_at).getTime()) / 86400000) : null;
  const canaryStale = canary?.valid_through ? Date.now() > new Date(canary.valid_through).getTime() : false;

  return (
    <div className="space-y-4">
      {/* === Leak Score === */}
      <div className="rounded-2xl border border-border/30 bg-card/40 p-5 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-foreground/70" />
            <h3 className="text-sm font-light tracking-wide">Geo-Drift Leak Score</h3>
          </div>
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Exposure</div>
            <div className={`text-2xl font-extralight ${bandColor(leakScore.band)}`}>
              {leakScore.score}<span className="text-sm text-muted-foreground">/100</span>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          {leakScore.signals.map((s) => (
            <div key={s.label} className="flex items-center justify-between rounded-lg border border-border/20 bg-background/40 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                {s.tripped
                  ? <AlertTriangle className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                  : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                <div className="min-w-0">
                  <p className="text-[12px] font-light text-foreground truncate">{s.label}</p>
                  <p className="text-[10px] font-extralight text-muted-foreground truncate">{s.detail}</p>
                </div>
              </div>
              <span className="text-[9px] font-mono text-muted-foreground shrink-0">+{s.weight}</span>
            </div>
          ))}
        </div>
      </div>

      {/* === Multi-hop relay chaining === */}
      <div className="rounded-2xl border border-border/30 bg-card/40 p-5 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-foreground/70" />
            <h3 className="text-sm font-light tracking-wide">Multi-Hop Relay Chain</h3>
          </div>
          <Badge variant="outline" className="border-border/40 bg-card/40 font-light text-[10px]">{selected.length} hops</Badge>
        </div>
        <p className="mb-3 text-[11px] font-extralight text-muted-foreground">
          Wraps each request through {selected.length} sequential proxies on three jurisdictions before hitting the destination — each hop sees only the previous hop, never your real IP and the final URL together.
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {HOPS.map((h, i) => (
            <button
              key={h.id}
              onClick={() => toggleHop(h.id)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-light transition-all ${
                selected.includes(h.id)
                  ? "border-accent/50 bg-accent/15 text-accent"
                  : "border-border/30 bg-background/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="text-[9px] font-mono opacity-70">H{i + 1}</span>
              {h.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="https://check.torproject.org"
            className="bg-background/40 border-border/40 font-mono text-[12px]"
          />
          <Button onClick={runChain} disabled={chainBusy} className="bg-foreground/90 text-background hover:bg-foreground">
            {chainBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Run Chain
          </Button>
        </div>
        {chainOut && (
          <div className="mt-3 rounded-xl border border-border/30 bg-background/40 p-3 text-[11px] font-light">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className={chainOut.status >= 200 && chainOut.status < 400 ? "text-emerald-400" : "text-red-400"}>{chainOut.status}</span>
            </div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Bytes</span><span>{chainOut.bytes}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Latency</span><span>{chainOut.ms}ms</span></div>
            <div className="mt-2 break-all text-[10px] font-mono text-muted-foreground/70">{chainOut.url}</div>
          </div>
        )}
      </div>

      {/* === Kill Switch === */}
      <div className="rounded-2xl border border-border/30 bg-card/40 p-5 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Power className={`h-4 w-4 ${armed ? "text-red-400" : "text-foreground/70"}`} />
            <h3 className="text-sm font-light tracking-wide">Kill Switch · Service Worker</h3>
          </div>
          <Switch checked={armed} onCheckedChange={(v) => (v ? armKillSwitch() : disarm())} disabled={!swReady} />
        </div>
        <p className="mb-3 text-[11px] font-extralight text-muted-foreground">
          Installs a Service Worker that intercepts every request from this origin. When armed, any request whose host is not on the allowlist is blocked at the browser layer — even if your VPN drops, nothing leaks.
        </p>
        <div className="space-y-2">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Allowlist (comma-separated hosts)</div>
          <Input
            value={allowlistText}
            onChange={(e) => setAllowlistText(e.target.value)}
            disabled={armed}
            className="bg-background/40 border-border/40 font-mono text-[11px]"
          />
          <div className="flex items-center justify-between text-[11px] font-light">
            <span className="text-muted-foreground">Worker</span>
            <span className={swReady ? "text-emerald-400" : "text-muted-foreground"}>{swReady ? "Active" : "Registering…"}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-light">
            <span className="text-muted-foreground">State</span>
            <span className={armed ? "text-red-400" : "text-emerald-400"}>{armed ? "ARMED · blocking" : "Disarmed · pass-through"}</span>
          </div>
        </div>
      </div>

      {/* === Location history === */}
      <div className="rounded-2xl border border-border/30 bg-card/40 p-5 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-foreground/70" />
            <h3 className="text-sm font-light tracking-wide">Location History · IndexedDB</h3>
            <Badge variant="outline" className="border-border/40 bg-card/40 font-light text-[10px]">{history.length} fixes</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={reloadHistory} disabled={loadingHistory} className="border-border/40 bg-card/40 hover:bg-card/70 h-7 px-2">
              {loadingHistory ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
            <Button variant="outline" size="sm" onClick={wipeHistory} className="border-red-400/30 bg-red-400/5 text-red-300 hover:bg-red-400/10 h-7 px-2">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <p className="mb-3 text-[11px] font-extralight text-muted-foreground">
          Every precise GPS fix from the Location tab is stored locally in your browser's IndexedDB — never transmitted. Impossible jumps (faster than 200 km/h or further than 50 km between consecutive fixes) are flagged as forensic anomalies.
        </p>
        {jumps.length > 0 && (
          <div className="mb-3 rounded-xl border border-orange-400/30 bg-orange-400/5 p-3">
            <div className="mb-1.5 flex items-center gap-2 text-[11px] font-light text-orange-300">
              <AlertTriangle className="h-3.5 w-3.5" />
              {jumps.length} impossible jump{jumps.length === 1 ? "" : "s"} detected
            </div>
            <div className="space-y-1">
              {jumps.slice(0, 5).map((j, i) => (
                <div key={i} className="text-[10px] font-mono text-muted-foreground">
                  {Math.round(j.km)} km in {j.minutes.toFixed(1)} min · {Math.round(j.speedKmh)} km/h
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="max-h-64 overflow-y-auto rounded-xl border border-border/20 bg-background/30">
          {history.length === 0 ? (
            <div className="p-4 text-center text-[11px] font-extralight text-muted-foreground">
              No fixes yet — capture a precise position from the Location tab to start the timeline.
            </div>
          ) : (
            <table className="w-full text-[11px] font-light">
              <thead className="sticky top-0 bg-card/80 backdrop-blur">
                <tr className="text-left text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Lat / Lon</th>
                  <th className="px-3 py-2">±m</th>
                  <th className="px-3 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {history.map((f) => (
                  <tr key={f.ts} className="border-t border-border/15">
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">{new Date(f.ts).toLocaleString()}</td>
                    <td className="px-3 py-1.5 font-mono">{f.lat.toFixed(4)}, {f.lon.toFixed(4)}</td>
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">{Math.round(f.acc)}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{f.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* === Warrant Canary === */}
      <div className="rounded-2xl border border-border/30 bg-card/40 p-5 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-foreground/70" />
            <h3 className="text-sm font-light tracking-wide">Warrant Canary</h3>
            {canary && !canaryStale && <Badge variant="outline" className="border-emerald-400/40 bg-emerald-400/5 text-emerald-300 font-light text-[10px]">Alive · {canaryAge}d old</Badge>}
            {canaryStale && <Badge variant="outline" className="border-red-400/40 bg-red-400/5 text-red-300 font-light text-[10px]">STALE — assume compromise</Badge>}
          </div>
          <Button variant="outline" size="sm" onClick={fetchCanary} disabled={canaryBusy} className="border-border/40 bg-card/40 hover:bg-card/70 h-7 px-2">
            {canaryBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          </Button>
        </div>
        {canaryError && <p className="text-[11px] text-red-400">Fetch failed: {canaryError}</p>}
        {canary && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3 text-[11px] font-light">
              <div className="rounded-lg border border-border/20 bg-background/40 p-2">
                <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">Issued</div>
                <div className="font-mono">{new Date(canary.issued_at).toLocaleDateString()}</div>
              </div>
              <div className="rounded-lg border border-border/20 bg-background/40 p-2">
                <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">Valid through</div>
                <div className="font-mono">{new Date(canary.valid_through).toLocaleDateString()}</div>
              </div>
              <div className="rounded-lg border border-border/20 bg-background/40 p-2">
                <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground">Signed by</div>
                <div className="font-mono truncate">{canary.signed_by}</div>
              </div>
            </div>
            <ol className="space-y-1.5">
              {(canary.statements || []).map((s: string, i: number) => (
                <li key={i} className="flex gap-2 rounded-lg border border-border/15 bg-background/30 p-2 text-[11px] font-extralight leading-relaxed text-foreground/90">
                  <ShieldCheck className="h-3.5 w-3.5 mt-0.5 text-emerald-400/80 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ol>
            <p className="text-[10px] font-extralight text-muted-foreground/70">
              Live anchors (BTC tip, NYT front page) prove the canary cannot be pre-signed. If this file disappears or stops being refreshed within 30 days of <span className="font-mono">{new Date(canary.valid_through).toLocaleDateString()}</span>, treat the platform as compromised.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RelayCanaryTab;
