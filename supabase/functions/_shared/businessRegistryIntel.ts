// ───────────────────────────────────────────────────────────────────────────
// BUSINESS REGISTRY INTEL — jurisdictional company-lookup framework.
//
// Goal: paste a company name (optionally with a country hint) into Aureon
// Chat and get back a live, cited authoritative-registry pull — the same
// way Ghost Trace autopsies a social post and Specter Weave autopsies a
// handle. Framework-first: one adapter interface, per-country adapters
// plug in. Ships today with a fully working SEC EDGAR (US) adapter using
// SEC's zero-key JSON endpoints. Additional country adapters (UK
// Companies House, France INSEE Sirene, EU BRIS, etc.) can be added by
// implementing the RegistryAdapter interface and registering below.
//
// Design constraints:
//  • SSRF-hardened: all fetches go through allow-listed host lists.
//  • No secrets required for the SEC lane (SEC's data.sec.gov is public).
//  • Per-adapter timeout, silent per-adapter failure — never blocks stream.
//  • Evidence is fenced as <business_registry_evidence> so the LLM knows
//    to cite it verbatim, and every fact carries a numeric confidence.
// ───────────────────────────────────────────────────────────────────────────

const USER_AGENT = "Aureon-Intel/1.0 contact@aureonai.app";
const ADAPTER_TIMEOUT_MS = 5000;

export interface RegistryHit {
  jurisdiction: string;           // ISO alpha-2 country
  registry: string;               // human-readable authority name
  registryId: string;             // authority-issued id (CIK, CRN, SIREN, …)
  legalName: string;
  status: string;                 // active / dissolved / etc.
  incorporatedIn?: string;
  address?: string;
  sicOrNace?: string;
  sicDescription?: string;
  tickers?: string[];
  exchanges?: string[];
  website?: string;
  ein?: string;
  lei?: string;
  fiscalYearEnd?: string;
  filingsRecent?: { form: string; filedAt: string; accessionNumber?: string; url?: string }[];
  sourceUrl: string;
  confidence: number;             // 0..1 confidence the record matches the query
}

export interface RegistryIntent {
  fired: boolean;
  query: string;
  countryHint?: string;           // ISO alpha-2 if user hinted (US, UK, FR…)
}

export interface RegistryAdapter {
  id: string;
  jurisdiction: string;
  supports(intent: RegistryIntent): boolean;
  search(intent: RegistryIntent, signal: AbortSignal): Promise<RegistryHit[]>;
}

// ── Intent detection ───────────────────────────────────────────────────────
// Fire when the user message pairs a "company / registry / EIN / CIK / SEC
// filings / who owns" verb with a plausible entity name, OR when the
// message directly references a jurisdictional registry.
const REGISTRY_VERBS =
  /\b(company|corporation|corp|inc\.?|llc|ltd|filings?|sec (?:filings?|edgar)|edgar|10-?[kq]|8-?k|cik|ein|lei|ticker|business (?:registry|registration)|incorporated|who owns|ownership of|registered agent)\b/i;
const REGISTRY_NOUNS =
  /\b(look ?up|search|find|pull|show|check|verify)\b/i;
const COUNTRY_HINT: Record<string, string> = {
  " us": "US", " usa": "US", " united states": "US", " sec ": "US",
  " uk ": "GB", " britain": "GB", " england": "GB", " companies house": "GB",
  " france": "FR", " insee": "FR", " sirene": "FR",
  " germany": "DE", " handelsregister": "DE",
  " canada": "CA", " australia": "AU", " singapore": "SG", " india": "IN",
};
export function detectRegistryIntent(text: string): RegistryIntent {
  if (!text) return { fired: false, query: "" };
  const t = text.toLowerCase();
  const verb = REGISTRY_VERBS.test(text);
  const noun = REGISTRY_NOUNS.test(text);
  if (!(verb || noun)) return { fired: false, query: "" };
  let countryHint: string | undefined;
  for (const [needle, code] of Object.entries(COUNTRY_HINT)) {
    if (t.includes(needle)) { countryHint = code; break; }
  }
  // Extract the likely entity: strip verbs/nouns, keep proper-noun-ish tokens.
  const cleaned = text
    .replace(/[?.!,]/g, " ")
    .replace(REGISTRY_VERBS, " ")
    .replace(REGISTRY_NOUNS, " ")
    .replace(/\b(in|for|on|about|the|please|can you|could you)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 2) return { fired: false, query: "" };
  return { fired: true, query: cleaned, countryHint };
}

