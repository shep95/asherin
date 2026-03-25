import { Shield, AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react";

interface NomadConfidenceBadgeProps {
  content: string;
}

function analyzeConfidence(text: string): { score: number; level: "high" | "medium" | "low"; indicators: string[] } {
  const indicators: string[] = [];
  let score = 50;

  // High confidence markers
  const highMarkers = [
    /confirmed/gi, /verified/gi, /according to (?:official|public)/gi,
    /court records show/gi, /SEC filing/gi, /registered/gi,
    /documented/gi, /publicly available/gi, /on record/gi,
  ];
  // Low confidence markers
  const lowMarkers = [
    /allegedly/gi, /unconfirmed/gi, /rumor/gi, /possibly/gi,
    /may have/gi, /could be/gi, /uncertain/gi, /unverified/gi,
    /speculation/gi, /reportedly/gi, /appears to/gi, /seems/gi,
  ];
  // Medium markers
  const medMarkers = [
    /likely/gi, /suggests/gi, /indicates/gi, /probable/gi,
    /evidence points to/gi, /sources say/gi, /based on analysis/gi,
  ];

  for (const r of highMarkers) {
    const matches = text.match(r);
    if (matches) { score += matches.length * 5; indicators.push(`${matches.length}× verified claim${matches.length > 1 ? "s" : ""}`); }
  }
  for (const r of medMarkers) {
    const matches = text.match(r);
    if (matches) { score += matches.length * 1; indicators.push(`${matches.length}× assessed claim${matches.length > 1 ? "s" : ""}`); }
  }
  for (const r of lowMarkers) {
    const matches = text.match(r);
    if (matches) { score -= matches.length * 6; indicators.push(`${matches.length}× unverified claim${matches.length > 1 ? "s" : ""}`); }
  }

  // Source count bonus
  const sourceCount = (text.match(/https?:\/\//g) || []).length;
  if (sourceCount >= 3) { score += 10; indicators.push(`${sourceCount} sources cited`); }
  else if (sourceCount === 0) { score -= 10; indicators.push("No sources cited"); }

  score = Math.max(10, Math.min(95, score));
  const level = score >= 70 ? "high" : score >= 45 ? "medium" : "low";
  return { score, level, indicators: indicators.slice(0, 4) };
}

const config = {
  high: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", label: "High Confidence" },
  medium: { icon: HelpCircle, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", label: "Medium Confidence" },
  low: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", label: "Low Confidence" },
};

const NomadConfidenceBadge = ({ content }: NomadConfidenceBadgeProps) => {
  if (!content || content.length < 100) return null;

  const { score, level, indicators } = analyzeConfidence(content);
  const { icon: Icon, color, bg, label } = config[level];

  return (
    <div className="group relative inline-flex items-center gap-1.5">
      <div className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[9px] font-extralight tracking-wider ${bg}`}>
        <Icon className={`h-3 w-3 ${color}`} />
        <span className={color}>{score}%</span>
      </div>
      {/* Tooltip */}
      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 w-52">
        <div className="rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl p-3 shadow-xl">
          <p className="text-[10px] font-light text-foreground mb-2">{label}</p>
          <ul className="space-y-1">
            {indicators.map((ind, i) => (
              <li key={i} className="text-[9px] font-extralight text-muted-foreground flex items-center gap-1.5">
                <span className={`h-1 w-1 rounded-full ${color.replace("text-", "bg-")}`} />
                {ind}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default NomadConfidenceBadge;
