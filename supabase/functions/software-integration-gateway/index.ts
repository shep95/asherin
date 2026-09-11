// software-integration-gateway
//
// The only path by which an installed Asherin application reaches an outside
// API or MCP server. An artifact never holds a credential and never makes the
// call itself: it names an integration and an operation, this function proves
// the caller owns both, resolves the secret from edge-function env, performs a
// bounded request, and returns the response as untrusted data.
//
// Refusals are honest. If a credential is not configured, the answer is
// "configuration required" — never a pretend success.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 512_000;
const SECRET_NAME = /^[A-Z][A-Z0-9_]{2,64}$/;

const PRIVATE_V4 =
  /^(0|10|127|169\.254|192\.168|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])|172\.(1[6-9]|2\d|3[01]))\./;
const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "kubernetes.default.svc",
]);

function endpointSafe(raw: string): { ok: boolean; reason: string; url?: URL } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "not a valid address" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "only https is allowed" };
  if (url.username || url.password) return { ok: false, reason: "the address must not carry credentials" };
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(host)) return { ok: false, reason: "private infrastructure is not reachable" };
  if (/(^|\.)(local|internal|localdomain|home\.arpa)$/.test(host)) return { ok: false, reason: "private network" };
  if (PRIVATE_V4.test(host) || /^\d+$/.test(host)) return { ok: false, reason: "private network" };
  if (host === "::1" || host === "::" || /^f[cd][0-9a-f]{2}:/.test(host) || /^fe80:/.test(host)) {
    return { ok: false, reason: "private network" };
  }
  if (!host.includes(".")) return { ok: false, reason: "use a public hostname" };
  return { ok: true, reason: "ok", url };
}

