import { describe, expect, it } from "vitest";
import type { SensorDescriptor, ServiceHealth } from "../../sensors/types";
import { cameraFrustum, cameraSpatialModel } from "../camera";
import { depthAvailability, lidarAvailability } from "../depth";
import { summarizePointCloud } from "../pointCloud";
import { assetSpatialState, buildingGeometryState, makeAsset } from "../assets";
import { emptyRegistrationEvidence, resolveRegistration, sharesFrame } from "../registration";
import { handoffCandidates, relationToZone, relationsBetween, toSpatialTrack } from "../tracks3d";
import { historicalScene, nearestObservation } from "../history";
import { buildSpatialMatrix, spatialCell } from "../capability";
import type { SpatialTrack3D } from "../types";

function sensor(over: Partial<SensorDescriptor> = {}): SensorDescriptor {
  return {
    id: "cam1",
    modality: "rgb",
    label: "front door",
    transport: "browser_media",
    health: "live",
    statusDetail: "",
    calibration: { state: "none", detail: "no calibration has been recorded for this camera", intrinsics: null, atMs: null },
    provenance: { vendor: null, model: null, driver: null, adapter: "browser_media", topic: "/sensors/rgb" },
    quality: { cadence: 0.9, signal: 0.8, latencyMs: null, note: "" },
    units: { measurement: null, frameFormat: "rgb" },
    lastSampleMs: 1000,
    declaredFps: 30,
    resolution: { width: 1280, height: 720 },
    measurable: false,
    ...over,
  };
}

const device = { id: "cam1", name: "front door", modality: "rgb" as const };

const services: ServiceHealth[] = [
  { id: "recording", label: "recording", configured: false, online: false, detail: "no recording service is configured", checkedAtMs: null, endpointKind: "none" },
];

function track(over: Partial<SpatialTrack3D> = {}): SpatialTrack3D {
  return {
    trackId: "t1",
    sourceDeviceId: "cam1",
    position: { x: 0, y: 0, z: 0 },
    measuredBy: "lidar",
    atMs: 1000,
    firstSeenMs: 500,
    lastSeenMs: 1000,
    velocityMps: null,
    headingDeg: null,
    uncertaintyM: { x: 0.1, y: 0.1, z: 0.1 },
    occlusion: "visible",
    confidence: 0.8,
    trajectory: [],
    spatialState: "real_sensor_3d",
    ...over,
  };
}

describe("depth truth", () => {
  it("an rgb-only camera reports depth unavailable", () => {
    const d = depthAvailability({ sensor: sensor(), all: [sensor()], edgeConnected: false });
    expect(d.state).toBe("requires_edge");
    expect(d.reason).toContain("DEPTH UNAVAILABLE");
    expect(d.source).toBeNull();
  });

  it("an rgb-only camera reports lidar unavailable", () => {
    const l = lidarAvailability({ sensor: sensor(), all: [sensor()], edgeConnected: false });
    expect(l.state).toBe("requires_edge");
    expect(l.reason).toContain("LIDAR UNAVAILABLE");
  });

  it("a live lidar stream reports measured depth with its source", () => {
    const lid = sensor({ id: "lidar1", modality: "lidar", transport: "edge_bridge", measurable: true });
    const d = depthAvailability({ sensor: lid, all: [lid], edgeConnected: true });
    expect(d.state).toBe("available");
    expect(d.source?.modality).toBe("lidar");
    expect(d.atMs).toBe(1000);
  });
});

describe("geometry provenance", () => {
  it("an osm footprint is MAP DERIVED 3D and says it has no interior", () => {
    const g = buildingGeometryState("osm");
    expect(g.state).toBe("map_derived_3d");
    expect(g.note).toContain("no interior");
  });

  it("an imported glb is IMPORTED 3D and refuses site coordinates until aligned", () => {
    const asset = makeAsset({ siteId: "s1", format: "glb", source: "site survey export", uploadedBy: "ops" });
    const s = assetSpatialState(asset);
    expect(s.state).toBe("imported_3d");
    expect(s.note).toContain("NOT REGISTERED");
  });
});

