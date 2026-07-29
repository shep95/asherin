// PropertySourcesStrip — cited property evidence from Firecrawl scrapes.
// Renders beneath an Aureon chat message when the property pipeline
// returned scraped Zillow/Redfin/Realtor/assessor sources.

import { Globe, ExternalLink } from "lucide-react";

export interface PropertySourceCard {
  url: string;
  domain: string;
  title: string;
  snippet: string;
  extracted?: Record<string, unknown>;
}

interface Props {
  sources: PropertySourceCard[];
}

// Show at most the two most useful extracted facts per source, in a stable order.
const FACT_ORDER = [
  "owner_name", "last_sale_price", "last_sale_date", "listing_price",
  "listing_status", "beds", "baths", "sqft", "lot_size", "year_built",
  "tax_assessment", "hoa_fee", "property_type", "mls_number", "full_address",
];

function topFacts(x: Record<string, unknown> | undefined): Array<[string, string]> {
  if (!x) return [];
  const out: Array<[string, string]> = [];
  for (const key of FACT_ORDER) {
    const v = x[key];
    if (v == null || v === "") continue;
    out.push([key.replace(/_/g, " "), typeof v === "string" ? v : JSON.stringify(v)]);
    if (out.length >= 2) break;
  }
  return out;
}

const PropertySourcesStrip = ({ sources }: Props) => {
  if (!sources?.length) return null;
  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center gap-1.5 px-0.5">
        <Globe className="h-3 w-3 text-foreground/60" />
        <span className="text-[10px] uppercase tracking-[0.18em] font-light text-muted-foreground">
          Property Evidence · {sources.length} sources
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {sources.map((s) => {
          const facts = topFacts(s.extracted);
          return (
            <a
              key={s.url}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group rounded-md border border-border/30 bg-foreground/[0.02] hover:bg-foreground/[0.05] hover:border-foreground/30 transition-colors px-2 py-1.5"
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <img
                    src={`https://www.google.com/s2/favicons?sz=32&domain=${s.domain}`}
                    alt=""
                    className="h-3 w-3 rounded-sm opacity-80"
                    onError={(e) => ((e.currentTarget.style.display = "none"))}
                  />
                  <span className="text-[10px] font-light text-foreground/80 truncate">
                    {s.domain}
                  </span>
                </div>
                <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/60 group-hover:text-foreground shrink-0" />
              </div>
              {s.title && (
                <div className="mt-0.5 text-[10px] font-light text-foreground/90 truncate">
                  {s.title}
                </div>
              )}
              {facts.length > 0 ? (
                <div className="mt-1 space-y-0.5">
                  {facts.map(([k, v]) => (
                    <div key={k} className="text-[9.5px] font-light text-muted-foreground">
                      <span className="text-foreground/60">{k}:</span>{" "}
                      <span className="text-foreground/90">{v.slice(0, 60)}</span>
                    </div>
                  ))}
                </div>
              ) : s.snippet ? (
                <div className="mt-1 text-[9.5px] font-light text-muted-foreground line-clamp-2">
                  {s.snippet}
                </div>
              ) : null}
            </a>
          );
        })}
      </div>
    </div>
  );
};

export default PropertySourcesStrip;
