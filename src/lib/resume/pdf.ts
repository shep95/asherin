// Resume PDF renderer — jsPDF, letter, ATS-legible single column.
// No colour blocks, no two-column layout, no icons: applicant tracking systems
// linearise the text layer, and a decorative layout is what scrambles it.

import jsPDF from "jspdf";
import type { ResumeStructured } from "./types";

const PAGE_W = 612;
const PAGE_H = 792;
const M = 54;
const CONTENT_W = PAGE_W - M * 2;

export function renderResumePdf(r: ResumeStructured): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  let y = M;

  const ensure = (need: number) => {
    if (y + need > PAGE_H - M) {
      doc.addPage();
      y = M;
    }
  };

  const text = (
    s: string,
    opts: { size?: number; style?: "normal" | "bold" | "italic"; gap?: number; indent?: number; grey?: boolean } = {},
  ) => {
    const size = opts.size ?? 9.5;
    doc.setFont("helvetica", opts.style ?? "normal");
    doc.setFontSize(size);
    doc.setTextColor(opts.grey ? 110 : 25);
    const indent = opts.indent ?? 0;
    const lines = doc.splitTextToSize(s, CONTENT_W - indent) as string[];
    const lh = size * 1.32;
    ensure(lines.length * lh);
    doc.text(lines, M + indent, y);
    y += lines.length * lh + (opts.gap ?? 0);
  };

  const rule = () => {
    ensure(10);
    doc.setDrawColor(190);
    doc.setLineWidth(0.6);
    doc.line(M, y, PAGE_W - M, y);
    y += 10;
  };

  const section = (label: string) => {
    y += 6;
    ensure(24);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(70);
    doc.text(label.toUpperCase(), M, y);
    y += 5;
    doc.setDrawColor(150);
    doc.setLineWidth(0.8);
    doc.line(M, y, PAGE_W - M, y);
    y += 12;
  };

  // ── Header ───────────────────────────────────────────────────────────────
  if (r.name) text(r.name, { size: 19, style: "bold", gap: 2 });
  if (r.headline) text(r.headline, { size: 10.5, grey: true, gap: 3 });
  const contact = [r.email, r.phone, r.location, ...r.links].filter(Boolean).join("  ·  ");
  if (contact) text(contact, { size: 8.5, grey: true, gap: 6 });
  rule();

  // ── Summary ──────────────────────────────────────────────────────────────
  if (r.summary) {
    section("Summary");
    text(r.summary, { size: 9.5, gap: 2 });
  }

  // ── Experience ───────────────────────────────────────────────────────────
  if (r.experience.length) {
    section("Experience");
    r.experience.forEach((e, i) => {
      ensure(40);
      const left = [e.title, e.company].filter(Boolean).join(" — ");
      const right = [e.start, e.end || "Present"].filter(Boolean).join(" – ");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(25);
      doc.text(left || "Role", M, y);
      if (right) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(110);
        doc.text(right, PAGE_W - M, y, { align: "right" });
      }
      y += 13;
      if (e.location) text(e.location, { size: 8.5, grey: true, gap: 2 });
      for (const b of e.bullets) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(25);
        const lines = doc.splitTextToSize(b, CONTENT_W - 14) as string[];
        ensure(lines.length * 12.5);
        doc.text("•", M + 2, y);
        doc.text(lines, M + 14, y);
        y += lines.length * 12.5;
      }
      if (i < r.experience.length - 1) y += 8;
    });
  }

  // ── Projects ─────────────────────────────────────────────────────────────
  if (r.projects.length) {
    section("Projects");
    for (const p of r.projects) {
      text(p.name, { size: 9.5, style: "bold" });
      if (p.description) text(p.description, { size: 9.5, indent: 10 });
      if (p.link) text(p.link, { size: 8.5, grey: true, indent: 10, gap: 4 });
    }
  }

  // ── Education ────────────────────────────────────────────────────────────
  if (r.education.length) {
    section("Education");
    for (const e of r.education) {
      const line = [ [e.degree, e.field].filter(Boolean).join(" "), e.school ].filter(Boolean).join(" — ");
      const dates = [e.start, e.end].filter(Boolean).join(" – ");
      ensure(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(25);
      doc.text(line || e.school, M, y);
      if (dates) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(110);
        doc.text(dates, PAGE_W - M, y, { align: "right" });
      }
      y += 13;
      if (e.note) text(e.note, { size: 8.5, grey: true, gap: 3 });
    }
  }

  // ── Skills / Certifications ──────────────────────────────────────────────
  if (r.skills.length) {
    section("Skills");
    text(r.skills.join("  ·  "), { size: 9.5 });
  }
  if (r.certifications.length) {
    section("Certifications");
    text(r.certifications.join("  ·  "), { size: 9.5 });
  }

  return doc;
}

export function downloadResumePdf(r: ResumeStructured, filename?: string) {
  const doc = renderResumePdf(r);
  const safe = (filename || r.name || "resume").replace(/[^\w.-]+/g, "_");
  doc.save(`${safe}.pdf`);
}

/** Same document as a Blob — used when the resume is attached to an application. */
export function resumePdfBase64(r: ResumeStructured): string {
  const doc = renderResumePdf(r);
  const data = doc.output("datauristring");
  return data.slice(data.indexOf(",") + 1);
}
