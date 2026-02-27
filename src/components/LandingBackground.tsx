import { useState, useEffect, ReactNode } from "react";
import { getStoredWallpaper } from "./WallpaperSwitcher";
import WallpaperSwitcher from "./WallpaperSwitcher";

interface Props {
  children: ReactNode;
  overlayOpacity?: string;
}

const LandingBackground = ({ children, overlayOpacity = "bg-black/80" }: Props) => {
  const [wallpaper, setWallpaper] = useState(getStoredWallpaper);

  useEffect(() => {
    const handler = () => setWallpaper(getStoredWallpaper());
    window.addEventListener("wallpaper-change", handler);
    return () => window.removeEventListener("wallpaper-change", handler);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 pointer-events-none"
        style={{ backgroundImage: `url(${wallpaper})` }}
      />
      <div className={`fixed inset-0 ${overlayOpacity} pointer-events-none`} />
      <div className="relative z-10">
        {children}
      </div>
      <WallpaperSwitcher />
    </div>
  );
};

export default LandingBackground;
