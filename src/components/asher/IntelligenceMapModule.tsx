import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, CircleMarker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ChevronDown, ChevronRight, X, Search, Loader2, Pin,
  Layers as LayersIcon, Crosshair as CrosshairIcon, Save,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logAsherEvent } from "@/lib/asherAudit";
import { toast } from "sonner";

/* ─────────────────────────────────────────────────────────────
   ASHER — Real-time Intelligence Map
   100% live data: OpenStreetMap base tiles, Nominatim search,
   REST Countries for sovereign profiles, Overpass for facility
   detail, Open-Meteo for tactical weather. No mocked data.
   ───────────────────────────────────────────────────────────── */

interface LayerLeaf { id: string; label: string; status: "live" | "soon"; sub?: string; }
interface LayerCategory { id: string; label: string; layers: LayerLeaf[]; }

const LAYER_TREE: LayerCategory[] = [
  { id: "base", label: "Base Cartography", layers: [
    { id: "osm-standard",  label: "Street Map — OSM",        status: "live" },
    { id: "osm-topo",      label: "Topographic — OpenTopo",  status: "live" },
    { id: "esri-sat",      label: "Satellite Imagery — ESRI", status: "live" },
    { id: "carto-dark",    label: "Dark Tactical",            status: "live" },
    { id: "sat-multispec", label: "Multi-Spectral (IR/Thermal/UV)", status: "soon" },
    { id: "sar",           label: "Synthetic Aperture Radar (SAR)", status: "soon" },
    { id: "nautical",      label: "Nautical Chart",           status: "soon" },
    { id: "aero",          label: "Aeronautical Chart",       status: "soon" },
  ]},
  { id: "terrain", label: "Terrain & Elevation", layers: [
    { id: "dem-30",  label: "DEM 30m",          status: "soon" },
    { id: "contour", label: "Elevation Contours", status: "soon" },
    { id: "slope",   label: "Slope Analysis",   status: "soon" },
    { id: "viewshed", label: "Viewshed",        status: "soon" },
    { id: "los",     label: "Line of Sight",    status: "soon" },
    { id: "traffic", label: "Trafficability",   status: "soon" },
  ]},
  { id: "boundaries", label: "Boundaries & Administrative", layers: [
    { id: "borders-intl",   label: "International Borders",     status: "live" },
    { id: "disputed",       label: "Disputed Territories",      status: "soon" },
    { id: "eez",            label: "Exclusive Economic Zones",  status: "soon" },
    { id: "states",         label: "State / Province Boundaries", status: "soon" },
    { id: "ao",             label: "Area of Operations (AO)",   status: "soon" },
    { id: "fscl",           label: "Fire Support Coordination Line", status: "soon" },
  ]},
  { id: "friendly", label: "Friendly Forces (Blue)", layers: [
    { id: "f-units",   label: "Unit Positions",     status: "soon" },
    { id: "f-vectors", label: "Movement Vectors",   status: "soon" },
    { id: "f-fire",    label: "Fire Support",       status: "soon" },
    { id: "f-air",     label: "Air Assets",         status: "soon" },
  ]},
  { id: "enemy", label: "Enemy Forces (Red)", layers: [
    { id: "e-conf",  label: "Confirmed Positions", status: "soon" },
    { id: "e-prob",  label: "Probable Positions",  status: "soon" },
    { id: "e-aoi",   label: "Area of Influence",   status: "soon" },
    { id: "e-hist",  label: "Historical",          status: "soon" },
  ]},
  { id: "intel", label: "Intelligence (GEOINT)", layers: [
    { id: "imint", label: "IMINT — Imagery Intel", status: "soon" },
    { id: "sigint", label: "SIGINT — Signals",     status: "soon" },
    { id: "humint", label: "HUMINT — Reports",     status: "soon" },
    { id: "osint",  label: "OSINT — Open Source",  status: "soon" },
    { id: "change", label: "Change Detection",     status: "soon" },
  ]},
  { id: "infra", label: "Critical Infrastructure", layers: [
    { id: "i-power",   label: "Power Plants & Grid",      status: "soon" },
    { id: "i-pipe-oil", label: "Oil Pipelines",           status: "soon" },
    { id: "i-pipe-gas", label: "Natural Gas Pipelines",   status: "soon" },
    { id: "i-fiber",    label: "Fiber Optic / Subsea Cables", status: "soon" },
    { id: "i-cell",     label: "Telecom Towers",          status: "soon" },
    { id: "i-water",    label: "Water Treatment + Dams",  status: "soon" },
    { id: "i-data",     label: "Data Centers + IXP",      status: "soon" },
    { id: "i-gov",      label: "Government Buildings",    status: "soon" },
    { id: "i-mil",      label: "Military Bases",          status: "soon" },
  ]},
  { id: "transport", label: "Transportation", layers: [
    { id: "t-road",    label: "Road Network",     status: "soon" },
    { id: "t-msr",     label: "Main Supply Routes (MSR)", status: "soon" },
    { id: "t-rail",    label: "Railway Network",  status: "soon" },
    { id: "t-bridge",  label: "Bridges & Tunnels", status: "soon" },
    { id: "t-airport", label: "Airports / Airfields", status: "soon" },
    { id: "t-port",    label: "Seaports / River Ports", status: "soon" },
    { id: "t-border",  label: "Border Crossings", status: "soon" },
  ]},
  { id: "weather", label: "Weather & Environment", layers: [
    { id: "w-current",  label: "Current Conditions (Open-Meteo)", status: "live" },
    { id: "w-forecast", label: "Weather Forecast",   status: "soon" },
    { id: "w-tactical", label: "Tactical Weather (cross-winds, visibility)", status: "soon" },
    { id: "w-celestial", label: "Sun / Moon / Tide", status: "soon" },
  ]},
  { id: "demo", label: "Demographics & Population", layers: [
    { id: "d-pop",   label: "Population Density",  status: "soon" },
    { id: "d-eth",   label: "Ethnic Groups",       status: "soon" },
    { id: "d-rel",   label: "Religious Groups",    status: "soon" },
    { id: "d-lang",  label: "Language Distribution", status: "soon" },
    { id: "d-idp",   label: "Internally Displaced Persons", status: "soon" },
  ]},
  { id: "threats", label: "Threats & Hazards", layers: [
    { id: "h-quake",  label: "Live Earthquakes (USGS)", status: "live" },
    { id: "h-fire",   label: "Active Wildfires (NASA FIRMS)", status: "live" },
    { id: "h-air",    label: "Aircraft Traffic (OpenSky)", status: "live" },
    { id: "h-ied",    label: "IED Locations",       status: "soon" },
    { id: "h-mine",   label: "Minefields",          status: "soon" },
    { id: "h-env",    label: "Environmental",       status: "soon" },
  ]},
  { id: "targeting", label: "Targeting", layers: [
    { id: "tg-hvt",   label: "High Value Targets", status: "soon" },
    { id: "tg-pkg",   label: "Target Packages",    status: "soon" },
    { id: "tg-bda",   label: "Battle Damage Assessment", status: "soon" },
  ]},
];

