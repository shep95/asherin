// LEAKS — direct browse of search.libraryofleaks.org (Aleph / DDoSecrets) only.
// Asher Dashboard / Zophiel Engine ONLY. No censorship, no filter, no rate limiting beyond Aleph itself.
// Bundles selected files + a manifest into a single ZIP for download.
import { useCallback, useState } from "react";
import { Search, Loader2, Download, FileText, ExternalLink, Mail, User, Building2, FolderOpen, FileArchive, Package, Plus, Check } from "lucide-react";

const ALEPH = "https://search.libraryofleaks.org/api/2";
const UI = "https://search.libraryofleaks.org";

type Schema = "Pages" | "Document" | "HyperText" | "Email" | "PlainText" | "Folder" | "Person" | "Company" | "Table";
const SCHEMATA: Schema[] = ["Pages", "Document", "HyperText", "Email", "PlainText", "Folder", "Person", "Company", "Table"];

interface AlephResult {
  id: string;
  schema: string;
  properties: Record<string, any>;
  collection?: { label?: string; publisher?: string };
  links?: { ui?: string; file?: string; self?: string };
  highlight?: string[];
}

const SCHEMA_ICON: Record<string, any> = {
  Pages: FileText, Document: FileText, HyperText: FileText, PlainText: FileText,
  Email: Mail, Folder: FolderOpen, Person: User, Company: Building2, Table: FileArchive,
};

const firstProp = (p: any, ...keys: string[]): string => {
  for (const k of keys) {
    const v = p?.[k];
    if (Array.isArray(v) && v.length) return String(v[0]);
    if (typeof v === "string" && v) return v;
  }
  return "";
};

