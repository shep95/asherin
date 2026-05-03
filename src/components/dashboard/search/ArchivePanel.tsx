// ARCHIVE — direct browse of archive.org (Internet Archive).
// Books, papers, web captures, audio, and VIDEO. Videos are streamed via the
// archive.org embed player — many cannot be downloaded but can be watched.
import { useCallback, useState } from "react";
import { Search, Loader2, ExternalLink, FileText, Film, Music, Archive, Image as ImageIcon, Cpu, Globe, Play } from "lucide-react";

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

interface IaDoc {
  identifier: string;
  title?: string;
  description?: string | string[];
  creator?: string | string[];
  date?: string;
  mediatype?: string;
}

const ArchivePanel = () => {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<MediaType[]>(["texts", "movies", "audio"]);
  const [docs, setDocs] = useState<IaDoc[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<IaDoc | null>(null);

  const run = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true); setError(null); setSearched(true); setDocs([]); setTotal(0);
    try {
      const mt = active.length ? `(${active.map((m) => `mediatype:${m}`).join(" OR ")})` : "";
      const fullQ = mt ? `(${q}) AND ${mt}` : q;
      const params = new URLSearchParams();
      params.set("q", fullQ);
      ["identifier","title","description","creator","date","mediatype"].forEach((f) => params.append("fl[]", f));
      params.set("rows", "50");
      params.set("page", "1");
      params.set("output", "json");
      params.set("sort[]", "downloads desc");
      const r = await fetch(`${IA}/advancedsearch.php?${params.toString()}`);
      if (!r.ok) throw new Error(`Archive ${r.status}`);
      const j = await r.json();
      setDocs(j?.response?.docs || []);
      setTotal(j?.response?.numFound || 0);
    } catch (e: any) {
      setError(e?.message || "Search failed");
    } finally { setLoading(false); }
  }, [active]);

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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-accent/30 bg-accent/5 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
        <Archive className="h-5 w-5 text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-light text-foreground">Internet Archive</p>
          <p className="text-[10px] font-extralight text-muted-foreground">
            Direct browse of <span className="font-mono">archive.org</span> — books, papers, web captures, audio, and video. Videos play in-page; some items are stream-only and cannot be downloaded.
          </p>
        </div>
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
          placeholder="Search archive.org (e.g. CIA reading room, Apollo 11 footage, Linux Kernel)…"
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

      {searched && (
        <p className="text-[10px] font-light text-muted-foreground/50">
          {loading ? "Searching archive.org…" : `${docs.length} shown of ${total.toLocaleString()} total matches`}
        </p>
      )}

      {error && <div className="text-[11px] text-destructive">{error}</div>}

      {loading && (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-xl border border-border/10 bg-card/20 animate-pulse" />)}
        </div>
      )}

      {!loading && docs.length > 0 && (
        <div className="space-y-2">
          {docs.map((d) => {
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
                        <ExternalLink className="h-3 w-3" /> Open on archive.org
                      </a>
                      {isAV && (
                        <button
                          onClick={() => setPreviewing(d)}
                          className="inline-flex items-center gap-1 text-[10px] text-accent/80 hover:text-accent"
                          title="Stream-only — cannot be downloaded"
                        >
                          <Play className="h-3 w-3" /> Watch / Listen (stream only)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && searched && docs.length === 0 && !error && (
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
