import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Search, Download, Star, Check, Trash2, Filter, ExternalLink } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Plugin {
  id: string;
  name: string;
  description: string;
  category: string;
  author: string;
  icon: string;
  version: string;
  downloads: number;
  rating: number;
  is_premium: boolean;
  price_cents: number;
}

interface InstalledPlugin {
  id: string;
  plugin_id: string;
  installed_at: string;
}

const categoryLabels: Record<string, string> = { connector: "Data Connectors", analysis: "Analysis Modules", visualization: "Visualizations", export: "Export Plugins", automation: "Automation" };
const categoryColors: Record<string, string> = { connector: "text-blue-400 bg-blue-500/10", analysis: "text-purple-400 bg-purple-500/10", visualization: "text-emerald-400 bg-emerald-500/10", export: "text-amber-400 bg-amber-500/10", automation: "text-cyan-400 bg-cyan-500/10" };

const PluginMarketplaceView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showInstalled, setShowInstalled] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [{ data: pluginData }, { data: installedData }] = await Promise.all([
      (supabase.from as any)("plugins").select("*").order("downloads", { ascending: false }),
      (supabase.from as any)("installed_plugins").select("*").eq("user_id", user.id),
    ]);
    setPlugins((pluginData ?? []) as Plugin[]);
    setInstalled((installedData ?? []) as InstalledPlugin[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const installPlugin = async (pluginId: string) => {
    if (!user) return;
    const { error } = await (supabase.from as any)("installed_plugins").insert({ user_id: user.id, plugin_id: pluginId });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Plugin installed" });
    loadData();
  };

  const uninstallPlugin = async (pluginId: string) => {
    if (!user) return;
    await (supabase.from as any)("installed_plugins").delete().eq("user_id", user.id).eq("plugin_id", pluginId);
    toast({ title: "Plugin uninstalled" });
    loadData();
  };

  const isInstalled = (pluginId: string) => installed.some(i => i.plugin_id === pluginId);

  const categories = [...new Set(plugins.map(p => p.category))];
  const filtered = plugins.filter(p => {
    if (showInstalled && !isInstalled(p.id)) return false;
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="flex flex-1 items-center justify-center"><div className="text-sm font-extralight tracking-widest text-muted-foreground animate-pulse">Loading plugins…</div></div>;

  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-border/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-extralight tracking-[0.2em] text-foreground">PLUGIN MARKETPLACE</h1>
            <p className="text-xs font-extralight text-muted-foreground mt-1">{plugins.length} plugins available • {installed.length} installed</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 px-4 py-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search plugins…" className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
          </div>
          <button onClick={() => setShowInstalled(!showInstalled)}
            className={`rounded-xl px-3 py-2 text-[10px] font-light transition-colors ${showInstalled ? "bg-accent/20 text-accent" : "bg-card/20 text-muted-foreground hover:text-foreground"}`}>
            {showInstalled ? "Show All" : "Installed Only"}
          </button>
        </div>
        <div className="flex gap-1.5 mt-3">
          <button onClick={() => setCategoryFilter(null)} className={`rounded-lg px-2.5 py-1 text-[10px] transition-colors ${!categoryFilter ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>All</button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
              className={`rounded-lg px-2.5 py-1 text-[10px] capitalize transition-colors ${categoryFilter === cat ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(plugin => {
              const installed = isInstalled(plugin.id);
              return (
                <div key={plugin.id} className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-3 hover:border-border/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{plugin.icon}</span>
                      <div>
                        <p className="text-xs font-light text-foreground">{plugin.name}</p>
                        <p className="text-[10px] text-muted-foreground">{plugin.author} • v{plugin.version}</p>
                      </div>
                    </div>
                    {plugin.is_premium && (
                      <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400">Premium</span>
                    )}
                  </div>
                  
                  <p className="text-[10px] font-light text-muted-foreground leading-relaxed">{plugin.description}</p>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                        <span className="text-[10px] text-foreground">{plugin.rating}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Download className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">{(plugin.downloads / 1000).toFixed(1)}K</span>
                      </div>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize ${categoryColors[plugin.category]}`}>{plugin.category}</span>
                    </div>
                    {plugin.is_premium && plugin.price_cents > 0 && (
                      <span className="text-[10px] text-foreground">${(plugin.price_cents / 100).toFixed(0)}/mo</span>
                    )}
                  </div>

                  <button
                    onClick={() => installed ? uninstallPlugin(plugin.id) : installPlugin(plugin.id)}
                    className={`w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-[10px] font-light transition-colors ${
                      installed ? "bg-emerald-500/10 text-emerald-400 hover:bg-red-500/10 hover:text-red-400" : "bg-accent/20 text-accent hover:bg-accent/30"
                    }`}
                  >
                    {installed ? <><Check className="h-3 w-3" /> Installed</> : <><Download className="h-3 w-3" /> Install</>}
                  </button>
                </div>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm font-extralight text-muted-foreground">No plugins match your search.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default PluginMarketplaceView;
