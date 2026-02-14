import type { SourceTier } from "./types";

const tierConfig: Record<SourceTier, { color: string; bg: string; label: string }> = {
  1: { color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", label: "Primary" },
  2: { color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30", label: "Established" },
  3: { color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30", label: "Institutional" },
  4: { color: "text-muted-foreground", bg: "bg-muted/30 border-border/30", label: "General" },
};

interface SourceTierBadgeProps {
  tier: SourceTier;
  compact?: boolean;
}

const SourceTierBadge = ({ tier, compact }: SourceTierBadgeProps) => {
  const cfg = tierConfig[tier];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase ${cfg.bg} ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tier === 1 ? 'bg-emerald-400' : tier === 2 ? 'bg-blue-400' : tier === 3 ? 'bg-amber-400' : 'bg-muted-foreground'}`} />
      {!compact && cfg.label}
    </span>
  );
};

export default SourceTierBadge;
