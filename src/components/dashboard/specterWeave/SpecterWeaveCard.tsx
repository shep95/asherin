// SPECTER WEAVE CARD — full-account reconstruction dossier UI.
// Renders the SpecterAttachment produced by
// supabase/functions/_shared/specterWeaveIntel.ts.
//
// Monochrome, glass, matches GhostTraceCard / YouTubeEvidenceCard aesthetic.
// Never presents a probabilistic claim as fact — every claim carries a
// confidence pill.
import { useState } from "react";
import {
  Eye, ChevronDown, ShieldAlert, ExternalLink, CheckCircle2,
  Clock, MessageSquare, Users, AlertTriangle, Cpu, Globe2, TrendingUp, TrendingDown, Minus,
} from "lucide-react";

export type SpecterPlatform =
  | "x" | "instagram" | "tiktok" | "threads" | "bluesky" | "reddit" | "youtube" | "github";

export interface SpecterAttachment {
  fired: true;
  platform: SpecterPlatform;
  handle: string;
  profileUrl: string;
  derivedFromPost: boolean;
  genesis: {
    userId: string | null;
    createdAt: string | null;
    ageDays: number | null;
    confidence: number;
    method: "snowflake" | "profile" | "unknown";
  };
  author: {
    displayName: string | null;
    verified: boolean | null;
    avatar: string | null;
    bio: string | null;
    location: string | null;
    url: string | null;
    followerCount: number | null;
    followingCount: number | null;
    postCount: number | null;
  };
  cartography: {
    sampleSize: number;
    hoursHistogram: number[];
    weekdayHistogram: number[];
    peakUtcHour: number | null;
    peakUtcHourShare: number;
    inferredTimezone: { offset: number; label: string; confidence: number } | null;
    postsPerDay: number;
  };
  linguistics: {
    sampleSize: number;
    avgWordsPerPost: number;
    typeTokenRatio: number;
    hashtagRate: number;
    mentionRate: number;
    emojiRate: number;
    urlRate: number;
    capsRate: number;
    exclamationRate: number;
    profanityRate: number;
    detectedLanguages: string[];
  };
  graph: {
    topMentions: Array<{ handle: string; count: number }>;
    topReplyTargets: Array<{ handle: string; count: number }>;
    inferredInnerRing: string[];
  };
  leaks: Array<{
    kind: string;
    excerpt: string;
    sourcePostUrl: string | null;
    confidence: number;
    reasoning: string;
  }>;
  devices: {
    clients: Array<{ source: string; count: number; share: number }>;
    primary: string | null;
    diversity: number;
  };
  media: {
    photoCount: number;
    cdnEdges: Array<{ host: string; count: number }>;
    topEdge: string | null;
  };
  crossPlatform: Array<{
    platform: string; url: string;
    status: "found" | "not_found" | "rate_limited" | "unreachable";
    confidence: number;
  }>;
  drift: {
    monthlyCounts: Array<{ month: string; count: number }>;
    activityTrend: "rising" | "falling" | "flat" | "insufficient_data";
  };
  claims: Array<{ key: string; value: unknown; confidence: number; source: string; reasoning?: string }>;
  errors: string[];
}

const PLATFORM_LABEL: Record<SpecterPlatform, string> = {
  x: "X", instagram: "Instagram", tiktok: "TikTok", threads: "Threads",
  bluesky: "Bluesky", reddit: "Reddit", youtube: "YouTube", github: "GitHub",
};

function ConfidencePill({ v }: { v: number }) {
  const pct = Math.round(v * 100);
  const tone = v >= 0.9 ? "text-white/90 border-white/30" : v >= 0.6 ? "text-white/70 border-white/20" : "text-white/50 border-white/10";
  return <span className={`text-[10px] px-1.5 py-[1px] rounded-sm border ${tone} bg-white/[0.02] tabular-nums`}>{pct}%</span>;
}

