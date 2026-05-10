import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clipboard,
  Download,
  Eye,
  FileCode2,
  Github,
  Globe,
  HardDrive,
  Lock,
  MapPin,
  Network,
  Radar,
  RefreshCw,
  Server,
  Shield,
  Terminal,
  Wifi,
  Zap,
} from "lucide-react";
import wallpaperAureon from "@/assets/wallpaper-aureon.png";
import { toast } from "sonner";

const REPO_URL = "https://github.com/ZorakCorp/openvpn";
const RAW_BASE = "https://raw.githubusercontent.com/ZorakCorp/openvpn/master";
const API_BASE = "https://api.github.com/repos/ZorakCorp/openvpn";

type IpState = {
  ip: string;
  city: string;
  region: string;
  country: string;
  org: string;
  timezone: string;
};

type RepoState = {
  updatedAt: string;
  pushedAt: string;
  defaultBranch: string;
  tools: Array<{ name: string; path: string; url: string }>;
};

const HARDENING_TOOLS = [
  {
    icon: Shield,
    name: "Config Auditor",
    file: "audit_ovpn_config.py",
    path: "contrib/aureon-hardening/audit_ovpn_config.py",
    body: "Stdlib heuristic scanner for risky .ovpn directives before a profile touches a device.",
  },
  {
    icon: HardDrive,
    name: "Device Health Scan",
    file: "device_health_scan.py",
    path: "contrib/aureon-hardening/device_health_scan.py",
    body: "Read-only endpoint inventory for storage pressure, stale surfaces, and posture handoff.",
  },
  {
    icon: Activity,
    name: "Aureon Doctor",
    file: "aureon_doctor.py",
    path: "contrib/aureon-hardening/aureon_doctor.py",
    body: "Chains Wi‑Fi, DNS, metrics, config audit, and optional inventory into one report bundle.",
  },
  {
    icon: FileCode2,
    name: "Phase‑2 Remediation Cockpit",
    file: "device_remediate_phase2.py",
    path: "contrib/aureon-hardening/device_remediate_phase2.py",
    body: "DNS/ARP/traceroute checks, disk bench, duplicate cleanup manifests, app inventory, SHA‑256 gates, and JSONL audit trails.",
  },
  {
    icon: Download,
    name: "Audit Bundle Export",
    file: "export_audit_bundle.py",
    path: "contrib/aureon-hardening/export_audit_bundle.py",
    body: "Creates a zip handoff with MANIFEST.json plus SHA‑256 index for review or incident response.",
  },
  {
    icon: Lock,
    name: "Hardened Fragments",
    file: "client/server.fragment",
    path: "sample/sample-config-files/hardened/README.rst",
    body: "TLS ≥ 1.2, remote certificate expectations, AES‑GCM / ChaCha20‑Poly1305 cipher floors.",
  },
];

const INSTALL_STEPS = [
  {
    label: "Clone",
    command: "git clone https://github.com/ZorakCorp/openvpn.git && cd openvpn",
  },
  {
    label: "Build Unix",
    command: "./configure && make && sudo make install",
  },
  {
    label: "Audit Profile",
    command: "python3 contrib/aureon-hardening/audit_ovpn_config.py path/to/client.ovpn",
  },
  {
    label: "Connect Native",
    command: "sudo openvpn --config path/to/client.ovpn",
  },
];

const rawUrl = (path: string) => `${RAW_BASE}/${path}`;
const blobUrl = (path: string) => `${REPO_URL}/blob/master/${path}`;

const fetchIp = async (): Promise<IpState> => {
  const res = await fetch("https://ipapi.co/json/");
  if (!res.ok) throw new Error("IP intelligence endpoint unavailable");
  const data = await res.json();
  return {
    ip: data.ip || "Unknown",
    city: data.city || "Unknown",
    region: data.region || "Unknown",
    country: data.country_name || data.country || "Unknown",
    org: data.org || data.asn || "Unknown network",
    timezone: data.timezone || "Unknown",
  };
};

