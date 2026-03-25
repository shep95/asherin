import { useState, useMemo } from "react";
import { BookOpen, ChevronDown, ChevronUp, Clock, Brain, AlertTriangle } from "lucide-react";

interface NomadDecisionLogProps {
  messages: { role: string; content: string; timestamp: Date }[];
}

interface Decision {
  text: string;
  type: "conclusion" | "pivot" | "escalation" | "dismissal";
  timestamp: Date;
  msgIndex: number;
}

function extractDecisions(messages: { role: string; content: string; timestamp: Date }[]): Decision[] {
  const decisions: Decision[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== "assistant" || !msg.content) continue;

    const patterns: { regex: RegExp; type: Decision["type"] }[] = [
      { regex: /(?:conclusion|assessment|finding|verdict|determination):\s*(.{20,120})/gi, type: "conclusion" },
      { regex: /(?:pivoting|shifting focus|redirecting|instead|alternatively)[\s,]+(.{15,100})/gi, type: "pivot" },
      { regex: /(?:escalat|high risk|critical|urgent|immediate attention)[\s:]+(.{15,100})/gi, type: "escalation" },
      { regex: /(?:dismissed|ruled out|unlikely|no evidence|insufficient)[\s:]+(.{15,100})/gi, type: "dismissal" },
    ];

    for (const { regex, type } of patterns) {
      let match;
      while ((match = regex.exec(msg.content)) !== null) {
        const text = match[1].trim().replace(/[.,:;]+$/, "");
        const key = text.toLowerCase().slice(0, 30);
        if (!seen.has(key) && text.length > 10) {
          seen.add(key);
          decisions.push({ text, type, timestamp: msg.timestamp, msgIndex: i });
        }
      }
    }
  }

  return decisions.slice(0, 15);
}

const typeConfig = {
  conclusion: { icon: Brain, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Conclusion" },
  pivot: { icon: Clock, color: "text-blue-400", bg: "bg-blue-500/10", label: "Pivot" },
  escalation: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10", label: "Escalation" },
  dismissal: { icon: BookOpen, color: "text-muted-foreground", bg: "bg-secondary/20", label: "Dismissed" },
};

const NomadDecisionLog = ({ messages }: NomadDecisionLogProps) => {
  const [expanded, setExpanded] = useState(false);
  const decisions = useMemo(() => extractDecisions(messages), [messages]);

  if (decisions.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/15 bg-card/15 backdrop-blur-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-extralight tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen className="h-3 w-3 text-accent/60" />
          <span>{decisions.length} intelligence decision{decisions.length !== 1 ? "s" : ""} logged</span>
        </div>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-1.5 animate-fade-in">
          {decisions.map((d, i) => {
            const { icon: Icon, color, bg, label } = typeConfig[d.type];
            return (
              <div key={i} className={`rounded-lg ${bg} p-2.5 flex items-start gap-2`}>
                <Icon className={`h-3 w-3 ${color} mt-0.5 shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-extralight text-foreground/80 leading-relaxed">{d.text}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[8px] font-extralight ${color}`}>{label}</span>
                    <span className="text-[8px] font-extralight text-muted-foreground/40">
                      {d.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NomadDecisionLog;
