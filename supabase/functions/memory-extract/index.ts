// MEMORY EXTRACT — pulls durable user preferences/rules/facts from the most
// recent chat turn and saves them to public.memory_entries with source
// 'conversation'. Fire-and-forget from the client after each assistant
// response. Skips silently when nothing durable is detected.
//
// Privacy: only saves things that are clearly about the USER (preferences,
// rules they set, facts they stated about themselves/their work). Never saves
// transient task content, code snippets, or assistant claims.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

interface Body {
  userMessage: string;
  assistantMessage: string;
  conversationId?: string;
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 512, responseMimeType: "application/json" },
      }),
    },
  );
  if (!r.ok) throw new Error(`gemini_${r.status}`);
  const j = await r.json();
  return j?.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { userMessage, assistantMessage } = (await req.json()) as Body;
    if (!userMessage?.trim()) {
      return new Response(JSON.stringify({ saved: 0 }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const anonSb = createClient(SUPABASE_URL, ANON);
    const { data: { user } } = await anonSb.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthenticated" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return new Response(JSON.stringify({ saved: 0, skipped: "no_key" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    const adminSb = createClient(SUPABASE_URL, SRK);
    // Load existing memories to avoid duplicates.
    const { data: existing } = await adminSb
      .from("memory_entries")
      .select("content")
      .eq("user_id", user.id)
      .limit(200);
    const existingSet = new Set((existing ?? []).map((e: any) => String(e.content).toLowerCase().trim()));

    const prompt = `You extract DURABLE personal memory for a long-running AI assistant. From the most recent chat turn below, return a JSON array of memory items the assistant should remember across ALL future chats with this user.

ONLY extract items that are:
- Stable preferences the user states ("always answer in bullets", "use metric units", "no emojis")
- Rules / constraints the user sets ("never suggest React", "I prefer Python over Node")
- Durable facts about the user, their work, their identity, their projects ("I live in Austin", "I'm a forensic accountant", "my company is Asherin")
- Goals or ongoing context that will outlive this chat ("I'm building a trading bot named Lavba")

DO NOT extract:
- Anything from the assistant message (only mine the user message for first-person statements)
- Transient task details ("write me a haiku about cats")
- Code, file contents, or one-off questions
- Anything speculative or implied — only explicit statements

Return STRICT JSON: an array (possibly empty) of objects of the form
  { "content": "short first-person rule, max 140 chars", "category": "preferences" | "context" | "technical" | "general" }
Do not wrap in markdown. Just the JSON array. If nothing qualifies, return [].

USER MESSAGE:
${userMessage.slice(0, 4000)}

ASSISTANT REPLY (context only, do not mine):
${(assistantMessage || "").slice(0, 1500)}`;

    let raw = "[]";
    try { raw = await callGemini(geminiKey, prompt); } catch (e) {
      console.error("gemini extract failed", e);
      return new Response(JSON.stringify({ saved: 0, error: "extract_failed" }), { headers: { ...cors, "Content-Type": "application/json" } });
    }

    let items: { content: string; category?: string }[] = [];
    try {
      const parsed = JSON.parse(raw.trim().replace(/^```json\s*|\s*```$/g, ""));
      if (Array.isArray(parsed)) items = parsed;
    } catch { /* not valid JSON, skip */ }

    const allowedCats = new Set(["preferences", "context", "technical", "general"]);
    const rows: any[] = [];
    for (const it of items) {
      const content = String(it?.content || "").trim();
      if (!content || content.length > 280) continue;
      if (existingSet.has(content.toLowerCase())) continue;
      const category = allowedCats.has(String(it?.category)) ? it.category! : "general";
      rows.push({
        user_id: user.id,
        content,
        category,
        source: "conversation",
        reason: "Auto-extracted from chat",
        enabled: true,
      });
      if (rows.length >= 5) break; // cap per-turn writes
    }

    let saved = 0;
    if (rows.length) {
      const { error, data } = await adminSb.from("memory_entries").insert(rows).select("id");
      if (error) console.error("memory insert failed", error);
      else saved = data?.length ?? 0;
    }

    return new Response(JSON.stringify({ saved, items: rows.map(r => r.content) }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("memory-extract fatal", e);
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
