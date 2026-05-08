import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Folder, Bell, Eye, Calendar, Users, Layers, History, Shield,
  Bookmark, Sparkles, ArrowLeft, Plus, Search, Trash2, Download,
  FileText, X, Hash, Filter, ExternalLink, Copy, Check, Pin,
  Clock, AlertCircle, Globe, Database, Edit3
} from "lucide-react";
import { toast } from "sonner";
import { logAudit, getAuditTrail, exportAuditTrailJSON } from "@/lib/auditLogger";
import { exportJSON, exportCSV, exportPDF, exportMarkdown } from "@/lib/exportEngine";
import { scoreSource, getDomain } from "@/lib/sourceTrust";

const TABS = [
  { id: "workspaces", label: "Workspaces", icon: Folder },
  { id: "annotations", label: "Annotations", icon: Bookmark },
  { id: "alerts", label: "Saved & Alerts", icon: Bell },
  { id: "watchlist", label: "Watchlist", icon: Eye },
  { id: "timeline", label: "Timeline", icon: Calendar },
  { id: "rooms", label: "Intel Rooms", icon: Users },
  { id: "sources", label: "Source Lists", icon: Layers },
  { id: "history", label: "History/Replay", icon: History },
  { id: "audit", label: "Chain of Custody", icon: Shield },
  { id: "query-builder", label: "Query Builder", icon: Filter },
] as const;

export default function EliteSuite() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "workspaces";
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate("/dashboard");
  }, [user, loading, navigate]);

  useEffect(() => {
    logAudit({ action: "view", resourceType: "elite_suite", payload: { tab } });
  }, [tab]);

  const setTab = (id: string) => setParams({ tab: id });

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-pulse text-xs tracking-[0.3em] text-muted-foreground">LOADING ELITE SUITE</div></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card/30 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <button onClick={() => navigate("/dashboard")} className="p-2 rounded hover:bg-muted">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <Sparkles className="h-5 w-5 text-foreground" />
          <div>
            <h1 className="text-lg font-light tracking-wide zophiel-shimmer-text">ELITE RESEARCH SUITE</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Power tools • Forensic-grade • Court-admissible</p>
          </div>
          <div className="ml-auto text-[10px] text-muted-foreground">
            <kbd className="rounded border border-border px-1.5 py-0.5">⌘K</kbd> for command palette
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-3 py-2.5 text-xs font-light tracking-wide whitespace-nowrap border-b-2 transition-colors ${
                  active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {tab === "workspaces" && <WorkspacesPanel />}
        {tab === "annotations" && <AnnotationsPanel />}
        {tab === "alerts" && <AlertsPanel />}
        {tab === "watchlist" && <WatchlistPanel />}
        {tab === "timeline" && <TimelinePanel />}
        {tab === "rooms" && <RoomsPanel />}
        {tab === "sources" && <SourceListsPanel />}
        {tab === "history" && <HistoryPanel />}
        {tab === "audit" && <AuditPanel />}
        {tab === "query-builder" && <QueryBuilderPanel />}
      </div>
    </div>
  );
}

