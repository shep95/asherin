import { useMemo, useState } from "react";
import { Box, X, ExternalLink, RefreshCw } from "lucide-react";

interface Props {
  label: string | null;
  lat: number;
  lng: number;
  onClose: () => void;
}

type Source = "osmb" | "f4";

/**
 * Photorealistic / volumetric 3D view of a selected property.
 * - OSM Buildings: 3D extrusions from OpenStreetMap building footprints (no key).
 * - F4 Map: stylised 3D city view (no key).
 * Both render in an iframe — no auth, no external account required.
 */
const Property3DPanel = ({ label, lat, lng, onClose }: Props) => {
  const [src, setSrc] = useState<Source>("osmb");
  const [nonce, setNonce] = useState(0);

  const place = useMemo(
    () => label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    [label, lat, lng],
  );

  const url = useMemo(() => {
    if (src === "osmb") {
      // OSMBuildings demo viewer — accepts lat/lon/zoom/tilt/rotation in hash.
      return `https://osmbuildings.org/?lat=${lat}&lon=${lng}&zoom=18&tilt=45&rotation=0&nonce=${nonce}`;
    }
    // F4 Map — vector 3D city renderer
    return `https://demo.f4map.com/#lat=${lat}&lon=${lng}&zoom=19&camera.theta=55&nonce=${nonce}`;
  }, [src, lat, lng, nonce]);

  const externalUrl = `https://earth.google.com/web/search/${lat},${lng}/@${lat},${lng},150a,500d,35y,0h,60t,0r`;

  return (
    <div className="absolute top-3 right-3 z-[1001] w-[460px] rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/15 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Box className="h-3.5 w-3.5 text-foreground/70 shrink-0" strokeWidth={1.5} />
          <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase truncate">
            3D Property View — {place}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setNonce((n) => n + 1)}
            className="p-1 text-muted-foreground hover:text-foreground"
            title="Reload"
          >
            <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
          </button>
          <a
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-muted-foreground hover:text-foreground"
            title="Open in Google Earth"
          >
            <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
          </a>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground"
            title="Close"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border/15 px-3 py-1.5">
        {([
          { id: "osmb" as const, label: "OSM Buildings" },
          { id: "f4" as const, label: "F4 Vector" },
        ]).map((s) => (
          <button
            key={s.id}
            onClick={() => setSrc(s.id)}
            className={`px-2 py-1 rounded text-[10px] font-light tracking-[0.2em] uppercase transition-colors ${
              src === s.id
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="relative aspect-video bg-black">
        <iframe
          key={url}
          src={url}
          title={`3D view — ${place}`}
          className="h-full w-full"
          allow="accelerometer; gyroscope; fullscreen"
        />
      </div>

      <div className="px-3 py-2 text-[9px] font-light tracking-wider text-muted-foreground/70 uppercase truncate">
        Source: {src === "osmb" ? "OpenStreetMap 3D extrusions" : "F4 Map vector renderer"} · drag to orbit · scroll to zoom
      </div>
    </div>
  );
};

export default Property3DPanel;
