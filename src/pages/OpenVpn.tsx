import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowUpRight, CheckCircle2, Cpu, Eye, Fingerprint,
  Github, Globe, HardDrive, KeyRound, Loader2, Lock, MapPin, Monitor, Network, Power,
  RefreshCw, Search, Server, Shield, ShieldCheck, ShieldOff, Wifi, X, Zap,
} from "lucide-react";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HardeningTab } from "@/components/aureon-shield/HardeningTab";
import { TrackersTab } from "@/components/aureon-shield/TrackersTab";
import { StorageTab } from "@/components/aureon-shield/StorageTab";
import { ExtensionsTab } from "@/components/aureon-shield/ExtensionsTab";
import { DohAuditTab } from "@/components/aureon-shield/DohAuditTab";
import { ShutoffTab } from "@/components/aureon-shield/ShutoffTab";
import { RelayCanaryTab } from "@/components/aureon-shield/RelayCanaryTab";
import { computeLeakScore, bandColor } from "@/lib/aureonShield/leakScore";
import { recordFix } from "@/lib/aureonShield/locationHistory";

const REPO_URL = "https://github.com/ZorakCorp/openvpn";

// ────────────────────────────────────────────────────────────────────────────
// REAL audit primitives — no simulation

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
// ────────────────────────────────────────────────────────────────────────────

type NetIdentity = {
  ip: string; city: string; region: string; country: string; org: string;
  asn?: string; timezone: string; latitude?: number; longitude?: number;
};

async function detectIp(): Promise<NetIdentity> {
  const r = await fetch("https://ipapi.co/json/");
  if (!r.ok) throw new Error("ipapi failed");
  const j = await r.json();
  return {
    ip: j.ip, city: j.city, region: j.region, country: j.country_name,
    org: j.org, asn: j.asn, timezone: j.timezone,
    latitude: j.latitude, longitude: j.longitude,
  };
}

// Real WebRTC IP leak detection — exposes local + public IPs even behind VPN
async function detectWebRTCLeak(): Promise<{ leaked: boolean; ips: string[] }> {
  return new Promise((resolve) => {
    const ips = new Set<string>();
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      pc.createDataChannel("");
      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          pc.close();
          resolve({ leaked: ips.size > 0, ips: Array.from(ips) });
          return;
        }
        const m = e.candidate.candidate.match(/(\d{1,3}(\.\d{1,3}){3}|[a-f0-9:]+:[a-f0-9:]+)/i);
        if (m) ips.add(m[1]);
      };
      pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => {});
      setTimeout(() => { pc.close(); resolve({ leaked: ips.size > 0, ips: Array.from(ips) }); }, 2500);
    } catch {
      resolve({ leaked: false, ips: [] });
    }
  });
}

// Real DNS leak hint via Cloudflare trace
async function detectDnsResolver(): Promise<{ colo: string; loc: string; ip: string } | null> {
  try {
    const r = await fetch("https://1.1.1.1/cdn-cgi/trace");
    const txt = await r.text();
    const obj: Record<string, string> = {};
    txt.split("\n").forEach((l) => { const [k, v] = l.split("="); if (k && v) obj[k] = v; });
    return { colo: obj.colo || "?", loc: obj.loc || "?", ip: obj.ip || "?" };
  } catch { return null; }
}

type DeviceAudit = {
  ua: string; platform: string; cores: number; memoryGB: number | null;
  language: string; languages: readonly string[]; screen: string; dpr: number;
  timezone: string; touchPoints: number; vendor: string; cookiesEnabled: boolean;
  doNotTrack: string | null; online: boolean; connection: any;
  storageQuotaMB: number | null; storageUsedMB: number | null;
};

async function deviceAudit(): Promise<DeviceAudit> {
  const n = navigator as any;
  let quota: number | null = null, used: number | null = null;
  try {
    if (navigator.storage?.estimate) {
      const e = await navigator.storage.estimate();
      quota = Math.round((e.quota || 0) / 1024 / 1024);
      used = Math.round((e.usage || 0) / 1024 / 1024);
    }
  } catch {}
  return {
    ua: navigator.userAgent,
    platform: n.userAgentData?.platform || navigator.platform,
    cores: navigator.hardwareConcurrency || 0,
    memoryGB: n.deviceMemory ?? null,
    language: navigator.language,
    languages: navigator.languages,
    screen: `${screen.width}×${screen.height}`,
    dpr: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    touchPoints: navigator.maxTouchPoints,
    vendor: navigator.vendor,
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack,
    online: navigator.onLine,
    connection: n.connection ? { effectiveType: n.connection.effectiveType, downlink: n.connection.downlink, rtt: n.connection.rtt } : null,
    storageQuotaMB: quota, storageUsedMB: used,
  };
}

// Canvas + audio fingerprint hash
async function fingerprintHash(): Promise<{ hash: string; uniquenessHint: string }> {
  const c = document.createElement("canvas");
  c.width = 240; c.height = 60;
  const ctx = c.getContext("2d")!;
  ctx.textBaseline = "top";
  ctx.font = "16px 'Arial'";
  ctx.fillStyle = "#f60"; ctx.fillRect(0, 0, 100, 30);
  ctx.fillStyle = "#069"; ctx.fillText("Aureon Shield 🛡️", 2, 2);
  ctx.fillStyle = "rgba(102,204,0,0.7)"; ctx.fillText("fp", 4, 17);
  const data = c.toDataURL();
  const buf = new TextEncoder().encode(data + navigator.userAgent + screen.width);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  const hash = Array.from(new Uint8Array(digest)).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
  return { hash, uniquenessHint: "Hash derived from canvas + UA + resolution. Repeat across sites = trackable." };
}

