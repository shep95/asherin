import AIKeysSettings from "@/components/dashboard/AIKeysSettings";
import { Settings as SettingsIcon, Key } from "lucide-react";

/**
 * Asher Settings — operator preferences + Bring Your Own LLM API Key.
 * Reuses Asherin's AIKeysSettings component so the operator can toggle
 * provider + model exactly like in the main Asherin system. When BYOK is
 * active, the Asher AI / Asherin Command Center will route through the
 * operator's own key instead of the platform key.
 */
const AsherSettingsModule = () => {
  return (
    <div className="h-full w-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-4xl px-6 py-8 space-y-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <SettingsIcon className="h-3.5 w-3.5 text-foreground/60" strokeWidth={1.5} />
            <p className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">
              Operator Settings
            </p>
          </div>
          <h1 className="text-2xl font-extralight tracking-wide text-foreground">Asher Settings</h1>
          <p className="text-xs font-light text-muted-foreground/70 mt-1">
            Configure runtime preferences and bring-your-own-key providers.
          </p>
        </div>

        <div className="rounded-2xl border border-border/15 bg-card/30 backdrop-blur-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <Key className="h-3.5 w-3.5 text-foreground/60" strokeWidth={1.5} />
            <p className="text-[10px] font-light tracking-[0.3em] text-foreground/80 uppercase">
              Bring Your Own LLM Key (BYOK)
            </p>
          </div>
          <p className="text-xs font-light text-muted-foreground/70 mb-6 leading-relaxed">
            Toggle individual AI providers on/off and supply your own API keys. When a provider is
            active and a key is saved, Asher AI will route requests through your key instead of the
            platform's. Keys are encrypted at rest and never shared.
          </p>
          <AIKeysSettings />
        </div>
      </div>
    </div>
  );
};

export default AsherSettingsModule;
