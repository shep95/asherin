// LinkedImageryMap — mini Leaflet map plotting every analyzed Imagine-Intel image
// as a linked data point. Each marker shows the image thumbnail, city/region/country,
// coordinates, and a popup with full forensic context. Markers are connected in
// chronological order so the operator can see the movement / link pattern.
import { useEffect, useMemo, useRef } from "react";
import { MapPin, Layers, Link2 } from "lucide-react";
import "leaflet/dist/leaflet.css";

export interface ImageryDataPoint {
  id: string;
  imageDataUrl: string;          // preview thumbnail (base64 dataURL)
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
  address?: string | null;
  confidence?: number;
  timestamp: number;             // for ordering / link line
  label?: string;                // user-supplied or "Image 1", "Image 2"
}

interface Props {
  points: ImageryDataPoint[];
  height?: number;
  onPointClick?: (p: ImageryDataPoint) => void;
}

const LinkedImageryMap = ({ points, height = 320, onPointClick }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);

  // Sort chronologically so the polyline reflects sequence
  const sorted = useMemo(
    () => [...points].sort((a, b) => a.timestamp - b.timestamp),
    [points]
  );

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        worldCopyJump: true,
      }).setView([20, 0], 2);
      // Dark tile layer to match interface theme
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 19, subdomains: "abcd" }
      ).addTo(map);
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  // Re-render markers + linking polyline whenever points change
  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !mapRef.current) return;
      const layer = layerRef.current;
      layer.clearLayers();

      if (sorted.length === 0) return;

      // Add markers with custom thumbnail icon
      const latlngs: [number, number][] = [];
      sorted.forEach((p, idx) => {
        const latlng: [number, number] = [p.latitude, p.longitude];
        latlngs.push(latlng);
        const html = `
          <div style="position:relative;width:46px;height:46px;">
            <div style="position:absolute;inset:0;border-radius:8px;overflow:hidden;border:2px solid hsl(var(--accent));box-shadow:0 4px 14px rgba(0,0,0,.55);">
              <img src="${p.imageDataUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" />
            </div>
            <div style="position:absolute;top:-6px;right:-6px;background:hsl(var(--accent));color:hsl(var(--accent-foreground));border-radius:9999px;font:600 10px/1 ui-sans-serif,system-ui;padding:3px 5px;min-width:16px;text-align:center;">
              ${idx + 1}
            </div>
          </div>`;
        const icon = L.divIcon({
          html,
          className: "linked-imagery-icon",
          iconSize: [46, 46],
          iconAnchor: [23, 23],
        });
        const marker = L.marker(latlng, { icon }).addTo(layer);
        const locStr =
          [p.city, p.region, p.country].filter(Boolean).join(", ") || "Unknown locale";
        const conf = typeof p.confidence === "number" ? `${Math.round(p.confidence * 100)}%` : "—";
        marker.bindPopup(
          `<div style="font:400 11px/1.4 ui-sans-serif,system-ui;color:#e4e4e7;min-width:180px;">
             <div style="font-weight:600;margin-bottom:4px;">${p.label ?? `Image ${idx + 1}`}</div>
             <img src="${p.imageDataUrl}" style="width:100%;height:90px;object-fit:cover;border-radius:6px;margin-bottom:6px;" />
             <div style="opacity:.85;"><b>Location:</b> ${locStr}</div>
             ${p.address ? `<div style="opacity:.7;"><b>Addr:</b> ${p.address}</div>` : ""}
             <div style="opacity:.7;"><b>Coords:</b> ${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}</div>
             <div style="opacity:.7;"><b>Confidence:</b> ${conf}</div>
           </div>`,
          { className: "linked-imagery-popup" }
        );
        if (onPointClick) marker.on("click", () => onPointClick(p));
      });

      // Connect points with a dashed polyline (data-link visualization)
      if (latlngs.length > 1) {
        L.polyline(latlngs, {
          color: "hsl(var(--accent))" as any,
          weight: 2,
          opacity: 0.55,
          dashArray: "6 6",
        }).addTo(layer);
      }

      // Fit bounds
      const bounds = L.latLngBounds(latlngs);
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
      // Force resize in case parent height was unknown at init
      setTimeout(() => mapRef.current?.invalidateSize(), 50);
    })();
    return () => { cancelled = true; };
  }, [sorted, onPointClick]);

  return (
    <div className="rounded-2xl border border-border/30 bg-card/10 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5 text-accent" />
          <span className="text-[10px] font-light tracking-[0.2em] text-foreground uppercase">
            Linked Imagery Map
          </span>
        </div>
        <div className="flex items-center gap-3 text-[9px] tracking-wide text-muted-foreground/70 uppercase">
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{points.length} pts</span>
          {points.length > 1 && (
            <span className="flex items-center gap-1"><Link2 className="h-3 w-3" />{points.length - 1} links</span>
          )}
        </div>
      </div>
      {points.length === 0 ? (
        <div
          style={{ height }}
          className="flex items-center justify-center text-[11px] font-extralight text-muted-foreground/60"
        >
          Upload imagery above — analyzed locations will plot here as linked data points.
        </div>
      ) : (
        <div ref={containerRef} style={{ height, width: "100%" }} />
      )}
    </div>
  );
};

export default LinkedImageryMap;