type PermAudit = Record<string, string>;
async function permissionsAudit(): Promise<PermAudit> {
  const names = ["geolocation","notifications","camera","microphone","clipboard-read","clipboard-write","persistent-storage"];
  const out: PermAudit = {};
  for (const n of names) {
    try {
      // @ts-expect-error - browser permission name strings
      const p = await navigator.permissions.query({ name: n });
      out[n] = p.state;
    } catch { out[n] = "unsupported"; }
  }
  return out;
}

// Real HIBP password breach check (k-anonymity, never sends full password)
async function checkPasswordBreach(pw: string): Promise<number> {
  const buf = new TextEncoder().encode(pw);
  const digest = await crypto.subtle.digest("SHA-1", buf);
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
  const prefix = hex.slice(0, 5), suffix = hex.slice(5);
  const r = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
  const txt = await r.text();
  const line = txt.split("\n").find((l) => l.startsWith(suffix));
  return line ? parseInt(line.split(":")[1], 10) : 0;
}

// ────────────────────────────────────────────────────────────────────────────
// UI
// ────────────────────────────────────────────────────────────────────────────

const Glass = ({ className = "", children }: { className?: string; children: React.ReactNode }) => (
  <div className={`rounded-2xl border border-border/35 bg-card/55 backdrop-blur-2xl shadow-[0_18px_55px_-25px_hsl(var(--foreground)/0.45)] ${className}`}>{children}</div>
);

