// asherin.search — identity mode.
// pivots outward from a seed identifier through free public sources. sources
// that need a key surface unmeasured with the reason. no fake rows.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUser, authErrorResponse } from "../_shared/authMiddleware.ts";
import { expandPivot, type PivotNode, type IdentifierKind } from "../_shared/discover/pivot.ts";
import { crtByEmail } from "../_shared/discover/crtsh.ts";
import { waybackByIdentifier } from "../_shared/discover/waybackCdx.ts";
import {
  gravatarProfile, githubUserByEmail, keyserverProfile, xposedOrNot,
  secEdgarByName, wikidataByName, faaAirmen, type IdResult,
} from "../_shared/discover/identitySources.ts";
import { scoreSensitivity } from "../_shared/discover/sensitivity.ts";

interface Body { identifier: string; kind: IdentifierKind }

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: cors });

  let user;
  try { user = await requireUser(req); } catch (e) { return authErrorResponse(e, cors); }

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400, cors); }
  const identifier = String(body?.identifier ?? "").trim();
  const kind = (["email", "phone", "username", "name"] as const).includes(body?.kind as never)
    ? (body.kind as IdentifierKind) : null;
  if (!identifier || !kind) return json({ error: "identifier and kind (email|phone|username|name) required" }, 400, cors);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: run } = await admin
    .from("search_discover_runs")
    .insert({ user_id: user.id, seed: identifier, kind: "identity" })
    .select("id").single();
  if (!run) return json({ error: "could not open run" }, 500, cors);
  const runId = run.id as string;

  const hitInserts: Array<Record<string, unknown>> = [];
  const meta: Record<string, Record<string, unknown>> = { sources: {} };

  async function collect(source: string, res: IdResult) {
    meta.sources[source] = res.available
      ? { available: true, count: res.rows.length }
      : { available: false, reason: res.reason ?? "unmeasured" };
    for (const r of res.rows) {
      hitInserts.push({
        run_id: runId, user_id: user!.id,
        source, url: r.url ?? null, kind: r.kind,
        exposure_class: "identity",
        sensitivity: scoreSensitivity("identity", r.evidence ?? r.summary),
        last_probed_at: new Date().toISOString(),
        evidence_excerpt: (r.evidence ?? r.summary).slice(0, 400),
        meta: { discovered: r.discovered },
      });
    }
    return res.rows;
  }

  async function resolveNode(node: PivotNode): Promise<Array<{ identifier: string; kind: IdentifierKind }>> {
    const discovered: Array<{ identifier: string; kind: IdentifierKind }> = [];
    if (node.kind === "email") {
      const results = await Promise.allSettled([
        collect("gravatar", await gravatarProfile(node.identifier)),
        collect("github", await githubUserByEmail(node.identifier)),
        collect("keys.openpgp.org", await keyserverProfile(node.identifier)),
        collect("xposedornot", await xposedOrNot(node.identifier)),
        collect("crt.sh", { available: true, rows: (await crtByEmail(node.identifier)).slice(0, 10).map((r) => ({
          source: "crt.sh", kind: "cert", summary: `s/mime cert for ${node.identifier} on ${r.name}`, discovered: [{ identifier: r.name, kind: "domain" as const }],
        })) }),
        collect("wayback", {
          available: true,
          rows: (await waybackByIdentifier(node.identifier, 20)).slice(0, 20).map((r) => ({
            source: "wayback", kind: "archive", url: `https://web.archive.org/web/${r.timestamp}/${r.original}`,
            summary: `archive captured a page mentioning ${node.identifier}`, discovered: [],
          })),
        }),
      ]);
      for (const r of results) if (r.status === "fulfilled") for (const row of r.value) for (const d of row.discovered) discovered.push(d);
      const localPart = node.identifier.split("@")[0];
      if (localPart && node.depth === 0) discovered.push({ identifier: localPart, kind: "username" });
    } else if (node.kind === "name") {
      const [sec, wiki, faa, wb] = await Promise.allSettled([
        collect("sec.edgar", await secEdgarByName(node.identifier)),
        collect("wikidata", await wikidataByName(node.identifier)),
        collect("faa.airmen", await faaAirmen(node.identifier)),
        collect("wayback", {
          available: true,
          rows: (await waybackByIdentifier(node.identifier, 20)).slice(0, 20).map((r) => ({
            source: "wayback", kind: "archive", url: `https://web.archive.org/web/${r.timestamp}/${r.original}`,
            summary: `archive captured a page mentioning ${node.identifier}`, discovered: [],
          })),
        }),
      ]);
      for (const r of [sec, wiki, faa, wb]) if (r.status === "fulfilled") for (const row of r.value) for (const d of row.discovered) discovered.push(d);
    } else if (node.kind === "username") {
      const wb = await collect("wayback", {
        available: true,
        rows: (await waybackByIdentifier(node.identifier, 20)).slice(0, 20).map((r) => ({
          source: "wayback", kind: "archive", url: `https://web.archive.org/web/${r.timestamp}/${r.original}`,
          summary: `archive mentions username ${node.identifier}`, discovered: [],
        })),
      });
      for (const row of wb) for (const d of row.discovered) discovered.push(d);
    } else if (node.kind === "phone") {
      meta.sources["carrier.numverify"] = { available: false, reason: "requires NUMVERIFY_API_KEY" };
      meta.sources["opencnam"] = { available: false, reason: "requires OPENCNAM credentials" };
      const wb = await collect("wayback", {
        available: true,
        rows: (await waybackByIdentifier(node.identifier, 15)).slice(0, 15).map((r) => ({
          source: "wayback", kind: "archive", url: `https://web.archive.org/web/${r.timestamp}/${r.original}`,
          summary: `archive mentions phone ${node.identifier}`, discovered: [],
        })),
      });
      for (const row of wb) for (const d of row.discovered) discovered.push(d);
    }
    return discovered;
  }

  const nodes = await expandPivot({ identifier, kind }, resolveNode, { maxDepth: 2, maxNodes: 20, maxFanoutPerNode: 6 });

  // persist pivot graph
  await admin.from("search_identity_pivots").insert(nodes.map((n) => ({
    run_id: runId, user_id: user.id,
    parent_node: n.parentId, node_id: n.id,
    identifier: n.identifier.slice(0, 500), kind: n.kind, depth: n.depth,
  })));

  for (let i = 0; i < hitInserts.length; i += 500) {
    await admin.from("search_hits").insert(hitInserts.slice(i, i + 500));
  }
  await admin.from("search_discover_runs").update({ status: "done", ended_at: new Date().toISOString() }).eq("id", runId);

  return json({ run_id: runId, hits: hitInserts.length, nodes: nodes.length, meta }, 200, cors);
});

function json(x: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(x), { status, headers: { ...cors, "content-type": "application/json" } });
}
