// Inline BYOK input for the Zaxin tab. Lets the operator paste a key without
// leaving AR Vision and without going to Settings → API Keys / Zophiel BYOK.

import { useState } from "react";
import { Key, Save } from "lucide-react";
import type { IntelMapByok, IntelMapByokProvider } from "@/lib/intelMapByok";

interface Props {
  onSave: (cfg: IntelMapByok) => void;
}

const PROVIDERS: { id: IntelMapByokProvider; name: string; defaultModel: string; placeholder: string }[] = [
  { id: "google", name: "Google (Gemini)", defaultModel: "gemini-2.5-flash", placeholder: "AIzaSy..." },
  { id: "openai", name: "OpenAI (GPT)", defaultModel: "gpt-4o-mini", placeholder: "sk-..." },
];

export default function ZaxinInlineByok({ onSave }: Props) {
  const [provider, setProvider] = useState<IntelMapByokProvider>("google");
  const [model, setModel] = useState<string>(PROVIDERS[0].defaultModel);
  const [apiKey, setApiKey] = useState<string>("");
  const [show, setShow] = useState(false);

  const spec = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];

  return (
    <div className="mt-3 rounded-md border border-[#c69a4a]/25 bg-black/40 p-3 space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] tracking-[0.18em] uppercase text-[#e8c684]/85">
        <Key className="h-3 w-3" /> Paste key here (stays on this device)
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          value={provider}
          onChange={(e) => {
            const id = e.target.value as IntelMapByokProvider;
            setProvider(id);
            const next = PROVIDERS.find((p) => p.id === id);
            if (next) setModel(next.defaultModel);
          }}
          className="bg-black/60 border border-[#c69a4a]/30 rounded-md px-2 py-1.5 text-[11px] text-foreground/90"
          aria-label="API provider"
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="model id (e.g. gemini-2.5-flash)"
          className="bg-black/60 border border-[#c69a4a]/30 rounded-md px-2 py-1.5 text-[11px] font-mono text-foreground/90"
          aria-label="Model id"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type={show ? "text" : "password"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={spec.placeholder}
          className="flex-1 bg-black/60 border border-[#c69a4a]/30 rounded-md px-2 py-1.5 text-[11px] font-mono text-foreground/90"
          aria-label="API key"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="text-[9px] tracking-[0.18em] uppercase text-foreground/55 hover:text-[#e8c684]"
        >
          {show ? "hide" : "show"}
        </button>
        <button
          type="button"
          disabled={!apiKey.trim() || !model.trim()}
          onClick={() => {
            onSave({ provider, model: model.trim(), apiKey: apiKey.trim() });
            setApiKey("");
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] tracking-[0.18em] uppercase border border-[#c69a4a]/40 text-[#e8c684] hover:bg-[#c69a4a]/[0.1] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save className="h-3 w-3" /> Save
        </button>
      </div>
      <div className="text-[9px] tracking-[0.16em] uppercase text-muted-foreground/55">
        Stored locally only. Used by Zaxin AR Vision + Tactical Brief.
      </div>
    </div>
  );
}
