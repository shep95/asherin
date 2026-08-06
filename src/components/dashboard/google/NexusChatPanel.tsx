import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Brain, Lock, X, Maximize2, Minimize2, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { streamChat } from "@/lib/ai";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NexusMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface NexusChatPanelProps {
  activeModule: string;
  moduleLabel: string;
}

const moduleContextMap: Record<string, string> = {
  overview: "Cloud Intelligence Mesh station overview — all modules, multi-account management, and cross-platform correlation.",
  twin: "AI Digital Twin — the user's complete digital replica that predicts decisions, automates life, and knows communication style, preferences, and routines.",
  location: "Location Prophet — analyzes 5+ years of Google location history, predicts where the user will be next week with 95% accuracy, discovers movement patterns.",
  email: "AI Email Assistant — learns the user's writing style from sent emails, auto-replies in their voice, prioritizes inbox, and drafts messages.",
  gmail: "Gmail raw data feed — email patterns, sender analysis, thread intelligence.",
  subscriptions: "Subscription Oracle — scans emails for subscription confirmations, tracks recurring payments, predicts charges, finds forgotten subscriptions, identifies savings.",
  health: "Health Guardian — tracks steps, sleep, heart rate from Google Fit, detects health anomalies, predicts illness, tracks menstrual cycles.",
  fit: "Google Fit biometric data — steps, heart rate, sleep patterns, workout tracking.",
  calendar: "Calendar Wizard — auto-schedules meetings based on energy levels, commute patterns, and historical success rates, protects deep work hours.",
  contacts: "Contact Intelligence — scores every relationship from emails, meetings, photos, maps social graph, predicts next contact, warns when relationships fade.",
  career: "Career Predictor — predicts job changes, promotions, and career trajectory by analyzing recruiter emails, resume updates, calendar patterns, search history.",
  drive: "Google Drive file storage intelligence — document analysis, sharing patterns.",
  photos: "Google Photos visual intelligence — face recognition, location clustering, memory timeline.",
  youtube: "YouTube watch patterns — interest profiling, content consumption analysis.",
  search: "Google Search history — interest profiling, intent analysis, behavioral patterns.",
  chrome: "Chrome browsing intelligence — site visit patterns, productivity analysis.",
  connected: "Connected Apps — OAuth scope audit, permission analysis, risk scoring.",
};

const NexusChatPanel = ({ activeModule, moduleLabel }: NexusChatPanelProps) => {
  const [messages, setMessages] = useState<NexusMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: NexusMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const assistantMsg: NexusMessage = { id: crypto.randomUUID(), role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsStreaming(true);

    const moduleContext = moduleContextMap[activeModule] || "Asherin Cloud Intelligence Mesh";

    const systemContext = `You are Aureon, an AI intelligence assistant embedded in the Asherin Cloud Intelligence Mesh. The user is currently viewing: "${moduleLabel}" tab. Context about this module: ${moduleContext}. Answer questions about their Google data intelligence, help them understand patterns, and provide actionable insights. Be concise, intelligent, and specific to the module context. If they ask about data from a different module, reference it naturally.`;

    const apiMessages = [
      { role: "user" as const, content: systemContext },
      { role: "assistant" as const, content: "Understood. Station analyst online, reading your connected collection. What would you like to know?" },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: trimmed },
    ];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat({
        messages: apiMessages,
        mode: "research",
        depth: "standard",
        signal: controller.signal,
        onDelta: (text) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = { ...last, content: last.content + text };
            }
            return updated;
          });
        },
        onReplace: (fullText) => {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last.role === "assistant") {
              updated[updated.length - 1] = { ...last, content: fullText };
            }
            return updated;
          });
        },
        onDone: () => setIsStreaming(false),
      });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === "assistant") {
            updated[updated.length - 1] = { ...last, content: "Unable to connect. Please try again." };
          }
          return updated;
        });
      }
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, activeModule, moduleLabel]);

  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={`rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden flex flex-col transition-all ${
        expanded ? "fixed inset-4 z-50 shadow-2xl" : "h-[420px]"
      }`}
    >
      {/* Chat Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 bg-card/20 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-foreground/50" />
          <span className="text-xs font-light text-foreground">
            Asherin · {moduleLabel}
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setIsStreaming(false); abortRef.current?.abort(); }}
              className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 space-y-3">
              <Brain className="h-8 w-8 text-muted-foreground/15" />
              <p className="text-xs font-extralight text-muted-foreground/40 text-center max-w-[200px]">
                Ask Asherin about your {moduleLabel} intelligence
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center max-w-[280px]">
                {[
                  activeModule === "overview" ? "Summarize my collection" : `Analyze my ${moduleLabel} data`,
                  activeModule === "health" ? "Am I getting sick?" : "What patterns do you see?",
                  "What should I do next?",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="rounded-lg bg-foreground/5 px-2.5 py-1.5 text-[10px] font-light text-muted-foreground/60 hover:text-foreground hover:bg-foreground/10 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs font-light leading-relaxed ${
                    msg.role === "user"
                      ? "bg-foreground/15 text-foreground border border-border/20"
                      : "bg-foreground/5 text-foreground border border-border/10"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_ul]:my-1 [&_code]:text-accent [&_code]:bg-secondary/50 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-secondary/50 [&_pre]:rounded-lg [&_pre]:p-2">
                      {msg.content ? (
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      ) : isStreaming ? (
                        <div className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-pulse" />
                          <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-pulse" style={{ animationDelay: "150ms" }} />
                          <span className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-pulse" style={{ animationDelay: "300ms" }} />
                        </div>
                      ) : null}
                      {isStreaming && msg.content && (
                        <span className="inline-block w-0.5 h-3.5 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
                      )}
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="shrink-0 border-t border-border/20 bg-card/20 px-3 py-2.5">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask about ${moduleLabel}…`}
            rows={1}
            className="flex-1 resize-none bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 focus:outline-none leading-relaxed min-h-[32px] max-h-[120px] py-1.5"
          />
          {isStreaming ? (
            <button
              onClick={handleStop}
              className="shrink-0 rounded-lg bg-foreground/10 p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="shrink-0 rounded-lg bg-foreground/10 p-2 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Lock className="h-2.5 w-2.5 text-emerald-500/40" />
          <span className="text-[9px] font-extralight text-muted-foreground/30">Encrypted · Context-aware of {moduleLabel}</span>
        </div>
      </div>
    </div>
  );
};

export default NexusChatPanel;
