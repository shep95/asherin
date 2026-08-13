import { describe, it, expect } from "vitest";
// The bridge is Deno-targeted but the planner is pure: no Deno globals are
// touched at import time or inside planFoldedTools.
import { planFoldedTools } from "../../supabase/functions/_shared/foldedToolsBridge";

describe("folded tools planner — Google Cloud Intelligence", () => {
  it("routes an owned-inbox question to google-data gmail_inbox", () => {
    const plan = planFoldedTools("summarise my gmail from this week", []);
    expect(plan.googleService).toBe("gmail_inbox");
  });

  it("routes an owned-calendar question to calendar_events", () => {
    const plan = planFoldedTools("what is on my calendar tomorrow", []);
    expect(plan.googleService).toBe("calendar_events");
  });

  it("routes 'what did X email me about Y' to a mesh mail search", () => {
    const plan = planFoldedTools("what did Marcus email me about the lease", []);
    expect(plan.googleMesh?.action).toBe("search_mail");
    expect(plan.googleMesh?.query).toContain("Marcus");
    expect(plan.googleMesh?.query).toContain("lease");
  });

  it("routes a daily digest ask to the mesh digest action", () => {
    const plan = planFoldedTools("give me my daily digest", []);
    expect(plan.googleMesh?.action).toBe("daily_digest");
  });

  it("leaves unrelated turns free of any Google leg", () => {
    const plan = planFoldedTools("explain the difference between RSA and ECC", []);
    expect(plan.googleService).toBeUndefined();
    expect(plan.googleMesh).toBeUndefined();
  });
});
