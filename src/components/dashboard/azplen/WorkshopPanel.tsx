import { useState, useEffect, useCallback } from "react";
import { LayoutDashboard, Plus, GripVertical, Trash2, BarChart3, TrendingUp, MapPin, Table2, FileText, Activity, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAzplenSession } from "./AzplenSessionContext";
import { supabase } from "@/integrations/supabase/client";

type WidgetType = "metric" | "chart" | "table" | "map" | "status" | "text";

interface DashWidget {
  id: string;
  type: WidgetType;
  title: string;
  config: Record<string, string>;
  size: "sm" | "md" | "lg";
}

interface Workshop {
  id: string;
  name: string;
  widgets: DashWidget[];
  createdAt: string;
}

const WIDGET_TYPES: { type: WidgetType; icon: React.ElementType; label: string }[] = [
  { type: "metric", icon: TrendingUp, label: "KPI Metric" },
  { type: "chart", icon: BarChart3, label: "Chart" },
  { type: "table", icon: Table2, label: "Data Table" },
  { type: "map", icon: MapPin, label: "Live Map" },
  { type: "status", icon: Activity, label: "Status Feed" },
  { type: "text", icon: FileText, label: "Text / Notes" },
];

const sizeClasses = { sm: "col-span-1", md: "col-span-1 sm:col-span-2", lg: "col-span-1 sm:col-span-2 lg:col-span-3" };

