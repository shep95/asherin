import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Square, Lock, Copy, Check, Download, ArrowRight, Sparkles, Code2, ZoomIn, FileCode2 } from "lucide-react";
import type { ZaliMessage, ZaliProject } from "./types";
import type { ResponseDepth } from "../DepthSelector";
import type { ChatMode } from "../types";
import ReactMarkdown from "react-markdown";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAccess } from "@/hooks/useAccess";
import DepthSelector from "../DepthSelector";
import ContextHealthIndicator from "../ContextHealthIndicator";
import type { FeedbackType } from "../CalibrationFeedback";
import TypingIndicator from "../TypingIndicator";
import CodeFilePreview from "../CodeFilePreview";
import FollowUpSuggestions from "../FollowUpSuggestions";
import ScrollIntelligence from "../ScrollIntelligence";
import ZaliQuestionOptions, { parseQuestionOptions } from "./ZaliQuestionOptions";

const SOFTWARE_TYPES = ["software", "app", "web", "mobile", "api", "saas", "backend", "frontend", "fullstack", "full-stack", "service", "microservice", "platform", "dashboard", "cli", "library", "plugin", "extension", "bot", "automation", "script", "code"];

function isSoftwareProject(project: ZaliProject | null): boolean {
  if (!project) return false;
  const lower = (project.designType + " " + project.name + " " + project.description).toLowerCase();
  return SOFTWARE_TYPES.some((kw) => lower.includes(kw));
}

interface Props {
  messages: ZaliMessage[];
  project: ZaliProject | null;
  isStreaming: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  depth: ResponseDepth;
  onDepthChange: (depth: ResponseDepth) => void;
  suggestions?: string[];
  onCalibrationFeedback?: (messageId: string, feedback: FeedbackType) => void;
}

// Copy button for messages
function MessageCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors" title="Copy message">
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

// Code block copy
function CodeBlockCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-foreground/10 hover:bg-foreground/20 text-muted-foreground hover:text-foreground transition-colors"
      title="Copy code"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
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
  img({ src, alt, ...props }: any) {
    return (
      <span className="relative inline-block group cursor-pointer" onClick={() => (window as any).__aureonLightbox?.(src)}>
        <img
          src={src}
          alt={alt || "Chart analysis"}
          className="rounded-xl border border-border/20 max-w-full my-3 shadow-lg transition-transform hover:scale-[1.02]"
          style={{ maxHeight: "500px", objectFit: "contain" }}
          loading="lazy"
          {...props}
        />
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-xl">
          <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
        </span>
      </span>
    );
  },
};

// Code block detection in user messages
const CODE_BLOCK_RE = /```(\w+)?\n([\s\S]*?)```/g;

function UserMessageContent({ content }: { content: string }) {
  // Clean generate trigger prefix for display
  const displayContent = content.replace("__GENERATE_CODE_NOW__ ", "").replace("__GENERATE_CODE_NOW__", "");

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(CODE_BLOCK_RE);
  let key = 0;

  while ((match = regex.exec(displayContent)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={key++} className="whitespace-pre-wrap">{displayContent.slice(lastIndex, match.index)}</span>);
    }
    parts.push(<CodeFilePreview key={key++} code={match[2].trimEnd()} language={match[1]} />);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < displayContent.length) {
    parts.push(<span key={key++} className="whitespace-pre-wrap">{displayContent.slice(lastIndex)}</span>);
  }

  if (parts.length === 0) {
    const trimmed = displayContent.trim();
    const looksLikeCode = trimmed.split("\n").length >= 3 && (
      /[{};()=>]/.test(trimmed) && /^(import|export|const|let|var|function|def |class |#include|package |fn |pub )/.test(trimmed)
    );
    if (looksLikeCode) return <CodeFilePreview code={trimmed} />;
    return <span className="whitespace-pre-wrap">{displayContent}</span>;
  }
  return <>{parts}</>;
}

