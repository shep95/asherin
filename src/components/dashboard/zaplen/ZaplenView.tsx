import { useState } from "react";
import { Swords, Crown, Bot, User, RotateCcw, Settings2 } from "lucide-react";
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
    <div className="h-full flex flex-col bg-background/50">
      {/* Header */}
      <div className="shrink-0 border-b border-border/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
            <Swords className="h-4.5 w-4.5 text-red-400" />
          </div>
          <div>
            <h1 className="text-sm font-light tracking-[0.08em] text-foreground">ZAPLEN</h1>
            <p className="text-[10px] text-muted-foreground/50 tracking-wide">WAR SCENARIOS</p>
          </div>
        </div>
        {gameConfig && (
          <button
            onClick={handleNewGame}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/15 text-[11px] text-muted-foreground/70 hover:bg-foreground/5 transition-colors"
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
