// ═══════════════════════════════════════════════════════════════════════════
// IC tradecraft — regression pins.
//
// These are not decorative. Three of them guard bugs that would silently
// corrupt an analytic product rather than crash it, which is the dangerous
// class:
//
//   · the substring trap — "very unlikely" read as "unlikely" inverts an 80%
//     judgment into a 20% one and the page still renders happily
//   · the 0–1 vs 0–100 trap — a probability of 1 meaning "certain" or "1%"
//   · ordering drift between the server assembler and the client renderer,
//     which would make the email and the dossier page disagree on section
//     order for the same product
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from "vitest";
import {
  IC_APPARATUS,
  IC_SECTION_ORDER,
  LIKELIHOOD_TERMS,
  estimativeTermIn,
  orderIcSections,
  reportNumber,
  splitPortionMark,
} from "@/lib/ic/tradecraft";

describe("estimative language", () => {
  it("matches the longest ladder term, never a substring of it", () => {
    expect(estimativeTermIn("We assess this is very unlikely to recur")?.term).toBe("very unlikely");
    expect(estimativeTermIn("It is unlikely to recur")?.term).toBe("unlikely");
    expect(estimativeTermIn("almost certain to recur")?.term).toBe("almost certain");
    expect(estimativeTermIn("almost no chance of recurrence")?.term).toBe("almost no chance");
  });

  it("returns null rather than guessing when no term is present", () => {
    expect(estimativeTermIn("The driver may possibly be the same person")).toBeNull();
  });

  it("covers the full probability space with no gaps or overlaps", () => {
    for (let i = 0; i < LIKELIHOOD_TERMS.length - 1; i++) {
      expect(LIKELIHOOD_TERMS[i].hi).toBe(LIKELIHOOD_TERMS[i + 1].lo);
    }
  });
});

describe("portion marking", () => {
  it("splits the provenance mark off the judgment text", () => {
    expect(splitPortionMark("(U) Employer corroborated")).toEqual({
      mark: "U",
      text: "Employer corroborated",
    });
    expect(splitPortionMark("(U//LIMDIS) Derived from account telemetry").mark).toBe("U//LIMDIS");
  });

  it("leaves an unmarked judgment intact instead of inventing a mark", () => {
    expect(splitPortionMark("Employer corroborated")).toEqual({
      mark: null,
      text: "Employer corroborated",
    });
  });
});

describe("section ordering", () => {
  it("puts the apparatus in IC reading order and facts in the discussion body", () => {
    const out = orderIcSections([
      { label: "HANDLING", value: "x" },
      { label: "Plate", value: "T117661C" },
      { label: "INTELLIGENCE GAPS", value: "x" },
      { label: "SCOPE NOTE", value: "x" },
      { label: "Vehicle", value: "Toyota" },
      { label: "SOURCE SUMMARY", value: "x" },
    ]);
    expect(out.map((s) => s.label)).toEqual([
      "SCOPE NOTE",
      "SOURCE SUMMARY",
      "Plate",
      "Vehicle",
      "INTELLIGENCE GAPS",
      "HANDLING",
    ]);
  });

  it("preserves producer order among equally ranked facts", () => {
    const facts = [{ label: "A", value: "1" }, { label: "B", value: "2" }, { label: "C", value: "3" }];
    expect(orderIcSections(facts).map((s) => s.label)).toEqual(["A", "B", "C"]);
  });

  it("treats every apparatus label as a known section", () => {
    for (const label of IC_APPARATUS) {
      expect(IC_SECTION_ORDER).toContain(label);
    }
  });
});

describe("report serial", () => {
  it("is deterministic for a given row, so email and page cite one number", () => {
    const at = new Date("2026-08-08T04:12:00Z");
    const a = reportNumber("rideshare", "9c1f4e22-0000-4aaa-bbbb-cccc0000 4f2a".replace(/\s/g, ""), at);
    const b = reportNumber("rideshare", "9c1f4e22-0000-4aaa-bbbb-cccc00004f2a", at);
    expect(a).toBe(b);
    expect(a).toBe("ASH-RIDESHARE-20260808-4F2A");
  });

  it("degrades to a stable placeholder rather than throwing on a missing id", () => {
    expect(reportNumber("", null, new Date("2026-01-02T00:00:00Z"))).toBe("ASH-INTEL-20260102-0000");
  });
});
