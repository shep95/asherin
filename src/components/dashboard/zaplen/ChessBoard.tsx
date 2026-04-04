import { useState, useEffect, useCallback, useRef } from "react";
import { Chess, type Square, type PieceSymbol, type Color } from "chess.js";
import { Bot, User, Clock, Trophy, Skull, Flag, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { GameConfig } from "./ZaplenView";

// Unicode chess pieces
const PIECE_UNICODE: Record<string, string> = {
  wk: "\u2654", wq: "\u2655", wr: "\u2656", wb: "\u2657", wn: "\u2658", wp: "\u2659",
  bk: "\u265A", bq: "\u265B", br: "\u265C", bb: "\u265D", bn: "\u265E", bp: "\u265F",
};

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

interface MoveLog {
  moveNumber: number;
  white: string;
  black?: string;
}

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
  const [aiCommentary, setAiCommentary] = useState<string>("");
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const gameRef = useRef(game);
  const moveLogRef = useRef<HTMLDivElement>(null);

  useEffect(() => { gameRef.current = game; }, [game]);

  // Scroll move log to bottom
  useEffect(() => {
    if (moveLogRef.current) {
      moveLogRef.current.scrollTop = moveLogRef.current.scrollHeight;
    }
  }, [moveHistory]);

  const isPlayerTurn = useCallback(() => {
    if (config.opponent === "human") return true;
    const turn = gameRef.current.turn();
    return (config.playerColor === "white" && turn === "w") ||
           (config.playerColor === "black" && turn === "b");
  }, [config]);

  const updateMoveHistory = useCallback((g: Chess) => {
    const history = g.history();
    const logs: MoveLog[] = [];
    for (let i = 0; i < history.length; i += 2) {
      logs.push({
        moveNumber: Math.floor(i / 2) + 1,
        white: history[i],
        black: history[i + 1],
      });
    }
    setMoveHistory(logs);
  }, []);

  const requestAiMove = useCallback(async (currentGame: Chess) => {
    if (currentGame.isGameOver()) return;
    setAiThinking(true);
    setAiCommentary("");

    try {
      const pgn = currentGame.pgn();
      const fen = currentGame.fen();
      const aiColor = config.playerColor === "white" ? "black" : "white";

      const { data, error } = await supabase.functions.invoke("zaplen-chess", {
        body: {
          pgn,
          fen,
          aiColor,
          byokProvider: config.byokProvider,
          byokModel: config.byokModel,
          opponent: config.opponent,
        },
      });

      if (error) throw error;

      const move = data?.move;
      const commentary = data?.commentary || "";

      if (move) {
        const newGame = new Chess(currentGame.fen());
        // Try different move formats
        let result = newGame.move(move);
        if (!result && typeof move === "string") {
          // Try SAN format
          try { result = newGame.move(move); } catch { /* */ }
        }
        if (!result && typeof move === "object") {
          try { result = newGame.move({ from: move.from, to: move.to, promotion: move.promotion }); } catch { /* */ }
        }

        if (result) {
          setGame(new Chess(newGame.fen()));
          setLastMove({ from: result.from as Square, to: result.to as Square });
          updateMoveHistory(newGame);
          if (commentary) setAiCommentary(commentary);
        } else {
          // Fallback: pick a random legal move
          const moves = currentGame.moves({ verbose: true });
          if (moves.length > 0) {
            const fallback = moves[Math.floor(Math.random() * moves.length)];
            const fbGame = new Chess(currentGame.fen());
            const fbResult = fbGame.move(fallback);
            if (fbResult) {
              setGame(new Chess(fbGame.fen()));
              setLastMove({ from: fbResult.from as Square, to: fbResult.to as Square });
              updateMoveHistory(fbGame);
              setAiCommentary("Interesting position... I see several possibilities.");
            }
          }
        }
      }
    } catch (err) {
      console.error("AI move error:", err);
      // Fallback to random move on error
      const moves = currentGame.moves({ verbose: true });
      if (moves.length > 0) {
        const fallback = moves[Math.floor(Math.random() * moves.length)];
        const fbGame = new Chess(currentGame.fen());
        const fbResult = fbGame.move(fallback);
        if (fbResult) {
          setGame(new Chess(fbGame.fen()));
          setLastMove({ from: fbResult.from as Square, to: fbResult.to as Square });
          updateMoveHistory(fbGame);
        }
      }
      toast({ title: "AI Move", description: "Aureon played a calculated move.", variant: "default" });
    } finally {
      setAiThinking(false);
    }
  }, [config, toast, updateMoveHistory]);

  // If AI moves first (player is black)
  useEffect(() => {
    if (config.opponent !== "human" && config.playerColor === "black" && game.history().length === 0) {
      requestAiMove(game);
    }
  }, []);

  const handleSquareClick = useCallback((square: Square) => {
    if (game.isGameOver()) return;
    if (aiThinking) return;
    if (!isPlayerTurn()) return;

    const piece = game.get(square);

    if (selectedSquare) {
      // Try to move
      const newGame = new Chess(game.fen());
      try {
        // Check for promotion
        const movingPiece = newGame.get(selectedSquare);
        let promotion: PieceSymbol | undefined;
        if (movingPiece?.type === "p") {
          const targetRank = square[1];
          if ((movingPiece.color === "w" && targetRank === "8") || (movingPiece.color === "b" && targetRank === "1")) {
            promotion = "q"; // Auto-promote to queen
          }
        }

        const result = newGame.move({ from: selectedSquare, to: square, promotion });
        if (result) {
          setGame(new Chess(newGame.fen()));
          setSelectedSquare(null);
          setLegalMoves([]);
          setLastMove({ from: result.from as Square, to: result.to as Square });
          updateMoveHistory(newGame);

          // Trigger AI response
          if (config.opponent !== "human" && !newGame.isGameOver()) {
            setTimeout(() => requestAiMove(newGame), 500);
          }
          return;
        }
      } catch { /* invalid move */ }

      // If clicking another own piece, select it instead
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

    // Select a piece
    if (piece && piece.color === game.turn()) {
      setSelectedSquare(square);
      const moves = game.moves({ square, verbose: true });
      setLegalMoves(moves.map(m => m.to as Square));
    }
  }, [game, selectedSquare, aiThinking, isPlayerTurn, config, requestAiMove, updateMoveHistory]);

  const getGameStatus = () => {
    if (game.isCheckmate()) return { icon: Trophy, text: `Checkmate — ${game.turn() === "w" ? "Black" : "White"} wins`, color: "text-red-400" };
    if (game.isDraw()) return { icon: Flag, text: "Draw", color: "text-amber-400" };
    if (game.isStalemate()) return { icon: Flag, text: "Stalemate", color: "text-amber-400" };
    if (game.isThreefoldRepetition()) return { icon: Flag, text: "Draw — Threefold repetition", color: "text-amber-400" };
    if (game.isInsufficientMaterial()) return { icon: Flag, text: "Draw — Insufficient material", color: "text-amber-400" };
    if (game.inCheck()) return { icon: Skull, text: `${game.turn() === "w" ? "White" : "Black"} is in check`, color: "text-orange-400" };
    return null;
  };

  const status = getGameStatus();
  const isFlipped = config.playerColor === "black" && config.opponent !== "human";
  const displayRanks = isFlipped ? [...RANKS].reverse() : RANKS;
  const displayFiles = isFlipped ? [...FILES].reverse() : FILES;

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 lg:p-6 h-full">
      {/* Board */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Opponent info */}
        <div className="flex items-center gap-2 mb-3 px-2 w-full max-w-[480px]">
          <div className="w-6 h-6 rounded-full bg-foreground/[0.06] flex items-center justify-center">
            <Bot className="h-3 w-3 text-muted-foreground/60" />
          </div>
          <span className="text-[11px] text-muted-foreground/70 font-light">
            {config.opponent === "aureon" ? "Aureon AI" : config.opponent === "byok" ? `${config.byokProvider}/${config.byokModel}` : "Player 2"}
          </span>
          {aiThinking && (
            <span className="text-[9px] text-red-400/70 animate-pulse ml-auto">analyzing...</span>
          )}
        </div>

        {/* Chess board */}
        <div className="w-full max-w-[480px] aspect-square">
          <div className="grid grid-cols-8 gap-0 w-full h-full rounded-lg overflow-hidden border border-border/20">
            {displayRanks.map((rank, ri) =>
              displayFiles.map((file, fi) => {
                const square = `${file}${rank}` as Square;
                const piece = game.get(square);
                const isLight = (ri + fi) % 2 === 0;
                const isSelected = selectedSquare === square;
                const isLegal = legalMoves.includes(square);
                const isLastMoveSquare = lastMove && (lastMove.from === square || lastMove.to === square);
                const inCheck = game.inCheck() && piece?.type === "k" && piece.color === game.turn();

                let bgClass = isLight ? "bg-[hsl(30,20%,82%)]" : "bg-[hsl(30,20%,48%)]";
                if (isSelected) bgClass = "bg-red-500/40";
                else if (isLastMoveSquare) bgClass = isLight ? "bg-amber-300/50" : "bg-amber-500/40";
                else if (inCheck) bgClass = "bg-red-600/50";

                return (
                  <button
                    key={square}
                    onClick={() => handleSquareClick(square)}
                    className={`relative flex items-center justify-center ${bgClass} transition-colors cursor-pointer hover:brightness-110`}
                  >
                    {/* Legal move indicator */}
                    {isLegal && !piece && (
                      <div className="absolute w-[28%] h-[28%] rounded-full bg-foreground/20" />
                    )}
                    {isLegal && piece && (
                      <div className="absolute inset-0 border-[3px] border-foreground/30 rounded-sm" />
                    )}
                    {/* Piece */}
                    {piece && (
                      <span className="text-[clamp(1.5rem,5vw,2.8rem)] leading-none select-none drop-shadow-sm">
                        {PIECE_UNICODE[`${piece.color}${piece.type}`]}
                      </span>
                    )}
                    {/* Coordinates */}
                    {fi === 0 && (
                      <span className={`absolute top-0.5 left-1 text-[8px] font-medium ${isLight ? "text-[hsl(30,20%,48%)]" : "text-[hsl(30,20%,82%)]"}`}>
                        {rank}
                      </span>
                    )}
                    {ri === 7 && (
                      <span className={`absolute bottom-0 right-1 text-[8px] font-medium ${isLight ? "text-[hsl(30,20%,48%)]" : "text-[hsl(30,20%,82%)]"}`}>
                        {file}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Player info */}
        <div className="flex items-center gap-2 mt-3 px-2 w-full max-w-[480px]">
          <div className="w-6 h-6 rounded-full bg-foreground/[0.06] flex items-center justify-center">
            <User className="h-3 w-3 text-muted-foreground/60" />
          </div>
          <span className="text-[11px] text-muted-foreground/70 font-light">
            {config.opponent === "human" ? "Player 1" : "You"}
          </span>
          <span className="text-[9px] text-muted-foreground/40 ml-auto">
            {game.turn() === (config.playerColor === "white" ? "w" : "b") && !game.isGameOver() ? "Your turn" : ""}
          </span>
        </div>

        {/* Status */}
        {status && (
          <div className={`mt-3 flex items-center gap-2 px-4 py-2 rounded-lg border border-border/10 bg-card/10 ${status.color}`}>
            <status.icon className="h-3.5 w-3.5" />
            <span className="text-[11px] font-light">{status.text}</span>
          </div>
        )}
      </div>

      {/* Side panel — Move log + AI commentary */}
      <div className="w-full lg:w-72 shrink-0 flex flex-col gap-3">
        {/* Move Log */}
        <div className="rounded-xl border border-border/10 bg-card/5 flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border/10">
            <h3 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 font-light">Move History</h3>
          </div>
          <div ref={moveLogRef} className="flex-1 overflow-auto p-3 space-y-0.5 max-h-64 lg:max-h-none">
            {moveHistory.length === 0 && (
              <p className="text-[10px] text-muted-foreground/30 text-center py-4">No moves yet</p>
            )}
            {moveHistory.map(log => (
              <div key={log.moveNumber} className="flex items-center text-[11px] font-mono">
                <span className="w-8 text-muted-foreground/30 shrink-0">{log.moveNumber}.</span>
                <span className="w-16 text-foreground/80">{log.white}</span>
                <span className="w-16 text-foreground/60">{log.black || ""}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Commentary */}
        {config.opponent !== "human" && (
          <div className="rounded-xl border border-border/10 bg-card/5 p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-3 w-3 text-red-400/60" />
              <h3 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/60 font-light">
                {config.opponent === "aureon" ? "Aureon" : config.byokModel} Says
              </h3>
            </div>
            <p className="text-[11px] text-muted-foreground/60 font-extralight leading-relaxed min-h-[40px]">
              {aiThinking ? (
                <span className="animate-pulse text-red-400/50">Calculating optimal strategy...</span>
              ) : aiCommentary || (
                <span className="text-muted-foreground/30">Waiting for the game to begin...</span>
              )}
            </p>
          </div>
        )}

        {/* Game controls */}
        {game.isGameOver() && (
          <button
            onClick={onNewGame}
            className="w-full py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-[11px] font-light tracking-wide hover:bg-red-500/30 transition-colors"
          >
            Play Again
          </button>
        )}
      </div>
    </div>
  );
};

export default ChessBoard;
