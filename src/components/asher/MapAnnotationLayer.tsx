// MapAnnotationLayer — renders the operator/AI editable overlay on the
// Intelligence Map. Pure presentation: every mutation is delegated upward.
import { CircleMarker, Circle, Polygon, Polyline, Popup, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import { annoColor, annoMetric, type MapAnnotation } from "@/lib/asher/mapAnnotations";

interface Props {
  annotations: MapAnnotation[];
  onDelete: (id: string) => void;
  focusedId?: string | null;
}

const labelIcon = (text: string, color: string) =>
  L.divIcon({
    className: "asher-anno-label",
    html: `<div style="transform:translate(-50%,-50%);white-space:nowrap;padding:2px 7px;border-radius:6px;border:1px solid ${color}99;background:rgba(9,9,11,.85);color:#e4e4e7;font:500 10px/1.3 ui-sans-serif,system-ui;letter-spacing:.06em;box-shadow:0 2px 10px rgba(0,0,0,.5)">${
      text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string))
    }</div>`,
    iconSize: [0, 0],
  });

const AnnoPopup = ({ a, onDelete }: { a: MapAnnotation; onDelete: (id: string) => void }) => {
  const metric = annoMetric(a);
  return (
    <Popup>
      <div className="text-xs space-y-1 min-w-[160px]">
        <div className="font-semibold">{a.label}</div>
        {a.category && <div className="opacity-70 uppercase tracking-wide text-[10px]">{a.category}</div>}
        {a.note && <div className="opacity-85">{a.note}</div>}
        {metric && <div className="opacity-70">{metric}</div>}
        <div className="opacity-50 font-mono text-[10px]">
          {a.lat != null && a.lng != null ? `${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}` : `${a.path?.length ?? 0} vertices`}
        </div>
        <div className="opacity-50 text-[10px]">{a.source === "asher-ai" ? "placed by Asher AI" : "placed by operator"}</div>
        <button
          onClick={() => onDelete(a.id)}
          className="mt-1 rounded border border-red-400/40 px-2 py-0.5 text-[10px] text-red-500 hover:bg-red-500/10"
        >
          Delete
        </button>
      </div>
    </Popup>
  );
};

const MapAnnotationLayer = ({ annotations, onDelete, focusedId }: Props) => (
  <>
    {annotations.map((a) => {
      const color = annoColor(a);
      const focused = focusedId === a.id;
      const stroke = { color, weight: focused ? 4 : 2, fillColor: color, fillOpacity: 0.2 };
      switch (a.kind) {
        case "marker":
          return (
            <CircleMarker
              key={a.id}
              center={[a.lat!, a.lng!]}
              radius={focused ? 11 : 8}
              pathOptions={{ ...stroke, fillOpacity: 0.7 }}
            >
              <Tooltip direction="top" offset={[0, -8]} opacity={0.95}>{a.label}</Tooltip>
              <AnnoPopup a={a} onDelete={onDelete} />
            </CircleMarker>
          );
        case "label":
          return (
            <Marker key={a.id} position={[a.lat!, a.lng!]} icon={labelIcon(a.label, color)}>
              <AnnoPopup a={a} onDelete={onDelete} />
            </Marker>
          );
        case "circle":
          return (
            <Circle key={a.id} center={[a.lat!, a.lng!]} radius={a.radiusM!} pathOptions={stroke}>
              <AnnoPopup a={a} onDelete={onDelete} />
            </Circle>
          );
        case "polygon":
          return (
            <Polygon key={a.id} positions={a.path!.map((p) => [p.lat, p.lng]) as [number, number][]} pathOptions={stroke}>
              <AnnoPopup a={a} onDelete={onDelete} />
            </Polygon>
          );
        case "line":
          return (
            <Polyline
              key={a.id}
              positions={a.path!.map((p) => [p.lat, p.lng]) as [number, number][]}
              pathOptions={{ ...stroke, fillOpacity: 0, dashArray: "6 5" }}
            >
              <AnnoPopup a={a} onDelete={onDelete} />
            </Polyline>
          );
        default:
          return null;
      }
    })}
  </>
);

export default MapAnnotationLayer;
