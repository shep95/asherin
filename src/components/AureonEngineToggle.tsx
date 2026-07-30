import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { KeyRound, ChevronDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AI_PROVIDERS } from "@/lib/aiProviders";

/**
 * Global Model Picker.
 *
 * BYOK-ONLY: every AI surface runs on the user's own provider key. There is
 * no in-house fallback model. If no provider is connected, this widget
 * routes the user to Settings → AI Keys to add one.
 *
 * Persisted via the existing `aureon_byok_active` localStorage contract,
 * which `src/lib/ai.ts` reads on every chat call.
 */

const HIDDEN_ROUTES = ["/", "/pricing", "/terms", "/privacy", "/nda", "/unsubscribe"];

type Active = { provider: string; model: string; label: string } | null;

function loadActive(): Active {
  try {
    const raw = localStorage.getItem("aureon_byok_active");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.provider) return null;
    // Ignore legacy in-house engine entries.
    if (parsed.provider === "aureon" || parsed.provider === "default") return null;
    const prov = AI_PROVIDERS.find((p) => p.id === parsed.provider);
    const mod = prov?.models.find((m) => m.id === parsed.model);
    if (prov && mod) {
      return { provider: prov.id, model: mod.id, label: `${prov.name} · ${mod.name}` };
    }
    return null;
  } catch {
    return null;
  }
}

export default function AureonEngineToggle() {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Active>(null);
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

  const select = async (next: NonNullable<Active>) => {
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

  const availableProviders = AI_PROVIDERS.filter((p) => storedProviders.includes(p.id));
  const label = active?.label ?? "No model — connect a key";

  return (
    <div className="fixed bottom-4 right-4 z-[80]">
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 backdrop-blur-xl text-[10px] font-light tracking-wider shadow-2xl transition-all ${
            active
              ? "border-accent/30 bg-accent/10 text-accent hover:bg-accent/15"
              : "border-foreground/15 bg-background/70 text-foreground/70 hover:bg-background/90"
          }`}
          title="Switch AI Model"
        >
          <KeyRound className="h-3 w-3" />
          <span className="max-w-[160px] truncate">{label}</span>
          <ChevronDown className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute bottom-full right-0 mb-2 w-72 rounded-xl border border-border/30 bg-card/95 backdrop-blur-2xl shadow-2xl p-2 space-y-1 animate-fade-in">
            <div className="px-2.5 py-1.5 border-b border-border/15">
              <p className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/50 uppercase">
                Active AI Model
              </p>
              <p className="text-[9px] text-muted-foreground/40 mt-0.5 leading-relaxed">
                Bring your own provider key — applies to every AI surface.
              </p>
            </div>

            <div className="px-2.5 pt-2 pb-1">
              <span className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/40 uppercase">
                Your Connected Providers
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
              <div className="max-h-[280px] overflow-y-auto space-y-0.5">
                {availableProviders.map((provider) => (
                  <div key={provider.id}>
                    <div className="px-2.5 pt-1.5 pb-0.5">
                      <span className="text-[9px] font-light tracking-widest text-muted-foreground/40 uppercase">
                        {provider.icon} {provider.name}
                      </span>
                    </div>
                    {provider.models.map((model) => {
                      const isActive = active?.provider === provider.id && active?.model === model.id;
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
              Manage keys in Settings → AI Keys. Asherin does not ship a default model.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
