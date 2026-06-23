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
import AsherAIPanel, { type MapAction } from "@/components/asher/AsherAIPanel";
import LiveFeedsPanel from "@/components/asher/LiveFeedsPanel";
import Property3DPanel from "@/components/asher/Property3DPanel";
import PropertyInteriorPanel from "@/components/asher/PropertyInteriorPanel";
import { Video, Globe2, ExternalLink, RefreshCw, Building2, User, Hash, CalendarDays, Ruler, DollarSign, Users as UsersIcon, History, AlertTriangle, Activity, Radio } from "lucide-react";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";

/* ─────────────────────────────────────────────────────────────
   ASHER — Real-time Intelligence Map
   100% live data: OpenStreetMap base tiles, Nominatim search,
   REST Countries for sovereign profiles, Overpass for facility
   detail, Open-Meteo for live weather. No mocked data.
   ───────────────────────────────────────────────────────────── */

interface LayerLeaf { id: string; label: string; status: "live" | "soon"; sub?: string; }
interface LayerCategory { id: string; label: string; layers: LayerLeaf[]; }

const LAYER_TREE: LayerCategory[] = [
  { id: "base", label: "Base Cartography", layers: [
    { id: "osm-standard",  label: "Street Map — OSM",        status: "live" },
    { id: "osm-topo",      label: "Topographic — OpenTopo",  status: "live" },
    { id: "esri-sat",      label: "Satellite Imagery — ESRI", status: "live" },
    { id: "carto-dark",    label: "Dark Mode",                status: "live" },
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
  ]},
  { id: "boundaries", label: "Boundaries & Administrative", layers: [
    { id: "borders-intl",   label: "International Borders",     status: "live" },
    { id: "disputed",       label: "Disputed Territories",      status: "soon" },
    { id: "eez",            label: "Exclusive Economic Zones",  status: "soon" },
    { id: "states",         label: "State / Province Boundaries", status: "soon" },
  ]},
  { id: "intel", label: "Open-Source Intelligence", layers: [
    { id: "osint",  label: "OSINT — Open Source Reports", status: "soon" },
    { id: "change", label: "Change Detection",            status: "soon" },
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
  ]},
  { id: "transport", label: "Transportation", layers: [
    { id: "t-road",    label: "Road Network",     status: "soon" },
    { id: "t-rail",    label: "Railway Network",  status: "soon" },
    { id: "t-bridge",  label: "Bridges & Tunnels", status: "soon" },
    { id: "t-airport", label: "Airports / Airfields", status: "soon" },
    { id: "t-port",    label: "Seaports / River Ports", status: "soon" },
    { id: "t-border",  label: "Border Crossings", status: "soon" },
  ]},
  { id: "weather", label: "Weather & Environment", layers: [
    { id: "w-current",  label: "Current Conditions (Open-Meteo)", status: "live" },
    { id: "w-forecast", label: "Weather Forecast",   status: "soon" },
    { id: "w-celestial", label: "Sun / Moon / Tide", status: "soon" },
  ]},
  { id: "demo", label: "Demographics & Population", layers: [
    { id: "d-pop",   label: "Population Density",  status: "soon" },
    { id: "d-eth",   label: "Ethnic Groups",       status: "soon" },
    { id: "d-rel",   label: "Religious Groups",    status: "soon" },
    { id: "d-lang",  label: "Language Distribution", status: "soon" },
  ]},
  { id: "threats", label: "Natural Hazards", layers: [
    { id: "h-quake",  label: "Live Earthquakes (USGS)", status: "live" },
    { id: "h-fire",   label: "Active Wildfires (NASA FIRMS)", status: "live" },
    { id: "h-air",    label: "Aircraft Traffic (OpenSky)", status: "live" },
    { id: "h-env",    label: "Environmental",       status: "soon" },
  ]},
];

