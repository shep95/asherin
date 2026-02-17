/**
 * AUREON File Upload Security Module
 * Extension whitelist, MIME validation, size limits, UUID naming
 */

// Allowed extensions whitelist
const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  // Data files
  ".csv": ["text/csv", "application/csv", "text/plain"],
  ".json": ["application/json", "text/plain"],
  ".jsonl": ["application/jsonl", "application/x-ndjson", "text/plain"],
  ".xlsx": ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ".xls": ["application/vnd.ms-excel"],
  ".xml": ["application/xml", "text/xml"],
  ".yaml": ["application/x-yaml", "text/yaml", "text/plain"],
  ".yml": ["application/x-yaml", "text/yaml", "text/plain"],
  ".toml": ["application/toml", "text/plain"],
  // Documents
  ".pdf": ["application/pdf"],
  ".txt": ["text/plain"],
  ".log": ["text/plain", "application/octet-stream"],
  ".sql": ["application/sql", "text/plain", "application/x-sql"],
  // Data formats
  ".parquet": ["application/octet-stream", "application/vnd.apache.parquet"],
  ".geojson": ["application/geo+json", "application/json"],
  ".db": ["application/x-sqlite3", "application/octet-stream"],
  // Images (for library)
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".gif": ["image/gif"],
  ".webp": ["image/webp"],
  ".svg": ["image/svg+xml"],
};

// Blocked extensions (executable / dangerous)
const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".php", ".js", ".sh", ".py", ".rb", ".pl", ".jar",
  ".bat", ".cmd", ".ps1", ".msi", ".com", ".scr", ".vbs",
  ".wsf", ".cpl", ".hta", ".inf", ".reg", ".rgs", ".sct",
  ".wsc", ".dll", ".sys", ".drv", ".ocx",
]);

// Magic bytes signatures for common file types
const MAGIC_BYTES: Record<string, number[]> = {
  ".pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
  ".xlsx": [0x50, 0x4B, 0x03, 0x04], // PK (ZIP)
  ".xls": [0xD0, 0xCF, 0x11, 0xE0], // OLE2
  ".png": [0x89, 0x50, 0x4E, 0x47], // PNG
  ".jpg": [0xFF, 0xD8, 0xFF],
  ".jpeg": [0xFF, 0xD8, 0xFF],
  ".gif": [0x47, 0x49, 0x46],       // GIF
  ".webp": [0x52, 0x49, 0x46, 0x46], // RIFF
  ".db": [0x53, 0x51, 0x4C, 0x69],   // SQLi
};

// Dangerous CSV/Excel formula prefixes
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r", "|"];

export const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
export const MAX_FILE_SIZE_DISPLAY = "500MB";

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Extract extension from filename (lowercase)
 */
function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot).toLowerCase() : "";
}

/**
 * Generate a UUID-based storage filename, preserving only the extension
 */
export function generateSecureFilename(originalName: string): string {
  const ext = getExtension(originalName);
  return `${crypto.randomUUID()}${ext}`;
}

/**
 * Build the full secure storage path: userId/uuid.ext
 */
export function buildStoragePath(userId: string, originalName: string): string {
  return `${userId}/${generateSecureFilename(originalName)}`;
}

/**
 * Validate a file before upload — runs all checks
 */
export async function validateFile(file: File): Promise<FileValidationResult> {
  // STEP 1 — Size check (reject before reading content)
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File exceeds maximum size of ${MAX_FILE_SIZE_DISPLAY}` };
  }
  if (file.size === 0) {
    return { valid: false, error: "File is empty" };
  }

  // STEP 2 — Extension check (whitelist)
  const ext = getExtension(file.name);
  if (!ext) {
    return { valid: false, error: "File has no extension" };
  }
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `Blocked file type: ${ext}` };
  }
  if (!ALLOWED_EXTENSIONS[ext]) {
    return { valid: false, error: `Unsupported file type: ${ext}` };
  }

  // STEP 3 — MIME type check (compare to extension whitelist)
  const allowedMimes = ALLOWED_EXTENSIONS[ext];
  const claimedMime = file.type || "application/octet-stream";
  if (claimedMime !== "application/octet-stream" && !allowedMimes.includes(claimedMime)) {
    return {
      valid: false,
      error: `MIME type mismatch: expected ${allowedMimes.join(" or ")} for ${ext}, got ${claimedMime}`,
    };
  }

  // STEP 4 — Magic bytes check (read first 8 bytes)
  const expectedMagic = MAGIC_BYTES[ext];
  if (expectedMagic) {
    try {
      const header = new Uint8Array(await file.slice(0, 8).arrayBuffer());
      const matches = expectedMagic.every((byte, i) => header[i] === byte);
      if (!matches) {
        return {
          valid: false,
          error: `File content does not match ${ext} format (magic bytes mismatch)`,
        };
      }
    } catch {
      // If we can't read the header, skip this check
    }
  }

  // STEP 5 — CSV/text formula injection check (for text-based data files)
  const textExts = new Set([".csv", ".txt", ".json", ".jsonl", ".xml", ".yaml", ".yml", ".toml", ".sql", ".log"]);
  if (textExts.has(ext) && file.size < 10 * 1024 * 1024) {
    // Only scan files under 10MB for formula injection
    try {
      const sample = await file.slice(0, 1024 * 100).text(); // First 100KB
      const lines = sample.split("\n");
      for (const line of lines) {
        const cells = line.split(",");
        for (const cell of cells) {
          const trimmed = cell.trim().replace(/^["']/, "");
          if (FORMULA_PREFIXES.some((p) => trimmed.startsWith(p) && trimmed.length > 1)) {
            // Check for actual formula patterns, not just minus signs in numbers
            if (trimmed.startsWith("=") || trimmed.startsWith("@") || trimmed.startsWith("|")) {
              const formulaPatterns = /^[=@|+\-]\s*(HYPERLINK|DDE|EXEC|CMD|IMPORTXML|IMPORTDATA|IMPORTRANGE)\s*\(/i;
              if (formulaPatterns.test(trimmed)) {
                return {
                  valid: false,
                  error: "File contains potentially dangerous formula injection patterns",
                };
              }
            }
          }
        }
      }
    } catch {
      // If text parsing fails, skip this check
    }
  }

  return { valid: true };
}

/**
 * Validate multiple files, returning per-file results
 */
export async function validateFiles(files: File[]): Promise<{ file: File; result: FileValidationResult }[]> {
  return Promise.all(files.map(async (file) => ({ file, result: await validateFile(file) })));
}

/**
 * Sanitize a filename for display (strip path traversal attempts)
 */
export function sanitizeDisplayName(name: string): string {
  return name
    .replace(/\.\./g, "")
    .replace(/[/\\]/g, "_")
    .replace(/[<>:"|?*\x00-\x1F]/g, "_")
    .trim();
}
