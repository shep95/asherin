import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are ZOPHIEL — a forensic infrastructure intelligence engine.

Given a target URL, you must return a complete BLUEPRINT MAP of its digital infrastructure as a structured JSON tree of nodes and connections.

Return ONLY valid JSON matching this exact schema (no markdown, no commentary):

{
  "target": "domain.tld",
  "summary": "2-sentence executive overview of the stack & posture.",
  "score": {
    "security": 0-100,
    "performance": 0-100,
    "complexity": 0-100
  },
  "branches": [
    {
      "id": "domain",
      "label": "DOMAIN & DNS",
      "icon": "globe",
      "tone": "neutral|good|warn|critical",
      "leaves": [
        { "label": "Registrar", "value": "GoDaddy", "confidence": "high|med|low" },
        { "label": "DNSSEC", "value": "Disabled", "confidence": "high" }
      ]
    },
    {
      "id": "hosting",
      "label": "HOSTING & CDN",
      "icon": "server",
      "tone": "good",
      "leaves": [...]
    },
    {
      "id": "stack",
      "label": "TECH STACK",
      "icon": "cpu",
      "tone": "neutral",
      "leaves": [...]
    },
    {
      "id": "security",
      "label": "SECURITY POSTURE",
      "icon": "shield",
      "tone": "warn",
      "leaves": [...]
    },
    {
      "id": "thirdparty",
      "label": "THIRD-PARTY",
      "icon": "plug",
      "tone": "neutral",
      "leaves": [...]
    },
    {
      "id": "network",
      "label": "NETWORK TOPOLOGY",
      "icon": "network",
      "tone": "neutral",
      "leaves": [...]
    },
    {
      "id": "org",
      "label": "ORG INTEL",
      "icon": "building",
      "tone": "neutral",
      "leaves": [...]
    }
  ],
  "edges": [
    { "from": "domain", "to": "hosting", "label": "resolves" },
    { "from": "hosting", "to": "stack", "label": "serves" },
    { "from": "stack", "to": "thirdparty", "label": "loads" },
    { "from": "stack", "to": "security", "label": "exposes" },
    { "from": "thirdparty", "to": "network", "label": "extends" },
    { "from": "domain", "to": "org", "label": "owned by" }
  ],
  "criticals": [
    { "branch": "security", "finding": "CSP allows unsafe-eval", "severity": "high" }
  ]
}

Rules:
- Each branch MUST have 4-8 leaves with concrete observed/inferred values.
- Use 'tone' to color-code branches: good (secure/modern), neutral (standard), warn (gaps), critical (severe).
- Leaves should be FACTS, not descriptions ("Nginx 1.24" not "uses a web server").
- Always include all 7 branches.
- Always include the 6 standard edges above (and add more if relevant).
- Output JSON only. No prose before or after.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url required" }), {
        status: 400,
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
              parts: [{ text: `Target URL: ${url}\n\nReturn the JSON blueprint now.` }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.3,
            maxOutputTokens: 4096,
          },
        }),
      },
    );

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[blueprint] AI error", aiResp.status, errText);
      return new Response(
        JSON.stringify({ error: `Gemini: ${aiResp.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiData = await aiResp.json();
    const raw = aiData?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "{}";

    let blueprint: any;
    try {
      blueprint = JSON.parse(raw);
    } catch {
      // Strip code fences if present
      const cleaned = raw.replace(/```json\n?|```/g, "").trim();
      blueprint = JSON.parse(cleaned);
    }

    return new Response(
      JSON.stringify({ success: true, blueprint }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[blueprint] fatal", e);
    return new Response(
      JSON.stringify({ error: e?.message || "extract failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
