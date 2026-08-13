// asher-property-intel — CINEMATIC DOSSIER ENGINE
//
// One click on the map builds a living intelligence file:
//   1. Ownership Chain (beneficial owners, LLC unmasking)
//   2. Residents (occupancy, associates)
//   3. Thermal / Signature Analysis (AI-inferred activity signatures)
//   4. Temporal Changes (permit gaps, ghost construction flags)
//   5. Social Graph (relationship spider nodes + edges)
//   6. Financial Forensics (liens, tax, bankruptcy, distress score)
//   7. Interior Reconstruction (real listing photo URLs harvested)
//   8. Neighborhood Patterns (block-level clusters)
//   9. Prediction Engine (transaction probability + horizon)
//
// GEMINI-ONLY (per Asher Dashboard AI policy).

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { sourcesFor, siteFilter, parseJurisdiction } from "./jurisdictions.ts";

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

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";

async function fetchPage(url: string, timeoutMs = 5000): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!r.ok) return "";
    const txt = await r.text();
    return stripHtml(txt).slice(0, 6000);
  } catch { return ""; }
  finally { clearTimeout(t); }
}

async function fetchImageUrls(url: string, timeoutMs = 5000): Promise<string[]> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: controller.signal });
    if (!r.ok) return [];
    const html = await r.text();
    const urls = new Set<string>();
    const re = /<img[^>]+src=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/gi;
    let m;
    while ((m = re.exec(html)) !== null && urls.size < 12) {
      let u = m[1];
      if (u.startsWith("//")) u = "https:" + u;
      if (u.startsWith("http") && !/logo|sprite|icon|avatar|placeholder/i.test(u)) {
        urls.add(u);
      }
    }
    return [...urls].slice(0, 8);
  } catch { return []; }
  finally { clearTimeout(t); }
}

type Hit = { title: string; url: string; snippet: string };

