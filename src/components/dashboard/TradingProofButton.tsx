import { useState } from "react";
import { TrendingUp, X, Loader2, Download, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Message, FileAttachment } from "./types";

const TRADING_KEYWORDS = [
  "long", "short", "entry", "stop loss", "take profit", "buy", "sell",
  "support", "resistance", "trade", "trading", "setup", "signal",
  "bullish", "bearish", "breakout", "breakdown", "tp", "sl",
  "target", "position", "scalp", "swing", "fractal",
];

/**
 * Determines if a conversation pair (user msg + assistant reply) is trading-related
 * and has a chart image attached.
 */
export function isTradingWithChart(
  assistantMsg: Message,
  allMessages: Message[]
): { isTradingMsg: boolean; chartAttachment: FileAttachment | null; userQuery: string } {
  // Find the user message immediately before this assistant message
  const idx = allMessages.indexOf(assistantMsg);
  let userMsg: Message | null = null;
  for (let i = idx - 1; i >= 0; i--) {
    if (allMessages[i].role === "user") {
      userMsg = allMessages[i];
      break;
    }
  }

  if (!userMsg) return { isTradingMsg: false, chartAttachment: null, userQuery: "" };

  const combined = (userMsg.content + " " + assistantMsg.content).toLowerCase();
  const hasTradingContent = TRADING_KEYWORDS.some((kw) => combined.includes(kw));
  const chartAtt = userMsg.attachments?.find((a) => a.type.startsWith("image/")) || null;

  return {
    isTradingMsg: hasTradingContent && !!chartAtt,
    chartAttachment: chartAtt,
    userQuery: userMsg.content,
  };
}

interface Props {
  message: Message;
  allMessages: Message[];
}

export default function TradingProofButton({ message, allMessages }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [annotatedUrl, setAnnotatedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const { isTradingMsg, chartAttachment, userQuery } = isTradingWithChart(message, allMessages);

  if (!isTradingMsg || !chartAttachment) return null;

  const generateProof = async () => {
    if (annotatedUrl) {
      setOpen(true);
      return;
    }

    setLoading(true);
    setError(null);
    setOpen(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("chart-annotate", {
        body: {
          imageBase64: chartAttachment.base64,
          imageMimeType: chartAttachment.type,
          analysisText: message.content,
          userQuery,
        },
      });

      if (fnError) throw new Error(fnError.message || "Annotation failed");
      if (data?.error) throw new Error(data.error);

      if (data?.annotatedImage) {
        setAnnotatedUrl(data.annotatedImage);
      } else {
        throw new Error("No annotated image returned");
      }
    } catch (e: any) {
      console.error("Trading proof error:", e);
      setError(e.message || "Failed to generate proof");
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = () => {
    if (!annotatedUrl) return;
    const a = document.createElement("a");
    a.href = annotatedUrl;
    a.download = `trading-proof-${Date.now()}.png`;
    a.click();
  };

  return (
    <>
      <button
        onClick={generateProof}
        className="flex items-center gap-1 text-[10px] font-light text-emerald-500/70 hover:text-emerald-500 transition-colors"
        title="Show visual proof with annotated chart"
      >
        <TrendingUp className="h-3 w-3" />
        Show Proof
      </button>

      {open && (
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in ${
            fullscreen ? "" : "p-4 sm:p-8"
          }`}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div
            className={`relative bg-card/95 backdrop-blur-xl border border-border/30 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
              fullscreen ? "w-full h-full rounded-none" : "max-w-4xl w-full max-h-[90vh]"
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 shrink-0">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-light text-foreground">Trading Proof — Visual Analysis</span>
              </div>
              <div className="flex items-center gap-1.5">
                {annotatedUrl && (
                  <>
                    <button
                      onClick={downloadImage}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setFullscreen(!fullscreen)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                      title="Toggle fullscreen"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              {loading && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <Loader2 className="h-8 w-8 text-emerald-500 animate-spin" />
                  <p className="text-sm font-light text-muted-foreground">Annotating chart with entry, SL, and TP levels…</p>
                  <p className="text-[10px] text-muted-foreground/50">This may take a few seconds</p>
                </div>
              )}

              {error && !loading && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <p className="text-sm text-destructive font-light">{error}</p>
                  <button
                    onClick={() => { setAnnotatedUrl(null); generateProof(); }}
                    className="px-4 py-2 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-light hover:bg-emerald-500/20 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {annotatedUrl && !loading && (
                <div className="space-y-4">
                  {/* Side by side on desktop, stacked on mobile */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Original */}
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-light">Original Chart</p>
                      <div className="rounded-xl border border-border/20 overflow-hidden bg-black/20">
                        <img
                          src={chartAttachment.previewUrl || `data:${chartAttachment.type};base64,${chartAttachment.base64}`}
                          alt="Original chart"
                          className="w-full object-contain max-h-[500px]"
                        />
                      </div>
                    </div>
                    {/* Annotated */}
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-500/70 font-light">Annotated Proof</p>
                      <div className="rounded-xl border border-emerald-500/20 overflow-hidden bg-black/20">
                        <img
                          src={annotatedUrl}
                          alt="Annotated trading chart"
                          className="w-full object-contain max-h-[500px]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Analysis summary */}
                  <div className="rounded-xl border border-border/20 bg-foreground/5 p-4">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-light mb-2">AI Analysis</p>
                    <p className="text-xs font-light text-foreground/80 whitespace-pre-wrap leading-relaxed">
                      {message.content.slice(0, 800)}
                      {message.content.length > 800 && "…"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
