// ============================================================================
// ZACOON PHANTOM GRID v3.0 — Operative Intelligence Console
// ----------------------------------------------------------------------------
// Multi-cortex autonomous web operative with:
//   • $79/mo Pro tier gate (admins bypass)
//   • Mass-ban on aureonai.app / www.aureonai.app for non-admins
//   • 5-Phase Cortex Loop (Recon → Navigate → Adversarial → Self-Correct → Synthesis)
//   • Unified Mission Memory (cross-mode intelligence via zacoon_missions)
//   • Cryptographic mission fingerprint + integrity certificate
//   • Append-only audit ledger (zacoon_missions + zacoon_cortex_events)
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { retiredSurfaceResponse } from "../_shared/retiredSurfaces.ts";
import { getCallerEmail, isAdminEmail } from "../_shared/adminGate.ts";
import { requireTier } from "../_shared/tierGate.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP") || "";
const FIRECRAWL_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";

// Domains where non-admin usage is mass-banned per operator directive.
const BANNED_HOSTS = new Set(["aureonai.app", "www.aureonai.app"]);

type Phase = "RECON" | "NAVIGATE" | "ADVERSARIAL" | "SELF_CORRECT" | "SYNTHESIS" | "DISPATCH" | "CLOSE";
type EventType = "PLAN" | "EXECUTE" | "DETECT" | "ADAPT" | "ABORT" | "CONFIRM";
interface CortexEvent { ts_ms: number; phase: Phase; event_type: EventType; detail: string; data?: unknown }

const jsonResp = (data: unknown, status: number, cors: Record<string,string>) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

// ── Cryptography helpers ────────────────────────────────────────────────────
async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Gemini call ─────────────────────────────────────────────────────────────
async function gemini(prompt: string, system: string, apiKey: string): Promise<string> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.35, maxOutputTokens: 16384 },
      }),
    },
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const d = await r.json();
  return d?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function parseJsonLoose<T = any>(text: string, fallback: T): T {
  try {
    const cleaned = text.replace(/^```json\s*|\s*```$/gi, "").trim();
    return JSON.parse(cleaned) as T;
  } catch { return fallback; }
}

// ── Firecrawl (primary substrate — no bad native fallback) ─────────────────
async function firecrawlScrape(url: string, formats: string[] = ["markdown", "links"]) {
  if (!FIRECRAWL_KEY) throw new Error("FIRECRAWL_KEY_MISSING");
  const r = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats, onlyMainContent: true, waitFor: 800 }),
  });
  if (!r.ok) throw new Error(`Firecrawl ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return {
    markdown: d?.data?.markdown || d?.markdown || "",
    links: (d?.data?.links || d?.links || []) as string[],
    html: d?.data?.rawHtml || d?.data?.html || "",
    metadata: d?.data?.metadata || {},
  };
}

async function firecrawlMap(url: string): Promise<string[]> {
  if (!FIRECRAWL_KEY) return [];
  const r = await fetch("https://api.firecrawl.dev/v2/map", {
    method: "POST",
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, limit: 200, includeSubdomains: false }),
  });
  if (!r.ok) return [];
  const d = await r.json();
  return (d?.links || d?.data?.links || []) as string[];
}

// ── PHASE 1: RECON CORTEX — Target Resistance Profile ──────────────────────
async function reconCortex(targetUrl: string): Promise<{
  hostname: string;
  cdn_or_waf: string[];
  server?: string;
  x_powered_by?: string;
  status?: number;
  headers: Record<string,string>;
  surface: string[];
  approach_vector: "direct" | "stealth" | "visual_grounding";
}> {
  const u = new URL(targetUrl);
  const probe = await fetch(`${u.protocol}//${u.hostname}`, {
    method: "GET",
    redirect: "manual",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ZacoonPhantomBot/3.0)" },
  }).catch(() => null);
  const headers: Record<string,string> = {};
  probe?.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });

  const cdn: string[] = [];
  if (headers["cf-ray"] || headers["cf-cache-status"]) cdn.push("Cloudflare");
  if (headers["x-akamai-transformed"] || headers["x-akamai-request-id"]) cdn.push("Akamai");
  if (headers["x-amz-cf-id"]) cdn.push("AWS CloudFront");
  if (headers["x-served-by"]?.includes("cache-")) cdn.push("Fastly");
  if (headers["x-vercel-id"]) cdn.push("Vercel Edge");
  if (headers["server"]?.toLowerCase().includes("nginx")) cdn.push("Nginx");

  const surfacePaths = ["/robots.txt", "/sitemap.xml", "/.well-known/security.txt", "/api", "/admin"];
  const surfaceRes = await Promise.allSettled(
    surfacePaths.map(p =>
      fetch(`${u.protocol}//${u.hostname}${p}`, { method: "GET" }).then(r => ({ p, status: r.status }))
    )
  );
  const surface = surfaceRes
    .map(r => r.status === "fulfilled" ? r.value : null)
    .filter((x): x is { p: string; status: number } => !!x && x.status < 400)
    .map(x => `${x.p} → ${x.status}`);

  // Select approach vector based on resistance
  let approach: "direct" | "stealth" | "visual_grounding" = "direct";
  if (cdn.includes("Cloudflare") || cdn.includes("Akamai")) approach = "stealth";
  if (headers["cf-mitigated"] || headers["server"]?.toLowerCase().includes("perimeter")) approach = "visual_grounding";

  return {
    hostname: u.hostname,
    cdn_or_waf: cdn,
    server: headers["server"],
    x_powered_by: headers["x-powered-by"],
    status: probe?.status,
    headers,
    surface,
    approach_vector: approach,
  };
}

