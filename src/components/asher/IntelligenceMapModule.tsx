import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, CircleMarker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ChevronDown, ChevronRight, X, Search, Loader2, Pin,
  Layers as LayersIcon, Crosshair as CrosshairIcon, Save,
  PanelLeftClose, PanelLeftOpen, Plus, Minus, LocateFixed, Copy, Share2,
  Navigation2, Utensils, Briefcase, Camera as CameraIcon, Eye,
} from "lucide-react";
import DirectionsPanel, { type DirectionsEndpoint } from "@/components/asher/DirectionsPanel";
import PlacesNearbyPanel from "@/components/asher/PlacesNearbyPanel";
import JobsNearbyPanel, { type JobPosting } from "@/components/asher/JobsNearbyPanel";
import StreetCameraLayer from "@/components/asher/StreetCameraLayer";
import { fetchStreetCameras, type StreetCamera, type CameraQuery } from "@/lib/asher/streetCameras";
import { searchNearby, streetViewUrl, type Place } from "@/lib/asher/places";
import {
  getDirections, fmtDistance as fmtDistUnits, fmtDuration as fmtDurUnits, fmtEta,
  type RouteOption, type TravelMode, type Units,
} from "@/lib/asher/directions";
import { supabase } from "@/integrations/supabase/client";
import { logAsherEvent } from "@/lib/asherAudit";
import { toast } from "sonner";
import AsherAIPanel, { type MapAction, type GeoRef } from "@/components/asher/AsherAIPanel";
import LiveFeedsPanel from "@/components/asher/LiveFeedsPanel";
import Property3DPanel from "@/components/asher/Property3DPanel";
import PropertyInteriorPanel from "@/components/asher/PropertyInteriorPanel";
import CinematicDossierPanel from "@/components/asher/CinematicDossierPanel";
import { Video, Globe2, ExternalLink, RefreshCw, Building2, User, Hash, CalendarDays, Ruler, DollarSign, Users as UsersIcon, History, AlertTriangle, Activity, Radio } from "lucide-react";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";
import { triggerByokRequired } from "@/components/ByokRequiredDialog";
import MapAnnotationLayer from "@/components/asher/MapAnnotationLayer";
import MapFocusPin, { type FocusPinTarget, type FocusPinRow } from "@/components/asher/MapFocusPin";
import AnnotationPanel, { type DrawMode } from "@/components/asher/AnnotationPanel";
import AnalysisPanel from "@/components/asher/AnalysisPanel";
import SelfLocationLayer from "@/components/asher/SelfLocationLayer";
import SelfTrackPanel from "@/components/asher/SelfTrackPanel";
import { useSelfTracking, bearingDeg, compass16, fmtSpeed } from "@/lib/asher/selfTrack";
import MyDevicesLayer from "@/components/asher/MyDevicesLayer";
import MyDevicesPanel from "@/components/asher/MyDevicesPanel";
import {
  locateGroup, locateDevice, fmtAge,
  type LocatedDevice,
} from "@/lib/asher/findMy";
import {
  loadCloudMapLayer, venueFeatures, clearCloudMapCache,
  pendingVenueFeatures, getPendingVenues, clearPendingVenues,
  pendingContactFeatures, getPendingContacts, clearPendingContacts,
  type CloudMapLayer, type CloudMapFeature,
} from "@/lib/cloudIntel/mapBridge";

import {
  makeAnnotation, annoCenter, annoMetric,
  haversineM, fmtDistance, type MapAnnotation,
} from "@/lib/asher/mapAnnotations";
import {
  getActiveCaseId, loadCaseAnnotations, saveCaseAnnotations, appendAudit, listCases,
} from "@/lib/asher/mapCases";
import {
  computeViewshed, elevationProfile, solarPosition, detectColocations, roadRoute,
  fmtM, fmtDuration, compass, type ViewshedResult,
} from "@/lib/asher/geoAnalysis";
import { buildBriefing } from "@/lib/asher/mapExport";


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
  { id: "assets", label: "My Devices (Find-My)", layers: [
    { id: "my-devices", label: "Owned BLE Gear — Group Map", status: "live" },
  ]},
  { id: "threats", label: "Natural Hazards", layers: [
    { id: "h-quake",  label: "Live Earthquakes (USGS)", status: "live" },
    { id: "h-fire",   label: "Active Wildfires (NASA FIRMS)", status: "live" },
    { id: "h-air",    label: "Aircraft Traffic (OpenSky)", status: "live" },
    { id: "h-env",    label: "Environmental",       status: "soon" },
  ]},
  { id: "cloud-intel", label: "Cloud Intelligence", layers: [
    { id: "cloud-contacts",    label: "Contact Dossiers",    status: "live" },
    { id: "cloud-venues",      label: "Calendar Venues & Forecasts", status: "live" },
    { id: "cloud-security",    label: "Security Events & Signals", status: "live" },
    { id: "cloud-relationships", label: "Inferred Relationship Links", status: "live" },
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
  name?: string; addresstype?: string;
  /** Nominatim returns [south, north, west, east] as strings. */
  boundingbox?: [string, string, string, string] | string[];
  address?: { country?: string; country_code?: string; state?: string; city?: string; town?: string; village?: string; suburb?: string; neighbourhood?: string; house_number?: string; road?: string; postcode?: string; county?: string; };
}

/* ─────────────── Precision focus ───────────────
   A geocoder hit is not a single zoom level. "Cape Coral" is a 30 km polygon;
   "1234 SE 5th Ave" is a 12 m rooftop. Flying to a fixed z10 for both is why
   an address request used to land the operator a mile up in the air.
   Resolution order: the hit's own bounding box (Leaflet computes the exact
   zoom that frames it), then a semantic floor so rooftop-class targets are
   never framed wider than z18, then a hard clamp at the imagery ceiling. */
const BUILDING_CLASSES = new Set(["building", "shop", "office", "amenity", "tourism", "healthcare", "craft"]);
const BUILDING_TYPES = new Set([
  "house", "detached", "residential", "apartments", "semidetached_house", "terrace",
  "bungalow", "farm", "yes", "building", "commercial", "retail", "industrial",
  "hotel", "school", "hospital", "church", "warehouse",
]);

function isRooftopHit(hit?: SearchHit | null): boolean {
  if (!hit) return false;
  if (hit.address?.house_number) return true;
  const cls = (hit.class || "").toLowerCase();
  const type = (hit.type || "").toLowerCase();
  const at = (hit.addresstype || "").toLowerCase();
  if (at === "building" || at === "house" || at === "place_house") return true;
  if (cls === "place" && (type === "house" || type === "building")) return true;
  return BUILDING_CLASSES.has(cls) && BUILDING_TYPES.has(type);
}

/** The zoom that actually frames this hit, given the live map viewport. */
function zoomForHit(map: L.Map | null, hit?: SearchHit | null, fallback = 16): number {
  let z = fallback;
  const bb = hit?.boundingbox;
  if (map && Array.isArray(bb) && bb.length === 4) {
    const [s, n, w, e] = bb.map((v) => parseFloat(String(v)));
    if ([s, n, w, e].every(Number.isFinite) && n >= s && e >= w) {
      try {
        z = map.getBoundsZoom(L.latLngBounds([s, w], [n, e]), false, L.point(64, 64));
      } catch { /* degenerate bbox — keep the fallback */ }
    }
  }
  if (isRooftopHit(hit)) z = Math.max(z, 18);
  if (!Number.isFinite(z)) z = fallback;
  return Math.max(3, Math.min(19, Math.round(z)));
}

/** Short, human label for the card badge. */
function hitBadge(hit?: SearchHit | null): string | undefined {
  // `type` is the precise class ("house", "supermarket"); `addresstype` only
  // appears on reverse hits and `class` is the coarse bucket ("place").
  const t = (hit?.type || hit?.addresstype || hit?.class || "").replace(/_/g, " ").trim();

  return t ? t.toUpperCase() : undefined;
}

/** Title shown while the reverse-geocode for a freshly clicked point is in flight. */
const PIN_PLACEHOLDER = "Selected point";




async function nominatimSearch(q: string): Promise<SearchHit[]> {
  if (!q.trim()) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=8&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { "Accept": "application/json" } });
  if (!r.ok) throw new Error("search_failed");
  return r.json();
}

