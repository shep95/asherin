import { useState, useMemo, useCallback } from "react";
import { Shield, Copy, Check, Eye, EyeOff, Download, AlertTriangle } from "lucide-react";

interface NomadShareRedactionProps {
  content: string;
  entities: { type: string; value: string }[];
  onExport: (redactedContent: string) => void;
  open: boolean;
  onClose: () => void;
}

interface RedactionItem {
  original: string;
  type: string;
  redacted: string;
  enabled: boolean;
}

function detectSensitive(text: string, entities: { type: string; value: string }[]): RedactionItem[] {
  const items: RedactionItem[] = [];
  const seen = new Set<string>();

  // Emails
  (text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || []).forEach(v => {
    if (!seen.has(v)) { seen.add(v); items.push({ original: v, type: "Email", redacted: "[REDACTED_EMAIL]", enabled: true }); }
  });

  // Phone numbers
  (text.match(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g) || []).forEach(v => {
    if (!seen.has(v)) { seen.add(v); items.push({ original: v, type: "Phone", redacted: "[REDACTED_PHONE]", enabled: true }); }
  });

  // IPs
  (text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []).forEach(v => {
    if (!seen.has(v)) { seen.add(v); items.push({ original: v, type: "IP Address", redacted: "[REDACTED_IP]", enabled: true }); }
  });

  // Social handles
  (text.match(/@[\w]{3,30}/g) || []).forEach(v => {
    if (!seen.has(v)) { seen.add(v); items.push({ original: v, type: "Handle", redacted: "[REDACTED_HANDLE]", enabled: false }); }
  });

  // Entity-based PII (names from entities)
  for (const e of entities) {
    if ((e.type === "email" || e.type === "phone" || e.type === "handle") && !seen.has(e.value)) {
      seen.add(e.value);
      items.push({ original: e.value, type: e.type, redacted: `[REDACTED_${e.type.toUpperCase()}]`, enabled: true });
    }
  }

  return items;
}

const NomadShareRedaction = ({ content, entities, onExport, open, onClose }: NomadShareRedactionProps) => {
  const detected = useMemo(() => detectSensitive(content, entities), [content, entities]);
  const [items, setItems] = useState(detected);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);

  const toggleItem = (index: number) => {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, enabled: !item.enabled } : item));
  };

  const getRedactedContent = useCallback(() => {
    let result = content;
    for (const item of items) {
      if (item.enabled) {
        result = result.split(item.original).join(item.redacted);
      }
    }
    return result;
  }, [content, items]);

  if (!open) return null;

  const redactedContent = getRedactedContent();
  const enabledCount = items.filter(i => i.enabled).length;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
      <div onClick={e => e.stopPropagation()} className="relative w-full max-w-lg rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/15">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-light tracking-wide text-foreground">Share with Redaction</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-xs">✕</button>
        </div>

        {items.length === 0 ? (
          <div className="p-6 text-center">
            <Check className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-xs font-extralight text-muted-foreground">No sensitive data detected</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-extralight text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {items.length} sensitive item{items.length !== 1 ? "s" : ""} detected · {enabledCount} will be redacted
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {items.map((item, i) => (
                <label key={i} className="flex items-center gap-3 rounded-lg bg-card/30 px-3 py-2 cursor-pointer hover:bg-foreground/5 transition-colors">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={() => toggleItem(i)}
                    className="rounded border-border/30"
                  />
                  <span className="text-[10px] font-extralight text-muted-foreground/50 w-16">{item.type}</span>
                  <span className={`text-[10px] font-extralight flex-1 truncate ${item.enabled ? "line-through text-muted-foreground/30" : "text-foreground"}`}>
                    {item.original}
                  </span>
                </label>
              ))}
            </div>

            {preview && (
              <div className="rounded-lg border border-border/15 bg-secondary/20 p-3 max-h-32 overflow-y-auto">
                <p className="text-[10px] font-extralight text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {redactedContent.slice(0, 500)}{redactedContent.length > 500 ? "…" : ""}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-t border-border/15">
          <button
            onClick={() => setPreview(!preview)}
            className="flex items-center gap-1.5 text-[10px] font-extralight text-muted-foreground hover:text-foreground transition-colors"
          >
            {preview ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {preview ? "Hide" : "Preview"}
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { navigator.clipboard.writeText(redactedContent); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="flex items-center gap-1.5 rounded-xl border border-border/20 px-3 py-1.5 text-[10px] font-extralight text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              onClick={() => { onExport(redactedContent); onClose(); }}
              className="flex items-center gap-1.5 rounded-xl bg-foreground/[0.1] border border-foreground/15 px-3 py-1.5 text-[10px] font-extralight text-accent hover:bg-accent/30 transition-colors"
            >
              <Download className="h-3 w-3" />
              Export Redacted
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NomadShareRedaction;
