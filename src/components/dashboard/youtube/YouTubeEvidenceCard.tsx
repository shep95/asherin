import { ExternalLink, Play, Radio } from "lucide-react";

export interface YouTubeAttachmentVideo {
  videoId: string;
  title: string;
  channel: string;
  publishedAt: string;
  durationSeconds: number;
  viewCount: number;
  thumbnail: string;
  url: string;
  isLive: boolean;
  transcriptChars: number;
  transcriptSource: "timedtext" | "empty";
}
export interface YouTubeAttachment {
  fired: true;
  mode: "video" | "search";
  query: string | null;
  videos: YouTubeAttachmentVideo[];
}

function fmtDuration(sec: number): string {
  if (!sec) return "";
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}
function fmtViews(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K views`;
  return `${n} views`;
}
function fmtAge(iso: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const hrs = (Date.now() - t) / 3600000;
  if (hrs < 1) return "just now";
  if (hrs < 48) return `${Math.round(hrs)}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 60) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

const YouTubeEvidenceCard = ({ data }: { data: YouTubeAttachment }) => {
  if (!data?.videos?.length) return null;
  return (
    <div className="rounded-lg border border-border/40 bg-card/40 backdrop-blur-md overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 bg-foreground/[0.02]">
        <div className="flex items-center gap-2 text-[10px] font-light tracking-[0.22em] uppercase text-muted-foreground">
          <Play className="h-3 w-3" strokeWidth={1.5} />
          YouTube Intel
          {data.query && <span className="normal-case tracking-normal text-foreground/60 truncate max-w-[180px]">· "{data.query}"</span>}
        </div>
        <span className="text-[10px] font-light text-muted-foreground/70">{data.videos.length} video{data.videos.length === 1 ? "" : "s"}</span>
      </div>
      <div className="divide-y divide-border/20">
        {data.videos.map((v) => (
          <a
            key={v.videoId}
            href={v.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-3 p-2.5 hover:bg-foreground/[0.03] transition-colors group"
          >
            <div className="relative flex-shrink-0 w-24 h-14 rounded overflow-hidden bg-foreground/5">
              <img
                src={v.thumbnail}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
              />
              {v.isLive ? (
                <span className="absolute bottom-1 right-1 flex items-center gap-1 px-1 py-0.5 rounded bg-red-500/90 text-white text-[9px] font-light">
                  <Radio className="h-2 w-2 animate-pulse" /> LIVE
                </span>
              ) : v.durationSeconds > 0 ? (
                <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-white text-[9px] font-light tabular-nums">
                  {fmtDuration(v.durationSeconds)}
                </span>
              ) : null}
            </div>
            <div className="flex-1 min-w-0 space-y-0.5">
              <div className="text-[11px] font-light text-foreground line-clamp-2 group-hover:text-foreground">
                {v.title}
              </div>
              <div className="text-[10px] font-light text-muted-foreground truncate">
                {v.channel}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-light text-muted-foreground/70">
                <span>{fmtViews(v.viewCount)}</span>
                <span>·</span>
                <span>{fmtAge(v.publishedAt)}</span>
                {v.transcriptSource === "timedtext" && v.transcriptChars > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-emerald-400/80">transcript {(v.transcriptChars / 1000).toFixed(1)}k</span>
                  </>
                )}
                {v.transcriptSource === "empty" && !v.isLive && (
                  <>
                    <span>·</span>
                    <span className="text-amber-400/70">no captions</span>
                  </>
                )}
              </div>
            </div>
            <ExternalLink className="h-3 w-3 text-muted-foreground/40 flex-shrink-0 mt-1" />
          </a>
        ))}
      </div>
    </div>
  );
};

export default YouTubeEvidenceCard;
