// ─────────────────────────────────────────────────────────────────────────────
// ARTIFACT LEDGER — binary provenance, hardening posture, and drift over time.
//
// The idea borrowed from patch-forensics practice and rebuilt for this platform:
// a file is not a verdict, it is an IDENTITY (content hash), a POSTURE (what
// defences the compiler and signer actually turned on), and a LINEAGE (how that
// identity and posture changed between the last time we saw this name and now).
//
// Design law, learned from the failure modes of the original:
//   • Observation ≠ verdict. We record "imports strcpy" as an OBSERVATION with
//     its evidence field; the score is derived downstream and always explains
//     itself. Presence of a banned symbol is linkage, never proven reachability.
//   • "Unknown" and "clean" are DIFFERENT states. A parse that could not run
//     emits `unknown` with a reason — never an empty list that reads as safe.
//   • Idempotency key is the content hash, never a timestamp. Re-ingesting the
//     same bytes updates last_seen and seen_count; it never forks the ledger.
//   • Every parse is bounded: hard byte caps, bounded loops, no recursion, and
//     no execution of anything. Bytes are read, never run.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_ARTIFACT_BYTES = 24 * 1024 * 1024;

export type ArtifactKind =
  | "pe" | "elf" | "macho" | "dex" | "class" | "wasm"
  | "pdf" | "image" | "office" | "archive" | "script" | "text" | "unknown";

export interface ArtifactObservation {
  /** Short machine-stable id, e.g. "mitigation.aslr". */
  id: string;
  label: string;
  /** What we actually read, verbatim enough to re-verify. */
  evidence: string;
  /** posture = defensive flag, exposure = weakens the artifact, identity = provenance */
  facet: "posture" | "exposure" | "identity" | "unknown";
  state: "present" | "absent" | "unknown";
  /** Only set when `state` is meaningful for scoring. */
  weight?: number;
  note?: string;
}

export interface ArtifactReport {
  sha256: string;
  sha1: string;
  size_bytes: number;
  filename: string;
  declared_type: string;
  kind: ArtifactKind;
  format: string;              // "PE32+ executable", "ELF64 shared object", …
  arch: string | null;
  build_time: string | null;   // compiler-stamped, NOT filesystem mtime
  signed: "yes" | "no" | "unknown";
  signature_note: string | null;
  pdb_path: string | null;     // leaks build machine paths — an identity signal
  mitigations: Record<string, "on" | "off" | "n/a" | "unknown">;
  banned_symbols: { symbol: string; evidence: string }[];
  observations: ArtifactObservation[];
  posture_score: number | null; // null when the format was not parseable
  posture_basis: string;
  parse_errors: string[];
  parsed_at: string;
}

export interface ArtifactDrift {
  field: string;
  before: string;
  after: string;
  severity: "info" | "notice" | "alarm";
  reading: string;
}

// ── hashing ──────────────────────────────────────────────────────────────────

