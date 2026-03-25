import { useState } from "react";
import { Brain, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, HelpCircle, Lightbulb, Search } from "lucide-react";

interface NomadChainOfThoughtProps {
  content: string;
}

interface ThoughtStep {
  type: "source" | "entity" | "pattern" | "caveat" | "conclusion";
  text: string;
}

function extractThoughts(text: string): ThoughtStep[] {
  const steps: ThoughtStep[] = [];
  const lines = text.split("\n");
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    if (/(?:source|according to|per|via|from)\s/i.test(trimmed) && /https?:\/\/|SEC|court|filing|record/i.test(trimmed)) {
      steps.push({ type: "source", text: trimmed.replace(/^[-*#>\s]+/, "").slice(0, 120) });
    } else if (/(?:identified|found|detected|entity|person|company|organization)\s/i.test(trimmed)) {
      steps.push({ type: "entity", text: trimmed.replace(/^[-*#>\s]+/, "").slice(0, 120) });
    } else if (/(?:pattern|trend|correlation|anomaly|signal)\s/i.test(trimmed)) {
      steps.push({ type: "pattern", text: trimmed.replace(/^[-*#>\s]+/, "").slice(0, 120) });
    } else if (/(?:however|caveat|limitation|uncertain|note that|caution|disclaimer)\s/i.test(trimmed)) {
      steps.push({ type: "caveat", text: trimmed.replace(/^[-*#>\s]+/, "").slice(0, 120) });
    } else if (/(?:therefore|conclusion|assessment|finding|verdict|summary)\s/i.test(trimmed)) {
      steps.push({ type: "conclusion", text: trimmed.replace(/^[-*#>\s]+/, "").slice(0, 120) });
    }
  }
  
  return steps.slice(0, 12);
}

const stepConfig = {
  source: { icon: Search, color: "text-blue-400", label: "Source" },
  entity: { icon: CheckCircle2, color: "text-emerald-400", label: "Entity" },
  pattern: { icon: Lightbulb, color: "text-amber-400", label: "Pattern" },
  caveat: { icon: AlertTriangle, color: "text-red-400", label: "Caveat" },
  conclusion: { icon: Brain, color: "text-foreground", label: "Conclusion" },
};

const NomadChainOfThought = ({ content }: NomadChainOfThoughtProps) => {
  const [expanded, setExpanded] = useState(false);
  const thoughts = extractThoughts(content);
  
  if (thoughts.length < 2) return null;

  const certainCount = thoughts.filter(t => t.type === "source" || t.type === "entity" || t.type === "conclusion").length;
  const uncertainCount = thoughts.filter(t => t.type === "caveat").length;
  const confidenceRatio = thoughts.length > 0 ? Math.round((certainCount / (certainCount + uncertainCount)) * 100) : 50;

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] font-extralight text-muted-foreground/60 hover:text-muted-foreground transition-colors"
      >
        <Brain className="h-3 w-3" />
        Show reasoning ({thoughts.length} steps · {confidenceRatio}% certain)
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      
      {expanded && (
        <div className="mt-2 rounded-xl border border-border/15 bg-card/15 p-3 space-y-1.5 animate-fade-in">
          {thoughts.map((step, i) => {
            const { icon: Icon, color, label } = stepConfig[step.type];
            return (
              <div key={i} className="flex items-start gap-2">
                <div className="flex items-center gap-1 mt-0.5 shrink-0">
                  <span className="text-[8px] font-extralight text-muted-foreground/40 w-3">{i + 1}</span>
                  <Icon className={`h-3 w-3 ${color}`} />
                </div>
                <p className="text-[10px] font-extralight text-muted-foreground leading-relaxed">{step.text}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NomadChainOfThought;
