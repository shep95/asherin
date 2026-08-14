// StreetCameraLayer — live public camera positions and frames on the map.
//
// Three classes of object render here:
//  · Agency CCTV with a still-image endpoint → the popup shows the live frame
//    and refreshes it on a timer while open (Caltrans, TfL).
//  · Agency CCTV that only publishes video (HLS .m3u8 / clip .mp4, e.g. 511NY)
//    → the popup mounts a muted inline player, lazily loading hls.js only when
//    the browser has no native HLS support. Torn down on popup close.
//  · OpenStreetMap-tagged surveillance devices → position only. They render
//    hollow so an operator can never mistake a position for a viewable feed.

import { useEffect, useRef, useState } from "react";
import { CircleMarker, Polygon, Polyline, Popup, Tooltip } from "react-leaflet";
import L from "leaflet";
import { ExternalLink, RefreshCw } from "lucide-react";
import { liveFrameUrl, type StreetCamera } from "@/lib/asher/streetCameras";

interface Props {
  cameras: StreetCamera[];
  /** Frame refresh cadence while a popup is open, ms. */
  refreshMs?: number;
  /** Camera the operator picked from the glass list. */
  selectedId?: string | null;
  onSelect?: (cam: StreetCamera) => void;
  /** Property pin — a dashed sight-line is drawn from it to the selection. */
  anchor?: { lat: number; lng: number } | null;
}

/** Compass token → bearing. Agencies publish "NB"/"North"/"E"; OSM publishes
 *  camera:direction in degrees. Anything we cannot parse returns null and the
 *  cone is simply not drawn — a guessed bearing would be a fabricated fact. */
const COMPASS: Record<string, number> = {
  n: 0,
  nb: 0,
  north: 0,
  ne: 45,
  northeast: 45,
  e: 90,
  eb: 90,
  east: 90,
  se: 135,
  southeast: 135,
  s: 180,
  sb: 180,
  south: 180,
  sw: 225,
  southwest: 225,
  w: 270,
  wb: 270,
  west: 270,
  nw: 315,
  northwest: 315,
};
function bearingOf(direction?: string): number | null {
  if (!direction) return null;
  const raw = direction.trim().toLowerCase();
  const num = Number(raw.replace(/[^\d.-]/g, ""));
  if (raw && /^-?\d+(\.\d+)?$/.test(raw) && Number.isFinite(num)) return ((num % 360) + 360) % 360;
  return COMPASS[raw] ?? COMPASS[raw.replace(/[^a-z]/g, "")] ?? null;
}

/** Schematic facing wedge. The half-angle is a drawing constant, NOT a
 *  measured lens field of view, and the range is a drawing constant too. */
function conePoints(lat: number, lng: number, bearing: number, rangeM = 140, halfAngle = 22): Array<[number, number]> {
  const pts: Array<[number, number]> = [[lat, lng]];
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  for (let a = -halfAngle; a <= halfAngle; a += 4) {
    const t = ((bearing + a) * Math.PI) / 180;
    pts.push([lat + (Math.cos(t) * rangeM) / mPerDegLat, lng + (Math.sin(t) * rangeM) / mPerDegLng]);
  }
  return pts;
}

const LIVE = "#c98b3a";
const POSITION_ONLY = "#8b8b8b";

/** Inline player for stream-only cameras. Native HLS on Safari/iOS, hls.js
 *  elsewhere — imported dynamically so the 400 KB parser never lands in the
 *  main bundle for operators who never open a camera. */
