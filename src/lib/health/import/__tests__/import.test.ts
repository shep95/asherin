import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseGeneticsFile, RSID_MAP } from "../geneticsFile";
import {
  parseWearableFile,
  rollingBaseline,
  trendDirection,
  deviationFromBaseline,
  wearableFindings
} from "../wearables";
import { normaliseLabDocument } from "../labsDocument";

describe("Genetics Import", () => {
  it("should parse 23andMe TSV format", async () => {
    const tsv = [
      "# 23andMe raw data",
      "rsid\tchromosome\tposition\tgenotype",
      "rs1801133\t1\t11856378\tAG",
      "rs6025\t1\t169519049\tGG",
      "rs9939609\t16\t53820527\tAT", // known but uncatalogued
      "rs000000\t1\t1\tAA", // unmapped
    ].join("\n");

    const result = await parseGeneticsFile("genome.txt", tsv);
    expect(result.error).toBeNull();
    expect(result.variantsRead).toBe(4);
    expect(result.mapped).toBe(2);
    expect(result.knownButUncatalogued).toBe(1);
    expect(result.unmapped).toBe(1);
    
    const mthfr = result.entries.find(e => e.geneKey === "mthfr");
    expect(mthfr).toBeDefined();
    expect(mthfr?.genotype).toContain("AG");
    expect(mthfr?.genotype).toContain("c677t");
  });

  it("should parse VCF format", async () => {
    const vcf = [
      "##fileformat=VCFv4.2",
      "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tSAMPLE",
      "1\t11856378\trs1801133\tA\tG\t.\t.\t.\tGT\t0/1",
    ].join("\n");

    const result = await parseGeneticsFile("genome.vcf", vcf);
    expect(result.error).toBeNull();
    expect(result.mapped).toBe(1);
    expect(result.entries[0].geneKey).toBe("mthfr");
    expect(result.entries[0].genotype).toBe("AG · c677t");
  });

  it("should reject files over the size limit", async () => {
    const largeText = "A".repeat(40 * 1024 * 1024 + 1);
    const result = await parseGeneticsFile("huge.txt", largeText);
    expect(result.error).toContain("larger than 40mb");
  });
});

describe("Wearables Import", () => {
  it("should parse Apple Health XML", async () => {
    const xml = `
      <?xml version="1.0" encoding="UTF-8"?>
      <HealthData>
        <Record type="HKQuantityTypeIdentifierRestingHeartRate" startDate="2023-01-01 08:00:00 +0000" value="65" unit="count/min"/>
        <Record type="HKQuantityTypeIdentifierRestingHeartRate" startDate="2023-01-02 08:00:00 +0000" value="68" unit="count/min"/>
        <Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2023-01-01 22:00:00 +0000" endDate="2023-01-02 06:00:00 +0000" value="HKCategoryValueSleepAnalysisInBed"/>
      </HealthData>
    `;
    const result = await parseWearableFile("export.xml", xml);
    expect(result.error).toBeNull();
    expect(result.series).toHaveLength(2);
    
    const rhr = result.series.find(s => s.kind === "resting-heart-rate");
    expect(rhr?.points).toHaveLength(2);
    expect(rhr?.points[0].v).toBe(65);
    
    const sleep = result.series.find(s => s.kind === "sleep");
    expect(sleep?.points[0].v).toBe(8); // 8 hours
  });

  it("should parse generic CSV with delimiter detection", async () => {
    const csv = [
      "Timestamp;Glucose (mg/dL);Steps",
      "2023-01-01 10:00:00;105;1000",
      "2023-01-01 11:00:00;110;2000",
    ].join("\n");
    
    const result = await parseWearableFile("cgm.csv", csv);
    expect(result.error).toBeNull();
    expect(result.series).toHaveLength(2);
    
    const glucose = result.series.find(s => s.kind === "glucose");
    expect(glucose?.unit).toBe("mg/dL");
    expect(glucose?.points).toHaveLength(2);
  });

  it("should downsample (capSeries) when exceeding MAX_POINTS_PER_SERIES", async () => {
    // MAX_POINTS_PER_SERIES is 5000.
    // We'll simulate this by providing many points on different days.
    let csv = "time,hrv\n";
    for (let i = 0; i < 6000; i++) {
      const date = new Date(2020, 0, 1 + Math.floor(i / 10));
      csv += `${date.toISOString()},${70 + (i % 10)}\n`;
    }
    
    const result = await parseWearableFile("long.csv", csv);
    const hrv = result.series[0];
    // It should be capped at 5000.
    expect(hrv.points.length).toBeLessThanOrEqual(5000);
    // And it should have tags like 'mean', 'min', 'max' because it was downsampled.
    expect(hrv.points.some(p => p.tag === "mean")).toBe(true);
  });
});

describe("Wearables Analysis", () => {
  const mockSeries = (values: number[]): any => ({
    id: "test",
    kind: "hrv",
    source: "test-source",
    unit: "ms",
    points: values.map((v, i) => ({
      t: new Date(Date.now() - (values.length - i) * 86400000).toISOString(),
      v
    }))
  });

  it("should calculate rolling baseline", () => {
    const series = mockSeries([50, 60, 70, 80, 90]);
    const baseline = rollingBaseline(series, 30);
    expect(baseline.n).toBe(5);
    expect(baseline.mean).toBe(70);
    expect(baseline.stdDev).toBeGreaterThan(0);
  });

  it("should detect trend direction", () => {
    const rising = mockSeries([10, 10, 10, 20, 20, 20]);
    expect(trendDirection(rising)).toBe("rising");

    const falling = mockSeries([20, 20, 20, 10, 10, 10]);
    expect(trendDirection(falling)).toBe("falling");

    const flat = mockSeries([10, 10, 10, 10.1, 10.1, 10.1]);
    expect(trendDirection(flat)).toBe("flat");
  });

  it("should generate findings for deviations", () => {
    // 30 points of baseline at 50, then a big jump
    const values = new Array(30).fill(50);
    values.push(100);
    const series = mockSeries(values);
    
    const findings = wearableFindings([series]);
    expect(findings).toHaveLength(1);
    expect(findings[0].direction).toBe("elevated");
    expect(findings[0].label).toContain("elevated");
  });
});

describe("Labs Document Import", () => {
  it("should normalise lab document with unit conversion", () => {
    const text = `
      Date of service: 2023-05-15
      Glucose 5.5 mmol/L (3.9 - 5.5)
      LDL Cholesterol 4.0 mmol/L
      Haemoglobin 14.5 g/dL
    `;
    
    const result = normaliseLabDocument(text);
    expect(result.collectedAt).toBe(new Date("2023-05-15").toISOString());
    
    const glucose = result.values.find(v => v.key === "glucose");
    expect(glucose?.rawValue).toBe(5.5);
    expect(glucose?.value).toBeCloseTo(99.1, 1); // 5.5 * 18.0182
    expect(glucose?.refLow).toBe(3.9);
    expect(glucose?.refHigh).toBe(5.5);

    const ldl = result.values.find(v => v.key === "ldl");
    expect(ldl?.value).toBeCloseTo(154.68, 1); // 4.0 * 38.67
    
    const hgb = result.values.find(v => v.key === "hemoglobin");
    expect(hgb?.value).toBe(14.5); // no conversion for g/dL
  });

  it("should detect collection dates in various formats", () => {
    expect(normaliseLabDocument("Collected: May 20, 2023").collectedAt).toBe(new Date("2023-05-20").toISOString());
    expect(normaliseLabDocument("05/20/2023").collectedAt).toBe(new Date("2023-05-20").toISOString());
  });
});
