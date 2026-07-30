import { useMemo, useState } from "react";
import { Apple, Chrome, Cog, Globe, MonitorSmartphone, Power, Smartphone, Terminal, Wifi } from "lucide-react";
import { toast } from "sonner";

type OS = "windows" | "macos" | "linux" | "ios" | "android" | "chromeos";

const detectOS = (): OS => {
  const ua = navigator.userAgent.toLowerCase();
  const platform = (navigator.platform || "").toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  if (/cros/.test(ua)) return "chromeos";
  if (/mac/.test(platform) || /mac os/.test(ua)) return "macos";
  if (/win/.test(platform)) return "windows";
  return "linux";
};

type Step = { title: string; detail?: string };
type Section = { id: OS; label: string; icon: React.ReactNode; intro: string; steps: Step[] };

const SECTIONS: Section[] = [
  {
    id: "windows",
    label: "Windows 10 / 11",
    icon: <MonitorSmartphone className="h-4 w-4" />,
    intro: "Disable Asherin Shield's browser audit, tunnel, and any VPN profile.",
    steps: [
      { title: "Pause this audit", detail: "Click the Power switch in the status strip above (top-right of Asherin Shield). The browser audit telemetry stops immediately and the page reverts to your raw network identity." },
      { title: "Close the in-browser tunnel", detail: "Open the Tunnel tab → click Stop Tunnel. Any tab routed through the relay returns to your direct ISP route." },
      { title: "Disable browser hardening", detail: "Open the Hardening tab → toggle off Canvas Spoof, WebGL Spoof, Audio Spoof, Font Block, Battery API, Network Info, Memory API. Reload the tab once to clear injected overrides." },
      { title: "Remove the OpenVPN system profile (if installed)", detail: "Press Win + R → type ncpa.cpl → Enter. Right-click the TAP-Windows / WireGuard / Asherin adapter → Disable. To uninstall: Settings → Apps → Installed apps → search 'OpenVPN' or 'WireGuard' → Uninstall." },
      { title: "Stop the background service", detail: "Press Win + R → services.msc → Enter. Find OpenVPNService (or WireGuardManager) → Right-click → Stop → set Startup type to Disabled." },
      { title: "Flush DNS to clear DoH overrides", detail: "Open PowerShell as Administrator → run: ipconfig /flushdns  then  Clear-DnsClientCache" },
      { title: "Verify shutoff", detail: "Reload the Asherin Shield page. Verdict should read AWAITING ANALYSIS, the public IP should match your real ISP, and WebRTC should report your true local IPs." },
    ],
  },
  {
    id: "macos",
    label: "macOS",
    icon: <Apple className="h-4 w-4" />,
    intro: "Stop the audit, remove VPN configurations, and reset DNS.",
    steps: [
      { title: "Pause this audit", detail: "Click the Power switch in the status strip. All browser-side fingerprint overrides stop and telemetry halts." },
      { title: "Close the in-browser tunnel", detail: "Tunnel tab → Stop Tunnel." },
      { title: "Turn off browser hardening", detail: "Hardening tab → toggle off every spoofer (Canvas, WebGL, Audio, Fonts, Battery, Network, Memory). Cmd + R to reload the tab." },
      { title: "Remove the system VPN profile", detail: "Apple menu → System Settings → Network → VPN. Click the (i) next to the Asherin / OpenVPN / WireGuard entry → Remove Configuration. Confirm with your password." },
      { title: "Delete configuration profiles", detail: "System Settings → Privacy & Security → Profiles. Select any 'OpenVPN' / 'Asherin Shield' profile → minus (−) button → Remove." },
      { title: "Quit the helper agent", detail: "Open Terminal → run:  sudo launchctl unload /Library/LaunchDaemons/net.openvpn.client.plist  (or the WireGuard equivalent). Then:  sudo killall openvpn 2>/dev/null" },
      { title: "Flush DNS", detail: "Terminal → sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder" },
      { title: "Verify", detail: "Reload Asherin Shield. Public IP should equal your real ISP IP; DNS resolver should return your ISP / system default, not Cloudflare 1.1.1.1." },
    ],
  },
  {
    id: "linux",
    label: "Linux",
    icon: <Terminal className="h-4 w-4" />,
    intro: "Kill the audit, drop OpenVPN/WireGuard interfaces, restore default DNS.",
    steps: [
      { title: "Pause this audit", detail: "Click the Power switch in the status strip above." },
      { title: "Close the in-browser tunnel", detail: "Tunnel tab → Stop Tunnel." },
      { title: "Turn off browser hardening", detail: "Hardening tab → toggle every spoofer off. Ctrl + R to reload the tab." },
      { title: "Drop the VPN interface", detail: "Terminal:  sudo wg-quick down wg0   (WireGuard) or  sudo systemctl stop openvpn-client@aureon  (OpenVPN systemd unit)." },
      { title: "Disable the unit so it never auto-starts", detail: "sudo systemctl disable openvpn-client@aureon  /  sudo systemctl disable wg-quick@wg0" },
      { title: "Remove the package (optional)", detail: "Debian/Ubuntu:  sudo apt remove --purge openvpn wireguard-tools     Fedora/RHEL:  sudo dnf remove openvpn wireguard-tools     Arch:  sudo pacman -Rns openvpn wireguard-tools" },
      { title: "Restore default DNS", detail: "sudo resolvectl revert <iface>     (or remove /etc/resolv.conf overrides and restart NetworkManager:  sudo systemctl restart NetworkManager)" },
      { title: "Verify", detail: "ip a should no longer show tun0 / wg0. curl ifconfig.me should return your ISP IP. Reload Asherin Shield to confirm." },
    ],
  },
  {
    id: "ios",
    label: "iPhone / iPad",
    icon: <Smartphone className="h-4 w-4" />,
    intro: "Disable VPN profile and reset Safari overrides.",
    steps: [
      { title: "Pause this audit", detail: "Tap the Power switch in the status strip. Browser-side audit stops." },
      { title: "Stop the in-browser tunnel", detail: "Tunnel tab → Stop Tunnel." },
      { title: "Toggle VPN off (quick)", detail: "Settings → VPN → toggle Status to off. The on-screen 'VPN' badge in the status bar disappears." },
      { title: "Delete the VPN configuration", detail: "Settings → General → VPN & Device Management → VPN → tap the (i) next to 'Asherin' / 'OpenVPN' → Delete VPN. Confirm." },
      { title: "Remove the configuration profile", detail: "Settings → General → VPN & Device Management → under Configuration Profile, tap any Asherin profile → Remove Profile. Enter your passcode." },
      { title: "Uninstall the app", detail: "Long-press the OpenVPN Connect / WireGuard app icon → Remove App → Delete App." },
      { title: "Clear Safari leftovers", detail: "Settings → Safari → Clear History and Website Data → confirm." },
      { title: "Verify", detail: "Reload aureonai.app/openvpn in Safari. The status strip should show your real carrier IP and 'AWAITING ANALYSIS'." },
    ],
  },
  {
    id: "android",
    label: "Android",
    icon: <Smartphone className="h-4 w-4" />,
    intro: "Revoke VPN authorization and uninstall the client.",
    steps: [
      { title: "Pause this audit", detail: "Tap the Power switch in the status strip." },
      { title: "Stop the in-browser tunnel", detail: "Tunnel tab → Stop Tunnel." },
      { title: "Disconnect the VPN", detail: "Settings → Network & internet → VPN → tap the gear next to 'Asherin' / 'OpenVPN' → Disconnect. Toggle 'Always-on VPN' off." },
      { title: "Forget the profile", detail: "Same screen → Forget VPN. Confirm." },
      { title: "Uninstall the client", detail: "Long-press OpenVPN Connect / WireGuard / Asherin app → App info → Uninstall." },
      { title: "Revoke private DNS override", detail: "Settings → Network & internet → Private DNS → select Off (or Automatic)." },
      { title: "Clear Chrome site data", detail: "Chrome → ⋮ → Settings → Site settings → All sites → aureonai.app → Clear & reset." },
      { title: "Verify", detail: "Reload the page. The key icon in the status bar should be gone and Asherin Shield should show your real mobile IP." },
    ],
  },
  {
    id: "chromeos",
    label: "ChromeOS",
    icon: <Chrome className="h-4 w-4" />,
    intro: "Remove the VPN network and reset DNS.",
    steps: [
      { title: "Pause this audit", detail: "Click the Power switch in the status strip." },
      { title: "Close the in-browser tunnel", detail: "Tunnel tab → Stop Tunnel." },
      { title: "Disconnect the VPN", detail: "Status area (bottom-right) → click the VPN tile → toggle off." },
      { title: "Forget the network", detail: "Settings → Network → Add connection → expand the OpenVPN/L2TP section → click the existing entry → Forget." },
      { title: "Remove the extension (if any)", detail: "chrome://extensions → find the VPN extension → Remove." },
      { title: "Reset Secure DNS", detail: "Settings → Security and Privacy → Use secure DNS → toggle off (or set to 'With your current service provider')." },
      { title: "Verify", detail: "Reload the page; verdict should reset and your IP should match your real ISP." },
    ],
  },
];

