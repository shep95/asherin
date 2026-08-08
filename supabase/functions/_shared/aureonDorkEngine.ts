// aureonDorkEngine.ts — Asherin Engine's 100-theory Google-dork battery.
//
// Narrative → Flaws → New narrative (see chat writeup):
//   • 100 theories is a categorical fan-out, not one big Gemini call — the
//     model gets 8 domain-specific micro-prompts (12–13 dorks each) in
//     parallel. Cheap, resilient, dedupable.
//   • Testing 100 queries at ~8s each would blow the 150s edge budget, so we
//     pick the TOP N by heuristic value (default 50) and fan those out via
//     zophiel-search at concurrency 15. Un-tested theories still ship in the
//     response as "hypotheses" — they cost nothing and are the whole point.
//   • Every hit is scored by the presence of the report's high-value markers
//     (env, sql, key, index of, phpmyadmin, s3.amazonaws, .git, admin,
//     phpinfo, wp-config, backup) so the ledger can rank exposures by risk.
//   • The engine intentionally does NOT hit google.com directly — Google
//     rate-limits + CAPTCHAs edge-function IPs. zophiel-search fans out to 5
//     engines (DDG html, Wikipedia, HackerNews, OpenAlex, CrossRef) which is
//     what actually returns hits from inside the platform.
//
// v2 — 55-DOMAIN DOCTRINE (dorkDomainDoctrine.ts):
//   • The 8 canonical prompts still ship. A 9th "NOVEL SYNTHESIS" call feeds
//     Gemini the full 55-domain doctrine + 10 root-cause patterns and asks
//     for cross-domain dorks nobody has documented before — the elite move.
//   • Novel-synthesis output is tagged category=`novel_synthesis` so the
//     ledger can rank first-to-find hits separately from canonical hits.

// deno-lint-ignore-file no-explicit-any

import { doctrineDigest, NOVEL_SYNTHESIS_SYSTEM } from "./dorkDomainDoctrine.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

export interface DorkTheory {
  id: string;
  category: DorkCategory;
  query: string;
  why: string;
  yieldScore: number; // 0..100, populated after testing
  tested: boolean;
  hits: DorkHit[];
  markers: string[]; // matched high-value markers
}
export interface DorkHit { title: string; url: string; snippet: string; host: string }
export type DorkCategory =
  | "exposed_files" | "open_directories" | "login_portals" | "exposed_dbs"
  | "sensitive_docs" | "device_feeds" | "credentials_keys" | "attack_surface"
  | "novel_synthesis";

export interface DorkTarget {
  subject: string;
  kind: "person" | "domain" | "organization" | "topic";
  hints?: {
    domain?: string;
    location?: string;
    employer?: string;
    industry?: string;
    country_tld?: string;
  };
}

export interface DorkReport {
  target: DorkTarget;
  theoriesGenerated: number;
  theoriesTested: number;
  totalHits: number;
  byCategory: Record<DorkCategory, DorkTheory[]>;
  topExposures: DorkTheory[];       // sorted by yieldScore desc
  brief: string;                    // markdown, analyst-grade
  defensiveGuidance: string;        // Section 3 self-audit framing
  via: string;                      // gemini / venice / etc
  elapsedMs: number;
}

const HIGH_VALUE_MARKERS = [
  ".env", "env=", "DB_PASSWORD", "API_KEY", "api_key",
  "index of /", "parent directory",
  "phpmyadmin", "phpMyAdmin", "adminer",
  "s3.amazonaws.com", "storage.googleapis.com", "blob.core.windows",
  ".git/", "wp-config", "web.config", "phpinfo()",
  ".sql", "backup.sql", ".bak",
  ".pem", "BEGIN PRIVATE KEY", "BEGIN RSA",
  "id_rsa", ".ssh/", ".htpasswd",
  "AKIA", "AIza", "sk_live_", "xoxb-",
  "confidential", "internal use only", "restricted",
  // 55-domain doctrine surface markers
  "crt.sh", "_dmarc", "wigle.net", "shodan", "censys",
  "form 4", "form 990", "13F", "warning letter", "483",
  "n-number", "airmen inquiry", "vessel documentation",
  "opencorporates", "companieshouse", "sam.gov",
  "web.archive.org", "wayback", "orcid.org",
  "assignee", "acknowledgments", "funded by",
  "statement of work", "sole source", "toxic release",
  "H-1B", "prevailing wage", "npi", "medical board",
  "building permit", "business license", "voter registration",
  "survived by", "in memory of", "beloved",
];

