import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");
    const userId = userData.user.id;

    const body = await req.json();
    const { action } = body;

    // ── CHAT (AI editing assistant) ───────────────────────────
    if (action === "chat") {
      const { messages, projectId, currentImageUrl } = body;
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const systemPrompt = `You are AUREON Vibe Imager Assistant — an expert image editing advisor embedded alongside a Photopea editor.

Your role:
- Help users with editing techniques, tips, and creative direction
- Suggest Photopea tools and workflows for their needs
- Explain techniques like masking, blending modes, color correction, retouching
- Be concise (1-3 sentences unless explaining something complex)
- Be proactive with suggestions based on what they're working on

If the user wants a specific Photopea automation, you can provide a Photopea script using the tag:
[SCRIPT: app.activeDocument.someCommand();]

Common useful scripts:
- Rotate: app.activeDocument.rotateCanvas(90);
- Flip: app.activeDocument.flipCanvas("horizontal");
- Resize: app.activeDocument.resizeImage(1920, null);
- Flatten: app.activeDocument.flattenImage();
- Desaturate: app.activeDocument.activeLayer.adjustments.desaturate();

Current context: ${currentImageUrl ? "User has an image loaded in the editor." : "No image loaded yet."}`;

      const aiMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
      ];

      const aiResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: aiMessages,
          }),
        }
      );

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limited." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (aiResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "Credits exhausted." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error("Chat failed");
      }

      const aiData = await aiResponse.json();
      const reply = aiData.choices?.[0]?.message?.content || "";

      return new Response(
        JSON.stringify({ reply }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("vibe-imager error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
