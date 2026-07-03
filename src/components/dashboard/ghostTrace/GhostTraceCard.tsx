// GHOST TRACE CARD — renders the forensic attachment produced by
// supabase/functions/_shared/ghostTraceIntel.ts. Monochrome, glass, matches
// PropertyMapCard / YouTubeEvidenceCard / DomainIntelCard aesthetic.
//
// Renders in three collapsed tiers: author strip → EXIF drawer → reasoning
// trail drawer. Never presents a probabilistic claim as fact — every claim
// carries a confidence pill.
import { useState } from "react";
import { ExternalLink, ChevronDown, Fingerprint, MapPin, ShieldAlert, CheckCircle2 } from "lucide-react";

export type GhostTracePlatform =
  | "x" | "instagram" | "facebook" | "tiktok" | "threads"
  | "bluesky" | "reddit" | "youtube_short";

export interface GhostTraceClaim {
  key: string; value: unknown; confidence: number; source: string;
}
export interface GhostTraceAttachment {
  fired: true;
  platform: GhostTracePlatform;
  url: string;
  postId: string;
  author: {
    handle: string | null;
    displayName: string | null;
    verified: boolean | null;
    avatar: string | null;
    profileUrl: string | null;
  };
  caption: string | null;
  postedAt: string | null;
  language: string | null;
  media: Array<{ url: string; kind: "photo" | "video" | "unknown"; width: number | null; height: number | null; cdnHost: string | null }>;
  exif: {
    attempted: boolean; scrubbed: boolean;
    device: { make: string | null; model: string | null; software: string | null } | null;
    capturedAt: string | null;
    gps: { lat: number; lng: number } | null;
  };
  locus: {
    method: "exif_gps" | "visual" | "none";
    lat: number | null; lng: number | null; radiusMeters: number | null;
    confidence: number; reasoning: string;
  };
  network: { cdnEdge: string | null; hint: string | null };
  claims: GhostTraceClaim[];
  errors: string[];
}

const PLATFORM_LABEL: Record<GhostTracePlatform, string> = {
  x: "X", instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok",
  threads: "Threads", bluesky: "Bluesky", reddit: "Reddit", youtube_short: "YouTube Short",
};

function ConfidencePill({ v }: { v: number }) {
  const pct = Math.round(v * 100);
  const tone = v >= 0.9 ? "text-white/90 border-white/30" : v >= 0.6 ? "text-white/70 border-white/20" : "text-white/50 border-white/10";
  return <span className={`text-[10px] px-1.5 py-[1px] rounded-sm border ${tone} bg-white/[0.02] tabular-nums`}>{pct}%</span>;
}