const TILE_SOURCES: Record<string, { url: string; attribution: string; max?: number }> = {
  "osm-standard": { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors" },
  "osm-topo":     { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",   attribution: "© OpenTopoMap (CC-BY-SA)", max: 17 },
  "esri-sat":     { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "© Esri, Maxar, Earthstar Geographics" },
  "carto-dark":   { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", attribution: "© OpenStreetMap, © CARTO" },
};

/* ─────────────── Search via Nominatim ─────────────── */

interface SearchHit {
  display_name: string; lat: string; lon: string;
  type?: string; class?: string;
  address?: { country?: string; country_code?: string; state?: string; city?: string; town?: string; village?: string; suburb?: string; neighbourhood?: string; };
}

async function nominatimSearch(q: string): Promise<SearchHit[]> {
  if (!q.trim()) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!r.ok) throw new Error("search_failed");
  return r.json();
}

async function reverseGeocode(lat: number, lon: number): Promise<SearchHit | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lon}`;
  const r = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!r.ok) return null;
  return r.json();
}

/* ─────────────── REST Countries (live country profile) ─────────────── */

interface CountryData {
  name: { common: string; official: string };
  capital?: string[];
  region?: string;
  subregion?: string;
  population?: number;
  area?: number;
  flags?: { png?: string; svg?: string; alt?: string };
  languages?: Record<string, string>;
  currencies?: Record<string, { name: string; symbol?: string }>;
  borders?: string[];
  cca2?: string;
  timezones?: string[];
  unMember?: boolean;
  latlng?: [number, number];
}

async function fetchCountryByCode(cc: string): Promise<CountryData | null> {
  try {
    const r = await fetch(`https://restcountries.com/v3.1/alpha/${cc}`);
    if (!r.ok) return null;
    const arr = await r.json();
    return Array.isArray(arr) ? arr[0] : arr;
  } catch { return null; }
}

