import { useState, useEffect } from "react";
import {
  MapPin, DollarSign, Plane, Briefcase, Heart,
  Stethoscope, ShoppingCart, TrendingUp,
  ChevronRight, Sparkles, RefreshCw, Zap,
  Calendar, Activity, Users, BarChart3,
  Clock, Mail, CheckCircle2, AlertTriangle,
} from "lucide-react";
import { useGoogleApi } from "@/hooks/useGoogleApi";

type TabKey = "schedule" | "health" | "social" | "trends";

const LifePredictions = () => {
  const { fetchGoogleData, isConnected } = useGoogleApi();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("schedule");
  const [calEvents, setCalEvents] = useState<any[]>([]);
  const [gmailStats, setGmailStats] = useState<any>(null);
  const [emails, setEmails] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [totalContacts, setTotalContacts] = useState(0);
  const [fitData, setFitData] = useState<any[]>([]);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cal, stats, inbox, contactData, fit, drive] = await Promise.all([
        fetchGoogleData("calendar_events", { maxResults: 50 }).catch(() => ({ events: [] })),
        fetchGoogleData("gmail_stats").catch(() => ({ unread: 0, important: 0, starred: 0 })),
        fetchGoogleData("gmail_inbox", { maxResults: 10 }).catch(() => ({ messages: [] })),
        fetchGoogleData("contacts", { pageSize: 50 }).catch(() => ({ contacts: [], totalContacts: 0 })),
        fetchGoogleData("fitness", undefined, undefined, false).catch(() => ({ dailyData: [] })),
        fetchGoogleData("drive_files", { pageSize: 10 }).catch(() => ({ files: [] })),
      ]);
      setCalEvents(cal.events || []);
      setGmailStats(stats);
      setEmails(inbox.messages || []);
      setContacts(contactData.contacts || []);
      setTotalContacts(contactData.totalContacts || 0);
      setFitData(fit.dailyData || []);
      setDriveFiles(drive.files || []);
    } catch (err) {
      console.error("Failed to fetch prediction data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected) loadData();
  }, [isConnected]);

  const hasLive = isConnected && (calEvents.length > 0 || (gmailStats?.unread ?? 0) > 0 || contacts.length > 0);

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: "schedule", label: "Schedule", icon: Calendar },
    { key: "health", label: "Health", icon: Activity },
    { key: "social", label: "Social", icon: Users },
    { key: "trends", label: "Trends", icon: BarChart3 },
  ];

  const todayEvents = calEvents.filter(e => new Date(e.start).toDateString() === new Date().toDateString());
  const tomorrowEvents = calEvents.filter(e => {
    const d = new Date(e.start);
    const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
    return d.toDateString() === tmr.toDateString();
  });

  const avgSteps = fitData.length > 0
    ? Math.round(fitData.reduce((a: number, d: any) => a + d.steps, 0) / fitData.length)
    : 0;
  const avgCalories = fitData.length > 0
    ? Math.round(fitData.reduce((a: number, d: any) => a + d.calories, 0) / fitData.length)
    : 0;
  const avgHR = fitData.length > 0
    ? Math.round(fitData.filter((d: any) => d.heartRate > 0).reduce((a: number, d: any) => a + d.heartRate, 0) / Math.max(fitData.filter((d: any) => d.heartRate > 0).length, 1))
    : 0;

  const renderTab = () => {
    if (!hasLive) {
      return (
        <div className="rounded-2xl border border-dashed border-border/30 bg-card/10 p-10 text-center space-y-3">
          <Sparkles className="h-10 w-10 text-muted-foreground/20 mx-auto" />
          <p className="text-sm font-extralight text-muted-foreground/50">
            {isConnected ? "No data available yet — sync to populate predictions." : "Connect Google to enable predictive intelligence."}
          </p>
        </div>
      );
    }

    if (activeTab === "schedule") {
      return (
        <div className="space-y-4">
          {/* Today */}
          <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
            <h4 className="text-xs font-light text-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" /> Today — {todayEvents.length} event{todayEvents.length !== 1 ? "s" : ""}
            </h4>
            {todayEvents.length > 0 ? (
              <div className="space-y-1.5">
                {todayEvents.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-foreground/5 px-4 py-2.5">
                    <span className="text-[10px] font-light text-muted-foreground w-16 shrink-0">
                      {e.isAllDay ? "All Day" : new Date(e.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-xs font-light text-foreground flex-1 truncate">{e.summary}</span>
                    {e.attendees > 1 && <span className="text-[10px] text-muted-foreground/50">{e.attendees} ppl</span>}
                  </div>
                ))}
              </div>
            ) : <p className="text-[10px] text-muted-foreground/50">No events today — open for deep work</p>}
          </div>
          {/* Tomorrow */}
          <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
            <h4 className="text-xs font-light text-foreground flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5" /> Tomorrow — {tomorrowEvents.length} event{tomorrowEvents.length !== 1 ? "s" : ""}
            </h4>
            {tomorrowEvents.length > 0 ? (
              <div className="space-y-1.5">
                {tomorrowEvents.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-foreground/5 px-4 py-2.5">
                    <span className="text-[10px] font-light text-muted-foreground w-16 shrink-0">
                      {e.isAllDay ? "All Day" : new Date(e.start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-xs font-light text-foreground flex-1 truncate">{e.summary}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-[10px] text-muted-foreground/50">No events tomorrow</p>}
          </div>
          {/* Email load */}
          <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
            <h4 className="text-xs font-light text-foreground flex items-center gap-2">
              <Mail className="h-3.5 w-3.5" /> Email Activity
            </h4>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Unread", value: gmailStats?.unread || 0 },
                { label: "Important", value: gmailStats?.important || 0 },
                { label: "Starred", value: gmailStats?.starred || 0 },
              ].map(s => (
                <div key={s.label} className="rounded-xl bg-foreground/5 p-3 text-center">
                  <p className="text-lg font-light text-foreground">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground/50">{s.label}</p>
                </div>
              ))}
            </div>
            {emails.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {emails.slice(0, 5).map((m, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl bg-foreground/5 px-3 py-2">
                    <Mail className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                    <span className="text-[10px] font-light text-foreground truncate flex-1">{m.subject || "(no subject)"}</span>
                    <span className="text-[9px] text-muted-foreground/40 shrink-0">{m.from?.split("<")[0]?.trim()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Schedule prediction */}
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-foreground/50" />
              <span className="text-[11px] font-light text-foreground">Schedule Prediction</span>
            </div>
            <p className="text-[10px] font-extralight text-muted-foreground/70">
              {todayEvents.length > 5
                ? `Heavy day with ${todayEvents.length} events — expect context-switching fatigue. Block recovery time.`
                : todayEvents.length > 0
                ? `Moderate schedule with ${todayEvents.length} events — good balance of meetings and focus time.`
                : `Clear schedule today — ideal for deep work. ${tomorrowEvents.length > 3 ? "Tomorrow is busier, front-load priorities." : ""}`}
            </p>
          </div>
        </div>
      );
    }

    if (activeTab === "health") {
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Avg Steps/Day", value: avgSteps > 0 ? avgSteps.toLocaleString() : "—" },
              { label: "Avg Calories", value: avgCalories > 0 ? avgCalories.toLocaleString() : "—" },
              { label: "Avg Heart Rate", value: avgHR > 0 ? `${avgHR} bpm` : "—" },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
                <p className="text-lg font-light text-foreground">{loading ? "…" : s.value}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          {fitData.length > 0 ? (
            <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
              <h4 className="text-xs font-light text-foreground flex items-center gap-2">
                <Activity className="h-3.5 w-3.5" /> 7-Day Activity (Live)
              </h4>
              <div className="space-y-1.5">
                {fitData.map((d: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-foreground/5 px-4 py-2.5">
                    <span className="text-[10px] font-light text-muted-foreground w-20 shrink-0">{d.date}</span>
                    <div className="flex-1 flex items-center gap-4">
                      <span className="text-[10px] text-foreground">{d.steps.toLocaleString()} steps</span>
                      <span className="text-[10px] text-muted-foreground/60">{d.calories} cal</span>
                      {d.heartRate > 0 && <span className="text-[10px] text-muted-foreground/40">{d.heartRate} bpm</span>}
                    </div>
                    <div className="w-20 h-1.5 bg-foreground/10 rounded-full overflow-hidden">
                      <div className="h-full bg-foreground/30 rounded-full" style={{ width: `${Math.min((d.steps / 10000) * 100, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/30 bg-card/10 p-8 text-center">
              <Stethoscope className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-[11px] text-muted-foreground/50">No fitness data available — connect Google Fit to track health metrics.</p>
            </div>
          )}
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-foreground/50" />
              <span className="text-[11px] font-light text-foreground">Health Prediction</span>
            </div>
            <p className="text-[10px] font-extralight text-muted-foreground/70">
              {avgSteps > 8000 ? "Activity levels above target — maintaining good habits." :
               avgSteps > 5000 ? "Moderate activity — consider adding a walk to boost energy." :
               avgSteps > 0 ? "Below target activity — schedule movement breaks between meetings." :
               "Connect fitness data for personalized health predictions."}
            </p>
          </div>
        </div>
      );
    }

    if (activeTab === "social") {
      const recentSenders = new Set(emails.map((m: any) => (m.from || "").toLowerCase()));
      const activeContacts = contacts.filter(c => c.email && [...recentSenders].some(s => s.includes(c.email.toLowerCase())));
      const inactiveContacts = contacts.filter(c => c.email && !activeContacts.includes(c));

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Contacts", value: totalContacts },
              { label: "Recently Active", value: activeContacts.length },
              { label: "Fading", value: inactiveContacts.length },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
                <p className="text-lg font-light text-foreground">{loading ? "…" : s.value}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          {activeContacts.length > 0 && (
            <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
              <h4 className="text-xs font-light text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Active Contacts
              </h4>
              <div className="space-y-1.5">
                {activeContacts.slice(0, 8).map((c, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-foreground/5 px-3 py-2">
                    <div className="h-6 w-6 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-light text-foreground overflow-hidden shrink-0">
                      {c.photo ? <img src={c.photo} className="h-full w-full object-cover rounded-full" referrerPolicy="no-referrer" /> : c.name?.charAt(0)}
                    </div>
                    <span className="text-[11px] font-light text-foreground flex-1 truncate">{c.name}</span>
                    {c.organization && <span className="text-[9px] text-muted-foreground/40">{c.organization}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {inactiveContacts.length > 0 && (
            <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
              <h4 className="text-xs font-light text-foreground flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Fading Relationships
              </h4>
              <div className="space-y-1.5">
                {inactiveContacts.slice(0, 8).map((c, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-foreground/5 px-3 py-2">
                    <div className="h-6 w-6 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-light text-foreground overflow-hidden shrink-0">
                      {c.photo ? <img src={c.photo} className="h-full w-full object-cover rounded-full" referrerPolicy="no-referrer" /> : c.name?.charAt(0)}
                    </div>
                    <span className="text-[11px] font-light text-foreground flex-1 truncate">{c.name}</span>
                    <span className="text-[9px] text-muted-foreground/40">No recent activity</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-foreground/50" />
              <span className="text-[11px] font-light text-foreground">Social Prediction</span>
            </div>
            <p className="text-[10px] font-extralight text-muted-foreground/70">
              {inactiveContacts.length > 5 ? `${inactiveContacts.length} contacts fading — consider reaching out to maintain key relationships.` :
               activeContacts.length > 0 ? `Strong engagement with ${activeContacts.length} contacts in your inbox recently.` :
               "Analyzing contact interaction patterns..."}
            </p>
          </div>
        </div>
      );
    }

    if (activeTab === "trends") {
      const meetingsByDay: Record<string, number> = {};
      calEvents.forEach(e => {
        const day = new Date(e.start).toLocaleDateString("en", { weekday: "short" });
        meetingsByDay[day] = (meetingsByDay[day] || 0) + 1;
      });
      const busiestDay = Object.entries(meetingsByDay).sort((a, b) => b[1] - a[1])[0];

      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Week Events", value: calEvents.length },
              { label: "Unread Emails", value: gmailStats?.unread || 0 },
              { label: "Drive Files", value: driveFiles.length },
              { label: "Contacts", value: totalContacts },
            ].map(s => (
              <div key={s.label} className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-4 text-center">
                <p className="text-lg font-light text-foreground">{loading ? "…" : s.value}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          {/* Meeting density by day */}
          {Object.keys(meetingsByDay).length > 0 && (
            <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
              <h4 className="text-xs font-light text-foreground flex items-center gap-2">
                <BarChart3 className="h-3.5 w-3.5" /> Meeting Density by Day
              </h4>
              <div className="flex gap-2 items-end h-16">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day => {
                  const count = meetingsByDay[day] || 0;
                  const max = Math.max(...Object.values(meetingsByDay), 1);
                  return (
                    <div key={day} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t bg-foreground/20 hover:bg-foreground/40 transition-colors" style={{ height: `${(count / max) * 100}%`, minHeight: count > 0 ? "4px" : "0" }} />
                      <span className="text-[8px] text-muted-foreground/50">{day}</span>
                    </div>
                  );
                })}
              </div>
              {busiestDay && <p className="text-[9px] text-muted-foreground/40">Busiest: {busiestDay[0]} ({busiestDay[1]} events)</p>}
            </div>
          )}
          {/* Recent Drive */}
          {driveFiles.length > 0 && (
            <div className="rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-5 space-y-3">
              <h4 className="text-xs font-light text-foreground flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5" /> Recent Files
              </h4>
              <div className="space-y-1.5">
                {driveFiles.slice(0, 5).map((f: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl bg-foreground/5 px-3 py-2">
                    <span className="text-[11px] font-light text-foreground flex-1 truncate">{f.name}</span>
                    <span className="text-[9px] text-muted-foreground/40">{new Date(f.modifiedTime).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-foreground/50" />
              <span className="text-[11px] font-light text-foreground">Trend Prediction</span>
            </div>
            <p className="text-[10px] font-extralight text-muted-foreground/70">
              {calEvents.length > 20 ? "High activity week — workload trending above average." :
               calEvents.length > 10 ? "Moderate week — balanced between meetings and individual work." :
               "Light week detected — good opportunity for strategic planning and catch-up."}
            </p>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-foreground/5">
          <Sparkles className="h-6 w-6 text-foreground/70" />
        </div>
        <div className="space-y-1 flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-light tracking-wide text-foreground">Predictive Intelligence Engine</h3>
            {isConnected && (
              <button onClick={loadData} disabled={loading} className="flex items-center gap-1 rounded-lg bg-foreground/10 px-3 py-1.5 text-[10px] font-light text-foreground hover:bg-foreground/20 transition-all disabled:opacity-50">
                <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                Sync
              </button>
            )}
          </div>
          <p className="text-[10px] font-extralight text-muted-foreground">
            {hasLive ? "Cross-referencing live data from all connected services." : "Connect Google to enable predictive intelligence."}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-card/20 border border-border/20 p-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-light transition-all ${
              activeTab === t.key
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground/50 hover:text-foreground/70 hover:bg-foreground/5"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {renderTab()}
    </div>
  );
};

export default LifePredictions;
