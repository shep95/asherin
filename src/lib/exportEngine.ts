// Multi-format export engine — PDF / CSV / JSON / Markdown
import jsPDF from "jspdf";
import { logAudit } from "./auditLogger";

export interface ExportItem {
  title: string;
  url?: string;
  snippet?: string;
  metadata?: Record<string, unknown>;
}

function download(filename: string, content: string | Blob, mime: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportJSON(name: string, items: ExportItem[], meta: Record<string, unknown> = {}) {
  const payload = {
    exported_at: new Date().toISOString(),
    name,
    item_count: items.length,
    metadata: meta,
    items,
  };
  download(`${name}.json`, JSON.stringify(payload, null, 2), "application/json");
  await logAudit({ action: "export", resourceType: "json", payload: { name, count: items.length } });
}

export async function exportCSV(name: string, items: ExportItem[]) {
  const headers = ["title", "url", "snippet"];
  const escape = (v: string) => `"${(v ?? "").toString().replace(/"/g, '""')}"`;
  const rows = items.map((i) => headers.map((h) => escape((i as any)[h] ?? "")).join(","));
  const csv = [headers.join(","), ...rows].join("\n");
  download(`${name}.csv`, csv, "text/csv");
  await logAudit({ action: "export", resourceType: "csv", payload: { name, count: items.length } });
}

export async function exportMarkdown(name: string, items: ExportItem[], meta: Record<string, unknown> = {}) {
  const lines = [
    `# ${name}`,
    ``,
    `*Exported: ${new Date().toISOString()}*`,
    `*Items: ${items.length}*`,
    ``,
    `---`,
    ``,
  ];
  items.forEach((it, i) => {
    lines.push(`## ${i + 1}. ${it.title}`);
    if (it.url) lines.push(`**Source:** [${it.url}](${it.url})`);
    if (it.snippet) lines.push(``, it.snippet);
    lines.push(``, `---`, ``);
  });
  download(`${name}.md`, lines.join("\n"), "text/markdown");
  await logAudit({ action: "export", resourceType: "markdown", payload: { name, count: items.length } });
}

export async function exportPDF(name: string, items: ExportItem[], meta: Record<string, unknown> = {}) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 50;
  const lineHeight = 14;
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(name, margin, y);
  y += 28;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Exported: ${new Date().toISOString()} • ${items.length} items`, margin, y);
  y += 24;

  doc.setDrawColor(200);
  doc.line(margin, y, 612 - margin, y);
  y += 18;

  doc.setTextColor(20);
  items.forEach((it, idx) => {
    if (y > 720) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    const titleLines = doc.splitTextToSize(`${idx + 1}. ${it.title}`, 500);
    doc.text(titleLines, margin, y);
    y += titleLines.length * lineHeight;
    if (it.url) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 200);
      doc.text(it.url.slice(0, 100), margin, y);
      doc.setTextColor(20);
      y += lineHeight;
    }
    if (it.snippet) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const snippet = doc.splitTextToSize(it.snippet, 500);
      doc.text(snippet, margin, y);
      y += snippet.length * lineHeight;
    }
    y += 12;
  });

  doc.save(`${name}.pdf`);
  await logAudit({ action: "export", resourceType: "pdf", payload: { name, count: items.length } });
}
