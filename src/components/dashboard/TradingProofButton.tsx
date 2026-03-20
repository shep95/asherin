import { useState } from "react";
import { TrendingUp, X, Loader2, Download, Maximize2, BarChart3, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Message, FileAttachment } from "./types";

const TRADING_KEYWORDS = [
  "long", "short", "entry", "stop loss", "take profit", "buy", "sell",
  "support", "resistance", "trade", "trading", "setup", "signal",
  "bullish", "bearish", "breakout", "breakdown", "tp", "sl",
  "target", "position", "scalp", "swing", "fractal",
  "chart", "candle", "candlestick", "timeframe", "price", "level",
  "trend", "momentum", "rsi", "macd", "ema", "sma", "fibonacci",
  "analysis", "analyze", "pattern", "technical", "indicator",
];

export function isTradingWithChart(
  assistantMsg: Message,
  allMessages: Message[]
): { isTradingMsg: boolean; chartAttachment: FileAttachment | null; userQuery: string } {
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

  // Show button if trading content exists AND user had an image attachment
  // Allow even without base64 — previewUrl is sufficient for display
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
  const [zoomedSrc, setZoomedSrc] = useState<string | null>(null);
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

  const chartPreviewSrc = chartAttachment.previewUrl || (chartAttachment.base64 ? `data:${chartAttachment.type};base64,${chartAttachment.base64}` : null);

  return (
    <>
      {/* Prominent card-style button */}
      <button
        onClick={generateProof}
        className="mt-3 w-full flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 px-3.5 py-2.5 transition-all group active:scale-[0.98]"
      >
        {/* Chart thumbnail */}
        <div className="relative shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-border/20 bg-black/30">
          {chartPreviewSrc ? (
            <img src={chartPreviewSrc} alt="Chart" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-emerald-500/50" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <BarChart3 className="h-4 w-4 text-emerald-400 drop-shadow" />
          </div>
        </div>
        {/* Label */}
        <div className="flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-xs font-medium text-emerald-500">Show Proof</span>
          </div>
          <p className="text-[10px] text-muted-foreground/60 font-light mt-0.5">
            View annotated chart with Entry, SL &amp; TP levels
          </p>
        </div>
        <ImageIcon className="h-4 w-4 text-emerald-500/40 group-hover:text-emerald-500/70 transition-colors shrink-0" />
      </button>

      {/* Modal */}
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
                <BarChart3 className="h-4 w-4 text-emerald-500" />
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Original */}
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-light">Original Chart</p>
                      <div className="rounded-xl border border-border/20 overflow-hidden bg-black/20">
                        <img
                          src={chartPreviewSrc || ""}
                          alt="Original chart"
                          className="w-full object-contain max-h-[500px]"
                        />
                      </div>
                    </div>
                    {/* Annotated */}
                    <div className="space-y-2">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-500/70 font-light">📊 Annotated Proof</p>
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
