import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";

const VIDEO_IDS = [
  "bUxrY21xGDw",
  "g7FmttXtyEw",
  "Bng9dGp3444",
  "pTA9aOdd6iw",
  "HcvAEtC4wRw",
  "xM3zKp_oYwo",
  "RxvLmhZJ8kU",
  "DFSLspaEMn0",
  "FcKzSP7_g1w",
  "hBhldKwbH6Q",
  "UispvssxFdo",
  "w_K7UrDEp98",
  "q98IqcFco9A",
  "Ak6PVkHM2cE",
  "OEksMhZ8R-Q",
  "ZecS7rqIkDc",
];

const FounderVideos = () => {
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        VIDEO_IDS.map(async (id) => {
          try {
            const res = await fetch(
              `https://www.youtube.com/oembed?url=https://youtu.be/${id}&format=json`
            );
            if (!res.ok) return [id, ""] as const;
            const data = await res.json();
            return [id, (data?.title as string) || ""] as const;
          } catch {
            return [id, ""] as const;
          }
        })
      );
      if (cancelled) return;
      setTitles(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveId(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [activeId]);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {VIDEO_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveId(id)}
            className="group text-left rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden shadow-2xl shadow-black/30 transition-all hover:border-foreground/30 hover:bg-card/50"
          >
            <div className="relative aspect-video overflow-hidden bg-background">
              <img
                src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
                alt={titles[id] || "Founder video"}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-black/50 backdrop-blur-md transition-all group-hover:scale-110 group-hover:bg-black/70">
                  <Play className="h-5 w-5 text-white" strokeWidth={1.5} fill="currentColor" />
                </div>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm font-light leading-snug text-foreground line-clamp-2 min-h-[2.5rem]">
                {titles[id] || "Loading…"}
              </p>
              <p className="mt-2 text-[10px] font-extralight tracking-[0.2em] text-muted-foreground/50 uppercase">
                Asher Newton
              </p>
            </div>
          </button>
        ))}
      </div>

      {activeId && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 sm:p-8"
          onClick={() => setActiveId(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setActiveId(null)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full border border-border/30 bg-card/40 text-foreground transition-all hover:bg-foreground/10"
            aria-label="Close video"
          >
            <X className="h-4 w-4" />
          </button>
          <div
            className="w-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border/20 bg-black shadow-2xl">
              <iframe
                src={`https://www.youtube.com/embed/${activeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&mute=0&enablejsapi=1`}
                title={titles[activeId] || "Founder video"}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
            {titles[activeId] && (
              <p className="mt-4 text-center text-sm font-light tracking-wide text-foreground">
                {titles[activeId]}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default FounderVideos;