async function digestHex(algo: "SHA-256" | "SHA-1", bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest(algo, bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function decodeBase64(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ── SDL banned function families ─────────────────────────────────────────────
// Sourced from Microsoft's SDL banned.h families. Matched on exact symbol
// boundaries so `strcpy_s` (the SAFE replacement) never counts as `strcpy`.
const BANNED = [
  "strcpy", "strcpyA", "strcpyW", "wcscpy", "lstrcpy", "lstrcpyA", "lstrcpyW", "StrCpy",
  "strcat", "wcscat", "lstrcat", "lstrcatA", "lstrcatW", "StrCat",
  "sprintf", "vsprintf", "swprintf", "vswprintf", "wsprintf", "wsprintfA", "wsprintfW",
  "gets", "_getws", "getwd",
  "strncpy", "wcsncpy", "strncat", "wcsncat",
  "memcpy", "CopyMemory", "RtlCopyMemory",
  "alloca", "_alloca",
  "scanf", "sscanf", "swscanf", "wscanf",
  "IsBadReadPtr", "IsBadWritePtr", "IsBadCodePtr", "IsBadStringPtr",
  "system", "popen", "execl", "execlp", "execv", "execvp",
  "tmpnam", "mktemp", "rand", "srand",
] as const;
// A subset that is high-signal even in a stripped binary: the rest are noisy
// because modern CRTs inline them. Only these move the score.
const BANNED_SCORING = new Set([
  "strcpy", "wcscpy", "lstrcpy", "strcat", "wcscat", "lstrcat",
  "sprintf", "vsprintf", "wsprintf", "gets", "scanf", "sscanf",
  "alloca", "_alloca", "system", "popen", "tmpnam", "mktemp",
  "IsBadReadPtr", "IsBadWritePtr", "IsBadCodePtr", "IsBadStringPtr",
]);
const BANNED_SET = new Set<string>(BANNED as readonly string[]);

const ident = (c: number) =>
  (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95;

/** Extract NUL/boundary-delimited ASCII symbols and keep only banned exact hits. */
function scanBannedSymbols(bytes: Uint8Array, cap = 8 * 1024 * 1024): { symbol: string; evidence: string }[] {
  const end = Math.min(bytes.length, cap);
  const found = new Map<string, string>();
  let start = -1;
  for (let i = 0; i <= end; i++) {
    const c = i < end ? bytes[i] : 0;
    if (ident(c)) { if (start < 0) start = i; continue; }
    if (start >= 0) {
      const len = i - start;
      if (len >= 4 && len <= 32) {
        let s = "";
        for (let j = start; j < i; j++) s += String.fromCharCode(bytes[j]);
        if (BANNED_SET.has(s) && !found.has(s)) found.set(s, `symbol table @0x${start.toString(16)}`);
      }
      start = -1;
    }
  }
  return [...found].map(([symbol, evidence]) => ({ symbol, evidence }));
}

// ── format sniffing (magic bytes, never the filename) ────────────────────────

function sniff(bytes: Uint8Array, filename: string, declared: string): ArtifactKind {
  const b = bytes;
  const u32 = (o: number) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
  if (b.length >= 2 && b[0] === 0x4d && b[1] === 0x5a) return "pe";
  if (b.length >= 4 && b[0] === 0x7f && b[1] === 0x45 && b[2] === 0x4c && b[3] === 0x46) return "elf";
  if (b.length >= 4) {
    const m = u32(0);
    if (m === 0xfeedface || m === 0xfeedfacf || m === 0xcefaedfe || m === 0xcffaedfe || m === 0xcafebabe) {
      // 0xcafebabe is both a Mach-O fat binary and a Java .class; disambiguate
      // on the minor/major version words that only a class file carries.
      if (m === 0xcafebabe && b.length >= 8 && b[4] === 0 && b[5] === 0) return "class";
      return m === 0xcafebabe ? "macho" : "macho";
    }
  }
  if (b.length >= 8 && b[0] === 0x64 && b[1] === 0x65 && b[2] === 0x78 && b[3] === 0x0a) return "dex";
  if (b.length >= 4 && b[0] === 0x00 && b[1] === 0x61 && b[2] === 0x73 && b[3] === 0x6d) return "wasm";
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image";
  if (b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b) {
    const n = filename.toLowerCase();
    if (/\.(docx|xlsx|pptx|odt|ods|odp)$/.test(n)) return "office";
    return "archive";
  }
  if (b.length >= 4 && b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21) return "archive";
  if (b.length >= 6 && b[0] === 0x37 && b[1] === 0x7a) return "archive";
  if (/^(text\/|application\/(json|xml|javascript))/.test(declared)) return "text";
  if (/\.(sh|ps1|bat|cmd|py|js|ts|rb|pl|vbs)$/i.test(filename)) return "script";
  return "unknown";
}

// ── PE ───────────────────────────────────────────────────────────────────────

const PE_MACHINE: Record<number, string> = {
  0x014c: "x86", 0x8664: "x64", 0x01c0: "ARM", 0xaa64: "ARM64", 0x01c4: "ARMv7", 0x0200: "IA64",
};
const PE_SUBSYSTEM: Record<number, string> = {
  1: "native/driver", 2: "Windows GUI", 3: "Windows console", 9: "Windows CE", 10: "EFI application",
};

interface PeResult {
  format: string; arch: string | null; build_time: string | null;
  signed: "yes" | "no"; signature_note: string | null; pdb_path: string | null;
  mitigations: Record<string, "on" | "off" | "n/a" | "unknown">;
  banned: { symbol: string; evidence: string }[];
  observations: ArtifactObservation[];
  errors: string[];
}

function parsePe(b: Uint8Array): PeResult | null {
  const errors: string[] = [];
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const at = (o: number, n: number) => o >= 0 && o + n <= b.length;
  if (!at(0x40, 0)) return null;
  const peOff = dv.getUint32(0x3c, true);
  if (!at(peOff, 24) || dv.getUint32(peOff, true) !== 0x00004550) return null;

  const machine = dv.getUint16(peOff + 4, true);
  const numSections = dv.getUint16(peOff + 6, true);
  const stamp = dv.getUint32(peOff + 8, true);
  const optSize = dv.getUint16(peOff + 20, true);
  const characteristics = dv.getUint16(peOff + 22, true);
  const opt = peOff + 24;
  if (!at(opt, 0x60)) return null;
  const magic = dv.getUint16(opt, true);
  const plus = magic === 0x20b;
  const dllChar = dv.getUint16(opt + 0x46, true);
  const subsystem = dv.getUint16(opt + 0x44, true);
  const ddOff = opt + (plus ? 0x70 : 0x60);
  const numDD = dv.getUint32(opt + (plus ? 0x6c : 0x5c), true);

  const dd = (i: number) =>
    i < numDD && at(ddOff + i * 8, 8)
      ? { rva: dv.getUint32(ddOff + i * 8, true), size: dv.getUint32(ddOff + i * 8 + 4, true) }
      : { rva: 0, size: 0 };

  // Section table → RVA→file-offset map, bounded by the declared section count.
  const secOff = opt + optSize;
  const sections: { va: number; vsize: number; raw: number; rsize: number }[] = [];
  for (let i = 0; i < Math.min(numSections, 96); i++) {
    const s = secOff + i * 40;
    if (!at(s, 40)) break;
    sections.push({
      va: dv.getUint32(s + 12, true), vsize: dv.getUint32(s + 8, true),
      raw: dv.getUint32(s + 20, true), rsize: dv.getUint32(s + 16, true),
    });
  }
  const rva2off = (rva: number): number => {
    for (const s of sections) {
      const span = Math.max(s.vsize, s.rsize);
      if (rva >= s.va && rva < s.va + span) {
        const off = s.raw + (rva - s.va);
        return off < b.length ? off : -1;
      }
    }
    return -1;
  };
  const cstr = (off: number, max = 128): string => {
    if (off < 0 || off >= b.length) return "";
    let s = "";
    for (let i = off; i < Math.min(b.length, off + max); i++) {
      if (b[i] === 0) break;
      s += String.fromCharCode(b[i]);
    }
    return s;
  };

  // Authenticode: the certificate directory (index 4) stores a FILE offset,
  // not an RVA. Presence proves a signature blob exists — never that it is
  // valid or currently trusted, and we say exactly that.
  const cert = dd(4);
  const signed = cert.size > 0 && cert.rva > 0 ? "yes" : "no";

  // Debug directory (index 6) → CodeView PDB path. Leaks the build machine.
  let pdb: string | null = null;
  const dbg = dd(6);
  if (dbg.size > 0) {
    const o = rva2off(dbg.rva);
    for (let i = 0; o >= 0 && i < Math.min(16, Math.floor(dbg.size / 28)); i++) {
      const e = o + i * 28;
      if (!at(e, 28)) break;
      if (dv.getUint32(e + 12, true) === 2) { // IMAGE_DEBUG_TYPE_CODEVIEW
        const p = dv.getUint32(e + 24, true); // PointerToRawData (file offset)
        if (at(p, 24) && cstr(p, 4) === "RSDS") pdb = cstr(p + 24, 260) || null;
      }
    }
  }

  // Import table (index 1) → the imported symbol names, with real provenance.
  const banned = new Map<string, string>();
  const imp = dd(1);
  if (imp.size > 0) {
    const o = rva2off(imp.rva);
    for (let i = 0; o >= 0 && i < 128; i++) {
      const d = o + i * 20;
      if (!at(d, 20)) break;
      const origThunk = dv.getUint32(d, true);
      const nameRva = dv.getUint32(d + 12, true);
      const firstThunk = dv.getUint32(d + 16, true);
      if (origThunk === 0 && nameRva === 0 && firstThunk === 0) break;
      const dllName = cstr(rva2off(nameRva), 64) || "(unnamed)";
      let t = rva2off(origThunk || firstThunk);
      const step = plus ? 8 : 4;
      for (let k = 0; t >= 0 && k < 4096; k++) {
        const cell = t + k * step;
        if (!at(cell, step)) break;
        const v = plus ? dv.getBigUint64(cell, true) : BigInt(dv.getUint32(cell, true));
        if (v === 0n) break;
        const ordinalBit = plus ? 1n << 63n : 1n << 31n;
        if (v & ordinalBit) continue; // imported by ordinal — no name to read
        const hint = rva2off(Number(v & 0x7fffffffn));
        const sym = cstr(hint + 2, 64);
        if (sym && BANNED_SET.has(sym) && !banned.has(sym)) {
          banned.set(sym, `import table · ${dllName}`);
        }
      }
    }
  }
  if (banned.size === 0) {
    // Fall back to the symbol scan so a stripped or packed import table does
    // not silently read as "no banned linkage".
    for (const f of scanBannedSymbols(b)) if (!banned.has(f.symbol)) banned.set(f.symbol, f.evidence);
  }

  const flag = (bit: number) => ((dllChar & bit) !== 0 ? "on" : "off") as "on" | "off";
  const isDriver = subsystem === 1;
  const mitigations: Record<string, "on" | "off" | "n/a" | "unknown"> = {
    aslr: flag(0x0040),                    // DYNAMIC_BASE
    high_entropy_aslr: plus ? flag(0x0020) : "n/a", // HIGH_ENTROPY_VA (64-bit only)
    dep_nx: flag(0x0100),                  // NX_COMPAT
    // NO_SEH is an inverted flag: set means the image declares it uses no SEH.
    // On 64-bit images SEH is table-driven and the flag carries no meaning.
    structured_exception_handling: plus ? "n/a" : ((dllChar & 0x0400) ? "off" : "on"),
    control_flow_guard: flag(0x4000),      // GUARD_CF
    force_integrity: flag(0x0080),
    safe_unload: flag(0x0800),             // NO_BIND
    terminal_server_aware: flag(0x8000),
    appcontainer: flag(0x1000),
  };

  const observations: ArtifactObservation[] = [
    { id: "mitigation.aslr", label: "Address Space Layout Randomisation", facet: "posture", state: mitigations.aslr === "on" ? "present" : "absent", evidence: `DllCharacteristics=0x${dllChar.toString(16)} · DYNAMIC_BASE`, weight: 18 },
    { id: "mitigation.dep", label: "Data Execution Prevention (NX)", facet: "posture", state: mitigations.dep_nx === "on" ? "present" : "absent", evidence: `DllCharacteristics=0x${dllChar.toString(16)} · NX_COMPAT`, weight: 18 },
    { id: "mitigation.cfg", label: "Control Flow Guard", facet: "posture", state: mitigations.control_flow_guard === "on" ? "present" : "absent", evidence: `DllCharacteristics=0x${dllChar.toString(16)} · GUARD_CF`, weight: 14 },
    { id: "mitigation.high_entropy", label: "High-entropy ASLR (64-bit)", facet: "posture", state: mitigations.high_entropy_aslr === "on" ? "present" : mitigations.high_entropy_aslr === "n/a" ? "unknown" : "absent", evidence: "HIGH_ENTROPY_VA", weight: plus ? 8 : 0, note: plus ? undefined : "n/a on 32-bit images" },
    { id: "signature.authenticode", label: "Authenticode signature blob", facet: "identity", state: signed === "yes" ? "present" : "absent", evidence: `certificate directory size=${cert.size}`, weight: 20, note: "Presence only — the chain is not validated here, and a present blob can still be expired, revoked, or self-signed." },
  ];
  if (pdb) {
    observations.push({
      id: "identity.pdb", label: "Build machine path leaked in debug directory",
      facet: "identity", state: "present", evidence: pdb,
      note: "PDB paths routinely carry the builder's username, branch, and internal project layout.",
    });
  }
  if (isDriver) {
    observations.push({ id: "context.driver", label: "Kernel-mode / native subsystem image", facet: "unknown", state: "present", evidence: `Subsystem=${subsystem}`, note: "Several user-mode mitigations are not applicable to this image class; treat absences here as context, not defects." });
  }

  return {
    format: `${plus ? "PE32+" : "PE32"} ${(characteristics & 0x2000) ? "dynamic library" : "executable"}${isDriver ? " (native/driver)" : ""}`,
    arch: PE_MACHINE[machine] ?? `machine 0x${machine.toString(16)}`,
    build_time: stamp > 0 && stamp < 0xfffffffe ? new Date(stamp * 1000).toISOString() : null,
    signed, signature_note: signed === "yes"
      ? "Signature blob present. Chain validity, revocation, and timestamp are NOT verified here."
      : "No certificate table — the image carries no Authenticode blob at all.",
    pdb_path: pdb,
    mitigations: { ...mitigations, subsystem_note: "unknown" as const, ...(PE_SUBSYSTEM[subsystem] ? {} : {}) },
    banned: [...banned].map(([symbol, evidence]) => ({ symbol, evidence })),
    observations, errors,
  };
}

// ── ELF ──────────────────────────────────────────────────────────────────────

const ELF_MACHINE: Record<number, string> = {
  0x03: "x86", 0x3e: "x86-64", 0x28: "ARM", 0xb7: "AArch64", 0xf3: "RISC-V", 0x15: "PPC64",
};

function parseElf(b: Uint8Array): PeResult | null {
  if (b.length < 64) return null;
  const is64 = b[4] === 2;
  const le = b[5] === 1;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);
  const uptr = (o: number) => (is64 ? Number(dv.getBigUint64(o, le)) : dv.getUint32(o, le));

  const eType = u16(16);
  const eMachine = u16(18);
  const phoff = is64 ? uptr(0x20) : u32(0x1c);
  const phentsize = u16(is64 ? 0x36 : 0x2a);
  const phnum = u16(is64 ? 0x38 : 0x2c);

  let nxState: "on" | "off" | "unknown" = "unknown";
  let relro: "on" | "off" | "unknown" = "off";
  let hasDynamic = false;
  for (let i = 0; i < Math.min(phnum, 64); i++) {
    const p = phoff + i * phentsize;
    if (p + 8 > b.length) break;
    const pType = u32(p);
    const pFlags = is64 ? u32(p + 4) : u32(p + 24);
    if (pType === 0x6474e551) nxState = (pFlags & 0x1) ? "off" : "on"; // PT_GNU_STACK, X bit
    if (pType === 0x6474e552) relro = "on";                            // PT_GNU_RELRO
    if (pType === 2) hasDynamic = true;                                // PT_DYNAMIC
  }
  const pie = eType === 3; // ET_DYN — PIE executable or shared object

  const banned = scanBannedSymbols(b);
  const mitigations: Record<string, "on" | "off" | "n/a" | "unknown"> = {
    pie_aslr: pie ? "on" : "off",
    nx_stack: nxState,
    relro: relro,
    dynamic_linking: hasDynamic ? "on" : "off",
  };
  const observations: ArtifactObservation[] = [
    { id: "mitigation.pie", label: "Position-Independent Executable (ASLR-capable)", facet: "posture", state: pie ? "present" : "absent", evidence: `e_type=${eType} (${pie ? "ET_DYN" : "ET_EXEC"})`, weight: 20 },
    { id: "mitigation.nx", label: "Non-executable stack", facet: "posture", state: nxState === "on" ? "present" : nxState === "off" ? "absent" : "unknown", evidence: "PT_GNU_STACK program header", weight: 20, note: nxState === "unknown" ? "No PT_GNU_STACK header found — the kernel default applies and cannot be read from the file alone." : undefined },
    { id: "mitigation.relro", label: "RELRO (read-only relocations)", facet: "posture", state: relro === "on" ? "present" : "absent", evidence: "PT_GNU_RELRO program header", weight: 12 },
  ];

  return {
    format: `ELF${is64 ? "64" : "32"} ${eType === 3 ? "shared object / PIE" : eType === 2 ? "executable" : eType === 1 ? "relocatable" : `type ${eType}`}`,
    arch: ELF_MACHINE[eMachine] ?? `machine 0x${eMachine.toString(16)}`,
    build_time: null,
    signed: "no",
    signature_note: "ELF images carry no embedded Authenticode equivalent; trust is established out-of-band (distro signature, sigstore, or detached signature).",
    pdb_path: null,
    mitigations, banned, observations, errors: [],
  };
}

// ── Mach-O ───────────────────────────────────────────────────────────────────

function parseMachO(b: Uint8Array): PeResult | null {
  if (b.length < 32) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const raw = dv.getUint32(0, true);
  const be = raw === 0xcefaedfe || raw === 0xcffaedfe || raw === 0xbebafeca;
  const le = !be;
  const magic = dv.getUint32(0, le);
  if (magic === 0xcafebabe || magic === 0xbebafeca) {
    return {
      format: "Mach-O universal (fat) binary", arch: "multi-architecture", build_time: null,
      signed: "unknown", signature_note: "Fat binary — each slice carries its own header and signature; per-slice parsing is not performed here.",
      pdb_path: null, mitigations: { pie_aslr: "unknown", nx: "unknown" }, banned: scanBannedSymbols(b),
      observations: [{ id: "context.fat", label: "Universal binary", facet: "unknown", state: "present", evidence: "FAT_MAGIC", note: "Posture must be read per-slice; a single verdict for the container would be misleading." }],
      errors: [],
    };
  }
  const is64 = magic === 0xfeedfacf;
  const cpu = dv.getUint32(4, le);
  const fileType = dv.getUint32(12, le);
  const flags = dv.getUint32(24, le);
  const pie = (flags & 0x00200000) !== 0;      // MH_PIE
  const noHeap = (flags & 0x01000000) !== 0;   // MH_NO_HEAP_EXECUTION
  const arch = cpu === 0x0100000c ? "ARM64" : cpu === 0x01000007 ? "x86-64" : cpu === 7 ? "x86" : `cpu 0x${cpu.toString(16)}`;
  return {
    format: `Mach-O ${is64 ? "64-bit" : "32-bit"} ${fileType === 2 ? "executable" : fileType === 6 ? "dynamic library" : `type ${fileType}`}`,
    arch, build_time: null,
    signed: "unknown",
    signature_note: "Code-signature load command parsing is not performed; use the platform's own verification for a trust decision.",
    pdb_path: null,
    mitigations: { pie_aslr: pie ? "on" : "off", no_heap_exec: noHeap ? "on" : "off" },
    banned: scanBannedSymbols(b),
    observations: [
      { id: "mitigation.pie", label: "Position-Independent Executable", facet: "posture", state: pie ? "present" : "absent", evidence: `mach_header flags=0x${flags.toString(16)} · MH_PIE`, weight: 25 },
      { id: "mitigation.no_heap_exec", label: "Non-executable heap", facet: "posture", state: noHeap ? "present" : "absent", evidence: "MH_NO_HEAP_EXECUTION", weight: 10 },
    ],
    errors: [],
  };
}

// ── scoring ──────────────────────────────────────────────────────────────────

function score(obs: ArtifactObservation[], banned: { symbol: string }[]): { value: number; basis: string } {
  let earned = 0, possible = 0;
  const missing: string[] = [];
  for (const o of obs) {
    if (o.facet !== "posture" && o.id !== "signature.authenticode") continue;
    const w = o.weight ?? 0;
    if (!w || o.state === "unknown") continue;
    possible += w;
    if (o.state === "present") earned += w;
    else missing.push(o.label);
  }
  if (possible === 0) return { value: 0, basis: "No scoreable posture flags could be read from this format." };
  let pct = Math.round((earned / possible) * 100);
  const scoring = banned.filter((x) => BANNED_SCORING.has(x.symbol));
  const penalty = Math.min(20, scoring.length * 5);
  pct = Math.max(0, pct - penalty);
  const parts = [`${earned}/${possible} weighted posture points`];
  if (missing.length) parts.push(`missing: ${missing.join(", ")}`);
  if (penalty) parts.push(`−${penalty} for ${scoring.length} high-signal banned symbol(s) linked`);
  return { value: pct, basis: parts.join(" · ") };
}

// ── the public entry point ───────────────────────────────────────────────────

export async function assessArtifact(
  bytes: Uint8Array, filename: string, declaredType: string,
): Promise<ArtifactReport> {
  const parse_errors: string[] = [];
  const [sha256, sha1] = await Promise.all([digestHex("SHA-256", bytes), digestHex("SHA-1", bytes)]);
  const kind = sniff(bytes, filename, declaredType || "");

  let r: PeResult | null = null;
  try {
    if (kind === "pe") r = parsePe(bytes);
    else if (kind === "elf") r = parseElf(bytes);
    else if (kind === "macho") r = parseMachO(bytes);
  } catch (e) {
    parse_errors.push(`${kind} header parse failed: ${(e as Error).message}`);
  }
  if ((kind === "pe" || kind === "elf" || kind === "macho") && !r) {
    parse_errors.push(`${kind.toUpperCase()} magic present but the header did not parse — treat posture as UNKNOWN, not clean.`);
  }

  const observations = r?.observations ?? [];
  const banned = r?.banned ?? (kind === "script" || kind === "text" ? [] : scanBannedSymbols(bytes));
  for (const bsym of banned) {
    observations.push({
      id: `banned.${bsym.symbol}`, label: `Links banned function \`${bsym.symbol}\``,
      facet: "exposure", state: "present", evidence: bsym.evidence,
      note: "Linkage only. This proves the symbol is referenced, NOT that attacker-controlled input reaches it.",
    });
  }

  const scored = r ? score(observations, banned) : null;

  return {
    sha256, sha1, size_bytes: bytes.length,
    filename: filename || "(unnamed)",
    declared_type: declaredType || "(none declared)",
    kind,
    format: r?.format ?? kindLabel(kind),
    arch: r?.arch ?? null,
    build_time: r?.build_time ?? null,
    signed: r?.signed ?? "unknown",
    signature_note: r?.signature_note ?? null,
    pdb_path: r?.pdb_path ?? null,
    mitigations: r?.mitigations ?? {},
    banned_symbols: banned,
    observations,
    posture_score: scored ? scored.value : null,
    posture_basis: scored ? scored.basis
      : "Posture scoring applies to executable formats only; this artifact was fingerprinted and its container metadata is reported instead.",
    parse_errors: [...parse_errors, ...(r?.errors ?? [])],
    parsed_at: new Date().toISOString(),
  };
}

function kindLabel(k: ArtifactKind): string {
  return {
    pdf: "PDF document", image: "Raster image", office: "Office Open XML document",
    archive: "Compressed archive", script: "Script / source file", text: "Text payload",
    dex: "Android DEX bytecode", class: "Java class file", wasm: "WebAssembly module",
    pe: "Windows PE image", elf: "ELF image", macho: "Mach-O image", unknown: "Unrecognised container",
  }[k];
}

// ── drift: the whole reason a ledger exists ──────────────────────────────────

export function diffArtifacts(prev: ArtifactReport, next: ArtifactReport): ArtifactDrift[] {
  const out: ArtifactDrift[] = [];
  if (prev.sha256 === next.sha256) return out;

  out.push({
    field: "sha256", before: prev.sha256.slice(0, 16), after: next.sha256.slice(0, 16),
    severity: "notice",
    reading: "The bytes behind this name changed. Everything below is the delta between those two builds.",
  });

  if (prev.signed === "yes" && next.signed === "no") {
    out.push({ field: "signature", before: "signed", after: "unsigned", severity: "alarm",
      reading: "A previously signed artifact now carries no signature blob. This is the single strongest substitution signal in the ledger." });
  } else if (prev.signed === "no" && next.signed === "yes") {
    out.push({ field: "signature", before: "unsigned", after: "signed", severity: "info", reading: "Signing was added between builds." });
  }

  for (const key of new Set([...Object.keys(prev.mitigations), ...Object.keys(next.mitigations)])) {
    const a = prev.mitigations[key], b = next.mitigations[key];
    if (!a || !b || a === b) continue;
    if (a === "on" && b === "off") {
      out.push({ field: `mitigation.${key}`, before: "on", after: "off", severity: "alarm",
        reading: `${key.replace(/_/g, " ")} was on in the previous build and is off in this one — hardening regressions are almost never intentional.` });
    } else if (a === "off" && b === "on") {
      out.push({ field: `mitigation.${key}`, before: "off", after: "on", severity: "info", reading: `${key.replace(/_/g, " ")} was enabled.` });
    }
  }

  const pb = new Set(prev.banned_symbols.map((x) => x.symbol));
  const added = next.banned_symbols.filter((x) => !pb.has(x.symbol)).map((x) => x.symbol);
  if (added.length) {
    out.push({ field: "banned_symbols", before: `${prev.banned_symbols.length} linked`, after: `${next.banned_symbols.length} linked`,
      severity: "notice", reading: `New banned linkage appeared: ${added.join(", ")}.` });
  }

  if (prev.arch && next.arch && prev.arch !== next.arch) {
    out.push({ field: "arch", before: prev.arch, after: next.arch, severity: "notice", reading: "Target architecture changed between builds." });
  }
  if (prev.posture_score !== null && next.posture_score !== null && next.posture_score < prev.posture_score - 5) {
    out.push({ field: "posture_score", before: String(prev.posture_score), after: String(next.posture_score),
      severity: "alarm", reading: "Overall hardening posture dropped materially." });
  }
  return out;
}

/** Compact, model-readable rendering — used by chat so the LLM never re-derives. */
export function renderArtifactBrief(r: ArtifactReport, drift: ArtifactDrift[] = []): string {
  const L: string[] = [];
  L.push(`FILE: ${r.filename} (${r.declared_type})`);
  L.push(`FORMAT: ${r.format}${r.arch ? ` · ${r.arch}` : ""} · ${r.size_bytes.toLocaleString()} bytes`);
  L.push(`SHA-256: ${r.sha256}`);
  L.push(`SHA-1: ${r.sha1}`);
  if (r.build_time) L.push(`COMPILER BUILD STAMP: ${r.build_time} (not filesystem mtime)`);
  L.push(`SIGNATURE: ${r.signed}${r.signature_note ? ` — ${r.signature_note}` : ""}`);
  if (r.pdb_path) L.push(`BUILD PATH LEAK: ${r.pdb_path}`);
  if (Object.keys(r.mitigations).length) {
    L.push(`MITIGATIONS: ${Object.entries(r.mitigations).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }
  if (r.posture_score !== null) L.push(`POSTURE SCORE: ${r.posture_score}/100 — ${r.posture_basis}`);
  else L.push(`POSTURE: not scoreable — ${r.posture_basis}`);
  if (r.banned_symbols.length) {
    L.push(`BANNED LINKAGE (presence, NOT proven reachability): ${r.banned_symbols.map((b) => `${b.symbol} [${b.evidence}]`).join("; ")}`);
  }
  if (r.parse_errors.length) L.push(`PARSE GAPS (absence of evidence, not evidence of absence): ${r.parse_errors.join(" | ")}`);
  if (drift.length) {
    L.push(`DRIFT SINCE LAST SIGHTING OF THIS NAME:`);
    for (const d of drift) L.push(`  [${d.severity.toUpperCase()}] ${d.field}: ${d.before} → ${d.after} — ${d.reading}`);
  }
  return L.join("\n");
}
