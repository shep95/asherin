import { useState } from "react";
import { Bot, User, Key, Crown, Swords, Zap, Eye } from "lucide-react";
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

  const modes = [
    { id: "aureon" as OpponentType, icon: Bot, label: "You vs Aureon", desc: "Challenge the full intelligence stack" },
    { id: "human" as OpponentType, icon: User, label: "Human vs Human", desc: "Local two-player" },
    { id: "byok" as OpponentType, icon: Zap, label: "AI vs Aureon", desc: "Pit your AI against Aureon" },
  ];

  return (
    <div className="max-w-lg mx-auto px-6 py-10 space-y-8">
      {/* Title */}
      <div className="text-center space-y-3">
        <div className="w-14 h-14 rounded-2xl bg-foreground/[0.04] backdrop-blur-sm border border-border/[0.08] flex items-center justify-center mx-auto">
          <Swords className="h-6 w-6 text-foreground/50" />
        </div>
        <h2 className="text-base font-extralight tracking-[0.1em] text-foreground/90">Chess — War Scenario I</h2>
        <p className="text-[11px] text-muted-foreground/40 font-extralight leading-relaxed max-w-xs mx-auto">
          Strategic combat simulation. Play against Aureon, challenge a friend, or watch your AI battle Aureon's intelligence.
        </p>
      </div>

      {/* Mode Selection */}
      <div className="space-y-2.5">
        <label className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 font-light">Game Mode</label>
        <div className="space-y-2">
          {modes.map(opt => (
            <button
              key={opt.id}
              onClick={() => setOpponent(opt.id)}
              className={`w-full rounded-2xl border p-4 text-left transition-all backdrop-blur-sm ${
                opponent === opt.id
                  ? "border-foreground/[0.12] bg-foreground/[0.05]"
                  : "border-border/[0.06] bg-foreground/[0.02] hover:bg-foreground/[0.04]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                  opponent === opt.id ? "bg-foreground/[0.08]" : "bg-foreground/[0.03]"
                }`}>
                  <opt.icon className={`h-3.5 w-3.5 ${opponent === opt.id ? "text-foreground/70" : "text-muted-foreground/40"}`} />
                </div>
                <div>
                  <p className={`text-[11px] font-light ${opponent === opt.id ? "text-foreground/90" : "text-foreground/60"}`}>{opt.label}</p>
                  <p className="text-[9px] text-muted-foreground/35 mt-0.5">{opt.desc}</p>
                </div>
                {opt.id === "byok" && (
                  <div className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full bg-foreground/[0.04] border border-border/[0.06]">
                    <Eye className="h-2.5 w-2.5 text-muted-foreground/40" />
                    <span className="text-[8px] text-muted-foreground/40 uppercase tracking-wider">Spectate</span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* BYOK Config */}
      {opponent === "byok" && (
        <div className="space-y-3 rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <Key className="h-3 w-3 text-muted-foreground/40" />
            <label className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 font-light">Challenger AI</label>
          </div>
          <p className="text-[9px] text-muted-foreground/30 leading-relaxed">
            Select which AI model will challenge Aureon. Uses API keys from Settings ◇ AI Keys.
          </p>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="space-y-1.5">
              <span className="text-[9px] text-muted-foreground/40 tracking-wide">Provider</span>
              <select
                value={byokProvider}
                onChange={e => {
                  setByokProvider(e.target.value);
                  const prov = BYOK_PROVIDERS.find(p => p.id === e.target.value);
                  if (prov) setByokModel(prov.models[0]);
                }}
                className="w-full rounded-xl border border-border/[0.1] bg-background/60 backdrop-blur-sm px-3 py-2.5 text-[11px] text-foreground/80 focus:outline-none focus:border-foreground/[0.15] transition-colors"
              >
                {BYOK_PROVIDERS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <span className="text-[9px] text-muted-foreground/40 tracking-wide">Model</span>
              <select
                value={byokModel}
                onChange={e => setByokModel(e.target.value)}
                className="w-full rounded-xl border border-border/[0.1] bg-background/60 backdrop-blur-sm px-3 py-2.5 text-[11px] text-foreground/80 focus:outline-none focus:border-foreground/[0.15] transition-colors"
              >
                {selectedProvider?.models.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Color Selection (only when user plays) */}
      {opponent === "aureon" && (
        <div className="space-y-2.5">
          <label className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 font-light">Play As</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { id: "white" as PlayerColor, label: "White", desc: "First move" },
              { id: "black" as PlayerColor, label: "Black", desc: "Second move" },
            ]).map(opt => (
              <button
                key={opt.id}
                onClick={() => setPlayerColor(opt.id)}
                className={`rounded-2xl border p-4 text-center transition-all backdrop-blur-sm ${
                  playerColor === opt.id
                    ? "border-foreground/[0.12] bg-foreground/[0.05]"
                    : "border-border/[0.06] bg-foreground/[0.02] hover:bg-foreground/[0.04]"
                }`}
              >
                <div className={`w-6 h-6 rounded-full mx-auto mb-2 border ${
                  opt.id === "white" 
                    ? "bg-foreground/80 border-foreground/20" 
                    : "bg-background border-foreground/20"
                }`} />
                <p className="text-[11px] font-light text-foreground/80">{opt.label}</p>
                <p className="text-[9px] text-muted-foreground/30">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* BYOK info banner */}
      {opponent === "byok" && (
        <div className="rounded-2xl border border-border/[0.06] bg-foreground/[0.02] backdrop-blur-sm p-4 flex items-start gap-3">
          <Eye className="h-4 w-4 text-muted-foreground/30 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] text-foreground/60 font-light">Spectator Mode</p>
            <p className="text-[9px] text-muted-foreground/35 mt-1 leading-relaxed">
              You will watch {selectedProvider?.label} ({byokModel}) play against Aureon AI in real-time. 
              Both AIs will alternate moves automatically.
            </p>
          </div>
        </div>
      )}

      {/* Start Button */}
      <button
        onClick={() => onStart({
          opponent,
          playerColor: opponent === "byok" ? "white" : playerColor,
          byokProvider: opponent === "byok" ? byokProvider : undefined,
          byokModel: opponent === "byok" ? byokModel : undefined,
        })}
        className="w-full py-3.5 rounded-2xl bg-foreground/[0.06] border border-foreground/[0.1] text-foreground/70 text-[11px] font-light tracking-[0.15em] uppercase hover:bg-foreground/[0.1] transition-all backdrop-blur-sm"
      >
        {opponent === "byok" ? "Begin AI Battle" : "Begin War Scenario"}
      </button>
    </div>
  );
};

export default ZaplenSetup;
