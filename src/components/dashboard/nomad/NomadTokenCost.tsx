import { useMemo } from "react";
import { Coins } from "lucide-react";

interface NomadTokenCostProps {
  messages: { role: string; content: string }[];
}

const NomadTokenCost = ({ messages }: NomadTokenCostProps) => {
  const { inputTokens, outputTokens, cost } = useMemo(() => {
    let inp = 0;
    let out = 0;
    for (const m of messages) {
      const chars = m.content?.length || 0;
      const tokens = Math.round(chars / 4);
      if (m.role === "user") inp += tokens;
      else out += tokens;
    }
    // Rough estimate for Gemini 2.5 Flash
    const c = (inp / 1000) * 0.00005 + (out / 1000) * 0.0001;
    return { inputTokens: inp, outputTokens: out, cost: c };
  }, [messages]);

  if (inputTokens === 0 && outputTokens === 0) return null;

  return (
    <div className="flex items-center gap-2 text-[9px] font-extralight text-muted-foreground/40">
      <Coins className="h-3 w-3" />
      <span>{(inputTokens + outputTokens).toLocaleString()} tokens</span>
      <span className="text-muted-foreground/20">•</span>
      <span>{cost < 0.001 ? "<$0.001" : `~$${cost.toFixed(4)}`}</span>
    </div>
  );
};

export default NomadTokenCost;
