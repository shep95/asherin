import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { CODE_SCAN_CHECKLIST } from "../_shared/codeScanChecklist.ts";
import { callByokJsonWithRetry, type ZophielByokConfig } from "../_shared/zophielByokRouter.ts";
import { CODE_NARRATIVE_PROTOCOL } from "../_shared/codeNarrativeProtocol.ts";
import { QUANTUM_ORCHESTRATION_BRAIN } from "../_shared/quantumOrchestrationBrain.ts";

const ZERLAL_SYSTEM_PROMPT = `You are ZERLAL, an elite code-security and audit engine.

${CODE_NARRATIVE_PROTOCOL}

${QUANTUM_ORCHESTRATION_BRAIN}

Return ONLY valid JSON. No markdown fences. No prose outside the JSON payload.`;

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

const CODE_EXTS = [".ts",".tsx",".js",".jsx",".py",".go",".rs",".java",".c",".cpp",".h",".php",".rb",".swift",".kt",".cs",".sh",".sql",".yaml",".yml",".json",".toml",".tf",".dockerfile",".env",".vue",".svelte"];
const SKIP_PATHS = ["node_modules/",".git/","dist/","build/","__pycache__/",".next/","vendor/","package-lock.json","yarn.lock","bun.lock",".min.js",".min.css"];
const SEC_KEYWORDS = ["auth","login","password","token","session","crypto","encrypt","middleware","api","route","handler","config","env","secret","key"];

function acceptFile(path: string, size?: number) {
  if (!path) return false;
  if (typeof size === "number" && size > 50000) return false;
  if (SKIP_PATHS.some((s) => path.includes(s))) return false;
  return CODE_EXTS.some((ext) => path.endsWith(ext));
}
function secScore(path: string) {
  const p = path.toLowerCase();
  return SEC_KEYWORDS.filter((s) => p.includes(s)).length;
}
async function assembleFiles(entries: { path: string; rawUrl: string }[]) {
  entries.sort((a, b) => secScore(b.path) - secScore(a.path)).splice(40);
  let out = "";
  let fetched = 0;
  for (const f of entries) {
    try {
      const r = await fetch(f.rawUrl);
      if (r.ok) {
        const text = await r.text();
        out += `\n--- FILE: ${f.path} ---\n${text}\n`;
        fetched++;
      }
    } catch { /* skip */ }
    if (out.length > 60000) break;
  }
  console.log("[ZERLAL] Fetched", fetched, "files, size:", out.length);
  if (!out) throw new Error("No readable code files in repository. Ensure it is public and contains source code.");
  return out;
}