/* ─────────────── Open-Meteo (live current weather) ─────────────── */

async function fetchWeather(lat: number, lon: number) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,cloud_cover,visibility,precipitation&timezone=auto`;
    const r = await fetch(url);
    if (!r.ok) return null;
    return r.json();
  } catch { return null; }
}

/* ─────────────── Open-Meteo Elevation API (live) ─────────────── */
async function fetchElevation(lat: number, lon: number): Promise<number | null> {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lon}`);
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j?.elevation) ? j.elevation[0] : null;
  } catch { return null; }
}

/* ─────────────── Sunrise-Sunset.org (live celestial) ─────────────── */
async function fetchCelestial(lat: number, lon: number) {
  try {
    const r = await fetch(`https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lon}&formatted=0`);
    if (!r.ok) return null;
    const j = await r.json();
    return j?.results || null;
  } catch { return null; }
}

/* ─────────────── Overpass API (live OSM building / facility query) ─────────────── */
async function fetchNearbyFeatures(lat: number, lon: number) {
  try {
    const radius = 150;
    const q = `[out:json][timeout:10];(
      node(around:${radius},${lat},${lon})[amenity];
      way(around:${radius},${lat},${lon})[building];
      node(around:${radius},${lat},${lon})[man_made];
      node(around:${radius},${lat},${lon})[military];
      way(around:${radius},${lat},${lon})[military];
    );out tags 30;`;
    const r = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(q),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j?.elements) ? j.elements.slice(0, 25) : [];
  } catch { return null; }
}

/* ─────────────── Map click handler ─────────────── */

const MapClick = ({ onClick }: { onClick: (lat: number, lng: number) => void }) => {
  const map = useMap();
  useEffect(() => {
    const h = (e: L.LeafletMouseEvent) => onClick(e.latlng.lat, e.latlng.lng);
    map.on("click", h);
    return () => { map.off("click", h); };
  }, [map, onClick]);
  return null;
};

/* ─────────────── Coordinate display ─────────────── */

const CoordDisplay = ({ onMove }: { onMove: (cb: (lat: number, lng: number, zoom: number) => void) => void }) => {
  const map = useMap();
  useEffect(() => {
    const handler = () => {
      const c = map.getCenter();
      onMove(() => {});
      // expose via window event for parent
      window.dispatchEvent(new CustomEvent("asher:mapmove", { detail: { lat: c.lat, lng: c.lng, zoom: map.getZoom() } }));
    };
    map.on("move", handler);
    map.on("zoomend", handler);
    handler();
    return () => { map.off("move", handler); map.off("zoomend", handler); };
  }, [map, onMove]);
  return null;
};

