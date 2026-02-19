import { useState, useMemo } from "react";
import {
  Brain, FileText, Link2, TrendingUp, ShieldCheck,
  HelpCircle, ChevronDown, ChevronUp, Sparkles,
} from "lucide-react";

interface ChainOfThoughtPanelProps {
  open: boolean;
  content?: string;
  query?: string;
}

interface ReasoningStep {
  icon: typeof Brain;
  label: string;
  color: string;
  items: string[];
  confidence: number;
}

function extractDocumentsRead(content: string): string[] {
  const docs: string[] = [];
  // Look for source citations like [Source](url) or "according to X"
  const citationRe = /\[([^\]]+)\]\(https?:\/\/[^\)]+\)/g;
  let m;
  while ((m = citationRe.exec(content)) !== null) docs.push(m[1]);

  const accordingRe = /according to\s+([^,.;]+)/gi;
  while ((m = accordingRe.exec(content)) !== null) docs.push(m[1].trim());

  const sourceRe = /(?:source|report|study|paper|article|data from|published by)\s*:?\s*([^,.;\n]+)/gi;
  while ((m = sourceRe.exec(content)) !== null) {
    const val = m[1].trim();
    if (val.length > 3 && val.length < 80) docs.push(val);
  }

  return [...new Set(docs)].slice(0, 8);
}

function extractEntities(content: string): string[] {
  const entities: string[] = [];
  // Find capitalized multi-word names (likely entities)
  const nameRe = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  let m;
  while ((m = nameRe.exec(content)) !== null) {
    const name = m[1];
    // Filter out common sentence starters
    if (!["The Data", "The Physics", "The System", "Zero Point", "Ghost Chain"].includes(name)) {
      entities.push(name);
    }
  }
  // Look for quoted entities
  const quotedRe = /[""]([^""]{3,40})[""\u201d]/g;
  while ((m = quotedRe.exec(content)) !== null) entities.push(m[1]);

  // Look for bolded entities in markdown
  const boldRe = /\*\*([^*]{2,40})\*\*/g;
  while ((m = boldRe.exec(content)) !== null) {
    const val = m[1];
    if (val.length < 40 && !val.includes("\n")) entities.push(val);
  }

  return [...new Set(entities)].slice(0, 12);
}

function extractPatterns(content: string): string[] {
  const patterns: string[] = [];
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 15);

  const patternPhrases = [
    "pattern", "trend", "correlation", "indicates", "suggests",
    "consistent with", "historically", "trajectory", "momentum",
    "cycle", "recurring", "systematic", "proportional",
  ];

  for (const s of sentences) {
    const lower = s.toLowerCase().trim();
    if (patternPhrases.some(p => lower.includes(p))) {
      patterns.push(s.trim().slice(0, 120) + (s.trim().length > 120 ? "…" : ""));
    }
  }

  return [...new Set(patterns)].slice(0, 5);
}

function extractAlternatives(content: string): string[] {
  const alts: string[] = [];
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 15);

  const altPhrases = [
    "alternatively", "however", "on the other hand", "another interpretation",
    "counterargument", "some argue", "opposing view", "contrarily",
    "different perspective", "could also", "another possibility",
    "it's worth noting", "caveat", "exception",
  ];

  for (const s of sentences) {
    const lower = s.toLowerCase().trim();
    if (altPhrases.some(p => lower.includes(p))) {
      alts.push(s.trim().slice(0, 120) + (s.trim().length > 120 ? "…" : ""));
    }
  }

  return [...new Set(alts)].slice(0, 4);
}

function computeConfidence(content: string): number {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length === 0) return 0;

  const uncertainPhrases = ["might", "could", "possibly", "may", "perhaps", "likely", "probably", "uncertain", "unclear", "not sure"];
  const confidentPhrases = ["is", "are", "definitively", "according to", "data shows", "confirms", "proven", "established"];

  let uncertainCount = 0;
  let confidentCount = 0;

  for (const s of sentences) {
    const lower = s.toLowerCase();
    if (uncertainPhrases.some(p => lower.includes(p))) uncertainCount++;
    if (confidentPhrases.some(p => lower.includes(p))) confidentCount++;
  }

  const total = uncertainCount + confidentCount || 1;
  return Math.round((confidentCount / total) * 100);
}

