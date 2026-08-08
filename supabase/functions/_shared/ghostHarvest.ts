// ─────────────────────────────────────────────────────────────────────────────
// GHOST HARVEST — wide-aperture selector fan-out for the Asherin Ghost Engine.
//
// The old discovery pass asked one question of one scraper and kept whatever
// twelve links came back. A bare personal name returns almost nothing that
// way, because a name is not a query — it is an *entity*, and an entity has
// to be interrogated from many angles before the open index admits it knows
// anything.
//
// Three things this module does that the single-shot pass never did:
//   1. CLASSIFY  — email / phone / domain / handle / name / freeform. The
//                  selector kind drives every downstream leg.
//   2. FAN OUT   — expand one selector into 6–16 orthogonal queries. An email
//                  is asked as literal, as a paste-site artefact, as a
//                  document string, as a breach term, and as its own domain.
//                  A name is asked as a quoted phrase, as social handles,
//                  as court/property records, as a resume, as a news subject.
//   3. UNION     — run legs across the multi-engine surface (zophiel-search)
//                  with a scraper fallback (ddg-search), dedupe by canonical
//                  URL, and keep every engine's title/snippet so a lead is
//                  evidence even if the shell probe later fails.
// ─────────────────────────────────────────────────────────────────────────────

export type SelectorKind = "email" | "phone" | "domain" | "name" | "handle" | "freeform";

export interface SelectorIdentity {
  kind: SelectorKind;
  /** Stable normalized key for history grouping. Never the raw typed string. */
  key: string;
  /** Display label for the history rail. */
  label: string;
  /** Extra facts (email local, phone digits, root domain, etc). */
  parts: Record<string, string>;
}

export interface HarvestLead {
  url: string;
  title: string;
  snippet: string;
  engine: string;
  /** Which fan-out leg surfaced it — the lead's own provenance. */
  via: string;
  /** Distinct legs that independently returned this URL. */
  corroboration: number;
}

/** ── 1. CLASSIFY ─────────────────────────────────────────────────────────── */
export function classifySelector(raw: string): SelectorIdentity {
  const s = raw.trim();
  const email = s.match(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i);
  if (email) {
    const [local, domain] = s.toLowerCase().split("@");
    return { kind: "email", key: `email:${s.toLowerCase()}`, label: s, parts: { local, domain } };
  }
  const digits = s.replace(/\D+/g, "");
  if (/^\+?[\d\s().-]{7,}$/.test(s) && digits.length >= 7 && digits.length <= 15) {
    return { kind: "phone", key: `phone:${digits}`, label: s, parts: { digits } };
  }
  const dom = s.match(/^(?:https?:\/\/)?([a-z0-9-]+(?:\.[a-z0-9-]+)+)/i);
  if (dom && !/\s/.test(s)) {
    const host = dom[1].toLowerCase();
    return { kind: "domain", key: `domain:${host}`, label: host, parts: { host } };
  }
  const handle = s.match(/^@([a-z0-9_.-]{2,32})$/i);
  if (handle) {
    return { kind: "handle", key: `handle:${handle[1].toLowerCase()}`, label: `@${handle[1]}`, parts: { handle: handle[1].toLowerCase() } };
  }
  const words = s.split(/\s+/).filter(Boolean);
  const looksLikeName =
    words.length >= 2 && words.length <= 5 &&
    words.every((w) => /^[\p{L}][\p{L}'.-]{0,30}$/u.test(w));
  if (looksLikeName) {
    const key = words.map((w) => w.toLowerCase()).join(" ");
    return { kind: "name", key: `name:${key}`, label: s, parts: { normalized: key, first: words[0].toLowerCase(), last: words[words.length - 1].toLowerCase() } };
  }
  return { kind: "freeform", key: `q:${s.toLowerCase().slice(0, 120)}`, label: s, parts: {} };
}

/** ── 2. FAN OUT ──────────────────────────────────────────────────────────── */
export interface HarvestLeg { label: string; query: string; weight: number }

const SOCIAL_SITES = [
  "linkedin.com", "twitter.com", "x.com", "facebook.com", "instagram.com",
  "github.com", "reddit.com", "medium.com", "youtube.com", "tiktok.com",
  "pinterest.com", "about.me", "keybase.io",
];
const RECORD_SITES = [
  "spokeo.com", "whitepages.com", "beenverified.com", "truepeoplesearch.com",
  "fastpeoplesearch.com", "peoplefinder.com", "radaris.com", "mylife.com",
  "courtlistener.com", "unicourt.com", "justia.com",
];
const PASTE_SITES = ["pastebin.com", "ghostbin.com", "hastebin.com", "rentry.co", "controlc.com"];
const BREACH_HINTS = ["haveibeenpwned.com", "dehashed.com", "leakcheck.io", "intelx.io"];

/** Providers whose domain says nothing about the person behind the address. */
const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com",
  "outlook.com", "live.com", "msn.com", "aol.com", "icloud.com", "me.com",
  "mac.com", "proton.me", "protonmail.com", "gmx.com", "gmx.net", "mail.com",
  "zoho.com", "yandex.com", "yandex.ru", "tutanota.com", "fastmail.com",
  "hushmail.com", "pm.me", "qq.com", "163.com", "126.com", "naver.com",
]);
export const isFreemail = (domain: string) => FREEMAIL.has(domain.toLowerCase());

