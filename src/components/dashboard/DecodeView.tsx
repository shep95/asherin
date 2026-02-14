import { CheckCircle, Brain, AlertTriangle } from "lucide-react";

interface DecodeViewProps {
  open: boolean;
  content?: string;
}

// Simple heuristic analysis of response content
function analyzeContent(content: string) {
  const sentences = content.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const verified: string[] = [];
  const inference: string[] = [];
  const lowConf: string[] = [];

  const uncertainPhrases = ["might", "could", "possibly", "may", "perhaps", "likely", "probably", "it seems", "appears to", "i think", "not sure", "uncertain"];
  const confidentPhrases = ["is", "are", "was", "according to", "research shows", "data shows", "studies", "defined as", "known as"];

  for (const sentence of sentences) {
    const lower = sentence.toLowerCase().trim();
    if (!lower) continue;

    const hasUncertain = uncertainPhrases.some((p) => lower.includes(p));
    const hasConfident = confidentPhrases.some((p) => lower.includes(p));

    if (hasUncertain) {
      lowConf.push(sentence.trim());
    } else if (hasConfident) {
      verified.push(sentence.trim());
    } else {
      inference.push(sentence.trim());
    }
  }

  return { verified, inference, lowConf };
}

const DecodeView = ({ open, content }: DecodeViewProps) => {
  if (!open) return null;

  const analysis = content ? analyzeContent(content) : null;

  return (
    <div className="mt-3 rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm p-3 space-y-3 animate-fade-in">
      <div className="flex items-start gap-2">
        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-[10px] font-medium tracking-wider text-emerald-500 uppercase">Verified Data</p>
          {analysis && analysis.verified.length > 0 ? (
            <p className="text-xs font-light text-muted-foreground mt-1 line-clamp-2">
              {analysis.verified.length} statement{analysis.verified.length !== 1 ? "s" : ""} with high-confidence markers.
            </p>
          ) : (
            <p className="text-xs font-light text-muted-foreground/50 mt-1">No strongly verified claims detected.</p>
          )}
        </div>
        {analysis && (
          <span className="text-[10px] font-light text-emerald-500/70 tabular-nums">
            {analysis.verified.length}
          </span>
        )}
      </div>
      <div className="flex items-start gap-2">
        <Brain className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-[10px] font-medium tracking-wider text-amber-500 uppercase">Analytical Inference</p>
          {analysis && analysis.inference.length > 0 ? (
            <p className="text-xs font-light text-muted-foreground mt-1 line-clamp-2">
              {analysis.inference.length} statement{analysis.inference.length !== 1 ? "s" : ""} based on logical reasoning.
            </p>
          ) : (
            <p className="text-xs font-light text-muted-foreground/50 mt-1">No inferred conclusions detected.</p>
          )}
        </div>
        {analysis && (
          <span className="text-[10px] font-light text-amber-500/70 tabular-nums">
            {analysis.inference.length}
          </span>
        )}
      </div>
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-[10px] font-medium tracking-wider text-orange-500 uppercase">Low Confidence</p>
          {analysis && analysis.lowConf.length > 0 ? (
            <p className="text-xs font-light text-muted-foreground mt-1 line-clamp-2">
              {analysis.lowConf.length} statement{analysis.lowConf.length !== 1 ? "s" : ""} with uncertainty markers — verify independently.
            </p>
          ) : (
            <p className="text-xs font-light text-muted-foreground/50 mt-1">No uncertain statements detected.</p>
          )}
        </div>
        {analysis && (
          <span className="text-[10px] font-light text-orange-500/70 tabular-nums">
            {analysis.lowConf.length}
          </span>
        )}
      </div>
    </div>
  );
};

export default DecodeView;
