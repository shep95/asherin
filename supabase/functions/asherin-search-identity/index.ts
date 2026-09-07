// asherin.search — identity mode.
//
// narrative this implements: a seed identifier is not a query, it is a door.
// every door opens onto a set of public record surfaces; each surface either
// answers, answers empty, or refuses. what comes back is not just rows — it is
// new identifiers, which are new doors. the engine keeps opening doors until it
// runs out of depth, nodes or time, and it never invents a room it did not
// enter. a surface that refuses is reported as refused, with the reason, so an
// empty screen is never mistaken for a clean subject.
//
// hard rules: public sources only, no login, no exploitation, no fabrication.
// paid or key-gated surfaces are declared unmeasured with the exact key name.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUser, authErrorResponse } from "../_shared/authMiddleware.ts";
import { expandPivot, type PivotNode, type IdentifierKind } from "../_shared/discover/pivot.ts";
import { crtByEmail } from "../_shared/discover/crtsh.ts";
import { waybackByIdentifier } from "../_shared/discover/waybackCdx.ts";
import {
  gravatarProfile, githubUserByEmail, keyserverProfile, xposedOrNot, leakCheckEmail,
  emailKeyedSources, secEdgarByName, wikidataByName, type IdResult,
} from "../_shared/discover/identitySources.ts";
import {
  wikipediaByName, openAlexByName, orcidByName, crossrefByName, pubmedByName,
  openLibraryByName, courtListenerByName, federalRegisterByName, fccLicensesByName,
  usaSpendingByName, hackerNewsByTerm, gdeltByTerm, archiveOrgByTerm,
  openWebSurface, openWebMentions, surfaceGroups, unqueryablePeopleSources,
} from "../_shared/discover/peopleSources.ts";
import {
  usernameSweep, githubProfile, githubCommitEmails, usernameOpenWeb,
} from "../_shared/discover/usernameSources.ts";
import {
  shapePhone, phoneAllocation, leakCheckPhone, phoneOpenWeb, phoneUnmeasured,
} from "../_shared/discover/phoneSources.ts";
import { scoreSensitivity } from "../_shared/discover/sensitivity.ts";

interface Body { identifier: string; kind: IdentifierKind; depth?: number }

