import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { CODE_SCAN_CHECKLIST } from "../_shared/codeScanChecklist.ts";
import { callByokJsonWithRetry, type ZophielByokConfig } from "../_shared/zophielByokRouter.ts";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

async function fetchGitHubContent(url: string): Promise<string> {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
  if (!match) throw new Error("Invalid GitHub URL format. Use: https://github.com/owner/repo");

  const [, owner, repo] = match;
  const cleanRepo = repo.replace(/\.git$/, "");
  
  console.log("[ZERLAL] Fetching GitHub tree for", owner, "/", cleanRepo);
  
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
  const codeExts = [".ts",".tsx",".js",".jsx",".py",".go",".rs",".java",".c",".cpp",".h",".php",".rb",".swift",".kt",".cs",".sh",".sql",".yaml",".yml",".json",".toml",".tf",".dockerfile",".env",".vue",".svelte"];
  const skipPaths = ["node_modules/",".git/","dist/","build/","__pycache__/",".next/","vendor/","package-lock.json","yarn.lock","bun.lock",".min.js",".min.css"];

  const codeFiles = (treeData.tree || [])
    .filter((f: any) => {
      if (f.type !== "blob" || f.size > 50000) return false;
      if (skipPaths.some((skip: string) => f.path.includes(skip))) return false;
      return codeExts.some((ext: string) => f.path.endsWith(ext));
    })
    .sort((a: any, b: any) => {
      const secKeywords = ["auth","login","password","token","session","crypto","encrypt","middleware","api","route","handler","config","env","secret","key"];
      const aScore = secKeywords.filter((s: string) => a.path.toLowerCase().includes(s)).length;
      const bScore = secKeywords.filter((s: string) => b.path.toLowerCase().includes(s)).length;
      return bScore - aScore;
    })
    .slice(0, 40);

  console.log("[ZERLAL] Found", codeFiles.length, "code files to analyze");

  let allContent = "";
  let fetchedCount = 0;
  for (const file of codeFiles) {
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${cleanRepo}/HEAD/${file.path}`;
      const fileResp = await fetch(rawUrl);
      if (fileResp.ok) {
        const text = await fileResp.text();
        allContent += `\n--- FILE: ${file.path} ---\n${text}\n`;
        fetchedCount++;
      }
    } catch { /* skip */ }
    if (allContent.length > 60000) break;
  }

  console.log("[ZERLAL] Fetched", fetchedCount, "files, total size:", allContent.length);
  if (!allContent) throw new Error("No code files found in repository. Make sure the repo is public and contains code.");
  return allContent;
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
          const codeExt = /\.(ts|tsx|js|jsx|py|go|rs|java|c|cpp|h|php|rb|swift|kt|cs|sh|sql|ya?ml|json|toml|tf|vue|svelte|html|css|md|env|dockerfile|lock)$/i;
          const securityHints = /auth|login|password|token|session|crypto|encrypt|middleware|api|route|handler|config|env|secret|key|permission|policy|payment|webhook|storage|upload/i;
          const totalEntries = zipEntries.length;
          const candidates = zipEntries
          .filter((entry: any) => {
            const path = entry?.filename || "";
            if (entry?.directory || path.endsWith("/")) return false;
            if (skip.test("/" + path)) return false;
            if ((entry?.uncompressedSize || entry?.size || 0) > 120_000) return false;
            return codeExt.test(path) || /(^|\/)dockerfile$/i.test(path);
          })
          .sort((aEntry: any, bEntry: any) => {
            const aPath = aEntry?.filename || "";
            const bPath = bEntry?.filename || "";
            const aScore = (securityHints.test(aPath) ? 100 : 0) - Math.floor((aEntry?.uncompressedSize || aEntry?.size || 0) / 25_000);
            const bScore = (securityHints.test(bPath) ? 100 : 0) - Math.floor((bEntry?.uncompressedSize || bEntry?.size || 0) / 25_000);
            return bScore - aScore;
          })
          .slice(0, 160);

          const ASSEMBLED_CAP = 1_200_000; // ~1.2MB of source text max
          const PER_FILE_CAP = 120_000;
          let assembled = "";
          let extracted = 0;
          let skipped = Math.max(0, totalEntries - candidates.length);
          for (const entry of candidates as any[]) {
          if (assembled.length >= ASSEMBLED_CAP) { skipped++; continue; }
          try {
            const path = entry?.filename || "unknown";
            const text = await entry.getData(new TextWriter("utf-8"));
            if (!text || text.length > PER_FILE_CAP) { skipped++; continue; }
            assembled += `\n--- FILE: ${path} ---\n${text}\n`;
            extracted++;
          } catch {
            skipped++;
          }
        }
          await zipReader.close().catch(() => undefined);
          codeToAnalyze = `ZIP SOURCE: ${source_storage_path}\nFILES_EXTRACTED_FOR_SECURITY_AUDIT: ${extracted}\nFILES_SKIPPED_OR_DEPRIORITIZED: ${skipped}\nTOTAL_ENTRIES: ${totalEntries}\n${assembled}`;
          console.log("[ZERLAL] ZIP extracted:", extracted, "files,", assembled.length, "chars, skipped:", skipped, "of total:", totalEntries);
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
      console.log("[ZERLAL] Fetching code from GitHub:", github_url);
      codeToAnalyze = await fetchGitHubContent(github_url);
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
    const totalLen = codeToAnalyze.length;
    const chunkCount = Math.max(1, Math.ceil(totalLen / profile.chunk_size));

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
      const start = normalizedIndex * profile.chunk_size;
      const codeSlice = codeToAnalyze.substring(start, start + profile.chunk_size);
      console.log(`[ZERLAL] Section ${normalizedIndex + 1}/${chunkCount} using ${profile.provider_label} (${profile.section_timeout_ms}ms timeout)`);

      const analysis = await callScanAI(
        buildAnalysisPrompt(scan_profile, file_name, codeSlice, brainsContext),
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
      const pass2Slice = codeToAnalyze.substring(
        Math.floor(totalLen / 2),
        Math.floor(totalLen / 2) + Math.min(60000, profile.chunk_size),
      ) || codeToAnalyze.substring(Math.max(0, totalLen - profile.chunk_size));

      if (pass2Slice.trim()) {
        try {
          const pass2Prompt = `You are ZERLAL. Already found: ${existingTitles}

Find ALL additional vulnerabilities NOT listed above. Focus areas: input validation, logic flaws, race conditions, dependency risks, CORS/headers, info disclosure, access control, crypto weaknesses, DoS vectors, missing security controls, hardcoded secrets, insecure deserialization, SSRF, prototype pollution.

Return ONLY JSON: { "findings": [...] }
Each finding needs: severity, title, file_path, line_number, category, confidence, cwe_id, cvss_score, description, impact, exploitation_steps (array of strings), code_snippet, suggested_fix, dataflow_trace (array of {file,line,label}), compliance_controls (array), similar_cves (array), age_estimate_days.

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

        const { error: insertErr } = await supabase.from("zerlal_findings").insert({
          user_id: user.id,
          project_id,
          scan_id,
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
    if (body?.scan_id && body?.project_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
      await failScan(supabase, body.scan_id, body.project_id, e.message || "Unknown error");
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
    : (lovableKey ? "lovable-gateway/google-gemini-2.5-flash" : "google/gemini-2.5-flash");

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
    const reportUrl = "https://aureonai.app/dashboard/zerlal";
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

function buildAnalysisPrompt(scanProfile: string, fileName: string, code: string, brainsContext: string): string {
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

FOR EACH VULNERABILITY RETURN:
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
  systemPrompt = "You are ZERLAL. Always run the CODE → NARRATIVE → FLAWS → FIX loop internally (max 6 iterations) before responding: (1) convert every file into a plain-language narrative, (2) hunt logic/security/UI/workflow/bug flaws on the narrative, (3) when fixes are requested, regenerate code and re-narrate until zero medium+ flaws remain or 6 iterations are hit. Return ONLY valid JSON. No markdown."
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
  systemPrompt = "You are ZERLAL. Always run the CODE → NARRATIVE → FLAWS → FIX loop internally (max 6 iterations) before responding: (1) convert every file into a plain-language narrative, (2) hunt logic/security/UI/workflow/bug flaws on the narrative, (3) when fixes are requested, regenerate code and re-narrate until zero medium+ flaws remain or 6 iterations are hit. Return ONLY valid JSON. No markdown."
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
            model: "google/gemini-2.5-flash",
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
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
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
