import { useState, useEffect, useRef, useCallback } from "react";
import { getStoredWallpaper } from "./WallpaperSwitcher";
import WallpaperSwitcher from "./WallpaperSwitcher";
import ClickRippleEffect from "./ClickRippleEffect";

interface Props {
  children: React.ReactNode;
  overlayOpacity?: string;
}

const LandingBackground = ({ children, overlayOpacity = "bg-black/80" }: Props) => {
  const [currentWallpaper, setCurrentWallpaper] = useState(getStoredWallpaper);
  const [prevWallpaper, setPrevWallpaper] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleWallpaperChange = useCallback(() => {
    const newWp = getStoredWallpaper();
    if (newWp === currentWallpaper) return;

    // Start transition
    setPrevWallpaper(currentWallpaper);
    setCurrentWallpaper(newWp);
    setIsTransitioning(true);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsTransitioning(false);
      setPrevWallpaper(null);
    }, 900);
  }, [currentWallpaper]);

  useEffect(() => {
    window.addEventListener("wallpaper-change", handleWallpaperChange);
    return () => {
      window.removeEventListener("wallpaper-change", handleWallpaperChange);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [handleWallpaperChange]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Previous wallpaper (fades out) */}
      {prevWallpaper && isTransitioning && (
        <div
          className="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
          style={{
            backgroundImage: `url(${prevWallpaper})`,
            zIndex: 0,
          }}
        />
      )}

      {/* Current wallpaper (fades in) */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
        style={{
          backgroundImage: `url(${currentWallpaper})`,
          zIndex: 1,
          opacity: isTransitioning ? 0 : 1,
          animation: isTransitioning ? "wpFadeIn 0.8s cubic-bezier(0.16,1,0.3,1) 0.1s forwards" : undefined,
        }}
      />

      {/* Dark overlay — dims during transition to reveal the light streak */}
      <div
        className={`fixed inset-0 pointer-events-none transition-opacity duration-500`}
        style={{
          zIndex: 3,
          backgroundColor: 'hsl(0 0% 0% / 0.8)',
          opacity: isTransitioning ? 0.5 : 1,
        }}
      />

      {/* Light streak wipe effect — ABOVE the overlay */}
      {isTransitioning && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 4 }}
        >
          {/* Main luminous streak */}
          <div
            style={{
              position: "absolute",
              top: "-20%",
              bottom: "-20%",
              width: "35%",
              background: "linear-gradient(90deg, transparent 0%, hsla(275, 80%, 70%, 0.12) 15%, hsla(275, 80%, 85%, 0.3) 35%, hsla(0, 0%, 100%, 0.5) 50%, hsla(275, 80%, 85%, 0.3) 65%, hsla(275, 80%, 70%, 0.12) 85%, transparent 100%)",
              filter: "blur(25px)",
              animation: "wpLightStreak 0.85s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
              transform: "translateX(-100%) skewX(-8deg)",
            }}
          />
          {/* Secondary thin bright line */}
          <div
            style={{
              position: "absolute",
              top: "-10%",
              bottom: "-10%",
              width: "3px",
              background: "linear-gradient(180deg, transparent 5%, hsla(275, 80%, 85%, 0.7) 30%, hsla(0, 0%, 100%, 0.95) 50%, hsla(275, 80%, 85%, 0.7) 70%, transparent 95%)",
              filter: "blur(1px)",
              animation: "wpLightStreak 0.85s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
              transform: "translateX(-100%) skewX(-8deg)",
            }}
          />
          {/* Soft glow spread */}
          <div
            style={{
              position: "absolute",
              top: "-30%",
              bottom: "-30%",
              width: "60%",
              background: "radial-gradient(ellipse at center, hsla(275, 60%, 70%, 0.18) 0%, transparent 70%)",
              filter: "blur(40px)",
              animation: "wpLightStreak 0.85s cubic-bezier(0.25, 0.1, 0.25, 1) forwards",
              transform: "translateX(-100%) skewX(-5deg)",
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="relative" style={{ zIndex: 10 }}>
        {children}
      </div>

      <ClickRippleEffect />
      <WallpaperSwitcher />

      <style>{`
        @keyframes wpFadeIn {
          from { opacity: 0; transform: scale(1.02); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes wpLightStreak {
          from { transform: translateX(-50%) skewX(-8deg); }
          to { transform: translateX(calc(100vw + 50%)) skewX(-8deg); }
        }
      `}</style>
    </div>
  );
};

export default LandingBackground;
