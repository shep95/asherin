// ZOSMA — CT-log historical audit. Sweeps crt.sh (Sectigo's public Certificate
// Transparency log mirror) for every cert ever issued to a domain + subdomains.
// Surfaces shadow subdomains, rotation gaps, wildcard sprawl, and short-lived
// or long-lived anomalies.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { guardHost, requireAdmin } from "../_shared/zosma-guards.ts";

interface CtRow {
  id: number;
  name_value: string;
  issuer_name: string;
  not_before: string;
  not_after: string;
  common_name?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    let domain = String(body?.domain ?? "").trim().toLowerCase();
    try { if (domain.includes("://")) domain = new URL(domain).hostname; } catch { /**/ }
    const g = guardHost(domain);
    if (g) return new Response(JSON.stringify({ error: `SSRF guard: ${g}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!/^[a-z0-9.\-]+\.[a-z]{2,}$/.test(domain)) return new Response(JSON.stringify({ error: "invalid domain" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // crt.sh public JSON endpoint. % prefix matches subdomains.
    const url = `https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 25000);
    let res: Response;
    try {
      res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "ZOSMA-CT-Audit/1.0" } });
    } catch (e) {
      clearTimeout(to);
      return new Response(JSON.stringify({ error: `crt.sh fetch failed: ${(e as Error).message}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    clearTimeout(to);
    if (!res.ok) return new Response(JSON.stringify({ error: `crt.sh HTTP ${res.status}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const text = await res.text();
    let rows: CtRow[];
    try { rows = JSON.parse(text); } catch { return new Response(JSON.stringify({ error: "crt.sh returned non-JSON" }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

    // Dedupe subdomains
    const subs = new Set<string>();
    const wildcards = new Set<string>();
    const issuers = new Map<string, number>();
    let earliest = Infinity, latest = -Infinity;
    let shortLived = 0, longLived = 0;
    const now = Date.now();

    for (const r of rows) {
      const names = (r.name_value || "").split("\n");
      for (const n of names) {
        const nn = n.trim().toLowerCase();
        if (!nn) continue;
        if (nn.startsWith("*.")) wildcards.add(nn);
        else subs.add(nn);
      }
      issuers.set(r.issuer_name, (issuers.get(r.issuer_name) || 0) + 1);
      const nb = new Date(r.not_before).getTime();
      const na = new Date(r.not_after).getTime();
      if (!isNaN(nb) && nb < earliest) earliest = nb;
      if (!isNaN(na) && na > latest) latest = na;
      const life = (na - nb) / 86400000;
      if (life < 7) shortLived++;
      else if (life > 397) longLived++;
    }

    const activeSubs = Array.from(subs).slice(0, 500);
    const wildcardList = Array.from(wildcards);
    const topIssuers = Array.from(issuers.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

    const findings: string[] = [];
    if (wildcardList.length > 5) findings.push(`WILDCARD SPRAWL: ${wildcardList.length} distinct wildcard certs — blast radius on any single key compromise`);
    if (subs.size > 100) findings.push(`LARGE ATTACK SURFACE: ${subs.size} unique subdomains ever seen in CT`);
    if (longLived > 0) findings.push(`${longLived} cert(s) with lifetime >397d — violates Apple/Mozilla 2020 limit`);
    if (topIssuers.length > 4) findings.push(`FRAGMENTED ISSUANCE: ${topIssuers.length}+ distinct CAs used — CAA policy likely absent`);
    if (earliest !== Infinity) {
      const first = new Date(earliest).toISOString().slice(0, 10);
      const last  = new Date(Math.min(latest, now + 3.15e10)).toISOString().slice(0, 10);
      findings.unshift(`CT window: ${first} → ${last} (${rows.length} entries)`);
    }

    return new Response(JSON.stringify({
      domain,
      total_ct_entries: rows.length,
      unique_subdomains: subs.size,
      wildcards: wildcardList,
      top_issuers: topIssuers,
      short_lived_count: shortLived,
      long_lived_count: longLived,
      subdomains_sample: activeSubs,
      findings,
      ran_at: new Date().toISOString(),
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