describe("camera frustum", () => {
  const pose = { latitude: 30.2672, longitude: -97.7431, elevationM: 6, headingDeg: 90, pitchDeg: -15, hfovDeg: 70, measuredRangeM: 40 };

  it("a calibrated camera with a measured range gets a frustum", () => {
    const model = cameraSpatialModel(device, sensor({ calibration: { state: "operator", detail: "four operator reference points", intrinsics: { fx: 900, fy: 900, px: 640, py: 360, width: 1280, height: 720 }, atMs: 10 } }), pose);
    const f = cameraFrustum(model);
    expect(f.state).toBe("available");
    expect(f.geometry?.footprint.length).toBeGreaterThan(3);
    expect(f.caveat).toContain("not guaranteed detection coverage");
  });

  it("an uncalibrated camera never claims a measured frustum", () => {
    const f = cameraFrustum(cameraSpatialModel(device, sensor(), pose));
    expect(f.state).toBe("approximate");
    expect(f.confidence).toBeNull();
  });

  it("a camera with no pose has no frustum at all", () => {
    const f = cameraFrustum(cameraSpatialModel(device, sensor(), null));
    expect(f.state).toBe("unavailable");
    expect(f.geometry).toBeNull();
  });
});

describe("point clouds", () => {
  it("real points produce counted spatial figures", () => {
    const s = summarizePointCloud([
      {
        positions: new Float32Array([0, 0, 0, 1, 1, 1, 2, 0.5, 1]),
        colors: null,
        sensorId: "lidar1",
        modality: "lidar",
        atMs: 2000,
        frameId: "sensor_frame",
        intensity: new Float32Array([0.1, 0.2, 0.3]),
      },
    ]);
    expect(s.available).toBe(true);
    expect(s.points).toBe(3);
    expect(s.hasIntensity).toBe(true);
    expect(s.densityPerM3).not.toBeNull();
  });

  it("no chunks means unavailable, never an invented cloud", () => {
    const s = summarizePointCloud([]);
    expect(s.available).toBe(false);
    expect(s.points).toBe(0);
    expect(s.reason).toContain("POINT CLOUD UNAVAILABLE");
  });
});

describe("registration and cross-camera correlation", () => {
  it("no evidence means NOT REGISTERED", () => {
    const r = resolveRegistration(emptyRegistrationEvidence());
    expect(r.state).toBe("not_registered");
    expect(sharesFrame(r, r).allowed).toBe(false);
  });

  it("reference points plus ranging reach calibrated", () => {
    const r = resolveRegistration({ ...emptyRegistrationEvidence(), referencePoints: 4, depthOrLidar: true });
    expect(r.state).toBe("calibrated");
    expect(sharesFrame(r, r).allowed).toBe(true);
  });

  it("synchronised registered cameras may offer a possible match", () => {
    const [c] = handoffCandidates({
      from: track({ lastSeenMs: 1000 }),
      candidates: [track({ trackId: "t2", sourceDeviceId: "cam2", firstSeenMs: 3000, position: { x: 5, y: 0, z: 0 } })],
      sharedFrame: true,
      timeSynchronised: true,
    });
    expect(c.status).toBe("possible_match");
    expect(c.distanceM).toBeCloseTo(5, 5);
  });

  it("unsynchronised cameras are never confirmed", () => {
    const [c] = handoffCandidates({
      from: track({ lastSeenMs: 1000 }),
      candidates: [track({ trackId: "t2", sourceDeviceId: "cam2", firstSeenMs: 3000 })],
      sharedFrame: false,
      timeSynchronised: false,
    });
    expect(c.status).toBe("insufficient_evidence");
    expect(c.distanceM).toBeNull();
    expect(c.reasons.join(" ")).toContain("not synchronised");
  });
});

describe("3d tracks and relationships", () => {
  it("an image-only track is not lifted into 3d", () => {
    const lifted = toSpatialTrack(
      {
        trackId: "t9", category: null, firstSeenMs: 0, lastSeenMs: 1, occlusion: "visible",
        image: { x: 0, y: 0, w: 0.1, h: 0.2 }, history: [], world: null, distanceM: null, geometry: null,
        velocityMps: null, accelerationMps2: null, headingDeg: null, poseKeypoints: null, thermal: null,
        spectral: null, polarization: null, sensorIds: ["cam1"], relations: [],
        environment: { illumination: null, motionEnergy: null }, confidence: 0.5,
      },
      "cam1",
    );
    expect(lifted).toBeNull();
  });

  it("zone relationships come from measured positions only", () => {
    const zone = { id: "z1", name: "loading bay", polygonXZ: [[-1, -1], [1, -1], [1, 1], [-1, 1]] as Array<[number, number]>, heightRangeM: null };
    expect(relationToZone(track(), zone).relation).toBe("inside");
    expect(relationToZone(track({ position: { x: 9, y: 0, z: 9 } }), zone).relation).toBe("outside");
  });

  it("approach is a closing rate, not an intent", () => {
    const a = track({ velocityMps: { x: 1, y: 0, z: 0 } });
    const b = track({ trackId: "t2", position: { x: 2, y: 0, z: 0 } });
    const rel = relationsBetween(a, b);
    expect(rel.some((r) => r.relation === "approaching")).toBe(true);
    expect(rel.every((r) => !/danger|threat|suspicious/i.test(r.basis))).toBe(true);
  });
});

