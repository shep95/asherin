import { describe, expect, it } from "vitest";
import { bodyShape, REFERENCE_HEIGHT_CM, SHAPE_BANDS, shapeKey } from "../bodyShape";

const bandIndex = (key: string) => SHAPE_BANDS.findIndex((b) => b.key === key);

describe("bodyShape", () => {
  it("leaves the reference body alone when nothing is known", () => {
    const s = bodyShape({});
    expect(s.heightScale).toBe(1);
    expect(s.scales.every((v) => v === 1)).toBe(true);
    expect(s.personalised).toBe(false);
  });

  it("scales stature against the reference height", () => {
    expect(bodyShape({ heightCm: REFERENCE_HEIGHT_CM }).heightScale).toBeCloseTo(1, 5);
    expect(bodyShape({ heightCm: 200 }).heightScale).toBeGreaterThan(1);
    expect(bodyShape({ heightCm: 150 }).heightScale).toBeLessThan(1);
    expect(bodyShape({ heightCm: 400 }).heightScale).toBeLessThanOrEqual(1.25);
    expect(bodyShape({ heightCm: 40 }).heightScale).toBeGreaterThanOrEqual(0.78);
  });

  it("widens the waist band when a large waist is measured", () => {
    const slim = bodyShape({ heightCm: 175, waistCm: 74 });
    const wide = bodyShape({ heightCm: 175, waistCm: 110 });
    const i = bandIndex("waist");
    expect(wide.scales[i]).toBeGreaterThan(slim.scales[i]);
    expect(wide.personalised).toBe(true);
  });

  it("moves only the measured band, not the whole body", () => {
    const s = bodyShape({ heightCm: 175, waistCm: 110 });
    expect(s.scales[bandIndex("waist")]).toBeGreaterThan(1.1);
    expect(s.scales[bandIndex("neck")]).toBeCloseTo(1, 2);
  });

  it("gives a female reference wider hips and a narrower shoulder than male", () => {
    const f = bodyShape({ sex: "female" });
    const m = bodyShape({ sex: "male" });
    expect(f.scales[bandIndex("hip")]).toBeGreaterThan(m.scales[bandIndex("hip")]);
    expect(f.scales[bandIndex("shoulder")]).toBeLessThan(m.scales[bandIndex("shoulder")]);
    expect(f.personalised).toBe(true);
    expect(shapeKey(f)).not.toBe(shapeKey(m));
  });

  it("says out loud that a female setting reshapes a male reference mesh", () => {
    expect(bodyShape({ sex: "female" }).notes.join(" ")).toContain("male reference dataset");
  });

  it("falls back to bmi girth when no circumference has been measured", () => {
    const heavy = bodyShape({ heightCm: 175, weightKg: 110 });
    const light = bodyShape({ heightCm: 175, weightKg: 55 });
    expect(heavy.scales[bandIndex("waist")]).toBeGreaterThan(light.scales[bandIndex("waist")]);
    expect(heavy.notes.join(" ")).toContain("coarse guide");
  });

  it("prefers a measured circumference over the bmi fallback", () => {
    const s = bodyShape({ heightCm: 175, weightKg: 110, waistCm: 70 });
    expect(s.scales[bandIndex("waist")]).toBeLessThan(1);
  });

  it("never emits a non-finite or absurd scale", () => {
    const s = bodyShape({ heightCm: 0, weightKg: -4, waistCm: Number.NaN, hipCm: 1e9, sex: "female" });
    expect(Number.isFinite(s.heightScale)).toBe(true);
    s.scales.forEach((v) => {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0.7);
      expect(v).toBeLessThanOrEqual(1.45);
    });
  });

  it("produces one scale per band and a key that tracks changes", () => {
    const a = bodyShape({ heightCm: 175 });
    const b = bodyShape({ heightCm: 176 });
    expect(a.scales).toHaveLength(SHAPE_BANDS.length);
    expect(shapeKey(a)).not.toBe(shapeKey(b));
    expect(shapeKey(a)).toBe(shapeKey(bodyShape({ heightCm: 175 })));
  });
});
