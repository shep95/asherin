import { ExternalLink, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * OpenVpnPanel — embeds the full Aureon Shield / OpenVPN suite as a Zophiel tab.
 * Renders the live /openvpn route inside a same-origin iframe so every feature
 * (Layers, Hardening, Trackers, Storage, Extensions, DoH, Network, Device,
 * Privacy, Location, Breach, Tunnel, Threats, Native VPN, Shutoff) is available
 * without duplicating 800+ lines of audit code.
 */
const OpenVpnPanel = () => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-4 w-4 text-accent" strokeWidth={1.5} />
          <div>
            <p className="text-[12px] font-light text-foreground">Aureon Shield · OpenVPN Suite</p>
            <p className="text-[10px] font-extralight text-muted-foreground">
              Full device + browser audit, leak detection, hardening, fingerprint spoofing, breach checks, native VPN — live, free, no installs.
            </p>
          </div>
        </div>
        <Link
          to="/openvpn"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border/40 bg-card/50 px-2.5 py-1.5 text-[10px] font-light tracking-[0.2em] uppercase text-foreground/80 hover:text-foreground hover:bg-card/80 transition-colors"
        >
          Pop out <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <div className="rounded-2xl border border-border/30 bg-card/20 overflow-hidden">
        <iframe
          src="/openvpn?embed=1"
          title="Aureon Shield · OpenVPN"
          className="w-full h-[calc(100vh-16rem)] min-h-[640px] bg-background"
          loading="lazy"
        />
      </div>
    </div>
  );
};

export default OpenVpnPanel;
