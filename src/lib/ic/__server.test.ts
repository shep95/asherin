import { describe, expect, it } from "vitest";
import { buildIcProduct, likelihoodFor, estimative, confidenceFromSourcing, gradeSource, orderIcSections, IC_ANALYTIC_DOCTRINE } from "../../../supabase/functions/_shared/icTradecraft.ts";

describe("server assembler", () => {
  it("maps probabilities onto the ODNI ladder on both scales", () => {
    expect(likelihoodFor(0.85).term).toBe("very likely");
    expect(likelihoodFor(85).term).toBe("very likely");
    expect(likelihoodFor(0.5).term).toBe("roughly even chance");
    expect(estimative(0.6)).toBe("likely (55–80%)");
  });
  it("keeps confidence independent of likelihood and caps on contradiction", () => {
    expect(confidenceFromSourcing({ independentSources: 5, contradicted: true })).toBe("low");
    expect(confidenceFromSourcing({ independentSources: 3 })).toBe("high");
    expect(confidenceFromSourcing({ independentSources: 1 })).toBe("low");
  });
  it("grades a government registry above an aggregator", () => {
    expect(gradeSource("government_registry", { independentSources: 2 }).code).toBe("A1");
    expect(gradeSource("aggregator").code).toBe("D3");
    expect(gradeSource("anonymous").code).toBe("F6");
  });
  it("upgrades a bare module payload to a full IC product without fabricating calibration", () => {
    const p = buildIcProduct({
      kind: "wifi", title: "Network assessed", body: "BLUF.",
      sections: [{ label: "Operator", value: "Comcast" }],
      findings: ["Egress is a residential line."],
      serial: "abcd1234",
      generatedAt: new Date("2026-08-08T04:00:00Z"),
    });
    const labels = p.sections.map(s => s.label);
    expect(labels).toEqual(["SCOPE NOTE","SOURCE SUMMARY","Operator","ALTERNATIVE ANALYSIS","INTELLIGENCE GAPS","CONFIDENCE","HANDLING"]);
    expect(p.keyJudgments[0]).toBe("(U) Egress is a residential line.");
    expect(p.reportNumber).toBe("ASH-WIFI-20260808-1234");
    // no invented confidence
    expect(p.confidence).toBeNull();
    expect(p.sections.find(s=>s.label==="CONFIDENCE")!.value).toMatch(/Uncalibrated/);
  });
  it("never overwrites apparatus a module supplied itself", () => {
    const p = buildIcProduct({ kind: "x", title: "t", body: "b",
      sections: [{ label: "SOURCE SUMMARY", value: "Two registries." }],
      confidence: "high" });
    expect(p.sections.find(s=>s.label==="SOURCE SUMMARY")!.value).toBe("Two registries.");
    expect(p.sections.find(s=>s.label==="CONFIDENCE")!.value).toMatch(/^High confidence/);
  });
  it("doctrine bans uncalibrated hedges and fabrication", () => {
    expect(IC_ANALYTIC_DOCTRINE).toMatch(/roughly even chance/);
    expect(IC_ANALYTIC_DOCTRINE).toMatch(/PROHIBITED ABSOLUTELY/);
  });
});
