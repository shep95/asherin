// ARCHIVE — Asher Archives. Three pillars:
//   1. Historical Intelligence  — decade-scoped browse (1990 → present)
//   2. Lost Knowledge Recovery  — surfaces content DELETED from the live web (Wayback)
//   3. Evolution Tracking       — decade-by-decade timeline of how a topic mutated
import { useCallback, useState } from "react";
import {
  Search, Loader2, ExternalLink, FileText, Film, Music, Archive, Image as ImageIcon,
  Cpu, Globe, Play, History, Ghost, GitBranch, Calendar
} from "lucide-react";

const IA = "https://archive.org";

type MediaType = "texts" | "movies" | "audio" | "image" | "software" | "web";
const MEDIA: { id: MediaType; label: string; icon: any }[] = [
  { id: "texts", label: "Books / Papers", icon: FileText },
  { id: "movies", label: "Video", icon: Film },
  { id: "audio", label: "Audio", icon: Music },
  { id: "image", label: "Images", icon: ImageIcon },
  { id: "software", label: "Software", icon: Cpu },
  { id: "web", label: "Web Captures", icon: Globe },
];

type Pillar = "historical" | "lost" | "evolution";
const PILLARS: { id: Pillar; label: string; icon: any; tip: string }[] = [
  { id: "historical", label: "Historical Intelligence", icon: History, tip: "Entire history 1990 → present" },
  { id: "lost",       label: "Lost Knowledge",          icon: Ghost,   tip: "Recover content DELETED from the live web" },
  { id: "evolution",  label: "Evolution Tracking",      icon: GitBranch, tip: "Decade-by-decade mutation of a topic" },
];

const NOW_YEAR = new Date().getUTCFullYear();
const DECADES: { from: number; to: number; label: string }[] = [
  { from: 1990, to: 1999, label: "1990s" },
  { from: 2000, to: 2009, label: "2000s" },
  { from: 2010, to: 2019, label: "2010s" },
  { from: 2020, to: NOW_YEAR, label: `2020s` },
];

interface IaDoc {
  identifier: string;
  title?: string;
  description?: string | string[];
  creator?: string | string[];
  date?: string;
  mediatype?: string;
}

interface WaybackHit {
  original: string;
  timestamp: string; // YYYYMMDDhhmmss
  statuscode: string;
  mimetype: string;
  digest: string;
}

interface DecadeBucket {
  label: string;
  from: number;
  to: number;
  count: number;
  top: IaDoc[];
}

