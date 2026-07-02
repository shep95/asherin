import { useMemo, useState } from "react";
import { ExternalLink, Copy, FileText, Layers, Shield, Globe } from "lucide-react";

// Shape mirrors supabase/functions/_shared/domainIntel.ts
export interface DomainMapAttachment {
  kind: "map";
  domain: string;
  origin: string;
  totalUnique: number;
  categories: Array<{ segment: string; count: number; urls: string[] }>;
  truncated: boolean;
}
export interface DomainHarvestAttachment {
  kind: "harvest";
  domain: string;
  origin: string;
  totalDocs: number;
  pagesCrawled: number;
  truncated: boolean;
  extTally: Record<string, number>;
  categories: Array<{ category: string; entries: Array<{ ext: string; count: number; urls: string[] }> }>;
}
export interface DomainReconCta {
  kind: "recon_cta";
  domain: string;
  deepLink: string;
  reason: string;
}
export interface DomainOsintAttachment {
  kind: "osint";
  domain: string;
  origin: string;
  ip?: string;
  server?: string;
  title?: string;
  description?: string;
  robotsPresent: boolean;
  sitemapCount: number;
}
export type DomainAttachment =
  | DomainMapAttachment
  | DomainHarvestAttachment
  | DomainReconCta
  | DomainOsintAttachment;

export interface DomainIntel {
  intent: { mode: "map" | "harvest" | "recon" | "osint"; domain: string; extFilter: string | null; trigger: string } | null;
  attachment: DomainAttachment | null;
}

interface Props { data: DomainIntel; }

const containerCls =
  "rounded-lg border border-border/40 bg-foreground/[0.03] backdrop-blur-sm text-[11px] font-light overflow-hidden";
const headerCls =
  "flex items-center justify-between px-2.5 py-1.5 border-b border-border/20 bg-foreground/[0.04]";

const DomainIntelCard = ({ data }: Props) => {
  const a = data.attachment;
  if (!a) return null;
  if (a.kind === "map") return <MapCard a={a} />;
  if (a.kind === "harvest") return <HarvestCard a={a} />;
  if (a.kind === "recon_cta") return <ReconCta a={a} />;
  if (a.kind === "osint") return <OsintCard a={a} />;
  return null;
};

// ─── Sub-cards ────────────────────────────────────────────────────────────

