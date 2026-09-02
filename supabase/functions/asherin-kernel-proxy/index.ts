// asherin-kernel-proxy
//
// The vessel (asherin.com) does not expose arbitrary network access. This
// function is the authenticated boundary for the external Asherin kernel and
// for the small set of already-implemented, first-party adapters in this app.
//
// Contract:
//   POST { op: "retrieve", query, k? }  -> { ok: true, cards: [...] }
//   POST { op: "tool", tool, args }     -> { ok: true, result: ... }
//
// Rules:
//   - A valid Supabase user JWT is required.
//   - Kernel secrets live only in edge-function env and are never returned.
//   - External kernel tools never silently become fabricated local output.
//   - Procedure retrieval is backed by the shipped, bounded pattern index when
//     no external kernel is configured. This is retrieval, not live intelligence.
//   - Tool calls use an existing, allow-listed first-party adapter only when
//     that capability is genuinely implemented in this project; otherwise the
//     response remains the explicit offline contract.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { retrieveAsherinCards } from "../_shared/asherinPatternIndex.ts";

const KERNEL_OFFLINE = { ok: false, error: "kernel offline", fake: false } as const;
const KERNEL_TIMEOUT_MS = 25_000;
const ADAPTER_TIMEOUT_MS = 20_000;

// Tools the vessel may ask the kernel to run. Anything else is refused here
// rather than forwarded, so a compromised client cannot turn this proxy into a
// generic outbound request runner.
const ALLOWED_TOOLS = new Set([
  "elite_dorks",
  "search_swarm",
  "zophiel_search",
  "dork",
  "path_map",
  "intel_map",
  "site_cyber_map",
  "osint_intel",
  "osint_lookup",
  "dork_auto",
  "file_metadata",
  "social_fetch",
  "asherinx",
]);

const jsonHeaders = { "Content-Type": "application/json" };

type User = { id: string; email?: string };

function json(body: unknown, cors: Record<string, string>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, ...jsonHeaders },
  });
}

async function authenticate(req: Request): Promise<User | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email };
}

async function postJson(
  url: string,
  authHeader: string,
  payload: unknown,
  timeoutMs: number,
): Promise<{ ok: true; data: any } | { ok: false }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data) return { ok: false };
    return { ok: true, data };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

async function callExternalKernel(
  base: string,
  token: string,
  path: string,
  payload: unknown,
): Promise<{ ok: true; data: unknown } | { ok: false }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KERNEL_TIMEOUT_MS);
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok || !res.headers.get("content-type")?.includes("application/json")) {
      return { ok: false };
    }
    return { ok: true, data: await res.json() };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

function targetHost(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = parsed.hostname.toLowerCase();
    if (!/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(host)) return null;
    return host;
  } catch {
    const host = raw.replace(/^https?:\/\//i, "").split(/[/?#]/)[0].toLowerCase();
    return /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(host) ? host : null;
  }
}

/**
 * Adapters for capabilities that already have a real edge implementation.
 * These are not simulated kernel results: each adapter calls the same
 * authenticated function used by the corresponding product surface.
 */
