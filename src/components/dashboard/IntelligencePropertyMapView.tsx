import IntelligenceMapModule from "@/components/asher/IntelligenceMapModule";

/**
 * ASHERIN PRO — Intelligence Property Map
 *
 * Brings the Asher Dashboard real-time intelligence map into the Aureon
 * dashboard for the Maximum Intelligence (Pro) subscription tier.
 *
 * Click any property / land parcel on the map and the Zophiel engine
 * (via the `asher-property-intel` edge function) scrapes live web
 * intelligence — ownership, valuation, history, risk signals — and
 * displays it inside the property intel panel.
 *
 * 100% live data: OSM base tiles, Nominatim search, Overpass parcel
 * detail, Open-Meteo tactical weather, Zophiel OSINT enrichment.
 */
const IntelligencePropertyMapView = () => {
  return (
    <div className="h-full w-full">
      <IntelligenceMapModule />
    </div>
  );
};

export default IntelligencePropertyMapView;