// ── 8 categorical dork-generation micro-prompts ─────────────────────────────
// Each returns 12–13 targeted dork queries in strict JSON. Small schemas =
// no Gemini truncation; parallel calls = ~2× wallclock of one call.
const CAT_PROMPTS: Array<{ cat: DorkCategory; system: string }> = [
  {
    cat: "exposed_files",
    system: `You are DORK ARCHITECT — EXPOSED FILES. Given a target, return 12 Google-dork queries that surface accidentally-published sensitive files (env, sql, xls, xlsx, pdf, log, bak, config, xml, json, pem, key, doc, docx). Combine site:, filetype:, intext:, "quoted phrase". Emit STRICT JSON only: {"queries":[{"q":"...","why":"one sentence"}]}`,
  },
  {
    cat: "open_directories",
    system: `You are DORK ARCHITECT — OPEN DIRECTORIES. Return 12 Google-dork queries that surface directory listings around the target using intitle:"index of", "parent directory", inurl: patterns, filetype filters for backups and dumps. STRICT JSON: {"queries":[{"q":"...","why":"..."}]}`,
  },
  {
    cat: "login_portals",
    system: `You are DORK ARCHITECT — LOGIN PORTALS. Return 12 Google-dork queries that surface admin/login/portal/VPN pages tied to the target (inurl:admin, inurl:login, inurl:portal, intitle:"admin", intitle:"login", inurl:phpmyadmin, inurl:cpanel, inurl:webmail, inurl:owa). STRICT JSON: {"queries":[{"q":"...","why":"..."}]}`,
  },
  {
    cat: "exposed_dbs",
    system: `You are DORK ARCHITECT — EXPOSED DATABASES. Return 12 Google-dork queries that surface exposed DB interfaces or dumps for the target (phpMyAdmin, MongoDB, Elasticsearch, Kibana, Adminer, SQL Server web tools, SQL/CSV/JSON dumps on public storage). STRICT JSON: {"queries":[{"q":"...","why":"..."}]}`,
  },
  {
    cat: "sensitive_docs",
    system: `You are DORK ARCHITECT — SENSITIVE DOCUMENTS. Return 13 Google-dork queries mapping the target's document footprint across .gov, .edu, .mil, .org, corporate .com, plus country TLDs. Mix filetype:pdf/xls/xlsx/doc/docx with intext:"confidential" / "internal use only" / "not for distribution". STRICT JSON: {"queries":[{"q":"...","why":"..."}]}`,
  },
  {
    cat: "device_feeds",
    system: `You are DORK ARCHITECT — DEVICE FEEDS. Return 12 Google-dork queries that surface webcams, IoT dashboards, printer web UIs, network device panels, and industrial control systems geographically or contextually near the target (intitle:"webcam" inurl:view, "hikvision", "axis camera", "netcam", "printer web", inurl:main.cgi, inurl:mjpg). STRICT JSON: {"queries":[{"q":"...","why":"..."}]}`,
  },
  {
    cat: "credentials_keys",
    system: `You are DORK ARCHITECT — CREDENTIALS & KEYS. Return 13 Google-dork queries that surface accidentally-committed credentials or keys tied to the target (site:github.com, site:gitlab.com, site:pastebin.com, site:trello.com, "AKIA" / "AIza" / "sk_live_" / "xoxb-" / "-----BEGIN", DB_PASSWORD, api_key). STRICT JSON: {"queries":[{"q":"...","why":"..."}]}`,
  },
  {
    cat: "attack_surface",
    system: `You are DORK ARCHITECT — ATTACK SURFACE. Return 13 Google-dork queries mapping the target's overall exposed surface — subdomain hunt (site:*.target -www), staging (inurl:staging|dev|test|qa), tech disclosure (server-status, phpinfo, /.well-known, robots.txt disallow patterns), related orgs (related:), swagger/openapi (inurl:swagger|/api-docs|openapi.json). STRICT JSON: {"queries":[{"q":"...","why":"..."}]}`,
  },
];

