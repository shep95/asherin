import { CircleMarker, Circle, Polyline, Popup } from "react-leaflet";
import { Fragment, memo } from "react";
import { STATE_COLOR, fmtAge, type LocatedDevice } from "@/lib/asher/findMy";

/**
 * MY DEVICES — group map layer for owned BLE gear.
 *
 * Renders one hollow-ringed golden-brown dot per owned device, a translucent
 * halo sized to the *fused confidence radius* (never a fake pin), and, for the
 * focused device, the 24-hour breadcrumb polyline. A STOLEN device draws in red
 * with a heavier ring so it reads instantly at a glance.
 *
 * All geometry is Canvas-rendered by the parent MapContainer (`preferCanvas`),
 * so a roster of dozens of devices with halos stays at 60 fps.
 */
interface Props {
  devices: LocatedDevice[];
  focusedFingerprint: string | null;
  breadcrumb: Array<{ lat: number; lng: number; seen_at: string }>;
  onFocus: (fingerprint: string) => void;
  onRoute: (d: LocatedDevice) => void;
}

const MyDevicesLayer = ({ devices, focusedFingerprint, breadcrumb, onFocus, onRoute }: Props) => {
  const positioned = devices.filter((d) => d.fused);

  return (
    <>
      {breadcrumb.length > 1 && (
        <Polyline
          positions={breadcrumb.map((p) => [p.lat, p.lng] as [number, number])}
          pathOptions={{ color: "#c98b3a", weight: 3, opacity: 0.6, dashArray: "4 6" }}
        />
      )}

      {positioned.map((d) => {
        const f = d.fused!;
        const color = STATE_COLOR[d.effectiveState];
        const focused = focusedFingerprint === d.fingerprint;
        return (
          <div key={d.fingerprint} style={{ display: "contents" }}>
            {/* Confidence halo — the honest answer, sized to fused error. */}
            <Circle
              center={[f.lat, f.lng]}
              radius={f.radiusM}
              pathOptions={{
                color,
                weight: 1,
                opacity: 0.5,
                fillColor: color,
                fillOpacity: d.effectiveState === "stolen" ? 0.16 : 0.08,
              }}
            />
            <CircleMarker
              center={[f.lat, f.lng]}
              radius={focused ? 9 : 7}
              pathOptions={{
                color,
                weight: d.effectiveState === "stolen" ? 3 : 2,
                fillColor: "#0b1220",
                fillOpacity: 0.85,
              }}
              eventHandlers={{ click: () => onFocus(d.fingerprint) }}
            >
              <Popup>
                <div className="min-w-[210px] space-y-1 text-xs">
                  <div className="font-semibold">{d.label}</div>
                  <div className="opacity-70 capitalize">{d.kind} · {d.effectiveState}</div>
                  <div>{f.caption}</div>
                  <div className="opacity-70">Last heard {fmtAge(f.lastSeenAt)}</div>
                  <div className="flex gap-2 pt-1">
                    <button className="underline" onClick={() => onFocus(d.fingerprint)}>Breadcrumb</button>
                    <button className="underline" onClick={() => onRoute(d)}>Route to it</button>
                  </div>
                  <div className="text-[10px] opacity-60">
                    Fused from {f.fixCount} live sighting{f.fixCount === 1 ? "" : "s"} · Asherin mesh
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          </div>
        );
      })}
    </>
  );
};

export default memo(MyDevicesLayer);
