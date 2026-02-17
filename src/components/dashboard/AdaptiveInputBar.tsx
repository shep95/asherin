import { useState, useEffect, useCallback, useRef } from "react";
import { Send, Loader2, Square, Bug, Zap, TestTubes, FileText, Link, Search, BarChart3, ImageIcon, Code, Lock, X, WifiOff } from "lucide-react";
import { saveDraft, getDraft, deleteDraft } from "@/lib/messageQueue";

type InputIntent = "text" | "code" | "url" | "image" | "file";

interface AdaptiveInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  onQuickAction?: (action: string, content: string) => void;
  isStreaming: boolean;
  disabled?: boolean;
  conversationId?: string;
}

function detectIntent(text: string): InputIntent {
  const trimmed = text.trim();
  // URL detection
  if (/^https?:\/\/\S+$/i.test(trimmed)) return "url";
  // Code detection (multi-line with brackets/semicolons or language markers)
  if (
    (trimmed.includes("\n") && (trimmed.includes("{") || trimmed.includes("=>") || trimmed.includes("import ") || trimmed.includes("def ") || trimmed.includes("function "))) ||
    trimmed.startsWith("```")
  ) return "code";
  return "text";
}

const quickActions: Record<InputIntent, { id: string; icon: React.ElementType; label: string }[]> = {
  text: [],
  code: [
    { id: "debug", icon: Bug, label: "Debug" },
    { id: "explain", icon: FileText, label: "Explain" },
    { id: "optimize", icon: Zap, label: "Optimize" },
    { id: "test", icon: TestTubes, label: "Add Tests" },
  ],
  url: [
    { id: "summarize", icon: FileText, label: "Summarize" },
    { id: "fact-check", icon: Search, label: "Fact Check" },
    { id: "extract", icon: BarChart3, label: "Extract Data" },
  ],
  image: [
    { id: "describe", icon: FileText, label: "Describe" },
    { id: "extract-text", icon: FileText, label: "Extract Text" },
    { id: "analyze", icon: Search, label: "Analyze" },
  ],
  file: [
    { id: "summarize", icon: FileText, label: "Summarize" },
    { id: "extract", icon: BarChart3, label: "Key Points" },
  ],
};

const AdaptiveInputBar = ({ value, onChange, onSend, onStop, onQuickAction, isStreaming, disabled, conversationId }: AdaptiveInputBarProps) => {
  const [intent, setIntent] = useState<InputIntent>("text");
  const [draftSaved, setDraftSaved] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIntent(detectIntent(value));
  }, [value]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 128) + "px";
  }, [value]);

  // Online/offline tracking
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Load draft on mount / conversation change
  useEffect(() => {
    const key = conversationId || "global";
    getDraft(key).then(draft => {
      if (draft && draft.content && !value) {
        onChange(draft.content);
        setDraftSaved(`Restored from ${new Date(draft.updatedAt).toLocaleTimeString()}`);
        setTimeout(() => setDraftSaved(null), 3000);
      }
    }).catch(() => {});
  }, [conversationId]);

  // Auto-save draft every 500ms
  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    if (!value.trim()) {
      setDraftSaved(null);
      return;
    }
    draftTimerRef.current = setTimeout(() => {
      const key = conversationId || "global";
      saveDraft({ id: key, content: value, updatedAt: Date.now() }).then(() => {
        setDraftSaved("Draft saved");
        setTimeout(() => setDraftSaved(null), 2000);
      }).catch(() => {});
    }, 500);
    return () => { if (draftTimerRef.current) clearTimeout(draftTimerRef.current); };
  }, [value, conversationId]);

  // Clear draft on send
  const handleSend = () => {
    const key = conversationId || "global";
    deleteDraft(key).catch(() => {});
    setDraftSaved(null);
    onSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearDraft = () => {
    const key = conversationId || "global";
    onChange("");
    deleteDraft(key).catch(() => {});
    setDraftSaved(null);
  };

  const actions = quickActions[intent];

  return (
    <div className="px-4 pb-4 lg:pb-6">
      <div className="mx-auto max-w-3xl">
        {/* Quick action pills */}
        {actions.length > 0 && value.trim() && (
          <div className="flex items-center gap-1.5 mb-2 animate-fade-in">
            {intent === "code" && <Code className="h-3 w-3 text-accent mr-1" />}
            {intent === "url" && <Link className="h-3 w-3 text-accent mr-1" />}
            {actions.map((a) => (
              <button
                key={a.id}
                onClick={() => onQuickAction?.(a.id, value)}
                className="flex items-center gap-1.5 rounded-lg border border-border/20 bg-card/40 backdrop-blur-sm px-2.5 py-1 text-[11px] font-light text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-all hover:scale-[1.02]"
              >
                <a.icon className="h-3 w-3" />
                {a.label}
              </button>
            ))}
          </div>
        )}

        <div className={`flex items-end gap-3 rounded-2xl border ${online ? "border-border/30" : "border-amber-500/30"} bg-card/40 backdrop-blur-xl p-3 transition-all`}>
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={online ? "Message Aureon…" : "Offline — messages will queue…"}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none max-h-32"
          />
          {value.trim() && (
            <button onClick={clearDraft} className="shrink-0 p-1 text-muted-foreground/40 hover:text-muted-foreground transition-colors" title="Clear draft">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {isStreaming ? (
            <button
              onClick={onStop}
              className="shrink-0 rounded-xl bg-destructive p-2.5 text-destructive-foreground transition-all hover:bg-destructive/90 active:scale-95"
              title="Stop generating"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!value.trim() || disabled}
              className="shrink-0 rounded-xl bg-foreground p-2.5 text-background transition-all hover:bg-foreground/90 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 hover:scale-[1.02]"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          {!online && <WifiOff className="h-3 w-3 text-amber-400/70" />}
          <Lock className="h-3 w-3 text-emerald-500/50" />
          <p className="text-xs font-extralight text-muted-foreground/50">
            {!online ? "Offline · messages queued" : "End-to-end encrypted"}{draftSaved ? ` · ${draftSaved}` : ""} · Aureon may make mistakes
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdaptiveInputBar;
