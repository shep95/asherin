// asher-property-intel — pulls live OSINT for a map-selected location by
// running a Zophiel-style web search (DDG), scraping top pages, and using
// Gemini to extract structured property intelligence.
//
// GEMINI-ONLY (per Asher Dashboard AI policy): admin GEMINI_API_KEY or user BYOK.
// No Lovable AI Gateway fallback.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts
let corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://aureonai.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Vary": "Origin",
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPage(url: string, timeoutMs = 5000): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!r.ok) return "";
    const txt = await r.text();
    return stripHtml(txt).slice(0, 6000);
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

type Hit = { title: string; url: string; snippet: string };

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function ddgLite(query: string, n = 6): Promise<Hit[]> {
  try {
    const r = await fetch("https://lite.duckduckgo.com/lite/", {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", "Accept": "text/html" },
      body: `q=${encodeURIComponent(query)}`,
    });
    if (!r.ok) return [];
    const html = await r.text();
    const out: Hit[] = [];
    const linkRe = /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const snipRe = /<td class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
    const links: Array<{ title: string; url: string }> = [];
    const snippets: string[] = [];
    let m;
    while ((m = linkRe.exec(html)) !== null) links.push({ url: m[1], title: stripHtml(m[2]) });
    while ((m = snipRe.exec(html)) !== null) snippets.push(stripHtml(m[1]));
    for (let i = 0; i < Math.min(links.length, n); i++) out.push({ ...links[i], snippet: snippets[i] || "" });
    return out;
  } catch { return []; }
}

async function ddgHtml(query: string, n = 6): Promise<Hit[]> {
  try {
    const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": UA, "Accept": "text/html" },
    });
    if (!r.ok) return [];
    const html = await r.text();
    const out: Hit[] = [];
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) !== null && out.length < n) {
      let url = m[1];
      // unwrap DDG redirect
      const u = url.match(/uddg=([^&]+)/);
      if (u) url = decodeURIComponent(u[1]);
      out.push({ url, title: stripHtml(m[2]), snippet: stripHtml(m[3]) });
    }
    return out;
  } catch { return []; }
}

async function bingSearch(query: string, n = 6): Promise<Hit[]> {
  try {
    const r = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": UA, "Accept": "text/html" },
    });
    if (!r.ok) return [];
    const html = await r.text();
    const out: Hit[] = [];
    const re = /<li class="b_algo"[\s\S]*?<h2><a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>)?/gi;
    let m;
    while ((m = re.exec(html)) !== null && out.length < n) {
      out.push({ url: m[1], title: stripHtml(m[2]), snippet: stripHtml(m[3] || "") });
    }
    return out;
  } catch { return []; }
}

async function wikiSearch(query: string, n = 3): Promise<Hit[]> {
  try {
    const r = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=${n}&srsearch=${encodeURIComponent(query)}&origin=*`,
      { headers: { "User-Agent": UA } },
    );
    if (!r.ok) return [];
    const j = await r.json();
    return (j?.query?.search || []).map((s: any) => ({
      title: s.title,
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title.replace(/ /g, "_"))}`,
      snippet: stripHtml(s.snippet || ""),
    }));
  } catch { return []; }
}

async function multiSearch(query: string, n = 6): Promise<Hit[]> {
  // run all in parallel; first non-empty wins, but merge unique
  const [a, b, c, d] = await Promise.all([
    ddgLite(query, n),
    ddgHtml(query, n),
    bingSearch(query, n),
    wikiSearch(query, 3),
  ]);
  const seen = new Set<string>();
  const out: Hit[] = [];
  for (const arr of [a, b, c, d]) {
    for (const h of arr) {
      if (!h.url || seen.has(h.url)) continue;
      seen.add(h.url);
      out.push(h);
      if (out.length >= n) return out;
    }
  }
  return out;
}

