// SelfLocationLayer — own-force rendering on Asherin Maps: live fix, accuracy
// disc, heading cone, breadcrumb trail and geofences.
//
// The operator's own position is tagged with a GOLDEN-BROWN teardrop pin — the
// small blue dot it replaced was invisible against satellite imagery, which is
// now the default base layer. The pin is a Leaflet divIcon (real DOM), so it
// keeps its size at every zoom instead of scaling away like a vector radius.
//
// Pure presentation. It never touches the sensor; every value arrives already
// gated by the tracking engine, so a degraded fix renders visibly degraded
// (hollow, dashed) rather than being drawn as a confident position.

import { useMemo } from "react";
import L from "leaflet";
import { Circle, Marker, Polygon, Polyline, Popup, Tooltip } from "react-leaflet";
import {
  compass16, fmtSpeed, type Geofence, type SelfFix,
} from "@/lib/asher/selfTrack";

interface Props {
  fix: SelfFix | null;
  trail: SelfFix[];
  fences: Geofence[];
  onRemoveFence?: (id: string) => void;
}

/** Golden brown — the operator's own-force colour across Asherin Maps. */
const GOLD = "#c98b3a";
const GOLD_DEEP = "#8a5a1c";
const GOLD_LIGHT = "#e6b96b";
const DEGRADED = "#f59e0b";

/** Teardrop pin with a pulse ring, built once per colour and cached. */
function selfPinIcon(degraded: boolean): L.DivIcon {
  const stroke = degraded ? DEGRADED : GOLD_DEEP;
  const top = degraded ? "#fcd34d" : GOLD_LIGHT;
  const mid = degraded ? DEGRADED : GOLD;
  return L.divIcon({
    className: "asher-self-pin",
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -38],
    tooltipAnchor: [0, -38],
    html: `
      <div style="position:relative;width:30px;height:42px;">
        <span style="position:absolute;left:50%;top:36px;width:26px;height:26px;margin-left:-13px;margin-top:-13px;border-radius:9999px;background:radial-gradient(circle, rgba(201,139,58,.5) 0%, rgba(201,139,58,0) 70%);"></span>
        <svg width="30" height="42" viewBox="0 0 30 42" aria-hidden="true" style="position:absolute;inset:0;filter:drop-shadow(0 4px 8px rgba(0,0,0,.7));">
          <defs>
            <linearGradient id="asher-self-grad${degraded ? "-d" : ""}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${top}" />
              <stop offset="50%" stop-color="${mid}" />
              <stop offset="100%" stop-color="${stroke}" />
            </linearGradient>
          </defs>
          <path d="M15 1.5C8.1 1.5 2.5 7.1 2.5 14c0 9.4 12.5 26.5 12.5 26.5S27.5 23.4 27.5 14C27.5 7.1 21.9 1.5 15 1.5z"
                fill="url(#asher-self-grad${degraded ? "-d" : ""})" stroke="rgba(12,10,6,.85)" stroke-width="1.6"/>
          <circle cx="15" cy="14" r="4.8" fill="rgba(12,10,6,.88)" />
          <circle cx="15" cy="14" r="2" fill="${top}" />
        </svg>
      </div>`,
  });
}

const BLUE = GOLD;
const TRAIL = "#0ea5e9";

/** Heading wedge: a 46° cone projected ~70 m ahead of the operator. */
function headingCone(fix: SelfFix): [number, number][] | null {
  if (fix.headingDeg == null) return null;
  const reach = Math.max(45, Math.min(220, (fix.speedMps ?? 0) * 12 + 55));
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((fix.lat * Math.PI) / 180) || 1;
  const pt = (bearing: number, dist: number): [number, number] => {
    const r = (bearing * Math.PI) / 180;
    return [fix.lat + (Math.cos(r) * dist) / mPerDegLat, fix.lng + (Math.sin(r) * dist) / mPerDegLng];
  };
  return [[fix.lat, fix.lng], pt(fix.headingDeg - 23, reach), pt(fix.headingDeg, reach * 1.06), pt(fix.headingDeg + 23, reach)];
}

