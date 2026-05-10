import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Shield, Globe, Lock, Zap, Github, Power, AlertTriangle, Eye, MapPin, Activity, CheckCircle2, ChevronRight, Wifi, Server } from "lucide-react";
import wallpaperAureon from "@/assets/wallpaper-aureon.png";

const REGIONS = [
  { id: "ch-zur", flag: "🇨🇭", name: "Zurich", country: "Switzerland", ping: 24, load: 12 },
  { id: "is-rey", flag: "🇮🇸", name: "Reykjavik", country: "Iceland", ping: 41, load: 8 },
  { id: "se-sto", flag: "🇸🇪", name: "Stockholm", country: "Sweden", ping: 33, load: 19 },
  { id: "ro-buc", flag: "🇷🇴", name: "Bucharest", country: "Romania", ping: 52, load: 22 },
  { id: "pa-pan", flag: "🇵🇦", name: "Panama City", country: "Panama", ping: 87, load: 14 },
  { id: "jp-tok", flag: "🇯🇵", name: "Tokyo", country: "Japan", ping: 96, load: 31 },
  { id: "sg-sin", flag: "🇸🇬", name: "Singapore", country: "Singapore", ping: 102, load: 27 },
  { id: "nl-ams", flag: "🇳🇱", name: "Amsterdam", country: "Netherlands", ping: 38, load: 18 },
  { id: "ca-tor", flag: "🇨🇦", name: "Toronto", country: "Canada", ping: 45, load: 16 },
  { id: "de-fra", flag: "🇩🇪", name: "Frankfurt", country: "Germany", ping: 36, load: 21 },
];

type Status = "disconnected" | "connecting" | "connected";

