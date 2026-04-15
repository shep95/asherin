import { useMemo } from "react";
import { detectRelevantSkills, type Skill } from "@/lib/autoSkillInjection";
import { Activity, Brain, Zap } from "lucide-react";

interface Props {
  messages: { role: string; content: string }[];
  compact?: boolean;
}

/**
 * Shows which domain skills are currently active based on conversation context.
 * Visual indicator that the AI is operating with enhanced domain expertise.
 */
const ActiveSkillsIndicator = ({ messages, compact = false }: Props) => {
  const activeSkills = useMemo(() => detectRelevantSkills(messages, 3), [messages]);

  if (activeSkills.length === 0) return null;

  const SKILL_COLORS: Record<string, string> = {
    code: "text-blue-400 bg-blue-400/10",
    finance: "text-emerald-400 bg-emerald-400/10",
    trade: "text-yellow-400 bg-yellow-400/10",
    intelligence: "text-red-400 bg-red-400/10",
    data: "text-orange-400 bg-orange-400/10",
    legal: "text-amber-400 bg-amber-400/10",
    bio: "text-cyan-400 bg-cyan-400/10",
    sales: "text-pink-400 bg-pink-400/10",
    marketing: "text-violet-400 bg-violet-400/10",
    product: "text-indigo-400 bg-indigo-400/10",
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1" title={`Active skills: ${activeSkills.map(s => s.name).join(", ")}`}>
        <Zap className="h-2.5 w-2.5 text-accent animate-pulse" />
        <span className="text-[8px] font-extralight text-accent/70">{activeSkills.length}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 animate-fade-in">
      <div className="flex items-center gap-1">
        <Brain className="h-3 w-3 text-accent/60" />
        <span className="text-[9px] font-extralight text-muted-foreground/50">Skills:</span>
      </div>
      {activeSkills.map((skill) => {
        const colors = SKILL_COLORS[skill.category] || "text-muted-foreground bg-muted/10";
        return (
          <span
            key={skill.id}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-light ${colors}`}
            title={skill.prompt.slice(0, 100)}
          >
            <Activity className="h-2 w-2" />
            {skill.name}
          </span>
        );
      })}
    </div>
  );
};

export default ActiveSkillsIndicator;
