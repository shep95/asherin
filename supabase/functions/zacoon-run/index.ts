// ZACOON-RUN — real browser-task execution backend.
// Tries Firecrawl if FIRECRAWL_API_KEY exists, otherwise falls back to native fetch + Gemini extraction.
// Also exposes a "recon" mode that returns infrastructure intelligence (DNS / TLS / WAF / headers / surface).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-byok-gemini-key",
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
        generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let userId: string | null = null;
  try {
    const auth = req.headers.get("Authorization");
    if (auth) {
      const { data } = await sb.auth.getUser(auth.replace("Bearer ", ""));
      userId = data?.user?.id ?? null;
    }
  } catch { /* anon */ }
  if (!userId) return j({ error: "auth required" }, 401);

  const body = await req.json().catch(() => ({}));
  const mode: "browser" | "recon" = body.mode || "browser";
  const task: string = body.task || "";
  const targetUrl: string = body.target_url || body.url || "";

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
      const exploitText = await gemini_KEYED(
        `You are a permissioned offensive security analyst. Target: ${targetUrl}\n\n` +
        `Headers:\n${JSON.stringify(recon.headers, null, 2)}\n\n` +
        `Reachable surface:\n${recon.surface.join("\n")}\n\n` +
        `Sitemap sample:\n${mapped.slice(0, 30).join("\n")}\n\n` +
        `Output strict JSON: {"exposed_data":[{"path":"","why":"","severity":"low|med|high"}],` +
        `"exploit_hypotheses":[{"vector":"","cwe":"","severity":"low|med|high|crit","why":"","next_step":""}],` +
        `"shutdown_feasibility":{"summary":"","required_perms":[],"steps":[]}}`,
        "You return ONLY valid JSON. No prose, no code fences.",
      );
      const cleaned = exploitText.replace(/^```json\s*|\s*```$/gi, "").trim();
      try { findings = JSON.parse(cleaned); }
      catch { findings = { raw: exploitText }; }
      log("recon.findings", "AI exploit & exposure analysis complete");
      output = { recon, mapped: mapped.slice(0, 50) };
    } else {
      // Browser task mode
      log("plan", `Planning task: ${task}`);
      const plan = await gemini_KEYED(
        `Browser task: "${task}"${targetUrl ? `\nStart URL: ${targetUrl}` : ""}\n\n` +
        `Return strict JSON: {"start_url":"","steps":[{"action":"navigate|extract|search","detail":""}],"extraction_schema":{}}`,
        "You return ONLY valid JSON. No prose.",
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

      const extracted = await gemini_KEYED(
        `User task: "${task}"\nURL: ${url}\n\nPage content:\n${scrape.markdown.slice(0, 60_000)}\n\n` +
        `Extract the answer. Return strict JSON: {"answer":"","key_facts":[],"sources":[{"title":"","url":""}],"confidence":0.0}`,
        "You return ONLY valid JSON. Cite the source URL provided. No fabrication.",
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