export default function GhostTraceCard({ data }: { data: GhostTraceAttachment }) {
  const [openExif, setOpenExif] = useState(false);
  const [openTrail, setOpenTrail] = useState(false);
  const [openCaption, setOpenCaption] = useState(false);

  const primary = data.media[0];
  const posted = data.postedAt ? new Date(data.postedAt) : null;

  return (
    <div className="mt-3 mb-1 rounded-lg border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden text-white/85">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-black/20">
        <Fingerprint className="h-3.5 w-3.5 text-white/70" strokeWidth={1.5} />
        <span className="text-[11px] tracking-[0.14em] uppercase text-white/70">Ghost Trace</span>
        <span className="text-[10px] px-1.5 py-[1px] rounded-sm border border-white/15 text-white/60">{PLATFORM_LABEL[data.platform]}</span>
        <span className="ml-auto text-[10px] text-white/40 tabular-nums">{posted ? posted.toISOString().replace("T", " ").slice(0, 16) + " UTC" : "no timestamp"}</span>
      </div>

      {/* Author + media */}
      <div className="p-3 flex gap-3">
        {primary?.url ? (
          <a href={data.url} target="_blank" rel="noreferrer" className="shrink-0 block w-20 h-20 rounded-md overflow-hidden border border-white/10 bg-black/40">
            <img src={primary.url} alt="post media" className="w-full h-full object-cover" loading="lazy" />
          </a>
        ) : (
          <div className="shrink-0 w-20 h-20 rounded-md border border-dashed border-white/10 flex items-center justify-center text-[10px] text-white/40">no media</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {data.author.avatar && <img src={data.author.avatar} alt="" className="w-4 h-4 rounded-full" />}
            <span className="text-[13px] text-white font-medium truncate">{data.author.displayName || data.author.handle || "unknown"}</span>
            {data.author.verified && <CheckCircle2 className="h-3 w-3 text-white/70" strokeWidth={2} />}
          </div>
          {data.author.handle && (
            <a href={data.author.profileUrl || data.url} target="_blank" rel="noreferrer" className="text-[11px] text-white/50 hover:text-white/80 inline-flex items-center gap-1">
              @{data.author.handle} <ExternalLink className="h-2.5 w-2.5" />
            </a>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className="text-[10px] px-1.5 py-[1px] rounded-sm border border-white/10 text-white/60">
              {data.exif.scrubbed ? "EXIF scrubbed" : data.exif.device ? "EXIF device found" : "EXIF absent"}
            </span>
            <span className="text-[10px] px-1.5 py-[1px] rounded-sm border border-white/10 text-white/60">
              CDN: {data.network.cdnEdge || "unknown"}
            </span>
            {primary?.width && primary?.height && (
              <span className="text-[10px] px-1.5 py-[1px] rounded-sm border border-white/10 text-white/60 tabular-nums">
                {primary.width}×{primary.height}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Locus */}
      <div className="px-3 py-2 border-t border-white/10 flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5 text-white/60" strokeWidth={1.5} />
        {data.locus.method === "none" ? (
          <span className="text-[11px] text-white/50 italic">No location signal in this post.</span>
        ) : (
          <>
            <span className="text-[11px] text-white/80 tabular-nums">
              {data.locus.lat?.toFixed(4)}, {data.locus.lng?.toFixed(4)}
            </span>
            <span className="text-[10px] text-white/50">±{data.locus.radiusMeters}m via {data.locus.method}</span>
            <ConfidencePill v={data.locus.confidence} />
          </>
        )}
      </div>

      {/* Caption drawer */}
      {data.caption && (
        <button onClick={() => setOpenCaption(v => !v)} className="w-full px-3 py-1.5 border-t border-white/10 flex items-center gap-2 text-[11px] text-white/70 hover:text-white/95 text-left">
          <ChevronDown className={`h-3 w-3 transition-transform ${openCaption ? "rotate-180" : ""}`} />
          Caption ({data.caption.length} chars)
        </button>
      )}
      {openCaption && data.caption && (
        <div className="px-3 pb-3 -mt-1 text-[11px] text-white/70 leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto border-l border-white/10 ml-3">
          {data.caption}
        </div>
      )}

      {/* EXIF drawer */}
      <button onClick={() => setOpenExif(v => !v)} className="w-full px-3 py-1.5 border-t border-white/10 flex items-center gap-2 text-[11px] text-white/70 hover:text-white/95 text-left">
        <ChevronDown className={`h-3 w-3 transition-transform ${openExif ? "rotate-180" : ""}`} />
        EXIF autopsy
      </button>
      {openExif && (
        <div className="px-3 pb-3 -mt-1 text-[11px] text-white/70">
          <table className="w-full">
            <tbody>
              <tr><td className="text-white/40 pr-3 py-0.5">attempted</td><td className="tabular-nums">{String(data.exif.attempted)}</td></tr>
              <tr><td className="text-white/40 pr-3 py-0.5">scrubbed</td><td className="tabular-nums">{String(data.exif.scrubbed)}</td></tr>
              <tr><td className="text-white/40 pr-3 py-0.5">device</td><td>{data.exif.device ? `${data.exif.device.make || ""} ${data.exif.device.model || ""}`.trim() || "(none)" : "(none)"}</td></tr>
              <tr><td className="text-white/40 pr-3 py-0.5">software</td><td>{data.exif.device?.software || "—"}</td></tr>
              <tr><td className="text-white/40 pr-3 py-0.5">captured</td><td>{data.exif.capturedAt || "—"}</td></tr>
              <tr><td className="text-white/40 pr-3 py-0.5">gps</td><td>{data.exif.gps ? `${data.exif.gps.lat.toFixed(4)}, ${data.exif.gps.lng.toFixed(4)}` : "—"}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Reasoning trail drawer */}
      <button onClick={() => setOpenTrail(v => !v)} className="w-full px-3 py-1.5 border-t border-white/10 flex items-center gap-2 text-[11px] text-white/70 hover:text-white/95 text-left">
        <ChevronDown className={`h-3 w-3 transition-transform ${openTrail ? "rotate-180" : ""}`} />
        Reasoning trail ({data.claims.length})
      </button>
      {openTrail && (
        <div className="px-3 pb-3 -mt-1 space-y-1">
          {data.claims.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] py-0.5 border-b border-white/5 last:border-0">
              <span className="text-white/40 min-w-[92px]">{c.key}</span>
              <span className="text-white/85 flex-1 break-words">{typeof c.value === "object" ? JSON.stringify(c.value) : String(c.value)}</span>
              <span className="text-white/40 text-[9px]">{c.source}</span>
              <ConfidencePill v={c.confidence} />
            </div>
          ))}
          {data.network.hint && (
            <div className="mt-2 text-[10px] text-white/50 italic">{data.network.hint}</div>
          )}
        </div>
      )}

      {/* Ethics footer */}
      <div className="px-3 py-1.5 border-t border-white/10 bg-black/20 flex items-center gap-1.5 text-[10px] text-white/40">
        <ShieldAlert className="h-3 w-3" strokeWidth={1.5} />
        OSINT on public data. Confidence-scored. Verify before acting.
      </div>
    </div>
  );
}
