import { useState, useEffect } from "react";
import { ChevronDown, Key, Zap, Check, X } from "lucide-react";
import { AI_PROVIDERS } from "../AIKeysSettings";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface StoredKey {
  provider: string;
  is_active: boolean;
}

interface ActiveModel {
  provider: string;
  model: string;
  label: string;
}

const IdeModelSelector = () => {
  const { user } = useAuth();
  const { subscribed } = useSubscription();
  const [open, setOpen] = useState(false);
  const [storedProviders, setStoredProviders] = useState<string[]>([]);
  const [active, setActive] = useState<ActiveModel>({ provider: "default", model: "default", label: "Aureon Default" });

  // Load stored keys
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_api_keys")
      .select("provider, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .then(({ data }) => {
        setStoredProviders((data as StoredKey[] | null)?.map(k => k.provider) ?? []);
      });
  }, [user]);

  // Load current preference from localStorage
  useEffect(() => {
    try {
      const cached = localStorage.getItem("aureon_byok_active");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.provider && parsed.provider !== "default") {
          const prov = AI_PROVIDERS.find(p => p.id === parsed.provider);
          const mod = prov?.models.find(m => m.id === parsed.model);
          if (prov && mod) {
            setActive({ provider: parsed.provider, model: parsed.model, label: `${prov.name} → ${mod.name}` });
          }
        }
      }
    } catch { /* ignore */ }
  }, []);

  const selectModel = async (provider: string, model: string, label: string) => {
    setActive({ provider, model, label });
    localStorage.setItem("aureon_byok_active", JSON.stringify({ provider, model }));

    // Persist to DB
    if (user) {
      await supabase.from("user_model_preferences").upsert({
        user_id: user.id,
        active_provider: provider,
        active_model: model,
        fallback_to_default: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }
    setOpen(false);
  };

  const availableProviders = AI_PROVIDERS.filter(p => storedProviders.includes(p.id));

  if (!subscribed || availableProviders.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-light transition-colors border ${
          active.provider !== "default"
            ? "border-accent/30 bg-accent/10 text-accent"
            : "border-border/20 text-muted-foreground/50 hover:text-foreground"
        }`}
        title="Select AI Model"
      >
        <Key className="h-2.5 w-2.5" />
        <span className="truncate max-w-[70px]">
          {active.provider !== "default" ? active.label.split(" → ").pop() : "No model"}
        </span>
        <ChevronDown className={`h-2 w-2 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-56 z-50 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl p-2 space-y-1 animate-fade-in">
          <div className="flex items-center justify-between px-2 pb-1 border-b border-border/15">
            <span className="text-[9px] font-light tracking-widest text-muted-foreground/50 uppercase">Model</span>
            <button onClick={() => setOpen(false)} className="text-muted-foreground/40 hover:text-foreground">
              <X className="h-2.5 w-2.5" />
            </button>
          </div>

          {/* "Aureon Default" removed — IDE runs on the user's BYOK model only. */}

          {/* BYOK providers */}
          <div className="space-y-0.5 max-h-[240px] overflow-y-auto">
            {availableProviders.map(provider => (
              <div key={provider.id}>
                <div className="px-2.5 pt-1.5 pb-0.5">
                  <span className="text-[8px] font-light tracking-widest text-muted-foreground/40 uppercase">
                    {provider.icon} {provider.name}
                  </span>
                </div>
                {provider.models.map(model => {
                  const isActive = active.provider === provider.id && active.model === model.id;
                  return (
                    <button
                      key={model.id}
                      onClick={() => selectModel(provider.id, model.id, `${provider.name} → ${model.name}`)}
                      className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-all ${
                        isActive ? "bg-accent/10 border border-accent/20" : "border border-transparent hover:bg-foreground/5"
                      }`}
                    >
                      <Zap className={`h-2.5 w-2.5 shrink-0 ${isActive ? "text-accent" : "text-muted-foreground/30"}`} />
                      <div className="flex-1 min-w-0">
                        <span className={`text-[10px] font-light block truncate ${isActive ? "text-foreground" : "text-muted-foreground/70"}`}>
                          {model.name}
                        </span>
                        <span className="text-[8px] text-muted-foreground/30 truncate block">{model.description}</span>
                      </div>
                      {isActive && <Check className="h-2.5 w-2.5 text-accent shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <p className="text-[8px] text-muted-foreground/30 px-2 pt-1 border-t border-border/10">
            Manage keys in Settings → AI Model Keys
          </p>
        </div>
      )}
    </div>
  );
};

export default IdeModelSelector;
