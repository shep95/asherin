// turn-loop split: prepareTurn must compose a credential-free brief and
// completeTurn must finish the same turn from whatever the model returned —
// including failure — without the two phases sharing hidden state.

import { describe, expect, it, vi, beforeEach } from "vitest";

const storeMock = vi.hoisted(() => ({
  loadSettings: vi.fn(),
  loadConversationState: vi.fn(),
  saveConversationState: vi.fn().mockResolvedValue(undefined),
  loadUserMemory: vi.fn(),
  loadProjectMemory: vi.fn().mockResolvedValue([]),
  loadPatterns: vi.fn(),
  insertMemoryCandidate: vi.fn().mockResolvedValue(null),
  upsertPattern: vi.fn().mockImplementation(async (p: unknown) => p),
  snapshotPatternVersion: vi.fn().mockResolvedValue(undefined),
  recordOutcome: vi.fn().mockResolvedValue(undefined),
  recordLearningDecisions: vi.fn().mockResolvedValue(undefined),
  bumpMemoryEvidence: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/intelligence/store", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/intelligence/store")>();
  return { ...original, ...storeMock };
});

import { prepareTurn, completeTurn } from "@/lib/intelligence/orchestrator";
import { SEED_PATTERNS } from "@/lib/intelligence/seedPatterns";
import { emptyConversationState, DEFAULT_SETTINGS } from "@/lib/intelligence/store";
import type { MemoryRecord } from "@/lib/intelligence/types";

const standingRule: MemoryRecord = {
  id: "m1",
  kind: "never",
  scope: "user",
  content: "never use emoji in answers",
  confidence: 0.9,
  evidenceCount: 4,
  source: "conversation",
  status: "active",
};

beforeEach(() => {
  vi.clearAllMocks();
  // memory is opt-in by default; these turns exercise it, so enable it.
  storeMock.loadSettings.mockResolvedValue({ ...DEFAULT_SETTINGS, memoryEnabled: true });
  storeMock.loadConversationState.mockResolvedValue(emptyConversationState("conv-1", null));
  storeMock.loadUserMemory.mockResolvedValue([standingRule]);
  storeMock.loadPatterns.mockResolvedValue([{ ...SEED_PATTERNS[0], id: "p1" }]);
});

describe("prepareTurn / completeTurn", () => {
  it("composes a brief that carries the standing rule and no credential material", async () => {
    const prepared = await prepareTurn({ conversationId: "conv-1", message: "help me refactor this function" });
    expect(prepared.composed).toContain("never use emoji in answers");
    expect(prepared.composed).not.toMatch(/sk-[A-Za-z0-9]{12,}/);
    expect(prepared.task.modality).toBeTruthy();
  });

  it("finishes a successful turn: validation runs, outcomes are recorded, state is saved", async () => {
    const prepared = await prepareTurn({ conversationId: "conv-1", message: "help me refactor this function" });
    const result = await completeTurn(prepared, { ok: true, text: "here is the refactored function." });
    expect(result.ok).toBe(true);
    expect(result.validation).toBeDefined();
    expect(storeMock.saveConversationState).toHaveBeenCalledOnce();
    expect(storeMock.recordLearningDecisions).toHaveBeenCalledOnce();
  });

  it("records an honest failure when the model never answered", async () => {
    const prepared = await prepareTurn({ conversationId: "conv-1", message: "help me refactor this function" });
    const result = await completeTurn(prepared, { ok: false, unavailableReason: "provider timeout" });
    expect(result.ok).toBe(false);
    expect(result.unavailableReason).toBe("provider timeout");
    expect(result.validation).toBeUndefined();
    // failure lowers confidence rather than silently passing
    const saved = storeMock.saveConversationState.mock.calls[0]?.[0];
    expect(saved.confidence).toBeLessThan(emptyConversationState("conv-1", null).confidence);
  });

  it("treats a user correction as a learning proposal, gated and audited", async () => {
    const prepared = await prepareTurn({
      conversationId: "conv-1",
      message: "no, that's wrong — never mutate props directly",
    });
    await completeTurn(prepared, { ok: true, text: "understood." });
    expect(storeMock.insertMemoryCandidate).toHaveBeenCalled();
    const decisions = storeMock.recordLearningDecisions.mock.calls[0]?.[1] ?? [];
    expect(decisions.length).toBeGreaterThan(0);
  });
});