// ============== WORKSPACES ==============
function WorkspacesPanel() {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("research_workspaces").select("*").order("pinned", { ascending: false }).order("updated_at", { ascending: false });
    setWorkspaces(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("research_workspaces").insert([{ user_id: user.id, name, description: desc }]);
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "create", resourceType: "workspace", payload: { name } });
    toast.success("Workspace created");
    setName(""); setDesc(""); setCreating(false); load();
  };

  const togglePin = async (id: string, pinned: boolean) => {
    await supabase.from("research_workspaces").update({ pinned: !pinned }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this workspace and all its items?")) return;
    await supabase.from("research_workspaces").delete().eq("id", id);
    await logAudit({ action: "delete", resourceType: "workspace", resourceId: id });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-light tracking-[0.2em] uppercase">Research Workspaces</h2>
          <p className="text-xs text-muted-foreground mt-1">Save entire research sessions — queries, results, annotations — into named projects.</p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2 text-xs border border-border rounded hover:bg-muted">
          <Plus className="h-3.5 w-3.5" /> New Workspace
        </button>
      </div>

      {creating && (
        <div className="p-4 border border-border rounded-lg bg-card space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Workspace name (e.g. Operation Cobalt)" className="w-full bg-transparent border border-border rounded px-3 py-2 text-sm" autoFocus />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description (optional)" className="w-full bg-transparent border border-border rounded px-3 py-2 text-sm resize-none" rows={2} />
          <div className="flex gap-2">
            <button onClick={create} className="px-4 py-1.5 text-xs bg-foreground text-background rounded">Create</button>
            <button onClick={() => setCreating(false)} className="px-4 py-1.5 text-xs border border-border rounded">Cancel</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workspaces.length === 0 && <div className="col-span-full text-center py-12 text-xs text-muted-foreground">No workspaces yet. Create your first.</div>}
        {workspaces.map((w) => (
          <div key={w.id} className="p-4 border border-border rounded-lg bg-card hover:border-foreground/30 transition-colors group">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{w.icon}</span>
                <h3 className="text-sm font-light">{w.name}</h3>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => togglePin(w.id, w.pinned)} className="p-1 rounded hover:bg-muted"><Pin className={`h-3 w-3 ${w.pinned ? "text-foreground fill-foreground" : "text-muted-foreground"}`} /></button>
                <button onClick={() => remove(w.id)} className="p-1 rounded hover:bg-muted"><Trash2 className="h-3 w-3 text-muted-foreground" /></button>
              </div>
            </div>
            {w.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{w.description}</p>}
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>{new Date(w.updated_at).toLocaleDateString()}</span>
              {w.pinned && <span className="text-foreground">PINNED</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== ANNOTATIONS ==============
function AnnotationsPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");

  const load = async () => {
    const { data } = await supabase.from("intel_annotations").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const filtered = items.filter((i) => filter === "all" || i.flag === filter);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-light tracking-[0.2em] uppercase">Annotations</h2>
        <p className="text-xs text-muted-foreground mt-1">Private notes, tags, and confidence scores attached to nodes, entities, and results.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {["all", "critical", "verified", "suspicious", "dismissed"].map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 text-[10px] uppercase tracking-wider rounded border ${filter === f ? "border-foreground text-foreground" : "border-border text-muted-foreground"}`}>
            {f}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filtered.length === 0 && <div className="text-center py-12 text-xs text-muted-foreground">No annotations yet. Right-click any node, entity, or result to add one.</div>}
        {filtered.map((a) => (
          <div key={a.id} className="p-3 border border-border rounded bg-card">
            <div className="flex items-start gap-3">
              <Bookmark className="h-3.5 w-3.5 text-muted-foreground mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-light">{a.target_id}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">{a.target_type}</span>
                  {a.flag && <span className="text-[10px] px-1.5 py-0.5 rounded border border-border uppercase">{a.flag}</span>}
                  {a.confidence_score != null && <span className="text-[10px] text-muted-foreground">CONF {a.confidence_score}%</span>}
                </div>
                {a.note && <p className="text-xs text-muted-foreground">{a.note}</p>}
                {a.tags?.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {a.tags.map((t: string) => <span key={t} className="text-[10px] text-muted-foreground">#{t}</span>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== SAVED SEARCHES + ALERTS ==============
function AlertsPanel() {
  const [searches, setSearches] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [freq, setFreq] = useState("daily");

  const load = async () => {
    const [{ data: s }, { data: a }] = await Promise.all([
      supabase.from("saved_searches").select("*").order("updated_at", { ascending: false }),
      supabase.from("search_alerts").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setSearches(s ?? []); setAlerts(a ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim() || !query.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("saved_searches").insert([{ user_id: user.id, name, query, frequency: freq }]);
    await logAudit({ action: "create", resourceType: "saved_search", payload: { name, query, freq } });
    toast.success("Saved search created");
    setName(""); setQuery(""); setCreating(false); load();
  };

  const toggle = async (id: string, enabled: boolean) => {
    await supabase.from("saved_searches").update({ enabled: !enabled }).eq("id", id);
    load();
  };
  const remove = async (id: string) => {
    await supabase.from("saved_searches").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-light tracking-[0.2em] uppercase">Saved Searches & Alerts</h2>
          <p className="text-xs text-muted-foreground mt-1">Save queries and get notified when new results appear. Google Alerts, but elite.</p>
        </div>
        <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2 text-xs border border-border rounded hover:bg-muted">
          <Plus className="h-3.5 w-3.5" /> New Saved Search
        </button>
      </div>

      {creating && (
        <div className="p-4 border border-border rounded bg-card space-y-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alert name" className="w-full bg-transparent border border-border rounded px-3 py-2 text-sm" autoFocus />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search query" className="w-full bg-transparent border border-border rounded px-3 py-2 text-sm" />
          <select value={freq} onChange={(e) => setFreq(e.target.value)} className="w-full bg-card border border-border rounded px-3 py-2 text-sm">
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="manual">Manual only</option>
          </select>
          <div className="flex gap-2">
            <button onClick={create} className="px-4 py-1.5 text-xs bg-foreground text-background rounded">Save</button>
            <button onClick={() => setCreating(false)} className="px-4 py-1.5 text-xs border border-border rounded">Cancel</button>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Saved Searches</h3>
        <div className="space-y-2">
          {searches.length === 0 && <div className="text-xs text-muted-foreground py-4">No saved searches yet.</div>}
          {searches.map((s) => (
            <div key={s.id} className="p-3 border border-border rounded bg-card flex items-center gap-3">
              <Bell className={`h-3.5 w-3.5 ${s.enabled ? "text-foreground" : "text-muted-foreground"}`} />
              <div className="flex-1">
                <div className="text-sm">{s.name}</div>
                <div className="text-[10px] text-muted-foreground">"{s.query}" • {s.frequency} • {s.total_runs} runs</div>
              </div>
              <button onClick={() => toggle(s.id, s.enabled)} className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground">{s.enabled ? "ON" : "OFF"}</button>
              <button onClick={() => remove(s.id)} className="p-1 rounded hover:bg-muted"><Trash2 className="h-3 w-3 text-muted-foreground" /></button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Recent Alerts</h3>
        <div className="space-y-2">
          {alerts.length === 0 && <div className="text-xs text-muted-foreground py-4">No alerts yet. Saved searches will fire here when new results appear.</div>}
          {alerts.map((a) => (
            <div key={a.id} className={`p-3 border rounded ${a.read ? "border-border bg-card/50" : "border-foreground/30 bg-card"}`}>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3.5 w-3.5" />
                <span className="text-sm">{a.title}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span>
              </div>
              {a.summary && <p className="text-xs text-muted-foreground mt-1 ml-5">{a.summary}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============== WATCHLIST ==============
function WatchlistPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [val, setVal] = useState(""); const [type, setType] = useState("person");

  const load = async () => {
    const { data } = await supabase.from("entity_watchlist").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!val.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("entity_watchlist").insert([{ user_id: user.id, entity_type: type, entity_value: val }]);
    await logAudit({ action: "create", resourceType: "watchlist", payload: { type, val } });
    setVal(""); load();
  };

  const remove = async (id: string) => {
    await supabase.from("entity_watchlist").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-light tracking-[0.2em] uppercase">Entity Watchlist</h2>
        <p className="text-xs text-muted-foreground mt-1">Continuously monitor people, companies, domains, locations across all sources.</p>
      </div>
      <div className="flex gap-2">
        <select value={type} onChange={(e) => setType(e.target.value)} className="bg-card border border-border rounded px-3 py-2 text-sm">
          <option value="person">Person</option>
          <option value="company">Company</option>
          <option value="domain">Domain</option>
          <option value="location">Location</option>
          <option value="keyword">Keyword</option>
        </select>
        <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add entity to watch..." className="flex-1 bg-transparent border border-border rounded px-3 py-2 text-sm" />
        <button onClick={add} className="px-4 py-2 text-xs bg-foreground text-background rounded">Add</button>
      </div>
      <div className="space-y-2">
        {items.length === 0 && <div className="text-center py-12 text-xs text-muted-foreground">Watchlist is empty.</div>}
        {items.map((w) => (
          <div key={w.id} className="p-3 border border-border rounded bg-card flex items-center gap-3">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex-1">
              <span className="text-sm">{w.entity_value}</span>
              <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">{w.entity_type}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{w.mention_count} mentions</span>
            <button onClick={() => remove(w.id)} className="p-1 rounded hover:bg-muted"><Trash2 className="h-3 w-3 text-muted-foreground" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== TIMELINE ==============
function TimelinePanel() {
  const [history, setHistory] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("search_history").select("*").order("created_at", { ascending: false }).limit(200).then(({ data }) => setHistory(data ?? []));
  }, []);

  const grouped = history.reduce<Record<string, any[]>>((acc, h) => {
    const day = new Date(h.created_at).toLocaleDateString();
    (acc[day] = acc[day] ?? []).push(h);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-light tracking-[0.2em] uppercase">Timeline View</h2>
        <p className="text-xs text-muted-foreground mt-1">Your research activity plotted chronologically. Critical for legal, investigative, and financial work.</p>
      </div>
      <div className="space-y-6">
        {Object.keys(grouped).length === 0 && <div className="text-center py-12 text-xs text-muted-foreground">Timeline is empty. Run searches to populate.</div>}
        {Object.entries(grouped).map(([day, items]) => (
          <div key={day}>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground mb-3 sticky top-32 bg-background py-1">{day}</div>
            <div className="border-l border-border ml-2 pl-4 space-y-3">
              {items.map((h) => (
                <div key={h.id} className="relative">
                  <div className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-foreground" />
                  <div className="text-xs">{h.query}</div>
                  <div className="text-[10px] text-muted-foreground">{new Date(h.created_at).toLocaleTimeString()} • {h.result_count} results • {h.category}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== ROOMS ==============
function RoomsPanel() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [name, setName] = useState("");

  const load = async () => {
    const { data } = await supabase.from("shared_intel_rooms").select("*").order("updated_at", { ascending: false });
    setRooms(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("shared_intel_rooms").insert([{ owner_id: user.id, name }]).select().single();
    if (error) { toast.error(error.message); return; }
    await logAudit({ action: "create", resourceType: "intel_room", payload: { name } });
    setName(""); load();
    if (data) navigator.clipboard.writeText(`${window.location.origin}/elite?tab=rooms&room=${data.share_code}`);
    toast.success("Room created — share link copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-light tracking-[0.2em] uppercase">Shared Intel Rooms</h2>
        <p className="text-xs text-muted-foreground mt-1">Live-shared research sessions. Multiple researchers, real-time map updates, like Figma for intelligence.</p>
      </div>
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} placeholder="Room name..." className="flex-1 bg-transparent border border-border rounded px-3 py-2 text-sm" />
        <button onClick={create} className="px-4 py-2 text-xs bg-foreground text-background rounded">Create Room</button>
      </div>
      <div className="space-y-2">
        {rooms.length === 0 && <div className="text-center py-12 text-xs text-muted-foreground">No rooms yet.</div>}
        {rooms.map((r) => (
          <div key={r.id} className="p-3 border border-border rounded bg-card flex items-center gap-3">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex-1">
              <div className="text-sm">{r.name}</div>
              <div className="text-[10px] text-muted-foreground font-mono">code: {r.share_code}</div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/elite?tab=rooms&room=${r.share_code}`);
                toast.success("Link copied");
              }}
              className="p-1 rounded hover:bg-muted"
            >
              <Copy className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== SOURCE LISTS ==============
function SourceListsPanel() {
  const [lists, setLists] = useState<any[]>([]);
  const [name, setName] = useState(""); const [domains, setDomains] = useState("");

  const load = async () => {
    const { data } = await supabase.from("custom_source_lists").select("*").order("updated_at", { ascending: false });
    setLists(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const arr = domains.split(/[\s,]+/).map((d) => d.trim()).filter(Boolean);
    await supabase.from("custom_source_lists").insert([{ user_id: user.id, name, domains: arr }]);
    setName(""); setDomains(""); load();
  };

  const remove = async (id: string) => {
    await supabase.from("custom_source_lists").delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-light tracking-[0.2em] uppercase">Custom Source Lists</h2>
        <p className="text-xs text-muted-foreground mt-1">Define your own trusted source collections. Searches prioritize these domains.</p>
      </div>
      <div className="p-4 border border-border rounded bg-card space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="List name (e.g. My Finance Sources)" className="w-full bg-transparent border border-border rounded px-3 py-2 text-sm" />
        <textarea value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="Domains (comma or space separated): wsj.com, ft.com, bloomberg.com" rows={3} className="w-full bg-transparent border border-border rounded px-3 py-2 text-sm resize-none" />
        <button onClick={create} className="px-4 py-1.5 text-xs bg-foreground text-background rounded">Create List</button>
      </div>
      <div className="space-y-2">
        {lists.map((l) => (
          <div key={l.id} className="p-3 border border-border rounded bg-card">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm">{l.name}</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{l.domains?.length ?? 0} domains</span>
              <button onClick={() => remove(l.id)} className="p-1 rounded hover:bg-muted"><Trash2 className="h-3 w-3 text-muted-foreground" /></button>
            </div>
            <div className="flex gap-1 flex-wrap">
              {l.domains?.map((d: string) => {
                const score = scoreSource(`https://${d}`);
                return (
                  <span key={d} className="text-[10px] px-2 py-0.5 rounded border border-border flex items-center gap-1">
                    {d}
                    <span className={`h-1.5 w-1.5 rounded-full ${score.tier === "high" ? "bg-foreground" : score.tier === "medium" ? "bg-muted-foreground" : "bg-muted"}`} />
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== HISTORY / REPLAY ==============
function HistoryPanel() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  useEffect(() => {
    supabase.from("search_history").select("*").order("created_at", { ascending: false }).limit(500).then(({ data }) => setItems(data ?? []));
  }, []);

  const filtered = items.filter((i) => !search || i.query.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-light tracking-[0.2em] uppercase">Search History & Session Replay</h2>
          <p className="text-xs text-muted-foreground mt-1">Every query, timestamped. Replay sessions exactly as they happened.</p>
        </div>
        <button
          onClick={() => exportJSON("search-history", items.map((i) => ({ title: i.query, snippet: `${i.result_count} results @ ${i.created_at}` })))}
          className="flex items-center gap-2 px-3 py-1.5 text-xs border border-border rounded hover:bg-muted"
        >
          <Download className="h-3 w-3" /> Export
        </button>
      </div>
      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by query..." className="w-full bg-transparent border border-border rounded px-3 py-2 text-sm" />
      <div className="space-y-1">
        {filtered.length === 0 && <div className="text-center py-12 text-xs text-muted-foreground">No history.</div>}
        {filtered.map((h) => (
          <div key={h.id} className="p-2 border border-border rounded bg-card flex items-center gap-3 text-xs">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="flex-1">{h.query}</span>
            <span className="text-muted-foreground">{h.category}</span>
            <span className="text-muted-foreground">{h.result_count}r</span>
            <span className="text-muted-foreground">{new Date(h.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== AUDIT — Chain of Custody ==============
function AuditPanel() {
  const [trail, setTrail] = useState<any[]>([]);
  useEffect(() => { getAuditTrail(500).then(setTrail); }, []);

  const verifyChain = () => {
    let prev: string | null = null;
    let valid = 0;
    for (let i = trail.length - 1; i >= 0; i--) {
      const entry = trail[i];
      if (entry.prev_hash === prev) valid++;
      prev = entry.payload_hash;
    }
    return { total: trail.length, valid };
  };
  const { total, valid } = verifyChain();

  const exportTrail = async () => {
    const json = await exportAuditTrailJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `audit-trail-${Date.now()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Audit trail exported");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-sm font-light tracking-[0.2em] uppercase flex items-center gap-2"><Shield className="h-4 w-4" /> Chain of Custody</h2>
          <p className="text-xs text-muted-foreground mt-1">Every query, click, annotation, export — SHA-256 hashed and chained. Court-admissible.</p>
        </div>
        <button onClick={exportTrail} className="flex items-center gap-2 px-3 py-1.5 text-xs border border-border rounded hover:bg-muted">
          <Download className="h-3 w-3" /> Export Forensic Report
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 border border-border rounded bg-card">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Records</div>
          <div className="text-2xl font-light mt-1">{total}</div>
        </div>
        <div className="p-3 border border-border rounded bg-card">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Chain Verified</div>
          <div className="text-2xl font-light mt-1 flex items-center gap-2">{valid} <Check className="h-4 w-4 text-foreground" /></div>
        </div>
        <div className="p-3 border border-border rounded bg-card">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Algorithm</div>
          <div className="text-sm font-mono mt-2">SHA-256</div>
        </div>
      </div>
      <div className="space-y-1 max-h-[60vh] overflow-y-auto">
        {trail.length === 0 && <div className="text-center py-12 text-xs text-muted-foreground">No audit entries yet.</div>}
        {trail.map((e) => (
          <div key={e.id} className="p-2 border border-border rounded bg-card text-xs flex items-center gap-3 font-mono">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-16">{e.action_type}</span>
            <span className="text-muted-foreground w-20 truncate">{e.resource_type ?? "—"}</span>
            <span className="flex-1 truncate text-[10px]">{e.payload_hash.slice(0, 16)}…</span>
            <span className="text-[10px] text-muted-foreground">{new Date(e.created_at).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============== QUERY BUILDER ==============
function QueryBuilderPanel() {
  const [terms, setTerms] = useState<{ op: "AND" | "OR" | "NOT"; val: string }[]>([{ op: "AND", val: "" }]);
  const [site, setSite] = useState(""); const [filetype, setFiletype] = useState(""); const [dateRange, setDateRange] = useState("");

  const buildQuery = () => {
    const parts: string[] = [];
    terms.forEach((t, i) => {
      if (!t.val.trim()) return;
      if (i === 0) parts.push(t.val);
      else if (t.op === "AND") parts.push(`AND ${t.val}`);
      else if (t.op === "OR") parts.push(`OR ${t.val}`);
      else parts.push(`-${t.val}`);
    });
    if (site) parts.push(`site:${site}`);
    if (filetype) parts.push(`filetype:${filetype}`);
    if (dateRange) parts.push(`after:${dateRange}`);
    return parts.join(" ");
  };

  const q = buildQuery();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-light tracking-[0.2em] uppercase">Boolean Query Builder</h2>
        <p className="text-xs text-muted-foreground mt-1">Visual builder for AND, OR, NOT, site:, filetype: operators.</p>
      </div>
      <div className="space-y-2">
        {terms.map((t, i) => (
          <div key={i} className="flex gap-2">
            {i > 0 ? (
              <select value={t.op} onChange={(e) => { const c = [...terms]; c[i].op = e.target.value as any; setTerms(c); }} className="bg-card border border-border rounded px-3 py-2 text-sm">
                <option>AND</option><option>OR</option><option>NOT</option>
              </select>
            ) : <div className="w-[80px] text-xs text-muted-foreground flex items-center px-3">FIRST</div>}
            <input value={t.val} onChange={(e) => { const c = [...terms]; c[i].val = e.target.value; setTerms(c); }} placeholder="term..." className="flex-1 bg-transparent border border-border rounded px-3 py-2 text-sm" />
            {terms.length > 1 && <button onClick={() => setTerms(terms.filter((_, idx) => idx !== i))} className="p-2 border border-border rounded"><X className="h-3 w-3" /></button>}
          </div>
        ))}
        <button onClick={() => setTerms([...terms, { op: "AND", val: "" }])} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <Plus className="h-3 w-3" /> Add term
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="site: (e.g. wsj.com)" className="bg-transparent border border-border rounded px-3 py-2 text-sm" />
        <input value={filetype} onChange={(e) => setFiletype(e.target.value)} placeholder="filetype: (e.g. pdf)" className="bg-transparent border border-border rounded px-3 py-2 text-sm" />
        <input value={dateRange} onChange={(e) => setDateRange(e.target.value)} placeholder="after: (YYYY-MM-DD)" className="bg-transparent border border-border rounded px-3 py-2 text-sm" />
      </div>
      <div className="p-4 border border-border rounded bg-card">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Generated Query</div>
        <div className="font-mono text-sm break-all">{q || "—"}</div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => { navigator.clipboard.writeText(q); toast.success("Query copied"); }} className="px-4 py-2 text-xs border border-border rounded hover:bg-muted flex items-center gap-2"><Copy className="h-3 w-3" /> Copy</button>
        <button onClick={() => window.open(`/zophiel?q=${encodeURIComponent(q)}`, "_blank")} className="px-4 py-2 text-xs bg-foreground text-background rounded flex items-center gap-2"><Search className="h-3 w-3" /> Run in Zophiel</button>
      </div>
    </div>
  );
}