const CameraStream = ({ url }: { url: string }) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let destroyed = false;
    let hls: { destroy: () => void } | null = null;

    const isHls = /\.m3u8(\?|$)/i.test(url);
    if (!isHls || video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.play().catch(() => {
        /* autoplay refusal is not a failure */
      });
    } else {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (destroyed || !ref.current) return;
          if (!Hls.isSupported()) {
            setFailed(true);
            return;
          }
          const inst = new Hls({ lowLatencyMode: true, maxBufferLength: 8 });
          hls = inst;
          inst.on(Hls.Events.ERROR, (_e, data) => {
            if (data?.fatal) setFailed(true);
          });
          inst.loadSource(url);
          inst.attachMedia(ref.current);
          ref.current.play().catch(() => {
            /* ignore */
          });
        })
        .catch(() => setFailed(true));
    }

    return () => {
      destroyed = true;
      hls?.destroy();
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {
        /* teardown best-effort */
      }
    };
  }, [url]);

  if (failed) {
    return (
      <p className="text-[10px] leading-snug opacity-70">
        Stream would not play in-browser.{" "}
        <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
          Open it directly
        </a>
        .
      </p>
    );
  }

  return (
    <video
      ref={ref}
      muted
      playsInline
      autoPlay
      loop
      controls
      hidden
      width={260}
      height={146}
      className="block w-[260px] rounded border border-black/20 bg-black/60 object-cover"
      style={{ aspectRatio: "16 / 9" }}
      onPlaying={(e) => {
        (e.currentTarget as HTMLVideoElement).hidden = false;
      }}
    />
  );
};

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
    // Stream-only agency feed (511NY HLS, TfL clip) — play it rather than
    // mislabelling it as an unviewable OpenStreetMap position.
    if (cam.streamUrl) return <CameraStream url={cam.streamUrl} />;
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

const StreetCameraLayer = ({ cameras, refreshMs = 800, selectedId = null, onSelect, anchor = null }: Props) => {
  const markerRefs = useRef({});
  useEffect(() => {
    if (!selectedId) return;
    const m = markerRefs.current[selectedId];
    if (m && typeof m.openPopup === "function") m.openPopup();
  }, [selectedId, cameras]);
  if (!cameras.length) return null;
  const selected = cameras.find((c) => c.id === selectedId) ?? null;
  const selBearing = selected ? bearingOf(selected.direction) : null;
  return (
    <>
      {selected && selBearing !== null && (
        <Polygon
          positions={conePoints(selected.lat, selected.lng, selBearing)}
          pathOptions={{ color: "#e0a955", weight: 1, opacity: 0.6, fillColor: "#e0a955", fillOpacity: 0.12 }}
          interactive={false}
        />
      )}
      {selected && anchor && (
        <Polyline
          positions={[
            [anchor.lat, anchor.lng],
            [selected.lat, selected.lng],
          ]}
          pathOptions={{ color: "#e0a955", weight: 1.2, opacity: 0.7, dashArray: "5 6" }}
          interactive={false}
        />
      )}
      {cameras.map((cam) => {
        const live = !!(cam.imageUrl || cam.streamUrl);
        const isSel = cam.id === selectedId;
        const color = isSel ? "#f5d08a" : live ? LIVE : POSITION_ONLY;
        return (
          <CircleMarker
            key={cam.id}
            center={[cam.lat, cam.lng]}
            radius={isSel ? 9 : live ? 6 : 4}
            ref={(el) => {
              markerRefs.current[cam.id] = el as unknown as L.CircleMarker;
            }}
            eventHandlers={{ click: () => onSelect?.(cam) }}
            pathOptions={{
              color,
              weight: isSel ? 3 : 2,
              fillColor: color,
              fillOpacity: live ? 0.85 : 0.15,
            }}
          >
            <Tooltip direction="top" opacity={0.95}>
              {cam.name}
            </Tooltip>
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
                      <RefreshCw className="h-2.5 w-2.5" />
                      auto-refresh {Math.round(refreshMs / 1000)}s
                    </span>
                  )}
                  {cam.streamUrl && (
                    <a
                      href={cam.streamUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 underline"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      Open stream
                    </a>
                  )}
                </div>
                <div className="text-[9px] opacity-50">Source: {cam.source}</div>
                <div className="text-[9px] leading-snug opacity-50">
                  Highway / corridor still published by a transport agency. This is not a camera on a house — Asherin
                  has no access to doorbell or private CCTV.
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
};

export default StreetCameraLayer;