/**
 * Relevance gate.
 *
 * A fan-out leg is a question, and search engines answer questions they were
 * not asked. Without a gate, a leg like `site:en.wikipedia.org "@gmail.com"`
 * floods the result set with encyclopedia articles that merely mention the
 * provider. An entity selector is only satisfied by a document that carries a
 * piece of the entity: the address, the digits, the surname, the host.
 * Freeform queries keep everything — there is no entity to be wrong about.
 */
function selectorTokens(id: SelectorIdentity): string[] {
  switch (id.kind) {
    case "email": {
      const { local, domain } = id.parts;
      // The local part is the discriminating token; the freemail domain is not.
      return isFreemail(domain) ? [id.label, local] : [id.label, local, domain];
    }
    case "phone": {
      const d = id.parts.digits;
      const last10 = d.slice(-10);
      return [d, last10, last10.slice(0, 3) + last10.slice(3, 6) + last10.slice(6)];
    }
    case "domain": return [id.parts.host];
    case "handle": return [id.parts.handle];
    case "name": return [id.parts.normalized, id.parts.last];
    default: return [];
  }
}

function leadIsRelevant(lead: HarvestLead, tokens: string[], id: SelectorIdentity): boolean {
  if (tokens.length === 0) return true;
  const hay = `${lead.url} ${lead.title} ${lead.snippet}`.toLowerCase();
  const digits = hay.replace(/\D+/g, "");
  for (const t of tokens) {
    if (!t) continue;
    if (hay.includes(t.toLowerCase())) return true;
    if (id.kind === "phone" && /^\d{7,}$/.test(t) && digits.includes(t)) return true;
  }
  // A name is often split across a title ("Newton, Asher"); accept first+last
  // appearing separately rather than as a contiguous phrase.
  if (id.kind === "name") {
    const { first, last } = id.parts;
    if (first && last && hay.includes(first) && hay.includes(last)) return true;
  }
  return false;
}


