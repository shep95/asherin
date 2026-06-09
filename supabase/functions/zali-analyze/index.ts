import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

const ANALYSIS_PROMPTS: Record<string, string> = {
  simulation_mechanical: `You are an expert structural/mechanical engineer. Analyze the following design project and provide a realistic FEA simulation result. Return ONLY valid JSON with this structure:
{"status":"pass"|"warning"|"fail","maxStress":"value MPa","yieldStrength":"value MPa","safetyFactor":"value","maxDeformation":"value mm","criticalPoint":"location","duration":"value s","recommendations":["rec1","rec2"]}`,

  simulation_thermal: `You are a thermal engineer. Analyze the following design and provide thermal simulation results. Return ONLY valid JSON:
{"status":"pass"|"warning"|"fail","maxTemp":"value°C","tempLimit":"value°C","timeToEquilibrium":"value s","hotspot":"location","coolingEfficiency":"value%","recommendations":["rec1","rec2"]}`,

  simulation_electrical: `You are an electrical engineer. Analyze the following design for circuit/SPICE simulation. Return ONLY valid JSON:
{"status":"pass"|"warning"|"fail","maxVoltage":"value V","maxCurrent":"value A","powerDissipation":"value W","signalIntegrity":"assessment","recommendations":["rec1","rec2"]}`,

  simulation_fluids: `You are a CFD engineer. Analyze the following design for fluid dynamics. Return ONLY valid JSON:
{"status":"pass"|"warning"|"fail","maxPressure":"value Pa","flowRate":"value m³/s","turbulenceLevel":"value","pressureDrop":"value Pa","recommendations":["rec1","rec2"]}`,

  simulation_vibration: `You are a vibration analysis engineer. Return ONLY valid JSON:
{"status":"pass"|"warning"|"fail","naturalFreq":"value Hz","dampingRatio":"value","maxAmplitude":"value mm","fatigueLife":"value cycles","recommendations":["rec1","rec2"]}`,

  simulation_chemical: `You are a chemical engineer. Analyze the following design for chemical compatibility and corrosion. Return ONLY valid JSON:
{"status":"pass"|"warning"|"fail","corrosionRate":"value mm/yr","chemicalCompatibility":"assessment","stabilityRating":"value","shelfLife":"value years","recommendations":["rec1","rec2"]}`,

  manufacturing: `You are a manufacturing engineer specializing in DFM (Design for Manufacturing). Analyze the following design project and provide a comprehensive manufacturing assessment. Return ONLY valid JSON:
{"dfmChecks":[{"label":"check name (supplier)","status":"pass"|"warning"|"fail","detail":"specific detail","cost":"$X","lead":"X days"}],"suppliers":[{"name":"supplier","items":N,"inStock":N,"total":"$X","leadDays":N}],"certifications":[{"name":"cert name","required":true|false,"status":"pass"|"needs-review"|"optional"}],"timeline":[{"week":"Week X-Y","task":"description","status":"ready"|"pending"}],"totalCost":"$X","maxLeadDays":N}`,

  optimization: `You are a multi-objective optimization engineer. Given the following design project and optimization weights, generate 3 optimized design variants. Return ONLY valid JSON:
{"designs":[{"name":"variant name","score":N,"badge":"⭐ BEST"|"","cost":{"value":"$X","delta":"+/-X%"},"performance":{"value":"X/100","delta":"+/-X%"},"weight":{"value":"X kg","delta":"+/-X%"},"buildTime":{"value":"X hrs","delta":"+/-X%"},"changes":["change1","change2"],"tradeoffs":["tradeoff1"]}]}`,

  material_trends: `You are a materials scientist. Analyze current material trends for the given design context. Return ONLY valid JSON:
{"trends":[{"name":"material name","growth":"+X%","reason":"brief reason"}],"failureAlerts":[{"material":"name","context":"where it fails","failRate":"X%","recommendation":"what to use instead"}],"substitutions":[{"original":"material","alternative":"material","costDelta":"-X%","strengthDelta":"+/-X%","risk":"X% higher/lower"}]}`,
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  try {
    const _b = await req.clone().json().catch(() => ({} as any));
    const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
    const _gate = await import('../_shared/adminGate.ts');
    await _gate.resolveKey(req, _byok);
  } catch (_e) {
    const _gate = await import('../_shared/adminGate.ts');
    return _gate.byokErrorResponse(_e, (globalThis as any).corsHeaders ?? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { analysisType, projectData, weights } = await req.json();

    const systemPrompt = ANALYSIS_PROMPTS[analysisType];
    if (!systemPrompt) {
      return new Response(JSON.stringify({ error: `Unknown analysis type: ${analysisType}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userContent = `Project: ${projectData?.name || "Unnamed Project"}
Description: ${projectData?.description || "No description"}
Specifications: ${JSON.stringify(projectData?.specs || {})}
Materials: ${JSON.stringify(projectData?.materials || [])}
${weights ? `Optimization Weights: ${JSON.stringify(weights)}` : ""}

Provide realistic, detailed results based on this project data. If data is sparse, make reasonable engineering assumptions and note them.`;

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userContent }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[ZALI-ANALYZE] Gemini error:", errText);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON from response
    let result;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = { error: "Could not parse AI response", raw: rawText.substring(0, 500) };
      }
    } catch {
      result = { error: "JSON parse failed", raw: rawText.substring(0, 500) };
    }

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[ZALI-ANALYZE] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
