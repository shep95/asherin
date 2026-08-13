import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Download, Star, Check, Cloud, Link, DollarSign, ShoppingCart,
  CreditCard, Sparkles, Shield, MessageSquare, Eye, Mic, BarChart3,
  ScatterChart, Network, LayoutDashboard, FileOutput, FileSpreadsheet,
  Send, Workflow, Bot, RefreshCw, Package, Play, X, Loader2, ArrowLeft,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

const pluginIconMap: Record<string, React.ReactNode> = {
  "☁️": <Cloud className="h-5 w-5 text-muted-foreground" />,
  "🟠": <Link className="h-5 w-5 text-muted-foreground" />,
  "💰": <DollarSign className="h-5 w-5 text-muted-foreground" />,
  "🛒": <ShoppingCart className="h-5 w-5 text-muted-foreground" />,
  "💳": <CreditCard className="h-5 w-5 text-muted-foreground" />,
  "🔮": <Sparkles className="h-5 w-5 text-muted-foreground" />,
  "🛡️": <Shield className="h-5 w-5 text-muted-foreground" />,
  "💬": <MessageSquare className="h-5 w-5 text-muted-foreground" />,
  "👁️": <Eye className="h-5 w-5 text-muted-foreground" />,
  "🎙️": <Mic className="h-5 w-5 text-muted-foreground" />,
  "📊": <BarChart3 className="h-5 w-5 text-muted-foreground" />,
  "📈": <ScatterChart className="h-5 w-5 text-muted-foreground" />,
  "🕸️": <Network className="h-5 w-5 text-muted-foreground" />,
  "📋": <LayoutDashboard className="h-5 w-5 text-muted-foreground" />,
  "📤": <FileOutput className="h-5 w-5 text-muted-foreground" />,
  "📑": <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />,
  "📧": <Send className="h-5 w-5 text-muted-foreground" />,
  "⚡": <Workflow className="h-5 w-5 text-muted-foreground" />,
  "🤖": <Bot className="h-5 w-5 text-muted-foreground" />,
  "🔄": <RefreshCw className="h-5 w-5 text-muted-foreground" />,
  "🔌": <Package className="h-5 w-5 text-muted-foreground" />,
  "❤️": <Sparkles className="h-5 w-5 text-rose-400" />,
};

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

