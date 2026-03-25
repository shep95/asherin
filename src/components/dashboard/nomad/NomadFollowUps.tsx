import { Sparkles } from "lucide-react";

const NOMAD_FOLLOW_UPS: Record<string, string[]> = {
  person: [
    "Map their professional network",
    "Check for litigation history",
    "Analyze social media footprint",
    "Find financial disclosures",
  ],
  company: [
    "Identify beneficial ownership",
    "Check regulatory filings",
    "Map competitor landscape",
    "Analyze leadership changes",
  ],
  domain: [
    "Enumerate subdomains",
    "Check certificate transparency",
    "Map hosting infrastructure",
    "Find associated domains",
  ],
  default: [
    "Cross-reference with public records",
    "Generate entity relationship map",
    "Run predictive trajectory analysis",
    "Export findings as dossier",
  ],
};

interface NomadFollowUpsProps {
  lastContent: string;
  investigationType?: string;
  onSelect: (suggestion: string) => void;
}

const NomadFollowUps = ({ lastContent, investigationType, onSelect }: NomadFollowUpsProps) => {
  if (!lastContent) return null;

  const suggestions = NOMAD_FOLLOW_UPS[investigationType || "default"] || NOMAD_FOLLOW_UPS.default;

  return (
    <div className="flex flex-wrap gap-2 mt-3 animate-fade-in">
      {suggestions.map((s, i) => (
        <button
          key={i}
          onClick={() => onSelect(s)}
          className="flex items-center gap-1.5 rounded-xl border border-border/20 bg-foreground/[0.03] backdrop-blur-sm px-3 py-1.5 text-[10px] font-extralight tracking-wide text-foreground/60 hover:text-foreground hover:bg-foreground/[0.06] hover:border-foreground/15 transition-all"
        >
          <Sparkles className="h-3 w-3" />
          {s}
        </button>
      ))}
    </div>
  );
};

export default NomadFollowUps;
