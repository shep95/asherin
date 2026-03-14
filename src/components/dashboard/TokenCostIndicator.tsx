import { Coins, Search, FileText, Wrench } from "lucide-react";

interface TokenCostIndicatorProps {
  tokenCount?: number;
  usedSearch?: boolean;
  usedFiles?: boolean;
  usedTools?: boolean;
  model?: string;
}

function estimateCost(tokens: number, model?: string): string {
  // Rough cost estimates per 1K tokens (output)
  const rates: Record<string, number> = {
    "gemini-2.5-flash": 0.0001,
    "gemini-2.5-pro": 0.001,
    "gpt-5": 0.003,
    "gpt-5-mini": 0.0006,
    default: 0.0001,
  };
  const rate = rates[model || "default"] || rates.default;
  const cost = (tokens / 1000) * rate;
  return cost < 0.001 ? "<$0.001" : `~$${cost.toFixed(4)}`;
}

const TokenCostIndicator = ({ tokenCount, usedSearch, usedFiles, usedTools, model }: TokenCostIndicatorProps) => {
  const tokens = tokenCount || 0;
  if (tokens === 0) return null;

  return (
    <div className="flex items-center gap-2 mt-1">
      <div className="flex items-center gap-1 text-[9px] text-muted-foreground/30">
        <Coins className="h-2.5 w-2.5" />
        <span>{tokens.toLocaleString()} tokens</span>
        <span className="text-muted-foreground/20">•</span>
        <span>{estimateCost(tokens, model)}</span>
      </div>
      {(usedSearch || usedFiles || usedTools) && (
        <div className="flex items-center gap-1.5">
          {usedSearch && (
            <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/25">
              <Search className="h-2.5 w-2.5" /> search
            </span>
          )}
          {usedFiles && (
            <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/25">
              <FileText className="h-2.5 w-2.5" /> files
            </span>
          )}
          {usedTools && (
            <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/25">
              <Wrench className="h-2.5 w-2.5" /> tools
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default TokenCostIndicator;
