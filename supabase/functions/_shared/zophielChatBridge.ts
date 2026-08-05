/**
 * ZOPHIEL → CHAT BRIDGE
 * ---------------------------------------------------------------------------
 * Gives Aureon/Asher chat the same retrieval substrate the Zophiel web engine
 * uses in the dashboard, instead of a single DuckDuckGo scrape:
 *
 *   1. `zophiel-search`     — multi-engine, tiered, veracity-scored corpus.
 *   2. `zophiel-xkeyscore`  — deterministic entity/graph layer over that corpus
 *                             (bodies harvested server-side, no model involved).
 *
 * Every claim handed to the model carries a URL, a tier and a corroboration
 * count, so the assistant can cite rather than assert. Both calls are bounded
 * by wall-clock deadlines and fail soft: on any error the caller keeps its
 * existing fallback path.
 */

import type { SerpIntel } from "./serpEntityEngine.ts";

export interface ZophielHit {
  title: string;
  url: string;
  snippet: string;
  tier?: number;
  veracity?: number;
  engine?: string;
  layer?: string;
  onion?: boolean;
  publishDate?: string;
}

export interface ZophielBundle {
  query: string;
  results: ZophielHit[];
  instantAnswer?: string | null;
  intel: SerpIntel | null;
  elapsedMs: number;
}

const SEARCH_TIMEOUT_MS = 42_000;
const INTEL_TIMEOUT_MS = 40_000;
const MAX_CONTEXT_HITS = 24;

function fnUrl(name: string): string | null {
  const base = Deno.env.get("SUPABASE_URL");
  return base ? `${base.replace(/\/+$/, "")}/functions/v1/${name}` : null;
}

function authHeaders(): Record<string, string> {
  const key =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_ANON_KEY") ||
    "";
  return {
    "Content-Type": "application/json",
    ...(key ? { Authorization: `Bearer ${key}`, apikey: key } : {}),
  };
}