const ZaliChatPanel = ({ messages, project, isStreaming, onSend, onStop, mode, onModeChange, depth, onDepthChange, suggestions = [], onCalibrationFeedback }: Props) => {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { subscribed, loading: subLoading } = useSubscription();
  const { isAdmin } = useAccess();

  // Strip fenced code blocks from chat display — code is rendered in workspace.
  const stripCodeBlocks = (raw: string): { text: string; codeCount: number } => {
    let count = 0;
    const cleaned = raw.replace(/```[\w.+-]*\n[\s\S]*?```/g, () => { count++; return ""; }).replace(/\n{3,}/g, "\n\n").trim();
    return { text: cleaned, codeCount: count };
  };
  // Avoid lint warnings for now-removed pieces while preserving prop API
  void onModeChange; void mode; void onCalibrationFeedback;
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { subscribed, loading: subLoading } = useSubscription();
  const { isAdmin } = useAccess();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSend(input.trim());
    setInput("");
  };

  const downloadConversation = useCallback(() => {
    if (!messages.length) return;
    const lines = messages.map(m =>
      `**${m.role === "user" ? "You" : "ZANOEM"}** (${m.createdAt.toLocaleString()}):\n${m.content}`
    );
    const md = `# ZANOEM Design Lab — ${project?.name || "Conversation"}\n\n${lines.join("\n\n---\n\n")}`;
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ZANOEM-${(project?.name || "conversation").replace(/[^a-zA-Z0-9 -]/g, "")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, project]);

  const lastMsg = messages[messages.length - 1];
  const showSuggestions = lastMsg?.role === "assistant" && !isStreaming && suggestions.length > 0;

  return (
    <div className="flex flex-col h-full bg-background/40">
      {/* Top bar with mode/depth */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-border/15 hidden md:flex items-center justify-between gap-2">
        <ModeSelector active={mode} onChange={onModeChange} />
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button onClick={downloadConversation} className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Download conversation">
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
          <ContextHealthIndicator messageCount={messages.length} />
          <DepthSelector active={depth} onChange={onDepthChange} />
        </div>
      </div>

      {/* Mobile compact mode/depth bar */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-border/15 flex md:hidden items-center justify-between gap-2">
        <ModeSelector active={mode} onChange={onModeChange} />
        <DepthSelector active={depth} onChange={onDepthChange} />
      </div>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
        <div className="p-3 sm:p-5 space-y-3 sm:space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-10 sm:py-14 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border/20 bg-card/30 mb-4">
                <Lock className="h-3 w-3 text-emerald-500/70" />
                <span className="text-[10px] font-light tracking-[0.25em] uppercase text-muted-foreground/80">End-to-end encrypted</span>
              </div>
              <p className="text-[13px] font-extralight text-foreground/80 mb-1">
                {project ? "Describe what you want to design" : "Create a project to start designing"}
              </p>
              <p className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground/50">
                ZANOEM Design Intelligence
              </p>
              {project && (
                <div className="mt-6 space-y-1.5 max-w-md mx-auto">
                  <p className="text-[9px] tracking-[0.25em] uppercase text-muted-foreground/40 mb-2">Example prompts</p>
                  {[
                    "Design a camera with human eye quality",
                    "Create a biodegradable phone case from mushroom mycelium",
                    "Engineer a water purification tablet for disaster zones",
                    "Design a neural interface for paralysis patients",
                  ].map((p) => (
                    <button key={p} onClick={() => onSend(p)} className="block w-full text-left text-[11px] font-light text-muted-foreground/70 hover:text-foreground rounded-lg px-3 py-2 hover:bg-foreground/5 border border-transparent hover:border-border/20 transition-all">
                      → {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} animate-slide-up`}
              style={{ animationDelay: `${Math.min(idx * 30, 150)}ms`, animationFillMode: "backwards" }}
            >
              <div className="max-w-[90%] sm:max-w-[85%]">
                <div
                  className={`rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs font-light leading-relaxed transition-all ${
                    msg.role === "user"
                      ? "bg-foreground/15 text-foreground backdrop-blur-sm border border-border/20"
                      : "bg-card/50 text-foreground backdrop-blur-md border border-border/20"
                  }`}
                >
                  {msg.role === "assistant" && !msg.content && isStreaming && msg === lastMsg ? (
                    <TypingIndicator mode="thinking" />
                  ) : msg.role === "assistant" ? (
                    (() => {
                      const { cleanContent, options } = parseQuestionOptions(msg.content);
                      const isLastAssistant = msg === lastMsg && !isStreaming;
                      return (
                        <>
                          <div className="prose prose-sm prose-invert max-w-none overflow-hidden [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5 [&_p]:text-xs [&_p]:font-light [&_p]:leading-relaxed [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_li]:text-xs [&_code]:text-accent [&_code]:bg-secondary/50 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-secondary/50 [&_pre]:rounded-lg [&_pre]:p-3 [&_blockquote]:border-accent/50 [&_blockquote]:text-muted-foreground [&_strong]:text-foreground [&_hr]:border-border/30 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_table]:text-[10px] [&_th]:text-[10px] [&_td]:text-[10px]">
                            <ReactMarkdown components={markdownComponents}>{cleanContent}</ReactMarkdown>
                            {isStreaming && msg === lastMsg && (
                              <span className="inline-block w-0.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />
                            )}
                          </div>
                          {isLastAssistant && options.length > 0 && (
                            <ZaliQuestionOptions options={options} onSelect={(text) => onSend(text)} />
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <UserMessageContent content={msg.content} />
                  )}
                </div>
                {/* Action bar */}
                {msg.content && !isStreaming && (
                  <div className="flex items-center gap-2 mt-1.5 px-1 flex-wrap animate-fade-in">
                    <MessageCopyButton text={msg.content} />
                    {msg.role === "assistant" && (
                      <>
                        <TruthScore score="medium" />
                        <button
                          onClick={() => setDecodeId(decodeId === msg.id ? null : msg.id)}
                          className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                          Decode
                        </button>
                        <CalibrationFeedback messageId={msg.id} onFeedback={onCalibrationFeedback ?? (() => {})} />
                      </>
                    )}
                  </div>
                )}
                {msg.role === "assistant" && decodeId === msg.id && <DecodeView open={true} content={msg.content} />}
              </div>
            </div>
          ))}

          {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="bg-card/40 border border-border/10 rounded-2xl px-4 py-3">
                <TypingIndicator mode="thinking" />
              </div>
            </div>
          )}

          {showSuggestions && (
            <FollowUpSuggestions suggestions={suggestions} onSelect={(s) => onSend(s)} />
          )}

          <div ref={bottomRef} />
        </div>
        <ScrollIntelligence containerRef={scrollContainerRef} isStreaming={isStreaming} messagesEndRef={bottomRef} />
      </div>

      {/* Input — subscription gated */}
      {subLoading ? (
        <div className="flex-shrink-0 p-3 border-t border-border/15" />
      ) : !subscribed && !isAdmin ? (
        <div className="flex-shrink-0 border-t border-border/15 bg-card/30 backdrop-blur-md px-3 py-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Lock className="h-3.5 w-3.5 text-accent shrink-0" />
              <p className="text-[11px] font-light text-foreground">Subscribe to use ZANOEM.</p>
            </div>
            <a
              href="/dashboard"
              onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("aureon:navigate", { detail: "subscription" })); }}
              className="group flex items-center gap-1 rounded-lg bg-accent text-accent-foreground px-3 py-1.5 text-[10px] font-light hover:bg-accent/90 transition-all shrink-0"
            >
              Plans <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      ) : (
        <div className="flex-shrink-0 border-t border-border/15 bg-card/20 backdrop-blur-sm">
          {/* Generate Code button for software projects */}
          {isSoftwareProject(project) && messages.length > 0 && !isStreaming && (
            <div className="px-2 sm:px-3 pt-2.5 pb-1">
              <button
                onClick={() => onSend("__GENERATE_CODE_NOW__ Based on everything we've discussed, generate the complete code for this project now.")}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 hover:bg-accent/20 py-2.5 text-xs font-light text-accent transition-all group active:scale-[0.98]"
              >
                <Code2 className="h-3.5 w-3.5" />
                <span>Generate Code</span>
                <Sparkles className="h-3 w-3 opacity-60 group-hover:opacity-100 group-hover:animate-pulse transition-opacity" />
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="p-2.5 sm:p-3">
            <div className="flex items-center gap-2 rounded-xl border border-border/25 bg-background/40 focus-within:border-foreground/30 focus-within:bg-background/60 px-3.5 py-2.5 transition-colors">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={project ? "Message ZANOEM…" : "Create a project first"}
                disabled={!project || isStreaming}
                className="flex-1 bg-transparent text-[12px] font-light text-foreground placeholder:text-muted-foreground/40 outline-none disabled:opacity-40"
              />
              {isStreaming ? (
                <button type="button" onClick={onStop} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors" title="Stop">
                  <Square className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button type="submit" disabled={!input.trim() || !project} className="p-1.5 rounded-lg text-accent hover:bg-accent/10 transition-colors disabled:opacity-30" title="Send">
                  <Send className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ZaliChatPanel;
