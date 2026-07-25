// hoa-ai-command — /ai slash command handler for the Sovereign Command Deck.
//
// Called from the DeckComposer when an operator types `/ai <prompt>` in any
// text/broadcast/vault channel. Verifies the JWT, confirms the caller is a
// member of the target server, runs the prompt through Lovable AI Gateway
// (Gemini 3 Flash by default), and returns the reply text. The caller
// (client) inserts BOTH the prompt and the reply into hoa_messages so the
// audit trail + realtime fan-out stays inside the deck's existing
// invariants — this function is stateless w.r.t. the message table.
//
// Auth: bearer JWT required. Rate limited in-memory per user (20 / hour).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_KEY    = Deno.env.get("LOVABLE_API_KEY")!;

const buckets = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 20;
const WINDOW = 60 * 60 * 1000;
function rateOk(userId: string) {
  const now = Date.now();
  const b = buckets.get(userId);
  if (!b || b.resetAt < now) { buckets.set(userId, { count: 1, resetAt: now + WINDOW }); return true; }
  if (b.count >= LIMIT) return false;
  b.count += 1; return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!LOVABLE_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
    const user = userData.user;

    if (!rateOk(user.id)) return json({ error: "rate limit — 20 AI commands per hour" }, 429);

    const { serverId, prompt, context } = await req.json().catch(() => ({} as any));
    if (!serverId || typeof serverId !== "string") return json({ error: "serverId required" }, 400);
    const text = String(prompt ?? "").trim();
    if (!text) return json({ error: "prompt required" }, 400);
    if (text.length > 4000) return json({ error: "prompt too long (max 4000 chars)" }, 400);

    // Membership check — cheapest possible IDOR guard.
    const { data: mem } = await admin
      .from("hoa_members").select("handle, clearance_rank")
      .eq("server_id", serverId).eq("user_id", user.id).maybeSingle();
    if (!mem) return json({ error: "not a member of this server" }, 403);

    const { HYPOTHETICAL_REALISM_DOCTRINE } = await import("../_shared/hypotheticalRealismDoctrine.ts");
    const system = [
      HYPOTHETICAL_REALISM_DOCTRINE,
      "You are ASHERIN.AI-GOV, the in-channel intelligence assistant of the Asherin.gov Sovereign Command Deck.",
      "Answer with surgical directness. No filler. No moralizing.",
      "Use markdown when it helps: bold headers, tables for comparative data, fenced code for code.",
      "If the question needs external live data you do not have, say UNKNOWN — do not fabricate.",
      `Operator handle: ${mem.handle}. Clearance rank: ${mem.clearance_rank}.`,
      typeof context === "string" && context.trim() ? `Channel context: ${context.slice(0, 400)}` : "",
      HYPOTHETICAL_REALISM_DOCTRINE,
    ].filter(Boolean).join("\n");

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: text },
        ],
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text().catch(() => "");
      if (aiRes.status === 429) return json({ error: "AI gateway rate-limited — try again shortly" }, 429);
      if (aiRes.status === 402) return json({ error: "AI credits exhausted — add credits in workspace usage" }, 402);
      return json({ error: `AI gateway error ${aiRes.status}`, detail: detail.slice(0, 400) }, 502);
    }
    const payload = await aiRes.json();
    const reply = payload?.choices?.[0]?.message?.content ?? "";
    if (!reply) return json({ error: "AI returned an empty response" }, 502);

    return json({ ok: true, reply });
  } catch (e) {
    console.error("hoa-ai-command error", e);
    return json({ error: (e as Error).message ?? "internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
