// ─────────────────────────────────────────────────────────────────────────────
// GHOST ENGINE — DOCUMENT INTELLIGENCE
//
// Narrative the Deep Time ladder was missing:
//
//   The old reader opened a URL, checked whether the MIME type looked like
//   markup, and if it did not it cancelled the body and walked away. That is a
//   page-dating tool wearing a document engine's coat. Everything an operator
//   actually wants from deep history lives in exactly the bodies it threw out:
//   a PDF's /Author, /Producer and /CreationDate; a Word file's core.xml
//   creator and revision; the `keywords` and `generator` a 2005 CMS stamped
//   into its head; a name sitting in a committed .py or .ts file; a shared
//   drive link's document title. And even for the pages it did read, it never
//   asked the one question that makes a hit evidence rather than a coincidence:
//   *do the operator's own words appear in this document, and in what
//   sentence?*
//
//   So this module reads the document rather than sniffing it. It classifies
//   the surface, pulls the metadata block appropriate to that surface, lifts
//   the declared keywords, and carves a context snippet around every selector
//   term it finds. Bytes are capped, MIME is honoured, and nothing is inferred:
//   a field appears only when a file carried it.
// ─────────────────────────────────────────────────────────────────────────────

import { parsePdfInfo, parseExif, parseHtmlHead, isPublicHttpUrl } from "./ghostMetadata.ts";
import { inflatePdfStreams } from "./ghostOrigin.ts";

const UA = "Asherin-GhostEngine/1.0 (+doc-intel)";
const MAX_TEXT = 900_000;
const MAX_BIN = 3_000_000; // 3 MB ceiling on binary documents

export type DocClass =
  | "webpage"
  | "pdf"
  | "office"
  | "code"
  | "data"
  | "image"
  | "share"
  | "open-index"
  | "other";

export interface TermHit {
  term: string;
  count: number;
  /** Where the term was found, strongest location first. */
  where: ("url" | "title" | "meta" | "keywords" | "body")[];
  /** The sentence the term sits inside — the proof, in the document's words. */
  snippet: string;
}

export interface DocRead {
  url: string;
  ok: boolean;
  status: number;
  mime: string;
  docClass: DocClass;
  /** Response headers kept for downstream date carving. */
  headers: Headers | null;
  /** Readable text of the document — inflated for PDFs, raw for markup/code. */
  text: string;
  /** Metadata fields the file itself carried, namespaced by origin. */
  meta: Record<string, string>;
  /** Keywords the document declared (meta keywords, JSON-LD, PDF /Keywords). */
  keywords: string[];
  bytes: number;
  error: string | null;
}

const SHARE_HOSTS = [
  "docs.google.com", "drive.google.com", "sheets.google.com", "slides.google.com",
  "dropbox.com", "1drv.ms", "onedrive.live.com", "sharepoint.com", "box.com",
  "notion.site", "notion.so", "icloud.com", "mega.nz", "wetransfer.com",
];

const CODE_EXT = /\.(py|ts|tsx|js|jsx|mjs|cjs|rb|go|rs|java|kt|cs|php|c|h|cpp|sh|sql|yml|yaml|toml|ini|env|ipynb)(?:$|\?)/i;
const DOC_EXT = /\.(pdf)(?:$|\?)/i;
const OFFICE_EXT = /\.(docx?|xlsx?|pptx?|odt|ods|odp|rtf)(?:$|\?)/i;
const DATA_EXT = /\.(csv|tsv|json|xml|txt|log|eml|msg|vcf)(?:$|\?)/i;
const IMG_EXT = /\.(jpe?g|png|tiff?|heic|webp)(?:$|\?)/i;

export function classifyDoc(url: string, mime: string): DocClass {
  const u = url.toLowerCase();
  const m = (mime || "").toLowerCase();
  if (DOC_EXT.test(u) || m.includes("application/pdf")) return "pdf";
  if (OFFICE_EXT.test(u) || /officedocument|msword|ms-excel|ms-powerpoint|opendocument/.test(m)) return "office";
  if (IMG_EXT.test(u) || m.startsWith("image/")) return "image";
  if (CODE_EXT.test(u) || /x-python|javascript|typescript|x-sh|x-yaml/.test(m)) return "code";
  if (DATA_EXT.test(u) || /csv|json|xml|plain/.test(m)) return "data";
  try {
    const host = new URL(u).hostname.replace(/^www\./, "");
    if (SHARE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) return "share";
  } catch { /* unparseable is not a class */ }
  if (/\/index of|intitle/.test(u)) return "open-index";
  if (m.includes("html") || m.includes("xhtml")) return "webpage";
  return m ? "other" : "webpage";
}

