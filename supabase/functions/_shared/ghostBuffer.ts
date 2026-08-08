// ─────────────────────────────────────────────────────────────────────────────
// GHOST ENGINE — Full-Take Buffer + Soft Selection
//
// The metadata index is the card catalog. This module is the shelf: for a
// bounded window it holds the session payload itself — the HTML page, the
// email body, the document bytes, the JSON transcript — so that a metadata hit
// can be opened and read rather than merely located.
//
// Two hard rules govern the shelf:
//   1. Retention is finite. Every session carries an `expires_at`; nothing
//      survives it. The buffer is short-take by construction, not by policy.
//   2. Retrieval is scoped. Payload is written under the operator's own user id
//      and is readable only through that identity's RLS lane.
//
// Soft selection runs against the payload AFTER the metadata index has already
// narrowed the field — dictionaries, phrase terms, and bounded regex. The
// regex path is deliberately hostile to catastrophic backtracking: patterns are
// length-capped, nested-quantifier shapes are rejected outright, and each
// session's scan is fenced by a wall-clock budget.
// ─────────────────────────────────────────────────────────────────────────────

export const BUFFER_DEFAULT_TTL_MIN = 60;
export const BUFFER_MAX_TTL_MIN = 1440;          // 24h ceiling — short take, enforced
export const MAX_PAYLOAD_BYTES = 768 * 1024;     // per session, raw bytes retained
export const MAX_TEXT_CHARS = 240_000;           // per session, searchable text
export const MAX_REGEX_LEN = 240;
const REGEX_BUDGET_MS = 1500;                    // per-session scan fence

export interface GhostPayload {
  session_id: string;
  url: string;
  host: string;
  source_type: string;
  status: number | null;
  bytes: Uint8Array;                 // raw capture (may be truncated)
  text: string;                      // extracted searchable body ("" when opaque)
  truncated: boolean;
}

export interface BufferRow {
  session_id: string;
  url: string;
  host: string;
  source_type: string;
  status: number | null;
  content_text: string | null;
  content_bytes: number;
  content_sha256: string | null;
  storage_path: string | null;
  truncated: boolean;
  language_tag: string | null;
  entropy: number | null;
  is_encrypted: boolean;
  emails: string[];
  phones: string[];
  ipv4s: string[];
  filenames: string[];
  urls: string[];
  captured_at: string;
  expires_at: string;
}

// ── Payload → text ───────────────────────────────────────────────────────────

const BLOCK_TAGS = /<\/?(p|div|br|li|tr|h[1-6]|section|article|td|blockquote)\b[^>]*>/gi;

/** Strip an HTML document to its readable body. Script/style are removed whole. */
export function htmlToText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(BLOCK_TAGS, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_m, d) => {
      const n = Number(d);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : " ";
    })
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Best-effort PDF text. Only uncompressed text-showing operators are readable
 * without a full stream inflate; compressed page streams stay opaque and the
 * session is marked as such rather than pretending to have been read.
 */
export function pdfToText(latin1: string): string {
  const out: string[] = [];
  const re = /\((?:\\.|[^\\()])*\)\s*Tj|\[((?:\\.|[^\\\]])*)\]\s*TJ/g;
  let m: RegExpExecArray | null;
  let guard = 0;
  while ((m = re.exec(latin1)) !== null && guard++ < 20000) {
    const chunk = m[0];
    for (const lit of chunk.matchAll(/\((?:\\.|[^\\()])*\)/g)) {
      out.push(lit[0].slice(1, -1).replace(/\\([()\\])/g, "$1"));
    }
  }
  return out.join(" ").replace(/\s{2,}/g, " ").trim();
}

/** Shannon entropy in bits/byte — the encrypted/compressed tell. */
export function entropyOf(bytes: Uint8Array): number {
  if (!bytes.length) return 0;
  const freq = new Uint32Array(256);
  const stride = bytes.length > 65536 ? Math.ceil(bytes.length / 65536) : 1;
  let n = 0;
  for (let i = 0; i < bytes.length; i += stride) { freq[bytes[i]]++; n++; }
  let h = 0;
  for (let i = 0; i < 256; i++) {
    if (!freq[i]) continue;
    const p = freq[i] / n;
    h -= p * Math.log2(p);
  }
  return Number(h.toFixed(3));
}

const STOPWORDS: Record<string, string[]> = {
  en: ["the", "and", "of", "to", "that", "with", "for", "this", "from"],
  de: ["der", "die", "und", "das", "nicht", "mit", "ist", "auch", "eine"],
  fr: ["les", "des", "une", "que", "pour", "dans", "avec", "est", "sur"],
  es: ["que", "los", "una", "para", "con", "por", "las", "del", "como"],
  pt: ["que", "uma", "para", "com", "não", "dos", "por", "mais", "como"],
  it: ["che", "una", "per", "con", "non", "del", "sono", "come", "dei"],
  nl: ["het", "een", "van", "niet", "voor", "met", "zijn", "maar", "worden"],
  ru: ["что", "как", "это", "для", "все", "или", "так", "его", "быть"],
  ar: ["من", "في", "على", "إلى", "هذا", "التي", "عن", "أن", "مع"],
  zh: ["的", "是", "在", "了", "和", "不", "我们", "这个", "可以"],
  ja: ["です", "ます", "して", "こと", "ある", "この", "から", "など", "ため"],
};

