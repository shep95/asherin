import { useState, useEffect, ReactNode } from "react";
import { getStoredWallpaper } from "./WallpaperSwitcher";
import WallpaperSwitcher from "./WallpaperSwitcher";
import { Link } from "react-router-dom";
import aureonLogo from "@/assets/aureon-logo.png";

interface Props {
  children: ReactNode;
  overlayOpacity?: string; // e.g. "bg-black/80"
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
        className="fixed inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700"
        style={{ backgroundImage: `url(${wallpaper})` }}
      />
      <div className={`fixed inset-0 ${overlayOpacity}`} />
      {children}
      {/* Bottom-left logo watermark */}
      <Link
        to="/"
        className="fixed bottom-6 left-6 z-20 flex items-center gap-2.5 rounded-xl border border-border/20 bg-card/40 backdrop-blur-md px-3 py-2 transition-all hover:bg-card/60 hover:border-border/40"
      >
        <img src={aureonLogo} alt="Aureon" className="h-6 w-6 object-contain opacity-80" />
        <span className="text-xs font-extralight tracking-[0.2em] text-muted-foreground/60 uppercase">
          Aureon
        </span>
      </Link>
      <WallpaperSwitcher />
    </div>
  );
};

export default LandingBackground;
