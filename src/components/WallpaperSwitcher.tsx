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
import wallpaperAbyss from "@/assets/wallpaper-abyss.png";
import wallpaperStealth from "@/assets/wallpaper-stealth.png";
import wallpaperStatic from "@/assets/wallpaper-static.png";
import wallpaperMane from "@/assets/wallpaper-mane.png";
import wallpaperImpact from "@/assets/wallpaper-impact.png";
import wallpaperOracle from "@/assets/wallpaper-oracle.png";
import wallpaperAscend from "@/assets/wallpaper-ascend.png";
import wallpaperCosmos from "@/assets/wallpaper-cosmos.png";

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
  { key: "abyss", label: "Abyss", src: wallpaperAbyss },
  { key: "stealth", label: "Stealth", src: wallpaperStealth },
  { key: "static", label: "Static", src: wallpaperStatic },
  { key: "mane", label: "Mane", src: wallpaperMane },
  { key: "impact", label: "Impact", src: wallpaperImpact },
  { key: "oracle", label: "Oracle", src: wallpaperOracle },
  { key: "ascend", label: "Ascend", src: wallpaperAscend },
  { key: "cosmos", label: "Cosmos", src: wallpaperCosmos },
];

const STORAGE_KEY = "aureon_landing_wallpaper";

export const getStoredWallpaper = (): string => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "custom") {
    const customUrl = localStorage.getItem("aureon_custom_wallpaper_url");
    if (customUrl) return customUrl;
  }
  const key = stored ?? "stealth";
  const wp = WALLPAPERS.find((w) => w.key === key);
  return wp ? wp.src : wallpaperStealth;
};

const WallpaperSwitcher = () => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => localStorage.getItem(STORAGE_KEY) || "stealth");
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const select = (key: string) => {
    if (key === active) return;
    setActive(key);
    localStorage.setItem(STORAGE_KEY, key);
    setOpen(false);
    window.dispatchEvent(new Event("wallpaper-change"));
  };

  const activeIndex = WALLPAPERS.findIndex(w => w.key === active);
  const displayIndex = hoveredKey
    ? WALLPAPERS.findIndex(w => w.key === hoveredKey)
    : activeIndex;
  const displayLabel = hoveredKey
    ? WALLPAPERS.find(w => w.key === hoveredKey)?.label
    : WALLPAPERS[activeIndex]?.label;
  const indexStr = String(displayIndex + 1).padStart(2, "0");

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
        <div
          className="absolute bottom-12 right-0 rounded-2xl border border-border/30 bg-card/80 backdrop-blur-xl p-3 shadow-2xl min-w-[220px] max-h-[400px] overflow-y-auto"
          style={{ animation: "wpPanelIn 0.25s cubic-bezier(0.16,1,0.3,1)" }}
        >
          {/* Number + Label header */}
          <div className="flex items-end gap-2 mb-2 px-1">
            <span
              className="text-[28px] font-extralight leading-none text-foreground/15 tracking-tight"
              style={{ fontFamily: "serif", fontStyle: "italic" }}
            >
              {indexStr}
            </span>
            <span className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase pb-1">
              {displayLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {WALLPAPERS.map((wp, i) => (
              <button
                key={wp.key}
                onClick={() => select(wp.key)}
                onMouseEnter={() => setHoveredKey(wp.key)}
                onMouseLeave={() => setHoveredKey(null)}
                className={`relative rounded-xl overflow-hidden border-2 transition-all group ${
                  active === wp.key
                    ? "border-foreground/40 ring-1 ring-foreground/20"
                    : "border-border/20 hover:border-border/40"
                }`}
                style={{
                  animation: `wpThumbIn 0.3s cubic-bezier(0.16,1,0.3,1) ${i * 0.03}s both`,
                }}
              >
                <img
                  src={wp.src}
                  alt={wp.label}
                  className="w-full h-12 object-cover transition-transform duration-500 group-hover:scale-110"
                />
                {/* Light sweep on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none"
                  style={{
                    background: "linear-gradient(105deg, transparent 40%, hsla(0,0%,100%,0.15) 50%, transparent 60%)",
                    animation: "wpThumbSweep 0.6s ease-out",
                  }}
                />
                <span className="absolute inset-0 flex items-end justify-center pb-0.5 bg-gradient-to-t from-black/60 to-transparent">
                  <span className="text-[9px] font-light text-white/90">{wp.label}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes wpPanelIn {
          from { opacity: 0; transform: translateY(8px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes wpThumbIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes wpThumbSweep {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default WallpaperSwitcher;