const WorkshopPanel = () => {
  const { user } = useAuth();
  const { activeSession } = useAzplenSession();
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [active, setActive] = useState<Workshop | null>(null);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [datasets, setDatasets] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !activeSession) return;
    supabase.from("asha_datasets").select("id, file_name, row_count, col_count, quality_score").eq("user_id", user.id).eq("session_id", activeSession.id).eq("status", "ready").then(({ data }) => {
      if (data) setDatasets(data);
    });
  }, [user, activeSession]);

  const createWorkshop = () => {
    const w: Workshop = { id: crypto.randomUUID(), name: `Dashboard ${workshops.length + 1}`, widgets: [], createdAt: new Date().toISOString() };
    setWorkshops(prev => [...prev, w]);
    setActive(w);
  };

  const addWidget = (type: WidgetType) => {
    if (!active) return;
    const widget: DashWidget = {
      id: crypto.randomUUID(),
      type,
      title: WIDGET_TYPES.find(w => w.type === type)?.label || type,
      config: {},
      size: type === "table" || type === "map" ? "lg" : type === "chart" ? "md" : "sm",
    };
    const updated = { ...active, widgets: [...active.widgets, widget] };
    setActive(updated);
    setWorkshops(prev => prev.map(w => w.id === updated.id ? updated : w));
    setShowAddWidget(false);
  };

  const removeWidget = (wid: string) => {
    if (!active) return;
    const updated = { ...active, widgets: active.widgets.filter(w => w.id !== wid) };
    setActive(updated);
    setWorkshops(prev => prev.map(w => w.id === updated.id ? updated : w));
  };

  const cycleSize = (wid: string) => {
    if (!active) return;
    const order: DashWidget["size"][] = ["sm", "md", "lg"];
    const updated = {
      ...active,
      widgets: active.widgets.map(w => {
        if (w.id !== wid) return w;
        const next = order[(order.indexOf(w.size) + 1) % order.length];
        return { ...w, size: next };
      }),
    };
    setActive(updated);
    setWorkshops(prev => prev.map(w => w.id === updated.id ? updated : w));
  };

  const renderWidgetPreview = (widget: DashWidget) => {
    switch (widget.type) {
      case "metric":
        return (
          <div className="text-center py-4">
            <p className="text-2xl font-light text-foreground">{datasets.length > 0 ? datasets.reduce((a, d) => a + (d.row_count || 0), 0).toLocaleString() : "—"}</p>
            <p className="text-[9px] text-muted-foreground/40 mt-1">Total Records</p>
          </div>
        );
      case "chart":
        return (
          <div className="flex items-end gap-1 justify-center py-4 h-20">
            {[40, 65, 35, 80, 55, 70, 45].map((h, i) => (
              <div key={i} className="w-4 bg-accent/20 rounded-t" style={{ height: `${h}%` }} />
            ))}
          </div>
        );
      case "table":
        return (
          <div className="space-y-1 py-2">
            {datasets.slice(0, 4).map(ds => (
              <div key={ds.id} className="flex justify-between text-[10px] px-2 py-1 rounded bg-foreground/5">
                <span className="text-foreground/70 truncate max-w-[60%]">{ds.file_name}</span>
                <span className="text-muted-foreground/50">{ds.row_count} rows</span>
              </div>
            ))}
          </div>
        );
      case "map":
        return (
          <div className="relative h-24 bg-accent/5 rounded-lg overflow-hidden flex items-center justify-center">
            <MapPin className="h-6 w-6 text-accent/30" />
            <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-accent animate-ping" />
            <div className="absolute bottom-3 right-4 w-2 h-2 rounded-full bg-emerald-500 animate-ping" style={{ animationDelay: "0.5s" }} />
          </div>
        );
      case "status":
        return (
          <div className="space-y-1.5 py-2">
            {["Pipeline: Running", "Monitor: Active", "Quality: 94%"].map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <div className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
                <span className="text-foreground/70">{s}</span>
              </div>
            ))}
          </div>
        );
      case "text":
        return <p className="text-[10px] text-muted-foreground/50 py-4 text-center italic">Click to edit notes…</p>;
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-extralight tracking-wide text-foreground">Workshop</h2>
          </div>
          <p className="text-xs font-extralight text-muted-foreground mt-1">Build operational apps and live dashboards on top of your data — no coding needed.</p>
        </div>
        <button onClick={createWorkshop} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent/10 text-accent text-xs hover:bg-accent/20 transition-colors">
          <Plus className="h-3.5 w-3.5" /> New Dashboard
        </button>
      </div>

      {!active && workshops.length === 0 && (
        <div className="flex flex-col items-center py-16">
          <LayoutDashboard className="h-12 w-12 text-muted-foreground/15 mb-4" />
          <p className="text-sm font-extralight text-muted-foreground/50 mb-1">No dashboards yet</p>
          <p className="text-[10px] text-muted-foreground/30 mb-4">Build live operational views for trucks, facilities, inventory, and more</p>
          <button onClick={createWorkshop} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent/10 text-accent text-xs hover:bg-accent/20 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Create Dashboard
          </button>
        </div>
      )}

      {!active && workshops.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {workshops.map(w => (
            <button key={w.id} onClick={() => setActive(w)} className="text-left px-4 py-4 rounded-xl border border-border/20 bg-card/20 hover:bg-card/40 transition-colors">
              <p className="text-sm font-light text-foreground">{w.name}</p>
              <p className="text-[10px] text-muted-foreground/50 mt-1">{w.widgets.length} widgets · Created {new Date(w.createdAt).toLocaleDateString()}</p>
            </button>
          ))}
        </div>
      )}

      {active && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setActive(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">← Back</button>
              <input value={active.name} onChange={e => { const u = { ...active, name: e.target.value }; setActive(u); setWorkshops(prev => prev.map(w => w.id === u.id ? u : w)); }} className="bg-transparent text-sm font-light text-foreground border-b border-border/20 focus:border-accent/40 outline-none px-1" />
            </div>
            <button onClick={() => setShowAddWidget(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs hover:bg-accent/20 transition-colors">
              <Plus className="h-3 w-3" /> Add Widget
            </button>
          </div>

          {active.widgets.length === 0 ? (
            <div className="flex flex-col items-center py-12 border border-dashed border-border/20 rounded-2xl">
              <LayoutDashboard className="h-8 w-8 text-muted-foreground/20 mb-3" />
              <p className="text-xs text-muted-foreground/50 mb-3">Add widgets to build your dashboard</p>
              <button onClick={() => setShowAddWidget(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent/10 text-accent text-xs hover:bg-accent/20 transition-colors">
                <Plus className="h-3 w-3" /> Add Widget
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {active.widgets.map(widget => {
                const wt = WIDGET_TYPES.find(w => w.type === widget.type);
                const Icon = wt?.icon || FileText;
                return (
                  <div key={widget.id} className={`rounded-xl border border-border/15 bg-card/20 p-3 ${sizeClasses[widget.size]} transition-all hover:border-accent/15`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <GripVertical className="h-3 w-3 text-muted-foreground/20 cursor-grab" />
                        <Icon className="h-3 w-3 text-muted-foreground/40" />
                        <span className="text-[10px] font-light text-foreground/80">{widget.title}</span>
                      </div>
                      <div className="flex gap-0.5">
                        <button onClick={() => cycleSize(widget.id)} className="p-0.5 text-muted-foreground/30 hover:text-foreground transition-colors">
                          <Maximize2 className="h-2.5 w-2.5" />
                        </button>
                        <button onClick={() => removeWidget(widget.id)} className="p-0.5 text-muted-foreground/30 hover:text-destructive transition-colors">
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                    {renderWidgetPreview(widget)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showAddWidget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setShowAddWidget(false)}>
          <div className="bg-card rounded-2xl border border-border/20 p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-light text-foreground mb-4">Add Widget</h3>
            <div className="grid grid-cols-2 gap-2">
              {WIDGET_TYPES.map(wt => {
                const Icon = wt.icon;
                return (
                  <button key={wt.type} onClick={() => addWidget(wt.type)} className="flex items-center gap-2.5 px-3 py-3 rounded-xl border border-border/15 bg-card/30 hover:border-accent/20 hover:bg-accent/5 transition-all text-left">
                    <Icon className="h-4 w-4 text-muted-foreground/50" />
                    <span className="text-xs font-light text-foreground">{wt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkshopPanel;
