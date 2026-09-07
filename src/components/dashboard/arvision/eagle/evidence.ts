// eagle.eye — evidence package.
//
// a capture is only useful to a human reviewer if three things travel with it:
// the untouched frame, the annotated reading of it, and an honest statement of
// what the software did and did not establish. this module builds all three.
//
// the language here is deliberate. the engine detects *observable patterns*. it
// does not establish intent, guilt, or identity, and every package says that in
// plain words so nobody downstream can mistake a score for a conclusion.

import type { CaptureContext } from "./context";
import { contextLine } from "./context";
import { FILTER_MODES, filteredCanvas, type FilterMode } from "./filters";
import type { PatternCategory, ThreatEvent, ThreatTier } from "./engine";

export interface EvidenceVariant {
  key: string;
  label: string;
  note: string;
  dataUrl: string;
  sha256: string;
}

export interface EvidenceRecord {
  recordId: string;
  eventId: string;
  cameraId: string;
  cameraLabel: string;
  trackId: string;
  tier: ThreatTier;
  score: number;
  patterns: PatternCategory[];
  reason: string;
  context: CaptureContext;
  variants: EvidenceVariant[];
  reviewState: "unreviewed" | "confirmed" | "dismissed";
  reviewNote: string;
  reviewedAtMs: number | null;
  createdAtMs: number;
}

export const EVIDENCE_DISCLAIMER = [
  "this package records observable movement and posture patterns captured by a camera under the operator's control.",
  "it does not identify people, does not read faces or biometrics, and does not establish intent, wrongdoing, or guilt.",
  "a pattern score is a prompt for a human to look — never a conclusion, and never a substitute for one.",
  "the thermal variant is a luminance mapping of visible light, not an infrared temperature measurement.",
  "fields recorded as unavailable or denied were genuinely not obtainable at capture time and were not estimated.",
].join(" ");

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  if (!globalThis.crypto?.subtle) return "unavailable-no-subtlecrypto";
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** burn a legible provenance strip across the bottom of a frame copy. */
export function stampCanvas(src: HTMLCanvasElement, lines: string[]): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(src, 0, 0);
  const pad = Math.max(8, Math.round(src.width * 0.008));
  const size = Math.max(11, Math.round(src.width * 0.014));
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  const height = lines.length * (size + 4) + pad * 2;
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.fillRect(0, out.height - height, out.width, height);
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  lines.forEach((l, i) => ctx.fillText(l, pad, out.height - height + pad + size + i * (size + 4)));
  return out;
}

export interface BuildEvidenceInput {
  event: ThreatEvent;
  frame: HTMLCanvasElement;
  annotatedDataUrl?: string;
  context: CaptureContext;
  cameraLabel: string;
  filters?: FilterMode[];
}

export async function buildEvidence(input: BuildEvidenceInput): Promise<EvidenceRecord> {
  const { event, frame, context, cameraLabel } = input;
  const filters = input.filters ?? ["thermal", "lowlight", "edge"];
  const stampLines = [
    `eagle.eye · ${cameraLabel} · event ${event.eventId} · track ${event.trackId}`,
    contextLine(context),
    `pattern tier ${event.threatTier} score ${event.threatScore} · observable patterns only, not an identification or a finding of intent`,
  ];

  const variants: EvidenceVariant[] = [];
  const push = async (key: string, label: string, note: string, canvas: HTMLCanvasElement) => {
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    variants.push({ key, label, note, dataUrl, sha256: await sha256Hex(dataUrl) });
  };

  await push("clean", "clean frame", "unmodified captured frame, no overlay", frame);
  await push("clean-stamped", "clean frame, stamped", "same pixels with the provenance strip burned in", stampCanvas(frame, stampLines));

  if (input.annotatedDataUrl) {
    variants.push({
      key: "annotated",
      label: "annotated frame",
      note: "bounding box, track id, tier and triggered patterns drawn over the captured frame",
      dataUrl: input.annotatedDataUrl,
      sha256: await sha256Hex(input.annotatedDataUrl),
    });
  }

  for (const mode of filters) {
    const meta = FILTER_MODES.find((m) => m.id === mode);
    await push(mode, meta?.label ?? mode, meta?.note ?? "", stampCanvas(filteredCanvas(frame, mode), stampLines));
  }

  return {
    recordId: `evd_${event.eventId}`,
    eventId: event.eventId,
    cameraId: event.cameraId,
    cameraLabel,
    trackId: event.trackId,
    tier: event.threatTier,
    score: event.threatScore,
    patterns: event.patternsTriggered,
    reason: event.naturalLanguageReason,
    context,
    variants,
    reviewState: "unreviewed",
    reviewNote: "",
    reviewedAtMs: null,
    createdAtMs: Date.now(),
  };
}

