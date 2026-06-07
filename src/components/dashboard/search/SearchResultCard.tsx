import { useMemo, useState } from "react";
import { Globe, ExternalLink, Clock, Eye, Copy, Check, AlertTriangle, Info, MapPin, ShieldAlert, FileSearch, ChevronDown } from "lucide-react";
import type { SearchResult, FreshnessAlert, PagePreview } from "./types";
import SourceTierBadge from "./SourceTierBadge";
import SocialPostEmbed, { isSocialUrl } from "./SocialPostEmbed";
import LocationMapPanel from "./LocationMapPanel";
import { supabase } from "@/integrations/supabase/client";
import { decodeHtmlEntities } from "@/lib/htmlDecode";
import { buildIntelReport, type IntelReport } from "./intel/buildIntelReport";

interface SearchResultCardProps {
  result: SearchResult;
  freshnessAlert?: FreshnessAlert;
  onPreview?: (preview: PagePreview) => void;
  index: number;
}

// Location detection heuristics — pulls coordinates and address-like phrases
// out of the title + snippet so users can pin them on the map panel.
const COORD_RE = /(-?\d{1,2}\.\d{3,8})[,\s]+(-?\d{1,3}\.\d{3,8})/;
const ADDRESS_RE =
  /\b\d{1,5}\s+[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,4}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Highway|Hwy|Parkway|Pkwy)\b[^.,;\n]{0,60}/;
const CITY_STATE_RE =
  /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,3}),\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/;

function detectLocation(text: string): string | null {
  if (!text) return null;
  const coord = text.match(COORD_RE);
  if (coord) return `${coord[1]}, ${coord[2]}`;
  const addr = text.match(ADDRESS_RE);
  if (addr) return addr[0].trim();
  const city = text.match(CITY_STATE_RE);
  if (city) return city[0].trim();
  return null;
}

const SearchResultCard = ({ result, freshnessAlert, onPreview, index }: SearchResultCardProps) => {
  const [copied, setCopied] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [mapQuery, setMapQuery] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [report, setReport] = useState<IntelReport | null>(null);
  const [reportError, setReportError] = useState<string | null>(null);

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

  const social = useMemo(() => isSocialUrl(result.url), [result.url]);
  // Decode HTML entities (&gt; &amp; &#039; etc.) that some search providers leave intact.
  const cleanTitle = useMemo(() => decodeHtmlEntities(result.title), [result.title]);
  const cleanSnippet = useMemo(() => decodeHtmlEntities(result.snippet), [result.snippet]);
  const detectedLocation = useMemo(
    () => detectLocation(`${cleanTitle} ${cleanSnippet}`),
    [cleanTitle, cleanSnippet]
  );

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

  const isOnion = !!result.onion;

  return (
    <>
      <div className={`group rounded-xl border p-3 sm:p-4 backdrop-blur-sm transition-all animate-slide-up ${isOnion ? "border-orange-500/25 bg-orange-500/[0.04] hover:bg-orange-500/[0.07] hover:border-orange-500/40" : "border-border/15 bg-card/20 hover:bg-foreground/5 hover:border-border/30"}`} style={{ animationDelay: `${index * 40}ms` }}>
        {/* Freshness Alert */}
        {freshnessAlert && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-1.5 mb-3 text-[11px] font-light ${freshnessAlert.severity === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
            {freshnessAlert.severity === 'warning' ? <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" /> : <Info className="h-3 w-3 shrink-0 mt-0.5" />}
            <span className="break-words">{freshnessAlert.message}</span>
          </div>
        )}

        {/* Onion warning banner */}
        {isOnion && (
          <div className="flex items-start gap-2 rounded-lg px-3 py-1.5 mb-3 text-[11px] font-light bg-orange-500/10 text-orange-300 border border-orange-500/20">
            <ShieldAlert className="h-3 w-3 shrink-0 mt-0.5" />
            <span className="break-words">
              <strong className="font-medium">Tor required.</strong> This is a hidden-service (.onion) result indexed via Ahmia. It is unverified, may contain illegal or hostile content, and only opens in <a href="https://www.torproject.org/download/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Tor Browser</a>.
            </span>
          </div>
        )}

        {/* Top row: tier + domain */}
        <div className="flex items-center gap-2 mb-1.5 min-w-0">
          <SourceTierBadge tier={result.tier} />
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <Globe className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            <span className="text-[11px] font-light text-muted-foreground/50 truncate">{result.source || domain(result.url)}</span>
          </div>
          {!isOnion && (
            <a href={cleanUrl(result.url)} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1" aria-label="Open in new tab">
              <ExternalLink className="h-3 w-3 text-muted-foreground/30" />
            </a>
          )}
        </div>

        {/* Title — clickable on clearnet, plain text on .onion */}
        {isOnion ? (
          <h3 className="text-sm font-normal text-foreground/90 mb-1 line-clamp-2 break-words">{cleanTitle}</h3>
        ) : (
          <a href={cleanUrl(result.url)} target="_blank" rel="noopener noreferrer" className="block">
            <h3 className="text-sm font-normal text-foreground/90 hover:text-foreground hover:underline underline-offset-2 mb-1 line-clamp-2 break-words">{cleanTitle}</h3>
          </a>
        )}

        {/* URL */}
        <p className={`text-[10px] font-mono truncate mb-1.5 ${isOnion ? "text-orange-300/70" : "text-muted-foreground/30"}`}>
          {isOnion ? result.url : cleanUrl(result.url)}
        </p>

        {/* Snippet */}
        {cleanSnippet && (
          <p className="text-xs font-extralight text-muted-foreground leading-relaxed line-clamp-3 mb-2 break-words">{cleanSnippet}</p>
        )}

        {/* Inline social embed (clearnet only) */}
        {!isOnion && social && <SocialPostEmbed url={result.url} />}

        {/* Location chip — opens dark-theme map side panel */}
        {detectedLocation && (
          <button
            onClick={() => setMapQuery(detectedLocation)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border/25 bg-foreground/[0.04] hover:bg-foreground/[0.08] hover:border-border/40 px-2.5 py-1 text-[10px] font-light text-foreground/80 transition-colors"
            title="Open on map"
          >
            <MapPin className="h-3 w-3" />
            <span className="truncate max-w-[260px]">{detectedLocation}</span>
            <span className="text-muted-foreground/50">· View map</span>
          </button>
        )}

        {/* Bottom row: meta + actions — always visible on mobile */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] text-muted-foreground/40 mt-2">
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
            {!isOnion && (
              <button
                onClick={loadPreview}
                disabled={loadingPreview}
                className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-foreground/5 transition-colors text-muted-foreground/50 hover:text-foreground"
              >
                <Eye className="h-3 w-3" />
                {loadingPreview ? "…" : "Preview"}
              </button>
            )}
            <button
              onClick={copyLink}
              className="flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-foreground/5 transition-colors text-muted-foreground/50 hover:text-foreground"
              title={isOnion ? "Copy .onion address — paste in Tor Browser" : "Copy link"}
            >
              {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : isOnion ? "Copy .onion" : "Copy"}
            </button>
          </div>
        </div>
      </div>

      {mapQuery && <LocationMapPanel query={mapQuery} onClose={() => setMapQuery(null)} />}
    </>
  );
};

export default SearchResultCard;