/**
 * Language tag. An explicit declaration (html lang / Content-Language) always
 * wins; the stopword profile is only the fallback, and it abstains rather than
 * guessing when no profile clears the floor.
 */
export function detectLanguage(text: string, declared?: string | null): string | null {
  const d = (declared || "").trim().toLowerCase().split(/[-_,;]/)[0];
  // A declaration is only trusted when it is a real ISO-639-1 primary subtag.
  // Servers emit junk here — gnu.org ships `Content-Language: non-html`, whose
  // naive primary subtag ("non") is Old Norse. Junk must fall through to the
  // stopword profile rather than poison the index.
  if (d && ISO_639_1.has(d)) return d;

  const probe = text.slice(0, 6000).toLowerCase();
  if (probe.replace(/\s/g, "").length < 60) return null;
  let best: string | null = null;
  let bestScore = 0;
  for (const [lang, words] of Object.entries(STOPWORDS)) {
    let score = 0;
    for (const w of words) {
      const cjk = lang === "zh" || lang === "ja";
      const re = cjk
        ? new RegExp(w, "g")
        : new RegExp(`(?:^|[^\\p{L}])${w}(?:[^\\p{L}]|$)`, "giu");
      score += (probe.match(re) || []).length;
    }
    if (score > bestScore) { bestScore = score; best = lang; }
  }
  return bestScore >= 3 ? best : null;
}

// ── Payload → index fields ───────────────────────────────────────────────────