// ── PHASE 3: ADVERSARIAL AWARENESS ENGINE ──────────────────────────────────
function adversarialScan(markdown: string, html: string): {
  threats: { type: string; severity: "low" | "med" | "high"; evidence: string }[];
  clean: boolean;
} {
  const threats: { type: string; severity: "low" | "med" | "high"; evidence: string }[] = [];
  const src = (html || markdown).slice(0, 200_000);

  // Honeypot form field patterns
  const honeypots = src.match(/<input[^>]*(?:name|id)=["'](?:email_confirm|website|url|honeypot|hp_|bot_check|leave_blank)["'][^>]*>/gi);
  if (honeypots && honeypots.length > 0)
    threats.push({ type: "honeypot_field", severity: "med", evidence: honeypots[0].slice(0, 120) });

  // Canary token / invisible tracking pixel patterns
  const canaryMatch = src.match(/(?:1x1|pixel|tracking|canary|beacon)[^"']{0,40}\.(?:gif|png)/gi);
  if (canaryMatch && canaryMatch.length > 2)
    threats.push({ type: "canary_token", severity: "low", evidence: canaryMatch.slice(0, 3).join(", ") });

  // Prompt-injection style adversarial content
  if (/ignore (?:all )?previous instructions|disregard your (?:system )?prompt|you are now/i.test(src))
    threats.push({ type: "prompt_injection", severity: "high", evidence: "Detected instruction-hijack phrase in page content" });

  // Behavioral fingerprinting
  if (/(?:fingerprintjs|clientjs|creepjs|fpjs)/i.test(src))
    threats.push({ type: "behavioral_fingerprint", severity: "med", evidence: "Fingerprinting library detected" });

  // Bot-detection redirect
  if (/(?:cf-browser-verification|hcaptcha|recaptcha\/api|challenge-platform)/i.test(src))
    threats.push({ type: "captcha_wall", severity: "high", evidence: "Challenge/CAPTCHA infrastructure present" });

  return { threats, clean: threats.length === 0 };
}

// ── PHASE 2: PHANTOM NAVIGATION with SELF-CORRECTION (Phase 4) ─────────────
async function phantomNavigate(
  url: string,
  approach: string,
  log: (e: EventType, detail: string, data?: unknown, phase?: Phase) => void,
): Promise<{ markdown: string; links: string[]; html: string; metadata: any; substrate: string }> {
  const attempts: string[] = [];
  // Substrate escalation ladder
  const substrates = approach === "visual_grounding"
    ? ["firecrawl_screenshot", "firecrawl_markdown"]
    : ["firecrawl_markdown", "firecrawl_screenshot"];

  for (let i = 0; i < substrates.length; i++) {
    const sub = substrates[i];
    try {
      log("EXECUTE", `Substrate: ${sub} (attempt ${i + 1})`, { substrate: sub }, "NAVIGATE");
      const formats = sub === "firecrawl_screenshot"
        ? ["markdown", "links", "screenshot"]
        : ["markdown", "links", "rawHtml"];
      const res = await firecrawlScrape(url, formats);
      log("CONFIRM", `Substrate succeeded — ${res.markdown.length} chars, ${res.links.length} links`, undefined, "NAVIGATE");
      return { ...res, substrate: sub };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      attempts.push(`${sub}: ${msg}`);
      log("ADAPT", `Substrate ${sub} failed — rerouting (${msg.slice(0, 80)})`, undefined, "SELF_CORRECT");
    }
  }
  throw new Error(`All substrates exhausted:\n${attempts.join("\n")}`);
}

// ── Cross-mode Unified Mission Memory: seed from prior missions ────────────
async function umRelatedMissions(sb: any, userId: string, hostname: string): Promise<any[]> {
  const { data } = await sb
    .from("zacoon_missions")
    .select("id,mode,target_url,intel,output,created_at")
    .eq("user_id", userId)
    .eq("status", "success")
    .ilike("target_url", `%${hostname}%`)
    .order("created_at", { ascending: false })
    .limit(3);
  return data ?? [];
}

// ── HANDLER ──────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const retired = retiredSurfaceResponse(req, "zacoon");
  if (retired) return retired;
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // ── Mass-ban gate: block aureonai.app for non-admins ──────────────────────
  const origin = (req.headers.get("origin") || req.headers.get("referer") || "").toLowerCase();
  const email = await getCallerEmail(req);
  const admin = isAdminEmail(email);
  if (!admin) {
    for (const host of BANNED_HOSTS) {
      if (origin.includes(host)) {
        return jsonResp({
          error: "DOMAIN_BANNED",
          message: "Zacoon Phantom Grid is not available on this domain.",
        }, 451, corsHeaders);
      }
    }
    // ── Tier gate: $79 Pro tier or higher required ────────────────────────
    const gate = await requireTier(req, ["pro", "lifetime"], corsHeaders);
    if (!gate.ok) return gate.response!;
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  let userId: string | null = null;
  try {
    const auth = req.headers.get("Authorization");
    if (auth) {
      const { data } = await sb.auth.getUser(auth.replace("Bearer ", ""));
      userId = data?.user?.id ?? null;
    }
  } catch { /* anon rejected below */ }
  if (!userId) return jsonResp({ error: "auth_required" }, 401, corsHeaders);

  const body = await req.json().catch(() => ({} as any));
  const mode: string = body.mode || "recon";
  const objective: string = body.objective || body.task || "";
  const targetUrl: string = body.target_url || body.url || "";
  const riskEnvelope: string = body.risk_envelope || "standard";
  const byokKey = req.headers.get("x-byok-gemini-key") || "";
  const geminiKey = byokKey || ADMIN_GEMINI_KEY;

  if (!targetUrl && mode !== "browser") return jsonResp({ error: "target_url_required" }, 400, corsHeaders);
  if (!geminiKey) return jsonResp({ error: "no_ai_key", message: "Add a Gemini BYOK key in Settings." }, 401, corsHeaders);

  const t0 = Date.now();
  const events: CortexEvent[] = [];

  // Mission fingerprint (cryptographic chain-of-custody)
  const fingerprint = await sha256Hex(JSON.stringify({
    userId, mode, objective, targetUrl, riskEnvelope, ts: t0,
  }));

  // Insert mission row
  const { data: mission, error: mErr } = await sb.from("zacoon_missions").insert({
    user_id: userId,
    mode,
    objective,
    target_url: targetUrl || null,
    risk_envelope: riskEnvelope,
    fingerprint,
    status: "running",
    teg: body.teg ?? {},
  }).select("id").single();

  if (mErr || !mission) return jsonResp({ error: "ledger_write_failed", detail: mErr?.message }, 500, corsHeaders);
  const missionId = mission.id as string;

  const log = async (event_type: EventType, detail: string, data?: unknown, phase: Phase = "NAVIGATE") => {
    const ev: CortexEvent = { ts_ms: Date.now() - t0, phase, event_type, detail, data };
    events.push(ev);
    // Fire-and-forget audit write (RLS enforces ownership on the SELECT side; service role bypasses on INSERT).
    sb.from("zacoon_cortex_events").insert({
      mission_id: missionId, user_id: userId, phase, event_type, detail,
      data: data === undefined ? null : (data as any),
      ts_ms: ev.ts_ms,
    }).then(() => {}, () => {});
  };

  try {
    await log("PLAN", `Mission ${mode.toUpperCase()} dispatched — target=${targetUrl || "(none)"} risk=${riskEnvelope}`, { fingerprint }, "DISPATCH");

    // ── PHASE 1: RECON ─────────────────────────────────────────────────────
    let trp: Awaited<ReturnType<typeof reconCortex>> | null = null;
    if (targetUrl) {
      await log("EXECUTE", "Building Target Resistance Profile", undefined, "RECON");
      trp = await reconCortex(targetUrl);
      await log("CONFIRM",
        `TRP built — WAF=${trp.cdn_or_waf.join("/") || "none"} surface=${trp.surface.length} approach=${trp.approach_vector}`,
        trp, "RECON");
    }

    // ── UMM: seed from prior related missions ──────────────────────────────
    let priorContext: any[] = [];
    if (trp) {
      priorContext = await umRelatedMissions(sb, userId, trp.hostname);
      if (priorContext.length > 0)
        await log("DETECT", `Unified Mission Memory: ${priorContext.length} prior mission(s) on ${trp.hostname}`, undefined, "RECON");
    }

    // ── Mode-specific execution ────────────────────────────────────────────
    let output: Record<string, unknown> = {};
    let intel: Record<string, unknown> = {};

    if (mode === "recon" || mode === "phantom_recon") {
      const mapped = await firecrawlMap(targetUrl).catch(() => []);
      if (mapped.length) await log("EXECUTE", `Mapped ${mapped.length} surface URLs`, undefined, "RECON");

      const analysis = await gemini(
        `Target: ${targetUrl}\nTRP: ${JSON.stringify(trp, null, 2)}\nSitemap sample:\n${mapped.slice(0, 30).join("\n")}\n\n` +
        `Produce a Target Intelligence Dossier. Return strict JSON: ` +
        `{"summary":"","technology_stack":[],"attack_surface_score":0,"exposed_data":[{"path":"","severity":"low|med|high","why":""}],` +
        `"security_headers":{"csp":"","hsts":"","x_frame":""},"risk_score":0}`,
        "You return ONLY valid JSON. Confidence-score every finding.",
        geminiKey,
      );
      intel = parseJsonLoose(analysis, { raw: analysis });
      output = { trp, mapped: mapped.slice(0, 100) };
      await log("CONFIRM", "Phantom Recon dossier synthesized", undefined, "SYNTHESIS");

    } else if (mode === "extract" || mode === "precision_extract") {
      const maxPages = Math.min(Number(body.max_pages) || 15, 60);
      const mapped = await firecrawlMap(targetUrl).catch(() => []);
      const urls = Array.from(new Set([targetUrl, ...mapped])).slice(0, maxPages);
      await log("EXECUTE", `Precision Extract across ${urls.length} pages`, undefined, "NAVIGATE");

      const pages: { url: string; markdown: string }[] = [];
      const threats: any[] = [];
      for (let i = 0; i < urls.length; i += 4) {
        const batch = urls.slice(i, i + 4);
        const results = await Promise.allSettled(batch.map(async (u) => {
          const nav = await phantomNavigate(u, trp?.approach_vector || "direct", log);
          const aae = adversarialScan(nav.markdown, nav.html);
          if (!aae.clean) {
            threats.push({ url: u, ...aae });
            await log("DETECT", `AAE flagged ${aae.threats.length} threat(s) on ${u}`, aae.threats, "ADVERSARIAL");
          }
          return { url: u, markdown: nav.markdown };
        }));
        for (const r of results) if (r.status === "fulfilled") pages.push(r.value);
        await log("CONFIRM", `Batch ${Math.floor(i/4)+1} → ${pages.length}/${urls.length} pages captured`, undefined, "NAVIGATE");
      }

      // Signal Forge synthesis (multi-pass)
      const aggregated: any = { summary: "", entities: [], tables: [], endpoints: [], confidence: 0 };
      for (let i = 0; i < pages.length; i += 4) {
        const slice = pages.slice(i, i + 4);
        const corpus = slice.map(p => `===${p.url}===\n${p.markdown.slice(0, 50_000)}`).join("\n\n");
        const raw = await gemini(
          `Objective: "${objective || "extract every structured data point"}"\nRoot: ${targetUrl}\nPages:\n${corpus}\n\n` +
          `Return strict JSON: {"summary":"","entities":[{"name":"","type":"","value":"","source_url":"","confidence":0.0}],` +
          `"tables":[{"title":"","rows":[[""]]}],"endpoints":[{"path":"","method":"","why":""}],"confidence":0.0}`,
          "ONLY valid JSON. Be exhaustive. Confidence-score every extraction.",
          geminiKey,
        );
        const parsed = parseJsonLoose<any>(raw, {});
        aggregated.summary += (parsed.summary || "") + " ";
        aggregated.entities.push(...(parsed.entities || []));
        aggregated.tables.push(...(parsed.tables || []));
        aggregated.endpoints.push(...(parsed.endpoints || []));
        aggregated.confidence = Math.max(aggregated.confidence, parsed.confidence || 0);
      }
      intel = { ...aggregated, adversarial_events: threats };
      output = { trp, pages_captured: pages.length, urls_targeted: urls.length };
      await log("CONFIRM", `Signal Forge synthesized ${aggregated.entities.length} entities`, undefined, "SYNTHESIS");

    } else if (mode === "forge" || mode === "forge_blueprint") {
      const nav = await phantomNavigate(targetUrl, trp?.approach_vector || "direct", log);
      const raw = await gemini(
        `Brief: "${objective || "build a reusable scraper"}"\nURL: ${targetUrl}\nSample:\n${nav.markdown.slice(0, 40_000)}\n\n` +
        `Return strict JSON: {"name":"","description":"","schema":{},"selectors":[{"field":"","selector":"","strategy":""}],` +
        `"code_typescript":"","run_interval_minutes":60}`,
        "ONLY valid JSON. The code field must be complete runnable Deno.",
        geminiKey,
      );
      intel = parseJsonLoose(raw, { raw });
      output = { trp, sample_chars: nav.markdown.length, substrate: nav.substrate };
      await log("CONFIRM", "Forge Blueprint generated", undefined, "SYNTHESIS");

    } else if (mode === "resilience_probe" || mode === "stress") {
      if (!body.ownership_attestation) throw new Error("ownership_attestation required for RESILIENCE_PROBE");
      const raw = await gemini(
        `Permissioned RESILIENCE MODELING. Target: ${targetUrl}\nTRP: ${JSON.stringify(trp, null, 2)}\n\n` +
        `Model shutdown scenarios, single-point-of-failure surfaces, recovery paths. NO exploit payloads.\n` +
        `Return strict JSON: {"resilience_score":0,"weak_points":[{"layer":"","severity":"low|med|high|crit","why":""}],` +
        `"lateral_shutdown_vectors":[{"vector":"","layer":"","summary":"","feasibility":"low|med|high"}],` +
        `"hardening_recommendations":[]}`,
        "ONLY valid JSON. Analytical only — describe steps, never payloads.",
        geminiKey,
      );
      intel = parseJsonLoose(raw, { raw });
      output = { trp, mode: "analytical_only", live_traffic_generated: false };
      await log("CONFIRM", "Resilience model complete", undefined, "SYNTHESIS");

    } else {
      // Default: browser task
      const nav = await phantomNavigate(targetUrl, trp?.approach_vector || "direct", log);
      const aae = adversarialScan(nav.markdown, nav.html);
      if (!aae.clean) await log("DETECT", `${aae.threats.length} adversarial signal(s) detected`, aae.threats, "ADVERSARIAL");

      const raw = await gemini(
        `Objective: "${objective}"\nURL: ${targetUrl}\nPage:\n${nav.markdown.slice(0, 60_000)}\n\n` +
        `Return strict JSON: {"answer":"","key_facts":[],"sources":[{"title":"","url":""}],"confidence":0.0}`,
        "ONLY valid JSON. Cite the source URL. No fabrication.",
        geminiKey,
      );
      intel = parseJsonLoose(raw, { answer: raw });
      output = { trp, substrate: nav.substrate, adversarial: aae };
      await log("CONFIRM", "Mission Signal synthesized", undefined, "SYNTHESIS");
    }

    // ── Integrity certificate ──────────────────────────────────────────────
    const duration = Date.now() - t0;
    const cert = await sha256Hex(JSON.stringify({ fingerprint, output, intel, duration, events: events.length }));
    await log("CONFIRM", `Mission Integrity Certificate sealed`, { cert: cert.slice(0, 16) + "…" }, "CLOSE");

    await sb.from("zacoon_missions").update({
      status: "success",
      output,
      intel: { ...intel, prior_context_count: priorContext.length },
      duration_ms: duration,
      integrity_cert: cert,
      finished_at: new Date().toISOString(),
    }).eq("id", missionId);

    return jsonResp({
      ok: true,
      mission_id: missionId,
      fingerprint,
      integrity_cert: cert,
      duration_ms: duration,
      events,
      output,
      intel,
    }, 200, corsHeaders);

  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    await log("ABORT", err, undefined, "CLOSE");
    await sb.from("zacoon_missions").update({
      status: "failed",
      output: { error: err },
      duration_ms: Date.now() - t0,
      finished_at: new Date().toISOString(),
    }).eq("id", missionId);
    return jsonResp({ ok: false, error: err, events, mission_id: missionId }, 500, corsHeaders);
  }
});
