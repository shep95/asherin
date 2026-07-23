// Zaxin Falcon — Identity verification / tamper heuristics
// ---------------------------------------------------------
// Cross-checks structured data (PDF417/MRZ) against front-of-card OCR text.
// Any mismatch = "TAMPER SUSPECTED" — barcode is trivially reprintable but
// re-writing PDF417 to match a swapped photo is common in fake IDs.
//
// Heuristics only — this is decision-support, not proof of authenticity.

export interface VerifyInput {
  authoritative: {
    familyName?: string;
    firstName?: string;
    dob?: string;           // ISO
    documentNumber?: string;
    expirationDate?: string;
  };
  ocrText: string;          // whatever tesseract lifted off the front
}

export interface VerifyResult {
  status: "clean" | "review" | "tamper_suspected";
  checks: Array<{ field: string; expected: string; found: boolean; note?: string }>;
  score: number;            // 0..1, 1 = every field found on the front
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function contains(hay: string, needle: string): boolean {
  if (!needle) return true;
  const h = norm(hay), n = norm(needle);
  if (n.length < 2) return true;
  return h.includes(n);
}

function containsDobLoose(hay: string, isoDob: string): boolean {
  // Accept multiple presentations: MM/DD/YYYY, DD-MM-YYYY, YYYY-MM-DD, MMM DD YYYY
  const [y, m, d] = isoDob.split("-");
  if (!y || !m || !d) return false;
  const bare = hay.replace(/[^0-9A-Za-z]/g, "");
  const candidates = [
    `${m}${d}${y}`, `${d}${m}${y}`, `${y}${m}${d}`,
    `${m}${d}${y.slice(2)}`, `${d}${m}${y.slice(2)}`,
  ];
  return candidates.some((c) => bare.includes(c));
}

export function verifyCrossFields(input: VerifyInput): VerifyResult {
  const { authoritative: A, ocrText } = input;
  const checks: VerifyResult["checks"] = [];

  if (A.familyName) checks.push({ field: "familyName", expected: A.familyName, found: contains(ocrText, A.familyName) });
  if (A.firstName) checks.push({ field: "firstName", expected: A.firstName, found: contains(ocrText, A.firstName) });
  if (A.dob) checks.push({ field: "dob", expected: A.dob, found: containsDobLoose(ocrText, A.dob) });
  if (A.documentNumber) checks.push({ field: "documentNumber", expected: A.documentNumber, found: contains(ocrText, A.documentNumber) });
  if (A.expirationDate) checks.push({ field: "expirationDate", expected: A.expirationDate, found: containsDobLoose(ocrText, A.expirationDate) });

  if (checks.length === 0) return { status: "review", checks, score: 0 };

  const hits = checks.filter((c) => c.found).length;
  const score = hits / checks.length;
  const status: VerifyResult["status"] =
    score >= 0.8 ? "clean" :
    score >= 0.5 ? "review" :
    "tamper_suspected";
  return { status, checks, score };
}

/** Utility: mask a DL/document number for on-screen display (last 4 visible). */
export function maskDocNumber(n?: string): string {
  if (!n) return "—";
  if (n.length <= 4) return "•".repeat(n.length);
  return "•".repeat(n.length - 4) + n.slice(-4);
}

/** Utility: DOB → age (Years). */
export function ageFromDob(iso?: string): number | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  const now = new Date();
  let age = now.getFullYear() - y;
  const mm = now.getMonth() + 1;
  if (mm < m || (mm === m && now.getDate() < d)) age--;
  return age;
}
