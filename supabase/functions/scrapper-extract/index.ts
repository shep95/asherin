import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts
let corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://aureonai.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Vary": "Origin",
};

serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
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

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user) throw new Error("Not authenticated");

    const { fileId, fileName, fileType, fileBase64, sessionId } = await req.json();
    if (!fileId || !fileBase64) throw new Error("Missing file data");

    console.log(`[SCRAPPER] Extracting text from: ${fileName} (${fileType})`);

    // Use Gemini to extract text from the document
    const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP");
    if (!apiKey) throw new Error("No AI API key configured");

    // Determine MIME type for Gemini
    let mimeType = fileType || "application/octet-stream";
    if (mimeType === "unknown") {
      const ext = fileName.split(".").pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        pdf: "application/pdf",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        bmp: "image/bmp",
        tiff: "image/tiff",
        tif: "image/tiff",
        txt: "text/plain",
        csv: "text/csv",
        html: "text/html",
        xml: "text/xml",
        json: "application/json",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ppt: "application/vnd.ms-powerpoint",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      };
      mimeType = mimeMap[ext || ""] || "application/octet-stream";
    }

    // For plain text files, just decode directly
    if (mimeType.startsWith("text/") || mimeType === "application/json") {
      const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
      const extractedText = new TextDecoder().decode(bytes);

      await supabaseAdmin
        .from("scrapper_files")
        .update({ extracted_text: extractedText, status: "completed" })
        .eq("id", fileId);

      // Update session stats
      await updateSessionStats(supabaseAdmin, sessionId);

      return new Response(JSON.stringify({ extractedText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For images, PDFs, and documents — use Gemini Vision (with retry)
    const maxRetries = 4;
    let geminiResp: Response | null = null;
    let lastError = "";

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      geminiResp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    inlineData: {
                      mimeType,
                      data: fileBase64,
                    },
                  },
                  {
                    text: `You are a document text extraction engine. Extract ALL text content from this document/image exactly as it appears. Preserve the original structure, formatting, line breaks, and order. Do not summarize, interpret, or add commentary. If the document contains tables, preserve them in a readable text format. If there are multiple pages, extract text from all pages. If the document is an image with text (OCR), extract all visible text. Output ONLY the raw extracted text, nothing else.`,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 65536,
            },
          }),
        }
      );

      if (geminiResp.ok) break;

      lastError = await geminiResp.text();

      if ((geminiResp.status === 503 || geminiResp.status === 429) && attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.warn(`[SCRAPPER] Gemini ${geminiResp.status} (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }

      console.error("[SCRAPPER] Gemini error:", lastError);
      throw new Error(`AI extraction failed: ${geminiResp.status}`);
    }

    if (!geminiResp || !geminiResp.ok) {
      throw new Error(`AI extraction failed after ${maxRetries} attempts`);
    }

    const geminiData = await geminiResp.json();
    const extractedText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    console.log(`[SCRAPPER] Extracted ${extractedText.length} characters from ${fileName}`);

    // Save extracted text to DB
    await supabaseAdmin
      .from("scrapper_files")
      .update({ extracted_text: extractedText, status: "completed" })
      .eq("id", fileId);

    // Update session stats
    await updateSessionStats(supabaseAdmin, sessionId);

    return new Response(JSON.stringify({ extractedText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[SCRAPPER] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

async function updateSessionStats(admin: any, sessionId: string) {
  const { data: allFiles } = await admin
    .from("scrapper_files")
    .select("extracted_text")
    .eq("session_id", sessionId);

  const totalFiles = allFiles?.length || 0;
  const totalTextLength = allFiles?.reduce(
    (sum: number, f: any) => sum + (f.extracted_text?.length || 0),
    0
  ) || 0;

  await admin
    .from("scrapper_sessions")
    .update({ total_files: totalFiles, total_text_length: totalTextLength })
    .eq("id", sessionId);
}
