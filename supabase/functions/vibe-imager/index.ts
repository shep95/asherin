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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");
    const userId = userData.user.id;

    const body = await req.json();
    const { action } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // ── EDIT: AI edits an image based on instruction ──────────
    if (action === "edit") {
      const { instruction, imageUrl, projectId } = body;
      if (!imageUrl) throw new Error("No image URL provided");
      if (!instruction) throw new Error("No instruction provided");

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
            JSON.stringify({ error: "Rate limited. Please wait a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (aiResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: "Credits exhausted." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const errText = await aiResponse.text();
        console.error("AI image edit error:", aiResponse.status, errText);
        throw new Error("Image editing failed");
      }

      const aiData = await aiResponse.json();
      const editedImageBase64 = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      const textReply = aiData.choices?.[0]?.message?.content || "";

      if (!editedImageBase64) {
        return new Response(
          JSON.stringify({ reply: textReply || "I couldn't edit the image. Try a different instruction.", editedImageUrl: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upload the edited image to storage
      const base64Data = editedImageBase64.replace(/^data:image\/\w+;base64,/, "");
      const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const fileName = `${userId}/${projectId}/${crypto.randomUUID()}.png`;

      const { error: uploadErr } = await supabase.storage
        .from("vibe-imager")
        .upload(fileName, binaryData, { contentType: "image/png", upsert: false });

      if (uploadErr) {
        console.error("Upload error:", uploadErr);
        throw new Error("Failed to save edited image");
      }

      const { data: urlData } = supabase.storage.from("vibe-imager").getPublicUrl(fileName);

      return new Response(
        JSON.stringify({
          editedImageUrl: urlData.publicUrl,
          reply: textReply || "Done! Here's your edited image.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CHAT: General editing advice (no image edit) ──────────
    if (action === "chat") {
      const { messages, currentImageUrl } = body;

      const systemPrompt = `You are AUREON Vibe Imager — an AI image editing assistant. Users upload images and ask you to edit them.

Your role:
- Help users describe what edits they want
- Suggest creative directions and improvements
- Be concise (1-3 sentences)
- When users describe an edit, tell them you'll apply it

${currentImageUrl ? "The user currently has an image loaded." : "No image loaded yet. Ask them to upload one."}`;

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
            messages: [
              { role: "system", content: systemPrompt },
              ...messages,
            ],
          }),
        }
      );

      if (!aiResponse.ok) {
        if (aiResponse.status === 429)
          return new Response(JSON.stringify({ error: "Rate limited." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (aiResponse.status === 402)
          return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