const ChainOfThoughtPanel = ({ open, content, query }: ChainOfThoughtPanelProps) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const analysis = useMemo(() => {
    if (!content) return null;

    const documents = extractDocumentsRead(content);
    const entities = extractEntities(content);
    const patterns = extractPatterns(content);
    const alternatives = extractAlternatives(content);
    const confidence = computeConfidence(content);

    const steps: ReasoningStep[] = [
      {
        icon: FileText,
        label: "Sources Analyzed",
        color: "text-blue-400",
        items: documents.length > 0 ? documents : ["Reasoning from trained knowledge base"],
        confidence: documents.length > 0 ? 90 : 60,
      },
      {
        icon: Link2,
        label: "Entities Connected",
        color: "text-cyan-400",
        items: entities.length > 0 ? entities : ["No named entities extracted"],
        confidence: entities.length > 0 ? Math.min(95, 70 + entities.length * 3) : 0,
      },
      {
        icon: TrendingUp,
        label: "Patterns Recognized",
        color: "text-amber-400",
        items: patterns.length > 0 ? patterns : ["No explicit pattern markers detected"],
        confidence: patterns.length > 0 ? Math.min(90, 60 + patterns.length * 8) : 0,
      },
      {
        icon: HelpCircle,
        label: "Alternatives Considered",
        color: "text-purple-400",
        items: alternatives.length > 0 ? alternatives : ["No alternative interpretations surfaced"],
        confidence: alternatives.length > 0 ? Math.min(85, 50 + alternatives.length * 10) : 0,
      },
    ];

    return { steps, overallConfidence: confidence };
  }, [content]);

  if (!open || !analysis) return null;

  const toggleSection = (label: string) => {
    setExpanded(prev => (prev === label ? null : label));
  };

  return (
    <div className="mt-3 rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm p-4 space-y-3 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-border/10">
        <Brain className="h-4 w-4 text-accent" />
        <span className="text-xs font-medium text-foreground tracking-wide">Chain-of-Thought Transparency</span>
        <div className="ml-auto flex items-center gap-2">
          <ShieldCheck className="h-3 w-3 text-emerald-500/70" />
          <span className="text-[10px] font-mono text-emerald-500/70">
            {analysis.overallConfidence}% confidence
          </span>
        </div>
      </div>

      {/* Overall confidence bar */}
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider whitespace-nowrap">
          Assertion Confidence
        </span>
        <div className="flex-1 h-1.5 rounded-full bg-card/50 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              analysis.overallConfidence >= 80
                ? "bg-emerald-500"
                : analysis.overallConfidence >= 50
                ? "bg-amber-500"
                : "bg-orange-500"
            }`}
            style={{ width: `${analysis.overallConfidence}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-foreground w-8 text-right">
          {analysis.overallConfidence}%
        </span>
      </div>

      {/* Reasoning steps */}
      <div className="space-y-1">
        {analysis.steps.map((step) => {
          const Icon = step.icon;
          const isExpanded = expanded === step.label;
          const hasContent = step.items.length > 0 && step.items[0] !== "No named entities extracted" && step.items[0] !== "No explicit pattern markers detected" && step.items[0] !== "No alternative interpretations surfaced";

          return (
            <div key={step.label} className="rounded-lg border border-border/10 overflow-hidden">
              <button
                onClick={() => toggleSection(step.label)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-card/40 transition-colors"
              >
                <Icon className={`h-3.5 w-3.5 ${step.color} shrink-0`} />
                <span className="text-xs font-light text-foreground flex-1 text-left">{step.label}</span>
                <span className={`text-[10px] font-mono ${step.color} opacity-70`}>
                  {hasContent ? step.items.length : 0}
                </span>
                {step.confidence > 0 && (
                  <div className="w-12 h-1 rounded-full bg-card/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${step.color.replace("text-", "bg-")} opacity-60`}
                      style={{ width: `${step.confidence}%` }}
                    />
                  </div>
                )}
                {isExpanded ? (
                  <ChevronUp className="h-3 w-3 text-muted-foreground/40" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground/40" />
                )}
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 pt-1 space-y-1.5 animate-fade-in">
                  {step.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Sparkles className={`h-2.5 w-2.5 mt-1 ${step.color} opacity-50 shrink-0`} />
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{item}</p>
                    </div>
                  ))}
                  {step.confidence > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/10">
                      <span className="text-[10px] text-muted-foreground/50">
                        Step confidence: <span className="font-mono text-foreground/70">{step.confidence}%</span>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <p className="text-[10px] text-muted-foreground/40 italic pt-1 border-t border-border/10">
        Transparency analysis is heuristic — based on linguistic markers in the response. Verify critical claims independently.
      </p>
    </div>
  );
};

export default ChainOfThoughtPanel;