const TILE_SOURCES: Record<string, { url: string; attribution: string; max?: number }> = {
  "osm-standard": { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap contributors" },
  "osm-topo":     { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",   attribution: "© OpenTopoMap (CC-BY-SA)", max: 17 },
  "esri-sat":     { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "© Esri, Maxar, Earthstar Geographics" },
  "carto-dark":   { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", attribution: "© OpenStreetMap, © CARTO" },
};

const TACTICAL_BORDER_OVERLAY = {
  url: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap, © CARTO",
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
    const radius = 250;
    const q = `[out:json][timeout:15];(
      node(around:${radius},${lat},${lon})[amenity];
      way(around:${radius},${lat},${lon})[amenity];
      way(around:${radius},${lat},${lon})[building];
      way(around:${radius},${lat},${lon})[landuse];
      way(around:${radius},${lat},${lon})[natural];
      way(around:${radius},${lat},${lon})[leisure];
      node(around:${radius},${lat},${lon})[man_made];
      way(around:${radius},${lat},${lon})[man_made];
      node(around:${radius},${lat},${lon})[shop];
      way(around:${radius},${lat},${lon})[power];
      node(around:${radius},${lat},${lon})[power];
      way(around:${radius},${lat},${lon})[highway];
      way(around:${radius},${lat},${lon})[railway];
      node(around:${radius},${lat},${lon})[shop];
      way(around:${radius},${lat},${lon})[waterway];
    );out tags center 80;`;
    const r = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(q),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j?.elements) ? j.elements.slice(0, 80) : [];
  } catch { return null; }
}

/* ─────────────── Wikipedia GeoSearch (live nearby articles) ─────────────── */
async function fetchWikipediaNearby(lat: number, lon: number) {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=2000&gslimit=10&format=json&origin=*`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    return j?.query?.geosearch || [];
  } catch { return []; }
}

/* ─────────────── MGRS-ish & UTM derivation (no external dep) ─────────────── */
function toUTM(lat: number, lon: number): { zone: number; band: string; easting: number; northing: number } {
  const a = 6378137, f = 1 / 298.257223563;
  const k0 = 0.9996, e = Math.sqrt(f * (2 - f)), e2 = e * e;
  const zone = Math.floor((lon + 180) / 6) + 1;
  const lonOrigin = (zone - 1) * 6 - 180 + 3;
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const lonOriginRad = (lonOrigin * Math.PI) / 180;
  const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) ** 2);
  const T = Math.tan(latRad) ** 2;
  const C = (e2 / (1 - e2)) * Math.cos(latRad) ** 2;
  const A = Math.cos(latRad) * (lonRad - lonOriginRad);
  const M = a * ((1 - e2 / 4 - (3 * e2 ** 2) / 64) * latRad
    - ((3 * e2) / 8 + (3 * e2 ** 2) / 32) * Math.sin(2 * latRad)
    + ((15 * e2 ** 2) / 256) * Math.sin(4 * latRad));
  const easting = k0 * N * (A + ((1 - T + C) * A ** 3) / 6
    + ((5 - 18 * T + T ** 2 + 72 * C - 58 * (e2 / (1 - e2))) * A ** 5) / 120) + 500000;
  let northing = k0 * (M + N * Math.tan(latRad) * (A ** 2 / 2
    + ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24
    + ((61 - 58 * T + T ** 2 + 600 * C - 330 * (e2 / (1 - e2))) * A ** 6) / 720));
  if (lat < 0) northing += 10000000;
  const bands = "CDEFGHJKLMNPQRSTUVWX";
  const bIdx = Math.max(0, Math.min(19, Math.floor((lat + 80) / 8)));
  return { zone, band: bands[bIdx], easting: Math.round(easting), northing: Math.round(northing) };
}
function toMGRS(lat: number, lon: number): string {
  const u = toUTM(lat, lon);
  const e100k = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const n100k = "ABCDEFGHJKLMNPQRSTUV";
  const setIdx = (u.zone - 1) % 6;
  const eCol = Math.floor(u.easting / 100000);
  const nRow = Math.floor(u.northing / 100000) % 20;
  const eLetters = ["ABCDEFGH", "JKLMNPQR", "STUVWXYZ", "ABCDEFGH", "JKLMNPQR", "STUVWXYZ"];
  const nLetters = ["ABCDEFGHJKLMNPQRSTUV", "FGHJKLMNPQRSTUVABCDE"];
  const eL = eLetters[setIdx][(eCol - 1 + 8) % 8] || "A";
  const nL = nLetters[setIdx % 2][nRow] || "A";
  const e5 = String(u.easting % 100000).padStart(5, "0");
  const n5 = String(u.northing % 100000).padStart(5, "0");
  return `${u.zone}${u.band} ${eL}${nL} ${e5} ${n5}`;
  void e100k; void n100k;
}

/* ─────────────── Land-use classifier (from Overpass tags) ─────────────── */
type ClickClass = "building" | "residential" | "commercial" | "industrial" | "agricultural" | "vacant" | "infrastructure" | "transport" | "natural" | "water" | "unknown";
function classifyClick(features: any[] | null): { primary: any | null; cls: ClickClass } {
  if (!features?.length) return { primary: null, cls: "unknown" };
  const ranked = [...features].sort((a, b) => {
    const score = (f: any) => {
      const t = f.tags || {};
      if (t.building) return 80;
      if (t.amenity) return 70;
      if (t.man_made) return 60;
      if (t.power) return 55;
      if (t.landuse) return 40;
      if (t.shop) return 35;
      if (t.leisure) return 25;
      if (t.natural) return 20;
      if (t.highway || t.railway || t.waterway) return 15;
      return 5;
    };
    return score(b) - score(a);
  });
  const p = ranked[0];
  const t = p?.tags || {};
  let cls: ClickClass = "unknown";
  if (t.building === "residential" || t.building === "house" || t.building === "apartments" || t.landuse === "residential") cls = "residential";
  else if (t.building === "commercial" || t.building === "retail" || t.building === "office" || t.amenity || t.shop || t.landuse === "commercial" || t.landuse === "retail") cls = "commercial";
  else if (t.building === "industrial" || t.landuse === "industrial" || t.man_made) cls = "industrial";
  else if (t.landuse === "farmland" || t.landuse === "farm" || t.landuse === "orchard" || t.landuse === "vineyard" || t.landuse === "meadow") cls = "agricultural";
  else if (t.landuse === "brownfield" || t.landuse === "greenfield" || t.landuse === "construction") cls = "vacant";
  else if (t.power) cls = "infrastructure";
  else if (t.highway || t.railway) cls = "transport";
  else if (t.natural) cls = "natural";
  else if (t.waterway || t.natural === "water") cls = "water";
  else if (t.building) cls = "building";
  return { primary: p, cls };
}

/* ─────────────── Threat overlay fetchers (live) ─────────────── */
interface ThreatPoint { lat: number; lng: number; label: string; meta?: string; severity?: number }

async function fetchEarthquakes(): Promise<ThreatPoint[]> {
  try {
    // USGS — past 24h, magnitude 2.5+
    const r = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson");
    if (!r.ok) return [];
    const j = await r.json();
    return (j.features || []).map((f: any) => ({
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      label: f.properties.title || `M${f.properties.mag}`,
      meta: `Depth ${f.geometry.coordinates[2]}km · ${new Date(f.properties.time).toUTCString()}`,
      severity: f.properties.mag,
    }));
  } catch { return []; }
}

async function fetchAircraft(bounds: L.LatLngBounds): Promise<ThreatPoint[]> {
  try {
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const url = `https://opensky-network.org/api/states/all?lamin=${sw.lat}&lomin=${sw.lng}&lamax=${ne.lat}&lomax=${ne.lng}`;
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    return (j.states || []).filter((s: any[]) => s[5] != null && s[6] != null).slice(0, 200).map((s: any[]) => ({
      lat: s[6], lng: s[5],
      label: (s[1] || s[0] || "Aircraft").trim(),
      meta: `Origin ${s[2] || "?"} · Alt ${s[7] ? Math.round(s[7]) + "m" : "?"} · Vel ${s[9] ? Math.round(s[9]) + "m/s" : "?"}`,
    }));
  } catch { return []; }
}

