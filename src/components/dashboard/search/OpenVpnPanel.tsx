import AureonShield from "@/pages/OpenVpn";

/**
 * OpenVpnPanel — renders the full Aureon Shield / OpenVPN suite directly
 * inside the Zophiel engine in embed mode (no LandingBackground/Header,
 * compact padding) so it lives as a real tab, not a page-takeover.
 */
const OpenVpnPanel = () => (
  <div className="zophiel-gold">
    <AureonShield embed />
  </div>
);

export default OpenVpnPanel;