/** Strip markup down to prose so term matching sees words, not attributes. */
export function toProse(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Keywords the document declared about itself. */
function declaredKeywords(head: string, text: string, pdf: Record<string, string>): string[] {
  const out = new Set<string>();
  const add = (raw?: string | null) => {
    if (!raw) return;
    for (const part of raw.split(/[,;|]/)) {
      const k = part.replace(/\s+/g, " ").trim().toLowerCase();
      if (k.length >= 2 && k.length <= 60) out.add(k);
    }
  };
  for (const m of head.matchAll(/<meta[^>]+name=["'](?:keywords|news_keywords|article:tag|tags)["'][^>]+content=["']([^"']+)["']/gi)) add(m[1]);
  for (const m of text.matchAll(/"keywords"\s*:\s*"([^"]{2,300})"/gi)) add(m[1]);
  for (const m of text.matchAll(/"keywords"\s*:\s*\[([^\]]{2,600})\]/gi)) add(m[1].replace(/["']/g, ""));
  add(pdf["Keywords"]);
  add(pdf["Subject"]);
  return [...out].slice(0, 40);
}

/**
 * Locate the operator's terms inside the document and quote the sentence that
 * carries each one. A count without a sentence is a claim; a sentence is
 * evidence an operator can read and judge.
 */
export function matchTerms(
  url: string,
  title: string,
  meta: Record<string, string>,
  keywords: string[],
  prose: string,
  terms: string[],
): TermHit[] {
  const hits: TermHit[] = [];
  const urlL = url.toLowerCase();
  const titleL = (title || "").toLowerCase();
  const metaBlob = Object.values(meta).join(" ").toLowerCase();
  const kwBlob = keywords.join(" ").toLowerCase();
  const proseL = prose.toLowerCase();

  for (const raw of terms) {
    const t = (raw || "").toLowerCase().trim();
    if (t.length < 3) continue;
    const where: TermHit["where"] = [];
    if (urlL.includes(t)) where.push("url");
    if (titleL.includes(t)) where.push("title");
    if (metaBlob.includes(t)) where.push("meta");
    if (kwBlob.includes(t)) where.push("keywords");

    let count = 0;
    let snippet = "";
    let from = 0;
    for (;;) {
      const idx = proseL.indexOf(t, from);
      if (idx === -1) break;
      count++;
      if (!snippet) {
        const s = Math.max(0, idx - 110);
        const e = Math.min(prose.length, idx + t.length + 110);
        snippet = `${s > 0 ? "…" : ""}${prose.slice(s, e).trim()}${e < prose.length ? "…" : ""}`;
      }
      from = idx + t.length;
      if (count > 500) break; // a term repeated 500 times is boilerplate
    }
    if (count) where.push("body");
    if (!where.length) continue;
    hits.push({ term: raw, count, where, snippet: snippet.slice(0, 260) });
  }
  return hits.sort((a, b) => b.where.length - a.where.length || b.count - a.count);
}

async function timedFetch(url: string, init: RequestInit, ms: number): Promise<Response | null> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctl.signal, redirect: "follow" }); }
  catch { return null; } finally { clearTimeout(t); }
}

const latin1 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode(...b.subarray(i, i + 8192));
  return s;
};

/**
 * Read one document end-to-end: fetch, classify, pull metadata, lift keywords.
 * Never throws — an unreadable document is itself a finding and is returned
 * with `ok:false` and the reason attached.
 */
export async function readDocument(url: string, timeoutMs = 12_000): Promise<DocRead> {
  const base: DocRead = {
    url, ok: false, status: 0, mime: "", docClass: "other",
    headers: null, text: "", meta: {}, keywords: [], bytes: 0, error: null,
  };
  // SSRF guard — the engine reaches the public web only.
  if (!isPublicHttpUrl(url)) return { ...base, error: "non-public url refused" };

  const res = await timedFetch(url, {
    headers: { "user-agent": UA, accept: "text/html,application/pdf,application/xhtml+xml,*/*" },
  }, timeoutMs);
  if (!res) return { ...base, error: "unreachable or timed out" };

  const mime = (res.headers.get("content-type") || "").split(";")[0].trim();
  const docClass = classifyDoc(url, mime);
  const out: DocRead = { ...base, ok: res.ok, status: res.status, mime, docClass, headers: res.headers };

  try {
    if (docClass === "pdf") {
      const buf = new Uint8Array((await res.arrayBuffer()).slice(0, MAX_BIN));
      out.bytes = buf.length;
      const raw = latin1(buf);
      const info = parsePdfInfo(raw);
      for (const [k, v] of Object.entries(info)) out.meta[`pdf:${k}`] = v;
      // XMP packets carry the authoring trail even when /Info was scrubbed.
      const xmp = raw.match(/<x:xmpmeta[\s\S]{0,20000}?<\/x:xmpmeta>/)?.[0] ?? "";
      for (const [key, re] of [
        ["dc:creator", /<dc:creator>[\s\S]{0,200}?<rdf:li[^>]*>([^<]{1,200})</],
        ["dc:title", /<dc:title>[\s\S]{0,200}?<rdf:li[^>]*>([^<]{1,200})</],
        ["xmp:CreateDate", /<xmp:CreateDate>([^<]{1,60})</],
        ["xmp:ModifyDate", /<xmp:ModifyDate>([^<]{1,60})</],
        ["pdf:Producer", /<pdf:Producer>([^<]{1,200})</],
      ] as const) {
        const m = xmp.match(re);
        if (m?.[1]) out.meta[`xmp:${key}`] = m[1].trim().slice(0, 200);
      }
      const inflated = await inflatePdfStreams(buf).catch(() => "");
      out.text = (inflated || raw).slice(0, MAX_TEXT);
      out.keywords = declaredKeywords("", raw.slice(0, 40_000), info);
    } else if (docClass === "image") {
      const buf = new Uint8Array((await res.arrayBuffer()).slice(0, 512_000));
      out.bytes = buf.length;
      for (const [k, v] of Object.entries(parseExif(buf))) out.meta[`exif:${k}`] = String(v).slice(0, 200);
    } else if (docClass === "office") {
      // OOXML is a zip; without inflating the container the honest read is the
      // transport envelope plus whatever plain strings the package leaks.
      const buf = new Uint8Array((await res.arrayBuffer()).slice(0, MAX_BIN));
      out.bytes = buf.length;
      const raw = latin1(buf);
      for (const [key, re] of [
        ["creator", /<dc:creator>([^<]{1,200})</],
        ["lastModifiedBy", /<cp:lastModifiedBy>([^<]{1,200})</],
        ["created", /<dcterms:created[^>]*>([^<]{1,60})</],
        ["modified", /<dcterms:modified[^>]*>([^<]{1,60})</],
        ["application", /<Application>([^<]{1,120})</],
        ["company", /<Company>([^<]{1,160})</],
      ] as const) {
        const m = raw.match(re);
        if (m?.[1]) out.meta[`office:${key}`] = m[1].trim();
      }
      out.text = raw.replace(/[^\x20-\x7E\n]+/g, " ").slice(0, MAX_TEXT);
    } else {
      const body = (await res.text().catch(() => "")).slice(0, MAX_TEXT);
      out.bytes = body.length;
      out.text = body;
      const head = body.slice(0, 120_000);
      for (const [k, v] of Object.entries(parseHtmlHead(head))) out.meta[`html:${k}`] = v;
      const gen = head.match(/<meta[^>]+name=["']generator["'][^>]+content=["']([^"']+)["']/i)?.[1];
      if (gen) out.meta["html:generator"] = gen.slice(0, 160);
      out.keywords = declaredKeywords(head, body.slice(0, 60_000), {});
    }
  } catch (e) {
    out.error = e instanceof Error ? e.message : "read failed";
    await res.body?.cancel().catch(() => {});
  }
  return out;
}

/** Selector words worth hunting for inside a document body. */
const STOP = new Set([
  "the", "and", "for", "with", "from", "that", "this", "who", "was", "were", "are",
  "his", "her", "their", "into", "about", "there", "where", "when", "what",
]);
export function keywordTerms(selector: string, extra: string[] = []): string[] {
  const words = selector
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@.\-_ ]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
  const out = new Set<string>([...words, ...extra.filter(Boolean).map((e) => e.toLowerCase())]);
  // Adjacent pairs catch names and place names that only mean something joined.
  for (let i = 0; i < words.length - 1; i++) out.add(`${words[i]} ${words[i + 1]}`);
  return [...out].slice(0, 24);
}
