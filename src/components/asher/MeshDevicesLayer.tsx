import { memo } from "react";
import { CircleMarker, Circle, Popup } from "react-leaflet";
import { Fragment } from "react";
import {
  LIVENESS_COLOR, batteryLabel, fixCaption, fmtAgo, liveness, type MeshDevice,
} from "@/lib/asher/meshDevices";

/**
 * SIGNED-IN FLEET — map layer for devices paired by Google account.
 *
 * A device is drawn only when it has actually reported a position. The halo is
 * that device's own reported accuracy, never a decorative radius, so the map
 * cannot imply a precision the GPS did not claim. Colour encodes freshness,
 * not identity: a laptop last heard yesterday must not look like one reporting
 * right now.
 */
interface Props {
  devices: MeshDevice[];
  focused: string | null;
  onFocus: (deviceId: string) => void;
  onRoute: (d: MeshDevice) => void;
}

const MeshDevicesLayer = ({ devices, focused, onFocus, onRoute }: Props) => {
  const positioned = devices.filter((d) => d.lat !== null && d.lng !== null);

  return (
    <>
      {positioned.map((d) => {
        const color = LIVENESS_COLOR[liveness(d)];
        const isFocused = focused === d.device_id;
        const radius = Math.max(25, Math.min(2000, d.accuracy && d.accuracy > 0 ? d.accuracy : 60));
        return (
          <Fragment key={d.id}>
            <Circle
              center={[d.lat as number, d.lng as number]}
              radius={radius}
              pathOptions={{ color, weight: 1, opacity: 0.45, fillColor: color, fillOpacity: 0.08 }}
            />
            <CircleMarker
              center={[d.lat as number, d.lng as number]}
              radius={isFocused ? 9 : 7}
              pathOptions={{ color, weight: 2, fillColor: "#0b1220", fillOpacity: 0.85 }}
              eventHandlers={{ click: () => onFocus(d.device_id) }}
            >
              <Popup>
                <div className="min-w-[220px] space-y-1 text-xs">
                  <div className="font-semibold">{d.label || "Unnamed device"}</div>
                  <div className="capitalize opacity-70">
                    {d.form_factor} · {batteryLabel(d)}
                  </div>
                  <div>{fixCaption(d)}</div>
                  <div className="opacity-70">Checked in {fmtAgo(d.last_seen_at)}</div>
                  {d.google_emails?.length > 0 && (
                    <div className="text-[10px] opacity-60">Paired via {d.google_emails[0]}</div>
                  )}
                  <div className="pt-1">
                    <button className="underline" onClick={() => onRoute(d)}>Route to it</button>
                  </div>
                  <div className="text-[10px] opacity-60">
                    Reported by the device itself · Asherin fleet mesh
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          </Fragment>
        );
      })}
    </>
  );
};

export default memo(MeshDevicesLayer);
