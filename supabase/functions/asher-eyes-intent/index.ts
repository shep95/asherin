// Asher Eyes — Intent Filter
// Takes the current Asher Eyes result set + a natural-language intent
// ("data that improves coding knowledge", "cybersecurity dossiers", etc.)
// and returns the ids that actually match, ranked, with a one-line reason.
// GEMINI ONLY (per Asher Dashboard policy).
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP");

interface InItem { id: string; title: string; schema?: string; source?: string; snippet?: string; }

Deno.serve(async (req) => {
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
      return _gate.byokErrorResponse(_e, (globalThis as any).corsHeaders ?? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
    }
  }

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { intent, items, userKey } = await req.json() as { intent: string; items: InItem[]; userKey?: string };
    if (!intent?.trim() || !Array.isArray(items) || !items.length) {
      return new Response(JSON.stringify({ error: "intent + items required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const key = userKey || GEMINI_KEY;
    if (!key) return new Response(JSON.stringify({ error: "No Gemini key" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Trim items to keep prompt manageable
    const trimmed = items.slice(0, 200).map((r) => ({
      id: r.id,
      title: (r.title || "").slice(0, 180),
      schema: r.schema || "",
      source: (r.source || "").slice(0, 80),
      snippet: (r.snippet || "").slice(0, 280),
    }));

    const prompt = `You are an intelligence triage analyst working inside Asher Eyes.
A search returned the JSON list of documents below. The operator's intent is:

"${intent.trim()}"

Return ONLY items that genuinely satisfy that intent. Be strict — no padding, no "maybe relevant".
Score each kept item 0–100 by how well it matches.

Respond with STRICT JSON, no prose, no markdown:
{"matches":[{"id":"<id>","score":<int 0-100>,"reason":"<<= 18 words>"}, ...]}

Documents:
${JSON.stringify(trimmed)}`;

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: `Gemini ${r.status}`, detail: t.slice(0, 500) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const j = await r.json();
    const text = j?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(text); }
    catch { parsed = JSON.parse((text.match(/\{[\s\S]*\}/)?.[0]) || "{}"); }
    const matches = Array.isArray(parsed.matches) ? parsed.matches : [];
    matches.sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0));
    return new Response(JSON.stringify({ matches }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
