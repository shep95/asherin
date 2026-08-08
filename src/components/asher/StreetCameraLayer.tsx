// StreetCameraLayer — live public camera positions and frames on the map.
//
// Two classes of object render here:
//  · Agency CCTV with a still-image endpoint → the popup shows the live frame
//    and refreshes it on a timer while open.
//  · OpenStreetMap-tagged surveillance devices → position only. They render
//    hollow so an operator can never mistake a position for a viewable feed.

import { useEffect, useState } from "react";
import { CircleMarker, Popup, Tooltip } from "react-leaflet";
import { ExternalLink, RefreshCw } from "lucide-react";
import { liveFrameUrl, type StreetCamera } from "@/lib/asher/streetCameras";

interface Props {
  cameras: StreetCamera[];
  /** Frame refresh cadence while a popup is open, ms. */
  refreshMs?: number;
}

const LIVE = "#c98b3a";
const POSITION_ONLY = "#8b8b8b";

const CameraFrame = ({ cam, refreshMs }: { cam: StreetCamera; refreshMs: number }) => {
  const [tick, setTick] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);

  // Only the mounted popup polls — Leaflet unmounts popup children on close,
  // so no interval survives a closed camera.
  useEffect(() => {
    if (!cam.imageUrl) return;
    const id = setInterval(() => setTick(Date.now()), refreshMs);
    return () => clearInterval(id);
  }, [cam.imageUrl, refreshMs]);

  if (!cam.imageUrl) {
    return (
      <p className="text-[10px] leading-snug opacity-70">
        Position only — this device is mapped in OpenStreetMap but publishes no public feed.
      </p>
    );
  }

  if (failed) {
    return <p className="text-[10px] text-red-500">Frame unavailable — the agency endpoint did not return an image.</p>;
  }

  return (
    <img
      src={liveFrameUrl(cam, tick)}
      alt={`Live frame from ${cam.name}`}
      width={260}
      height={146}
      loading="lazy"
      onError={() => setFailed(true)}
      className="block w-[260px] rounded border border-black/20 bg-black/40 object-cover"
      style={{ aspectRatio: "16 / 9" }}
    />
  );
};

const StreetCameraLayer = ({ cameras, refreshMs = 15_000 }: Props) => {
  if (!cameras.length) return null;
  return (
    <>
      {cameras.map((cam) => {
        const live = !!(cam.imageUrl || cam.streamUrl);
        const color = live ? LIVE : POSITION_ONLY;
        return (
          <CircleMarker
            key={cam.id}
            center={[cam.lat, cam.lng]}
            radius={live ? 6 : 4}
            pathOptions={{
              color,
              weight: 2,
              fillColor: color,
              fillOpacity: live ? 0.85 : 0.15,
            }}
          >
            <Tooltip direction="top" opacity={0.95}>{cam.name}</Tooltip>
            <Popup minWidth={272}>
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold leading-tight">{cam.name}</div>
                <div className="text-[10px] opacity-70">
                  {[cam.roadway, cam.direction, cam.operator || cam.source].filter(Boolean).join(" · ")}
                  {cam.distanceM !== undefined ? ` · ${cam.distanceM} m from route` : ""}
                </div>
                <CameraFrame cam={cam} refreshMs={refreshMs} />
                <div className="flex items-center gap-2 pt-0.5 text-[10px]">
                  {cam.imageUrl && (
                    <span className="flex items-center gap-1 opacity-70">
                      <RefreshCw className="h-2.5 w-2.5" />auto-refresh {Math.round(refreshMs / 1000)}s
                    </span>
                  )}
                  {cam.streamUrl && (
                    <a href={cam.streamUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline">
                      <ExternalLink className="h-2.5 w-2.5" />Open stream
                    </a>
                  )}
                </div>
                <div className="text-[9px] opacity-50">Source: {cam.source}</div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
};

export default StreetCameraLayer;