describe("historical scene", () => {
  it("no store means no rewind and no simulation", () => {
    const h = historicalScene({ storage: { configured: false, online: false, detail: "" }, observationTimestampsMs: [] });
    expect(h.available).toBe(false);
    expect(h.label).toBe("HISTORICAL SCENE UNAVAILABLE");
  });

  it("stored observations back a real interval, and gaps stay gaps", () => {
    const h = historicalScene({ storage: { configured: true, online: true, detail: "ok" }, observationTimestampsMs: [10, 20, 30] });
    expect(h.available).toBe(true);
    expect(h.fromMs).toBe(10);
    expect(nearestObservation([10, 20, 30], 5000, 2000)).toBeNull();
    expect(nearestObservation([10, 20, 30], 21, 2000)).toBe(20);
  });
});

describe("spatial capability matrix follows runtime state", () => {
  const base = {
    deviceId: "cam1",
    sensor: sensor(),
    allSensors: [sensor()],
    services,
    edgeConnected: false,
    assets: [],
    registration: emptyRegistrationEvidence(),
    pointCloud: summarizePointCloud([]),
    buildingSource: "none" as const,
    observationTimestampsMs: [],
    peer: null,
  };

  it("an rgb-only, uncalibrated, asset-free camera claims no 3d", () => {
    const cells = buildSpatialMatrix({ ...base, model: cameraSpatialModel(device, sensor(), null) });
    expect(spatialCell(cells, "depth").state).toBe("requires_hardware");
    expect(spatialCell(cells, "lidar").state).toBe("requires_hardware");
    expect(spatialCell(cells, "point_cloud").state).toBe("requires_hardware");
    expect(spatialCell(cells, "scene_3d").state).toBe("unavailable");
    expect(spatialCell(cells, "historical_scene").state).toBe("requires_backend");
    expect(spatialCell(cells, "multi_camera_spatial").state).toBe("unavailable");
  });

  it("an osm footprint makes the scene derived, never live", () => {
    const cells = buildSpatialMatrix({ ...base, buildingSource: "osm", model: cameraSpatialModel(device, sensor(), null) });
    expect(spatialCell(cells, "building_model").state).toBe("derived");
    expect(spatialCell(cells, "building_model").produces).toBe("map_derived_3d");
    expect(spatialCell(cells, "scene_3d").state).toBe("derived");
  });

  it("an imported model makes the scene imported and keeps provenance visible", () => {
    const asset = makeAsset({ siteId: "s1", format: "glb", source: "operator export", uploadedBy: "ops" });
    const cells = buildSpatialMatrix({ ...base, assets: [asset], model: cameraSpatialModel(device, sensor(), null) });
    expect(spatialCell(cells, "building_model").state).toBe("imported");
    expect(spatialCell(cells, "scene_3d").state).toBe("imported");
    expect(spatialCell(cells, "building_model").reason).toContain("operator-supplied");
  });

  it("live points make the scene live and reconstruction derived", () => {
    const lid = sensor({ id: "lidar1", modality: "lidar", transport: "edge_bridge", measurable: true });
    const cloud = summarizePointCloud([
      { positions: new Float32Array([0, 0, 0, 1, 1, 1]), colors: null, sensorId: "lidar1", modality: "lidar", atMs: 5, frameId: "f" },
    ]);
    const cells = buildSpatialMatrix({
      ...base, sensor: lid, allSensors: [lid], edgeConnected: true, pointCloud: cloud,
      model: cameraSpatialModel(device, lid, null),
    });
    expect(spatialCell(cells, "point_cloud").state).toBe("live");
    expect(spatialCell(cells, "scene_3d").state).toBe("live");
    expect(spatialCell(cells, "reconstruction_3d").state).toBe("derived");
  });

  it("an unsynchronised peer keeps multi-camera correlation unavailable", () => {
    const cells = buildSpatialMatrix({
      ...base, peer: { registered: true, timeSynchronised: false }, model: cameraSpatialModel(device, sensor(), null),
    });
    const c = spatialCell(cells, "multi_camera_spatial");
    expect(c.state).toBe("unavailable");
    expect(c.reason).toContain("UNCERTAIN");
  });

  it("every cell carries a printable reason and an evidence class", () => {
    const cells = buildSpatialMatrix({ ...base, model: cameraSpatialModel(device, sensor(), null) });
    for (const c of cells) {
      expect(c.reason.length).toBeGreaterThan(10);
      expect(["observed", "inferred", "predicted", "unknown", "unavailable"]).toContain(c.evidence);
    }
  });
});
