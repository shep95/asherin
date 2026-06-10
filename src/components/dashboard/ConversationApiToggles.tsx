import { useState, useEffect } from "react";
import { Key, ChevronDown, X, Power } from "lucide-react";
import { AI_PROVIDERS } from "./AIKeysSettings";

interface Props {
  conversationId: string;
  storedProviders: string[]; // providers that have API keys stored
}

const STORAGE_KEY = "aureon_conv_api_toggles";

function loadToggles(convId: string): Record<string, boolean> {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return all[convId] || {};
  } catch {
    return {};
  }
}

function saveToggles(convId: string, toggles: Record<string, boolean>) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all[convId] = toggles;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

export function getActiveProviders(conversationId: string, storedProviders: string[]): string[] {
  const toggles = loadToggles(conversationId);
  // Providers default ON unless explicitly disabled (=== false) — matches the
  // semantics enforced in src/lib/ai.ts.
  return storedProviders.filter(p => toggles[p] !== false);
}

const ConversationApiToggles = ({ conversationId, storedProviders }: Props) => {
  const [open, setOpen] = useState(false);
  const [toggles, setToggles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setToggles(loadToggles(conversationId));
  }, [conversationId]);

  // Default ON unless the user has explicitly toggled OFF (=== false).
  const isActive = (providerId: string) => toggles[providerId] !== false;

  const handleToggle = (providerId: string) => {
    const updated = { ...toggles, [providerId]: !isActive(providerId) };
    setToggles(updated);
    saveToggles(conversationId, updated);
  };

  const activeCount = storedProviders.filter(p => isActive(p)).length;

  if (storedProviders.length === 0) return null;

  const connectedProviders = AI_PROVIDERS.filter(p => storedProviders.includes(p.id));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-light transition-all border ${
          open
            ? "bg-foreground/10 text-foreground border-foreground/20"
            : "text-muted-foreground/50 hover:text-muted-foreground/70 border-transparent hover:border-border/20"
        }`}
        title="API Connections"
      >
        <Key className="h-3 w-3" />
        <span className="hidden sm:inline">APIs</span>
        <span className="bg-foreground/15 rounded-full px-1.5 text-[9px]">
          {activeCount}/{storedProviders.length}
        </span>
        <ChevronDown className={`h-2.5 w-2.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1.5 z-50 w-72 rounded-xl border border-border/20 bg-card/95 backdrop-blur-xl shadow-2xl p-3 space-y-2 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-light tracking-wider text-muted-foreground/50 uppercase">
              Connected APIs
            </p>
            <button onClick={() => setOpen(false)} className="text-muted-foreground/40 hover:text-muted-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Aureon Default removed — all chat runs on the user's connected BYOK providers. */}

          {/* BYOK providers */}
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {connectedProviders.map((provider) => {
              const active = isActive(provider.id);
              return (
                <button
                  key={provider.id}
                  onClick={() => handleToggle(provider.id)}
                  className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all border ${
                    active
                      ? "bg-foreground/5 border-foreground/15 hover:bg-foreground/10"
                      : "bg-transparent border-border/10 opacity-50 hover:opacity-70"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] shrink-0 transition-colors ${
                    active ? "bg-foreground/10 text-foreground" : "bg-border/10 text-muted-foreground/40"
                  }`}>
                    {provider.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-[11px] font-light block truncate ${active ? "text-foreground" : "text-muted-foreground/60"}`}>
                      {provider.name}
                    </span>
                    <span className="text-[9px] text-muted-foreground/40">
                      {provider.models.length} model{provider.models.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Power className={`h-3 w-3 ${active ? "text-emerald-400" : "text-muted-foreground/30"}`} />
                    <span className={`text-[9px] ${active ? "text-emerald-400/70" : "text-muted-foreground/30"}`}>
                      {active ? "ON" : "OFF"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-[9px] text-muted-foreground/30 pt-1">
            Toggle APIs on/off for this conversation. Manage keys in Settings → AI Model Keys.
          </p>
        </div>
      )}
    </div>
  );
};

export default ConversationApiToggles;
