import { useMemo, useState, useEffect, useCallback } from "react";
import { MapPin, Globe, Layers, Radio, Navigation, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface LocationEntity {
  type: string;
  value: string;
  confidence: number;
  lat?: number;
  lng?: number;
  label?: string;
}

interface NomadMapLayerProps {
  entities: { type: string; value: string; confidence: number; source?: string }[];
  investigations: { query: string; findings: string; created_at: string }[];
}

// Nominatim (OpenStreetMap) geocoding — LIVE
async function geocodeWithNominatim(query: string): Promise<{ lat: number; lng: number; display: string } | null> {
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&addressdetails=0`,
      { headers: { "User-Agent": "AUREON-NOMAD/3.0 (research@aureon.ai)" } }
    );
    if (!resp.ok) return null;
    const results = await resp.json();
    if (results.length === 0) return null;
    return {
      lat: parseFloat(results[0].lat),
      lng: parseFloat(results[0].lon),
      display: results[0].display_name,
    };
  } catch {
    return null;
  }
}

// Try to extract coordinates from entity values
function parseCoordinates(value: string): { lat: number; lng: number } | null {
  const coordMatch = value.match(/(-?\d{1,3}\.\d{3,8}),\s*(-?\d{1,3}\.\d{3,8})/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }
  const latMatch = value.match(/lat(?:itude)?[:\s]*(-?\d{1,3}\.\d{3,8})/i);
  const lngMatch = value.match(/(?:lng|lon(?:gitude)?)[:\s]*(-?\d{1,3}\.\d{3,8})/i);
  if (latMatch && lngMatch) {
    return { lat: parseFloat(latMatch[1]), lng: parseFloat(lngMatch[1]) };
  }
  return null;
}

// Cache for geocoding results
const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

const NomadMapLayer = ({ entities, investigations }: NomadMapLayerProps) => {
  const [selectedPin, setSelectedPin] = useState<LocationEntity | null>(null);
  const [layerFilter, setLayerFilter] = useState<string>("all");
  const [locationEntities, setLocationEntities] = useState<LocationEntity[]>([]);
  const [geocoding, setGeocoding] = useState(false);

  // Extract location candidates from entities and investigation text
  const locationCandidates = useMemo(() => {
    const locTypes = ["location", "us_location", "coordinates", "geo_coordinate", "cell_tower", "ip_address"];
    const candidates: LocationEntity[] = [];
    const seen = new Set<string>();

    for (const e of entities) {
      if (locTypes.includes(e.type) || e.type === "organization" || e.type === "institution") {
        const key = `${e.type}:${e.value}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const coords = parseCoordinates(e.value);
        if (coords) {
          candidates.push({ ...e, ...coords, label: e.value });
        } else if (locTypes.includes(e.type) || e.type === "organization" || e.type === "institution") {
          candidates.push({ ...e, label: e.value });
        }
      }
    }

    // Extract location mentions from investigation text
    for (const inv of investigations) {
      const locMatches = inv.findings.match(
        /\b(?:located\s+(?:in|at|near)|headquartered\s+in|based\s+in|office\s+in)\s+([A-Z][A-Za-z\s,]+)/g
      ) || [];
      const cityMatches = inv.findings.match(
        /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/g
      ) || [];

      for (const match of [...locMatches, ...cityMatches]) {
        const clean = match.replace(/^(?:located|headquartered|based|office)\s+(?:in|at|near)\s+/i, "").trim();
        const key = `text_location:${clean.toLowerCase()}`;
        if (!seen.has(key) && clean.length > 2) {
          seen.add(key);
          candidates.push({
            type: "text_location",
            value: clean,
            confidence: 0.7,
            label: `${clean} (from findings)`,
          });
        }
      }
    }

    return candidates;
  }, [entities, investigations]);

  // Geocode all unresolved locations using Nominatim
  const geocodeAll = useCallback(async () => {
    if (locationCandidates.length === 0) return;
    setGeocoding(true);

    const resolved: LocationEntity[] = [];
    const toGeocode: LocationEntity[] = [];

    for (const loc of locationCandidates) {
      if (loc.lat !== undefined && loc.lng !== undefined) {
        resolved.push(loc);
      } else {
        const cacheKey = loc.value.toLowerCase().trim();
        if (geocodeCache.has(cacheKey)) {
          const cached = geocodeCache.get(cacheKey);
          if (cached) {
            resolved.push({ ...loc, ...cached });
          } else {
            resolved.push(loc); // null = previously failed
          }
        } else {
          toGeocode.push(loc);
        }
      }
    }

    // Geocode in batches of 3 (Nominatim rate limit: 1 req/sec)
    for (let i = 0; i < toGeocode.length; i++) {
      const loc = toGeocode[i];
      const cacheKey = loc.value.toLowerCase().trim();
      // Clean the value for geocoding
      const query = loc.value
        .replace(/^(?:located|headquartered|based|office)\s+(?:in|at|near)\s+/i, "")
        .replace(/\(.*?\)/g, "")
        .trim();

      const result = await geocodeWithNominatim(query);
      geocodeCache.set(cacheKey, result);

      if (result) {
        resolved.push({ ...loc, lat: result.lat, lng: result.lng, label: loc.label || result.display });
      } else {
        resolved.push(loc);
      }

      // Rate limit: 1 request per second for Nominatim
      if (i < toGeocode.length - 1) {
        await new Promise(r => setTimeout(r, 1100));
      }
    }

    setLocationEntities(resolved);
    setGeocoding(false);
  }, [locationCandidates]);

  useEffect(() => {
    geocodeAll();
  }, [geocodeAll]);

  const geoLocated = locationEntities.filter(l => l.lat !== undefined && l.lng !== undefined);
  const unlocated = locationEntities.filter(l => l.lat === undefined);

  const mapBounds = useMemo(() => {
    if (geoLocated.length === 0) return { minLat: -30, maxLat: 60, minLng: -130, maxLng: 150 };
    const lats = geoLocated.map(l => l.lat!);
    const lngs = geoLocated.map(l => l.lng!);
    const padding = 10;
    return {
      minLat: Math.min(...lats) - padding,
      maxLat: Math.max(...lats) + padding,
      minLng: Math.min(...lngs) - padding,
      maxLng: Math.max(...lngs) + padding,
    };
  }, [geoLocated]);

  const project = (lat: number, lng: number, width: number, height: number) => {
    const x = ((lng - mapBounds.minLng) / (mapBounds.maxLng - mapBounds.minLng)) * width;
    const y = ((mapBounds.maxLat - lat) / (mapBounds.maxLat - mapBounds.minLat)) * height;
    return { x, y };
  };

  const filteredPins = layerFilter === "all" ? geoLocated : geoLocated.filter(l => l.type === layerFilter);
  const pinTypes = [...new Set(geoLocated.map(l => l.type))];

  if (locationEntities.length === 0 && !geocoding) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-20">
        <Globe className="h-10 w-10 text-muted-foreground/30 mb-4" />
        <p className="text-sm font-extralight text-muted-foreground">No geospatial data available.</p>
        <p className="text-[10px] font-extralight text-muted-foreground/50 mt-1">Investigate targets with location data to populate the map.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Map Canvas */}
      <div className="flex-1 relative bg-card/5">
        {/* Layer controls */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-xl bg-card/80 border border-border/20 px-3 py-2 backdrop-blur-sm">
            <Layers className="h-3 w-3 text-muted-foreground/50" />
            <select
              value={layerFilter}
              onChange={e => setLayerFilter(e.target.value)}
              className="bg-transparent text-[10px] font-extralight text-foreground outline-none cursor-pointer"
            >
              <option value="all">All Layers ({geoLocated.length})</option>
              {pinTypes.map(t => (
                <option key={t} value={t}>{t.replace(/_/g, " ")} ({geoLocated.filter(l => l.type === t).length})</option>
              ))}
            </select>
          </div>
          {geocoding && (
            <div className="flex items-center gap-1.5 rounded-xl bg-foreground/[0.06] border border-border/25 px-3 py-2 backdrop-blur-sm">
              <Loader2 className="h-3 w-3 text-foreground animate-spin" />
              <span className="text-[10px] font-extralight text-foreground">Geocoding…</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-3 text-[9px] font-extralight tracking-wider text-muted-foreground/40 uppercase">
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {geoLocated.length} located</span>
          <span className="flex items-center gap-1"><Radio className="h-3 w-3" /> {unlocated.length} unresolved</span>
        </div>

        {/* SVG Map */}
        <svg viewBox="0 0 800 500" className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* Grid */}
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`vg-${i}`} x1={i * 100} y1={0} x2={i * 100} y2={500} stroke="hsl(var(--border) / 0.1)" strokeWidth={0.5} />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <line key={`hg-${i}`} x1={0} y1={i * 100} x2={800} y2={i * 100} stroke="hsl(var(--border) / 0.1)" strokeWidth={0.5} />
          ))}

          {/* Connection lines between pins */}
          {filteredPins.map((pin, i) =>
            filteredPins.slice(i + 1).map((other, j) => {
              const p1 = project(pin.lat!, pin.lng!, 800, 500);
              const p2 = project(other.lat!, other.lng!, 800, 500);
              return (
                <line key={`conn-${i}-${j}`}
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke="hsl(var(--foreground) / 0.1)" strokeWidth={0.5}
                  strokeDasharray="4 4"
                />
              );
            })
          )}

          {/* Pins */}
          {filteredPins.map((pin, idx) => {
            const { x, y } = project(pin.lat!, pin.lng!, 800, 500);
            const isSelected = selectedPin === pin;
            const pulseRadius = pin.confidence * 20 + 8;

            return (
              <g key={idx} onClick={() => setSelectedPin(isSelected ? null : pin)} style={{ cursor: "pointer" }}>
                <circle cx={x} cy={y} r={pulseRadius} fill="hsl(var(--foreground))" opacity={0.08}>
                  <animate attributeName="r" values={`${pulseRadius};${pulseRadius + 10};${pulseRadius}`} dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.08;0.02;0.08" dur="3s" repeatCount="indefinite" />
                </circle>
                <circle cx={x} cy={y} r={isSelected ? 6 : 4} fill="hsl(var(--foreground))" opacity={0.8} stroke="hsl(var(--foreground))" strokeWidth={isSelected ? 2 : 0} />
                <text x={x} y={y - 10} textAnchor="middle" fontSize={isSelected ? 10 : 8} fill="hsl(var(--foreground))" opacity={0.7} fontWeight={isSelected ? 400 : 200}>
                  {pin.value.length > 20 ? pin.value.slice(0, 17) + "…" : pin.value}
                </text>
                {isSelected && (
                  <text x={x} y={y + 18} textAnchor="middle" fontSize={7} fill="hsl(var(--muted-foreground))" opacity={0.5}>
                    {pin.lat!.toFixed(4)}, {pin.lng!.toFixed(4)} · {Math.round(pin.confidence * 100)}%
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Right sidebar */}
      <div className="w-56 border-l border-border/20 flex-shrink-0">
        <div className="p-3 border-b border-border/20">
          <p className="text-[10px] font-extralight tracking-wider text-muted-foreground/50 uppercase">Intelligence Locations</p>
        </div>
        <ScrollArea className="h-[calc(100%-44px)]">
          <div className="p-2 space-y-1">
            {locationEntities.map((loc, idx) => {
              const hasCoords = loc.lat !== undefined;
              return (
                <button
                  key={idx}
                  onClick={() => hasCoords ? setSelectedPin(loc) : null}
                  className={`w-full text-left px-3 py-2 rounded-xl transition-colors ${
                    selectedPin === loc ? "bg-foreground/[0.06] border border-border/25" : "hover:bg-card/30 border border-transparent"
                  } ${!hasCoords ? "opacity-40" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    {hasCoords ? (
                      <Navigation className="h-3 w-3 text-foreground/50 shrink-0" />
                    ) : (
                      <MapPin className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[10px] font-extralight text-foreground truncate">{loc.value}</p>
                      <p className="text-[8px] font-extralight text-muted-foreground/40">
                        {hasCoords ? `${loc.lat!.toFixed(2)}, ${loc.lng!.toFixed(2)}` : "Resolving…"}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
};

export default NomadMapLayer;
