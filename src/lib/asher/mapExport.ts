// mapExport — intelligence-product generation from the live overlay.
//
// NARRATIVE
// GeoJSON alone is a developer artefact. An operator needs the overlay in the
// formats the rest of the stack consumes — KML for Earth, GPX for handhelds,
// WKT/CSV for a database — plus a written briefing that carries provenance and
// confidence, because an unsourced claim on a map is a liability.
//
// FLAWS THIS MODULE IS BUILT AGAINST
//  - XML injection through operator-supplied labels → every text node is
//    entity-escaped before it touches KML/GPX.
//  - CSV formula injection (a label beginning = + - @ executing in a
//    spreadsheet) → leading formula characters are neutralised.
//  - Leaked object URLs → every download revokes its blob URL on the next tick
//    rather than synchronously, so Safari still completes the download.
//  - Silent precision loss → coordinates serialise at 6 dp (~0.11 m), enough
//    for parcel work and stable across round-trips.

import {
  annoCenter, annoColor, annoMetric, toGeoJSON,
  fmtDistance, pathLengthM, polygonAreaM2, fmtArea,
  type MapAnnotation,
} from "@/lib/asher/mapAnnotations";
import type { MapCase } from "@/lib/asher/mapCases";

const xml = (s: string): string =>
  String(s ?? "").replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string));

/** Neutralise spreadsheet formula injection, then quote for CSV. */
const csv = (s: unknown): string => {
  let v = String(s ?? "");
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
};

const c6 = (n: number): string => Number(n).toFixed(6);

/** KML colour is aabbggrr — the inverse byte order of CSS #rrggbb. */
function kmlColor(hex: string, alpha = "ff"): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h.slice(0, 6);
  const r = full.slice(0, 2), g = full.slice(2, 4), b = full.slice(4, 6);
  return `${alpha}${b}${g}${r}`.toLowerCase();
}

