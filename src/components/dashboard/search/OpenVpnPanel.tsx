import AsherinShield from "@/components/asherin-shield/OpenVpn";

/**
 * OpenVpnPanel — renders the full Asherin Shield / OpenVPN suite directly
 * inside the Zophiel engine in embed mode (no LandingBackground/Header,
 * compact padding) so it lives as a real tab, not a page-takeover.
 */
const OpenVpnPanel = () => (
  <div className="zophiel-gold">
    <AsherinShield embed />
  </div>
);

export default OpenVpnPanel;
