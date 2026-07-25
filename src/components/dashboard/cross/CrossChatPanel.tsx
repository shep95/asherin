import React, { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, Mic, Paperclip, Settings, ArrowDown, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import ReactMarkdown from "react-markdown";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
  type?: "text" | "code" | "suggestion" | "warning" | "analysis" | "insight";
  actions?: { label: string; onClick?: () => void }[];
  confidence?: number;
}

interface CrossChatPanelProps {
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  onInputChange: (val: string) => void;
  onSend: () => void;
  onClose: () => void;
}

const CrossChatPanel: React.FC<CrossChatPanelProps> = ({
  messages, input, isLoading, onInputChange, onSend, onClose,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (autoScroll) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, autoScroll]);

  // Detect user scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(atBottom);
    setShowScrollBtn(!atBottom);
  }, []);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    setAutoScroll(true);
    setShowScrollBtn(false);
  };

  const copyMessage = (content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const getTypeIndicator = (type?: string) => {
    switch (type) {
      case "suggestion": return { emoji: "💡", label: "SUGGESTION", color: "border-l-blue-400" };
      case "warning": return { emoji: "⚠️", label: "WARNING", color: "border-l-amber-400" };
      case "analysis": return { emoji: "📊", label: "ANALYSIS COMPLETE", color: "border-l-emerald-400" };
      case "insight": return { emoji: "🎯", label: "OPPORTUNITY DETECTED", color: "border-l-violet-400" };
      default: return null;
    }
  };

  return (
    <div className="w-80 border-l border-border/20 flex flex-col"
      style={{ background: "rgba(20, 20, 25, 0.92)", backdropFilter: "blur(10px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
        <h3 className="text-sm font-medium text-foreground tracking-wide">CROSS AI Chat</h3>
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-white/5 rounded transition" title="Settings">
            <Settings className="h-3.5 w-3.5 text-muted-foreground/50" />
          </button>
          <button onClick={onClose} className="p-1 hover:bg-white/5 rounded transition">
            <X className="h-4 w-4 text-muted-foreground/60" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-3 space-y-3 relative">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground/30 text-center py-12 font-extralight">
            Ask Asherin about what it sees on your screen
          </p>
        )}

        {messages.map((m, i) => {
          const typeInfo = m.role === "assistant" ? getTypeIndicator(m.type) : null;

          return (
            <div key={i} className={`group ${m.role === "user" ? "flex justify-end" : "flex justify-start"}`}>
              <div
                className={`relative max-w-[85%] rounded-xl px-3 py-2.5 text-[13px] leading-relaxed transition-all ${
                  m.role === "user"
                    ? "bg-blue-600/80 text-white"
                    : `bg-muted/20 text-foreground/90 ${typeInfo ? `border-l-2 ${typeInfo.color}` : ""}`
                }`}
                style={m.role === "assistant" ? { background: "rgba(55, 65, 81, 0.6)" } : undefined}
              >
                {/* Type header for special messages */}
                {typeInfo && (
                  <div className="flex items-center gap-1.5 mb-1.5 text-[10px] font-semibold tracking-wider uppercase opacity-80">
                    <span>{typeInfo.emoji}</span>
                    <span>{typeInfo.label}</span>
                  </div>
                )}

                {/* Content */}
                {m.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-1.5 [&_p]:last:mb-0 [&_code]:bg-black/30 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[11px] [&_pre]:bg-black/40 [&_pre]:rounded-lg [&_pre]:p-2 [&_pre]:text-[11px] [&_ul]:space-y-0.5 [&_li]:text-[12px]">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <span>{m.content}</span>
                )}

                {/* Confidence */}
                {m.confidence && (
                  <div className="mt-1.5 text-[10px] opacity-50">
                    Confidence: {m.confidence}%
                  </div>
                )}

                {/* Action buttons */}
                {m.actions && m.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {m.actions.map((action, ai) => (
                      <button
                        key={ai}
                        onClick={action.onClick}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-white/10 hover:bg-white/20 transition border border-white/10"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Timestamp + copy */}
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[9px] opacity-30">
                    {(m.timestamp || new Date()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                  <button
                    onClick={() => copyMessage(m.content, i)}
                    className="opacity-0 group-hover:opacity-40 hover:!opacity-80 transition p-0.5"
                    title="Copy"
                  >
                    {copiedIdx === i ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 px-3 py-2">
            <Loader2 className="h-3 w-3 animate-spin text-accent" />
            <span className="text-[10px] text-muted-foreground/40">Analyzing...</span>
          </div>
        )}

        <div ref={endRef} />

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-accent/80 text-[10px] text-white font-medium shadow-lg hover:bg-accent transition z-10"
          >
            New messages <ArrowDown className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/[0.06]">
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-3">
            <input
              value={input}
              onChange={e => onInputChange(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              placeholder="Type message..."
              className="flex-1 bg-transparent py-2 text-xs text-foreground placeholder:text-muted-foreground/25 outline-none"
              disabled={isLoading}
            />
            <button className="p-1 hover:bg-white/5 rounded transition" title="Attach file">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground/30" />
            </button>
            <button className="p-1 hover:bg-white/5 rounded transition" title="Voice input">
              <Mic className="h-3.5 w-3.5 text-muted-foreground/30" />
            </button>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-xl bg-accent/20 hover:bg-accent/30"
            onClick={onSend}
            disabled={isLoading || !input.trim()}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CrossChatPanel;