// the whole run must land inside the function's wall clock with room to store.
const RUN_BUDGET_MS = 110_000;

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
  if (identifier.length > 200) return json({ error: "identifier is too long" }, 400, cors);

  const startedAt = Date.now();
  const deadlineAt = startedAt + RUN_BUDGET_MS;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: run, error: runErr } = await admin
    .from("search_discover_runs")
    .insert({ user_id: user.id, seed: identifier, kind: "identity" })
    .select("id").single();
  if (runErr || !run) {
    console.error("could not open run", runErr?.message);
    return json({ error: `could not open run: ${runErr?.message ?? "unknown"}` }, 500, cors);
  }
  const runId = run.id as string;

  const hitInserts: Array<Record<string, unknown>> = [];
  const sources: Record<string, Record<string, unknown>> = {};
  const nodeErrors: Array<{ node: string; error: string }> = [];

  function markUnmeasured(map: Record<string, { available: false; reason: string }>) {
    for (const [k, v] of Object.entries(map)) if (!sources[k]) sources[k] = { ...v };
  }

  function collect(source: string, res: IdResult): Array<{ identifier: string; kind: IdentifierKind }> {
    const prev = sources[source] as { available?: boolean; count?: number } | undefined;
    if (res.available) {
      sources[source] = {
        available: true,
        count: (prev?.available ? Number(prev.count ?? 0) : 0) + res.rows.length,
        ...(res.reason ? { note: res.reason } : {}),
      };
    } else if (!prev?.available) {
      sources[source] = { available: false, reason: res.reason ?? "unmeasured" };
    }
    const discovered: Array<{ identifier: string; kind: IdentifierKind }> = [];
    for (const r of res.rows) {
      hitInserts.push({
        run_id: runId, user_id: user!.id,
        source: r.source || source, url: r.url ?? null, kind: r.kind,
        exposure_class: "identity",
        sensitivity: scoreSensitivity("identity", r.evidence ?? r.summary),
        last_probed_at: new Date().toISOString(),
        evidence_excerpt: (r.evidence ?? r.summary).slice(0, 400),
        meta: { discovered: r.discovered },
      });
      for (const d of r.discovered) {
        if (d.kind === "url" || d.kind === "domain") continue; // pivots stay on people-shaped identifiers
        discovered.push({ identifier: d.identifier, kind: d.kind as IdentifierKind });
      }
    }
    return discovered;
  }

  /** run one adapter without letting its failure take down the node. */
  async function tap(
    source: string,
    fn: () => Promise<IdResult>,
  ): Promise<Array<{ identifier: string; kind: IdentifierKind }>> {
    if (Date.now() > deadlineAt) {
      if (!sources[source]) sources[source] = { available: false, reason: "run budget exhausted before this source ran" };
      return [];
    }
    try {
      return collect(source, await fn());
    } catch (e) {
      const reason = e instanceof Error ? e.message : "adapter threw";
      const prev = sources[source] as { available?: boolean } | undefined;
      if (!prev?.available) sources[source] = { available: false, reason };
      return [];
    }
  }

  async function waybackFor(needle: string): Promise<IdResult> {
    const rows = await waybackByIdentifier(needle, 20);
    return {
      available: true,
      rows: rows.slice(0, 20).map((r) => ({
        source: "wayback", kind: "archive",
        url: `https://web.archive.org/web/${r.timestamp}/${r.original}`,
        summary: `archive captured a page mentioning ${needle}`,
        discovered: [],
      })),
    };
  }

  async function resolveEmail(node: PivotNode) {
    const email = node.identifier.toLowerCase();
    markUnmeasured(emailKeyedSources());
    const fans = await Promise.all([
      tap("gravatar", () => gravatarProfile(email)),
      tap("github", () => githubUserByEmail(email)),
      tap("keys.openpgp.org", () => keyserverProfile(email)),
      tap("xposedornot", () => xposedOrNot(email)),
      tap("leakcheck.public", () => leakCheckEmail(email)),
      tap("crt.sh", async () => ({
        available: true,
        rows: (await crtByEmail(email)).slice(0, 10).map((r) => ({
          source: "crt.sh", kind: "cert",
          summary: `s/mime cert for ${email} on ${r.name}`,
          discovered: [{ identifier: r.name, kind: "domain" as const }],
        })),
      })),
      tap("wayback", () => waybackFor(email)),
      tap("open-web", () => openWebMentions(email)),
    ]);
    const discovered = fans.flat();
    const localPart = email.split("@")[0];
    if (localPart && node.depth === 0 && /^[a-z0-9._-]{3,30}$/.test(localPart)) {
      discovered.push({ identifier: localPart.replace(/[._]/g, ""), kind: "username" });
      discovered.push({ identifier: localPart, kind: "username" });
    }
    return discovered;
  }

  async function resolveName(node: PivotNode) {
    const name = node.identifier;
    markUnmeasured(unqueryablePeopleSources());
    const core = await Promise.all([
      tap("wikidata", () => wikidataByName(name)),
      tap("wikipedia", () => wikipediaByName(name)),
      tap("sec.edgar", () => secEdgarByName(name)),
      tap("courtlistener", () => courtListenerByName(name)),
      tap("federalregister", () => federalRegisterByName(name)),
      tap("fcc.licenses", () => fccLicensesByName(name)),
      tap("usaspending", () => usaSpendingByName(name)),
      tap("openalex", () => openAlexByName(name)),
      tap("orcid", () => orcidByName(name)),
      tap("crossref", () => crossrefByName(name)),
      tap("pubmed", () => pubmedByName(name)),
      tap("openlibrary", () => openLibraryByName(name)),
      tap("hackernews", () => hackerNewsByTerm(name)),
      tap("gdelt.news", () => gdeltByTerm(name)),
      tap("archive.org", () => archiveOrgByTerm(name)),
      tap("wayback", () => waybackFor(name)),
      tap("open-web", () => openWebMentions(name)),
    ]);
    // scoped record sweeps: aggregators, obituaries, genealogy, usenet, pastes,
    // professional profiles, corporate registries, court/property portals.
    const groups = surfaceGroups();
    const scoped: Array<Array<{ identifier: string; kind: IdentifierKind }>> = [];
    for (const g of groups) {
      if (Date.now() > deadlineAt) {
        if (!sources[g.label]) sources[g.label] = { available: false, reason: "run budget exhausted before this sweep ran" };
        continue;
      }
      scoped.push(await tap(g.label, () => openWebSurface(name, g)));
    }
    return [...core.flat(), ...scoped.flat()];
  }

  async function resolveUsername(node: PivotNode) {
    const u = node.identifier;
    const sweep = await (async () => {
      try { return await usernameSweep(u); } catch (e) {
        return { outcomes: [], result: { available: false, reason: e instanceof Error ? e.message : "sweep failed", rows: [] } as IdResult };
      }
    })();
    const fromSweep = collect("account.sweep", sweep.result);
    sources["account.sweep"] = {
      available: sweep.result.available,
      ...(sweep.result.reason ? { reason: sweep.result.reason } : {}),
      present: sweep.outcomes.filter((o) => o.state === "present").map((o) => o.label),
      absent: sweep.outcomes.filter((o) => o.state === "absent").length,
      unmeasured: sweep.outcomes.filter((o) => o.state === "unmeasured").map((o) => ({ platform: o.label, reason: o.reason })),
    };
    const rest = await Promise.all([
      tap("github.profile", () => githubProfile(u)),
      tap("github.commits", () => githubCommitEmails(u)),
      tap("hackernews", () => hackerNewsByTerm(u)),
      tap("wayback", () => waybackFor(u)),
      tap("open-web", () => usernameOpenWeb(u)),
    ]);
    return [...fromSweep, ...rest.flat()];
  }

  async function resolvePhone(node: PivotNode) {
    markUnmeasured(phoneUnmeasured());
    const shape = shapePhone(node.identifier);
    const fans = await Promise.all([
      tap("nanp.allocation", () => Promise.resolve(phoneAllocation(shape))),
      tap("leakcheck.public", () => leakCheckPhone(shape)),
      tap("open-web", () => phoneOpenWeb(shape)),
      tap("wayback", () => waybackFor(shape.e164 ?? node.identifier)),
    ]);
    return fans.flat();
  }

  async function resolveNode(node: PivotNode): Promise<Array<{ identifier: string; kind: IdentifierKind }>> {
    if (Date.now() > deadlineAt) return [];
    switch (node.kind) {
      case "email": return await resolveEmail(node);
      case "name": return await resolveName(node);
      case "username": return await resolveUsername(node);
      case "phone": return await resolvePhone(node);
      default: return [];
    }
  }

  const nodes = await expandPivot({ identifier, kind }, resolveNode, {
    maxDepth: Math.min(Math.max(Number(body.depth ?? 3), 1), 3),
    maxNodes: 24,
    maxFanoutPerNode: 8,
    deadlineAt,
    onResolverError: (node, e) => nodeErrors.push({
      node: `${node.kind}:${node.identifier}`,
      error: e instanceof Error ? e.message : String(e),
    }),
  });

  if (nodes.length) {
    const { error: pivotErr } = await admin.from("search_identity_pivots").insert(nodes.map((n) => ({
      run_id: runId, user_id: user.id,
      parent_node: n.parentId, node_id: n.id,
      identifier: n.identifier.slice(0, 500), kind: n.kind, depth: n.depth,
    })));
    if (pivotErr) console.error("search_identity_pivots insert failed", pivotErr.message);
  }

  for (const row of hitInserts) {
    row.meta = row.meta ?? {};
    row.url = row.url ?? null;
    row.exposure_class = row.exposure_class ?? null;
    row.live = null;
    row.http_status = null;
    row.content_type = null;
    row.first_seen_at = null;
  }

  let stored = 0;
  const storeErrors: string[] = [];
  for (let i = 0; i < hitInserts.length; i += 200) {
    const chunk = hitInserts.slice(i, i + 200);
    const { error } = await admin.from("search_hits").insert(chunk);
    if (error) { storeErrors.push(error.message); console.error("search_hits insert failed", error.message); }
    else stored += chunk.length;
  }

  const measured = Object.values(sources).filter((s) => s.available === true).length;
  const refused = Object.values(sources).filter((s) => s.available === false).length;

  const meta = {
    sources,
    storage: { stored, errors: storeErrors.slice(0, 3) },
    coverage: { measured, refused, nodes: nodes.length, elapsed_ms: Date.now() - startedAt, budget_hit: Date.now() > deadlineAt },
    node_errors: nodeErrors.slice(0, 5),
  };

  await admin.from("search_discover_runs")
    .update({ status: "done", ended_at: new Date().toISOString() })
    .eq("id", runId);

  return json({ run_id: runId, hits: stored, found: hitInserts.length, nodes: nodes.length, meta }, 200, cors);
});

function json(x: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(x), { status, headers: { ...cors, "content-type": "application/json" } });
}