async function fetchGitHubContent(url: string): Promise<string> {
  const match = url.match(/github\.com[:/]([^/]+)\/([^/#?]+)/i);
  if (!match) throw new Error("Invalid GitHub URL. Use: https://github.com/owner/repo");
  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");
  const treeResp = await fetch(`https://api.github.com/repos/${owner}/${cleanRepo}/git/trees/HEAD?recursive=1`, {
    headers: { "Accept": "application/vnd.github.v3+json", "User-Agent": "ZERLAL-Scanner" },
  });
  if (!treeResp.ok) {
    const errText = await treeResp.text();
    if (treeResp.status === 404) throw new Error(`Repository not found: ${owner}/${cleanRepo}. Make sure it's public.`);
    if (treeResp.status === 403) throw new Error("GitHub API rate limit reached. Try again in a few minutes.");
    throw new Error(`GitHub API error (${treeResp.status}): ${errText.slice(0, 200)}`);
  }
  const treeData = await treeResp.json();
  const entries = (treeData.tree || [])
    .filter((f: any) => f.type === "blob" && acceptFile(f.path, f.size))
    .map((f: any) => ({ path: f.path, rawUrl: `https://raw.githubusercontent.com/${owner}/${cleanRepo}/HEAD/${f.path}` }));
  return assembleFiles(entries);
}

async function fetchGitLabContent(url: string): Promise<string> {
  const match = url.match(/gitlab\.com[:/]([^#?]+?)(?:\.git)?(?:[/#?]|$)/i);
  if (!match) throw new Error("Invalid GitLab URL. Use: https://gitlab.com/group/project");
  const projectPath = match[1].replace(/\/+$/, "");
  const encoded = encodeURIComponent(projectPath);
  const treeResp = await fetch(`https://gitlab.com/api/v4/projects/${encoded}/repository/tree?recursive=true&per_page=100`, {
    headers: { "User-Agent": "ZERLAL-Scanner" },
  });
  if (!treeResp.ok) {
    if (treeResp.status === 404) throw new Error(`GitLab project not found or private: ${projectPath}`);
    throw new Error(`GitLab API error (${treeResp.status})`);
  }
  const tree = await treeResp.json();
  const entries = (Array.isArray(tree) ? tree : [])
    .filter((f: any) => f.type === "blob" && acceptFile(f.path))
    .map((f: any) => ({ path: f.path, rawUrl: `https://gitlab.com/${projectPath}/-/raw/HEAD/${f.path}` }));
  return assembleFiles(entries);
}

async function fetchBitbucketContent(url: string): Promise<string> {
  const match = url.match(/bitbucket\.org[:/]([^/]+)\/([^/#?]+)/i);
  if (!match) throw new Error("Invalid Bitbucket URL. Use: https://bitbucket.org/workspace/repo");
  const [, ws, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");
  let next = `https://api.bitbucket.org/2.0/repositories/${ws}/${cleanRepo}/src/HEAD/?pagelen=100&max_depth=6`;
  const entries: { path: string; rawUrl: string }[] = [];
  for (let hops = 0; hops < 8 && next; hops++) {
    const r = await fetch(next, { headers: { "User-Agent": "ZERLAL-Scanner" } });
    if (!r.ok) {
      if (r.status === 404) throw new Error(`Bitbucket repo not found or private: ${ws}/${cleanRepo}`);
      throw new Error(`Bitbucket API error (${r.status})`);
    }
    const j: any = await r.json();
    for (const it of j.values || []) {
      if (it.type === "commit_file" && acceptFile(it.path, it.size)) {
        entries.push({
          path: it.path,
          rawUrl: `https://bitbucket.org/${ws}/${cleanRepo}/raw/HEAD/${it.path}`,
        });
      }
    }
    next = j.next || "";
  }
  return assembleFiles(entries);
}

async function fetchGitContent(url: string): Promise<string> {
  const u = url.trim();
  if (/gitlab\.com/i.test(u)) return fetchGitLabContent(u);
  if (/bitbucket\.org/i.test(u)) return fetchBitbucketContent(u);
  if (/github\.com/i.test(u)) return fetchGitHubContent(u);
  throw new Error("Unsupported Git host. Supported: github.com, gitlab.com, bitbucket.org.");
}


type ScanMode = "plan" | "section" | "finalize";

interface ProviderProfile {
  provider_label: string;
  provider_timeout_ms: number;
  section_timeout_ms: number;
  chunk_size: number;
  break_seconds: number;
  probe_latency_ms: number;
}

/**
 * File-aware deterministic chunker.
 * The browser/server preamble concatenates extracted source as:
 *   "ZIP SOURCE: ...\n--- FILE: path/a.tsx ---\n<code>\n--- FILE: path/b.tsx ---\n<code>"
 * A naive substring() splitter would sever file boundaries and ship raw
 * code fragments with no filename — the AI then reports "ZIP contents not provided".
 * This splitter packs WHOLE files into ~chunk_size buckets and preserves headers.
 */
function splitIntoFileSections(code: string, chunkSize: number): { preamble: string; sections: string[] } {
  const headerRe = /^--- FILE: .+? ---$/gm;
  const firstMatch = headerRe.exec(code);
  if (!firstMatch) {
    const out: string[] = [];
    for (let i = 0; i < code.length; i += chunkSize) out.push(code.slice(i, i + chunkSize));
    return { preamble: "", sections: out.length ? out : [code] };
  }
  const preamble = code.slice(0, firstMatch.index).trim();
  const body = code.slice(firstMatch.index);

  // Collect block boundaries
  const indices: number[] = [];
  const re2 = /^--- FILE: .+? ---$/gm;
  let m: RegExpExecArray | null;
  while ((m = re2.exec(body)) !== null) indices.push(m.index);
  indices.push(body.length);

  const blocks: string[] = [];
  for (let i = 0; i < indices.length - 1; i++) blocks.push(body.slice(indices[i], indices[i + 1]));

  const sections: string[] = [];
  let current = "";
  for (const block of blocks) {
    if (block.length > chunkSize) {
      if (current) { sections.push(current); current = ""; }
      const headerEnd = block.indexOf("\n");
      const header = headerEnd > 0 ? block.slice(0, headerEnd + 1) : "--- FILE: (unknown) ---\n";
      const rest = headerEnd > 0 ? block.slice(headerEnd + 1) : block;
      const inner = Math.max(2000, chunkSize - header.length);
      for (let i = 0; i < rest.length; i += inner) sections.push(header + rest.slice(i, i + inner));
      continue;
    }
    if (current.length + block.length > chunkSize) {
      sections.push(current);
      current = block;
    } else {
      current += block;
    }
  }
  if (current) sections.push(current);
  if (sections.length === 0) sections.push(body);
  return { preamble, sections };
}

function buildSectionPayload(preamble: string, sections: string[], index: number, fileName: string): string {
  const safe = Math.max(0, Math.min(index, sections.length - 1));
  const head = `PROJECT: ${fileName || "uploaded codebase"}
SEGMENT ${safe + 1} OF ${sections.length}
${preamble ? preamble + "\n" : ""}NOTE: This segment is part of a larger uploaded codebase. The full archive WAS provided — audit the files contained in this segment as-is. Do NOT respond with "contents not provided" — analyze every '--- FILE: ... ---' block below.

`;
  return head + sections[safe];
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const token = authHeader.replace("Bearer ", "");
    // Internal server-to-server bypass (background worker): if the caller presents
    // the service-role key + matching x-internal-key + body.user_id_override, trust it.
    const internalKey = req.headers.get("x-internal-key");
    const bodyPeek = await req.clone().json().catch(() => ({}));
    let user: any;
    if (internalKey && internalKey === serviceRoleKey && bodyPeek?.user_id_override) {
      user = { id: bodyPeek.user_id_override };
    } else {
      const { data: { user: authedUser }, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !authedUser) throw new Error("Unauthorized");
      user = authedUser;
    }

    const {
      mode = "plan",
      project_id,
      scan_id,
      scan_profile,
      code_content,
      source_storage_path,
      file_name,
      github_url,
      include_workflow_function_flaws = false,
      byok = null,
      section_index = 0,
      total_sections = 1,
      aggregated_findings = [],
      first_pass_summary = "",
      first_pass_risk_grade = "F",
      provider_profile = null,
    } = await req.json();

    // BYOK PRIORITY — if caller didn't pass byok in body, auto-load their saved
    // active provider/key from user_model_preferences + user_api_keys. This makes
    // BYOK win automatically (even for admin) so we don't burn the platform key
    // when the user has their own configured.
    let effectiveByok: any = byok;
    if (!effectiveByok && authHeader) {
      try {
        const anonSb = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", { auth: { persistSession: false } });
        const { data: { user: reqUser } } = await anonSb.auth.getUser(token);
        if (reqUser) {
          const { data: pref } = await supabase
            .from("user_model_preferences")
            .select("active_provider, active_model")
            .eq("user_id", reqUser.id)
            .maybeSingle();
          const activeProvider = pref?.active_provider;
          const activeModel = pref?.active_model;
          if (activeProvider && activeProvider !== "default" && activeModel && activeModel !== "default") {
            const { data: keyRow } = await supabase
              .from("user_api_keys")
              .select("api_key")
              .eq("user_id", reqUser.id)
              .eq("provider", activeProvider)
              .eq("is_active", true)
              .maybeSingle();
            if (keyRow?.api_key) {
              effectiveByok = { provider: activeProvider, model: activeModel, apiKey: keyRow.api_key };
              console.log("[ZERLAL] Using user BYOK:", activeProvider, "/", activeModel);
            }
          }
        }
      } catch (e) {
        console.log("[ZERLAL] BYOK auto-load skipped:", (e as Error).message);
      }
    }

    // STRICT BYOK GATE — non-admin must supply a BYOK config.
    let _resolved;
    try {
      _resolved = await (await import('../_shared/adminGate.ts')).resolveKey(req, effectiveByok, { strict: true });
    } catch (e: any) {
      return (await import('../_shared/adminGate.ts')).byokErrorResponse(e, corsHeaders);
    }
    console.log("[ZERLAL] Key mode:", _resolved.mode, _resolved.mode === "byok" ? `(${_resolved.byok?.provider}/${_resolved.byok?.model})` : "(platform)");
    if (!project_id) throw new Error("project_id is required");

    console.log("[ZERLAL] Starting scan for project:", project_id, "mode:", mode, "profile:", scan_profile, "github_url:", github_url || "none");

    // Fetch code from GitHub if URL provided and no direct content
    let codeToAnalyze = code_content || "";
    if (!codeToAnalyze && source_storage_path) {
      console.log("[ZERLAL] Loading code from storage:", source_storage_path);
      const isZip = /\.zip$/i.test(source_storage_path);
      if (isZip) {
        // Server-side ZIP extraction — range-read the archive instead of loading
        // the whole ZIP into memory. This keeps large uploads under edge limits.
        console.log("[ZERLAL] Extracting ZIP server-side via range reader");
        const { data: signed, error: signedErr } = await supabase.storage
          .from("zerlal-scan-sources")
          .createSignedUrl(source_storage_path, 60 * 20);
        if (signedErr || !signed?.signedUrl) {
          throw new Error(`Failed to open stored archive: ${signedErr?.message || "no signed URL"}`);
        }

        // zip.js is Deno-edge compatible through npm: imports. Keep HTTP range
        // reads so large archives do not get loaded into memory at once.
        const { ZipReader, HttpRangeReader, BlobReader, TextWriter, configure } = await import(
          "npm:@zip.js/zip.js@2.7.72"
        );
        try { configure({ useWebWorkers: false }); } catch { /* older */ }
        let zipReader: any;
        let zipEntries: any[] = [];
        try {
          zipReader = new ZipReader(new HttpRangeReader(signed.signedUrl));
          zipEntries = await zipReader.getEntries();
        } catch (rangeErr) {
          const rangeMessage = rangeErr instanceof Error ? rangeErr.message : String(rangeErr);
          console.log("[ZERLAL] Range reader unavailable, falling back to direct download:", rangeMessage);
          const { data: archiveBlob, error: archiveErr } = await supabase.storage
            .from("zerlal-scan-sources")
            .download(source_storage_path);
          if (archiveErr || !archiveBlob) {
            throw new Error(`Failed to download stored archive: ${archiveErr?.message || rangeMessage}`);
          }
          if ((archiveBlob.size || 0) > 18_000_000) {
            throw new Error("Archive host does not support range reads and this ZIP is too large for safe fallback extraction.");
          }
          zipReader = new ZipReader(new BlobReader(archiveBlob));
          try {
            zipEntries = await zipReader.getEntries();
          } catch (blobZipErr) {
            const blobZipMessage = blobZipErr instanceof Error ? blobZipErr.message : String(blobZipErr);
            if (/end of central directory|not a zip|invalid zip/i.test(blobZipMessage) && (archiveBlob.size || 0) <= 2_000_000) {
              await zipReader.close().catch(() => undefined);
              zipReader = null;
              codeToAnalyze = await archiveBlob.text();
              console.log("[ZERLAL] Stored object was prepared text mislabeled as ZIP; continuing as text source");
            } else {
              throw blobZipErr;
            }
          }
        }

        if (!codeToAnalyze) {
          const skip = /(^|\/)(node_modules|\.git|dist|build|__pycache__|\.next|vendor|coverage|__MACOSX|\.cache|target|out|bin|obj)\//i;
          const codeExt = /\.(ts|tsx|js|jsx|mjs|cjs|py|go|rs|java|c|cc|cpp|cxx|h|hpp|hh|php|rb|swift|kt|kts|cs|sh|bash|zsh|ps1|bat|cmd|sql|ya?ml|json|jsonc|toml|tf|vue|svelte|html|css|scss|sass|less|md|mdx|env|example|sample|dockerfile|lock|txt|xml|ini|cfg|conf|properties|gradle|scala|dart|lua|zig|hcl|gitignore|sum|mod|prisma|graphql|gql|proto|makefile|cmake)$/i;
          const securityHints = /auth|login|password|token|session|crypto|encrypt|middleware|api|route|handler|config|env|secret|key|permission|policy|payment|webhook|storage|upload/i;
          const totalEntries = zipEntries.length;
          const candidates = zipEntries
            .filter((entry: any) => {
              const path = entry?.filename || "";
              if (entry?.directory || path.endsWith("/")) return false;
              if (skip.test("/" + path)) return false;
              return codeExt.test(path) || /(^|\/)dockerfile$/i.test(path);
            })
            .sort((aEntry: any, bEntry: any) => {
              const aPath = aEntry?.filename || "";
              const bPath = bEntry?.filename || "";
              const aScore = (securityHints.test(aPath) ? 100 : 0) - Math.floor((aEntry?.uncompressedSize || aEntry?.size || 0) / 25_000);
              const bScore = (securityHints.test(bPath) ? 100 : 0) - Math.floor((bEntry?.uncompressedSize || bEntry?.size || 0) / 25_000);
              return bScore - aScore;
            })
            .slice(0, 260);

          const ASSEMBLED_CAP = 2_400_000;
          const PER_FILE_CAP = 180_000;
          let assembled = "";
          let extracted = 0;
          let truncated = 0;
          let skipped = Math.max(0, totalEntries - candidates.length);
          for (const entry of candidates as any[]) {
            if (assembled.length >= ASSEMBLED_CAP) { skipped++; continue; }
            try {
              const path = entry?.filename || "unknown";
              let text = await entry.getData(new TextWriter("utf-8"));
              if (!text) { skipped++; continue; }
              if (text.length > PER_FILE_CAP) {
                text = text.slice(0, PER_FILE_CAP) + `\n/* ZERLAL_NOTE: file truncated at ${PER_FILE_CAP} characters for transport; analyze visible logic and report if full file is needed. */\n`;
                truncated++;
              }
              assembled += `\n--- FILE: ${path} ---\n${text}\n`;
              extracted++;
            } catch {
              skipped++;
            }
          }
          await zipReader.close().catch(() => undefined);
          codeToAnalyze = `ZIP SOURCE: ${source_storage_path}\nFILES_EXTRACTED_FOR_CODE_AUDIT: ${extracted}\nFILES_TRUNCATED_FOR_TRANSPORT: ${truncated}\nFILES_SKIPPED_OR_DEPRIORITIZED: ${skipped}\nTOTAL_ENTRIES: ${totalEntries}\n${assembled}`;
          console.log("[ZERLAL] ZIP extracted:", extracted, "files,", assembled.length, "chars, truncated:", truncated, "skipped:", skipped, "of total:", totalEntries);
        }
      } else {
        const { data: storedFile, error: storedFileErr } = await supabase.storage
          .from("zerlal-scan-sources")
          .download(source_storage_path);
        if (storedFileErr) {
          throw new Error(`Failed to load stored scan source: ${storedFileErr.message}`);
        }
        codeToAnalyze = await storedFile.text();
      }
    }
    if (!codeToAnalyze && github_url) {
      console.log("[ZERLAL] Fetching code from Git host:", github_url);
      codeToAnalyze = await fetchGitContent(github_url);
    }

    if (!codeToAnalyze || codeToAnalyze.trim().length < 10) {
      // Update project status to failed
      await supabase.from("zerlal_projects").update({ status: "failed" }).eq("id", project_id);
      throw new Error("No code content to analyze. Upload files or provide a valid GitHub URL.");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GEMINI_KEY = _resolved.mode === 'admin' ? (_resolved.geminiKey || '') : '';
    const BYOK = _resolved.mode === "byok" ? (_resolved.byok as ZophielByokConfig) : null;
    if (_resolved.mode === 'admin' && !LOVABLE_API_KEY && !GEMINI_KEY) {
      throw new Error("No AI API key configured");
    }

    // Load active brains for intelligence context (compact)
    let brainsContext = "";
    try {
      const { data: brains } = await supabase
        .from("axrlen_brains")
        .select("name, content")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (brains && brains.length > 0) {
        brainsContext = brains.map((b: any) => `[${b.name}]: ${b.content.substring(0, 2000)}`).join("\n");
        console.log("[ZERLAL] Loaded", brains.length, "active brains");
      }
    } catch (e) {
      console.log("[ZERLAL] Brains load skipped:", e);
    }

    const profile = provider_profile || await detectProviderProfile(_resolved, LOVABLE_API_KEY, GEMINI_KEY);
    const split = splitIntoFileSections(codeToAnalyze, profile.chunk_size);
    const totalLen = codeToAnalyze.length;
    const chunkCount = Math.max(1, split.sections.length);
    console.log(`[ZERLAL] File-aware split: ${chunkCount} segments (chunk_size=${profile.chunk_size}, preamble=${split.preamble.length}b, totalLen=${totalLen}b)`);

    if (mode === "plan") {
      const { data: scan, error: scanErr } = await supabase
        .from("zerlal_scans")
        .insert({
          user_id: user.id,
          project_id,
          scan_profile: scan_profile || "security-audit",
          status: "running",
          started_at: new Date().toISOString(),
          findings_count: 0,
        })
        .select()
        .single();

      if (scanErr) {
        console.error("[ZERLAL] Failed to create scan record:", scanErr);
        throw new Error("Failed to create scan record: " + scanErr.message);
      }

      await supabase.from("zerlal_projects").update({ status: "scanning" }).eq("id", project_id);

      return jsonResponse(corsHeaders, {
        scan_id: scan.id,
        provider_profile: profile,
        total_sections: chunkCount,
        code_length: totalLen,
        break_seconds: profile.break_seconds,
        estimated_total_seconds: Math.ceil((chunkCount * (profile.probe_latency_ms + profile.break_seconds * 1000)) / 1000),
      });
    }

    if (!scan_id) throw new Error("scan_id is required");

    if (mode === "section") {
      const normalizedIndex = Math.max(0, Math.min(section_index, chunkCount - 1));
      const codeSlice = buildSectionPayload(split.preamble, split.sections, normalizedIndex, file_name);
      console.log(`[ZERLAL] Section ${normalizedIndex + 1}/${chunkCount} (${codeSlice.length} chars) using ${profile.provider_label} (${profile.section_timeout_ms}ms timeout)`);

      const analysis = await callScanAI(
        buildAnalysisPrompt(scan_profile, file_name, codeSlice, brainsContext, Boolean(include_workflow_function_flaws)),
        _resolved,
        LOVABLE_API_KEY,
        GEMINI_KEY,
        profile.section_timeout_ms,
      );

      return jsonResponse(corsHeaders, {
        scan_id,
        section_index: normalizedIndex,
        total_sections: total_sections || chunkCount,
        findings: analysis.findings || [],
        risk_grade: normalizedIndex === 0 ? (analysis.risk_grade || "F") : undefined,
        summary: normalizedIndex === 0 ? (analysis.summary || "") : undefined,
      });
    }

    if (mode === "finalize") {
      let allFindings = dedupeFindings(Array.isArray(aggregated_findings) ? aggregated_findings : []);
      const existingTitles = allFindings.slice(0, 60).map((f: any) => f.title).join(", ");
      const midIdx = Math.floor(chunkCount / 2);
      const pass2Slice = buildSectionPayload(split.preamble, split.sections, midIdx, file_name);

      if (pass2Slice.trim()) {
        try {
          const pass2Prompt = `You are ZERLAL. Already found: ${existingTitles}

Find ALL additional ${include_workflow_function_flaws ? "security findings AND workflow/function flaws" : "security vulnerabilities"} NOT listed above. Focus areas: input validation, logic flaws, race conditions, dependency risks, CORS/headers, info disclosure, access control, crypto weaknesses, DoS vectors, missing security controls, hardcoded secrets, insecure deserialization, SSRF, prototype pollution${include_workflow_function_flaws ? ", broken user journeys, failed state transitions, dead functions, wrong data propagation, missing success/error feedback, partial-failure handling, retry gaps, navigation dead ends" : ""}.

Return ONLY JSON: { "findings": [...] }
Each finding needs: finding_type ("security"|"workflow-function"), severity, title, file_path, line_number, category, confidence, cwe_id, cvss_score, description, impact, exploitation_steps (array of strings), code_snippet, suggested_fix, dataflow_trace (array of {file,line,label}), compliance_controls (array), similar_cves (array), age_estimate_days.

CODE:\n\`\`\`\n${pass2Slice}\n\`\`\``;
          const pass2 = await callScanAI(pass2Prompt, _resolved, LOVABLE_API_KEY, GEMINI_KEY, profile.section_timeout_ms);
          allFindings = dedupeFindings([...allFindings, ...(pass2.findings || [])]);
        } catch (e: any) {
          console.log("[ZERLAL] Pass 2 non-fatal error:", e.message);
        }
      }

      await supabase.from("zerlal_findings").delete().eq("project_id", project_id);

      let criticalCount = 0, highCount = 0, mediumCount = 0, lowCount = 0, infoCount = 0;
      for (const f of allFindings) {
        const severity = (f.severity || "medium").toLowerCase();
        if (severity === "critical") criticalCount++;
        else if (severity === "high") highCount++;
        else if (severity === "medium") mediumCount++;
        else if (severity === "low") lowCount++;
        else infoCount++;

        const rawType = (f.finding_type || "security").toString().toLowerCase();
        const finding_type = rawType === "workflow-function" || rawType === "workflow_function" || rawType === "workflow"
          ? "workflow-function"
          : "security";
        const { error: insertErr } = await supabase.from("zerlal_findings").insert({
          user_id: user.id,
          project_id,
          scan_id,
          finding_type,
          severity,
          title: f.title || "Unnamed finding",
          file_path: f.file_path || file_name || "unknown",
          line_number: f.line_number || 0,
          category: f.category || "logic",
          confidence: Math.min(100, Math.max(0, f.confidence || 50)),
          age_days: f.age_estimate_days || 0,
          first_seen_at: new Date().toISOString(),
          status: "open",
          cwe_id: f.cwe_id || "",
          cvss_score: Math.min(10, Math.max(0, f.cvss_score || 0)),
          description: f.description || "",
          impact: f.impact || "",
          exploitation_steps: f.exploitation_steps || [],
          code_snippet: f.code_snippet || "",
          suggested_fix: f.suggested_fix || "",
          dataflow_trace: f.dataflow_trace || [],
          compliance_controls: f.compliance_controls || [],
          similar_cves: f.similar_cves || [],
        });
        if (insertErr) console.error("[ZERLAL] Insert error:", insertErr, "Title:", f.title);
      }

      const { data: scanRow } = await supabase.from("zerlal_scans").select("created_at").eq("id", scan_id).single();
      const duration = Math.floor((Date.now() - new Date(scanRow?.created_at || Date.now()).getTime()) / 1000);
      const riskGrade = first_pass_risk_grade || "F";
      const summary = first_pass_summary || "";

      await supabase.from("zerlal_scans").update({
        status: "complete",
        completed_at: new Date().toISOString(),
        duration,
        findings_count: allFindings.length,
        critical_count: criticalCount,
        high_count: highCount,
        medium_count: mediumCount,
        low_count: lowCount,
        info_count: infoCount,
        error: null,
      }).eq("id", scan_id);

      await supabase.from("zerlal_projects").update({
        risk_grade: riskGrade,
        last_scan_at: new Date().toISOString(),
        critical_count: criticalCount,
        high_count: highCount,
        medium_count: mediumCount,
        low_count: lowCount,
        info_count: infoCount,
        status: "complete",
      }).eq("id", project_id);

      await sendEmails({
        supabase,
        user,
        project_id,
        scan_id,
        scan_profile,
        summary,
        riskGrade,
        duration,
        allFindings,
        criticalCount,
        highCount,
        mediumCount,
        lowCount,
        infoCount,
      });

      return jsonResponse(corsHeaders, {
        scan_id,
        findings_count: allFindings.length,
        risk_grade: riskGrade,
        summary,
        duration,
      });
    }

    throw new Error(`Unsupported mode: ${mode}`);
  } catch (e: any) {
    console.error("[ZERLAL] Scan error:", e);
    const body = await safeReadBody(req);
    if (body?.project_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
      if (body?.scan_id) {
        await failScan(supabase, body.scan_id, body.project_id, e.message || "Unknown error");
      } else {
        // Plan-mode failure: no scan row yet, but still mark project failed so it doesn't hang in "scanning"
        await supabase.from("zerlal_projects").update({ status: "failed" }).eq("id", body.project_id);
      }
    }
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function failScan(supabase: any, scanId: string, projectId: string, error: string) {
  await supabase.from("zerlal_scans").update({ status: "failed", error, completed_at: new Date().toISOString() }).eq("id", scanId);
  await supabase.from("zerlal_projects").update({ status: "failed" }).eq("id", projectId);
}

async function safeReadBody(req: Request) {
  try {
    return await req.clone().json();
  } catch {
    return null;
  }
}

function jsonResponse(corsHeaders: Record<string, string>, payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function keyOf(f: any) {
  return `${(f.file_path || "").toLowerCase()}::${f.line_number || 0}::${(f.title || "").toLowerCase().trim()}`;
}

function dedupeFindings(findings: any[]) {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const finding of findings) {
    const key = keyOf(finding);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(finding);
    }
  }
  return out;
}

async function detectProviderProfile(resolved: any, lovableKey: string | undefined, geminiKey: string | undefined): Promise<ProviderProfile> {
  const providerLabel = resolved.mode === "byok"
    ? `${resolved.byok.provider}/${resolved.byok.model}`
    : (lovableKey ? "lovable-gateway/google-gemini-flash-latest" : "google/gemini-flash-latest");

  const baseTimeout = resolved.mode === "byok"
    ? providerTimeoutForByok(resolved.byok.provider, resolved.byok.model)
    : 55_000;

  let probeLatencyMs = 2500;
  try {
    const started = Date.now();
    await callScanAI(
      "Return ONLY JSON: {\"ok\":true}",
      resolved,
      lovableKey,
      geminiKey,
      Math.min(20_000, baseTimeout),
      "You are ZERLAL. Return ONLY valid JSON."
    );
    probeLatencyMs = Math.max(900, Date.now() - started);
  } catch (e) {
    console.log("[ZERLAL] Provider probe failed, using defaults:", (e as Error).message);
  }

  const baseChunkSize = resolved.mode === "byok"
    ? byokChunkSize(resolved.byok.provider)
    : 26000;
  const latencyFactor = probeLatencyMs > 8000 ? 0.58 : probeLatencyMs > 5000 ? 0.72 : probeLatencyMs > 3000 ? 0.84 : 1;
  const chunkSize = Math.max(12000, Math.floor(baseChunkSize * latencyFactor));

  // Section timeout: scale with provider base, allow up to 110s (client allots 140s+ per section call)
  const sectionTimeout = Math.max(30_000, Math.min(baseTimeout - 5000, 110_000));

  return {
    provider_label: providerLabel,
    provider_timeout_ms: baseTimeout,
    section_timeout_ms: sectionTimeout,
    chunk_size: chunkSize,
    break_seconds: 15,
    probe_latency_ms: probeLatencyMs,
  };
}

function providerTimeoutForByok(provider: string, model?: string) {
  const m = (model || "").toLowerCase();
  // Reasoning / slow models need much more headroom
  const isSlowReasoning =
    /^gpt-5/.test(m) || /^o\d/.test(m) || /opus/.test(m) || /reason/.test(m) || /thinking/.test(m);
  if (isSlowReasoning) return 115_000;
  switch (provider) {
    case "google": return 70_000;
    case "anthropic": return 75_000;
    case "openai":
    case "xai":
    case "deepseek":
    case "mistral":
    case "perplexity":
    case "venice":
    default: return 70_000;
  }
}

function byokChunkSize(provider: string) {
  switch (provider) {
    case "google": return 30000;
    case "anthropic": return 28000;
    case "openai": return 24000;
    case "xai": return 22000;
    case "deepseek": return 20000;
    case "mistral": return 22000;
    case "perplexity": return 18000;
    case "venice": return 20000;
    default: return 22000;
  }
}


async function sendEmails({ supabase, user, project_id, scan_id, scan_profile, summary, riskGrade, duration, allFindings, criticalCount, highCount, mediumCount, lowCount, infoCount }: any) {
  try {
    const [{ data: project }, { data: settings }] = await Promise.all([
      supabase.from("zerlal_projects").select("name").eq("id", project_id).maybeSingle(),
      supabase.from("zerlal_settings").select("alert_email, notify_critical").eq("user_id", user.id).maybeSingle(),
    ]);
    const recipient = (settings?.alert_email && settings.alert_email.trim()) || user.email;
    const projectName = project?.name || "Untitled project";
    const reportUrl = "https://asherin.com/dashboard/zerlal";
    const completedAtStr = new Date().toUTCString();

    if (!recipient) return;

    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "zerlal-scan-report",
        recipientEmail: recipient,
        idempotencyKey: `zerlal-report-${scan_id}`,
        templateData: {
          projectName,
          riskGrade,
          findingsCount: allFindings.length,
          criticalCount, highCount, mediumCount, lowCount, infoCount,
          durationSec: duration,
          scanProfile: scan_profile || "security-audit",
          summary,
          reportUrl,
          completedAt: completedAtStr,
          findings: allFindings.map((f: any) => ({
            title: f.title || "Unnamed finding",
            severity: (f.severity || "info").toLowerCase(),
            file_path: f.file_path || "",
            line_number: f.line_number || 0,
            cwe_id: f.cwe_id || "",
            cvss_score: f.cvss_score || 0,
          })),
        },
      },
    }).catch((e) => console.error("[ZERLAL] scan-report email failed:", e));

    if (criticalCount > 0 && settings?.notify_critical !== false) {
      const allCritical = allFindings
        .filter((f: any) => (f.severity || "").toLowerCase() === "critical")
        .map((f: any) => ({
          title: f.title || "Unnamed finding",
          severity: "critical",
          file_path: f.file_path || "",
          line_number: f.line_number || 0,
          cwe_id: f.cwe_id || "",
          cvss_score: f.cvss_score || 0,
        }));
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: "zerlal-critical-alert",
          recipientEmail: recipient,
          idempotencyKey: `zerlal-critical-${scan_id}`,
          templateData: {
            projectName,
            criticalCount,
            findings: allCritical,
            reportUrl,
            completedAt: completedAtStr,
          },
        },
      }).catch((e) => console.error("[ZERLAL] critical-alert email failed:", e));
    }
  } catch (mailErr) {
    console.error("[ZERLAL] Email dispatch error (non-fatal):", mailErr);
  }
}

function buildAnalysisPrompt(scanProfile: string, fileName: string, code: string, brainsContext: string, includeWorkflowFunctionFlaws = false): string {
  const workflowAddendum = includeWorkflowFunctionFlaws
    ? `\n14. WORKFLOW/FUNCTION FLAWS (broken user journeys, dead/unreachable functions, failed state transitions, wrong data propagation between modules, missing success/error feedback, partial-failure handling, retry gaps, navigation dead ends, contract mismatches between caller and callee signatures, columns referenced that don't exist, payloads that don't round-trip end-to-end)\n`
    : "";
  const findingTypeLine = includeWorkflowFunctionFlaws
    ? `- finding_type: "security" for vulnerabilities, "workflow-function" for workflow / function / UX / contract flaws`
    : `- finding_type: always "security"`;
  return `You are ZERLAL, an elite vulnerability intelligence engine. Adopt the adversary's Zero-Point Perspective — every component is a potential exploit vector. Simulate both old-school and modern attack techniques.

SCAN PROFILE: ${scanProfile || "security-audit"}
FILE: ${fileName || "multi-file codebase"}
${brainsContext ? `\nINTELLIGENCE CONTEXT:\n${brainsContext}\n` : ""}

${CODE_SCAN_CHECKLIST}

SCAN CATEGORIES:
1. INJECTION (SQL, XSS, command, path traversal, SSRF, template, prompt injection)
2. AUTH (bypass, IDOR, CSRF, broken sessions, privilege escalation, JWT mishandling)
3. SECRETS (hardcoded API keys, tokens, passwords, connection strings)
4. CRYPTO (weak algorithms, hardcoded keys, insecure random, missing encryption)
5. CONFIG (debug endpoints, CORS misconfiguration, missing security headers, TLS issues)
6. DEPENDENCIES (known CVEs, outdated packages, typosquatting, supply chain risks)
7. LOGIC (business logic flaws, race conditions, error handling leaks, info disclosure)
8. MEMORY-SAFETY (buffer overflow, use-after-free, integer overflow)
9. AI-SECURITY (prompt injection, insecure output handling, excessive agency)
10. ZERO-TRUST (implicit trust, missing mTLS, overprivileged accounts)
11. CROSS-DOMAIN (CORS bypass, SOP bypass, postMessage abuse, site spoofing, open redirect, reload/redirect leaks)
12. CONCEALMENT (audit-disabling, steganography, obfuscation, anti-analysis)
13. OTHER (catch-all — anything suspicious, sloppy, non-idiomatic, or "just not good" that doesn't cleanly fit above; NEVER drop a finding because it doesn't have a category)
${workflowAddendum}
FOR EACH VULNERABILITY RETURN:
${findingTypeLine}
- severity: "critical"|"high"|"medium"|"low"|"info"
- title: Clear specific title
- file_path: Exact file path
- line_number: Approximate line
- category: Short form from above (e.g. "injection", "auth", "secrets")
- confidence: 0-100
- cwe_id: e.g. "CWE-89"
- cvss_score: 0.0-10.0
- description: Technical explanation
- impact: What attacker achieves
- exploitation_steps: Array of 3-7 specific step-by-step attack instructions
- code_snippet: The vulnerable code
- suggested_fix: The fixed code
- dataflow_trace: Array of {file, line, label}
- compliance_controls: Array e.g. ["NIST 800-53 AC-6", "SOC2 CC6.1"]
- similar_cves: Array of CVE IDs
- age_estimate_days: Estimated vulnerability age

RULES:
- Find ALL vulnerabilities — do NOT limit count
- Be AGGRESSIVE — better to flag than miss
- exploitation_steps must be specific enough for a developer to understand the attack
- Even simple code has config/dependency risks — always report something

Return ONLY JSON (no markdown):
{
  "findings": [...],
  "risk_grade": "A"|"B"|"C"|"D"|"F",
  "summary": "2-3 sentence executive summary",
  "quantum_status": "safe"|"vulnerable"|"unknown",
  "supply_chain_risks": number,
  "compliance_gaps": ["framework names"],
  "zero_trust_score": number,
  "total_files_analyzed": number,
  "scan_depth": "surface"|"standard"|"deep"
}

CODE:
\`\`\`
${code}
\`\`\``;
}

async function callScanAI(
  prompt: string,
  resolved: any,
  lovableKey: string | undefined,
  geminiKey: string | undefined,
  timeoutMs = 55_000,
  systemPrompt = ZERLAL_SYSTEM_PROMPT
): Promise<any> {
  if (resolved.mode === "byok" && resolved.byok) {
    const text = await callByokJsonWithRetry(resolved.byok as ZophielByokConfig, systemPrompt, prompt, {
      attempts: 3,
      timeoutMs,
      temperature: 0.1,
      maxOutputTokens: 32000,
      jsonMode: true,
    });
    if (!text.trim()) throw new Error("Empty BYOK response");
    return parseFindings(text);
  }

  return callAI(prompt, lovableKey, geminiKey, timeoutMs, systemPrompt);
}

async function callAI(
  prompt: string,
  lovableKey: string | undefined,
  geminiKey: string | undefined,
  timeoutMs = 55_000,
  systemPrompt = ZERLAL_SYSTEM_PROMPT
): Promise<any> {
  // Try Lovable AI Gateway first
  if (lovableKey) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log("[ZERLAL] AI attempt", attempt + 1, "via Lovable Gateway");
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), timeoutMs);
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${lovableKey}`,
          },
          signal: ctl.signal,
          body: JSON.stringify({
            model: "google/gemini-flash-latest",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 32000,
          }),
        });
        clearTimeout(timer);

        if (resp.ok) {
          const data = await resp.json();
          const text = data.choices?.[0]?.message?.content || "";
          if (!text.trim()) throw new Error("Empty AI response");
          return parseFindings(text);
        }

        const errText = await resp.text();
        console.log("[ZERLAL] Lovable AI error", resp.status, ":", errText.slice(0, 200));

        if (resp.status === 402) throw new Error("AI credits exhausted. Please add credits.");
        if (resp.status === 429 || resp.status === 500 || resp.status === 503) {
          if (attempt < 2) {
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000));
            continue;
          }
          // Fall through to Gemini
          break;
        }
        throw new Error(`AI error: ${errText.slice(0, 200)}`);
      } catch (err: any) {
        if (err.message.includes("credits")) throw err;
        console.log("[ZERLAL] Lovable attempt", attempt + 1, "failed:", err.message);
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 2000));
          continue;
        }
      }
    }
  }

  // Fallback to Gemini
  if (geminiKey) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        console.log("[ZERLAL] AI attempt via Gemini fallback");
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), timeoutMs);
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: ctl.signal,
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 32000 },
            }),
          }
        );
        clearTimeout(timer);

        if (resp.ok) {
          const data = await resp.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
          if (!text.trim()) throw new Error("Empty Gemini response");
          return parseFindings(text);
        }

        const errText = await resp.text();
        console.log("[ZERLAL] Gemini error", resp.status, ":", errText.slice(0, 200));
        if (attempt < 1) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        throw new Error(`Gemini API error: ${resp.status}`);
      } catch (err: any) {
        if (attempt < 1) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
        throw err;
      }
    }
  }

  throw new Error("All AI providers failed. Please try again.");
}

function parseFindings(text: string): any {
  if (!text || !text.trim()) throw new Error("Empty AI response");

  // Strip reasoning / thinking blocks some models leak
  let cleaned = text
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<ant_thinking>[\s\S]*?<\/ant_thinking>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .trim();

  // Prefer the LAST fenced ```json``` block (often the final answer)
  const fences = [...cleaned.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  const candidates: string[] = [];
  if (fences.length) candidates.push(fences[fences.length - 1][1]);
  candidates.push(cleaned);

  const tryParse = (raw: string): any => {
    const repaired = raw
      .replace(/^\uFEFF/, "")
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
    return JSON.parse(repaired);
  };

  for (const c of candidates) {
    const s = c.trim();
    // Extract balanced top-level { ... } or [ ... ]
    const startIdx = (() => {
      const b = s.indexOf("{");
      const a = s.indexOf("[");
      if (b === -1) return a;
      if (a === -1) return b;
      return Math.min(a, b);
    })();
    if (startIdx === -1) continue;

    const open = s[startIdx];
    const close = open === "{" ? "}" : "]";
    let depth = 0, inStr = false, esc = false, end = -1;
    for (let i = startIdx; i < s.length; i++) {
      const ch = s[i];
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === open) depth++;
      else if (ch === close) { depth--; if (depth === 0) { end = i; break; } }
    }

    const slice = end !== -1 ? s.slice(startIdx, end + 1) : s.slice(startIdx);
    try { return tryParse(slice); } catch { /* try next */ }

    // Auto-close unbalanced braces/brackets as a last resort
    if (end === -1) {
      let opens = 0, brOpens = 0, inS = false, es = false;
      for (let i = startIdx; i < s.length; i++) {
        const ch = s[i];
        if (es) { es = false; continue; }
        if (ch === "\\") { es = true; continue; }
        if (ch === '"') { inS = !inS; continue; }
        if (inS) continue;
        if (ch === "{") opens++; else if (ch === "}") opens--;
        else if (ch === "[") brOpens++; else if (ch === "]") brOpens--;
      }
      let patched = s.slice(startIdx).replace(/,\s*$/, "");
      if (inS) patched += '"';
      while (brOpens-- > 0) patched += "]";
      while (opens-- > 0) patched += "}";
      try { return tryParse(patched); } catch { /* fall through */ }
    }
  }

  console.log("[ZERLAL] parseFindings failed. Preview:", cleaned.slice(0, 500));
  throw new Error("No valid JSON found in AI response");
}