async function callFirstPartyAdapter(
  tool: string,
  args: Record<string, unknown>,
  authHeader: string,
): Promise<{ handled: boolean; result?: unknown }> {
  const base = Deno.env.get("SUPABASE_URL");
  if (!base) return { handled: false };
  const endpoint = (name: string) => `${base.replace(/\/+$/, "")}/functions/v1/${name}`;

  if (tool === "search_swarm" || tool === "asherinx") {
    const query = String(args.query ?? "").trim().slice(0, 512);
    if (!query) return { handled: true, result: { error: "query required" } };
    const out = await postJson(endpoint("asherinx-engine"), authHeader, {
      action: "query",
      query,
      domain: typeof args.domain === "string" ? args.domain : undefined,
    }, ADAPTER_TIMEOUT_MS);
    return out.ok ? { handled: true, result: out.data } : { handled: false };
  }

  if (tool === "dork_auto" || tool === "path_map" || tool === "site_cyber_map") {
    const raw = args.target ?? args.url;
    const host = targetHost(raw);
    if (!host) return { handled: true, result: { error: "a public domain is required" } };
    const mode = tool === "path_map" ? "path_map" : tool === "site_cyber_map" ? "swarm" : "dork";
    const out = await postJson(endpoint("asherin-live-dork"), authHeader, {
      mode,
      host,
      query: String(raw),
    }, ADAPTER_TIMEOUT_MS);
    return out.ok ? { handled: true, result: out.data } : { handled: false };
  }

  if (tool === "social_fetch") {
    const platform = String(args.platform ?? "").toLowerCase();
    if (!["x", "instagram", "linkedin", "facebook"].includes(platform)) {
      return { handled: true, result: { error: "platform must be x, instagram, linkedin, or facebook" } };
    }
    const query = String(args.query ?? "").trim().slice(0, 300);
    if (!query) return { handled: true, result: { error: "query required" } };
    const out = await postJson(endpoint("social-intel"), authHeader, {
      targets: [{ platform, handle: query }],
    }, ADAPTER_TIMEOUT_MS);
    return out.ok ? { handled: true, result: out.data } : { handled: false };
  }

  // These capabilities require the separate kernel or an explicitly supplied
  // file/document substrate. Do not reinterpret them as a weaker tool.
  return { handled: false };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method not allowed" }, cors, 405);

  const user = await authenticate(req);
  if (!user) return json({ ok: false, error: "unauthorized" }, cors, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid request" }, cors, 400);
  }

  const op = typeof body.op === "string" ? body.op : "";
  const kernelUrl = Deno.env.get("ASHERIN_KERNEL_URL");
  const kernelToken = Deno.env.get("ASHERIN_KERNEL_TOKEN");
  const authHeader = req.headers.get("Authorization") ?? "";

  if (op === "retrieve") {
    const query = typeof body.query === "string" ? body.query.slice(0, 4000) : "";
    if (!query) return json({ ok: false, error: "invalid request" }, cors, 400);
    const kRaw = typeof body.k === "number" ? Math.floor(body.k) : 5;
    const k = Math.min(7, Math.max(3, Number.isFinite(kRaw) ? kRaw : 5));

    if (kernelUrl && kernelToken) {
      const out = await callExternalKernel(kernelUrl, kernelToken, "/retrieve", { query, k });
      if (!out.ok) return json(KERNEL_OFFLINE, cors);
      const data = out.data as { cards?: unknown };
      return json({ ok: true, cards: Array.isArray(data?.cards) ? data.cards.slice(0, k) : [] }, cors);
    }

    // The uploaded wrapper's benign thinking-pattern corpus is already ported
    // to a bounded server-side index. It is safe to use for retrieval without
    // pretending that a live OSINT/cyber kernel is running.
    return json({ ok: true, cards: retrieveAsherinCards(query).slice(0, k), source: "asherin-pattern-index" }, cors);
  }

  if (op === "tool") {
    const tool = typeof body.tool === "string" ? body.tool : "";
    if (!ALLOWED_TOOLS.has(tool)) return json({ ok: false, error: "unknown tool" }, cors, 400);
    const args = body.args && typeof body.args === "object" ? body.args as Record<string, unknown> : {};

    if (kernelUrl && kernelToken) {
      const out = await callExternalKernel(kernelUrl, kernelToken, "/tool", { tool, args });
      if (!out.ok) return json(KERNEL_OFFLINE, cors);
      const data = out.data as { result?: unknown };
      return json({ ok: true, tool, result: data?.result ?? data }, cors);
    }

    const adapted = await callFirstPartyAdapter(tool, args, authHeader);
    if (adapted.handled) return json({ ok: true, tool, result: adapted.result }, cors);
    return json({ ...KERNEL_OFFLINE, tool }, cors);
  }

  return json({ ok: false, error: "invalid request" }, cors, 400);
});
