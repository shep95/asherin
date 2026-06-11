// code-narrative-fix — runs the CODE → NARRATIVE → FLAWS → FIX loop and
// returns both per-file before/after diffs AND a patched .zip blob.
// Consumed by ZERLAL "Fix all" button and by chat surfaces when the
// user explicitly asks "fix the bugs in this zip".
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import { runNarrativeLoop, CodeFile } from "../_shared/codeNarrativeProtocol.ts";
import { resolveKey, byokErrorResponse } from "../_shared/adminGate.ts";

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: { user }, error: uErr } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (uErr || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const {
      files,              // [{path, content}]  — direct files
      zip_base64,         // OR a base64-encoded zip
      instruction,
      fix = true,
      max_iterations = 6,
      byok = null,
    } = body || {};

    let resolved;
    try {
      resolved = await resolveKey(req, byok);
    } catch (e: any) {
      return byokErrorResponse(e, cors);
    }

    const lovableKey = Deno.env.get("LOVABLE_API_KEY") || undefined;
    const geminiKey = resolved.mode === "admin" ? (resolved.geminiKey || undefined) : undefined;

    // ── Collect input files
    let inputFiles: CodeFile[] = [];
    if (Array.isArray(files) && files.length) {
      inputFiles = files
        .filter((f: any) => f?.path && typeof f.content === "string")
        .slice(0, 60)
        .map((f: any) => ({ path: String(f.path), content: String(f.content).slice(0, 40_000) }));
    } else if (zip_base64) {
      const bytes = Uint8Array.from(atob(zip_base64), (c) => c.charCodeAt(0));
      const zip = await JSZip.loadAsync(bytes);
      const exts = /\.(ts|tsx|js|jsx|py|go|rs|java|c|cpp|h|php|rb|swift|kt|cs|sh|sql|yaml|yml|json|toml|vue|svelte)$/i;
      const entries = Object.values(zip.files).filter(
        (f: any) => !f.dir && exts.test(f.name) && !/node_modules|\.git\/|dist\/|build\//.test(f.name),
      );
      for (const e of entries.slice(0, 60)) {
        const txt = await (e as any).async("string");
        inputFiles.push({ path: (e as any).name, content: txt.slice(0, 40_000) });
      }
    }

    if (!inputFiles.length) throw new Error("Provide either files[] or zip_base64");

    // ── Run the loop
    const result = await runNarrativeLoop({
      files: inputFiles,
      instruction,
      keys: { lovableKey, geminiKey },
      fix,
      maxIterations: max_iterations,
    });

    // ── Rebuild patched zip
    let patched_zip_base64: string | undefined;
    if (fix) {
      const outZip = new JSZip();
      for (const f of result.final_files) outZip.file(f.path, f.content);
      const bin = await outZip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
      let s = "";
      for (let i = 0; i < bin.length; i++) s += String.fromCharCode(bin[i]);
      patched_zip_base64 = btoa(s);
    }

    return new Response(
      JSON.stringify({
        iterations: result.iterations,
        final_files: result.final_files,
        verdict: result.verdict,
        patched_zip_base64,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[code-narrative-fix]", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
