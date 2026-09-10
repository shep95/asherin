import { describe, expect, it } from "vitest";

import { classifySource, countIndependentPublishers, strongerTier } from "../authority";
import { assessClaim, assessStaleness, isPromotableToFact } from "../confidence";
import { detectContradictions, resolveByAuthority } from "../contradictions";
import { detectGaps, nextBestHops, shouldContinueLoop } from "../hops";
import { canonicalize, decideResolution, findCandidates } from "../resolve";
import { buildGroundingContext, isResearchRequest, parseCommand } from "../intent";
import type {
  Claim,
  Entity,
  Evidence,
  Identifier,
  Investigation,
  InvestigationSnapshot,
  Source,
} from "../types";
import { EMPTY_SNAPSHOT_PARTS } from "../types";

const T0 = "2024-01-01T00:00:00.000Z";

function entity(over: Partial<Entity> & { id: string; label: string }): Entity {
  return {
    investigationId: "inv",
    kind: "company",
    canonical: canonicalize(over.kind ?? "company", over.label),
    aliases: [],
    attributes: {},
    resolutionState: "candidate",
    mergedInto: null,
    confidence: 0.4,
    origin: "public_record",
    firstSeen: T0,
    lastSeen: T0,
    ...over,
  } as Entity;
}

function source(over: Partial<Source> & { id: string }): Source {
  return {
    investigationId: "inv",
    url: null,
    title: "source",
    sourceType: "web_page",
    publisher: null,
    provider: null,
    publishedAt: null,
    retrievedAt: T0,
    authorityTier: 4,
    authorityReason: null,
    searchRank: null,
    createdAt: T0,
    ...over,
  } as Source;
}

function claim(over: Partial<Claim> & { id: string; statement: string }): Claim {
  return {
    investigationId: "inv",
    subjectEntityId: "e1",
    predicate: "WORKS_AT",
    objectEntityId: null,
    objectValue: null,
    claimKind: "observation",
    status: "unresolved",
    origin: "public_record",
    validFrom: null,
    validTo: null,
    volatility: "slow",
    confidence: 0.3,
    confidenceReason: null,
    lastVerifiedAt: T0,
    createdAt: T0,
    updatedAt: T0,
    ...over,
  } as Claim;
}

function evidence(over: Partial<Evidence> & { id: string; claimId: string }): Evidence {
  return {
    investigationId: "inv",
    sourceId: null,
    documentId: null,
    stance: "supports",
    excerpt: null,
    locator: null,
    authorityTier: 4,
    retrievedAt: T0,
    notes: null,
    createdAt: T0,
    ...over,
  } as Evidence;
}

function snapshot(parts: Partial<InvestigationSnapshot> = {}): InvestigationSnapshot {
  const investigation: Investigation = {
    id: "inv",
    userId: "u1",
    title: "Acme",
    question: "research acme holdings and figure out who owns it",
    status: "active",
    summary: null,
    conversationId: null,
    providerState: {},
    lastHopAt: null,
    createdAt: T0,
    updatedAt: T0,
  };
  return { ...EMPTY_SNAPSHOT_PARTS, investigation, ...parts };
}

// ── source authority ────────────────────────────────────────────────────────
describe("source authority", () => {
  it("ranks an official filing above a newsroom above a blog", () => {
    expect(classifySource("https://www.sec.gov/edgar/x").tier).toBe(1);
    expect(classifySource("https://www.reuters.com/a").tier).toBe(3);
    expect(classifySource("https://foo.medium.com/a").tier).toBe(4);
    expect(classifySource(null).tier).toBe(5);
  });

  it("treats authority as independent of search rank", () => {
    // A blog that ranked first is still tier 4; rank never enters the verdict.
    const blog = classifySource("https://example.substack.com/p/1");
    expect(blog.tier).toBe(4);
    expect(strongerTier(1, 4)).toBe(1);
  });

  it("counts independent publishers by host, not by row count", () => {
    const rows = [
      source({ id: "s1", url: "https://reuters.com/a" }),
      source({ id: "s2", url: "https://reuters.com/b" }),
      source({ id: "s3", url: "https://apnews.com/c" }),
    ];
    expect(countIndependentPublishers(rows)).toBe(2);
  });
});