// ── SEC EDGAR adapter (US) — zero-key ─────────────────────────────────────
// Uses the officially documented, zero-auth data.sec.gov + www.sec.gov
// endpoints. Ticker-first: SEC publishes the full ticker→CIK table as a
// single JSON file, so a company name / ticker resolves in one round-trip
// against the local snapshot, then a second call pulls the authoritative
// submissions record (name, tickers, exchanges, SIC, EIN, addresses,
// recent filings). Confidence is scored from name/ticker match quality.
const SEC_ALLOWED = new Set(["www.sec.gov", "data.sec.gov"]);
let SEC_TICKER_CACHE: { at: number; rows: { cik: string; ticker: string; title: string }[] } | null = null;
async function loadSecTickers(signal: AbortSignal): Promise<{ cik: string; ticker: string; title: string }[]> {
  const now = Date.now();
  if (SEC_TICKER_CACHE && now - SEC_TICKER_CACHE.at < 6 * 3600 * 1000) return SEC_TICKER_CACHE.rows;
  const url = "https://www.sec.gov/files/company_tickers.json";
  const u = new URL(url);
  if (!SEC_ALLOWED.has(u.hostname)) throw new Error("SSRF_BLOCK");
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT, "accept": "application/json" }, signal });
  if (!res.ok) throw new Error(`sec_tickers_${res.status}`);
  const json = await res.json();
  const rows = Object.values(json as Record<string, any>).map((r: any) => ({
    cik: String(r.cik_str).padStart(10, "0"),
    ticker: String(r.ticker).toUpperCase(),
    title: String(r.title),
  }));
  SEC_TICKER_CACHE = { at: now, rows };
  return rows;
}
function scoreSecMatch(query: string, row: { ticker: string; title: string }): number {
  const q = query.toUpperCase().trim();
  if (row.ticker === q) return 1;
  if (row.title.toUpperCase() === q) return 0.98;
  if (row.title.toUpperCase().startsWith(q)) return 0.88;
  if (row.title.toUpperCase().includes(q)) return 0.72;
  // Loose token overlap
  const qTokens = q.split(/\s+/).filter(Boolean);
  const tTokens = row.title.toUpperCase().split(/\s+/).filter(Boolean);
  const overlap = qTokens.filter((t) => tTokens.includes(t)).length;
  if (overlap === 0) return 0;
  return Math.min(0.65, 0.25 + 0.2 * overlap);
}
export const SEC_EDGAR_ADAPTER: RegistryAdapter = {
  id: "sec_edgar",
  jurisdiction: "US",
  supports: (intent) => !intent.countryHint || intent.countryHint === "US",
  async search(intent, signal) {
    const rows = await loadSecTickers(signal);
    const scored = rows.map((r) => ({ r, score: scoreSecMatch(intent.query, r) }))
      .filter((x) => x.score > 0.6)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    const out: RegistryHit[] = [];
    for (const { r, score } of scored) {
      try {
        const subUrl = `https://data.sec.gov/submissions/CIK${r.cik}.json`;
        if (!SEC_ALLOWED.has(new URL(subUrl).hostname)) continue;
        const res = await fetch(subUrl, { headers: { "user-agent": USER_AGENT, "accept": "application/json" }, signal });
        if (!res.ok) continue;
        const j: any = await res.json();
        const filings = ((): RegistryHit["filingsRecent"] => {
          const rec = j.filings?.recent;
          if (!rec?.form) return [];
          const forms: string[] = rec.form || [];
          const dates: string[] = rec.filingDate || [];
          const accs: string[] = rec.accessionNumber || [];
          const prims: string[] = rec.primaryDocument || [];
          return forms.slice(0, 5).map((f, i) => ({
            form: f,
            filedAt: dates[i] || "",
            accessionNumber: accs[i] || "",
            url: accs[i]
              ? `https://www.sec.gov/Archives/edgar/data/${Number(r.cik)}/${(accs[i] as string).replace(/-/g, "")}/${prims[i] || ""}`
              : undefined,
          }));
        })();
        const addr = j.addresses?.business || j.addresses?.mailing;
        const address = addr
          ? [addr.street1, addr.street2, addr.city, addr.stateOrCountry, addr.zipCode].filter(Boolean).join(", ")
          : undefined;
        out.push({
          jurisdiction: "US",
          registry: "U.S. Securities and Exchange Commission — EDGAR",
          registryId: `CIK${r.cik}`,
          legalName: j.name || r.title,
          status: (j.entityType || "operating"),
          incorporatedIn: j.stateOfIncorporationDescription || j.stateOfIncorporation,
          address,
          sicOrNace: j.sic,
          sicDescription: j.sicDescription,
          tickers: j.tickers || [r.ticker],
          exchanges: j.exchanges || [],
          website: j.website || undefined,
          ein: j.ein || undefined,
          lei: j.lei || undefined,
          fiscalYearEnd: j.fiscalYearEnd || undefined,
          filingsRecent: filings,
          sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${r.cik}`,
          confidence: Math.min(0.99, score),
        });
      } catch {
        // silent per-record failure
      }
    }
    return out;
  },
};

// ── Registry ────────────────────────────────────────────────────────────────
const ADAPTERS: RegistryAdapter[] = [SEC_EDGAR_ADAPTER];

export interface BusinessRegistryPullResult {
  fired: boolean;
  intent: RegistryIntent;
  hits: RegistryHit[];
  evidence: string;               // ready-to-inject fenced block
  attachment: { hits: RegistryHit[] } | null;
  errors: string[];
}

export async function runBusinessRegistryPipeline(userText: string): Promise<BusinessRegistryPullResult> {
  const intent = detectRegistryIntent(userText);
  if (!intent.fired) {
    return { fired: false, intent, hits: [], evidence: "", attachment: null, errors: [] };
  }
  const active = ADAPTERS.filter((a) => a.supports(intent));
  const errors: string[] = [];
  const perAdapter = await Promise.all(active.map(async (a) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort("timeout"), ADAPTER_TIMEOUT_MS);
    try {
      const hits = await a.search(intent, ctrl.signal);
      return hits;
    } catch (e: any) {
      errors.push(`${a.id}:${String(e?.message || e).slice(0, 80)}`);
      return [] as RegistryHit[];
    } finally {
      clearTimeout(t);
    }
  }));
  const hits = perAdapter.flat().sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  if (hits.length === 0) {
    return {
      fired: true, intent, hits: [], attachment: null, errors,
      evidence: `\n<business_registry_evidence>\nNo authoritative registry hit for query="${intent.query}"${intent.countryHint ? ` (country hint=${intent.countryHint})` : ""}. Do not fabricate a registration; say the pull returned no match and suggest the user provide a jurisdiction hint or exact legal name.\n</business_registry_evidence>\n`,
    };
  }
  // Build human-readable evidence fence.
  const lines: string[] = [];
  lines.push(`\n<business_registry_evidence>`);
  lines.push(`Query: "${intent.query}"${intent.countryHint ? ` — country hint: ${intent.countryHint}` : ""}`);
  lines.push(`Authoritative registry pull returned ${hits.length} candidate(s). Every fact below is sourced from the linked authority; cite [${hits[0].registry}] inline. Do NOT invent additional facts.`);
  for (const h of hits) {
    lines.push(``);
    lines.push(`— ${h.legalName} (${h.registry}, ${h.registryId}) — confidence ${h.confidence.toFixed(2)}`);
    lines.push(`  status=${h.status}${h.incorporatedIn ? `, incorporated in ${h.incorporatedIn}` : ""}${h.fiscalYearEnd ? `, FY end ${h.fiscalYearEnd}` : ""}`);
    if (h.tickers?.length) lines.push(`  tickers=${h.tickers.join(", ")}${h.exchanges?.length ? ` on ${h.exchanges.join(", ")}` : ""}`);
    if (h.sicOrNace) lines.push(`  SIC/NACE=${h.sicOrNace}${h.sicDescription ? ` (${h.sicDescription})` : ""}`);
    if (h.ein) lines.push(`  EIN=${h.ein}`);
    if (h.lei) lines.push(`  LEI=${h.lei}`);
    if (h.address) lines.push(`  address=${h.address}`);
    if (h.website) lines.push(`  website=${h.website}`);
    if (h.filingsRecent?.length) {
      lines.push(`  recent filings:`);
      for (const f of h.filingsRecent) {
        lines.push(`    • ${f.form} filed ${f.filedAt}${f.url ? ` — ${f.url}` : ""}`);
      }
    }
    lines.push(`  source: ${h.sourceUrl}`);
  }
  lines.push(`</business_registry_evidence>\n`);
  return {
    fired: true, intent, hits, errors,
    evidence: lines.join("\n"),
    attachment: { hits },
  };
}