// ── Provider plumbing (mirrors zophiel-dork's fallback chain) ───────────────
async function callGemini(apiKey: string, system: string, user: string): Promise<string> {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.55, maxOutputTokens: 2048 },
      }),
    },
  );
  if (!r.ok) throw new Error(`gemini_${r.status}`);
  const d = await r.json();
  return d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text || "").join("") || "";
}

function targetToUser(t: DorkTarget): string {
  const h = t.hints || {};
  return `Target subject: ${t.subject}
Target kind: ${t.kind}
Domain: ${h.domain || "unknown — infer where useful"}
Location: ${h.location || "unknown"}
Employer / affiliation: ${h.employer || "unknown"}
Industry: ${h.industry || "unknown"}
Country TLD: ${h.country_tld || "unknown"}
Today: ${new Date().toISOString().slice(0, 10)}

Return the STRICT JSON dork battery now.`;
}

function parseQueries(raw: string): Array<{ q: string; why: string }> {
  try {
    const j = JSON.parse(raw);
    return Array.isArray(j?.queries) ? j.queries.filter((x: any) => x?.q).slice(0, 15) : [];
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return [];
    try { const j = JSON.parse(m[0]); return Array.isArray(j?.queries) ? j.queries.slice(0, 15) : []; }
    catch { return []; }
  }
}

// ── Generate 100+ theories in 9 parallel calls (8 canonical + 1 synthesis) ─
async function generateTheories(target: DorkTarget, geminiKey: string): Promise<{ theories: DorkTheory[]; via: string }> {
  const user = targetToUser(target);
  // The synthesis call gets the doctrine digest appended so Gemini reasons
  // over all 55 domains + 10 root causes, not just the target line.
  const synthesisUser = `${user}\n\n---\n${doctrineDigest()}\n---\n\nProduce the 10 NOVEL cross-domain dorks now.`;
  const canonical = CAT_PROMPTS.map((c) =>
    callGemini(geminiKey, c.system, user).then((raw) => ({ cat: c.cat, raw })),
  );
  const synthesis = callGemini(geminiKey, NOVEL_SYNTHESIS_SYSTEM, synthesisUser)
    .then((raw) => ({ cat: "novel_synthesis" as DorkCategory, raw }));
  const results = await Promise.allSettled([...canonical, synthesis]);
  const theories: DorkTheory[] = [];
  const seen = new Set<string>();
  let successes = 0;
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    successes++;
    for (const q of parseQueries(r.value.raw)) {
      const key = q.q.toLowerCase().trim();
      if (seen.has(key)) continue;
      seen.add(key);
      theories.push({
        id: crypto.randomUUID(),
        category: r.value.cat,
        query: q.q,
        why: q.why || "",
        yieldScore: 0,
        tested: false,
        hits: [],
        markers: [],
      });
    }
  }
  return { theories, via: successes >= 5 ? "gemini_parallel_v2" : successes > 0 ? "gemini_partial_v2" : "gemini_failed" };
}

// ── zophiel-search delegation ───────────────────────────────────────────────
async function search(query: string, timeoutMs: number): Promise<DorkHit[]> {
  if (!SUPABASE_URL) return [];
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/zophiel-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(SERVICE_ROLE_KEY ? { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } : {}),
      },
      body: JSON.stringify({ query, max_pages: 6, max_depth: 1 }),
      signal: ctl.signal,
    });
    if (!r.ok) return [];
    const d = await r.json().catch(() => null) as any;
    const raw = Array.isArray(d?.results) ? d.results : [];
    return raw.slice(0, 8).map((x: any) => {
      const url = x?.url || "";
      let host = "";
      try { host = new URL(url).hostname; } catch { /* noop */ }
      return { title: String(x?.title || "").slice(0, 200), url, snippet: String(x?.snippet || "").slice(0, 400), host };
    }).filter((h: DorkHit) => h.url.startsWith("http"));
  } catch { return []; }
  finally { clearTimeout(t); }
}