export function planFanout(id: SelectorIdentity): HarvestLeg[] {
  const legs: HarvestLeg[] = [];
  const push = (label: string, query: string, weight = 1) => legs.push({ label, query, weight });

  switch (id.kind) {
    case "email": {
      const e = id.label;
      const { local, domain } = id.parts;
      push("literal", `"${e}"`, 3);
      push("intext", `intext:"${e}"`, 2);
      push("filetype", `"${e}" filetype:pdf OR filetype:doc OR filetype:xls OR filetype:csv`);
      push("paste", `"${e}" ${PASTE_SITES.map((s) => `site:${s}`).join(" OR ")}`);
      push("breach", `"${e}" (breach OR leak OR dump OR combolist)`);
      // The domain of a freemail address belongs to the provider, not the
      // subject. Interrogating "gmail.com" returns the provider's own corpus —
      // encyclopedia entries, unrelated addresses — which is noise wearing the
      // costume of a finding. For those, pivot to the local part as a handle,
      // which is the piece that actually travels with the person.
      if (isFreemail(domain)) {
        push("local-as-handle", `"${local}"`, 2);
        for (const s of SOCIAL_SITES.slice(0, 8)) push(`handle:${s}`, `site:${s} "${local}"`, 0.8);
      } else {
        push("domain-artifact", `"@${domain}" "${local}"`);
        push("root-domain", domain);
      }

      for (const s of ["github.com", "gitlab.com", "gist.github.com"]) {
        push(`code:${s}`, `"${e}" site:${s}`);
      }
      push("archive", `site:web.archive.org "${e}"`);
      for (const s of BREACH_HINTS) push(`hint:${s}`, `site:${s} "${e}"`, 0.5);
      break;
    }
    case "phone": {
      const d = id.parts.digits;
      const pretty = id.label;
      push("literal", `"${pretty}"`, 3);
      const grouped = d.length === 10
        ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
        : d.length === 11
          ? `${d.slice(0, 1)}-${d.slice(1, 4)}-${d.slice(4, 7)}-${d.slice(7)}`
          : d;
      push("dashed", `"${grouped}"`, 2);
      push("dotted", `"${grouped.replace(/-/g, ".")}"`);
      push("parens", d.length >= 10 ? `"(${d.slice(-10, -7)}) ${d.slice(-7, -4)}-${d.slice(-4)}"` : `"${d}"`);
      push("records", `"${grouped}" (${RECORD_SITES.map((s) => `site:${s}`).join(" OR ")})`);
      push("carrier", `"${grouped}" (carrier OR sim OR porting OR "spam calls")`);
      push("classified", `"${grouped}" (craigslist OR classified OR listing OR contact)`);
      push("archive", `site:web.archive.org "${grouped}"`);
      break;
    }
    case "domain": {
      const h = id.parts.host;
      push("root", h, 3);
      push("literal-host", `"${h}"`, 2);
      push("subdomain-index", `site:${h}`);
      push("about", `${h} (about OR contact OR imprint OR "privacy policy")`);
      push("whois", `"${h}" (whois OR registrar OR "domain owner")`);
      push("archive", `site:web.archive.org ${h}`);
      push("shodan", `site:shodan.io "${h}"`);
      push("crt", `site:crt.sh ${h}`);
      push("virustotal", `site:virustotal.com "${h}"`);
      push("github", `site:github.com "${h}"`);
      push("paste", `"${h}" ${PASTE_SITES.map((s) => `site:${s}`).join(" OR ")}`);
      break;
    }
    case "handle": {
      const h = id.parts.handle;
      push("literal", `"@${h}"`, 3);
      for (const s of SOCIAL_SITES) push(`site:${s}`, `site:${s} "${h}"`);
      push("github", `site:github.com ${h}`);
      push("archive", `site:web.archive.org "@${h}"`);
      break;
    }
    case "name": {
      const n = id.label;
      const first = id.parts.first;
      const last = id.parts.last;
      push("phrase", `"${n}"`, 3);
      push("intitle", `intitle:"${n}"`, 2);
      for (const s of SOCIAL_SITES) push(`social:${s}`, `site:${s} "${n}"`);
      for (const s of RECORD_SITES) push(`record:${s}`, `site:${s} "${n}"`);
      push("resume", `"${n}" (resume OR CV OR curriculum) filetype:pdf`);
      push("court", `"${n}" (court OR docket OR filing OR plaintiff OR defendant)`);
      push("obit", `"${n}" (obituary OR memorial OR funeral)`);
      push("news", `"${n}" (news OR interview OR announcement)`);
      push("property", `"${n}" (property OR deed OR parcel OR assessor)`);
      push("archive", `site:web.archive.org "${n}"`);
      if (first && last) push("initials", `"${first[0]}. ${last}"`, 0.5);
      break;
    }
    default: {
      push("literal", id.label, 3);
      push("phrase", `"${id.label}"`, 2);
      push("filetype", `${id.label} filetype:pdf OR filetype:doc`);
      push("archive", `site:web.archive.org ${id.label}`);
      push("github", `site:github.com ${id.label}`);
      push("news", `${id.label} (news OR report OR announcement)`);
    }
  }
  return legs;
}

/** ── 3. UNION ────────────────────────────────────────────────────────────── */
interface EngineHit { url: string; title?: string; snippet?: string; engine?: string }

function canonicalUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    u.hash = "";
    for (const p of [...u.searchParams.keys()]) {
      if (/^utm_|^fbclid$|^gclid$|^mc_/i.test(p)) u.searchParams.delete(p);
    }
    let s = u.toString();
    if (s.endsWith("/") && u.pathname === "/") s = s.slice(0, -1);
    return s;
  } catch { return null; }
}

