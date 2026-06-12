// Media-to-Code AI editor + hosted upload helper.
// - action=edit  → rewrites embed code based on plain-English instruction
// - action=host  → uploads base64 media to private bucket, returns 30-day signed URL
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const SYSTEM_PROMPT = `You are MEDIA-TO-CODE, an elite front-end engineer specialized in rewriting
HTML/CSS embed snippets for images and videos based on plain-English instructions.

CRITICAL RULES:
1. You receive the CURRENT CODE (HTML+CSS), the MEDIA TYPE (image|video), and a USER INSTRUCTION.
2. You MUST return the FULL updated HTML+CSS code — never a diff, never a partial snippet.
3. NEVER replace the actual media source (src, data URI, or {{MEDIA_SRC}} placeholder). Preserve it byte-for-byte.
4. Keep the snippet self-contained: one root <div class="m2c-wrap">, an inline <style>, and the <img>/<video> tag.
5. Stay responsive — prefer max-width:100%, aspect-ratio, object-fit.
6. Output ONLY a single JSON object, no prose, no markdown fences:
   {"code":"<full new html/css>","summary":"one sentence describing the change","notes":"optional accessibility/perf tip or empty string"}
7. If the instruction is ambiguous or destructive (e.g. "delete the video"), respond with:
   {"clarify":"short clarifying question","summary":""}
8. Never invent external scripts, CDN imports, or tracking pixels.
9. Honor previous edit history — additive changes should preserve earlier styling unless the user explicitly overrides it.`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");
    const userId = userData.user.id;

    const body = await req.json();
    const action = body.action as string;

    // ── HOST: upload base64 → private bucket → 30-day signed URL ───────────
    if (action === "host") {
      const { dataUri, filename } = body as { dataUri: string; filename: string };
      if (!dataUri?.startsWith("data:")) throw new Error("dataUri must be a data URI");
      const m = dataUri.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) throw new Error("Invalid data URI format");
      const mime = m[1];
      const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
      if (bin.byteLength > 25 * 1024 * 1024) throw new Error("File exceeds 25MB hosted limit");
      const safeName = (filename || "media").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
      const path = `${userId}/${Date.now()}-${safeName}`;
      const up = await supabase.storage.from("media-to-code").upload(path, bin, {
        contentType: mime, upsert: false,
      });
      if (up.error) throw new Error("Upload failed: " + up.error.message);
      const signed = await supabase.storage.from("media-to-code").createSignedUrl(path, 60 * 60 * 24 * 30);
      if (signed.error || !signed.data?.signedUrl) throw new Error("Signed URL failed");
      return new Response(JSON.stringify({ url: signed.data.signedUrl, path }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── EDIT: rewrite code via Gemini ──────────────────────────────────────
    if (action === "edit") {
      const { instruction, currentCode, mediaType, history } = body as {
        instruction: string; currentCode: string; mediaType: "image" | "video";
        history?: { instruction: string; summary: string }[];
      };
      if (!instruction || !currentCode) throw new Error("Missing instruction or currentCode");

      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY_APP not configured");

      const histBlock = (history && history.length)
        ? "\n\nPRIOR EDITS (oldest → newest):\n" + history.slice(-8).map((h, i) =>
            `${i + 1}. "${h.instruction}" → ${h.summary}`).join("\n")
        : "";

      const userMessage =
        `MEDIA TYPE: ${mediaType}\n\nCURRENT CODE:\n\`\`\`html\n${currentCode}\n\`\`\`${histBlock}\n\nUSER INSTRUCTION: ${instruction}`;

      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: userMessage }] }],
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
          }),
        },
      );
      if (!r.ok) {
        const errBody = await r.text();
        console.error("Gemini error", r.status, errBody);
        if (r.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        throw new Error(`AI failed (${r.status})`);
      }
      const data = await r.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      let parsed: any = null;
      try { parsed = JSON.parse(raw); }
      catch {
        const m2 = raw.match(/\{[\s\S]*\}/);
        if (m2) { try { parsed = JSON.parse(m2[0]); } catch {} }
      }
      if (!parsed) throw new Error("AI returned unparseable output");
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (e) {
    console.error("media-to-code error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
