/**
 * AUREON — Metadata Sanitizer
 *
 * Scrubs EXIF, GPS, color profiles, comments, XMP, and other metadata from
 * images and PDFs before upload OR download. Uses canvas re-encode for images
 * (which inherently drops all metadata) and lightweight stream cleaning for
 * PDFs/SVGs. Falls back to original blob if sanitization fails.
 *
 * USAGE:
 *   const clean = await stripMetadata(file);            // for uploads
 *   downloadSanitized(blob, "filename.jpg");            // for downloads
 *   const clean = await stripMetadataFromUrl(url);      // for asset URLs (logos, wallpapers)
 */

const IMAGE_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
]);

/**
 * Re-encode an image via canvas — strips ALL metadata (EXIF, GPS, ICC, XMP, comments).
 */
async function reencodeImage(blob: Blob, mime: string): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    ctx.drawImage(img, 0, 0);
    // Force JPEG/PNG/WebP encode — drops every metadata segment
    const outType = mime === "image/png" || mime === "image/webp" ? mime : "image/jpeg";
    const quality = outType === "image/jpeg" ? 0.92 : undefined;
    return await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b ?? blob), outType, quality);
    });
  } catch {
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Strip metadata from a SVG (removes <metadata>, <desc>, RDF, comments).
 */
async function cleanSvg(blob: Blob): Promise<Blob> {
  try {
    const text = await blob.text();
    const cleaned = text
      .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
      .replace(/<desc[\s\S]*?<\/desc>/gi, "")
      .replace(/<rdf:RDF[\s\S]*?<\/rdf:RDF>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/\s(inkscape|sodipodi|rdf|cc|dc):[a-zA-Z-]+="[^"]*"/g, "");
    return new Blob([cleaned], { type: "image/svg+xml" });
  } catch {
    return blob;
  }
}

/**
 * Strip top-level /Info dict and /Metadata stream references from a PDF (best-effort).
 * Note: full PDF re-encoding is not safe in-browser — this removes the most common
 * metadata vectors without breaking the document.
 */
async function cleanPdf(blob: Blob): Promise<Blob> {
  try {
    const buf = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder("latin1").decode(buf);
    let cleaned = text
      // strip XMP metadata streams
      .replace(/<<\s*\/Type\s*\/Metadata[\s\S]*?stream[\s\S]*?endstream/g, "")
      // strip Info dictionary entries
      .replace(/\/Author\s*\([^)]*\)/g, "/Author ()")
      .replace(/\/Creator\s*\([^)]*\)/g, "/Creator ()")
      .replace(/\/Producer\s*\([^)]*\)/g, "/Producer ()")
      .replace(/\/Title\s*\([^)]*\)/g, "/Title ()")
      .replace(/\/Subject\s*\([^)]*\)/g, "/Subject ()")
      .replace(/\/Keywords\s*\([^)]*\)/g, "/Keywords ()");
    return new Blob([new TextEncoder().encode(cleaned)], { type: "application/pdf" });
  } catch {
    return blob;
  }
}

/**
 * Public API — sanitize ANY File/Blob before upload or download.
 */
export async function stripMetadata(file: File | Blob): Promise<Blob> {
  const mime = (file as File).type || "";
  if (IMAGE_TYPES.has(mime)) return reencodeImage(file, mime);
  if (mime === "image/svg+xml") return cleanSvg(file);
  if (mime === "application/pdf") return cleanPdf(file);
  return file; // no-op for other types (CSV/JSON/etc rarely carry metadata)
}

/** Sanitize a remote asset by URL (e.g. wallpaper, founder photo) before serving to user. */
export async function stripMetadataFromUrl(url: string): Promise<Blob | null> {
  try {
    const r = await fetch(url, { credentials: "omit" });
    if (!r.ok) return null;
    const b = await r.blob();
    return await stripMetadata(b);
  } catch {
    return null;
  }
}

/** Trigger a sanitized download (use this instead of raw a[download]). */
export async function downloadSanitized(blob: Blob, filename: string) {
  const clean = await stripMetadata(blob);
  const url = URL.createObjectURL(clean);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Sanitize an array of files (e.g. multi-upload). */
export async function stripMetadataBatch(files: (File | Blob)[]): Promise<Blob[]> {
  return Promise.all(files.map(stripMetadata));
}
