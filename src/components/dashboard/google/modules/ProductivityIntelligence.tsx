import { useState, useEffect } from "react";
import {
  Clock, BarChart3, Target, Mail, Users, FolderOpen, Zap,
  Brain, AlertTriangle, CheckCircle2, RefreshCw,
} from "lucide-react";
import { useGoogleApi } from "@/hooks/useGoogleApi";

const ProductivityIntelligence = () => {
  const { fetchGoogleData, isConnected } = useGoogleApi();
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [gmailStats, setGmailStats] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [calData, emailStats] = await Promise.all([
        fetchGoogleData("calendar_events", { maxResults: 100 }),
        fetchGoogleData("gmail_stats"),
      ]);
      setEvents(calData.events || []);
      setGmailStats(emailStats);
    } catch (err) {
      console.error("Failed to fetch productivity data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) loadData();
  }, [isConnected]);

  const hasLive = events.length > 0 || gmailStats;

  // Compute meeting stats from live calendar data
  const todayEvents = events.filter((e) => {
    const d = new Date(e.start);
    return d.toDateString() === new Date().toDateString();
  });
  const meetingsWithOthers = events.filter((e) => e.attendees > 1);
  const allDayEvents = events.filter((e) => e.isAllDay);

  const stats = hasLive
    ? [
        { label: "Week Meetings", value: String(events.length), trend: "" },
        { label: "Today", value: String(todayEvents.length), trend: "" },
        { label: "With Others", value: String(meetingsWithOthers.length), trend: "" },
        { label: "Unread Emails", value: String(gmailStats?.unread || 0), trend: "" },
      ]
    : [
        { label: "Productive Hours", value: "—", trend: "" },
        { label: "Focus Time", value: "—", trend: "" },
        { label: "Email Time", value: "—", trend: "" },
        { label: "Context Switches", value: "—", trend: "" },
      ];

  // Group events by hour for timeline
  const hourCounts = new Array(12).fill(0);
  events.forEach((e) => {
    if (!e.isAllDay) {
      const h = new Date(e.start).getHours();
      if (h >= 6 && h < 18) hourCounts[h - 6]++;
    }
  });
  const maxHourCount = Math.max(...hourCounts, 1);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground/5">
            <BarChart3 className="h-6 w-6 text-foreground/70" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-extralight tracking-wide text-foreground">Productivity Intelligence</h2>
              {isConnected && (
                <button onClick={loadData} disabled={loading} className="flex items-center gap-1 rounded-lg bg-foreground/10 px-3 py-1.5 text-[10px] font-light text-foreground hover:bg-foreground/20 transition-all disabled:opacity-50">
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                  Sync
                </button>
              )}
            </div>
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
              {isConnected
                ? "Live data connected — analyzing your calendar density, meeting patterns, and email load."
                : "Connect Google to track productivity patterns and optimize your workflow."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-4 space-y-1">
            <span className="text-[10px] font-extralight text-muted-foreground">{s.label}</span>
            <span className="text-lg font-light text-foreground block">{loading ? "…" : s.value}</span>
          </div>
        ))}
      </div>

      {/* Meeting Distribution */}
      {hasLive && (
        <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 space-y-3">
          <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" /> Meeting Distribution (Live)
          </h3>
          <div className="flex gap-1 items-end h-20">
            {hourCounts.map((count, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-foreground/20 transition-all hover:bg-foreground/40"
                  style={{ height: `${(count / maxHourCount) * 100}%`, minHeight: count > 0 ? "4px" : "0" }}
                />
                <span className="text-[8px] text-muted-foreground/50">{6 + i}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] font-extralight text-muted-foreground/60">
            Meetings by hour (6am–6pm) · {meetingsWithOthers.length} meetings with others this week
          </p>
        </div>
      )}

      {/* Today's Schedule */}
      {todayEvents.length > 0 && (
        <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
          <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
            <Target className="h-4 w-4" /> Today's Schedule (Live)
          </h3>
          <div className="space-y-1.5">
            {todayEvents.map((e) => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl bg-foreground/5 px-4 py-2.5">
                <Clock className="h-3.5 w-3.5 text-foreground/50 shrink-0" />
                <span className="text-[10px] font-light text-muted-foreground w-16 shrink-0">
                  {e.isAllDay ? "All Day" : new Date(e.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-xs font-light text-foreground flex-1 truncate">{e.summary}</span>
                {e.attendees > 1 && (
                  <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                    <Users className="h-2.5 w-2.5" /> {e.attendees}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Insights */}
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 space-y-3">
        <h3 className="text-sm font-light tracking-wide text-foreground flex items-center gap-2">
          <Brain className="h-4 w-4" /> AI Productivity Insights
        </h3>
        <div className="space-y-2">
          {(hasLive
            ? [
                { type: "strength", text: `${events.length} events this week — ${meetingsWithOthers.length} are collaborative` },
                { type: "strength", text: `${allDayEvents.length} all-day events (deep work blocks or OOO)` },
                { type: gmailStats?.unread > 20 ? "warning" : "strength", text: `${gmailStats?.unread || 0} unread emails ${gmailStats?.unread > 20 ? "— inbox overload detected" : "— inbox under control"}` },
                todayEvents.length > 5
                  ? { type: "warning", text: `${todayEvents.length} events today — consider blocking focus time` }
                  : { type: "strength", text: `Light day with ${todayEvents.length} events — use for deep work` },
              ]
            : [
                { type: "strength", text: "Connect Google to detect work patterns" },
                { type: "strength", text: "AI will analyze calendar density and email load" },
                { type: "warning", text: "Productivity insights require live data" },
              ]
          ).map((ins, i) => (
            <div key={i} className="flex items-start gap-2 py-1">
              {ins.type === "strength" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <span className="text-[11px] font-extralight text-muted-foreground">{ins.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProductivityIntelligence;
