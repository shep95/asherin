import { describe, it, expect } from "vitest";
import { chooseLane, planWorkspace, markDegraded } from "@/lib/workspace/planner";
import { applyMapOp, applyMapOps, EMPTY_MAP } from "@/lib/workspace/mapOps";
import { runLanes } from "@/lib/workspace/orchestrator";
import { workspaceReducer, initialWorkspaceState, detectNarrowing, describeWorkspace, visibleSurfacesOf } from "@/lib/workspace/state";
import { NO_CAPABILITIES, type WorkspaceCapabilities, type MapMarker } from "@/lib/workspace/types";
import { frameTask } from "@/lib/intelligence/taskFrame";
import { routeIntent } from "@/lib/intelligence/intentRouter";

function input(message: string, capabilities: WorkspaceCapabilities = NO_CAPABILITIES) {
  const task = frameTask(message);
  return { message, task, route: routeIntent(task, { message }), capabilities };
}

const ALL: WorkspaceCapabilities = {
  research: true,
  geocoding: true,
  cameras: true,
  fabric: true,
  evidenceStore: true,
  spatialCalibration: true,
};

describe("workspace planner", () => {
  it("routes a sensor question to the sensor lane", () => {
    expect(chooseLane(input("show me what happened at the warehouse entrance between 2 and 3 pm")).lane).toBe("sensor");
  });

  it("routes a research question to the research lane", () => {
    expect(chooseLane(input("research this company and show me its locations")).lane).toBe("research");
  });

  it("answers prose questions with no subsystem", () => {
    expect(chooseLane(input("explain why the sky looks red at dusk")).lane).toBe("none");
  });

  it("marks every sensor surface unavailable with a reason when nothing is wired", () => {
    const plan = planWorkspace(input("show the camera footage from the entrance"));
    const nonAnswer = plan.surfaces.filter((s) => s.kind !== "answer");
    expect(nonAnswer.length).toBeGreaterThan(0);
    for (const s of nonAnswer) {
      expect(s.state).toBe("unavailable");
      expect(s.reason && s.reason.length).toBeTruthy();
    }
  });

  it("plans a map only when geocoding is possible", () => {
    const withGeo = planWorkspace(input("research acme corp and show me its locations", ALL));
    expect(withGeo.surfaces.find((s) => s.kind === "map")?.state).toBe("pending");
    const without = planWorkspace(
      input("research acme corp and show me its locations", { ...ALL, geocoding: false, geocodingReason: "no geocoder" }),
    );
    expect(without.surfaces.find((s) => s.kind === "map")?.reason).toBe("no geocoder");
  });

  it("keeps a failed lane visible as degraded", () => {
    const plan = markDegraded(planWorkspace(input("show the cameras", ALL)), "cameras", "camera lane failed");
    expect(plan.surfaces.find((s) => s.kind === "cameras")?.state).toBe("degraded");
    expect(plan.degraded).toHaveLength(1);
  });
});

