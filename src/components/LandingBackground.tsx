import { useState, useEffect } from "react";
import { getStoredWallpaper, getStoredWallpaperKey, getGlassRefraction } from "./WallpaperSwitcher";
import WallpaperSwitcher from "./WallpaperSwitcher";
import ClickRippleEffect from "./ClickRippleEffect";

interface Props {
  children: React.ReactNode;
  overlayOpacity?: string;
}

const GLASS_TONES: Record<string, React.CSSProperties> = {
  default: {
    "--glass-bg": "32 18% 56% / 0.08",
    "--glass-border": "36 26% 72% / 0.14",
    "--glass-highlight": "34 46% 78% / 0.14",
    "--glass-streak-soft": "34 42% 70% / 0.08",
    "--glass-streak-strong": "30 58% 78% / 0.16",
    "--glass-glow-a": "30 34% 62% / 0.08",
    "--glass-glow-b": "40 28% 68% / 0.05",
  } as React.CSSProperties,
  raven: {
    "--glass-bg": "220 14% 44% / 0.08",
    "--glass-border": "220 18% 68% / 0.14",
    "--glass-highlight": "220 26% 80% / 0.13",
    "--glass-streak-soft": "215 24% 70% / 0.08",
    "--glass-streak-strong": "220 28% 82% / 0.14",
    "--glass-glow-a": "225 20% 62% / 0.07",
    "--glass-glow-b": "210 18% 74% / 0.05",
  } as React.CSSProperties,
  eclipse: {
    "--glass-bg": "214 16% 42% / 0.08",
    "--glass-border": "214 22% 70% / 0.14",
    "--glass-highlight": "210 32% 82% / 0.14",
    "--glass-streak-soft": "208 28% 74% / 0.08",
    "--glass-streak-strong": "210 40% 84% / 0.15",
    "--glass-glow-a": "212 24% 64% / 0.07",
    "--glass-glow-b": "220 18% 76% / 0.05",
  } as React.CSSProperties,
  glitch: {
    "--glass-bg": "198 24% 44% / 0.08",
    "--glass-border": "192 34% 72% / 0.15",
    "--glass-highlight": "188 54% 82% / 0.14",
    "--glass-streak-soft": "190 48% 72% / 0.09",
    "--glass-streak-strong": "184 70% 80% / 0.16",
    "--glass-glow-a": "192 36% 60% / 0.08",
    "--glass-glow-b": "184 28% 74% / 0.05",
  } as React.CSSProperties,
  aureon: {
    "--glass-bg": "34 24% 52% / 0.09",
    "--glass-border": "38 34% 74% / 0.16",
    "--glass-highlight": "40 52% 84% / 0.15",
    "--glass-streak-soft": "34 48% 72% / 0.09",
    "--glass-streak-strong": "32 68% 80% / 0.18",
    "--glass-glow-a": "34 42% 62% / 0.09",
    "--glass-glow-b": "42 30% 72% / 0.06",
  } as React.CSSProperties,
  seraph: {
    "--glass-bg": "214 20% 52% / 0.08",
    "--glass-border": "214 30% 76% / 0.15",
    "--glass-highlight": "212 50% 86% / 0.15",
    "--glass-streak-soft": "210 42% 76% / 0.09",
    "--glass-streak-strong": "208 64% 84% / 0.16",
    "--glass-glow-a": "214 32% 66% / 0.08",
    "--glass-glow-b": "206 22% 78% / 0.05",
  } as React.CSSProperties,
  prophet: {
    "--glass-bg": "154 18% 44% / 0.08",
    "--glass-border": "154 24% 66% / 0.14",
    "--glass-highlight": "154 34% 80% / 0.14",
    "--glass-streak-soft": "152 30% 70% / 0.08",
    "--glass-streak-strong": "154 42% 80% / 0.15",
    "--glass-glow-a": "154 24% 58% / 0.07",
    "--glass-glow-b": "152 18% 72% / 0.05",
  } as React.CSSProperties,
  nexus: {
    "--glass-bg": "236 18% 46% / 0.08",
    "--glass-border": "236 26% 70% / 0.14",
    "--glass-highlight": "236 38% 82% / 0.14",
    "--glass-streak-soft": "236 32% 74% / 0.08",
    "--glass-streak-strong": "238 48% 82% / 0.15",
    "--glass-glow-a": "236 28% 60% / 0.08",
    "--glass-glow-b": "238 22% 74% / 0.05",
  } as React.CSSProperties,
  sentinel: {
    "--glass-bg": "44 18% 48% / 0.08",
    "--glass-border": "46 28% 72% / 0.15",
    "--glass-highlight": "48 44% 84% / 0.14",
    "--glass-streak-soft": "44 36% 74% / 0.08",
    "--glass-streak-strong": "48 54% 84% / 0.16",
    "--glass-glow-a": "46 30% 62% / 0.08",
    "--glass-glow-b": "42 20% 76% / 0.05",
  } as React.CSSProperties,
  inferno: {
    "--glass-bg": "16 28% 46% / 0.09",
    "--glass-border": "18 42% 70% / 0.16",
    "--glass-highlight": "20 58% 82% / 0.15",
    "--glass-streak-soft": "18 48% 70% / 0.09",
    "--glass-streak-strong": "16 70% 78% / 0.18",
    "--glass-glow-a": "14 44% 58% / 0.09",
    "--glass-glow-b": "24 28% 72% / 0.06",
  } as React.CSSProperties,
  sorrow: {
    "--glass-bg": "252 14% 46% / 0.08",
    "--glass-border": "252 20% 70% / 0.14",
    "--glass-highlight": "252 28% 82% / 0.14",
    "--glass-streak-soft": "250 24% 72% / 0.08",
    "--glass-streak-strong": "254 34% 82% / 0.15",
    "--glass-glow-a": "252 18% 60% / 0.08",
    "--glass-glow-b": "248 14% 74% / 0.05",
  } as React.CSSProperties,
  silhouette: {
    "--glass-bg": "26 14% 40% / 0.08",
    "--glass-border": "28 20% 64% / 0.13",
    "--glass-highlight": "30 28% 78% / 0.13",
    "--glass-streak-soft": "28 22% 68% / 0.08",
    "--glass-streak-strong": "30 34% 78% / 0.14",
    "--glass-glow-a": "26 18% 54% / 0.07",
    "--glass-glow-b": "30 14% 68% / 0.05",
  } as React.CSSProperties,
  phantom: {
    "--glass-bg": "210 10% 50% / 0.07",
    "--glass-border": "210 16% 72% / 0.13",
    "--glass-highlight": "210 24% 84% / 0.13",
    "--glass-streak-soft": "210 18% 74% / 0.08",
    "--glass-streak-strong": "210 28% 84% / 0.14",
    "--glass-glow-a": "210 14% 60% / 0.07",
    "--glass-glow-b": "210 12% 76% / 0.05",
  } as React.CSSProperties,
  abyss: {
    "--glass-bg": "206 20% 34% / 0.08",
    "--glass-border": "202 28% 60% / 0.14",
    "--glass-highlight": "198 40% 76% / 0.13",
    "--glass-streak-soft": "200 34% 66% / 0.08",
    "--glass-streak-strong": "196 54% 76% / 0.15",
    "--glass-glow-a": "202 30% 54% / 0.08",
    "--glass-glow-b": "196 20% 68% / 0.05",
  } as React.CSSProperties,
  custom: {
    "--glass-bg": "0 0% 58% / 0.07",
    "--glass-border": "0 0% 78% / 0.12",
    "--glass-highlight": "0 0% 90% / 0.12",
    "--glass-streak-soft": "0 0% 82% / 0.07",
    "--glass-streak-strong": "0 0% 94% / 0.12",
    "--glass-glow-a": "0 0% 72% / 0.07",
    "--glass-glow-b": "0 0% 86% / 0.04",
  } as React.CSSProperties,
};

const LandingBackground = ({ children, overlayOpacity = "bg-black/80" }: Props) => {
  const [currentWallpaper, setCurrentWallpaper] = useState(getStoredWallpaper);
  const [wallpaperKey, setWallpaperKey] = useState(getStoredWallpaperKey);
  const [glassOn, setGlassOn] = useState(getGlassRefraction);

  useEffect(() => {
    const handler = () => {
      setCurrentWallpaper(getStoredWallpaper());
      setWallpaperKey(getStoredWallpaperKey());
      setGlassOn(getGlassRefraction());
    };
    window.addEventListener("wallpaper-change", handler);
    return () => window.removeEventListener("wallpaper-change", handler);
  }, []);

  return (
    <div
      className={`relative min-h-screen overflow-hidden bg-background ${glassOn ? "liquid-glass-mode" : ""}`}
      style={GLASS_TONES[wallpaperKey] ?? GLASS_TONES.default}
    >
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
