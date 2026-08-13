// asherin-kernel-proxy
//
// The vessel (asherin.com) does not hold the kernel. The kernel is a separate
// runtime that owns thinking-pattern retrieval and the heavy operator tools
// (elite dork packs, search swarm, path maps). This function is the only door
// between them.
//
// Contract:
//   POST { op: "retrieve", query, k? }  -> { ok: true, cards: [...] }
//   POST { op: "tool", tool, args }     -> { ok: true, result: ... }
//
// Non-negotiable rules:
//   - The caller must present a valid Supabase user JWT. No anonymous reach.
//   - ASHERIN_KERNEL_URL / ASHERIN_KERNEL_TOKEN live only in edge secrets.
//     They are never returned, logged, or echoed into a response body.
//   - If the kernel is unset or unreachable we answer, verbatim,
//     { ok: false, error: "kernel offline", fake: false }.
//     We never synthesise cards, dorks, or tool output to look busy.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const KERNEL_OFFLINE = { ok: false, error: "kernel offline", fake: false };

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
]);

// A kernel call is a network call: bounded, aborted on time, never left to hang
// against the platform request timeout.
const KERNEL_TIMEOUT_MS = 25_000;

async function callKernel(
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
    if (!res.ok) return { ok: false };
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return { ok: false };
    return { ok: true, data: await res.json() };
  } catch {
    // Timeout, DNS failure, TLS failure, refused connection — all one answer.
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ ok: false, error: "method not allowed" }, 405);

  // ---- auth: real user JWT only -------------------------------------------
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return json({ ok: false, error: "unauthorized" }, 401);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) return json({ ok: false, error: "unauthorized" }, 401);

  // ---- kernel configuration ------------------------------------------------
  const kernelUrl = Deno.env.get("ASHERIN_KERNEL_URL");
  const kernelToken = Deno.env.get("ASHERIN_KERNEL_TOKEN");
  if (!kernelUrl || !kernelToken) return json(KERNEL_OFFLINE, 200);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid request" }, 400);
  }

  const op = typeof body.op === "string" ? body.op : "";

  if (op === "retrieve") {
    const query = typeof body.query === "string" ? body.query.slice(0, 4000) : "";
    if (!query) return json({ ok: false, error: "invalid request" }, 400);
    // 3–7 procedure cards. Never an identity costume, never a SKILL.md dump.
    const kRaw = typeof body.k === "number" ? Math.floor(body.k) : 5;
    const k = Math.min(7, Math.max(3, Number.isFinite(kRaw) ? kRaw : 5));

    const out = await callKernel(kernelUrl, kernelToken, "/retrieve", { query, k });
    if (!out.ok) return json(KERNEL_OFFLINE, 200);
    const data = out.data as { cards?: unknown };
    const cards = Array.isArray(data?.cards) ? data.cards.slice(0, k) : [];
    return json({ ok: true, cards });
  }

  if (op === "tool") {
    const tool = typeof body.tool === "string" ? body.tool : "";
    if (!ALLOWED_TOOLS.has(tool)) return json({ ok: false, error: "unknown tool" }, 400);
    const args = body.args && typeof body.args === "object" ? body.args : {};

    const out = await callKernel(kernelUrl, kernelToken, "/tool", { tool, args });
    if (!out.ok) return json(KERNEL_OFFLINE, 200);
    const data = out.data as { result?: unknown };
    return json({ ok: true, tool, result: data?.result ?? data });
  }

  return json({ ok: false, error: "invalid request" }, 400);
});
