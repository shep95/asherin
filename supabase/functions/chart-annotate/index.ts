import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { imageBase64, imageMimeType, analysisText, userQuery } = await req.json();

    if (!imageBase64 || !imageMimeType) {
      return new Response(JSON.stringify({ error: "Missing image data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for user BYOK keys first
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    let apiKey = Deno.env.get("GEMINI_API_KEY_APP") || "";

    // Try to get user's BYOK Google key
    const token = authHeader.replace("Bearer ", "");
    if (token) {
      try {
        const { data: { user } } = await sb.auth.getUser(token);
        if (user) {
          const { data: keys } = await sb.from("user_api_keys").select("*").eq("user_id", user.id).eq("provider", "google");
          if (keys && keys.length > 0) {
            apiKey = keys[0].api_key;
            console.log("Using user's Google BYOK key for chart annotation");
          }
        }
      } catch { /* use default key */ }
    }

    // Fallback to Lovable AI Gateway if no Gemini key
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const annotationPrompt = `You are a professional technical analyst. I have a trading chart and an analysis. 
Edit and annotate this trading chart image with clear visual markings that PROVE the analysis:

ANALYSIS TO PROVE:
${analysisText?.slice(0, 1500) || "Analyze this chart"}

USER QUESTION: ${userQuery || "Analyze this chart"}

ANNOTATION INSTRUCTIONS:
1. Draw horizontal lines at key SUPPORT levels (green dashed) and RESISTANCE levels (red dashed)
2. Mark the suggested ENTRY zone with a green highlighted area or arrow labeled "ENTRY"
3. Mark the STOP LOSS level with a bold red line labeled "SL" with the price
4. Mark TAKE PROFIT target(s) with blue/cyan lines labeled "TP1", "TP2", "TP3" with prices
5. Draw any visible trendlines, pattern boundaries, or fibonacci levels
6. Add a large directional arrow (↑ for LONG in green, ↓ for SHORT in red) showing expected move
7. If there are specific price levels mentioned in the analysis, mark them clearly
8. Keep the original chart fully visible — overlay annotations cleanly with semi-transparency
9. Add a small legend in the corner explaining the color coding

Make annotations bold, clear, and professional. Use high-contrast colors visible on dark charts.
Return ONLY the annotated image.`;

    // Try Gemini image generation models (correct model names as of 2026)
    if (apiKey) {
      const imageModels = [
        "gemini-2.5-flash-image",
        "gemini-3.1-flash-image-preview",
        "gemini-3-pro-image-preview",
      ];

      for (const model of imageModels) {
        try {
          console.log(`Trying chart annotation with ${model}...`);
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{
                  role: "user",
                  parts: [
                    { inline_data: { mime_type: imageMimeType, data: imageBase64 } },
                    { text: annotationPrompt },
                  ],
                }],
                generationConfig: {
                  responseModalities: ["IMAGE", "TEXT"],
                },
              }),
            },
          );

          if (resp.ok) {
            const data = await resp.json();
            const parts = data.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
              if (part.inlineData?.mimeType?.startsWith("image/")) {
                const annotatedImage = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                console.log(`Chart annotation succeeded with ${model}`);
                return new Response(JSON.stringify({ annotatedImage }), {
                  headers: { ...corsHeaders, "Content-Type": "application/json" },
                });
              }
            }
            console.warn(`${model} returned OK but no image in parts`);
          } else {
            const errText = await resp.text();
            console.warn(`${model} failed (${resp.status}):`, errText.slice(0, 200));
          }
        } catch (e) {
          console.warn(`${model} error:`, e);
        }
      }
    }

    // Fallback: Try Lovable AI Gateway with image editing model
    if (LOVABLE_API_KEY) {
      try {
        console.log("Trying Lovable AI Gateway for chart annotation...");
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{
              role: "user",
              content: [
                { type: "text", text: annotationPrompt },
                { type: "image_url", image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } },
              ],
            }],
            modalities: ["image", "text"],
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          if (imageUrl) {
            console.log("Chart annotation succeeded via Lovable AI Gateway");
            return new Response(JSON.stringify({ annotatedImage: imageUrl }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          const errText = await resp.text();
          console.warn(`Lovable AI Gateway failed (${resp.status}):`, errText.slice(0, 200));
        }
      } catch (e) {
        console.warn("Lovable AI Gateway error:", e);
      }
    }

    return new Response(JSON.stringify({ error: "Chart annotation unavailable. All image generation models failed." }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("chart-annotate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
