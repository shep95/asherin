import { useState } from "react";
import { Swords, RotateCcw, Pause, Play } from "lucide-react";
import ChessBoard from "./ChessBoard";
import ZaplenSetup from "./ZaplenSetup";

export type OpponentType = "aureon" | "human" | "byok";
export type PlayerColor = "white" | "black";

export interface GameConfig {
  opponent: OpponentType;
  playerColor: PlayerColor;
  byokProvider?: string;
  byokModel?: string;
}

const ZaplenView = () => {
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [gameKey, setGameKey] = useState(0);

  const handleStartGame = (config: GameConfig) => {
    setGameConfig(config);
    setGameKey(k => k + 1);
  };

  const handleNewGame = () => {
    setGameConfig(null);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border/[0.06] px-6 py-4 flex items-center justify-between backdrop-blur-md bg-background/40">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-foreground/[0.04] backdrop-blur-sm border border-border/[0.08] flex items-center justify-center">
            <Swords className="h-4 w-4 text-foreground/60" />
          </div>
          <div>
            <h1 className="text-sm font-light tracking-[0.12em] text-foreground/90">ZAPLEN</h1>
            <p className="text-[9px] text-muted-foreground/40 tracking-[0.2em] uppercase">War Scenarios</p>
          </div>
        </div>
        {gameConfig && (
          <button
            onClick={handleNewGame}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-border/[0.08] bg-foreground/[0.03] backdrop-blur-sm text-[10px] text-muted-foreground/60 hover:bg-foreground/[0.06] transition-all"
          >
            <RotateCcw className="h-3 w-3" />
            New Game
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {!gameConfig ? (
          <ZaplenSetup onStart={handleStartGame} />
        ) : (
          <ChessBoard key={gameKey} config={gameConfig} onNewGame={handleNewGame} />
        )}
      </div>
    </div>
  );
};

export default ZaplenView;
