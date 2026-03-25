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
          className="flex items-center gap-1.5 rounded-xl border border-accent/15 bg-accent/5 backdrop-blur-sm px-3 py-1.5 text-[10px] font-extralight tracking-wide text-accent/70 hover:text-accent hover:bg-accent/10 hover:border-accent/30 transition-all"
        >
          <Sparkles className="h-3 w-3" />
          {s}
        </button>
      ))}
    </div>
  );
};

export default NomadFollowUps;
