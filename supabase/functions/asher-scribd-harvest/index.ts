// ASHER SCRIBD — Knowledge Harvester (admin-only).
// Scrapes scribd.com (via DuckDuckGo site: queries + direct meta fetches) for
// a topic, synthesizes a plain-English knowledge dump via Gemini, and inserts
// it as an ACTIVE row into public.asher_brains so it feeds ASHER + AUREON
// brain context automatically.
//
// Mirrors asher-archives-harvest. GEMINI ONLY per ASHER DASHBOARD AI policy.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

let corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://aureonai.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Vary": "Origin",
};

const ADMIN_EMAIL = "ashernewtonx@gmail.com";

interface HarvestReq {
  topic: string;        // free-text e.g. "military strategy"
  category?: string;    // asher_brain_category — defaults to 'general'
  maxSources?: number;  // default 25
  brainName?: string;
  byok?: unknown;
}

interface ScribdHit { url: string; title: string; snippet: string; }

// ── Discover scribd.com documents across multiple search engines ───────────
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function extractScribdLinks(html: string, seen: Set<string>, out: ScribdHit[], max: number) {
  const linkRe = /href=["']([^"']*scribd\.com\/[^"']+)["'][^>]*>([\s\S]{0,300}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) && out.length < max) {
    let href = m[1];
    try {
      if (href.startsWith("/")) href = new URL(href, "https://duckduckgo.com").toString();
      const u = new URL(href);
      const uddg = u.searchParams.get("uddg") || u.searchParams.get("u");
      if (uddg) {
        try { href = decodeURIComponent(uddg); } catch { href = uddg; }
      }
    } catch { /* keep */ }
    if (!/^https?:\/\/[^/]*scribd\.com\//i.test(href)) continue;
    if (/scribd\.com\/(static|assets|images|favicon)/i.test(href)) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    const title = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
    out.push({ url: href, title: title || href, snippet: "" });
  }
}

async function searchEngine(url: string): Promise<string> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 9000);
    const r = await fetch(url, {
      signal: ctl.signal,
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
    });
    clearTimeout(t);
    if (!r.ok) return "";
    return await r.text();
  } catch { return ""; }
}

async function ddgScribd(topic: string, max: number): Promise<ScribdHit[]> {
  const q = encodeURIComponent(`site:scribd.com ${topic}`);
  const out: ScribdHit[] = [];
  const seen = new Set<string>();
  const endpoints = [
    `https://html.duckduckgo.com/html/?q=${q}`,
    `https://duckduckgo.com/html/?q=${q}`,
    `https://lite.duckduckgo.com/lite/?q=${q}`,
    `https://www.bing.com/search?q=${q}`,
    `https://www.bing.com/search?q=${q}&first=11`,
    `https://search.brave.com/search?q=${q}`,
    `https://www.mojeek.com/search?q=${q}`,
  ];
  for (const ep of endpoints) {
    if (out.length >= max) break;
    const html = await searchEngine(ep);
    if (!html) continue;
    extractScribdLinks(html, seen, out, max);
  }
  // Final fallback: scribd's own search page (no auth required for listings)
  if (out.length === 0) {
    const html = await searchEngine(`https://www.scribd.com/search?query=${encodeURIComponent(topic)}`);
    if (html) extractScribdLinks(html, seen, out, max);
  }
  return out;
}

// ── Fetch a scribd page and pull og:title / og:description / meta desc ─────
async function fetchScribdMeta(url: string): Promise<{ title: string; desc: string; raw: string }> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(url, {
      signal: ctl.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "text/html",
      },
    });
    clearTimeout(t);
    if (!r.ok) return { title: "", desc: "", raw: "" };
    const html = await r.text();
    const pick = (re: RegExp) => (html.match(re)?.[1] || "").trim();
    const title =
      pick(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const desc =
      pick(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
      pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
    // Pull a handful of visible <p> snippets as bonus signal.
    const paras = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
      .slice(0, 6)
      .map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      .filter((s) => s.length > 40);
    return { title, desc, raw: paras.join("\n").slice(0, 3000) };
  } catch { return { title: "", desc: "", raw: "" }; }
}