async function reverseGeocode(lat: number, lon: number): Promise<SearchHit | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lon}`;
    const r = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
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

/* Follow mode must yield to the operator: the instant they drag or zoom the
   map by hand, auto-recentering stops. A camera that fights the analyst is
   worse than no camera lock at all. */
const FollowGuard = ({ active, onRelease }: { active: boolean; onRelease: () => void }) => {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    const release = () => onRelease();
    /* Only *human* camera input releases the lock. Listening to `zoomstart`
       would also catch our own recenter animation and disarm follow one frame
       after arming it, so hand input is read from the raw pointer/wheel events
       on the container instead. */
    const el = map.getContainer();
    map.on("dragstart", release);
    el.addEventListener("wheel", release, { passive: true });
    el.addEventListener("dblclick", release);
    return () => {
      map.off("dragstart", release);
      el.removeEventListener("wheel", release);
      el.removeEventListener("dblclick", release);
    };
  }, [map, active, onRelease]);
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

/* Sidebar geometry — persisted so the operator's chosen width survives a
   reload. Clamped on read: a corrupted localStorage value must never render an
   unusable 4px rail or a sidebar wider than the viewport. */
const SIDEBAR_KEY = "asherin-maps.sidebar";
const SIDEBAR_MIN = 240;
const SIDEBAR_MAX = 620;
const SIDEBAR_DEFAULT = 384;
const UNITS_KEY = "asherin-maps.units";

function readSidebar(): { width: number; collapsed: boolean } {
  try {
    const raw = JSON.parse(localStorage.getItem(SIDEBAR_KEY) || "null");
    const width = Number(raw?.width);
    return {
      width: Number.isFinite(width) ? Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, width)) : SIDEBAR_DEFAULT,
      collapsed: !!raw?.collapsed,
    };
  } catch {
    return { width: SIDEBAR_DEFAULT, collapsed: false };
  }
}

function readUnits(): Units {
  try { return localStorage.getItem(UNITS_KEY) === "metric" ? "metric" : "imperial"; } catch { return "imperial"; }
}

const IntelligenceMapModule = () => {
  // Satellite is the operator default: parcel edges, roof detail and vehicle
  // presence are the whole point of this surface, and none of them survive on
  // a vector base map.
  const [activeBase, setActiveBase] = useState<string>("esri-sat");
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({ base: true, weather: true, threats: true });
  const [layerFilter, setLayerFilter] = useState("");
  const [sidebar, setSidebar] = useState(readSidebar);
  const [units, setUnits] = useState<Units>(readUnits);
  const [tool, setTool] = useState<null | "directions" | "places" | "jobs">(null);
  const [seedDest, setSeedDest] = useState<DirectionsEndpoint | null>(null);
  const [routeLayer, setRouteLayer] = useState<{ routes: RouteOption[]; activeId: string | null; highlight: Array<{ lat: number; lng: number }> | null }>({ routes: [], activeId: null, highlight: null });
  const [cameras, setCameras] = useState<StreetCamera[]>([]);
  /** True while the Asher AI dock is expanded — the top bar shrinks so no
   *  control is ever rendered underneath the 380px dock. */
  const [aiDocked, setAiDocked] = useState(true);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [placePins, setPlacePins] = useState<Place[]>([]);
  const [jobPins, setJobPins] = useState<JobPosting[]>([]);
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
  const [cloudLayer, setCloudLayer] = useState<CloudMapLayer>({ contacts: [], venues: [], security: [], relationships: [] });
  const [cloudLayerLoading, setCloudLayerLoading] = useState(false);
  const [activeCloud, setActiveCloud] = useState<Record<string, boolean>>({ "cloud-contacts": false, "cloud-venues": false, "cloud-security": false, "cloud-relationships": false });
  const mapRef = useRef<L.Map | null>(null);

  const refreshCloudLayer = async (kind: string) => {
    try {
      setCloudLayerLoading(true);
      const q: Record<string, boolean> = {
        contacts: kind === "cloud-contacts" || kind === "cloud-relationships",
        venues: kind === "cloud-venues",
        security: kind === "cloud-security",
        relationships: kind === "cloud-relationships",
      };
      const layer = await loadCloudMapLayer(q);
      setCloudLayer((prev) => ({ ...prev, [layerKeyForKind(kind)]: layer[layerKeyForKind(kind)] }));
      if (kind === "cloud-relationships") {
        setCloudLayer((prev) => ({ ...prev, relationships: layer.relationships }));
      }
    } catch (e: any) {
      toast.error(e?.message || "Cloud intelligence layer failed to load");
    } finally {
      setCloudLayerLoading(false);
    }
  };
  const layerKeyForKind = (kind: string): keyof CloudMapLayer => {
    switch (kind) {
      case "cloud-contacts": return "contacts";
      case "cloud-venues": return "venues";
      case "cloud-security": return "security";
      case "cloud-relationships": return "relationships";
      default: return "contacts";
    }
  };

  // Load pending venues pushed from Cloud Intelligence modules (e.g. Prophet).
  useEffect(() => {
    const load = async () => {
      const pendingVenues = getPendingVenues();
      const pendingContacts = getPendingContacts();
      clearPendingVenues();
      clearPendingContacts();
      const venueFeatures = pendingVenues.length ? await pendingVenueFeatures(pendingVenues) : [];
      const contactFeatures = pendingContacts.length ? await pendingContactFeatures(pendingContacts) : [];
      const updates: Partial<CloudMapLayer> = {};
      if (venueFeatures.length) updates.venues = venueFeatures;
      if (contactFeatures.length) updates.contacts = contactFeatures;
      if (!Object.keys(updates).length) return;
      setCloudLayer((prev) => ({ ...prev, ...updates }));
      setActiveCloud((prev) => ({
        ...prev,
        ...(venueFeatures.length ? { "cloud-venues": true } : {}),
        ...(contactFeatures.length ? { "cloud-contacts": true } : {}),
      }));
      fitFeatures([...(venueFeatures || []), ...(contactFeatures || [])]);
    };
    load();
  }, []);

  const [showLiveFeeds, setShowLiveFeeds] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const [showInside, setShowInside] = useState(false);
  const [showDossier, setShowDossier] = useState(true);
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

  /* ── Operator/AI editable overlay ─────────────────────────────────────
     Local-first and partitioned by operation (case folder): hydrated
     synchronously on first render (never in an effect, which StrictMode
     double-invokes) and persisted on every mutation. Two investigations can
     never contaminate each other because the storage key carries the case id. */
  const [activeCaseId, setActiveCaseId] = useState<string>(() => getActiveCaseId());
  const [annotations, setAnnotations] = useState<MapAnnotation[]>(() => loadCaseAnnotations(getActiveCaseId()));
  const [drawMode, setDrawMode] = useState<DrawMode>("none");
  const [draftPath, setDraftPath] = useState<Array<{ lat: number; lng: number }>>([]);
  const [focusedAnno, setFocusedAnno] = useState<string | null>(null);
  const [viewshedOverlay, setViewshedOverlay] = useState<ViewshedResult | null>(null);

  /* The golden "target acquired" pin. One at a time by design: it marks the
     single site the operator (or the AI) is currently interrogating, and its
     card streams the same entity slices the side drawer shows. */
  const [focusPin, setFocusPin] = useState<FocusPinTarget | null>(null);

  /* FIND-MY — owned BLE gear rendered as assets, not threats. The roster comes
     from `ble_owned_devices`; positions are fused server-side from every
     Asherin scanner that heard the fingerprint (crowd relay), and the finder's
     identity never crosses the boundary. */
  const [showMyDevices, setShowMyDevices] = useState(false);
  const [myDevices, setMyDevices] = useState<LocatedDevice[]>([]);
  const [myDevicesLoading, setMyDevicesLoading] = useState(false);
  const [focusedDevice, setFocusedDevice] = useState<string | null>(null);
  const [deviceBreadcrumb, setDeviceBreadcrumb] = useState<Array<{ lat: number; lng: number; seen_at: string }>>([]);


  // The case id must be readable from inside the persistence funnel without
  // re-creating it on every render — a ref keeps the closure permanently fresh.
  const caseIdRef = useRef(activeCaseId);
  useEffect(() => { caseIdRef.current = activeCaseId; }, [activeCaseId]);

  // Single mutation funnel — state, storage and the audit trail can never diverge.
  const mutateAnnotations = (fn: (prev: MapAnnotation[]) => MapAnnotation[], audit?: { action: string; detail?: string; actor?: "operator" | "asher-ai" }) => {
    setAnnotations((prev) => {
      const next = fn(prev);
      saveCaseAnnotations(caseIdRef.current, next);
      return next;
    });
    if (audit) appendAudit({ caseId: caseIdRef.current, actor: audit.actor ?? "operator", action: audit.action, detail: audit.detail });
  };

  const addAnnotation = (a: MapAnnotation) => {
    mutateAnnotations((prev) => [...prev, a], { action: `add_${a.kind}`, detail: a.label, actor: a.source });
    setFocusedAnno(a.id);
    return a;
  };

  /** Switching operations swaps the entire overlay and drops stale products. */
  const switchCase = (id: string) => {
    setActiveCaseId(id);
    caseIdRef.current = id;
    setAnnotations(loadCaseAnnotations(id));
    setFocusedAnno(null);
    setDrawMode("none");
    setDraftPath([]);
    setViewshedOverlay(null);
  };


  /** Map clicks are shared between entity inspection and manual drawing. */
  const handleMapClick = (lat: number, lng: number) => {
    if (drawMode === "none") {
      // A click is also an acquisition: drop the golden pin immediately so the
      // operator gets instant feedback, then let the reverse-geocode name it.
      setFocusPin({ lat, lng, title: PIN_PLACEHOLDER });
      void loadEntity(lat, lng);
      return;
    }

    if (drawMode === "marker") {
      addAnnotation(makeAnnotation({ kind: "marker", label: `Pin ${annotations.length + 1}`, lat, lng, category: "observation" }));
      setDrawMode("none");
      toast.success("Marker placed — rename it in the Map Editor");
      return;
    }
    if (drawMode === "label") {
      const text = window.prompt("Label text");
      if (text?.trim()) addAnnotation(makeAnnotation({ kind: "label", label: text.trim(), lat, lng, category: "observation" }));
      setDrawMode("none");
      return;
    }
    if (drawMode === "circle") {
      if (draftPath.length === 0) { setDraftPath([{ lat, lng }]); return; }
      const centre = draftPath[0];
      const radiusM = haversineM(centre, { lat, lng });
      if (radiusM < 1) { toast.error("Radius too small — click further from the centre"); return; }
      addAnnotation(makeAnnotation({
        kind: "circle", label: `Radius ${fmtDistance(radiusM)}`,
        lat: centre.lat, lng: centre.lng, radiusM, category: "zone",
      }));
      setDraftPath([]);
      setDrawMode("none");
      return;
    }
    // line / polygon accumulate until the operator hits Finish
    setDraftPath((p) => [...p, { lat, lng }]);
  };

  const finishDraft = () => {
    if (drawMode === "line" && draftPath.length >= 2) {
      addAnnotation(makeAnnotation({ kind: "line", label: `Route ${annotations.length + 1}`, path: draftPath, category: "route" }));
    } else if (drawMode === "polygon" && draftPath.length >= 3) {
      addAnnotation(makeAnnotation({ kind: "polygon", label: `Zone ${annotations.length + 1}`, path: draftPath, category: "zone" }));
    }
    setDraftPath([]);
    setDrawMode("none");
  };

  const focusAnnotation = (a: MapAnnotation) => {
    const c = annoCenter(a);
    setFocusedAnno(a.id);
    if (c) flyTo(c.lat, c.lng, a.kind === "marker" || a.kind === "label" ? 14 : 12);
  };


  // Escape always cancels an in-progress draw — no trapped modes.
  useEffect(() => {
    if (drawMode === "none") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setDrawMode("none"); setDraftPath([]); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawMode]);



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

  // One-shot guard so the BYOK dialog can't fire on every map click / fly-to.
  const byokPromptedRef = useRef(false);

  const flyTo = (lat: number, lng: number, zoom = 11) => {

    mapRef.current?.flyTo([lat, lng], zoom, { duration: 0.8 });
  };

  /* ── Sidebar geometry ────────────────────────────────────────────────────
     The drag is tracked on `document` (not the handle) so a fast pointer that
     outruns the 6px rail keeps resizing, and pointer capture guarantees the
     release fires even if the cursor leaves the window. Width is written to
     state on every move but only flushed to storage on release — persisting
     at 120 Hz would thrash localStorage on the main thread. */
  const resizingRef = useRef(false);
  const persistSidebar = useCallback((next: { width: number; collapsed: boolean }) => {
    try { localStorage.setItem(SIDEBAR_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  }, []);

  const startResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    resizingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const move = (ev: PointerEvent) => {
      if (!resizingRef.current) return;
      const w = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, ev.clientX));
      setSidebar((s) => (s.width === w ? s : { ...s, width: w }));
    };
    const up = () => {
      resizingRef.current = false;
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.body.style.userSelect = "";
      // Leaflet caches container size; a resized rail must be re-measured or
      // tiles tear along the old edge.
      setTimeout(() => mapRef.current?.invalidateSize(), 60);
      setSidebar((s) => { persistSidebar(s); return s; });
    };
    document.body.style.userSelect = "none";
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  }, [persistSidebar]);

  const toggleSidebar = useCallback(() => {
    setSidebar((s) => {
      const next = { ...s, collapsed: !s.collapsed };
      persistSidebar(next);
      setTimeout(() => mapRef.current?.invalidateSize(), 260);
      return next;
    });
  }, [persistSidebar]);

  // Keyboard resize keeps the rail operable without a pointer (WCAG 2.1.1).
  const nudgeWidth = useCallback((delta: number) => {
    setSidebar((s) => {
      const next = { ...s, width: Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, s.width + delta)) };
      persistSidebar(next);
      setTimeout(() => mapRef.current?.invalidateSize(), 60);
      return next;
    });
  }, [persistSidebar]);

  const changeUnits = useCallback((u: Units) => {
    setUnits(u);
    try { localStorage.setItem(UNITS_KEY, u); } catch { /* private mode */ }
  }, []);

  /* ── Directions / places / cameras plumbing ───────────────────────────── */
  const mapCenter = useCallback(
    () => {
      const c = mapRef.current?.getCenter();
      return c ? { lat: c.lat, lng: c.lng } : { lat: coord.lat, lng: coord.lng };
    },
    [coord.lat, coord.lng],
  );

  /* Endpoint resolution for the directions panel: rooftop precision beats a
     higher-importance city centroid whenever the operator types a street
     address, and a miss returns null so the panel can say so honestly. */
  const geocodeEndpoint = useCallback(async (q: string): Promise<DirectionsEndpoint | null> => {
    const hits = await nominatimSearch(q);
    if (!hits.length) return null;
    const h = hits.find(isRooftopHit) ?? hits[0];
    return { label: h.display_name, lat: parseFloat(h.lat), lng: parseFloat(h.lon) };
  }, []);

  const openDirectionsTo = useCallback((dest: DirectionsEndpoint) => {
    setSeedDest(dest);
    setTool("directions");
  }, []);

  /* ── FIND-MY ─────────────────────────────────────────────────────────────
     One round trip returns the newest fix per owned device. Polling is slow
     (45 s) and only while the layer is visible: BLE sightings arrive on the
     scanner's duty cycle, so a tighter loop would burn quota for no new truth. */
  const refreshMyDevices = useCallback(async () => {
    setMyDevicesLoading(true);
    try {
      const rows = await locateGroup(24);
      setMyDevices(rows);
      setFocusedDevice((prev) => (prev && rows.some((r) => r.fingerprint === prev) ? prev : null));
    } catch (e: any) {
      toast.error(`Find-My unavailable — ${e?.message ?? "unknown error"}`);
    } finally {
      setMyDevicesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showMyDevices) return;
    let alive = true;
    const tick = () => { if (alive) void refreshMyDevices(); };
    tick();
    const id = window.setInterval(tick, 45_000);
    return () => { alive = false; window.clearInterval(id); };
  }, [showMyDevices, refreshMyDevices]);

  const focusDevice = useCallback(async (fingerprint: string) => {
    setFocusedDevice(fingerprint);
    const d = myDevices.find((x) => x.fingerprint === fingerprint);
    if (d?.fused) flyTo(d.fused.lat, d.fused.lng, 17);
    try {
      const { breadcrumb } = await locateDevice(fingerprint, 24);
      setDeviceBreadcrumb(breadcrumb);
    } catch {
      setDeviceBreadcrumb([]);
    }
  }, [myDevices]);

  const fitAllDevices = useCallback(() => {
    const pts = myDevices.filter((d) => d.fused).map((d) => [d.fused!.lat, d.fused!.lng] as [number, number]);
    if (!pts.length || !mapRef.current) return;
    if (pts.length === 1) { flyTo(pts[0][0], pts[0][1], 17); return; }
    try { mapRef.current.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 17 }); } catch {}
  }, [myDevices]);

  const fitFeatures = useCallback((features: Array<{ lat: number; lng: number }>) => {
    const pts = features.map((f) => [f.lat, f.lng] as [number, number]);
    if (!pts.length || !mapRef.current) return;
    if (pts.length === 1) { flyTo(pts[0][0], pts[0][1], 15); return; }
    try { mapRef.current.fitBounds(L.latLngBounds(pts), { padding: [80, 80], maxZoom: 16 }); } catch {}
  }, []);

  const routeToDevice = useCallback((d: LocatedDevice) => {
    if (!d.fused) return;
    openDirectionsTo({ label: d.label, lat: d.fused.lat, lng: d.fused.lng });
  }, [openDirectionsTo]);

  const handleRoutes = useCallback((payload: { routes: RouteOption[]; activeId: string | null; highlight: Array<{ lat: number; lng: number }> | null }) => {
    const { routes, activeId } = payload;
    setRouteLayer(payload);
    const active = routes.find((r) => r.id === activeId) ?? routes[0];
    if (active && mapRef.current && active.path.length > 1) {
      mapRef.current.fitBounds(L.latLngBounds(active.path.map((p) => [p.lat, p.lng] as [number, number])), {
        padding: [60, 60], maxZoom: 16,
      });
    }
  }, []);

  const loadCameras = useCallback(async (opts: CameraQuery) => {
    setCameraBusy(true);
    try {
      const sweep = await fetchStreetCameras(opts);
      setCameras(sweep.cameras);
      if (!sweep.cameras.length) toast.info(sweep.coverageNote || "No public traffic cameras published for that corridor.");
    } catch (e: any) {
      toast.error(e?.message || "Camera catalogue unavailable.");
    } finally {
      setCameraBusy(false);
    }
  }, []);



  /* ── Own-force tracking ──────────────────────────────────────────────────
     The sensor is owned by the operator, never by the model. Follow mode pans
     (never zooms) so the analyst's chosen scale survives every fix, and it
     only recenters when the new fix has actually left the viewport — panning
     on GPS jitter would make the map crawl under the cursor. */
  const followRef = useRef(true);
  /* The first fix of a session always frames the operator; after that the
     camera only moves when they have genuinely left the viewport, so a jittery
     fix cannot make the map crawl under the analyst's cursor. */
  const firstFixRef = useRef(true);
  const track = useSelfTracking({
    onFix: (f) => {
      const map = mapRef.current;
      if (!map) return;
      if (firstFixRef.current) {
        firstFixRef.current = false;
        if (followRef.current) map.flyTo([f.lat, f.lng], Math.max(map.getZoom(), 15), { duration: 0.9 });
        return;
      }
      if (!followRef.current) return;
      const b = map.getBounds().pad(-0.25);
      if (!b.contains([f.lat, f.lng])) map.panTo([f.lat, f.lng], { animate: true, duration: 0.6 });
    },

    onFenceEvent: (e) => {
      toast[e.kind === "enter" ? "success" : "warning"](
        `${e.kind === "enter" ? "Entered" : "Exited"} geofence · ${e.label}`,
      );
      logAsherEvent("geofence_event", { label: e.label, kind: e.kind });
    },
  });
  useEffect(() => { followRef.current = track.follow; }, [track.follow]);
  // A stopped sensor ends the session: the next acquisition re-frames the map.
  useEffect(() => { if (track.status !== "live") firstFixRef.current = true; }, [track.status]);



  /* ── focusOn ────────────────────────────────────────────────────────────
     The single entry point for "take me to X". It replaces the old
     `flyTo(lat, lng, 10) + loadEntity(...)` pair, which framed a rooftop the
     same way it framed a country and left nothing on the map to show WHAT was
     found. Now: precision zoom from the hit's own footprint, a golden pin on
     the target, imagery under it when we are at building scale, and the intel
     drawer loading in parallel. */
  const focusOn = async (
    lat: number,
    lng: number,
    hit?: SearchHit | null,
    opts?: { title?: string; subtitle?: string; badge?: string; minZoom?: number },
  ) => {
    const zoom = Math.max(zoomForHit(mapRef.current, hit), opts?.minZoom ?? 0);
    /* For a rooftop hit Nominatim's `name` is just the house number ("1213"),
       which is a useless card title. Rebuild the street line instead. */
    const street = [hit?.address?.house_number, hit?.address?.road].filter(Boolean).join(" ").trim();
    const label = opts?.title
      || street
      || hit?.name
      || hit?.display_name?.split(",")[0]?.trim()
      || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;


    setFocusPin({
      lat, lng,
      title: label,
      subtitle: opts?.subtitle ?? hit?.display_name,
      badge: opts?.badge ?? hitBadge(hit),
    });

    // At rooftop scale a dark vector basemap shows an empty grey block; the
    // operator asked to see the house, so put imagery under the pin. Street/
    // topo choices are respected — only the label-only dark base is swapped.
    if (zoom >= 17 && activeBase === "carto-dark") setActiveBase("esri-sat");

    flyTo(lat, lng, zoom);
    await loadEntity(lat, lng);
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
      // Backfill the golden card for this exact point once the address lands.
      // Guarded on coordinates so a slow reverse-geocode from a previous
      // target can never relabel the pin the operator is looking at now.
      setFocusPin((p) => {
        if (!p || p.lat !== lat || p.lng !== lng || !hit) return p;
        const primary = hit.name || hit.display_name?.split(",")[0]?.trim();
        return {
          ...p,
          title: p.title === PIN_PLACEHOLDER && primary ? primary : p.title,
          subtitle: p.subtitle || hit.display_name,
          badge: p.badge || hitBadge(hit),
        };
      });

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
    // Coordinates alone are a valid target — fall back to a coord label so
    // rural / unresolved parcels still trigger the dossier sweep instead of
    // silently returning and leaving the panel blank.
    const resolvedAddress =
      address || `Unresolved parcel @ ${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    // BYOK GATE — property intel requires the user's own AI key.
    // Eliminates platform-key rate limits and the 4–15s queue wait.
    const byok = getActiveIntelMapByok();
    if (!byok) {
      setPropertyIntel({
        loading: false,
        intel: null,
        sources: [],
        error: "BYOK_REQUIRED",
      });
      // Prompt at most once per session: every fly-to / map click reaches this
      // path, and a dialog on each one would be an interruption storm. The
      // inline BYOK_REQUIRED state in the panel remains the persistent signal.
      if (!byokPromptedRef.current) {
        byokPromptedRef.current = true;
        triggerByokRequired({
          source: "intelligence-property-map",
          reason: "Property intel requires your own AI key (Settings → AI Keys).",
          // The map owns the operator's workspace. Without this flag, paid
          // subscribers were silently navigated to /dashboard?tab=settings,
          // which remounts the dashboard on the default chat view and yanked
          // the operator off the map mid-task (e.g. right after a fly-to).
          noRedirect: true,
        });
      }
      return;
    }


    setPropertyIntel({ loading: true, intel: null, sources: [], error: null });
    try {
      // Extract jurisdiction from the reverse-geocode hit so the edge function
      // scopes queries to the right registry (Florida parcels site for FL,
      // ONLAND for Ontario, Land Registry for UK, etc.).
      const addr: any = hit?.address || {};
      const country = String(addr.country_code || "").toUpperCase();
      const state = String(addr["ISO3166-2-lvl4"] || "").split("-").pop() || "";
      const county = String(addr.county || "").replace(/\s+County$/i, "");
      const { data, error } = await supabase.functions.invoke("asher-property-intel", {
        body: {
          lat, lng, address: resolvedAddress, entityName,
          country, state, county,
          byok: byok.apiKey,
          byokProvider: byok.provider,
          byokModel: byok.model,
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
    void focusOn(lat, lng, h);
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
    /* Own-force state. Coordinates are only exposed once the operator has
       consented and a fix exists; otherwise the model sees the gate, not a
       position, so it can never narrate a location it was never given. */
    selfTracking: {
      status: track.status,
      consented: track.consent,
      following: track.follow,
      fix: track.fix
        ? {
            lat: track.fix.lat, lng: track.fix.lng,
            accuracyM: Math.round(track.fix.accM),
            altitudeM: track.fix.altM,
            speedKph: track.fix.speedMps != null ? +(track.fix.speedMps * 3.6).toFixed(1) : null,
            headingDeg: track.fix.headingDeg != null ? Math.round(track.fix.headingDeg) : null,
            fixedAt: new Date(track.fix.ts).toISOString(),
            degraded: track.fix.degraded,
          }
        : null,
      trackedDistanceM: Math.round(track.stats.distanceM),
      geofences: track.fences.map((g) => ({ label: g.label, radiusM: g.radiusM, operatorInside: g.inside })),
    },
  };


  /* Card body for the golden pin. Derived from the same `entity` slices the
     side drawer renders, so the card can never disagree with the dossier, and
     it fills in progressively as each live source lands. Every row is real
     harvested data — a source that hasn't answered simply omits its row. */
  const focusPinRows: FocusPinRow[] = useMemo(() => {
    if (!focusPin || !entity || entity.lat !== focusPin.lat || entity.lng !== focusPin.lng) return [];
    const rows: FocusPinRow[] = [];
    const addr: any = entity.hit?.address || {};
    const street = [addr.house_number, addr.road].filter(Boolean).join(" ");
    const locality = [addr.city || addr.town || addr.village, addr.state, addr.postcode].filter(Boolean).join(", ");
    if (street) rows.push({ label: "Street", value: street });
    if (locality) rows.push({ label: "Locality", value: locality });

    const { primary, cls } = classifyClick(entity.features);
    if (cls && cls !== "unknown") rows.push({ label: "Class", value: cls });
    const tags = primary?.tags || {};
    const name = tags.name || tags["name:en"] || tags.operator;
    if (name) rows.push({ label: "Site", value: String(name) });
    const structure = tags.building && tags.building !== "yes" ? String(tags.building) : tags.amenity || tags.shop || tags.office;
    if (structure) rows.push({ label: "Structure", value: String(structure).replace(/_/g, " ") });
    if (tags["building:levels"]) rows.push({ label: "Levels", value: String(tags["building:levels"]) });
    if (tags["addr:postcode"] && !addr.postcode) rows.push({ label: "Postcode", value: String(tags["addr:postcode"]) });

    if (entity.country?.name?.common) rows.push({ label: "Country", value: entity.country.name.common });
    if (typeof entity.elevation === "number") rows.push({ label: "Elevation", value: `${Math.round(entity.elevation)} m` });
    const cur: any = entity.weather?.current;
    if (cur && typeof cur.temperature_2m === "number") {
      rows.push({ label: "Weather", value: `${Math.round(cur.temperature_2m)}°C · wind ${Math.round(cur.wind_speed_10m ?? 0)} km/h` });
    }
    if (entity.features?.length) rows.push({ label: "Nearby", value: `${entity.features.length} mapped features` });
    return rows;
  }, [focusPin, entity]);



  // Asher AI dispatcher — drives the map from the right-side panel
  const handleAIAction = async (a: MapAction): Promise<string | void> => {
    if (a.type === "search") {
      const hits = await nominatimSearch(a.query);
      if (!hits.length) { toast.error(`No results for ${a.query}`); return "No results."; }
      /* Prefer the most precise hit the geocoder returned. Asking for a street
         address used to land on hits[0] even when a rooftop match sat lower in
         the list, because Nominatim ranks by importance (population), not by
         precision. */
      const h = hits.find(isRooftopHit) ?? hits[0];
      const lat = parseFloat(h.lat); const lng = parseFloat(h.lon);
      await focusOn(lat, lng, h);
      const z = mapRef.current?.getZoom() ?? 0;
      return `Centered on ${h.display_name} at zoom ${Math.round(z)} — golden target pin dropped with the site card.`;
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

    /* ── Overlay editing ────────────────────────────────────────────────
       Resolution order for a point: explicit coordinates → geocoded place →
       currently selected entity → current map centre. The AI never has to
       guess coordinates, and a failed geocode degrades to an honest error
       instead of silently dropping a pin at 0,0. */
    const resolveRef = async (ref?: GeoRef): Promise<{ lat: number; lng: number; hit?: SearchHit } | null> => {
      if (ref && Number.isFinite(ref.lat) && Number.isFinite(ref.lng)) {
        return { lat: ref.lat as number, lng: ref.lng as number };
      }
      if (ref?.place) {
        const hits = await nominatimSearch(ref.place);
        if (!hits.length) return null;
        // Same precision-first rule as map_search: a rooftop match beats a
        // higher-"importance" city centroid when the AI names an address.
        const h = hits.find(isRooftopHit) ?? hits[0];
        return { lat: parseFloat(h.lat), lng: parseFloat(h.lon), hit: h };
      }
      if (entity) return { lat: entity.lat, lng: entity.lng };
      const c = mapRef.current?.getCenter();
      return c ? { lat: c.lat, lng: c.lng } : null;
    };

    const resolveMany = async (refs: GeoRef[]) => {
      const out: Array<{ lat: number; lng: number }> = [];
      for (const r of refs) {
        const p = await resolveRef(r);
        if (p) out.push({ lat: p.lat, lng: p.lng });
      }
      return out;
    };

    if (a.type === "place_marker") {
      const p = await resolveRef(a.ref);
      if (!p) return `Could not resolve "${a.ref?.place ?? "that location"}" — give me coordinates or a more specific place.`;
      const anno = addAnnotation(makeAnnotation({
        kind: "marker", label: a.label, lat: p.lat, lng: p.lng,
        note: a.note, category: a.category as MapAnnotation["category"], color: a.color, source: "asher-ai",
      }));
      // A pin the operator can't see is not a pin: frame the target at its own
      // scale and raise the golden card over it with live site detail.
      await focusOn(p.lat, p.lng, p.hit, {
        title: a.label,
        subtitle: a.note ?? p.hit?.display_name,
        badge: a.category?.toUpperCase() ?? hitBadge(p.hit),
        minZoom: p.hit ? 0 : 16,
      });
      return `Marker **${anno.label}** placed at ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)} and framed with the site card.`;
    }


    if (a.type === "add_label") {
      const p = await resolveRef(a.ref);
      if (!p) return `Could not resolve "${a.ref?.place ?? "that location"}".`;
      addAnnotation(makeAnnotation({
        kind: "label", label: a.text, lat: p.lat, lng: p.lng, color: a.color, source: "asher-ai",
      }));
      flyTo(p.lat, p.lng, Math.max(mapRef.current?.getZoom() ?? 0, 12));
      return `Label **${a.text}** placed.`;
    }

    if (a.type === "draw_radius") {
      const p = await resolveRef(a.ref);
      if (!p) return `Could not resolve "${a.ref?.place ?? "that location"}".`;
      const radiusM = Math.max(10, Math.min(a.radiusKm * 1000, 2_000_000));
      const anno = addAnnotation(makeAnnotation({
        kind: "circle", label: a.label, lat: p.lat, lng: p.lng, radiusM,
        note: a.note, category: (a.category as MapAnnotation["category"]) ?? "zone", color: a.color, source: "asher-ai",
      }));
      try {
        mapRef.current?.fitBounds(L.circle([p.lat, p.lng], { radius: radiusM }).getBounds(), { padding: [40, 40] });
      } catch { flyTo(p.lat, p.lng, 11); }
      return `Ring **${anno.label}** drawn — ${annoMetric(anno)}.`;
    }

    if (a.type === "draw_zone") {
      const pts = await resolveMany(a.points || []);
      if (pts.length < 3) return "Need at least 3 resolvable vertices to draw a zone.";
      const anno = addAnnotation(makeAnnotation({
        kind: "polygon", label: a.label, path: pts, note: a.note,
        category: (a.category as MapAnnotation["category"]) ?? "zone", color: a.color, source: "asher-ai",
      }));
      try { mapRef.current?.fitBounds(pts.map((p) => [p.lat, p.lng]) as any, { padding: [40, 40] }); } catch {}
      return `Zone **${anno.label}** drawn — ${annoMetric(anno)}.`;
    }

    if (a.type === "draw_route") {
      const pts = await resolveMany(a.waypoints || []);
      if (pts.length < 2) return "Need at least 2 resolvable waypoints to draw a route.";
      const anno = addAnnotation(makeAnnotation({
        kind: "line", label: a.label, path: pts, note: a.note,
        category: "route", color: a.color, source: "asher-ai",
      }));
      try { mapRef.current?.fitBounds(pts.map((p) => [p.lat, p.lng]) as any, { padding: [40, 40] }); } catch {}
      return `Route **${anno.label}** drawn — ${annoMetric(anno)}.`;
    }

    if (a.type === "measure") {
      const [from, to] = [await resolveRef(a.from), await resolveRef(a.to)];
      if (!from || !to) return "Could not resolve both endpoints for the measurement.";
      const distM = haversineM(from, to);
      // Initial great-circle bearing.
      const φ1 = (from.lat * Math.PI) / 180, φ2 = (to.lat * Math.PI) / 180;
      const Δλ = ((to.lng - from.lng) * Math.PI) / 180;
      const bearing = (
        (Math.atan2(
          Math.sin(Δλ) * Math.cos(φ2),
          Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ),
        ) * 180) / Math.PI + 360
      ) % 360;
      addAnnotation(makeAnnotation({
        kind: "line", label: `Measure · ${fmtDistance(distM)}`, path: [from, to],
        note: `Bearing ${bearing.toFixed(1)}°`, category: "observation", source: "asher-ai",
      }));
      try { mapRef.current?.fitBounds([[from.lat, from.lng], [to.lat, to.lng]] as any, { padding: [60, 60] }); } catch {}
      return `**${fmtDistance(distM)}** · initial bearing **${bearing.toFixed(1)}°**.`;
    }

    if (a.type === "clear_annotations") {
      const scope = (a.scope || "all").trim().toLowerCase();
      let removed = 0;
      mutateAnnotations((prev) => {
        if (scope === "all") { removed = prev.length; return []; }
        if (scope === "last") { removed = prev.length ? 1 : 0; return prev.slice(0, -1); }
        const next = prev.filter((x) => !x.label.toLowerCase().includes(scope));
        removed = prev.length - next.length;
        return next;
      });
      setFocusedAnno(null);
      return removed ? `Removed ${removed} overlay object${removed === 1 ? "" : "s"}.` : "Nothing matched — overlay unchanged.";
    }

    if (a.type === "list_annotations") {
      if (!annotations.length) return "Overlay is empty.";
      const rows = annotations.map((x, i) => {
        const c = annoCenter(x);
        return `| ${i + 1} | ${x.label} | ${x.kind} | ${x.category ?? "—"} | ${c ? `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}` : "—"} | ${annoMetric(x) ?? "—"} |`;
      });
      return `**OVERLAY — ${annotations.length} OBJECT${annotations.length === 1 ? "" : "S"}**\n\n| # | Label | Kind | Class | Centre | Metric |\n|---|---|---|---|---|---|\n${rows.join("\n")}`;
    }

    /* ── Analytical tradecraft ─────────────────────────────────────────
       Every product below is computed from live upstreams (Copernicus GLO-30
       terrain, OSRM road graph, NOAA solar equations) and lands on the map as
       a persisted, provenance-tagged annotation. The returned text is the
       payload the AI reads back on its next autonomous round. */
    if (a.type === "run_viewshed") {
      const p = await resolveRef(a.ref);
      if (!p) return `Could not resolve "${a.ref?.place ?? "that location"}" for a viewshed.`;
      const radiusM = Math.max(200, Math.min((a.radiusKm ?? 5) * 1000, 30_000));
      const eye = Math.max(0, Math.min(a.observerHeightM ?? 2, 500));
      try {
        const res = await computeViewshed({ lat: p.lat, lng: p.lng }, radiusM, eye);
        setViewshedOverlay(res);
        const obsElev = res.observerElevM == null ? "unresolved" : `${Math.round(res.observerElevM)} m`;
        const visPct = Math.round(res.visibleFraction * 100);
        addAnnotation(makeAnnotation({
          kind: "polygon",
          label: a.label || `Viewshed · ${fmtM(radiusM)} @ ${eye} m`,
          path: res.ring,
          note: `Visible ${visPct}% · observer ${obsElev} + ${eye} m AGL · Copernicus GLO-30`,
          category: "zone", color: "#f59e0b", source: "asher-ai",
          // Terrain-only viewshed: it models ground, never buildings or canopy,
          // so it is a strong indication rather than a verified sightline.
          confidence: res.degraded ? 45 : 85,
          role: "viewshed", sourceUrl: "https://www.opentopodata.org/datasets/copernicus/",
        }));
        try { mapRef.current?.fitBounds(res.ring.map((q) => [q.lat, q.lng]) as any, { padding: [40, 40] }); } catch {}
        const sorted = res.rays.slice().sort((x, y) => x.visibleM - y.visibleM);
        const worst = sorted[0], best = sorted[sorted.length - 1];
        return [
          `**VIEWSHED — ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}**`,
          "",
          `| Metric | Value |`, `|---|---|`,
          `| Observer ground elevation | ${obsElev} |`,
          `| Eye height | ${eye} m AGL |`,
          `| Analysis radius | ${fmtM(radiusM)} |`,
          `| Visible fraction | **${visPct}%** |`,
          `| Longest sightline | ${fmtM(best.visibleM)} toward ${compass(best.bearing)} (${best.bearing.toFixed(0)}°) |`,
          `| Most obstructed | ${fmtM(worst.visibleM)} toward ${compass(worst.bearing)} (${worst.bearing.toFixed(0)}°) |`,
          `| DEM coverage | ${Math.round(res.coverage * 100)}% |`,
          "",
          `Terrain: Copernicus GLO-30 DEM, ${res.rays.length} radial rays, earth-curvature and refraction corrected. Bare-earth only — buildings and canopy are not modelled.`,
          res.degraded ? `\n⚠ Degraded: ${res.degraded}` : "",
        ].filter(Boolean).join("\n");

      } catch (e: any) {
        return `Viewshed failed — ${e?.message || "terrain service unreachable"}.`;
      }
    }

    if (a.type === "elevation_profile") {
      const [from, to] = await Promise.all([resolveRef(a.from), resolveRef(a.to)]);
      if (!from || !to) return "Could not resolve both endpoints for an elevation profile.";
      try {
        const prof = await elevationProfile([from, to]);
        const first = prof.samples[0]?.elevM, last = prof.samples[prof.samples.length - 1]?.elevM;
        const m = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v)} m`);
        addAnnotation(makeAnnotation({
          kind: "line", label: a.label || `Profile · ${fmtM(prof.totalM)}`,
          path: [from, to],
          note: `Min ${m(prof.minM)} · Max ${m(prof.maxM)} · gain ${Math.round(prof.gainM)} m · max grade ${prof.maxGradePct.toFixed(1)}%`,
          category: "observation", color: "#0ea5e9", source: "asher-ai",
          confidence: Math.round(prof.coverage * 90), role: "profile",
          sourceUrl: "https://www.opentopodata.org/datasets/copernicus/",
        }));
        try { mapRef.current?.fitBounds([[from.lat, from.lng], [to.lat, to.lng]] as any, { padding: [60, 60] }); } catch {}
        return [
          `**ELEVATION PROFILE — ${fmtM(prof.totalM)}**`, "",
          `| Metric | Value |`, `|---|---|`,
          `| Start / end elevation | ${m(first)} → ${m(last)} |`,
          `| Min / max along path | ${m(prof.minM)} / ${m(prof.maxM)} |`,
          `| Cumulative gain / loss | +${Math.round(prof.gainM)} m / −${Math.round(prof.lossM)} m |`,
          `| Steepest grade | ${prof.maxGradePct.toFixed(1)}% |`,
          `| Samples resolved | ${prof.samples.length} (${Math.round(prof.coverage * 100)}% DEM coverage) |`,
          prof.degraded ? `\n⚠ Degraded: ${prof.degraded}` : "",
        ].filter(Boolean).join("\n");
      } catch (e: any) {
        return `Elevation profile failed — ${e?.message || "terrain service unreachable"}.`;
      }
    }

    if (a.type === "road_route") {
      const [from, to] = await Promise.all([resolveRef(a.from), resolveRef(a.to)]);
      if (!from || !to) return "Could not resolve both endpoints for a road route.";
      try {
        const r = await roadRoute([from, to]);
        addAnnotation(makeAnnotation({
          kind: "line", label: a.label || `Drive · ${fmtM(r.distanceM)} / ${fmtDuration(r.durationS)}`,
          path: r.path, note: `OSRM driving profile · ${r.path.length} geometry points`,
          category: "route", color: "#22c55e", source: "asher-ai",
          confidence: r.degraded ? 40 : 88, role: "roadroute", sourceUrl: "https://project-osrm.org/",
        }));
        try { mapRef.current?.fitBounds(r.path.map((q) => [q.lat, q.lng]) as any, { padding: [40, 40] }); } catch {}
        const straight = haversineM(from, to);
        return [
          `**ROAD ROUTE**`, "",
          `| Metric | Value |`, `|---|---|`,
          `| Driving distance | ${fmtM(r.distanceM)} |`,
          `| Estimated time | ${fmtDuration(r.durationS)} |`,
          `| Straight-line distance | ${fmtM(straight)} |`,
          `| Detour factor | ${(r.distanceM / Math.max(straight, 1)).toFixed(2)}× |`,
          "", `Graph: OSRM public driving profile (OpenStreetMap).`,
          r.degraded ? `\n⚠ Degraded: ${r.degraded}` : "",
        ].filter(Boolean).join("\n");
      } catch (e: any) {
        return `Road routing failed — ${e?.message || "routing service unreachable"}.`;
      }
    }

    if (a.type === "solar_analysis") {
      const p = await resolveRef(a.ref);
      if (!p) return "Could not resolve a location for solar geometry.";
      const when = a.iso ? new Date(a.iso) : new Date();
      if (Number.isNaN(when.getTime())) return "Invalid timestamp for solar analysis.";
      const s = solarPosition({ lat: p.lat, lng: p.lng }, when);
      return [
        `**SOLAR GEOMETRY — ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}**`,
        `${when.toISOString()} (UTC)`, "",
        `| Metric | Value |`, `|---|---|`,
        `| Sun elevation | ${s.elevationDeg.toFixed(2)}° |`,
        `| Sun azimuth | ${s.azimuthDeg.toFixed(2)}° (${compass(s.azimuthDeg)}) |`,
        `| Condition | ${s.isDaylight ? "Daylight" : s.elevationDeg > -6 ? "Civil twilight" : "Night"} |`,
        `| Shadow direction | ${compass(s.shadowBearingDeg)} (${s.shadowBearingDeg.toFixed(1)}°) |`,
        `| Shadow length | ${s.shadowRatio == null ? "n/a — sun below usable altitude" : `${s.shadowRatio.toFixed(2)} × object height`} |`,
        `| Solar declination | ${s.declinationDeg.toFixed(2)}° |`,
        `| Solar noon (UTC) | ${s.solarNoonUtcHours.toFixed(2)} h |`,
        "",
        s.shadowRatio == null
          ? "Shadow-based height recovery is unavailable while the sun is at or below the horizon."
          : `Height recovery: divide a measured shadow length by ${s.shadowRatio.toFixed(2)} to obtain structure height. NOAA solar position algorithm.`,
      ].join("\n");
    }

    if (a.type === "detect_colocation") {
      const radiusM = Math.max(10, Math.min(a.radiusM ?? 250, 20_000));
      const pairs = detectColocations(
        annotations.map((x) => { const c = annoCenter(x); return { id: x.id, label: x.label, lat: c?.lat, lng: c?.lng }; }),
        radiusM,
      );
      if (!pairs.length) return `No overlay objects fall within ${fmtM(radiusM)} of each other.`;
      const shown = pairs.slice(0, 12);
      shown.forEach((pr) => {
        const A = annotations.find((x) => x.id === pr.aId), B = annotations.find((x) => x.id === pr.bId);
        const ca = A && annoCenter(A), cb = B && annoCenter(B);
        if (!ca || !cb) return;
        addAnnotation(makeAnnotation({
          kind: "line", label: `Co-located · ${fmtM(pr.distanceM)}`,
          path: [ca, cb], note: `${pr.aLabel} ↔ ${pr.bLabel}`,
          category: "observation", color: "#a855f7", source: "asher-ai",
          confidence: 70, role: "colocation",
        }));
      });
      return [
        `**CO-LOCATION — ${pairs.length} PAIR${pairs.length === 1 ? "" : "S"} WITHIN ${fmtM(radiusM)}**`, "",
        `| # | Object A | Object B | Separation |`, `|---|---|---|---|`,
        ...shown.map((pr, i) => `| ${i + 1} | ${pr.aLabel} | ${pr.bLabel} | ${fmtM(pr.distanceM)} |`),
        pairs.length > shown.length ? `\n${pairs.length - shown.length} further pair(s) not drawn — narrow the radius.` : "",
      ].filter(Boolean).join("\n");
    }

    if (a.type === "generate_briefing") {
      const caseRec = listCases().find((c) => c.id === caseIdRef.current);
      if (!caseRec) return "No active operation — create a case folder first.";
      const md = buildBriefing({
        caseRec,
        annotations,
        mapCenter: { lat: coord.lat, lng: coord.lng, zoom: coord.zoom },
        baseLayer: activeBase,
        activeLayers: THREAT_IDS.filter((t) => activeThreats[t]),
      });
      appendAudit({ caseId: caseIdRef.current, actor: "asher-ai", action: "generate_briefing", detail: `${annotations.length} objects` });
      return md;
    }

    /* ── Own-force tracking ──────────────────────────────────────────────
       The model can request, read and frame the operator's position, but it
       cannot consent on their behalf: a "start" with no prior consent only
       raises the on-screen prompt and says so. */
    if (a.type === "track_location") {
      const describe = () => {
        const f = track.fix;
        if (!f) return "No fix yet — the sensor is still acquiring.";
        return `Operator at ${f.lat.toFixed(6)}, ${f.lng.toFixed(6)} (±${Math.round(f.accM)} m${f.degraded ? ", degraded" : ""})`
          + `, ${fmtSpeed(f.speedMps)}`
          + (f.headingDeg != null ? ` heading ${compass16(f.headingDeg)} ${Math.round(f.headingDeg)}°` : "")
          + (f.altM != null ? `, altitude ${Math.round(f.altM)} m` : "")
          + `. Fix taken ${new Date(f.ts).toLocaleTimeString()}. Track so far ${fmtDistance(track.stats.distanceM)}.`;
      };

      switch (a.mode) {
        case "start": {
          if (track.status === "unsupported") return "This device exposes no geolocation sensor — tracking is unavailable.";
          if (!track.consent) {
            track.requestFromAI(a.reason || "Live position tracking for map operations");
            return "Consent prompt raised in the My Location panel. Tracking stays off until the operator taps Allow — nothing leaves their device.";
          }
          track.start();
          return track.fix ? `Tracking live. ${describe()}` : "Tracking armed — acquiring first fix.";
        }
        case "stop":
          track.stop();
          return "Tracking stopped. The sensor is closed; the recorded track stays on the operator's device.";
        case "status":
          if (!track.consent) return "Tracking is not authorised — the operator has not granted location consent.";
          return `${track.status === "live" ? "Live" : "Idle"}. ${describe()}`;
        case "center": {
          const f = track.fix;
          if (!f) return "No fix available to center on — request tracking first.";
          flyTo(f.lat, f.lng, Math.max(mapRef.current?.getZoom() ?? 0, 16));
          return `Map centered on the operator. ${describe()}`;
        }
        case "follow":
          track.setFollow(true);
          if (!track.consent) { track.requestFromAI(a.reason || "Follow the operator on the map"); return "Follow armed — awaiting the operator's location consent."; }
          track.start();
          return "Follow mode on. The map recenters on each fix and releases the moment the operator pans by hand.";
        case "unfollow":
          track.setFollow(false);
          return "Follow mode off. The camera stays where the operator puts it.";
        default:
          return "Unrecognised tracking mode.";
      }
    }

    /* FIND-MY — "where's my laptop". The roster is the only namespace the model
       may address; an unmatched name returns the roster rather than guessing. */
    if (a.type === "locate_device") {
      setShowMyDevices(true);
      let rows: LocatedDevice[];
      try {
        rows = await locateGroup(24);
      } catch (e: any) {
        return `Find-My is unavailable right now (${e?.message ?? "unknown error"}).`;
      }
      setMyDevices(rows);
      if (!rows.length) return "You have no claimed devices yet. Tag one in the My Devices panel — it must have been heard within 5 m by your own scanner on two separate days.";

      const needle = (a.name || "").trim().toLowerCase();
      const match = needle
        ? rows.find((d) => d.label.toLowerCase() === needle)
          ?? rows.find((d) => d.label.toLowerCase().includes(needle))
          ?? rows.find((d) => d.kind.toLowerCase() === needle)
        : rows.length === 1 ? rows[0] : undefined;

      if (!match) {
        const list = rows.map((d) => `- ${d.label} (${d.kind}) — ${d.fused ? d.fused.caption : "no sighting in 24 h"}`).join("\n");
        return `Name the device. Your roster:\n${list}`;
      }
      if (!match.fused) {
        return `${match.label} has no sighting in the last 24 hours. Nothing on the mesh has heard it, so I will not invent a position. Last known state: ${match.effectiveState}.`;
      }
      setFocusedDevice(match.fingerprint);
      flyTo(match.fused.lat, match.fused.lng, 17);
      try {
        const { breadcrumb } = await locateDevice(match.fingerprint, 24);
        setDeviceBreadcrumb(breadcrumb);
      } catch { setDeviceBreadcrumb([]); }
      const f = match.fused;
      return `${match.label} — ${f.lat.toFixed(6)}, ${f.lng.toFixed(6)}, confidence ±${f.radiusM} m. ${f.caption}. State: ${match.effectiveState}${match.state === "stolen" ? " (declared stolen — breadcrumb trail is live)" : ""}. Last heard ${fmtAge(f.lastSeenAt)}. Map is on it.`;
    }

    if (a.type === "distance_from_me") {
      const f = track.fix;
      if (!f) return "No operator fix — start tracking before asking for range from your position.";
      const p = await resolveRef(a.to);
      if (!p) return "Could not resolve the destination.";
      const m = haversineM({ lat: f.lat, lng: f.lng }, p);
      const brg = bearingDeg({ lat: f.lat, lng: f.lng }, p);
      const name = a.label || a.to.place || `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
      // ±accuracy is carried through: a range is only as honest as its fix.
      return `${fmtDistance(m)} from your position to ${name}, bearing ${compass16(brg)} ${Math.round(brg)}° (straight line; your fix is ±${Math.round(f.accM)} m). Use road_route for driving distance.`;
    }

    if (a.type === "geofence") {
      const anchor = a.ref ? await resolveRef(a.ref) : (track.fix ? { lat: track.fix.lat, lng: track.fix.lng } : null);
      if (!anchor) return "No anchor for the geofence — give a place, or start tracking to use your own position.";
      const g = track.addFence({ label: a.label, lat: anchor.lat, lng: anchor.lng, radiusM: a.radiusM });
      return `Geofence "${g.label}" armed at ${g.lat.toFixed(5)}, ${g.lng.toFixed(5)} with a ${Math.round(g.radiusM)} m radius. ${
        track.status === "live" ? "Breach alerts are live." : "It will start alerting once tracking is running."
      }`;
    }

    /* ── Navigation & discovery ───────────────────────────────────────────
       The model may only ask for a corridor; the road graph, the POI index
       and the job boards remain the sole authority for what is returned, and
       every failure degrades to an explicit sentence rather than a silent
       empty map. */
    if (a.type === "get_directions") {
      const to = await resolveRef(a.to);
      if (!to) return `Could not resolve the destination "${a.to?.place ?? "that place"}".`;
      const from = a.from
        ? await resolveRef(a.from)
        : (track.fix ? { lat: track.fix.lat, lng: track.fix.lng } : await resolveRef(undefined));
      if (!from) return "No origin — give me a starting place or start location tracking.";
      const res = await getDirections([from, to], { mode: a.mode || "driving", alternatives: true });
      if (!res.routes.length) return "The road graph returned no route between those two points.";
      const best = res.routes[0];
      setSeedDest({ label: a.to?.place || `${to.lat.toFixed(5)}, ${to.lng.toFixed(5)}`, lat: to.lat, lng: to.lng });
      handleRoutes({ routes: res.routes, activeId: best.id, highlight: null });
      if (a.withCameras) void loadCameras({ path: best.path, radiusM: 900 });
      return `${a.mode === "walking" ? "Walking" : a.mode === "cycling" ? "Cycling" : "Driving"} route plotted: ${fmtDistUnits(best.distanceM, units)} · ${fmtDurUnits(best.durationS)}, arriving about ${fmtEta(best.durationS)}${
        res.routes.length > 1 ? ` (${res.routes.length - 1} alternative${res.routes.length > 2 ? "s" : ""} drawn dashed)` : ""
      }.${best.degraded ? ` Caveat: ${best.degraded}` : ""} Source: ${res.attribution}.`;
    }

    if (a.type === "find_nearby") {
      const anchor = await resolveRef(a.ref);
      if (!anchor) return "Could not resolve where to search around.";
      const places = await searchNearby({
        center: anchor,
        category: (a.category as any) || "any",
        query: a.query,
        radiusM: a.radiusM ?? 2000,
        openNowOnly: a.openNow,
      });
      setPlacePins(places);
      setTool("places");
      if (!places.length) return `Nothing matching ${a.query || a.category || "that"} is mapped within ${fmtDistUnits(a.radiusM ?? 2000, units)} of there.`;
      flyTo(anchor.lat, anchor.lng, 15);
      const top = places.slice(0, 5).map((p) => `${p.name}${p.distanceM !== undefined ? ` (${fmtDistUnits(p.distanceM, units)})` : ""}`).join("; ");
      return `${places.length} pinned within ${fmtDistUnits(a.radiusM ?? 2000, units)}. Closest: ${top}. Source: OpenStreetMap live query.`;
    }

    if (a.type === "find_jobs") {
      const anchor = await resolveRef(a.ref);
      if (!anchor) return "Could not resolve where to run the hiring sweep.";
      const byok = getActiveIntelMapByok();
      const { data, error } = await supabase.functions.invoke("asher-jobs-nearby", {
        body: { role: a.role, lat: anchor.lat, lng: anchor.lng, radiusMi: a.radiusMi ?? 10, ...(byok ? { byok: byok.apiKey } : {}) },
      });
      if (error) return `Job sweep failed: ${error.message}`;
      if (!data?.success) return `Job sweep failed: ${data?.error || "boards unreachable"}.`;
      const jobs: JobPosting[] = Array.isArray(data.jobs) ? data.jobs : [];
      setJobPins(jobs);
      setTool("jobs");
      if (!jobs.length) return `No live "${a.role}" postings surfaced within ${a.radiusMi ?? 10} mi of there right now.`;
      flyTo(anchor.lat, anchor.lng, 13);
      const top = jobs.slice(0, 5).map((j) => `${j.employer} — ${j.title}${j.pay ? ` (${j.pay})` : ""}`).join("; ");
      return `${jobs.length} live "${a.role}" postings within ${a.radiusMi ?? 10} mi. Top: ${top}. Each pin carries its source and apply link.`;
    }

    if (a.type === "street_cameras") {
      const active = routeLayer.routes.find((r) => r.id === routeLayer.activeId);
      if (a.alongRoute && active) {
        await loadCameras({ path: active.path, radiusM: a.radiusM ?? 900 });
        return `Camera sweep run along the plotted corridor. Click any camera pin for its live frame.`;
      }
      const anchor = await resolveRef(a.ref);
      if (!anchor) return "Could not resolve where to sweep for cameras.";
      await loadCameras({ center: anchor, radiusM: a.radiusM ?? 4000 });
      return `Camera sweep run around ${anchor.lat.toFixed(5)}, ${anchor.lng.toFixed(5)}. Public agency feeds only — click a pin for the live frame.`;
    }

    /* ── Cloud Intelligence overlays ─────────────────────────────────────
       The map is the spatial canvas for the user's Cloud Intelligence.
       Contacts, calendar venues, and security signals are geocoded and plotted
       as distinct layers with provenance-tagged popups. */
    if (a.type === "plot_cloud_contacts") {
      const limit = Math.max(1, Math.min(a.limit ?? 50, 200));
      const layer = await loadCloudMapLayer({ contacts: true, venues: false, security: false, relationships: true, limit });
      setCloudLayer((prev) => ({ ...prev, contacts: layer.contacts, relationships: layer.relationships }));
      setActiveCloud((prev) => ({ ...prev, "cloud-contacts": true, "cloud-relationships": true }));
      if (!layer.contacts.length) return "No contact dossiers with geocodable locations found in Cloud Intelligence.";
      if (layer.contacts.length === 1) flyTo(layer.contacts[0].lat, layer.contacts[0].lng, 14);
      else fitFeatures(layer.contacts);
      return `Plotted ${layer.contacts.length} contact dossiers and ${layer.relationships.length} inferred relationship links from Cloud Intelligence.`;
    }
    if (a.type === "plot_cloud_venues") {
      const layer = await loadCloudMapLayer({ contacts: false, venues: true, security: false, relationships: false });
      setCloudLayer((prev) => ({ ...prev, venues: layer.venues }));
      setActiveCloud((prev) => ({ ...prev, "cloud-venues": true }));
      if (!layer.venues.length) return "No calendar venues or movement forecasts with geocodable locations found.";
      fitFeatures(layer.venues);
      return `Plotted ${layer.venues.length} calendar venues / movement forecasts from Cloud Intelligence.`;
    }
    if (a.type === "plot_cloud_security") {
      const layer = await loadCloudMapLayer({ contacts: false, venues: false, security: true, relationships: false, sinceDays: a.sinceDays ?? 30 });
      setCloudLayer((prev) => ({ ...prev, security: layer.security }));
      setActiveCloud((prev) => ({ ...prev, "cloud-security": true }));
      if (!layer.security.length) return "No security events or signals with geocodable locations in the selected window.";
      fitFeatures(layer.security);
      return `Plotted ${layer.security.length} security events / signals from Cloud Intelligence.`;
    }
    if (a.type === "focus_cloud_contact") {
      const { email, name } = a;
      if (!email && !name) return "Need an email or name to focus a Cloud Intelligence contact.";
      const layer = await loadCloudMapLayer({ contacts: true, limit: 200 });
      const match = layer.contacts.find((c) =>
        (email && c.subjectEmail && c.subjectEmail.toLowerCase() === email.toLowerCase()) ||
        (name && c.label.toLowerCase().includes(name.toLowerCase()))
      );
      if (!match) return `No geocodable contact matching ${email || name} in Cloud Intelligence.`;
      setCloudLayer((prev) => ({ ...prev, contacts: layer.contacts }));
      setActiveCloud((prev) => ({ ...prev, "cloud-contacts": true }));
      flyTo(match.lat, match.lng, 16);
      return `Focused on ${match.label} — ${match.caption}. Source: ${match.source}.`;
    }

  };

  /* Horizontal space the right-hand docks occupy, so the top bar never renders
     controls underneath the Asher AI dock (380px) or the dossier (420px). */
  const rightDockPx =
    entity && showDossier ? 432 : aiDocked ? 392 : 12;

  return (
    <div className="relative flex h-full w-full bg-background">
      {/* LEFT LAYER PANEL — resizable, collapsible, searchable */}
      <div
        className="flex h-full min-h-0 flex-col overflow-hidden border-r border-border/15 bg-card/30 backdrop-blur-md"
        style={{ width: sidebar.collapsed ? 0 : sidebar.width, minWidth: sidebar.collapsed ? 0 : undefined }}
        aria-hidden={sidebar.collapsed}
      >
        <div className="border-b border-border/15 px-5 py-4 flex items-center gap-3">
          <LayersIcon className="h-5 w-5 text-muted-foreground shrink-0" strokeWidth={1.5} />
          <p className="text-sm font-medium tracking-[0.2em] text-muted-foreground uppercase truncate">Layer Tree</p>
          <button
            onClick={toggleSidebar}
            aria-label="Collapse layer tree"
            className="ml-auto rounded p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
        <div className="border-b border-border/10 px-3 py-2">
          <input
            value={layerFilter}
            onChange={(e) => setLayerFilter(e.target.value)}
            placeholder="Filter layers…"
            aria-label="Filter layers"
            className="w-full rounded-md border border-border/25 bg-background/50 px-2 py-1.5 text-[11px] font-light text-foreground outline-none focus:border-[#c98b3a]/50"
          />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 text-sm">
          {LAYER_TREE.map((cat) => {
            const needle = layerFilter.trim().toLowerCase();
            // A filter must not hide the answer behind a collapsed header, so a
            // matching category force-opens while the query is live.
            const layers = needle
              ? cat.layers.filter((l) => l.label.toLowerCase().includes(needle))
              : cat.layers;
            if (!layers.length) return null;
            const open = needle ? true : !!openCats[cat.id];
            return (
              <div key={cat.id} className="mb-2">
                <button
                  onClick={() => toggleCat(cat.id)}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left hover:bg-foreground/5"
                >
                  {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-xs font-medium tracking-[0.12em] text-foreground/90 uppercase">{cat.label}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/60">{layers.length}</span>
                </button>
                {open && (
                  <div className="ml-6 mt-1 space-y-1">
                    {layers.map((l) => {
                      const isBase = cat.id === "base";
                      const isThreat = (THREAT_IDS as readonly string[]).includes(l.id);
                      const isBoundary = l.id === "borders-intl";
                      const isMyDevices = l.id === "my-devices";
                      const isCloud = cat.id === "cloud-intel";
                      const isActive = isBase
                        ? l.id === activeBase
                        : isThreat ? !!activeThreats[l.id as ThreatId]
                        : isBoundary ? showTacticalBorders
                        : isMyDevices ? showMyDevices
                        : isCloud ? !!activeCloud[l.id]
                        : false;
                      return (
                        <button
                          key={l.id}
                          onClick={() => {
                            if (l.status !== "live") return;
                            if (isBase) setActiveBase(l.id);
                            else if (isThreat) setActiveThreats((p) => ({ ...p, [l.id]: !p[l.id as ThreatId] }));
                            else if (isBoundary) setShowTacticalBorders((p) => !p);
                            else if (isMyDevices) setShowMyDevices((p) => !p);
                            else if (isCloud) {
                              setActiveCloud((p) => ({ ...p, [l.id]: !p[l.id] }));
                              void refreshCloudLayer(l.id);
                            }
                          }}
                          disabled={l.status !== "live"}
                          className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left transition-colors ${
                            isActive ? "bg-foreground/10 text-foreground"
                            : l.status === "live" ? "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                            : "text-muted-foreground/40 cursor-not-allowed"
                          }`}
                        >
                          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${
                            l.status === "live" ? (isActive ? "bg-emerald-400" : "bg-emerald-400/40") : "bg-muted-foreground/30"
                          }`} />
                          <span className="text-sm font-light flex-1 truncate">{l.label}</span>
                          {l.status === "soon" && (
                            <span className="text-[10px] tracking-[0.15em] text-muted-foreground/40 uppercase">Soon</span>
                          )}
                          {isThreat && isActive && (
                            <span className="text-[10px] tracking-[0.15em] text-emerald-400/80 uppercase">{threatData[l.id as ThreatId]?.length ?? 0}</span>
                          )}
                          {isCloud && isActive && (
                            <span className="text-[10px] tracking-[0.15em] text-emerald-400/80 uppercase">
                              {l.id === "cloud-contacts" ? cloudLayer.contacts.length
                                : l.id === "cloud-venues" ? cloudLayer.venues.length
                                : l.id === "cloud-security" ? cloudLayer.security.length
                                : l.id === "cloud-relationships" ? cloudLayer.relationships.length
                                : 0}
                            </span>
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

        {showMyDevices && (
          <MyDevicesPanel
            devices={myDevices}
            loading={myDevicesLoading}
            focused={focusedDevice}
            onRefresh={refreshMyDevices}
            onFocus={focusDevice}
            onFitAll={fitAllDevices}
            onRoute={routeToDevice}
          />
        )}

        <AnnotationPanel
          annotations={annotations}
          drawMode={drawMode}
          draftPath={draftPath}
          onSetDrawMode={(m) => { setDrawMode(m); setDraftPath([]); }}
          onFinishDraft={finishDraft}
          onCancelDraft={() => { setDrawMode("none"); setDraftPath([]); }}
          onDelete={(id) => { mutateAnnotations((p) => p.filter((x) => x.id !== id), { action: "delete", detail: id }); setFocusedAnno((f) => (f === id ? null : f)); }}
          onRename={(id, label) => mutateAnnotations((p) => p.map((x) => (x.id === id ? { ...x, label, updatedAt: Date.now() } : x)), { action: "rename", detail: label })}
          onClear={() => { mutateAnnotations(() => [], { action: "clear_all" }); setFocusedAnno(null); setViewshedOverlay(null); }}
          onFocus={focusAnnotation}
        />

        <AnalysisPanel
          focus={entity ? { lat: entity.lat, lng: entity.lng } : { lat: coord.lat, lng: coord.lng }}
          annotations={annotations}
          activeCaseId={activeCaseId}
          mapCenter={coord}
          baseLayer={activeBase}
          activeLayers={THREAT_IDS.filter((t) => activeThreats[t])}
          onAddAnnotation={addAnnotation}
          onViewshed={setViewshedOverlay}
          onSwitchCase={switchCase}
          onRestoreSnapshot={(list) => { mutateAnnotations(() => list, { action: "restore_snapshot", detail: `${list.length} objects` }); setFocusedAnno(null); }}
          onFlyTo={flyTo}
        />

        <SelfTrackPanel track={track} mapCenter={{ lat: coord.lat, lng: coord.lng }} />
      </div>

      {/* RESIZE RAIL — pointer drag, arrow-key nudge, double-click reset */}
      {!sidebar.collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize layer tree"
          aria-valuenow={sidebar.width}
          aria-valuemin={SIDEBAR_MIN}
          aria-valuemax={SIDEBAR_MAX}
          tabIndex={0}
          onPointerDown={startResize}
          onDoubleClick={() => nudgeWidth(SIDEBAR_DEFAULT - sidebar.width)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") { e.preventDefault(); nudgeWidth(-24); }
            if (e.key === "ArrowRight") { e.preventDefault(); nudgeWidth(24); }
          }}
          className="z-[1001] w-1.5 shrink-0 cursor-col-resize bg-border/20 transition-colors hover:bg-[#c98b3a]/60 focus-visible:bg-[#c98b3a]/80 focus-visible:outline-none"
        />
      )}







      {/* MAP COLUMN */}
      <div className="relative flex-1">
        {/* TOP BAR */}
        <div
          className="absolute top-3 left-3 z-[1000] flex items-center gap-2 transition-[right] duration-200 motion-reduce:transition-none"
          style={{ right: rightDockPx }}
        >
          <div className="flex min-w-0 flex-1 max-w-md items-center gap-2 rounded-xl border border-border/30 bg-card/85 backdrop-blur-md px-3 py-2">
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
          {sidebar.collapsed && (
            <button
              onClick={toggleSidebar}
              aria-label="Open layer tree"
              className="rounded-xl border border-border/30 bg-card/85 px-2.5 py-2 text-muted-foreground backdrop-blur-md hover:text-foreground"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </button>
          )}
          <div className="flex shrink-0 flex-nowrap items-center gap-1 rounded-xl border border-border/30 bg-card/85 px-1.5 py-1.5 backdrop-blur-md">
            {([
              { id: "directions" as const, label: "Directions", Icon: Navigation2 },
              { id: "places" as const, label: "Explore nearby", Icon: Utensils },
              { id: "jobs" as const, label: "Hiring nearby", Icon: Briefcase },
            ]).map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => { setTool((t) => (t === id ? null : id)); if (id !== "directions") setSeedDest(null); }}
                aria-pressed={tool === id}
                title={label}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] transition-colors ${
                  tool === id ? "bg-[#c98b3a]/20 text-[#e0a955]" : "text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.6} />
                <span className="hidden 2xl:inline">{label}</span>
              </button>
            ))}
            <button
              onClick={() => (cameras.length ? setCameras([]) : loadCameras({ center: mapCenter(), radiusM: 4000 }))}
              aria-pressed={cameras.length > 0}
              title="Live street cameras"
              disabled={cameraBusy}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] transition-colors disabled:opacity-50 ${
                cameras.length ? "bg-[#c98b3a]/20 text-[#e0a955]" : "text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              }`}
            >
              {cameraBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" /> : <CameraIcon className="h-3.5 w-3.5" strokeWidth={1.6} />}
              <span className="hidden 2xl:inline">Cameras{cameras.length ? ` · ${cameras.length}` : ""}</span>
            </button>
          </div>
          <div className="ml-auto hidden rounded-xl border border-border/30 bg-card/85 backdrop-blur-md px-3 py-2 text-[10px] font-light tracking-[0.15em] text-muted-foreground uppercase xl:block">
            Live · OSM · Esri · Nominatim · OSRM · Overpass · Open-Meteo · DOT CCTV
          </div>
        </div>

        {/* TOOL PANELS */}
        <div className="pointer-events-none absolute right-3 top-16 z-[1000] flex flex-col items-end gap-2">
          <div className="pointer-events-auto">
            <DirectionsPanel
              open={tool === "directions"}
              onClose={() => { setTool(null); setSeedDest(null); setRouteLayer({ routes: [], activeId: null, highlight: null }); }}
              units={units}
              onUnitsChange={changeUnits}
              myFix={track.fix ? { lat: track.fix.lat, lng: track.fix.lng } : null}
              onRequestMyLocation={() => track.start()}
              seedDestination={seedDest}
              geocode={geocodeEndpoint}
              onRoutes={handleRoutes}
              onCameras={setCameras}
              onFitPath={(path) => {
                if (path.length > 1 && mapRef.current) {
                  mapRef.current.fitBounds(L.latLngBounds(path.map((p) => [p.lat, p.lng] as [number, number])), { padding: [60, 60], maxZoom: 16 });
                }
              }}
            />
          </div>
          <div className="pointer-events-auto">
            <PlacesNearbyPanel
              open={tool === "places"}
              onClose={() => { setTool(null); setPlacePins([]); }}
              center={mapCenter()}
              units={units}
              onResults={setPlacePins}
              onFocus={(p) => flyTo(p.lat, p.lng, 18)}
              onRoute={(p) => openDirectionsTo({ label: p.name, lat: p.lat, lng: p.lng })}
            />
          </div>
          <div className="pointer-events-auto">
            <JobsNearbyPanel
              open={tool === "jobs"}
              onClose={() => { setTool(null); setJobPins([]); }}
              center={mapCenter()}
              units={units}
              onResults={setJobPins}
              onFocus={(j) => { if (j.lat !== undefined && j.lng !== undefined) flyTo(j.lat, j.lng, 17); }}
              onRoute={(j) => { if (j.lat !== undefined && j.lng !== undefined) openDirectionsTo({ label: j.employer, lat: j.lat, lng: j.lng }); }}
            />
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
          /* Canvas rendering: SVG vector layers stall past ~2k features, and an
             elite overlay routinely carries recon detections plus a 36-ray
             viewshed ring. Canvas holds 60fps under that load. */
          preferCanvas
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

          {/* ROUTE CORRIDOR — alternatives sit underneath the active line so a
              click always lands on the route the operator is following. */}
          {routeLayer.routes.map((r) => (
            r.id === routeLayer.activeId ? null : (
              <Polyline
                key={`alt-${r.id}`}
                positions={r.path.map((p) => [p.lat, p.lng] as [number, number])}
                pathOptions={{ color: "#8b8b8b", weight: 4, opacity: 0.5, dashArray: "6 8" }}
              />
            )
          ))}
          {routeLayer.routes
            .filter((r) => r.id === routeLayer.activeId)
            .map((r) => (
              <Polyline
                key={`act-${r.id}`}
                positions={r.path.map((p) => [p.lat, p.lng] as [number, number])}
                pathOptions={{ color: "#c98b3a", weight: 6, opacity: 0.95 }}
              >
                <Popup>
                  <div className="min-w-[170px] space-y-1 text-xs">
                    <div className="font-semibold">{r.summary || "Route"}</div>
                    <div>{fmtDistUnits(r.distanceM, units)} · {fmtDurUnits(r.durationS)}</div>
                    <div className="opacity-70">Arrive ~{fmtEta(r.durationS)}</div>
                    {r.degraded && <div className="text-amber-500">{r.degraded}</div>}
                  </div>
                </Popup>
              </Polyline>
            ))}
          {routeLayer.highlight && routeLayer.highlight.length > 1 && (
            <Polyline
              positions={routeLayer.highlight.map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{ color: "#ffe0a3", weight: 9, opacity: 0.85 }}
            />
          )}

          {/* LIVE STREET CAMERAS */}
          <StreetCameraLayer cameras={cameras} />

          {/* NEARBY PLACES */}
          {placePins.map((p) => (
            <CircleMarker
              key={`place-${p.id}`}
              center={[p.lat, p.lng]}
              radius={6}
              pathOptions={{ color: "#0b1220", weight: 2, fillColor: "#c98b3a", fillOpacity: 0.95 }}
            >
              <Popup>
                <div className="min-w-[190px] space-y-1 text-xs">
                  <div className="font-semibold">{p.name}</div>
                  {p.address && <div className="opacity-80">{p.address}</div>}
                  {p.openNow !== null && p.openNow !== undefined && (
                    <div className={p.openNow ? "text-emerald-600" : "text-red-500"}>{p.openNow ? "Open now" : "Closed now"}</div>
                  )}
                  {p.phone && <a href={`tel:${p.phone}`} className="block underline">{p.phone}</a>}
                  {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer" className="block underline">Website</a>}
                  <div className="flex gap-2 pt-1">
                    <button className="underline" onClick={() => openDirectionsTo({ label: p.name, lat: p.lat, lng: p.lng })}>Directions</button>
                    <a className="underline" href={streetViewUrl(p.lat, p.lng)} target="_blank" rel="noopener noreferrer">Street view</a>
                  </div>
                  <div className="text-[10px] opacity-60">OpenStreetMap · live query</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {/* HIRING PINS */}
          {jobPins.filter((j) => j.lat !== undefined && j.lng !== undefined).map((j, i) => (
            <CircleMarker
              key={`job-${j.applyUrl || j.employer}-${i}`}
              center={[j.lat as number, j.lng as number]}
              radius={6}
              pathOptions={{ color: "#0b1220", weight: 2, fillColor: "#34d399", fillOpacity: 0.95 }}
            >
              <Popup>
                <div className="min-w-[200px] space-y-1 text-xs">
                  <div className="font-semibold">{j.title}</div>
                  <div className="opacity-80">{j.employer}</div>
                  {j.address && <div className="opacity-70">{j.address}</div>}
                  {j.pay && <div className="text-emerald-600">{j.pay}</div>}
                  {j.applyUrl && <a href={j.applyUrl} target="_blank" rel="noopener noreferrer" className="block underline">Apply · {j.source}</a>}
                  <button className="underline" onClick={() => openDirectionsTo({ label: j.employer, lat: j.lat as number, lng: j.lng as number })}>Directions</button>
                </div>
              </Popup>
            </CircleMarker>
          ))}

          {showMyDevices && (
            <MyDevicesLayer
              devices={myDevices}
              focusedFingerprint={focusedDevice}
              breadcrumb={focusedDevice ? deviceBreadcrumb : []}
              onFocus={focusDevice}
              onRoute={routeToDevice}
            />
          )}

          <MapClick onClick={handleMapClick} />
          <FollowGuard active={track.follow && track.status === "live"} onRelease={() => track.setFollow(false)} />
          <SelfLocationLayer
            fix={track.fix}
            trail={track.trail}
            fences={track.fences}
            onRemoveFence={track.removeFence}
          />

          {focusPin && (
            <MapFocusPin
              key={`${focusPin.lat},${focusPin.lng}`}
              target={focusPin}
              rows={focusPinRows}
              loading={!!entity?.loading}
              onClose={() => setFocusPin(null)}
            />
          )}

          <MapAnnotationLayer
            annotations={annotations}
            draftPath={draftPath}
            drawMode={drawMode}
            focusedId={focusedAnno}
            onSelect={(id) => setFocusedAnno(id)}
            onDelete={(id) => { mutateAnnotations((p) => p.filter((x) => x.id !== id), { action: "delete", detail: id }); setFocusedAnno((f) => (f === id ? null : f)); }}
          />
          {/* Viewshed observer: the ring itself persists as an annotation; this
              marks where the sensor actually stands so the product is readable. */}
          {viewshedOverlay && (
            <CircleMarker
              center={[viewshedOverlay.observer.lat, viewshedOverlay.observer.lng]}
              radius={5}
              pathOptions={{ color: "#f59e0b", weight: 2, fillColor: "#f59e0b", fillOpacity: 0.9 }}
            >
              <Popup>
                <div className="text-[11px] space-y-0.5">
                  <div className="font-medium">Viewshed observer</div>
                  <div className="opacity-70">eye {viewshedOverlay.observerHeightM} m AGL · ground {Math.round(viewshedOverlay.observerElevM)} m</div>
                  <div className="opacity-70">visible {viewshedOverlay.visibleFraction}% of {fmtM(viewshedOverlay.radiusM)} radius</div>
                </div>
              </Popup>
            </CircleMarker>
          )}

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

          {/* Cloud Intelligence overlays */}
          {activeCloud["cloud-contacts"] && cloudLayer.contacts.map((f) => (
            <CircleMarker
              key={f.id}
              center={[f.lat, f.lng]}
              radius={Math.max(5, 6 + f.confidence * 5)}
              pathOptions={{ color: "#0b1220", weight: 2, fillColor: "#8b5cf6", fillOpacity: 0.85 }}
            >
              <Popup>
                <div className="min-w-[220px] space-y-1.5 text-xs">
                  <div className="font-semibold">{f.label}</div>
                  <div className="opacity-80">{f.caption}</div>
                  <div className="opacity-70">Confidence: {(f.confidence * 100).toFixed(0)}%</div>
                  {f.subjectName && f.subjectName !== f.label && <div className="opacity-80">{f.subjectName}</div>}
                  {f.subjectEmail && <div className="opacity-80 font-mono text-[10px]">{f.subjectEmail}</div>}
                  <div className="text-[10px] opacity-50">Source: {f.source}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
          {activeCloud["cloud-venues"] && cloudLayer.venues.map((f) => (
            <CircleMarker
              key={f.id}
              center={[f.lat, f.lng]}
              radius={Math.max(5, 6 + (f.confidence ?? 0.5) * 5)}
              pathOptions={{ color: "#0b1220", weight: 2, fillColor: "#f59e0b", fillOpacity: 0.85 }}
            >
              <Popup>
                <div className="min-w-[220px] space-y-1 text-xs">
                  <div className="font-semibold">{f.label}</div>
                  <div className="opacity-80">{f.caption}</div>
                  {f.payload?.nextPredicted && <div className="text-emerald-400">Predicted next: {f.payload.nextPredicted}</div>}
                  <div className="text-[10px] opacity-50">Source: {f.source}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
          {activeCloud["cloud-security"] && cloudLayer.security.map((f) => (
            <CircleMarker
              key={f.id}
              center={[f.lat, f.lng]}
              radius={Math.max(5, 6 + (f.confidence ?? 0.5) * 6)}
              pathOptions={{ color: "#0b1220", weight: 2, fillColor: "#ef4444", fillOpacity: 0.8 }}
            >
              <Popup>
                <div className="min-w-[220px] space-y-1 text-xs">
                  <div className="font-semibold text-red-400">{f.label}</div>
                  <div className="opacity-80">{f.caption}</div>
                  {f.occurredAt && <div className="opacity-70">{new Date(f.occurredAt).toLocaleString()}</div>}
                  <div className="text-[10px] opacity-50">Source: {f.source}</div>
                </div>
              </Popup>
            </CircleMarker>
          ))}
          {activeCloud["cloud-relationships"] && cloudLayer.relationships.map((f) => (
            f.to && (
              <Polyline
                key={f.id}
                positions={[[f.lat, f.lng], [f.to.lat, f.to.lng]]}
                pathOptions={{ color: "#8b5cf6", weight: 2, opacity: 0.6, dashArray: "4 4" }}
              />
            )
          ))}
        </MapContainer>

        {/* Always-visible tracking indicator. A live sensor must never be
            hidden behind a collapsed panel — the operator has to be able to
            see, at a glance, that their own position is being read. */}
        {track.status === "live" && (
          <div className="pointer-events-none absolute top-3 right-3 z-[1001] flex items-center gap-2 rounded-xl border border-sky-400/40 bg-card/90 px-3 py-1.5 backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400 animate-pulse motion-reduce:animate-none" />
            <span className="text-[10px] font-light uppercase tracking-[0.2em] text-sky-300">
              Tracking{track.fix ? ` · ±${Math.round(track.fix.accM)} m` : " · acquiring"}
            </span>
          </div>
        )}


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

        {/* CINEMATIC DOSSIER TOGGLE */}
        {entity && (
          <button
            onClick={() => setShowDossier((v) => !v)}
            className={`absolute bottom-3 left-[360px] z-[1001] flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-light tracking-[0.2em] uppercase backdrop-blur-md transition-colors ${
              showDossier
                ? "border-amber-400/40 bg-amber-400/10 text-amber-200"
                : "border-border/30 bg-card/85 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
            title="Cinematic Dossier — ownership, financial, social graph, prediction"
          >
            <span className="font-mono">◈</span>
            Dossier
          </button>
        )}

        {/* CINEMATIC DOSSIER PANEL */}
        {entity && showDossier && (
          <CinematicDossierPanel
            address={
              entity.hit?.display_name ||
              `${entity.lat.toFixed(5)}, ${entity.lng.toFixed(5)}`
            }
            lat={entity.lat}
            lng={entity.lng}
            loading={propertyIntel.loading}
            intel={propertyIntel.intel as any}
            error={propertyIntel.error === "BYOK_REQUIRED"
              ? "Property intel requires your own AI key. Open Settings → AI Keys."
              : propertyIntel.error}
            sources={propertyIntel.sources as any}
            onClose={() => setShowDossier(false)}
            onRescan={() => fetchPropertyIntel(entity.lat, entity.lng, entity.hit, entity.features)}
          />
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
        {/* MAP CONTROLS — zoom, recenter on operator, copy/share the view */}
        <div className="absolute bottom-24 right-3 z-[1000] flex flex-col gap-1.5">
          <div className="flex flex-col overflow-hidden rounded-xl border border-border/30 bg-card/85 backdrop-blur-md">
            <button onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in" className="px-2.5 py-2 text-muted-foreground hover:bg-foreground/10 hover:text-foreground">
              <Plus className="h-4 w-4" />
            </button>
            <div className="h-px bg-border/30" />
            <button onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out" className="px-2.5 py-2 text-muted-foreground hover:bg-foreground/10 hover:text-foreground">
              <Minus className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => {
              if (track.fix) { flyTo(track.fix.lat, track.fix.lng, Math.max(mapRef.current?.getZoom() ?? 15, 16)); track.setFollow(true); }
              else track.start();
            }}
            aria-label="Centre on my location"
            title={track.fix ? "Centre on my location" : "Start location tracking"}
            className={`rounded-xl border px-2.5 py-2 backdrop-blur-md transition-colors ${
              track.follow && track.status === "live"
                ? "border-[#c98b3a]/50 bg-[#c98b3a]/20 text-[#e0a955]"
                : "border-border/30 bg-card/85 text-muted-foreground hover:text-foreground"
            }`}
          >
            <LocateFixed className="h-4 w-4" />
          </button>
          <button
            onClick={async () => {
              const c = mapCenter();
              const text = `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`;
              try { await navigator.clipboard.writeText(text); toast.success(`Copied ${text}`); }
              catch { toast.error("Clipboard blocked by the browser."); }
            }}
            aria-label="Copy centre coordinates"
            title="Copy centre coordinates"
            className="rounded-xl border border-border/30 bg-card/85 px-2.5 py-2 text-muted-foreground backdrop-blur-md hover:text-foreground"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={async () => {
              const c = mapCenter();
              const z = Math.round(mapRef.current?.getZoom() ?? coord.zoom);
              const url = `${window.location.origin}${window.location.pathname}?lat=${c.lat.toFixed(6)}&lng=${c.lng.toFixed(6)}&z=${z}&base=${activeBase}`;
              try { await navigator.clipboard.writeText(url); toast.success("Map view link copied."); }
              catch { toast.error("Clipboard blocked by the browser."); }
            }}
            aria-label="Copy a link to this view"
            title="Copy a link to this view"
            className="rounded-xl border border-border/30 bg-card/85 px-2.5 py-2 text-muted-foreground backdrop-blur-md hover:text-foreground"
          >
            <Share2 className="h-4 w-4" />
          </button>
          <a
            href={streetViewUrl(coord.lat, coord.lng)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open street-level imagery here"
            title="Street-level imagery at map centre"
            className="rounded-xl border border-border/30 bg-card/85 px-2.5 py-2 text-muted-foreground backdrop-blur-md hover:text-foreground"
          >
            <Eye className="h-4 w-4" />
          </a>
        </div>

        <div className="absolute bottom-3 right-3 z-[1000] rounded-xl border border-border/30 bg-card/85 backdrop-blur-md px-3 py-2 text-[10px] font-light tracking-wide text-muted-foreground space-y-0.5">
          <p><span className="text-muted-foreground/50">LAT/LNG:</span> {fmtCoord(coord.lat, coord.lng)}</p>
          <p><span className="text-muted-foreground/50">ZOOM:</span> {coord.zoom.toFixed(0)}</p>
          <p><span className="text-muted-foreground/50">SCALE:</span> 1:{Math.round(591657550.5 / Math.pow(2, coord.zoom)).toLocaleString()}</p>
          <button
            onClick={() => changeUnits(units === "imperial" ? "metric" : "imperial")}
            className="pt-0.5 uppercase tracking-[0.18em] text-[9px] text-muted-foreground/70 hover:text-foreground"
          >
            Units · {units === "imperial" ? "mi / ft" : "km / m"}
          </button>
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
        <AsherAIPanel mapContext={mapContext} onAction={handleAIAction} onDockedChange={setAiDocked} />
      </div>
    </div>
  );
};

export default IntelligenceMapModule;
