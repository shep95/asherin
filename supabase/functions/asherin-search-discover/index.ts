// asherin.search — discover mode.
// finds subdomains, orphan urls, exposed paths, archived captures and code
// leaks for a seed domain. all sources are free public feeds. sources that
// require a key surface as { available:false, reason } and never fabricate.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireUser, errorToResponse } from "../_shared/authMiddleware.ts";
import { crtSubdomains } from "../_shared/discover/crtsh.ts";
import { enumerateSubdomains } from "../_shared/discover/doh.ts";
import { waybackByDomain, commonCrawlIndexId as _idId } from "../_shared/discover/waybackCdx.ts";
import { commonCrawlByDomain, commonCrawlIndexId } from "../_shared/discover/commonCrawl.ts";
import { githubCodeSearch } from "../_shared/discover/githubSearch.ts";
import { probeUrlPatterns } from "../_shared/discover/urlPatterns.ts";
import { scoreSensitivity } from "../_shared/discover/sensitivity.ts";

interface Body { seed: string }

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: cors });

  let user;
  try { user = await requireUser(req); } catch (e) { return errorToResponse(e, cors); }

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "invalid json" }, 400, cors); }
  const seed = String(body?.seed ?? "").trim().toLowerCase();
  const domain = seed.replace(/^https?:\/\//, "").split("/")[0];
  if (!/^[a-z0-9.-]{3,253}$/.test(domain)) return json({ error: "invalid seed" }, 400, cors);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  const { data: run, error: runErr } = await admin
    .from("search_discover_runs")
    .insert({ user_id: user.id, seed: domain, kind: "discover" })
    .select("id")
    .single();
  if (runErr || !run) return json({ error: "could not open run" }, 500, cors);
  const runId = run.id as string;

  const [crt, dns, wb, cc, gh] = await Promise.allSettled([
    crtSubdomains(domain),
    enumerateSubdomains(domain, 60, 12),
    waybackByDomain(domain, 200),
    commonCrawlByDomain(domain, 100),
    githubCodeSearch(`"${domain}" filename:.env`, 20),
  ]);

  const inserts: Array<Record<string, unknown>> = [];
  const now = new Date().toISOString();
  const meta: Record<string, unknown> = {
    sources: {
      "crt.sh": crt.status === "fulfilled" ? { count: crt.value.length, available: true } : { available: false, reason: "crt.sh error" },
      "dns.probe": dns.status === "fulfilled" ? { count: dns.value.length, available: true } : { available: false, reason: "dns error" },
      "wayback": wb.status === "fulfilled" ? { count: wb.value.length, available: true } : { available: false, reason: "wayback error" },
      "commoncrawl": cc.status === "fulfilled"
        ? { count: cc.value.length, available: true, index: commonCrawlIndexId() }
        : { available: false, reason: "commoncrawl error" },
      "github.code": gh.status === "fulfilled"
        ? (gh.value.available ? { count: gh.value.hits.length, available: true } : { available: false, reason: gh.value.reason })
        : { available: false, reason: "github error" },
      "shodan": { available: false, reason: "requires SHODAN_API_KEY" },
      "censys": { available: false, reason: "requires CENSYS_API_ID and CENSYS_API_SECRET" },
      "pastebin.scrape": { available: false, reason: "pastebin closed the free scraping api" },
    },
  };

  if (crt.status === "fulfilled") {
    for (const row of crt.value.slice(0, 200)) {
      inserts.push({
        run_id: runId, user_id: user.id,
        source: "crt.sh", url: `https://${row.name}`, kind: "subdomain",
        exposure_class: "subdomain",
        sensitivity: scoreSensitivity("subdomain", row.name),
        first_seen_at: row.first_seen || null, last_probed_at: now,
        meta: { issuer: row.issuer, host: row.name },
      });
    }
  }
  if (dns.status === "fulfilled") {
    for (const row of dns.value) {
      inserts.push({
        run_id: runId, user_id: user.id,
        source: "dns.probe", url: `https://${row.host}`, kind: "subdomain",
        exposure_class: "subdomain", sensitivity: scoreSensitivity("subdomain", row.host),
        last_probed_at: now, meta: { a: row.a, cname: row.cname, host: row.host },
      });
    }
  }
  if (wb.status === "fulfilled") {
    for (const row of wb.value.slice(0, 200)) {
      inserts.push({
        run_id: runId, user_id: user.id,
        source: "wayback", url: row.original, kind: "archive",
        exposure_class: "archive", sensitivity: scoreSensitivity("archive", row.original),
        http_status: Number(row.statuscode) || null,
        content_type: row.mimetype || null,
        first_seen_at: row.timestamp ? cdxTsToIso(row.timestamp) : null, last_probed_at: now,
        meta: { digest: row.digest },
      });
    }
  }
  if (cc.status === "fulfilled") {
    for (const row of cc.value) {
      inserts.push({
        run_id: runId, user_id: user.id,
        source: "commoncrawl", url: row.url, kind: "archive",
        exposure_class: "archive", sensitivity: scoreSensitivity("archive", row.url),
        http_status: Number(row.status) || null, content_type: row.mime || null,
        first_seen_at: row.timestamp ? cdxTsToIso(row.timestamp) : null, last_probed_at: now,
      });
    }
  }
  if (gh.status === "fulfilled" && gh.value.available) {
    for (const hit of gh.value.hits) {
      inserts.push({
        run_id: runId, user_id: user.id,
        source: "github.code", url: hit.html_url, kind: "code-leak",
        exposure_class: "code-leak",
        sensitivity: scoreSensitivity("code-leak", hit.path),
        last_probed_at: now,
        meta: { repository: hit.repository, path: hit.path, score: hit.score },
      });
    }
  }

  // url pattern probe against apex + top 6 dns hits
  const bases = new Set<string>([`https://${domain}`]);
  if (dns.status === "fulfilled") for (const r of dns.value.slice(0, 6)) bases.add(`https://${r.host}`);
  const probeResults = await Promise.allSettled([...bases].map((b) => probeUrlPatterns(b)));
  for (const pr of probeResults) {
    if (pr.status !== "fulfilled") continue;
    for (const hit of pr.value) {
      inserts.push({
        run_id: runId, user_id: user.id,
        source: "url-probe", url: hit.url, kind: hit.exposure_class,
        exposure_class: hit.exposure_class,
        sensitivity: scoreSensitivity(hit.exposure_class, hit.evidence_excerpt, { live: true }),
        http_status: hit.status, content_type: hit.content_type,
        live: true, last_probed_at: now,
        evidence_excerpt: hit.evidence_excerpt.slice(0, 400),
      });
    }
  }

  // insert in chunks to keep payload sane
  for (let i = 0; i < inserts.length; i += 500) {
    await admin.from("search_hits").insert(inserts.slice(i, i + 500));
  }
  await admin
    .from("search_discover_runs")
    .update({ status: "done", ended_at: new Date().toISOString() })
    .eq("id", runId);

  return json({ run_id: runId, hits: inserts.length, meta }, 200, cors);
});

function json(x: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(x), { status, headers: { ...cors, "content-type": "application/json" } });
}

function cdxTsToIso(ts: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(ts);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}