async function geminiSynthesize(topic: string, raw: string, apiKey: string): Promise<string> {
  const prompt = `You are ZOPHIEL — Asher Scribd knowledge synthesizer.

TOPIC: ${topic}
SOURCE: scribd.com document listings, titles, og-descriptions, and visible page text.
RAW SOURCE MATERIAL (deduplicated):
"""
${raw.slice(0, 60_000)}
"""

PRODUCE a single self-contained .txt knowledge dump that:
1. Opens with a 1-paragraph executive summary in plain English.
2. Lists the CORE CONCEPTS / VOCABULARY with one-line definitions.
3. Synthesizes WHAT THE SCRIBD CORPUS COLLECTIVELY SAYS about the topic — points of consensus, points of dispute, and notable outlier documents.
4. Names the major DOCUMENT TYPES present (academic paper, government memo, training manual, court filing, leaked dossier, etc.) and what each contributes.
5. Calls out OPEN QUESTIONS / GAPS the corpus does not answer.
6. Ends with "## Operator Briefing" — 5-10 bullets a non-expert can act on.

Hard rules:
- Plain text, no markdown headers heavier than ##. No emoji.
- Dumb down jargon: explain every acronym the first time.
- 4000-9000 words. Be dense, not padded.
- Cite source titles inline when claiming a specific fact: (src: <title>).
- Never reveal you are an AI. Never mention Gemini / Lovable / model names.`;

  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 32_000 },
      }),
    },
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

serve(async (req) => {
  corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Strict BYOK gate ──
  let body: HarvestReq;
  try {
    body = (await req.json()) as HarvestReq;
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const _gate = await import("../_shared/adminGate.ts");
    await _gate.resolveKey(req, body?.byok);
  } catch (e) {
    const _gate = await import("../_shared/adminGate.ts");
    return _gate.byokErrorResponse(e, corsHeaders);
  }

  try {
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP");
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(supaUrl, anon, { global: { headers: { Authorization: auth } } });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: corsHeaders });
    if (u.user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "admin only" }), { status: 403, headers: corsHeaders });
    }

    const topic = (body.topic || "").trim();
    if (!topic || topic.length < 3) {
      return new Response(JSON.stringify({ error: "topic required" }), { status: 400, headers: corsHeaders });
    }
    const category = body.category || "general";
    const maxSources = Math.max(5, Math.min(50, body.maxSources ?? 25));

    console.log(`[SCRIBD-HARVEST] topic="${topic}" cat=${category} max=${maxSources}`);

    // 1) Discover scribd documents
    const hits = await ddgScribd(topic, maxSources);
    if (hits.length === 0) {
      return new Response(JSON.stringify({ error: "no scribd documents discovered for topic" }), { status: 502, headers: corsHeaders });
    }

    // 2) Fetch meta + visible text for the top N
    const topN = hits.slice(0, Math.min(12, hits.length));
    const enriched = await Promise.all(topN.map(async (h) => {
      const meta = await fetchScribdMeta(h.url);
      return {
        url: h.url,
        title: meta.title || h.title,
        desc: meta.desc || h.snippet,
        body: meta.raw,
      };
    }));

    const corpus = enriched.map((d) =>
      `[SCRIBD] ${d.title}\nURL: ${d.url}\n${d.desc}\n${d.body}`
    ).join("\n\n");

    const tail = hits.slice(topN.length).map((h) =>
      `[SCRIBD-LINK] ${h.title} — ${h.url}\n${h.snippet}`
    ).join("\n");

    const raw = `## SCRIBD CORPUS — ${hits.length} documents discovered for "${topic}"\n\n${corpus}\n\n## ADDITIONAL LINKS\n${tail}`;
    if (raw.trim().length < 500) {
      return new Response(JSON.stringify({ error: "insufficient source material harvested" }), { status: 502, headers: corsHeaders });
    }

    // 3) Synthesize via Gemini
    const synthesized = await geminiSynthesize(topic, raw, apiKey);
    if (!synthesized || synthesized.length < 800) {
      return new Response(JSON.stringify({ error: "synthesis failed", preview: synthesized?.slice(0, 500) }), { status: 502, headers: corsHeaders });
    }

    // 4) Insert into asher_brains as ACTIVE
    const admin = createClient(supaUrl, service);
    const stamp = new Date().toISOString().slice(0, 10);
    const safe = topic.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60);
    const fileName = `scribd_${safe}_${stamp}.txt`;
    const brainName = body.brainName || `Scribd — ${topic} (${stamp})`;

    const { data: row, error } = await admin
      .from("asher_brains")
      .insert({
        name: brainName,
        description: `Auto-harvested from scribd.com (${hits.length} documents). Feeds ASHER + AUREON brains.`,
        category,
        content: synthesized,
        file_name: fileName,
        file_size: synthesized.length,
        is_active: true,
        uploaded_by: u.user.id,
      })
      .select("id, name, file_name, file_size, category")
      .single();

    if (error) throw error;

    console.log(`[SCRIBD-HARVEST] OK brain=${row.id} bytes=${synthesized.length}`);
    return new Response(
      JSON.stringify({
        ok: true,
        brain: row,
        sources_used: hits.length,
        synthesized_chars: synthesized.length,
        file_name: fileName,
        content: synthesized,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[SCRIBD-HARVEST] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
