import { useEffect, useState } from "react";
import { Loader2, Network, Globe, AtSign, Hash, Mail, Phone, Link2, ArrowUpRight, X, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  url: string;
  onClose: () => void;
}

interface IntelResponse {
  success: boolean;
  target: string;
  domain: string;
  scrapeError?: string | null;
  meta: { title: string; description: string; statusCode: number | null; language: string; siteName: string; sourceURL: string; image: string };
  screenshot: string | null;
  stats: { words: number; outboundLinks: number; internalLinks: number; uniqueDomains: number; handles: number; hashtags: number; emails: number; phones: number };
  handles: string[];
  tweetMentions: { value: string; count: number }[];
  hashtags: string[];
  emails: string[];
  phones: string[];
  socials: Record<string, string[]>;
  domainCounts: { value: string; count: number }[];
  outboundLinks: string[];
  internalLinks: string[];
  headings: string[];
  keySentences: string[];
  entities: { value: string; count: number }[];
  graph: { nodes: any[]; edges: any[] };
  error?: string;
}

const Pill = ({ children, href }: { children: React.ReactNode; href?: string }) => (
  href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-background/60 px-2 py-1 text-[11px] font-light text-foreground hover:border-foreground/60 hover:bg-foreground/5 transition-colors">
      {children}
    </a>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-md border border-border/40 bg-background/60 px-2 py-1 text-[11px] font-light text-foreground">{children}</span>
  )
);

const Section = ({ title, icon, count, children }: { title: string; icon?: React.ReactNode; count?: number; children: React.ReactNode }) => (
  <div className="rounded-xl border border-border/30 bg-foreground/[0.02] p-4">
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2 text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground">
        {icon}{title}
      </div>
      {typeof count === "number" && <div className="text-[10px] font-light text-muted-foreground">{count}</div>}
    </div>
    {children}
  </div>
);

