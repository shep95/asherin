import { useState, useEffect } from "react";
import { getStoredWallpaper } from "./WallpaperSwitcher";
import WallpaperSwitcher from "./WallpaperSwitcher";
import ClickRippleEffect from "./ClickRippleEffect";

interface Props {
  children: React.ReactNode;
  overlayOpacity?: string;
}

const LandingBackground = ({ children, overlayOpacity = "bg-black/80" }: Props) => {
  const [currentWallpaper, setCurrentWallpaper] = useState(getStoredWallpaper);

  useEffect(() => {
    const handler = () => setCurrentWallpaper(getStoredWallpaper());
    window.addEventListener("wallpaper-change", handler);
    return () => window.removeEventListener("wallpaper-change", handler);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url(${currentWallpaper})`, zIndex: 0 }}
      />
      <div className={`fixed inset-0 ${overlayOpacity} pointer-events-none`} style={{ zIndex: 1 }} />
      {/* Ambient aurora glow — applies across all landing-connected pages */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-1/2 top-[18vh] -translate-x-1/2 w-[95vw] max-w-[1300px] h-[560px] zophiel-aurora rounded-full"
        style={{ zIndex: 2 }}
      />
      <div className="relative" style={{ zIndex: 10 }}>
        {children}
      </div>
      <ClickRippleEffect />
      <WallpaperSwitcher />
    </div>
  );
};

export default LandingBackground;
