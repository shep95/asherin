// Same-cipher world matcher.
// Given { phrase, cipher, value }, harvests candidate phrases from Wikipedia
// (opensearch + related titles) and Datamuse (meaning-like + sound-like),
// computes the requested cipher on each candidate locally, and returns only
// those whose value matches. No provider-side arithmetic — all filtering is
// deterministic here, so the frontend can trust the returned rows blindly.
//
// Contract:
//   POST { phrase: string; cipher: "ordinal"|"reduction"|"reverse"|"chaldean"; value: number }
//   -> { matches: Array<{ phrase: string; source: "wikipedia"|"datamuse"; note?: string }>,
//        counts: { candidates: number; matched: number },
//        cipher, value }

// deno-lint-ignore-file no-explicit-any
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type CipherKey = "ordinal" | "reduction" | "reverse" | "chaldean";

const CHALDEAN: Record<string, number> = {
  a:1,i:1,j:1,q:1,y:1, b:2,k:2,r:2, c:3,g:3,l:3,s:3, d:4,m:4,t:4,
  e:5,h:5,n:5,x:5, u:6,v:6,w:6, o:7,z:7, f:8,p:8,
};
function ord(ch: string) { const c = ch.charCodeAt(0) - 96; return c >= 1 && c <= 26 ? c : 0; }
function fnFor(cipher: CipherKey): (ch: string) => number {
  switch (cipher) {
    case "ordinal": return ord;
    case "reduction": return (ch) => { const o = ord(ch); return o ? ((o - 1) % 9) + 1 : 0; };
    case "reverse": return (ch) => { const o = ord(ch); return o ? 27 - o : 0; };
    case "chaldean": return (ch) => CHALDEAN[ch] ?? 0;
  }
}
function normalize(s: string) { return (s || "").toLowerCase().replace(/[^a-z]/g, ""); }
function sumCipher(phrase: string, cipher: CipherKey): number {
  const fn = fnFor(cipher);
  let s = 0;
  for (const ch of normalize(phrase)) s += fn(ch);
  return s;
}

async function fetchJson(url: string, timeoutMs = 4000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Asherin-Gematria/1.0" } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; } finally { clearTimeout(t); }
}

async function wikipediaCandidates(phrase: string): Promise<string[]> {
  const q = encodeURIComponent(phrase.slice(0, 80));
  const [open, search] = await Promise.all([
    fetchJson(`https://en.wikipedia.org/w/api.php?action=opensearch&limit=50&format=json&origin=*&search=${q}`),
    fetchJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=50&format=json&origin=*&srsearch=${q}`),
  ]);
  const out: string[] = [];
  if (Array.isArray(open) && Array.isArray(open[1])) out.push(...open[1]);
  const hits = search?.query?.search;
  if (Array.isArray(hits)) for (const h of hits) if (h?.title) out.push(h.title);
  return out;
}

async function datamuseCandidates(phrase: string): Promise<string[]> {
  const q = encodeURIComponent(phrase.slice(0, 80));
  const [ml, sl, trg] = await Promise.all([
    fetchJson(`https://api.datamuse.com/words?ml=${q}&max=200`),
    fetchJson(`https://api.datamuse.com/words?sl=${q}&max=100`),
    fetchJson(`https://api.datamuse.com/words?rel_trg=${q}&max=100`),
  ]);
  const out: string[] = [];
  for (const set of [ml, sl, trg]) {
    if (Array.isArray(set)) for (const w of set) if (w?.word) out.push(w.word);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json();
    const phrase = String(body?.phrase ?? "").slice(0, 200);
    const cipher = String(body?.cipher ?? "") as CipherKey;
    const value = Number(body?.value);
    if (!phrase || !["ordinal","reduction","reverse","chaldean"].includes(cipher) || !Number.isFinite(value)) {
      return new Response(JSON.stringify({ error: "bad_request" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [wiki, datamuse] = await Promise.all([
      wikipediaCandidates(phrase),
      datamuseCandidates(phrase),
    ]);

    const seen = new Set<string>([normalize(phrase)]);
    const matches: Array<{ phrase: string; source: "wikipedia"|"datamuse" }> = [];
    let candidates = 0;

    const scan = (list: string[], source: "wikipedia"|"datamuse") => {
      for (const raw of list) {
        candidates++;
        const key = normalize(raw);
        if (!key || seen.has(key)) continue;
        if (sumCipher(raw, cipher) !== value) continue;
        seen.add(key);
        matches.push({ phrase: raw, source });
        if (matches.length >= 120) return true;
      }
      return false;
    };
    if (!scan(wiki, "wikipedia")) scan(datamuse, "datamuse");

    return new Response(JSON.stringify({
      cipher, value, matches,
      counts: { candidates, matched: matches.length },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: "internal", detail: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
