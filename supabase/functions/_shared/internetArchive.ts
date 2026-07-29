// Shared Internet Archive (archive.org) helper.
// Used by Asher AI + Aureon Chat + Asher Archives to ground answers in real
// archived books, web pages, audio, video, and software.
//
// Public API — no auth required. Fails soft (returns []).

const IA_BASE = "https://archive.org";
const IA_SEARCH = `${IA_BASE}/advancedsearch.php`;

export type IaMediaType = "texts" | "movies" | "audio" | "image" | "software" | "web" | "data" | "etree" | "collection";

export interface IaHit {
  id: string;                 // archive.org identifier
  title: string;
  description: string;
  creator: string;
  date: string;
  mediatype: IaMediaType | string;
  details_url: string;        // https://archive.org/details/<id>
  thumbnail: string;          // https://archive.org/services/img/<id>
  embed_url?: string;         // for videos / audio (no download)
  download_url?: string;      // best-effort full-text download for `texts`
  body?: string;              // optional extracted text (deepRead)
}

const TEXT_FIELDS = ["identifier", "title", "description", "creator", "date", "mediatype"];

export async function searchArchive(
  query: string,
  opts: { limit?: number; mediatypes?: IaMediaType[]; deepRead?: number; timeoutMs?: number } = {}
): Promise<IaHit[]> {
  const q = (query || "").trim();
  if (q.length < 2) return [];
  try {
    const mt = opts.mediatypes && opts.mediatypes.length
      ? `(${opts.mediatypes.map((m) => `mediatype:${m}`).join(" OR ")})`
      : "";
    const fullQ = mt ? `(${q}) AND ${mt}` : q;
    const params = new URLSearchParams();
    params.set("q", fullQ);
    TEXT_FIELDS.forEach((f) => params.append("fl[]", f));
    params.set("rows", String(opts.limit ?? 25));
    params.set("page", "1");
    params.set("output", "json");
    params.set("sort[]", "downloads desc");

    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 12_000);
    const r = await fetch(`${IA_SEARCH}?${params.toString()}`, {
      headers: { Accept: "application/json", "User-Agent": "Aureon-Intelligence/1.0" },
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return [];
    const j = await r.json();
    const docs: any[] = j?.response?.docs || [];
    const out: IaHit[] = docs.map((d) => {
      const id = String(d.identifier || "");
      const mediatype = String(d.mediatype || "texts");
      const isAV = mediatype === "movies" || mediatype === "audio" || mediatype === "etree";
      return {
        id,
        title: String(d.title || id).slice(0, 240),
        description: String(d.description || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 600),
        creator: Array.isArray(d.creator) ? d.creator.join(", ") : String(d.creator || ""),
        date: String(d.date || ""),
        mediatype,
        details_url: `${IA_BASE}/details/${id}`,
        thumbnail: `${IA_BASE}/services/img/${id}`,
        embed_url: isAV ? `${IA_BASE}/embed/${id}` : undefined,
        download_url: mediatype === "texts" ? `${IA_BASE}/stream/${id}/${id}_djvu.txt` : undefined,
      };
    });

    // Deep-read full text for top N text items
    const deep = Math.min(opts.deepRead ?? 3, out.length);
    if (deep > 0) {
      await Promise.all(out.slice(0, deep).map(async (h) => {
        if (h.mediatype !== "texts") return;
        try {
          const ctl2 = new AbortController();
          const t2 = setTimeout(() => ctl2.abort(), 8000);
          const tr = await fetch(`${IA_BASE}/download/${h.id}/${h.id}_djvu.txt`, {
            headers: { "User-Agent": "Aureon-Intelligence/1.0" }, signal: ctl2.signal,
          });
          clearTimeout(t2);
          if (tr.ok) {
            const txt = await tr.text();
            h.body = txt.replace(/\s+/g, " ").trim().slice(0, 8000);
          }
        } catch { /* soft fail */ }
      }));
    }
    return out;
  } catch (e) {
    console.error("[internet-archive] search failed", e);
    return [];
  }
}

/** Format IA hits as a markdown context block for system prompts. */
export function formatArchiveContext(query: string, hits: IaHit[]): string {
  if (!hits.length) return "";
  const rows = hits.map((h, i) => {
    const parts = [
      `### [A${i + 1}] ${h.title}  _(${h.mediatype}${h.creator ? ` · ${h.creator}` : ""}${h.date ? ` · ${h.date}` : ""})_`,
      `Source URL: ${h.details_url}`,
    ];
    if (h.embed_url) parts.push(`Embed (no download — stream only): ${h.embed_url}`);
    if (h.download_url) parts.push(`Full text: ${h.download_url}`);
    if (h.body) parts.push(`Excerpt:\n${h.body}`);
    else if (h.description) parts.push(`Description: ${h.description}`);
    return parts.join("\n");
  }).join("\n\n---\n\n");

  return `\n\n## INTERNET ARCHIVE — LIVE EVIDENCE (archive.org)
The following are REAL items returned RIGHT NOW from archive.org for "${query}" — books, papers, web captures, audio, video, software.
Treat as primary-source evidence. Quote names, dates, and concrete facts. Cite inline as [A1], [A2]…
For video/audio items: tell the operator they can WATCH/LISTEN on archive.org but the file may not be downloadable.
Render every URL as a clickable markdown link.

${rows}

End with a "## Sources" section that lists each [AN] as a markdown link → its details_url.`;
}

/** Should we hit Internet Archive for this turn? */
export function shouldQueryArchive(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  if (/\b(archive\.org|internet archive|wayback|archived|old version|historical|public domain|out of print|original source|book about|paper on|documentary|footage|recording)\b/.test(t)) return true;
  // Investigation / research intent + capitalized subject
  const invest = /\b(research|history of|find|look up|background on|tell me about|book|paper|footage|video of|audio of|documentary|sources for)\b/.test(t);
  const hasSubject = /[A-Z][a-zA-Z0-9._-]{2,}/.test(text);
  return invest && hasSubject;
}