function Sparkbars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-[2px] h-8">
      {values.map((v, i) => (
        <div key={i} className="w-1.5 bg-white/60 rounded-sm" style={{ height: `${(v / max) * 100}%` }} title={`${i}: ${v}`} />
      ))}
    </div>
  );
}

const TrendIcon = ({ t }: { t: SpecterAttachment["drift"]["activityTrend"] }) =>
  t === "rising" ? <TrendingUp className="h-3 w-3 text-white/80" strokeWidth={1.5} />
  : t === "falling" ? <TrendingDown className="h-3 w-3 text-white/80" strokeWidth={1.5} />
  : <Minus className="h-3 w-3 text-white/60" strokeWidth={1.5} />;

export default function SpecterWeaveCard({ data }: { data: SpecterAttachment }) {
  const [openLattice, setOpenLattice] = useState<string | null>("leaks");
  const toggle = (k: string) => setOpenLattice((cur) => (cur === k ? null : k));

  const foundCross = data.crossPlatform.filter((h) => h.status === "found");
  const bornDate = data.genesis.createdAt ? new Date(data.genesis.createdAt) : null;
  const ageYears = data.genesis.ageDays != null ? (data.genesis.ageDays / 365).toFixed(1) : null;

  return (
    <div className="mt-3 mb-1 rounded-lg border border-white/10 bg-white/[0.02] backdrop-blur-sm overflow-hidden text-white/85">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-black/20">
        <Eye className="h-3.5 w-3.5 text-white/70" strokeWidth={1.5} />
        <span className="text-[11px] tracking-[0.14em] uppercase text-white/70">Specter Weave</span>
        <span className="text-[10px] px-1.5 py-[1px] rounded-sm border border-white/15 text-white/60">{PLATFORM_LABEL[data.platform]}</span>
        {data.derivedFromPost && <span className="text-[9px] text-white/40">·  profile derived from pasted post</span>}
        <a href={data.profileUrl} target="_blank" rel="noreferrer" className="ml-auto text-[10px] text-white/50 hover:text-white/90 inline-flex items-center gap-1">
          profile <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>

      {/* Author + genesis strip */}
      <div className="p-3 flex gap-3">
        {data.author.avatar ? (
          <img src={data.author.avatar} alt="" className="w-14 h-14 rounded-full border border-white/10 object-cover" />
        ) : (
          <div className="w-14 h-14 rounded-full border border-dashed border-white/10 flex items-center justify-center text-[10px] text-white/40">—</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] text-white font-medium truncate">{data.author.displayName || `@${data.handle}`}</span>
            {data.author.verified && <CheckCircle2 className="h-3 w-3 text-white/80" strokeWidth={2} />}
          </div>
          <div className="text-[11px] text-white/50">@{data.handle}</div>
          {data.author.bio && (
            <div className="mt-1 text-[11px] text-white/70 line-clamp-2 leading-snug">{data.author.bio}</div>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {data.author.followerCount != null && (
              <span className="text-[10px] px-1.5 py-[1px] rounded-sm border border-white/10 text-white/60 tabular-nums">
                {data.author.followerCount.toLocaleString()} followers
              </span>
            )}
            {data.author.postCount != null && (
              <span className="text-[10px] px-1.5 py-[1px] rounded-sm border border-white/10 text-white/60 tabular-nums">
                {data.author.postCount.toLocaleString()} posts
              </span>
            )}
            {data.author.location && (
              <span className="text-[10px] px-1.5 py-[1px] rounded-sm border border-white/10 text-white/60">
                📍 {data.author.location}
              </span>
            )}
            {bornDate && (
              <span className="text-[10px] px-1.5 py-[1px] rounded-sm border border-white/10 text-white/60 tabular-nums">
                born {bornDate.toISOString().slice(0, 10)} · {ageYears}y old
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Quick metric bar */}
      <div className="px-3 py-2 border-t border-white/10 grid grid-cols-4 gap-2 text-[10px]">
        <div><div className="text-white/40">Sample</div><div className="text-white/90 tabular-nums">{data.cartography.sampleSize} posts</div></div>
        <div><div className="text-white/40">Cadence</div><div className="text-white/90 tabular-nums">{data.cartography.postsPerDay}/day</div></div>
        <div><div className="text-white/40">TZ</div><div className="text-white/90">{data.cartography.inferredTimezone?.label ?? "—"}</div></div>
        <div><div className="text-white/40">Trend</div><div className="text-white/90 flex items-center gap-1"><TrendIcon t={data.drift.activityTrend}/>{data.drift.activityTrend.replace("_", " ")}</div></div>
      </div>

      {/* Leaks lattice */}
      <button onClick={() => toggle("leaks")} className="w-full px-3 py-1.5 border-t border-white/10 flex items-center gap-2 text-[11px] text-white/80 hover:text-white text-left">
        <ChevronDown className={`h-3 w-3 transition-transform ${openLattice === "leaks" ? "rotate-180" : ""}`} />
        <AlertTriangle className="h-3 w-3 text-white/60" strokeWidth={1.5} />
        Leak signals ({data.leaks.length})
      </button>
      {openLattice === "leaks" && (
        <div className="px-3 pb-3 -mt-1 space-y-1">
          {data.leaks.length === 0 && <div className="text-[11px] text-white/40 italic">No leak signals detected in sampled posts.</div>}
          {data.leaks.map((l, i) => (
            <div key={i} className="border border-white/10 rounded-md p-2 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-[1px] rounded-sm border border-white/20 text-white/80 uppercase tracking-wide">{l.kind.replace(/_/g, " ")}</span>
                <ConfidencePill v={l.confidence} />
                {l.sourcePostUrl && (
                  <a href={l.sourcePostUrl} target="_blank" rel="noreferrer" className="ml-auto text-[10px] text-white/40 hover:text-white/80 inline-flex items-center gap-1">source <ExternalLink className="h-2.5 w-2.5" /></a>
                )}
              </div>
              <div className="text-[11px] text-white/85 font-mono break-words">"{l.excerpt}"</div>
              <div className="text-[10px] text-white/40 italic">{l.reasoning}</div>
            </div>
          ))}
        </div>
      )}

      {/* Cartography lattice */}
      <button onClick={() => toggle("cart")} className="w-full px-3 py-1.5 border-t border-white/10 flex items-center gap-2 text-[11px] text-white/80 hover:text-white text-left">
        <ChevronDown className={`h-3 w-3 transition-transform ${openLattice === "cart" ? "rotate-180" : ""}`} />
        <Clock className="h-3 w-3 text-white/60" strokeWidth={1.5} />
        Timeline cartography
      </button>
      {openLattice === "cart" && (
        <div className="px-3 pb-3 -mt-1 space-y-2">
          <div>
            <div className="text-[10px] text-white/40 mb-1">Posts by hour (UTC)</div>
            <Sparkbars values={data.cartography.hoursHistogram} />
          </div>
          <div>
            <div className="text-[10px] text-white/40 mb-1">Posts by weekday (Sun–Sat)</div>
            <Sparkbars values={data.cartography.weekdayHistogram} />
          </div>
          <div className="text-[11px] text-white/70">
            Peak UTC hour <span className="text-white tabular-nums">{data.cartography.peakUtcHour ?? "—"}h</span> ({Math.round(data.cartography.peakUtcHourShare * 100)}% share) ·
            {" "}inferred TZ <span className="text-white">{data.cartography.inferredTimezone?.label || "—"}</span>
            {data.cartography.inferredTimezone && <> <ConfidencePill v={data.cartography.inferredTimezone.confidence} /></>}
          </div>
        </div>
      )}

      {/* Linguistics lattice */}
      <button onClick={() => toggle("ling")} className="w-full px-3 py-1.5 border-t border-white/10 flex items-center gap-2 text-[11px] text-white/80 hover:text-white text-left">
        <ChevronDown className={`h-3 w-3 transition-transform ${openLattice === "ling" ? "rotate-180" : ""}`} />
        <MessageSquare className="h-3 w-3 text-white/60" strokeWidth={1.5} />
        Linguistic fingerprint
      </button>
      {openLattice === "ling" && (
        <div className="px-3 pb-3 -mt-1">
          <table className="w-full text-[11px]">
            <tbody>
              <tr><td className="text-white/40 pr-3 py-0.5">avg words/post</td><td className="tabular-nums">{data.linguistics.avgWordsPerPost}</td></tr>
              <tr><td className="text-white/40 pr-3 py-0.5">vocab diversity (TTR)</td><td className="tabular-nums">{data.linguistics.typeTokenRatio}</td></tr>
              <tr><td className="text-white/40 pr-3 py-0.5">hashtag rate</td><td className="tabular-nums">{data.linguistics.hashtagRate}</td></tr>
              <tr><td className="text-white/40 pr-3 py-0.5">mention rate</td><td className="tabular-nums">{data.linguistics.mentionRate}</td></tr>
              <tr><td className="text-white/40 pr-3 py-0.5">emoji rate</td><td className="tabular-nums">{data.linguistics.emojiRate}</td></tr>
              <tr><td className="text-white/40 pr-3 py-0.5">ALL-CAPS rate</td><td className="tabular-nums">{data.linguistics.capsRate}</td></tr>
              <tr><td className="text-white/40 pr-3 py-0.5">exclamation rate</td><td className="tabular-nums">{data.linguistics.exclamationRate}</td></tr>
              <tr><td className="text-white/40 pr-3 py-0.5">profanity rate</td><td className="tabular-nums">{data.linguistics.profanityRate}</td></tr>
              <tr><td className="text-white/40 pr-3 py-0.5">languages</td><td>{data.linguistics.detectedLanguages.join(", ") || "—"}</td></tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Social graph lattice */}
      <button onClick={() => toggle("graph")} className="w-full px-3 py-1.5 border-t border-white/10 flex items-center gap-2 text-[11px] text-white/80 hover:text-white text-left">
        <ChevronDown className={`h-3 w-3 transition-transform ${openLattice === "graph" ? "rotate-180" : ""}`} />
        <Users className="h-3 w-3 text-white/60" strokeWidth={1.5} />
        Social graph
      </button>
      {openLattice === "graph" && (
        <div className="px-3 pb-3 -mt-1 space-y-2 text-[11px]">
          <div>
            <div className="text-white/40 mb-1">Top mentions</div>
            <div className="flex flex-wrap gap-1">
              {data.graph.topMentions.length === 0 && <span className="text-white/40 italic">none</span>}
              {data.graph.topMentions.map((m) => (
                <span key={m.handle} className="px-1.5 py-[1px] rounded-sm border border-white/10 tabular-nums">@{m.handle} <span className="text-white/40">×{m.count}</span></span>
              ))}
            </div>
          </div>
          <div>
            <div className="text-white/40 mb-1">Top reply targets</div>
            <div className="flex flex-wrap gap-1">
              {data.graph.topReplyTargets.length === 0 && <span className="text-white/40 italic">none</span>}
              {data.graph.topReplyTargets.map((m) => (
                <span key={m.handle} className="px-1.5 py-[1px] rounded-sm border border-white/10 tabular-nums">@{m.handle} <span className="text-white/40">×{m.count}</span></span>
              ))}
            </div>
          </div>
          {data.graph.inferredInnerRing.length > 0 && (
            <div>
              <div className="text-white/40 mb-1">Inferred inner ring (bidirectional interaction)</div>
              <div className="flex flex-wrap gap-1">
                {data.graph.inferredInnerRing.map((h) => (
                  <span key={h} className="px-1.5 py-[1px] rounded-sm border border-white/25 text-white/90">@{h}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Devices lattice */}
      <button onClick={() => toggle("dev")} className="w-full px-3 py-1.5 border-t border-white/10 flex items-center gap-2 text-[11px] text-white/80 hover:text-white text-left">
        <ChevronDown className={`h-3 w-3 transition-transform ${openLattice === "dev" ? "rotate-180" : ""}`} />
        <Cpu className="h-3 w-3 text-white/60" strokeWidth={1.5} />
        Device / client stack
      </button>
      {openLattice === "dev" && (
        <div className="px-3 pb-3 -mt-1 space-y-1 text-[11px]">
          {data.devices.clients.length === 0 && <div className="text-white/40 italic">No client source field exposed on sampled posts.</div>}
          {data.devices.clients.map((c) => (
            <div key={c.source} className="flex items-center gap-2">
              <span className="text-white/85 flex-1 truncate">{c.source}</span>
              <span className="text-white/40 tabular-nums">{Math.round(c.share * 100)}%</span>
              <div className="w-24 h-1.5 bg-white/5 rounded-sm overflow-hidden">
                <div className="h-full bg-white/60" style={{ width: `${c.share * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cross-platform lattice */}
      <button onClick={() => toggle("cross")} className="w-full px-3 py-1.5 border-t border-white/10 flex items-center gap-2 text-[11px] text-white/80 hover:text-white text-left">
        <ChevronDown className={`h-3 w-3 transition-transform ${openLattice === "cross" ? "rotate-180" : ""}`} />
        <Globe2 className="h-3 w-3 text-white/60" strokeWidth={1.5} />
        Cross-platform handle enumeration ({foundCross.length}/{data.crossPlatform.length})
      </button>
      {openLattice === "cross" && (
        <div className="px-3 pb-3 -mt-1 grid grid-cols-2 gap-1 text-[11px]">
          {data.crossPlatform.map((h) => {
            const tone = h.status === "found" ? "text-white/90 border-white/30 bg-white/[0.04]"
                      : h.status === "not_found" ? "text-white/40 border-white/10"
                      : "text-white/50 border-white/10";
            return (
              <a key={h.platform} href={h.url} target="_blank" rel="noreferrer" className={`flex items-center gap-2 px-2 py-1 rounded-md border ${tone} hover:text-white`}>
                <span className="flex-1 truncate capitalize">{h.platform}</span>
                <span className="text-[9px] uppercase tabular-nums">{h.status.replace("_", " ")}</span>
                {h.status === "found" && <ConfidencePill v={h.confidence} />}
              </a>
            );
          })}
        </div>
      )}

      {/* Reasoning trail */}
      <button onClick={() => toggle("trail")} className="w-full px-3 py-1.5 border-t border-white/10 flex items-center gap-2 text-[11px] text-white/80 hover:text-white text-left">
        <ChevronDown className={`h-3 w-3 transition-transform ${openLattice === "trail" ? "rotate-180" : ""}`} />
        Reasoning trail ({data.claims.length})
      </button>
      {openLattice === "trail" && (
        <div className="px-3 pb-3 -mt-1 space-y-1">
          {data.claims.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] py-0.5 border-b border-white/5 last:border-0">
              <span className="text-white/40 min-w-[110px]">{c.key}</span>
              <span className="text-white/85 flex-1 break-words">{typeof c.value === "object" ? JSON.stringify(c.value) : String(c.value)}</span>
              <span className="text-white/40 text-[9px]">{c.source}</span>
              <ConfidencePill v={c.confidence} />
            </div>
          ))}
        </div>
      )}

      {/* Ethics footer */}
      <div className="px-3 py-1.5 border-t border-white/10 bg-black/20 flex items-center gap-1.5 text-[10px] text-white/40">
        <ShieldAlert className="h-3 w-3" strokeWidth={1.5} />
        Public OSINT reconstruction. Probabilistic. Verify before acting. Available to all subscription tiers.
      </div>
    </div>
  );
}