export function manifestFor(record: EvidenceRecord) {
  return {
    schema: "asherin.eagle.eye/evidence-manifest@1",
    recordId: record.recordId,
    eventId: record.eventId,
    generatedAtUtc: new Date(record.createdAtMs).toISOString(),
    camera: { id: record.cameraId, label: record.cameraLabel },
    subjectTrackId: record.trackId,
    subjectIdentity: "not established — this system performs no identification",
    observedPatterns: record.patterns,
    patternTier: record.tier,
    patternScore: record.score,
    machineReading: record.reason,
    capture: {
      utc: record.context.isoUtc,
      local: record.context.isoLocal,
      timezone: record.context.timezone,
      utcOffsetMinutes: record.context.utcOffsetMinutes,
      coordinates: record.context.coords,
      coordinatesStatus: record.context.coordsStatus,
      coordinatesSource: record.context.coordsSource,
      ipAddress: record.context.ipAddress,
      ipStatus: record.context.ipStatus,
      ipSource: record.context.ipSource,
    },
    files: record.variants.map((v) => ({ file: `${v.key}.jpg`, label: v.label, note: v.note, sha256: v.sha256 })),
    humanReview: {
      state: record.reviewState,
      note: record.reviewNote,
      reviewedAtUtc: record.reviewedAtMs ? new Date(record.reviewedAtMs).toISOString() : null,
    },
    limitations: EVIDENCE_DISCLAIMER,
  };
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const bin = atob(dataUrl.split(",")[1] ?? "");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** a zip containing every variant, the manifest, and a printable pdf report. */
export async function exportEvidenceZip(records: EvidenceRecord[]): Promise<Blob> {
  const [{ default: JSZip }, { jsPDF }] = await Promise.all([import("jszip"), import("jspdf")]);
  const zip = new JSZip();
  const index: unknown[] = [];

  for (const record of records) {
    const folder = zip.folder(record.recordId)!;
    for (const v of record.variants) folder.file(`${v.key}.jpg`, dataUrlToBytes(v.dataUrl));
    const manifest = manifestFor(record);
    folder.file("manifest.json", JSON.stringify(manifest, null, 2));
    folder.file("report.pdf", await buildReportPdf(record, jsPDF));
    index.push(manifest);
  }

  zip.file("index.json", JSON.stringify({ schema: "asherin.eagle.eye/evidence-index@1", exportedAtUtc: new Date().toISOString(), records: index }, null, 2));
  zip.file("READ-ME-FIRST.txt", `${EVIDENCE_DISCLAIMER}\n\neach folder holds one recorded event: the clean frame, a stamped copy, the annotated reading, filter renderings, a manifest with sha-256 hashes of every image, and a printable report.\nverify an image by hashing the exact file bytes and comparing with the manifest entry.\n`);
  return await zip.generateAsync({ type: "blob" });
}

type JsPdfCtor = typeof import("jspdf")["jsPDF"];

export async function buildReportPdf(record: EvidenceRecord, Ctor: JsPdfCtor): Promise<ArrayBuffer> {
  const doc = new Ctor({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40;
  let y = M;

  doc.setFont("helvetica", "bold").setFontSize(15);
  doc.text("eagle.eye — observed pattern report", M, y);
  y += 20;
  doc.setFont("helvetica", "normal").setFontSize(9);
  doc.text(doc.splitTextToSize(EVIDENCE_DISCLAIMER, W - M * 2), M, y);
  y += 46;

  const rows: Array<[string, string]> = [
    ["record", record.recordId],
    ["event", record.eventId],
    ["camera", `${record.cameraLabel} (${record.cameraId})`],
    ["track id", `${record.trackId} — an anonymous per-session label, not an identity`],
    ["captured (utc)", record.context.isoUtc],
    ["captured (local)", `${record.context.isoLocal} · ${record.context.timezone}`],
    ["coordinates", record.context.coords ? `${record.context.coords.lat.toFixed(6)}, ${record.context.coords.lng.toFixed(6)}${record.context.coords.accuracyM ? ` ±${Math.round(record.context.coords.accuracyM)}m` : ""}` : `${record.context.coordsStatus} — ${record.context.coordsSource}`],
    ["network address", record.context.ipAddress ? `${record.context.ipAddress} (via ${record.context.ipSource})` : `unavailable — ${record.context.ipSource}`],
    ["pattern tier", `${record.tier} · score ${record.score}`],
    ["patterns observed", record.patterns.join(", ") || "none recorded"],
    ["machine reading", record.reason],
    ["human review", record.reviewState + (record.reviewNote ? ` — ${record.reviewNote}` : "")],
  ];

  doc.setFontSize(10);
  for (const [k, v] of rows) {
    const wrapped = doc.splitTextToSize(v, W - M * 2 - 120) as string[];
    doc.setFont("helvetica", "bold").text(k, M, y);
    doc.setFont("helvetica", "normal").text(wrapped, M + 120, y);
    y += Math.max(14, wrapped.length * 12) + 2;
    if (y > 700) { doc.addPage(); y = M; }
  }

  for (const v of record.variants) {
    doc.addPage();
    y = M;
    doc.setFont("helvetica", "bold").setFontSize(12).text(v.label, M, y);
    y += 14;
    doc.setFont("helvetica", "normal").setFontSize(8);
    doc.text(doc.splitTextToSize(`${v.note} · sha-256 ${v.sha256}`, W - M * 2), M, y);
    y += 20;
    try {
      const props = doc.getImageProperties(v.dataUrl);
      const w = W - M * 2;
      const h = (props.height / props.width) * w;
      doc.addImage(v.dataUrl, "JPEG", M, y, w, Math.min(h, 640));
    } catch {
      doc.text("image could not be embedded in this report; the original file is in the package.", M, y);
    }
  }

  return doc.output("arraybuffer");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