const ArchivePanel = () => {
  const [query, setQuery] = useState("");
  const [pillar, setPillar] = useState<Pillar>("historical");
  const [active, setActive] = useState<MediaType[]>(["texts", "movies", "audio"]);
  const [decade, setDecade] = useState<{ from: number; to: number } | null>(null);

  const [docs, setDocs] = useState<IaDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [wayback, setWayback] = useState<WaybackHit[]>([]);
  const [evo, setEvo] = useState<DecadeBucket[]>([]);

  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<IaDoc | null>(null);

  const buildIaUrl = (q: string, from: number | null, to: number | null, rows = 50) => {
    const mt = active.length ? `(${active.map((m) => `mediatype:${m}`).join(" OR ")})` : "";
    const parts = [`(${q})`];
    if (mt) parts.push(mt);
    if (from && to) parts.push(`date:[${from}-01-01 TO ${to}-12-31]`);
    const params = new URLSearchParams();
    params.set("q", parts.join(" AND "));
    ["identifier","title","description","creator","date","mediatype"].forEach((f) => params.append("fl[]", f));
    params.set("rows", String(rows));
    params.set("page", "1");
    params.set("output", "json");
    params.set("sort[]", "downloads desc");
    return `${IA}/advancedsearch.php?${params.toString()}`;
  };

  const runHistorical = useCallback(async (q: string) => {
    const url = buildIaUrl(q, decade?.from ?? 1990, decade?.to ?? NOW_YEAR, 60);
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Archive ${r.status}`);
    const j = await r.json();
    setDocs(j?.response?.docs || []);
    setTotal(j?.response?.numFound || 0);
  }, [active, decade]);

  // Lost Knowledge — query Wayback CDX for snapshots that are 404/410/dead today
  const runLost = useCallback(async (q: string) => {
    // Heuristic: treat the query as a URL or a domain; fall back to a Google-style search of cached pages
    const looksLikeUrl = /[./]/.test(q) && !/\s/.test(q);
    const target = looksLikeUrl ? q.replace(/^https?:\/\//, "") : `*.${q.replace(/\s+/g, "")}.*`;
    const cdx = new URL("https://web.archive.org/cdx/search/cdx");
    cdx.searchParams.set("url", target);
    cdx.searchParams.set("output", "json");
    cdx.searchParams.set("limit", "200");
    cdx.searchParams.set("collapse", "urlkey");
    cdx.searchParams.set("filter", "statuscode:200");
    if (!looksLikeUrl) cdx.searchParams.set("matchType", "domain");

    const r = await fetch(cdx.toString());
    if (!r.ok) throw new Error(`Wayback ${r.status}`);
    const rows: string[][] = await r.json();
    const [, ...data] = rows;
    const hits: WaybackHit[] = data.map((row) => ({
      original: row[2], timestamp: row[1], statuscode: row[4], mimetype: row[3], digest: row[5],
    }));

    // Probe a sample of originals; keep only those that are dead on the live web NOW.
    const sample = hits.slice(0, 30);
    const dead = await Promise.all(sample.map(async (h) => {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 4000);
        const live = await fetch(h.original, { method: "HEAD", mode: "no-cors", signal: ctl.signal });
        clearTimeout(t);
        // no-cors masks status; treat opaque as alive. Only AbortError / network failure ⇒ likely dead.
        return live.type === "opaque" ? null : h;
      } catch {
        return h; // network failure ⇒ likely deleted
      }
    }));
    setWayback(dead.filter(Boolean) as WaybackHit[]);
    setTotal(hits.length);
  }, []);

  // Evolution Tracking — bucket archive.org hits per decade
  const runEvolution = useCallback(async (q: string) => {
    const buckets = await Promise.all(DECADES.map(async (d) => {
      const r = await fetch(buildIaUrl(q, d.from, d.to, 5));
      if (!r.ok) return { ...d, count: 0, top: [] as IaDoc[] };
      const j = await r.json();
      return { ...d, count: j?.response?.numFound || 0, top: j?.response?.docs || [] };
    }));
    setEvo(buckets);
    setTotal(buckets.reduce((s, b) => s + b.count, 0));
  }, [active]);

  const run = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true); setError(null); setSearched(true);
    setDocs([]); setWayback([]); setEvo([]); setTotal(0);
    try {
      if (pillar === "historical") await runHistorical(q);
      else if (pillar === "lost") await runLost(q);
      else await runEvolution(q);
    } catch (e: any) {
      setError(e?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }, [pillar, runHistorical, runLost, runEvolution]);

  const desc = (d: IaDoc) => {
    const x = Array.isArray(d.description) ? d.description.join(" ") : (d.description || "");
    return String(x).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  };
  const creator = (d: IaDoc) => Array.isArray(d.creator) ? d.creator.join(", ") : (d.creator || "");
  const iconFor = (m?: string) => {
    switch (m) {
      case "movies": case "etree": return Film;
      case "audio": return Music;
      case "image": return ImageIcon;
      case "software": return Cpu;
      case "web": return Globe;
      default: return FileText;
    }
  };
  const fmtTs = (ts: string) =>
    `${ts.slice(0,4)}-${ts.slice(4,6)}-${ts.slice(6,8)}`;

  const renderDoc = (d: IaDoc) => {
    const Icon = iconFor(d.mediatype);
    const isAV = d.mediatype === "movies" || d.mediatype === "audio" || d.mediatype === "etree";
    const url = `${IA}/details/${d.identifier}`;
    return (
      <div key={d.identifier} className="rounded-xl border border-border/20 bg-card/30 px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          <Icon className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <a href={url} target="_blank" rel="noopener noreferrer" className="text-[12px] font-light text-foreground hover:text-accent truncate">{d.title || d.identifier}</a>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50">{d.mediatype}</span>
              {creator(d) && <span className="text-[9px] text-muted-foreground/40 truncate">· {creator(d)}</span>}
              {d.date && <span className="text-[9px] text-muted-foreground/40">· {String(d.date).slice(0, 10)}</span>}
            </div>
            {desc(d) && <p className="text-[11px] font-extralight text-muted-foreground/80 mt-1 line-clamp-2">{desc(d)}</p>}
            <div className="flex items-center gap-3 mt-1.5">
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground">
                <ExternalLink className="h-3 w-3" /> Open record
              </a>
              {isAV && (
                <button onClick={() => setPreviewing(d)} className="inline-flex items-center gap-1 text-[10px] text-accent/80 hover:text-accent" title="Stream-only — cannot be downloaded">
                  <Play className="h-3 w-3" /> Watch / Listen (stream only)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-accent/30 bg-accent/5 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
        <Archive className="h-5 w-5 text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-light text-foreground">Asher Archives — Time Engine</p>
          <p className="text-[10px] font-extralight text-muted-foreground">
            Historical Intelligence (1990 → present) · Lost Knowledge Recovery (deleted-from-web) · Evolution Tracking (decade by decade).
          </p>
        </div>
      </div>

      {/* Pillar selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {PILLARS.map(({ id, label, icon: Icon, tip }) => {
          const on = pillar === id;
          return (
            <button
              key={id}
              onClick={() => { setPillar(id); setSearched(false); setDocs([]); setWayback([]); setEvo([]); }}
              className={`text-left rounded-xl border px-3 py-2 transition-colors ${
                on ? "bg-accent/15 border-accent/40" : "bg-card/30 border-border/20 hover:border-border/40"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 ${on ? "text-accent" : "text-muted-foreground/70"}`} />
                <span className={`text-[11px] font-light ${on ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
              </div>
              <p className="text-[10px] font-extralight text-muted-foreground/60 mt-0.5">{tip}</p>
            </button>
          );
        })}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); run(query); }}
        className="flex items-center gap-2 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl px-4 py-3"
      >
        <Search className="h-5 w-5 text-muted-foreground/50 shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            pillar === "lost"
              ? "Domain or URL whose deleted pages to recover (e.g. geocities.com, oldsite.com/blog)…"
              : pillar === "evolution"
                ? "Topic to track across decades (e.g. neural networks, encryption, drone warfare)…"
                : "Search Asher Archives across history (e.g. CIA reading room, Apollo 11)…"
          }
          className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded-xl bg-accent/20 px-3 py-1.5 text-xs font-light text-accent hover:bg-accent/30 transition-colors disabled:opacity-30"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Hunt"}
        </button>
      </form>

      {/* Decade scope (historical only) */}
      {pillar === "historical" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/50 mr-1 inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Era
          </span>
          <button
            onClick={() => setDecade(null)}
            className={`px-2 py-0.5 rounded-md text-[10px] font-light tracking-wide border transition-colors ${
              !decade ? "bg-accent/20 border-accent/40 text-accent" : "bg-card/30 border-border/30 text-muted-foreground/60 hover:text-foreground"
            }`}
          >All (1990–{NOW_YEAR})</button>
          {DECADES.map((d) => {
            const on = decade?.from === d.from;
            return (
              <button
                key={d.label}
                onClick={() => setDecade({ from: d.from, to: d.to })}
                className={`px-2 py-0.5 rounded-md text-[10px] font-light tracking-wide border transition-colors ${
                  on ? "bg-accent/20 border-accent/40 text-accent" : "bg-card/30 border-border/30 text-muted-foreground/60 hover:text-foreground"
                }`}
              >{d.label}</button>
            );
          })}
        </div>
      )}

      {/* Media filters (historical + evolution) */}
      {pillar !== "lost" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/50 mr-1">Media</span>
          {MEDIA.map(({ id, label, icon: Icon }) => {
            const on = active.includes(id);
            return (
              <button
                key={id}
                onClick={() => setActive((cur) => on ? cur.filter((x) => x !== id) : [...cur, id])}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-light tracking-wide border transition-colors ${
                  on ? "bg-accent/20 border-accent/40 text-accent" : "bg-card/30 border-border/30 text-muted-foreground/60 hover:text-foreground"
                }`}
              ><Icon className="h-3 w-3" /> {label}</button>
            );
          })}
        </div>
      )}

      {searched && (
        <p className="text-[10px] font-light text-muted-foreground/50">
          {loading
            ? "Searching Asher Archives…"
            : pillar === "lost"
              ? `${wayback.length} dead-on-web items recovered from ${total.toLocaleString()} archived snapshots`
              : pillar === "evolution"
                ? `${total.toLocaleString()} total records spanning ${DECADES.length} decades`
                : `${docs.length} shown of ${total.toLocaleString()} total matches`}
        </p>
      )}

      {error && <div className="text-[11px] text-destructive">{error}</div>}

      {loading && (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-xl border border-border/10 bg-card/20 animate-pulse" />)}
        </div>
      )}

      {/* Historical results */}
      {!loading && pillar === "historical" && docs.length > 0 && (
        <div className="space-y-2">{docs.map(renderDoc)}</div>
      )}

      {/* Lost Knowledge results */}
      {!loading && pillar === "lost" && wayback.length > 0 && (
        <div className="space-y-2">
          {wayback.map((h) => {
            const wb = `https://web.archive.org/web/${h.timestamp}/${h.original}`;
            return (
              <div key={h.timestamp + h.digest} className="rounded-xl border border-border/20 bg-card/30 px-3 py-2.5">
                <div className="flex items-start gap-2.5">
                  <Ghost className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-light text-foreground truncate">{h.original}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Snapshot · {fmtTs(h.timestamp)} · {h.mimetype} · status {h.statuscode} · DELETED FROM LIVE WEB
                    </p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <a href={wb} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-accent/80 hover:text-accent">
                        <ExternalLink className="h-3 w-3" /> Recover snapshot
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Evolution Tracking results */}
      {!loading && pillar === "evolution" && evo.length > 0 && (
        <div className="space-y-3">
          {evo.map((b) => {
            const max = Math.max(...evo.map((x) => x.count), 1);
            const pct = Math.round((b.count / max) * 100);
            return (
              <div key={b.label} className="rounded-xl border border-border/20 bg-card/30 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-light text-foreground w-14">{b.label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-card/50 overflow-hidden">
                    <div className="h-full bg-accent/50" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground/70 w-16 text-right">{b.count.toLocaleString()}</span>
                </div>
                {b.top.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {b.top.slice(0, 5).map((d) => (
                      <li key={d.identifier} className="text-[11px] font-extralight text-muted-foreground/80 truncate">
                        <a href={`${IA}/details/${d.identifier}`} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                          • {d.title || d.identifier} {d.date ? <span className="text-muted-foreground/50">· {String(d.date).slice(0,10)}</span> : null}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && searched && !error &&
        ((pillar === "historical" && docs.length === 0) ||
         (pillar === "lost" && wayback.length === 0) ||
         (pillar === "evolution" && evo.length === 0)) && (
        <div className="text-center py-12">
          <Archive className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm font-extralight text-muted-foreground">No results matched.</p>
        </div>
      )}

      {previewing && (
        <>
          <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" onClick={() => setPreviewing(null)} />
          <div className="fixed inset-4 sm:inset-10 z-50 rounded-2xl border border-border/40 bg-card/95 backdrop-blur-2xl shadow-2xl flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
              <Play className="h-4 w-4 text-accent" />
              <p className="flex-1 text-xs font-light text-foreground truncate">{previewing.title || previewing.identifier}</p>
              <span className="text-[10px] text-muted-foreground/60">stream-only · cannot be downloaded</span>
              <button onClick={() => setPreviewing(null)} className="text-xs px-2 py-1 rounded-md hover:bg-foreground/10 text-muted-foreground hover:text-foreground">Close</button>
            </div>
            <iframe
              src={`${IA}/embed/${previewing.identifier}`}
              className="flex-1 w-full bg-black"
              allow="autoplay; fullscreen"
              allowFullScreen
              title={previewing.title || previewing.identifier}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default ArchivePanel;
