import { useState, useMemo } from "react";
import { ExternalLink, Globe, Shield, AlertTriangle, Copy, Check, Lock, Eye } from "lucide-react";

interface NomadCitationFootnoteProps {
  content: string;
}

interface Citation {
  url: string;
  domain: string;
  index: number;
  trustLevel: "high" | "medium" | "low";
}

function extractCitations(text: string): Citation[] {
  const urls = text.match(/https?:\/\/[^\s)>\]]+/g) || [];
  const seen = new Set<string>();
  const citations: Citation[] = [];

  const highTrust = ["sec.gov", "courts.gov", "fec.gov", "justice.gov", "fbi.gov", "treasury.gov", "congress.gov", "reuters.com", "bloomberg.com", "wsj.com"];
  const medTrust = ["linkedin.com", "github.com", "wikipedia.org", "bbc.com", "nytimes.com", "ap.com"];

  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    const domain = url.replace(/https?:\/\/(?:www\.)?/, "").split("/")[0];
    const trustLevel = highTrust.some(d => domain.includes(d)) ? "high" :
                       medTrust.some(d => domain.includes(d)) ? "medium" : "low";
    citations.push({ url, domain, index: citations.length + 1, trustLevel });
  }

  return citations;
}

const trustConfig = {
  high: { icon: Shield, color: "text-emerald-400", label: "Official / Verified" },
  medium: { icon: Globe, color: "text-blue-400", label: "Established Source" },
  low: { icon: AlertTriangle, color: "text-amber-400", label: "Unverified Source" },
};

const NomadCitationFootnotes = ({ content }: NomadCitationFootnoteProps) => {
  const [copied, setCopied] = useState<number | null>(null);
  const citations = useMemo(() => extractCitations(content), [content]);

  if (citations.length === 0) return null;

  return (
    <div className="mt-3 border-t border-border/10 pt-2">
      <p className="text-[9px] font-extralight tracking-wider text-muted-foreground/50 uppercase mb-1.5">Sources ({citations.length})</p>
      <div className="space-y-1">
        {citations.map(c => {
          const { icon: Icon, color, label } = trustConfig[c.trustLevel];
          return (
            <div key={c.index} className="group flex items-center gap-2 text-[10px]">
              <span className="text-muted-foreground/30 font-mono w-4 text-right">[{c.index}]</span>
              <Icon className={`h-3 w-3 ${color} shrink-0`} />
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-extralight text-muted-foreground hover:text-foreground truncate flex-1 transition-colors"
              >
                {c.domain}
              </a>
              <span className={`text-[8px] font-extralight ${color} hidden group-hover:inline`}>{label}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(c.url); setCopied(c.index); setTimeout(() => setCopied(null), 1500); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {copied === c.index ? <Check className="h-3 w-3 text-foreground" /> : <Copy className="h-3 w-3 text-muted-foreground/40" />}
              </button>
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="h-3 w-3 text-muted-foreground/40 hover:text-foreground" />
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NomadCitationFootnotes;
