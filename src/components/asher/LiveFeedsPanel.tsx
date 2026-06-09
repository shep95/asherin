import { useEffect, useMemo, useState } from "react";
import { Video, X, RefreshCw, ExternalLink, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  label: string | null;
  lat: number;
  lng: number;
  onClose: () => void;
}

type FeedKind = "live" | "news" | "cams";

interface Resolved {
  videoId: string;
  title?: string;
  channel?: string;
  url?: string;
  candidates?: string[];
}

const LiveFeedsPanel = ({ label, lat, lng, onClose }: Props) => {
  const [kind, setKind] = useState<FeedKind>("live");
  const [nonce, setNonce] = useState(0);
  const [loading, setLoading] = useState(true);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [altIdx, setAltIdx] = useState(0);

  const place = useMemo(
    () => label || `${lat.toFixed(3)}, ${lng.toFixed(3)}`,
    [label, lat, lng]
  );

  // Resolve a real live video for this location/kind via Gemini + Google Search
  useEffect(() => {
    let cancel = false;
    setLoading(true);
    setError(null);
    setResolved(null);
    setAltIdx(0);
    (async () => {
      try {
        // BYOK key — session-scoped only (never persisted to localStorage to avoid XSS exfil).
        const byok = sessionStorage.getItem("byok_gemini_key") || undefined;
        const { data, error: invErr } = await supabase.functions.invoke("asher-live-feed", {
          body: { location: place, lat, lng, kind, byokGeminiKey: byok },
        });
        if (cancel) return;
        if (invErr) throw new Error(invErr.message || "resolve failed");
        if (!data?.videoId) throw new Error(data?.error || "No live stream found");
        setResolved(data as Resolved);
      } catch (e) {
        if (!cancel) setError(e instanceof Error ? e.message : "Failed to resolve feed");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [place, lat, lng, kind, nonce]);

  const candidates = resolved?.candidates ?? (resolved?.videoId ? [resolved.videoId] : []);
  const currentId = candidates[altIdx] ?? resolved?.videoId ?? "";
  const embedUrl = currentId
    ? `https://www.youtube-nocookie.com/embed/${currentId}?autoplay=1&mute=1&rel=0&modestbranding=1`
    : "";
  const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${place} ${kind === "news" ? "live news" : kind === "cams" ? "live webcam" : "live"}`
  )}&sp=EgJAAQ%253D%253D`;

  return (
    <div className="absolute bottom-3 left-3 z-[1000] w-[380px] rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/15 px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Video className="h-3.5 w-3.5 text-foreground/70 shrink-0" strokeWidth={1.5} />
          <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase truncate">
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
            href={resolved?.url || ytSearchUrl}
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
        {candidates.length > 1 && (
          <button
            onClick={() => setAltIdx((i) => (i + 1) % candidates.length)}
            className="ml-auto px-2 py-1 rounded text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            title="Try alternate stream"
          >
            Next ({altIdx + 1}/{candidates.length})
          </button>
        )}
      </div>

      <div className="relative aspect-video bg-black">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} />
            <p className="text-[9px] tracking-[0.25em] uppercase">Locating live stream…</p>
          </div>
        )}
        {!loading && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2 px-4 text-center">
            <AlertTriangle className="h-5 w-5 text-foreground/60" strokeWidth={1.5} />
            <p className="text-[10px] tracking-[0.2em] uppercase text-foreground/70">No live feed found</p>
            <p className="text-[9px] text-muted-foreground">{error}</p>
            <a
              href={ytSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] underline text-foreground/80 hover:text-foreground mt-1"
            >
              Search on YouTube
            </a>
          </div>
        )}
        {!loading && !error && embedUrl && (
          <iframe
            key={embedUrl}
            src={embedUrl}
            title={`Live feed — ${place}`}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>

      <div className="px-3 py-2 text-[9px] font-light tracking-wider text-muted-foreground/70 uppercase truncate">
        {resolved?.title ? (
          <span className="text-foreground/70 normal-case tracking-normal">{resolved.title}{resolved.channel ? ` · ${resolved.channel}` : ""}</span>
        ) : (
          <>Source: live search · {kind.toUpperCase()}</>
        )}
      </div>
    </div>
  );
};

export default LiveFeedsPanel;