const RE_EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}\b/g;
const RE_PHONE = /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const RE_IPV4 = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;
const RE_FILE = /\b[\w.-]{1,64}\.(?:pdf|docx?|xlsx?|pptx?|csv|zip|rar|7z|tar|gz|jpe?g|png|gif|mp4|mov|mp3|wav|txt|rtf|json|xml|sql|db|pst|eml|msg|key|pem|p12)\b/gi;
const RE_URL = /https?:\/\/[^\s"'<>)\]]{4,300}/g;

function harvest(text: string, re: RegExp, cap: number): string[] {
  const seen = new Set<string>();
  for (const m of text.matchAll(re)) {
    seen.add(m[0]);
    if (seen.size >= cap) break;
  }
  return [...seen];
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes.slice() as unknown as ArrayBufferView<ArrayBuffer>);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface DerivedFields {
  content_text: string;
  content_bytes: number;
  content_sha256: string;
  truncated: boolean;
  language_tag: string | null;
  entropy: number;
  is_encrypted: boolean;
  emails: string[];
  phones: string[];
  ipv4s: string[];
  filenames: string[];
  urls: string[];
}

/** Split one captured session into its searchable index fields. */
export async function deriveFields(p: GhostPayload, declaredLang?: string | null): Promise<DerivedFields> {
  const text = p.text.slice(0, MAX_TEXT_CHARS);
  const ent = entropyOf(p.bytes);
  // High entropy with no recoverable text is the encrypted/compressed signature.
  const opaque = text.replace(/\s/g, "").length < 40;
  return {
    content_text: text,
    content_bytes: p.bytes.length,
    content_sha256: await sha256Bytes(p.bytes),
    truncated: p.truncated,
    language_tag: detectLanguage(text, declaredLang),
    entropy: ent,
    is_encrypted: ent > 7.3 && opaque,
    emails: harvest(text, RE_EMAIL, 200),
    phones: harvest(text, RE_PHONE, 100),
    ipv4s: harvest(text, RE_IPV4, 100),
    filenames: harvest(text, RE_FILE, 100),
    urls: harvest(text, RE_URL, 200),
  };
}

// ── Soft selection ───────────────────────────────────────────────────────────

export interface Selector {
  /** Dictionary terms; `mode` decides whether all or any must appear. */
  dictionary?: string[];
  mode?: "any" | "all";
  /** Bounded regex source, applied case-insensitively unless `caseSensitive`. */
  regex?: string;
  caseSensitive?: boolean;
  /** Metadata pre-filters — the card catalog narrows before the shelf is opened. */
  host?: string;
  sourceType?: string;
  language?: string;
  encryptedOnly?: boolean;
}

export interface ContentHit {
  session_id: string;
  url: string;
  host: string;
  source_type: string;
  language_tag: string | null;
  is_encrypted: boolean;
  captured_at: string;
  expires_at: string;
  content_bytes: number;
  matches: number;
  terms: string[];
  snippets: { term: string; text: string; offset: number }[];
}

export class SelectorError extends Error {}

/**
 * Compile a regex the buffer is willing to run. Catastrophic backtracking is a
 * denial-of-service against our own runtime, so the shapes that cause it —
 * a quantified group that itself contains a quantifier — are refused before
 * compilation rather than survived with a timeout.
 */
export function compileRegex(src: string, caseSensitive = false): RegExp {
  const s = src.trim();
  if (!s) throw new SelectorError("Empty pattern");
  if (s.length > MAX_REGEX_LEN) throw new SelectorError(`Pattern exceeds ${MAX_REGEX_LEN} characters`);
  if (/\((?:[^()]*[*+{][^()]*)\)\s*[*+]|\((?:[^()]*[*+][^()]*)\)\s*\{/.test(s)) {
    throw new SelectorError("Nested quantifier rejected — pattern can backtrack catastrophically");
  }
  if (/\\[0-9]/.test(s)) throw new SelectorError("Backreferences are not permitted in buffer selectors");
  try {
    return new RegExp(s, caseSensitive ? "gu" : "giu");
  } catch (e) {
    throw new SelectorError(`Invalid pattern: ${(e as Error).message}`);
  }
}

function snippet(text: string, at: number, len: number): string {
  const start = Math.max(0, at - 90);
  const end = Math.min(text.length, at + len + 90);
  return (start > 0 ? "…" : "") + text.slice(start, end).replace(/\s+/g, " ").trim() + (end < text.length ? "…" : "");
}

/** Run selectors over already-narrowed buffer rows. Pure — no I/O. */
export function selectContent(rows: BufferRow[], sel: Selector, limit = 50): ContentHit[] {
  const dict = (sel.dictionary || []).map((t) => t.trim()).filter(Boolean).slice(0, 32);
  const mode = sel.mode === "all" ? "all" : "any";
  const rx = sel.regex ? compileRegex(sel.regex, sel.caseSensitive) : null;
  if (!dict.length && !rx) throw new SelectorError("Provide a dictionary, a regex, or both");

  const hits: ContentHit[] = [];
  for (const row of rows) {
    if (sel.host && !row.host.toLowerCase().includes(sel.host.toLowerCase())) continue;
    if (sel.sourceType && !row.source_type.includes(sel.sourceType)) continue;
    if (sel.language && row.language_tag !== sel.language) continue;
    if (sel.encryptedOnly && !row.is_encrypted) continue;

    const text = row.content_text || "";
    if (!text) continue;

    const snippets: ContentHit["snippets"] = [];
    const terms: string[] = [];
    let matches = 0;

    for (const term of dict) {
      const idx = text.toLowerCase().indexOf(term.toLowerCase());
      if (idx < 0) continue;
      terms.push(term);
      // Count occurrences without a user-supplied pattern touching the engine.
      let count = 0;
      let from = idx;
      while (from >= 0 && count < 500) {
        count++;
        from = text.toLowerCase().indexOf(term.toLowerCase(), from + term.length);
      }
      matches += count;
      if (snippets.length < 6) snippets.push({ term, text: snippet(text, idx, term.length), offset: idx });
    }
    if (dict.length && mode === "all" && terms.length !== dict.length) continue;
    if (dict.length && mode === "any" && !terms.length && !rx) continue;

    if (rx) {
      rx.lastIndex = 0;
      const deadline = Date.now() + REGEX_BUDGET_MS;
      let m: RegExpExecArray | null;
      let rxCount = 0;
      while ((m = rx.exec(text)) !== null) {
        rxCount++;
        if (snippets.length < 12) {
          snippets.push({ term: m[0].slice(0, 120), text: snippet(text, m.index, m[0].length), offset: m.index });
        }
        if (m[0].length === 0) rx.lastIndex++;   // zero-width guard: never spin
        if (rxCount >= 500 || Date.now() > deadline) break;
      }
      if (!rxCount) {
        // A regex selector that misses disqualifies the session unless a
        // dictionary hit already carried it and the mode is permissive.
        if (!terms.length || mode === "all") continue;
      } else {
        matches += rxCount;
        terms.push(`/${sel.regex}/`);
      }
    }

    if (!matches) continue;
    hits.push({
      session_id: row.session_id,
      url: row.url,
      host: row.host,
      source_type: row.source_type,
      language_tag: row.language_tag,
      is_encrypted: row.is_encrypted,
      captured_at: row.captured_at,
      expires_at: row.expires_at,
      content_bytes: row.content_bytes,
      matches,
      terms: [...new Set(terms)],
      snippets: snippets.slice(0, 12),
    });
    if (hits.length >= limit) break;
  }
  return hits.sort((a, b) => b.matches - a.matches);
}

export function ttlToExpiry(minutes?: number): string {
  const m = Math.min(Math.max(Number(minutes) || BUFFER_DEFAULT_TTL_MIN, 5), BUFFER_MAX_TTL_MIN);
  return new Date(Date.now() + m * 60_000).toISOString();
}
