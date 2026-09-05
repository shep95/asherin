import { useEffect, useMemo, useState } from "react";
import { Play, X, Sparkles } from "lucide-react";
import secretHistoryAntichristNewMessiahPoster from "@/assets/secret-history-antichrist-new-messiah-poster.jpg.asset.json";
import secretHistoryAntichristNewMessiahVideo from "@/assets/secret-history-antichrist-new-messiah.mp4.asset.json";
import secretHistoryNewMessiahPartTwoPoster from "@/assets/secret-history-new-messiah-part-two-poster.jpg.asset.json";
import secretHistoryNewMessiahPartTwoVideo from "@/assets/secret-history-new-messiah-part-two.mp4.asset.json";

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
    id: "local:divine-truth-of-lucifer",
    src: "/videos/founder/divine-truth-of-lucifer.mp4",
    poster: "/videos/founder/divine-truth-of-lucifer.jpg",
    title: "The Divine Truth of Lucifer",
    publishedAt: new Date().toISOString(),
  },
  {
    id: "local:humanity-vs-mankind",
    src: "/videos/founder/humanity-vs-mankind.mp4",
    poster: "/videos/founder/humanity-vs-mankind.jpg",
    title: "The Difference Between the Humanity Species and the Mankind Species",
    publishedAt: new Date().toISOString(),
  },
  {
    id: "local:secret-history-three-messiahs",
    src: "/videos/founder/secret-history-three-messiahs.mp4",
    poster: "/videos/founder/secret-history-three-messiahs.jpg",
    title: "Secret History: The Three Messiahs",
    publishedAt: new Date().toISOString(),
  },
  {
    id: "local:secret-history-antichrist-new-messiah",
    src: secretHistoryAntichristNewMessiahVideo.url,
    poster: secretHistoryAntichristNewMessiahPoster.url,
    title: "Secret History: Who Is the Antichrist and the New Messiah?",
    publishedAt: new Date().toISOString(),
  },
  {
    id: "local:secret-history-new-messiah-part-two",
    src: secretHistoryNewMessiahPartTwoVideo.url,
    poster: secretHistoryNewMessiahPartTwoPoster.url,
    title: "Secret History: The New Messiah Part Two and How You Are the Child of God and the Prodigal Son",
    publishedAt: new Date().toISOString(),
  },
  {
    id: "local:truth-about-jesus",
    src: "/videos/founder/truth-about-jesus.mp4",
    poster: "/videos/founder/truth-about-jesus.jpg",
    title: "The Truth About Jesus",
    publishedAt: new Date().toISOString(),
  },
  {
    id: "local:soulmates-karmic-relationships",
    src: "/videos/founder/soulmates-karmic-relationships.mp4",
    poster: "/videos/founder/soulmates-karmic-relationships.jpg",
    title: "Soulmates and Karmic Relationships Explained",
    publishedAt: new Date().toISOString(),
  },
];

const VIDEO_IDS = [
  "RcnNpqG4izQ",
  "xAMqCBhIvIQ",
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
  "5dypqZawm8U",
];


interface VideoMeta {
  title: string;
  publishedAt?: string; // ISO
  local?: LocalVideo;
}

