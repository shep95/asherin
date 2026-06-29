// Wallpapers are served as static URLs from /public/wallpapers/ so they are NOT
// bundled into the JS payload. Only the active wallpaper is fetched at runtime
// (previously all 21 PNGs ≈ 50MB were eagerly imported on landing + dashboard).

export interface WallpaperOption {
  key: string;
  label: string;
  src: string;
}

const url = (file: string) => `/wallpapers/${file}`;

export const ALL_WALLPAPERS: WallpaperOption[] = [
  { key: "default", label: "Original", src: url("hero-bg.png") },
  { key: "raven", label: "Raven", src: url("wallpaper-raven.png") },
  { key: "eclipse", label: "Eclipse", src: url("wallpaper-eclipse.png") },
  { key: "glitch", label: "Glitch", src: url("wallpaper-glitch.png") },
  { key: "aureon", label: "Aureon", src: url("wallpaper-aureon.png") },
  { key: "seraph", label: "Seraph", src: url("wallpaper-seraph.png") },
  { key: "prophet", label: "Prophet", src: url("wallpaper-prophet.png") },
  { key: "nexus", label: "Nexus", src: url("wallpaper-nexus.png") },
  { key: "sentinel", label: "Sentinel", src: url("wallpaper-sentinel.png") },
  { key: "inferno", label: "Inferno", src: url("wallpaper-inferno.png") },
  { key: "sorrow", label: "Sorrow", src: url("wallpaper-sorrow.png") },
  { key: "silhouette", label: "Silhouette", src: url("wallpaper-silhouette.png") },
  { key: "phantom", label: "Phantom", src: url("wallpaper-phantom.png") },
  { key: "abyss", label: "Abyss", src: url("wallpaper-abyss.png") },
  { key: "stealth", label: "Stealth", src: url("wallpaper-stealth.png") },
  { key: "static", label: "Static", src: url("wallpaper-static.png") },
  { key: "mane", label: "Mane", src: url("wallpaper-mane.png") },
  { key: "impact", label: "Impact", src: url("wallpaper-impact.png") },
  { key: "oracle", label: "Oracle", src: url("wallpaper-oracle.png") },
  { key: "ascend", label: "Ascend", src: url("wallpaper-ascend.png") },
  { key: "cosmos", label: "Cosmos", src: url("wallpaper-cosmos.png") },
];

export const getWallpaperSrc = (key: string, fallback?: string): string => {
  const wp = ALL_WALLPAPERS.find((w) => w.key === key);
  return wp?.src || fallback || ALL_WALLPAPERS[0].src;
};
