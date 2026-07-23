// Zaxin Falcon — AAMVA PDF417 parser
// -----------------------------------
// Decodes the AAMVA DL/ID Card Design Standard subfile data lifted from the
// PDF417 barcode on the back of US/Canadian driver licenses. This is a 1:1
// read of printed data — NO DMV lookup, NO biometric, NO photo. Everything
// here is data the operator can already read off the front of the card.

export interface AamvaFields {
  raw: string;
  jurisdiction?: string;    // DAJ - issuing state
  country?: string;         // DCG
  familyName?: string;      // DCS
  firstName?: string;       // DAC / DCT
  middleName?: string;      // DAD
  fullName?: string;        // derived
  dob?: string;             // DBB (MMDDCCYY) → ISO
  sex?: string;             // DBC (1=M, 2=F, 9=X)
  eyeColor?: string;        // DAY
  hairColor?: string;       // DAZ
  heightIn?: number;        // DAU (069 IN)
  weightLb?: number;        // DAW
  addressLine1?: string;    // DAG
  city?: string;            // DAI
  state?: string;           // DAJ
  postalCode?: string;      // DAK
  licenseNumber?: string;   // DAQ
  issueDate?: string;       // DBD
  expirationDate?: string;  // DBA
  vehicleClass?: string;    // DCA
  restrictions?: string;    // DCB
  endorsements?: string;    // DCD
  documentDiscriminator?: string; // DCF (unique per issuance)
  complianceType?: string;  // DDA (F=Real-ID)
  organDonor?: string;      // DDK
  veteran?: string;         // DDL
}

const CODE_MAP: Record<string, keyof AamvaFields> = {
  DCS: "familyName",
  DAC: "firstName",
  DCT: "firstName",
  DAD: "middleName",
  DBB: "dob",
  DBC: "sex",
  DAY: "eyeColor",
  DAZ: "hairColor",
  DAU: "heightIn",
  DAW: "weightLb",
  DAG: "addressLine1",
  DAI: "city",
  DAJ: "state",
  DAK: "postalCode",
  DAQ: "licenseNumber",
  DBD: "issueDate",
  DBA: "expirationDate",
  DCA: "vehicleClass",
  DCB: "restrictions",
  DCD: "endorsements",
  DCF: "documentDiscriminator",
  DCG: "country",
  DDA: "complianceType",
  DDK: "organDonor",
  DDL: "veteran",
};

function parseDate(raw: string): string | undefined {
  // AAMVA dates: MMDDCCYY (US) or CCYYMMDD (Canada). Try US first.
  const clean = raw.replace(/[^0-9]/g, "");
  if (clean.length !== 8) return undefined;
  const mmddccyy = { mm: clean.slice(0, 2), dd: clean.slice(2, 4), y: clean.slice(4, 8) };
  const ccyymmdd = { y: clean.slice(0, 4), mm: clean.slice(4, 6), dd: clean.slice(6, 8) };
  const tryIso = (y: string, m: string, d: string) => {
    const yi = parseInt(y, 10), mi = parseInt(m, 10), di = parseInt(d, 10);
    if (yi < 1900 || yi > 2100 || mi < 1 || mi > 12 || di < 1 || di > 31) return null;
    return `${y}-${m}-${d}`;
  };
  return tryIso(mmddccyy.y, mmddccyy.mm, mmddccyy.dd)
      ?? tryIso(ccyymmdd.y, ccyymmdd.mm, ccyymmdd.dd)
      ?? undefined;
}

function parseHeight(raw: string): number | undefined {
  // "069 in" or "175 cm"
  const m = raw.match(/(\d+)\s*(in|cm)?/i);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  if (!isFinite(n)) return undefined;
  if (m[2]?.toLowerCase() === "cm") return Math.round(n / 2.54);
  return n; // inches
}

function parseWeight(raw: string): number | undefined {
  const m = raw.match(/(\d+)/);
  if (!m) return undefined;
  const n = parseInt(m[1], 10);
  return isFinite(n) ? n : undefined;
}

export function parseAamva(raw: string): AamvaFields | null {
  if (!raw || typeof raw !== "string") return null;
  // AAMVA barcodes start with the compliance indicator @, then ANSI header.
  if (!raw.includes("ANSI") && !raw.startsWith("@")) return null;

  const out: AamvaFields = { raw };
  // Split into lines — element codes are 3-char alpha prefixes at start of a line.
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([A-Z]{3})(.*)$/);
    if (!m) continue;
    const [, code, value] = m;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const field = CODE_MAP[code];
    if (!field) continue;
    if (field === "dob" || field === "issueDate" || field === "expirationDate") {
      out[field] = parseDate(trimmed);
    } else if (field === "heightIn") {
      out.heightIn = parseHeight(trimmed);
    } else if (field === "weightLb") {
      out.weightLb = parseWeight(trimmed);
    } else if (field === "sex") {
      out.sex = trimmed === "1" ? "M" : trimmed === "2" ? "F" : trimmed === "9" ? "X" : trimmed;
    } else {
      (out as any)[field] = trimmed;
    }
  }

  const parts = [out.firstName, out.middleName, out.familyName].filter(Boolean);
  if (parts.length) out.fullName = parts.join(" ");
  return out;
}

/** Deterministic hash key for identity hotlist / linkage. */
export async function identityHash(fields: AamvaFields): Promise<string | null> {
  if (!fields.licenseNumber || !fields.dob) return null;
  const key = `${fields.licenseNumber.toUpperCase()}|${fields.dob}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
