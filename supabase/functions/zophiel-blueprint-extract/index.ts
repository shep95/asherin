import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { isValidByok, callByokJsonWithRetry, type ZophielByokConfig } from "../_shared/zophielByokRouter.ts";

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
  "score": { "security": 0-100, "performance": 0-100, "complexity": 0-100 },
  "branches": [
    { "id": "domain", "label": "DOMAIN & DNS", "icon": "globe", "tone": "neutral", "leaves": [...] },
    { "id": "hosting", "label": "HOSTING & CDN", "icon": "server", "tone": "good", "leaves": [...] },
    { "id": "stack", "label": "TECH STACK", "icon": "cpu", "tone": "neutral", "leaves": [...] },
    { "id": "security", "label": "SECURITY POSTURE", "icon": "shield", "tone": "warn", "leaves": [...] },
    { "id": "thirdparty", "label": "THIRD-PARTY", "icon": "plug", "tone": "neutral", "leaves": [...] },
    { "id": "network", "label": "NETWORK TOPOLOGY", "icon": "network", "tone": "neutral", "leaves": [...] },
    { "id": "org", "label": "ORG INTEL", "icon": "building", "tone": "neutral", "leaves": [...] },
    { "id": "subdomains", "label": "SUBDOMAINS", "icon": "network", "tone": "neutral",
      "leaves": [
        { "label": "api.domain.tld", "value": "REST API gateway", "confidence": "high" },
        { "label": "mail.domain.tld", "value": "Email infrastructure", "confidence": "med" }
      ],
      "subdomains": ["api.domain.tld", "mail.domain.tld", "cdn.domain.tld", "blog.domain.tld"]
    }
  ],
  "edges": [
    { "from": "domain", "to": "hosting", "label": "resolves" },
    { "from": "hosting", "to": "stack", "label": "serves" },
    { "from": "stack", "to": "thirdparty", "label": "loads" },
    { "from": "stack", "to": "security", "label": "exposes" },
    { "from": "thirdparty", "to": "network", "label": "extends" },
    { "from": "domain", "to": "org", "label": "owned by" },
    { "from": "domain", "to": "subdomains", "label": "delegates" }
  ],
  "criticals": [
    { "branch": "security", "finding": "CSP allows unsafe-eval", "severity": "high" }
  ]
}

Rules:
- Each branch MUST have 4-8 leaves with concrete observed/inferred values.
- Use 'tone' to color-code branches: good (secure/modern), neutral (standard), warn (gaps), critical (severe).
- Leaves should be FACTS, not descriptions ("Nginx 1.24" not "uses a web server").
- Always include all 8 branches (including subdomains).
- For the 'subdomains' branch: enumerate 6-20 likely/observed subdomains via cert transparency patterns, common conventions (api, mail, cdn, blog, dev, staging, app, admin, docs, status, m, www, secure, vpn, git), and any documented services. Populate the 'subdomains' string array with bare hostnames only.
- Output JSON only. No prose before or after.`;

const SUBDOMAIN_SYSTEM_PROMPT = `You are ZOPHIEL — forensic infrastructure intelligence engine.

Given a SUBDOMAIN target (e.g. api.example.com), return a BLUEPRINT MAP for THAT specific subdomain — focusing on how it differs from the parent (its own stack, CDN, security headers, third-parties, purpose).

Return ONLY valid JSON matching this exact schema (no markdown, no commentary):

{
  "target": "api.example.com",
  "summary": "2-sentence overview of THIS subdomain's stack & posture.",
  "score": { "security": 0-100, "performance": 0-100, "complexity": 0-100 },
  "branches": [
    { "id": "domain", "label": "DOMAIN & DNS", "icon": "globe", "tone": "neutral", "leaves": [{"label":"...","value":"...","confidence":"high"}] },
    { "id": "hosting", "label": "HOSTING & CDN", "icon": "server", "tone": "good", "leaves": [...] },
    { "id": "stack", "label": "TECH STACK", "icon": "cpu", "tone": "neutral", "leaves": [...] },
    { "id": "security", "label": "SECURITY POSTURE", "icon": "shield", "tone": "warn", "leaves": [...] },
    { "id": "thirdparty", "label": "THIRD-PARTY", "icon": "plug", "tone": "neutral", "leaves": [...] },
    { "id": "network", "label": "NETWORK TOPOLOGY", "icon": "network", "tone": "neutral", "leaves": [...] },
    { "id": "org", "label": "ORG INTEL", "icon": "building", "tone": "neutral", "leaves": [...] }
  ],
  "edges": [
    { "from": "domain", "to": "hosting", "label": "resolves" },
    { "from": "hosting", "to": "stack", "label": "serves" },
    { "from": "stack", "to": "security", "label": "exposes" },
    { "from": "stack", "to": "thirdparty", "label": "loads" }
  ],
  "criticals": [
    { "branch": "security", "finding": "...", "severity": "high|med|low" }
  ]
}

Rules:
- Each branch MUST have 4-8 concrete leaves (FACTS, not descriptions).
- Always include all 7 branches above (no subdomains branch on a subdomain target).
- Use 'tone' to color-code: good, neutral, warn, critical.
- Output JSON only. No prose.`;



serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url, byok, mode } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSubdomainMode = mode === "subdomain";
    const activeSystemPrompt = isSubdomainMode ? SUBDOMAIN_SYSTEM_PROMPT : SYSTEM_PROMPT;

    const useByok = isValidByok(byok);
    const GEMINI_API_KEY = useByok ? "" : (Deno.env.get("GEMINI_API_KEY_APP") || "");
    if (!useByok && !GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY_APP missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = isSubdomainMode
      ? `Subdomain target: ${url}\n\nReturn the JSON blueprint for THIS subdomain now.`
      : `Target URL: ${url}\n\nReturn the JSON blueprint now (include the subdomains branch with enumerated hostnames).`;

    let raw = "";
    let finishReason: string | undefined;
    if (useByok) {
      try {
        raw = await callByokJsonWithRetry(byok as ZophielByokConfig, activeSystemPrompt, userPrompt, {
          timeoutMs: 60_000,
          temperature: 0.3,
          maxOutputTokens: 16384,
          attempts: 2,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "BYOK call failed";
        console.error("[blueprint] BYOK error", msg);
        return new Response(
          JSON.stringify({ error: `Your AI key call failed: ${msg}` }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      const aiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: activeSystemPrompt }] },
            contents: [
              { role: "user", parts: [{ text: userPrompt }] },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.3,
              maxOutputTokens: 16384,
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
      const candidate = aiData?.candidates?.[0];
      finishReason = candidate?.finishReason;
      raw = candidate?.content?.parts?.map((p: { text?: string }) => p.text || "").join("") || "";
    }

    if (!raw.trim()) {
      console.error("[blueprint] empty response", { finishReason, aiData });
      return new Response(
        JSON.stringify({ error: `Empty AI response (finish: ${finishReason || "unknown"})` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (finishReason === "MAX_TOKENS") {
      console.error("[blueprint] truncated", { length: raw.length });
      return new Response(
        JSON.stringify({ error: "AI response truncated — try a shorter target or retry" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Strip fences and salvage to last closing brace
    let cleaned = raw.replace(/```json\n?|```/g, "").trim();
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace !== -1) cleaned = cleaned.slice(0, lastBrace + 1);

    let blueprint: any;
    try {
      blueprint = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("[blueprint] parse failed", parseErr, "raw:", raw.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "AI returned malformed JSON — please retry" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
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
