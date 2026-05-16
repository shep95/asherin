import { useEffect, useMemo, useState } from "react";
import { Play, X, Sparkles } from "lucide-react";

interface LocalVideo {
  id: string; // unique key, prefixed with "local:"
  src: string;
  poster?: string;
  title: string;
  publishedAt: string; // ISO
}

// Local self-hosted videos (mp4). Use ISO `publishedAt` so they appear in
// "New · Last 7 Days" and the topic branches just like YouTube videos.
const LOCAL_VIDEOS: LocalVideo[] = [
  {
    id: "local:humanity-vs-mankind",
    src: "/videos/founder/humanity-vs-mankind.mp4",
    poster: "/videos/founder/humanity-vs-mankind.jpg",
    title: "The Difference Between the Humanity Species and the Mankind Species",
    publishedAt: new Date().toISOString(),
  },
];

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

interface VideoMeta {
  title: string;
  publishedAt?: string; // ISO
  local?: LocalVideo;
}

const TOPIC_RULES: { topic: string; match: RegExp }[] = [
  { topic: "AI & Aureon", match: /\b(aureon|ai|gpt|claude|gemini|llm|model|agent|prompt)\b/i },
  { topic: "Trading & Markets", match: /\b(trade|trading|market|stock|crypto|bitcoin|btc|eth|forex|chart|invest)\b/i },
  { topic: "Astrology & Vedic", match: /\b(vedic|astrology|chart|nakshatra|zodiac|planet|jyotish|horoscope)\b/i },
  { topic: "Security & Intelligence", match: /\b(security|osint|intel|hack|cyber|privacy|surveillance|forensic)\b/i },
  { topic: "Philosophy & Mindset", match: /\b(truth|god|mind|philosophy|life|reality|consciousness|spiritual)\b/i },
  { topic: "Build & Product", match: /\b(build|launch|release|update|feature|demo|tutorial|how to|how i)\b/i },
];

function classify(title: string): string {
  for (const r of TOPIC_RULES) if (r.match.test(title)) return r.topic;
  return "Other";
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const FounderVideos = () => {
  const [meta, setMeta] = useState<Record<string, VideoMeta>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        VIDEO_IDS.map(async (id) => {
          let title = "";
          let publishedAt: string | undefined;
          // Title via oEmbed (reliable)
          try {
            const r = await fetch(
              `https://www.youtube.com/oembed?url=https://youtu.be/${id}&format=json`
            );
            if (r.ok) {
              const d = await r.json();
              title = (d?.title as string) || "";
            }
          } catch {}
          // PublishedAt via unofficial no-key YouTube API
          try {
            const r = await fetch(
              `https://yt.lemnoslife.com/noKey/videos?part=snippet&id=${id}`
            );
            if (r.ok) {
              const d = await r.json();
              const item = d?.items?.[0]?.snippet;
              if (item?.publishedAt) publishedAt = item.publishedAt as string;
              if (!title && item?.title) title = item.title as string;
            }
          } catch {}
          return [id, { title, publishedAt }] as const;
        })
      );
      if (cancelled) return;
      setMeta(Object.fromEntries(entries));
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

  const { newIds, branches } = useMemo(() => {
    const now = Date.now();
    const newIds: string[] = [];
    const branchesMap = new Map<string, string[]>();
    for (const id of VIDEO_IDS) {
      const m = meta[id];
      const t = m?.title || "";
      if (m?.publishedAt) {
        const ts = new Date(m.publishedAt).getTime();
        if (!isNaN(ts) && now - ts <= SEVEN_DAYS_MS) newIds.push(id);
      }
      const topic = classify(t);
      if (!branchesMap.has(topic)) branchesMap.set(topic, []);
      branchesMap.get(topic)!.push(id);
    }
    // Sort branches: known order first, "Other" last
    const order = [...TOPIC_RULES.map((r) => r.topic), "Other"];
    const branches = order
      .filter((t) => branchesMap.has(t))
      .map((t) => ({ topic: t, ids: branchesMap.get(t)! }));
    return { newIds, branches };
  }, [meta]);

  const renderCard = (id: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setActiveId(id)}
      className="group text-left rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden shadow-2xl shadow-black/30 transition-all hover:border-foreground/30 hover:bg-card/50"
    >
      <div className="relative aspect-video overflow-hidden bg-background">
        <img
          src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
          alt={meta[id]?.title || "Founder video"}
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
          {meta[id]?.title || "Loading…"}
        </p>
        <p className="mt-2 text-[10px] font-extralight tracking-[0.2em] text-muted-foreground/50 uppercase">
          Asher Newton
        </p>
      </div>
    </button>
  );

  return (
    <>
      {newIds.length > 0 && (
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-5">
            <Sparkles className="h-4 w-4 text-foreground/80" strokeWidth={1.5} />
            <h3 className="text-xs font-light tracking-[0.3em] uppercase text-foreground/80">
              New · Last 7 Days
            </h3>
            <span className="text-[10px] font-extralight tracking-widest text-muted-foreground/50">
              {newIds.length}
            </span>
            <div className="flex-1 h-px bg-border/20" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {newIds.map(renderCard)}
          </div>
        </section>
      )}

      {branches.map(({ topic, ids }) => (
        <section key={topic} className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-foreground/60 text-sm">◈</span>
            <h3 className="text-xs font-light tracking-[0.3em] uppercase text-foreground/80">
              {topic}
            </h3>
            <span className="text-[10px] font-extralight tracking-widest text-muted-foreground/50">
              {ids.length}
            </span>
            <div className="flex-1 h-px bg-border/15" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {ids.map(renderCard)}
          </div>
        </section>
      ))}

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
          <div className="w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-border/20 bg-black shadow-2xl">
              <iframe
                src={`https://www.youtube.com/embed/${activeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&mute=0&enablejsapi=1`}
                title={meta[activeId]?.title || "Founder video"}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            </div>
            {meta[activeId]?.title && (
              <p className="mt-4 text-center text-sm font-light tracking-wide text-foreground">
                {meta[activeId]?.title}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default FounderVideos;
