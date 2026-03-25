import { useState, useMemo } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, CheckCircle2, HelpCircle, XCircle } from "lucide-react";

interface NomadAssumptionTrackerProps {
  messages: { role: string; content: string }[];
}

interface Assumption {
  text: string;
  status: "unchallenged" | "supported" | "challenged";
  source: string;
}

function extractAssumptions(messages: { role: string; content: string }[]): Assumption[] {
  const assumptions: Assumption[] = [];
  const seen = new Set<string>();

  for (const msg of messages) {
    if (msg.role !== "assistant" || !msg.content) continue;
    
    const patterns = [
      /(?:assuming|assumption|presume|presumes|assumed)\s+(?:that\s+)?(.{15,80})/gi,
      /(?:if\s+)(.{15,60})(?:,\s+then)/gi,
      /(?:based on the assumption)\s+(?:that\s+)?(.{15,80})/gi,
      /(?:it appears|it seems|this suggests)\s+(?:that\s+)?(.{15,80})/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(msg.content)) !== null) {
        const text = match[1].trim().replace(/[.,:;]+$/, "");
        const key = text.toLowerCase().slice(0, 40);
        if (!seen.has(key) && text.length > 10) {
          seen.add(key);
          
          // Check if later messages support or challenge this
          const laterContent = messages
            .slice(messages.indexOf(msg) + 1)
            .filter(m => m.role === "assistant")
            .map(m => m.content)
            .join(" ")
            .toLowerCase();

          let status: Assumption["status"] = "unchallenged";
          if (/confirmed|verified|evidence supports/i.test(laterContent) && laterContent.includes(text.toLowerCase().slice(0, 20))) {
            status = "supported";
          } else if (/contradicted|however|incorrect|false/i.test(laterContent) && laterContent.includes(text.toLowerCase().slice(0, 20))) {
            status = "challenged";
          }

          assumptions.push({ text, status, source: msg.content.slice(0, 60) + "…" });
        }
      }
    }
  }

  return assumptions.slice(0, 10);
}

const statusConfig = {
  unchallenged: { icon: HelpCircle, color: "text-amber-400", bg: "bg-amber-500/10", label: "Unchallenged" },
  supported: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Supported" },
  challenged: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", label: "Challenged" },
};

const NomadAssumptionTracker = ({ messages }: NomadAssumptionTrackerProps) => {
  const [expanded, setExpanded] = useState(false);
  const assumptions = useMemo(() => extractAssumptions(messages), [messages]);

  if (assumptions.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/15 bg-card/15 backdrop-blur-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-extralight tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3 w-3 text-amber-400" />
          <span>{assumptions.length} assumption{assumptions.length !== 1 ? "s" : ""} detected</span>
        </div>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      
      {expanded && (
        <div className="px-3 pb-3 space-y-2 animate-fade-in">
          {assumptions.map((a, i) => {
            const { icon: Icon, color, bg, label } = statusConfig[a.status];
            return (
              <div key={i} className={`rounded-lg ${bg} p-2.5 flex items-start gap-2`}>
                <Icon className={`h-3 w-3 ${color} mt-0.5 shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-extralight text-foreground/80 leading-relaxed">{a.text}</p>
                  <span className={`text-[8px] font-extralight ${color}`}>{label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default NomadAssumptionTracker;
