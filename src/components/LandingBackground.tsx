import { useState, useEffect } from "react";
import { getStoredWallpaper, getGlassRefraction } from "./WallpaperSwitcher";
import WallpaperSwitcher from "./WallpaperSwitcher";
import ClickRippleEffect from "./ClickRippleEffect";

interface Props {
  children: React.ReactNode;
  overlayOpacity?: string;
}

const LandingBackground = ({ children, overlayOpacity = "bg-black/80" }: Props) => {
  const [currentWallpaper, setCurrentWallpaper] = useState(getStoredWallpaper);
  const [glassOn, setGlassOn] = useState(getGlassRefraction);

  useEffect(() => {
    const handler = () => {
      setCurrentWallpaper(getStoredWallpaper());
      setGlassOn(getGlassRefraction());
    };
    window.addEventListener("wallpaper-change", handler);
    return () => window.removeEventListener("wallpaper-change", handler);
  }, []);

  return (
    <div className={`relative min-h-screen overflow-hidden bg-background ${glassOn ? "liquid-glass-mode" : ""}`}>
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url(${currentWallpaper})`, zIndex: 0 }}
      />
      <div className={`fixed inset-0 ${glassOn ? "bg-black/40" : overlayOpacity} pointer-events-none transition-colors duration-500`} style={{ zIndex: 1 }} />
      <div className="relative" style={{ zIndex: 10 }}>
        {children}
      </div>
      <ClickRippleEffect />
      <WallpaperSwitcher />
    </div>
  );
};

export default LandingBackground;
