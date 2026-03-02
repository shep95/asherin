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

    // ── TEXT-TO-IMAGE ──────────────────────────────────────────
    if (action === "generate") {
      const { prompt, projectId, parentVersionId, stylePreset } = body;
      if (!prompt) throw new Error("Prompt is required");

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      // Enhance prompt with style
      let enhancedPrompt = prompt;
      if (stylePreset && stylePreset !== "none") {
        const styleMap: Record<string, string> = {
          photorealistic: "Ultra photorealistic, 8K, detailed lighting, professional photography",
          artistic: "Fine art painting style, expressive brushstrokes, gallery quality",
          anime: "Anime/manga art style, vibrant colors, detailed linework",
          minimalist: "Clean minimalist design, simple shapes, white space, modern",
          cinematic: "Cinematic shot, dramatic lighting, film color grading, widescreen",
          watercolor: "Delicate watercolor painting, soft edges, translucent washes",
          "3d-render": "3D rendered, volumetric lighting, ray-traced, octane render",
          sketch: "Pencil sketch, cross-hatching, hand-drawn, graphite on paper",
        };
        enhancedPrompt = `${prompt}. Style: ${styleMap[stylePreset] || stylePreset}`;
      }

      // Generate image via Lovable AI image model
      const aiResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [
              {
                role: "user",
                content: `Generate a high quality image: ${enhancedPrompt}`,
              },
            ],
            modalities: ["image", "text"],
          }),
        }
      );

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limited. Please wait a moment and try again." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (aiResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "Credits exhausted. Please add funds." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errText = await aiResponse.text();
        console.error("AI error:", aiResponse.status, errText);
        throw new Error("Image generation failed");
      }

      const aiData = await aiResponse.json();
      const imageData = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      const aiText = aiData.choices?.[0]?.message?.content || "";

      if (!imageData) throw new Error("No image returned from AI");

      // Extract base64 and upload to storage
      const base64Match = imageData.match(/^data:image\/([\w+]+);base64,(.+)$/);
      if (!base64Match) throw new Error("Invalid image data format");
      const ext = base64Match[1] === "jpeg" ? "jpg" : base64Match[1];
      const b64 = base64Match[2];
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

      const fileName = `${userId}/${projectId || "unsorted"}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("vibe-imager")
        .upload(fileName, bytes, { contentType: `image/${ext}`, upsert: false });
      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

      const { data: urlData } = supabase.storage
        .from("vibe-imager")
        .getPublicUrl(fileName);

      // Determine version number
      let versionNumber = 1;
      if (parentVersionId) {
        const { data: parentVersion } = await supabase
          .from("vibe_imager_versions")
          .select("version_number")
          .eq("id", parentVersionId)
          .single();
        if (parentVersion) versionNumber = parentVersion.version_number + 1;
      }

      // Save version to DB
      const { data: version, error: versionErr } = await supabase
        .from("vibe_imager_versions")
        .insert({
          project_id: projectId,
          user_id: userId,
          parent_id: parentVersionId || null,
          version_number: versionNumber,
          prompt: enhancedPrompt,
          image_url: urlData.publicUrl,
          style_preset: stylePreset || null,
          metadata: { ai_text: aiText },
        })
        .select()
        .single();
      if (versionErr) throw new Error(`Version save failed: ${versionErr.message}`);

      return new Response(
        JSON.stringify({ version, aiText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── EDIT IMAGE ─────────────────────────────────────────────
    if (action === "edit") {
      const { instruction, imageUrl, projectId, parentVersionId } = body;
      if (!instruction || !imageUrl) throw new Error("Instruction and imageUrl required");

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const aiResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: instruction },
                  { type: "image_url", image_url: { url: imageUrl } },
                ],
              },
            ],
            modalities: ["image", "text"],
          }),
        }
      );

      if (!aiResponse.ok) {
        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limited. Please wait." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (aiResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "Credits exhausted." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw new Error("Edit failed");
      }

      const aiData = await aiResponse.json();
      const editedImage = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      const aiText = aiData.choices?.[0]?.message?.content || "";
      if (!editedImage) throw new Error("No edited image returned");

      // Upload
      const base64Match = editedImage.match(/^data:image\/([\w+]+);base64,(.+)$/);
      if (!base64Match) throw new Error("Invalid image data");
      const ext = base64Match[1] === "jpeg" ? "jpg" : base64Match[1];
      const b64 = base64Match[2];
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

      const fileName = `${userId}/${projectId || "unsorted"}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("vibe-imager")
        .upload(fileName, bytes, { contentType: `image/${ext}`, upsert: false });
      if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

      const { data: urlData } = supabase.storage
        .from("vibe-imager")
        .getPublicUrl(fileName);

      let versionNumber = 1;
      if (parentVersionId) {
        const { data: pv } = await supabase
          .from("vibe_imager_versions")
          .select("version_number")
          .eq("id", parentVersionId)
          .single();
        if (pv) versionNumber = pv.version_number + 1;
      }

      const { data: version, error: versionErr } = await supabase
        .from("vibe_imager_versions")
        .insert({
          project_id: projectId,
          user_id: userId,
          parent_id: parentVersionId || null,
          version_number: versionNumber,
          prompt: instruction,
          image_url: urlData.publicUrl,
          is_uploaded: false,
          metadata: { ai_text: aiText, edit: true },
        })
        .select()
        .single();
      if (versionErr) throw new Error(`Version save failed: ${versionErr.message}`);

      return new Response(
        JSON.stringify({ version, aiText }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CHAT (conversational refinement) ───────────────────────
    if (action === "chat") {
      const { messages, projectId, currentImageUrl } = body;
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const systemPrompt = `You are AUREON Vibe Imager — a conversational AI image creation partner. You help users create, refine, and iterate on images.

Your personality:
- Proactive: Ask clarifying questions about style, mood, composition
- Creative: Suggest unexpected but tasteful variations
- Concise: Keep responses under 3 sentences unless explaining something complex
- Collaborative: Treat the user as the creative director

When the user describes changes:
1. Acknowledge what they want
2. If generating/editing is needed, describe what you'll do
3. Suggest 1-2 alternative directions they might like

If you need to generate or edit an image, include [GENERATE] or [EDIT] tags in your response with a refined prompt.
Format: [GENERATE: detailed prompt here] or [EDIT: editing instruction here]

Current context: ${currentImageUrl ? "User has an active image they're iterating on." : "No image yet — starting fresh."}`;

      const aiMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
      ];

      // If the last user message includes an image reference, add it
      if (currentImageUrl && messages.length > 0) {
        const lastMsg = aiMessages[aiMessages.length - 1];
        if (typeof lastMsg.content === "string") {
          aiMessages[aiMessages.length - 1] = {
            role: lastMsg.role,
            content: [
              { type: "text", text: lastMsg.content },
              { type: "image_url", image_url: { url: currentImageUrl } },
            ],
          };
        }
      }

      const aiResponse = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
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
