// ZACOON-RUN — real browser-task execution backend.
// Tries Firecrawl if FIRECRAWL_API_KEY exists, otherwise falls back to native fetch + Gemini extraction.
// Also exposes a "recon" mode that returns infrastructure intelligence (DNS / TLS / WAF / headers / surface).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts
let corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://aureonai.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Vary": "Origin",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP");
const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY");

interface Step { ts: number; type: string; detail: string; data?: unknown }

const j = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function gemini(prompt: string, system: string | undefined, apiKey: string): Promise<string> {
  if (!apiKey) throw new Error("No Gemini API key available — add a BYOK key in Settings.");
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 16384 },
      }),
    },
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function firecrawlScrape(url: string, formats: string[] = ["markdown", "links"]) {
  const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats, onlyMainContent: true }),
  });
  if (!r.ok) throw new Error(`Firecrawl ${r.status}: ${await r.text()}`);
  return r.json();
}

async function firecrawlMap(url: string) {
  const r = await fetch("https://api.firecrawl.dev/v2/map", {
    method: "POST",
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, limit: 200, includeSubdomains: true }),
  });
  if (!r.ok) throw new Error(`Firecrawl ${r.status}: ${await r.text()}`);
  return r.json();
}

async function nativeScrape(url: string): Promise<{ markdown: string; links: string[]; status: number; headers: Record<string,string> }> {
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ZacoonBot/1.0; +https://aureonai.app)",
      "Accept": "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  const headers: Record<string,string> = {};
  r.headers.forEach((v, k) => { headers[k] = v; });
  const html = await r.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80_000);
  const links = Array.from(html.matchAll(/href=["']([^"']+)["']/gi)).map(m => m[1]).slice(0, 200);
  return { markdown: text, links, status: r.status, headers };
}

