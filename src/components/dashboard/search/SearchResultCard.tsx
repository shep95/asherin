import { useState } from "react";
import { Globe, ExternalLink, Clock, Eye, Copy, Check, AlertTriangle, Info } from "lucide-react";
import type { SearchResult, FreshnessAlert, PagePreview } from "./types";
import SourceTierBadge from "./SourceTierBadge";
import { supabase } from "@/integrations/supabase/client";

interface SearchResultCardProps {
  result: SearchResult;
  freshnessAlert?: FreshnessAlert;
  onPreview?: (preview: PagePreview) => void;
  index: number;
}

const SearchResultCard = ({ result, freshnessAlert, onPreview, index }: SearchResultCardProps) => {
  const [copied, setCopied] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const cleanUrl = (url: string) => {
    try {
      const u = new URL(url);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid', 'ref', 'source'].forEach(p => u.searchParams.delete(p));
      return u.toString();
    } catch { return url; }
  };

  const domain = (url: string) => {
    try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(cleanUrl(result.url));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const loadPreview = async () => {
    if (!onPreview) return;
    setLoadingPreview(true);
    try {
      const { data } = await supabase.functions.invoke("zophiel-preview", {
        body: { url: result.url },
      });
      if (data?.success) onPreview(data as PagePreview);
    } catch { /* silent */ }
    setLoadingPreview(false);
  };

  return (
    <div className="group rounded-xl border border-border/15 bg-card/20 backdrop-blur-sm p-3 sm:p-4 hover:bg-foreground/5 hover:border-border/30 transition-all animate-slide-up" style={{ animationDelay: `${index * 40}ms` }}>
      {/* Freshness Alert */}
      {freshnessAlert && (
        <div className={`flex items-start gap-2 rounded-lg px-3 py-1.5 mb-3 text-[11px] font-light ${freshnessAlert.severity === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
          {freshnessAlert.severity === 'warning' ? <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /> : <Info className="h-3 w-3 shrink-0 mt-0.5" />}
          <span className="break-words">{freshnessAlert.message}</span>
        </div>
      )}

      {/* Top row: tier + domain */}
      <div className="flex items-center gap-2 mb-1.5 min-w-0">
        <SourceTierBadge tier={result.tier} />
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <Globe className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          <span className="text-[11px] font-light text-muted-foreground/50 truncate">{result.source || domain(result.url)}</span>
        </div>
        <a href={cleanUrl(result.url)} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1">
          <ExternalLink className="h-3 w-3 text-muted-foreground/30" />
        </a>
      </div>

      {/* Title */}
      <a href={cleanUrl(result.url)} target="_blank" rel="noopener noreferrer" className="block">
        <h3 className="text-sm font-normal text-accent hover:underline underline-offset-2 mb-1 line-clamp-2 break-words">{result.title}</h3>
      </a>

      {/* URL */}
      <p className="text-[10px] font-mono text-muted-foreground/30 truncate mb-1.5">{cleanUrl(result.url)}</p>

      {/* Snippet */}
      {result.snippet && (
        <p className="text-xs font-extralight text-muted-foreground leading-relaxed line-clamp-3 mb-2 break-words">{result.snippet}</p>
      )}

      {/* Bottom row: meta + actions — always visible on mobile */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] text-muted-foreground/40">
        {result.publishDate && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {result.publishDate}
          </span>
        )}
        {result.readingTimeMin && (
          <span>{result.readingTimeMin} min read</span>
        )}

        <div className="flex items-center gap-1 sm:ml-auto sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            onClick={loadPreview}
            disabled={loadingPreview}
            className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-foreground/5 transition-colors text-muted-foreground/50 hover:text-foreground"
          >
            <Eye className="h-3 w-3" />
            {loadingPreview ? "…" : "Preview"}
          </button>
          <button
            onClick={copyLink}
            className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-foreground/5 transition-colors text-muted-foreground/50 hover:text-foreground"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchResultCard;
