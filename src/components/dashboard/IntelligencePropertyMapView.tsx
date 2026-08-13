import IntelligenceMapModule from "@/components/asher/IntelligenceMapModule";

/**
 * asherin.maps
 *
 * The live map room. Included with the $18 asherin plan; the property
 * dossier and the plane / ship layers open on pro.
 *
 * Click any property / land parcel on the map and the open-index reader
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
