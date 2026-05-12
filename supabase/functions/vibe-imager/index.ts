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

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  if (req.method !== 'OPTIONS') {
    try {
      const _b = await req.clone().json().catch(() => ({} as any));
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      await _gate.resolveKey(req, _byok);
    } catch (_e) {
      const _gate = await import('../_shared/adminGate.ts');
      return _gate.byokErrorResponse(_e, (globalThis as any).corsHeaders ?? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
    }
  }

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

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY_APP not configured");

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

      const chatContent = messages.map((m: any) => `${m.role === "system" ? "[System]" : m.role === "user" ? "[User]" : "[Assistant]"}: ${m.content}`).join("\n\n");
      const aiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: chatContent }] }],
            systemInstruction: { parts: [{ text: AUREON_SYSTEM_PROMPT }] },
          }),
        }
      );

      if (!aiResponse.ok) {
        if (aiResponse.status === 429)
          return new Response(JSON.stringify({ error: "Rate limited." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("Analysis failed");
      }

      const aiData = await aiResponse.json();
      const reply = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Try to parse JSON response — multiple strategies
      let parsed: any = null;

      // Strategy 1: ```json ... ``` fenced block
      const fenceMatch = reply.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (fenceMatch) {
        try { parsed = JSON.parse(fenceMatch[1].trim()); } catch {}
      }

      // Strategy 2: Raw JSON object with "action" key
      if (!parsed) {
        const rawMatch = reply.match(/\{[^{}]*"action"\s*:\s*"[^"]+?"[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/s);
        if (rawMatch) {
          try { parsed = JSON.parse(rawMatch[0]); } catch {}
        }
      }

      // Strategy 3: Find any JSON object in the reply
      if (!parsed) {
        const anyJson = reply.match(/\{[\s\S]*\}/);
        if (anyJson) {
          try {
            const candidate = JSON.parse(anyJson[0]);
            if (candidate.action) parsed = candidate;
          } catch {}
        }
      }

      if (parsed?.action) {
        return new Response(
          JSON.stringify({ type: parsed.action, ...parsed }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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

      // Fetch image and convert to base64 if it's a URL
      let imageBase64 = "";
      let imageMimeType = "image/jpeg";
      if (imageUrl.startsWith("data:")) {
        const match = imageUrl.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          imageMimeType = match[1];
          imageBase64 = match[2];
        } else {
          throw new Error("Invalid data URL format");
        }
      } else {
        const imgResp = await fetch(imageUrl);
        if (!imgResp.ok) throw new Error("Failed to fetch image from storage");
        const contentType = imgResp.headers.get("content-type") || "image/jpeg";
        imageMimeType = contentType.split(";")[0].trim();
        const arrayBuf = await imgResp.arrayBuffer();
        const bytes = new Uint8Array(arrayBuf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        imageBase64 = btoa(binary);
      }

      // Use image generation model for actual editing
      const imageModels = [
        "gemini-2.5-flash-image",
        "gemini-3.1-flash-image-preview",
        "gemini-3-pro-image-preview",
      ];

      for (const model of imageModels) {
        try {
          console.log(`Trying image edit with ${model}...`);
          const aiResponse = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{
                  role: "user",
                  parts: [
                    { text: instruction },
                    { inline_data: { mime_type: imageMimeType, data: imageBase64 } },
                  ],
                }],
                generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
              }),
            }
          );

          if (!aiResponse.ok) {
            if (aiResponse.status === 429) {
              return new Response(JSON.stringify({ error: "Rate limited. Please wait a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            const errText = await aiResponse.text();
            console.warn(`${model} failed (${aiResponse.status}):`, errText.slice(0, 300));
            continue;
          }

          const aiData = await aiResponse.json();
          const parts = aiData.candidates?.[0]?.content?.parts || [];

          // Look for image in response
          for (const part of parts) {
            if (part.inlineData?.mimeType?.startsWith("image/")) {
              const editedImageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              console.log(`Image edit succeeded with ${model}`);
              return new Response(
                JSON.stringify({ editedImageUrl, reply: "Image edited successfully." }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }

          // Model returned text only
          const textReply = parts.find((p: any) => p.text)?.text || "";
          if (textReply) {
            return new Response(
              JSON.stringify({ reply: textReply, editedImageUrl: null }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch (e) {
          console.warn(`${model} error:`, e);
        }
      }

      throw new Error("Image editing failed — all models exhausted");
    }

    // ── CHAT: General editing advice (no image edit) ──────────
    if (action === "chat") {
      const { messages, currentImageUrl } = body;

      const chatContent2 = messages.map((m: any) => `${m.role === "system" ? "[System]" : m.role === "user" ? "[User]" : "[Assistant]"}: ${m.content}`).join("\n\n");
      const aiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: chatContent2 }] }],
            systemInstruction: { parts: [{ text: AUREON_SYSTEM_PROMPT }] },
          }),
        }
      );

      if (!aiResponse.ok) {
        if (aiResponse.status === 429)
          return new Response(JSON.stringify({ error: "Rate limited." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("Chat failed");
      }

      const aiData = await aiResponse.json();
      const reply = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

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
