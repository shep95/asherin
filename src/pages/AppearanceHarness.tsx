import { useEffect, useState } from "react";
import DashboardSurface from "@/components/dashboard/DashboardSurface";
import DashboardAppearanceControls from "@/components/dashboard/settings/DashboardAppearanceControls";
import { APPEARANCE_EVENT, readAppearance, writeAppearance, type DashboardAppearance } from "@/lib/dashboardAppearance";
import { getWallpaperSrc } from "@/lib/wallpapers";

const AppearanceHarness = () => {
  const [a, setA] = useState<DashboardAppearance>(() => readAppearance());
  useEffect(() => {
    const s = () => setA(readAppearance());
    window.addEventListener(APPEARANCE_EVENT, s);
    return () => window.removeEventListener(APPEARANCE_EVENT, s);
  }, []);
  const [wp, setWp] = useState(() => localStorage.getItem("aureon_wallpaper") || "aureon");
  return (
    <div className="relative min-h-dvh">
      <DashboardSurface appearance={a} activeWallpaper={getWallpaperSrc(wp)} prevWallpaper={null} transitioning={false} />
      <div className="relative z-10 p-6 max-w-4xl">
        <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-5">
          <DashboardAppearanceControls
            appearance={a}
            onChange={(patch) => setA(writeAppearance(patch))}
            wallpaperLabel="Eclipse"
          />
          <button data-pick-eclipse className="mt-4 text-xs text-foreground" onClick={() => { localStorage.setItem("aureon_wallpaper","eclipse"); setWp("eclipse"); setA(writeAppearance({ mode: "wallpaper" })); }}>pick eclipse</button>
        </div>
        <p data-chat-line className="mt-4 text-sm text-foreground">asherin chat line for contrast</p>
      </div>
    </div>
  );
};
export default AppearanceHarness;
