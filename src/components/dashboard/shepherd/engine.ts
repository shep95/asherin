// shepherd — the weight rules.
//
// Five rules, none of which a source may opt out of:
//   1. origin typing      — a token carries its birth tier forever
//   2. ceiling by tier    — agreement inside a tier cannot break that tier's roof
//   3. no child corroborates parent — downstream agreement is an echo
//   4. typed corroboration — identical > consistent > non-contradicting
//   5. conflicts stay open — the higher tier does not silently win

import type {
  AbsenceToken,
  Certainty,
  ConflictEntry,
  CorroborationKind,
  DependencyNotice,
  Finding,
  Tier,
  Token,
} from "./types";

/** Maximum weight any token born in a tier may ever reach. */
export const TIER_CEILING: Record<Tier, number> = {
  1: 0.95, // government records contain errors too
  2: 0.8, // enumeration false positives, ownership gap on email probes
  3: 0.55, // curated personas, shared handles
  4: 0.3, // circular sourcing, record-merge errors
};

/** Opening weight a token gets from the source that first produced it. */
export const TIER_BIRTH_WEIGHT: Record<Tier, number> = { 1: 0.72, 2: 0.5, 3: 0.34, 4: 0.18 };

/** Seed tokens are assertions by the analyst. Provisional, never confirmed. */
export const SEED_WEIGHT = 0.4;

export const LIFT: Record<CorroborationKind, number> = {
  identical: 0.22,
  consistent: 0.09,
  "non-contradicting": 0.03,
};

export const TIER_LABEL: Record<Tier, string> = {
  1: "T1 government primary",
  2: "T2 passive technical",
  3: "T3 social enumeration",
  4: "T4 aggregator",
};

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function ceilingFor(tier: Tier | null): number {
  return tier === null ? 0.5 : TIER_CEILING[tier];
}

/** Rule 3 — a token may not be corroborated by anything downstream of it. */
export function isDownstream(candidateId: string, ofId: string, byId: Map<string, Token>): boolean {
  const seen = new Set<string>();
  const walk = (id: string): boolean => {
    if (seen.has(id)) return false;
    seen.add(id);
    const t = byId.get(id);
    if (!t) return false;
    if (t.parents.includes(ofId)) return true;
    return t.parents.some(walk);
  };
  return walk(candidateId);
}

/** Apply a corroboration event, clamped by the receiving token's tier ceiling. */
export function corroborate(
  token: Token,
  withToken: Token,
  kind: CorroborationKind,
  byId: Map<string, Token>,
): boolean {
  if (token.id === withToken.id) return false;
  if (isDownstream(withToken.id, token.id, byId)) return false; // rule 3
  if (token.corroborations.some((c) => c.withTokenId === withToken.id)) return false;
  const ceiling = ceilingFor(token.originTier);
  const before = token.weight;
  const lift = LIFT[kind];
  token.weight = Math.min(ceiling, clamp01(token.weight + (1 - token.weight) * lift * 2.2));
  token.corroborations.push({
    kind,
    withTokenId: withToken.id,
    lift: Number((token.weight - before).toFixed(4)),
    note: `${kind} match with ${withToken.originSourceName} (${TIER_LABEL[withToken.originTier ?? 4]})`,
  });
  return true;
}

/** Distinct origin sources that back a token, itself included. */
export function corroborationCount(token: Token, byId: Map<string, Token>): number {
  const sources = new Set<string>([token.originSourceId]);
  for (const c of token.corroborations) {
    const other = byId.get(c.withTokenId);
    if (other) sources.add(other.originSourceId);
  }
  return sources.size;
}

/** Seed-most-first dependency path for a token. */
export function chainFor(tokenId: string, byId: Map<string, Token>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const t = byId.get(id);
    if (!t) return;
    for (const p of t.parents) walk(p);
    out.push(id);
  };
  walk(tokenId);
  return out;
}

/** Rule: joint confidence is the product of every weight along the chain. */
export function jointConfidence(chain: string[], byId: Map<string, Token>): number {
  let j = 1;
  for (const id of chain) {
    const t = byId.get(id);
    if (!t) continue;
    j *= t.weight;
  }
  return clamp01(Number(j.toFixed(4)));
}

export function chainHasConflict(chain: string[], byId: Map<string, Token>): boolean {
  return chain.some((id) => (byId.get(id)?.conflicts.length ?? 0) > 0);
}