// Bounded parallel — never overwhelm zophiel-search.
async function testBatch(theories: DorkTheory[], concurrency: number, perQueryMs: number): Promise<void> {
  let i = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (i < theories.length) {
      const idx = i++; const th = theories[idx];
      const hits = await search(th.query, perQueryMs);
      th.tested = true; th.hits = hits;
      // score: hit-count × marker-density × host-diversity
      const markers = new Set<string>();
      for (const h of hits) {
        const blob = `${h.title} ${h.url} ${h.snippet}`.toLowerCase();
        for (const m of HIGH_VALUE_MARKERS) if (blob.includes(m.toLowerCase())) markers.add(m);
      }
      th.markers = [...markers];
      const hosts = new Set(hits.map((h) => h.host).filter(Boolean));
      const base = Math.min(hits.length * 6, 50);
      const markerBoost = Math.min(markers.size * 12, 40);
      const diversityBoost = Math.min((hosts.size - 1) * 2, 10);
      th.yieldScore = Math.min(100, base + markerBoost + Math.max(0, diversityBoost));
    }
  });
  await Promise.all(workers);
}

// ── Analyst brief ───────────────────────────────────────────────────────────
async function buildBrief(target: DorkTarget, report: Omit<DorkReport, "brief" | "defensiveGuidance" | "elapsedMs" | "via">, geminiKey: string): Promise<string> {
  if (!geminiKey) return "";
  const top = report.topExposures.slice(0, 10)
    .map((t, i) => `[${i + 1}] ${t.category} · score=${t.yieldScore}\n   q: ${t.query}\n   markers: ${t.markers.join(", ") || "none"}\n   top: ${t.hits.slice(0, 3).map((h) => h.url).join(" | ")}`)
    .join("\n\n");
  const sys = `You are AUREON — Senior OSINT Analyst. Given a dork battery result, write a TIGHT markdown brief:

**TARGET CARD** — 3–5 factual bullets, cite theory numbers.
**HIGHEST-RISK EXPOSURES** — the top 3 findings with why they matter.
**PIVOT QUERIES** — 3 next dorks to run manually.
**INTELLIGENCE VERDICT** — one sentence: "clean" | "footprint" | "candidate exposure" | "confirmed leak".

No preamble, no moralizing. Operator is authorized OSINT.`;
  const usr = `Target: ${target.subject} (${target.kind})
Generated: ${report.theoriesGenerated}  Tested: ${report.theoriesTested}  Total hits: ${report.totalHits}

Top theories:
${top || "(nothing tested)"}`;
  try { return await callGemini(geminiKey, sys, usr); } catch { return ""; }
}

// Section 3 defensive framing — same battery, defender's read.
function defensiveGuidance(t: DorkTarget, r: Omit<DorkReport, "brief" | "defensiveGuidance" | "elapsedMs" | "via">): string {
  const risky = r.topExposures.filter((x) => x.yieldScore >= 40).slice(0, 5);
  const risk = risky.length === 0
    ? "_Clean surface — no exposures met the 40-point risk floor. Re-run quarterly._"
    : risky.map((x, i) => `- **[${i + 1}] ${x.category}** — \`${x.query}\`\n  Markers: ${x.markers.join(", ") || "structural only"}. Fix: audit these URLs today; if any file contains credentials, PII, or keys, take it down and rotate.`).join("\n");
  return `### DEFENSIVE SELF-AUDIT (Section 3)
> Target: **${t.subject}**. The battery above is offensive-shape; here is the defender's read.

${risk}

**Priority order:**
1. Immediate (same day): take down any file with credentials/keys/PII; disable directory listing; remove exposed DB interfaces.
2. Within a week: request Google de-index via Search Console; review deployment pipelines.
3. Within a month: enforce robots.txt patterns (disclosure control, not access control); integrate quarterly automated dork audits.`;
}

