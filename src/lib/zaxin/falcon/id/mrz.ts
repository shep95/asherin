// Zaxin Falcon — MRZ (Machine Readable Zone) parser
// ---------------------------------------------------
// Thin wrapper over the `mrz` npm package. Accepts either the raw multi-line
// MRZ text (e.g. from tesseract OCR) or an array of lines. Handles TD1/TD2/TD3
// with checksum validation — a failed checksum is a strong forgery signal.

import { parse } from "mrz";

export interface MrzFields {
  format: "TD1" | "TD2" | "TD3" | string;
  valid: boolean;
  documentType?: string;
  issuingCountry?: string;
  familyName?: string;
  firstName?: string;
  fullName?: string;
  documentNumber?: string;
  nationality?: string;
  dob?: string;           // ISO
  sex?: string;
  expirationDate?: string; // ISO
  personalNumber?: string;
  failedChecksums: string[];
}

function iso(d: unknown): string | undefined {
  if (!d || typeof d !== "string") return undefined;
  // library emits YYMMDD-ish objects; when it does, it also emits a machine-parsed
  // date. Otherwise defensively convert YYMMDD → ISO.
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  if (/^\d{6}$/.test(d)) {
    const yy = parseInt(d.slice(0, 2), 10);
    const y = yy > 30 ? 1900 + yy : 2000 + yy; // rough pivot
    return `${y}-${d.slice(2, 4)}-${d.slice(4, 6)}`;
  }
  return d;
}

export function parseMrz(input: string | string[]): MrzFields | null {
  const lines = Array.isArray(input)
    ? input
    : input.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length < 2 || lines.length > 3) return null;
  try {
    const result: any = parse(lines);
    const f = result.fields ?? {};
    const failed = (result.details ?? [])
      .filter((d: any) => d.error && /check/i.test(d.field || d.label || ""))
      .map((d: any) => d.field || d.label);
    const parts = [f.firstName, f.lastName].filter(Boolean);
    return {
      format: result.format,
      valid: !!result.valid,
      documentType: f.documentCode,
      issuingCountry: f.issuingState,
      familyName: f.lastName,
      firstName: f.firstName,
      fullName: parts.join(" ") || undefined,
      documentNumber: f.documentNumber,
      nationality: f.nationality,
      dob: iso(f.birthDate),
      sex: f.sex,
      expirationDate: iso(f.expirationDate),
      personalNumber: f.personalNumber ?? f.optional1 ?? f.optional2,
      failedChecksums: failed,
    };
  } catch (e) {
    console.warn("[falcon-mrz] parse error", e);
    return null;
  }
}
