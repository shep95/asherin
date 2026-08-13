import { useState } from "react";
import {
  CheckCircle2, AlertTriangle, ShieldAlert, ChevronDown, ChevronUp,
  Copy, Check, Eye, Brain, Scale, Clock, Zap, AlertOctagon
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { AI_PROVIDERS } from "@/lib/aiProviders";

// ── Types matching the multi-model consensus engine ──────────────────────

interface CrossValidationEntry {
  provider: string;
  model: string;
  totalClaims: number;
  validatedClaims: number;
  unvalidatedClaims: string[];
  validationRate: number; // 0-100
}

interface ConfidenceData {
  overallConfidence: number;
  level: "high" | "medium" | "low" | "critical_divergence";
  needsHumanReview: boolean;
  reasons: string[];
  jaccardSimilarity: number;
}

interface EnsembleData {
  agreedFacts: string[];
  contestedFacts: string[];
  agreementRatio: number; // 0-100
}

interface VerdictData {
  index: number;
  provider: string;
  model: string;
}

interface ConsensusResponse {
  provider: string;
  model: string;
  content: string;
  error: string | null;
  latencyMs: number;
}

export interface ConsensusData {
  consensus: boolean;
  confidence: ConfidenceData;
  crossValidation: CrossValidationEntry[];
  ensemble: EnsembleData;
  verdict: VerdictData | null;
  responses: ConsensusResponse[];
  timing: { parallelMs: number; totalMs: number };
  // Legacy compat
  similarity?: number;
  modelCount?: number;
  successCount?: number;
}

interface Props {
  data: ConsensusData;
}

// ── Helpers ──────────────────────────────────────────────────────────────────────

function getProviderLabel(provider: string, model: string): string {
  if (provider === "default") return "Asherin Default";
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

function ConfidenceBadge({ level, confidence }: { level: string; confidence: number }) {
  const styles: Record<string, string> = {
    high: "border-emerald-500/30 bg-emerald-500/8 text-emerald-400",
    medium: "border-amber-500/30 bg-amber-500/8 text-amber-400",
    low: "border-orange-500/30 bg-orange-500/8 text-orange-400",
    critical_divergence: "border-red-500/30 bg-red-500/8 text-red-400",
  };
  const icons: Record<string, typeof CheckCircle2> = {
    high: CheckCircle2,
    medium: AlertTriangle,
    low: ShieldAlert,
    critical_divergence: AlertOctagon,
  };
  const labels: Record<string, string> = {
    high: "High Confidence",
    medium: "Moderate Confidence",
    low: "Low Confidence",
    critical_divergence: "Critical Divergence",
  };
  const Icon = icons[level] || AlertTriangle;

  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 border text-[10px] font-medium ${styles[level] || styles.medium}`}>
      <Icon className="h-3 w-3" />
      <span>{labels[level] || level}</span>
      <span className="opacity-60">({confidence}%)</span>
    </div>
  );
}

function ValidationBar({ rate }: { rate: number }) {
  const color = rate >= 80 ? "bg-emerald-500" : rate >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 rounded-full bg-muted/20 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${rate}%` }} />
      </div>
      <span className="text-[9px] text-muted-foreground/50 w-8 text-right">{rate}%</span>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────────

const ConsensusMessage = ({ data }: Props) => {
  const [showAllResponses, setShowAllResponses] = useState(false);
  const [showCrossValidation, setShowCrossValidation] = useState(false);
  const [showEnsemble, setShowEnsemble] = useState(false);

  const confidence = data.confidence;
  const successful = data.responses.filter(r => r.content && !r.error);
  const failed = data.responses.filter(r => r.error);
  const verdictResponse = data.verdict !== null ? successful[data.verdict.index] : null;

  return (
    <div className="space-y-3">

      {/* ═══ CONFIDENCE HEADER ═══ */}
      <div className={`rounded-xl border px-4 py-3 space-y-2.5 ${
        confidence?.needsHumanReview
          ? "border-amber-500/20 bg-amber-500/3"
          : confidence?.level === "high"
            ? "border-emerald-500/15 bg-emerald-500/3"
            : "border-border/15 bg-card/10"
      }`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Brain className="h-4 w-4 text-muted-foreground/40" />
            <div>
              <p className="text-xs font-light text-foreground">
                {data.consensus
                  ? `${successful.length} models reached consensus`
                  : `${successful.length} models diverged`
                }
              </p>
              <p className="text-[9px] text-muted-foreground/40 mt-0.5">
                {data.timing?.totalMs ? `${data.timing.totalMs}ms` : ""} · Jaccard {confidence?.jaccardSimilarity ? `${Math.round(confidence.jaccardSimilarity * 100)}%` : "N/A"}
              </p>
            </div>
          </div>
          {confidence && <ConfidenceBadge level={confidence.level} confidence={confidence.overallConfidence} />}
        </div>

        {/* Confidence reasons */}
        {confidence?.reasons && confidence.reasons.length > 0 && (
          <div className="space-y-1">
            {confidence.reasons.map((r, i) => (
              <p key={i} className="text-[10px] text-muted-foreground/50 font-light pl-6">
                {confidence.needsHumanReview && i === 0 ? "⚠ " : "· "}{r}
              </p>
            ))}
          </div>
        )}

        {/* Human Review Flag */}
        {confidence?.needsHumanReview && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-500/8 border border-amber-500/15 px-3 py-2 mt-1">
            <Eye className="h-3.5 w-3.5 text-amber-500/60 shrink-0" />
            <p className="text-[10px] font-light text-amber-400/70">
              Flagged for human review — models disagree on key claims. Cross-check before trusting.
            </p>
          </div>
        )}
      </div>

      {/* ═══ VERDICT (Winning Response) ═══ */}
      {verdictResponse && (
        <div className="rounded-xl border border-border/15 bg-card/10 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border/10 bg-card/5">
            <div className="flex items-center gap-2">
              <Scale className="h-3 w-3 text-muted-foreground/30" />
              <span className="text-[10px] font-light text-muted-foreground/60">
                Verdict: {getProviderLabel(verdictResponse.provider, verdictResponse.model)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {verdictResponse.latencyMs > 0 && (
                <span className="text-[9px] text-muted-foreground/30 flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {verdictResponse.latencyMs}ms
                </span>
              )}
              <CopyBtn text={verdictResponse.content} />
            </div>
          </div>
          <div className="px-4 py-3 prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1.5 [&_p]:text-xs [&_p]:font-light [&_p]:leading-relaxed [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5 [&_li]:text-xs [&_code]:text-accent [&_code]:bg-secondary/50 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-secondary/50 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:overflow-x-auto [&_blockquote]:border-accent/50 [&_blockquote]:text-muted-foreground [&_strong]:text-foreground [&_hr]:border-border/30 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs">
            <ReactMarkdown>{verdictResponse.content}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* ═══ CROSS-VALIDATION PANEL ═══ */}
      {data.crossValidation && data.crossValidation.length > 0 && (
        <div className="rounded-xl border border-border/10 overflow-hidden">
          <button
            onClick={() => setShowCrossValidation(!showCrossValidation)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-card/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Zap className="h-3 w-3 text-muted-foreground/30" />
              <span className="text-[10px] font-light text-muted-foreground/50 uppercase tracking-wider">Cross-Validation</span>
            </div>
            {showCrossValidation
              ? <ChevronUp className="h-3 w-3 text-muted-foreground/30" />
              : <ChevronDown className="h-3 w-3 text-muted-foreground/30" />
            }
          </button>
          {showCrossValidation && (
            <div className="px-3 pb-3 space-y-2.5">
              {data.crossValidation.map((cv, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-light text-foreground/70">{getProviderLabel(cv.provider, cv.model)}</span>
                    <span className="text-[9px] text-muted-foreground/40">{cv.validatedClaims}/{cv.totalClaims} claims verified</span>
                  </div>
                  <ValidationBar rate={cv.validationRate} />
                  {cv.unvalidatedClaims.length > 0 && (
                    <div className="ml-1 space-y-0.5">
                      <p className="text-[9px] text-amber-400/50 font-light">Unverified claims:</p>
                      {cv.unvalidatedClaims.map((claim, ci) => (
                        <p key={ci} className="text-[9px] text-muted-foreground/35 font-light italic pl-2 border-l border-amber-500/10">
                          "{claim.slice(0, 100)}{claim.length > 100 ? "…" : ""}"
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ ENSEMBLE VOTING PANEL ═══ */}
      {data.ensemble && (data.ensemble.agreedFacts?.length > 0 || data.ensemble.contestedFacts?.length > 0) && (
        <div className="rounded-xl border border-border/10 overflow-hidden">
          <button
            onClick={() => setShowEnsemble(!showEnsemble)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-card/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Scale className="h-3 w-3 text-muted-foreground/30" />
              <span className="text-[10px] font-light text-muted-foreground/50 uppercase tracking-wider">
                Ensemble Voting · {data.ensemble.agreementRatio}% agreement
              </span>
            </div>
            {showEnsemble
              ? <ChevronUp className="h-3 w-3 text-muted-foreground/30" />
              : <ChevronDown className="h-3 w-3 text-muted-foreground/30" />
            }
          </button>
          {showEnsemble && (
            <div className="px-3 pb-3 space-y-2.5">
              {data.ensemble.agreedFacts.length > 0 && (
                <div>
                  <p className="text-[9px] text-emerald-400/50 font-light uppercase tracking-wider mb-1.5">Agreed by majority</p>
                  <div className="flex flex-wrap gap-1">
                    {data.ensemble.agreedFacts.map((f, i) => (
                      <span key={i} className="inline-block rounded-md bg-emerald-500/8 border border-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-400/60">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {data.ensemble.contestedFacts.length > 0 && (
                <div>
                  <p className="text-[9px] text-amber-400/50 font-light uppercase tracking-wider mb-1.5">Contested (single model)</p>
                  <div className="flex flex-wrap gap-1">
                    {data.ensemble.contestedFacts.map((f, i) => (
                      <span key={i} className="inline-block rounded-md bg-amber-500/8 border border-amber-500/15 px-1.5 py-0.5 text-[9px] text-amber-400/50">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ ALL INDIVIDUAL RESPONSES ═══ */}
      <div className="rounded-xl border border-border/10 overflow-hidden">
        <button
          onClick={() => setShowAllResponses(!showAllResponses)}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-card/10 transition-colors"
        >
          <span className="text-[10px] font-light text-muted-foreground/50 uppercase tracking-wider">
            {successful.length} Individual Responses
          </span>
          {showAllResponses
            ? <ChevronUp className="h-3 w-3 text-muted-foreground/30" />
            : <ChevronDown className="h-3 w-3 text-muted-foreground/30" />
          }
        </button>
        {showAllResponses && (
          <div className="space-y-2 p-3 pt-0">
            {successful.map((r, i) => {
              const isVerdict = data.verdict?.index === i;
              return (
                <div key={i} className={`rounded-xl border overflow-hidden ${
                  isVerdict ? "border-foreground/15 bg-card/15" : "border-border/10 bg-card/5"
                }`}>
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border/8">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-light text-muted-foreground/60">
                        {getProviderLabel(r.provider, r.model)}
                      </span>
                      {isVerdict && (
                        <span className="text-[8px] uppercase tracking-wider text-emerald-400/50 bg-emerald-500/8 rounded px-1.5 py-0.5">verdict</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {r.latencyMs > 0 && (
                        <span className="text-[9px] text-muted-foreground/25">{r.latencyMs}ms</span>
                      )}
                      <CopyBtn text={r.content} />
                    </div>
                  </div>
                  <div className="px-3 py-2.5 prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-1 [&_p]:text-[11px] [&_p]:font-light [&_p]:leading-relaxed [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_li]:text-[11px] [&_code]:text-accent [&_code]:bg-secondary/50 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-secondary/50 [&_pre]:rounded-lg [&_pre]:p-2 [&_pre]:overflow-x-auto [&_strong]:text-foreground [&_h1]:text-xs [&_h2]:text-[11px] [&_h3]:text-[11px]">
                    <ReactMarkdown>{r.content}</ReactMarkdown>
                  </div>
                </div>
              );
            })}
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
    </div>
  );
};

export default ConsensusMessage;
