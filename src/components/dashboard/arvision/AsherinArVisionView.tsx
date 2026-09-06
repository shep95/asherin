// asherin.arvision — room shell.
//
// Two layers live here. The optical layer is the existing head up display over
// the device camera. The spatial layer is the capability set from the uploaded
// see-through-walls package: map positioning, indoor routing with spoken turn by
// turn guidance, a shared live session, and the silhouette view for people behind
// geometry. The shell keeps both reachable on a phone without either one being
// cropped: the switch is a pair of pills that sit above the layer, and each layer
// owns its own scrolling.

import { Suspense, lazy, useState } from "react";
import { Eye, Radar } from "lucide-react";
import OpticalHudView from "./OpticalHudView";

const SpatialView = lazy(() => import("./spatial/SpatialView"));

type Layer = "optical" | "spatial";

const LAYERS: { id: Layer; label: string; hint: string; icon: typeof Eye }[] = [
  { id: "optical", label: "optical", hint: "camera head up display", icon: Eye },
  { id: "spatial", label: "spatial", hint: "map, route, session, see through", icon: Radar },
];

const AsherinArVisionView = () => {
  const [layer, setLayer] = useState<Layer>("optical");

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-black">
      <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-white/8 bg-black/80 px-3 py-2 backdrop-blur-xl">
        {LAYERS.map(({ id, label, hint, icon: Icon }) => {
          const active = layer === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setLayer(id)}
              aria-pressed={active}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-light transition ${
                active
                  ? "border-white/45 bg-white/[0.14] text-white"
                  : "border-white/12 bg-white/[0.04] text-white/60 hover:border-white/25 hover:text-white"
              }`}
              title={hint}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          );
        })}
        <span className="ml-auto hidden shrink-0 text-[11px] font-light text-white/35 sm:block">
          {LAYERS.find((l) => l.id === layer)?.hint}
        </span>
      </div>

      <div className="relative min-h-0 flex-1">
        <div className={`absolute inset-0 ${layer === "optical" ? "" : "pointer-events-none invisible"}`}>
          <OpticalHudView />
        </div>
        {layer === "spatial" && (
          <div className="absolute inset-0">
            <Suspense
              fallback={
                <div className="flex h-full w-full items-center justify-center text-[12px] font-light text-white/45">
                  loading spatial layer
                </div>
              }
            >
              <SpatialView />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
};

export default AsherinArVisionView;
