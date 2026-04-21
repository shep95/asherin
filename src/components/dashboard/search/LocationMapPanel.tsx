import { useEffect, useMemo, useRef, useState } from "react";
import { X, MapPin, ExternalLink, Copy, Check, Loader2, Navigation, Globe } from "lucide-react";
import "leaflet/dist/leaflet.css";

interface LocationMapPanelProps {
  query: string;
  onClose: () => void;
}

interface GeocodeResult {
  lat: number;
  lon: number;
  display_name: string;
  type?: string;
  class?: string;
  address?: Record<string, string>;
}

const LocationMapPanel = ({ query, onClose }: LocationMapPanelProps) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [active, setActive] = useState<GeocodeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Geocode via Nominatim (OpenStreetMap) — live, no API key
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
          { headers: { Accept: "application/json" } }
        );
        if (!resp.ok) throw new Error(`Nominatim ${resp.status}`);
        const data: GeocodeResult[] = await resp.json();
        if (cancelled) return;
        const parsed = data.map((d) => ({ ...d, lat: parseFloat(String(d.lat)), lon: parseFloat(String(d.lon)) }));
        setResults(parsed);
        setActive(parsed[0] ?? null);
        if (parsed.length === 0) setError("No location matches found.");
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Geocoding failed.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query]);

  // Initialize Leaflet map (dark theme via CartoDB Dark Matter tiles)
  useEffect(() => {
    if (!active || !mapContainerRef.current) return;
    let map: any;
    let markerLayer: any;
    (async () => {
      const L = await import("leaflet");
      // Fix Leaflet default icon paths (use inline SVG via divIcon)
      const customIcon = L.divIcon({
        className: "",
        html: `<div style="
          width:28px;height:28px;border-radius:50% 50% 50% 0;
          background:hsl(var(--foreground));
          transform:rotate(-45deg);
          border:2px solid hsl(var(--background));
          box-shadow:0 4px 14px rgba(0,0,0,0.6);
          display:flex;align-items:center;justify-content:center;
        "><div style="width:8px;height:8px;border-radius:50%;background:hsl(var(--background));transform:rotate(45deg);"></div></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });

      if (mapRef.current) {
        (mapRef.current as any).remove();
        mapRef.current = null;
      }
      map = L.map(mapContainerRef.current!, {
        center: [active.lat, active.lon],
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      L.control.attribution({ position: "bottomleft", prefix: false })
        .addAttribution('© <a href="https://openstreetmap.org">OSM</a> · © <a href="https://carto.com/attributions">CARTO</a>')
        .addTo(map);

      markerLayer = L.layerGroup().addTo(map);
      results.forEach((r) => {
        const m = L.marker([r.lat, r.lon], { icon: customIcon }).addTo(markerLayer);
        m.bindTooltip(r.display_name, { direction: "top", offset: [0, -24], className: "leaflet-dark-tooltip" });
        m.on("click", () => setActive(r));
      });
    })();

    return () => {
      if (mapRef.current) {
        try { (mapRef.current as any).remove(); } catch { /* ignore */ }
        mapRef.current = null;
      }
    };
  }, [active, results]);

  // Re-center on active change
  useEffect(() => {
    if (mapRef.current && active) {
      try { (mapRef.current as any).flyTo([active.lat, active.lon], 15, { duration: 0.8 }); } catch { /* ignore */ }
    }
  }, [active]);

  const coords = useMemo(() => active ? `${active.lat.toFixed(5)}, ${active.lon.toFixed(5)}` : "", [active]);

  const copyCoords = async () => {
    if (!coords) return;
    await navigator.clipboard.writeText(coords);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      {/* Backdrop on mobile */}
      <div className="fixed inset-0 z-40 bg-background/60 sm:hidden" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 w-full sm:max-w-xl z-50 bg-card/95 backdrop-blur-xl border-l border-border/20 shadow-2xl flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/15 shrink-0">
          <div className="min-w-0 flex-1 mr-3">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-foreground/70 shrink-0" />
              <h3 className="text-sm font-normal text-foreground truncate">{query}</h3>
            </div>
            {active && (
              <p className="text-[10px] text-muted-foreground/40 font-mono truncate mt-0.5">{coords}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {active && (
              <a
                href={`https://www.openstreetmap.org/?mlat=${active.lat}&mlon=${active.lon}#map=16/${active.lat}/${active.lon}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors"
                title="Open in OpenStreetMap"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button onClick={onClose} className="p-2 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Map */}
        <div className="relative flex-1 bg-black min-h-[260px]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <Loader2 className="h-5 w-5 text-foreground/60 animate-spin" />
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <Globe className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-light text-muted-foreground">{error}</p>
            </div>
          )}
          <div ref={mapContainerRef} className="absolute inset-0" />
        </div>

        {/* Active result details + alternates */}
        {active && (
          <div className="border-t border-border/15 bg-card/95 max-h-[40vh] overflow-y-auto shrink-0">
            <div className="px-4 py-3 border-b border-border/10">
              <p className="text-[10px] font-light text-muted-foreground/50 uppercase tracking-wider mb-1">Selected location</p>
              <p className="text-xs font-light text-foreground/90 break-words">{active.display_name}</p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={copyCoords}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-light text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : coords}
                </button>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${active.lat},${active.lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-light text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
                >
                  <Navigation className="h-3 w-3" /> Directions
                </a>
              </div>
            </div>

            {results.length > 1 && (
              <div className="px-2 py-2">
                <p className="px-2 text-[10px] font-light text-muted-foreground/50 uppercase tracking-wider mb-1">Other matches</p>
                {results.filter((r) => r !== active).map((r, i) => (
                  <button
                    key={`${r.lat}-${r.lon}-${i}`}
                    onClick={() => setActive(r)}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-foreground/5 transition-colors"
                  >
                    <p className="text-[11px] font-light text-foreground/80 line-clamp-2">{r.display_name}</p>
                    <p className="text-[9px] font-mono text-muted-foreground/40 mt-0.5">{r.lat.toFixed(4)}, {r.lon.toFixed(4)}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dark map styles */}
      <style>{`
        .leaflet-container { background: #0a0a0a; font-family: inherit; }
        .leaflet-control-zoom a {
          background: hsl(var(--card)) !important;
          color: hsl(var(--foreground)) !important;
          border-color: hsl(var(--border) / 0.3) !important;
        }
        .leaflet-control-zoom a:hover { background: hsl(var(--foreground) / 0.1) !important; }
        .leaflet-control-attribution {
          background: hsl(var(--card) / 0.8) !important;
          color: hsl(var(--muted-foreground) / 0.6) !important;
          font-size: 9px !important;
          backdrop-filter: blur(8px);
        }
        .leaflet-control-attribution a { color: hsl(var(--foreground) / 0.7) !important; }
        .leaflet-dark-tooltip {
          background: hsl(var(--card)) !important;
          color: hsl(var(--foreground)) !important;
          border: 1px solid hsl(var(--border) / 0.3) !important;
          border-radius: 8px !important;
          font-size: 10px !important;
          font-weight: 300 !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;
          padding: 6px 10px !important;
          max-width: 280px !important;
          white-space: normal !important;
        }
        .leaflet-dark-tooltip::before { display: none !important; }
      `}</style>
    </>
  );
};

export default LocationMapPanel;
