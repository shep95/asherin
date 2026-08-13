import { describe, it, expect } from "vitest";
import { detectGeoIntent } from "@/lib/geoIntent";

describe("detectGeoIntent", () => {
  it("opens the map for a fly request", () => {
    expect(detectGeoIntent("take me to Dallas Texas")).toEqual({ place: "Dallas Texas", property: false });
  });

  it("marks an occupancy question as a property fly", () => {
    expect(detectGeoIntent("who lives at 1600 Pennsylvania Avenue?")).toEqual({
      place: "1600 Pennsylvania Avenue",
      property: true,
    });
  });

  it("treats a bare street address as a property fly", () => {
    const got = detectGeoIntent("742 Evergreen Terrace Springfield");
    expect(got?.property).toBe(true);
  });

  it("ignores diagram senses of the word map", () => {
    expect(detectGeoIntent("build me a relationship map of the board")).toBeNull();
    expect(detectGeoIntent("draw an intel map for this org")).toBeNull();
  });

  it("ignores non-geography turns", () => {
    expect(detectGeoIntent("summarize this contract")).toBeNull();
  });
});
