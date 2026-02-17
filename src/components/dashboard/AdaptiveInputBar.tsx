import { useState, useEffect, useCallback, useRef } from "react";
import { Send, Loader2, Square, Bug, Zap, TestTubes, FileText, Link, Search, BarChart3, ImageIcon, Code, Lock } from "lucide-react";

type InputIntent = "text" | "code" | "url" | "image" | "file";

interface AdaptiveInputBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void;
  onQuickAction?: (action: string, content: string) => void;
  isStreaming: boolean;
  disabled?: boolean;
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

const AdaptiveInputBar = ({ value, onChange, onSend, onStop, onQuickAction, isStreaming, disabled }: AdaptiveInputBarProps) => {
  const [intent, setIntent] = useState<InputIntent>("text");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
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

        <div className="flex items-end gap-3 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-3 transition-all">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Aureon…"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none max-h-32"
          />
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
              onClick={onSend}
              disabled={!value.trim() || disabled}
              className="shrink-0 rounded-xl bg-foreground p-2.5 text-background transition-all hover:bg-foreground/90 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 hover:scale-[1.02]"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <Lock className="h-3 w-3 text-emerald-500/50" />
          <p className="text-xs font-extralight text-muted-foreground/50">
            End-to-end encrypted · Aureon may make mistakes
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdaptiveInputBar;