async function postJson<T>(
  name: string,
  payload: unknown,
  timeoutMs: number,
): Promise<T | null> {
  const url = fnUrl(name);
  if (!url) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn(`[zophielBridge] ${name} -> HTTP ${res.status}`);
      return null;
    }
    const ctype = res.headers.get("content-type") ?? "";
    if (!/application\/json/i.test(ctype)) return null;
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[zophielBridge] ${name} failed:`, (e as Error).message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Deep mode (graph layer) is reserved for turns where relationships matter —
 * people, organisations, infrastructure, investigations. Pure "what happened
 * today" news turns only need the ranked corpus, and paying 40s for a graph
 * there would blow the chat deadline for no analytical gain.
 */
export function needsGraphLayer(text: string): boolean {
  return /\b(who is|who's|background|dossier|investigate|investigation|osint|connections?|associates?|linked to|affiliat|network|relationship|owner|ownership|registrant|whois|breach|leak|dark ?web|profile on|look ?up|trace|footprint|due diligence|records? on|find (?:everything|info|information) (?:on|about))\b/i
    .test(text);
}

/** Multi-engine corpus + optional deterministic graph layer. Never throws. */
export async function runZophielIntel(
  query: string,
  opts: { deep?: boolean; mode?: string; fast?: boolean } = {},
): Promise<ZophielBundle | null> {
  const started = Date.now();
  const trimmed = query.trim().slice(0, 400);
  if (!trimmed) return null;

  const search = await postJson<{
    success?: boolean;
    results?: ZophielHit[];
    instantAnswer?: string | null;
  }>(
    "zophiel-search",
    { query: trimmed, mode: opts.mode || "web", fast: opts.fast !== false },
    SEARCH_TIMEOUT_MS,
  );

  const results = Array.isArray(search?.results) ? search!.results : [];
  if (results.length === 0) return null;

  let intel: SerpIntel | null = null;
  if (opts.deep) {
    // Onion hits are excluded from the harvest: the edge runtime cannot reach
    // .onion hosts, so every fetch would burn a worker slot on a guaranteed
    // timeout and starve the clearnet pages that actually resolve.
    const corpus = results
      .filter((r) => !r.onion && /^https?:/i.test(r.url || ""))
      .slice(0, 30)
      .map((r) => ({ title: r.title, url: r.url, snippet: r.snippet }));
    if (corpus.length > 0) {
      const res = await postJson<{ success?: boolean; intel?: SerpIntel }>(
        "zophiel-xkeyscore",
        { query: trimmed, results: corpus, harvest: true },
        INTEL_TIMEOUT_MS,
      );
      intel = res?.intel ?? null;
    }
  }

  return {
    query: trimmed,
    results,
    instantAnswer: search?.instantAnswer ?? null,
    intel,
    elapsedMs: Date.now() - started,
  };
}

function ringLabel(ring: number): string {
  if (ring === 0) return "SEED";
  if (ring > 0) return `RING ${ring}`;
  return "UNPLACED";
}

/** Compact, citation-forcing evidence block. Empty string when nothing usable. */
export function formatZophielContext(bundle: ZophielBundle | null): string {
  if (!bundle || bundle.results.length === 0) return "";

  const lines: string[] = [];
  lines.push(
    `\n\n## ZOPHIEL SEARCH INTELLIGENCE (live, multi-engine)\nRetrieval substrate: Zophiel web engine — multiple independent indexes, tier-ranked (1 = authoritative registry/primary source, 5 = unverified/onion) with a veracity score per document. This is EVIDENCE. Prefer it over training data for anything current, and cite as [Title](URL).`,
  );

  if (bundle.instantAnswer) {
    lines.push(`\n### INSTANT ANSWER\n${String(bundle.instantAnswer).slice(0, 800)}`);
  }

  lines.push("\n### RANKED CORPUS");
  bundle.results.slice(0, MAX_CONTEXT_HITS).forEach((r, i) => {
    const meta = [
      r.tier != null ? `tier ${r.tier}` : null,
      r.veracity != null ? `veracity ${r.veracity}` : null,
      r.engine || null,
      r.publishDate || null,
      r.onion ? "onion (non-clickable)" : null,
    ].filter(Boolean).join(" · ");
    lines.push(
      `${i + 1}. **${(r.title || r.url).slice(0, 180)}**\n   URL: ${r.url}\n   ${meta ? `[${meta}]\n   ` : ""}${(r.snippet || "").slice(0, 600)}`,
    );
  });

  const intel = bundle.intel;
  if (intel) {
    const c = intel.coverage;
    lines.push(
      `\n### XKEYSCORE GRAPH LAYER (deterministic — extracted from harvested page bodies, no inference)\nCoverage: ${c.documents} documents · ${c.bodiesParsed} full bodies · ${c.snippetOnly} snippet-only · ${c.domains} distinct domains · rings ${c.ring1}/${c.ring2}/${c.ring3}`,
    );

    const ranked = intel.entities
      .filter((e) => e.ring >= 0 && e.confidence >= 0.25)
      .sort((a, b) => (b.ring === 0 ? 1 : 0) - (a.ring === 0 ? 1 : 0) || b.confidence - a.confidence)
      .slice(0, 40);
    if (ranked.length) {
      lines.push("\n**Entities (label · kind · ring · corroborating domains · confidence):**");
      for (const e of ranked) {
        lines.push(
          `- ${e.label} · ${e.kind} · ${ringLabel(e.ring)} · ${e.domains.slice(0, 4).join(", ") || "—"} (${e.domains.length} domain${e.domains.length === 1 ? "" : "s"}, ${e.mentions} doc${e.mentions === 1 ? "" : "s"}) · conf ${e.confidence.toFixed(2)}`,
        );
      }
    }

    const byId = new Map(intel.entities.map((e) => [e.id, e.label]));
    const links = intel.edges
      .filter((e) => e.domains >= 2 || e.kind !== "co-occurrence")
      .sort((a, b) => b.domains - a.domains || b.weight - a.weight)
      .slice(0, 30);
    if (links.length) {
      lines.push("\n**Links (only those corroborated by 2+ domains or by a structural identity join):**");
      for (const l of links) {
        lines.push(
          `- ${byId.get(l.from) ?? l.from} ↔ ${byId.get(l.to) ?? l.to} · ${l.kind} · ${l.domains} domains / ${l.weight} docs · e.g. ${l.sources[0] ?? "—"}`,
        );
      }
    }

    if (intel.identities.length) {
      lines.push("\n**Identity resolution (structural joins, with the basis stated):**");
      for (const id of intel.identities.slice(0, 12)) {
        lines.push(
          `- ${id.label} = ${id.members.map((m) => `${m.label} (${m.kind})`).join(" + ")} — basis: ${id.basis.join("; ")} · conf ${id.confidence.toFixed(2)}`,
        );
      }
    }

    if (intel.timeline.length) {
      lines.push("\n**Timeline (dates observed in the corpus):**");
      for (const t of intel.timeline.slice(0, 20)) {
        lines.push(`- ${t.iso} — ${t.label.slice(0, 160)} (${t.domain})`);
      }
    }

    if (intel.exposure.length) {
      lines.push("\n**Exposure surface (source-classified, not asserted):**");
      for (const x of intel.exposure.slice(0, 15)) {
        lines.push(`- [${x.kind}] ${x.domain} — ${x.title.slice(0, 120)} — ${x.url}`);
      }
    }
  }

  lines.push(
    `\n### EVIDENCE RULES FOR THIS TURN\n- Report only what the corpus above supports; attach the URL to every specific claim.\n- Weight by corroboration: a fact carried by 2+ distinct domains outranks a single tier-4/5 page. Say so when a claim rests on one source.\n- Ring 3 nodes are intersection-only candidates — label them as leads, never as established facts.\n- If the corpus does not answer part of the question, state the gap explicitly instead of filling it from training data.\n- Never present an entity, link, date or exposure signal that does not appear above.`,
  );

  return lines.join("\n");
}
