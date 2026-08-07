// Client-side text extraction for resume uploads.
// PDF -> pdfjs (real text layer), DOCX -> mammoth, everything else -> File.text().
// Extraction happens on the device so an unparseable file never costs a model call.

const MAX_BYTES = 12 * 1024 * 1024;

export const ACCEPTED_RESUME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
];

export interface ExtractResult {
  text: string;
  pages?: number;
  method: "pdf" | "docx" | "text";
}

export async function extractResumeText(file: File): Promise<ExtractResult> {
  if (file.size > MAX_BYTES) {
    throw new Error(`File is ${(file.size / 1_048_576).toFixed(1)} MB — the limit is 12 MB.`);
  }
  const name = file.name.toLowerCase();

  if (file.type === "application/pdf" || name.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    // Worker is bundled by Vite as a module worker; pdfjs resolves it by URL.
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const chunks: string[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      // Re-introduce line breaks pdfjs drops: a y-shift means a new line.
      let lastY: number | null = null;
      let line = "";
      const out: string[] = [];
      for (const item of content.items as Array<{ str?: string; transform?: number[] }>) {
        const s = item.str ?? "";
        const y = item.transform?.[5] ?? null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
          out.push(line.trim());
          line = "";
        }
        line += s + " ";
        lastY = y;
      }
      if (line.trim()) out.push(line.trim());
      chunks.push(out.filter(Boolean).join("\n"));
      page.cleanup();
    }
    const text = chunks.join("\n\n").replace(/[ \t]{2,}/g, " ").trim();
    if (!text) {
      throw new Error("That PDF has no selectable text — it is a scan. Export a text PDF or paste the content in.");
    }
    return { text, pages: doc.numPages, method: "pdf" };
  }

  if (name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    const text = String(value || "").trim();
    if (!text) throw new Error("That document came back empty.");
    return { text, method: "docx" };
  }

  const text = (await file.text()).trim();
  if (!text) throw new Error("That file came back empty.");
  return { text, method: "text" };
}