/**
 * Certainty classification. Type integrity is enforced here: a finding can
 * never be shown as confirmed if anything upstream of it is unconfirmed.
 */
export function classify(
  tier: Tier,
  chain: string[],
  byId: Map<string, Token>,
  opts: { inferred?: boolean; estimated?: boolean } = {},
): Certainty {
  if (opts.estimated) return "estimated";
  const nodes = chain.map((id) => byId.get(id)).filter(Boolean) as Token[];
  const head = nodes[nodes.length - 1];
  const upstream = nodes.slice(0, -1);
  const fragile = upstream.some((t) => t.originTier === null || t.weight < 0.5 || t.conflicts.length > 0);
  if (fragile) return "conditional";
  if (opts.inferred) return "inferred";
  const independent = head ? corroborationCount(head, byId) : 1;
  if (independent >= 2 && (head?.originTier ?? 4) <= 2) return "corroborated";
  if (tier === 1 && !fragile) return "confirmed";
  if (independent >= 2) return "corroborated";
  return "conditional";
}

/** Every finding that flows through an unconfirmed node says so on itself. */
export function noticeFor(chain: string[], byId: Map<string, Token>): DependencyNotice | undefined {
  const weakest = chain
    .map((id) => byId.get(id))
    .filter((t): t is Token => !!t)
    .filter((t) => t.weight < 0.6 || t.originTier === null)
    .sort((a, b) => a.weight - b.weight)[0];
  if (!weakest) return undefined;
  return {
    throughTokenId: weakest.id,
    throughLabel: `${weakest.type}: ${weakest.value}`,
    weight: Number(weakest.weight.toFixed(2)),
    resolvedBy:
      weakest.originTier === null
        ? "a T1 record returning this same value independently"
        : `a second independent path returning ${weakest.value}`,
    ifWrong: "this finding belongs to a different individual and must be discarded entirely",
  };
}

export function buildFinding(input: {
  id: string;
  category: Finding["category"];
  label: string;
  detail: string;
  url?: string;
  sourceId: string;
  sourceName: string;
  tier: Tier;
  tokenId: string;
  byId: Map<string, Token>;
  inferred?: boolean;
  estimated?: boolean;
  candidateId?: string;
}): Finding {
  const chain = chainFor(input.tokenId, input.byId);
  const joint = jointConfidence(chain, input.byId);
  const unresolvable = chainHasConflict(chain, input.byId);
  const certainty = classify(input.tier, chain, input.byId, {
    inferred: input.inferred,
    estimated: input.estimated,
  });
  return {
    id: input.id,
    category: input.category,
    label: input.label,
    detail: input.detail,
    url: input.url,
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    tier: input.tier,
    tokenId: input.tokenId,
    chain,
    joint,
    certainty,
    notice: certainty === "conditional" ? noticeFor(chain, input.byId) : undefined,
    unresolvable,
    candidateId: input.candidateId,
  };
}

/** A null return is a finding. Its meaning is set by the tier that produced it. */
export function absence(sourceId: string, sourceName: string, tier: Tier, query: string): AbsenceToken {
  const meaning =
    tier === 1
      ? "confirmed absence — a maintained government index was searched and held no matching record"
      : tier === 2
        ? "probable absence — a live technical index returned nothing; coverage gaps are possible"
        : tier === 3
          ? "weak absence — platform visibility is partial and scraping blocks are common"
          : "not meaningful — aggregator coverage gaps explain absence at least as well as the subject does";
  return { sourceId, sourceName, tier, query, meaning };
}

export function openConflict(
  a: Token,
  b: Token,
  resolvedBy: string,
): ConflictEntry {
  a.conflicts.push(b.id);
  b.conflicts.push(a.id);
  return {
    id: `${a.id}~${b.id}`,
    tokenType: a.type,
    left: { value: a.value, sourceName: a.originSourceName, tier: a.originTier ?? 4 },
    right: { value: b.value, sourceName: b.originSourceName, tier: b.originTier ?? 4 },
    resolvedBy,
  };
}

/** Conclusions shepherd refuses to produce, whatever the data looks like. */
export const REFUSALS: string[] = [
  "no opsec-awareness judgement is produced. a visible identity layer cannot be distinguished from an unaware one by passive collection.",
  "no clearance, safety or no-concern conclusion is produced. clean records are absence tokens over queried systems only.",
  "no breach, platform or associate finding is attributed without its dependency chain shown on the finding itself.",
  "no single summary confidence number is produced. anchor confidence and per-finding chains never merge.",
];
