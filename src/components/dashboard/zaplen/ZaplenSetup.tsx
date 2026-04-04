import { useState } from "react";
import { Bot, User, Key, Crown, Swords } from "lucide-react";
import type { GameConfig, OpponentType, PlayerColor } from "./ZaplenView";

interface Props {
  onStart: (config: GameConfig) => void;
}

const BYOK_PROVIDERS = [
  { id: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4", "gpt-3.5-turbo"] },
  { id: "anthropic", label: "Anthropic", models: ["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"] },
  { id: "google", label: "Google", models: ["gemini-pro", "gemini-flash"] },
  { id: "xai", label: "xAI", models: ["grok-2", "grok-beta"] },
  { id: "deepseek", label: "DeepSeek", models: ["deepseek-chat", "deepseek-reasoner"] },
  { id: "meta", label: "Meta", models: ["llama-3-70b", "llama-3-8b"] },
];

const ZaplenSetup = ({ onStart }: Props) => {
  const [opponent, setOpponent] = useState<OpponentType>("aureon");
  const [playerColor, setPlayerColor] = useState<PlayerColor>("white");
  const [byokProvider, setByokProvider] = useState(BYOK_PROVIDERS[0].id);
  const [byokModel, setByokModel] = useState(BYOK_PROVIDERS[0].models[0]);

  const selectedProvider = BYOK_PROVIDERS.find(p => p.id === byokProvider);

  return (
    <div className="max-w-xl mx-auto px-6 py-10 space-y-8">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-4">
          <Swords className="h-7 w-7 text-red-400" />
        </div>
        <h2 className="text-lg font-light tracking-[0.06em] text-foreground">Chess — War Scenario I</h2>
        <p className="text-xs text-muted-foreground/50 font-extralight leading-relaxed max-w-sm mx-auto">
          Strategic combat simulation. Play against Aureon's full intelligence stack, challenge yourself, or bring an external AI opponent via API.
        </p>
      </div>

      {/* Opponent Selection */}
      <div className="space-y-3">
        <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 font-light">Opponent</label>
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: "aureon" as OpponentType, icon: Bot, label: "Aureon AI", desc: "Full intelligence" },
            { id: "human" as OpponentType, icon: User, label: "Human vs Human", desc: "Local play" },
            { id: "byok" as OpponentType, icon: Key, label: "Bring AI", desc: "Your API key" },
          ]).map(opt => (
            <button
              key={opt.id}
              onClick={() => setOpponent(opt.id)}
              className={`rounded-xl border p-4 text-left transition-all ${
                opponent === opt.id
                  ? "border-red-500/40 bg-red-500/[0.06]"
                  : "border-border/10 bg-card/5 hover:bg-foreground/[0.03]"
              }`}
            >
              <opt.icon className={`h-4 w-4 mb-2 ${opponent === opt.id ? "text-red-400" : "text-muted-foreground/50"}`} />
              <p className="text-[11px] font-light text-foreground">{opt.label}</p>
              <p className="text-[9px] text-muted-foreground/40 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* BYOK Config */}
      {opponent === "byok" && (
        <div className="space-y-3 rounded-xl border border-border/10 bg-card/5 p-4">
          <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 font-light">External AI Configuration</label>
          <p className="text-[9px] text-muted-foreground/40">Uses the API key you've configured in Settings → AI Keys</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-[10px] text-muted-foreground/50">Provider</span>
              <select
                value={byokProvider}
                onChange={e => {
                  setByokProvider(e.target.value);
                  const prov = BYOK_PROVIDERS.find(p => p.id === e.target.value);
                  if (prov) setByokModel(prov.models[0]);
                }}
                className="w-full rounded-lg border border-border/15 bg-background/50 px-3 py-2 text-xs text-foreground focus:outline-none"
              >
                {BYOK_PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <span className="text-[10px] text-muted-foreground/50">Model</span>
              <select
                value={byokModel}
                onChange={e => setByokModel(e.target.value)}
                className="w-full rounded-lg border border-border/15 bg-background/50 px-3 py-2 text-xs text-foreground focus:outline-none"
              >
                {selectedProvider?.models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Color Selection (when playing against AI) */}
      {opponent !== "human" && (
        <div className="space-y-3">
          <label className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 font-light">Play As</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: "white" as PlayerColor, label: "White", desc: "Move first" },
              { id: "black" as PlayerColor, label: "Black", desc: "Respond second" },
            ]).map(opt => (
              <button
                key={opt.id}
                onClick={() => setPlayerColor(opt.id)}
                className={`rounded-xl border p-4 text-center transition-all ${
                  playerColor === opt.id
                    ? "border-red-500/40 bg-red-500/[0.06]"
                    : "border-border/10 bg-card/5 hover:bg-foreground/[0.03]"
                }`}
              >
                <Crown className={`h-4 w-4 mx-auto mb-1 ${opt.id === "white" ? "text-foreground/80" : "text-muted-foreground/60"}`} />
                <p className="text-[11px] font-light text-foreground">{opt.label}</p>
                <p className="text-[9px] text-muted-foreground/40">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Start Button */}
      <button
        onClick={() => onStart({
          opponent,
          playerColor,
          byokProvider: opponent === "byok" ? byokProvider : undefined,
          byokModel: opponent === "byok" ? byokModel : undefined,
        })}
        className="w-full py-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-light tracking-wide hover:bg-red-500/30 transition-colors"
      >
        Begin War Scenario
      </button>
    </div>
  );
};

export default ZaplenSetup;
