import { useState, useRef, useEffect } from "react";
import { Send, Square, Lock, Copy, Check, Eye, Sparkles, ArrowRight } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useSubscription } from "@/contexts/SubscriptionContext";
import TypingIndicator from "../TypingIndicator";
import TruthScore from "../TruthScore";
import CalibrationFeedback from "../CalibrationFeedback";
import type { FeedbackType } from "../CalibrationFeedback";
import DecodeView from "../DecodeView";
import FollowUpSuggestions from "../FollowUpSuggestions";
import ZaliQuestionOptions, { parseQuestionOptions } from "../zali/ZaliQuestionOptions";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
  suggestions?: string[];
  onCalibrationFeedback?: (messageId: string, feedback: FeedbackType) => void;
  /** Current file context for AI awareness */
  activeFileName?: string;
  activeFileContent?: string;
}

function CodeBlockCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-foreground/10 hover:bg-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

const markdownComponents = {
  pre({ children, ...props }: any) {
    let codeText = "";
    const extractText = (node: any): string => {
      if (typeof node === "string") return node;
      if (node?.props?.children) {
        if (Array.isArray(node.props.children)) return node.props.children.map(extractText).join("");
        return extractText(node.props.children);
      }
      return "";
    };
    codeText = extractText(children);
    return (
      <div className="relative group overflow-hidden">
        <pre className="overflow-x-auto" {...props}>{children}</pre>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <CodeBlockCopyButton code={codeText} />
        </div>
      </div>
    );
  },
};

function MessageCopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 text-[9px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors">
      {copied ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

const IdeChatPanel = ({ messages, isStreaming, onSend, onStop, suggestions = [], onCalibrationFeedback, activeFileName, activeFileContent }: Props) => {
  const [input, setInput] = useState("");
  const [decodeId, setDecodeId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { subscribed, loading } = useSubscription();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    // If there's an active file, auto-attach context
    let msg = input.trim();
    onSend(msg);
    setInput("");
  };

  const sendWithContext = (text: string) => {
    if (activeFileName && activeFileContent) {
      onSend(`[Context: ${activeFileName}]\n\`\`\`\n${activeFileContent.slice(0, 2000)}\n\`\`\`\n\n${text}`);
    } else {
      onSend(text);
    }
  };

  const lastMsg = messages[messages.length - 1];
  const showSuggestions = lastMsg?.role === "assistant" && !isStreaming && suggestions.length > 0;

  if (loading) return <div className="flex-1" />;

  if (!subscribed) {
    return (
      <div className="flex flex-col h-full items-center justify-center p-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 w-full">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-accent shrink-0" />
            <p className="text-[11px] font-light text-foreground">Subscribe to use IDE AI.</p>
          </div>
          <a href="/dashboard" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("aureon:navigate", { detail: "subscription" })); }}
            className="group flex items-center gap-1 rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-[10px] font-light hover:bg-accent/90 transition-all shrink-0">
            Plans <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/20">
        <Sparkles className="h-3 w-3 text-accent/60" />
        <span className="text-[10px] font-light tracking-widest text-muted-foreground/50 uppercase">AI Assistant</span>
        {activeFileName && (
          <span className="text-[9px] font-light text-accent/60 bg-accent/10 rounded-full px-2 py-0.5 truncate max-w-[140px]">
            {activeFileName}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0 p-2.5 space-y-2.5">
        {messages.length === 0 && (
          <div className="text-center py-6 animate-fade-in">
            <p className="text-[11px] font-extralight text-muted-foreground/50">Ask anything about your code...</p>
            <div className="mt-3 space-y-1">
              {[
                "Explain this file",
                "Find bugs in my code",
                "Generate unit tests",
                "Refactor for performance",
              ].map(p => (
                <button key={p} onClick={() => sendWithContext(p)}
                  className="block w-full text-left text-[10px] text-muted-foreground/50 hover:text-foreground rounded-lg px-2.5 py-1.5 hover:bg-foreground/5 transition-colors">
                  → {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[95%]">
              <div className={`rounded-xl px-3 py-2 text-[11px] font-light leading-relaxed ${
                msg.role === "user"
                  ? "bg-foreground/10 text-foreground border border-border/15"
                  : "bg-card/40 text-foreground border border-border/15"
              }`}>
                {msg.role === "assistant" && !msg.content && isStreaming && msg === lastMsg ? (
                  <TypingIndicator mode="thinking" />
                ) : msg.role === "assistant" ? (
                  (() => {
                    const { cleanContent, options } = parseQuestionOptions(msg.content);
                    const isLastAssistant = msg === lastMsg && !isStreaming;
                    return (
                      <>
                        <div className="prose prose-sm prose-invert max-w-none overflow-hidden [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_p]:text-[11px] [&_p]:font-light [&_code]:text-accent [&_code]:bg-secondary/50 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-secondary/50 [&_pre]:rounded-lg [&_pre]:p-2 [&_pre]:text-[10px]">
                          <ReactMarkdown components={markdownComponents}>{cleanContent}</ReactMarkdown>
                          {isStreaming && msg === lastMsg && (
                            <span className="inline-block w-0.5 h-3.5 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
                          )}
                        </div>
                        {isLastAssistant && options.length > 0 && (
                          <ZaliQuestionOptions options={options} onSelect={onSend} />
                        )}
                      </>
                    );
                  })()
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>
              {msg.content && !isStreaming && (
                <div className="flex items-center gap-1.5 mt-1 px-0.5">
                  <MessageCopyBtn text={msg.content} />
                  {msg.role === "assistant" && (
                    <>
                      <TruthScore score="medium" />
                      <button onClick={() => setDecodeId(decodeId === msg.id ? null : msg.id)}
                        className="flex items-center gap-0.5 text-[9px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                        <Eye className="h-2.5 w-2.5" /> Decode
                      </button>
                      <CalibrationFeedback messageId={msg.id} onFeedback={onCalibrationFeedback ?? (() => {})} />
                    </>
                  )}
                </div>
              )}
              {msg.role === "assistant" && decodeId === msg.id && <DecodeView open content={msg.content} />}
            </div>
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-card/30 border border-border/10 rounded-xl px-3 py-2">
              <TypingIndicator mode="thinking" />
            </div>
          </div>
        )}

        {showSuggestions && <FollowUpSuggestions suggestions={suggestions} onSelect={onSend} />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-border/20">
        <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 px-2.5 py-2">
          <input
            value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your code..."
            disabled={isStreaming}
            className="flex-1 bg-transparent text-[11px] font-light text-foreground placeholder:text-muted-foreground/30 outline-none disabled:opacity-40"
          />
          {isStreaming ? (
            <button type="button" onClick={onStop} className="p-1 rounded text-destructive hover:bg-destructive/10 transition-colors">
              <Square className="h-3 w-3" />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className="p-1 rounded text-accent hover:bg-accent/10 transition-colors disabled:opacity-30">
              <Send className="h-3 w-3" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default IdeChatPanel;
