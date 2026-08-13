// LEAKS — direct browse of search.libraryofleaks.org (Aleph / DDoSecrets) only.
// Asher Dashboard / Zophiel Engine ONLY. No censorship, no filter, no rate limiting beyond Aleph itself.
// Bundles selected files + a manifest into a single ZIP for download.
import { useCallback, useState } from "react";
import { Search, Loader2, Download, FileText, ExternalLink, Mail, User, Building2, FolderOpen, FileArchive, Package, Plus, Check, BrainCircuit, Filter, Sparkles, X, FileSearch, Send, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isOwnerEmail } from "@/lib/adminEmail";
const ALEPH = "https://search.libraryofleaks.org/api/2";
const UI = "https://search.libraryofleaks.org";
const PROXY = `https://xpgxgzqbtrrrbtjcemci.supabase.co/functions/v1/asher-eyes-proxy?url=`;
const viaProxy = (u: string) => `${PROXY}${encodeURIComponent(u)}`;

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
  const { user } = useAuth();
  const isAdmin = isOwnerEmail(user?.email);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AlephResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, AlephResult>>({});
  const [zipping, setZipping] = useState(false);
  const [integrating, setIntegrating] = useState(false);
  // Filters removed — AI Intent Filter does the narrowing instead.

  // ── Intent Filter ────────────────────────────────────────────
  const [intent, setIntent] = useState("");
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentMatches, setIntentMatches] = useState<Record<string, { score: number; reason: string }> | null>(null);
  const INTENT_PRESETS = [
    "Data that improves coding knowledge",
    "Cybersecurity / exploit / vulnerability intelligence",
    "Internal emails revealing decisions or wrongdoing",
    "Financial records, contracts, or invoices",
    "Personal identifiers, credentials, or leaked PII",
  ];

  const runIntentFilter = async () => {
    if (!intent.trim() || !results.length) return;
    setIntentLoading(true);
    try {
      const payload = {
        intent: intent.trim(),
        items: results.map((r) => ({
          id: r.id,
          title: firstProp(r.properties, "title", "fileName", "name") || r.id,
          schema: r.schema,
          source: r.collection?.label,
          snippet: (r.highlight?.[0] || firstProp(r.properties, "summary", "description") || "")
            .replace(/<[^>]+>/g, "").slice(0, 280),
        })),
      };
      const { data, error: fnErr } = await supabase.functions.invoke("asher-eyes-intent", { body: payload });
      if (fnErr) throw fnErr;
      const map: Record<string, { score: number; reason: string }> = {};
      (data?.matches || []).forEach((m: any) => { if (m?.id) map[m.id] = { score: m.score ?? 0, reason: m.reason || "" }; });
      setIntentMatches(map);
      // Auto-select all matches so the user can ZIP/integrate them in one click
      const next: Record<string, AlephResult> = {};
      results.forEach((r) => { if (map[r.id]) next[r.id] = r; });
      setSelected(next);
      const n = Object.keys(map).length;
      if (n) toast.success(`${n} of ${results.length} match your intent — auto-selected`);
      else toast.info("No items matched that intent");
    } catch (e: any) {
      toast.error(e?.message || "Intent filter failed");
    } finally {
      setIntentLoading(false);
    }
  };

  const clearIntent = () => { setIntent(""); setIntentMatches(null); };

  // ── Dossier Side Panel ───────────────────────────────────────
  const [dossierOpen, setDossierOpen] = useState(false);
  const [dossierQ, setDossierQ] = useState("");
  const [dossierLoading, setDossierLoading] = useState(false);
  const [dossierThread, setDossierThread] = useState<Array<{ q: string; a: string; sources?: any[]; scraped?: number }>>([]);
  const DOSSIER_PRESETS = [
    "Is there anything about cybersecurity flaws in code or software I should look out for?",
    "Create a long, prompt-engineered checklist of what to find in code and look out for when scanning and debugging software.",
    "Summarize every leaked credential, API key, or secret found across these documents.",
    "What internal decisions, cover-ups, or wrongdoing are exposed here?",
    "Extract every named person, their role, and what they did.",
  ];

  const askDossier = async (q: string) => {
    const question = q.trim();
    if (!question) return;
    if (!results.length) { toast.error("Run a search first so the dossier has something to scrape."); return; }
    setDossierLoading(true);
    setDossierThread((t) => [...t, { q: question, a: "" }]);
    try {
      const pool = (intentMatches ? results.filter((r) => intentMatches[r.id]) : results).slice(0, 200);
      const payload = {
        question,
        items: pool.map((r) => ({
          id: r.id,
          title: firstProp(r.properties, "title", "fileName", "name") || r.id,
          schema: r.schema,
          source: r.collection?.label,
          ui: r.links?.ui,
          fileUrl: r.links?.file,
          snippet: (r.highlight?.[0] || firstProp(r.properties, "summary", "description") || "").replace(/<[^>]+>/g, "").slice(0, 400),
        })),
      };
      const { data, error: fnErr } = await supabase.functions.invoke("asher-eyes-dossier", { body: payload });
      if (fnErr) throw fnErr;
      setDossierThread((t) => {
        const copy = [...t];
        copy[copy.length - 1] = { q: question, a: data?.answer || "(no answer)", sources: data?.sources, scraped: data?.scraped };
        return copy;
      });
      setDossierQ("");
    } catch (e: any) {
      setDossierThread((t) => {
        const copy = [...t];
        copy[copy.length - 1] = { q: question, a: `**Error:** ${e?.message || "Dossier query failed"}` };
        return copy;
      });
    } finally { setDossierLoading(false); }
  };


  // Visible results = filtered + sorted by score when intent is active
  const visibleResults = intentMatches
    ? results.filter((r) => intentMatches[r.id]).sort((a, b) => (intentMatches[b.id]?.score ?? 0) - (intentMatches[a.id]?.score ?? 0))
    : results;

  const detectCategory = (title: string, body: string): "coding" | "general" => {
    const t = `${title}\n${body}`.toLowerCase();
    if (/\b(function|const |class |import |def |#include|public static|\.tsx?|\.py|\.js|\.go|\.rs|\.java|\.cpp|github\.com|stack ?overflow|npm |pip |cargo |sdk|api endpoint|regex|sql|terraform|kubernetes|docker)\b/.test(t)) return "coding";
    return "general";
  };

  const integrateIntoBrains = async () => {
    const items = Object.values(selected);
    if (!items.length || !isAdmin) return;
    setIntegrating(true);
    let ok = 0, fail = 0;
    try {
      for (const r of items) {
        try {
          const title = firstProp(r.properties, "title", "fileName", "name") || r.id;
          const ui = r.links?.ui || `${UI}/entities/${r.id}`;
          const fileUrl = r.links?.file;
          const body = (firstProp(r.properties, "bodyText") || firstProp(r.properties, "bodyHtml") || "")
            .replace(/<[^>]+>/g, " ");
          const highlights = (r.highlight || []).map((h) => h.replace(/<[^>]+>/g, "")).join("\n");
          const category = detectCategory(title, body);

          // Compose canonical text content for the brain
          const content = [
            `# ${title}`,
            `Schema: ${r.schema}`,
            `Source: ${r.collection?.label || ""} ${r.collection?.publisher ? `(${r.collection.publisher})` : ""}`.trim(),
            `Source URL: ${ui}`,
            fileUrl ? `Original File: ${fileUrl}` : "",
            "",
            "## Highlights",
            highlights,
            "",
            "## Body",
            body.slice(0, 200_000),
          ].filter(Boolean).join("\n").replace(/\u0000/g, "");

          // Upload original file (if any) into asher-brains bucket via proxy
          let filePath: string | null = null;
          let fileSize = content.length;
          if (fileUrl && user?.id) {
            try {
              const fr = await fetch(viaProxy(fileUrl));
              if (fr.ok) {
                const blob = await fr.blob();
                const ext = (firstProp(r.properties, "fileName").match(/\.[a-z0-9]+$/i)?.[0]) || ".bin";
                const safe = title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || r.id;
                // P0: validate remote blob magic bytes / MIME before storing.
                // Otherwise an Aleph entry with mimeType: "text/html" could
                // store renderable HTML in our trusted brains bucket.
                const { validateFile } = await import("@/lib/file-security");
                const fileObj = new File([blob], `${safe}${ext}`, { type: blob.type || "application/octet-stream" });
                const v = await validateFile(fileObj);
                if (!v.valid) {
                  console.warn("[asher-eyes→brains] rejected remote blob:", v.error);
                } else {
                  const path = `${user.id}/asher-eyes/${Date.now()}_${safe}${ext}`;
                  const up = await supabase.storage.from("asher-brains").upload(path, fileObj, { upsert: false });
                  if (!up.error) { filePath = path; fileSize = blob.size; }
                }
              }
            } catch (e) { console.warn("[asher-eyes→brains] file upload failed", e); }
          }

          const { error: insErr } = await supabase.from("asher_brains").insert({
            name: title.slice(0, 200),
            description: `Asher Eyes · ${r.collection?.label || r.schema}`,
            category,
            content,
            file_name: firstProp(r.properties, "fileName") || `${title}.txt`,
            file_path: filePath,
            file_size: fileSize,
            uploaded_by: user?.id,
            is_active: true,
          });
          if (insErr) { fail++; console.error("[asher-eyes→brains] insert failed", insErr); }
          else ok++;
        } catch (e) { fail++; console.error(e); }
      }
      toast.success(`Integrated ${ok} item${ok === 1 ? "" : "s"} into ASHER Brains${fail ? ` (${fail} failed)` : ""}`);
      setSelected({});
    } finally { setIntegrating(false); }
  };

  const run = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true); setError(null); setSearched(true); setResults([]); setTotal(0); setIntentMatches(null);
    try {
      // Query all Aleph schemata in parallel, merge results (API requires a schema param)
      const allSchemaResults: AlephResult[] = [];
      const schemaFetches = SCHEMATA.map(async (schema) => {
        const params = new URLSearchParams();
        params.set("q", q.trim());
        params.set("limit", "15");
        params.set("highlight", "true");
        params.set("highlight_count", "2");
        params.append("filter:schemata", schema);
        const target = `${ALEPH}/search?${params.toString()}`;
        try {
          let r = await fetch(target, { headers: { Accept: "application/json" } }).catch(() => null as any);
          if (!r || !r.ok) r = await fetch(viaProxy(target));
          if (!r.ok) return [];
          const j = await r.json();
          return (j?.results || []) as AlephResult[];
        } catch { return []; }
      });

      // Internet Archive query (parallel)
      const iaParams = new URLSearchParams();
      iaParams.set("q", q.trim());
      ["identifier","title","description","creator","date","mediatype"].forEach((f) => iaParams.append("fl[]", f));
      iaParams.set("rows", "40"); iaParams.set("page", "1"); iaParams.set("output", "json"); iaParams.set("sort[]", "downloads desc");
      const iaUrl = `https://archive.org/advancedsearch.php?${iaParams.toString()}`;

      const [alephRes, iaRes] = await Promise.allSettled([
        (async () => {
          const schemaArrays = await Promise.all(schemaFetches);
          return schemaArrays.flat();
        })(),
        (async () => {
          const r = await fetch(iaUrl);
          if (!r.ok) throw new Error(`Asher Archives ${r.status}`);
          return r.json();
        })(),
      ]);

      const merged: AlephResult[] = [];
      let totalCount = 0;

      if (alephRes.status === "fulfilled") {
        const items = alephRes.value as AlephResult[];
        // Deduplicate by id
        const seen = new Set<string>();
        for (const item of items) {
          if (!seen.has(item.id)) { seen.add(item.id); merged.push(item); }
        }
        totalCount += merged.length;
      }
      if (iaRes.status === "fulfilled") {
        const docs = iaRes.value?.response?.docs ?? [];
        const iaTotal = iaRes.value?.response?.numFound ?? docs.length;
        totalCount += iaTotal;
        for (const d of docs) {
          const mt = String(d.mediatype || "texts");
          const schema = mt === "movies" ? "Pages" : mt === "audio" ? "PlainText" : mt === "image" ? "Pages" : "Document";
          const desc = Array.isArray(d.description) ? d.description.join(" ") : (d.description || "");
          const creator = Array.isArray(d.creator) ? d.creator.join(", ") : (d.creator || "");
          merged.push({
            id: `ia:${d.identifier}`,
            schema,
            properties: { title: [d.title || d.identifier], description: [desc], author: [creator], date: [d.date || ""] },
            collection: { label: `Asher Archives · ${mt}`, publisher: "Asher Archives" },
            links: {
              ui: `https://archive.org/details/${d.identifier}`,
              file: mt === "texts" ? `https://archive.org/download/${d.identifier}/${d.identifier}_djvu.txt` : undefined,
            },
            highlight: desc ? [desc.slice(0, 280)] : [],
          });
        }
      }

      setResults(merged);
      setTotal(totalCount);
      if (alephRes.status === "rejected" && iaRes.status === "rejected") {
        setError("Asher Archives lookup failed");
      }
    } catch (e: any) {
      setError(e?.message || "Search failed");
    } finally { setLoading(false); }
  }, []);

  const toggleSel = (r: AlephResult) => {
    setSelected((s) => {
      const n = { ...s };
      if (n[r.id]) delete n[r.id]; else n[r.id] = r;
      return n;
    });
  };

  const exportZip = async () => {
    // If nothing selected, bundle every visible result automatically.
    const items = Object.values(selected).length ? Object.values(selected) : results;
    if (!items.length) { toast.error("Run a search first"); return; }
    setZipping(true);
    toast.info(`Bundling ${items.length} item${items.length === 1 ? "" : "s"} into a ZIP…`);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const manifest: any[] = [];
      // Fetch all originals in parallel for speed
      const fetched = await Promise.all(items.map(async (r) => {
        const fileUrl = r.links?.file;
        if (!fileUrl) return null;
        try {
          const fr = await fetch(viaProxy(fileUrl));
          if (fr.ok) return await fr.blob();
        } catch (err) { console.warn("[asher-eyes] file fetch failed", err); }
        return null;
      }));

      items.forEach((r, i) => {
        const title = firstProp(r.properties, "title", "fileName", "name") || r.id;
        const safe = title.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 80) || r.id;
        const ui = r.links?.ui || `${UI}/entities/${r.id}`;
        const fileUrl = r.links?.file;
        const mime = firstProp(r.properties, "mimeType");
        const ext = (firstProp(r.properties, "fileName").match(/\.[a-z0-9]+$/i)?.[0]) || (mime?.includes("pdf") ? ".pdf" : "");
        const blob = fetched[i];
        let downloaded = false;
        if (blob) {
          zip.folder("files")!.file(`${safe}${ext || ""}`, blob);
          downloaded = true;
        }
        const text = [
          `# ${title}`,
          `Schema: ${r.schema}`,
          `ID: ${r.id}`,
          `Source: ${r.collection?.label || ""} ${r.collection?.publisher ? `(${r.collection.publisher})` : ""}`,
          `Source URL: ${ui}`,
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
      });
      zip.file("manifest.json", JSON.stringify({ query, exported_at: new Date().toISOString(), count: items.length, items: manifest }, null, 2));
      zip.file("README.txt", `ASHER EYES EXPORT\nQuery: ${query}\nItems: ${items.length}\nGenerated: ${new Date().toISOString()}\n\nSee manifest.json for index. /files contains downloaded originals where available; /text contains plaintext snapshots.\n`);
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
          <p className="text-xs font-light text-foreground">Asher Archives</p>
          <p className="text-[10px] font-extralight text-muted-foreground">
            Unified deep browse of the <span className="font-mono">Asher Eyes</span> leaks index plus the Asher Archives mirror — emails, documents, files, books, papers, audio &amp; video. No filter, no censorship. Bundle anything into a downloadable ZIP.
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
          placeholder="Search Asher Archives…"
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

      {/* Schema filters removed — AI Intent Filter narrows results instead. */}

      {/* Intent Filter — describe what you actually want, AI picks matching docs */}
      {searched && results.length > 0 && (
        <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <p className="text-[11px] font-light text-foreground">Ask Asher Eyes — only show what I actually need</p>
            {intentMatches && (
              <button onClick={clearIntent} className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" /> Clear filter
              </button>
            )}
          </div>
          <form
            onSubmit={(e) => { e.preventDefault(); runIntentFilter(); }}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            <input
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              placeholder='e.g. "Data that improves coding knowledge or cybersecurity intelligence"'
              className="flex-1 bg-transparent text-[12px] font-light text-foreground placeholder:text-muted-foreground/40 outline-none border-b border-border/20 pb-1 focus:border-accent/40"
            />
            <button
              type="submit"
              disabled={intentLoading || !intent.trim()}
              className="rounded-lg bg-accent/20 px-3 py-1 text-[11px] font-light text-accent hover:bg-accent/30 transition-colors disabled:opacity-30 inline-flex items-center gap-1.5"
            >
              {intentLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Filter
            </button>
          </form>
          <div className="flex flex-wrap gap-1.5">
            {INTENT_PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setIntent(p)}
                className="px-2 py-0.5 rounded-md text-[10px] font-extralight border border-border/30 bg-card/30 text-muted-foreground/70 hover:text-foreground hover:border-accent/40 transition-colors"
              >{p}</button>
            ))}
          </div>
          {intentMatches && (
            <p className="text-[10px] font-extralight text-accent/80">
              ◈ {Object.keys(intentMatches).length} of {results.length} match · auto-selected · ready to ZIP{isAdmin ? " or integrate into ASHER Brains" : ""}.
            </p>
          )}
        </div>
      )}

      {/* Bundle bar */}
      {searched && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[10px] font-light text-muted-foreground/50">
            {loading ? "Searching Asher Eyes…" : intentMatches ? `${visibleResults.length} matched of ${results.length} fetched` : `${results.length} shown of ${total.toLocaleString()} total matches`}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={selectAll} disabled={!results.length} className="text-[10px] px-2 py-1 rounded-md border border-border/30 bg-card/30 text-muted-foreground hover:text-foreground disabled:opacity-30">Select page</button>
            <button onClick={clearAll} disabled={!Object.keys(selected).length} className="text-[10px] px-2 py-1 rounded-md border border-border/30 bg-card/30 text-muted-foreground hover:text-foreground disabled:opacity-30">Clear ({Object.keys(selected).length})</button>
            <button
              onClick={() => setDossierOpen(true)}
              disabled={!results.length}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1 text-[11px] font-light tracking-wide text-accent hover:bg-accent/20 transition-colors disabled:opacity-30"
              title="Open Intelligence Dossier — scrapes the result set and answers questions in plain English"
            >
              <FileSearch className="h-3.5 w-3.5" /> Intel Dossier
            </button>
            <button
              onClick={exportZip}
              disabled={(!results.length && !Object.keys(selected).length) || zipping}
              className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/15 px-3 py-1 text-[11px] font-light tracking-wide text-accent hover:bg-accent/25 transition-colors disabled:opacity-30"
            >
              {zipping ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
              {Object.keys(selected).length
                ? `Export ZIP (${Object.keys(selected).length})`
                : `Download All as ZIP (${results.length})`}
            </button>
            {isAdmin && (
              <button
                onClick={integrateIntoBrains}
                disabled={!Object.keys(selected).length || integrating}
                title="Admin only — pushes selected items into ASHER Brains (shared with Aureon AI + all coding modules)"
                className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/40 bg-foreground/10 px-3 py-1 text-[11px] font-light tracking-wide text-foreground hover:bg-foreground/20 transition-colors disabled:opacity-30"
              >
                {integrating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BrainCircuit className="h-3.5 w-3.5" />}
                Integrate into ASHER ({Object.keys(selected).length})
              </button>
            )}
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
          {visibleResults.map((r) => {
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
                        <ExternalLink className="h-3 w-3" /> Open source
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
          <p className="text-sm font-extralight text-muted-foreground">No results matched. Try a broader term or enable more types above.</p>
        </div>
      )}

      {/* ── Intelligence Dossier slide-out ─────────────────────── */}
      {dossierOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm" onClick={() => setDossierOpen(false)} />
          <aside className="fixed top-0 right-0 z-50 h-full w-full sm:w-[520px] bg-card/95 backdrop-blur-2xl border-l border-border/40 shadow-2xl flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30">
              <BookOpen className="h-4 w-4 text-accent" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-light text-foreground">Intelligence Dossier</p>
                <p className="text-[10px] font-extralight text-muted-foreground/70 truncate">
                  Scraping {Math.min(intentMatches ? Object.keys(intentMatches).length : results.length, 200)} docs · jargon translated to plain English
                </p>
              </div>
              <button onClick={() => setDossierOpen(false)} className="p-1 rounded-md hover:bg-foreground/10 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
              {dossierThread.length === 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-light text-muted-foreground">Ask anything about the documents on screen. Try:</p>
                  {DOSSIER_PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => askDossier(p)}
                      className="w-full text-left text-[11px] font-extralight px-3 py-2 rounded-lg border border-border/30 bg-card/40 text-muted-foreground hover:text-foreground hover:border-accent/40 transition-colors"
                    >{p}</button>
                  ))}
                </div>
              )}
              {dossierThread.map((m, i) => (
                <div key={i} className="space-y-2">
                  <div className="rounded-lg bg-accent/10 border border-accent/30 px-3 py-2">
                    <p className="text-[11px] font-light text-accent">{m.q}</p>
                  </div>
                  <div className="rounded-lg bg-background/40 border border-border/30 px-3 py-2.5">
                    {m.a ? (
                      <div className="prose prose-sm prose-invert max-w-none text-[12px] font-extralight text-foreground/90 [&_a]:text-accent [&_a]:underline [&_strong]:text-foreground [&_strong]:font-light [&_h2]:text-foreground [&_h2]:font-light [&_h2]:text-[13px] [&_h3]:text-foreground [&_h3]:font-light [&_table]:text-[11px] [&_code]:text-accent [&_code]:bg-foreground/10 [&_code]:px-1 [&_code]:rounded">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            a: ({ node, ...p }) => <a {...p} target="_blank" rel="noopener noreferrer" />,
                          }}
                        >{m.a}</ReactMarkdown>
                        {m.scraped !== undefined && (
                          <p className="text-[9px] text-muted-foreground/50 mt-2">◈ scraped {m.scraped} docs · {m.sources?.length || 0} citations</p>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Scraping & analyzing…
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => { e.preventDefault(); askDossier(dossierQ); }}
              className="border-t border-border/30 p-3 flex items-center gap-2"
            >
              <input
                value={dossierQ}
                onChange={(e) => setDossierQ(e.target.value)}
                placeholder="Ask the dossier… (e.g. cybersecurity flaws to look out for)"
                className="flex-1 bg-background/50 border border-border/30 rounded-lg px-3 py-2 text-[12px] font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/40"
                disabled={dossierLoading}
              />
              <button
                type="submit"
                disabled={dossierLoading || !dossierQ.trim()}
                className="rounded-lg bg-accent/20 px-3 py-2 text-accent hover:bg-accent/30 transition-colors disabled:opacity-30"
              >
                {dossierLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </aside>
        </>
      )}
    </div>
  );
};

export default LeaksPanel;
