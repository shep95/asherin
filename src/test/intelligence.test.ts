import { describe, expect, it } from "vitest";
import { frameTask } from "@/lib/intelligence/taskFrame";
import { resolveContext, composeModelContext, rankMemories } from "@/lib/intelligence/contextResolver";
import { assertNoCredentials } from "@/lib/intelligence/modelGateway";
import { SEED_PATTERNS } from "@/lib/intelligence/seedPatterns";
import { emptyConversationState, DEFAULT_SETTINGS } from "@/lib/intelligence/store";
import { gateMemory, gatePattern } from "@/lib/intelligence/learningGate";
import { needsDiscovery } from "@/lib/intelligence/creator";
import type { MemoryRecord } from "@/lib/intelligence/types";

const conv = emptyConversationState("conv-1", null);

const memory = (content: string, kind: MemoryRecord["kind"]): MemoryRecord => ({
  kind,
  scope: "user",
  content,
  confidence: 0.7,
  evidenceCount: 2,
  source: "conversation",
  status: "active",
});

describe("context resolution", () => {
  it("keeps standing rules in scope even when they do not match the query words", () => {
    const ranked = rankMemories(
      [memory("never use emoji in answers", "never"), memory("the barn roof is corrugated steel", "fact")],
      "help me refactor a database migration",
      5,
    );
    expect(ranked.map((m) => m.content)).toContain("never use emoji in answers");
    expect(ranked.map((m) => m.content)).not.toContain("the barn roof is corrugated steel");
  });

  it("honours memory off by reading no durable memory at all", () => {
    const ctx = resolveContext({
      conversation: conv,
      task: frameTask("write a migration for the orders table"),
      query: "write a migration for the orders table",
      settings: { ...DEFAULT_SETTINGS, memoryEnabled: false },
      userMemory: [memory("prefer terse answers", "prefer")],
      projectMemory: [],
      patterns: SEED_PATTERNS,
    });
    expect(ctx.userMemory).toHaveLength(0);
    expect(ctx.notes.join(" ")).toMatch(/memory is off/);
  });

  it("never exceeds the retrieval budget", () => {
    const ctx = resolveContext({
      conversation: conv,
      task: frameTask("debug why the build fails intermittently"),
      query: "debug why the build fails intermittently",
      settings: { ...DEFAULT_SETTINGS, memoryEnabled: true },
      userMemory: Array.from({ length: 40 }, (_, i) => memory(`prefer rule number ${i}`, "prefer")),
      projectMemory: [],
      patterns: SEED_PATTERNS,
      budget: { maxMemories: 4, maxPatterns: 3 },
    });
    expect(ctx.userMemory.length).toBeLessThanOrEqual(4);
    expect(ctx.patterns.length).toBeLessThanOrEqual(3);
  });

  it("marks a candidate pattern as a hypothesis in the composed context", () => {
    const candidate = { ...SEED_PATTERNS[0], status: "candidate" as const };
    const ctx = resolveContext({
      conversation: conv,
      task: frameTask(candidate.triggerTerms.join(" ")),
      query: candidate.triggerTerms.join(" "),
      settings: DEFAULT_SETTINGS,
      userMemory: [],
      projectMemory: [],
      patterns: [candidate],
    });
    if (ctx.patterns.length > 0) {
      expect(composeModelContext(ctx)).toMatch(/hypothesis/);
    } else {
      expect(ctx.coverage.state).toBe("unknown");
    }
  });

  it("says plainly when nothing covers the task instead of inventing a procedure", () => {
    const ctx = resolveContext({
      conversation: conv,
      task: frameTask("translate this medieval falconry manual into modern welsh"),
      query: "translate this medieval falconry manual into modern welsh",
      settings: DEFAULT_SETTINGS,
      userMemory: [],
      projectMemory: [],
      patterns: [],
    });
    expect(ctx.coverage.state).toBe("unknown");
    expect(needsDiscovery(ctx.coverage)).toBe("no_coverage");
    expect(composeModelContext(ctx)).toMatch(/no established procedure/);
  });
});

describe("credential boundary", () => {
  it("refuses to send a composed context containing key-shaped material", () => {
    expect(() => assertNoCredentials("here is the key sk-abcdefghijklmnop12345")).toThrow(/credential/);
    expect(() => assertNoCredentials("use AIzaSyA1234567890abcdefghijklmnop")).toThrow();
    expect(() => assertNoCredentials("prefer terse answers")).not.toThrow();
  });

  it("keeps credentials out of memory", () => {
    const result = gateMemory(
      { content: "my openai api key is sk-live-abcdefghijklmnop", kind: "fact", conversationId: "c" },
      { settings: DEFAULT_SETTINGS, hasProject: false },
    );
    expect(result.outcome).toBe("rejected");
  });
});

describe("learning gate", () => {
  it("does not write anything durable while learning is off", () => {
    const gated = gatePattern({ ...SEED_PATTERNS[0], status: "candidate" }, {
      settings: { ...DEFAULT_SETTINGS, learningEnabled: false },
    });
    expect(gated.outcome).toBe("held");
  });

  it("refuses a pattern with no mechanism and no procedure", () => {
    const gated = gatePattern(
      { ...SEED_PATTERNS[0], mechanism: undefined, procedure: [], status: "candidate" },
      { settings: DEFAULT_SETTINGS },
    );
    expect(gated.outcome).toBe("rejected");
  });

  it("holds a pattern back when the run that produced it failed validation", () => {
    const gated = gatePattern(
      { ...SEED_PATTERNS[0], successCount: 9, failureCount: 0, contextsUsed: ["a", "b", "c"], evidenceQuality: "strong", confidence: 0.9, status: "validated" },
      {
        settings: DEFAULT_SETTINGS,
        validation: { modality: "code", checks: [], verdict: "needs_revision" },
      },
    );
    expect(gated.outcome).toBe("candidate");
  });

  it("treats a one-off instruction as this turn only", () => {
    const result = gateMemory(
      { content: "just for now, answer in bullet points only", kind: "output", conversationId: "c" },
      { settings: DEFAULT_SETTINGS, hasProject: false },
    );
    expect(result.outcome).toBe("rejected");
  });
});

describe("task framing", () => {
  it("recognises debugging and keeps the stated constraint", () => {
    const task = frameTask("the checkout page crashes on submit, fix it but do not change the database schema");
    expect(["debugging", "code"]).toContain(task.modality);
    expect(task.constraints.join(" ")).toMatch(/database schema/i);
  });
});
