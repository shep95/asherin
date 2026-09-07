// asherin.data — alert evaluation.
// Rules are arithmetic, not opinion: a threshold, a change, or a value falling
// outside the historic band. Every fire writes an event with the number that
// caused it, so an alert can always be audited after the fact.

import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUser, authErrorResponse } from "../_shared/authMiddleware.ts";
import { adminClient, workspaceRole, canWrite, jsonResponse, loadRows, auditData } from "../_shared/dataAccess.ts";

interface RuleSpec {
  metric: string;
  aggregate?: "sum" | "avg" | "count" | "max" | "min";
  operator?: ">" | "<" | ">=" | "<=" | "==" | "change>" | "change<";
  threshold?: number;
  /** for anomaly rules: how many standard deviations count as unusual */
  sigma?: number;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = Number(String(v).replace(/[$£€¥,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function aggregate(rows: Record<string, unknown>[], metric: string, how: RuleSpec["aggregate"] = "sum"): number | null {
  const nums = rows.map((r) => num(r[metric])).filter((n): n is number => n !== null);
  if (how === "count") return rows.length;
  if (!nums.length) return null;
  switch (how) {
    case "avg": return nums.reduce((a, b) => a + b, 0) / nums.length;
    case "max": return Math.max(...nums);
    case "min": return Math.min(...nums);
    default: return nums.reduce((a, b) => a + b, 0);
  }
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: cors });

  let user;
  try { user = await requireUser(req); } catch (e) { return authErrorResponse(e, cors); }

  let body: { workspace_id?: string; rule_id?: string };
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid json" }, 400, cors); }
  const workspaceId = String(body.workspace_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return jsonResponse({ error: "workspace_id is required" }, 400, cors);

  const admin = adminClient();
  const role = await workspaceRole(admin, workspaceId, user.id);
  if (!role) return jsonResponse({ error: "no access to this workspace" }, 403, cors);
  if (!canWrite(role)) return jsonResponse({ error: "viewers cannot run alerts" }, 403, cors);

  let q = admin.from("data_alert_rules").select("*").eq("workspace_id", workspaceId).eq("active", true);
  if (body.rule_id) q = q.eq("id", String(body.rule_id));
  const { data: rules } = await q.limit(100);
  if (!rules?.length) return jsonResponse({ evaluated: 0, fired: 0, events: [] }, 200, cors);

  const events: Record<string, unknown>[] = [];
  const versionCache = new Map<string, { rows: Record<string, unknown>[]; prev: Record<string, unknown>[] }>();

  for (const rule of rules) {
    const spec = (rule.spec ?? {}) as RuleSpec;
    if (!spec.metric) continue;
    let bundle = versionCache.get(rule.source_id);
    if (!bundle) {
      const { data: versions } = await admin
        .from("data_versions").select("id, version").eq("source_id", rule.source_id)
        .order("version", { ascending: false }).limit(2);
      if (!versions?.length) continue;
      const current = await loadRows(admin, versions[0].id as string, 20_000);
      const previous = versions[1] ? await loadRows(admin, versions[1].id as string, 20_000) : { rows: [] };
      bundle = { rows: current.rows, prev: previous.rows };
      versionCache.set(rule.source_id, bundle);
    }

    const value = aggregate(bundle.rows, spec.metric, spec.aggregate);
    if (value === null) continue;
    let fired = false;
    let message = "";

    if (rule.kind === "anomaly") {
      const nums = bundle.rows.map((r) => num(r[spec.metric])).filter((n): n is number => n !== null);
      if (nums.length >= 12) {
        const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
        const sd = Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / nums.length);
        const latest = nums[nums.length - 1];
        const sigma = spec.sigma ?? 3;
        if (sd > 0 && Math.abs(latest - mean) > sigma * sd) {
          fired = true;
          message = `${spec.metric} is at ${latest}, which is ${(Math.abs(latest - mean) / sd).toFixed(1)} standard deviations from its normal range of ${mean.toFixed(2)}`;
        }
      }
    } else if (rule.kind === "change") {
      const before = aggregate(bundle.prev, spec.metric, spec.aggregate);
      if (before !== null && before !== 0) {
        const pct = ((value - before) / Math.abs(before)) * 100;
        const limit = spec.threshold ?? 10;
        if ((spec.operator === "change<" && pct <= -Math.abs(limit)) || (spec.operator !== "change<" && pct >= Math.abs(limit))) {
          fired = true;
          message = `${spec.metric} moved ${pct.toFixed(1)}% against the previous version (${before.toFixed(2)} to ${value.toFixed(2)})`;
        }
      }
    } else {
      const t = spec.threshold ?? 0;
      const op = spec.operator ?? ">";
      fired = op === ">" ? value > t : op === "<" ? value < t : op === ">=" ? value >= t : op === "<=" ? value <= t : value === t;
      if (fired) message = `${spec.metric} is ${value} which is ${op} ${t}`;
    }

    if (fired) {
      const { data: ev } = await admin.from("data_alert_events").insert({
        workspace_id: workspaceId,
        rule_id: rule.id,
        kind: rule.kind,
        metric: spec.metric,
        value,
        expected: spec,
        message,
      }).select("id, message, metric, value, created_at").single();
      if (ev) events.push({ ...ev, rule: rule.name });
    }
  }

  await auditData(admin, workspaceId, user.id, "alerts.evaluate", workspaceId, { rules: rules.length, fired: events.length });
  return jsonResponse({ evaluated: rules.length, fired: events.length, events }, 200, cors);
});