const BROWSER_STEPS: { id: string; label: string; icon: React.ReactNode; steps: Step[] }[] = [
  {
    id: "chrome",
    label: "Chrome / Edge / Brave",
    icon: <Chrome className="h-4 w-4" />,
    steps: [
      { title: "Disable Secure DNS (DoH)", detail: "Settings → Privacy and security → Security → scroll to 'Use secure DNS' → toggle off." },
      { title: "Clear site permissions", detail: "Settings → Privacy and security → Site Settings → View permissions and data stored across sites → search aureonai.app → Clear data." },
      { title: "Disable Aureon-related extensions", detail: "chrome://extensions → toggle off any Asherin Shield / privacy proxy extension → Remove." },
    ],
  },
  {
    id: "firefox",
    label: "Firefox",
    icon: <Globe className="h-4 w-4" />,
    steps: [
      { title: "Turn off DNS over HTTPS", detail: "about:preferences#privacy → scroll to DNS over HTTPS → set to Off." },
      { title: "Clear site data", detail: "about:preferences#privacy → Cookies and Site Data → Manage Data → search aureonai.app → Remove Selected." },
      { title: "Reset WebRTC override", detail: "about:config → search media.peerconnection.enabled → set true (default)." },
    ],
  },
  {
    id: "safari",
    label: "Safari",
    icon: <Apple className="h-4 w-4" />,
    steps: [
      { title: "Disable iCloud Private Relay", detail: "System Settings → Apple ID → iCloud → Private Relay → off." },
      { title: "Clear website data", detail: "Safari → Settings → Privacy → Manage Website Data → search aureonai.app → Remove." },
      { title: "Reset advanced tracking protection", detail: "Safari → Settings → Privacy → uncheck 'Hide IP address from trackers' if you don't want it." },
    ],
  },
];

