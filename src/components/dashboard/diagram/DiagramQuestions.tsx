import { useState, useMemo } from "react";
import { MessageCircleQuestion, Plus, Sparkles, Send } from "lucide-react";
import { extractKnowledge } from "./diagramGenerators";

interface DiagramQuestionsProps {
  content: string;
  diagramType: string;
  onAddNode: (text: string) => void;
}

function generateFollowUpQuestions(content: string, diagramType: string): string[] {
  const { concepts, facts, relationships, categories } = extractKnowledge(content);
  const questions: string[] = [];

  const topConcepts = concepts.slice(0, 3);
  const catKeys = Object.keys(categories).slice(0, 3);

  if (diagramType === "knowledge" || diagramType === "concepts") {
    if (topConcepts.length > 0) {
      questions.push(`How does "${topConcepts[0]}" connect to other systems?`);
    }
    if (topConcepts.length > 1) {
      questions.push(`What is the relationship between "${topConcepts[0]}" and "${topConcepts[1]}"?`);
    }
    questions.push("Are there any external dependencies not shown?");
    questions.push("What sub-components exist within the main nodes?");
  }

  if (diagramType === "causal") {
    if (relationships.length > 0) {
      questions.push(`What triggers "${relationships[0]?.from}" initially?`);
    }
    questions.push("Are there any feedback loops in this chain?");
    questions.push("What are the failure points in this sequence?");
    questions.push("What happens if a step in this chain fails?");
  }

  if (diagramType === "taxonomy") {
    if (catKeys.length > 0) {
      questions.push(`What subcategories exist under "${catKeys[0]}"?`);
    }
    questions.push("Are there overlapping categories?");
    questions.push("What items don't fit existing categories?");
    questions.push("How deep should the hierarchy go?");
  }

  if (diagramType === "neural") {
    questions.push("What alternative reasoning paths exist?");
    questions.push("Where could the logic branch differently?");
    questions.push("What assumptions does this reasoning make?");
  }

  // Generic fallbacks
  if (questions.length < 3) {
    questions.push("What additional context would improve this diagram?");
    questions.push("Are there missing connections between nodes?");
    questions.push("What related concepts should be added?");
  }

  return questions.slice(0, 4);
}

const DiagramQuestions = ({ content, diagramType, onAddNode }: DiagramQuestionsProps) => {
  const [customInput, setCustomInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [appliedQuestions, setAppliedQuestions] = useState<Set<string>>(new Set());

  const questions = useMemo(
    () => generateFollowUpQuestions(content, diagramType),
    [content, diagramType]
  );

  const handleApplyQuestion = (question: string) => {
    onAddNode(question);
    setAppliedQuestions(prev => new Set(prev).add(question));
  };

  const handleCustomSubmit = () => {
    if (!customInput.trim()) return;
    onAddNode(customInput.trim());
    setCustomInput("");
  };

  return (
    <div className="border-t border-border/10 px-4 py-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-[10px] font-light text-muted-foreground/50 hover:text-foreground transition-colors w-full"
      >
        <Sparkles className="h-3 w-3 text-accent" />
        <span>Asherin Suggestions — Enrich this diagram</span>
        <span className="ml-auto text-[9px]">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-2 animate-fade-in">
          {/* AI-generated follow-up questions */}
          <div className="space-y-1.5">
            {questions.map((q, i) => {
              const applied = appliedQuestions.has(q);
              return (
                <button
                  key={i}
                  onClick={() => !applied && handleApplyQuestion(q)}
                  disabled={applied}
                  className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-xl border transition-all text-[11px] font-light ${
                    applied
                      ? "border-accent/20 bg-accent/5 text-accent/60 cursor-default"
                      : "border-border/15 bg-card/30 text-foreground/80 hover:border-accent/30 hover:bg-accent/5 cursor-pointer"
                  }`}
                >
                  {applied ? (
                    <Plus className="h-3 w-3 text-accent/50 rotate-45" />
                  ) : (
                    <MessageCircleQuestion className="h-3 w-3 text-muted-foreground/40" />
                  )}
                  <span className="flex-1">{q}</span>
                  {!applied && (
                    <span className="text-[8px] text-accent/40 uppercase tracking-wider">Add</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom node input */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                placeholder="Add your own node or concept..."
                className="w-full bg-card/40 border border-border/15 rounded-xl px-3 py-2 text-[11px] font-light text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-accent/30 transition-colors"
              />
            </div>
            <button
              onClick={handleCustomSubmit}
              disabled={!customInput.trim()}
              className="p-2 rounded-xl border border-border/15 bg-card/30 text-muted-foreground/50 hover:text-accent hover:border-accent/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send className="h-3 w-3" />
            </button>
          </div>

          <p className="text-[8px] text-muted-foreground/30 font-extralight mt-1">
            Click a suggestion or type your own to add nodes to the diagram
          </p>
        </div>
      )}
    </div>
  );
};

export default DiagramQuestions;