const MapCard = ({ a }: { a: DomainMapAttachment }) => {
  const [openSeg, setOpenSeg] = useState<string | null>(null);
  const copy = (urls: string[]) => navigator.clipboard.writeText(urls.join("\n")).catch(() => {});
  return (
    <div className={containerCls} aria-label={`Domain map for ${a.domain}`}>
      <div className={headerCls}>
        <div className="flex items-center gap-1.5 min-w-0">
          <Layers className="h-3 w-3 text-foreground/70" aria-hidden />
          <span className="uppercase tracking-[0.18em] text-[10px] text-muted-foreground">Domain Map</span>
          <span className="text-foreground truncate">· {a.domain}</span>
        </div>
        <span className="text-muted-foreground">
          {a.totalUnique} URLs{a.truncated ? " · truncated" : ""}
        </span>
      </div>
      <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
        {a.categories.length === 0 && <div className="text-muted-foreground italic">No path segments discovered.</div>}
        {a.categories.map((c) => {
          const isOpen = openSeg === c.segment;
          return (
            <div key={c.segment} className="rounded border border-border/20">
              <button
                type="button"
                onClick={() => setOpenSeg(isOpen ? null : c.segment)}
                className="w-full flex items-center justify-between px-2 py-1 hover:bg-foreground/[0.04]"
                aria-expanded={isOpen}
              >
                <span className="text-foreground/90">/{c.segment}/</span>
                <span className="text-muted-foreground">{c.count}</span>
              </button>
              {isOpen && (
                <div className="border-t border-border/20 p-1.5 space-y-0.5">
                  {c.urls.slice(0, 20).map((u) => (
                    <a key={u} href={u} target="_blank" rel="noopener noreferrer"
                       className="block truncate text-[10.5px] text-foreground/70 hover:text-foreground">
                      {u}
                    </a>
                  ))}
                  <button type="button" onClick={() => copy(c.urls)}
                    className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                    <Copy className="h-2.5 w-2.5" /> Copy {c.urls.length} URL{c.urls.length === 1 ? "" : "s"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const HarvestCard = ({ a }: { a: DomainHarvestAttachment }) => {
  const tally = useMemo(() =>
    Object.entries(a.extTally).sort((x, y) => y[1] - x[1]).slice(0, 12),
    [a.extTally]);
  const copy = (urls: string[]) => navigator.clipboard.writeText(urls.join("\n")).catch(() => {});
  return (
    <div className={containerCls} aria-label={`Domain harvest for ${a.domain}`}>
      <div className={headerCls}>
        <div className="flex items-center gap-1.5 min-w-0">
          <FileText className="h-3 w-3 text-foreground/70" aria-hidden />
          <span className="uppercase tracking-[0.18em] text-[10px] text-muted-foreground">Domain Harvest</span>
          <span className="text-foreground truncate">· {a.domain}</span>
        </div>
        <span className="text-muted-foreground">
          {a.totalDocs} docs · {a.pagesCrawled} pages{a.truncated ? " · capped" : ""}
        </span>
      </div>
      {tally.length > 0 && (
        <div className="flex flex-wrap gap-1 p-2 border-b border-border/20">
          {tally.map(([ext, n]) => (
            <span key={ext} className="rounded border border-border/30 px-1.5 py-0.5 text-[10px] text-foreground/80">
              .{ext} × {n}
            </span>
          ))}
        </div>
      )}
      <div className="p-2 space-y-2 max-h-72 overflow-y-auto">
        {a.categories.length === 0 && (
          <div className="text-muted-foreground italic">No downloadable documents found.</div>
        )}
        {a.categories.map((cat) => (
          <div key={cat.category}>
            <div className="uppercase tracking-[0.16em] text-[9.5px] text-muted-foreground mb-1">{cat.category}</div>
            <div className="space-y-1">
              {cat.entries.map((e) => (
                <details key={e.ext} className="rounded border border-border/20 group">
                  <summary className="flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-foreground/[0.04]">
                    <span className="text-foreground/90">.{e.ext}</span>
                    <span className="text-muted-foreground">{e.count}</span>
                  </summary>
                  <div className="border-t border-border/20 p-1.5 space-y-0.5">
                    {e.urls.slice(0, 25).map((u) => (
                      <a key={u} href={u} target="_blank" rel="noopener noreferrer"
                         className="block truncate text-[10.5px] text-foreground/70 hover:text-foreground">
                        {u}
                      </a>
                    ))}
                    <button type="button" onClick={() => copy(e.urls)}
                      className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                      <Copy className="h-2.5 w-2.5" /> Copy {e.urls.length} URL{e.urls.length === 1 ? "" : "s"}
                    </button>
                  </div>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ReconCta = ({ a }: { a: DomainReconCta }) => (
  <div className={containerCls} aria-label={`Recon deep link for ${a.domain}`}>
    <div className={headerCls}>
      <div className="flex items-center gap-1.5 min-w-0">
        <Shield className="h-3 w-3 text-foreground/70" aria-hidden />
        <span className="uppercase tracking-[0.18em] text-[10px] text-muted-foreground">Zerlal Recon</span>
        <span className="text-foreground truncate">· {a.domain}</span>
      </div>
    </div>
    <div className="p-2.5 space-y-2">
      <p className="text-muted-foreground leading-relaxed">{a.reason}</p>
      <a href={a.deepLink} target="_blank" rel="noopener noreferrer"
         className="inline-flex items-center gap-1.5 rounded border border-border/40 px-2.5 py-1 text-foreground hover:bg-foreground/[0.05]">
        Launch Zerlal recon <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  </div>
);

const OsintCard = ({ a }: { a: DomainOsintAttachment }) => (
  <div className={containerCls} aria-label={`Domain probe for ${a.domain}`}>
    <div className={headerCls}>
      <div className="flex items-center gap-1.5 min-w-0">
        <Globe className="h-3 w-3 text-foreground/70" aria-hidden />
        <span className="uppercase tracking-[0.18em] text-[10px] text-muted-foreground">Domain Probe</span>
        <span className="text-foreground truncate">· {a.domain}</span>
      </div>
      <a href={a.origin} target="_blank" rel="noopener noreferrer"
         className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        Visit <ExternalLink className="h-2.5 w-2.5" />
      </a>
    </div>
    <div className="p-2.5 space-y-1 text-foreground/85">
      {a.title && <div><span className="text-muted-foreground">Title:</span> {a.title}</div>}
      {a.description && <div className="text-muted-foreground leading-relaxed">{a.description}</div>}
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-[10.5px] text-muted-foreground">
        {a.server && <span>server: <span className="text-foreground/80">{a.server}</span></span>}
        <span>robots.txt: <span className="text-foreground/80">{a.robotsPresent ? "present" : "absent"}</span></span>
        <span>sitemap URLs: <span className="text-foreground/80">{a.sitemapCount}</span></span>
      </div>
    </div>
  </div>
);

export default DomainIntelCard;
