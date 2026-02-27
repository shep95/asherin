import { useState, useEffect, ReactNode, Children, isValidElement, cloneElement, ReactElement } from "react";
import { getStoredWallpaper } from "./WallpaperSwitcher";
import WallpaperSwitcher from "./WallpaperSwitcher";
import ScrollBlurFade from "./ScrollBlurFade";

interface Props {
  children: ReactNode;
  overlayOpacity?: string; // e.g. "bg-black/80"
}

// Components that should NOT be wrapped (header, etc.)
const SKIP_WRAP_TYPES = new Set(["Header"]);

const LandingBackground = ({ children, overlayOpacity = "bg-black/80" }: Props) => {
  const [wallpaper, setWallpaper] = useState(getStoredWallpaper);

  useEffect(() => {
    const handler = () => setWallpaper(getStoredWallpaper());
    window.addEventListener("wallpaper-change", handler);
    return () => window.removeEventListener("wallpaper-change", handler);
  }, []);

  // Auto-wrap each direct child in ScrollBlurFade (except Header and already-wrapped ScrollSection)
  const wrappedChildren = Children.map(children, (child, i) => {
    if (!isValidElement(child)) return child;

    // Get component display name
    const typeName =
      typeof child.type === "string"
        ? child.type
        : (child.type as any).displayName || (child.type as any).name || "";

    // Skip wrapping Header and ScrollBlurFade (already wrapped)
    if (SKIP_WRAP_TYPES.has(typeName) || typeName === "ScrollBlurFade" || typeName === "ScrollSection") {
      return child;
    }

    return (
      <ScrollBlurFade key={i} delay={i === 0 ? 0 : 50}>
        {child}
      </ScrollBlurFade>
    );
  });

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat transition-all duration-700 pointer-events-none"
        style={{ backgroundImage: `url(${wallpaper})` }}
      />
      <div className={`fixed inset-0 ${overlayOpacity} pointer-events-none`} />
      {wrappedChildren}
      <WallpaperSwitcher />
    </div>
  );
};

export default LandingBackground;
