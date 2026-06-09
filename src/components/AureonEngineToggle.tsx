import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Cpu, KeyRound, ChevronDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AI_PROVIDERS } from "@/components/dashboard/AIKeysSettings";

/**
 * Global Engine Toggle.
 *
 * Lets the user switch every AI-powered surface (free pages, paid features,
 * dashboard, standalone tools) between:
 *   1. AUREON ALGORITHM — the in-house Zophiel Algorithm → AUREON Brains route.
 *   2. BRING YOUR OWN MODEL — any provider/model the user has configured
 *      in Settings → AI Keys.
 *
 * Persisted via the existing `aureon_byok_active` localStorage contract,
 * which `src/lib/ai.ts` already reads on every chat call. No backend
 * changes needed — this is purely a UI surface over the existing router.
 */

const HIDDEN_ROUTES = ["/", "/pricing", "/terms", "/privacy", "/nda", "/unsubscribe"];

type Active = { provider: string; model: string; label: string };

const AUREON_ACTIVE: Active = {
  provider: "aureon",
  model: "aureon-algorithm",
  label: "Aureon Algorithm",
};

function loadActive(): Active {
  try {
    const raw = localStorage.getItem("aureon_byok_active");
    if (!raw) return AUREON_ACTIVE;
    const parsed = JSON.parse(raw);
    if (!parsed?.provider) return AUREON_ACTIVE;
    if (parsed.provider === "aureon") return AUREON_ACTIVE;
    const prov = AI_PROVIDERS.find((p) => p.id === parsed.provider);
    const mod = prov?.models.find((m) => m.id === parsed.model);
    if (prov && mod) {
      return { provider: prov.id, model: mod.id, label: `${prov.name} · ${mod.name}` };
    }
    return AUREON_ACTIVE;
  } catch {
    return AUREON_ACTIVE;
  }
}

export default function AureonEngineToggle() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Active>(AUREON_ACTIVE);
  const [storedProviders, setStoredProviders] = useState<string[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    setActive(loadActive());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (!uid) return;
      const { data } = await supabase
        .from("user_api_keys")
        .select("provider, is_active")
        .eq("user_id", uid)
        .eq("is_active", true);
      if (cancelled) return;
      setStoredProviders((data ?? []).map((k: any) => k.provider));
    })();
    return () => { cancelled = true; };
  }, [location.pathname]);

  const isHidden = HIDDEN_ROUTES.includes(location.pathname);
  if (isHidden) return null;

  const select = async (next: Active) => {
    setActive(next);
    localStorage.setItem(
      "aureon_byok_active",
      JSON.stringify({ provider: next.provider, model: next.model }),
    );
    if (userId) {
      await supabase.from("user_model_preferences").upsert({
        user_id: userId,
        active_provider: next.provider,
        active_model: next.model,
        fallback_to_default: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }
    setOpen(false);
  };

  const onAureon = active.provider === "aureon";
  const availableProviders = AI_PROVIDERS.filter((p) => storedProviders.includes(p.id));

  return (
    <div className="fixed bottom-4 right-4 z-[80]">
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-xl text-[10px] font-light tracking-wider shadow-2xl transition-all ${
            onAureon
              ? "border-foreground/15 bg-background/70 text-foreground/80 hover:bg-background/90"
              : "border-accent/30 bg-accent/10 text-accent hover:bg-accent/15"
          }`}
          title="Switch AI Engine"
        >
          {onAureon ? <Cpu className="h-3 w-3" /> : <KeyRound className="h-3 w-3" />}
          <span className="max-w-[140px] truncate">{active.label}</span>
          <ChevronDown className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute bottom-full right-0 mb-2 w-72 rounded-xl border border-border/30 bg-card/95 backdrop-blur-2xl shadow-2xl p-2 space-y-1 animate-fade-in">
            <div className="px-2.5 py-1.5 border-b border-border/15">
              <p className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/50 uppercase">
                AI Engine
              </p>
              <p className="text-[9px] text-muted-foreground/40 mt-0.5 leading-relaxed">
                Applies to every AI surface in the app.
              </p>
            </div>

            {/* Aureon Algorithm */}
            <button
              onClick={() => select(AUREON_ACTIVE)}
              className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all border ${
                onAureon
                  ? "bg-foreground/10 border-foreground/20"
                  : "border-transparent hover:bg-foreground/5"
              }`}
            >
              <div className="w-6 h-6 rounded-md bg-foreground/10 flex items-center justify-center text-[10px] text-foreground shrink-0">
                ◈
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-light text-foreground block">Aureon Algorithm</span>
                <span className="text-[9px] text-muted-foreground/50">Zophiel Algorithm → AUREON Brains</span>
              </div>
              {onAureon && <Check className="h-3 w-3 text-accent shrink-0" />}
            </button>




            {/* BYOK providers */}
            <div className="px-2.5 pt-2 pb-1">
              <span className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/40 uppercase">
                Bring Your Own Model
              </span>
            </div>

            {availableProviders.length === 0 ? (
              <button
                onClick={() => { setOpen(false); navigate("/dashboard/settings?panel=ai-keys"); }}
                className="w-full text-left rounded-lg px-2.5 py-2 text-[10px] font-light text-muted-foreground/70 hover:bg-foreground/5 border border-dashed border-border/30"
              >
                + Connect a provider in Settings → AI Keys
              </button>
            ) : (
              <div className="max-h-[240px] overflow-y-auto space-y-0.5">
                {availableProviders.map((provider) => (
                  <div key={provider.id}>
                    <div className="px-2.5 pt-1.5 pb-0.5">
                      <span className="text-[9px] font-light tracking-widest text-muted-foreground/40 uppercase">
                        {provider.icon} {provider.name}
                      </span>
                    </div>
                    {provider.models.map((model) => {
                      const isActive = active.provider === provider.id && active.model === model.id;
                      return (
                        <button
                          key={model.id}
                          onClick={() => select({
                            provider: provider.id,
                            model: model.id,
                            label: `${provider.name} · ${model.name}`,
                          })}
                          className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-all ${
                            isActive
                              ? "bg-accent/10 border border-accent/20"
                              : "border border-transparent hover:bg-foreground/5"
                          }`}
                        >
                          <KeyRound className={`h-2.5 w-2.5 shrink-0 ${isActive ? "text-accent" : "text-muted-foreground/40"}`} />
                          <div className="flex-1 min-w-0">
                            <span className={`text-[10px] font-light block truncate ${isActive ? "text-foreground" : "text-muted-foreground/70"}`}>
                              {model.name}
                            </span>
                            {model.description && (
                              <span className="text-[8px] text-muted-foreground/40 truncate block">
                                {model.description}
                              </span>
                            )}
                          </div>
                          {isActive && <Check className="h-2.5 w-2.5 text-accent shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            <p className="text-[8px] text-muted-foreground/40 px-2.5 pt-2 border-t border-border/10 leading-relaxed">
              Switching here updates every AI feature instantly. Manage keys in Settings → AI Keys.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
