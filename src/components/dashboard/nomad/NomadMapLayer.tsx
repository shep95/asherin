import { useMemo, useState } from "react";
import { MapPin, Globe, Layers, Radio, Navigation, ChevronDown } from "lucide-react";
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

// Try to extract coordinates from entity values
function parseCoordinates(value: string): { lat: number; lng: number } | null {
  // Direct coordinate format: "lat, lng"
  const coordMatch = value.match(/(-?\d{1,3}\.\d{3,8}),\s*(-?\d{1,3}\.\d{3,8})/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]);
    const lng = parseFloat(coordMatch[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }

  // Lat/lng format
  const latMatch = value.match(/lat(?:itude)?[:\s]*(-?\d{1,3}\.\d{3,8})/i);
  const lngMatch = value.match(/(?:lng|lon(?:gitude)?)[:\s]*(-?\d{1,3}\.\d{3,8})/i);
  if (latMatch && lngMatch) {
    return { lat: parseFloat(latMatch[1]), lng: parseFloat(lngMatch[1]) };
  }

  return null;
}

// Known city coordinates for rough geo-mapping
const KNOWN_CITIES: Record<string, { lat: number; lng: number }> = {
  "new york": { lat: 40.7128, lng: -74.0060 },
  "los angeles": { lat: 34.0522, lng: -118.2437 },
  "chicago": { lat: 41.8781, lng: -87.6298 },
  "houston": { lat: 29.7604, lng: -95.3698 },
  "phoenix": { lat: 33.4484, lng: -112.0740 },
  "san francisco": { lat: 37.7749, lng: -122.4194 },
  "seattle": { lat: 47.6062, lng: -122.3321 },
  "miami": { lat: 25.7617, lng: -80.1918 },
  "boston": { lat: 42.3601, lng: -71.0589 },
  "washington": { lat: 38.9072, lng: -77.0369 },
  "london": { lat: 51.5074, lng: -0.1278 },
  "paris": { lat: 48.8566, lng: 2.3522 },
  "tokyo": { lat: 35.6762, lng: 139.6503 },
  "berlin": { lat: 52.5200, lng: 13.4050 },
  "sydney": { lat: -33.8688, lng: 151.2093 },
  "dubai": { lat: 25.2048, lng: 55.2708 },
  "singapore": { lat: 1.3521, lng: 103.8198 },
  "hong kong": { lat: 22.3193, lng: 114.1694 },
  "toronto": { lat: 43.6532, lng: -79.3832 },
  "mumbai": { lat: 19.0760, lng: 72.8777 },
  "austin": { lat: 30.2672, lng: -97.7431 },
  "denver": { lat: 39.7392, lng: -104.9903 },
  "atlanta": { lat: 33.7490, lng: -84.3880 },
  "dallas": { lat: 32.7767, lng: -96.7970 },
  "san jose": { lat: 37.3382, lng: -121.8863 },
  "palo alto": { lat: 37.4419, lng: -122.1430 },
  "silicon valley": { lat: 37.3875, lng: -122.0575 },
};

function geolocateEntity(entity: { type: string; value: string }): { lat: number; lng: number } | null {
  // Direct coordinates
  const coords = parseCoordinates(entity.value);
  if (coords) return coords;

  // Try known cities
  const lower = entity.value.toLowerCase();
  for (const [city, coords] of Object.entries(KNOWN_CITIES)) {
    if (lower.includes(city)) return coords;
  }

  return null;
}

const NomadMapLayer = ({ entities, investigations }: NomadMapLayerProps) => {
  const [selectedPin, setSelectedPin] = useState<LocationEntity | null>(null);
  const [layerFilter, setLayerFilter] = useState<string>("all");

  // Extract all location-related entities
  const locationEntities = useMemo(() => {
    const locTypes = ["location", "us_location", "coordinates", "geo_coordinate", "cell_tower", "ip_address"];
    const locs: LocationEntity[] = [];

    // From entities
    for (const e of entities) {
      if (locTypes.includes(e.type) || e.type === "organization" || e.type === "institution") {
        const coords = geolocateEntity(e);
        if (coords) {
          locs.push({ ...e, ...coords, label: e.value });
        } else if (locTypes.includes(e.type)) {
          locs.push({ ...e, label: e.value });
        }
      }
    }

    // Extract locations from investigation text
    for (const inv of investigations) {
      for (const [city, coords] of Object.entries(KNOWN_CITIES)) {
        if (inv.findings.toLowerCase().includes(city)) {
          const exists = locs.some(l => l.lat === coords.lat && l.lng === coords.lng);
          if (!exists) {
            locs.push({
              type: "text_location",
              value: city.charAt(0).toUpperCase() + city.slice(1),
              confidence: 0.6,
              ...coords,
              label: `${city.charAt(0).toUpperCase() + city.slice(1)} (mentioned in findings)`,
            });
          }
        }
      }
    }

    return locs;
  }, [entities, investigations]);

  const geoLocated = locationEntities.filter(l => l.lat !== undefined && l.lng !== undefined);
  const unlocated = locationEntities.filter(l => l.lat === undefined);

  // Calculate map bounds
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

  // Project lat/lng to SVG coordinates
  const project = (lat: number, lng: number, width: number, height: number) => {
    const x = ((lng - mapBounds.minLng) / (mapBounds.maxLng - mapBounds.minLng)) * width;
    const y = ((mapBounds.maxLat - lat) / (mapBounds.maxLat - mapBounds.minLat)) * height;
    return { x, y };
  };

  const filteredPins = layerFilter === "all" ? geoLocated : geoLocated.filter(l => l.type === layerFilter);

  const pinTypes = [...new Set(geoLocated.map(l => l.type))];

  if (locationEntities.length === 0) {
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
                  stroke="hsl(var(--accent) / 0.15)" strokeWidth={0.5}
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
                {/* Pulse ring */}
                <circle cx={x} cy={y} r={pulseRadius} fill="hsl(var(--accent))" opacity={0.08}>
                  <animate attributeName="r" values={`${pulseRadius};${pulseRadius + 10};${pulseRadius}`} dur="3s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.08;0.02;0.08" dur="3s" repeatCount="indefinite" />
                </circle>
                {/* Pin dot */}
                <circle cx={x} cy={y} r={isSelected ? 6 : 4} fill="hsl(var(--accent))" opacity={0.8} stroke="hsl(var(--accent))" strokeWidth={isSelected ? 2 : 0} />
                {/* Label */}
                <text x={x} y={y - 10} textAnchor="middle" fontSize={isSelected ? 10 : 8} fill="hsl(var(--foreground))" opacity={0.7} fontWeight={isSelected ? 400 : 200}>
                  {pin.value.length > 20 ? pin.value.slice(0, 17) + "…" : pin.value}
                </text>
                {/* Coordinates on hover */}
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

      {/* Right sidebar: Location list */}
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
                    selectedPin === loc ? "bg-accent/10 border border-accent/20" : "hover:bg-card/30 border border-transparent"
                  } ${!hasCoords ? "opacity-40" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    {hasCoords ? (
                      <Navigation className="h-3 w-3 text-accent/60 shrink-0" />
                    ) : (
                      <MapPin className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[10px] font-extralight text-foreground truncate">{loc.value}</p>
                      <p className="text-[8px] font-extralight text-muted-foreground/40">
                        {hasCoords ? `${loc.lat!.toFixed(2)}, ${loc.lng!.toFixed(2)}` : "No coordinates"}
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
