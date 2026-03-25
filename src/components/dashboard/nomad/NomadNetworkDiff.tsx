import { useState, useMemo } from "react";
import {
  GitCompare, Clock, Plus, Minus, ArrowRight, AlertTriangle,
  Bell, Globe, User, Building2, Eye
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NomadNetworkDiffProps {
  entities: { type: string; value: string; confidence: number }[];
  investigations: { query: string; findings: string; created_at: string; entities_found: any[] }[];
}

interface EntityMutation {
  id: string;
  entityType: string;
  entityValue: string;
  mutationType: "added" | "removed" | "changed";
  detail: string;
  timestamp: number;
}

interface AlertRule {
  id: string;
  entityValue: string;
  watchFor: string;
  active: boolean;
  lastTriggered?: number;
}

const STORAGE_KEY = "nomad_network_diff";

function loadData(): { snapshots: Record<string, { entities: any[]; timestamp: number }[]>; alerts: AlertRule[] } {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"snapshots":{},"alerts":[]}'); } catch { return { snapshots: {}, alerts: [] }; }
}
function saveData(d: any) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

const NomadNetworkDiff = ({ entities, investigations }: NomadNetworkDiffProps) => {
  const [data, setData] = useState(loadData);
  const [tab, setTab] = useState<"diff" | "alerts">("diff");
  const [window1, setWindow1] = useState(7); // days ago
  const [window2, setWindow2] = useState(0); // now
  const [addingAlert, setAddingAlert] = useState(false);
  const [alertEntity, setAlertEntity] = useState("");
  const [alertWatch, setAlertWatch] = useState("");

  const save = (d: typeof data) => { setData(d); saveData(d); };

  // Compute diff between two time windows
  const diff = useMemo(() => {
    const now = Date.now();
    const cutoff1 = now - window1 * 24 * 60 * 60 * 1000;
    const cutoff2 = now - window2 * 24 * 60 * 60 * 1000;

    const oldEntities = new Set<string>();
    const newEntities = new Set<string>();

    for (const inv of investigations) {
      const ts = new Date(inv.created_at).getTime();
      for (const e of (inv.entities_found || [])) {
        const key = `${e.type}:${e.value}`;
        if (ts < cutoff1) continue;
        if (ts <= cutoff2 && ts >= cutoff1) oldEntities.add(key);
        if (ts > cutoff2) newEntities.add(key);
      }
    }

    // Also include current session entities as "new"
    for (const e of entities) {
      newEntities.add(`${e.type}:${e.value}`);
    }

    const added = [...newEntities].filter(e => !oldEntities.has(e));
    const removed = [...oldEntities].filter(e => !newEntities.has(e));
    const persisted = [...newEntities].filter(e => oldEntities.has(e));

    return { added, removed, persisted };
  }, [entities, investigations, window1, window2]);

  const addAlert = () => {
    if (!alertEntity.trim()) return;
    const alert: AlertRule = { id: crypto.randomUUID(), entityValue: alertEntity.trim(), watchFor: alertWatch || "any change", active: true };
    save({ ...data, alerts: [...data.alerts, alert] });
    setAlertEntity(""); setAlertWatch(""); setAddingAlert(false);
  };

  const toggleAlert = (id: string) => {
    save({ ...data, alerts: data.alerts.map(a => a.id === id ? { ...a, active: !a.active } : a) });
  };

  const parseKey = (key: string) => {
    const [type, ...rest] = key.split(":");
    return { type, value: rest.join(":") };
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border/20">
        <button onClick={() => setTab("diff")} className={`px-3 py-1.5 rounded-lg text-[10px] font-light transition-colors ${tab === "diff" ? "bg-foreground/10 text-foreground" : "text-muted-foreground/40"}`}>
          <GitCompare className="h-3 w-3 inline mr-1" /> Network Diff
        </button>
        <button onClick={() => setTab("alerts")} className={`px-3 py-1.5 rounded-lg text-[10px] font-light transition-colors ${tab === "alerts" ? "bg-foreground/10 text-foreground" : "text-muted-foreground/40"}`}>
          <Bell className="h-3 w-3 inline mr-1" /> Entity Alerts ({data.alerts.length})
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {tab === "diff" && (
            <div className="space-y-4">
              <h3 className="text-sm font-light text-foreground">Network Diffing</h3>
              <p className="text-[10px] text-muted-foreground/40">Compare two time windows to surface new nodes and severed links.</p>

              {/* Time window selectors */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-muted-foreground/40" />
                  <select value={window1} onChange={e => setWindow1(Number(e.target.value))} className="bg-transparent text-[10px] text-foreground outline-none border border-border/20 rounded-lg px-2 py-1">
                    <option value={1}>1 day ago</option>
                    <option value={7}>7 days ago</option>
                    <option value={14}>14 days ago</option>
                    <option value={30}>30 days ago</option>
                    <option value={90}>90 days ago</option>
                  </select>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground/30" />
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-muted-foreground/40" />
                  <select value={window2} onChange={e => setWindow2(Number(e.target.value))} className="bg-transparent text-[10px] text-foreground outline-none border border-border/20 rounded-lg px-2 py-1">
                    <option value={0}>Now</option>
                    <option value={1}>1 day ago</option>
                    <option value={7}>7 days ago</option>
                  </select>
                </div>
              </div>

              {/* Diff results */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Plus className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-[10px] text-emerald-400 uppercase tracking-wider">New ({diff.added.length})</span>
                  </div>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {diff.added.slice(0, 20).map(key => {
                      const { type, value } = parseKey(key);
                      return (
                        <div key={key} className="text-[10px] text-emerald-400/70 truncate">
                          <span className="opacity-50">{type}:</span> {value}
                        </div>
                      );
                    })}
                    {diff.added.length === 0 && <p className="text-[10px] text-emerald-400/30 italic">No new entities</p>}
                  </div>
                </div>

                <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Minus className="h-3.5 w-3.5 text-red-400" />
                    <span className="text-[10px] text-red-400 uppercase tracking-wider">Severed ({diff.removed.length})</span>
                  </div>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {diff.removed.slice(0, 20).map(key => {
                      const { type, value } = parseKey(key);
                      return (
                        <div key={key} className="text-[10px] text-red-400/70 truncate">
                          <span className="opacity-50">{type}:</span> {value}
                        </div>
                      );
                    })}
                    {diff.removed.length === 0 && <p className="text-[10px] text-red-400/30 italic">No severed links</p>}
                  </div>
                </div>

                <div className="rounded-xl border border-border/20 bg-card/10 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Persistent ({diff.persisted.length})</span>
                  </div>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {diff.persisted.slice(0, 20).map(key => {
                      const { type, value } = parseKey(key);
                      return (
                        <div key={key} className="text-[10px] text-muted-foreground/40 truncate">
                          <span className="opacity-50">{type}:</span> {value}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "alerts" && (
            <div className="space-y-3">
              <h3 className="text-sm font-light text-foreground">Entity Mutation Alerts</h3>
              <p className="text-[10px] text-muted-foreground/40">Notify when an entity changes username, WHOIS, officers, wallet activity, or deletes posts.</p>

              <button onClick={() => setAddingAlert(true)} className="flex items-center gap-1 text-[10px] text-foreground/50 hover:text-foreground">
                <Plus className="h-3 w-3" /> Add Alert Rule
              </button>

              {addingAlert && (
                <div className="rounded-xl border border-border/20 bg-card/20 p-3 space-y-2">
                  <input value={alertEntity} onChange={e => setAlertEntity(e.target.value)} placeholder="Entity to watch (name, domain, handle)" className="w-full bg-transparent text-xs text-foreground outline-none border-b border-border/20 pb-1" autoFocus />
                  <input value={alertWatch} onChange={e => setAlertWatch(e.target.value)} placeholder="Watch for (e.g. username change, WHOIS update)" className="w-full bg-transparent text-[11px] text-foreground outline-none border-b border-border/20 pb-1" />
                  <div className="flex gap-2"><button onClick={addAlert} className="text-[10px] text-foreground">Save</button><button onClick={() => setAddingAlert(false)} className="text-[10px] text-muted-foreground/40">Cancel</button></div>
                </div>
              )}

              {data.alerts.map(a => (
                <div key={a.id} className={`rounded-xl border p-3 ${a.active ? "border-border/25 bg-foreground/[0.03]" : "border-border/15 bg-card/10 opacity-50"}`}>
                  <div className="flex items-center gap-2">
                    <Bell className={`h-3.5 w-3.5 ${a.active ? "text-foreground" : "text-muted-foreground/30"}`} />
                    <span className="text-xs text-foreground/70 font-light flex-1">{a.entityValue}</span>
                    <button onClick={() => toggleAlert(a.id)} className="text-[9px] text-muted-foreground/40 hover:text-foreground">
                      {a.active ? "Disable" : "Enable"}
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground/40 mt-1">Watching: {a.watchFor}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default NomadNetworkDiff;
