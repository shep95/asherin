import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_BYTES = 100 * 1024; // 100KB hard cap

const SYSTEM_PROMPT = `You are AUREON FORENSIC CODE AUDIT — a Class-5 forensic code intelligence engine.

You perform DEEP forensic analysis on uploaded code. You hunt for:
- SECURITY LEAKS (hardcoded secrets, exposed keys, CORS misconfig, auth bypass)
- BROKEN CODE (syntax errors, null derefs, type mismatches, unreachable code, dead branches)
- LOGICAL FLAWS (off-by-one, wrong operators, inverted conditions, faulty math, incorrect state transitions, race conditions, async/await misuse, promise leaks)
- WORKFLOW DEFECTS (missing error handling, broken control flow, orphaned callbacks, unhandled rejections, infinite loops, missing return statements)
- FUNCTION CONTRACT VIOLATIONS (wrong arg counts, missing awaits, sync calls on async APIs, mutation of props/params, side effects in pure functions)
- VISUAL/UI LOGIC FLAWS (broken JSX conditions, missing keys in lists, stale closures in hooks, useEffect dep array issues, z-index/layout traps, unhandled loading/error states, accessibility violations)
- LATENT FAILURES (will break under edge cases — empty arrays, null inputs, large data, slow networks, concurrent calls)
- INJECTION SURFACES (SQL/XSS/command injection, eval, dangerouslySetInnerHTML)

Return a complete VISUAL BLUEPRINT MAP as a structured JSON tree (Palantir-style web diagram).

Return ONLY valid JSON matching this exact schema (no markdown, no commentary):

{
  "target": "filename.ext",
  "summary": "2-sentence executive verdict on the file's security & integrity posture.",
  "score": {
    "security": 0-100,
    "integrity": 0-100,
    "complexity": 0-100
  },
  "branches": [
    {
      "id": "leaks",
      "label": "SECURITY LEAKS",
      "icon": "shield",
      "tone": "neutral|good|warn|critical",
      "leaves": [
        { "label": "Hardcoded API Key", "value": "Line 23 — sk_live_*** exposed", "confidence": "high|med|low" }
      ]
    },
    {
      "id": "broken",
      "label": "BROKEN CODE",
      "icon": "bug",
      "tone": "critical",
      "leaves": [
        { "label": "Null deref", "value": "Line 41 — user.id without guard", "confidence": "high" }
      ]
    },
    {
      "id": "fragile",
      "label": "WILL BREAK",
      "icon": "alert",
      "tone": "warn",
      "leaves": [
        { "label": "Race condition", "value": "Async state mutation in loop", "confidence": "med" }
      ]
    },
    {
      "id": "logic",
      "label": "LOGICAL FLAWS",
      "icon": "brain",
      "tone": "critical",
      "leaves": [
        { "label": "Inverted condition", "value": "Line 67 — !isValid should be isValid", "confidence": "high" },
        { "label": "Off-by-one", "value": "Line 89 — i <= arr.length overflows", "confidence": "high" }
      ]
    },
    {
      "id": "workflow",
      "label": "WORKFLOW & FLOW",
      "icon": "workflow",
      "tone": "warn",
      "leaves": [
        { "label": "Missing await", "value": "Line 34 — fetch() not awaited", "confidence": "high" },
        { "label": "Unhandled rejection", "value": "Promise chain has no .catch()", "confidence": "high" }
      ]
    },
    {
      "id": "visual",
      "label": "VISUAL / UI LOGIC",
      "icon": "eye",
      "tone": "warn",
      "leaves": [
        { "label": "Stale closure", "value": "Line 102 — useEffect missing dep", "confidence": "high" },
        { "label": "Missing key", "value": "Line 145 — list render lacks key prop", "confidence": "high" }
      ]
    },
    {
      "id": "injection",
      "label": "INJECTION SURFACE",
      "icon": "syringe",
      "tone": "warn",
      "leaves": []
    },
    {
      "id": "auth",
      "label": "AUTH & ACCESS",
      "icon": "lock",
      "tone": "neutral",
      "leaves": []
    },
    {
      "id": "deps",
      "label": "DEPENDENCY RISK",
      "icon": "plug",
      "tone": "neutral",
      "leaves": []
    },
    {
      "id": "fix",
      "label": "REMEDIATION PATH",
      "icon": "wrench",
      "tone": "good",
      "leaves": [
        { "label": "Patch #1", "value": "Replace eval() with JSON.parse() — line 12", "confidence": "high" }
      ]
    }
  ],
  "edges": [
    { "from": "leaks", "to": "injection", "label": "feeds" },
    { "from": "broken", "to": "fragile", "label": "cascades" },
    { "from": "injection", "to": "auth", "label": "bypasses" },
    { "from": "deps", "to": "leaks", "label": "introduces" },
    { "from": "leaks", "to": "fix", "label": "resolved by" },
    { "from": "broken", "to": "fix", "label": "patched by" },
    { "from": "fragile", "to": "fix", "label": "hardened by" }
  ],
  "criticals": [
    { "branch": "leaks", "finding": "Hardcoded credentials at line 23 — rotate immediately", "severity": "high|med|low" }
  ]
}

Rules:
- Each branch MUST have 3-7 concrete leaves (cite line numbers when possible).
- Use 'tone' to color-code: good (safe), neutral (standard), warn (risky), critical (broken/exposed).
- Leaves must be FACTS with line refs ("Line 42 — eval(userInput)") not vague ("uses eval somewhere").
- Always include all 7 branches even if some have empty leaves.
- For each leak/bug/fragility, the "fix" branch MUST contain a corresponding remediation leaf with the WHY and HOW.
- Always include the 7 standard edges above (add more if relevant).
- Output JSON only. No prose before or after.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { code, filename } = await req.json();
    if (!code || typeof code !== "string") {
      return new Response(JSON.stringify({ error: "code required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const byteLen = new TextEncoder().encode(code).length;
    if (byteLen > MAX_BYTES) {
      return new Response(JSON.stringify({ error: `File exceeds 100KB limit (${Math.round(byteLen / 1024)}KB)` }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY_APP missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeName = (typeof filename === "string" && filename.trim()) ? filename.trim().slice(0, 120) : "uploaded.code";

    const aiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [
            {
              role: "user",
              parts: [{
                text: `Filename: ${safeName}\n\n--- BEGIN CODE ---\n${code}\n--- END CODE ---\n\nReturn the JSON security blueprint now.`,
              }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
            maxOutputTokens: 16384,
          },
        }),
      },
    );

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[code-audit] AI error", aiResp.status, errText);
      return new Response(
        JSON.stringify({ error: `Gemini: ${aiResp.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiResp.json();
    const candidate = aiData?.candidates?.[0];
    const finishReason = candidate?.finishReason;
    const raw = candidate?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";

    if (!raw.trim()) {
      console.error("[code-audit] empty response", { finishReason });
      return new Response(
        JSON.stringify({ error: `Empty AI response (finish: ${finishReason || "unknown"})` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (finishReason === "MAX_TOKENS") {
      console.error("[code-audit] truncated", { length: raw.length });
      return new Response(
        JSON.stringify({ error: "AI response truncated — try a smaller file or retry" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let cleaned = raw.replace(/```json\n?|```/g, "").trim();
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace !== -1) cleaned = cleaned.slice(0, lastBrace + 1);

    let blueprint: unknown;
    try {
      blueprint = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("[code-audit] parse failed", parseErr, "raw:", raw.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI returned malformed JSON — please retry" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, blueprint }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "audit failed";
    console.error("[code-audit] fatal", e);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