// ── entity resolution ───────────────────────────────────────────────────────
describe("entity resolution", () => {
  const acme = entity({ id: "e1", label: "Acme Holdings Ltd" });
  const ids: Identifier[] = [
    { id: "i1", investigationId: "inv", entityId: "e1", kind: "company_number", value: "0123456", sourceId: null, createdAt: T0 },
  ];

  it("resolves on a shared strong identifier", () => {
    const d = decideResolution(
      { kind: "company", label: "Acme Holdings Limited", identifiers: [{ kind: "company_number", value: "0123456" }] },
      [acme],
      ids,
    );
    expect(d.action).toBe("merge");
    expect(d.entityId).toBe("e1");
  });

  it("keeps a similar name as a candidate rather than merging it", () => {
    // Same normalized name, no shared identifier — still only a candidate.
    const d = decideResolution({ kind: "company", label: "Acme Group" }, [acme], ids);
    expect(d.action).toBe("candidate");
    expect(d.entityId).toBeNull();
    expect(d.candidates[0].decisive).toBe(false);
  });

  it("never marks name similarity as decisive", () => {
    const cands = findCandidates({ kind: "company", label: "Acme Holdings" }, [acme], ids);
    expect(cands.every((c) => c.basis === "identifier" || !c.decisive)).toBe(true);
  });

  it("creates a new entity when nothing is comparable", () => {
    expect(decideResolution({ kind: "company", label: "Zenith Systems" }, [acme], ids).action).toBe("create");
  });
});

// ── evidence and confidence ─────────────────────────────────────────────────
describe("claim assessment", () => {
  it("does not promote an uncited claim to a fact", () => {
    const c = claim({ id: "c1", statement: "X owns Y" });
    const a = assessClaim({ claim: c, evidence: [evidence({ id: "ev1", claimId: "c1" })], sources: [] });
    expect(a.status).toBe("weak");
    expect(a.confidence).toBeLessThan(0.2);
    expect(isPromotableToFact(a)).toBe(false);
  });

  it("resolves a claim backed by a single official filing", () => {
    const c = claim({ id: "c1", statement: "X became CEO in 2022" });
    const s = source({ id: "s1", url: "https://sec.gov/f", authorityTier: 1 });
    const a = assessClaim({ claim: c, evidence: [evidence({ id: "ev1", claimId: "c1", sourceId: "s1", authorityTier: 1 })], sources: [s] });
    expect(a.status).toBe("resolved");
    expect(isPromotableToFact(a)).toBe(true);
  });

  it("keeps a single reported source unresolved", () => {
    const c = claim({ id: "c1", statement: "X owns Y" });
    const s = source({ id: "s1", url: "https://reuters.com/a", authorityTier: 3 });
    const a = assessClaim({ claim: c, evidence: [evidence({ id: "ev1", claimId: "c1", sourceId: "s1", authorityTier: 3 })], sources: [s] });
    expect(a.status).toBe("unresolved");
  });

  it("resolves on two independent reported sources", () => {
    const c = claim({ id: "c1", statement: "X owns Y" });
    const s1 = source({ id: "s1", url: "https://reuters.com/a", authorityTier: 3 });
    const s2 = source({ id: "s2", url: "https://apnews.com/b", authorityTier: 3 });
    const a = assessClaim({
      claim: c,
      evidence: [
        evidence({ id: "ev1", claimId: "c1", sourceId: "s1", authorityTier: 3 }),
        evidence({ id: "ev2", claimId: "c1", sourceId: "s2", authorityTier: 3 }),
      ],
      sources: [s1, s2],
    });
    expect(a.status).toBe("resolved");
    expect(a.independentSources).toBe(2);
  });

  it("marks a claim contradicted when the opposing source is stronger", () => {
    const c = claim({ id: "c1", statement: "X became CEO in 2023" });
    const weak = source({ id: "s1", url: "https://blog.medium.com/a", authorityTier: 4 });
    const strong = source({ id: "s2", url: "https://sec.gov/f", authorityTier: 1 });
    const a = assessClaim({
      claim: c,
      evidence: [
        evidence({ id: "ev1", claimId: "c1", sourceId: "s1", authorityTier: 4 }),
        evidence({ id: "ev2", claimId: "c1", sourceId: "s2", authorityTier: 1, stance: "contradicts" }),
      ],
      sources: [weak, strong],
    });
    expect(a.status).toBe("contradicted");
  });

  it("holds equal-authority disagreement unresolved instead of picking", () => {
    const c = claim({ id: "c1", statement: "X became CEO in 2023" });
    const s1 = source({ id: "s1", url: "https://reuters.com/a", authorityTier: 3 });
    const s2 = source({ id: "s2", url: "https://apnews.com/b", authorityTier: 3 });
    const a = assessClaim({
      claim: c,
      evidence: [
        evidence({ id: "ev1", claimId: "c1", sourceId: "s1", authorityTier: 3 }),
        evidence({ id: "ev2", claimId: "c1", sourceId: "s2", authorityTier: 3, stance: "contradicts" }),
      ],
      sources: [s1, s2],
    });
    expect(a.status).toBe("unresolved");
  });

  it("never resolves a hypothesis on corroboration alone", () => {
    const c = claim({ id: "c1", statement: "X may control Y", claimKind: "hypothesis" });
    const s = source({ id: "s1", url: "https://sec.gov/f", authorityTier: 1 });
    const a = assessClaim({ claim: c, evidence: [evidence({ id: "ev1", claimId: "c1", sourceId: "s1", authorityTier: 1 })], sources: [s] });
    expect(a.status).toBe("unresolved");
  });
});

