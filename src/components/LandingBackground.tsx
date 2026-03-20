import { useState, useEffect, lazy, Suspense } from "react";
import { getStoredWallpaper } from "./WallpaperSwitcher";
import WallpaperSwitcher from "./WallpaperSwitcher";
import ClickRippleEffect from "./ClickRippleEffect";

const AnimatedVortexWallpaper = lazy(() => import("./AnimatedVortexWallpaper"));

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

  const isVortex = currentWallpaper === "vortex";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {isVortex ? (
        <Suspense fallback={<div className="fixed inset-0 bg-background" style={{ zIndex: 0 }} />}>
          <AnimatedVortexWallpaper />
        </Suspense>
      ) : (
        <div
          className="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
          style={{ backgroundImage: `url(${currentWallpaper})`, zIndex: 0 }}
        />
      )}
      <div
        className={`fixed inset-0 pointer-events-none`}
        style={{
          zIndex: 1,
          backgroundColor: isVortex ? 'hsl(0 0% 0% / 0.4)' : undefined,
        }}
      >
        {!isVortex && <div className={`absolute inset-0 ${overlayOpacity}`} />}
      </div>
      <div className="relative" style={{ zIndex: 10 }}>
        {children}
      </div>
      <ClickRippleEffect />
      <WallpaperSwitcher />
    </div>
  );
};

export default LandingBackground;
