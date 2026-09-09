import { useEffect, useState } from "react";
import AcatalepsyWorkspace from "@/components/acatalepsy/AcatalepsyWorkspace";
import WallpaperSwitcher, { getStoredWallpaper } from "@/components/WallpaperSwitcher";

export default function AsherinAcatalepsy() {
  const [wallpaper, setWallpaper] = useState(getStoredWallpaper);
  useEffect(() => { const onChange=()=>setWallpaper(getStoredWallpaper()); window.addEventListener("wallpaper-change",onChange); return()=>window.removeEventListener("wallpaper-change",onChange); }, []);
  return <div className="relative min-h-screen bg-background"><img src={wallpaper} alt="" aria-hidden className="fixed inset-0 h-full w-full object-cover opacity-55" decoding="async"/><div className="fixed inset-0 bg-background/75" aria-hidden/><div className="relative z-10"><AcatalepsyWorkspace/></div><WallpaperSwitcher/></div>;
}