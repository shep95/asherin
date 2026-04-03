import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  History, Search, Clock, Zap, BarChart3, Trash2, Star, Play, X,
  ChevronDown, Filter, Calendar, Tag, Monitor, Activity, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MODE_CONFIG, AnalysisMode } from "./types";
import { format, formatDistanceToNow } from "date-fns";

export interface CrossSession {
  id: string;
  title: string;
  mode: string;
  status: string;
  duration: number;
  frames_analyzed: number;
  frames_skipped: number;
  alerts_fired: number;
  credits_used: number;
  ai_summary: string | null;
  tags: string[];
  settings: Record<string, unknown>;
  recording_url: string | null;
  transcript: string | null;
  psych_profiles: unknown[];
  created_at: string;
  updated_at: string;
}

interface Props {
  onClose: () => void;
  onLoadSession?: (session: CrossSession) => void;
}

const CrossSessionHistory: React.FC<Props> = ({ onClose, onLoadSession }) => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<CrossSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<CrossSession | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const loadSessions = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("cross_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) { console.error("Failed to load sessions:", error); return; }
      setSessions((data as CrossSession[]) || []);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const deleteSession = async (id: string) => {
    await supabase.from("cross_sessions").delete().eq("id", id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (selectedSession?.id === id) setSelectedSession(null);
  };

  const filtered = sessions.filter(s => {
    if (filterMode !== "all" && s.mode !== filterMode) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return s.title.toLowerCase().includes(q) ||
        s.ai_summary?.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q));
    }
    return true;
  });

  const formatDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getModeColor = (mode: string) => MODE_CONFIG[mode as AnalysisMode]?.color || "text-muted-foreground";
  const getModeLabel = (mode: string) => MODE_CONFIG[mode as AnalysisMode]?.label || mode;

  const totalCredits = sessions.reduce((a, s) => a + Number(s.credits_used), 0);
  const totalDuration = sessions.reduce((a, s) => a + s.duration, 0);
  const totalAlerts = sessions.reduce((a, s) => a + s.alerts_fired, 0);

  return (
    <div className="w-96 border-l border-border/20 flex flex-col bg-background h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <History className="h-4 w-4 text-accent" /> Session History
        </h3>
        <button onClick={onClose}><X className="h-4 w-4 text-muted-foreground hover:text-foreground transition" /></button>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-3 gap-px bg-border/10 border-b border-border/10">
        {[
          { label: "Sessions", value: sessions.length, icon: Monitor },
          { label: "Total Time", value: formatDuration(totalDuration), icon: Clock },
          { label: "Alerts", value: totalAlerts, icon: Zap },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="bg-background px-3 py-2 text-center">
            <Icon className="h-3 w-3 mx-auto mb-0.5 text-muted-foreground/40" />
            <p className="text-xs font-medium text-foreground">{value}</p>
            <p className="text-[9px] text-muted-foreground/50">{label}</p>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="px-3 py-2 border-b border-border/10 space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search sessions..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/10 border border-border/20 rounded-lg text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-accent/30"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground px-2 py-1 rounded-md bg-muted/5 transition"
          >
            <Filter className="h-3 w-3" /> Filters <ChevronDown className={`h-2.5 w-2.5 transition ${showFilters ? "rotate-180" : ""}`} />
          </button>
          {filterMode !== "all" && (
            <span className="text-[9px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-md flex items-center gap-1">
              {getModeLabel(filterMode)} <button onClick={() => setFilterMode("all")}><X className="h-2.5 w-2.5" /></button>
            </span>
          )}
          {filterStatus !== "all" && (
            <span className="text-[9px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-md flex items-center gap-1">
              {filterStatus} <button onClick={() => setFilterStatus("all")}><X className="h-2.5 w-2.5" /></button>
            </span>
          )}
        </div>

        {showFilters && (
          <div className="space-y-2 bg-muted/5 rounded-lg p-2 border border-border/10">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">Mode</p>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setFilterMode("all")} className={`text-[10px] px-2 py-0.5 rounded-md transition ${filterMode === "all" ? "bg-accent/20 text-accent" : "bg-muted/10 text-muted-foreground/50 hover:text-foreground"}`}>All</button>
                {Object.entries(MODE_CONFIG).slice(0, 8).map(([key, cfg]) => (
                  <button key={key} onClick={() => setFilterMode(key)} className={`text-[10px] px-2 py-0.5 rounded-md transition ${filterMode === key ? "bg-accent/20 text-accent" : "bg-muted/10 text-muted-foreground/50 hover:text-foreground"}`}>{cfg.label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">Status</p>
              <div className="flex gap-1">
                {["all", "completed", "active", "archived"].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)} className={`text-[10px] px-2 py-0.5 rounded-md capitalize transition ${filterStatus === s ? "bg-accent/20 text-accent" : "bg-muted/10 text-muted-foreground/50 hover:text-foreground"}`}>{s}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <History className="h-8 w-8 text-muted-foreground/20 mx-auto" />
            <p className="text-xs text-muted-foreground/40 font-extralight">
              {sessions.length === 0 ? "No sessions yet" : "No matching sessions"}
            </p>
            <p className="text-[10px] text-muted-foreground/30">Start a screen analysis to create a session</p>
          </div>
        ) : (
          filtered.map(session => (
            <div
              key={session.id}
              onClick={() => setSelectedSession(selectedSession?.id === session.id ? null : session)}
              className={`px-4 py-3 border-b border-border/10 cursor-pointer hover:bg-muted/5 transition ${selectedSession?.id === session.id ? "bg-accent/5 border-l-2 border-l-accent" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-medium ${getModeColor(session.mode)}`}>{getModeLabel(session.mode)}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${
                      session.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                      session.status === "active" ? "bg-blue-500/10 text-blue-400" :
                      "bg-muted-foreground/10 text-muted-foreground/50"
                    }`}>{session.status}</span>
                  </div>
                  <p className="text-xs font-medium text-foreground truncate">{session.title}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground/50">
                    <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {formatDuration(session.duration)}</span>
                    <span className="flex items-center gap-0.5"><Activity className="h-2.5 w-2.5" /> {session.frames_analyzed} frames</span>
                    <span className="flex items-center gap-0.5"><Zap className="h-2.5 w-2.5" /> {session.alerts_fired}</span>
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground/30 whitespace-nowrap">
                  {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                </p>
              </div>

              {/* Expanded Details */}
              {selectedSession?.id === session.id && (
                <div className="mt-3 pt-3 border-t border-border/10 space-y-3">
                  {session.ai_summary && (
                    <div className="bg-muted/5 rounded-lg p-2.5">
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground/40 mb-1">AI Summary</p>
                      <p className="text-[11px] text-muted-foreground/70 leading-relaxed">{session.ai_summary}</p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/5 rounded-lg p-2 text-center">
                      <p className="text-xs font-medium text-foreground">{session.frames_analyzed}</p>
                      <p className="text-[9px] text-muted-foreground/40">Frames Analyzed</p>
                    </div>
                    <div className="bg-muted/5 rounded-lg p-2 text-center">
                      <p className="text-xs font-medium text-foreground">{session.frames_skipped}</p>
                      <p className="text-[9px] text-muted-foreground/40">Frames Skipped</p>
                    </div>
                    <div className="bg-muted/5 rounded-lg p-2 text-center">
                      <p className="text-xs font-medium text-foreground">{Number(session.credits_used).toFixed(2)}</p>
                      <p className="text-[9px] text-muted-foreground/40">Credits Used</p>
                    </div>
                    <div className="bg-muted/5 rounded-lg p-2 text-center">
                      <p className="text-xs font-medium text-foreground">{session.alerts_fired}</p>
                      <p className="text-[9px] text-muted-foreground/40">Alerts Fired</p>
                    </div>
                  </div>

                  {session.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {session.tags.map((tag, i) => (
                        <span key={i} className="text-[9px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                          <Tag className="h-2 w-2" /> {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5">
                    {onLoadSession && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px] gap-1 flex-1"
                        onClick={e => { e.stopPropagation(); onLoadSession(session); }}
                      >
                        <Eye className="h-3 w-3" /> View Details
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={e => { e.stopPropagation(); deleteSession(session.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  <p className="text-[9px] text-muted-foreground/30">
                    Started {format(new Date(session.created_at), "MMM d, yyyy h:mm a")}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border/10 bg-muted/5">
        <div className="flex items-center justify-between text-[9px] text-muted-foreground/40">
          <span>{filtered.length} session{filtered.length !== 1 ? "s" : ""}</span>
          <span>~{totalCredits.toFixed(1)} credits total</span>
        </div>
      </div>
    </div>
  );
};

export default CrossSessionHistory;