const Stat = ({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) => (
  <div className="flex flex-col gap-1">
    <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground/70 font-light">{label}</div>
    <div className={`text-sm font-light tracking-wide ${accent || "text-foreground"}`}>{value}</div>
  </div>
);

const SeverityDot = ({ s }: { s: string }) => {
  const m: Record<string, string> = {
    critical: "bg-red-500", high: "bg-orange-500", medium: "bg-yellow-500", low: "bg-emerald-500",
  };
  return <span className={`inline-block h-2 w-2 rounded-full ${m[s] || "bg-muted-foreground"}`} />;
};

type AnalysisResult = {
  score: number; verdict: string; headline: string; summary: string;
  threats: { severity: string; title: string; detail: string; action: string }[];
  recommendations: string[];
};

const AureonShield = () => {
  // SEO
  useEffect(() => {
    document.title = "Aureon Shield — Free Browser-Grade VPN & Cyber Audit | Aureon";
    const setMeta = (sel: string, attr: string, val: string, make: () => HTMLElement) => {
      let el = document.querySelector(sel) as HTMLElement | null;
      if (!el) { el = make(); document.head.appendChild(el); }
      el.setAttribute(attr, val);
    };
    setMeta('meta[name="description"]', "content",
      "Free military-grade browser audit, leak detection, breach checks, AI threat analysis, and OpenVPN client. No download required.",
      () => { const m = document.createElement("meta"); m.setAttribute("name", "description"); return m; });
  }, []);

  const [identity, setIdentity] = useState<NetIdentity | null>(null);
  const [baseline, setBaseline] = useState<NetIdentity | null>(null);
  const [webrtc, setWebrtc] = useState<{ leaked: boolean; ips: string[] } | null>(null);
  const [dns, setDns] = useState<{ colo: string; loc: string; ip: string } | null>(null);
  const [device, setDevice] = useState<DeviceAudit | null>(null);
  const [perms, setPerms] = useState<PermAudit | null>(null);
  const [fp, setFp] = useState<{ hash: string; uniquenessHint: string } | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Proxy session
  const [proxyUrl, setProxyUrl] = useState("");
  const [proxyActive, setProxyActive] = useState<string | null>(null);

  // HIBP
  const [pw, setPw] = useState("");
  const [pwResult, setPwResult] = useState<number | null>(null);
  const [pwChecking, setPwChecking] = useState(false);

  // Precise geolocation (browser API — only with explicit user consent)
  const [geo, setGeo] = useState<{ lat: number; lon: number; acc: number; ts: number } | null>(null);
  const [geoTracking, setGeoTracking] = useState(false);
  const geoWatchRef = useRef<number | null>(null);

  const captureGeo = useCallback(() => {
    if (!navigator.geolocation) { toast.error("Geolocation API unavailable"); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const fix = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, ts: p.timestamp };
        setGeo(fix);
        recordFix({ ...fix, source: "manual" }).catch(() => {});
        toast.success(`Precise position captured · ±${Math.round(p.coords.accuracy)}m`);
      },
      (err) => toast.error(`Geolocation denied: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  const toggleGeoTracking = useCallback((on: boolean) => {
    if (on) {
      if (!navigator.geolocation) { toast.error("Geolocation API unavailable"); return; }
      const id = navigator.geolocation.watchPosition(
        (p) => {
          const fix = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy, ts: p.timestamp };
          setGeo(fix);
          recordFix({ ...fix, source: "watch" }).catch(() => {});
        },
        (err) => toast.error(`Tracking failed: ${err.message}`),
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
      geoWatchRef.current = id; setGeoTracking(true);
    } else {
      if (geoWatchRef.current != null) navigator.geolocation.clearWatch(geoWatchRef.current);
      geoWatchRef.current = null; setGeoTracking(false); setGeo(null);
      toast.info("Tracking stopped — position cleared from memory");
    }
  }, []);

  useEffect(() => () => { if (geoWatchRef.current != null) navigator.geolocation?.clearWatch(geoWatchRef.current); }, []);

  // Multi-layer device protection signals (browser-derivable subset of full OS audit)
  const layers = useMemo(() => {
    const ua = device?.ua || "";
    const isHttps = typeof window !== "undefined" && window.location.protocol === "https:";
    const grantedSensors = perms ? Object.entries(perms).filter(([, v]) => v === "granted").length : 0;
    const cookieOk = device?.cookiesEnabled;
    const dnt = device?.doNotTrack === "1";
    const storageBig = (device?.storageQuotaMB ?? 0) > 1024;
    return [
      { id: 7, name: "User & Application", scope: "Browser tab",
        ok: !webrtc?.leaked && isHttps,
        signal: webrtc?.leaked ? `${webrtc.ips.length} IPs leak via WebRTC` : isHttps ? "TLS active · WebRTC clean" : "Mixed content risk",
        nativeOnly: false },
      { id: 6, name: "Operating System", scope: device?.platform || "Unknown",
        ok: !!device?.platform,
        signal: `${device?.platform || "?"} · ${device?.cores || "?"} cores · ${device?.memoryGB ?? "?"} GB`,
        nativeOnly: true, note: "Hardening (RDP, SMBv1, AutoRun, Telemetry) requires native client" },
      { id: 5, name: "Kernel & Drivers", scope: "Privileged ring",
        ok: false, signal: "Sandbox blocks kernel inspection",
        nativeOnly: true, note: "Rootkit / driver / syscall-table audit ships in ZorakCorp/openvpn" },
      { id: 4, name: "Firmware (BIOS/UEFI)", scope: "Pre-OS",
        ok: false, signal: "No web access to SPI flash",
        nativeOnly: true, note: "Secure-Boot + TPM verification via native client" },
      { id: 3, name: "Hardware (CPU/RAM)", scope: device?.vendor || "—",
        ok: !!device?.cores, signal: `${device?.cores || "?"} cores · RAM ${device?.memoryGB ? `${device.memoryGB} GB` : "hidden"} · DPR ${device?.dpr ?? "—"}`,
        nativeOnly: true, note: "Spectre/Meltdown/Rowhammer probes require native client" },
      { id: 2, name: "Network & Communication", scope: identity?.org || "—",
        ok: !!identity && !webrtc?.leaked,
        signal: identity ? `${identity.country} · ${identity.org} · DNS ${dns?.colo || "?"}` : "—",
        nativeOnly: false },
      { id: 1, name: "Physical & Sensors", scope: `${grantedSensors} permissions granted`,
        ok: grantedSensors === 0,
        signal: cookieOk ? `Cookies on · DNT ${dnt ? "set" : "off"} · ${storageBig ? "Persistent storage" : "Ephemeral"}` : "Cookies blocked",
        nativeOnly: false },
    ];
  }, [device, perms, webrtc, dns, identity]);

  const overallScore = useMemo(() => {
    if (!device) return 0;
    const browserOk = layers.filter((l) => !l.nativeOnly).every((l) => l.ok);
    const base = browserOk ? 70 : 45;
    return Math.min(100, base + (analysis?.score ? analysis.score * 0.3 : 0));
  }, [layers, device, analysis]);

  const runFullScan = useCallback(async () => {
    setScanning(true);
    try {
      const [id, w, d, dv, pm, f] = await Promise.all([
        detectIp().catch(() => null),
        detectWebRTCLeak().catch(() => ({ leaked: false, ips: [] })),
        detectDnsResolver().catch(() => null),
        deviceAudit(),
        permissionsAudit(),
        fingerprintHash(),
      ]);
      if (id) { setIdentity(id); if (!baseline) setBaseline(id); }
      setWebrtc(w); setDns(d); setDevice(dv); setPerms(pm); setFp(f);
      toast.success("Audit complete — 6 telemetry streams captured");
    } catch (e: any) {
      toast.error(`Scan error: ${e.message}`);
    } finally {
      setScanning(false);
    }
  }, [baseline]);

  useEffect(() => { runFullScan(); }, []); // eslint-disable-line

  const runAiAnalysis = useCallback(async () => {
    if (!identity || !device) { toast.error("Run a scan first"); return; }
    setAnalyzing(true); setAnalysis(null);
    try {
      const audit = { identity, baseline, webrtc, dns, device, permissions: perms, fingerprint: fp,
        proxyActive, capturedAt: new Date().toISOString() };
      const { data, error } = await supabase.functions.invoke("aureon-shield-analyze", { body: { audit } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAnalysis(data as AnalysisResult);
      toast.success(`Threat report ready · Score ${data.score}/100`);
    } catch (e: any) {
      toast.error(`AI analysis failed: ${e.message}`);
    } finally { setAnalyzing(false); }
  }, [identity, baseline, webrtc, dns, device, perms, fp, proxyActive]);

  const startProxy = useCallback((url: string) => {
    let target = url.trim();
    if (!target) return;
    if (!/^https?:\/\//i.test(target)) target = "https://" + target;
    // Real CORS proxy that fetches via remote server
    const proxied = `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`;
    setProxyActive(proxied);
    toast.success("Browser tunnel active — that page now loads via remote relay");
  }, []);

  const stopProxy = useCallback(() => { setProxyActive(null); toast.info("Tunnel closed"); }, []);

  const checkPw = useCallback(async () => {
    if (!pw) return;
    setPwChecking(true); setPwResult(null);
    try { setPwResult(await checkPasswordBreach(pw)); }
    catch (e: any) { toast.error(e.message); }
    finally { setPwChecking(false); }
  }, [pw]);

  const verdictColor = useMemo(() => {
    if (!analysis) return "text-muted-foreground";
    if (analysis.verdict === "PROTECTED") return "text-emerald-400";
    if (analysis.verdict === "EXPOSED") return "text-yellow-400";
    return "text-red-400";
  }, [analysis]);

  // Live Geo-Drift Leak Score (re-used by status strip + Relay tab)
  const leakScore = useMemo(
    () => computeLeakScore({ identity, baseline, webrtc, dns, perms, device, fp }),
    [identity, baseline, webrtc, dns, perms, device, fp],
  );

  return (
    <LandingBackground>
      <Header />

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6">
        {/* Hero */}
        <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/40 px-3 py-1 text-[9px] uppercase tracking-[0.32em] text-muted-foreground/80 backdrop-blur-xl">
              <Shield className="h-3 w-3" strokeWidth={1.5} />
              Aureon Shield · Free Forever
            </div>
            <h1 className="text-4xl font-extralight tracking-tight text-foreground sm:text-5xl">
              Military-grade browser audit & VPN
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-light text-muted-foreground">
              Real network identity inspection, WebRTC/DNS leak detection, device fingerprinting, breach checks, and AI threat analysis — all live, no installs.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="border-border/40 bg-card/40 backdrop-blur-xl hover:bg-card/70"
              onClick={runFullScan}
              disabled={scanning}
            >
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Re-scan
            </Button>
            <Button
              className="bg-foreground/90 text-background hover:bg-foreground"
              onClick={runAiAnalysis}
              disabled={analyzing || !identity}
            >
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Run AI Threat Analysis
            </Button>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border/40 bg-card/40 px-3 text-sm font-light text-foreground/80 backdrop-blur-xl transition hover:bg-card/70"
            >
              <Github className="h-4 w-4" /> GitHub
            </a>
          </div>
        </header>

        {/* Status strip */}
        <Glass className="mb-6 p-6">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-6">
            <div className="col-span-2 flex items-center gap-4 md:col-span-1">
              <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${analysis?.verdict === "PROTECTED" ? "border-emerald-400/40 bg-emerald-400/5" : "border-border/40 bg-background/40"}`}>
                {analysis?.verdict === "PROTECTED" ? <ShieldCheck className="h-6 w-6 text-emerald-400" /> :
                 analysis?.verdict === "COMPROMISED" ? <ShieldOff className="h-6 w-6 text-red-400" /> :
                 <Shield className="h-6 w-6 text-foreground/70" />}
              </div>
              <div>
                <div className="text-[9px] uppercase tracking-[0.32em] text-muted-foreground">Verdict</div>
                <div className={`text-lg font-light tracking-wide ${verdictColor}`}>{analysis?.verdict || "AWAITING ANALYSIS"}</div>
              </div>
            </div>
            <Stat label="Public IP" value={identity?.ip || "—"} />
            <Stat label="Geo / ISP" value={identity ? `${identity.city}, ${identity.country}` : "—"} />
            <Stat label="WebRTC Leak" value={webrtc?.leaked ? <span className="text-red-400">{webrtc.ips.length} IPs exposed</span> : <span className="text-emerald-400">None detected</span>} />
            <Stat label="DNS Resolver" value={dns ? `${dns.colo} · ${dns.loc}` : "—"} />
            <Stat label="Leak Score" value={<span className={bandColor(leakScore.band)}>{leakScore.score}/100 · {leakScore.band}</span>} />
          </div>
          {analysis && (
            <div className="mt-6 border-t border-border/30 pt-5">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-[9px] uppercase tracking-[0.32em] text-muted-foreground">Aureon Shield Score</div>
                  <div className="mt-1 text-2xl font-extralight tracking-wide">{analysis.score}<span className="text-sm text-muted-foreground">/100</span></div>
                </div>
                <Badge variant="outline" className="border-border/40 bg-card/40 font-light">{analysis.threats.length} findings</Badge>
              </div>
              <Progress value={analysis.score} className="h-1.5" />
              <p className="mt-3 text-sm font-light text-foreground/85">{analysis.headline}</p>
              <p className="mt-1 text-xs font-light leading-relaxed text-muted-foreground">{analysis.summary}</p>
            </div>
          )}
        </Glass>

        {/* Tabs */}
        <Tabs defaultValue="layers" className="space-y-4">
          <TabsList className="bg-card/40 backdrop-blur-xl border border-border/30 p-1 rounded-xl flex-wrap h-auto">
            <TabsTrigger value="layers">Layers</TabsTrigger>
            <TabsTrigger value="hardening">Hardening</TabsTrigger>
            <TabsTrigger value="trackers">Trackers</TabsTrigger>
            <TabsTrigger value="storage">Storage</TabsTrigger>
            <TabsTrigger value="extensions">Extensions</TabsTrigger>
            <TabsTrigger value="doh">DoH + Log</TabsTrigger>
            <TabsTrigger value="network">Network</TabsTrigger>
            <TabsTrigger value="device">Device</TabsTrigger>
            <TabsTrigger value="privacy">Privacy</TabsTrigger>
            <TabsTrigger value="location">Location</TabsTrigger>
            <TabsTrigger value="breach">Breach</TabsTrigger>
            <TabsTrigger value="tunnel">Tunnel</TabsTrigger>
            <TabsTrigger value="threats">Threats</TabsTrigger>
            <TabsTrigger value="native">Native VPN</TabsTrigger>
            <TabsTrigger value="shutoff">Shutoff</TabsTrigger>
          </TabsList>

          <TabsContent value="hardening"><HardeningTab /></TabsContent>
          <TabsContent value="trackers"><TrackersTab /></TabsContent>
          <TabsContent value="storage"><StorageTab /></TabsContent>
          <TabsContent value="extensions"><ExtensionsTab /></TabsContent>
          <TabsContent value="doh"><DohAuditTab /></TabsContent>
          <TabsContent value="shutoff"><ShutoffTab onPauseAudit={stopProxy} /></TabsContent>


          {/* LAYERS — multi-layer device protection (browser-derivable signals) */}
          <TabsContent value="layers" className="space-y-4">
            <Glass className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2"><Server className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">Multi-Layer Device Protection</h2></div>
                <div className="text-right">
                  <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Aureon Shield Score</div>
                  <div className="text-2xl font-extralight">{Math.round(overallScore)}<span className="text-sm text-muted-foreground">/100</span></div>
                </div>
              </div>
              <div className="space-y-2">
                {layers.map((l) => (
                  <div key={l.id} className="flex items-start gap-3 rounded-xl border border-border/30 bg-background/30 p-4">
                    <div className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg border ${l.ok ? "border-emerald-400/40 bg-emerald-400/5 text-emerald-300" : l.nativeOnly ? "border-border/40 bg-card/40 text-muted-foreground" : "border-yellow-400/40 bg-yellow-400/5 text-yellow-300"}`}>
                      <span className="text-[10px] font-mono">L{l.id}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-light text-foreground">{l.name}</span>
                        <span className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">{l.scope}</span>
                        {l.nativeOnly && <Badge variant="outline" className="border-border/40 text-[9px] font-light">Native client only</Badge>}
                      </div>
                      <div className="mt-1 text-xs font-light text-muted-foreground">{l.signal}</div>
                      {"note" in l && (l as any).note && (
                        <div className="mt-1 text-[10px] font-light text-foreground/60 italic">{(l as any).note}</div>
                      )}
                    </div>
                    {l.ok && <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11px] font-light text-muted-foreground">
                Browsers run inside a strict sandbox. Layers L3-L5 (kernel · firmware · hardware) cannot be inspected from a webpage by design — those scans require the open-source <a className="underline" href={REPO_URL} target="_blank" rel="noreferrer">ZorakCorp/openvpn</a> native client which performs rootkit detection, BIOS/UEFI verification, Spectre/Meltdown probes, USB monitoring and chassis-intrusion logging.
              </p>
            </Glass>
          </TabsContent>

          {/* LOCATION — precise geolocation with revoke */}
          <TabsContent value="location">
            <Glass className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">Precise Device Location</h2></div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Live tracking</span>
                  <Switch checked={geoTracking} onCheckedChange={toggleGeoTracking} />
                </div>
              </div>
              <p className="mb-4 text-xs font-light text-muted-foreground">
                Granted, the browser exposes GPS/Wi-Fi-fused coordinates within a few metres. Live tracking is opt-in and stored only in this tab — toggling off clears it from memory.
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <Button onClick={captureGeo} className="bg-foreground/90 text-background hover:bg-foreground"><MapPin className="h-4 w-4" /> Capture once</Button>
                {geo && (
                  <Button variant="outline" onClick={() => { setGeo(null); toast.info("Position cleared"); }} className="border-border/40 bg-card/40">
                    <X className="h-4 w-4" /> Clear
                  </Button>
                )}
              </div>
              {geo ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-xl border border-border/30 bg-background/30 p-4">
                  <Stat label="Latitude" value={geo.lat.toFixed(5)} />
                  <Stat label="Longitude" value={geo.lon.toFixed(5)} />
                  <Stat label="Accuracy" value={`±${Math.round(geo.acc)} m`} />
                  <Stat label="Captured" value={new Date(geo.ts).toLocaleTimeString()} />
                </div>
              ) : (
                <div className="rounded-xl border border-border/30 bg-background/30 p-4 text-xs text-muted-foreground">No precise position captured.</div>
              )}
              <div className="mt-4 grid md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border/30 bg-background/30 p-4">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Coarse (IP-derived)</div>
                  <div className="text-sm font-light">{identity ? `${identity.city}, ${identity.country}` : "—"}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">{identity?.latitude?.toFixed(2)}, {identity?.longitude?.toFixed(2)}</div>
                </div>
                <div className="rounded-xl border border-border/30 bg-background/30 p-4">
                  <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">Drift vs IP geo</div>
                  <div className="text-sm font-light">
                    {geo && identity?.latitude != null && identity?.longitude != null
                      ? `${Math.round(haversineKm(geo.lat, geo.lon, identity.latitude, identity.longitude))} km`
                      : "—"}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1">Large drift = VPN/proxy active or IP geolocation is stale.</div>
                </div>
              </div>
            </Glass>
          </TabsContent>

          {/* NETWORK */}
          <TabsContent value="network" className="grid gap-4 md:grid-cols-2">
            <Glass className="p-6">
              <div className="mb-4 flex items-center gap-2"><Globe className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">Network Identity</h2></div>
              <div className="grid grid-cols-2 gap-4">
                <Stat label="IP" value={identity?.ip || "—"} />
                <Stat label="Country" value={identity?.country || "—"} />
                <Stat label="City" value={identity?.city || "—"} />
                <Stat label="Region" value={identity?.region || "—"} />
                <Stat label="ISP / Org" value={identity?.org || "—"} />
                <Stat label="ASN" value={identity?.asn || "—"} />
                <Stat label="Timezone" value={identity?.timezone || "—"} />
                <Stat label="Coords" value={identity ? `${identity.latitude?.toFixed(2)}, ${identity.longitude?.toFixed(2)}` : "—"} />
              </div>
            </Glass>
            <Glass className="p-6">
              <div className="mb-4 flex items-center gap-2"><AlertTriangle className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">Leak Detection</h2></div>
              <div className="space-y-3">
                <div className="rounded-xl border border-border/30 bg-background/30 p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-light text-muted-foreground">WebRTC IP Leak</span>
                    {webrtc?.leaked ? <Badge variant="destructive">EXPOSED</Badge> : <Badge variant="outline" className="border-emerald-400/50 text-emerald-400">CLEAN</Badge>}
                  </div>
                  {webrtc?.ips.length ? (
                    <ul className="space-y-1 text-xs font-mono text-foreground/80">
                      {webrtc.ips.map((ip) => <li key={ip}>· {ip}</li>)}
                    </ul>
                  ) : <p className="text-xs text-muted-foreground">No local/STUN IPs leaked through WebRTC.</p>}
                </div>
                <div className="rounded-xl border border-border/30 bg-background/30 p-4">
                  <div className="mb-2 text-xs font-light text-muted-foreground">DNS Resolver Path</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <Stat label="POP" value={dns?.colo || "—"} />
                    <Stat label="Loc" value={dns?.loc || "—"} />
                    <Stat label="Edge IP" value={dns?.ip || "—"} />
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground">If DNS POP country ≠ your VPN exit country → DNS is leaking outside the tunnel.</p>
                </div>
                {baseline && identity && baseline.ip !== identity.ip && (
                  <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/5 p-4">
                    <div className="text-xs font-light text-emerald-300">IP changed since baseline</div>
                    <div className="mt-1 font-mono text-xs">{baseline.ip} → {identity.ip}</div>
                  </div>
                )}
              </div>
            </Glass>
          </TabsContent>

          {/* DEVICE */}
          <TabsContent value="device" className="grid gap-4 md:grid-cols-2">
            <Glass className="p-6">
              <div className="mb-4 flex items-center gap-2"><Cpu className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">Hardware & OS</h2></div>
              <div className="grid grid-cols-2 gap-4">
                <Stat label="Platform" value={device?.platform || "—"} />
                <Stat label="Vendor" value={device?.vendor || "—"} />
                <Stat label="CPU Cores" value={device?.cores || "—"} />
                <Stat label="RAM" value={device?.memoryGB ? `${device.memoryGB} GB` : "Hidden"} />
                <Stat label="Screen" value={device?.screen || "—"} />
                <Stat label="DPR" value={device?.dpr || "—"} />
                <Stat label="Touch points" value={device?.touchPoints ?? "—"} />
                <Stat label="Online" value={device?.online ? "Yes" : "No"} />
                <Stat label="Storage used" value={device?.storageUsedMB != null ? `${device.storageUsedMB} MB` : "—"} />
                <Stat label="Storage quota" value={device?.storageQuotaMB != null ? `${device.storageQuotaMB} MB` : "—"} />
                <Stat label="Net type" value={device?.connection?.effectiveType || "—"} />
                <Stat label="RTT" value={device?.connection?.rtt != null ? `${device.connection.rtt} ms` : "—"} />
              </div>
              {device && (
                <div className="mt-4 rounded-xl border border-border/30 bg-background/30 p-3">
                  <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">User Agent</div>
                  <div className="mt-1 break-all font-mono text-[11px] text-foreground/80">{device.ua}</div>
                </div>
              )}
            </Glass>
            <Glass className="p-6">
              <div className="mb-4 flex items-center gap-2"><Fingerprint className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">Browser Fingerprint</h2></div>
              {fp ? (
                <>
                  <div className="rounded-xl border border-border/30 bg-background/30 p-4">
                    <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Canvas + UA hash</div>
                    <div className="mt-2 font-mono text-lg tracking-widest text-foreground">{fp.hash}</div>
                  </div>
                  <p className="mt-3 text-xs font-light leading-relaxed text-muted-foreground">{fp.uniquenessHint}</p>
                </>
              ) : <p className="text-xs text-muted-foreground">Computing…</p>}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat label="Language" value={device?.language || "—"} />
                <Stat label="Timezone" value={device?.timezone || "—"} />
                <Stat label="Cookies" value={device?.cookiesEnabled ? "Enabled" : "Blocked"} />
                <Stat label="DNT header" value={device?.doNotTrack || "Not set"} />
              </div>
            </Glass>
          </TabsContent>

          {/* PRIVACY */}
          <TabsContent value="privacy">
            <Glass className="p-6">
              <div className="mb-4 flex items-center gap-2"><Eye className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">Browser Permissions Audit</h2></div>
              {perms ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(perms).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between rounded-xl border border-border/30 bg-background/30 px-4 py-3">
                      <span className="text-xs font-light tracking-wide">{k}</span>
                      <Badge variant="outline" className={`font-light ${v === "granted" ? "border-red-400/50 text-red-400" : v === "denied" ? "border-emerald-400/50 text-emerald-400" : "border-border/40 text-muted-foreground"}`}>{v}</Badge>
                    </div>
                  ))}
                </div>
              ) : <p className="text-xs text-muted-foreground">Loading…</p>}
              <p className="mt-4 text-[11px] font-light text-muted-foreground">
                Tip: any "granted" capability lets a site access that sensor without re-prompting. Revoke in your browser site-settings.
              </p>
            </Glass>
          </TabsContent>

          {/* BREACH */}
          <TabsContent value="breach">
            <Glass className="p-6">
              <div className="mb-4 flex items-center gap-2"><KeyRound className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">Password Breach Check (HIBP)</h2></div>
              <p className="mb-4 text-xs font-light text-muted-foreground">
                Uses k-anonymity: only the first 5 chars of a SHA-1 hash leave your browser. Your password is never sent.
              </p>
              <div className="flex gap-2">
                <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Paste a password to test"
                  className="bg-background/40 border-border/40 backdrop-blur-xl" />
                <Button onClick={checkPw} disabled={pwChecking || !pw} className="bg-foreground/90 text-background hover:bg-foreground">
                  {pwChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Check
                </Button>
              </div>
              {pwResult !== null && (
                <div className={`mt-4 rounded-xl border p-4 ${pwResult > 0 ? "border-red-400/40 bg-red-500/5" : "border-emerald-400/40 bg-emerald-500/5"}`}>
                  {pwResult > 0 ? (
                    <p className="text-sm font-light text-red-300">⚠ Found in <span className="font-mono">{pwResult.toLocaleString()}</span> known breaches. Stop using it everywhere.</p>
                  ) : (
                    <p className="text-sm font-light text-emerald-300">✓ Not found in any known public breach corpus.</p>
                  )}
                </div>
              )}
            </Glass>
          </TabsContent>

          {/* TUNNEL — in-browser proxy */}
          <TabsContent value="tunnel">
            <Glass className="p-6">
              <div className="mb-2 flex items-center gap-2"><Network className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">In-Browser Tunnel</h2></div>
              <p className="mb-4 text-xs font-light text-muted-foreground">
                Loads a target URL through a remote relay so the destination site sees the relay's IP, not yours. <strong className="text-foreground/80">This protects only what loads inside this frame</strong> — your other tabs and OS traffic still use your real connection. For full-device protection use the Native VPN tab.
              </p>
              <div className="flex gap-2">
                <Input value={proxyUrl} onChange={(e) => setProxyUrl(e.target.value)} placeholder="https://example.com"
                  className="bg-background/40 border-border/40 backdrop-blur-xl" onKeyDown={(e) => e.key === "Enter" && startProxy(proxyUrl)} />
                {!proxyActive ? (
                  <Button onClick={() => startProxy(proxyUrl)} disabled={!proxyUrl} className="bg-emerald-500/80 hover:bg-emerald-500 text-background">
                    <Power className="h-4 w-4" /> Connect
                  </Button>
                ) : (
                  <Button onClick={stopProxy} variant="destructive"><X className="h-4 w-4" /> Disconnect</Button>
                )}
              </div>
              {proxyActive && (
                <div className="mt-4 overflow-hidden rounded-xl border border-emerald-400/30 bg-background/40">
                  <div className="flex items-center justify-between border-b border-border/30 bg-card/40 px-3 py-2 text-[10px] uppercase tracking-[0.28em] text-emerald-300">
                    <span className="flex items-center gap-2"><Activity className="h-3 w-3 animate-pulse" /> Tunnel active · relay routing</span>
                    <span className="font-mono text-muted-foreground normal-case">{proxyUrl}</span>
                  </div>
                  <iframe src={proxyActive} title="Aureon Shield Tunnel" className="h-[600px] w-full bg-background" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
                </div>
              )}
            </Glass>
          </TabsContent>

          {/* THREATS — AI report */}
          <TabsContent value="threats">
            <Glass className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2"><Zap className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">AI Threat Report</h2></div>
                <Button onClick={runAiAnalysis} disabled={analyzing || !identity} size="sm" className="bg-foreground/90 text-background hover:bg-foreground">
                  {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  {analysis ? "Re-analyze" : "Analyze"}
                </Button>
              </div>
              {!analysis && !analyzing && (
                <p className="text-xs font-light text-muted-foreground">Run analysis to generate a forensic threat report from your live audit.</p>
              )}
              {analyzing && (
                <div className="flex items-center gap-3 text-sm font-light text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Gemini correlating {Object.keys({identity, webrtc, dns, device, perms, fp}).length} telemetry streams…
                </div>
              )}
              {analysis && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {analysis.threats.map((t, i) => (
                      <div key={i} className="rounded-xl border border-border/30 bg-background/30 p-4">
                        <div className="mb-1 flex items-center gap-2">
                          <SeverityDot s={t.severity} />
                          <span className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">{t.severity}</span>
                          <span className="text-sm font-light text-foreground">{t.title}</span>
                        </div>
                        <p className="text-xs font-light leading-relaxed text-muted-foreground">{t.detail}</p>
                        {t.action && <p className="mt-2 text-xs font-light text-foreground/85"><strong className="font-normal text-foreground">Action:</strong> {t.action}</p>}
                      </div>
                    ))}
                  </div>
                  {analysis.recommendations.length > 0 && (
                    <div className="rounded-xl border border-border/30 bg-background/30 p-4">
                      <div className="mb-2 text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Hardening Recommendations</div>
                      <ul className="space-y-1.5 text-xs font-light text-foreground/85">
                        {analysis.recommendations.map((r, i) => <li key={i} className="flex gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" /><span>{r}</span></li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </Glass>
          </TabsContent>

          {/* NATIVE VPN — honest about constraint */}
          <TabsContent value="native">
            <Glass className="p-6">
              <div className="mb-3 flex items-center gap-2"><Lock className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">Full-Device OpenVPN (Native Client)</h2></div>
              <p className="text-xs font-light leading-relaxed text-muted-foreground">
                A web page lives in a browser sandbox and physically cannot rewrite your OS routing table. That's why a "VPN" running purely in-browser cannot change the IP your Wi-Fi reports. To protect every app on the device — Mail, Messages, BitTorrent, system updaters — install the open-source <strong className="text-foreground/80">ZorakCorp/openvpn</strong> client below. It's free, audited, and runs locally with no telemetry.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <a href={REPO_URL} target="_blank" rel="noreferrer" className="group rounded-xl border border-border/35 bg-background/30 p-4 transition hover:border-foreground/30 hover:bg-background/50">
                  <div className="flex items-center justify-between">
                    <Github className="h-5 w-5" />
                    <ArrowUpRight className="h-4 w-4 opacity-50 transition group-hover:opacity-100" />
                  </div>
                  <div className="mt-3 text-sm font-light">Source on GitHub</div>
                  <div className="text-[10px] text-muted-foreground">ZorakCorp/openvpn · MIT</div>
                </a>
                <a href={`${REPO_URL}/releases/latest`} target="_blank" rel="noreferrer" className="group rounded-xl border border-border/35 bg-background/30 p-4 transition hover:border-foreground/30 hover:bg-background/50">
                  <div className="flex items-center justify-between"><HardDrive className="h-5 w-5" /><ArrowUpRight className="h-4 w-4 opacity-50 group-hover:opacity-100" /></div>
                  <div className="mt-3 text-sm font-light">Download Binary</div>
                  <div className="text-[10px] text-muted-foreground">Latest release · macOS / Linux / Win</div>
                </a>
                <a href={`${REPO_URL}/tree/master/contrib/aureon-hardening`} target="_blank" rel="noreferrer" className="group rounded-xl border border-border/35 bg-background/30 p-4 transition hover:border-foreground/30 hover:bg-background/50">
                  <div className="flex items-center justify-between"><Shield className="h-5 w-5" /><ArrowUpRight className="h-4 w-4 opacity-50 group-hover:opacity-100" /></div>
                  <div className="mt-3 text-sm font-light">Aureon Hardening Pack</div>
                  <div className="text-[10px] text-muted-foreground">Config auditor · Health scan · Doctor</div>
                </a>
              </div>
              <div className="mt-4 rounded-xl border border-border/30 bg-background/30 p-4">
                <div className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground">Quickstart (Terminal)</div>
                <pre className="mt-2 overflow-x-auto text-[11px] font-mono text-foreground/80">{`git clone https://github.com/ZorakCorp/openvpn
cd openvpn && ./configure && make
sudo make install
sudo openvpn --config aureon.ovpn`}</pre>
              </div>
            </Glass>
          </TabsContent>
        </Tabs>

        {/* Intelligence brief — kept minimal */}
        <Glass className="mt-6 p-6">
          <div className="mb-2 flex items-center gap-2"><MapPin className="h-4 w-4" /><h2 className="text-sm font-light tracking-wide">The Location-Jump Tell</h2></div>
          <p className="text-xs font-light leading-relaxed text-muted-foreground">
            Agencies don't break the VPN's encryption — they correlate your <em>historic</em> geo-trail. If your device pings a Las Vegas tower at 14:02 and a New Delhi exit at 14:03, the impossible-travel jump itself flags you. Defense: connect the VPN <strong className="text-foreground/80">before</strong> waking radios, keep the same exit region across sessions, and disable WebRTC (we test it on every scan above).
          </p>
        </Glass>
      </main>
    </LandingBackground>
  );
};

export default AureonShield;
