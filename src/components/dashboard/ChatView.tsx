import { useState, useRef, useEffect } from "react";
import { Send, Eye, Loader2 } from "lucide-react";
import type { Conversation, ChatMode, Message } from "./types";
import ModeSelector from "./ModeSelector";
import TruthScore from "./TruthScore";
import FollowUpSuggestions from "./FollowUpSuggestions";
import DecodeView from "./DecodeView";

interface ChatViewProps {
  conversation: Conversation;
  onSendMessage: (content: string) => void;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  isStreaming?: boolean;
  suggestions?: string[];
}

const ChatView = ({ conversation, onSendMessage, mode, onModeChange, isStreaming, suggestions = [] }: ChatViewProps) => {
  const [input, setInput] = useState("");
  const [decodeId, setDecodeId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation.messages.length, conversation.messages[conversation.messages.length - 1]?.content]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const lastMsg = conversation.messages[conversation.messages.length - 1];
  const showSuggestions = lastMsg?.role === "assistant" && !isStreaming && suggestions.length > 0;

  return (
    <div className="flex flex-1 flex-col min-w-0 h-full">
      {/* Top bar with mode selector */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 lg:pt-4">
        <ModeSelector active={mode} onChange={onModeChange} />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {conversation.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center max-w-md">
              <h1 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-3">
                How can I help?
              </h1>
              <p className="text-sm font-extralight text-muted-foreground">
                Start a conversation — your messages are encrypted end-to-end.
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4 py-4">
            {conversation.messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%]">
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm font-light leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-foreground/15 text-foreground backdrop-blur-sm border border-border/20"
                        : "bg-card/50 text-foreground backdrop-blur-md border border-border/20"
                    }`}
                  >
                    {msg.content}
                    {msg.role === "assistant" && isStreaming && msg === lastMsg && (
                      <span className="inline-block w-0.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
                    )}
                  </div>
                  {msg.role === "assistant" && msg.content && (
                    <div className="flex items-center gap-2 mt-1.5 px-1">
                      <TruthScore score={msg.truthScore ?? "medium"} sources={msg.sources} />
                      <button
                        onClick={() => setDecodeId(decodeId === msg.id ? null : msg.id)}
                        className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                      >
                        <Eye className="h-3 w-3" />
                        Decode
                      </button>
                    </div>
                  )}
                  {msg.role === "assistant" && decodeId === msg.id && <DecodeView open={true} />}
                </div>
              </div>
            ))}
            {showSuggestions && (
              <FollowUpSuggestions suggestions={suggestions} onSelect={(s) => onSendMessage(s)} />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 pb-4 lg:pb-6">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-end gap-3 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message Zialiel…"
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none max-h-32"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="shrink-0 rounded-xl bg-foreground p-2.5 text-background transition-colors hover:bg-foreground/90 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-center text-xs font-extralight text-muted-foreground/50">
            Zialiel may make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
