// SelfLocationLayer — own-force ("blue force") rendering on the Intelligence
// Map: live fix, accuracy disc, heading cone, breadcrumb trail and geofences.
//
// Pure presentation. It never touches the sensor; every value arrives already
// gated by the tracking engine, so a degraded fix renders visibly degraded
// (hollow, dashed) rather than being drawn as a confident position.

import { Circle, CircleMarker, Polygon, Polyline, Popup, Tooltip } from "react-leaflet";
import {
  compass16, fmtSpeed, type Geofence, type SelfFix,
} from "@/lib/asher/selfTrack";

interface Props {
  fix: SelfFix | null;
  trail: SelfFix[];
  fences: Geofence[];
  onRemoveFence?: (id: string) => void;
}

const BLUE = "#38bdf8";
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
          <CircleMarker
            center={[fix.lat, fix.lng]}
            radius={6}
            pathOptions={{ color: "#0b1220", weight: 2, fillColor: fix.degraded ? "#f59e0b" : BLUE, fillOpacity: 1 }}
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
          </CircleMarker>
        </>
      )}
    </>
  );
};

export default SelfLocationLayer;