describe("staleness", () => {
  it("never expires a static claim", () => {
    const c = claim({ id: "c1", statement: "founded 1998", volatility: "static" });
    expect(assessStaleness(c, [], Date.parse("2030-01-01")).stale).toBe(false);
  });

  it("marks a volatile claim stale past its window", () => {
    const c = claim({ id: "c1", statement: "X is CEO", volatility: "volatile", lastVerifiedAt: T0 });
    const s = assessStaleness(c, [], Date.parse("2024-09-01T00:00:00Z"));
    expect(s.stale).toBe(true);
    expect(s.reason).toMatch(/stale after 90/);
  });

  it("keeps a freshly verified volatile claim fresh", () => {
    const c = claim({ id: "c1", statement: "X is CEO", volatility: "volatile", lastVerifiedAt: T0 });
    expect(assessStaleness(c, [], Date.parse("2024-01-20T00:00:00Z")).stale).toBe(false);
  });
});

// ── contradictions ──────────────────────────────────────────────────────────
describe("contradictions", () => {
  const a = claim({ id: "cA", statement: "Person X became CEO in 2022", predicate: "WORKS_AT", objectValue: "CEO", validFrom: "2022-01-01" });
  const b = claim({ id: "cB", statement: "Person X became CEO in 2023", predicate: "WORKS_AT", objectValue: "CEO", validFrom: "2023-01-01" });

  it("detects a date conflict on the same assertion", () => {
    const found = detectContradictions([a, b]);
    expect(found).toHaveLength(1);
    expect(found[0].dimension).toBe("date");
  });

  it("favours the filing but preserves the losing claim", () => {
    const filing = source({ id: "s1", url: "https://sec.gov/f", authorityTier: 1 });
    const news = source({ id: "s2", url: "https://reuters.com/a", authorityTier: 3 });
    const ev = [
      evidence({ id: "e1", claimId: "cA", sourceId: "s1", authorityTier: 1 }),
      evidence({ id: "e2", claimId: "cB", sourceId: "s2", authorityTier: 3 }),
    ];
    const v = resolveByAuthority(a, b, ev);
    expect(v.resolution).toBe("favored_a");
    expect(v.favoredClaimId).toBe("cA");
    expect(v.reason).toMatch(/outranks/);
    // the conflicting claim is untouched — nothing deleted it
    expect(b.status).not.toBe("retracted");
    void filing;
    void news;
  });

  it("stays unresolved when both sides are equally authoritative", () => {
    const ev = [
      evidence({ id: "e1", claimId: "cA", sourceId: "s1", authorityTier: 3 }),
      evidence({ id: "e2", claimId: "cB", sourceId: "s2", authorityTier: 3 }),
    ];
    expect(resolveByAuthority(a, b, ev).resolution).toBe("unresolved");
  });

  it("stays unresolved when neither side is cited", () => {
    const ev = [evidence({ id: "e1", claimId: "cA" }), evidence({ id: "e2", claimId: "cB" })];
    expect(resolveByAuthority(a, b, ev).resolution).toBe("unresolved");
  });

  it("treats non-overlapping periods as both valid", () => {
    const p1 = claim({ id: "p1", statement: "A owns B", predicate: "OWNS", objectValue: "B", validFrom: "2010-01-01", validTo: "2015-01-01" });
    const p2 = claim({ id: "p2", statement: "C owns B", predicate: "OWNS", objectValue: "C-stake", validFrom: "2016-01-01", validTo: "2020-01-01" });
    const detected = detectContradictions([p1, p2])[0];
    expect(detected.temporallySeparable).toBe(true);
    expect(resolveByAuthority(p1, p2, [], detected).resolution).toBe("both_valid_different_periods");
  });
});

