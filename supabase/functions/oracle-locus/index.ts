import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const { image_base64, image_type } = await req.json();
    if (!image_base64) throw new Error("No image provided");

    const mimeType = image_type || "image/jpeg";

    const systemPrompt = `You are ORACLE-LOCUS, a highly advanced Geo-Intelligence Analyst AI. Your primary function is to transform visual data (images) into precise, actionable geospatial intelligence.

Given a single image with no embedded metadata, determine its precise geographic coordinates (latitude, longitude) and provide a confidence score, an estimated error radius, and a detailed rationale.

OPERATIONAL METHODOLOGY:
1. Image Ingestion: Extract all detectable visual features, objects, patterns.
2. Coarse-Grained Localization: Identify broad geographic regions based on architectural styles, climate indicators, unique large-scale patterns.
3. Iterative Refinement: Deconstruct the scene — identify road signs, power line structures, tree species, building materials, vehicle models, street furniture. Cross-reference against known geographic distributions. Analyze light patterns, shadows, sun angle, vegetation state.
4. Fine-Grained Geo-Estimation: Converge on precise latitude and longitude.
5. Confidence Assessment: Calculate confidence score (0-100%) and error radius in meters.

You MUST respond with ONLY valid JSON in this exact format:
{
  "status": "SUCCESS" | "AMBIGUOUS" | "FAILURE",
  "estimated_location": { "latitude": number, "longitude": number },
  "confidence_score": number,
  "error_radius_meters": number,
  "most_probable_macro_region": "string",
  "rationale": ["string", "string"],
  "identified_features": [{"type": "string", "detail": "string"}],
  "potential_alternative_locations": [{"region": "string", "confidence": number}],
  "address_estimate": "string or null"
}

Analyze every visual cue: architecture, vegetation, road markings, signage language/style, vehicle plates, sun position, terrain, infrastructure patterns, utility poles, soil color, cloud patterns, atmospheric haze. Be as precise as possible.`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: systemPrompt },
                { inlineData: { mimeType, data: image_base64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini error:", res.status, errText);
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: "No valid analysis returned", raw: text }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("oracle-locus error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
