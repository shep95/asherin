import React, { useState, useCallback } from "react";
import {
  User, MapPin, Clock, Users, MessageSquare, Eye, Camera, Hash, Globe, Shield,
  ChevronDown, ChevronRight, Download, Trash2, Plus, X, FileText, TrendingUp,
  AlertTriangle, Brain, Target, Fingerprint, BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

// ── Types ──

interface LocationPoint {
  label: string;
  coordinates?: string;
  source: string;
  timestamp?: string;
  confidence: number;
}

interface InteractionTarget {
  handle: string;
  platform?: string;
  interactionType: "quote" | "repost" | "reply" | "like" | "mention" | "tag" | "follow";
  frequency: number;
  lastSeen?: string;
  relationship?: string;
}

interface PostEntry {
  timestamp: string;
  type: "text" | "image" | "video" | "story" | "reel" | "thread";
  content: string;
  engagement?: { likes?: number; comments?: number; shares?: number; views?: number };
  location?: string;
  mentions?: string[];
  hashtags?: string[];
  sentiment?: "positive" | "negative" | "neutral";
}

interface SpeechPattern {
  pattern: string;
  frequency: number;
  examples: string[];
  category: "vocabulary" | "grammar" | "tone" | "emoji" | "slang" | "punctuation";
}

interface TemporalPattern {
  dayOfWeek: string;
  hourRange: string;
  postCount: number;
  activityLevel: "high" | "medium" | "low";
}

interface PsychographicInsight {
  trait: string;
  value: string;
  confidence: number;
  evidence: string[];
}

export interface SocialIntelProfile {
  id: string;
  handle: string;
  platform: string;
  displayName?: string;
  bio?: string;
  avatarDescription?: string;
  followerCount?: string;
  followingCount?: string;
  postCount?: string;
  accountAge?: string;
  verified?: boolean;
  
  // Intelligence layers
  locations: LocationPoint[];
  interactions: InteractionTarget[];
  posts: PostEntry[];
  speechPatterns: SpeechPattern[];
  temporalPatterns: TemporalPattern[];
  psychographics: PsychographicInsight[];
  
  // Meta
  framesCaptured: number;
  lastUpdated: Date;
  createdAt: Date;
  status: "building" | "complete" | "stale";
  
  // Summary
  aiSummary?: string;
  riskFlags?: string[];
  networkMap?: { nodes: string[]; edges: { from: string; to: string; type: string }[] };
}

const EMPTY_PROFILE: Omit<SocialIntelProfile, "id" | "createdAt" | "lastUpdated"> = {
  handle: "",
  platform: "",
  locations: [],
  interactions: [],
  posts: [],
  speechPatterns: [],
  temporalPatterns: [],
  psychographics: [],
  framesCaptured: 0,
  status: "building",
};

// ── Component ──

interface Props {
  onClose: () => void;
  isSharing: boolean;
  currentObservations: string[];
  currentContext: any;
}

const CrossSocialIntelProfiler: React.FC<Props> = ({ onClose, isSharing, currentObservations, currentContext }) => {
  const [profiles, setProfiles] = useState<SocialIntelProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    overview: true, locations: true, interactions: false, posts: false,
    speech: false, temporal: false, psycho: false, network: false,
  });

  const activeProfile = profiles.find(p => p.id === activeProfileId);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const createProfile = useCallback(() => {
    const id = crypto.randomUUID();
    const now = new Date();
    const platform = detectPlatform(currentContext?.url || currentContext?.app || "");
    const newProfile: SocialIntelProfile = {
      ...EMPTY_PROFILE,
      id,
      platform,
      handle: extractHandle(currentContext?.url || "", platform),
      createdAt: now,
      lastUpdated: now,
    };
    setProfiles(prev => [newProfile, ...prev]);
    setActiveProfileId(id);
    setIsCapturing(true);
  }, [currentContext]);

  const deleteProfile = useCallback((id: string) => {
    setProfiles(prev => prev.filter(p => p.id !== id));
    if (activeProfileId === id) setActiveProfileId(null);
  }, [activeProfileId]);

  // Ingest observations into the active profile
  const ingestObservations = useCallback(() => {
    if (!activeProfileId || !currentObservations.length) return;

    setProfiles(prev => prev.map(p => {
      if (p.id !== activeProfileId) return p;

      const updated = { ...p };
      updated.framesCaptured += 1;
      updated.lastUpdated = new Date();

      // Parse observations for social media data points
      for (const obs of currentObservations) {
        const lower = obs.toLowerCase();

        // Extract locations from geo-tags or location mentions
        if (lower.includes("location") || lower.includes("geo") || lower.includes("tagged at") || lower.includes("📍")) {
          const existing = updated.locations.map(l => l.label);
          const locMatch = obs.match(/(?:location|tagged at|📍|geo[:-]?\s*)(.*?)(?:\.|$)/i);
          if (locMatch && !existing.includes(locMatch[1].trim())) {
            updated.locations.push({
              label: locMatch[1].trim(),
              source: "frame_observation",
              confidence: 70,
              timestamp: new Date().toISOString(),
            });
          }
        }

        // Extract post timestamps
        if (lower.includes("posted") || lower.includes("ago") || lower.includes("timestamp")) {
          const timeMatch = obs.match(/(\d+\s*(?:hours?|minutes?|days?|weeks?|months?|years?)\s*ago|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d+)/i);
          if (timeMatch) {
            updated.posts.push({
              timestamp: timeMatch[1],
              type: "text",
              content: obs.slice(0, 200),
              sentiment: lower.includes("positive") || lower.includes("happy") ? "positive" :
                lower.includes("negative") || lower.includes("angry") ? "negative" : "neutral",
            });
          }
        }

        // Extract mentioned users / interactions
        const mentionMatches = obs.match(/@[\w.]+/g);
        if (mentionMatches) {
          for (const mention of mentionMatches) {
            const handle = mention.replace("@", "");
            const existingIdx = updated.interactions.findIndex(i => i.handle === handle);
            if (existingIdx >= 0) {
              updated.interactions[existingIdx].frequency += 1;
              updated.interactions[existingIdx].lastSeen = new Date().toISOString();
            } else {
              updated.interactions.push({
                handle,
                interactionType: lower.includes("repost") || lower.includes("retweet") ? "repost" :
                  lower.includes("quote") ? "quote" :
                  lower.includes("reply") ? "reply" : "mention",
                frequency: 1,
                lastSeen: new Date().toISOString(),
              });
            }
          }
        }

        // Extract hashtags
        const hashtagMatches = obs.match(/#[\w]+/g);
        if (hashtagMatches) {
          // Add to latest post or create new entry
          const latest = updated.posts[updated.posts.length - 1];
          if (latest) {
            latest.hashtags = [...new Set([...(latest.hashtags || []), ...hashtagMatches])];
          }
        }

        // Extract follower/following counts
        const followerMatch = obs.match(/(\d[\d,.]*[KMB]?)\s*followers?/i);
        if (followerMatch) updated.followerCount = followerMatch[1];
        const followingMatch = obs.match(/(\d[\d,.]*[KMB]?)\s*following/i);
        if (followingMatch) updated.followingCount = followingMatch[1];

        // Extract display name / bio
        if (lower.includes("bio") || lower.includes("description")) {
          const bioMatch = obs.match(/(?:bio|description)[:\s]+"?([^"]+)"?/i);
          if (bioMatch) updated.bio = bioMatch[1].trim();
        }

        // Extract handle
        if (!updated.handle && (lower.includes("@") || lower.includes("username"))) {
          const handleMatch = obs.match(/@([\w.]+)/);
          if (handleMatch) updated.handle = handleMatch[1];
        }

        // Speech patterns
        if (lower.includes("emoji") || lower.includes("slang") || lower.includes("tone") || lower.includes("writing style")) {
          updated.speechPatterns.push({
            pattern: obs.slice(0, 100),
            frequency: 1,
            examples: [obs.slice(0, 150)],
            category: lower.includes("emoji") ? "emoji" :
              lower.includes("slang") ? "slang" :
              lower.includes("tone") ? "tone" : "vocabulary",
          });
        }

        // Engagement data
        const likeMatch = obs.match(/(\d[\d,.]*[KMB]?)\s*(?:likes?|❤️|♡)/i);
        const commentMatch = obs.match(/(\d[\d,.]*[KMB]?)\s*(?:comments?|replies)/i);
        const shareMatch = obs.match(/(\d[\d,.]*[KMB]?)\s*(?:shares?|reposts?|retweets?)/i);
        const viewMatch = obs.match(/(\d[\d,.]*[KMB]?)\s*(?:views?|impressions?)/i);
        if (likeMatch || commentMatch || shareMatch || viewMatch) {
          const latest = updated.posts[updated.posts.length - 1];
          if (latest) {
            latest.engagement = {
              likes: likeMatch ? parseCount(likeMatch[1]) : latest.engagement?.likes,
              comments: commentMatch ? parseCount(commentMatch[1]) : latest.engagement?.comments,
              shares: shareMatch ? parseCount(shareMatch[1]) : latest.engagement?.shares,
              views: viewMatch ? parseCount(viewMatch[1]) : latest.engagement?.views,
            };
          }
        }
      }

      // Deduplicate posts
      updated.posts = deduplicatePosts(updated.posts);
      updated.interactions = deduplicateInteractions(updated.interactions);

      return updated;
    }));
  }, [activeProfileId, currentObservations]);

  // Auto-ingest when capturing is enabled and new observations arrive
  React.useEffect(() => {
    if (isCapturing && isSharing && currentObservations.length > 0) {
      ingestObservations();
    }
  }, [isCapturing, isSharing, currentObservations, ingestObservations]);

  const exportProfile = useCallback((profile: SocialIntelProfile) => {
    const report = generateIntelReport(profile);
    const blob = new Blob([report], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CROSS_INTEL_${profile.handle || "unknown"}_${profile.platform}_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <div className="w-[420px] border-l border-border/20 flex flex-col bg-background h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-medium text-foreground">Social Intel Profiler</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={createProfile} title="New Profile">
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Profile tabs */}
      {profiles.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border/10 overflow-x-auto">
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => setActiveProfileId(p.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] transition whitespace-nowrap ${
                activeProfileId === p.id
                  ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                  : "bg-muted/10 text-muted-foreground/60 hover:text-muted-foreground border border-transparent"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${p.status === "building" ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/30"}`} />
              @{p.handle || "scanning..."}
              <span className="text-muted-foreground/30">{p.platform}</span>
            </button>
          ))}
        </div>
      )}

      {/* Capture toggle */}
      {activeProfile && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/10">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${isCapturing ? "bg-red-400 animate-pulse" : "bg-muted-foreground/20"}`} />
            <span className="text-[10px] text-muted-foreground/60">
              {isCapturing ? "CAPTURING" : "PAUSED"} · {activeProfile.framesCaptured} frames · {activeProfile.posts.length} posts · {activeProfile.interactions.length} contacts
            </span>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 text-[10px] ${isCapturing ? "text-red-400" : "text-emerald-400"}`}
              onClick={() => setIsCapturing(!isCapturing)}
            >
              {isCapturing ? "⏸ Pause" : "▶ Capture"}
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => exportProfile(activeProfile)} title="Export Intel File">
              <Download className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-400/60" onClick={() => deleteProfile(activeProfile.id)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Content */}
      <ScrollArea className="flex-1">
        {!activeProfile ? (
          <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
            <Fingerprint className="h-10 w-10 text-muted-foreground/10 mb-4" />
            <p className="text-xs text-muted-foreground/40 font-extralight mb-2">
              Navigate to a social media profile while screen sharing, then click <strong className="text-foreground/60">+</strong> to begin building an intelligence file.
            </p>
            <p className="text-[10px] text-muted-foreground/25 font-extralight">
              Cross will extract locations, speech patterns, interaction networks, temporal behavior, and psychographic indicators from every frame.
            </p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {/* OVERVIEW */}
            <ProfileSection
              title="Subject Overview"
              icon={<User className="h-3.5 w-3.5 text-amber-400" />}
              expanded={expandedSections.overview}
              onToggle={() => toggleSection("overview")}
              count={null}
            >
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <InfoField label="Handle" value={`@${activeProfile.handle || "—"}`} />
                  <InfoField label="Platform" value={activeProfile.platform || "—"} />
                  <InfoField label="Followers" value={activeProfile.followerCount || "—"} />
                  <InfoField label="Following" value={activeProfile.followingCount || "—"} />
                  <InfoField label="Posts" value={activeProfile.postCount || `${activeProfile.posts.length} captured`} />
                  <InfoField label="Verified" value={activeProfile.verified ? "✓ Yes" : "—"} />
                </div>
                {activeProfile.bio && (
                  <div className="px-2 py-1.5 rounded bg-muted/10 text-[10px] text-foreground/70 font-extralight">
                    <span className="text-muted-foreground/40 text-[9px] uppercase tracking-wider block mb-0.5">Bio</span>
                    {activeProfile.bio}
                  </div>
                )}
              </div>
            </ProfileSection>

            {/* LOCATIONS */}
            <ProfileSection
              title="Geolocation Intelligence"
              icon={<MapPin className="h-3.5 w-3.5 text-emerald-400" />}
              expanded={expandedSections.locations}
              onToggle={() => toggleSection("locations")}
              count={activeProfile.locations.length}
            >
              {activeProfile.locations.length === 0 ? (
                <EmptyState text="No locations extracted yet. Scroll through posts with geo-tags." />
              ) : (
                <div className="space-y-1.5">
                  {activeProfile.locations.map((loc, i) => (
                    <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded bg-emerald-500/5 border border-emerald-500/10">
                      <MapPin className="h-3 w-3 text-emerald-400/60 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] text-foreground/80">{loc.label}</p>
                        {loc.coordinates && <p className="text-[9px] text-muted-foreground/40 font-mono">{loc.coordinates}</p>}
                        <p className="text-[9px] text-muted-foreground/30">{loc.source} · {loc.confidence}% confidence</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ProfileSection>

            {/* INTERACTION NETWORK */}
            <ProfileSection
              title="Interaction Network"
              icon={<Users className="h-3.5 w-3.5 text-blue-400" />}
              expanded={expandedSections.interactions}
              onToggle={() => toggleSection("interactions")}
              count={activeProfile.interactions.length}
            >
              {activeProfile.interactions.length === 0 ? (
                <EmptyState text="No interactions detected yet. Scroll through comments, quotes, and reposts." />
              ) : (
                <div className="space-y-1">
                  {activeProfile.interactions
                    .sort((a, b) => b.frequency - a.frequency)
                    .slice(0, 30)
                    .map((int, i) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1 rounded bg-blue-500/5 border border-blue-500/10">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] text-blue-300 font-medium">@{int.handle}</span>
                        <span className={`text-[8px] px-1 py-0.5 rounded ${
                          int.interactionType === "repost" ? "bg-emerald-500/20 text-emerald-300" :
                          int.interactionType === "quote" ? "bg-amber-500/20 text-amber-300" :
                          int.interactionType === "reply" ? "bg-purple-500/20 text-purple-300" :
                          "bg-muted/20 text-muted-foreground/60"
                        }`}>{int.interactionType}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-muted-foreground/40">×{int.frequency}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ProfileSection>

            {/* POST TIMELINE */}
            <ProfileSection
              title="Post Timeline & Content"
              icon={<Clock className="h-3.5 w-3.5 text-cyan-400" />}
              expanded={expandedSections.posts}
              onToggle={() => toggleSection("posts")}
              count={activeProfile.posts.length}
            >
              {activeProfile.posts.length === 0 ? (
                <EmptyState text="No posts captured yet. Scroll through the feed slowly." />
              ) : (
                <div className="space-y-1.5">
                  {activeProfile.posts.slice(0, 50).map((post, i) => (
                    <div key={i} className="px-2 py-1.5 rounded bg-cyan-500/5 border border-cyan-500/10">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px] text-muted-foreground/40">{post.timestamp}</span>
                        <div className="flex items-center gap-1.5">
                          {post.type !== "text" && <span className="text-[8px] px-1 py-0.5 rounded bg-muted/20 text-muted-foreground/50">{post.type}</span>}
                          {post.sentiment && (
                            <span className={`text-[8px] ${
                              post.sentiment === "positive" ? "text-emerald-400" :
                              post.sentiment === "negative" ? "text-red-400" :
                              "text-muted-foreground/40"
                            }`}>{post.sentiment === "positive" ? "😊" : post.sentiment === "negative" ? "😠" : "😐"}</span>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-foreground/70 font-extralight line-clamp-3">{post.content}</p>
                      {post.engagement && (
                        <div className="flex gap-2 mt-1 text-[8px] text-muted-foreground/30">
                          {post.engagement.likes != null && <span>❤️ {formatCount(post.engagement.likes)}</span>}
                          {post.engagement.comments != null && <span>💬 {formatCount(post.engagement.comments)}</span>}
                          {post.engagement.shares != null && <span>🔄 {formatCount(post.engagement.shares)}</span>}
                          {post.engagement.views != null && <span>👁 {formatCount(post.engagement.views)}</span>}
                        </div>
                      )}
                      {post.location && <p className="text-[8px] text-emerald-400/50 mt-0.5">📍 {post.location}</p>}
                      {post.hashtags?.length ? <p className="text-[8px] text-blue-400/40 mt-0.5">{post.hashtags.join(" ")}</p> : null}
                    </div>
                  ))}
                </div>
              )}
            </ProfileSection>

            {/* SPEECH & TEXT PATTERNS */}
            <ProfileSection
              title="Speech & Text Patterns"
              icon={<MessageSquare className="h-3.5 w-3.5 text-purple-400" />}
              expanded={expandedSections.speech}
              onToggle={() => toggleSection("speech")}
              count={activeProfile.speechPatterns.length}
            >
              {activeProfile.speechPatterns.length === 0 ? (
                <EmptyState text="Analyzing language patterns. More frames needed." />
              ) : (
                <div className="space-y-1">
                  {activeProfile.speechPatterns.map((sp, i) => (
                    <div key={i} className="px-2 py-1.5 rounded bg-purple-500/5 border border-purple-500/10">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[8px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-300">{sp.category}</span>
                        <span className="text-[9px] text-muted-foreground/30">×{sp.frequency}</span>
                      </div>
                      <p className="text-[10px] text-foreground/70 font-extralight">{sp.pattern}</p>
                    </div>
                  ))}
                </div>
              )}
            </ProfileSection>

            {/* TEMPORAL PATTERNS */}
            <ProfileSection
              title="Temporal Activity Patterns"
              icon={<BarChart3 className="h-3.5 w-3.5 text-amber-400" />}
              expanded={expandedSections.temporal}
              onToggle={() => toggleSection("temporal")}
              count={activeProfile.temporalPatterns.length}
            >
              {activeProfile.temporalPatterns.length === 0 ? (
                <EmptyState text="Need more post timestamps to detect patterns." />
              ) : (
                <div className="space-y-1">
                  {activeProfile.temporalPatterns.map((tp, i) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1 rounded bg-amber-500/5 border border-amber-500/10">
                      <span className="text-[10px] text-foreground/70">{tp.dayOfWeek} · {tp.hourRange}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-muted-foreground/40">{tp.postCount} posts</span>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          tp.activityLevel === "high" ? "bg-emerald-400" :
                          tp.activityLevel === "medium" ? "bg-amber-400" : "bg-muted-foreground/30"
                        }`} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ProfileSection>

            {/* PSYCHOGRAPHIC INDICATORS */}
            <ProfileSection
              title="Psychographic Intelligence"
              icon={<Brain className="h-3.5 w-3.5 text-rose-400" />}
              expanded={expandedSections.psycho}
              onToggle={() => toggleSection("psycho")}
              count={activeProfile.psychographics.length}
            >
              {activeProfile.psychographics.length === 0 ? (
                <EmptyState text="Psychographic analysis requires 20+ frames. Keep scrolling." />
              ) : (
                <div className="space-y-1.5">
                  {activeProfile.psychographics.map((pg, i) => (
                    <div key={i} className="px-2 py-1.5 rounded bg-rose-500/5 border border-rose-500/10">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[10px] text-foreground/80 font-medium">{pg.trait}</span>
                        <span className="text-[9px] text-muted-foreground/40">{pg.confidence}%</span>
                      </div>
                      <p className="text-[10px] text-rose-300/70">{pg.value}</p>
                      {pg.evidence.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {pg.evidence.slice(0, 3).map((e, j) => (
                            <p key={j} className="text-[9px] text-muted-foreground/30 pl-2 border-l border-rose-400/20 font-extralight">{e}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ProfileSection>

            {/* RISK FLAGS */}
            {activeProfile.riskFlags && activeProfile.riskFlags.length > 0 && (
              <div className="px-3 py-2 rounded-xl bg-red-500/5 border border-red-500/15">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                  <span className="text-[10px] uppercase tracking-wider text-red-400/70 font-medium">Risk Flags</span>
                </div>
                <div className="space-y-1">
                  {activeProfile.riskFlags.map((flag, i) => (
                    <p key={i} className="text-[10px] text-red-300/60 font-extralight">⚠ {flag}</p>
                  ))}
                </div>
              </div>
            )}

            {/* AI SUMMARY */}
            {activeProfile.aiSummary && (
              <div className="px-3 py-2 rounded-xl bg-accent/5 border border-accent/15">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Target className="h-3.5 w-3.5 text-accent" />
                  <span className="text-[10px] uppercase tracking-wider text-accent/70 font-medium">Intelligence Summary</span>
                </div>
                <p className="text-[11px] text-foreground/70 font-extralight leading-relaxed">{activeProfile.aiSummary}</p>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Footer stats */}
      {activeProfile && (
        <div className="px-4 py-2 border-t border-border/10 flex items-center justify-between text-[9px] text-muted-foreground/30">
          <span>Created {activeProfile.createdAt.toLocaleTimeString()}</span>
          <span>Updated {activeProfile.lastUpdated.toLocaleTimeString()}</span>
          <span>{activeProfile.framesCaptured} frames analyzed</span>
        </div>
      )}
    </div>
  );
};

// ── Sub-components ──

const ProfileSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  count: number | null;
  children: React.ReactNode;
}> = ({ title, icon, expanded, onToggle, count, children }) => (
  <div className="rounded-xl bg-muted/5 border border-border/10 overflow-hidden">
    <button onClick={onToggle} className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/5 transition">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-[10px] uppercase tracking-wider text-foreground/60 font-medium">{title}</span>
        {count != null && count > 0 && (
          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">{count}</span>
        )}
      </div>
      {expanded ? <ChevronDown className="h-3 w-3 text-muted-foreground/30" /> : <ChevronRight className="h-3 w-3 text-muted-foreground/30" />}
    </button>
    {expanded && <div className="px-3 pb-3">{children}</div>}
  </div>
);

const InfoField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="px-2 py-1 rounded bg-muted/10">
    <span className="text-[8px] uppercase tracking-wider text-muted-foreground/30 block">{label}</span>
    <span className="text-[10px] text-foreground/70">{value}</span>
  </div>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <p className="text-[10px] text-muted-foreground/30 font-extralight text-center py-3">{text}</p>
);

// ── Utilities ──

function detectPlatform(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("twitter") || lower.includes("x.com")) return "X/Twitter";
  if (lower.includes("instagram")) return "Instagram";
  if (lower.includes("facebook") || lower.includes("fb.com")) return "Facebook";
  if (lower.includes("tiktok")) return "TikTok";
  if (lower.includes("linkedin")) return "LinkedIn";
  if (lower.includes("youtube")) return "YouTube";
  if (lower.includes("reddit")) return "Reddit";
  if (lower.includes("threads")) return "Threads";
  if (lower.includes("snapchat")) return "Snapchat";
  if (lower.includes("telegram")) return "Telegram";
  if (lower.includes("discord")) return "Discord";
  return "Unknown";
}

function extractHandle(url: string, platform: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length > 0) return parts[0].replace("@", "");
  } catch { /* not a URL */ }
  return "";
}

function parseCount(val: string): number {
  const clean = val.replace(/,/g, "");
  const multiplier = clean.endsWith("K") ? 1000 : clean.endsWith("M") ? 1_000_000 : clean.endsWith("B") ? 1_000_000_000 : 1;
  return Math.round(parseFloat(clean) * multiplier);
}

function formatCount(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
  return String(val);
}

function deduplicatePosts(posts: PostEntry[]): PostEntry[] {
  const seen = new Set<string>();
  return posts.filter(p => {
    const key = `${p.timestamp}:${p.content.slice(0, 50)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deduplicateInteractions(interactions: InteractionTarget[]): InteractionTarget[] {
  const map = new Map<string, InteractionTarget>();
  for (const int of interactions) {
    const key = `${int.handle}:${int.interactionType}`;
    const existing = map.get(key);
    if (existing) {
      existing.frequency = Math.max(existing.frequency, int.frequency);
      if (int.lastSeen) existing.lastSeen = int.lastSeen;
    } else {
      map.set(key, { ...int });
    }
  }
  return Array.from(map.values());
}

function generateIntelReport(profile: SocialIntelProfile): string {
  const lines: string[] = [
    `# CROSS SOCIAL INTELLIGENCE FILE`,
    `## SUBJECT: @${profile.handle || "UNKNOWN"}`,
    `**Platform:** ${profile.platform}`,
    `**Generated:** ${new Date().toISOString()}`,
    `**Frames Analyzed:** ${profile.framesCaptured}`,
    `**Status:** ${profile.status}`,
    ``,
    `---`,
    ``,
    `## SUBJECT OVERVIEW`,
    profile.displayName ? `- **Display Name:** ${profile.displayName}` : "",
    profile.followerCount ? `- **Followers:** ${profile.followerCount}` : "",
    profile.followingCount ? `- **Following:** ${profile.followingCount}` : "",
    profile.bio ? `- **Bio:** ${profile.bio}` : "",
    profile.verified ? `- **Verified:** ✓` : "",
    ``,
    `## GEOLOCATION INTELLIGENCE (${profile.locations.length} points)`,
    ...profile.locations.map(l => `- 📍 **${l.label}** (${l.confidence}% confidence, source: ${l.source})`),
    ``,
    `## INTERACTION NETWORK (${profile.interactions.length} contacts)`,
    ...profile.interactions
      .sort((a, b) => b.frequency - a.frequency)
      .map(i => `- @${i.handle} — ${i.interactionType} (×${i.frequency})`),
    ``,
    `## POST TIMELINE (${profile.posts.length} captured)`,
    ...profile.posts.map(p => [
      `### ${p.timestamp} [${p.type}] ${p.sentiment ? `(${p.sentiment})` : ""}`,
      p.content.slice(0, 300),
      p.engagement ? `  - ❤️ ${p.engagement.likes || 0} | 💬 ${p.engagement.comments || 0} | 🔄 ${p.engagement.shares || 0} | 👁 ${p.engagement.views || 0}` : "",
      p.location ? `  - 📍 ${p.location}` : "",
      p.hashtags?.length ? `  - ${p.hashtags.join(" ")}` : "",
    ].filter(Boolean).join("\n")),
    ``,
    `## SPEECH & TEXT PATTERNS (${profile.speechPatterns.length})`,
    ...profile.speechPatterns.map(s => `- **[${s.category}]** ${s.pattern} (×${s.frequency})`),
    ``,
    `## PSYCHOGRAPHIC INDICATORS (${profile.psychographics.length})`,
    ...profile.psychographics.map(p => `- **${p.trait}:** ${p.value} (${p.confidence}%) — Evidence: ${p.evidence.join("; ")}`),
    ``,
    profile.riskFlags?.length ? `## RISK FLAGS\n${profile.riskFlags.map(f => `- ⚠ ${f}`).join("\n")}` : "",
    ``,
    profile.aiSummary ? `## INTELLIGENCE SUMMARY\n${profile.aiSummary}` : "",
    ``,
    `---`,
    `*Generated by CROSS Social Intelligence Profiler*`,
  ];

  return lines.filter(l => l !== undefined).join("\n");
}

export default CrossSocialIntelProfiler;
