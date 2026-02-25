import { useState, useRef, useEffect } from "react";
import { Settings } from "lucide-react";
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

const WALLPAPERS = [
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
];

const STORAGE_KEY = "aureon_landing_wallpaper";

export const getStoredWallpaper = (): string => {
  const stored = localStorage.getItem(STORAGE_KEY);
  const wp = WALLPAPERS.find((w) => w.key === stored);
  return wp ? wp.src : wallpaperDefault;
};

const WallpaperSwitcher = () => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => localStorage.getItem(STORAGE_KEY) || "default");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const select = (key: string) => {
    setActive(key);
    localStorage.setItem(STORAGE_KEY, key);
    setOpen(false);
    window.dispatchEvent(new Event("wallpaper-change"));
  };

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-50">
      <button
        onClick={() => setOpen(!open)}
        className="rounded-2xl border border-border/30 bg-card/60 backdrop-blur-md p-2.5 text-muted-foreground hover:text-foreground transition-colors shadow-lg"
        aria-label="Change wallpaper"
      >
        <Settings className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute bottom-12 right-0 rounded-2xl border border-border/30 bg-card/80 backdrop-blur-xl p-3 shadow-2xl min-w-[220px] max-h-[400px] overflow-y-auto">
          <p className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase mb-2 px-1">Wallpaper</p>
          <div className="grid grid-cols-2 gap-2">
            {WALLPAPERS.map((wp) => (
              <button
                key={wp.key}
                onClick={() => select(wp.key)}
                className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                  active === wp.key
                    ? "border-foreground/40 ring-1 ring-foreground/20"
                    : "border-border/20 hover:border-border/40"
                }`}
              >
                <img src={wp.src} alt={wp.label} className="w-full h-12 object-cover" />
                <span className="absolute inset-0 flex items-end justify-center pb-0.5 bg-gradient-to-t from-black/60 to-transparent">
                  <span className="text-[9px] font-light text-white/90">{wp.label}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WallpaperSwitcher;
