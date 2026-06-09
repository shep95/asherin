import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { audit, byok = null } = await req.json();
    if (!audit) throw new Error("Missing audit payload");

    let _resolved;
    try {
      _resolved = await (await import('../_shared/adminGate.ts')).resolveKey(req, byok);
    } catch (e: any) {
      return (await import('../_shared/adminGate.ts')).byokErrorResponse(e, corsHeaders);
    }

    const auditStr = JSON.stringify(audit).slice(0, 30000);

    // BYOK path → call user provider; admin path → platform Gemini.
    if (_resolved.mode === 'byok') {
      const { callByokJson } = await import('../_shared/zophielByokRouter.ts');
      const sysB = `You are AUREON SHIELD. Return STRICT JSON only with shape {score,verdict,headline,summary,threats[],recommendations[]}.`;
      const usrB = `AUDIT:\n${auditStr}`;
      try {
        const raw = await callByokJson(_resolved.byok!, sysB, usrB, { timeoutMs: 60_000, maxOutputTokens: 4096 });
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = { score: 0, verdict: 'EXPOSED', headline: 'parse_failed', summary: raw.slice(0, 400), threats: [], recommendations: [] }; }
        return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: 'BYOK call failed', detail: String(e?.message || e) }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const GEMINI_API_KEY = _resolved.geminiKey || '';

    const systemPrompt = `You are AUREON SHIELD — a forensic-grade cyber security analyst. You receive a real browser/device/network audit JSON. Produce a sharp, surgical threat report. Speak as an intelligence officer: BOLD direct headers, no fluff, no apologies. Be honest about real risks AND about what cannot be inspected from a sandboxed web context (e.g. installed processes, kernel modules, OS files).

Return STRICT JSON ONLY (no markdown), schema:
{
  "score": 0-100,
  "verdict": "PROTECTED" | "EXPOSED" | "COMPROMISED",
  "headline": "one sentence",
  "summary": "2-3 sentences",
  "threats": [{"severity":"critical|high|medium|low","title":"","detail":"","action":""}],
  "recommendations": ["short imperative action", ...]
}`;

    const userPrompt = `AUDIT PAYLOAD:\n${auditStr}\n\nAnalyze every signal. Cross-check IP/geo/ISP, DNS leak status, WebRTC leak, browser permissions, fingerprint uniqueness, storage quotas, mixed content, breached emails. Output the JSON.`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Gemini error ${resp.status}: ${errText.slice(0, 300)}`);
    }

    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    let parsed;
    try { parsed = JSON.parse(text); } catch {
      const m = text.match(/\{[\s\S]*\}/);
      parsed = m ? JSON.parse(m[0]) : { score: 0, verdict: "EXPOSED", headline: "Analysis failed to parse", summary: text.slice(0, 400), threats: [], recommendations: [] };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
