import { useEffect, useMemo, useState } from "react";
import { X, Eye, EyeOff, ExternalLink, Check, Trash2, KeyRound, Zap } from "lucide-react";
import {
  INTEL_MAP_PROVIDERS,
  IntelMapByok,
  IntelMapByokProvider,
  clearIntelMapByok,
  getIntelMapByok,
  getProviderSpec,
  isIntelMapByokEnabled,
  saveIntelMapByok,
  setIntelMapByokEnabled,
} from "@/lib/intelMapByok";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called whenever BYOK state changes (saved/cleared/enabled). */
  onChange?: () => void;
}

const IntelMapByokPanel = ({ open, onClose, onChange }: Props) => {
  const existing = useMemo(() => (open ? getIntelMapByok() : null), [open]);
  const enabledInit = useMemo(() => (open ? isIntelMapByokEnabled() : false), [open]);

  const [provider, setProvider] = useState<IntelMapByokProvider>(existing?.provider ?? "google");
  const [model, setModel] = useState<string>(existing?.model ?? "gemini-2.5-flash");
  const [customModel, setCustomModel] = useState<string>("");
  const [useCustom, setUseCustom] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>(existing?.apiKey ?? "");
  const [showKey, setShowKey] = useState(false);
  const [enabled, setEnabled] = useState<boolean>(enabledInit);
  const [status, setStatus] = useState<{ type: "idle" | "ok" | "err"; msg?: string }>({ type: "idle" });

  // Re-sync when reopened
  useEffect(() => {
    if (!open) return;
    const cur = getIntelMapByok();
    if (cur) {
      setProvider(cur.provider);
      const spec = getProviderSpec(cur.provider);
      const known = spec?.models.some((m) => m.id === cur.model);
      setUseCustom(!known);
      setModel(known ? cur.model : (spec?.models[0]?.id || ""));
      setCustomModel(known ? "" : cur.model);
      setApiKey(cur.apiKey);
    } else {
      setProvider("google");
      setModel("gemini-2.5-flash");
      setUseCustom(false);
      setCustomModel("");
      setApiKey("");
    }
    setEnabled(isIntelMapByokEnabled());
    setStatus({ type: "idle" });
  }, [open]);

  const spec = getProviderSpec(provider);

  const onProviderChange = (next: IntelMapByokProvider) => {
    setProvider(next);
    const s = getProviderSpec(next);
    setModel(s?.models[0]?.id || "");
    setUseCustom(false);
    setCustomModel("");
    setStatus({ type: "idle" });
  };

  const effectiveModel = useCustom ? customModel.trim() : model;
  const canSave = !!apiKey.trim() && !!effectiveModel && !!provider;

  const handleSave = () => {
    if (!canSave) return;
    const cfg: IntelMapByok = {
      provider,
      model: effectiveModel,
      apiKey: apiKey.trim(),
    };
    saveIntelMapByok(cfg);
    setIntelMapByokEnabled(true);
    setEnabled(true);
    setStatus({ type: "ok", msg: "Key saved on this device. Queue will be skipped." });
    onChange?.();
  };

  const handleToggle = (next: boolean) => {
    if (next && !getIntelMapByok()) {
      setStatus({ type: "err", msg: "Save your API key first." });
      return;
    }
    setIntelMapByokEnabled(next);
    setEnabled(next);
    onChange?.();
  };

  const handleClear = () => {
    clearIntelMapByok();
    setApiKey("");
    setEnabled(false);
    setStatus({ type: "ok", msg: "Removed from this device." });
    onChange?.();
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-start justify-center bg-background/70 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg my-8 rounded-2xl border border-border/30 bg-card/95 backdrop-blur-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-foreground/[0.04] border border-border/30">
              <Zap className="h-4 w-4 text-foreground/80" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground">
                Skip the Queue
              </div>
              <div className="text-sm font-light text-foreground">
                Bring Your Own AI Key
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-[11px] font-light text-muted-foreground leading-relaxed">
            Use any supported AI model with your own API key. The key is stored
            <span className="text-foreground/80"> only on this device</span> (browser
            localStorage) and is sent directly through the Zophiel Engine to the
            provider you choose. We never save it to our database.
          </p>

          {/* Enabled toggle */}
          <div className="flex items-center justify-between rounded-xl border border-border/30 bg-foreground/[0.02] px-4 py-3">
            <div>
              <div className="text-xs font-light text-foreground">Use my key (skip queue)</div>
              <div className="text-[10px] font-light text-muted-foreground/70 mt-0.5">
                When ON, the engine bypasses the shared queue.
              </div>
            </div>
            <button
              onClick={() => handleToggle(!enabled)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                enabled ? "bg-foreground/80" : "bg-foreground/15"
              }`}
              aria-pressed={enabled}
              aria-label="Toggle BYOK"
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-background transition-transform ${
                  enabled ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Provider */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-light tracking-[0.18em] uppercase text-muted-foreground">
              Provider
            </label>
            <select
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as IntelMapByokProvider)}
              className="w-full rounded-lg border border-border/30 bg-background/50 px-3 py-2 text-sm font-light text-foreground focus:outline-none focus:border-foreground/40"
            >
              {INTEL_MAP_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-light tracking-[0.18em] uppercase text-muted-foreground">
              Model
            </label>
            {!useCustom ? (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-lg border border-border/30 bg-background/50 px-3 py-2 text-sm font-light text-foreground focus:outline-none focus:border-foreground/40"
              >
                {spec?.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="e.g. gpt-4.1-mini"
                className="w-full rounded-lg border border-border/30 bg-background/50 px-3 py-2 text-sm font-light text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/40"
              />
            )}
            {spec?.allowCustomModel && (
              <button
                type="button"
                onClick={() => setUseCustom((v) => !v)}
                className="text-[10px] font-light text-muted-foreground hover:text-foreground transition-colors"
              >
                {useCustom ? "← Use a preset model" : "Use a custom model id →"}
              </button>
            )}
          </div>

          {/* API Key */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-light tracking-[0.18em] uppercase text-muted-foreground flex items-center justify-between">
              <span>API Key</span>
              {spec && (
                <a
                  href={spec.helpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 normal-case tracking-normal text-muted-foreground/70 hover:text-foreground transition-colors"
                >
                  Get a key <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={spec?.placeholder || "Your API key..."}
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-lg border border-border/30 bg-background/50 pl-9 pr-10 py-2 text-sm font-light text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/40"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                aria-label={showKey ? "Hide key" : "Show key"}
              >
                {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            {spec && (
              <p className="text-[10px] font-light text-muted-foreground/70">{spec.helpText}</p>
            )}
          </div>

          {/* Status */}
          {status.type !== "idle" && (
            <div
              className={`text-[11px] font-light rounded-lg px-3 py-2 border ${
                status.type === "ok"
                  ? "border-foreground/20 bg-foreground/[0.04] text-foreground/80"
                  : "border-destructive/30 bg-destructive/5 text-destructive"
              }`}
            >
              {status.msg}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-2 px-5 py-3.5 border-t border-border/20">
          <button
            onClick={handleClear}
            disabled={!getIntelMapByok()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-light text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove key
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-[11px] font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[11px] font-light bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="h-3.5 w-3.5" /> Save & Enable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntelMapByokPanel;
