// asherin.arvision — visual positioning proxy.
//
// The uploaded package authenticates machine-to-machine against the map service
// and posts a query frame with camera intrinsics to get a pose back. Those
// credentials must never sit in a browser bundle, so the exchange happens here:
// verified caller, subscription checked server-side, token cached in memory,
// bounded frame size, hard timeouts.
//
// When the credentials are not configured this returns an explicit unavailable
// state. It never returns a pose it did not receive from the service.

import { getCorsHeaders } from "../_shared/cors.ts";
import { requireTier } from "../_shared/tierGate.ts";

const AUTH_URL = "https://api.multiset.ai/v1/m2m/token";
const QUERY_URL = "https://api.multiset.ai/v1/vps/map/query-form";

const CLIENT_ID = Deno.env.get("MULTISET_CLIENT_ID") ?? "";
const CLIENT_SECRET = Deno.env.get("MULTISET_CLIENT_SECRET") ?? "";

const MAX_IMAGE_B64 = 3_000_000; // ~2.2mb jpeg
const REQUEST_TIMEOUT_MS = 15_000;
const TOKEN_SKEW_MS = 60_000;

let cachedToken: { value: string; expiresAt: number } | null = null;

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

function isConfigured() {
  return CLIENT_ID.length > 0 && CLIENT_SECRET.length > 0;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt - TOKEN_SKEW_MS > now) return cachedToken.value;

  const res = await fetchWithTimeout(AUTH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
  });
  if (!res.ok) {
    cachedToken = null;
    return null;
  }
  const body = await res.json().catch(() => null) as { token?: string; access_token?: string; expiresIn?: number } | null;
  const token = body?.token ?? body?.access_token ?? null;
  if (!token) return null;
  const ttl = typeof body?.expiresIn === "number" ? body.expiresIn * 1000 : 30 * 60_000;
  cachedToken = { value: token, expiresAt: now + ttl };
  return token;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405, cors);

  const gate = await requireTier(req, ["aureon", "pro", "lifetime"]);
  if (!gate.ok) return gate.response as Response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json body" }, 400, cors);
  }

  const action = String(body.action ?? "");

  if (action === "status") {
    return json({
      configured: isConfigured(),
      message: isConfigured()
        ? "positioning service configured"
        : "positioning service not configured. map credentials are missing, so camera localization is unavailable and you can still place yourself on the map by hand",
    }, 200, cors);
  }

  if (action !== "localize") return json({ error: "unknown action" }, 400, cors);

  if (!isConfigured()) {
    return json({
      poseFound: false,
      confidence: 0,
      unavailable: true,
      message: "positioning service not configured. add the map service credentials to enable camera localization",
    }, 200, cors);
  }

  const image = typeof body.image === "string" ? body.image : "";
  if (!image) return json({ error: "no frame supplied" }, 400, cors);
  if (image.length > MAX_IMAGE_B64) return json({ error: "frame too large" }, 413, cors);

  const mapCode = typeof body.mapCode === "string" ? body.mapCode.trim() : "";
  const mapSetCode = typeof body.mapSetCode === "string" ? body.mapSetCode.trim() : "";
  if (!mapCode && !mapSetCode) return json({ error: "a map code or map set code is required" }, 400, cors);

  const token = await getToken().catch(() => null);
  if (!token) {
    return json({
      poseFound: false,
      confidence: 0,
      unavailable: true,
      message: "positioning service rejected the configured credentials",
    }, 200, cors);
  }

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(image);
  } catch {
    return json({ error: "frame is not valid base64" }, 400, cors);
  }

  const form = new FormData();
  form.append("isRightHanded", String(Boolean(body.isRightHanded)));
  form.append("fx", String(numberOr(body.fx, 0)));
  form.append("fy", String(numberOr(body.fy, 0)));
  form.append("px", String(numberOr(body.px, 0)));
  form.append("py", String(numberOr(body.py, 0)));
  form.append("width", String(numberOr(body.width, 0)));
  form.append("height", String(numberOr(body.height, 0)));
  if (mapCode) form.append("mapCode", mapCode);
  if (mapSetCode) form.append("mapSetCode", mapSetCode);
  form.append("queryImage", new Blob([bytes as unknown as BlobPart], { type: "image/jpeg" }), "query.jpg");

  let res: Response;
  try {
    res = await fetchWithTimeout(QUERY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  } catch (_err) {
    return json({
      poseFound: false,
      confidence: 0,
      unavailable: true,
      message: "positioning service timed out",
    }, 200, cors);
  }

  if (res.status === 401 || res.status === 403) {
    cachedToken = null;
    return json({
      poseFound: false,
      confidence: 0,
      unavailable: true,
      message: "positioning service refused the request",
    }, 200, cors);
  }

  const payload = await res.json().catch(() => null) as Record<string, unknown> | null;
  if (!res.ok || !payload) {
    return json({
      poseFound: false,
      confidence: 0,
      unavailable: true,
      message: `positioning service error ${res.status}`,
    }, 200, cors);
  }

  const poseFound = Boolean(payload.poseFound);
  return json({
    poseFound,
    confidence: numberOr(payload.confidence, 0),
    position: payload.position ?? null,
    rotation: payload.rotation ?? null,
    mapCode: payload.mapCode ?? mapCode ?? null,
    unavailable: false,
    message: typeof payload.message === "string" && payload.message
      ? payload.message
      : poseFound
        ? "pose found"
        : "no pose found in this frame",
  }, 200, cors);
});
