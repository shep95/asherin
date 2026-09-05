// shepherd — evidence reasoning engine.
//
// Nothing in this file describes a search result. Everything here describes a
// node in a graph of evidence, its origin, and how much weight that origin is
// allowed to carry. Weight is earned by independent corroboration, never by
// the reputation of whoever produced the value first.

/** Source reliability tiers. Permanent, assigned before a source is queried. */
export type Tier = 1 | 2 | 3 | 4;

export type TokenType =
  | "name"
  | "partial-name"
  | "geo"
  | "age"
  | "handle"
  | "email"
  | "phone"
  | "address"
  | "org"
  | "keyword";

/** Higher precision = stronger discriminator between two people. */
export type GeoPrecision = "state" | "county" | "city" | "street";

/** The controlled certainty vocabulary. Enforced at the data layer. */
export type Certainty = "confirmed" | "corroborated" | "inferred" | "estimated" | "conditional";

export type CorroborationKind = "identical" | "consistent" | "non-contradicting";

export interface CorroborationEvent {
  kind: CorroborationKind;
  /** Token that arrived at the same conclusion down a different path. */
  withTokenId: string;
  /** Weight added by this event, after ceiling clamping. */
  lift: number;
  note: string;
}

export interface Token {
  id: string;
  type: TokenType;
  /** Display value. Normalised value lives on `key`. */
  value: string;
  /** Normalised comparison key — corroboration matches on this, not on value. */
  key: string;
  /** null for seed tokens: the analyst asserted them, nothing verified them. */
  originTier: Tier | null;
  originSourceId: string;
  originSourceName: string;
  /** Upstream tokens this token was derived from. Empty for seed + anchor. */
  parents: string[];
  weight: number;
  corroborations: CorroborationEvent[];
  conflicts: string[];
  precision?: GeoPrecision;
  /** Traversal layer that produced it: 0 = seed. */
  layer: 0 | 1 | 2 | 3 | 4;
  note?: string;
}

export type FindingCategory =
  | "identity"
  | "location"
  | "communications"
  | "platforms"
  | "government"
  | "network"
  | "breach"
  | "timeline";

export interface DependencyNotice {
  throughTokenId: string;
  throughLabel: string;
  weight: number;
  resolvedBy: string;
  ifWrong: string;
}

export interface Finding {
  id: string;
  category: FindingCategory;
  label: string;
  detail: string;
  url?: string;
  sourceId: string;
  sourceName: string;
  tier: Tier;
  tokenId: string;
  /** Full dependency path, seed-most first. */
  chain: string[];
  /** Product of every weight along the chain. */
  joint: number;
  certainty: Certainty;
  notice?: DependencyNotice;
  /** True while any token on the chain sits in conflict state. */
  unresolvable: boolean;
  candidateId?: string;
}

export interface AbsenceToken {
  sourceId: string;
  sourceName: string;
  tier: Tier;
  query: string;
  meaning: string;
}

export interface ConflictEntry {
  id: string;
  tokenType: TokenType;
  left: { value: string; sourceName: string; tier: Tier };
  right: { value: string; sourceName: string; tier: Tier };
  resolvedBy: string;
}

export type SourceState =
  | "idle"
  | "queued"
  | "querying"
  | "returned"
  | "null"
  | "rate-limited"
  | "failed"
  | "not-connected"
  | "blocked";

export interface SourceRun {
  id: string;
  name: string;
  tier: Tier;
  layer: 1 | 2 | 3 | 4;
  state: SourceState;
  hits: number;
  ms: number;
  detail: string;
}

export interface AnchorCandidate {
  id: string;
  label: string;
  /** Discriminating geography that separates this candidate from the others. */
  geo?: string;
  sourceName: string;
  tier: Tier;
  url?: string;
  snippet: string;
  tokens: Token[];
}

export type AnchorState = "pending" | "no-anchor" | "anchored" | "split" | "conflict";

export interface AnchorResult {
  state: AnchorState;
  confidence: number;
  candidates: AnchorCandidate[];
  accepted?: AnchorCandidate;
  /** Token types present in every candidate — they cannot separate anyone. */
  nonDiscriminating: string[];
  /** Ranked by discriminating power, not by ease of collection. */
  wouldResolve: string[];
  note: string;
}

export interface TimelineEvent {
  id: string;
  when: string;
  label: string;
  evidence: "observed" | "recorded" | "estimated";
  sourceName: string;
  tier: Tier;
}

/** The whole output. Shepherd produces this object, never a report. */
export interface EvidenceObject {
  seed: Token[];
  anchor: AnchorResult;
  tokens: Token[];
  findings: Finding[];
  absences: AbsenceToken[];
  conflicts: ConflictEntry[];
  timeline: TimelineEvent[];
  sources: SourceRun[];
  /** Set when the anchor gate ended in split identity state. */
  candidates: AnchorCandidate[];
  startedAt: number;
  finishedAt?: number;
  refusals: string[];
}