const OpenVpn = () => {
  const [beforeIp, setBeforeIp] = useState<IpState | null>(null);
  const [afterIp, setAfterIp] = useState<IpState | null>(null);
  const [loadingIp, setLoadingIp] = useState(false);
  const [repo, setRepo] = useState<RepoState | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);

  const refreshIp = useCallback(async (slot: "before" | "after") => {
    setLoadingIp(true);
    try {
      const ip = await fetchIp();
      if (slot === "before") setBeforeIp(ip);
      else setAfterIp(ip);
      toast.success(slot === "before" ? "Baseline location captured" : "Current public IP verified");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to verify public IP");
    } finally {
      setLoadingIp(false);
    }
  }, []);

  const syncRepo = useCallback(async () => {
    try {
      const [repoRes, toolsRes] = await Promise.all([
        fetch(API_BASE),
        fetch(`${API_BASE}/contents/contrib/aureon-hardening`),
      ]);
      if (!repoRes.ok || !toolsRes.ok) throw new Error("GitHub sync unavailable");
      const repoData = await repoRes.json();
      const toolData = await toolsRes.json();
      setRepo({
        updatedAt: repoData.updated_at,
        pushedAt: repoData.pushed_at,
        defaultBranch: repoData.default_branch,
        tools: Array.isArray(toolData)
          ? toolData
              .filter((item) => item.type === "file")
              .map((item) => ({ name: item.name, path: item.path, url: item.html_url }))
          : [],
      });
      setRepoError(null);
    } catch (error) {
      setRepoError(error instanceof Error ? error.message : "GitHub sync failed");
    }
  }, []);

  useEffect(() => {
    document.title = "OpenVPN — Aureon Free Forever";
    refreshIp("before");
    syncRepo();
  }, [refreshIp, syncRepo]);

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success("Command copied");
  };

  const changed = useMemo(() => {
    if (!beforeIp || !afterIp) return false;
    return beforeIp.ip !== afterIp.ip || beforeIp.country !== afterIp.country;
  }, [beforeIp, afterIp]);

  return (
    <div className="relative min-h-screen overflow-x-hidden text-foreground">
      <div className="fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${wallpaperAureon})` }} />
      <div className="fixed inset-0 -z-10 bg-background/80 backdrop-blur-[2px]" />
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,hsl(var(--foreground)/0.12),transparent_38%),linear-gradient(180deg,hsl(var(--background)/0.1),hsl(var(--background)))]" />

      <header className="sticky top-0 z-20 border-b border-border/[0.08] bg-background/45 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <Link to="/" className="flex items-center gap-3">
            <span className="text-base font-extralight tracking-[0.3em]">AUREON</span>
            <span className="hidden text-[9px] uppercase tracking-[0.3em] text-muted-foreground/60 sm:inline">/ openvpn</span>
          </Link>
          <div className="flex items-center gap-2">
            <a
              href={`${REPO_URL}/archive/refs/heads/master.zip`}
              className="hidden items-center gap-2 rounded-lg border border-border/30 bg-card/60 px-3 py-1.5 text-xs font-light tracking-wide text-muted-foreground backdrop-blur-md transition-all hover:bg-card/80 hover:text-foreground sm:flex"
            >
              <Download className="h-3.5 w-3.5" />
              Download ZIP
            </a>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-lg border border-border/30 bg-card/60 px-3 py-1.5 text-xs font-light tracking-wide text-muted-foreground backdrop-blur-md transition-all hover:bg-card/80 hover:text-foreground"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-10">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/40 px-4 py-1.5 backdrop-blur-xl">
              <CheckCircle2 className="h-3 w-3 text-foreground/70" />
              <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Free Forever · Native OpenVPN · Live IP Proof</span>
            </div>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-5xl font-extralight leading-none tracking-[0.04em] sm:text-6xl md:text-7xl">
                Aureon OpenVPN
              </h1>
              <p className="max-w-2xl text-sm font-light leading-relaxed tracking-wide text-muted-foreground">
                This page now controls the real workflow: download or build your ZorakCorp OpenVPN fork, audit the config, launch the native tunnel, then verify the public IP from the browser. No fake region switches. No simulated protection claims.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={`${REPO_URL}/archive/refs/heads/master.zip`}
                className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90"
              >
                <Download className="h-4 w-4" />
                Download Software
                <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </a>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-border/30 bg-card/45 px-5 py-3 text-sm font-light tracking-wide text-foreground backdrop-blur-xl transition-all hover:bg-card/70"
              >
                <Github className="h-4 w-4" />
                View Source
              </a>
              <a
                href={rawUrl("sample/sample-config-files/hardened/client.fragment")}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-border/30 bg-card/45 px-5 py-3 text-sm font-light tracking-wide text-foreground backdrop-blur-xl transition-all hover:bg-card/70"
              >
                <FileCode2 className="h-4 w-4" />
                Client Fragment
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-border/[0.1] bg-card/35 p-5 backdrop-blur-2xl">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">Live Repository Sync</p>
                <h2 className="mt-1 text-xl font-extralight tracking-wide">ZorakCorp/openvpn</h2>
              </div>
              <button
                onClick={syncRepo}
                className="rounded-lg border border-border/25 bg-background/30 p-2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Refresh GitHub repository data"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/[0.08] bg-background/30 p-4">
                <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/50">Branch</p>
                <p className="mt-2 text-sm font-light">{repo?.defaultBranch || "master"}</p>
              </div>
              <div className="rounded-xl border border-border/[0.08] bg-background/30 p-4">
                <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/50">Hardening Files</p>
                <p className="mt-2 text-sm font-light">{repo?.tools.length ?? HARDENING_TOOLS.length}</p>
              </div>
              <div className="col-span-2 rounded-xl border border-border/[0.08] bg-background/30 p-4">
                <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/50">Last Push</p>
                <p className="mt-2 text-sm font-light tabular-nums">
                  {repo?.pushedAt ? new Date(repo.pushedAt).toLocaleString() : repoError || "Syncing GitHub…"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border/[0.1] bg-card/35 p-5 backdrop-blur-2xl md:p-6">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">Real Location Verification</p>
              <h2 className="mt-1 text-2xl font-extralight tracking-wide">Your browser cannot create a VPN tunnel — your native client does.</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => refreshIp("before")}
                disabled={loadingIp}
                className="inline-flex items-center gap-2 rounded-lg border border-border/30 bg-background/35 px-4 py-2 text-xs font-light tracking-wide transition-colors hover:bg-background/55 disabled:cursor-wait"
              >
                <Radar className="h-3.5 w-3.5" />
                Capture Baseline
              </button>
              <button
                onClick={() => refreshIp("after")}
                disabled={loadingIp}
                className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-xs font-light tracking-wide text-background transition-colors hover:bg-foreground/90 disabled:cursor-wait"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Verify After Connect
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
            <IpCard title="Before VPN" ip={beforeIp} icon={Wifi} />
            <div className="hidden items-center justify-center px-2 lg:flex">
              <div className="flex h-full min-h-32 w-px items-center bg-border/20">
                <div className="-ml-5 flex h-10 w-10 items-center justify-center rounded-full border border-border/30 bg-card/80 backdrop-blur-xl">
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </div>
            <IpCard title="After Native Connect" ip={afterIp} icon={Globe} changed={changed} />
          </div>

          <div className="mt-5 rounded-xl border border-border/[0.08] bg-background/30 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60" />
              <p className="text-xs font-light leading-relaxed text-muted-foreground">
                If this panel still says America after you connect, the tunnel is not active at the OS/network level, split tunneling is leaking browser traffic, DNS/WebRTC is exposing you, or your .ovpn profile is not routing <span className="text-foreground">redirect-gateway</span> traffic through the tunnel. The UI will not fake the answer anymore.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-border/[0.1] bg-card/35 p-6 backdrop-blur-2xl">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">Native Connection Sequence</p>
            <h2 className="mt-2 text-2xl font-extralight tracking-wide">Install → Audit → Connect → Verify</h2>
            <div className="mt-6 space-y-3">
              {INSTALL_STEPS.map((step, index) => (
                <div key={step.label} className="rounded-xl border border-border/[0.08] bg-background/30 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground/50">0{index + 1} · {step.label}</span>
                    <button
                      onClick={() => copy(step.command)}
                      className="rounded-md border border-border/20 bg-card/40 p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={`Copy ${step.label} command`}
                    >
                      <Clipboard className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <code className="block break-words font-mono text-[11px] leading-relaxed text-foreground/75">{step.command}</code>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border/[0.1] bg-card/35 p-6 backdrop-blur-2xl">
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">Integrated From Your Repository</p>
            <h2 className="mt-2 text-2xl font-extralight tracking-wide">Aureon hardening pack</h2>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {HARDENING_TOOLS.map((tool) => (
                <a
                  key={tool.path}
                  href={blobUrl(tool.path)}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-xl border border-border/[0.08] bg-background/30 p-4 transition-all hover:border-border/30 hover:bg-background/45"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <tool.icon className="h-4 w-4 text-foreground/70" />
                    <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>
                  <p className="text-sm font-light tracking-wide">{tool.name}</p>
                  <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/70">{tool.body}</p>
                  <p className="mt-3 truncate font-mono text-[9px] text-muted-foreground/45">{tool.file}</p>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border/[0.1] bg-card/35 p-6 backdrop-blur-2xl">
          <div className="mb-5 flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/20 bg-background/35">
              <Eye className="h-4 w-4 text-foreground/70" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">Intelligence Briefing · VPN Location Bypass</p>
              <h2 className="mt-2 text-2xl font-extralight tracking-wide">The Location Jump Tell</h2>
            </div>
          </div>
          <p className="max-w-5xl text-sm font-light leading-relaxed text-muted-foreground">
            A VPN changes the public network path; it does not erase device history. Agencies, data brokers, and ad networks can correlate historic cell towers, Wi‑Fi BSSIDs, OS telemetry, account logins, TLS/browser fingerprints, and impossible-travel jumps. If a device was last seen in Las Vegas and one minute later appears through New Delhi, the jump itself becomes the fingerprint. Encryption may hold; identity correlation still exposes the operator.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { icon: MapPin, title: "Historic Geo Trail", body: "Cell towers, Wi‑Fi access points, app SDKs, and OS location services build a persistent device movement graph." },
              { icon: Network, title: "Impossible Travel", body: "A sudden country jump flags proxy/VPN use even when the tunnel cryptography is intact." },
              { icon: Server, title: "Fingerprint Continuity", body: "Browser size, fonts, WebRTC, TLS traits, login cookies, and typing rhythm can survive IP rotation." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-border/[0.08] bg-background/30 p-4">
                <item.icon className="mb-3 h-4 w-4 text-foreground/70" />
                <p className="text-sm font-light tracking-wide">{item.title}</p>
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/70">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-border/[0.08] bg-background/30 p-4">
            <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/60">Counter‑Doctrine</p>
            <p className="text-xs font-light leading-relaxed text-muted-foreground">
              Connect before movement, keep one exit node per session, disable OS/browser location surfaces, block WebRTC leaks, verify DNS, avoid account cross-contamination, and confirm your public IP after the native tunnel is active.
            </p>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          {[
            { icon: Shield, label: "OpenVPN Lineage", desc: "Auditable GPLv2 tunnel daemon" },
            { icon: Lock, label: "Aureon Floors", desc: "TLS 1.2+ and AEAD fragments" },
            { icon: Zap, label: "DCO Aware", desc: "Modern kernel offload path docs" },
            { icon: Terminal, label: "Doctor Tools", desc: "Config, device, and bundle CLIs" },
          ].map((feature) => (
            <div key={feature.label} className="rounded-xl border border-border/[0.08] bg-card/30 p-5 backdrop-blur-xl">
              <feature.icon className="mb-3 h-4 w-4 text-foreground/70" />
              <p className="text-sm font-light tracking-wide">{feature.label}</p>
              <p className="mt-1 text-[10px] text-muted-foreground/60">{feature.desc}</p>
            </div>
          ))}
        </section>

        <section className="flex flex-col items-center justify-between gap-6 rounded-2xl border border-border/[0.1] bg-card/35 p-8 backdrop-blur-2xl md:flex-row">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">Open Source · Auditable</p>
            <h3 className="mt-2 text-xl font-extralight tracking-wide">Powered by ZorakCorp/openvpn</h3>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground/70">
              The page now follows your repo: House of Asher hardening guide, config auditor, device scanners, doctor bundle, remediation cockpit, audit exporter, and hardened config fragments.
            </p>
          </div>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-foreground/20 bg-foreground/[0.04] px-5 py-3 transition-all hover:bg-foreground/[0.08]"
          >
            <Github className="h-5 w-5" />
            <div>
              <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground/60">Open on</p>
              <p className="text-sm font-light">GitHub</p>
            </div>
          </a>
        </section>

        <footer className="pb-4 pt-8 text-center">
          <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground/40">Aureon OpenVPN · Free Forever · Real Verification · No Fake Location State</p>
        </footer>
      </main>
    </div>
  );
};

const IpCard = ({
  title,
  ip,
  icon: Icon,
  changed,
}: {
  title: string;
  ip: IpState | null;
  icon: typeof Wifi;
  changed?: boolean;
}) => (
  <div className="rounded-xl border border-border/[0.08] bg-background/30 p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-foreground/70" />
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/60">{title}</p>
      </div>
      {changed && <span className="rounded-full border border-border/25 bg-card/50 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-foreground/70">Changed</span>}
    </div>
    {ip ? (
      <div className="space-y-3">
        <p className="break-all font-mono text-lg font-light tracking-wide text-foreground">{ip.ip}</p>
        <div className="grid grid-cols-2 gap-3 text-[10px]">
          <Field label="City" value={ip.city} />
          <Field label="Region" value={ip.region} />
          <Field label="Country" value={ip.country} />
          <Field label="Timezone" value={ip.timezone} />
        </div>
        <div className="rounded-lg border border-border/[0.06] bg-card/25 p-3">
          <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/45">Network</p>
          <p className="mt-1 break-words text-[11px] leading-relaxed text-muted-foreground/80">{ip.org}</p>
        </div>
      </div>
    ) : (
      <div className="flex min-h-40 items-center justify-center rounded-lg border border-border/[0.06] bg-card/20 text-[10px] uppercase tracking-[0.25em] text-muted-foreground/40">
        Awaiting IP capture
      </div>
    )}
  </div>
);

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-border/[0.06] bg-card/20 p-3">
    <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/45">{label}</p>
    <p className="mt-1 truncate text-xs font-light text-foreground/80">{value}</p>
  </div>
);

export default OpenVpn;
