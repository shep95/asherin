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
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{ backgroundImage: `url(${currentWallpaper})`, zIndex: 0 }}
      />
      <div className={`fixed inset-0 ${overlayOpacity} pointer-events-none`} style={{ zIndex: 1 }} />

      {/* Liquid glass refraction overlay */}
      {glassOn && (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 2 }}>
          {/* Primary refraction — large soft light streak */}
          <div
            className="absolute"
            style={{
              width: "120%",
              height: "60%",
              bottom: "-10%",
              left: "-10%",
              background: "radial-gradient(ellipse at 60% 80%, hsla(0,0%,100%,0.06) 0%, transparent 60%)",
              filter: "blur(40px)",
            }}
          />
          {/* Secondary caustic — diagonal light band */}
          <div
            className="absolute"
            style={{
              width: "80%",
              height: "40%",
              top: "30%",
              right: "-20%",
              background: "linear-gradient(135deg, transparent 30%, hsla(0,0%,100%,0.04) 50%, transparent 70%)",
              filter: "blur(30px)",
              transform: "rotate(-15deg)",
            }}
          />
          {/* Tertiary highlight — top-left corner refraction */}
          <div
            className="absolute"
            style={{
              width: "50%",
              height: "50%",
              top: "-5%",
              left: "-5%",
              background: "radial-gradient(ellipse at 20% 20%, hsla(0,0%,100%,0.035) 0%, transparent 50%)",
              filter: "blur(50px)",
            }}
          />
          {/* Subtle glass edge highlight — horizontal midline */}
          <div
            className="absolute"
            style={{
              width: "100%",
              height: "1px",
              top: "45%",
              left: 0,
              background: "linear-gradient(90deg, transparent 10%, hsla(0,0%,100%,0.06) 30%, hsla(0,0%,100%,0.08) 50%, hsla(0,0%,100%,0.06) 70%, transparent 90%)",
              filter: "blur(2px)",
            }}
          />
          {/* Bottom-right caustic sweep */}
          <div
            className="absolute"
            style={{
              width: "60%",
              height: "30%",
              bottom: "5%",
              right: "0%",
              background: "linear-gradient(160deg, transparent 40%, hsla(0,0%,100%,0.03) 55%, transparent 70%)",
              filter: "blur(25px)",
              transform: "rotate(5deg)",
            }}
          />
        </div>
      )}

      <div className="relative" style={{ zIndex: 10 }}>
        {children}
      </div>
      <ClickRippleEffect />
      <WallpaperSwitcher />
    </div>
  );
};

export default LandingBackground;