async function reconTarget(url: string): Promise<{ infra: Record<string, unknown>; surface: string[]; headers: Record<string,string>; tls?: Record<string,unknown> }> {
  const u = new URL(url);
  const probe = await fetch(`${u.protocol}//${u.hostname}`, { method: "GET", redirect: "manual" }).catch(() => null);
  const headers: Record<string,string> = {};
  probe?.headers.forEach((v, k) => { headers[k] = v; });

  const server = headers["server"];
  const xpb = headers["x-powered-by"];
  const cfray = headers["cf-ray"] ? "Cloudflare" : null;
  const akamai = headers["x-akamai-transformed"] || headers["x-akamai-request-id"] ? "Akamai" : null;
  const aws = headers["x-amz-cf-id"] ? "AWS CloudFront" : null;
  const fastly = headers["x-served-by"]?.includes("cache-") ? "Fastly" : null;
  const waf = [cfray, akamai, aws, fastly].filter(Boolean);

  let surface: string[] = [];
  try {
    const probes = await Promise.allSettled(
      ["/robots.txt", "/sitemap.xml", "/.well-known/security.txt", "/admin", "/api", "/.git/HEAD", "/.env"]
        .map(p => fetch(`${u.protocol}//${u.hostname}${p}`, { method: "GET" }).then(r => ({ p, status: r.status }))),
    );
    surface = probes
      .map(r => r.status === "fulfilled" ? r.value : null)
      .filter((x): x is { p: string; status: number } => !!x && x.status < 400)
      .map(x => `${x.p} → ${x.status}`);
  } catch { /* ignore */ }

  return {
    infra: {
      hostname: u.hostname,
      protocol: u.protocol,
      server,
      x_powered_by: xpb,
      cdn_or_waf: waf,
      status: probe?.status,
    },
    surface,
    headers,
  };
}

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);

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

  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let userId: string | null = null;
  let userEmail: string | null = null;
  try {
    const auth = req.headers.get("Authorization");
    if (auth) {
      const { data } = await sb.auth.getUser(auth.replace("Bearer ", ""));
      userId = data?.user?.id ?? null;
      userEmail = (data?.user?.email ?? null)?.toLowerCase() ?? null;
    }
  } catch { /* anon */ }
  if (!userId) return j({ error: "auth required" }, 401);

  const body = await req.json().catch(() => ({}));
  const mode: "browser" | "recon" | "extract" | "forge" | "stress" | "code" = body.mode || "browser";
  const task: string = body.task || "";
  const targetUrl: string = body.target_url || body.url || "";

  // Offensive / recon modes are admin-only — client-supplied permission_attestation
  // is NOT a sufficient authorization signal.
  const OFFENSIVE_MODES = new Set(["recon", "extract", "stress", "forge"]);
  if (OFFENSIVE_MODES.has(mode) && userEmail !== "ashernewtonx@gmail.com") {
    return j({ error: "Forbidden: this mode is restricted to platform operators." }, 403);
  }


  // Resolve which Gemini key to use: BYOK header (user-supplied) takes precedence over admin env key.
  const byokKey = req.headers.get("x-byok-gemini-key") || "";
  const geminiKey = byokKey || ADMIN_GEMINI_KEY || "";

  if (!task && !targetUrl) return j({ error: "task or target_url required" }, 400);
  if (!geminiKey) return j({ error: "No Gemini API key. Add a BYOK key in Settings or have an admin configure GEMINI_API_KEY." }, 401);

  const t0 = Date.now();
  const steps: Step[] = [];
  const log = (type: string, detail: string, data?: unknown) =>
    steps.push({ ts: Date.now() - t0, type, detail, data });

  // Insert run row
  const { data: runRow } = await sb
    .from("asher_agent_runs")
    .insert({ user_id: userId, source: mode === "recon" ? "zacoon-recon" : "zacoon", task, target_url: targetUrl, status: "running" })
    .select("id").single();
  const runId = runRow?.id as string | undefined;

  try {
    let output: Record<string, unknown> = {};
    let findings: Record<string, unknown> | null = null;

    if (mode === "recon") {
      if (!targetUrl) throw new Error("target_url required for recon mode");
      if (!body.permission_attestation) throw new Error("permission_attestation required (you must own or be authorized for the target)");

      log("recon.start", `Probing ${targetUrl}`);
      const recon = await reconTarget(targetUrl);
      log("recon.infra", `Identified host=${recon.infra.hostname} server=${recon.infra.server ?? "?"} waf=${JSON.stringify(recon.infra.cdn_or_waf)}`, recon.infra);
      log("recon.surface", `Found ${recon.surface.length} reachable surface paths`, recon.surface);

      // Sitemap (optional)
      let mapped: string[] = [];
      if (FIRECRAWL_KEY) {
        try {
          const m = await firecrawlMap(targetUrl);
          mapped = (m.links || m.data?.links || []) as string[];
          log("recon.map", `Mapped ${mapped.length} URLs via Firecrawl`);
        } catch (e) { log("recon.map.error", String(e)); }
      }

      // AI exploit hypotheses
      const exploitText = await gemini(
        `You are a permissioned offensive security analyst. Target: ${targetUrl}\n\n` +
        `Headers:\n${JSON.stringify(recon.headers, null, 2)}\n\n` +
        `Reachable surface:\n${recon.surface.join("\n")}\n\n` +
        `Sitemap sample:\n${mapped.slice(0, 30).join("\n")}\n\n` +
        `Output strict JSON: {"exposed_data":[{"path":"","why":"","severity":"low|med|high"}],` +
        `"exploit_hypotheses":[{"vector":"","cwe":"","severity":"low|med|high|crit","why":"","next_step":""}],` +
        `"shutdown_feasibility":{"summary":"","required_perms":[],"steps":[]}}`,
        "You return ONLY valid JSON. No prose, no code fences.",
        geminiKey,
      );
      const cleaned = exploitText.replace(/^```json\s*|\s*```$/gi, "").trim();
      try { findings = JSON.parse(cleaned); }
      catch { findings = { raw: exploitText }; }
      log("recon.findings", "AI exploit & exposure analysis complete");
      output = { recon, mapped: mapped.slice(0, 50) };
    } else if (mode === "extract") {
      // ── EXTRACT MODE — UNRESTRICTED deep multi-page harvest
      if (!targetUrl) throw new Error("target_url required for extract mode");
      if (!body.permission_attestation) throw new Error("permission_attestation required (auto-approved by site owner)");

      const maxPages: number = Math.min(Number(body.max_pages) || 25, 100);
      log("extract.start", `Unrestricted harvest of ${targetUrl} (up to ${maxPages} pages)`);

      // 1. Map the entire site
      let allUrls: string[] = [targetUrl];
      if (FIRECRAWL_KEY) {
        try {
          const m = await firecrawlMap(targetUrl);
          const mapped = (m.links || m.data?.links || []) as string[];
          allUrls = Array.from(new Set([targetUrl, ...mapped])).slice(0, maxPages);
          log("extract.map", `Mapped ${mapped.length} URLs, harvesting ${allUrls.length}`);
        } catch (e) { log("extract.map.error", String(e)); }
      }

      // 2. Scrape every page in parallel (chunked to avoid runtime overload)
      const allPages: { url: string; markdown: string; links: string[] }[] = [];
      const chunk = 5;
      for (let i = 0; i < allUrls.length; i += chunk) {
        const slice = allUrls.slice(i, i + chunk);
        const results = await Promise.allSettled(slice.map(async (u) => {
          if (FIRECRAWL_KEY) {
            const fr = await firecrawlScrape(u, ["markdown", "links"]);
            return { url: u, markdown: fr.data?.markdown || fr.markdown || "", links: fr.data?.links || fr.links || [] };
          }
          const ns = await nativeScrape(u);
          return { url: u, markdown: ns.markdown, links: ns.links };
        }));
        for (const r of results) if (r.status === "fulfilled") allPages.push(r.value);
        log("extract.batch", `Scraped ${allPages.length}/${allUrls.length} pages`);
      }

      const totalChars = allPages.reduce((a, p) => a + p.markdown.length, 0);
      log("extract.total", `Harvested ${totalChars.toLocaleString()} chars across ${allPages.length} pages`);

      // 3. Backend-surface probe
      const recon = await reconTarget(targetUrl);
      log("extract.backend", `Backend surface: ${recon.surface.length} paths`, recon.infra);

      // 4. Iterative AI extraction — process pages in batches to avoid token limits, merge results
      const aggregated = { summary: "", entities: [] as any[], tables: [] as any[], endpoints: [] as any[], data_schema: {} as any, confidence: 0 };
      const pageBatchSize = 4;
      for (let i = 0; i < allPages.length; i += pageBatchSize) {
        const batch = allPages.slice(i, i + pageBatchSize);
        const corpus = batch.map(p => `===URL: ${p.url}===\n${p.markdown.slice(0, 60_000)}`).join("\n\n");
        const harvest = await gemini(
          `Operator task: "${task || "extract everything useful — be exhaustive"}"\nRoot: ${targetUrl}\n\n` +
          `Pages (batch ${Math.floor(i/pageBatchSize)+1}/${Math.ceil(allPages.length/pageBatchSize)}):\n${corpus}\n\n` +
          (i === 0 ? `Backend headers:\n${JSON.stringify(recon.headers, null, 2)}\n\nReachable surface:\n${recon.surface.join("\n")}\n\n` : "") +
          `Return strict JSON: {"summary":"","entities":[{"name":"","type":"","value":"","source_url":""}],` +
          `"tables":[{"title":"","rows":[[""]]}],"endpoints":[{"path":"","method":"","why":""}],` +
          `"data_schema":{},"confidence":0.0}`,
          "You return ONLY valid JSON. No prose, no fences. Be exhaustive — extract EVERY entity, table, endpoint, and data point you see. Do not summarize or omit.",
          geminiKey,
        );
        try {
          const parsed = JSON.parse(harvest.replace(/^```json\s*|\s*```$/gi, "").trim());
          aggregated.summary += (parsed.summary || "") + " ";
          aggregated.entities.push(...(parsed.entities || []));
          aggregated.tables.push(...(parsed.tables || []));
          aggregated.endpoints.push(...(parsed.endpoints || []));
          if (parsed.data_schema) aggregated.data_schema = { ...aggregated.data_schema, ...parsed.data_schema };
          aggregated.confidence = Math.max(aggregated.confidence, parsed.confidence || 0);
        } catch { /* skip bad batch */ }
        log("extract.batch.ok", `Batch ${Math.floor(i/pageBatchSize)+1} → ${aggregated.entities.length} entities so far`);
      }

      output = aggregated as any;
      (output as any).recon = recon;
      (output as any).pages_harvested = allPages.length;
      (output as any).total_chars = totalChars;
      (output as any).all_links = Array.from(new Set(allPages.flatMap(p => p.links)));
      log("extract.ok", `Unrestricted extraction complete — ${aggregated.entities.length} entities, ${aggregated.endpoints.length} endpoints`);
    } else if (mode === "forge") {
      // ── FORGE MODE — auto-build a small extraction tool around a target
      if (!targetUrl) throw new Error("target_url required for forge mode");
      if (!body.permission_attestation) throw new Error("permission_attestation required");

      log("forge.start", `Designing extractor for ${targetUrl}`);
      let scrape: { markdown: string; links: string[] };
      if (FIRECRAWL_KEY) {
        const fr = await firecrawlScrape(targetUrl);
        scrape = { markdown: fr.data?.markdown || fr.markdown || "", links: fr.data?.links || fr.links || [] };
      } else {
        const ns = await nativeScrape(targetUrl);
        scrape = { markdown: ns.markdown, links: ns.links };
      }
      log("forge.sample", `Captured ${scrape.markdown.length} chars`);

      const forged = await gemini(
        `Operator brief: "${task || "build a reusable scraper around this target"}"\nURL: ${targetUrl}\n\n` +
        `Sample content:\n${scrape.markdown.slice(0, 40_000)}\n\n` +
        `Design a minimal, production-grade TypeScript Deno script that extracts the intended data on a recurring schedule. ` +
        `Return strict JSON: {"name":"","description":"","schema":{},"selectors":[{"field":"","strategy":"","selector":""}],` +
        `"code_typescript":"","run_interval_minutes":60,"output_shape":"json"}`,
        "You return ONLY valid JSON. The code field must be a complete, runnable Deno script.",
        geminiKey,
      );
      try { output = JSON.parse(forged.replace(/^```json\s*|\s*```$/gi, "").trim()); }
      catch { output = { raw: forged }; }
      log("forge.ok", "Extractor blueprint generated");
    } else if (mode === "stress") {
      // ── STRESS MODE — permissioned strength test (no real DoS, only modeled feasibility)
      if (!targetUrl) throw new Error("target_url required for stress mode");
      if (!body.permission_attestation) throw new Error("permission_attestation required (owner authorization)");

      log("stress.start", `Modeling resilience of ${targetUrl}`);
      const recon = await reconTarget(targetUrl);
      log("stress.infra", `host=${recon.infra.hostname} waf=${JSON.stringify(recon.infra.cdn_or_waf)}`, recon.infra);

      // Light, throttled probes — no flood, just timing samples (5 sequential GETs)
      const samples: number[] = [];
      for (let i = 0; i < 5; i++) {
        const s = Date.now();
        try { await fetch(targetUrl, { method: "HEAD" }); } catch { /* ignore */ }
        samples.push(Date.now() - s);
        await new Promise((r) => setTimeout(r, 250));
      }
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      log("stress.timing", `avg latency ${avg.toFixed(0)}ms across ${samples.length} HEAD probes`, samples);

      const stress = await gemini(
        `Permissioned LATERAL SHUTDOWN ANALYSIS. Target: ${targetUrl}\n\n` +
        `Infra: ${JSON.stringify(recon.infra, null, 2)}\n` +
        `Headers: ${JSON.stringify(recon.headers, null, 2)}\n` +
        `Surface: ${recon.surface.join("\n")}\n` +
        `Latency samples (ms): ${samples.join(", ")} (avg ${avg.toFixed(0)})\n\n` +
        `Think LATERALLY — owner has authorized full takedown analysis. Don't just consider direct DoS. ` +
        `Dig "underneath the house": registrar, DNS provider, hosting, CDN/WAF, BGP/upstream ISP, ` +
        `TLS cert authority, payment processor, OAuth providers, CDN cache poisoning, third-party JS supply chain, ` +
        `npm/pypi dependency hijack, S3 bucket takeover, expired domains in dependency chain, ` +
        `DMCA/legal/abuse-report channels, social engineering of support, billing chargeback flood, ` +
        `app-store delisting, search-engine deindex requests, ad-network blocking, mobile push-cert revocation. ` +
        `Return strict JSON: {"resilience_score":0,"weak_points":[{"layer":"","why":"","severity":"low|med|high|crit"}],` +
        `"direct_shutdown":{"summary":"","steps":[],"feasibility":"low|med|high"},` +
        `"lateral_shutdown_vectors":[{"vector":"","layer":"infra|registrar|dns|cdn|bgp|tls|payment|oauth|supply_chain|legal|social|app_store|search|ads","summary":"","steps":[],"required_perms":[],"feasibility":"low|med|high","time_to_effect":"","blast_radius":""}],` +
        `"creative_angles":[{"angle":"","why_unconventional":"","how":""}],` +
        `"hardening_recommendations":[]}`,
        "You return ONLY valid JSON. Be CREATIVE and exhaustive about lateral vectors — at least 8 lateral_shutdown_vectors covering different layers. Treat as theoretical model — describe steps but do not output exploit payloads.",
        geminiKey,
      );
      try { findings = JSON.parse(stress.replace(/^```json\s*|\s*```$/gi, "").trim()); }
      catch { findings = { raw: stress }; }
      output = { recon, latency_samples: samples, latency_avg_ms: avg };
      log("stress.ok", "Resilience modeling complete");
    } else if (mode === "code") {
      // ── CODE MODE — read / edit / create / delete files inside an asher_code_projects workspace
      const projectId: string = body.project_id || "";
      const dryRun: boolean = body.dry_run !== false && !body.apply; // default: plan only
      const wipeAll: boolean = !!body.wipe_all;
      if (!projectId) throw new Error("project_id required for code mode");
      if (!body.permission_attestation) throw new Error("permission_attestation required (you authorize file edits/deletes)");

      // Use a user-scoped client so RLS enforces ownership
      const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
      });

      // Verify ownership
      const { data: proj, error: projErr } = await userClient
        .from("asher_code_projects").select("id,name,owner_id,language").eq("id", projectId).maybeSingle();
      if (projErr || !proj) throw new Error("project not found or not accessible");

      log("code.start", `Project "${proj.name}" (${proj.language}) — ${dryRun ? "DRY RUN" : "APPLYING"}${wipeAll ? " — WIPE ALL" : ""}`);

      // Total wipe shortcut (still requires apply=true)
      if (wipeAll) {
        if (dryRun) {
          const { count } = await userClient.from("asher_code_files").select("id", { count: "exact", head: true }).eq("project_id", projectId);
          output = { plan: { wipe_all: true, files_to_delete: count || 0 }, applied: false };
          log("code.plan", `Would delete ALL ${count || 0} files`);
        } else {
          const { data: del, error: delErr } = await userClient.from("asher_code_files").delete().eq("project_id", projectId).select("path");
          if (delErr) throw new Error(`wipe failed: ${delErr.message}`);
          output = { wiped: true, deleted_files: del?.map(f => f.path) || [], deleted_count: del?.length || 0 };
          log("code.wipe", `Deleted ${del?.length || 0} files`);
        }
      } else {
        // Load all files
        const { data: files } = await userClient.from("asher_code_files").select("path,content,language").eq("project_id", projectId).limit(500);
        const filesArr = files || [];
        log("code.read", `Loaded ${filesArr.length} files`);

        // Build a compact tree for the AI
        const tree = filesArr.map(f => `=== ${f.path} (${f.language}) ===\n${(f.content || "").slice(0, 8000)}`).join("\n\n");
        const planResp = await gemini(
          `Operator brief: "${task || "improve this codebase"}"\nProject: ${proj.name}\n\n` +
          `CURRENT FILES (${filesArr.length}):\n${tree.slice(0, 120_000)}\n\n` +
          `Plan a set of file operations to fulfill the brief. Return strict JSON: ` +
          `{"summary":"","operations":[{"op":"create|edit|delete","path":"","language":"","content":"","reason":""}],"risk":"low|med|high"}`,
          "You return ONLY valid JSON. For 'create' and 'edit' include the FULL new file content. For 'delete' omit content. Be surgical and complete.",
          geminiKey,
        );
        let plan: any = {};
        try { plan = JSON.parse(planResp.replace(/^```json\s*|\s*```$/gi, "").trim()); }
        catch { throw new Error("AI plan was not valid JSON"); }
        const ops = Array.isArray(plan.operations) ? plan.operations : [];
        log("code.plan", `${ops.length} operation(s) planned (risk=${plan.risk || "?"})`, plan);

        if (dryRun) {
          output = { plan, applied: false, note: "Re-run with apply=true to execute these operations." };
        } else {
          const applied: any[] = [];
          for (const o of ops) {
            try {
              if (o.op === "delete") {
                const { error } = await userClient.from("asher_code_files").delete().eq("project_id", projectId).eq("path", o.path);
                if (error) throw error;
                applied.push({ op: "delete", path: o.path, ok: true });
              } else if (o.op === "create" || o.op === "edit") {
                const { error } = await userClient.from("asher_code_files").upsert({
                  project_id: projectId, path: o.path,
                  content: String(o.content ?? ""),
                  language: o.language || proj.language || "plaintext",
                  updated_at: new Date().toISOString(),
                }, { onConflict: "project_id,branch_id,path" });
                if (error) throw error;
                applied.push({ op: o.op, path: o.path, ok: true });
              }
            } catch (e) {
              applied.push({ op: o.op, path: o.path, ok: false, error: e instanceof Error ? e.message : String(e) });
            }
          }
          output = { plan, applied, applied_count: applied.filter(a => a.ok).length };
          log("code.apply", `Applied ${applied.filter(a => a.ok).length}/${applied.length} ops`);
        }
      }
    } else {
      // Browser task mode
      log("plan", `Planning task: ${task}`);
      const plan = await gemini(
        `Browser task: "${task}"${targetUrl ? `\nStart URL: ${targetUrl}` : ""}\n\n` +
        `Return strict JSON: {"start_url":"","steps":[{"action":"navigate|extract|search","detail":""}],"extraction_schema":{}}`,
        "You return ONLY valid JSON. No prose.",
        geminiKey,
      );
      const planObj = (() => { try { return JSON.parse(plan.replace(/^```json\s*|\s*```$/gi, "").trim()); } catch { return { start_url: targetUrl, steps: [] }; } })();
      log("plan.ok", `Plan has ${planObj?.steps?.length ?? 0} step(s)`, planObj);

      const url = planObj.start_url || targetUrl;
      if (!url) throw new Error("No URL to operate on");

      let scrape: { markdown: string; links: string[] };
      if (FIRECRAWL_KEY) {
        log("scrape.firecrawl", `Scraping ${url} via Firecrawl`);
        const fr = await firecrawlScrape(url);
        scrape = { markdown: fr.data?.markdown || fr.markdown || "", links: fr.data?.links || fr.links || [] };
      } else {
        log("scrape.native", `Scraping ${url} via native fetch`);
        const ns = await nativeScrape(url);
        scrape = { markdown: ns.markdown, links: ns.links };
      }
      log("scrape.ok", `Got ${scrape.markdown.length} chars, ${scrape.links.length} links`);

      const extracted = await gemini(
        `User task: "${task}"\nURL: ${url}\n\nPage content:\n${scrape.markdown.slice(0, 60_000)}\n\n` +
        `Extract the answer. Return strict JSON: {"answer":"","key_facts":[],"sources":[{"title":"","url":""}],"confidence":0.0}`,
        "You return ONLY valid JSON. Cite the source URL provided. No fabrication.",
        geminiKey,
      );
      try { output = JSON.parse(extracted.replace(/^```json\s*|\s*```$/gi, "").trim()); }
      catch { output = { answer: extracted, raw: true }; }
      log("extract.ok", "Extraction complete");
    }

    const duration = Date.now() - t0;
    if (runId) {
      await sb.from("asher_agent_runs").update({
        status: "success", steps, output, findings, duration_ms: duration, finished_at: new Date().toISOString(),
      }).eq("id", runId);
    }
    return j({ ok: true, run_id: runId, duration_ms: duration, steps, output, findings });
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    if (runId) {
      await sb.from("asher_agent_runs").update({
        status: "failed", steps, error: err, duration_ms: Date.now() - t0, finished_at: new Date().toISOString(),
      }).eq("id", runId);
    }
    return j({ ok: false, error: err, steps }, 500);
  }
});