describe("map operations", () => {
  const marker: MapMarker = {
    id: "m1",
    kind: "location",
    label: "warehouse",
    lat: 51.5,
    lng: -0.12,
    provenance: { origin: "geocoder", label: "public geocoder" },
  };

  it("refuses to centre without a coordinate", () => {
    const r = applyMapOp(EMPTY_MAP, { kind: "CENTER" });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/no coordinate/);
  });

  it("plots a marker that carries a real coordinate", () => {
    const r = applyMapOp(EMPTY_MAP, { kind: "ADD_LOCATION", marker });
    expect(r.ok).toBe(true);
    expect(r.map.markers).toHaveLength(1);
    expect(r.map.center).toEqual({ lat: 51.5, lng: -0.12 });
  });

  it("lists an uncoordinated entity as unplotted instead of inventing a point", () => {
    const r = applyMapOp(EMPTY_MAP, {
      kind: "ADD_ENTITY",
      marker: { ...marker, lat: Number.NaN as unknown as number, lng: Number.NaN as unknown as number },
    });
    expect(r.ok).toBe(false);
    expect(r.map.markers).toHaveLength(0);
    expect(r.map.unplotted).toHaveLength(1);
  });

  it("refuses a track with fewer than two calibrated points", () => {
    const r = applyMapOp(EMPTY_MAP, {
      kind: "ADD_TRACK",
      track: { id: "t", label: "track", points: [{ lat: 1, lng: 1, atMs: 0 }], provenance: { origin: "fabric", label: "cam" } },
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/fewer than two/);
  });

  it("refuses rewind when no trajectory was recorded", () => {
    expect(applyMapOp(EMPTY_MAP, { kind: "REWIND" }).ok).toBe(false);
  });

  it("collects every refusal reason across a batch", () => {
    const { refusals } = applyMapOps(EMPTY_MAP, [{ kind: "CENTER" }, { kind: "REWIND" }, { kind: "SHOW_ROUTE" }]);
    expect(refusals).toHaveLength(3);
  });
});

describe("lane orchestration", () => {
  const base = planWorkspace(input("show the cameras at the entrance", ALL));

  it("marks a surface ready when a runner returns rows", async () => {
    const out = await runLanes(base, [
      {
        kind: "cameras",
        emptyReason: "none",
        run: async () => ({
          kind: "cameras",
          cameras: [
            {
              id: "c1",
              kind: "camera",
              title: "front door",
              fields: [],
              provenance: { origin: "fabric", label: "c1" },
            },
          ],
        }),
      },
    ]);
    expect(out.surfaces.find((s) => s.kind === "cameras")?.state).toBe("ready");
  });

  it("marks an empty result unavailable with the runner's reason", async () => {
    const out = await runLanes(base, [
      { kind: "cameras", emptyReason: "no camera registered", run: async () => ({ kind: "cameras", cameras: [] }) },
    ]);
    const s = out.surfaces.find((x) => x.kind === "cameras");
    expect(s?.state).toBe("unavailable");
    expect(s?.reason).toBe("no camera registered");
  });

  it("degrades a lane that throws, keeping other lanes intact", async () => {
    const out = await runLanes(base, [
      {
        kind: "cameras",
        emptyReason: "none",
        run: async () => {
          throw new Error("feed refused");
        },
      },
    ]);
    const s = out.surfaces.find((x) => x.kind === "cameras");
    expect(s?.state).toBe("degraded");
    expect(s?.reason).toMatch(/feed refused/);
  });

  it("says so when a planned surface has no adapter at all", async () => {
    const out = await runLanes(base, []);
    const s = out.surfaces.find((x) => x.kind === "timeline");
    expect(s?.state).toBe("unavailable");
    expect(s?.reason).toMatch(/no adapter/);
  });
});

describe("workspace state", () => {
  it("detects a narrowing follow-up", () => {
    expect(detectNarrowing("only show the cameras")).toEqual(["cameras"]);
    expect(detectNarrowing("show me everything")).toEqual([]);
    expect(detectNarrowing("what about the loading bay?")).toBeNull();
  });

  it("keeps narrowing across a new turn", () => {
    const plan = planWorkspace(input("show the cameras", ALL));
    let s = workspaceReducer(initialWorkspaceState, { type: "narrow", surfaces: ["cameras"] });
    s = workspaceReducer(s, { type: "plan", plan, question: "show the cameras" });
    expect(visibleSurfacesOf(s)).toEqual(["cameras"]);
    expect(s.history).toHaveLength(1);
  });

  it("describes unavailable surfaces for the next turn's context", () => {
    const plan = planWorkspace(input("show the cameras"));
    const s = workspaceReducer(initialWorkspaceState, { type: "plan", plan, question: "show the cameras" });
    expect(describeWorkspace(s)).toMatch(/surfaces unavailable/);
  });
});