export function toKML(list: MapAnnotation[], docName = "Asher Overlay"): string {
  const styles = Array.from(new Set(list.map((a) => annoColor(a)))).map(
    (col, i) => `  <Style id="s${i}">
    <LineStyle><color>${kmlColor(col)}</color><width>2</width></LineStyle>
    <PolyStyle><color>${kmlColor(col, "44")}</color></PolyStyle>
    <IconStyle><color>${kmlColor(col)}</color></IconStyle>
  </Style>`,
  );
  const styleIndex = new Map(Array.from(new Set(list.map((a) => annoColor(a)))).map((c, i) => [c, `#s${i}`]));

  const placemarks = list.map((a) => {
    const sid = styleIndex.get(annoColor(a)) ?? "";
    const desc = [a.note, annoMetric(a), a.sourceUrl, a.confidence != null ? `confidence ${a.confidence}%` : null]
      .filter(Boolean).join(" · ");
    const head = `    <name>${xml(a.label)}</name>\n    <description>${xml(desc)}</description>\n    <styleUrl>${sid}</styleUrl>`;

    if (a.kind === "polygon" && a.path?.length) {
      const ring = [...a.path, a.path[0]].map((p) => `${c6(p.lng)},${c6(p.lat)},0`).join(" ");
      return `  <Placemark>\n${head}\n    <Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon>\n  </Placemark>`;
    }
    if (a.kind === "line" && a.path?.length) {
      const line = a.path.map((p) => `${c6(p.lng)},${c6(p.lat)},0`).join(" ");
      return `  <Placemark>\n${head}\n    <LineString><tessellate>1</tessellate><coordinates>${line}</coordinates></LineString>\n  </Placemark>`;
    }
    if (a.kind === "circle" && a.lat != null && a.lng != null && a.radiusM) {
      // KML has no circle primitive — emit a 64-gon so Earth renders it faithfully.
      const pts: string[] = [];
      const latR = a.radiusM / 111_320;
      const lngR = a.radiusM / (111_320 * Math.max(0.01, Math.cos((a.lat * Math.PI) / 180)));
      for (let i = 0; i <= 64; i++) {
        const t = (2 * Math.PI * i) / 64;
        pts.push(`${c6(a.lng + lngR * Math.cos(t))},${c6(a.lat + latR * Math.sin(t))},0`);
      }
      return `  <Placemark>\n${head}\n    <Polygon><outerBoundaryIs><LinearRing><coordinates>${pts.join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon>\n  </Placemark>`;
    }
    return `  <Placemark>\n${head}\n    <Point><coordinates>${c6(a.lng ?? 0)},${c6(a.lat ?? 0)},0</coordinates></Point>\n  </Placemark>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>${xml(docName)}</name>
${styles.join("\n")}
${placemarks.join("\n")}
</Document>
</kml>`;
}

export function toGPX(list: MapAnnotation[], docName = "Asher Overlay"): string {
  const wpts = list
    .filter((a) => a.lat != null && a.lng != null)
    .map((a) => `  <wpt lat="${c6(a.lat!)}" lon="${c6(a.lng!)}"><name>${xml(a.label)}</name>${a.note ? `<desc>${xml(a.note)}</desc>` : ""}</wpt>`);
  const trks = list
    .filter((a) => (a.kind === "line" || a.kind === "polygon") && a.path?.length)
    .map((a) => {
      const pts = a.path!.map((p) => `      <trkpt lat="${c6(p.lat)}" lon="${c6(p.lng)}"/>`).join("\n");
      return `  <trk><name>${xml(a.label)}</name><trkseg>\n${pts}\n  </trkseg></trk>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Asher Intelligence Map" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${xml(docName)}</name><time>${new Date().toISOString()}</time></metadata>
${wpts.join("\n")}
${trks.join("\n")}
</gpx>`;
}

export function toCsvWkt(list: MapAnnotation[]): string {
  const head = ["id", "label", "kind", "category", "color", "source", "confidence", "source_url", "note", "metric", "created_at", "wkt"];
  const rows = list.map((a) => {
    let wkt = "";
    if (a.kind === "polygon" && a.path?.length) {
      wkt = `POLYGON((${[...a.path, a.path[0]].map((p) => `${c6(p.lng)} ${c6(p.lat)}`).join(", ")}))`;
    } else if (a.kind === "line" && a.path?.length) {
      wkt = `LINESTRING(${a.path.map((p) => `${c6(p.lng)} ${c6(p.lat)}`).join(", ")})`;
    } else if (a.lat != null && a.lng != null) {
      wkt = `POINT(${c6(a.lng)} ${c6(a.lat)})`;
    }
    return [
      a.id, a.label, a.kind, a.category ?? "", annoColor(a), a.source,
      a.confidence ?? "", a.sourceUrl ?? "", a.note ?? "", annoMetric(a) ?? "",
      new Date(a.createdAt).toISOString(), wkt,
    ].map(csv).join(",");
  });
  return [head.map(csv).join(","), ...rows].join("\n");
}

/* ── Written intelligence product ───────────────────────────────────────── */

export interface BriefingContext {
  caseRec: MapCase;
  annotations: MapAnnotation[];
  mapCenter?: { lat: number; lng: number; zoom: number };
  baseLayer?: string;
  activeLayers?: string[];
  colocations?: Array<{ aLabel: string; bLabel: string; distanceM: number }>;
  analysisNotes?: string[];
}

export function buildBriefing(ctx: BriefingContext): string {
  const { caseRec, annotations } = ctx;
  const now = new Date();
  const byCat = annotations.reduce<Record<string, number>>((acc, a) => {
    const k = a.category ?? "unclassified";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const sourced = annotations.filter((a) => a.sourceUrl).length;
  const aiPlaced = annotations.filter((a) => a.source === "asher-ai").length;

  const lines: string[] = [];
  lines.push(`# INTELLIGENCE BRIEFING — ${caseRec.name}`);
  lines.push("");
  lines.push(`**Classification:** ${caseRec.classification}  `);
  lines.push(`**Generated:** ${now.toISOString()} (UTC)  `);
  lines.push(`**Overlay objects:** ${annotations.length}  `);
  if (ctx.mapCenter) {
    lines.push(`**Map focus:** ${ctx.mapCenter.lat.toFixed(5)}, ${ctx.mapCenter.lng.toFixed(5)} @ z${ctx.mapCenter.zoom}  `);
  }
  if (ctx.baseLayer) lines.push(`**Base cartography:** ${ctx.baseLayer}  `);
  if (ctx.activeLayers?.length) lines.push(`**Active feeds:** ${ctx.activeLayers.join(", ")}  `);
  lines.push("");

  lines.push("## 1. Composition");
  lines.push("");
  lines.push("| Class | Objects |");
  lines.push("|---|---|");
  Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => lines.push(`| ${k} | ${v} |`));
  lines.push("");
  lines.push(`Sourced objects: **${sourced}/${annotations.length}**. AI-placed: **${aiPlaced}**.`);
  lines.push("");

  lines.push("## 2. Object register");
  lines.push("");
  if (!annotations.length) {
    lines.push("_Overlay empty — no objects to report._");
  } else {
    lines.push("| # | Label | Kind | Class | Centre | Metric | Conf. | Origin |");
    lines.push("|---|---|---|---|---|---|---|---|");
    annotations.forEach((a, i) => {
      const c = annoCenter(a);
      lines.push(
        `| ${i + 1} | ${a.label} | ${a.kind} | ${a.category ?? "—"} | ${c ? `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}` : "—"} | ${annoMetric(a) ?? "—"} | ${a.confidence != null ? `${a.confidence}%` : "—"} | ${a.source === "asher-ai" ? "AI" : "OP"} |`,
      );
    });
  }
  lines.push("");

  const routes = annotations.filter((a) => a.kind === "line" && a.path?.length);
  const zones = annotations.filter((a) => a.kind === "polygon" && a.path?.length);
  if (routes.length || zones.length) {
    lines.push("## 3. Geometry summary");
    lines.push("");
    routes.forEach((r) => lines.push(`- **${r.label}** — route, ${fmtDistance(pathLengthM(r.path!))} across ${r.path!.length} nodes.`));
    zones.forEach((z) => lines.push(`- **${z.label}** — zone, ${fmtArea(polygonAreaM2(z.path!))}.`));
    lines.push("");
  }

  if (ctx.colocations?.length) {
    lines.push("## 4. Co-location findings");
    lines.push("");
    lines.push("| A | B | Separation |");
    lines.push("|---|---|---|");
    ctx.colocations.slice(0, 25).forEach((c) => lines.push(`| ${c.aLabel} | ${c.bLabel} | ${fmtDistance(c.distanceM)} |`));
    lines.push("");
  }

  if (ctx.analysisNotes?.length) {
    lines.push("## 5. Analytical products");
    lines.push("");
    ctx.analysisNotes.forEach((n) => lines.push(`- ${n}`));
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  const cited = annotations.filter((a) => a.sourceUrl);
  if (cited.length) cited.forEach((a, i) => lines.push(`${i + 1}. ${a.label} — ${a.sourceUrl}`));
  else lines.push("_No object carries an upstream citation. Treat this product as operator-asserted, not source-verified._");
  lines.push("");
  lines.push("---");
  lines.push("_Terrain: Copernicus GLO-30 via Open-Meteo elevation. Road graph: OSRM/OpenStreetMap. Geocoding: Nominatim. Solar geometry: NOAA closed-form. Figures are computed, not estimated by a language model._");

  return lines.join("\n");
}

/* ── Download plumbing ──────────────────────────────────────────────────── */

export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick — a synchronous revoke aborts the download in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export type ExportFormat = "geojson" | "kml" | "gpx" | "csv" | "briefing";

export function exportOverlay(fmt: ExportFormat, list: MapAnnotation[], ctx?: BriefingContext): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const base = `asher-overlay-${stamp}`;
  switch (fmt) {
    case "geojson":
      return downloadText(`${base}.geojson`, JSON.stringify(toGeoJSON(list), null, 2), "application/geo+json");
    case "kml":
      return downloadText(`${base}.kml`, toKML(list, ctx?.caseRec.name), "application/vnd.google-earth.kml+xml");
    case "gpx":
      return downloadText(`${base}.gpx`, toGPX(list, ctx?.caseRec.name), "application/gpx+xml");
    case "csv":
      return downloadText(`${base}.csv`, toCsvWkt(list), "text/csv");
    case "briefing":
      if (!ctx) return;
      return downloadText(`asher-briefing-${stamp}.md`, buildBriefing(ctx), "text/markdown");
  }
}
