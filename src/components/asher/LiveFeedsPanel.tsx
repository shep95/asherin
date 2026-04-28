import { useEffect, useMemo, useState } from "react";
import { Video, X, RefreshCw, ExternalLink, Loader2 } from "lucide-react";

interface Props {
  label: string | null;       // e.g. "Paris" or "Paris, France"
  lat: number;
  lng: number;
  onClose: () => void;
}

type FeedKind = "live" | "news" | "cams";

const buildQuery = (label: string, kind: FeedKind) => {
  const base = label.trim();
  if (kind === "live") return `${base} live`;
  if (kind === "news") return `${base} live news`;
  return `${base} live webcam street`;
};

/**
 * Live video feed panel — uses YouTube's embed search (no API key required).
 * Plays the first matching live result for the location and lets the user
 * cycle kinds (live / news / live cams).
 */
const LiveFeedsPanel = ({ label, lat, lng, onClose }: Props) => {
  const [kind, setKind] = useState<FeedKind>("live");
  const [nonce, setNonce] = useState(0);
  const [loading, setLoading] = useState(true);

  const place = useMemo(
    () => label || `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
    [label, lat, lng]
  );

  const query = buildQuery(place, kind);
  // listType=search loads a YouTube search results playlist — no API key needed.
  const embedUrl = `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(
    query
  )}&autoplay=1&mute=1&rel=0&modestbranding=1&v=${nonce}`;

  useEffect(() => {
    setLoading(true);
  }, [embedUrl]);

  return (
    <div className="absolute bottom-3 left-3 z-[1000] w-[380px] rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/15 px-3 py-2">
        <div className="flex items-center gap-2">
          <Video className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
          <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">
            Live Feeds — {place}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setNonce((n) => n + 1)}
            className="p-1 text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className="h-3 w-3" strokeWidth={1.5} />
          </button>
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
              query
            )}&sp=EgJAAQ%253D%253D`}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-muted-foreground hover:text-foreground"
            title="Open on YouTube"
          >
            <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
          </a>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground"
            title="Close"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border/15 px-3 py-1.5">
        {(["live", "news", "cams"] as FeedKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`px-2 py-1 rounded text-[10px] font-light tracking-[0.2em] uppercase transition-colors ${
              kind === k
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            {k === "live" ? "Live" : k === "news" ? "News" : "Cams"}
          </button>
        ))}
      </div>

      <div className="relative aspect-video bg-black">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} />
          </div>
        )}
        <iframe
          key={embedUrl}
          src={embedUrl}
          title={`Live feed — ${place}`}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={() => setLoading(false)}
        />
      </div>

      <div className="px-3 py-2 text-[9px] font-light tracking-wider text-muted-foreground/70 uppercase">
        Source: YouTube live search · Query: <span className="text-foreground/70 normal-case tracking-normal">"{query}"</span>
      </div>
    </div>
  );
};

export default LiveFeedsPanel;