const SENSITIVE_KEY = /(authorization|api[_-]?key|secret|token|password|cookie|credential|signature)/i;
function safeDetail(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (SENSITIVE_KEY.test(k)) out[k] = "[redacted]";
    else if (typeof v === "string") out[k] = v.slice(0, 200);
    else if (typeof v === "number" || typeof v === "boolean" || v === null) out[k] = v;
    else out[k] = { kind: "object" };
  }
  return out;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ ok: false, error: "sign in first" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.slice(7));
    const user = userData?.user;
    if (userError || !user) return json({ ok: false, error: "sign in first" }, 401);

    const body = await req.json().catch(() => ({}));
    const op = String(body?.op ?? "");
    const integrationId = String(body?.integrationId ?? "");
    if (!integrationId) return json({ ok: false, error: "which integration?" }, 400);

    const { data: integration } = await supabase
      .from("software_integration")
      .select("*")
      .eq("id", integrationId)
      .eq("owner_user_id", user.id)
      .maybeSingle();
    if (!integration) return json({ ok: false, error: "that integration does not belong to you" }, 403);

    const audit = async (
      eventType: string,
      outcome: "ok" | "denied" | "failed" | "unavailable",
      detail: Record<string, unknown>,
      artifactId: string | null = null,
      operation: string | null = null,
    ) => {
      await supabase.from("software_integration_event").insert({
        owner_user_id: user.id,
        integration_id: integrationId,
        artifact_id: artifactId,
        event_type: eventType,
        operation,
        outcome,
        detail: safeDetail(detail),
      });
    };

    // credential resolution: only the NAME travels; the value never leaves here.
    const credentialRef: string | null = integration.credential_ref ?? null;
    let credential: string | null = null;
    if (integration.auth_type !== "none") {
      if (!credentialRef || !SECRET_NAME.test(credentialRef)) {
        await audit("credential", "unavailable", { credential_ref: "[redacted]" });
        return json({ ok: false, state: "configuration_required", error: "no credential name is set for this connection" });
      }
      credential = Deno.env.get(credentialRef) ?? null;
      if (!credential) {
        await audit("credential", "unavailable", { reason: "secret not present in this environment" });
        return json({
          ok: false,
          state: "configuration_required",
          error: `the secret ${credentialRef} has not been added to this project yet`,
        });
      }
    }

    if (integration.status !== "active") {
      await audit(op || "invoke", "denied", { reason: `integration is ${integration.status}` });
      return json({ ok: false, state: "revoked", error: `this connection is ${integration.status}` });
    }

    const endpointRaw = String(integration.endpoint ?? "");
    const safe = endpointSafe(endpointRaw);
    if (!safe.ok || !safe.url) {
      await audit(op || "invoke", "denied", { reason: safe.reason });
      return json({ ok: false, state: "blocked", error: safe.reason });
    }

    const authHeaders: Record<string, string> = {};
    if (credential) {
      if (integration.auth_type === "bearer" || integration.auth_type === "oauth2") {
        authHeaders["Authorization"] = `Bearer ${credential}`;
      } else if (integration.auth_type === "basic") {
        authHeaders["Authorization"] = `Basic ${credential}`;
      } else {
        authHeaders["X-Api-Key"] = credential;
      }
    }

    const call = async (url: string, init: RequestInit) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const started = Date.now();
      try {
        const res = await fetch(url, { ...init, signal: controller.signal, redirect: "manual" });
        if (res.status >= 300 && res.status < 400) {
          return { status: res.status, ms: Date.now() - started, text: "", blocked: "the service tried to redirect the call" };
        }
        const reader = res.body?.getReader();
        let text = "";
        if (reader) {
          let bytes = 0;
          const decoder = new TextDecoder();
          while (bytes < MAX_BYTES) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            text += decoder.decode(value, { stream: true });
          }
          await reader.cancel().catch(() => undefined);
          if (bytes >= MAX_BYTES) text += "\n[response truncated]";
        }
        return { status: res.status, ms: Date.now() - started, text, blocked: null as string | null };
      } finally {
        clearTimeout(timer);
      }
    };

    /* ── health check ─────────────────────────────────────────────────── */
    if (op === "health") {
      let health = "failed";
      let detail = "";
      try {
        const isMcp = integration.integration_type === "mcp";
        const result = isMcp
          ? await call(safe.url.toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...authHeaders },
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "asherin", version: "1" } },
              }),
            })
          : await call(safe.url.toString(), { method: "GET", headers: authHeaders });

        if (result.blocked) {
          health = "failed";
          detail = result.blocked;
        } else if (result.status >= 200 && result.status < 300) {
          health = result.ms > 5000 ? "degraded" : "connected";
          detail = `responded ${result.status} in ${result.ms}ms`;
        } else if (result.status === 401 || result.status === 403) {
          health = "failed";
          detail = `the service refused the credential (${result.status})`;
        } else {
          health = "degraded";
          detail = `responded ${result.status}`;
        }
      } catch (e) {
        health = "failed";
        detail = e instanceof Error && e.name === "AbortError" ? "the service did not answer in time" : "the service could not be reached";
      }

      await supabase
        .from("software_integration")
        .update({ health, health_detail: detail, last_checked_at: new Date().toISOString() })
        .eq("id", integrationId)
        .eq("owner_user_id", user.id);
      await audit("health_check", health === "connected" ? "ok" : "failed", { health, detail });
      return json({ ok: health === "connected" || health === "degraded", health, detail });
    }

    /* ── mcp capability discovery ─────────────────────────────────────── */
    if (op === "discover") {
      if (integration.integration_type !== "mcp") {
        return json({ ok: false, error: "only an mcp server reports its own tools" }, 400);
      }
      try {
        const result = await call(safe.url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...authHeaders },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
        });
        if (result.blocked || result.status < 200 || result.status >= 300) {
          await audit("discover", "failed", { status: result.status, reason: result.blocked ?? "non-2xx" });
          return json({ ok: false, error: result.blocked ?? `the server answered ${result.status}` });
        }
        // the server's own report, taken as data: names and descriptions only.
        const text = result.text.replace(/^data:\s*/gm, "");
        const parsed = JSON.parse(text.trim().split("\n").filter(Boolean).pop() ?? "{}");
        const rawTools = Array.isArray(parsed?.result?.tools) ? parsed.result.tools : [];
        const tools = rawTools
          .filter((t: unknown) => t && typeof (t as { name?: unknown }).name === "string")
          .slice(0, 100)
          .map((t: { name: string; description?: string }) => ({
            name: String(t.name).slice(0, 120),
            description: typeof t.description === "string" ? t.description.slice(0, 300) : undefined,
          }));
        const contract = (integration.contract ?? {}) as Record<string, unknown>;
        const operations = tools.map((t: { name: string; description?: string }) => ({
          id: t.name,
          label: t.description ? `${t.name} — ${t.description}`.slice(0, 160) : t.name,
          effect: "write",
          scope: `mcp.${t.name}`,
          inputs: [],
          outputs: [],
        }));
        await supabase
          .from("software_integration")
          .update({ contract: { ...contract, tools, operations }, capabilities: { tools: tools.length } })
          .eq("id", integrationId)
          .eq("owner_user_id", user.id);
        await audit("discover", "ok", { tools: tools.length });
        return json({ ok: true, tools: tools.length });
      } catch {
        await audit("discover", "failed", { reason: "could not read the tool list" });
        return json({ ok: false, error: "the server did not return a readable tool list" });
      }
    }

    /* ── invocation ───────────────────────────────────────────────────── */
    if (op === "invoke") {
      const artifactId = body?.artifactId ? String(body.artifactId) : null;
      const operationId = String(body?.operationId ?? "");
      const toolName = body?.toolName ? String(body.toolName) : null;
      const input = (body?.input ?? {}) as Record<string, unknown>;
      if (!artifactId || !operationId) return json({ ok: false, error: "an app and an operation are required" }, 400);

      const { data: artifact } = await supabase
        .from("software_artifact")
        .select("id")
        .eq("id", artifactId)
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (!artifact) {
        await audit("invoke", "denied", { reason: "artifact not owned by caller" }, null, operationId);
        return json({ ok: false, error: "that app does not belong to you" }, 403);
      }

      const { data: grant } = await supabase
        .from("software_integration_grant")
        .select("*")
        .eq("integration_id", integrationId)
        .eq("artifact_id", artifactId)
        .eq("owner_user_id", user.id)
        .maybeSingle();

      const contract = (integration.contract ?? {}) as {
        operations?: Array<{ id: string; scope: string; effect?: string; method?: string; path?: string; label?: string }>;
        tools?: Array<{ name: string }>;
        limits?: { requestsPerMinute?: number | null };
      };
      const operation = contract.operations?.find((o) => o.id === operationId);

      const denyWith = async (reason: string) => {
        await audit("invoke", "denied", { reason }, artifactId, operationId);
        return json({ ok: false, state: "denied", error: reason });
      };

      if (!grant || grant.state !== "approved") return await denyWith("this app has not been granted this connection");
      if (!operation) return await denyWith("that operation is not part of this connection");
      if (!(grant.granted_scopes ?? []).includes(operation.scope)) {
        return await denyWith(`this app was not granted “${operation.scope}”`);
      }
      if (integration.integration_type === "mcp") {
        const tool = toolName ?? operationId;
        if (!(grant.granted_tools ?? []).includes(tool)) return await denyWith(`the tool “${tool}” was not granted to this app`);
      }
      if ((operation.effect ?? "read") !== "read" && body?.confirmed !== true) {
        await audit("invoke", "denied", { reason: "confirmation required", effect: operation.effect }, artifactId, operationId);
        return json({ ok: false, state: "confirmation_required", error: "this action changes data — confirm it first" });
      }

      // rate ceiling, counted from the audit trail rather than trusted input.
      const ceiling = contract.limits?.requestsPerMinute ?? 60;
      const since = new Date(Date.now() - 60_000).toISOString();
      const { count } = await supabase
        .from("software_integration_event")
        .select("id", { count: "exact", head: true })
        .eq("integration_id", integrationId)
        .eq("artifact_id", artifactId)
        .eq("event_type", "invoke")
        .gte("created_at", since);
      if ((count ?? 0) >= ceiling) return await denyWith(`this connection is limited to ${ceiling} calls a minute`);

      try {
        let result: { status: number; ms: number; text: string; blocked: string | null };
        if (integration.integration_type === "mcp") {
          result = await call(safe.url.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...authHeaders },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: Date.now(),
              method: "tools/call",
              params: { name: toolName ?? operationId, arguments: input },
            }),
          });
        } else {
          const target = new URL(operation.path ?? "", safe.url.toString());
          const targetSafe = endpointSafe(target.toString());
          if (!targetSafe.ok) return await denyWith(targetSafe.reason);
          const method = (operation.method ?? "GET").toUpperCase();
          result = await call(target.toString(), {
            method,
            headers: { "Content-Type": "application/json", ...authHeaders },
            body: method === "GET" || method === "HEAD" ? undefined : JSON.stringify(input),
          });
        }

        if (result.blocked) {
          await audit("invoke", "failed", { reason: result.blocked }, artifactId, operationId);
          return json({ ok: false, state: "blocked", error: result.blocked });
        }

        await audit(
          "invoke",
          result.status >= 200 && result.status < 300 ? "ok" : "failed",
          { status: result.status, ms: result.ms, bytes: result.text.length },
          artifactId,
          operationId,
        );

        // the response is data, never instruction. the caller wraps it as such.
        return json({
          ok: result.status >= 200 && result.status < 300,
          status: result.status,
          untrusted: true,
          body: result.text,
        });
      } catch (e) {
        const reason = e instanceof Error && e.name === "AbortError" ? "the service did not answer in time" : "the call failed";
        await audit("invoke", "failed", { reason }, artifactId, operationId);
        return json({ ok: false, state: "failed", error: reason });
      }
    }

    return json({ ok: false, error: "unknown operation" }, 400);
  } catch (e) {
    console.error("software-integration-gateway", e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ ok: false, error: "the gateway could not complete that" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
