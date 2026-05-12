import AureonShield from "@/pages/OpenVpn";

/**
 * OpenVpnPanel — renders the full Aureon Shield / OpenVPN suite directly
 * inside the Zophiel engine (no iframe). All tabs (Layers, Hardening,
 * Trackers, Storage, Extensions, DoH, Network, Device, Privacy, Location,
 * Breach, Tunnel, Threats, Native VPN, Shutoff, Relay & Canary) are live
 * in-process so state, theme, and routing stay native.
 */
const OpenVpnPanel = () => (
  <div className="zophiel-gold -mx-3 sm:-mx-6">
    <AureonShield />
  </div>
);

export default OpenVpnPanel;
