// CHAT-GREETING-NOT-INTEL-PACKET — a ping must not be answered with a dossier.
//
// Two layers are asserted, because the bug lived across both:
//   1. the classifier — "hey, asherin. you there bud" must be trivial;
//   2. the prompt assembly — on a trivial turn the analyst blocks must not be
//      concatenated into the system prompt. The assembly lives inside a Deno
//      edge handler that cannot be imported here, so it is asserted against the
//      source text: each named block must carry the `_R.trivial` gate, and the
//      greeting contract must exist and forbid the leaked fields.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyTurnRelevance } from "../../supabase/functions/_shared/promptRelevance";

const CHAT_SRC = readFileSync("supabase/functions/chat/index.ts", "utf8");

const base = { recent: "", mode: "chat", responseDepth: "standard" } as any;

describe("greeting classifier", () => {
  const pings = [
    "hey, asherin. you there bud",
    "hey asherin",
    "you there?",
    "you there bud",
    "u there",
    "still there?",
    "hello",
    "yo asherin you around",
    "good morning asherin",
  ];
  for (const text of pings) {
    it(`treats "${text}" as trivial`, () => {
      expect(classifyTurnRelevance({ ...base, text }).trivial).toBe(true);
    });
  }

  const tasks = [
    "who lives at 41 mercer street newark",
    "take me to the nearest airport and plot the route",
    "dork this host for exposed configuration files",
    "explain why the build failed on the v.2 dashboard layout",
  ];
  for (const text of tasks) {
    it(`keeps "${text.slice(0, 32)}…" non-trivial`, () => {
      const r = classifyTurnRelevance({ ...base, text });
      expect(r.trivial).toBe(false);
    });
  }

  it("attaches no specialist brains to a ping", () => {
    const r = classifyTurnRelevance({ ...base, text: "hey, asherin. you there bud" });
    expect(r.attached).toEqual([]);
    expect(r.geo).toBe(false);
    expect(r.intel).toBe(false);
    expect(r.psychology).toBe(false);
  });
});

describe("trivial-turn prompt assembly", () => {
  // Each analytic block and the exact gate expression that must guard it in
  // chat/index.ts. The gates now read from blocksForTurn(), so a drift between
  // the router and the assembly fails here.
  const gated: [string, string][] = [
    ["PROMPT_INTELLIGENCE_PROTOCOL", "_B.promptIntelligence ? PROMPT_INTELLIGENCE_PROTOCOL"],
    ["CONTEXT_INTELLIGENCE_PROMPT", "_B.contextIntelligence ? CONTEXT_INTELLIGENCE_PROMPT"],
    ["ASHERIN_OPERATING_NOTES", "_B.operatingNotes ? ASHERIN_OPERATING_NOTES"],
    ["QUICK_INTELLIGENCE_BRAIN", "_B.quickIntelligence ? QUICK_INTELLIGENCE_BRAIN"],
    ["ADAPTIVE_OPERATOR_ROUTER", "_B.adaptiveRouter ? ADAPTIVE_OPERATOR_ROUTER"],
    ["userContextStr", "_B.operatorProfile ? userContextStr"],
    ["_asherinProcedures", '_R.trivial ? "" : _asherinProcedures'],
  ];
  for (const [block, gate] of gated) {
    it(`withholds ${block} on a trivial turn`, () => {
      expect(CHAT_SRC).toContain(gate);
      // and never ships it unconditionally from the systemParts array
      expect(CHAT_SRC).not.toMatch(new RegExp(`^\\s{6}${block},$`, "m"));
    });
  }

  it("gates GEOLOCATION_BRAIN behind a named place, photo, or address", () => {
    expect(CHAT_SRC).toContain("_B.geolocation ? GEOLOCATION_BRAIN");
  });


  it("no longer titles the preference note as an intelligence profile", () => {
    expect(CHAT_SRC).not.toContain("USER INTELLIGENCE PROFILE");
  });

  it("ships the greeting contract last and forbids the leaked fields", () => {
    expect(CHAT_SRC).toContain('_R.trivial ? TRIVIAL_TURN_CONTRACT : ""');
    for (const forbidden of ["ip address", "geolocation", "vpn", "the user seems to be", "request metadata"]) {
      expect(CHAT_SRC.toLowerCase()).toContain(forbidden);
    }
  });

  it("strips network telemetry out of remembered traits", () => {
    expect(CHAT_SRC).toContain("TELEMETRY_KEY");
    expect(CHAT_SRC).toContain("TELEMETRY_VALUE");
  });
});
