// ─────────────────────────────────────────────────────────────────────────────
// asherinx.eng — public-index search. no tap.
//
// One box, one Enter. The query is classified, a domain pack of public indexes
// is asked in parallel, and every field site reports its own outcome. A site
// that refuses or times out shows up as a skip with its reason — it is never
// dressed up as a result, and it never takes the answer down with it.
//
// Actions
//   query       fan out over a domain pack and rank what came back        (all)
//   classify    say out loud which pack a query lands in, and why         (all)
//   extract     read one public url: starred contacts + genesis tags      (all)
//   fold        compact an already-run query into a reading digest        (all)
//   origin      provenance carve of one artefact            (pro, delegated)
//   identifier  selector sweep across surfaces              (pro, delegated)
//   buffer      the operator's short retention shelf        (pro, delegated)
//
// Depth: base callers get the pack; pro/team get widened fan-out and the
// delegated forensic actions. There is no tap, no wire, no breach corpus.
// ─────────────────────────────────────────────────────────────────────────────

import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveAxrlenAccess } from "../_shared/proTierGate.ts";
import {
  ALL_SITES, DOMAIN_PACKS, classify, runQuery, starContacts, genesisTags,
  type Domain, type Hit, type QueryResult,
} from "../_shared/asherinxFieldSites.ts";

const DELEGATED = new Set(["origin", "identifier", "buffer", "content", "payload", "purge", "upload"]);
const MAX_QUERY = 512;
const EXTRACT_BYTES = 512 * 1024;

interface Body {
  action?: string;
  query?: string;
  url?: string;
  domain?: Domain;
  when?: string;
  sites?: string[];
  result?: QueryResult;
}

function isPublicHttpUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  if (
    h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(h) && (
      h.startsWith("127.") || h.startsWith("10.") || h.startsWith("169.254.") ||
      h.startsWith("192.168.") || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.startsWith("0.")
    ) ||
    h === "::1" || h === "metadata.google.internal"
  ) return false;
  return true;
}

/** Reading digest of a fan-out. Counting and grouping only — nothing invented. */
function fold(r: QueryResult) {
  const bySite: Record<string, number> = {};
  for (const h of r.hits) bySite[h.site] = (bySite[h.site] ?? 0) + 1;
  const years = new Map<string, number>();
  for (const h of r.hits) {
    for (const g of h.genesis ?? []) {
      if (/^(19|20)\d{2}$/.test(g)) years.set(g, (years.get(g) ?? 0) + 1);
    }
  }
  const hosts = new Map<string, number>();
  for (const h of r.hits) {
    try { const d = new URL(h.url).hostname.replace(/^www\./, ""); hosts.set(d, (hosts.get(d) ?? 0) + 1); } catch { /* skip */ }
  }
  const top = (m: Map<string, number>, n: number) =>
    Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ value: k, count: v }));

  return {
    query: r.query,
    domain: r.classification.domain,
    answered: Object.keys(bySite).length,
    asked: r.sites.length,
    total_hits: r.hits.length,
    by_site: bySite,
    years: top(years, 6),
    hosts: top(hosts, 8),
    unsure: r.unsure,
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ error: "Authentication required" }, 401);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  const action = String(body.action || "query");

  const access = await resolveAxrlenAccess(req);
  if (access.reason === "anonymous") return json({ error: "Authentication required" }, 401);
  const pro = access.granted;

  // ── forensic actions live in the existing engine; forward, do not fork ────
  if (DELEGATED.has(action)) {
    if (!pro) {
      return json({
        error: "this depth is on asherin pro.",
        reason: "tier",
        available: ["query", "classify", "extract", "fold"],
      }, 403);
    }
    const base = Deno.env.get("SUPABASE_URL") ?? "";
    const r = await fetch(`${base}/functions/v1/ghost-engine`, {
      method: "POST",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json",
        apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      },
      body: JSON.stringify({ ...body, action }),
    });
    const text = await r.text();
    return new Response(text, {
      status: r.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (action === "classify") {
    const q = String(body.query || "").trim().slice(0, MAX_QUERY);
    if (!q) return json({ error: "give the engine something to read." }, 400);
    const c = classify(q);
    return json({ action, ...c, pack: DOMAIN_PACKS[c.domain], packs: DOMAIN_PACKS });
  }

  if (action === "extract") {
    const target = String(body.url || body.query || "").trim();
    if (!isPublicHttpUrl(target)) return json({ error: "that is not a public http(s) address." }, 400);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    try {
      const r = await fetch(target, {
        signal: ctrl.signal,
        headers: { "User-Agent": "asherin.eng/1.0 (public-index reader; +https://asherin.com)" },
        redirect: "follow",
      });
      const ctype = r.headers.get("content-type") || "";
      if (!/text|json|xml|html/i.test(ctype)) {
        return json({ action, url: target, status: r.status, content_type: ctype, note: "binary body — not read as text.", contacts: { emails: [], phones: [] }, genesis: [] });
      }
      const buf = new Uint8Array(await r.arrayBuffer()).slice(0, EXTRACT_BYTES);
      const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      const title = text.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i)?.[1]?.trim();
      return json({
        action,
        url: r.url,
        status: r.status,
        content_type: ctype,
        title: title ?? null,
        server: r.headers.get("server"),
        contacts: starContacts(text),
        genesis: genesisTags(text),
        bytes_read: buf.length,
      });
    } catch (e) {
      const msg = String((e as Error)?.message || e);
      return json({ error: /abort/i.test(msg) ? "the host did not answer in time." : msg.slice(0, 160) }, 502);
    } finally {
      clearTimeout(timer);
    }
  }

  if (action === "fold") {
    if (body.result?.hits) return json({ action, digest: fold(body.result) });
    const q = String(body.query || "").trim().slice(0, MAX_QUERY);
    if (!q) return json({ error: "nothing to fold." }, 400);
    const r = await runQuery(q, { domain: body.domain, when: body.when });
    return json({ action, digest: fold(r), result: r });
  }

  // ── query (default) ───────────────────────────────────────────────────────
  const q = String(body.query || "").trim().slice(0, MAX_QUERY);
  if (!q) return json({ error: "give the engine something to read." }, 400);

  const requested = Array.isArray(body.sites)
    ? body.sites.filter((s) => (ALL_SITES as readonly string[]).includes(s))
    : [];
  const c = classify(q);
  const domain = body.domain ?? c.domain;
  // Depth is the only thing tier buys here: pro widens the fan-out with the
  // general pack on top of the matched one. Base gets the matched pack whole.
  const pack = requested.length
    ? requested
    : pro
      ? Array.from(new Set([...DOMAIN_PACKS[domain], ...DOMAIN_PACKS.general]))
      : DOMAIN_PACKS[domain];

  const result = await runQuery(q, { domain, when: body.when, sites: pack });
  const grouped: Record<string, Hit[]> = {};
  for (const h of result.hits) (grouped[h.site] ??= []).push(h);

  return json({
    action: "query",
    ...result,
    grouped,
    depth: pro ? "full" : "basic",
    tap: false,
  });
});
