// AnnotationPanel — operator-side editing surface for the map overlay.
// Manual draw modes, per-item focus/rename/delete, GeoJSON export.
import { useMemo, useState } from "react";
import {
  MapPin, Circle as CircleIcon, Spline, Hexagon, Type as TypeIcon,
  Trash2, Download, Crosshair, PenLine, Check, X,
} from "lucide-react";
import {
  annoCenter, annoColor, annoMetric, toGeoJSON, type MapAnnotation,
} from "@/lib/asher/mapAnnotations";

export type DrawMode = "none" | "marker" | "label" | "circle" | "polygon" | "line";

interface Props {
  annotations: MapAnnotation[];
  drawMode: DrawMode;
  draftPath: Array<{ lat: number; lng: number }>;
  onSetDrawMode: (m: DrawMode) => void;
  onFinishDraft: () => void;
  onCancelDraft: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onClear: () => void;
  onFocus: (a: MapAnnotation) => void;
}

const KIND_ICON = {
  marker: MapPin, label: TypeIcon, circle: CircleIcon, polygon: Hexagon, line: Spline,
} as const;

const MODES: Array<{ id: DrawMode; label: string; hint: string }> = [
  { id: "marker", label: "Pin", hint: "Click the map to drop an intel pin" },
  { id: "label", label: "Label", hint: "Click the map to place a text label" },
  { id: "circle", label: "Radius", hint: "Click centre, then click the edge" },
  { id: "line", label: "Route", hint: "Click each node, then Finish" },
  { id: "polygon", label: "Zone", hint: "Click each vertex (3+), then Finish" },
];

const AnnotationPanel = ({
  annotations, drawMode, draftPath, onSetDrawMode, onFinishDraft, onCancelDraft,
  onDelete, onRename, onClear, onFocus,
}: Props) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const activeHint = useMemo(
    () => MODES.find((m) => m.id === drawMode)?.hint ?? null,
    [drawMode],
  );

  const exportGeoJson = () => {
    const blob = new Blob([JSON.stringify(toGeoJSON(annotations), null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `asher-map-overlay-${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border-t border-border/15">
      <div className="flex items-center justify-between px-4 py-2.5">
        <div className="flex items-center gap-2">
          <PenLine className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">Map Editor</p>
        </div>
        <span className="text-[10px] tracking-wide text-muted-foreground/60">{annotations.length}</span>
      </div>

      {/* Draw tools */}
      <div className="flex flex-wrap gap-1 px-3 pb-2">
        {MODES.map((m) => {
          const Icon = KIND_ICON[m.id as keyof typeof KIND_ICON];
          const on = drawMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onSetDrawMode(on ? "none" : m.id)}
              aria-pressed={on}
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] tracking-wide transition-colors ${
                on
                  ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-300"
                  : "border-border/25 bg-background/30 text-muted-foreground hover:text-foreground hover:border-border/40"
              }`}
            >
              <Icon className="h-3 w-3" strokeWidth={1.5} />
              {m.label}
            </button>
          );
        })}
      </div>

      {drawMode !== "none" && (
        <div className="mx-3 mb-2 rounded-md border border-emerald-400/25 bg-emerald-400/5 px-2.5 py-2">
          <p className="text-[10px] font-light leading-relaxed text-emerald-200/90">{activeHint}</p>
          {draftPath.length > 0 && (
            <p className="mt-1 text-[10px] text-muted-foreground">{draftPath.length} node{draftPath.length === 1 ? "" : "s"} staged</p>
          )}
          <div className="mt-2 flex gap-1.5">
            {(drawMode === "line" || drawMode === "polygon") && (
              <button
                onClick={onFinishDraft}
                disabled={draftPath.length < (drawMode === "polygon" ? 3 : 2)}
                className="flex items-center gap-1 rounded border border-emerald-400/40 px-2 py-0.5 text-[10px] text-emerald-300 disabled:opacity-30"
              >
                <Check className="h-3 w-3" /> Finish
              </button>
            )}
            <button
              onClick={onCancelDraft}
              className="flex items-center gap-1 rounded border border-border/30 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      <div className="max-h-56 overflow-y-auto px-2 pb-2">
        {annotations.length === 0 ? (
          <p className="px-2 py-2 text-[10px] font-extralight leading-relaxed text-muted-foreground/60">
            No overlay objects. Use a draw tool, or tell Asher AI to “pin the port of Odesa as a target” / “draw a 2km ring around this site”.
          </p>
        ) : (
          annotations.map((a) => {
            const Icon = KIND_ICON[a.kind];
            const metric = annoMetric(a);
            const c = annoCenter(a);
            return (
              <div key={a.id} className="group rounded-md px-2 py-1.5 hover:bg-foreground/5">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: annoColor(a) }} />
                  <Icon className="h-3 w-3 flex-shrink-0 text-muted-foreground" strokeWidth={1.5} />
                  {editingId === a.id ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => { onRename(a.id, draft.trim() || a.label); setEditingId(null); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { onRename(a.id, draft.trim() || a.label); setEditingId(null); }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="min-w-0 flex-1 rounded border border-border/40 bg-background/60 px-1.5 py-0.5 text-[11px] text-foreground focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => onFocus(a)}
                      className="min-w-0 flex-1 truncate text-left text-[11px] font-light text-foreground"
                      title={a.note || a.label}
                    >
                      {a.label}
                    </button>
                  )}
                  <button
                    onClick={() => { setEditingId(a.id); setDraft(a.label); }}
                    className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                    title="Rename"
                  >
                    <PenLine className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => onDelete(a.id)}
                    className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-red-400"
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                </div>
                <p className="pl-7 text-[9px] tracking-wide text-muted-foreground/60">
                  {metric ?? (c ? `${c.lat.toFixed(4)}, ${c.lng.toFixed(4)}` : "")}
                </p>
              </div>
            );
          })
        )}
      </div>

      {annotations.length > 0 && (
        <div className="flex gap-1.5 px-3 pb-3">
          <button
            onClick={exportGeoJson}
            className="flex items-center gap-1 rounded-md border border-border/25 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground"
          >
            <Download className="h-3 w-3" strokeWidth={1.5} /> GeoJSON
          </button>
          <button
            onClick={onClear}
            className="flex items-center gap-1 rounded-md border border-border/25 px-2 py-1 text-[10px] text-muted-foreground hover:text-red-400"
          >
            <Crosshair className="h-3 w-3" strokeWidth={1.5} /> Clear all
          </button>
        </div>
      )}
    </div>
  );
};

export default AnnotationPanel;
