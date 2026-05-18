// ZOPHIEL KEY PROBE
// Live data-pull from API keys/tokens that Link Intelligence surfaced.
// AUTHENTICATED + ADMIN-ONLY. Anonymous access is BLOCKED — this endpoint
// would otherwise be a free third-party key-testing proxy.

import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAdmin, authErrorResponse } from "../_shared/authMiddleware.ts";

type ProbeResult = {
  ok: boolean;
  type: string;
  status: number;
  endpoint: string;
  summary: string;
  data: unknown;
  error?: string;
};

const json = (status: number, body: unknown, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

async function safeJson(res: Response): Promise<unknown> {
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return txt.slice(0, 4000); }
}

async function probeOpenAI(key: string): Promise<ProbeResult> {
  const ep = "https://api.openai.com/v1/models";
  const r = await fetch(ep, { headers: { Authorization: `Bearer ${key}` } });
  const data = await safeJson(r);
  return { ok: r.ok, type: "openai", status: r.status, endpoint: ep,
    summary: r.ok ? `${(data as any)?.data?.length ?? 0} models accessible` : `OpenAI rejected key (${r.status})`, data };
}
async function probeAnthropic(key: string): Promise<ProbeResult> {
  const ep = "https://api.anthropic.com/v1/models";
  const r = await fetch(ep, { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" } });
  const data = await safeJson(r);
  return { ok: r.ok, type: "anthropic", status: r.status, endpoint: ep,
    summary: r.ok ? `${(data as any)?.data?.length ?? 0} Claude models accessible` : `Anthropic rejected key (${r.status})`, data };
}
async function probeGemini(key: string): Promise<ProbeResult> {
  const ep = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
  const r = await fetch(ep);
  const data = await safeJson(r);
  return { ok: r.ok, type: "google_api", status: r.status, endpoint: ep.replace(key, "***"),
    summary: r.ok ? `${(data as any)?.models?.length ?? 0} Gemini models accessible` : `Google rejected key (${r.status})`, data };
}
async function probeStripe(key: string): Promise<ProbeResult> {
  const ep = "https://api.stripe.com/v1/account";
  const r = await fetch(ep, { headers: { Authorization: `Bearer ${key}` } });
  const data = await safeJson(r); const acct = data as any;
  return { ok: r.ok, type: "stripe", status: r.status, endpoint: ep,
    summary: r.ok ? `Stripe acct ${acct?.id} · ${acct?.business_profile?.name ?? acct?.email ?? "unknown"} · ${acct?.country}` : `Stripe rejected key (${r.status})`, data };
}
async function probeGithub(key: string): Promise<ProbeResult> {
  const ep = "https://api.github.com/user";
  const r = await fetch(ep, { headers: { Authorization: `token ${key}`, Accept: "application/vnd.github+json" } });
  const data = await safeJson(r); const u = data as any;
  return { ok: r.ok, type: "github_token", status: r.status, endpoint: ep,
    summary: r.ok ? `GitHub ${u?.login} · ${u?.public_repos ?? 0} public repos` : `GitHub rejected token (${r.status})`, data };
}
async function probeGeneric(key: string, hostHint?: string): Promise<ProbeResult> {
  const target = hostHint && /^https?:\/\//.test(hostHint) ? hostHint : null;
  if (!target) return { ok: false, type: "unknown", status: 0, endpoint: "(no probe registered)", summary: "No live probe is registered for this key type", data: null };
  const r = await fetch(target, { headers: { Authorization: `Bearer ${key}` } });
  const data = await safeJson(r);
  return { ok: r.ok, type: "generic", status: r.status, endpoint: target, summary: `Generic Bearer probe → ${r.status}`, data };
}

async function dispatch(type: string, key: string, hostHint?: string): Promise<ProbeResult> {
  switch (type) {
    case "openai_sk":      return probeOpenAI(key);
    case "anthropic_key":  return probeAnthropic(key);
    case "google_api":     return probeGemini(key);
    case "stripe_live":
    case "stripe_test":    return probeStripe(key);
    case "github_token":
    case "github_pat":     return probeGithub(key);
    default:               return probeGeneric(key, hostHint);
  }
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "POST only" }, cors);

  // AUTH GATE — admin only. Key-probing is a sensitive capability that can
  // be abused as a free third-party key-testing proxy.
  try { await requireAdmin(req); }
  catch (e) { return authErrorResponse(e, cors); }

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }, cors); }
  const type = String(body?.type ?? "").trim();
  const key = String(body?.key ?? "").trim();
  const hostHint = body?.hostHint ? String(body.hostHint).trim() : undefined;

  if (!type || !key) return json(400, { error: "type and key are required" }, cors);
  if (key.length > 4000) return json(400, { error: "key too long" }, cors);

  try {
    const result = await dispatch(type, key, hostHint);
    return json(200, result, cors);
  } catch (e: any) {
    return json(200, {
      ok: false, type, status: 0, endpoint: "(network error)",
      summary: e?.message || "probe failed", data: null, error: e?.message || String(e),
    } satisfies ProbeResult, cors);
  }
});
