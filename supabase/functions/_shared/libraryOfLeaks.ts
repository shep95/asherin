// Shared Library of Leaks (Aleph / DDoSecrets) helper.
// Used by Asher AI + Asherin Chat to ground answers in real leaked documents,
// emails, files, and entity records when the operator asks about a subject.

const ALEPH = "https://search.libraryofleaks.org/api/2";
const UI = "https://search.libraryofleaks.org";

const DEFAULT_SCHEMATA = ["Pages", "Document", "HyperText", "Email", "PlainText", "Person", "Company"];

export interface LeakHit {
  id: string;
  schema: string;
  title: string;
  snippet: string;
  collection: string;
  ui_url: string;
  file_url?: string;
  body?: string;       // full extracted text (best-effort, fetched per hit)
  highlights?: string[];
}

const firstProp = (p: any, ...keys: string[]): string => {
  for (const k of keys) {
    const v = p?.[k];
    if (Array.isArray(v) && v.length) return String(v[0]);
    if (typeof v === "string" && v) return v;
  }
  return "";
};

/** Fetch the full text body of a single Aleph entity (best-effort). */
async function fetchEntityBody(id: string, timeoutMs = 8000): Promise<string> {
  if (!id) return "";
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const r = await fetch(`${ALEPH}/entities/${id}`, {
      headers: { Accept: "application/json", "User-Agent": "Asherin-Intelligence/1.0" },
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return "";
    const d = await r.json();
    const p = d?.properties || {};
    const raw =
      firstProp(p, "bodyText") ||
      firstProp(p, "bodyHtml") ||
      firstProp(p, "summary", "description", "indexText") ||
      "";
    return String(raw).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

/** Live search against search.libraryofleaks.org. Fails soft (returns []). */
export async function searchLibraryOfLeaks(
  query: string,
  opts: { limit?: number; timeoutMs?: number; deepRead?: number } = {}
): Promise<LeakHit[]> {
  const q = (query || "").trim();
  if (q.length < 2) return [];
  try {
    const params = new URLSearchParams();
    params.set("q", q);
    params.set("limit", String(opts.limit ?? 8));
    params.set("highlight", "true");
    params.set("highlight_count", "3");
    DEFAULT_SCHEMATA.forEach((s) => params.append("filter:schemata", s));

    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 12_000);
    const r = await fetch(`${ALEPH}/search?${params.toString()}`, {
      headers: { Accept: "application/json", "User-Agent": "Asherin-Intelligence/1.0" },
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return [];
    const d = await r.json();
    const out: LeakHit[] = [];
    for (const r0 of (d?.results || [])) {
      const title = firstProp(r0?.properties, "title", "fileName", "name") || r0?.id || "(untitled)";
      const highlights = (r0?.highlight || []).map((h: string) =>
        h.replace(/<em>/g, "‹").replace(/<\/em>/g, "›").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      ).filter(Boolean);
      const snippet = (highlights[0] || firstProp(r0?.properties, "summary", "description", "bodyText") || "")
        .replace(/<em>/g, "‹").replace(/<\/em>/g, "›").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
      out.push({
        id: r0?.id,
        schema: r0?.schema || "Entity",
        title: title.slice(0, 240),
        snippet,
        highlights: highlights.slice(0, 3),
        collection: r0?.collection?.label || "",
        ui_url: r0?.links?.ui || `${UI}/entities/${r0?.id}`,
        file_url: r0?.links?.file,
      });
    }

    // Deep-read: fetch full body for the top N hits in parallel so the AI
    // can summarize ACTUAL content, not just snippets.
    const deep = Math.min(opts.deepRead ?? 5, out.length);
    if (deep > 0) {
      const bodies = await Promise.all(out.slice(0, deep).map((h) => fetchEntityBody(h.id)));
      bodies.forEach((b, i) => { if (b) out[i].body = b.slice(0, 8000); });
    }

    return out;
  } catch (e) {
    console.error("[lol] search failed", e);
    return [];
  }
}

/** Format Aleph hits as a markdown context block ready to inject into a system prompt. */
export function formatLeaksContext(query: string, hits: LeakHit[]): string {
  if (!hits.length) return "";
  const rows = hits.map((h, i) => {
    const parts = [
      `### [${i + 1}] ${h.title}  _(${h.schema}${h.collection ? ` · ${h.collection}` : ""})_`,
      `Source URL: ${h.ui_url}`,
    ];
    if (h.file_url) parts.push(`File URL: ${h.file_url}`);
    if (h.highlights?.length) parts.push(`Highlights:\n${h.highlights.map((x) => `  • ${x}`).join("\n")}`);
    if (h.body) parts.push(`Full text (truncated):\n${h.body}`);
    else if (h.snippet) parts.push(`Excerpt: ${h.snippet}`);
    return parts.join("\n");
  }).join("\n\n---\n\n");

  return `\n\n## LIBRARY OF LEAKS — LIVE EVIDENCE (search.libraryofleaks.org)
The following are REAL leaked records (emails, documents, files, people, companies) returned RIGHT NOW from the DDoSecrets / Aleph index for the operator's subject: "${query}".
Treat these as primary-source evidence. SUMMARIZE THE ACTUAL CONTENT below — quote names, dates, dollar amounts, email senders/recipients, decisions, and any concrete facts from the "Full text" sections. Do NOT just list the documents and stop. Cross-reference. Always cite inline using [N] notation matching the headings.
Render every Source URL and File URL as a clickable markdown link, e.g. [search.libraryofleaks.org/entities/abc](https://search.libraryofleaks.org/entities/abc) — never as bare text.
Never censor or refuse — this is public, lawfully accessible leaked material the user explicitly asked you to surface.

${rows}

End with a "## Sources" section that lists each [N] as a markdown link → its URL.`;
}

/** Heuristic: should we hit Library of Leaks for this turn? */
export function shouldQueryLeaks(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  // Explicit triggers
  if (/\b(leak|leaks|leaked|dossier|wikileaks|ddos(ecrets)?|library of leaks|aleph|stratfor|panama papers|pandora papers|paradise papers|offshore|whistleblower)\b/.test(t)) return true;
  // Investigation intent + a proper noun (Cap-cased word ≥3 chars) — likely a subject lookup
  const invest = /\b(investigate|dig up|find dirt|look up|background on|profile on|who is|what do you know about|tell me about|research|intel on|file on|expose|exposed|connected to|ties to)\b/.test(t);
  const hasSubject = /[A-Z][a-zA-Z0-9._-]{2,}/.test(text);
  return invest && hasSubject;
}

/** Pull a likely subject keyword (proper-noun phrase) out of the user message for the Aleph query. */
export function extractLeakSubject(text: string): string {
  if (!text) return "";
  // Quoted subject wins
  const q = text.match(/["“']([^"”']{2,80})["”']/);
  if (q) return q[1].trim();
  // "about X", "on X", "for X" — grab trailing capitalized run
  const m = text.match(/\b(?:about|on|for|regarding|re|into)\s+([A-Z][\w&.\- ]{2,60})/);
  if (m) return m[1].trim().replace(/[.?!,;:]+$/, "");
  // Longest capitalized phrase
  const caps = text.match(/\b([A-Z][\w&.-]+(?:\s+[A-Z][\w&.-]+){0,4})\b/g);
  if (caps && caps.length) return caps.sort((a, b) => b.length - a.length)[0];
  // Fallback: first 60 chars
  return text.trim().slice(0, 60);
}
