import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Send, Loader2, Square, Bug, Zap, TestTubes, FileText, Link, Search, BarChart3, ImageIcon, Code, Lock, X, WifiOff, Paperclip } from "lucide-react";
import { saveDraft, getDraft, deleteDraft } from "@/lib/messageQueue";
import SmartAutocomplete, { trackPhrase } from "./SmartAutocomplete";
import type { FileAttachment } from "./types";

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
  attachments?: FileAttachment[];
  onAttachmentsChange?: (files: FileAttachment[]) => void;
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

const AdaptiveInputBar = ({ value, onChange, onSend, onStop, onQuickAction, isStreaming, disabled, conversationId, attachments = [], onAttachmentsChange }: AdaptiveInputBarProps) => {
  const [intent, setIntent] = useState<InputIntent>("text");
  const [draftSaved, setDraftSaved] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const isMobile = useMemo(() => /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768, []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Accept autocomplete suggestion
  const acceptSuggestion = useCallback(() => {
    const lower = value.toLowerCase();
    const allPhrases = [...(JSON.parse(localStorage.getItem("aureon_user_phrases") || "[]") as string[]),
      "Analyze this dataset", "Write a report about", "Summarize this document", "Explain how",
      "Compare and contrast", "Create a plan for", "Debug this code", "Optimize this function"];
    const match = allPhrases.find(p => p.toLowerCase().startsWith(lower) && p.toLowerCase() !== lower);
    if (match) onChange(match);
  }, [value, onChange]);

  // Clear draft on send
  const handleSend = () => {
    const key = conversationId || "global";
    deleteDraft(key).catch(() => {});
    setDraftSaved(null);
    trackPhrase(value.trim());
    onSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Tab" || (e.key === "ArrowRight" && textareaRef.current && textareaRef.current.selectionStart === value.length)) {
      // Accept autocomplete
      const lower = value.toLowerCase();
      if (lower.length >= 3) {
        e.preventDefault();
        acceptSuggestion();
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !onAttachmentsChange) return;

    const maxSize = 20 * 1024 * 1024; // 20MB
    const newAttachments: FileAttachment[] = [];
    const maxSlots = Math.max(0, 10 - attachments.length);

    for (const file of Array.from(files).slice(0, maxSlots)) {
      if (file.size > maxSize) {
        console.warn(`File "${file.name}" skipped: exceeds 20MB limit`);
        continue;
      }
      if (file.size === 0) {
        console.warn(`File "${file.name}" skipped: empty file`);
        continue;
      }
      try {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const commaIdx = result.indexOf(",");
            resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
          };
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsDataURL(file);
        });

        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
        newAttachments.push({ name: file.name, type: file.type || "application/octet-stream", size: file.size, base64, previewUrl });
      } catch (err) {
        console.error(`Failed to read file "${file.name}":`, err);
      }
    }

    if (newAttachments.length > 0) {
      onAttachmentsChange([...attachments, ...newAttachments]);
    }
    // Reset input so re-selecting the same file triggers onChange again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (idx: number) => {
    if (!onAttachmentsChange) return;
    const updated = attachments.filter((_, i) => i !== idx);
    onAttachmentsChange(updated);
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

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2 animate-fade-in">
            {attachments.map((file, idx) => (
              <div key={idx} className="relative group flex items-center gap-2 rounded-lg border border-border/30 bg-secondary/30 px-2.5 py-1.5 text-xs">
                {file.previewUrl ? (
                  <img src={file.previewUrl} alt={file.name} className="h-8 w-8 rounded object-cover" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-muted-foreground truncate max-w-[120px]">{file.name}</span>
                <button
                  onClick={() => removeAttachment(idx)}
                  className="ml-1 p-0.5 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={`flex items-end gap-3 rounded-2xl border ${online ? "border-border/30" : "border-amber-500/30"} bg-card/40 backdrop-blur-xl p-3 transition-all`}>
          {/* Attach button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.csv,.txt,.md,.json,.xml,.doc,.docx,.xls,.xlsx"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isStreaming}
            className="shrink-0 p-2 rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-all disabled:opacity-30"
            title="Attach files or images"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <div className="flex-1 relative min-w-0">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={online ? "Message Aureon…" : "Offline — messages will queue…"}
              rows={1}
              className="w-full resize-none bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none max-h-32"
            />
            {value && !value.includes("\n") && (
              <div className="absolute top-0 left-0 pointer-events-none text-sm font-light whitespace-pre overflow-hidden" style={{ color: "transparent" }}>
                {value}<SmartAutocomplete value={value} onAccept={acceptSuggestion} />
              </div>
            )}
          </div>
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
              disabled={(!value.trim() && attachments.length === 0) || disabled}
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
