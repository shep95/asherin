import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Square, Lock, Copy, Check, Eye, Sparkles, ArrowRight, Brain, Plus, X, ChevronDown, Settings2 } from "lucide-react";
import IdeModelSelector from "./IdeModelSelector";
import MessageQueuePanel, { type QueueItem } from "../MessageQueuePanel";
import ReactMarkdown from "react-markdown";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useAccess } from "@/hooks/useAccess";
import TypingIndicator from "../TypingIndicator";
import TruthScore from "../TruthScore";
import CalibrationFeedback from "../CalibrationFeedback";
import type { FeedbackType } from "../CalibrationFeedback";
import DecodeView from "../DecodeView";
import FollowUpSuggestions from "../FollowUpSuggestions";
import ZaliQuestionOptions, { parseQuestionOptions } from "../zali/ZaliQuestionOptions";

// Custom prompt brain type
export interface CustomBrain {
  id: string;
  name: string;
  prompt: string;
  icon?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Props {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (content: string, customBrainPrompt?: string) => void;
  onStop: () => void;
  suggestions?: string[];
  onCalibrationFeedback?: (messageId: string, feedback: FeedbackType) => void;
  activeFileName?: string;
  activeFileContent?: string;
  creditsRemaining?: number;
  maxCredits?: number;
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

const STORAGE_KEY = "aureon-ide-custom-brains";

function loadBrains(): CustomBrain[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveBrains(brains: CustomBrain[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(brains));
}

const IdeChatPanel = ({ messages, isStreaming, onSend, onStop, suggestions = [], onCalibrationFeedback, activeFileName, activeFileContent, creditsRemaining, maxCredits }: Props) => {
  const [input, setInput] = useState("");
  const [decodeId, setDecodeId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { subscribed, loading } = useSubscription();
  const { isAdmin } = useAccess();

  // Cursor-style ⌘L bridge: editor sends selection here as an @-reference block.
  useEffect(() => {
    const onAdd = (e: Event) => {
      const d = (e as CustomEvent).detail as { path: string; language: string; snippet: string; startLine: number; endLine: number } | null;
      if (!d) return;
      const block = `\n\n@${d.path}:${d.startLine}-${d.endLine}\n\`\`\`${d.language}\n${d.snippet}\n\`\`\`\n`;
      setInput((prev) => (prev ? prev + block : block.trimStart()));
    };
    window.addEventListener("ide:add-to-chat", onAdd);
    return () => window.removeEventListener("ide:add-to-chat", onAdd);
  }, []);

  // Custom brain state
  const [customBrains, setCustomBrains] = useState<CustomBrain[]>(loadBrains);
  const [activeBrainId, setActiveBrainId] = useState<string | null>(null);
  const [showBrainManager, setShowBrainManager] = useState(false);
  const [newBrainName, setNewBrainName] = useState("");
  const [newBrainPrompt, setNewBrainPrompt] = useState("");
  const [editingBrainId, setEditingBrainId] = useState<string | null>(null);
  const [showBrainDropdown, setShowBrainDropdown] = useState(false);

  const activeBrain = customBrains.find(b => b.id === activeBrainId) ?? null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const [messageQueue, setMessageQueue] = useState<QueueItem[]>([]);
  const [queuePaused, setQueuePaused] = useState(false);
  const processingRef = useRef(false);

  // Process queue: send next queued message when not streaming
  useEffect(() => {
    if (isStreaming || queuePaused || messageQueue.length === 0 || processingRef.current) return;
    processingRef.current = true;
    const next = messageQueue[0];
    setMessageQueue(prev => prev.slice(1));
    onSend(next.content, activeBrain?.prompt);
    // Reset processing flag after a tick to allow re-triggering
    setTimeout(() => { processingRef.current = false; }, 100);
  }, [isStreaming, messageQueue, queuePaused]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");

    // If currently streaming, queue the message instead of sending directly
    if (isStreaming) {
      setMessageQueue(prev => [...prev, { id: crypto.randomUUID(), content: text }]);
      return;
    }

    onSend(text, activeBrain?.prompt);
  };

  const removeFromQueue = useCallback((id: string) => {
    setMessageQueue(prev => prev.filter(q => q.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    setMessageQueue([]);
  }, []);

  const processQueueNow = useCallback(() => {
    setQueuePaused(false);
  }, []);

  const addBrain = () => {
    if (!newBrainName.trim() || !newBrainPrompt.trim()) return;
    const brain: CustomBrain = { id: crypto.randomUUID(), name: newBrainName.trim(), prompt: newBrainPrompt.trim() };
    const updated = [...customBrains, brain];
    setCustomBrains(updated);
    saveBrains(updated);
    setNewBrainName("");
    setNewBrainPrompt("");
    setEditingBrainId(null);
  };

  const updateBrain = (id: string) => {
    if (!newBrainName.trim() || !newBrainPrompt.trim()) return;
    const updated = customBrains.map(b => b.id === id ? { ...b, name: newBrainName.trim(), prompt: newBrainPrompt.trim() } : b);
    setCustomBrains(updated);
    saveBrains(updated);
    setNewBrainName("");
    setNewBrainPrompt("");
    setEditingBrainId(null);
  };

  const deleteBrain = (id: string) => {
    const updated = customBrains.filter(b => b.id !== id);
    setCustomBrains(updated);
    saveBrains(updated);
    if (activeBrainId === id) setActiveBrainId(null);
  };

  const startEditBrain = (brain: CustomBrain) => {
    setEditingBrainId(brain.id);
    setNewBrainName(brain.name);
    setNewBrainPrompt(brain.prompt);
    setShowBrainManager(true);
  };

  const sendWithContext = (text: string) => {
    if (activeFileName && activeFileContent) {
      onSend(`[Context: ${activeFileName}]\n\`\`\`\n${activeFileContent.slice(0, 2000)}\n\`\`\`\n\n${text}`, activeBrain?.prompt);
    } else {
      onSend(text, activeBrain?.prompt);
    }
  };

  const lastMsg = messages[messages.length - 1];
  const showSuggestions = lastMsg?.role === "assistant" && !isStreaming && suggestions.length > 0;

  if (loading) return <div className="flex-1" />;


  if (!subscribed && !isAdmin) {
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
      {/* Header with brain selector */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/20">
        <Sparkles className="h-3 w-3 text-accent/60 shrink-0" />
        <span className="text-[10px] font-light tracking-widest text-muted-foreground/50 uppercase shrink-0">AI</span>

        {/* Brain selector dropdown */}
        <div className="relative ml-auto flex items-center gap-1">
          <IdeModelSelector />
          {activeFileName && (
            <span className="text-[8px] font-light text-accent/50 bg-accent/10 rounded-full px-1.5 py-0.5 truncate max-w-[80px]">
              {activeFileName}
            </span>
          )}
          <button
            onClick={() => setShowBrainDropdown(!showBrainDropdown)}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-light transition-colors border ${
              activeBrain ? "border-foreground/20 bg-foreground/5 text-foreground" : "border-border/20 text-muted-foreground/50 hover:text-foreground"
            }`}
          >
            <Brain className="h-2.5 w-2.5" />
            <span className="truncate max-w-[60px]">{activeBrain?.name ?? "Default"}</span>
            <ChevronDown className="h-2 w-2" />
          </button>
          <button onClick={() => setShowBrainManager(!showBrainManager)} className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors" title="Manage Brains">
            <Settings2 className="h-3 w-3" />
          </button>

          {/* Brain dropdown */}
          {showBrainDropdown && (
            <div className="absolute top-full right-0 mt-1 w-48 z-50 rounded-xl border border-border/30 bg-card shadow-2xl py-1 max-h-[200px] overflow-y-auto">
              <button
                onClick={() => { setActiveBrainId(null); setShowBrainDropdown(false); }}
                className={`w-full text-left px-3 py-1.5 text-[10px] font-light transition-colors hover:bg-foreground/5 ${!activeBrainId ? "text-foreground" : "text-muted-foreground"}`}
              >
                <Brain className="h-3 w-3 text-muted-foreground/60 inline mr-1" /> Default (Aureon Core)
              </button>
              {customBrains.map(b => (
                <button key={b.id}
                  onClick={() => { setActiveBrainId(b.id); setShowBrainDropdown(false); }}
                  className={`w-full text-left px-3 py-1.5 text-[10px] font-light transition-colors hover:bg-foreground/5 flex items-center justify-between ${activeBrainId === b.id ? "text-foreground" : "text-muted-foreground"}`}
                >
                  <span className="truncate"><Settings2 className="h-2.5 w-2.5 inline mr-0.5 text-muted-foreground/50" />{b.name}</span>
                </button>
              ))}
              {customBrains.length === 0 && (
                <p className="px-3 py-2 text-[9px] text-muted-foreground/40">No custom brains yet</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Brain Manager Panel */}
      {showBrainManager && (
        <div className="border-b border-border/20 bg-card/30 p-2.5 space-y-2 max-h-[280px] overflow-y-auto">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-light tracking-widest text-muted-foreground/50 uppercase">Custom Brains</span>
            <button onClick={() => { setShowBrainManager(false); setEditingBrainId(null); setNewBrainName(""); setNewBrainPrompt(""); }} className="p-0.5 text-muted-foreground/40 hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Existing brains */}
          {customBrains.map(b => (
            <div key={b.id} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${activeBrainId === b.id ? "border-foreground/20 bg-foreground/5" : "border-border/15 bg-card/20"}`}>
              <Brain className="h-3 w-3 text-muted-foreground/50 shrink-0" />
              <span className="flex-1 text-[10px] font-light text-foreground truncate">{b.name}</span>
              <button onClick={() => startEditBrain(b)} className="text-[8px] text-muted-foreground/50 hover:text-foreground px-1">Edit</button>
              <button onClick={() => deleteBrain(b.id)} className="text-[8px] text-destructive/60 hover:text-destructive px-1">Del</button>
            </div>
          ))}

          {/* Add/Edit form */}
          <div className="space-y-1.5 pt-1 border-t border-border/10">
            <input
              value={newBrainName}
              onChange={e => setNewBrainName(e.target.value)}
              placeholder="Brain name (e.g. React Expert)"
              className="w-full bg-background/50 border border-border/20 rounded-lg px-2 py-1.5 text-[10px] font-light text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30"
            />
            <textarea
              value={newBrainPrompt}
              onChange={e => setNewBrainPrompt(e.target.value)}
              placeholder="System prompt... (e.g. Always use TypeScript strict mode, prefer functional components, use Tailwind utility classes...)"
              rows={3}
              className="w-full bg-background/50 border border-border/20 rounded-lg px-2 py-1.5 text-[10px] font-light text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30 resize-none"
            />
            <button
              onClick={() => editingBrainId ? updateBrain(editingBrainId) : addBrain()}
              disabled={!newBrainName.trim() || !newBrainPrompt.trim()}
              className="w-full flex items-center justify-center gap-1 rounded-lg bg-foreground/10 text-foreground text-[10px] font-light py-1.5 hover:bg-foreground/15 transition-colors disabled:opacity-30"
            >
              <Plus className="h-3 w-3" />
              {editingBrainId ? "Update Brain" : "Add Brain"}
            </button>
          </div>
        </div>
      )}

      {/* Active brain indicator */}
      {activeBrain && !showBrainManager && (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-foreground/5 border-b border-border/15">
          <Brain className="h-2.5 w-2.5 text-muted-foreground/60" />
          <span className="text-[9px] font-light text-muted-foreground/70 truncate">Active: {activeBrain.name}</span>
          <button onClick={() => setActiveBrainId(null)} className="ml-auto text-[8px] text-muted-foreground/40 hover:text-foreground">Clear</button>
        </div>
      )}

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

      {/* Message Queue Panel */}
      <MessageQueuePanel
        items={messageQueue}
        onRemove={removeFromQueue}
        onClear={clearQueue}
        onProcessNow={processQueueNow}
        paused={queuePaused}
        onTogglePause={() => setQueuePaused(p => !p)}
      />

      {/* Input — never disabled, allows queuing while streaming */}
      <form onSubmit={handleSubmit} className="p-2 border-t border-border/20">
        <div className={`flex items-center gap-2 rounded-xl border ${isStreaming && messageQueue.length > 0 ? "border-accent/20" : "border-border/20"} bg-card/20 px-2.5 py-2`}>
          <input
            value={input} onChange={(e) => setInput(e.target.value)}
            placeholder={isStreaming ? "Type to queue next message..." : (activeBrain ? `Ask with ${activeBrain.name}...` : "Ask about your code...")}
            className="flex-1 bg-transparent text-[11px] font-light text-foreground placeholder:text-muted-foreground/30 outline-none"
          />
          {isStreaming && (
            <button type="button" onClick={onStop} className="p-1 rounded text-destructive hover:bg-destructive/10 transition-colors" title="Stop generating">
              <Square className="h-3 w-3" />
            </button>
          )}
          <button type="submit" disabled={!input.trim()} className="p-1 rounded text-accent hover:bg-accent/10 transition-colors disabled:opacity-30" title={isStreaming ? "Queue message" : "Send"}>
            <Send className="h-3 w-3" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default IdeChatPanel;
