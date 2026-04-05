import { useState, useEffect, useCallback, useRef } from "react";
import { Chess, type Square, type PieceSymbol } from "chess.js";
import { Bot, User, Trophy, Skull, Flag, MessageSquare, Zap, Eye, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { GameConfig } from "./ZaplenView";

const PIECE_UNICODE: Record<string, string> = {
  wk: "\u2654", wq: "\u2655", wr: "\u2656", wb: "\u2657", wn: "\u2658", wp: "\u2659",
  bk: "\u265A", bq: "\u265B", br: "\u265C", bb: "\u265D", bn: "\u265E", bp: "\u265F",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

interface MoveLog { moveNumber: number; white: string; black?: string; }

interface Props {
  config: GameConfig;
  onNewGame: () => void;
}

const ChessBoard = ({ config, onNewGame }: Props) => {
  const { toast } = useToast();
  const [game, setGame] = useState(new Chess());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [moveHistory, setMoveHistory] = useState<MoveLog[]>([]);
  const [aiThinking, setAiThinking] = useState(false);
  const [aureonCommentary, setAureonCommentary] = useState("");
  const [challengerCommentary, setChallengerCommentary] = useState("");
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [aiVsAiPaused, setAiVsAiPaused] = useState(false);
  const [currentThinkingLabel, setCurrentThinkingLabel] = useState("");
  const gameRef = useRef(game);
  const moveLogRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const abortRef = useRef(false);

  const isAiVsAi = config.opponent === "byok";

  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => { pausedRef.current = aiVsAiPaused; }, [aiVsAiPaused]);
  useEffect(() => { return () => { abortRef.current = true; }; }, []);

  useEffect(() => {
    if (moveLogRef.current) moveLogRef.current.scrollTop = moveLogRef.current.scrollHeight;
  }, [moveHistory]);

  const isPlayerTurn = useCallback(() => {
    if (config.opponent === "human") return true;
    if (isAiVsAi) return false; // spectator mode
    const turn = gameRef.current.turn();
    return (config.playerColor === "white" && turn === "w") ||
           (config.playerColor === "black" && turn === "b");
  }, [config, isAiVsAi]);

  const updateMoveHistory = useCallback((g: Chess) => {
    const history = g.history();
    const logs: MoveLog[] = [];
    for (let i = 0; i < history.length; i += 2) {
      logs.push({ moveNumber: Math.floor(i / 2) + 1, white: history[i], black: history[i + 1] });
    }
    setMoveHistory(logs);
  }, []);

  const executeAiMove = useCallback(async (currentGame: Chess, side: "aureon" | "challenger"): Promise<Chess | null> => {
    if (currentGame.isGameOver() || abortRef.current) return null;

    const isAureon = side === "aureon";
    const aiColor = currentGame.turn() === "w" ? "white" : "black";
    const label = isAureon ? "Aureon" : `${config.byokProvider}/${config.byokModel}`;
    setCurrentThinkingLabel(label);
    setAiThinking(true);

    try {
      const { data, error } = await supabase.functions.invoke("zaplen-chess", {
        body: {
          pgn: currentGame.pgn(),
          fen: currentGame.fen(),
          aiColor,
          byokProvider: isAureon ? undefined : config.byokProvider,
          byokModel: isAureon ? undefined : config.byokModel,
          opponent: isAureon ? "aureon" : "byok",
        },
      });

      if (error) throw error;

      const move = data?.move;
      const commentary = data?.commentary || "";

      if (move) {
        const newGame = new Chess(currentGame.fen());
        let result: ReturnType<typeof newGame.move> = null;
        try { result = newGame.move(move); } catch { /* */ }
        if (!result && typeof move === "object") {
          try { result = newGame.move({ from: move.from, to: move.to, promotion: move.promotion }); } catch { /* */ }
        }

        if (result) {
          setGame(new Chess(newGame.fen()));
          setLastMove({ from: result.from as Square, to: result.to as Square });
          updateMoveHistory(newGame);
          if (isAureon) setAureonCommentary(commentary);
          else setChallengerCommentary(commentary);
          setAiThinking(false);
          return newGame;
        }
      }

      // Fallback: random legal move
      const moves = currentGame.moves({ verbose: true });
      if (moves.length > 0) {
        const fb = moves[Math.floor(Math.random() * moves.length)];
        const fbGame = new Chess(currentGame.fen());
        const fbResult = fbGame.move(fb);
        if (fbResult) {
          setGame(new Chess(fbGame.fen()));
          setLastMove({ from: fbResult.from as Square, to: fbResult.to as Square });
          updateMoveHistory(fbGame);
          if (isAureon) setAureonCommentary("An interesting position...");
          else setChallengerCommentary("Calculating...");
          setAiThinking(false);
          return fbGame;
        }
      }
    } catch (err) {
      console.error("AI move error:", err);
      const moves = currentGame.moves({ verbose: true });
      if (moves.length > 0) {
        const fb = moves[Math.floor(Math.random() * moves.length)];
        const fbGame = new Chess(currentGame.fen());
        const fbResult = fbGame.move(fb);
        if (fbResult) {
          setGame(new Chess(fbGame.fen()));
          setLastMove({ from: fbResult.from as Square, to: fbResult.to as Square });
          updateMoveHistory(fbGame);
          setAiThinking(false);
          return fbGame;
        }
      }
    }

    setAiThinking(false);
    return null;
  }, [config, updateMoveHistory]);

  // AI vs AI loop
  useEffect(() => {
    if (!isAiVsAi) return;
    abortRef.current = false;

    const runLoop = async () => {
      let currentGame = new Chess();
      // Aureon = white, Challenger = black
      while (!currentGame.isGameOver() && !abortRef.current) {
        // Wait if paused
        while (pausedRef.current && !abortRef.current) {
          await new Promise(r => setTimeout(r, 300));
        }
        if (abortRef.current) break;

        const turn = currentGame.turn();
        const side = turn === "w" ? "aureon" : "challenger";
        const result = await executeAiMove(currentGame, side as "aureon" | "challenger");
        if (!result) break;
        currentGame = result;

        // Brief delay between moves for visual effect
        await new Promise(r => setTimeout(r, 1200));
      }
    };

    runLoop();

    return () => { abortRef.current = true; };
  }, [isAiVsAi, executeAiMove]);

  // Single AI opponent (aureon mode)
  const requestAiMove = useCallback(async (currentGame: Chess) => {
    const result = await executeAiMove(currentGame, "aureon");
    return result;
  }, [executeAiMove]);

  // AI first move when player is black
  useEffect(() => {
    if (config.opponent === "aureon" && config.playerColor === "black" && game.history().length === 0) {
      requestAiMove(game);
    }
  }, []);

  const handleSquareClick = useCallback((square: Square) => {
    if (game.isGameOver() || aiThinking || !isPlayerTurn()) return;

    const piece = game.get(square);

    if (selectedSquare) {
      const newGame = new Chess(game.fen());
      try {
        const movingPiece = newGame.get(selectedSquare);
        let promotion: PieceSymbol | undefined;
        if (movingPiece?.type === "p") {
          const targetRank = square[1];
          if ((movingPiece.color === "w" && targetRank === "8") || (movingPiece.color === "b" && targetRank === "1")) {
            promotion = "q";
          }
        }
        const result = newGame.move({ from: selectedSquare, to: square, promotion });
        if (result) {
          setGame(new Chess(newGame.fen()));
          setSelectedSquare(null);
          setLegalMoves([]);
          setLastMove({ from: result.from as Square, to: result.to as Square });
          updateMoveHistory(newGame);
          if (config.opponent === "aureon" && !newGame.isGameOver()) {
            setTimeout(() => requestAiMove(newGame), 500);
          }
          return;
        }
      } catch { /* */ }

      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
        const moves = game.moves({ square, verbose: true });
        setLegalMoves(moves.map(m => m.to as Square));
        return;
      }
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      setLegalMoves(moves.map(m => m.to as Square));
    }
  }, [game, selectedSquare, aiThinking, isPlayerTurn, config, requestAiMove, updateMoveHistory]);

  const getGameStatus = () => {
    if (game.isCheckmate()) return { icon: Trophy, text: `Checkmate — ${game.turn() === "w" ? "Black" : "White"} wins`, urgent: true };
    if (game.isDraw()) return { icon: Flag, text: "Draw", urgent: false };
    if (game.isStalemate()) return { icon: Flag, text: "Stalemate", urgent: false };
    if (game.isThreefoldRepetition()) return { icon: Flag, text: "Draw — Threefold repetition", urgent: false };
    if (game.isInsufficientMaterial()) return { icon: Flag, text: "Draw — Insufficient material", urgent: false };
    if (game.inCheck()) return { icon: Skull, text: `${game.turn() === "w" ? "White" : "Black"} in check`, urgent: true };
    return null;
  };

  const status = getGameStatus();
  const isFlipped = config.opponent === "aureon" && config.playerColor === "black";
  const displayRanks = isFlipped ? [...RANKS].reverse() : RANKS;
  const displayFiles = isFlipped ? [...FILES].reverse() : FILES;

  const whiteLabel = isAiVsAi ? "Aureon AI" : (config.playerColor === "white" ? "You" : "Aureon AI");
  const blackLabel = isAiVsAi ? `${config.byokProvider}/${config.byokModel}` : (config.playerColor === "black" ? "You" : "Aureon AI");
  const topLabel = isFlipped ? whiteLabel : blackLabel;
  const bottomLabel = isFlipped ? blackLabel : whiteLabel;
  const topIsAi = isAiVsAi || (isFlipped ? config.playerColor !== "white" : config.playerColor !== "black");
  const bottomIsAi = isAiVsAi || (isFlipped ? config.playerColor !== "black" : config.playerColor !== "white");

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 lg:p-6 h-full">
      {/* Board area */}
      <div className="flex-1 flex flex-col items-center justify-center min-w-0">
        {/* AI vs AI spectator banner */}
        {isAiVsAi && (
          <div className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-2xl border border-border/[0.08] bg-foreground/[0.03] backdrop-blur-sm">
            <Eye className="h-3.5 w-3.5 text-muted-foreground/40" />
            <span className="text-[10px] text-muted-foreground/50 tracking-wide uppercase">Spectator Mode</span>
            <button
              onClick={() => setAiVsAiPaused(p => !p)}
              className="ml-2 p-1.5 rounded-lg border border-border/[0.1] bg-foreground/[0.04] hover:bg-foreground/[0.08] transition-colors"
            >
              {aiVsAiPaused ? <Play className="h-3 w-3 text-foreground/50" /> : <Pause className="h-3 w-3 text-foreground/50" />}
            </button>
          </div>
        )}

        {/* Top player */}
        <div className="flex items-center gap-2 mb-2 px-1 w-full max-w-[480px]">
          <div className="w-6 h-6 rounded-lg bg-foreground/[0.04] border border-border/[0.06] flex items-center justify-center">
            {topIsAi ? <Bot className="h-3 w-3 text-muted-foreground/50" /> : <User className="h-3 w-3 text-muted-foreground/50" />}
          </div>
          <span className="text-[10px] text-muted-foreground/60 font-light tracking-wide">{topLabel}</span>
          {aiThinking && currentThinkingLabel === topLabel && (
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-pulse" />
              <span className="text-[8px] text-muted-foreground/40 tracking-wider uppercase">Thinking</span>
            </div>
          )}
        </div>

        {/* Board */}
        <div className="w-full max-w-[480px] aspect-square">
          <div className="grid grid-cols-8 gap-0 w-full h-full rounded-2xl overflow-hidden border border-border/[0.1] shadow-[0_8px_32px_-12px_hsl(var(--foreground)/0.08)]">
            {displayRanks.map((rank, ri) =>
              displayFiles.map((file, fi) => {
                const square = `${file}${rank}` as Square;
                const piece = game.get(square);
                const isLight = (ri + fi) % 2 === 0;
                const isSelected = selectedSquare === square;
                const isLegal = legalMoves.includes(square);
                const isLastMoveSquare = lastMove && (lastMove.from === square || lastMove.to === square);
                const inCheck = game.inCheck() && piece?.type === "k" && piece.color === game.turn();

                // Glassmorphic board colors using design tokens
                let squareStyle = isLight
                  ? "bg-foreground/[0.06]"
                  : "bg-foreground/[0.16]";

                if (isSelected) squareStyle = "bg-foreground/[0.25]";
                else if (inCheck) squareStyle = "bg-destructive/30";
                else if (isLastMoveSquare) squareStyle = isLight ? "bg-foreground/[0.12]" : "bg-foreground/[0.22]";

                return (
                  <button
                    key={square}
                    onClick={() => handleSquareClick(square)}
                    className={`relative flex items-center justify-center ${squareStyle} transition-all duration-150 ${
                      isPlayerTurn() && !game.isGameOver() ? "cursor-pointer hover:brightness-125" : "cursor-default"
                    }`}
                  >
                    {isLegal && !piece && (
                      <div className="absolute w-[26%] h-[26%] rounded-full bg-foreground/[0.15]" />
                    )}
                    {isLegal && piece && (
                      <div className="absolute inset-[4%] border-2 border-foreground/20 rounded-lg" />
                    )}
                    {piece && (
                      <span className={`text-[clamp(1.4rem,4.8vw,2.6rem)] leading-none select-none ${
                        piece.color === "w" ? "drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" : "drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]"
                      }`} style={{ color: piece.color === "w" ? "#D4AF37" : "#8B6914" }}>
                        {PIECE_UNICODE[`${piece.color}${piece.type}`]}
                      </span>
                    )}
                    {fi === 0 && (
                      <span className={`absolute top-0.5 left-1 text-[7px] font-light ${isLight ? "text-foreground/20" : "text-foreground/15"}`}>
                        {rank}
                      </span>
                    )}
                    {ri === 7 && (
                      <span className={`absolute bottom-0 right-1 text-[7px] font-light ${isLight ? "text-foreground/20" : "text-foreground/15"}`}>
                        {file}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Bottom player */}
        <div className="flex items-center gap-2 mt-2 px-1 w-full max-w-[480px]">
          <div className="w-6 h-6 rounded-lg bg-foreground/[0.04] border border-border/[0.06] flex items-center justify-center">
            {bottomIsAi ? <Bot className="h-3 w-3 text-muted-foreground/50" /> : <User className="h-3 w-3 text-muted-foreground/50" />}
          </div>
          <span className="text-[10px] text-muted-foreground/60 font-light tracking-wide">{bottomLabel}</span>
          {!isAiVsAi && isPlayerTurn() && !game.isGameOver() && (
            <span className="text-[8px] text-muted-foreground/30 ml-auto tracking-wider uppercase">Your move</span>
          )}
          {aiThinking && currentThinkingLabel === bottomLabel && (
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-pulse" />
              <span className="text-[8px] text-muted-foreground/40 tracking-wider uppercase">Thinking</span>
            </div>
          )}
        </div>

        {/* Status */}
        {status && (
          <div className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-xl border backdrop-blur-sm ${
            status.urgent ? "border-destructive/20 bg-destructive/[0.06]" : "border-border/[0.08] bg-foreground/[0.03]"
          }`}>
            <status.icon className={`h-3.5 w-3.5 ${status.urgent ? "text-destructive/60" : "text-muted-foreground/50"}`} />
            <span className="text-[10px] font-light text-foreground/70">{status.text}</span>
          </div>
        )}
      </div>

      {/* Side panel */}
      <div className="w-full lg:w-64 shrink-0 flex flex-col gap-3">
        {/* Move Log */}
        <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border/[0.06]">
            <h3 className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 font-light">Moves</h3>
          </div>
          <div ref={moveLogRef} className="flex-1 overflow-auto p-3 space-y-0.5 max-h-52 lg:max-h-none">
            {moveHistory.length === 0 && (
              <p className="text-[10px] text-muted-foreground/20 text-center py-6">Awaiting first move</p>
            )}
            {moveHistory.map(log => (
              <div key={log.moveNumber} className="flex items-center text-[10px] font-mono py-0.5">
                <span className="w-7 text-muted-foreground/20 shrink-0">{log.moveNumber}.</span>
                <span className="w-14 text-foreground/70">{log.white}</span>
                <span className="w-14 text-foreground/40">{log.black || ""}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Commentary */}
        {config.opponent !== "human" && (
          <div className="space-y-2">
            {/* Aureon commentary */}
            <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="h-3 w-3 text-muted-foreground/40" />
                <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 font-light">Aureon</span>
              </div>
              <p className="text-[10px] text-muted-foreground/50 font-extralight leading-relaxed min-h-[28px]">
                {aiThinking && currentThinkingLabel.includes("Aureon") ? (
                  <span className="animate-pulse text-muted-foreground/30">Calculating...</span>
                ) : aureonCommentary || (
                  <span className="text-muted-foreground/20">...</span>
                )}
              </p>
            </div>

            {/* Challenger commentary (BYOK only) */}
            {isAiVsAi && (
              <div className="rounded-2xl border border-border/[0.08] bg-foreground/[0.02] backdrop-blur-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-3 w-3 text-muted-foreground/40" />
                  <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/40 font-light">{config.byokModel}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/50 font-extralight leading-relaxed min-h-[28px]">
                  {aiThinking && !currentThinkingLabel.includes("Aureon") ? (
                    <span className="animate-pulse text-muted-foreground/30">Calculating...</span>
                  ) : challengerCommentary || (
                    <span className="text-muted-foreground/20">...</span>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Game over */}
        {game.isGameOver() && (
          <button
            onClick={onNewGame}
            className="w-full py-2.5 rounded-2xl bg-foreground/[0.06] border border-foreground/[0.1] text-foreground/60 text-[10px] font-light tracking-[0.15em] uppercase hover:bg-foreground/[0.1] transition-all"
          >
            Play Again
          </button>
        )}
      </div>
    </div>
  );
};

export default ChessBoard;