/* ── Plugin Runner Panel ─────────────────────────────────────────── */
const PluginRunner = ({ plugin, onClose }: { plugin: Plugin; onClose: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [datasets, setDatasets] = useState<{ id: string; file_name: string }[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, string>>({});

  // Load persisted config from installed_plugins
  useEffect(() => {
    if (!user) return;
    supabase.from("installed_plugins").select("config").eq("user_id", user.id).eq("plugin_id", plugin.id).single()
      .then(({ data }) => {
        if (data?.config && typeof data.config === "object") {
          setConfigValues(data.config as Record<string, string>);
        }
      });
  }, [user, plugin.id]);

  // Persist config on change
  const updateConfig = (key: string, value: string) => {
    const newConfig = { ...configValues, [key]: value };
    setConfigValues(newConfig);
    // Debounced save
    supabase.from("installed_plugins").update({ config: newConfig }).eq("user_id", user!.id).eq("plugin_id", plugin.id);
  };

  useEffect(() => {
    if (!user) return;
    supabase.from("asha_datasets").select("id, file_name").eq("user_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => setDatasets((data ?? []) as { id: string; file_name: string }[]));
  }, [user]);

  const needsDataset = ["analysis", "visualization", "export"].includes(plugin.category);
  const needsConfig = ["connector", "automation"].includes(plugin.category);

  const configFields: Record<string, { label: string; placeholder: string }[]> = {
    connector: [
      { label: "API Key / Token", placeholder: "Enter your API key…" },
      { label: "Instance URL", placeholder: "https://your-instance.example.com" },
    ],
    automation: [
      { label: "Schedule", placeholder: "e.g. every 6 hours, daily at 9am" },
      { label: "Target Dataset", placeholder: "Dataset name or ID" },
    ],
  };

  const runPlugin = async () => {
    if (!user) return;
    setRunning(true);
    setResult(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/plugin-execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          pluginId: plugin.id,
          config: configValues,
          datasetId: selectedDataset,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.result || "Plugin execution failed");
      }

      const data = await res.json();
      setResult(data.result || "Plugin executed successfully but returned no output.");
      toast({ title: `${plugin.name} completed` });
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
      toast({ title: "Plugin error", description: e.message, variant: "destructive" });
    }
    setRunning(false);
  };

  return (
    <div className="flex flex-1 flex-col h-full">
      <div className="flex-shrink-0 p-6 border-b border-border/20">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          {pluginIconMap[plugin.icon] || <Package className="h-5 w-5 text-muted-foreground" />}
          <div>
            <h2 className="text-sm font-light text-foreground">{plugin.name}</h2>
            <p className="text-[10px] text-muted-foreground">{plugin.author} • v{plugin.version} • <span className={`capitalize ${categoryColors[plugin.category]?.split(" ")[0]}`}>{plugin.category}</span></p>
          </div>
        </div>
        <p className="text-xs font-light text-muted-foreground/70 leading-relaxed">{plugin.description}</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Dataset selector for analysis/viz/export plugins */}
          {needsDataset && (
            <div className="space-y-2">
              <label className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Select Dataset</label>
              {datasets.length === 0 ? (
                <p className="text-xs text-muted-foreground/50">No datasets available. Upload data through Azplen first.</p>
              ) : (
                <select
                  value={selectedDataset ?? ""}
                  onChange={e => setSelectedDataset(e.target.value || null)}
                  className="w-full rounded-xl border border-border/20 bg-card/20 px-4 py-2.5 text-xs text-foreground outline-none"
                >
                  <option value="">Choose a dataset…</option>
                  {datasets.map(d => <option key={d.id} value={d.id}>{d.file_name}</option>)}
                </select>
              )}
            </div>
          )}

          {/* Config fields for connector/automation plugins */}
          {needsConfig && configFields[plugin.category]?.map(field => (
            <div key={field.label} className="space-y-2">
              <label className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">{field.label}</label>
              <input
                value={configValues[field.label] || ""}
                onChange={e => updateConfig(field.label, e.target.value)}
                placeholder={field.placeholder}
                className="w-full rounded-xl border border-border/20 bg-card/20 px-4 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/30"
              />
            </div>
          ))}

          {/* Run button */}
          <button
            onClick={runPlugin}
            disabled={running || (needsDataset && !selectedDataset)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent/20 text-accent py-3 text-xs font-light hover:bg-accent/30 transition-colors disabled:opacity-40"
          >
            {running ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Running {plugin.name}…</> : <><Play className="h-3.5 w-3.5" /> Run {plugin.name}</>}
          </button>

          {/* Results */}
          {result && (
            <div className="space-y-2">
              <p className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">Results</p>
              <div className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5">
                <div className="prose prose-invert prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap text-xs font-light text-foreground/90 leading-relaxed">{result}</pre>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

/* ── Main Marketplace View ───────────────────────────────────────── */
const PluginMarketplaceView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showInstalled, setShowInstalled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [activePlugin, setActivePlugin] = useState<Plugin | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    const [{ data: pluginData }, { data: installedData }] = await Promise.all([
      supabase.from("plugins").select("*").order("downloads", { ascending: false }),
      supabase.from("installed_plugins").select("*").eq("user_id", user.id),
    ]);
    setPlugins((pluginData ?? []) as Plugin[]);
    setInstalled((installedData ?? []) as InstalledPlugin[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Handle ?plugin_installed= URL param after Stripe success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const installedPluginId = params.get("plugin_installed");
    if (installedPluginId && user) {
      (async () => {
        const { error } = await supabase.from("installed_plugins").insert({ user_id: user.id, plugin_id: installedPluginId });
        if (!error) {
          toast({ title: "Plugin purchased & installed" });
          loadData();
        }
        window.history.replaceState({}, "", window.location.pathname);
      })();
    }
  }, [user]);

  const installPlugin = async (plugin: Plugin) => {
    if (!user) return;
    if (plugin.is_premium && plugin.price_cents > 0) {
      setCheckoutLoading(plugin.id);
      try {
        const { data, error } = await supabase.functions.invoke("plugin-checkout", {
          body: { pluginId: plugin.id, pluginName: plugin.name, priceCents: plugin.price_cents },
        });
        if (error) throw error;
        if (data?.url) window.open(data.url, "_blank");
      } catch (e: any) {
        toast({ title: "Checkout failed", description: e.message, variant: "destructive" });
      }
      setCheckoutLoading(null);
      return;
    }
    const { error } = await supabase.from("installed_plugins").insert({ user_id: user.id, plugin_id: plugin.id });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Plugin installed" });
    loadData();
  };

  const uninstallPlugin = async (pluginId: string) => {
    if (!user) return;
    await supabase.from("installed_plugins").delete().eq("user_id", user.id).eq("plugin_id", pluginId);
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

  // Show plugin runner if a plugin is active
  if (activePlugin) {
    return <PluginRunner plugin={activePlugin} onClose={() => setActivePlugin(null)} />;
  }

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
              const pluginInstalled = isInstalled(plugin.id);
              return (
                <div key={plugin.id} className="rounded-2xl border border-border/10 bg-card/20 backdrop-blur-sm p-5 space-y-3 hover:border-border/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {pluginIconMap[plugin.icon] || <Package className="h-5 w-5 text-muted-foreground" />}
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
                      <span className="text-[10px] text-foreground">${(plugin.price_cents / 100).toFixed(0)}</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => pluginInstalled ? uninstallPlugin(plugin.id) : installPlugin(plugin)}
                      disabled={checkoutLoading === plugin.id}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-[10px] font-light transition-colors ${
                        pluginInstalled ? "bg-foreground/5 text-foreground hover:bg-destructive/10 hover:text-destructive" : "bg-accent/20 text-accent hover:bg-accent/30"
                      } disabled:opacity-50`}
                    >
                      {checkoutLoading === plugin.id ? "Redirecting…" : pluginInstalled ? <><Check className="h-3 w-3" /> Installed</> : plugin.is_premium && plugin.price_cents > 0 ? <><CreditCard className="h-3 w-3" /> ${(plugin.price_cents / 100).toFixed(0)}</> : <><Download className="h-3 w-3" /> Install</>}
                    </button>
                    {pluginInstalled && (
                      <button
                        onClick={() => setActivePlugin(plugin)}
                        className="flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-[10px] font-light bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
                      >
                        <Play className="h-3 w-3" /> Use
                      </button>
                    )}
                  </div>
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