async function fetchWildfires(bounds: L.LatLngBounds): Promise<ThreatPoint[]> {
  try {
    // NASA FIRMS public CSV (VIIRS_SNPP_NRT, last 24h, global). Filter by bounds client-side.
    const r = await fetch("https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv");
    if (!r.ok) return [];
    const text = await r.text();
    const lines = text.split("\n").slice(1, 8000);
    const sw = bounds.getSouthWest(); const ne = bounds.getNorthEast();
    const out: ThreatPoint[] = [];
    for (const ln of lines) {
      const cols = ln.split(",");
      if (cols.length < 4) continue;
      const lat = parseFloat(cols[0]); const lng = parseFloat(cols[1]);
      if (isNaN(lat) || isNaN(lng)) continue;
      if (lat < sw.lat || lat > ne.lat || lng < sw.lng || lng > ne.lng) continue;
      out.push({ lat, lng, label: `Hotspot · ${cols[2]}K`, meta: `${cols[5]} ${cols[6]} UTC · conf ${cols[8]}`, severity: parseFloat(cols[2]) });
      if (out.length >= 300) break;
    }
    return out;
  } catch { return []; }
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

const CoordDisplay = () => {
  const map = useMap();
  useEffect(() => {
    const handler = () => {
      const c = map.getCenter();
      // expose via window event for parent
      window.dispatchEvent(new CustomEvent("asher:mapmove", { detail: { lat: c.lat, lng: c.lng, zoom: map.getZoom() } }));
    };
    map.on("move", handler);
    map.on("zoomend", handler);
    handler();
    return () => { map.off("move", handler); map.off("zoomend", handler); };
  }, [map]);
  return null;
};

/* ─────────────── MGRS-ish formatter (lightweight, no extra dep) ─────────────── */
const fmtCoord = (lat: number, lng: number) => {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${ns}, ${Math.abs(lng).toFixed(4)}°${ew}`;
};

/* ─────────────── Profile drawer types ─────────────── */
interface OsmFeature { id: number; type: string; tags?: Record<string, string>; center?: { lat: number; lon: number } }
interface WikiHit { pageid: number; title: string; lat: number; lon: number; dist: number }
interface SelectedEntity {
  lat: number; lng: number;
  hit: SearchHit | null;
  country: CountryData | null;
  weather: any | null;
  elevation: number | null;
  celestial: any | null;
  features: OsmFeature[] | null;
  wiki: WikiHit[] | null;
  loading: boolean;
}

const THREAT_IDS = ["h-quake", "h-fire", "h-air"] as const;
type ThreatId = typeof THREAT_IDS[number];

const IntelligenceMapModule = () => {
  const [activeBase, setActiveBase] = useState<string>("carto-dark");
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({ base: true, weather: true, threats: true });
  const [searchQ, setSearchQ] = useState("");
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [coord, setCoord] = useState({ lat: 38.9072, lng: -77.0369, zoom: 4 });
  const [entity, setEntity] = useState<SelectedEntity | null>(null);
  const [pinned, setPinned] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);
  const [activeThreats, setActiveThreats] = useState<Record<ThreatId, boolean>>({ "h-quake": false, "h-fire": false, "h-air": false });
  const [threatData, setThreatData] = useState<Record<ThreatId, ThreatPoint[]>>({ "h-quake": [], "h-fire": [], "h-air": [] });
  const [showTacticalBorders, setShowTacticalBorders] = useState(true);
  const mapRef = useRef<L.Map | null>(null);
  const [showLiveFeeds, setShowLiveFeeds] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const [showInside, setShowInside] = useState(false);
  const [propertyIntel, setPropertyIntel] = useState<{
    loading: boolean;
    intel: any | null;
    sources: Array<{ title: string; url: string; snippet: string }>;
    error: string | null;
  }>({ loading: false, intel: null, sources: [], error: null });
  const [reconLayer, setReconLayer] = useState<{
    detections: Array<{ lat: number; lng: number; label: string; color?: string; confidence: number; reason?: string }>;
    bbox: [number, number, number, number] | null;
    summary?: string;
    label?: string;
  }>({ detections: [], bbox: null });
  const [temporalLayer, setTemporalLayer] = useState<{
    tracks: Array<{ lat: number; lng: number; label: string; color?: string; first_seen: number; last_seen: number; years_present: number[]; confidence: number; reason?: string }>;
    years: number[];
    frames: Array<{ year: number; source: string; detection_count: number; summary: string }>;
    bbox: [number, number, number, number] | null;
    label?: string;
  }>({ tracks: [], years: [], frames: [], bbox: null });
  const [timelineYear, setTimelineYear] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      setCoord((prev) => {
        if (prev.lat === d.lat && prev.lng === d.lng && prev.zoom === d.zoom) return prev;
        return { lat: d.lat, lng: d.lng, zoom: d.zoom };
      });
    };
    window.addEventListener("asher:mapmove", handler);
    return () => window.removeEventListener("asher:mapmove", handler);
  }, []);

  // Refresh threat overlays when toggled or map moves
  useEffect(() => {
    const refresh = async () => {
      const map = mapRef.current;
      if (!map) return;
      const bounds = map.getBounds();
      const tasks: Promise<void>[] = [];
      if (activeThreats["h-quake"]) {
        tasks.push(fetchEarthquakes().then((d) => setThreatData((p) => ({ ...p, "h-quake": d }))));
      }
      if (activeThreats["h-fire"]) {
        tasks.push(fetchWildfires(bounds).then((d) => setThreatData((p) => ({ ...p, "h-fire": d }))));
      }
      if (activeThreats["h-air"]) {
        tasks.push(fetchAircraft(bounds).then((d) => setThreatData((p) => ({ ...p, "h-air": d }))));
      }
      await Promise.all(tasks);
    };
    refresh();
    const id = window.setInterval(refresh, 60000);
    return () => window.clearInterval(id);
  }, [activeThreats, coord.lat, coord.lng, coord.zoom]);


  const tile = TILE_SOURCES[activeBase] ?? TILE_SOURCES["carto-dark"];
  const showSatelliteTacticalOverlay = activeBase === "esri-sat" && showTacticalBorders;

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
    // Paint the drawer immediately with whatever we have; stream the rest in.
    setEntity({ lat, lng, hit: null, country: null, weather: null, elevation: null, celestial: null, features: null, wiki: null, loading: true });
    logAsherEvent("map_query", { lat: +lat.toFixed(4), lng: +lng.toFixed(4) });

    // Helper: merge a partial slice into the current entity without blocking.
    const patch = (slice: Partial<NonNullable<typeof entity>>) =>
      setEntity((prev) => (prev ? { ...prev, ...slice } : prev));

    // Fire all sources in parallel. As soon as ONE resolves, it paints.
    // No more "slowest-of-6" gating. Country fetch is chained off the
    // reverse-geocode promise so it doesn't add a serial round-trip.
    const pReverse = reverseGeocode(lat, lng).then(async (hit) => {
      patch({ hit });
      // Kick off property intel the moment we have an address — don't wait for Overpass.
      const cc = hit?.address?.country_code?.toUpperCase();
      if (cc) {
        fetchCountryByCode(cc).then((country) => patch({ country })).catch(() => {});
      }
      return hit;
    });
    const pFeatures = fetchNearbyFeatures(lat, lng).then((features) => { patch({ features }); return features; });
    fetchWeather(lat, lng).then((weather) => patch({ weather })).catch(() => {});
    fetchElevation(lat, lng).then((elevation) => patch({ elevation })).catch(() => {});
    fetchCelestial(lat, lng).then((celestial) => patch({ celestial })).catch(() => {});
    fetchWikipediaNearby(lat, lng).then((wiki) => patch({ wiki })).catch(() => {});

    // Flip the global loading flag as soon as the two anchor sources land.
    // The remaining feeds keep streaming in via patch().
    Promise.allSettled([pReverse, pFeatures]).then(() => {
      patch({ loading: false });
    });

    // Property intel: don't block — start it as soon as address is known.
    pReverse.then((hit) => {
      pFeatures.then((features) => {
        setPropertyIntel({ loading: false, intel: null, sources: [], error: null });
        fetchPropertyIntel(lat, lng, hit, features);
      });
    });
  };

  const fetchPropertyIntel = async (
    lat: number,
    lng: number,
    hit: SearchHit | null,
    features: OsmFeature[] | null,
  ) => {
    const address = hit?.display_name;
    const primary = features ? classifyClick(features).primary : null;
    const entityName =
      primary?.tags?.name ||
      primary?.tags?.["name:en"] ||
      primary?.tags?.operator ||
      undefined;
    if (!address && !entityName) return;
    setPropertyIntel({ loading: true, intel: null, sources: [], error: null });
    try {
      const byok = getActiveIntelMapByok();
      const { data, error } = await supabase.functions.invoke("asher-property-intel", {
        body: {
          lat, lng, address, entityName,
          ...(byok ? { byok: byok.apiKey } : {}),
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Property intel failed");
      setPropertyIntel({ loading: false, intel: data.intel, sources: data.sources || [], error: null });
      logAsherEvent("module_open", { module: "property_intel", lat: +lat.toFixed(3), lng: +lng.toFixed(3) });
    } catch (e: any) {
      setPropertyIntel({ loading: false, intel: null, sources: [], error: e?.message || "Failed" });
    }
  };


  const saveCurrentTarget = async () => {
    if (!entity) return;
    setSavingTarget(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user?.id) { toast.error("Not authenticated"); return; }
      const label =
        entity.hit?.address?.city || entity.hit?.address?.town ||
        entity.hit?.address?.village || entity.hit?.address?.state ||
        entity.country?.name.common ||
        `${entity.lat.toFixed(3)}, ${entity.lng.toFixed(3)}`;
      const payload = {
        country: entity.country?.name?.common,
        weather: entity.weather?.current,
        elevation: entity.elevation,
        celestial: entity.celestial ? {
          sunrise: entity.celestial.sunrise, sunset: entity.celestial.sunset,
        } : null,
        feature_count: entity.features?.length ?? 0,
        address: entity.hit?.display_name,
      };
      const { error } = await supabase.from("asher_saved_targets").insert({
        user_id: u.user.id, label, lat: entity.lat, lng: entity.lng, payload,
      });
      if (error) { toast.error("Save failed"); return; }
      logAsherEvent("target_saved", { label, lat: entity.lat, lng: entity.lng });
      toast.success("Target saved to dossier vault");
    } finally {
      setSavingTarget(false);
    }
  };


  const handleSearchPick = (h: SearchHit) => {
    const lat = parseFloat(h.lat); const lng = parseFloat(h.lon);
    flyTo(lat, lng, 10);
    loadEntity(lat, lng);
    setSearchResults([]);
    setSearchQ(h.display_name);
  };

  // Map context exposed to Asher AI
  const mapContext = {
    center: { lat: coord.lat, lng: coord.lng, zoom: coord.zoom },
    activeBase,
    activeThreats,
    selectedEntity: entity ? (() => {
      const primary = entity.features ? classifyClick(entity.features).primary : null;
      const entityName = primary?.tags?.name || primary?.tags?.["name:en"] || primary?.tags?.operator;
      return {
        lat: entity.lat, lng: entity.lng,
        address: entity.hit?.display_name,
        entityName,
        country: entity.country?.name?.common,
        weather: entity.weather?.current,
        elevation: entity.elevation,
      };
    })() : null,
  };

  // Asher AI dispatcher — drives the map from the right-side panel
  const handleAIAction = async (a: MapAction): Promise<string | void> => {
    if (a.type === "search") {
      const hits = await nominatimSearch(a.query);
      if (!hits.length) { toast.error(`No results for ${a.query}`); return "No results."; }
      const h = hits[0];
      const lat = parseFloat(h.lat); const lng = parseFloat(h.lon);
      flyTo(lat, lng, 10);
      await loadEntity(lat, lng);
      return `Centered on ${h.display_name}`;
    }
    if (a.type === "toggle_threat") {
      const map: Record<string, ThreatId> = { earthquakes: "h-quake", wildfires: "h-fire", aircraft: "h-air" };
      const id = map[a.layer]; if (!id) return;
      setActiveThreats((p) => ({ ...p, [id]: a.enabled }));
    }
    if (a.type === "set_base") {
      const map: Record<string, string> = { street: "osm-standard", satellite: "esri-sat", topo: "osm-topo", dark: "carto-dark" };
      if (map[a.layer]) setActiveBase(map[a.layer]);
    }
    if (a.type === "save_target") {
      if (!entity) { toast.error("No entity selected"); return "Select a location first."; }
      await saveCurrentTarget();
    }
    if (a.type === "analyze_entity") {
      if (!entity) return "No entity selected.";
      return `Selected: ${entity.hit?.display_name || `${entity.lat.toFixed(3)}, ${entity.lng.toFixed(3)}`}. Country=${entity.country?.name?.common ?? "unknown"}. Weather=${entity.weather?.current?.temperature_2m ?? "?"}°C, wind ${entity.weather?.current?.wind_speed_10m ?? "?"} km/h. Elevation=${entity.elevation ?? "?"}m. Nearby features=${entity.features?.length ?? 0}.`;
    }
    if (a.type === "property_intel") {
      // If args provided, run on those; otherwise re-fetch on current entity to refresh the side panel.
      if (entity) {
        fetchPropertyIntel(entity.lat, entity.lng, entity.hit, entity.features);
      }
      return "Property intel scrape dispatched.";
    }
    if (a.type === "visual_recon") {
      setReconLayer({
        detections: a.detections || [],
        bbox: a.bbox || null,
        summary: a.summary,
        label: [a.landmark, a.area].filter(Boolean).join(" · "),
      });
      // Auto-switch to satellite for visual context
      setActiveBase("esri-sat");
      // Fly to centre / fit bbox
      if (a.bbox && mapRef.current) {
        const [w, s, e, n] = a.bbox;
        try { mapRef.current.fitBounds([[s, w], [n, e]], { padding: [40, 40] }); } catch {}
      } else if (a.center) {
        flyTo(a.center.lat, a.center.lng, 15);
      }
      return `Visual scan: ${a.detections?.length || 0} detections rendered.`;
    }
    if (a.type === "temporal_recon") {
      setTemporalLayer({
        tracks: a.tracks || [],
        years: a.years || [],
        frames: a.frames || [],
        bbox: a.bbox || null,
        label: [a.landmark, a.area].filter(Boolean).join(" · "),
      });
      // Default scrubber to latest year
      const last = (a.years || []).length ? Math.max(...a.years) : null;
      setTimelineYear(last);
      setActiveBase("esri-sat");
      if (a.bbox && mapRef.current) {
        const [w, s, e, n] = a.bbox;
        try { mapRef.current.fitBounds([[s, w], [n, e]], { padding: [40, 40] }); } catch {}
      } else if (a.center) {
        flyTo(a.center.lat, a.center.lng, 16);
      }
      return `Temporal scan: ${a.tracks?.length || 0} tracks across ${a.years?.length || 0} year frames.`;
    }
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
                      const isThreat = (THREAT_IDS as readonly string[]).includes(l.id);
                      const isBoundary = l.id === "borders-intl";
                      const isActive = isBase
                        ? l.id === activeBase
                        : isThreat ? !!activeThreats[l.id as ThreatId] : isBoundary ? showTacticalBorders : false;
                      return (
                        <button
                          key={l.id}
                          onClick={() => {
                            if (l.status !== "live") return;
                            if (isBase) setActiveBase(l.id);
                            else if (isThreat) setActiveThreats((p) => ({ ...p, [l.id]: !p[l.id as ThreatId] }));
                            else if (isBoundary) setShowTacticalBorders((p) => !p);
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
                          {isThreat && isActive && (
                            <span className="text-[8px] tracking-[0.2em] text-emerald-400/80 uppercase">{threatData[l.id as ThreatId]?.length ?? 0}</span>
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
          attributionControl={false}
          worldCopyJump
        >
          <TileLayer
            key={activeBase}
            url={tile.url}
            attribution=""
            maxZoom={tile.max ?? 19}
          />
          {showSatelliteTacticalOverlay && (
            <TileLayer
              key="esri-tactical-borders"
              url={TACTICAL_BORDER_OVERLAY.url}
              attribution=""
              maxZoom={19}
              opacity={0.92}
              zIndex={260}
              className="asher-tactical-border-overlay"
            />
          )}
          <MapClick onClick={loadEntity} />
          <CoordDisplay />

          {/* Threat overlays — live data */}
          {activeThreats["h-quake"] && threatData["h-quake"].map((p, i) => (
            <CircleMarker key={`q-${i}`} center={[p.lat, p.lng]}
              radius={Math.max(4, Math.min(14, (p.severity || 3) * 2))}
              pathOptions={{ color: "#f59e0b", weight: 1, fillColor: "#f59e0b", fillOpacity: 0.45 }}>
              <Popup><div className="text-xs"><b>{p.label}</b><br/>{p.meta}</div></Popup>
            </CircleMarker>
          ))}
          {activeThreats["h-fire"] && threatData["h-fire"].map((p, i) => (
            <CircleMarker key={`f-${i}`} center={[p.lat, p.lng]} radius={4}
              pathOptions={{ color: "#ef4444", weight: 1, fillColor: "#ef4444", fillOpacity: 0.6 }}>
              <Popup><div className="text-xs"><b>{p.label}</b><br/>{p.meta}</div></Popup>
            </CircleMarker>
          ))}
          {activeThreats["h-air"] && threatData["h-air"].map((p, i) => (
            <CircleMarker key={`a-${i}`} center={[p.lat, p.lng]} radius={3}
              pathOptions={{ color: "#22d3ee", weight: 1, fillColor: "#22d3ee", fillOpacity: 0.7 }}>
              <Popup><div className="text-xs"><b>{p.label}</b><br/>{p.meta}</div></Popup>
            </CircleMarker>
          ))}

          {/* AI Visual Scan detections */}
          {reconLayer.detections.map((d, i) => {
            const c = (d.color || "").toLowerCase();
            const fill = c.includes("red") || c.includes("rust") || c.includes("orange") ? "#ef4444"
              : c.includes("blue") || c.includes("navy") || c.includes("cyan") ? "#3b82f6"
              : c.includes("green") ? "#22c55e"
              : c.includes("yellow") ? "#eab308"
              : "#a855f7";
            return (
              <CircleMarker
                key={`recon-${i}`}
                center={[d.lat, d.lng]}
                radius={Math.max(5, Math.min(11, 4 + d.confidence * 8))}
                pathOptions={{ color: fill, weight: 2, fillColor: fill, fillOpacity: 0.55 }}
              >
                <Popup>
                  <div className="text-xs space-y-1">
                    <div className="font-semibold">{d.label}</div>
                    <div className="opacity-70">Confidence: {(d.confidence * 100).toFixed(0)}%</div>
                    {d.reason && <div className="opacity-80">{d.reason}</div>}
                    <div className="opacity-50 font-mono text-[10px]">{d.lat.toFixed(5)}, {d.lng.toFixed(5)}</div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}

          {/* AI Temporal Scan — tracks visible at the scrubbed year */}
          {temporalLayer.tracks
            .filter((t) => timelineYear == null || (t.first_seen <= timelineYear && t.last_seen >= timelineYear))
            .map((t, i) => {
              const c = (t.color || "").toLowerCase();
              const fill = c.includes("red") || c.includes("rust") || c.includes("orange") ? "#ef4444"
                : c.includes("blue") || c.includes("navy") || c.includes("cyan") ? "#3b82f6"
                : c.includes("green") ? "#22c55e"
                : c.includes("yellow") ? "#eab308"
                : "#f0abfc";
              const isNew = timelineYear != null && t.first_seen === timelineYear;
              return (
                <CircleMarker
                  key={`temporal-${i}-${timelineYear}`}
                  center={[t.lat, t.lng]}
                  radius={Math.max(6, Math.min(13, 5 + t.confidence * 9))}
                  pathOptions={{ color: fill, weight: isNew ? 3 : 1.5, fillColor: fill, fillOpacity: 0.55, dashArray: isNew ? "4 3" : undefined }}
                >
                  <Popup>
                    <div className="text-xs space-y-1">
                      <div className="font-semibold">{t.label}</div>
                      <div className="opacity-80">First seen: <b>{t.first_seen}</b> · Last seen: <b>{t.last_seen}</b></div>
                      <div className="opacity-70">Years present: {t.years_present.join(", ")}</div>
                      <div className="opacity-70">Confidence: {(t.confidence * 100).toFixed(0)}%</div>
                      {t.reason && <div className="opacity-80">{t.reason}</div>}
                      <div className="opacity-50 font-mono text-[10px]">{t.lat.toFixed(5)}, {t.lng.toFixed(5)}</div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
        </MapContainer>

        {/* RECON LAYER BANNER */}
        {reconLayer.detections.length > 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1001] flex items-center gap-2 rounded-xl border border-foreground/20 bg-card/90 backdrop-blur-md px-3 py-1.5 text-[10px] font-light tracking-[0.2em] uppercase text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Visual Scan · {reconLayer.detections.length} match{reconLayer.detections.length === 1 ? "" : "es"}</span>
            {reconLayer.label && <span className="opacity-60 normal-case tracking-normal">— {reconLayer.label}</span>}
            <button
              onClick={() => setReconLayer({ detections: [], bbox: null })}
              className="ml-2 text-muted-foreground hover:text-foreground"
              title="Clear scan layer"
            >×</button>
          </div>
        )}

        {/* TEMPORAL TIMELINE SCRUBBER */}
        {temporalLayer.years.length > 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1001] w-[min(720px,calc(100%-24px))] rounded-xl border border-foreground/20 bg-card/95 backdrop-blur-md px-4 py-3 shadow-2xl">
            <div className="flex items-center gap-3 mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-light tracking-[0.25em] uppercase text-foreground">Temporal Scan</span>
              <span className="text-[10px] tracking-wide text-muted-foreground">
                {temporalLayer.tracks.length} track{temporalLayer.tracks.length === 1 ? "" : "s"} · {temporalLayer.years.length} frames
              </span>
              {temporalLayer.label && (
                <span className="text-[10px] text-muted-foreground/70 truncate">— {temporalLayer.label}</span>
              )}
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[11px] font-mono text-foreground tabular-nums">
                  {timelineYear ?? Math.max(...temporalLayer.years)}
                </span>
                <button
                  onClick={() => { setTemporalLayer({ tracks: [], years: [], frames: [], bbox: null }); setTimelineYear(null); }}
                  className="text-muted-foreground hover:text-foreground text-base leading-none"
                  title="Clear temporal layer"
                >×</button>
              </div>
            </div>
            <input
              type="range"
              min={Math.min(...temporalLayer.years)}
              max={Math.max(...temporalLayer.years)}
              step={1}
              value={timelineYear ?? Math.max(...temporalLayer.years)}
              onChange={(e) => setTimelineYear(parseInt(e.target.value, 10))}
              className="w-full accent-emerald-400"
            />
            <div className="mt-1.5 flex items-center justify-between gap-1">
              {temporalLayer.frames.map((f) => {
                const active = (timelineYear ?? Math.max(...temporalLayer.years)) === f.year;
                return (
                  <button
                    key={f.year}
                    onClick={() => setTimelineYear(f.year)}
                    className={`flex flex-col items-center gap-0.5 rounded px-1.5 py-0.5 transition-colors ${active ? "bg-foreground/15 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    title={`${f.source} · ${f.detection_count} detections`}
                  >
                    <span className="text-[9px] font-mono tabular-nums">{f.year}</span>
                    <span className={`h-1 w-1 rounded-full ${f.detection_count > 0 ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                  </button>
                );
              })}
            </div>
          </div>
        )}


        {/* LIVE FEEDS TOGGLE */}
        {entity && (
          <button
            onClick={() => setShowLiveFeeds((v) => !v)}
            className={`absolute bottom-3 left-3 z-[1001] flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-light tracking-[0.2em] uppercase backdrop-blur-md transition-colors ${
              showLiveFeeds
                ? "border-foreground/40 bg-foreground/10 text-foreground"
                : "border-border/30 bg-card/85 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
            style={showLiveFeeds ? { display: "none" } : undefined}
            title="Show live video feeds for this location"
          >
            <Video className="h-3 w-3" strokeWidth={1.5} />
            Live Feeds
          </button>
        )}

        {/* 3D VIEW TOGGLE */}
        {entity && (
          <button
            onClick={() => setShow3D((v) => !v)}
            className={`absolute bottom-3 left-[140px] z-[1001] flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-light tracking-[0.2em] uppercase backdrop-blur-md transition-colors ${
              show3D
                ? "border-foreground/40 bg-foreground/10 text-foreground"
                : "border-border/30 bg-card/85 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
            title="View this property in 3D"
          >
            <span className="font-mono">◧</span>
            3D View
          </button>
        )}

        {/* INSIDE PROPERTY TOGGLE */}
        {entity && (
          <button
            onClick={() => setShowInside((v) => !v)}
            className={`absolute bottom-3 left-[240px] z-[1001] flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-light tracking-[0.2em] uppercase backdrop-blur-md transition-colors ${
              showInside
                ? "border-foreground/40 bg-foreground/10 text-foreground"
                : "border-border/30 bg-card/85 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
            title="See inside the property + property history (open-source imagery)"
          >
            <span className="font-mono">⌂</span>
            Inside / History
          </button>
        )}

        {/* LIVE FEEDS PANEL */}
        {entity && showLiveFeeds && (
          <LiveFeedsPanel
            label={
              entity.hit?.address?.city ||
              entity.hit?.address?.town ||
              entity.hit?.address?.village ||
              entity.hit?.address?.state ||
              entity.country?.name?.common ||
              entity.hit?.display_name?.split(",")[0] ||
              null
            }
            lat={entity.lat}
            lng={entity.lng}
            onClose={() => setShowLiveFeeds(false)}
          />
        )}

        {/* 3D PROPERTY PANEL */}
        {entity && show3D && (
          <Property3DPanel
            label={
              entity.hit?.address?.city ||
              entity.hit?.address?.town ||
              entity.hit?.address?.village ||
              entity.hit?.display_name?.split(",")[0] ||
              null
            }
            lat={entity.lat}
            lng={entity.lng}
            onClose={() => setShow3D(false)}
          />
        )}

        {/* INSIDE PROPERTY + HISTORY PANEL */}
        {entity && showInside && (
          <PropertyInteriorPanel
            label={
              entity.hit?.address?.city ||
              entity.hit?.address?.town ||
              entity.hit?.address?.village ||
              entity.hit?.display_name?.split(",")[0] ||
              null
            }
            lat={entity.lat}
            lng={entity.lng}
            onClose={() => setShowInside(false)}
          />
        )}

        {/* COORD WIDGET */}
        <div className="absolute bottom-3 right-3 z-[1000] rounded-xl border border-border/30 bg-card/85 backdrop-blur-md px-3 py-2 text-[10px] font-light tracking-wide text-muted-foreground space-y-0.5">
          <p><span className="text-muted-foreground/50">LAT/LNG:</span> {fmtCoord(coord.lat, coord.lng)}</p>
          <p><span className="text-muted-foreground/50">ZOOM:</span> {coord.zoom.toFixed(0)}</p>
          <p><span className="text-muted-foreground/50">SCALE:</span> 1:{Math.round(591657550.5 / Math.pow(2, coord.zoom)).toLocaleString()}</p>
        </div>

        {/* ENTITY DRAWER */}
        {entity && (
          <div className={`absolute right-[404px] top-3 z-[1000] w-[400px] max-h-[calc(100%-1.5rem)] overflow-y-auto rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl ${pinned ? "" : ""}`}>
            <div className="flex items-center justify-between border-b border-border/15 px-4 py-3">
              <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">Entity Profile</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={saveCurrentTarget}
                  disabled={savingTarget || entity.loading}
                  className="flex items-center gap-1.5 rounded-md border border-border/30 px-2 py-1 text-[10px] font-light tracking-[0.15em] text-muted-foreground hover:text-foreground hover:bg-foreground/5 uppercase disabled:opacity-40"
                  title="Save target to dossier vault"
                >
                  {savingTarget ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" strokeWidth={1.5} />}
                  Save
                </button>
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

                  {/* Live Satellite Preview (ESRI World Imagery composite) */}
                  {(() => {
                    const z = 17;
                    const tileX = Math.floor(((entity.lng + 180) / 360) * Math.pow(2, z));
                    const tileY = Math.floor(
                      ((1 - Math.log(Math.tan((entity.lat * Math.PI) / 180) + 1 / Math.cos((entity.lat * Math.PI) / 180)) / Math.PI) / 2) *
                        Math.pow(2, z)
                    );
                    const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${tileY}/${tileX}`;
                    return (
                      <div className="relative overflow-hidden rounded-lg border border-border/20">
                        <img src={url} alt="Live satellite imagery" className="w-full h-40 object-cover" loading="lazy" />
                        <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-background/70 backdrop-blur text-[8px] tracking-[0.2em] uppercase text-emerald-400">● Live · ESRI World Imagery</div>
                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-background/70 backdrop-blur text-[8px] tracking-[0.2em] uppercase text-muted-foreground">Z{z}</div>
                      </div>
                    );
                  })()}

                  {/* Click classification */}
                  {(() => {
                    const { primary, cls } = classifyClick(entity.features);
                    const t = primary?.tags || {};
                    const labelMap: Record<string, string> = {
                      residential: "Residential Property",
                      commercial: "Commercial Property",
                      industrial: "Industrial Site",
                      agricultural: "Agricultural Land",
                      vacant: "Vacant / Undeveloped Land",
                      infrastructure: "Critical Infrastructure",
                      transport: "Transportation Asset",
                      building: "Building",
                      natural: "Natural Feature",
                      water: "Hydrographic Feature",
                      unknown: "Geographic Point",
                    };
                    return (
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1.5">
                        <p className="text-[9px] font-light tracking-[0.3em] text-emerald-400/80 uppercase">Click Classification</p>
                        <p className="text-sm font-light text-foreground">{labelMap[cls]}</p>
                        {primary && (
                          <p className="text-[10px] tracking-wide text-muted-foreground">
                            {t.name || t["name:en"] || t.operator || "Unnamed"} · OSM {primary.type}#{primary.id}
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {/* Coords + Grids */}
                  <div className="rounded-lg bg-background/40 border border-border/15 p-3 text-[11px] font-light tracking-wide space-y-1">
                    <p><span className="text-muted-foreground/60">📍 LAT/LNG:</span> {fmtCoord(entity.lat, entity.lng)}</p>
                    {(() => { const u = toUTM(entity.lat, entity.lng);
                      return <p><span className="text-muted-foreground/60">UTM:</span> {u.zone}{u.band} {u.easting}E {u.northing}N</p>; })()}
                    <p><span className="text-muted-foreground/60">MGRS:</span> {toMGRS(entity.lat, entity.lng)}</p>
                    <p><span className="text-muted-foreground/60">🕐 Resolved:</span> {new Date().toUTCString().slice(17, 25)} UTC</p>
                    <p><span className="text-muted-foreground/60">📡 Source:</span> Nominatim · REST Countries · Open-Meteo · Overpass · Wikipedia · ESRI</p>
                  </div>

                  {/* PRIMARY ENTITY DETAILS — pulled from Overpass tags (live, real OSM data) */}
                  {(() => {
                    const { primary } = classifyClick(entity.features);
                    if (!primary) return null;
                    const t = primary.tags || {};
                    const fields: Array<[string, string | undefined]> = [
                      ["Name", t.name || t["name:en"]],
                      ["Operator", t.operator],
                      ["Owner", t.owner],
                      ["Building Type", t.building],
                      ["Use", t["building:use"] || t.amenity || t.shop],
                      ["Levels", t["building:levels"]],
                      ["Height", t.height],
                      ["Year Built", t["start_date"] || t["construction:start_date"]],
                      ["Material", t["building:material"]],
                      ["Roof", t["roof:shape"]],
                      ["Land Use", t.landuse],
                      ["Crop", t.crop || t.produce],
                      ["Surface", t.surface],
                      ["Power", t.power],
                      ["Voltage", t.voltage],
                      ["Capacity", t.capacity],
                      ["Wikipedia", t.wikipedia],
                      ["Wikidata", t.wikidata],
                      ["Phone", t.phone || t["contact:phone"]],
                      ["Website", t.website || t["contact:website"]],
                      ["Opening Hours", t.opening_hours],
                    ].filter((p): p is [string, string] => !!p[1]);
                    if (fields.length === 0) return null;
                    return (
                      <div>
                        <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-2">Primary Entity (OSM · Live)</p>
                        <div className="rounded-lg border border-border/15 bg-background/40 p-3 space-y-1 text-[11px] font-light">
                          {fields.map(([k, v]) => (
                            <p key={k}><span className="text-muted-foreground/60">{k}:</span> {v}</p>
                          ))}
                        </div>
                      </div>
                    );
                  })()}


                  {/* ── Property Intelligence · Zophiel Live Web Scrape ── */}
                  {(() => {
                    const intel = propertyIntel.intel as any;
                    const facts: Array<{ icon: any; label: string; value?: string }> = intel ? [
                      { icon: User,        label: "Owner",      value: intel.owner },
                      { icon: Building2,   label: "Operator",   value: intel.operator },
                      { icon: Hash,        label: "Type",       value: intel.property_type },
                      { icon: CalendarDays,label: "Year Built", value: intel.year_built },
                      { icon: Ruler,       label: "Size",       value: intel.size },
                      { icon: DollarSign,  label: "Est. Value", value: intel.value_estimate },
                    ].filter(f => !!f.value) : [];

                    const status = propertyIntel.loading
                      ? { dot: "bg-amber-400 animate-pulse", text: "SCRAPING", color: "text-amber-300/90" }
                      : propertyIntel.error
                        ? { dot: "bg-red-500", text: "FAILED", color: "text-red-400/90" }
                        : intel
                          ? { dot: "bg-emerald-400", text: "LIVE", color: "text-emerald-300/90" }
                          : { dot: "bg-muted-foreground/40", text: "STANDBY", color: "text-muted-foreground/60" };

                    return (
                      <div>
                        {/* Section header */}
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase flex items-center gap-1.5">
                            <Globe2 className="h-3 w-3" strokeWidth={1.5} />
                            Property Intel · Zophiel Web
                          </p>
                          <button
                            onClick={() => fetchPropertyIntel(entity.lat, entity.lng, entity.hit, entity.features)}
                            disabled={propertyIntel.loading}
                            className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
                            title="Re-scrape property intelligence"
                          >
                            <RefreshCw className={`h-3 w-3 ${propertyIntel.loading ? "animate-spin" : ""}`} strokeWidth={1.5} />
                          </button>
                        </div>

                        {/* Intel card */}
                        <div className="rounded-xl border border-border/15 bg-gradient-to-b from-background/60 to-background/30 backdrop-blur-sm overflow-hidden">

                          {/* Status bar */}
                          <div className="flex items-center justify-between px-3 py-2 border-b border-border/10 bg-background/40">
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                              <span className={`text-[9px] font-medium tracking-[0.25em] uppercase ${status.color}`}>{status.text}</span>
                              {intel && (
                                <span className="text-[9px] font-light text-muted-foreground/50 tracking-[0.2em] uppercase">
                                  · {propertyIntel.sources.length} src
                                </span>
                              )}
                            </div>
                            <Radio className="h-2.5 w-2.5 text-muted-foreground/40" strokeWidth={1.5} />
                          </div>

                          {/* Body */}
                          <div className="p-3 space-y-3">

                            {/* Loading */}
                            {propertyIntel.loading && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-muted-foreground text-[11px] font-light">
                                  <Activity className="h-3 w-3 animate-pulse" />
                                  <span>Scraping live web sources via Zophiel…</span>
                                </div>
                                <div className="space-y-1.5">
                                  {[80, 65, 90].map((w, i) => (
                                    <div key={i} className="h-1.5 rounded-full bg-muted-foreground/10 overflow-hidden">
                                      <div
                                        className="h-full bg-muted-foreground/25 animate-pulse rounded-full"
                                        style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Error */}
                            {propertyIntel.error && !propertyIntel.loading && (
                              <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                                <AlertTriangle className="h-3 w-3 text-amber-400/80 flex-shrink-0 mt-0.5" strokeWidth={1.5} />
                                <p className="text-[10px] text-amber-300/80 font-light leading-relaxed">{propertyIntel.error}</p>
                              </div>
                            )}

                            {/* Empty */}
                            {!propertyIntel.loading && !propertyIntel.error && !intel && (
                              <p className="text-muted-foreground/60 text-[10px] font-light text-center py-3">
                                Awaiting target lock. Select a location to scrape.
                              </p>
                            )}

                            {/* Intel content */}
                            {intel && (
                              <>
                                {/* Hero summary */}
                                {intel.summary && (
                                  <div className="relative pl-3 border-l border-emerald-400/30">
                                    <p className="text-[11px] text-foreground/90 leading-relaxed font-light">{intel.summary}</p>
                                  </div>
                                )}

                                {/* Fact grid */}
                                {facts.length > 0 && (
                                  <div className="grid grid-cols-2 gap-1.5">
                                    {facts.map(({ icon: Icon, label, value }) => (
                                      <div key={label} className="rounded-md border border-border/10 bg-background/30 px-2 py-1.5">
                                        <div className="flex items-center gap-1 mb-0.5">
                                          <Icon className="h-2.5 w-2.5 text-muted-foreground/50" strokeWidth={1.5} />
                                          <span className="text-[8.5px] uppercase tracking-[0.18em] text-muted-foreground/55 font-light">{label}</span>
                                        </div>
                                        <p className="text-[10.5px] text-foreground/90 font-light leading-snug truncate" title={value}>{value}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Tenants / occupants chips */}
                                {Array.isArray(intel.tenants_or_occupants) && intel.tenants_or_occupants.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <UsersIcon className="h-2.5 w-2.5 text-muted-foreground/55" strokeWidth={1.5} />
                                      <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground/60 font-light">Tenants / Occupants</p>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {intel.tenants_or_occupants.slice(0, 8).map((x: string, i: number) => (
                                        <span key={i} className="text-[10px] font-light px-1.5 py-0.5 rounded-md border border-border/15 bg-background/40 text-foreground/80">
                                          {x}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* History timeline */}
                                {Array.isArray(intel.history) && intel.history.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <History className="h-2.5 w-2.5 text-muted-foreground/55" strokeWidth={1.5} />
                                      <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground/60 font-light">History</p>
                                    </div>
                                    <div className="space-y-1 pl-1">
                                      {intel.history.slice(0, 6).map((x: string, i: number) => (
                                        <div key={i} className="relative pl-3 text-[10.5px] text-foreground/80 font-light leading-snug">
                                          <span className="absolute left-0 top-[5px] w-1 h-1 rounded-full bg-muted-foreground/40" />
                                          {x}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Notable events */}
                                {Array.isArray(intel.notable_events) && intel.notable_events.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <Activity className="h-2.5 w-2.5 text-muted-foreground/55" strokeWidth={1.5} />
                                      <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground/60 font-light">Notable Events</p>
                                    </div>
                                    <div className="space-y-1 pl-1">
                                      {intel.notable_events.slice(0, 6).map((x: string, i: number) => (
                                        <div key={i} className="relative pl-3 text-[10.5px] text-foreground/80 font-light leading-snug">
                                          <span className="absolute left-0 top-[5px] w-1 h-1 rounded-full bg-blue-400/60" />
                                          {x}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Risks callout */}
                                {Array.isArray(intel.risks) && intel.risks.length > 0 && (
                                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-2">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <AlertTriangle className="h-2.5 w-2.5 text-amber-400/80" strokeWidth={1.5} />
                                      <p className="text-[9px] uppercase tracking-[0.22em] text-amber-300/80 font-medium">Risks</p>
                                    </div>
                                    <div className="space-y-0.5">
                                      {intel.risks.slice(0, 6).map((x: string, i: number) => (
                                        <div key={i} className="relative pl-3 text-[10.5px] text-amber-100/85 font-light leading-snug">
                                          <span className="absolute left-0 top-[5px] w-1 h-1 rounded-full bg-amber-400/70" />
                                          {x}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Sources */}
                                {propertyIntel.sources.length > 0 && (
                                  <div className="pt-2 border-t border-border/10">
                                    <p className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground/55 font-light mb-1.5">Sources Scraped</p>
                                    <div className="flex flex-wrap gap-1">
                                      {propertyIntel.sources.map((s, i) => {
                                        let host = "";
                                        try { host = new URL(s.url).hostname.replace(/^www\./, ""); } catch { host = s.url; }
                                        return (
                                          <a key={i} href={s.url} target="_blank" rel="noreferrer"
                                            title={s.title || s.url}
                                            className="group flex items-center gap-1 text-[10px] font-light px-1.5 py-0.5 rounded-md border border-border/15 bg-background/40 text-muted-foreground hover:text-foreground hover:border-border/30 transition-colors">
                                            <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" strokeWidth={1.5} />
                                            <span className="truncate max-w-[140px]">{host}</span>
                                          </a>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

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
                      <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-2">Live Weather</p>
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

                  {/* Nearby OSM Features — categorized */}
                  {entity.features && entity.features.length > 0 && (() => {
                    const cats: Record<string, OsmFeature[]> = {};
                    for (const f of entity.features) {
                      const t = f.tags || {};
                      const cat = t.amenity ? "Amenities"
                        : t.shop ? "Commerce"
                        : t.building ? "Buildings"
                        : t.power ? "Power Grid"
                        : t.man_made ? "Man-Made"
                        : t.landuse ? "Land Use"
                        : t.highway ? "Roads"
                        : t.railway ? "Rail"
                        : t.waterway ? "Water"
                        : t.natural ? "Natural"
                        : t.leisure ? "Leisure"
                        : "Other";
                      (cats[cat] ||= []).push(f);
                    }
                    return (
                      <div>
                        <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-2">
                          Nearby Features (Overpass · 250m · {entity.features.length})
                        </p>
                        <div className="rounded-lg border border-border/15 bg-background/40 p-3 max-h-64 overflow-y-auto space-y-3">
                          {Object.entries(cats).map(([cat, items]) => (
                            <div key={cat}>
                              <p className="text-[9px] font-light tracking-[0.2em] text-emerald-400/70 uppercase mb-1">{cat} · {items.length}</p>
                              <div className="space-y-0.5 pl-2 border-l border-border/15">
                                {items.slice(0, 12).map((f) => {
                                  const t = f.tags || {};
                                  const name = t.name || t["name:en"] || t.amenity || t.building || t.man_made || t.landuse || t.shop || `${f.type} #${f.id}`;
                                  const kind = t.amenity || t.building || t.man_made || t.shop || t.landuse || t.power || t.highway || t.railway || "feature";
                                  return (
                                    <div key={`${f.type}-${f.id}`} className="text-[11px] font-light flex items-start gap-2">
                                      <div className="min-w-0">
                                        <p className="text-foreground/85 truncate">{name}</p>
                                        <p className="text-[9px] tracking-[0.15em] text-muted-foreground/50 uppercase">{kind}{t.operator ? ` · ${t.operator}` : ""}</p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Wikipedia Geo-Search (Live) */}
                  {entity.wiki && entity.wiki.length > 0 && (
                    <div>
                      <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-2">Open-Source Knowledge (Wikipedia · 2km)</p>
                      <div className="rounded-lg border border-border/15 bg-background/40 p-3 max-h-48 overflow-y-auto space-y-1.5">
                        {entity.wiki.map((w) => (
                          <a
                            key={w.pageid}
                            href={`https://en.wikipedia.org/?curid=${w.pageid}`}
                            target="_blank" rel="noopener noreferrer"
                            className="block text-[11px] font-light hover:text-emerald-400 transition-colors"
                          >
                            <p className="text-foreground/85 truncate">{w.title}</p>
                            <p className="text-[9px] tracking-[0.15em] text-muted-foreground/50 uppercase">{Math.round(w.dist)}m away</p>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live Hazard Proximity */}
                  {(threatData["h-quake"].length + threatData["h-fire"].length + threatData["h-air"].length) > 0 && (() => {
                    const within = (arr: ThreatPoint[], km: number) => arr.filter((p) => {
                      const dx = (p.lat - entity.lat) * 111;
                      const dy = (p.lng - entity.lng) * 111 * Math.cos((entity.lat * Math.PI) / 180);
                      return Math.sqrt(dx * dx + dy * dy) <= km;
                    });
                    const eq = within(threatData["h-quake"], 500);
                    const fi = within(threatData["h-fire"], 100);
                    const ai = within(threatData["h-air"], 200);
                    if (eq.length + fi.length + ai.length === 0) return null;
                    return (
                      <div>
                        <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-2">Hazard Proximity (Live Overlays)</p>
                        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1 text-[11px] font-light">
                          {eq.length > 0 && <p>● {eq.length} earthquake(s) within 500 km</p>}
                          {fi.length > 0 && <p>● {fi.length} active wildfire(s) within 100 km</p>}
                          {ai.length > 0 && <p>● {ai.length} aircraft tracked within 200 km</p>}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Property Assessment (derived from real data only) */}
                  <div>
                    <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-2">Property Assessment</p>
                    <div className="rounded-lg border border-border/15 bg-background/40 p-3 space-y-1 text-[11px] font-light">
                      {(() => {
                        const { cls } = classifyClick(entity.features);
                        const govCount = entity.features?.filter((f) => f.tags?.amenity === "embassy" || f.tags?.amenity === "townhall" || f.tags?.amenity === "courthouse" || f.tags?.amenity === "police").length || 0;
                        const infraCount = entity.features?.filter((f) => f.tags?.power || f.tags?.man_made === "tower" || f.tags?.man_made === "communications_tower").length || 0;
                        const popDensity = entity.features?.filter((f) => f.tags?.building === "residential" || f.tags?.building === "apartments" || f.tags?.building === "house").length || 0;
                        let activity = "LOW";
                        if (govCount > 0) activity = "MODERATE — government infrastructure";
                        else if (infraCount > 2) activity = "MODERATE — critical infrastructure cluster";
                        else if (popDensity > 5) activity = "HIGH — dense residential area";
                        return (
                          <>
                            <p><span className="text-muted-foreground/60">Classification:</span> {cls.toUpperCase()}</p>
                            <p><span className="text-muted-foreground/60">Activity Level:</span> {activity}</p>
                            <p><span className="text-muted-foreground/60">Government Footprint:</span> {govCount} entities</p>
                            <p><span className="text-muted-foreground/60">Critical Infrastructure:</span> {infraCount} entities</p>
                            <p><span className="text-muted-foreground/60">Residential Density:</span> {popDensity} structures</p>
                          </>
                        );
                      })()}
                    </div>
                    <p className="text-[8px] mt-1.5 tracking-[0.2em] text-muted-foreground/40 uppercase">
                      Note: Owner / occupant / financial / pattern-of-life data is not available via open public APIs and is intentionally not fabricated.
                    </p>
                  </div>

                  {/* Raw place name */}
                  {entity.hit && (
                    <div>
                      <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase mb-2">Resolved Address</p>
                      <p className="text-[11px] font-light text-muted-foreground/80 leading-relaxed">{entity.hit.display_name}</p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${entity.lat}&mlon=${entity.lng}#map=18/${entity.lat}/${entity.lng}`}
                      target="_blank" rel="noopener noreferrer"
                      className="rounded-lg border border-border/30 bg-background/40 px-3 py-2 text-[10px] font-light tracking-[0.15em] text-muted-foreground hover:text-foreground hover:bg-foreground/5 uppercase text-center"
                    >View on OSM</a>
                    <a
                      href={`https://www.google.com/maps/@?api=1&map_action=map&center=${entity.lat},${entity.lng}&zoom=18&basemap=satellite`}
                      target="_blank" rel="noopener noreferrer"
                      className="rounded-lg border border-border/30 bg-background/40 px-3 py-2 text-[10px] font-light tracking-[0.15em] text-muted-foreground hover:text-foreground hover:bg-foreground/5 uppercase text-center"
                    >Satellite View</a>
                    <a
                      href={`https://www.google.com/maps?q=&layer=c&cbll=${entity.lat},${entity.lng}`}
                      target="_blank" rel="noopener noreferrer"
                      className="rounded-lg border border-border/30 bg-background/40 px-3 py-2 text-[10px] font-light tracking-[0.15em] text-muted-foreground hover:text-foreground hover:bg-foreground/5 uppercase text-center"
                    >Street View</a>
                    <button
                      onClick={() => {
                        const txt = JSON.stringify({
                          coordinates: { lat: entity.lat, lng: entity.lng, mgrs: toMGRS(entity.lat, entity.lng) },
                          address: entity.hit?.display_name,
                          country: entity.country?.name?.common,
                          weather: entity.weather?.current,
                          elevation: entity.elevation,
                          celestial: entity.celestial,
                          features: entity.features?.map((f) => ({ id: f.id, type: f.type, tags: f.tags })),
                          wiki: entity.wiki,
                          generated: new Date().toISOString(),
                        }, null, 2);
                        const blob = new Blob([txt], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url; a.download = `asher-dossier-${entity.lat.toFixed(4)}_${entity.lng.toFixed(4)}.json`;
                        a.click(); URL.revokeObjectURL(url);
                      }}
                      className="rounded-lg border border-border/30 bg-background/40 px-3 py-2 text-[10px] font-light tracking-[0.15em] text-muted-foreground hover:text-foreground hover:bg-foreground/5 uppercase"
                    >Export JSON</button>
                  </div>

                  <p className="pt-2 text-[9px] font-light tracking-[0.2em] text-muted-foreground/50 uppercase border-t border-border/10">
                    Classification: Open Source · All data fetched live from public sources
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* ASHER AI right-side panel */}
        <AsherAIPanel mapContext={mapContext} onAction={handleAIAction} />
      </div>
    </div>
  );
};

export default IntelligenceMapModule;