async function ddgLite(query: string, n = 6): Promise<Hit[]> {
  try {
    const r = await fetch("https://lite.duckduckgo.com/lite/", {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
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
      headers: { "User-Agent": UA },
    });
    if (!r.ok) return [];
    const html = await r.text();
    const out: Hit[] = [];
    const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let m;
    while ((m = re.exec(html)) !== null && out.length < n) {
      let url = m[1];
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
      headers: { "User-Agent": UA },
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

// ── Primary channel: Zophiel search engine (30+ sources, credibility-ranked).
//    We call it internally over HTTP so property intel inherits every upgrade
//    Zophiel gets (SearXNG, Wayback, EDGAR, Wikipedia, Brave, etc.).
async function zophielSearch(query: string, authHeader: string, n = 6): Promise<Hit[]> {
  try {
    const base = Deno.env.get("SUPABASE_URL");
    if (!base) return [];
    const r = await fetch(`${base}/functions/v1/zophiel-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader || `Bearer ${Deno.env.get("SUPABASE_ANON_KEY") ?? ""}`,
        "apikey": Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      },
      body: JSON.stringify({ query, page: 1, mode: "web" }),
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return [];
    const j = await r.json().catch(() => null);
    const rows = Array.isArray(j?.results) ? j.results : [];
    const out: Hit[] = [];
    for (const row of rows) {
      if (!row?.url || row.onion) continue;
      out.push({ url: row.url, title: row.title || row.url, snippet: row.snippet || "" });
      if (out.length >= n) break;
    }
    return out;
  } catch { return []; }
}

async function multiSearch(query: string, authHeader: string, n = 6): Promise<Hit[]> {
  // Zophiel first (highest quality), then dumb-engine fallbacks for coverage.
  const [z, a, b, c] = await Promise.all([
    zophielSearch(query, authHeader, n),
    ddgLite(query, n),
    ddgHtml(query, n),
    bingSearch(query, n),
  ]);
  const seen = new Set<string>();
  const out: Hit[] = [];
  for (const arr of [z, a, b, c]) {
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
  const corsHeaders = getCorsHeaders(req);

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

    const body = await req.json().catch(() => ({} as any));
    const { address, lat, lng, entityName, byok, byokProvider, country: ctryIn, state: stIn, county: coIn } = body || {};
    if (!address && !entityName) {
      return new Response(JSON.stringify({ error: "address or entityName required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve Gemini API key:
    //  1. Admin (ashernewtonx / shepherdnewtonx / 28numberofmoney) → platform GEMINI_API_KEY.
    //  2. BYOK string (frontend sends byok as raw string) → use as Gemini key when provider is gemini or unspecified.
    //  3. BYOK object (shared shape) → pull .apiKey when provider === "gemini".
    //  4. Otherwise 402 BYOK_REQUIRED (this engine is Gemini-only by design).
    const isAdmin = ["ashernewtonx@gmail.com","shepherdnewtonx@gmail.com","28numberofmoney@gmail.com"]
      .includes(String(user.email || "").toLowerCase());

    let apiKey: string | null = null;
    if (typeof byok === "string" && byok.trim()) {
      const provider = String(byokProvider || "gemini").toLowerCase();
      if (provider === "gemini") apiKey = byok.trim();
    } else if (byok && typeof byok === "object") {
      const provider = String((byok as any).provider || "gemini").toLowerCase();
      const k = (byok as any).apiKey;
      if (provider === "gemini" && typeof k === "string" && k.trim()) apiKey = k.trim();
    }
    if (!apiKey && isAdmin) {
      apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP") || null;
    }
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: "BYOK_REQUIRED",
        message: "Cinematic Dossier requires a Gemini API key. Open the Intelligence Map BYOK panel and add your Gemini key.",
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── Parallel OSINT sweep across 6 investigation vectors ───
    const baseTarget = address || entityName;
    // Extract anchor tokens (street number, street name) so we can filter noise.
    const numMatch = String(baseTarget).match(/\b\d{1,6}\b/);
    const streetNumber = numMatch?.[0] || "";
    const streetTokens = String(baseTarget)
      .replace(/[",]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !/^(st|ave|rd|blvd|ln|dr|ct|way|pl|hwy|us|fl|ca|ny|tx)$/i.test(t))
      .slice(0, 6)
      .map((t) => t.toLowerCase());

    // ── Jurisdiction-aware source targeting ──
    // Prefer explicit country/state/county from the client (from reverse geocoding),
    // otherwise parse them out of the address string.
    const parsed = parseJurisdiction(String(baseTarget));
    const country = String(ctryIn || parsed.country || "US").toUpperCase();
    const state = String(stIn || parsed.state || "").toUpperCase();
    const county = String(coIn || parsed.county || "").toUpperCase();
    const src = sourcesFor(country, state, county);

    const ownershipSites = siteFilter([...(src.ownership || [])]);
    const taxSites       = siteFilter([...(src.tax || []), ...(src.ownership || [])]);
    const permitSites    = siteFilter([...(src.permits || []), ...(src.ownership || [])]);
    const listingSites   = siteFilter([...(src.listings || [])]);

    const q = (s: string) => `"${baseTarget}" ${s}`;
    const queries = {
      // Registry-scoped queries go FIRST so the top hits are authoritative.
      ownership:   q(`${ownershipSites} (owner OR "owned by" OR LLC OR deed OR parcel)`),
      residents:   q(`resident OR occupant OR "lives at" OR voter`),
      permits:     q(`${permitSites} (permit OR construction OR renovation OR addition)`),
      financial:   q(`${taxSites} (lien OR foreclosure OR "tax delinquent" OR mortgage OR "property tax")`),
      listings:    q(`${listingSites}`),
      history:     q(`${ownershipSites} (sold OR "sale price" OR "deed transfer" OR history)`),
      // Broad fallback (unscoped) in case registries are thin for this parcel.
      assessor:    q(`assessor OR "property appraiser" OR parcel OR cadastre`),
    };

    const authHeader = req.headers.get("Authorization") ?? "";
    const [oHits, rHits, pHits, fHits, lHits, hHits, aHits] = await Promise.all([
      multiSearch(queries.ownership, authHeader, 5),
      multiSearch(queries.residents, authHeader, 4),
      multiSearch(queries.permits, authHeader, 4),
      multiSearch(queries.financial, authHeader, 4),
      multiSearch(queries.listings, authHeader, 5),
      multiSearch(queries.history, authHeader, 4),
      multiSearch(queries.assessor, authHeader, 4),
    ]);

    // Merge & dedupe for corpus
    const seen = new Set<string>();
    const merged: Array<Hit & { channel: string }> = [];
    const push = (arr: Hit[], channel: string) => {
      for (const h of arr) {
        if (!h.url || seen.has(h.url)) continue;
        seen.add(h.url); merged.push({ ...h, channel });
      }
    };
    push(lHits, "listings"); push(aHits, "assessor"); push(oHits, "ownership");
    push(hHits, "history"); push(fHits, "financial"); push(pHits, "permits");
    push(rHits, "residents");

    // Score by relevance: does the snippet mention the street number or a street token?
    const isRelevant = (text: string) => {
      const t = (text || "").toLowerCase();
      if (streetNumber && t.includes(streetNumber)) return true;
      let matched = 0;
      for (const tok of streetTokens) if (t.includes(tok)) matched++;
      return matched >= 2;
    };

    // Scrape top 14 in parallel — richer corpus = fewer "no info" dossiers.
    const top = merged.slice(0, 14);
    const pagesRaw = await Promise.all(top.map(async (h) => ({
      channel: h.channel, url: h.url, title: h.title, snippet: h.snippet,
      body: (await fetchPage(h.url, 5500)).slice(0, 2400),
    })));

    // Keep pages that mention the address in title/snippet/body; otherwise keep snippet-only
    // signal if the search engine considered it relevant enough to surface.
    const pages = pagesRaw.map((p) => {
      const blob = `${p.title} ${p.snippet} ${p.body}`;
      const relevant = isRelevant(blob);
      return { ...p, relevant };
    });

    // Harvest interior/property photos from listings (top 3 listing URLs)
    const listingUrls = lHits.slice(0, 3).map(h => h.url);
    const photoBatches = await Promise.all(listingUrls.map(u => fetchImageUrls(u, 4500)));
    const interiorPhotos: Array<{ url: string; source: string }> = [];
    photoBatches.forEach((imgs, i) => {
      for (const url of imgs) {
        if (interiorPhotos.length >= 8) break;
        interiorPhotos.push({ url, source: listingUrls[i] });
      }
    });

    // Build corpus: prefer scraped body, fall back to snippet, mark relevance.
    const usable = pages.filter((p) => (p.body && p.body.length > 60) || (p.snippet && p.snippet.length > 20));
    const corpus = usable
      .map((p, i) => `### [${p.channel.toUpperCase()}] Source ${i + 1}${p.relevant ? " (address-matched)" : " (tangential)"}: ${p.title}
URL: ${p.url}
Snippet: ${p.snippet || "(no snippet)"}
Content: ${p.body || "(no body — infer from snippet only)"}`)
      .join("\n\n");

    const prompt = `You are a geospatial intelligence analyst building a CINEMATIC DOSSIER on a property.
Use ONLY facts present in the sources below. Snippets alone are valid facts — extract every value visible (price, beds, baths, year, owner names, permit numbers, tax amounts, sale dates). When a field is not present in ANY source, set it to null with confidence 0. Never invent names, prices, or dates.
When sources are tangential (do not mention the exact address), you MAY still use them for neighborhood context, comparable sales, or municipal patterns — but flag them in citations.channel and lower the field's confidence accordingly. Do NOT return an empty dossier when snippets contain any usable signal.

TARGET:
- Address: ${address ?? "(unknown)"}
- Coordinates: ${lat ?? "?"}, ${lng ?? "?"}
- Entity: ${entityName ?? "(none)"}

MULTI-CHANNEL OSINT CORPUS (${usable.length} sources, ${pages.filter((p) => p.relevant).length} address-matched):
${corpus || "(no sources scraped — return skeleton with confidence 0 and summary explaining that public records are limited for this parcel)"}

Return STRICT JSON only with this exact schema:
{
  "summary": "2-3 sentence classified brief",
  "risk_score": 0-100,
  "risk_label": "GREEN|AMBER|RED",
  "risk_rationale": "one sentence",

  "ownership": {
    "record_owner": "string|null",
    "beneficial_owner": "string|null",
    "llc_chain": ["Entity A -> Entity B -> Natural Person"],
    "registered_agent": "string|null",
    "state_of_formation": "string|null",
    "confidence": 0-1
  },

  "residents": {
    "occupants": [{"name":"string","role":"owner|tenant|associate","source":"string"}],
    "known_associates": ["string"],
    "confidence": 0-1
  },

  "property_facts": {
    "type": "string|null",
    "year_built": "string|null",
    "size": "string|null",
    "beds": "string|null",
    "baths": "string|null",
    "value_estimate": "string|null",
    "last_sale_price": "string|null",
    "last_sale_date": "string|null"
  },

  "temporal_changes": [
    {"year":"YYYY","change":"e.g. Pool added","permit_status":"PERMITTED|UNPERMITTED|UNKNOWN","flagged":true|false}
  ],

  "financial_forensics": {
    "liens": ["string"],
    "tax_status": "current|delinquent|unknown",
    "bankruptcy_filings": ["string"],
    "anomaly_flags": ["e.g. Purchase 40% below assessed", "Shell owner on residential"],
    "distress_score": 0-100
  },

  "social_graph": {
    "nodes": [{"id":"unique","label":"Name or Entity","type":"person|llc|business|address"}],
    "edges": [{"from":"id","to":"id","relation":"owns|associated|neighbor|family|business_partner"}]
  },

  "neighborhood_patterns": [
    "e.g. 4 LLCs on same block registered same day",
    "e.g. Shared registered agent across 3 nearby parcels"
  ],

  "prediction": {
    "transaction_probability_12mo": 0-100,
    "horizon_months": 1-24,
    "signal_class": "distress_sale|flip|refinance|hold|inheritance|unknown",
    "reasoning": "one sentence, evidence-based"
  },

  "criminal_at_address": ["only offences a source explicitly ties to THIS address, with the source name; empty array when none published"],

  "citations": [{"label":"string","url":"string","channel":"ownership|residents|permits|financial|listings|history"}]
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;
    let resp: Response | null = null;
    let lastErr = "";
    for (let attempt = 1; attempt <= 3; attempt++) {
      resp = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.15, maxOutputTokens: 3000, responseMimeType: "application/json" },
        }),
      });
      if (resp.ok) break;
      lastErr = await resp.text();
      if (resp.status === 429 || resp.status === 503) {
        await new Promise((r) => setTimeout(r, 1200 * attempt));
        continue;
      }
      break;
    }
    if (!resp || !resp.ok) {
      return new Response(JSON.stringify({ error: `Gemini failed: ${resp?.status} ${lastErr.slice(0, 240)}` }), {
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

    // Attach harvested interior photos (real URLs, not AI-generated)
    intel.interior_photos = interiorPhotos;

    return new Response(JSON.stringify({
      success: true,
      intel,
      sources: pages.map((p) => ({ title: p.title, url: p.url, snippet: p.snippet, channel: p.channel, relevant: p.relevant })),
      jurisdiction: { country, state, county, registries: src },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
