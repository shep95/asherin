import wallpaperDefault from "@/assets/hero-bg.png";
import wallpaperRaven from "@/assets/wallpaper-raven.png";
import wallpaperEclipse from "@/assets/wallpaper-eclipse.png";
import wallpaperGlitch from "@/assets/wallpaper-glitch.png";
import wallpaperAureon from "@/assets/wallpaper-aureon.png";
import wallpaperSeraph from "@/assets/wallpaper-seraph.png";
import wallpaperProphet from "@/assets/wallpaper-prophet.png";
import wallpaperNexus from "@/assets/wallpaper-nexus.png";
import wallpaperSentinel from "@/assets/wallpaper-sentinel.png";
import wallpaperInferno from "@/assets/wallpaper-inferno.png";
import wallpaperSorrow from "@/assets/wallpaper-sorrow.png";
import wallpaperSilhouette from "@/assets/wallpaper-silhouette.png";
import wallpaperPhantom from "@/assets/wallpaper-phantom.png";
import wallpaperAbyss from "@/assets/wallpaper-abyss.png";
import wallpaperStealth from "@/assets/wallpaper-stealth.png";
import wallpaperStatic from "@/assets/wallpaper-static.png";
import wallpaperMane from "@/assets/wallpaper-mane.png";
import wallpaperImpact from "@/assets/wallpaper-impact.png";
import wallpaperOracle from "@/assets/wallpaper-oracle.png";
import wallpaperAscend from "@/assets/wallpaper-ascend.png";
import wallpaperCosmos from "@/assets/wallpaper-cosmos.png";

export interface WallpaperOption {
  key: string;
  label: string;
  src: string;
}

export const ALL_WALLPAPERS: WallpaperOption[] = [
  { key: "default", label: "Original", src: wallpaperDefault },
  { key: "raven", label: "Raven", src: wallpaperRaven },
  { key: "eclipse", label: "Eclipse", src: wallpaperEclipse },
  { key: "glitch", label: "Glitch", src: wallpaperGlitch },
  { key: "aureon", label: "Aureon", src: wallpaperAureon },
  { key: "seraph", label: "Seraph", src: wallpaperSeraph },
  { key: "prophet", label: "Prophet", src: wallpaperProphet },
  { key: "nexus", label: "Nexus", src: wallpaperNexus },
  { key: "sentinel", label: "Sentinel", src: wallpaperSentinel },
  { key: "inferno", label: "Inferno", src: wallpaperInferno },
  { key: "sorrow", label: "Sorrow", src: wallpaperSorrow },
  { key: "silhouette", label: "Silhouette", src: wallpaperSilhouette },
  { key: "phantom", label: "Phantom", src: wallpaperPhantom },
  { key: "abyss", label: "Abyss", src: wallpaperAbyss },
  { key: "stealth", label: "Stealth", src: wallpaperStealth },
  { key: "static", label: "Static", src: wallpaperStatic },
  { key: "mane", label: "Mane", src: wallpaperMane },
  { key: "impact", label: "Impact", src: wallpaperImpact },
  { key: "oracle", label: "Oracle", src: wallpaperOracle },
  { key: "ascend", label: "Ascend", src: wallpaperAscend },
  { key: "cosmos", label: "Cosmos", src: wallpaperCosmos },
];

export const getWallpaperSrc = (key: string, fallback?: string): string => {
  const wp = ALL_WALLPAPERS.find((w) => w.key === key);
  return wp?.src || fallback || ALL_WALLPAPERS[0].src;
};
