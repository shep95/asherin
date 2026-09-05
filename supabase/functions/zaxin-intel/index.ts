// Zaxin live intelligence proxy — fetches public threat-intel feeds server-side
// (avoids CORS) and normalizes them for the dashboard.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// asherin.zaxin is retired — the room is off sale and off access, and this
// feed proxy goes with it. 410, not 404: the surface existed and is gone.
const RETIRED = () =>
  new Response(JSON.stringify({ error: "asherin.zaxin is retired and no longer served." }), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function fetchJson(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.json();
}
async function fetchText(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r.text();
}

// URLhaus recent malicious URLs (last ~1000)
async function getAlerts() {
  const data = await fetchJson("https://urlhaus.abuse.ch/downloads/json_recent/");
  // urlhaus returns object keyed by id with array values; flatten
  const rows: any[] = [];
  for (const k of Object.keys(data)) {
    const arr = data[k];
    if (Array.isArray(arr)) rows.push(...arr);
  }
  return rows.slice(0, 50).map((r: any) => ({
    sig: `URLhaus: ${r.threat || "malware_download"}${r.tags?.length ? " (" + r.tags.slice(0, 2).join(",") + ")" : ""}`,
    src: r.host || "unknown",
    dst: r.url || "",
    eng: "URLhaus",
    t: r.dateadded || "",
    sev: r.url_status === "online" ? "critical" : "med",
    ref: r.urlhaus_reference || "",
  }));
}

// ThreatFox recent IOCs — POST /api/v1/ with action get_iocs
async function getDetections() {
  const r = await fetch("https://threatfox-api.abuse.ch/api/v1/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "get_iocs", days: 3 }),
  });
  const data = await r.json();
  const iocs: any[] = data?.data || [];
  return iocs.slice(0, 50).map((i: any) => ({
    rule: `ThreatFox: ${i.malware_printable || "Unknown"} — ${i.ioc}`,
    type: i.ioc_type || "ioc",
    sid: String(i.id || ""),
    hits: String(i.confidence_level ?? "—"),
    sev: (i.confidence_level ?? 0) >= 75 ? "crit" : (i.confidence_level ?? 0) >= 50 ? "high" : "med",
    threat: i.threat_type || "",
    first: i.first_seen || "",
  }));
}

// ThreatFox top hosts (aggregation of recent IOCs by domain/ip)
async function getTopHosts() {
  const r = await fetch("https://threatfox-api.abuse.ch/api/v1/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "get_iocs", days: 3 }),
  });
  const data = await r.json();
  const iocs: any[] = data?.data || [];
  const counts = new Map<string, { count: number; malware: string }>();
  for (const i of iocs) {
    if (!i.ioc) continue;
    const key = i.ioc.split(":")[0];
    const cur = counts.get(key) || { count: 0, malware: i.malware_printable || "Unknown" };
    cur.count += 1;
    counts.set(key, cur);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([host, v]) => ({ host, count: v.count, label: v.malware }));
}

// Live Security Onion GitHub releases
async function getReleases() {
  const releases = await fetchJson(
    "https://api.github.com/repos/Security-Onion-Solutions/securityonion/releases?per_page=10",
  );
  return (releases as any[]).slice(0, 8).map((r) => ({
    tag: r.tag_name,
    name: r.name,
    publishedAt: r.published_at,
    htmlUrl: r.html_url,
    assets: (r.assets || []).slice(0, 5).map((a: any) => ({
      name: a.name,
      size: a.size,
      downloadUrl: a.browser_download_url,
      downloads: a.download_count,
    })),
  }));
}

// MITRE ATT&CK Enterprise — pull tactic counts from the official STIX bundle
async function getMitreCoverage() {
  const txt = await fetchText(
    "https://raw.githubusercontent.com/mitre/cti/master/enterprise-attack/enterprise-attack.json",
  );
  const bundle = JSON.parse(txt);
  const objs: any[] = bundle.objects || [];
  const techniques = objs.filter(
    (o) => o.type === "attack-pattern" && !o.revoked && o.x_mitre_deprecated !== true,
  );
  const tacticCounts = new Map<string, number>();
  for (const t of techniques) {
    const phases = t.kill_chain_phases || [];
    for (const p of phases) {
      if (p.kill_chain_name === "mitre-attack") {
        tacticCounts.set(p.phase_name, (tacticCounts.get(p.phase_name) || 0) + 1);
      }
    }
  }
  const ORDER = [
    "reconnaissance", "resource-development", "initial-access", "execution",
    "persistence", "privilege-escalation", "defense-evasion", "credential-access",
    "discovery", "lateral-movement", "collection", "command-and-control",
    "exfiltration", "impact",
  ];
  return ORDER.map((t) => ({ tactic: t, techniques: tacticCounts.get(t) || 0 }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "alerts";
    switch (action) {
      case "alerts":     return json({ data: await getAlerts() });
      case "detections": return json({ data: await getDetections() });
      case "top-hosts":  return json({ data: await getTopHosts() });
      case "releases":   return json({ data: await getReleases() });
      case "mitre":      return json({ data: await getMitreCoverage() });
      case "all": {
        const [alerts, detections, topHosts, releases, mitre] = await Promise.allSettled([
          getAlerts(), getDetections(), getTopHosts(), getReleases(), getMitreCoverage(),
        ]);
        return json({
          alerts:     alerts.status === "fulfilled" ? alerts.value : [],
          detections: detections.status === "fulfilled" ? detections.value : [],
          topHosts:   topHosts.status === "fulfilled" ? topHosts.value : [],
          releases:   releases.status === "fulfilled" ? releases.value : [],
          mitre:      mitre.status === "fulfilled" ? mitre.value : [],
        });
      }
      default: return json({ error: "unknown action" }, 400);
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