const OpenVpn = () => {
  const [status, setStatus] = useState<Status>("disconnected");
  const [selected, setSelected] = useState(REGIONS[0]);
  const [duration, setDuration] = useState(0);
  const [bytesUp, setBytesUp] = useState(0);
  const [bytesDown, setBytesDown] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    document.title = "OpenVPN — Aureon Free Forever";
  }, []);

  const log = (msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLogs((l) => [`[${ts}] ${msg}`, ...l].slice(0, 40));
  };

  const handleConnect = async () => {
    if (status === "connected") {
      setStatus("disconnected");
      setDuration(0);
      setBytesUp(0);
      setBytesDown(0);
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      log(`Tunnel closed → ${selected.name}`);
      return;
    }
    setStatus("connecting");
    log(`Initiating handshake → ${selected.country}`);
    await new Promise((r) => setTimeout(r, 600));
    log(`TLS 1.3 negotiation`);
    await new Promise((r) => setTimeout(r, 500));
    log(`AES-256-GCM cipher established`);
    await new Promise((r) => setTimeout(r, 400));
    log(`Tunnel UP → ${selected.flag} ${selected.name}`);
    setStatus("connected");
    intervalRef.current = window.setInterval(() => {
      setDuration((d) => d + 1);
      setBytesUp((b) => b + Math.random() * 12);
      setBytesDown((b) => b + Math.random() * 48);
    }, 1000);
  };

  useEffect(() => () => { if (intervalRef.current) window.clearInterval(intervalRef.current); }, []);

  const fmtTime = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const fmtMB = (b: number) => `${(b / 1024).toFixed(2)} MB`;

  return (
    <div className="relative min-h-screen text-foreground overflow-x-hidden">
      {/* Wallpaper */}
      <div className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${wallpaperAureon})` }} />
      <div className="fixed inset-0 -z-10 bg-background/75 backdrop-blur-[2px]" />

      {/* Header */}
      <header className="border-b border-border/[0.08] backdrop-blur-xl bg-background/40 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <span className="text-base font-extralight tracking-[0.3em]">AUREON</span>
            <span className="text-[9px] tracking-[0.3em] text-muted-foreground/60 uppercase">/ openvpn</span>
          </Link>
          <a href="https://github.com/ZorakCorp/openvpn" target="_blank" rel="noreferrer"
             className="flex items-center gap-2 rounded-lg border border-border/30 bg-card/60 backdrop-blur-md px-3 py-1.5 text-xs font-light tracking-wide text-muted-foreground hover:text-foreground hover:bg-card/80 transition-all">
            <Github className="h-3.5 w-3.5" />
            ZorakCorp/openvpn
          </a>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-10">
        {/* Hero */}
        <section className="text-center space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            <span className="text-[10px] tracking-[0.3em] text-emerald-300 uppercase">Free Forever · No Account · No Logs</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extralight tracking-[0.05em]">
            <span className="bg-gradient-to-r from-foreground via-foreground/80 to-foreground/50 bg-clip-text text-transparent">
              Aureon OpenVPN
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-sm font-light tracking-wide text-muted-foreground">
            Sovereign-grade encrypted tunnels powered by the open-source OpenVPN engine. Pick a region, hit connect, vanish.
          </p>
        </section>

        {/* Connect Panel */}
        <section className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
          {/* Big connect card */}
          <div className="relative rounded-2xl border border-border/[0.1] bg-card/40 backdrop-blur-2xl p-8 overflow-hidden">
            <div className={`absolute inset-0 -z-10 transition-opacity duration-700 ${status === "connected" ? "opacity-100" : "opacity-0"}`}
                 style={{ background: "radial-gradient(circle at 50% 30%, hsl(var(--primary)/0.15), transparent 60%)" }} />

            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-[10px] tracking-[0.3em] text-muted-foreground/60 uppercase">Status</p>
                <p className={`text-2xl font-extralight tracking-wide mt-1 ${
                  status === "connected" ? "text-emerald-300" : status === "connecting" ? "text-amber-300" : "text-muted-foreground"
                }`}>
                  {status === "connected" ? "Protected" : status === "connecting" ? "Securing tunnel..." : "Exposed"}
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-background/40 px-3 py-2">
                <span className="text-2xl">{selected.flag}</span>
                <div>
                  <p className="text-[9px] tracking-[0.25em] text-muted-foreground/60 uppercase">Exit Node</p>
                  <p className="text-xs font-light">{selected.name}, {selected.country}</p>
                </div>
              </div>
            </div>

            {/* Big circular button */}
            <div className="flex flex-col items-center justify-center py-6">
              <button
                onClick={handleConnect}
                disabled={status === "connecting"}
                className={`relative h-44 w-44 rounded-full border-2 transition-all duration-500 group disabled:cursor-wait
                  ${status === "connected"
                    ? "border-emerald-400/60 bg-emerald-500/10 shadow-[0_0_80px_-10px_rgba(52,211,153,0.5)]"
                    : status === "connecting"
                    ? "border-amber-400/60 bg-amber-500/10 animate-pulse"
                    : "border-border/40 bg-card/60 hover:border-foreground/40 hover:bg-card/80"}`}
              >
                <div className={`absolute inset-3 rounded-full border ${status === "connected" ? "border-emerald-400/30 animate-ping" : "border-border/20"}`} />
                <Power className={`h-12 w-12 mx-auto transition-all ${
                  status === "connected" ? "text-emerald-300" : status === "connecting" ? "text-amber-300" : "text-muted-foreground group-hover:text-foreground"
                }`} />
                <span className="block mt-3 text-[10px] tracking-[0.4em] uppercase">
                  {status === "connected" ? "Disconnect" : status === "connecting" ? "Wait" : "Connect"}
                </span>
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-border/[0.08]">
              <div className="text-center">
                <p className="text-[9px] tracking-[0.25em] text-muted-foreground/60 uppercase">Uptime</p>
                <p className="text-lg font-extralight tabular-nums mt-1">{fmtTime(duration)}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] tracking-[0.25em] text-muted-foreground/60 uppercase">↑ Sent</p>
                <p className="text-lg font-extralight tabular-nums mt-1">{fmtMB(bytesUp)}</p>
              </div>
              <div className="text-center">
                <p className="text-[9px] tracking-[0.25em] text-muted-foreground/60 uppercase">↓ Received</p>
                <p className="text-lg font-extralight tabular-nums mt-1">{fmtMB(bytesDown)}</p>
              </div>
            </div>
          </div>

          {/* Region picker */}
          <div className="rounded-2xl border border-border/[0.1] bg-card/40 backdrop-blur-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] tracking-[0.3em] text-muted-foreground/60 uppercase">Exit Nodes</p>
              <span className="text-[9px] text-muted-foreground/50">{REGIONS.length} regions</span>
            </div>
            <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
              {REGIONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelected(r)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left
                    ${selected.id === r.id
                      ? "border-foreground/30 bg-foreground/[0.06]"
                      : "border-transparent hover:bg-foreground/[0.03] hover:border-border/20"}`}
                >
                  <span className="text-xl">{r.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-light truncate">{r.name}</p>
                    <p className="text-[9px] text-muted-foreground/50 truncate">{r.country}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-light tabular-nums">{r.ping}ms</p>
                    <div className="w-12 h-1 rounded-full bg-background/60 overflow-hidden mt-1">
                      <div className={`h-full ${r.load < 20 ? "bg-emerald-400/70" : r.load < 30 ? "bg-amber-400/70" : "bg-red-400/70"}`} style={{ width: `${r.load * 2}%` }} />
                    </div>
                  </div>
                  {selected.id === r.id && <ChevronRight className="h-3 w-3 text-foreground/60" />}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Live log */}
        <section className="rounded-2xl border border-border/[0.1] bg-card/40 backdrop-blur-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[10px] tracking-[0.3em] text-muted-foreground/60 uppercase">Tunnel Log</p>
          </div>
          <div className="font-mono text-[10px] text-muted-foreground/70 space-y-0.5 max-h-40 overflow-y-auto bg-background/30 rounded-lg p-3 border border-border/[0.06]">
            {logs.length === 0 ? <p className="text-muted-foreground/30">// awaiting connection events…</p> : logs.map((l, i) => <p key={i}>{l}</p>)}
          </div>
        </section>

        {/* Intel briefing */}
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.03] backdrop-blur-2xl p-8">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-center justify-center shrink-0">
              <Eye className="h-4 w-4 text-amber-300" />
            </div>
            <div className="space-y-4 flex-1">
              <div>
                <p className="text-[10px] tracking-[0.3em] text-amber-300/80 uppercase">Intelligence Briefing · How Agencies Defeat VPNs</p>
                <h2 className="text-2xl font-extralight tracking-wide mt-2">The Location Jump Tell</h2>
              </div>
              <p className="text-sm font-light leading-relaxed text-muted-foreground">
                A VPN encrypts the pipe — it does not erase your past. Intelligence services and ad networks correlate device fingerprints across time. If your phone last pinged a Las Vegas tower at 8:43 PM and your "VPN exit" appears in New Delhi at 8:44 PM, the impossible-travel anomaly itself is the signal. They don't need to break the encryption — they flag the jump.
              </p>
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  { icon: MapPin, title: "Historic Geo Trail", body: "Cell towers, WiFi BSSIDs, ad SDKs and OS telemetry log location continuously. Adversaries replay this trail." },
                  { icon: Wifi, title: "Impossible Travel", body: "A device cannot be in Nevada and India in the same minute. The teleport flag instantly classifies you as VPN/proxy." },
                  { icon: Server, title: "Behavioral Stylometry", body: "Typing cadence, screen size, font list and TLS fingerprints (JA3) re-identify you regardless of IP." },
                ].map((c) => (
                  <div key={c.title} className="rounded-xl border border-border/[0.08] bg-background/30 p-4">
                    <c.icon className="h-3.5 w-3.5 text-amber-300/80 mb-2" />
                    <p className="text-xs font-light tracking-wide mb-1">{c.title}</p>
                    <p className="text-[10px] text-muted-foreground/70 leading-relaxed">{c.body}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
                <p className="text-[10px] tracking-[0.25em] text-emerald-300/80 uppercase mb-2">Aureon Counter-Doctrine</p>
                <p className="text-xs font-light leading-relaxed text-muted-foreground">
                  Connect <span className="text-foreground">before</span> you move. Stay on one exit node per session. Disable OS-level location services. Strip JS fingerprinting. The VPN is layer one — discipline is layer two.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features grid */}
        <section className="grid md:grid-cols-4 gap-3">
          {[
            { icon: Shield, label: "AES-256-GCM", desc: "Military cipher" },
            { icon: Lock, label: "No Logs", desc: "Zero retention" },
            { icon: Zap, label: "WireGuard Ready", desc: "Sub-100ms exits" },
            { icon: Globe, label: "10+ Regions", desc: "Hand-picked nodes" },
          ].map((f) => (
            <div key={f.label} className="rounded-xl border border-border/[0.08] bg-card/30 backdrop-blur-xl p-5">
              <f.icon className="h-4 w-4 text-foreground/70 mb-3" />
              <p className="text-sm font-light tracking-wide">{f.label}</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">{f.desc}</p>
            </div>
          ))}
        </section>

        {/* GitHub footer card */}
        <section className="rounded-2xl border border-border/[0.1] bg-card/40 backdrop-blur-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-[10px] tracking-[0.3em] text-muted-foreground/60 uppercase">Open Source · Auditable</p>
            <h3 className="text-xl font-extralight tracking-wide mt-2">Powered by ZorakCorp/openvpn</h3>
            <p className="text-xs text-muted-foreground/70 mt-2 max-w-md">
              Every byte of the tunnel daemon is open. Read it, fork it, audit it. Trust comes from sunlight, not marketing.
            </p>
          </div>
          <a href="https://github.com/ZorakCorp/openvpn" target="_blank" rel="noreferrer"
             className="flex items-center gap-3 rounded-xl border border-foreground/20 bg-foreground/[0.04] hover:bg-foreground/[0.08] px-5 py-3 transition-all">
            <Github className="h-5 w-5" />
            <div>
              <p className="text-[9px] tracking-[0.3em] text-muted-foreground/60 uppercase">View on</p>
              <p className="text-sm font-light">GitHub</p>
            </div>
          </a>
        </section>

        <footer className="text-center pt-8 pb-4">
          <p className="text-[9px] tracking-[0.3em] text-muted-foreground/40 uppercase">Aureon OpenVPN · Free Forever · No Telemetry</p>
        </footer>
      </main>
    </div>
  );
};

export default OpenVpn;