// ── gaps and hops ───────────────────────────────────────────────────────────
describe("gaps and next hops", () => {
  it("opens a discovery hop when there is nothing yet", () => {
    const hops = nextBestHops(snapshot());
    expect(hops[0].phase).toBe("discover");
  });

  it("prioritises verifying an uncited claim over connecting entities", () => {
    const e1 = entity({ id: "e1", label: "Acme Holdings Ltd" });
    const c = claim({ id: "c1", statement: "Acme is owned by Zenith" });
    const snap = snapshot({ entities: [e1], claims: [c], evidence: [] });
    const hops = nextBestHops(snap);
    expect(hops[0].phase).toBe("verify");
  });

  it("flags an uncited claim and an unidentified company as gaps", () => {
    const e1 = entity({ id: "e1", label: "Acme Holdings Ltd" });
    const c = claim({ id: "c1", statement: "Acme is owned by Zenith" });
    const gaps = detectGaps({
      entities: [e1],
      identifiers: [],
      claims: [c],
      evidence: [],
      sources: [],
      contradictions: [],
    });
    expect(gaps.some((g) => g.gapType === "missing_evidence")).toBe(true);
    expect(gaps.some((g) => g.gapType === "unidentified_entity")).toBe(true);
  });

  it("stops the loop once the hop budget is spent", () => {
    const done = Array.from({ length: 3 }, (_, i) => ({
      id: `h${i}`,
      investigationId: "inv",
      hopNumber: i + 1,
      phase: "verify" as const,
      objective: "o",
      rationale: null,
      targetEntityId: null,
      status: "done" as const,
      providerState: {},
      stats: {},
      startedAt: T0,
      finishedAt: T0,
      createdAt: T0,
    }));
    expect(shouldContinueLoop(snapshot({ hops: done })).proceed).toBe(false);
  });
});

// ── chat integration ────────────────────────────────────────────────────────
describe("chat intent", () => {
  it("recognises a research request", () => {
    expect(isResearchRequest("research this company and figure out who owns it")).toBe(true);
    expect(isResearchRequest("who owns Acme Holdings?")).toBe(true);
  });

  it("leaves normal conversation alone", () => {
    expect(isResearchRequest("hey, can you help me write an email?")).toBe(false);
    expect(parseCommand("what's the weather like", false).kind).toBe("none");
  });

  it("only parses follow-ups while an investigation is open", () => {
    expect(parseCommand("what contradicts this?", false).kind).toBe("none");
    expect(parseCommand("what contradicts this?", true).kind).toBe("contradictions");
    expect(parseCommand("hop from this company", true).kind).toBe("hop");
  });

  it("grounds on stored records and states when nothing was gathered", () => {
    const ctx = buildGroundingContext(snapshot());
    expect(ctx).toMatch(/NO CLAIMS STORED YET/);
    expect(ctx).toMatch(/never upgrade a weak or uncited claim/);
  });

  it("labels an unresolved claim as unresolved in the grounding block", () => {
    const c = claim({ id: "c1", statement: "Acme is owned by Zenith" });
    const ctx = buildGroundingContext(snapshot({ claims: [c] }));
    expect(ctx).toMatch(/weak/);
    expect(ctx).toMatch(/sources: none cited/);
  });
});

// ── provider honesty ────────────────────────────────────────────────────────
describe("provider availability", () => {
  it("surfaces an unavailable adapter in the grounding block", () => {
    const snap = snapshot();
    snap.investigation.providerState = {
      extraction: { status: "not_configured", detail: "GEMINI_API_KEY absent" },
    };
    expect(buildGroundingContext(snap)).toMatch(/UNAVAILABLE ADAPTERS: extraction=not_configured/);
  });
});
