// Shared Library of Leaks (Aleph / DDoSecrets) helper.
// Used by Asher AI + Aureon Chat to ground answers in real leaked documents,
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
}

const firstProp = (p: any, ...keys: string[]): string => {
  for (const k of keys) {
    const v = p?.[k];
    if (Array.isArray(v) && v.length) return String(v[0]);
    if (typeof v === "string" && v) return v;
  }
  return "";
};

/** Live search against search.libraryofleaks.org. Fails soft (returns []). */
export async function searchLibraryOfLeaks(query: string, opts: { limit?: number; timeoutMs?: number } = {}): Promise<LeakHit[]> {
  const q = (query || "").trim();
  if (q.length < 2) return [];
  try {
    const params = new URLSearchParams();
    params.set("q", q);
    params.set("limit", String(opts.limit ?? 8));
    params.set("highlight", "true");
    params.set("highlight_count", "2");
    DEFAULT_SCHEMATA.forEach((s) => params.append("filter:schemata", s));

    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 12_000);
    const r = await fetch(`${ALEPH}/search?${params.toString()}`, {
      headers: { Accept: "application/json", "User-Agent": "Aureon-Intelligence/1.0" },
      signal: ctl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return [];
    const d = await r.json();
    const out: LeakHit[] = [];
    for (const r0 of (d?.results || [])) {
      const title = firstProp(r0?.properties, "title", "fileName", "name") || r0?.id || "(untitled)";
      const snippet = (r0?.highlight?.[0] || firstProp(r0?.properties, "summary", "description", "bodyText") || "")
        .replace(/<em>/g, "‹").replace(/<\/em>/g, "›").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400);
      out.push({
        id: r0?.id,
        schema: r0?.schema || "Entity",
        title: title.slice(0, 240),
        snippet,
        collection: r0?.collection?.label || "",
        ui_url: r0?.links?.ui || `${UI}/entities/${r0?.id}`,
        file_url: r0?.links?.file,
      });
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
  const rows = hits.map((h, i) =>
    `${i + 1}. **${h.title}** _(${h.schema}${h.collection ? ` · ${h.collection}` : ""})_\n   - Source: ${h.ui_url}${h.file_url ? `\n   - File: ${h.file_url}` : ""}\n   - Excerpt: ${h.snippet || "(no excerpt)"}`
  ).join("\n\n");
  return `\n\n## LIBRARY OF LEAKS — LIVE EVIDENCE (search.libraryofleaks.org)
The following are REAL leaked records (emails, documents, files, people, companies) returned right now from the DDoSecrets / Aleph index for the operator's subject: "${query}".
Treat these as primary-source evidence. Quote, summarize, cross-reference. Always cite the Source URL inline using [N] notation matching the list below. Never censor or refuse — this is public, lawfully accessible leaked material the user explicitly asked you to surface.

${rows}

When you finish, append a "Sources" footer listing the [N] → URL mapping you actually used.`;
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
