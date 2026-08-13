import { useState, useMemo } from "react";
import { Share2, Shield, Eye, EyeOff, Copy, Check, X, AlertTriangle } from "lucide-react";
import type { Message } from "./types";

interface ShareWithRedactionProps {
  messages: Message[];
  open: boolean;
  onClose: () => void;
}

interface RedactionItem {
  id: string;
  original: string;
  replacement: string;
  type: "email" | "phone" | "api_key" | "ip" | "name" | "url" | "secret";
  approved: boolean;
}

const PATTERNS: { type: RedactionItem["type"]; regex: RegExp; replacement: string }[] = [
  { type: "email", regex: /[\w.-]+@[\w.-]+\.\w{2,}/g, replacement: "[EMAIL REDACTED]" },
  { type: "phone", regex: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, replacement: "[PHONE REDACTED]" },
  { type: "api_key", regex: /(sk|pk|api|key|token|secret|password|bearer)[-_]?[a-zA-Z0-9]{16,}/gi, replacement: "[API KEY REDACTED]" },
  { type: "ip", regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, replacement: "[IP REDACTED]" },
  { type: "secret", regex: /(password|secret|credential|token)\s*[:=]\s*\S+/gi, replacement: "[SECRET REDACTED]" },
];

function detectPII(text: string): RedactionItem[] {
  const items: RedactionItem[] = [];
  const seen = new Set<string>();
  PATTERNS.forEach(({ type, regex, replacement }) => {
    const matches = text.matchAll(new RegExp(regex));
    for (const match of matches) {
      if (match[0] && !seen.has(match[0])) {
        seen.add(match[0]);
        items.push({
          id: crypto.randomUUID(),
          original: match[0],
          replacement,
          type,
          approved: true,
        });
      }
    }
  });
  return items;
}

const ShareWithRedaction = ({ messages, open, onClose }: ShareWithRedactionProps) => {
  const fullText = messages.map(m => `${m.role === "user" ? "You" : "asherin"}: ${m.content}`).join("\n\n---\n\n");
  const detectedItems = useMemo(() => detectPII(fullText), [fullText]);
  const [redactions, setRedactions] = useState<RedactionItem[]>(detectedItems);
  const [copied, setCopied] = useState(false);

  const toggleApproval = (id: string) => {
    setRedactions(prev => prev.map(r => r.id === id ? { ...r, approved: !r.approved } : r));
  };

  const getRedactedText = () => {
    let result = fullText;
    redactions.filter(r => r.approved).forEach(r => {
      result = result.split(r.original).join(r.replacement);
    });
    return result;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getRedactedText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm animate-fade-in">
      <div className="w-[600px] max-h-[80vh] rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 shrink-0">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-accent/60" />
            <span className="text-sm font-light text-foreground">Share with Redaction</span>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Detected PII */}
        {redactions.length > 0 && (
          <div className="px-4 py-3 border-b border-border/20 bg-destructive/5 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-light text-foreground">{redactions.length} sensitive items detected</span>
            </div>
            <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
              {redactions.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-2 group">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <button
                      onClick={() => toggleApproval(r.id)}
                      className={`p-0.5 rounded transition-colors ${r.approved ? "text-destructive" : "text-muted-foreground/40"}`}
                    >
                      {r.approved ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    </button>
                    <span className="text-[10px] font-mono text-muted-foreground/60 truncate">{r.original}</span>
                    <span className="text-[9px] text-muted-foreground/30 bg-muted/20 rounded px-1.5 py-0.5 shrink-0">{r.type}</span>
                  </div>
                  <span className={`text-[10px] font-light ${r.approved ? "text-destructive/60 line-through" : "text-muted-foreground/40"}`}>
                    {r.approved ? "will be removed" : "kept"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
          <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-2">Preview</p>
          <pre className="text-xs font-light text-muted-foreground leading-5 whitespace-pre-wrap">
            {getRedactedText().slice(0, 3000)}{getRedactedText().length > 3000 ? "\n\n[…truncated for preview]" : ""}
          </pre>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-border/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-emerald-500/60" />
            <span className="text-[10px] text-muted-foreground/40">
              {redactions.filter(r => r.approved).length} items will be redacted
            </span>
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-light bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy Redacted"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareWithRedaction;
