import { GEO_CONTENT } from "../../src/lib/geo/geoContent";
import { allStructuralReports } from "../../src/lib/geo/structure";
const rs = allStructuralReports();
let fails = 0;
for (const r of rs) {
  const bad = !r.pass;
  if (bad) fails++;
  console.log(
    `${bad ? "FAIL" : "ok  "} ${r.path.padEnd(38)} SFE ${String(r.sfe.percent).padStart(3)}%  ` +
    `mac ${r.sfe.macro.score.toFixed(2)} mes ${r.sfe.meso.score.toFixed(2)} mic ${r.sfe.micro.score.toFixed(2)}  ` +
    `drift ${r.drift.confidence.toFixed(2)}(${r.drift.cls})  genres ${r.evidence.present.length}/4  ` +
    `stealth ${r.stealth.pass ? "clean" : r.stealth.violations.join(" | ")}`
  );
  if (bad) {
    if (r.sfe.weighted < 0.75) console.log("     sfe:", r.sfe.findings.join(" ; "));
    if (!r.evidence.pass) console.log("     missing genres:", r.evidence.missing.join(", "));
    if (!r.drift.pass) console.log("     drift: age", r.drift.ageDays, "fig", r.drift.oldestFigureDays);
  }
}
console.log(`\n${rs.length - fails}/${rs.length} pass`);
console.log("related sample:", GEO_CONTENT["/glossary/byok-ai"].related);
