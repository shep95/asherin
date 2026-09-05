// shepherd — the traversal engine.
//
// Order is not a matter of taste. T1 fires first so that when T4 arrives the
// analyst can see whether an aggregator added anything or merely echoed the
// government record it scraped in the first place. Circular corroboration is
// the failure mode this ordering exists to prevent.

import { supabase } from "@/integrations/supabase/client";
import {
  TIER_BIRTH_WEIGHT,
  REFUSALS,
  absence,
  buildFinding,
  ceilingFor,
  clamp01,
  corroborate,
  corroborationCount,
  openConflict,
} from "./engine";
import { parseSeed, strongestGeo, titleCase, type SeedMap } from "./seed";
import { SOURCES, matchesSource, sourcesForLayer, hostOf, type SourceDef } from "./sources";
import type {
  AnchorCandidate,
  AnchorResult,
  ConflictEntry,
  EvidenceObject,
  Finding,
  FindingCategory,
  Tier,
  TimelineEvent,
  Token,
  TokenType,
} from "./types";

interface Hit {
  title: string;
  url: string;
  snippet: string;
  source?: string;
  publishDate?: string;
}

/** Politeness spacing between wire queries. Rate limits are respected, not raced. */
const SPACING_MS = 900;

const CATEGORY_BY_SOURCE: Record<string, FindingCategory> = {
  "fl-voter": "government",
  courts: "government",
  pacer: "government",
  sunbiz: "government",
  fec: "government",
  property: "location",
  usaspending: "government",
  archive: "timeline",
  "paste-index": "breach",
  "breach-mention": "breach",
  keybase: "communications",
  github: "platforms",
  reddit: "platforms",
  x: "platforms",
  instagram: "platforms",
  linkedin: "network",
  steam: "platforms",
  twitch: "platforms",
};

let nseq = 0;
function nid(prefix: string): string {
  nseq += 1;
  return `${prefix}-${nseq}-${Math.random().toString(36).slice(2, 6)}`;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

async function wireQuery(query: string, signal?: AbortSignal): Promise<Hit[]> {
  const { data, error } = await supabase.functions.invoke("zophiel-search", {
    body: { query, max_pages: 8, max_depth: 1 },
  });
  if (signal?.aborted) throw new DOMException("aborted", "AbortError");
  if (error) throw new Error(error.message || "retrieval layer refused the query");
  const rows = (data as { success?: boolean; results?: Hit[] })?.results ?? [];
  return rows.filter((r) => !!r?.url);
}

/* ── value extraction ─────────────────────────────────────────────────── */

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]{2,}/g;
const PHONE_RE = /\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const COUNTY_RE = /\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+County\b/g;

function handleFromUrl(url: string, def: SourceDef): string | null {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean);
    if (!seg.length) return null;
    if (def.id === "reddit") {
      const i = seg.indexOf("user");
      return i >= 0 ? (seg[i + 1] ?? null) : null;
    }
    if (def.id === "github" || def.id === "x" || def.id === "instagram" || def.id === "twitch") {
      const bad = new Set(["search", "explore", "topics", "orgs", "about", "p", "reel", "i", "hashtag"]);
      return bad.has(seg[0]) ? null : seg[0];
    }
    if (def.id === "steam") return seg[0] === "id" || seg[0] === "profiles" ? (seg[1] ?? null) : null;
    if (def.id === "keybase") return seg[0] ?? null;
    return null;
  } catch {
    return null;
  }
}

/* ── the run ──────────────────────────────────────────────────────────── */

export interface TraversalOptions {
  /** Called on every material change so the UI can show collection live. */
  onUpdate: (evidence: EvidenceObject) => void;
  signal?: AbortSignal;
  /** Run both candidate graphs when the anchor gate splits. Output stays partitioned. */
  parallelCandidates?: boolean;
}