interface ShutoffTabProps {
  onPauseAudit?: () => void;
}

export const ShutoffTab = ({ onPauseAudit }: ShutoffTabProps) => {
  const detected = useMemo(detectOS, []);
  const [active, setActive] = useState<OS>(detected);
  const section = SECTIONS.find((s) => s.id === active)!;

  const copyAll = () => {
    const text = [
      `Asherin Shield · Shutoff steps (${section.label})`,
      ...section.steps.map((s, i) => `${i + 1}. ${s.title}${s.detail ? "\n   " + s.detail : ""}`),
    ].join("\n");
    navigator.clipboard.writeText(text).then(() => toast.success("Steps copied to clipboard"));
  };

  return (
    <div className="space-y-4">
      {/* Quick kill */}
      <div className="rounded-2xl border border-red-400/30 bg-red-400/5 p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-400/40 bg-red-400/10">
              <Power className="h-5 w-5 text-red-300" />
            </div>
            <div>
              <p className="text-sm font-light text-foreground">Emergency Kill Switch</p>
              <p className="text-[11px] font-light text-muted-foreground">Halts the in-browser tunnel, disables all hardening overrides, and stops audit telemetry on this device — instantly.</p>
            </div>
          </div>
          <button
            onClick={() => { onPauseAudit?.(); toast.success("All Asherin Shield browser overrides stopped on this device"); }}
            className="rounded-lg border border-red-400/40 bg-red-400/10 px-4 py-2 text-[11px] font-light tracking-[0.2em] uppercase text-red-200 hover:bg-red-400/20 transition-colors"
          >
            Stop Everything Now
          </button>
        </div>
      </div>

      {/* OS picker */}
      <div className="rounded-2xl border border-border/30 bg-card/30 p-5">
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Cog className="h-4 w-4 text-foreground/70" />
            <h3 className="text-sm font-light tracking-wide">Step-by-step device shutoff</h3>
          </div>
          <button onClick={copyAll} className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors">Copy steps</button>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-light transition-all ${
                active === s.id
                  ? "border-accent/50 bg-accent/15 text-accent"
                  : "border-border/30 bg-background/30 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              {s.icon}
              {s.label}
              {s.id === detected && <span className="ml-1 text-[8px] uppercase tracking-[0.2em] text-emerald-400/70">detected</span>}
            </button>
          ))}
        </div>

        <p className="mb-3 text-[11px] font-light text-muted-foreground">{section.intro}</p>

        <ol className="space-y-2">
          {section.steps.map((s, i) => (
            <li key={i} className="flex gap-3 rounded-xl border border-border/20 bg-background/40 p-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border/40 bg-card/60 text-[10px] font-mono text-foreground/80">{i + 1}</div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-light text-foreground">{s.title}</p>
                {s.detail && <p className="mt-1 text-[11px] font-extralight leading-relaxed text-muted-foreground whitespace-pre-line">{s.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Browser shutoff */}
      <div className="rounded-2xl border border-border/30 bg-card/30 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Wifi className="h-4 w-4 text-foreground/70" />
          <h3 className="text-sm font-light tracking-wide">Browser-level shutoff</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {BROWSER_STEPS.map((b) => (
            <div key={b.id} className="rounded-xl border border-border/20 bg-background/40 p-4">
              <div className="mb-2 flex items-center gap-2">
                {b.icon}
                <p className="text-[12px] font-light text-foreground">{b.label}</p>
              </div>
              <ol className="space-y-2">
                {b.steps.map((s, i) => (
                  <li key={i} className="text-[11px] font-extralight leading-relaxed text-muted-foreground">
                    <span className="text-foreground/85">{i + 1}. {s.title}</span>
                    {s.detail && <div className="mt-0.5">{s.detail}</div>}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShutoffTab;