const UrlIntelMapPanel = ({ url, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<IntelResponse | null>(null);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setError(null);
      setData(null);
      try {
        const { data: res, error: err } = await supabase.functions.invoke("url-intel-map", { body: { url } });
        if (cancel) return;
        if (err) throw err;
        if (!res?.success) throw new Error(res?.error || "Failed to map URL");
        setData(res as IntelResponse);
      } catch (e: any) {
        if (!cancel) setError(e?.message || "URL intel failed");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [url]);

  return (
    <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-1.5 rounded-lg bg-foreground/[0.04] border border-border/30">
            <Network className="h-4 w-4 text-foreground/80" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground">URL Intelligence Map</div>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm font-light text-foreground hover:underline truncate block max-w-[60vw]">{url}</a>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/5" aria-label="Close URL intel">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-5 space-y-4">
        {loading && (
          <div className="flex items-center gap-2 text-xs font-light text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Mapping connections, mentions, and outbound links…
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] font-light text-destructive">{error}</div>
        )}
        {data && (
          <>
            {/* Header / meta */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-2">
                <div className="text-base font-light text-foreground">{data.meta.title || data.domain}</div>
                {data.meta.description && (
                  <div className="text-xs font-light text-muted-foreground line-clamp-3">{data.meta.description}</div>
                )}
                <div className="flex flex-wrap gap-3 text-[10px] font-light tracking-[0.18em] uppercase text-muted-foreground pt-1">
                  <span>{data.domain}</span>
                  {data.meta.language && <span>{data.meta.language}</span>}
                  {data.meta.statusCode != null && <span>HTTP {data.meta.statusCode}</span>}
                  <span>{data.stats.words.toLocaleString()} words</span>
                </div>
                {data.scrapeError && (
                  <div className="text-[11px] font-light text-amber-500">Partial: {data.scrapeError}</div>
                )}
              </div>
              {data.screenshot && (
                <a href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-border/30 bg-background/40">
                  <img src={data.screenshot} alt="Page screenshot" className="w-full h-40 object-cover object-top" />
                </a>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                ["Outbound", data.stats.outboundLinks],
                ["Domains", data.stats.uniqueDomains],
                ["Mentions", data.stats.handles],
                ["Hashtags", data.stats.hashtags],
                ["Emails", data.stats.emails],
                ["Phones", data.stats.phones],
                ["Internal", data.stats.internalLinks],
                ["Entities", data.entities.length],
              ].map(([label, n]) => (
                <div key={label as string} className="rounded-lg border border-border/30 bg-foreground/[0.02] px-3 py-2">
                  <div className="text-[10px] font-light tracking-[0.18em] uppercase text-muted-foreground">{label}</div>
                  <div className="text-base font-light text-foreground">{(n as number).toLocaleString()}</div>
                </div>
              ))}
            </div>

            {/* Tweet/page mentions */}
            {data.tweetMentions.length > 0 && (
              <Section title="Mentions & Interactions" icon={<AtSign className="h-3 w-3" />} count={data.tweetMentions.length}>
                <div className="flex flex-wrap gap-1.5">
                  {data.tweetMentions.map((m) => {
                    const handle = m.value.replace(/^@/, "");
                    return (
                      <Pill key={m.value} href={`https://x.com/${handle}`}>
                        {m.value} <span className="text-muted-foreground">· {m.count}</span>
                      </Pill>
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Social profiles */}
            {Object.keys(data.socials).length > 0 && (
              <Section title="Linked Social Profiles" icon={<Globe className="h-3 w-3" />}>
                <div className="space-y-2">
                  {Object.entries(data.socials).map(([host, handles]) => (
                    <div key={host}>
                      <div className="text-[10px] font-light tracking-[0.18em] uppercase text-muted-foreground mb-1">{host}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {handles.map((h) => (
                          <Pill key={h} href={`https://${host}/${h.replace(/^@/, "")}`}>@{h}</Pill>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Domains it connects to */}
            {data.domainCounts.length > 0 && (
              <Section title="Connected Domains" icon={<Link2 className="h-3 w-3" />} count={data.domainCounts.length}>
                <div className="flex flex-wrap gap-1.5">
                  {data.domainCounts.map((d) => (
                    <Pill key={d.value} href={`https://${d.value}`}>
                      {d.value} <span className="text-muted-foreground">· {d.count}</span>
                    </Pill>
                  ))}
                </div>
              </Section>
            )}

            {/* Hashtags */}
            {data.hashtags.length > 0 && (
              <Section title="Topics & Hashtags" icon={<Hash className="h-3 w-3" />} count={data.hashtags.length}>
                <div className="flex flex-wrap gap-1.5">
                  {data.hashtags.map((h) => <Pill key={h}>{h}</Pill>)}
                </div>
              </Section>
            )}

            {/* Entities */}
            {data.entities.length > 0 && (
              <Section title="Named Entities" icon={<ImageIcon className="h-3 w-3" />} count={data.entities.length}>
                <div className="flex flex-wrap gap-1.5">
                  {data.entities.map((e) => (
                    <Pill key={e.value}>{e.value} <span className="text-muted-foreground">· {e.count}</span></Pill>
                  ))}
                </div>
              </Section>
            )}

            {/* Emails / phones */}
            {(data.emails.length > 0 || data.phones.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.emails.length > 0 && (
                  <Section title="Emails" icon={<Mail className="h-3 w-3" />} count={data.emails.length}>
                    <div className="flex flex-wrap gap-1.5">
                      {data.emails.map((e) => <Pill key={e} href={`mailto:${e}`}>{e}</Pill>)}
                    </div>
                  </Section>
                )}
                {data.phones.length > 0 && (
                  <Section title="Phones" icon={<Phone className="h-3 w-3" />} count={data.phones.length}>
                    <div className="flex flex-wrap gap-1.5">
                      {data.phones.map((p) => <Pill key={p}>{p}</Pill>)}
                    </div>
                  </Section>
                )}
              </div>
            )}

            {/* Outbound links */}
            {data.outboundLinks.length > 0 && (
              <Section title="Outbound Links" icon={<ArrowUpRight className="h-3 w-3" />} count={data.outboundLinks.length}>
                <ul className="space-y-1 max-h-72 overflow-y-auto">
                  {data.outboundLinks.map((u) => (
                    <li key={u}>
                      <a href={u} target="_blank" rel="noopener noreferrer" className="text-[11px] font-light text-foreground/80 hover:text-foreground hover:underline truncate block">{u}</a>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {/* Key sentences */}
            {data.keySentences.length > 0 && (
              <Section title="Key Excerpts">
                <ul className="space-y-2 text-[12px] font-light text-foreground/85">
                  {data.keySentences.map((s, i) => <li key={i}>· {s}</li>)}
                </ul>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default UrlIntelMapPanel;