const LeaksPanel = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AlephResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, AlephResult>>({});
  const [zipping, setZipping] = useState(false);
  const [activeSchemata, setActiveSchemata] = useState<Schema[]>(["Pages", "Document", "HyperText", "Email", "PlainText", "Person", "Company"]);

  const run = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true); setError(null); setSearched(true); setResults([]); setTotal(0);
    try {
      const params = new URLSearchParams();
      params.set("q", q.trim());
      params.set("limit", "60");
      params.set("highlight", "true");
      params.set("highlight_count", "2");
      activeSchemata.forEach((s) => params.append("filter:schemata", s));
      const r = await fetch(`${ALEPH}/search?${params.toString()}`, { headers: { Accept: "application/json" } });
      if (!r.ok) throw new Error(`Aleph ${r.status}`);
      const d = await r.json();
      setResults(Array.isArray(d.results) ? d.results : []);
      setTotal(typeof d.total === "number" ? d.total : 0);
    } catch (e: any) {
      setError(e?.message || "Search failed");
    } finally { setLoading(false); }
  }, [activeSchemata]);

  const toggleSel = (r: AlephResult) => {
    setSelected((s) => {
      const n = { ...s };
      if (n[r.id]) delete n[r.id]; else n[r.id] = r;
      return n;
    });
  };

  const exportZip = async () => {
    const items = Object.values(selected);
    if (!items.length) return;
    setZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const manifest: any[] = [];
      for (const r of items) {
        const title = firstProp(r.properties, "title", "fileName", "name") || r.id;
        const safe = title.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 80) || r.id;
        const ui = r.links?.ui || `${UI}/entities/${r.id}`;
        const fileUrl = r.links?.file;
        const mime = firstProp(r.properties, "mimeType");
        const ext = (firstProp(r.properties, "fileName").match(/\.[a-z0-9]+$/i)?.[0]) || (mime?.includes("pdf") ? ".pdf" : "");
        let downloaded = false;
        if (fileUrl) {
          try {
            const fr = await fetch(fileUrl);
            if (fr.ok) {
              const blob = await fr.blob();
              zip.folder("files")!.file(`${safe}${ext || ""}`, blob);
              downloaded = true;
            }
          } catch { /* fall back to text */ }
        }
        // Always include a text/json snapshot
        const text = [
          `# ${title}`,
          `Schema: ${r.schema}`,
          `ID: ${r.id}`,
          `Source: ${r.collection?.label || ""} ${r.collection?.publisher ? `(${r.collection.publisher})` : ""}`,
          `Aleph URL: ${ui}`,
          fileUrl ? `File URL: ${fileUrl}` : "",
          "",
          "## Highlights",
          ...(r.highlight || []).map((h) => "- " + h.replace(/<[^>]+>/g, "")),
          "",
          "## Body",
          (firstProp(r.properties, "bodyText") || firstProp(r.properties, "bodyHtml") || "").replace(/<[^>]+>/g, " ").slice(0, 50_000),
        ].filter(Boolean).join("\n");
        zip.folder("text")!.file(`${safe}.txt`, text);
        manifest.push({ id: r.id, title, schema: r.schema, ui, file_downloaded: downloaded, source: r.collection?.label });
      }
      zip.file("manifest.json", JSON.stringify({ query, exported_at: new Date().toISOString(), count: items.length, items: manifest }, null, 2));
      zip.file("README.txt", `LIBRARY OF LEAKS EXPORT\nQuery: ${query}\nItems: ${items.length}\nGenerated: ${new Date().toISOString()}\n\nSee manifest.json for index. /files contains downloaded originals where available; /text contains plaintext snapshots.\n`);
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leaks-${query.replace(/[^a-z0-9]+/gi, "_").slice(0, 40) || "export"}-${Date.now()}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("[leaks] export failed", e);
      setError("ZIP export failed");
    } finally { setZipping(false); }
  };

  const selectAll = () => {
    const next: Record<string, AlephResult> = { ...selected };
    results.forEach((r) => { next[r.id] = r; });
    setSelected(next);
  };
  const clearAll = () => setSelected({});

  return (
    <div className="space-y-4">
      {/* Banner */}
      <div className="rounded-2xl border border-accent/30 bg-accent/5 backdrop-blur-xl px-4 py-3 flex items-center gap-3">
        <FileArchive className="h-5 w-5 text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-light text-foreground">Library of Leaks</p>
          <p className="text-[10px] font-extralight text-muted-foreground">
            Direct browse of <span className="font-mono">search.libraryofleaks.org</span> — leaked emails, documents, files, folders, people, companies. No filter, no censorship. Bundle selected items into a downloadable ZIP.
          </p>
        </div>
      </div>

      {/* Search */}
      <form
        onSubmit={(e) => { e.preventDefault(); run(query); }}
        className="flex items-center gap-2 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl px-4 py-3"
      >
        <Search className="h-5 w-5 text-muted-foreground/50 shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search leaks (e.g. Aureon AI, Stratfor, Palantir, an email address)…"
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

      {/* Schema filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/50 mr-1">Types</span>
        {SCHEMATA.map((s) => {
          const on = activeSchemata.includes(s);
          return (
            <button
              key={s}
              onClick={() => setActiveSchemata((cur) => on ? cur.filter((x) => x !== s) : [...cur, s])}
              className={`px-2 py-0.5 rounded-md text-[10px] font-light tracking-wide border transition-colors ${
                on ? "bg-accent/20 border-accent/40 text-accent" : "bg-card/30 border-border/30 text-muted-foreground/60 hover:text-foreground"
              }`}
            >{s}</button>
          );
        })}
      </div>

      {/* Bundle bar */}
      {searched && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[10px] font-light text-muted-foreground/50">
            {loading ? "Searching Aleph…" : `${results.length} shown of ${total.toLocaleString()} total matches`}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={selectAll} disabled={!results.length} className="text-[10px] px-2 py-1 rounded-md border border-border/30 bg-card/30 text-muted-foreground hover:text-foreground disabled:opacity-30">Select page</button>
            <button onClick={clearAll} disabled={!Object.keys(selected).length} className="text-[10px] px-2 py-1 rounded-md border border-border/30 bg-card/30 text-muted-foreground hover:text-foreground disabled:opacity-30">Clear ({Object.keys(selected).length})</button>
            <button
              onClick={exportZip}
              disabled={!Object.keys(selected).length || zipping}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-3 py-1 text-[11px] font-light tracking-wide text-accent hover:bg-accent/25 transition-colors disabled:opacity-30"
            >
              {zipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
              Export ZIP ({Object.keys(selected).length})
            </button>
          </div>
        </div>
      )}

      {error && <div className="text-[11px] text-destructive">{error}</div>}

      {/* Results */}
      {loading && (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-16 rounded-xl border border-border/10 bg-card/20 animate-pulse" />)}
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => {
            const Icon = SCHEMA_ICON[r.schema] || FileText;
            const title = firstProp(r.properties, "title", "fileName", "name") || r.id;
            const ui = r.links?.ui || `${UI}/entities/${r.id}`;
            const file = r.links?.file;
            const isSel = !!selected[r.id];
            const snippet = (r.highlight?.[0] || firstProp(r.properties, "summary", "description") || "")
              .replace(/<em>/g, "‹").replace(/<\/em>/g, "›").replace(/<[^>]+>/g, "");
            return (
              <div key={r.id} className={`rounded-xl border ${isSel ? "border-accent/40 bg-accent/5" : "border-border/20 bg-card/30"} px-3 py-2.5 transition-colors`}>
                <div className="flex items-start gap-2.5">
                  <button
                    onClick={() => toggleSel(r)}
                    className={`mt-0.5 h-5 w-5 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
                      isSel ? "bg-accent/30 border-accent/50 text-accent" : "border-border/40 text-muted-foreground/40 hover:text-foreground"
                    }`}
                    title={isSel ? "Remove from bundle" : "Add to bundle"}
                  >
                    {isSel ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  </button>
                  <Icon className="h-4 w-4 text-muted-foreground/60 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href={ui} target="_blank" rel="noopener noreferrer" className="text-[12px] font-light text-foreground hover:text-accent truncate">{title}</a>
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/50">{r.schema}</span>
                      {r.collection?.label && <span className="text-[9px] text-muted-foreground/40 truncate">· {r.collection.label}</span>}
                    </div>
                    {snippet && <p className="text-[11px] font-extralight text-muted-foreground/80 mt-1 line-clamp-2">{snippet}</p>}
                    <div className="flex items-center gap-3 mt-1.5">
                      <a href={ui} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground">
                        <ExternalLink className="h-3 w-3" /> Open in Aleph
                      </a>
                      {file && (
                        <a href={file} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-accent/70 hover:text-accent">
                          <Download className="h-3 w-3" /> Direct file
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && searched && results.length === 0 && !error && (
        <div className="text-center py-12">
          <FileArchive className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm font-extralight text-muted-foreground">No leaks matched. Try a broader term or enable more types above.</p>
        </div>
      )}
    </div>
  );
};

export default LeaksPanel;
