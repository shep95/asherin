// Library extraction — OCR / text pull for a single library file.
//
// The browser never ships the file bytes here: it hands us a library_files row
// id, we pull the object out of storage with the service role after proving the
// caller owns the row, extract text, mask anything credential-shaped, and write
// the result back. Plain text decodes locally; images / pdf / office go through
// the same vision path the File Scrapper uses.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const MAX_CHARS = 200_000;

const SECRET_PATTERNS: RegExp[] = [
  /\b(sk|pk|rk|api|key|token|bearer|secret|pat|ghp|gho|ghu|ghs|xoxb|xoxp)[-_a-z]*[=:\s]*["']?[A-Za-z0-9_\-]{16,}/gi,
  /\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\b/g,
  /\bAIza[0-9A-Za-z_\-]{20,}\b/g,
  /\b(?:password|passphrase|totp|otp|seed|mnemonic|private[_\- ]key)\s*[:=]\s*\S+/gi,
  /-----BEGIN[^-]{0,40}PRIVATE KEY-----[\s\S]*?-----END[^-]{0,40}PRIVATE KEY-----/g,
];

/** Credentials must never become searchable corpus. */
function maskSecrets(raw: string): string {
  let s = raw;
  for (const re of SECRET_PATTERNS) s = s.replace(re, "[redacted]");
  return s;
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", bmp: "image/bmp", tiff: "image/tiff", tif: "image/tiff",
  txt: "text/plain", md: "text/markdown", csv: "text/csv", html: "text/html", xml: "text/xml",
  json: "application/json",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const rawBody = await req.json().catch(() => ({}));
    const fileId = typeof rawBody?.fileId === "string" ? rawBody.fileId : "";
    if (!/^[0-9a-f-]{36}$/i.test(fileId)) return json({ error: "fileId must be a uuid" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(SUPABASE_URL, ANON);
    const { data: authData } = await anonClient.auth.getUser(token);
    const user = authData?.user;
    if (!user) return json({ error: "Not authenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SRK);
    const { data: row } = await admin
      .from("library_files")
      .select("id,user_id,file_name,file_type,storage_path,file_size")
      .eq("id", fileId)
      .maybeSingle();

    // Ownership is checked here, not trusted from the client.
    if (!row || row.user_id !== user.id) return json({ error: "Not found" }, 404);

    const fail = async (status: string, reason: string) => {
      await admin.from("library_files").update({ text_status: status, text_chars: 0 }).eq("id", fileId);
      return json({ status, reason });
    };

    const { data: blob, error: dlErr } = await admin.storage.from("library").download(row.storage_path);
    if (dlErr || !blob) return await fail("failed", dlErr?.message ?? "download failed");

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const ext = String(row.file_name).split(".").pop()?.toLowerCase() ?? "";
    let mime = row.file_type && row.file_type !== "application/octet-stream"
      ? row.file_type
      : (MIME_BY_EXT[ext] ?? "application/octet-stream");
    if (mime === "application/octet-stream" && MIME_BY_EXT[ext]) mime = MIME_BY_EXT[ext];

    let text = "";

    if (mime.startsWith("text/") || mime === "application/json" || mime === "text/markdown") {
      text = new TextDecoder().decode(bytes);
    } else if (/^image\/|^application\/pdf|officedocument|ms-?(word|excel|powerpoint)/i.test(mime)) {
      // Vision / OCR path — key resolution follows the platform rule
      // (admin → platform key, BYOK user → their own, otherwise refuse).
      let apiKey = "";
      try {
        const gate = await import("../_shared/adminGate.ts");
        const resolved = await gate.resolveKey(req, rawBody?.byok);
        apiKey = resolved.mode === "byok" ? (resolved.byok?.apiKey ?? "") : (resolved.geminiKey ?? "");
      } catch {
        apiKey = "";
      }
      if (!apiKey) return await fail("unsupported", "no key available for OCR");
      if (bytes.length > 18 * 1024 * 1024) return await fail("unsupported", "file too large for OCR");

      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: AbortSignal.timeout(90_000),
          body: JSON.stringify({
            contents: [{
              parts: [
                { inlineData: { mimeType: mime, data: toBase64(bytes) } },
                { text: "Extract ALL text from this document exactly as it appears. Preserve order, line breaks and table structure as plain text. Do not summarize or comment. Output only the extracted text." },
              ],
            }],
            generationConfig: { temperature: 0, maxOutputTokens: 32768 },
          }),
        },
      );
      if (!resp.ok) {
        const detail = await resp.text();
        console.error(`[library-extract] vision failed [${resp.status}]: ${detail.slice(0, 400)}`);
        return await fail("failed", `extraction failed (${resp.status})`);
      }
      const data = await resp.json();
      text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } else {
      return await fail("unsupported", `no extractor for ${mime}`);
    }

    text = maskSecrets(text).slice(0, MAX_CHARS).trim();
    const status = text.length > 0 ? "ok" : "empty";

    await admin.from("library_files")
      .update({ extracted_text: text || null, text_status: status, text_chars: text.length })
      .eq("id", fileId);

    return json({ status, chars: text.length });
  } catch (err) {
    console.error("[library-extract] error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
