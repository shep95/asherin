// asherin.soren hosted model relay.
//
// asherin.soren is a free, no-account surface. Until an operator brings their
// own provider key, this relay lets the workspace's Lovable AI budget answer
// the tab's requests. The key never leaves the server; the browser only sends
// the prompt and receives text.
//
// Guardrails: strict CORS allowlist, per-IP burst limit, hard prompt size cap,
// and honest pass-through of gateway status codes (402/403/429 are surfaced,
// never disguised as a model answer).

import { getCorsHeaders, getClientIp } from "../_shared/cors.ts";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.8-flash";
const MAX_CHARS = 120_000;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 12;

const buckets = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (buckets.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  hits.push(now);
  buckets.set(ip, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (!v.some((t) => now - t < WINDOW_MS)) buckets.delete(k);
  }
  return hits.length > MAX_PER_WINDOW;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  const jsonHeaders = { ...cors, "content-type": "application/json" };

  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: jsonHeaders });
  }

  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    return new Response(
      JSON.stringify({ error: "the hosted model is not configured on this deployment. connect your own provider key." }),
      { status: 503, headers: jsonHeaders },
    );
  }

  if (rateLimited(getClientIp(req))) {
    return new Response(
      JSON.stringify({ error: "hosted model rate limit reached. wait a minute, or connect your own provider key for unlimited use." }),
      { status: 429, headers: jsonHeaders },
    );
  }

  let payload: { system?: unknown; prompt?: unknown; images?: unknown };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid request body" }), { status: 400, headers: jsonHeaders });
  }

  const system = typeof payload.system === "string" ? payload.system : "";
  const prompt = typeof payload.prompt === "string" ? payload.prompt : "";
  if (!prompt.trim()) {
    return new Response(JSON.stringify({ error: "empty prompt" }), { status: 400, headers: jsonHeaders });
  }
  if (system.length + prompt.length > MAX_CHARS) {
    return new Response(
      JSON.stringify({ error: "this workspace is larger than the hosted model window. connect your own provider key for large imports." }),
      { status: 413, headers: jsonHeaders },
    );
  }

  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  const images = Array.isArray(payload.images) ? payload.images.slice(0, 4) : [];
  for (const img of images) {
    const url = typeof img === "string" ? img : (img as { data_url?: string })?.data_url;
    if (typeof url === "string" && url.startsWith("data:image/")) {
      content.push({ type: "image_url", image_url: { url } });
    }
  }

  const messages: Array<Record<string, unknown>> = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content });

  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({ model: MODEL, messages }),
    });

    if (!res.ok) {
      const detail = await res.text();
      let message = detail;
      try {
        const parsed = JSON.parse(detail);
        message = parsed?.error?.message || parsed?.message || detail;
      } catch { /* raw text */ }
      if (res.status === 402) {
        message = "the hosted asherin model budget is exhausted. connect your own provider key to continue.";
      } else if (res.status === 403) {
        message = "the hosted model is blocked by workspace policy. connect your own provider key.";
      } else if (res.status === 429) {
        message = "the hosted model is rate limited right now. retry shortly, or connect your own provider key.";
      }
      return new Response(JSON.stringify({ error: message }), { status: res.status, headers: jsonHeaders });
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    return new Response(JSON.stringify({ ok: true, text, model: MODEL }), { status: 200, headers: jsonHeaders });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error)?.message || "hosted model request failed" }),
      { status: 502, headers: jsonHeaders },
    );
  }
});
