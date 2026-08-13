/**
 * AUREON SWARM AGENT INDICATOR
 * Shows which specialist agent is currently active in the conversation.
 * Visualises agent handoffs as they occur in a swarm run.
 */

import { memo, useMemo } from "react";
import { 
  Brain, TrendingUp, Shield, Search, Database, Code, Globe, Bot, Zap 
} from "lucide-react";
import { buildSwarmContext, type ClassifiedIntent } from "@/lib/swarmOrchestrator";

const AGENT_ICONS: Record<string, typeof Brain> = {
  "financial-analyst": TrendingUp,
  "trading-bot": Zap,
  "prediction-engine": Globe,
  "intelligence-osint": Search,
  "data-analyst": Database,
  "cyber-security": Shield,
  "code-engineer": Code,
  "general-assistant": Brain,
};

const AGENT_COLORS: Record<string, string> = {
  "financial-analyst": "text-emerald-400",
  "trading-bot": "text-amber-400",
  "prediction-engine": "text-blue-400",
  "intelligence-osint": "text-red-400",
  "data-analyst": "text-violet-400",
  "cyber-security": "text-rose-400",
  "code-engineer": "text-cyan-400",
  "general-assistant": "text-neutral-400",
};

interface SwarmAgentIndicatorProps {
  messages: { role: string; content: string }[];
}

const SwarmAgentIndicator = memo(({ messages }: SwarmAgentIndicatorProps) => {
  const { activeAgent, intents } = useMemo(() => {
    if (messages.length === 0) return { activeAgent: { id: "general-assistant", name: "asherin General Intelligence", module: "chat" }, intents: [] as ClassifiedIntent[] };
    return buildSwarmContext(messages);
  }, [messages]);

  const Icon = AGENT_ICONS[activeAgent.id] || Bot;
  const color = AGENT_COLORS[activeAgent.id] || "text-neutral-400";

  if (activeAgent.id === "general-assistant" && intents.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.06]">
      <Icon className={`w-3 h-3 ${color}`} />
      <span className="text-[10px] font-medium text-white/50 uppercase tracking-wider">
        {activeAgent.module}
      </span>
      {intents.length > 0 && (
        <span className="text-[9px] text-white/30">
          {(intents[0].confidence * 100).toFixed(0)}%
        </span>
      )}
    </div>
  );
});

SwarmAgentIndicator.displayName = "SwarmAgentIndicator";

export default SwarmAgentIndicator;
