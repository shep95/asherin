// ASHER ARCHIVES — Knowledge Harvester (admin-only).
// Scrapes Internet Archive + live web for a domain, synthesizes a dumbed-down
// .txt knowledge dump via Gemini, and inserts it as an ACTIVE row into
// public.asher_brains so it feeds ASHER + AUREON brain context automatically.
//
// Per ASHER DASHBOARD AI policy: GEMINI ONLY (admin GEMINI_API_KEY). Never
// routes through Lovable AI Gateway.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

import { isStaffEmail } from "../_shared/identityHash.ts";
const isAuthorizedAdminEmail = (e?: string | null): boolean => isStaffEmail(e);
const IA = "https://archive.org";

interface HarvestReq {
  domain: string;        // free-text e.g. "modern cybersecurity"
  category?: string;     // asher_brain_category — defaults to 'general'
  yearsBack?: number;    // default 4
  maxSources?: number;   // default 25
  brainName?: string;    // optional override for the brain row name
}

async function searchIA(query: string, yearsBack: number, rows: number): Promise<any[]> {
  const yearFrom = new Date().getFullYear() - yearsBack;
  const q = `(${query}) AND date:[${yearFrom} TO 9999] AND (mediatype:texts OR mediatype:web)`;
  const u = new URL(`${IA}/advancedsearch.php`);
  u.searchParams.set("q", q);
  ["identifier", "title", "description", "creator", "date", "mediatype"].forEach((f) => u.searchParams.append("fl[]", f));
  u.searchParams.set("rows", String(rows));
  u.searchParams.set("output", "json");
  u.searchParams.set("sort[]", "downloads desc");
  const r = await fetch(u.toString(), { headers: { "User-Agent": "Asher-Archives/1.0" } });
  if (!r.ok) return [];
  const j = await r.json();
  return j?.response?.docs || [];
}

async function fetchIAText(id: string): Promise<string> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`${IA}/download/${id}/${id}_djvu.txt`, { signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) return "";
    const txt = await r.text();
    return txt.replace(/\s+/g, " ").trim().slice(0, 6000);
  } catch { return ""; }
}

async function liveWebSnippets(query: string): Promise<string> {
  // DuckDuckGo HTML — no API key, fine for harvesting headlines + snippets.
  try {
    const r = await fetch(`https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0 Asher-Archives/1.0" },
    });
    if (!r.ok) return "";
    const html = await r.text();
    const matches = html.match(/<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi) || [];
    return matches.slice(0, 15).map((m) => m.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).join("\n").slice(0, 8000);
  } catch { return ""; }
}

async function geminiSynthesize(domain: string, yearsBack: number, raw: string, apiKey: string): Promise<string> {
  const prompt = `You are ZOPHIEL — Asher Archives knowledge synthesizer.

DOMAIN: ${domain}
TIME WINDOW: last ${yearsBack} years through ${new Date().getFullYear()}.
RAW SOURCE MATERIAL (Internet Archive + live web, deduplicated):
"""
${raw.slice(0, 60_000)}
"""

PRODUCE a single self-contained .txt knowledge dump that:
1. Opens with a 1-paragraph executive summary in plain English (dumbed-down for any reader).
2. Lists the CORE CONCEPTS / VOCABULARY with one-line definitions.
3. Walks through the EVOLUTION over the last ${yearsBack} years, year by year if signal exists.
4. Names the major TECHNIQUES, TOOLS, ATTACKS, FRAMEWORKS, or DOCTRINES that matter today.
5. Calls out the OPEN PROBLEMS / FRONTIER AREAS where the field is moving next.
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

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  if (req.method !== 'OPTIONS') {
    try {
      const _b = await req.clone().json().catch(() => ({} as any));
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      await _gate.resolveKey(req, _byok);
    } catch (_e) {
      const _gate = await import('../_shared/adminGate.ts');
      return _gate.byokErrorResponse(_e, corsHeaders);
    }
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const body = (await req.json()) as HarvestReq;
    const domain = (body.domain || "").trim();
    if (!domain || domain.length < 3) {
      return new Response(JSON.stringify({ error: "domain required" }), { status: 400, headers: corsHeaders });
    }
    const category = body.category || "general";
    const yearsBack = Math.max(1, Math.min(40, body.yearsBack ?? 4));
    const maxSources = Math.max(5, Math.min(50, body.maxSources ?? 25));

    console.log(`[ARCHIVES-HARVEST] domain="${domain}" years=${yearsBack} cat=${category}`);

    // 1) Internet Archive search + deep-read top texts
    const docs = await searchIA(domain, yearsBack, maxSources);
    const topTexts = docs.filter((d) => d.mediatype === "texts").slice(0, 6);
    const bodies = await Promise.all(topTexts.map((d) => fetchIAText(d.identifier)));
    const ia = docs.map((d, i) => {
      const desc = Array.isArray(d.description) ? d.description.join(" ") : (d.description || "");
      const body = i < bodies.length ? bodies[i] : "";
      return `[IA:${d.identifier}] ${d.title || ""} (${d.date || "?"}) — ${desc}\n${body}`;
    }).join("\n\n").slice(0, 50_000);

    // 2) Live web snippets
    const live = await liveWebSnippets(`${domain} ${new Date().getFullYear()}`);

    const raw = `## INTERNET ARCHIVE (last ${yearsBack}y)\n${ia}\n\n## LIVE WEB SNIPPETS\n${live}`;
    if (raw.trim().length < 500) {
      return new Response(JSON.stringify({ error: "no source material harvested" }), { status: 502, headers: corsHeaders });
    }

    // 3) Synthesize via Gemini
    const synthesized = await geminiSynthesize(domain, yearsBack, raw, apiKey);
    if (!synthesized || synthesized.length < 800) {
      return new Response(JSON.stringify({ error: "synthesis failed", preview: synthesized?.slice(0, 500) }), { status: 502, headers: corsHeaders });
    }

    // 4) Insert into asher_brains as ACTIVE
    const admin = createClient(supaUrl, service);
    const stamp = new Date().toISOString().slice(0, 10);
    const safe = domain.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60);
    const fileName = `archives_${safe}_${stamp}.txt`;
    const brainName = body.brainName || `Archives — ${domain} (${yearsBack}y · ${stamp})`;

    const { data: row, error } = await admin
      .from("asher_brains")
      .insert({
        name: brainName,
        description: `Auto-harvested from Internet Archive + live web (last ${yearsBack} years). Feeds ASHER + AUREON brains.`,
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

    console.log(`[ARCHIVES-HARVEST] OK brain=${row.id} bytes=${synthesized.length}`);
    return new Response(
      JSON.stringify({
        ok: true,
        brain: row,
        sources_used: docs.length,
        synthesized_chars: synthesized.length,
        file_name: fileName,
        content: synthesized,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[ARCHIVES-HARVEST] error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