const SelfLocationLayer = ({ fix, trail, fences, onRemoveFence }: Props) => {
  const path = trail.filter((f) => !f.degraded).map((f) => [f.lat, f.lng] as [number, number]);
  const cone = fix ? headingCone(fix) : null;
  // Rebuilding the divIcon on every fix would recreate the DOM node ~1×/sec
  // and kill the pulse animation; it only depends on the degraded flag.
  const selfIcon = useMemo(() => selfPinIcon(!!fix?.degraded), [fix?.degraded]);

  return (
    <>
      {fences.map((g) => (
        <Circle
          key={g.id}
          center={[g.lat, g.lng]}
          radius={g.radiusM}
          pathOptions={{
            color: g.inside ? "#34d399" : "#a78bfa",
            weight: 2,
            dashArray: g.inside ? undefined : "6 5",
            fillColor: g.inside ? "#34d399" : "#a78bfa",
            fillOpacity: 0.08,
          }}
        >
          <Tooltip direction="top" opacity={0.95}>{g.label}</Tooltip>
          <Popup>
            <div className="min-w-[150px] space-y-1 text-xs">
              <div className="font-semibold">{g.label}</div>
              <div className="opacity-70">{Math.round(g.radiusM)} m radius</div>
              <div className="opacity-70">{g.inside ? "Operator INSIDE" : "Operator outside"}</div>
              {onRemoveFence && (
                <button
                  onClick={() => onRemoveFence(g.id)}
                  className="mt-1 rounded border border-red-400/40 px-2 py-0.5 text-[10px] text-red-500 hover:bg-red-500/10"
                >
                  Remove geofence
                </button>
              )}
            </div>
          </Popup>
        </Circle>
      ))}

      {path.length >= 2 && (
        <Polyline positions={path} pathOptions={{ color: TRAIL, weight: 2.5, opacity: 0.75 }} />
      )}

      {fix && (
        <>
          {/* Accuracy disc — the honest uncertainty of this fix. */}
          <Circle
            center={[fix.lat, fix.lng]}
            radius={Math.max(5, fix.accM)}
            pathOptions={{
              color: fix.degraded ? "#f59e0b" : BLUE,
              weight: 1,
              opacity: 0.7,
              fillColor: fix.degraded ? "#f59e0b" : BLUE,
              fillOpacity: fix.degraded ? 0.05 : 0.12,
              ...(fix.degraded ? { dashArray: "4 4" } : {}),
            }}
          />
          {cone && (
            <Polygon
              positions={cone}
              pathOptions={{ color: BLUE, weight: 0, fillColor: BLUE, fillOpacity: 0.22 }}
            />
          )}
          <Marker
            position={[fix.lat, fix.lng]}
            icon={selfIcon}
            keyboard={false}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>
              You · ±{Math.round(fix.accM)} m
            </Tooltip>
            <Popup>
              <div className="min-w-[190px] space-y-1 text-xs">
                <div className="font-semibold">Operator position</div>
                <div className="font-mono text-[10px] opacity-70">
                  {fix.lat.toFixed(6)}, {fix.lng.toFixed(6)}
                </div>
                <div className="opacity-80">Accuracy ±{Math.round(fix.accM)} m{fix.degraded ? " — degraded, excluded from track math" : ""}</div>
                {fix.altM != null && (
                  <div className="opacity-80">
                    Altitude {Math.round(fix.altM)} m{fix.altAccM != null ? ` ±${Math.round(fix.altAccM)} m` : ""}
                  </div>
                )}
                <div className="opacity-80">
                  Speed {fmtSpeed(fix.speedMps)}
                  {fix.headingDeg != null ? ` · ${compass16(fix.headingDeg)} ${Math.round(fix.headingDeg)}°` : ""}
                  {fix.derivedMotion ? " (derived)" : ""}
                </div>
                <div className="opacity-50 text-[10px]">Fix {new Date(fix.ts).toLocaleTimeString()} · device sensor, stored locally</div>
              </div>
            </Popup>
          </Marker>
        </>
      )}
    </>
  );
};

export default SelfLocationLayer;