const TOPIC_RULES: { topic: string; match: RegExp }[] = [
  { topic: "AI & Asherin", match: /\b(aureon|ai|gpt|claude|gemini|llm|model|agent|prompt)\b/i },
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

    // Seed immediately so cards never get stuck on "Loading…" if oembed
    // is slow/blocked. Each YouTube entry then enriches itself in parallel.
    const seed: Record<string, VideoMeta> = {};
    for (const v of LOCAL_VIDEOS) {
      seed[v.id] = { title: v.title, publishedAt: v.publishedAt, local: v };
    }
    for (const id of VIDEO_IDS) {
      seed[id] = { title: "Watch on YouTube" };
    }
    setMeta(seed);

    const withTimeout = (url: string, ms = 6000) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), ms);
      return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
    };

    VIDEO_IDS.forEach(async (id) => {
      let title = "";
      let publishedAt: string | undefined;
      try {
        const r = await withTimeout(
          `https://www.youtube.com/oembed?url=https://youtu.be/${id}&format=json`,
        );
        if (r.ok) {
          const d = await r.json();
          title = (d?.title as string) || "";
        }
      } catch {}
      try {
        const r = await withTimeout(
          `https://yt.lemnoslife.com/noKey/videos?part=snippet&id=${id}`,
        );
        if (r.ok) {
          const d = await r.json();
          const item = d?.items?.[0]?.snippet;
          if (item?.publishedAt) publishedAt = item.publishedAt as string;
          if (!title && item?.title) title = item.title as string;
        }
      } catch {}

      if (cancelled || (!title && !publishedAt)) return;
      setMeta((prev) => ({
        ...prev,
        [id]: {
          title: title || prev[id]?.title || "Watch on YouTube",
          publishedAt: publishedAt ?? prev[id]?.publishedAt,
        },
      }));
    });

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
    const allIds = [...LOCAL_VIDEOS.map((v) => v.id), ...VIDEO_IDS];
    const newIds: string[] = [];
    const branchesMap = new Map<string, string[]>();
    for (const id of allIds) {
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
    const order = [...TOPIC_RULES.map((r) => r.topic), "Other"];
    const branches = order
      .filter((t) => branchesMap.has(t))
      .map((t) => ({ topic: t, ids: branchesMap.get(t)! }));
    return { newIds, branches };
  }, [meta]);

  const renderCard = (id: string) => {
    const m = meta[id];
    const local = m?.local;
    const thumb = local?.poster || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setActiveId(id)}
        className="group text-left rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden shadow-2xl shadow-black/30 transition-all hover:border-foreground/30 hover:bg-card/50"
      >
        <div className="relative aspect-video overflow-hidden bg-background">
          <img
            src={thumb}
            alt={m?.title || "Founder video"}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-black/50 backdrop-blur-md transition-all group-hover:scale-110 group-hover:bg-black/70">
              <Play className="h-5 w-5 text-white" strokeWidth={1.5} fill="currentColor" />
            </div>
          </div>
        </div>
        <div className="p-4">
          <p className="text-sm font-light leading-snug text-foreground line-clamp-2 min-h-[2.5rem]">
            {m?.title || "Loading…"}
          </p>
          <p className="mt-2 text-[10px] font-extralight tracking-[0.2em] text-muted-foreground/50 uppercase">
            Asher Newton
          </p>
        </div>
      </button>
    );
  };

  // Featured "start here" video — the first local video (highest editorial priority)
  const featuredId = LOCAL_VIDEOS[0]?.id;
  const featuredMeta = featuredId ? meta[featuredId] : undefined;
  const featuredThumb = featuredMeta?.local?.poster || (featuredId ? `https://i.ytimg.com/vi/${featuredId}/hqdefault.jpg` : "");

  return (
    <>
      {featuredId && (
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-foreground text-sm">◆</span>
            <h3 className="text-xs font-light tracking-[0.32em] uppercase text-foreground">
              Start Here · Featured
            </h3>
            <div className="flex-1 h-px bg-foreground/20" />
          </div>
          <button
            type="button"
            onClick={() => setActiveId(featuredId)}
            className="group block w-full text-left rounded-2xl border border-foreground/25 bg-card/40 backdrop-blur-md overflow-hidden shadow-2xl shadow-black/40 transition-all hover:border-foreground/50"
          >
            <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr]">
              <div className="relative aspect-video lg:aspect-auto overflow-hidden bg-background">
                <img src={featuredThumb} alt={featuredMeta?.title || "Featured video"} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                <div className="absolute inset-0 bg-black/40" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/60 bg-black/60 backdrop-blur-md transition-all group-hover:scale-110 group-hover:bg-black/80">
                    <Play className="h-7 w-7 text-white ml-1" strokeWidth={1.5} fill="currentColor" />
                  </div>
                </div>
              </div>
              <div className="p-8 sm:p-10 flex flex-col justify-center">
                <p className="text-[10px] font-extralight tracking-[0.42em] text-foreground/60 uppercase mb-4">
                  If you watch one video, watch this one
                </p>
                <h4 className="text-2xl sm:text-3xl font-extralight tracking-[-0.01em] leading-tight text-foreground">
                  {featuredMeta?.title || "Loading…"}
                </h4>
                <p className="mt-5 text-sm font-extralight leading-[1.75] text-muted-foreground/90">
                  The clearest distillation of what Asher actually believes, and why Asherin exists at all. Begin here, then explore the rest of the library below.
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-xs font-light tracking-[0.22em] text-foreground uppercase">
                  Play <Play className="h-3 w-3" fill="currentColor" />
                </span>
              </div>
            </div>
          </button>
        </section>
      )}

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
              {meta[activeId]?.local ? (
                <video
                  src={meta[activeId]!.local!.src}
                  poster={meta[activeId]!.local!.poster}
                  className="h-full w-full"
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <iframe
                  src={`https://www.youtube.com/embed/${activeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&mute=0&enablejsapi=1`}
                  title={meta[activeId]?.title || "Founder video"}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              )}
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