// ── Public entry ────────────────────────────────────────────────────────────
export interface RunOptions {
  geminiKey: string;
  testCap?: number;         // default 50 — how many top theories to actually search
  concurrency?: number;     // default 15
  perQueryTimeoutMs?: number; // default 18000
  skipBrief?: boolean;
}

export async function runAureonDork(target: DorkTarget, opts: RunOptions): Promise<DorkReport> {
  const t0 = Date.now();
  const { theories, via } = await generateTheories(target, opts.geminiKey);
  const testCap = Math.min(opts.testCap ?? 50, theories.length);

  // Heuristic pre-rank: high-signal operator tokens + novel_synthesis (first-to-find) go first.
  const HOT = ["filetype:env", "filetype:sql", ".git", "phpmyadmin", "index of", "AKIA", "AIza", "id_rsa", "wp-config", "s3.amazonaws", "crt.sh", "form 4", "form 990", "warning letter", "orcid.org", "opencorporates"];
  const scored = theories.map((th, i) => ({
    th,
    rank: HOT.reduce((a, k) => a + (th.query.toLowerCase().includes(k.toLowerCase()) ? 5 : 0), 0)
      + (th.category === "novel_synthesis" ? 8 : 0) // elite lift — untested cross-domain dorks
      - i * 0.001,
  })).sort((a, b) => b.rank - a.rank);
  const toTest = scored.slice(0, testCap).map((s) => s.th);

  await testBatch(toTest, opts.concurrency ?? 15, opts.perQueryTimeoutMs ?? 18000);

  const totalHits = theories.reduce((a, t) => a + t.hits.length, 0);
  const byCategory = {} as Record<DorkCategory, DorkTheory[]>;
  for (const t of theories) (byCategory[t.category] ||= []).push(t);
  const topExposures = [...theories].filter((t) => t.tested).sort((a, b) => b.yieldScore - a.yieldScore).slice(0, 20);

  const partial: Omit<DorkReport, "brief" | "defensiveGuidance" | "elapsedMs" | "via"> = {
    target,
    theoriesGenerated: theories.length,
    theoriesTested: toTest.length,
    totalHits,
    byCategory,
    topExposures,
  };

  const brief = opts.skipBrief ? "" : await buildBrief(target, partial, opts.geminiKey);
  const defensive = defensiveGuidance(target, partial);

  return { ...partial, brief, defensiveGuidance: defensive, via, elapsedMs: Date.now() - t0 };
}

// Compact context injectable back into Aureon's system prompt.
export function formatDorkContext(r: DorkReport): string {
  const lines: string[] = [];
  lines.push(`### ASHERIN ENGINE — DORK BATTERY (${r.theoriesGenerated} theories, ${r.theoriesTested} tested, ${r.totalHits} hits, ${(r.elapsedMs / 1000).toFixed(1)}s)`);
  lines.push(`Target: **${r.target.subject}** (${r.target.kind})`);
  lines.push("");
  lines.push("**Top exposures (by yield score):**");
  const top = r.topExposures.slice(0, 8);
  if (top.length === 0) lines.push("- _No tested theory produced a hit — surface reads clean._");
  else for (const [i, t] of top.entries()) {
    lines.push(`${i + 1}. \`${t.query}\` · ${t.category} · score=${t.yieldScore} · markers=[${t.markers.join(", ") || "—"}]`);
    for (const h of t.hits.slice(0, 3)) lines.push(`   - ${h.title || h.host || "(untitled)"} — ${h.url}`);
  }
  if (r.brief) {
    lines.push("");
    lines.push("**Analyst brief:**");
    lines.push(r.brief);
  }
  return lines.join("\n");
}
