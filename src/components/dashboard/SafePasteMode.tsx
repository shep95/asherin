import { useState, useCallback } from "react";
import { Shield, AlertTriangle, Eye, EyeOff, Check } from "lucide-react";

interface DetectedSecret {
  id: string;
  original: string;
  replacement: string;
  type: string;
  redact: boolean;
}

// Tightened patterns — avoid false-positive matches on ordinary technical prose
// like "the api key for authentication" or variable names like `apiKey`. We
// require a clear prefix (sk_/pk_/AKIA/ghp_/xoxb_/Bearer ) or an assignment
// (api_key="..."), not just any alphanumeric blob containing the word "key".
const PATTERNS: { type: string; regex: RegExp; replacement: string }[] = [
  { type: "OpenAI/Stripe Key", regex: /\b(sk|pk|rk)_(?:test|live|proj)_[A-Za-z0-9]{16,}\b/g, replacement: "[REDACTED_KEY]" },
  { type: "GitHub Token", regex: /\b(ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b/g, replacement: "[REDACTED_GITHUB_TOKEN]" },
  { type: "Slack Token", regex: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, replacement: "[REDACTED_SLACK_TOKEN]" },
  { type: "Bearer Token", regex: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g, replacement: "Bearer [REDACTED]" },
  { type: "API Key Assignment", regex: /\b(api[_-]?key|access[_-]?token|auth[_-]?token|secret[_-]?key)\s*[:=]\s*["']?[A-Za-z0-9._-]{16,}["']?/gi, replacement: "$1=[REDACTED]" },
  { type: "Email", regex: /[\w.-]+@[\w.-]+\.\w{2,}/g, replacement: "[REDACTED_EMAIL]" },
  { type: "Password Assignment", regex: /\b(password|passwd|pwd)\s*[:=]\s*\S{6,}/gi, replacement: "$1=[REDACTED]" },
  { type: "IP Address", regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, replacement: "[REDACTED_IP]" },
  { type: "AWS Key", regex: /\bAKIA[0-9A-Z]{16}\b/g, replacement: "[REDACTED_AWS_KEY]" },
  { type: "AWS Secret", regex: /\baws_secret[_a-z]*\s*[:=]\s*["']?[A-Za-z0-9/+=]{40}["']?/gi, replacement: "aws_secret=[REDACTED]" },
  { type: "JWT", regex: /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g, replacement: "[REDACTED_JWT]" },
  { type: "Private Key Block", regex: /-----BEGIN[ A-Z]+PRIVATE KEY-----[\s\S]+?-----END[ A-Z]+PRIVATE KEY-----/g, replacement: "[REDACTED_PRIVATE_KEY]" },
];

interface SafePasteModeProps {
  onCleanPaste: (cleanText: string) => void;
  children: (props: { onPaste: (e: React.ClipboardEvent) => void }) => React.ReactNode;
}

const SafePasteMode = ({ onCleanPaste, children }: SafePasteModeProps) => {
  const [detected, setDetected] = useState<DetectedSecret[]>([]);
  const [originalText, setOriginalText] = useState("");
  const [showModal, setShowModal] = useState(false);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text/plain");
    if (!text) return;

    const secrets: DetectedSecret[] = [];
    const seen = new Set<string>();

    PATTERNS.forEach(({ type, regex, replacement }) => {
      const matches = text.matchAll(new RegExp(regex));
      for (const match of matches) {
        if (match[0] && !seen.has(match[0])) {
          seen.add(match[0]);
          secrets.push({ id: crypto.randomUUID(), original: match[0], replacement, type, redact: true });
        }
      }
    });

    if (secrets.length > 0) {
      e.preventDefault();
      setOriginalText(text);
      setDetected(secrets);
      setShowModal(true);
    }
    // If no secrets, let paste proceed normally
  }, []);

  const toggleRedact = (id: string) => {
    setDetected(prev => prev.map(d => d.id === id ? { ...d, redact: !d.redact } : d));
  };

  const applyRedactions = () => {
    let result = originalText;
    detected.filter(d => d.redact).forEach(d => {
      result = result.split(d.original).join(d.replacement);
    });
    onCleanPaste(result);
    setShowModal(false);
    setDetected([]);
  };

  const pasteOriginal = () => {
    onCleanPaste(originalText);
    setShowModal(false);
    setDetected([]);
  };

  return (
    <>
      {children({ onPaste: handlePaste })}

      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/60 backdrop-blur-sm animate-fade-in">
          <div className="w-96 rounded-2xl border border-amber-500/30 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/20 bg-amber-500/5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-light text-foreground">Sensitive Data Detected</span>
            </div>

            <div className="px-4 py-3 max-h-[300px] overflow-y-auto space-y-2">
              <p className="text-[10px] text-muted-foreground/60">
                {detected.length} potential secret{detected.length > 1 ? "s" : ""} found in pasted text:
              </p>
              {detected.map(d => (
                <div key={d.id} className="flex items-center gap-2 group">
                  <button onClick={() => toggleRedact(d.id)} className="shrink-0">
                    {d.redact
                      ? <EyeOff className="h-3.5 w-3.5 text-destructive" />
                      : <Eye className="h-3.5 w-3.5 text-muted-foreground/40" />
                    }
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-mono text-muted-foreground/60 truncate block">{d.original.slice(0, 40)}{d.original.length > 40 ? "…" : ""}</span>
                    <span className="text-[9px] text-muted-foreground/30">{d.type}</span>
                  </div>
                  <span className={`text-[9px] ${d.redact ? "text-destructive/60" : "text-muted-foreground/30"}`}>
                    {d.redact ? "will redact" : "keep"}
                  </span>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 border-t border-border/20 flex items-center justify-between">
              <button
                onClick={pasteOriginal}
                className="text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                Paste original
              </button>
              <button
                onClick={applyRedactions}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-light bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
              >
                <Shield className="h-3 w-3" />
                Paste redacted ({detected.filter(d => d.redact).length})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default SafePasteMode;
