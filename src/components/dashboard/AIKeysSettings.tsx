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
  /** Country of origin — drives the country filter in Settings. */
  country: string;
  models: { id: string; name: string; description: string }[];
  /** Platform-hosted provider — no user API key required. Aureon-managed. */
  isPlatform?: boolean;
  /** Optional note shown under platform providers (e.g. subscription gating). */
  platformNote?: string;
}

export const AI_PROVIDERS: ProviderConfig[] = [

  {
    id: "google",
    name: "Google AI (Gemini)",
    icon: "◈",
    placeholder: "AIzaSy...",
    helpUrl: "https://aistudio.google.com/app/apikey",
    helpText: "Get your API key from Google AI Studio",
    models: [
      { id: "gemini-3-pro-preview", name: "Gemini 3 Pro", description: "Frontier reasoning, deep think, 1M context" },
      { id: "gemini-3-flash-preview", name: "Gemini 3 Flash", description: "Next-gen flash, balanced speed + capability" },
      { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview", description: "Latest reasoning preview" },
      { id: "gemini-3.1-flash-image-preview", name: "Gemini 3.1 Flash Image", description: "Pro-grade image generation/edit (Nano Banana 2)" },
      { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Strong reasoning + multimodal" },
      { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Fast, balanced performance" },
      { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", description: "Cheapest, high-volume" },
    ],
  },
  {
    id: "openai",
    name: "OpenAI",
    icon: "◉",
    placeholder: "sk-...",
    helpUrl: "https://platform.openai.com/api-keys",
    helpText: "Get your API key from OpenAI Platform",
    models: [
      { id: "gpt-5.5", name: "GPT-5.5", description: "Newest flagship, frontier reasoning" },
      { id: "gpt-5.2", name: "GPT-5.2", description: "Enhanced reasoning, complex problem solving" },
      { id: "gpt-5", name: "GPT-5", description: "All-rounder, multimodal, 400K context" },
      { id: "gpt-5-mini", name: "GPT-5 Mini", description: "Cost-efficient strong performance" },
      { id: "gpt-5-nano", name: "GPT-5 Nano", description: "Fastest, cheapest GPT-5 tier" },
      { id: "gpt-5-codex", name: "GPT-5 Codex", description: "Agentic coding specialist" },
      { id: "gpt-4.1", name: "GPT-4.1", description: "Best legacy coding model" },
      { id: "o4-mini", name: "o4-mini", description: "Reasoning + tool use" },
      { id: "o3-pro", name: "o3 Pro", description: "Deep reasoning, extended compute" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic (Claude)",
    icon: "◎",
    placeholder: "sk-ant-...",
    helpUrl: "https://console.anthropic.com/settings/keys",
    helpText: "Get your API key from Anthropic Console",
    models: [
      { id: "claude-opus-4-5", name: "Claude Opus 4.5", description: "Newest flagship, smartest Claude, 1M context" },
      { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5", description: "Best agentic + coding model, 1M context" },
      { id: "claude-haiku-4-5", name: "Claude Haiku 4.5", description: "Fastest 4.x, near-Sonnet quality" },
      { id: "claude-opus-4-1", name: "Claude Opus 4.1", description: "Previous flagship, deep reasoning" },
      { id: "claude-sonnet-4", name: "Claude Sonnet 4", description: "Strong all-rounder" },
      { id: "claude-3-5-haiku-latest", name: "Claude 3.5 Haiku", description: "Legacy fast tier" },
    ],
  },
  {
    id: "xai",
    name: "xAI (Grok)",
    icon: "◌",
    placeholder: "xai-...",
    helpUrl: "https://console.x.ai/",
    helpText: "Get your API key from xAI Console",
    models: [
      { id: "grok-5", name: "Grok 5", description: "Newest flagship, frontier reasoning + real-time" },
      { id: "grok-4-1", name: "Grok 4.1", description: "Refined reasoning, 256K context" },
      { id: "grok-4-fast", name: "Grok 4 Fast", description: "2M context, sub-second latency" },
      { id: "grok-4-heavy", name: "Grok 4 Heavy", description: "Multi-agent ensemble reasoning" },
      { id: "grok-code-fast-1", name: "Grok Code Fast", description: "Agentic coding model" },
      { id: "grok-3", name: "Grok 3", description: "Reliable legacy" },
    ],
  },
  {
    id: "meta",
    name: "Meta AI (Llama)",
    icon: "◇",
    placeholder: "Your Llama API key...",
    helpUrl: "https://llama.developer.meta.com/",
    helpText: "Access via Llama API or compatible providers (Together, Groq)",
    models: [
      { id: "llama-4-behemoth", name: "Llama 4 Behemoth", description: "2T param frontier teacher model" },
      { id: "llama-4-maverick", name: "Llama 4 Maverick", description: "MoE flagship, multimodal, 1M context" },
      { id: "llama-4-scout", name: "Llama 4 Scout", description: "10M context window" },
      { id: "llama-3.3-70b", name: "Llama 3.3 70B", description: "Strong open-weight" },
      { id: "llama-3.1-405b", name: "Llama 3.1 405B", description: "Largest classic Llama" },
    ],
  },
  {
    id: "mistral",
    name: "Mistral AI",
    icon: "◐",
    placeholder: "Your Mistral API key...",
    helpUrl: "https://console.mistral.ai/api-keys/",
    helpText: "Get your API key from Mistral Console",
    models: [
      { id: "mistral-large-3", name: "Mistral Large 3", description: "Newest frontier flagship" },
      { id: "magistral-medium", name: "Magistral Medium", description: "Reasoning specialist" },
      { id: "mistral-medium-3-1", name: "Mistral Medium 3.1", description: "Frontier multimodal" },
      { id: "codestral-25", name: "Codestral 25", description: "Latest dedicated code model" },
      { id: "pixtral-large", name: "Pixtral Large", description: "Vision + multimodal" },
      { id: "ministral-8b", name: "Ministral 8B", description: "Fast edge model" },
    ],
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    icon: "◔",
    placeholder: "sk-...",
    helpUrl: "https://platform.deepseek.com/",
    helpText: "Get your API key from DeepSeek Platform",
    models: [
      { id: "deepseek-v3.2", name: "DeepSeek V3.2", description: "Latest flagship chat model" },
      { id: "deepseek-r1", name: "DeepSeek R1", description: "Frontier open reasoning" },
      { id: "deepseek-chat", name: "DeepSeek V3", description: "Stable production chat" },
      { id: "deepseek-coder-v2", name: "DeepSeek Coder V2", description: "Code-specialized MoE" },
    ],
  },
  {
    id: "perplexity",
    name: "Perplexity AI",
    icon: "◈",
    placeholder: "pplx-...",
    helpUrl: "https://www.perplexity.ai/settings/api",
    helpText: "Get your API key from Perplexity Settings",
    models: [
      { id: "sonar-pro", name: "Sonar Pro", description: "Multi-step search reasoning, 2x citations" },
      { id: "sonar-reasoning-pro", name: "Sonar Reasoning Pro", description: "R1-based reasoning + live search" },
      { id: "sonar-deep-research", name: "Sonar Deep Research", description: "Expert multi-query analysis" },
      { id: "sonar-reasoning", name: "Sonar Reasoning", description: "CoT with real-time search" },
      { id: "sonar", name: "Sonar", description: "Fast search-grounded answers" },
    ],
  },
  {
    id: "venice",
    name: "Venice AI",
    icon: "◆",
    placeholder: "Your Venice API key...",
    helpUrl: "https://venice.ai/",
    helpText: "Get your API key from Venice AI — uncensored, no logging",
    models: [
      { id: "venice-uncensored", name: "Venice Uncensored", description: "Default uncensored flagship" },
      { id: "llama-3.1-405b", name: "Llama 3.1 405B", description: "Largest open uncensored" },
      { id: "qwen-3-235b", name: "Qwen 3 235B", description: "Top open Chinese MoE" },
      { id: "dolphin-72b", name: "Dolphin 72B", description: "Zero-filter assistant" },
      { id: "deepseek-r1-671b", name: "DeepSeek R1 671B", description: "Uncensored reasoning monster" },
    ],
  },
  {
    id: "qwen",
    name: "Alibaba Qwen",
    icon: "◉",
    placeholder: "sk-...",
    helpUrl: "https://dashscope.console.aliyun.com/apiKey",
    helpText: "Get your API key from Alibaba Cloud DashScope",
    models: [
      { id: "qwen3-max", name: "Qwen3 Max", description: "Frontier flagship, trillion-param MoE" },
      { id: "qwen3-235b-a22b", name: "Qwen3 235B", description: "Top open MoE reasoning" },
      { id: "qwen3-coder-plus", name: "Qwen3 Coder Plus", description: "Agentic coding specialist" },
      { id: "qwen3-vl-plus", name: "Qwen3 VL Plus", description: "Vision + multimodal" },
      { id: "qwen-turbo", name: "Qwen Turbo", description: "Fast, low-cost tier" },
    ],
  },
  {
    id: "zhipu",
    name: "Zhipu AI (GLM)",
    icon: "◍",
    placeholder: "Your Zhipu API key...",
    helpUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    helpText: "Get your API key from Zhipu BigModel",
    models: [
      { id: "glm-4.6", name: "GLM-4.6", description: "Newest flagship reasoning + coding" },
      { id: "glm-4.5", name: "GLM-4.5", description: "Strong agentic + tool use" },
      { id: "glm-4.5-air", name: "GLM-4.5 Air", description: "Fast, cost-efficient" },
      { id: "glm-4v-plus", name: "GLM-4V Plus", description: "Vision multimodal" },
    ],
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    icon: "◗",
    placeholder: "sk-...",
    helpUrl: "https://platform.moonshot.cn/console/api-keys",
    helpText: "Get your API key from Moonshot Platform",
    models: [
      { id: "kimi-k2", name: "Kimi K2", description: "Trillion-param MoE flagship" },
      { id: "kimi-k2-turbo", name: "Kimi K2 Turbo", description: "High-speed K2 tier" },
      { id: "moonshot-v1-128k", name: "Moonshot v1 128K", description: "Long-context chat" },
      { id: "moonshot-v1-vision", name: "Moonshot Vision", description: "Vision multimodal" },
    ],
  },
  {
    id: "baidu",
    name: "Baidu ERNIE",
    icon: "◖",
    placeholder: "Your Qianfan API key...",
    helpUrl: "https://qianfan.cloud.baidu.com/",
    helpText: "Get your API key from Baidu Qianfan",
    models: [
      { id: "ernie-5.0", name: "ERNIE 5.0", description: "Latest flagship multimodal" },
      { id: "ernie-4.5-turbo", name: "ERNIE 4.5 Turbo", description: "Fast reasoning tier" },
      { id: "ernie-x1", name: "ERNIE X1", description: "Deep reasoning specialist" },
      { id: "ernie-speed", name: "ERNIE Speed", description: "Low-latency edge" },
    ],
  },
  {
    id: "minimax",
    name: "MiniMax",
    icon: "◙",
    placeholder: "Your MiniMax API key...",
    helpUrl: "https://www.minimaxi.com/user-center/basic-information/interface-key",
    helpText: "Get your API key from MiniMax",
    models: [
      { id: "minimax-m2", name: "MiniMax M2", description: "Newest agentic flagship" },
      { id: "abab7-chat-preview", name: "Abab 7 Chat", description: "Long-context chat" },
      { id: "minimax-text-01", name: "MiniMax Text-01", description: "4M-token context" },
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
      const providerName = provider === "default" ? "No model selected" : AI_PROVIDERS.find(p => p.id === provider)?.name;
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

  const hasKey = (providerId: string) => {
    const cfg = AI_PROVIDERS.find(p => p.id === providerId);
    if (cfg?.isPlatform) return true; // platform providers never need a user key
    return storedKeys.some(k => k.provider === providerId);
  };

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />;

  return (
    <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-5 space-y-5">
      <div className="flex items-center gap-3">
        <Key className="h-5 w-5 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-light text-foreground">AI Model Keys</h3>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">Bring your own API keys. Aureon never lends out a shared key — every request runs on the keys you add here.</p>
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
                  ? "No key selected — pick a provider below"
                  : `${AI_PROVIDERS.find(p => p.id === preferences.active_provider)?.name} → ${preferences.active_model}`
                }
              </p>
            </div>
          </div>
          {savingPref && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/40" />}
        </div>

        <div className="mt-3 pt-3 border-t border-border/10 flex items-start gap-2 text-[10px] text-muted-foreground/60">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-400/60" />
          <span>You can enable multiple providers at once and toggle them per-conversation from the chat header. Aureon does not provide a shared/default key.</span>
        </div>
      </div>

      {/* Provider list */}
      <div className="space-y-2">
        <p className="text-[10px] font-light tracking-wider text-muted-foreground/40 uppercase">Available Providers</p>
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
                  {/* Platform provider — no API key required */}
                  {provider.isPlatform && (
                    <div className="mt-2 rounded-lg border border-foreground/15 bg-foreground/5 p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-emerald-400/70" />
                        <p className="text-[11px] font-light text-foreground">Platform-hosted — no key required</p>
                      </div>
                      {provider.platformNote && (
                        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">{provider.platformNote}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/40">
                        <a href={provider.helpUrl} target="_blank" rel="noopener noreferrer" className="text-foreground/60 underline underline-offset-2 hover:text-foreground">{provider.helpText}</a>
                      </p>
                    </div>
                  )}

                  {/* Add/Update key — only for BYOK providers */}
                  {!provider.isPlatform && !isAdding && !stored && (
                    <button
                      onClick={() => { setAddingProvider(provider.id); setNewKeyValue(""); }}
                      className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border/20 bg-foreground/5 px-3 py-1.5 text-[11px] font-light text-foreground hover:bg-foreground/10 transition-colors"
                    >
                      <Plus className="h-3 w-3" /> Add API Key
                    </button>
                  )}

                  {!provider.isPlatform && isAdding && (
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

                  {/* Key management if stored — BYOK only */}
                  {!provider.isPlatform && stored && !isAdding && (
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
