import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AUREON_SYSTEM_PROMPT = `You are AUREON Vibe Imager — an elite AI image editing intelligence. You help users edit images with precision.

CRITICAL BEHAVIOR — CLARIFYING QUESTIONS:
When a user gives a vague or ambiguous editing instruction, you MUST ask clarifying questions before proceeding. This is the Aureon Method — gather intelligence before acting.

Examples of vague requests that NEED clarification:
- "make it better" → Ask: What aspect? Color balance, sharpness, lighting, composition?
- "change the mood" → Ask: What mood? Warm/cozy, dark/moody, bright/cheerful, cinematic?
- "fix it" → Ask: What needs fixing? Exposure, color cast, blemishes, cropping?
- "make it pop" → Ask: Increase contrast? Saturation? Add vignette? Sharpen details?
- "edit this" → Ask: What kind of edit? Color grading, retouching, style transfer, background change?

Examples of CLEAR requests that should proceed directly:
- "make the sky more blue" → Clear, proceed
- "increase brightness by 20%" → Clear, proceed  
- "remove the background" → Clear, proceed
- "add a warm orange tint" → Clear, proceed
- "crop to square" → Clear, proceed

RESPONSE FORMAT:
When you need clarification, respond with a JSON block:
\`\`\`json
{"action":"clarify","questions":["Question 1?","Question 2?"],"context":"Brief explanation of why you need more info"}
\`\`\`

When the request is clear enough to execute, respond with:
\`\`\`json
{"action":"proceed","instruction":"Refined, precise editing instruction based on user input","summary":"What I'll do in one sentence"}
\`\`\`

When just chatting (no image loaded, general advice), respond normally in plain text. Be concise (1-3 sentences).`;

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

    // ── ANALYZE: Aureon decides if it needs more info ─────────
    if (action === "analyze") {
      const { instruction, hasImage, chatHistory } = body;

      const messages: any[] = [
        { role: "system", content: AUREON_SYSTEM_PROMPT },
      ];

      // Include recent chat history for context
      if (chatHistory?.length) {
        for (const m of chatHistory.slice(-6)) {
          messages.push({ role: m.role, content: m.content });
        }
      }

      messages.push({
        role: "user",
        content: hasImage
          ? `I have an image loaded. My editing request: "${instruction}"`
          : `No image loaded yet. User says: "${instruction}"`,
      });

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
            messages,
          }),
        }
      );

      if (!aiResponse.ok) {
        if (aiResponse.status === 429)
          return new Response(JSON.stringify({ error: "Rate limited." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (aiResponse.status === 402)
          return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("Analysis failed");
      }

      const aiData = await aiResponse.json();
      const reply = aiData.choices?.[0]?.message?.content || "";

      // Try to parse JSON response
      const jsonMatch = reply.match(/```json\s*([\s\S]*?)\s*```/) || reply.match(/\{[\s\S]*"action"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const jsonStr = jsonMatch[1] || jsonMatch[0];
          const parsed = JSON.parse(jsonStr);
          return new Response(
            JSON.stringify({ type: parsed.action, ...parsed }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } catch { /* fall through to plain text */ }
      }

      // Plain text reply (general chat)
      return new Response(
        JSON.stringify({ type: "chat", reply }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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
        if (aiResponse.status === 429)
          return new Response(JSON.stringify({ error: "Rate limited. Please wait a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (aiResponse.status === 402)
          return new Response(JSON.stringify({ error: "Credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
        JSON.stringify({ editedImageUrl: urlData.publicUrl, reply: textReply || "Done! Here's your edited image." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CHAT: General editing advice (no image edit) ──────────
    if (action === "chat") {
      const { messages, currentImageUrl } = body;

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
            messages: [
              { role: "system", content: AUREON_SYSTEM_PROMPT },
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