serve(async (req) => {
  corsHeaders = getCorsHeaders(req);

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  if (req.method !== 'OPTIONS') {
    try {
      const _b = await req.clone().json().catch(() => ({} as any));
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      await _gate.resolveKey(req, _byok);
    } catch (_e) {
      const _gate = await import('../_shared/adminGate.ts');
      return _gate.byokErrorResponse(_e, (globalThis as any).corsHeaders ?? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
    }
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: auth } = await supa.auth.getUser();
    const user = auth?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { address, lat, lng, entityName, byok } = await req.json();
    if (!address && !entityName) {
      return new Response(JSON.stringify({ error: "address or entityName required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GEMINI-ONLY: admin key or user BYOK
    const isAdmin = user.email === "ashernewtonx@gmail.com";
    const apiKey = (typeof byok === "string" && byok.trim())
      || (isAdmin ? Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP") : null);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Gemini API key required (BYOK or admin)" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const queries: string[] = [];
    if (entityName && address) queries.push(`"${entityName}" ${address}`);
    if (entityName) queries.push(`"${entityName}" owner operator history`);
    if (address) queries.push(`"${address}" property owner`);
    if (address) queries.push(`${address} site:wikipedia.org OR site:loopnet.com OR site:zillow.com OR site:realtor.com`);
    if (!queries.length && entityName) queries.push(entityName);

    const seen = new Set<string>();
    const merged: Hit[] = [];
    for (const q of queries) {
      const r = await multiSearch(q, 6);
      for (const hit of r) {
        if (seen.has(hit.url)) continue;
        seen.add(hit.url);
        merged.push(hit);
        if (merged.length >= 8) break;
      }
      if (merged.length >= 8) break;
    }
    console.log(`[asher-property-intel] queries=${queries.length} hits=${merged.length} for "${address ?? entityName}"`);

    // Scrape top 4 in parallel
    const top = merged.slice(0, 4);
    const pages = await Promise.all(top.map(async (h) => ({
      url: h.url, title: h.title, snippet: h.snippet, body: await fetchPage(h.url),
    })));

    const corpus = pages
      .map((p, i) => `### Source ${i + 1}: ${p.title}\nURL: ${p.url}\nSnippet: ${p.snippet}\nContent: ${p.body || "(empty)"}`)
      .join("\n\n");

    const prompt = `You are a geospatial intelligence analyst. Extract structured PROPERTY INTELLIGENCE for the location below using ONLY facts present in the sources. Do not invent values. If a field is unknown, omit it.

LOCATION:
- Address: ${address ?? "(unknown)"}
- Coordinates: ${lat ?? "?"}, ${lng ?? "?"}
- Entity (if any): ${entityName ?? "(none)"}

SOURCES (live web scrape):
${corpus || "(no sources scraped)"}

Return STRICT JSON only:
{
  "summary": "2-3 sentence intelligence brief about this property/site",
  "owner": "string|null",
  "operator": "string|null",
  "property_type": "string|null",
  "year_built": "string|null",
  "size": "string|null (sqft/acres/m²)",
  "value_estimate": "string|null",
  "tenants_or_occupants": ["..."],
  "history": ["bullet"],
  "notable_events": ["bullet"],
  "permits_or_filings": ["bullet"],
  "risks": ["bullet"],
  "citations": [{"label":"...","url":"..."}]
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    let resp: Response | null = null;
    let lastErr = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      resp = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: "application/json" },
        }),
      });
      if (resp.ok) break;
      lastErr = await resp.text();
      if (resp.status === 429 || resp.status === 503) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
      break;
    }
    if (!resp || !resp.ok) {
      return new Response(JSON.stringify({ error: `Gemini failed: ${resp?.status} ${lastErr.slice(0, 200)}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let intel: any = {};
    try { intel = JSON.parse(raw); } catch {
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) { try { intel = JSON.parse(m[0]); } catch {} }
    }

    return new Response(JSON.stringify({
      success: true,
      intel,
      sources: pages.map((p) => ({ title: p.title, url: p.url, snippet: p.snippet })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
