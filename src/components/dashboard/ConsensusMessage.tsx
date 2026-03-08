import { useState } from "react";
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AI_PROVIDERS } from "./AIKeysSettings";

interface ConsensusResponse {
  provider: string;
  model: string;
  content: string;
  error: string | null;
}

interface ConsensusData {
  consensus: boolean;
  similarity: number;
  modelCount: number;
  successCount: number;
  responses: ConsensusResponse[];
}

interface Props {
  data: ConsensusData;
}

function getProviderLabel(provider: string, model: string): string {
  if (provider === "default") return "Aureon Default";
  const p = AI_PROVIDERS.find(a => a.id === provider);
  const m = p?.models.find(mm => mm.id === model);
  return `${p?.name || provider} → ${m?.name || model}`;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

const ConsensusMessage = ({ data }: Props) => {
  const [expanded, setExpanded] = useState(!data.consensus);
  const successful = data.responses.filter(r => r.content && !r.error);
  const failed = data.responses.filter(r => r.error);

  return (
    <div className="space-y-3">
      {/* Consensus badge */}
      <div className={`flex items-center gap-2 rounded-xl px-3 py-2 border ${
        data.consensus
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-amber-500/20 bg-amber-500/5"
      }`}>
        {data.consensus ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500/70 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-500/70 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-light text-foreground">
            {data.consensus
              ? `${data.successCount} models agree`
              : `${data.successCount} models disagree`
            }
          </p>
          <p className="text-[10px] text-muted-foreground/50">
            Similarity: {Math.round(data.similarity * 100)}% ·{" "}
            {data.successCount}/{data.modelCount} responded
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded-md text-muted-foreground/40 hover:text-muted-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* If consensus, show the first successful response as the "merged" answer */}
      {data.consensus && !expanded && successful.length > 0 && (
        <div className="prose prose-sm prose-invert max-w-none overflow-hidden [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5 [&_p]:text-xs [&_p]:font-light [&_p]:leading-relaxed [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_li]:text-xs [&_code]:text-accent [&_code]:bg-secondary/50 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-secondary/50 [&_pre]:rounded-lg [&_pre]:p-3 [&_blockquote]:border-accent/50 [&_blockquote]:text-muted-foreground [&_strong]:text-foreground [&_hr]:border-border/30 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs">
          <ReactMarkdown>{successful[0].content}</ReactMarkdown>
        </div>
      )}

      {/* Expanded: show all responses */}
      {expanded && (
        <div className="space-y-3">
          {successful.map((r, i) => (
            <div key={i} className="rounded-xl border border-border/15 bg-card/20 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/10 bg-card/10">
                <span className="text-[10px] font-light text-muted-foreground/70">
                  {getProviderLabel(r.provider, r.model)}
                </span>
                <CopyBtn text={r.content} />
              </div>
              <div className="px-3 py-2.5 prose prose-sm prose-invert max-w-none overflow-hidden [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_p]:text-[11px] [&_p]:font-light [&_p]:leading-relaxed [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_li]:text-[11px] [&_code]:text-accent [&_code]:bg-secondary/50 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-secondary/50 [&_pre]:rounded-lg [&_pre]:p-2 [&_strong]:text-foreground [&_h1]:text-xs [&_h2]:text-[11px] [&_h3]:text-[11px]">
                <ReactMarkdown>{r.content}</ReactMarkdown>
              </div>
            </div>
          ))}
          {failed.map((r, i) => (
            <div key={`err-${i}`} className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2">
              <p className="text-[10px] font-light text-destructive/70">
                {getProviderLabel(r.provider, r.model)}: {r.error}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ConsensusMessage;
