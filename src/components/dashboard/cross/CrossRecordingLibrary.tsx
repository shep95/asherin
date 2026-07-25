import React, { useState, useEffect, useCallback } from "react";
import {
  Video, Star, Search, Grid3X3, List, Clock, HardDrive, Download, Share2,
  Trash2, Play, Edit, MoreHorizontal, Filter, Calendar, Tag, X, Eye,
  Lock, Link2, Copy, Check, FileText, Music, Image as ImageIcon, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ──
export interface SavedRecording {
  id: string;
  title: string;
  date: Date;
  duration: number;
  fileSize: number;
  creditsUsed: number;
  mode: string;
  starred: boolean;
  tags: string[];
  thumbnail?: string;
  hasTranscript: boolean;
  aiSummary?: string;
  storage: "local" | "cloud" | "both";
  shared: boolean;
  participants?: string[];
  overlayLayers: string[];
}

interface ShareSettings {
  emails: string[];
  linkEnabled: boolean;
  link: string;
  permissions: { view: boolean; download: boolean; edit: boolean };
  passwordProtected: boolean;
  password: string;
  expiresIn: number;
  privacyFilters: { removeSensitive: boolean; blurFaces: boolean; muteAudio: boolean };
  includeTranscript: boolean;
  includeAiSummary: boolean;
  includeReport: boolean;
}

interface ExportSettings {
  format: "mp4-h264" | "mp4-h265" | "webm" | "mov" | "cross";
  quality: "original" | "high" | "medium" | "low";
  overlays: "all" | "none" | "custom";
  extras: { transcript: boolean; report: boolean; audioOnly: boolean; overlayData: boolean; chapters: boolean };
  optimizeFor: "general" | "youtube" | "instagram" | "tiktok" | "linkedin";
}

const FILTER_CATEGORIES = ["All", "Sales Calls", "Meetings", "Trading", "Coding", "Starred"];
const FORMAT_OPTIONS = [
  { value: "mp4-h264" as const, label: "MP4 (H.264)", desc: "Universal compatibility" },
  { value: "mp4-h265" as const, label: "MP4 (H.265)", desc: "Smaller file size" },
  { value: "webm" as const, label: "WebM", desc: "Web optimized" },
  { value: "mov" as const, label: "MOV (ProRes)", desc: "Professional editing" },
  { value: "cross" as const, label: "CROSS Project", desc: "Editable in CROSS" },
];
const QUALITY_OPTIONS = [
  { value: "original" as const, label: "Original", mult: 1 },
  { value: "high" as const, label: "High (1080p)", mult: 0.74 },
  { value: "medium" as const, label: "Medium (720p)", mult: 0.43 },
  { value: "low" as const, label: "Low (480p)", mult: 0.19 },
];
const SOCIAL_PRESETS = [
  { value: "general" as const, label: "General use" },
  { value: "youtube" as const, label: "YouTube (1920×1080)" },
  { value: "instagram" as const, label: "Instagram (1080×1080)" },
  { value: "tiktok" as const, label: "TikTok (1080×1920)" },
  { value: "linkedin" as const, label: "LinkedIn" },
];

interface CrossRecordingLibraryProps {
  onClose: () => void;
}

const CrossRecordingLibrary: React.FC<CrossRecordingLibraryProps> = ({ onClose }) => {
  const { user } = useAuth();
  const [recordings, setRecordings] = useState<SavedRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeFilter, setActiveFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecording, setSelectedRecording] = useState<SavedRecording | null>(null);
  const [activePanel, setActivePanel] = useState<"details" | "share" | "export" | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const loadRecordings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cross_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) { console.error("Failed to load recordings:", error); return; }
      const mapped: SavedRecording[] = (data || []).map((s: any) => ({
        id: s.id,
        title: s.title || "Untitled Session",
        date: new Date(s.created_at),
        duration: s.duration || 0,
        fileSize: (s.duration || 0) * 500000, // estimate ~500KB/s
        creditsUsed: Number(s.credits_used) || 0,
        mode: s.mode || "general",
        starred: false,
        tags: s.tags || [],
        hasTranscript: !!s.transcript,
        aiSummary: s.ai_summary,
        storage: s.recording_url ? "cloud" : "local",
        shared: false,
        overlayLayers: ["chat", "annotations"],
      }));
      setRecordings(mapped);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadRecordings(); }, [loadRecordings]);

  const deleteRecording = async (id: string) => {
    await supabase.from("cross_sessions").delete().eq("id", id);
    setRecordings(prev => prev.filter(r => r.id !== id));
    if (selectedRecording?.id === id) { setSelectedRecording(null); setActivePanel(null); }
  };

  const [shareSettings] = useState<ShareSettings>({
    emails: [], linkEnabled: true, link: "https://cross.asherin.ai/r/abc123xyz",
    permissions: { view: true, download: false, edit: false },
    passwordProtected: true, password: "••••••••", expiresIn: 7,
    privacyFilters: { removeSensitive: true, blurFaces: false, muteAudio: false },
    includeTranscript: true, includeAiSummary: true, includeReport: false,
  });

  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    format: "mp4-h264", quality: "original", overlays: "all",
    extras: { transcript: true, report: true, audioOnly: false, overlayData: false, chapters: false },
    optimizeFor: "general",
  });

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(0)} MB`;
    return `${(bytes / 1e3).toFixed(0)} KB`;
  };

  const filtered = recordings.filter(r => {
    if (activeFilter === "Starred") return r.starred;
    if (activeFilter === "Sales Calls") return r.mode === "sales";
    if (activeFilter === "Trading") return r.mode === "trading";
    if (activeFilter === "Coding") return r.mode === "coding";
    if (activeFilter === "Meetings") return r.tags.some(t => t.toLowerCase().includes("meeting"));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.title.toLowerCase().includes(q) || r.tags.some(t => t.toLowerCase().includes(q));
    }
    return true;
  });

  const copyLink = () => {
    navigator.clipboard.writeText(shareSettings.link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label className="flex items-center justify-between py-1 cursor-pointer group">
      <span className="text-xs text-muted-foreground group-hover:text-foreground transition">{label}</span>
      <button onClick={() => onChange(!checked)} className={`relative w-7 h-3.5 rounded-full transition-colors ${checked ? "bg-accent" : "bg-muted/30"}`}>
        <span className="absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-transform left-0.5" style={{ transform: checked ? "translateX(12px)" : "translateX(0)" }} />
      </button>
    </label>
  );

  const Radio = ({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) => (
    <button onClick={onClick} className={`flex items-center gap-2 text-xs py-1 transition ${checked ? "text-foreground" : "text-muted-foreground/50 hover:text-muted-foreground"}`}>
      <span className={`w-3 h-3 rounded-full border ${checked ? "border-accent bg-accent" : "border-muted-foreground/30"}`}>
        {checked && <span className="block w-1.5 h-1.5 rounded-full bg-white mx-auto mt-[3px]" />}
      </span>
      {label}
    </button>
  );

  return (
    <div className="w-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <Video className="h-4 w-4 text-accent" /> Recording Library
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/10 rounded-lg p-0.5">
            <button onClick={() => setViewMode("grid")} className={`p-1 rounded ${viewMode === "grid" ? "bg-accent/20 text-accent" : "text-muted-foreground/40"}`}>
              <Grid3X3 className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setViewMode("list")} className={`p-1 rounded ${viewMode === "list" ? "bg-accent/20 text-accent" : "text-muted-foreground/40"}`}>
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
          <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground" /></button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="px-4 py-2 space-y-2 border-b border-border/10">
        <div className="flex items-center gap-2 bg-muted/10 rounded-lg px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-muted-foreground/40" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search recordings..." className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/25 outline-none" />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTER_CATEGORIES.map(f => (
            <button key={f} onClick={() => setActiveFilter(f)} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition ${activeFilter === f ? "bg-accent/20 text-accent" : "bg-muted/10 text-muted-foreground/50 hover:text-muted-foreground"}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {selectedRecording && activePanel ? (
          /* Detail / Share / Export panel */
          <div className="p-4 space-y-4">
            <button onClick={() => { setSelectedRecording(null); setActivePanel(null); }} className="flex items-center gap-1 text-xs text-accent hover:text-accent/80 transition">
              ← Back to library
            </button>

            {/* Recording header */}
            <div className="p-3 rounded-xl bg-muted/10 border border-border/20">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-sm font-medium text-foreground">{selectedRecording.title}</h4>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground/50">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {selectedRecording.date.toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDuration(selectedRecording.duration)}</span>
                    <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" /> {formatSize(selectedRecording.fileSize)}</span>
                    <span>◈ {selectedRecording.creditsUsed} credits</span>
                  </div>
                </div>
                <button onClick={() => {}} className="text-muted-foreground/40 hover:text-amber-400 transition">
                  <Star className={`h-4 w-4 ${selectedRecording.starred ? "text-amber-400 fill-amber-400" : ""}`} />
                </button>
              </div>

              {selectedRecording.participants && (
                <div className="mt-2">
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground/30 mb-1">Participants</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedRecording.participants.map((p, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-muted/15 text-[10px] text-muted-foreground/60">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedRecording.aiSummary && (
                <div className="mt-2 p-2 rounded-lg bg-accent/5 border border-accent/10">
                  <p className="text-[9px] uppercase tracking-wider text-accent/60 mb-1">AI Summary</p>
                  <p className="text-[11px] text-foreground/70 font-extralight leading-relaxed">{selectedRecording.aiSummary}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedRecording.tags.map(t => (
                  <span key={t} className="px-2 py-0.5 rounded-md bg-muted/15 text-[10px] text-muted-foreground/50">{t}</span>
                ))}
              </div>
            </div>

            {/* Panel tabs */}
            <div className="flex gap-1 border-b border-border/10 pb-1">
              {(["details", "share", "export"] as const).map(p => (
                <button key={p} onClick={() => setActivePanel(p)} className={`px-3 py-1.5 rounded-t-lg text-[11px] font-medium capitalize transition ${activePanel === p ? "bg-muted/15 text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground"}`}>
                  {p}
                </button>
              ))}
            </div>

            {/* DETAILS PANEL */}
            {activePanel === "details" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-muted/10"><span className="text-muted-foreground/40">Storage</span><p className="text-foreground mt-0.5 capitalize">{selectedRecording.storage}</p></div>
                  <div className="p-2 rounded-lg bg-muted/10"><span className="text-muted-foreground/40">Mode</span><p className="text-foreground mt-0.5 capitalize">{selectedRecording.mode}</p></div>
                  <div className="p-2 rounded-lg bg-muted/10"><span className="text-muted-foreground/40">Transcript</span><p className="text-foreground mt-0.5">{selectedRecording.hasTranscript ? "Available" : "None"}</p></div>
                  <div className="p-2 rounded-lg bg-muted/10"><span className="text-muted-foreground/40">Overlay Layers</span><p className="text-foreground mt-0.5">{selectedRecording.overlayLayers.length}</p></div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8 text-xs gap-1.5 rounded-lg"><Play className="h-3 w-3" /> Play</Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 rounded-lg"><Download className="h-3 w-3" /> Download</Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5 rounded-lg text-red-400 hover:text-red-300"><Trash2 className="h-3 w-3" /> Delete</Button>
                </div>
              </div>
            )}

            {/* SHARE PANEL */}
            {activePanel === "share" && (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1.5">Shareable Link</p>
                  <div className="flex items-center gap-1.5 bg-muted/10 rounded-lg px-3 py-2 text-[11px]">
                    <Link2 className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                    <span className="flex-1 truncate text-muted-foreground/60 font-mono">{shareSettings.link}</span>
                    <button onClick={copyLink} className="flex-shrink-0 p-1 hover:bg-white/5 rounded transition">
                      {copiedLink ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-muted-foreground/40" />}
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1.5">Permissions</p>
                  <div className="space-y-0.5">
                    <Toggle label="Can view" checked={shareSettings.permissions.view} onChange={() => {}} />
                    <Toggle label="Can download" checked={shareSettings.permissions.download} onChange={() => {}} />
                    <Toggle label="Can edit (trim, annotate)" checked={shareSettings.permissions.edit} onChange={() => {}} />
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1.5">Link Settings</p>
                  <div className="space-y-0.5">
                    <Toggle label="Password protect" checked={shareSettings.passwordProtected} onChange={() => {}} />
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs text-muted-foreground">Expire after</span>
                      <span className="text-xs text-foreground">{shareSettings.expiresIn} days</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1.5">Privacy Filters</p>
                  <div className="space-y-0.5">
                    <Toggle label="Remove sensitive data overlays" checked={shareSettings.privacyFilters.removeSensitive} onChange={() => {}} />
                    <Toggle label="Blur faces (except host)" checked={shareSettings.privacyFilters.blurFaces} onChange={() => {}} />
                    <Toggle label="Mute specific speakers" checked={shareSettings.privacyFilters.muteAudio} onChange={() => {}} />
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1.5">Include</p>
                  <div className="space-y-0.5">
                    <Toggle label="Transcript" checked={shareSettings.includeTranscript} onChange={() => {}} />
                    <Toggle label="AI summary" checked={shareSettings.includeAiSummary} onChange={() => {}} />
                    <Toggle label="Full AI analysis report" checked={shareSettings.includeReport} onChange={() => {}} />
                  </div>
                </div>

                <Button size="sm" className="w-full h-8 text-xs gap-1.5 rounded-lg"><Share2 className="h-3 w-3" /> Share Recording</Button>
              </div>
            )}

            {/* EXPORT PANEL */}
            {activePanel === "export" && (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1.5">Format</p>
                  <div className="space-y-1">
                    {FORMAT_OPTIONS.map(f => (
                      <Radio key={f.value} label={`${f.label} — ${f.desc}`} checked={exportSettings.format === f.value} onClick={() => setExportSettings(s => ({ ...s, format: f.value }))} />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1.5">Quality</p>
                  <div className="space-y-1">
                    {QUALITY_OPTIONS.map(q => (
                      <Radio key={q.value} label={`${q.label} — ${formatSize(selectedRecording.fileSize * q.mult)}`} checked={exportSettings.quality === q.value} onClick={() => setExportSettings(s => ({ ...s, quality: q.value }))} />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1.5">Include Overlays</p>
                  <div className="space-y-1">
                    <Radio label="All overlays as shown" checked={exportSettings.overlays === "all"} onClick={() => setExportSettings(s => ({ ...s, overlays: "all" }))} />
                    <Radio label="No overlays (clean recording)" checked={exportSettings.overlays === "none"} onClick={() => setExportSettings(s => ({ ...s, overlays: "none" }))} />
                    <Radio label="Custom selection" checked={exportSettings.overlays === "custom"} onClick={() => setExportSettings(s => ({ ...s, overlays: "custom" }))} />
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1.5">Include Separate Files</p>
                  <div className="space-y-0.5">
                    <Toggle label="Transcript (TXT/DOCX/PDF/SRT)" checked={exportSettings.extras.transcript} onChange={v => setExportSettings(s => ({ ...s, extras: { ...s.extras, transcript: v } }))} />
                    <Toggle label="AI analysis report (PDF)" checked={exportSettings.extras.report} onChange={v => setExportSettings(s => ({ ...s, extras: { ...s.extras, report: v } }))} />
                    <Toggle label="Audio only (MP3)" checked={exportSettings.extras.audioOnly} onChange={v => setExportSettings(s => ({ ...s, extras: { ...s.extras, audioOnly: v } }))} />
                    <Toggle label="Overlay data (JSON)" checked={exportSettings.extras.overlayData} onChange={v => setExportSettings(s => ({ ...s, extras: { ...s.extras, overlayData: v } }))} />
                    <Toggle label="Chapter markers (EDL)" checked={exportSettings.extras.chapters} onChange={v => setExportSettings(s => ({ ...s, extras: { ...s.extras, chapters: v } }))} />
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-1.5">Optimize For</p>
                  <div className="space-y-1">
                    {SOCIAL_PRESETS.map(p => (
                      <Radio key={p.value} label={p.label} checked={exportSettings.optimizeFor === p.value} onClick={() => setExportSettings(s => ({ ...s, optimizeFor: p.value }))} />
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground/40 px-1">
                  <span>Est. export time: ~8 min</span>
                  <span>Total size: {formatSize(selectedRecording.fileSize * (QUALITY_OPTIONS.find(q => q.value === exportSettings.quality)?.mult || 1))}</span>
                </div>

                <Button size="sm" className="w-full h-8 text-xs gap-1.5 rounded-lg"><Download className="h-3 w-3" /> Export Recording</Button>
              </div>
            )}
          </div>
        ) : (
          /* Grid / List */
          <div className={`p-4 ${viewMode === "grid" ? "grid grid-cols-2 gap-3" : "space-y-2"}`}>
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground/30 text-center py-8 col-span-2 font-extralight">No recordings found</p>
            ) : filtered.map(r => (
              viewMode === "grid" ? (
                <button
                  key={r.id}
                  onClick={() => { setSelectedRecording(r); setActivePanel("details"); }}
                  className="text-left p-3 rounded-xl bg-muted/10 border border-border/20 hover:border-accent/20 transition group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <Video className="h-5 w-5 text-muted-foreground/30 group-hover:text-accent/50 transition" />
                    {r.starred && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
                  </div>
                  <p className="text-xs font-medium text-foreground truncate">{r.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/40">
                    <span>{formatDuration(r.duration)}</span>
                    <span>·</span>
                    <span>{r.date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground/30">
                    <span>{formatSize(r.fileSize)}</span>
                    {r.shared && <span className="text-accent/50">Shared</span>}
                  </div>
                </button>
              ) : (
                <button
                  key={r.id}
                  onClick={() => { setSelectedRecording(r); setActivePanel("details"); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/10 border border-border/20 hover:border-accent/20 transition text-left"
                >
                  <Video className="h-4 w-4 text-muted-foreground/30 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{r.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40">
                      <span>{formatDuration(r.duration)}</span>
                      <span>·</span>
                      <span>{r.date.toLocaleDateString()}</span>
                      <span>·</span>
                      <span>{formatSize(r.fileSize)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {r.starred && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
                    {r.shared && <Share2 className="h-3 w-3 text-accent/40" />}
                  </div>
                </button>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CrossRecordingLibrary;