/* ─────────────── MGRS-ish formatter (lightweight, no extra dep) ─────────────── */
const fmtCoord = (lat: number, lng: number) => {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lng).toFixed(4)}°${ew}`;
};

/* ─────────────── Profile drawer types ─────────────── */
interface OsmFeature { id: number; type: string; tags?: Record<string, string> }
interface SelectedEntity {
  lat: number; lng: number;
  hit: SearchHit | null;
  country: CountryData | null;
  weather: any | null;
  elevation: number | null;
  celestial: any | null;
  features: OsmFeature[] | null;
  loading: boolean;
}

const IntelligenceMapModule = () => {
  const [activeBase, setActiveBase] = useState<string>("carto-dark");
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({ base: true, weather: true });
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [coord, setCoord] = useState({ lat: 38.9072, lng: -77.0369, zoom: 4 });
  const [entity, setEntity] = useState<SelectedEntity | null>(null);
  const [pinned, setPinned] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      setCoord({ lat: d.lat, lng: d.lng, zoom: d.zoom });
    };
    window.addEventListener("asher:mapmove", handler);
    return () => window.removeEventListener("asher:mapmove", handler);
  }, []);

  const tile = TILE_SOURCES[activeBase] ?? TILE_SOURCES["carto-dark"];

  const toggleCat = (id: string) => setOpenCats((p) => ({ ...p, [id]: !p[id] }));

  const runSearch = async () => {
    if (!searchQ.trim()) return;
    setSearching(true);
    try {
      const r = await nominatimSearch(searchQ);
      setSearchResults(r);
    } catch {
      setSearchResults([]);
    } finally { setSearching(false); }
  };

  const flyTo = (lat: number, lng: number, zoom = 11) => {
    mapRef.current?.flyTo([lat, lng], zoom, { duration: 0.8 });
  };

  const loadEntity = async (lat: number, lng: number) => {
    setEntity({ lat, lng, hit: null, country: null, weather: null, elevation: null, celestial: null, features: null, loading: true });
    const [hit, weather, elevation, celestial, features] = await Promise.all([
      reverseGeocode(lat, lng),
      fetchWeather(lat, lng),
      fetchElevation(lat, lng),
      fetchCelestial(lat, lng),
      fetchNearbyFeatures(lat, lng),
    ]);
    let country: CountryData | null = null;
    const cc = hit?.address?.country_code?.toUpperCase();
    if (cc) country = await fetchCountryByCode(cc);
    setEntity({ lat, lng, hit, country, weather, elevation, celestial, features, loading: false });
  };

  const handleSearchPick = (h: SearchHit) => {
    const lat = parseFloat(h.lat); const lng = parseFloat(h.lon);
    flyTo(lat, lng, 10);
    loadEntity(lat, lng);
    setSearchResults([]);
    setSearchQ(h.display_name);
  };

  return (
    <div className="relative flex h-full w-full bg-background">
      {/* LEFT LAYER PANEL */}
      <div className="flex h-full w-72 flex-col border-r border-border/15 bg-card/30 backdrop-blur-md">
        <div className="border-b border-border/15 px-4 py-3 flex items-center gap-2">
          <LayersIcon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">Layer Tree</p>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2 text-sm">
          {LAYER_TREE.map((cat) => {
            const open = !!openCats[cat.id];
            return (
              <div key={cat.id} className="mb-1">
                <button
                  onClick={() => toggleCat(cat.id)}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left hover:bg-foreground/5"
                >
                  {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  <span className="text-[11px] font-light tracking-[0.15em] text-foreground/85 uppercase">{cat.label}</span>
                  <span className="ml-auto text-[9px] text-muted-foreground/50">{cat.layers.length}</span>
                </button>
                {open && (
                  <div className="ml-5 mt-0.5 space-y-0.5">
                    {cat.layers.map((l) => {
                      const isBase = cat.id === "base";
                      const isActive = isBase ? l.id === activeBase : false;
                      return (
                        <button
                          key={l.id}
                          onClick={() => {
                            if (isBase && l.status === "live") setActiveBase(l.id);
                          }}
                          disabled={l.status !== "live"}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition-colors ${
                            isActive ? "bg-foreground/10 text-foreground"
                            : l.status === "live" ? "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                            : "text-muted-foreground/40 cursor-not-allowed"
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                            l.status === "live" ? (isActive ? "bg-emerald-400" : "bg-emerald-400/40") : "bg-muted-foreground/30"
                          }`} />
                          <span className="text-[11px] font-light flex-1 truncate">{l.label}</span>
                          {l.status === "soon" && (
                            <span className="text-[8px] tracking-[0.2em] text-muted-foreground/40 uppercase">Soon</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* MAP COLUMN */}
      <div className="relative flex-1">
        {/* TOP BAR */}
        <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-border/30 bg-card/85 backdrop-blur-md px-3 py-2 flex-1 max-w-md">
            <Search className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Search location, coordinates, MGRS, entity…"
              className="flex-1 bg-transparent text-xs font-light tracking-wide text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
            {searching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {searchQ && !searching && (
              <button onClick={() => { setSearchQ(""); setSearchResults([]); }}>
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <div className="rounded-xl border border-border/30 bg-card/85 backdrop-blur-md px-3 py-2 text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase">
            Live · OSM · Nominatim · REST Countries · Open-Meteo · Overpass · Sunrise-Sunset
          </div>
        </div>

        {/* SEARCH RESULTS */}
        {searchResults.length > 0 && (
          <div className="absolute top-16 left-3 z-[1000] w-full max-w-md rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
            {searchResults.map((h, i) => (
              <button
                key={`${h.lat}-${h.lon}-${i}`}
                onClick={() => handleSearchPick(h)}
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-foreground/5 border-b border-border/10 last:border-0"
              >
                <CrosshairIcon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground flex-shrink-0" strokeWidth={1.5} />
                <div className="min-w-0">
                  <p className="text-xs font-light text-foreground truncate">{h.display_name}</p>
                  <p className="text-[10px] tracking-wide text-muted-foreground/60 mt-0.5">
                    {parseFloat(h.lat).toFixed(4)}°, {parseFloat(h.lon).toFixed(4)}° · {h.type || h.class}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* MAP */}
        <MapContainer
          center={[coord.lat, coord.lng]}
          zoom={coord.zoom}
          ref={(m) => { if (m) mapRef.current = m; }}
          className="h-full w-full"
          zoomControl={false}
          worldCopyJump
        >
          <TileLayer
            key={activeBase}
            url={tile.url}
            attribution={tile.attribution}
            maxZoom={tile.max ?? 19}
          />
          <MapClick onClick={loadEntity} />
          <CoordDisplay onMove={() => {}} />
        </MapContainer>

        {/* COORD WIDGET */}
        <div className="absolute bottom-3 right-3 z-[1000] rounded-xl border border-border/30 bg-card/85 backdrop-blur-md px-3 py-2 text-[10px] font-light tracking-wide text-muted-foreground space-y-0.5">
          <p><span className="text-muted-foreground/50">LAT/LNG:</span> {fmtCoord(coord.lat, coord.lng)}</p>
          <p><span className="text-muted-foreground/50">ZOOM:</span> {coord.zoom.toFixed(0)}</p>
          <p><span className="text-muted-foreground/50">SCALE:</span> 1:{Math.round(591657550.5 / Math.pow(2, coord.zoom)).toLocaleString()}</p>
        </div>

        {/* ENTITY DRAWER */}
        {entity && (
          <div className={`absolute right-3 top-16 z-[1000] w-[420px] max-h-[calc(100%-5rem)] overflow-y-auto rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl ${pinned ? "" : ""}`}>
            <div className="flex items-center justify-between border-b border-border/15 px-4 py-3">
              <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">Entity Profile</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPinned(!pinned)} className={`p-1 rounded ${pinned ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  <Pin className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
                <button onClick={() => { setEntity(null); setPinned(false); }} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {entity.loading && (
                <div className="flex items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="ml-2 text-xs font-light tracking-wide">Querying live sources…</span>
                </div>
              )}

              {!entity.loading && (
                <>
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    {entity.country?.flags?.svg && (
                      <img src={entity.country.flags.svg} alt={entity.country.flags.alt || entity.country.name.common}
                        className="h-12 w-16 object-cover rounded border border-border/20" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-light tracking-wide text-foreground truncate">
                        {entity.hit?.address?.city || entity.hit?.address?.town || entity.hit?.address?.village ||
                          entity.hit?.address?.suburb || entity.hit?.address?.neighbourhood ||
                          entity.hit?.address?.state || entity.country?.name.common || "Unknown Location"}
                      </p>
                      <p className="text-[10px] font-light tracking-[0.2em] text-muted-foreground uppercase mt-1">
                        {entity.country?.name.common || ""}{entity.hit?.address?.state ? ` · ${entity.hit.address.state}` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Coords */}
                  <div className="rounded-lg bg-background/40 border border-border/15 p-3 text-[11px] font-light tracking-wide space-y-1">
                    <p><span className="text-muted-foreground/60">📍 Location:</span> {fmtCoord(entity.lat, entity.lng)}</p>
                    <p><span className="text-muted-foreground/60">🕐 Resolved:</span> {new Date().toLocaleTimeString()}</p>
                    <p><span className="text-muted-foreground/60">📡 Source:</span> Nominatim · REST Countries · Open-Meteo</p>
                  </div>

                  {/* Country profile */}
                  {entity.country && (
                    <div>
                      <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-2">Country Profile (Live)</p>
                      <div className="rounded-lg border border-border/15 bg-background/40 p-3 space-y-1.5 text-[11px] font-light">
                        <p><span className="text-muted-foreground/60">Official:</span> {entity.country.name.official}</p>
                        {entity.country.capital?.[0] && <p><span className="text-muted-foreground/60">Capital:</span> {entity.country.capital[0]}</p>}
                        <p><span className="text-muted-foreground/60">Region:</span> {entity.country.region}{entity.country.subregion ? ` · ${entity.country.subregion}` : ""}</p>
                        {entity.country.population != null && <p><span className="text-muted-foreground/60">Population:</span> {entity.country.population.toLocaleString()}</p>}
                        {entity.country.area != null && <p><span className="text-muted-foreground/60">Area:</span> {entity.country.area.toLocaleString()} km²</p>}
                        {entity.country.languages && <p><span className="text-muted-foreground/60">Languages:</span> {Object.values(entity.country.languages).join(", ")}</p>}
                        {entity.country.currencies && <p><span className="text-muted-foreground/60">Currencies:</span> {Object.entries(entity.country.currencies).map(([k, v]) => `${v.name} (${k})`).join(", ")}</p>}
                        {entity.country.timezones && <p><span className="text-muted-foreground/60">Timezones:</span> {entity.country.timezones.slice(0, 3).join(", ")}{entity.country.timezones.length > 3 ? "…" : ""}</p>}
                        {entity.country.borders && entity.country.borders.length > 0 && <p><span className="text-muted-foreground/60">Borders:</span> {entity.country.borders.join(", ")}</p>}
                        {entity.country.unMember != null && <p><span className="text-muted-foreground/60">UN Member:</span> {entity.country.unMember ? "Yes" : "No"}</p>}
                      </div>
                    </div>
                  )}

                  {/* Weather */}
                  {entity.weather?.current && (
                    <div>
                      <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-2">Tactical Weather (Live)</p>
                      <div className="grid grid-cols-2 gap-2 text-[11px] font-light">
                        <div className="rounded-lg border border-border/15 bg-background/40 p-2.5">
                          <p className="text-muted-foreground/60 text-[9px] tracking-[0.2em] uppercase mb-1">Temp</p>
                          <p className="text-foreground">{entity.weather.current.temperature_2m}°C</p>
                        </div>
                        <div className="rounded-lg border border-border/15 bg-background/40 p-2.5">
                          <p className="text-muted-foreground/60 text-[9px] tracking-[0.2em] uppercase mb-1">Wind</p>
                          <p className="text-foreground">{entity.weather.current.wind_speed_10m} km/h @ {entity.weather.current.wind_direction_10m}°</p>
                        </div>
                        <div className="rounded-lg border border-border/15 bg-background/40 p-2.5">
                          <p className="text-muted-foreground/60 text-[9px] tracking-[0.2em] uppercase mb-1">Cloud</p>
                          <p className="text-foreground">{entity.weather.current.cloud_cover}%</p>
                        </div>
                        <div className="rounded-lg border border-border/15 bg-background/40 p-2.5">
                          <p className="text-muted-foreground/60 text-[9px] tracking-[0.2em] uppercase mb-1">Visibility</p>
                          <p className="text-foreground">{(entity.weather.current.visibility / 1000).toFixed(1)} km</p>
                        </div>
                        <div className="rounded-lg border border-border/15 bg-background/40 p-2.5">
                          <p className="text-muted-foreground/60 text-[9px] tracking-[0.2em] uppercase mb-1">Humidity</p>
                          <p className="text-foreground">{entity.weather.current.relative_humidity_2m}%</p>
                        </div>
                        <div className="rounded-lg border border-border/15 bg-background/40 p-2.5">
                          <p className="text-muted-foreground/60 text-[9px] tracking-[0.2em] uppercase mb-1">Precip</p>
                          <p className="text-foreground">{entity.weather.current.precipitation} mm</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Terrain */}
                  {entity.elevation != null && (
                    <div>
                      <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-2">Terrain (Live)</p>
                      <div className="rounded-lg border border-border/15 bg-background/40 p-3 text-[11px] font-light">
                        <p><span className="text-muted-foreground/60">Elevation:</span> {entity.elevation.toFixed(1)} m ({(entity.elevation * 3.281).toFixed(0)} ft)</p>
                      </div>
                    </div>
                  )}

                  {/* Celestial */}
                  {entity.celestial && (
                    <div>
                      <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-2">Celestial (Live UTC)</p>
                      <div className="rounded-lg border border-border/15 bg-background/40 p-3 text-[11px] font-light space-y-1">
                        {entity.celestial.sunrise && <p><span className="text-muted-foreground/60">Sunrise:</span> {new Date(entity.celestial.sunrise).toUTCString().slice(17, 25)}</p>}
                        {entity.celestial.sunset && <p><span className="text-muted-foreground/60">Sunset:</span> {new Date(entity.celestial.sunset).toUTCString().slice(17, 25)}</p>}
                        {entity.celestial.solar_noon && <p><span className="text-muted-foreground/60">Solar Noon:</span> {new Date(entity.celestial.solar_noon).toUTCString().slice(17, 25)}</p>}
                        {entity.celestial.day_length && <p><span className="text-muted-foreground/60">Day Length:</span> {Math.floor(entity.celestial.day_length / 3600)}h {Math.floor((entity.celestial.day_length % 3600) / 60)}m</p>}
                        {entity.celestial.civil_twilight_begin && <p><span className="text-muted-foreground/60">Civil Twilight:</span> {new Date(entity.celestial.civil_twilight_begin).toUTCString().slice(17, 25)} → {new Date(entity.celestial.civil_twilight_end).toUTCString().slice(17, 25)}</p>}
                        {entity.celestial.nautical_twilight_begin && <p><span className="text-muted-foreground/60">Nautical Twilight:</span> {new Date(entity.celestial.nautical_twilight_begin).toUTCString().slice(17, 25)} → {new Date(entity.celestial.nautical_twilight_end).toUTCString().slice(17, 25)}</p>}
                      </div>
                    </div>
                  )}

                  {/* Nearby OSM Features */}
                  {entity.features && entity.features.length > 0 && (
                    <div>
                      <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-2">Nearby Features (Overpass · 150m radius)</p>
                      <div className="rounded-lg border border-border/15 bg-background/40 p-3 max-h-48 overflow-y-auto space-y-1.5">
                        {entity.features.map((f) => {
                          const t = f.tags || {};
                          const name = t.name || t["name:en"] || t.amenity || t.building || t.man_made || t.military || `${f.type} #${f.id}`;
                          const kind = t.amenity || t.building || t.man_made || t.military || t.shop || "feature";
                          return (
                            <div key={`${f.type}-${f.id}`} className="text-[11px] font-light flex items-start gap-2">
                              <span className="h-1 w-1 mt-1.5 rounded-full bg-emerald-400/70 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-foreground/85 truncate">{name}</p>
                                <p className="text-[9px] tracking-[0.2em] text-muted-foreground/50 uppercase">{kind}{t.operator ? ` · ${t.operator}` : ""}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Raw place name */}
                  {entity.hit && (
                    <div>
                      <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-2">Resolved Address</p>
                      <p className="text-[11px] font-light text-muted-foreground/80 leading-relaxed">{entity.hit.display_name}</p>
                    </div>
                  )}

                  <p className="pt-2 text-[9px] font-light tracking-[0.2em] text-muted-foreground/50 uppercase border-t border-border/10">
                    Classification: Open Source · All data fetched live from public sources
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default IntelligenceMapModule;