export async function runTraversal(rawQuery: string, opts: TraversalOptions): Promise<EvidenceObject> {
  const seed: SeedMap = parseSeed(rawQuery);
  const byId = new Map<string, Token>();
  for (const t of seed.tokens) byId.set(t.id, t);

  const sources = SOURCES.map((s) => ({
    id: s.id,
    name: s.name,
    tier: s.tier,
    layer: s.layer,
    state: (s.connected ? "queued" : "not-connected") as EvidenceObject["sources"][number]["state"],
    hits: 0,
    ms: 0,
    detail: s.connected ? "" : (s.note ?? "not wired into this deployment"),
  }));

  const ev: EvidenceObject = {
    seed: seed.tokens,
    anchor: {
      state: "pending",
      confidence: 0,
      candidates: [],
      nonDiscriminating: [],
      wouldResolve: seed.discriminators,
      note: "the anchor gate has not completed. no traversal beyond T1 is permitted.",
    },
    tokens: [...seed.tokens],
    findings: [],
    absences: [],
    conflicts: [],
    timeline: [],
    sources,
    candidates: [],
    startedAt: Date.now(),
    refusals: REFUSALS,
  };
  const emit = () => opts.onUpdate({ ...ev, tokens: [...ev.tokens], sources: [...ev.sources] });
  emit();

  const nameToken = seed.names[0];
  if (!nameToken) {
    ev.anchor = {
      state: "no-anchor",
      confidence: 0,
      candidates: [],
      nonDiscriminating: [],
      wouldResolve: ["a full personal name of at least two parts", ...seed.discriminators],
      note: "the seed produced no name token. the anchor gate cannot fire.",
    };
    ev.finishedAt = Date.now();
    emit();
    return ev;
  }

  const geo = strongestGeo(seed);
  const geoWire = geo ? geo.value : undefined;
  const seenUrls = new Set<string>();

  const patch = (id: string, next: Partial<EvidenceObject["sources"][number]>) => {
    const i = ev.sources.findIndex((s) => s.id === id);
    if (i >= 0) ev.sources[i] = { ...ev.sources[i], ...next };
  };

  const addToken = (
    type: TokenType,
    value: string,
    key: string,
    def: SourceDef,
    parents: string[],
    layer: 1 | 2 | 3 | 4,
    extra: Partial<Token> = {},
  ): Token => {
    const existing = ev.tokens.find((t) => t.key === key && t.type === type && t.originSourceId === def.id);
    if (existing) return existing;
    const tok: Token = {
      id: nid(`t-${type}`),
      type,
      value,
      key,
      originTier: def.tier,
      originSourceId: def.id,
      originSourceName: def.name,
      parents,
      weight: Math.min(ceilingFor(def.tier), TIER_BIRTH_WEIGHT[def.tier]),
      corroborations: [],
      conflicts: [],
      layer,
      ...extra,
    };
    ev.tokens.push(tok);
    byId.set(tok.id, tok);
    return tok;
  };

  /** Cross-path agreement. Never inside one origin source, never downstream. */
  const settleCorroboration = () => {
    const groups = new Map<string, Token[]>();
    for (const t of ev.tokens) {
      const k = `${t.type}:${t.key}`;
      groups.set(k, [...(groups.get(k) ?? []), t]);
    }
    for (const list of groups.values()) {
      for (const a of list) {
        for (const b of list) {
          if (a.originSourceId === b.originSourceId) continue;
          corroborate(a, b, "identical", byId);
        }
      }
    }
    // hierarchical consistency: a county inside the asserted state is expected,
    // not surprising, so it lifts only a little.
    const geoTokens = ev.tokens.filter((t) => t.type === "geo");
    for (const a of geoTokens) {
      for (const b of geoTokens) {
        if (a.id === b.id || a.key === b.key) continue;
        if (a.originSourceId === b.originSourceId) continue;
        if (a.precision === "county" && b.precision === "state") corroborate(a, b, "consistent", byId);
      }
    }
    // contradiction: two independent counties cannot both be the residence.
    const counties = geoTokens.filter((t) => t.precision === "county");
    for (let i = 0; i < counties.length; i += 1) {
      for (let j = i + 1; j < counties.length; j += 1) {
        const a = counties[i];
        const b = counties[j];
        if (a.key === b.key || a.originSourceId === b.originSourceId) continue;
        if (a.conflicts.includes(b.id)) continue;
        ev.conflicts.push(
          openConflict(a, b, "a T1 record dated after both, or an analyst judgement on which is current"),
        );
      }
    }
  };

  const ingest = (def: SourceDef, hits: Hit[], parentTokenId: string, layer: 1 | 2 | 3 | 4, candidateId?: string) => {
    for (const h of hits) {
      if (seenUrls.has(h.url)) continue;
      seenUrls.add(h.url);
      const host = hostOf(h.url);
      const blob = `${h.title} ${h.snippet}`;

      const anchorTok = addToken(
        "keyword",
        `${def.name} record`,
        `record:${def.id}:${host}:${h.url.slice(-24)}`,
        def,
        [parentTokenId],
        layer,
        { note: h.title.slice(0, 160) },
      );

      for (const m of blob.match(EMAIL_RE) ?? [])
        addToken("email", m, m.toLowerCase(), def, [anchorTok.id], layer);
      for (const m of blob.match(PHONE_RE) ?? []) {
        const digits = m.replace(/\D/g, "");
        if (digits.length === 10) addToken("phone", m, digits, def, [anchorTok.id], layer);
      }
      for (const m of blob.matchAll(COUNTY_RE))
        addToken("geo", titleCase(m[0]), `county:${m[0].toLowerCase()}`, def, [anchorTok.id], layer, {
          precision: "county",
        });
      const handle = handleFromUrl(h.url, def);
      if (handle) addToken("handle", handle, handle.toLowerCase(), def, [anchorTok.id], layer);

      ev.findings.push(
        buildFinding({
          id: nid("f"),
          category: CATEGORY_BY_SOURCE[def.id] ?? (def.tier === 4 ? "identity" : "network"),
          label: h.title.slice(0, 140) || host,
          detail: h.snippet.slice(0, 320),
          url: h.url,
          sourceId: def.id,
          sourceName: def.name,
          tier: def.tier,
          tokenId: anchorTok.id,
          byId,
          candidateId,
        }),
      );

      if (h.publishDate) {
        ev.timeline.push({
          id: nid("tl"),
          when: h.publishDate,
          label: h.title.slice(0, 110) || host,
          evidence: "observed",
          sourceName: def.name,
          tier: def.tier,
        });
      }
    }
  };

  const runSource = async (
    def: SourceDef,
    value: string,
    parentTokenId: string,
    layer: 1 | 2 | 3 | 4,
    candidateId?: string,
  ) => {
    if (!def.connected) return;
    patch(def.id, { state: "querying", detail: "on the wire" });
    emit();
    const t0 = performance.now();
    try {
      const raw = await wireQuery(def.query(value, geoWire), opts.signal);
      const hits = raw.filter((r) => matchesSource(r.url, def));
      const ms = Math.round(performance.now() - t0);
      if (!hits.length) {
        patch(def.id, { state: "null", ms, hits: 0, detail: "no matching record in this index" });
        ev.absences.push(absence(def.id, def.name, def.tier, def.query(value, geoWire)));
      } else {
        ingest(def, hits, parentTokenId, layer, candidateId);
        patch(def.id, { state: "returned", ms, hits: hits.length, detail: `${hits.length} record(s)` });
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      const ms = Math.round(performance.now() - t0);
      const msg = (e as Error).message ?? "failed";
      const limited = /429|rate|quota/i.test(msg);
      patch(def.id, {
        state: limited ? "rate-limited" : "failed",
        ms,
        detail: limited ? "rate limit window — no null recorded" : msg.slice(0, 120),
      });
    }
    emit();
    await sleep(SPACING_MS, opts.signal);
  };

  /* ── layer 1 — the anchor gate ─────────────────────────────────────── */
  for (const def of sourcesForLayer(1)) {
    if (!def.accepts.includes("name")) continue;
    await runSource(def, nameToken.value, nameToken.id, 1);
  }
  settleCorroboration();

  const t1Findings = ev.findings.filter((f) => f.tier === 1);
  const candidates = buildCandidates(t1Findings, ev.tokens, nameToken.value);
  ev.candidates = candidates;
  ev.anchor = decideAnchor(candidates, seed, ev.conflicts);
  emit();

  if (ev.anchor.state === "no-anchor" || ev.anchor.state === "conflict") {
    ev.finishedAt = Date.now();
    for (const s of ev.sources) if (s.state === "queued") patch(s.id, { state: "blocked", detail: "anchor gate did not pass" });
    emit();
    return ev;
  }

  const split = ev.anchor.state === "split";
  if (split && !opts.parallelCandidates) {
    for (const s of ev.sources)
      if (s.state === "queued")
        patch(s.id, { state: "blocked", detail: "split identity state — awaiting a discriminating token" });
    ev.finishedAt = Date.now();
    emit();
    return ev;
  }

  const tracks: Array<{ candidate?: AnchorCandidate; rootId: string }> = split
    ? candidates.map((c) => ({ candidate: c, rootId: c.tokens[0]?.id ?? nameToken.id }))
    : [{ candidate: ev.anchor.accepted, rootId: ev.anchor.accepted?.tokens[0]?.id ?? nameToken.id }];

  /* ── layer 2 — passive technical probes ────────────────────────────── */
  for (const track of tracks) {
    const laterals = [
      ...ev.tokens.filter((t) => t.type === "email" || t.type === "handle"),
      ...seed.handles,
    ];
    for (const def of sourcesForLayer(2)) {
      if (!def.connected) continue;
      const input =
        laterals.find((t) => def.accepts.includes(t.type)) ??
        (def.accepts.includes("name") ? nameToken : undefined);
      if (!input) {
        patch(def.id, { state: "blocked", detail: "no eligible token of a type this source accepts" });
        continue;
      }
      await runSource(def, input.value, input.id, 2, track.candidate?.id);
    }
  }
  settleCorroboration();
  emit();

  /* ── layer 3 — gated on a genuine corroboration event ──────────────── */
  const corroboratedExists = ev.tokens.some(
    (t) => t.layer >= 1 && t.layer <= 2 && corroborationCount(t, byId) >= 2,
  );
  if (!corroboratedExists) {
    for (const def of sourcesForLayer(3))
      patch(def.id, {
        state: "blocked",
        detail: "layer 3 requires a corroborated token from layer 2 — one source agreeing with itself is not one",
      });
    emit();
  } else {
    for (const track of tracks) {
      for (const def of sourcesForLayer(3)) {
        const input =
          ev.tokens.find((t) => t.type === "handle" && def.accepts.includes("handle")) ??
          (def.accepts.includes("name") ? nameToken : undefined);
        if (!input) {
          patch(def.id, { state: "blocked", detail: "no handle token exists to enumerate with" });
          continue;
        }
        await runSource(def, input.value, input.id, 3, track.candidate?.id);
      }
    }
    settleCorroboration();
  }

  /* ── layer 4 — aggregators, always last, provisional bucket ────────── */
  for (const track of tracks) {
    for (const def of sourcesForLayer(4)) {
      await runSource(def, nameToken.value, nameToken.id, 4, track.candidate?.id);
    }
  }
  settleCorroboration();

  // Non-additive T4 pass: an aggregator repeating a value the graph already
  // holds from a higher tier raises nothing. Say so on the finding.
  for (const f of ev.findings) {
    if (f.tier !== 4) continue;
    const tok = byId.get(f.tokenId);
    if (!tok) continue;
    const echoed = ev.tokens.some(
      (t) => t.originTier !== null && t.originTier < 4 && t.type === "geo" && f.detail.toLowerCase().includes(t.value.toLowerCase()),
    );
    if (echoed) f.detail = `${f.detail}\n\nnon-additive — this value is already held from a higher tier. it does not raise confidence.`;
  }

  // Recompute every finding's joint confidence against the settled graph.
  ev.findings = ev.findings.map((f) =>
    buildFinding({
      id: f.id,
      category: f.category,
      label: f.label,
      detail: f.detail,
      url: f.url,
      sourceId: f.sourceId,
      sourceName: f.sourceName,
      tier: f.tier,
      tokenId: f.tokenId,
      byId,
      candidateId: f.candidateId,
    }),
  );

  ev.anchor = { ...ev.anchor, confidence: anchorConfidence(ev.anchor, ev.tokens, byId) };
  ev.finishedAt = Date.now();
  for (const s of ev.sources) if (s.state === "queued") patch(s.id, { state: "idle", detail: "not reached" });
  emit();
  return ev;
}

/* ── the anchor gate ──────────────────────────────────────────────────── */

function buildCandidates(t1: Finding[], tokens: Token[], name: string): AnchorCandidate[] {
  const byGeo = new Map<string, AnchorCandidate>();
  for (const f of t1) {
    const blob = `${f.label} ${f.detail}`;
    if (!looksLikeSubject(blob, name)) continue;
    const county = blob.match(/\b([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)\s+County\b/)?.[0];
    const key = (county ?? "unspecified geography").toLowerCase();
    const existing = byGeo.get(key);
    const tok = tokens.find((t) => t.id === f.tokenId);
    if (existing) {
      if (tok) existing.tokens.push(tok);
      continue;
    }
    byGeo.set(key, {
      id: `cand-${byGeo.size + 1}`,
      label: `${name} — ${county ?? "geography not stated in record"}`,
      geo: county,
      sourceName: f.sourceName,
      tier: f.tier,
      url: f.url,
      snippet: f.detail.slice(0, 240),
      tokens: tok ? [tok] : [],
    });
  }
  return Array.from(byGeo.values());
}

function looksLikeSubject(blob: string, name: string): boolean {
  const parts = name.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
  if (!parts.length) return false;
  const lower = blob.toLowerCase();
  const hits = parts.filter((p) => lower.includes(p)).length;
  return hits >= Math.min(2, parts.length);
}

function decideAnchor(candidates: AnchorCandidate[], seed: SeedMap, conflicts: ConflictEntry[]): AnchorResult {
  if (!candidates.length) {
    return {
      state: "no-anchor",
      confidence: 0,
      candidates: [],
      nonDiscriminating: [],
      wouldResolve: seed.discriminators,
      note: "no T1 record matched the name and age tokens. traversal terminates here. refine the seed — nothing below T1 is permitted to establish identity.",
    };
  }
  if (candidates.length === 1) {
    return {
      state: "anchored",
      confidence: 0.62,
      candidates,
      accepted: candidates[0],
      nonDiscriminating: [],
      wouldResolve: seed.discriminators,
      note: "uniqueness check passed on one T1 record. that record is the identity anchor and traversal may proceed.",
    };
  }
  const shared = ["name", ...(seed.geo.length ? ["state-level geography"] : []), ...(seed.ages.length ? ["age range"] : [])];
  return {
    state: conflicts.length ? "conflict" : "split",
    confidence: 0.24,
    candidates,
    nonDiscriminating: shared,
    wouldResolve: seed.discriminators,
    note: `${candidates.length} T1 records match the seed. these are different people until proven otherwise. candidate graphs are isolated at the data layer and no combined confidence is produced.`,
  };
}

function anchorConfidence(anchor: AnchorResult, tokens: Token[], byId: Map<string, Token>): number {
  if (anchor.state !== "anchored" || !anchor.accepted) return anchor.confidence;
  const anchorTokens = anchor.accepted.tokens;
  const lifted = anchorTokens.filter((t) => corroborationCount(t, byId) >= 2).length;
  const base = 0.62 + lifted * 0.08;
  return clamp01(Math.min(0.95, Number(base.toFixed(2))));
}

export const __test = { buildCandidates, decideAnchor, looksLikeSubject };