async function runLegZophiel(bearer: string, supabaseUrl: string, leg: HarvestLeg, timeoutMs: number): Promise<EngineHit[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/zophiel-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ query: leg.query, mode: "web", fast: true }),
      signal: ctrl.signal,
    });
    if (!res.ok) { console.log(`[ghostHarvest] zophiel leg "${leg.label}" -> HTTP ${res.status}`); return []; }
    const j = await res.json() as { results?: Array<{ url: string; title?: string; snippet?: string; engine?: string }> };
    return (j.results || []).slice(0, 40).map((r) => ({ url: r.url, title: r.title, snippet: r.snippet, engine: r.engine || "zophiel" }));
  } catch (e) { console.log(`[ghostHarvest] zophiel leg "${leg.label}" failed: ${(e as Error).message}`); return []; }
  finally { clearTimeout(t); }
}

async function runLegDdg(bearer: string, supabaseUrl: string, leg: HarvestLeg, timeoutMs: number): Promise<EngineHit[]> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/ddg-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${bearer}` },
      body: JSON.stringify({ query: leg.query, numResults: 25 }),
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const j = await res.json() as { results?: Array<{ url: string; title?: string; snippet?: string }> };
    return (j.results || []).map((r) => ({ url: r.url, title: r.title, snippet: r.snippet, engine: "ddg" }));
  } catch { return []; }
  finally { clearTimeout(t); }
}

export interface HarvestOptions {
  concurrency?: number;
  legTimeoutMs?: number;
  maxLeads?: number;
}

export async function harvestLeads(
  id: SelectorIdentity,
  authHeader: string | null,
  opts: HarvestOptions = {},
): Promise<{ legs: HarvestLeg[]; leads: HarvestLead[] }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const bearer = serviceRole || (authHeader || "").replace(/^Bearer\s+/i, "");
  if (!supabaseUrl || !bearer) return { legs: [], leads: [] };

  const concurrency = opts.concurrency ?? 4;
  const legTimeoutMs = opts.legTimeoutMs ?? 12_000;
  const maxLeads = opts.maxLeads ?? 300;

  const legs = planFanout(id);
  const leadsByUrl = new Map<string, HarvestLead>();

  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, legs.length) }, async () => {
    while (cursor < legs.length && leadsByUrl.size < maxLeads) {
      const idx = cursor++;
      const leg = legs[idx];
      // Zophiel first (multi-engine), DDG as scraper fallback if Zophiel was thin.
      const [zop, ddg] = await Promise.all([
        runLegZophiel(bearer, supabaseUrl, leg, legTimeoutMs),
        Promise.resolve().then(() => runLegDdg(bearer, supabaseUrl, leg, Math.min(legTimeoutMs, 9000))),
      ]);
      const both = [...zop, ...ddg];
      for (const h of both) {
        const canon = canonicalUrl(h.url);
        if (!canon) continue;
        const existing = leadsByUrl.get(canon);
        if (existing) {
          existing.corroboration += 1;
          if (!existing.snippet && h.snippet) existing.snippet = h.snippet.slice(0, 400);
          if (!existing.title && h.title) existing.title = h.title.slice(0, 200);
        } else {
          leadsByUrl.set(canon, {
            url: canon,
            title: (h.title || "").slice(0, 200),
            snippet: (h.snippet || "").slice(0, 400),
            engine: h.engine || "unknown",
            via: leg.label,
            corroboration: 1,
          });
        }
      }
    }
  });
  await Promise.allSettled(workers);

  const tokens = selectorTokens(id);
  const all = [...leadsByUrl.values()];
  // Legs whose query already embedded the selector are trusted even when the
  // engine returns a snippet that omits the term — absence from a 160-char
  // preview is not absence from the page.
  const LITERAL_LEGS = /^(literal|phrase|intitle|intext|root|literal-host|subdomain-index|local-as-handle|dashed|dotted|parens)$/;
  const relevant = all.filter((l) => LITERAL_LEGS.test(l.via) || leadIsRelevant(l, tokens, id));
  // Corroboration first — a URL two independent legs both surfaced is a
  // stronger claim than one a single scraper coughed up.
  const leads = relevant.sort((a, b) => b.corroboration - a.corroboration);
  console.log(
    `[ghostHarvest] ${id.kind} · legs=${legs.length} · raw=${all.length} · kept=${leads.length}`,
  );
  return { legs, leads };

}
