import { useState, useEffect } from "react";
import { Key, Plus, Trash2, Check, Loader2, Eye, EyeOff, ChevronDown, Zap, AlertTriangle, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface ProviderConfig {
  id: string;
  name: string;
  icon: string;
  placeholder: string;
  helpUrl: string;
  helpText: string;
  models: { id: string; name: string; description: string }[];
}

export const AI_PROVIDERS: ProviderConfig[] = [
  {
    id: "google",
    name: "Google AI (Gemini)",
    icon: "🔮",
    placeholder: "AIzaSy...",
    helpUrl: "https://aistudio.google.com/app/apikey",
    helpText: "Get your API key from Google AI Studio",
    models: [
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Fast, balanced performance" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Strongest reasoning & multimodal" },
      { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Previous gen, fast" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: "🤖",
    placeholder: "sk-...",
    helpUrl: "https://platform.openai.com/api-keys",
    helpText: "Get your API key from OpenAI Platform",
    models: [
      { id: "gpt-4o", name: "GPT-4o", description: "Latest multimodal flagship" },
      { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "Fast & affordable" },
      { id: "gpt-4-turbo", name: "GPT-4 Turbo", description: "High performance" },
      { id: "o1", name: "o1", description: "Advanced reasoning" },
      { id: "o1-mini", name: "o1 Mini", description: "Fast reasoning" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    icon: "🧠",
    placeholder: "sk-ant-...",
    helpUrl: "https://console.anthropic.com/settings/keys",
    helpText: "Get your API key from Anthropic Console",
    models: [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", description: "Latest balanced model" },
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", description: "Fast & capable" },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus", description: "Most powerful" },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", description: "Fastest & cheapest" },
    ],
  },
  {
    id: "meta",
    name: "Meta AI (Llama)",
    icon: "🦙",
    placeholder: "Your Meta AI API key...",
    helpUrl: "https://llama.meta.com/",
    helpText: "Access via Meta AI API or compatible providers",
    models: [
      { id: "llama-3.1-405b", name: "Llama 3.1 405B", description: "Largest open model" },
      { id: "llama-3.1-70b", name: "Llama 3.1 70B", description: "Strong performance" },
      { id: "llama-3.1-8b", name: "Llama 3.1 8B", description: "Fast & efficient" },
    ],
  },
  {
    id: "venice",
    name: "Venice AI",
    icon: "🎭",
    placeholder: "Your Venice API key...",
    helpUrl: "https://venice.ai/",
    helpText: "Get your API key from Venice AI",
    models: [
      { id: "llama-3.1-405b", name: "Llama 3.1 405B", description: "Uncensored large model" },
      { id: "dolphin-2.9", name: "Dolphin 2.9", description: "Uncensored assistant" },
    ],
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    icon: "⚡",
    placeholder: "xai-...",
    helpUrl: "https://console.x.ai/",
    helpText: "Get your API key from xAI Console",
    models: [
      { id: "grok-2", name: "Grok 2", description: "Latest reasoning model" },
      { id: "grok-2-mini", name: "Grok 2 Mini", description: "Fast & efficient" },
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    icon: "🌊",
    placeholder: "Your Mistral API key...",
    helpUrl: "https://console.mistral.ai/api-keys/",
    helpText: "Get your API key from Mistral Console",
    models: [
      { id: "mistral-large-latest", name: "Mistral Large", description: "Most capable" },
      { id: "mistral-medium-latest", name: "Mistral Medium", description: "Balanced" },
      { id: "mistral-small-latest", name: "Mistral Small", description: "Fast & efficient" },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: "🔍",
    placeholder: "sk-...",
    helpUrl: "https://platform.deepseek.com/",
    helpText: "Get your API key from DeepSeek Platform",
    models: [
      { id: "deepseek-chat", name: "DeepSeek V3", description: "Latest chat model" },
      { id: "deepseek-reasoner", name: "DeepSeek R1", description: "Advanced reasoning" },
    ],
  },
];

interface StoredKey {
  id: string;
  provider: string;
  is_active: boolean;
  created_at: string;
}

interface ModelPreference {
  active_provider: string;
  active_model: string;
  fallback_to_default: boolean;
}

const AIKeysSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [storedKeys, setStoredKeys] = useState<StoredKey[]>([]);
  const [preferences, setPreferences] = useState<ModelPreference>({
    active_provider: "default",
    active_model: "default",
    fallback_to_default: true,
  });
  const [loading, setLoading] = useState(true);
  const [addingProvider, setAddingProvider] = useState<string | null>(null);
  const [newKeyValue, setNewKeyValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPref, setSavingPref] = useState(false);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    const [keysRes, prefRes] = await Promise.all([
      supabase.from("user_api_keys").select("id, provider, is_active, created_at").eq("user_id", user.id),
      supabase.from("user_model_preferences").select("*").eq("user_id", user.id).maybeSingle(),
    ]);
    setStoredKeys((keysRes.data as StoredKey[]) || []);
    if (prefRes.data) {
      const pref = {
        active_provider: prefRes.data.active_provider || "default",
        active_model: prefRes.data.active_model || "default",
        fallback_to_default: prefRes.data.fallback_to_default ?? true,
      };
      setPreferences(pref);
      localStorage.setItem("aureon_byok_active", JSON.stringify({ provider: pref.active_provider, model: pref.active_model }));
    } else {
      localStorage.setItem("aureon_byok_active", JSON.stringify({ provider: "default", model: "default" }));
    }
    }
    setLoading(false);
  };

  const saveKey = async (providerId: string) => {
    if (!user || !newKeyValue.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("user_api_keys").upsert({
      user_id: user.id,
      provider: providerId,
      api_key: newKeyValue.trim(),
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,provider" });
    setSaving(false);
    if (error) {
      toast({ title: "Failed to save key", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "API key saved", description: `${AI_PROVIDERS.find(p => p.id === providerId)?.name} key stored securely.` });
      setNewKeyValue("");
      setAddingProvider(null);
      loadData();
    }
  };

  const deleteKey = async (providerId: string) => {
    if (!user) return;
    const { error } = await supabase.from("user_api_keys").delete().eq("user_id", user.id).eq("provider", providerId);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      // If deleted provider was active, reset to default
      if (preferences.active_provider === providerId) {
        await updatePreference("default", "default");
      }
      toast({ title: "API key removed" });
      loadData();
    }
  };

  const updatePreference = async (provider: string, model: string) => {
    if (!user) return;
    setSavingPref(true);
    const { error } = await supabase.from("user_model_preferences").upsert({
      user_id: user.id,
      active_provider: provider,
      active_model: model,
      fallback_to_default: preferences.fallback_to_default,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    setSavingPref(false);
    if (error) {
      toast({ title: "Failed to update preference", description: error.message, variant: "destructive" });
    } else {
      setPreferences(prev => ({ ...prev, active_provider: provider, active_model: model }));
      // Sync to localStorage for streamChat to read
      localStorage.setItem("aureon_byok_active", JSON.stringify({ provider, model }));
      const providerName = provider === "default" ? "Aureon Default" : AI_PROVIDERS.find(p => p.id === provider)?.name;
      toast({ title: "Model updated", description: `Now using ${providerName}${model !== "default" ? ` → ${model}` : ""}` });
    }
  };

  const toggleFallback = async () => {
    if (!user) return;
    const newVal = !preferences.fallback_to_default;
    const { error } = await supabase.from("user_model_preferences").upsert({
      user_id: user.id,
      active_provider: preferences.active_provider,
      active_model: preferences.active_model,
      fallback_to_default: newVal,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (!error) {
      setPreferences(prev => ({ ...prev, fallback_to_default: newVal }));
    }
  };

  const hasKey = (providerId: string) => storedKeys.some(k => k.provider === providerId);

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />;

  return (
    <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-5 space-y-5">
      <div className="flex items-center gap-3">
        <Key className="h-5 w-5 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-light text-foreground">AI Model Keys</h3>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">Bring your own API keys to use your preferred AI models across all Aureon tools.</p>
        </div>
      </div>

      {/* Active Model Display */}
      <div className="rounded-lg border border-border/15 bg-card/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400/70" />
            <div>
              <p className="text-xs font-light text-foreground">Active Model</p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                {preferences.active_provider === "default"
                  ? "Aureon Default Engine"
                  : `${AI_PROVIDERS.find(p => p.id === preferences.active_provider)?.name} → ${preferences.active_model}`
                }
              </p>
            </div>
          </div>
          {savingPref && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/40" />}
        </div>

        {/* Fallback toggle */}
        <label className="flex items-center justify-between mt-3 pt-3 border-t border-border/10 cursor-pointer">
          <div>
            <span className="text-[11px] text-muted-foreground">Fallback to Aureon default if key fails</span>
            <p className="text-[9px] text-muted-foreground/40 mt-0.5">If your API key hits rate limits or errors, Aureon's built-in engine takes over.</p>
          </div>
          <button
            onClick={toggleFallback}
            className={`w-10 h-5 rounded-full transition-colors shrink-0 ml-3 ${preferences.fallback_to_default ? "bg-foreground/30" : "bg-border/30"}`}
          >
            <div className={`w-4 h-4 rounded-full bg-foreground transition-transform mx-0.5 ${preferences.fallback_to_default ? "translate-x-5" : ""}`} />
          </button>
        </label>
      </div>

      {/* Default option */}
      <button
        onClick={() => updatePreference("default", "default")}
        className={`w-full flex items-center gap-3 rounded-xl border p-3 transition-all ${
          preferences.active_provider === "default"
            ? "border-foreground/30 bg-foreground/5"
            : "border-border/15 bg-card/10 hover:bg-card/20"
        }`}
      >
        <span className="text-lg">⚡</span>
        <div className="flex-1 text-left">
          <p className="text-xs font-light text-foreground">Aureon Default Engine</p>
          <p className="text-[10px] text-muted-foreground/50">Built-in intelligence — no API key needed</p>
        </div>
        {preferences.active_provider === "default" && <Check className="h-4 w-4 text-emerald-500/70" />}
      </button>

      {/* Provider list */}
      <div className="space-y-2">
        <p className="text-[10px] font-light tracking-wider text-muted-foreground/40 uppercase">External Providers</p>
        {AI_PROVIDERS.map(provider => {
          const stored = hasKey(provider.id);
          const isActive = preferences.active_provider === provider.id;
          const isExpanded = expandedProvider === provider.id;
          const isAdding = addingProvider === provider.id;

          return (
            <div key={provider.id} className={`rounded-xl border transition-all ${isActive ? "border-foreground/30 bg-foreground/5" : "border-border/15 bg-card/10"}`}>
              {/* Provider header */}
              <button
                onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                className="w-full flex items-center gap-3 p-3"
              >
                <span className="text-lg">{provider.icon}</span>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-light text-foreground">{provider.name}</p>
                    {stored && (
                      <span className="flex items-center gap-1 text-[9px] text-emerald-500/70">
                        <Check className="h-2.5 w-2.5" /> Key Added
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground/40 truncate">{provider.models.length} models available</p>
                </div>
                {isActive && <Check className="h-4 w-4 text-emerald-500/70 shrink-0" />}
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground/30 transition-transform shrink-0 ${isExpanded ? "rotate-180" : ""}`} />
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-border/10">
                  {/* Add/Update key */}
                  {!isAdding && !stored && (
                    <button
                      onClick={() => { setAddingProvider(provider.id); setNewKeyValue(""); }}
                      className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border/20 bg-foreground/5 px-3 py-1.5 text-[11px] font-light text-foreground hover:bg-foreground/10 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Add API Key
                    </button>
                  )}

                  {isAdding && (
                    <div className="mt-2 space-y-2">
                      <div className="relative">
                        <input
                          type={showKey ? "text" : "password"}
                          value={newKeyValue}
                          onChange={e => setNewKeyValue(e.target.value)}
                          placeholder={provider.placeholder}
                          className="w-full bg-background/50 border border-border/20 rounded-lg px-3 py-2 pr-10 text-xs text-foreground outline-none placeholder:text-muted-foreground/40 focus:border-foreground/30 transition-colors"
                          autoFocus
                        />
                        <button onClick={() => setShowKey(!showKey)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground">
                          {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground/40">
                        <a href={provider.helpUrl} target="_blank" rel="noopener noreferrer" className="text-foreground/60 underline underline-offset-2 hover:text-foreground">{provider.helpText}</a>
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="flex items-start gap-1.5 text-[9px] text-amber-400/60">
                          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                          <span>Your key is stored encrypted and never shared. Only used for your requests.</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveKey(provider.id)}
                          disabled={!newKeyValue.trim() || saving}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-foreground/10 px-3 py-1.5 text-[11px] font-light text-foreground hover:bg-foreground/15 transition-colors disabled:opacity-30"
                        >
                          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          {saving ? "Saving…" : "Save Key"}
                        </button>
                        <button
                          onClick={() => { setAddingProvider(null); setNewKeyValue(""); }}
                          className="rounded-lg border border-border/20 px-3 py-1.5 text-[11px] font-light text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Key management if stored */}
                  {stored && !isAdding && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground/40 font-mono">••••••••••••</span>
                      <button
                        onClick={() => { setAddingProvider(provider.id); setNewKeyValue(""); }}
                        className="text-[10px] text-foreground/60 hover:text-foreground underline underline-offset-2 transition-colors"
                      >
                        Update
                      </button>
                      <button
                        onClick={() => deleteKey(provider.id)}
                        className="text-[10px] text-destructive/60 hover:text-destructive transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="h-2.5 w-2.5" /> Remove
                      </button>
                    </div>
                  )}

                  {/* Model selection */}
                  {stored && (
                    <div className="space-y-1.5 mt-2">
                      <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider">Select Model</p>
                      {provider.models.map(model => {
                        const isModelActive = isActive && preferences.active_model === model.id;
                        return (
                          <button
                            key={model.id}
                            onClick={() => updatePreference(provider.id, model.id)}
                            className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-all ${
                              isModelActive
                                ? "bg-foreground/10 border border-foreground/20"
                                : "border border-transparent hover:bg-foreground/5"
                            }`}
                          >
                            <Brain className={`h-3 w-3 shrink-0 ${isModelActive ? "text-foreground" : "text-muted-foreground/30"}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-[11px] ${isModelActive ? "text-foreground" : "text-muted-foreground/60"}`}>{model.name}</p>
                              <p className="text-[9px] text-muted-foreground/30">{model.description}</p>
                            </div>
                            {isModelActive && <Check className="h-3 w-3 text-emerald-500/70 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AIKeysSettings;
