// ASHER SCRIBD — Knowledge Harvester (admin-only).
// Scrapes scribd.com (via Firecrawl search + scrape text extraction) for a
// topic, synthesizes a plain-English knowledge dump via Gemini, and inserts
// it as an ACTIVE row into public.asher_brains so it feeds ASHER + AUREON
// brain context automatically.
//
// Mirrors asher-archives-harvest. GEMINI ONLY per ASHER DASHBOARD AI policy.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";


import { isStaffEmail } from "../_shared/identityHash.ts";
const isAuthorizedAdminEmail = (e?: string | null): boolean => isStaffEmail(e);

interface HarvestReq {
  topic: string;        // free-text e.g. "military strategy"
  category?: string;    // asher_brain_category — defaults to 'general'
  maxSources?: number;  // default 25
  brainName?: string;
  byok?: unknown;
}

interface ScribdHit { url: string; title: string; snippet: string; text: string; }
interface ScribdDoc { url: string; title: string; desc: string; body: string; }

const FIRECRAWL_V2 = "https://api.firecrawl.dev/v2";

function cleanText(value: unknown, max = 10_000): string {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

function normalizeScribdUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    [...u.searchParams.keys()].forEach((key) => u.searchParams.delete(key));
    return u.toString();
  } catch {
    return url;
  }
}

async function firecrawlJson(path: string, body: Record<string, unknown>, timeoutMs = 18_000): Promise<any> {
  const fcKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!fcKey) throw new Error("FIRECRAWL_API_KEY not configured");
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${FIRECRAWL_V2}${path}`, {
      method: "POST",
      signal: ctl.signal,
      headers: {
        "Authorization": `Bearer ${fcKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const txt = await r.text();
    const json = txt ? JSON.parse(txt) : null;
    if (!r.ok) throw new Error(json?.error || txt || `Firecrawl ${r.status}`);
    return json;
  } finally {
    clearTimeout(t);
  }
}

// ── Discover scribd.com documents via Firecrawl search (reliable) ──────────
async function ddgScribd(topic: string, max: number): Promise<ScribdHit[]> {
  const out: ScribdHit[] = [];
  const seen = new Set<string>();

  const queries = [
    `site:scribd.com ${topic}`,
    `${topic} scribd document`,
    `scribd ${topic} pdf`,
  ];

  for (const q of queries) {
    if (out.length >= max) break;
    try {
      const j = await firecrawlJson("/search", {
        query: q,
        limit: Math.min(max - out.length, 25),
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: false,
          waitFor: 2500,
        },
      });
      const results: any[] = j?.data?.web || j?.data || j?.results || [];
      for (const it of results) {
        const url = normalizeScribdUrl(String(it?.url || it?.link || ""));
        if (!/^https?:\/\/[^/]*scribd\.com\//i.test(url)) continue;
        if (seen.has(url)) continue;
        seen.add(url);
        out.push({
          url,
          title: (it?.title || url).toString().slice(0, 200),
          snippet: (it?.description || it?.snippet || "").toString().slice(0, 400),
          text: cleanText(it?.markdown || it?.content || it?.data?.markdown, 12_000),
        });
        if (out.length >= max) break;
      }
    } catch (e) {
      console.warn("[SCRIBD-HARVEST] firecrawl error", e);
    }
  }
  return out;
}

// ── Read the available Scribd document text, not just page metadata ─────────
async function fetchScribdText(hit: ScribdHit): Promise<ScribdDoc> {
  if (hit.text && hit.text.length > 900) {
    return { url: hit.url, title: hit.title, desc: hit.snippet, body: hit.text };
  }

  try {
    const j = await firecrawlJson("/scrape", {
      url: hit.url,
      formats: ["markdown", "html"],
      onlyMainContent: false,
      waitFor: 3000,
    });
    const data = j?.data || j;
    const metadata = data?.metadata || {};
    const markdown = cleanText(data?.markdown, 16_000);
    const html = cleanText(data?.html, 8_000);
    const body = markdown || html || hit.text || hit.snippet;
    return {
      url: hit.url,
      title: cleanText(metadata?.title || hit.title, 240),
      desc: cleanText(metadata?.description || hit.snippet, 700),
      body,
    };
  } catch (e) {
    console.warn("[SCRIBD-HARVEST] scrape fallback", hit.url, e);
    return { url: hit.url, title: hit.title, desc: hit.snippet, body: hit.text || hit.snippet };
  }
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const ret: R[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      ret[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return ret;
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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-latest:generateContent?key=${apiKey}`,
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
  const corsHeaders = getCorsHeaders(req);

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
    if (!isAuthorizedAdminEmail(u.user.email)) {
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

    // 2) Fetch the available document text for every discovered source.
    const topN = hits.slice(0, Math.min(maxSources, hits.length));
    const enriched = await mapLimit(topN, 4, fetchScribdText);

    const corpus = enriched.map((d) =>
      `[SCRIBD] ${d.title}\nURL: ${d.url}\n${d.desc}\n${d.body}`
    ).join("\n\n");

    const tail = hits.slice(topN.length).map((h) =>
      `[SCRIBD-LINK] ${h.title} — ${h.url}\n${h.snippet}`
    ).join("\n");

    const documentsWithText = enriched.filter((d) => d.body.length > 900).length;
    const raw = `## SCRIBD CORPUS — ${hits.length} documents discovered for "${topic}"\n## DOCUMENTS WITH AVAILABLE TEXT — ${documentsWithText}\n\n${corpus}\n\n## ADDITIONAL LINKS\n${tail}`;
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
        documents_with_text: documentsWithText,
        source_text_chars: enriched.reduce((sum, d) => sum + d.body.length, 0),
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
