import { useState, useRef, useEffect, useCallback } from "react";
import { Eye, Lock } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Conversation, ChatMode, Message } from "./types";
import type { ResponseDepth } from "./DepthSelector";
import ModeSelector from "./ModeSelector";
import DepthSelector from "./DepthSelector";
import ContextHealthIndicator from "./ContextHealthIndicator";
import TruthScore from "./TruthScore";
import FollowUpSuggestions from "./FollowUpSuggestions";
import DecodeView from "./DecodeView";
import CalibrationFeedback from "./CalibrationFeedback";
import type { FeedbackType } from "./CalibrationFeedback";
import AdaptiveInputBar from "./AdaptiveInputBar";
import ScrollIntelligence from "./ScrollIntelligence";
import SmartSelectionMenu from "./SmartSelectionMenu";

interface ChatViewProps {
  conversation: Conversation;
  onSendMessage: (content: string) => void;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  depth: ResponseDepth;
  onDepthChange: (depth: ResponseDepth) => void;
  isStreaming?: boolean;
  suggestions?: string[];
  onCalibrationFeedback?: (messageId: string, feedback: FeedbackType) => void;
  onStopStreaming?: () => void;
  focusMode?: boolean;
}

const ChatView = ({ conversation, onSendMessage, mode, onModeChange, depth, onDepthChange, isStreaming, suggestions = [], onCalibrationFeedback, onStopStreaming, focusMode }: ChatViewProps) => {
  const [input, setInput] = useState("");
  const [decodeId, setDecodeId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    onSendMessage(input.trim());
    setInput("");
  };

  const handleQuickAction = useCallback((action: string, content: string) => {
    const prompts: Record<string, string> = {
      debug: `Debug this code:\n\`\`\`\n${content}\n\`\`\``,
      explain: `Explain this code line by line:\n\`\`\`\n${content}\n\`\`\``,
      optimize: `Optimize this code:\n\`\`\`\n${content}\n\`\`\``,
      test: `Write tests for this code:\n\`\`\`\n${content}\n\`\`\``,
      summarize: `Summarize the content at: ${content}`,
      "fact-check": `Fact check: ${content}`,
      extract: `Extract key data from: ${content}`,
    };
    const prompt = prompts[action] ?? `${action}: ${content}`;
    onSendMessage(prompt);
    setInput("");
  }, [onSendMessage]);

  const handleSelectionAction = useCallback((action: string, text: string) => {
    if (action === "copy") {
      navigator.clipboard.writeText(text);
      return;
    }
    const prompts: Record<string, string> = {
      expand: `Expand on this: "${text}"`,
      rewrite: `Rewrite this differently: "${text}"`,
      "fact-check": `Fact check this claim: "${text}"`,
      ask: `Tell me more about: "${text}"`,
      explain: `Explain this code:\n\`\`\`\n${text}\n\`\`\``,
      debug: `Debug this code:\n\`\`\`\n${text}\n\`\`\``,
    };
    onSendMessage(prompts[action] ?? `${action}: "${text}"`);
  }, [onSendMessage]);

  const lastMsg = conversation.messages[conversation.messages.length - 1];
  const showSuggestions = lastMsg?.role === "assistant" && !isStreaming && suggestions.length > 0;

  return (
    <div className="flex flex-1 flex-col min-w-0 h-full">
      {/* Top bar — hidden in focus mode */}
      {!focusMode && (
        <div className="flex items-center justify-between px-4 pt-4 pb-2 lg:pt-4 gap-3 flex-wrap">
          <ModeSelector active={mode} onChange={onModeChange} />
          <div className="flex items-center gap-3">
            <ContextHealthIndicator messageCount={conversation.messages.length} />
            <DepthSelector active={depth} onChange={onDepthChange} />
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 pb-4 relative">
        {conversation.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center max-w-md animate-fade-in">
               <h1 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-3">
                How can I help?
              </h1>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Lock className="h-3 w-3 text-emerald-500/70" />
                <span className="text-xs font-extralight text-emerald-500/70">End-to-end encrypted</span>
              </div>
              <p className="text-sm font-extralight text-muted-foreground">
                Your messages are encrypted before leaving your device.
              </p>
            </div>
          </div>
        ) : (
          <div ref={messagesRef} className="relative mx-auto max-w-3xl space-y-4 py-4">
            <SmartSelectionMenu containerRef={messagesRef} onAction={handleSelectionAction} />
            {conversation.messages.map((msg, idx) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-slide-up`}
                style={{ animationDelay: `${Math.min(idx * 30, 150)}ms`, animationFillMode: "backwards" }}
              >
                <div className="max-w-[80%]">
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm font-light leading-relaxed transition-all ${
                      msg.role === "user"
                        ? "bg-foreground/15 text-foreground backdrop-blur-sm border border-border/20"
                        : "bg-card/50 text-foreground backdrop-blur-md border border-border/20"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_code]:text-accent [&_code]:bg-secondary/50 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-secondary/50 [&_pre]:rounded-lg [&_pre]:p-3 [&_blockquote]:border-accent/50 [&_blockquote]:text-muted-foreground [&_strong]:text-foreground [&_hr]:border-border/30">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        {isStreaming && msg === lastMsg && (
                          <span className="inline-block w-0.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
                        )}
                      </div>
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}
                  </div>
                  {msg.role === "assistant" && msg.content && !isStreaming && (
                    <div className="flex items-center gap-2 mt-1.5 px-1 flex-wrap animate-fade-in">
                      <TruthScore score={msg.truthScore ?? "medium"} sources={msg.sources} />
                      <button
                        onClick={() => setDecodeId(decodeId === msg.id ? null : msg.id)}
                        className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                      >
                        <Eye className="h-3 w-3" />
                        Decode
                      </button>
                      <CalibrationFeedback
                        messageId={msg.id}
                        onFeedback={onCalibrationFeedback ?? (() => {})}
                      />
                    </div>
                  )}
                  {msg.role === "assistant" && decodeId === msg.id && <DecodeView open={true} content={msg.content} />}
                </div>
              </div>
            ))}
            {showSuggestions && (
              <FollowUpSuggestions suggestions={suggestions} onSelect={(s) => onSendMessage(s)} />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
        <ScrollIntelligence
          containerRef={scrollContainerRef}
          isStreaming={!!isStreaming}
          messagesEndRef={messagesEndRef}
        />
      </div>

      {/* Adaptive Input */}
      <AdaptiveInputBar
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onStop={onStopStreaming}
        onQuickAction={handleQuickAction}
        isStreaming={!!isStreaming}
        disabled={!!isStreaming}
      />
    </div>
  );
};

export default ChatView;
