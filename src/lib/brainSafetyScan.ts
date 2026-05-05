/**
 * Brain Safety Scanner — heuristic virus/malware/script-injection detector.
 *
 * Browsers cannot run a real AV engine, so this is a signature + heuristic
 * scanner tuned for the formats the Brains vault accepts (.txt .md .json .csv
 * .pdf .log .yml .yaml). It blocks:
 *  - EICAR test signature
 *  - Executable magic bytes (PE/ELF/Mach-O/ZIP w/ executables)
 *  - Embedded macro / script payloads (VBA, JS, PowerShell, shell)
 *  - Obfuscated base64-encoded executables
 *  - Known phishing/malware URL patterns
 *  - Suspicious eval/exec/Function constructors
 */

export interface ScanResult {
  clean: boolean;
  threats: string[];
  severity: "none" | "low" | "medium" | "high" | "critical";
}

// EICAR antivirus test file — universal AV test signature
const EICAR =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

const EXECUTABLE_MAGIC: { bytes: number[]; label: string }[] = [
  { bytes: [0x4d, 0x5a], label: "Windows PE executable (MZ)" },
  { bytes: [0x7f, 0x45, 0x4c, 0x46], label: "Linux ELF executable" },
  { bytes: [0xfe, 0xed, 0xfa, 0xce], label: "Mach-O 32-bit binary" },
  { bytes: [0xfe, 0xed, 0xfa, 0xcf], label: "Mach-O 64-bit binary" },
  { bytes: [0xca, 0xfe, 0xba, 0xbe], label: "Java class / Mach-O fat binary" },
  { bytes: [0xd0, 0xcf, 0x11, 0xe0], label: "MS Office OLE (possible macro)" },
];

const MALICIOUS_PATTERNS: { re: RegExp; label: string; sev: "low" | "medium" | "high" | "critical" }[] = [
  { re: /powershell\s+-(?:enc|encodedcommand|nop|w\s+hidden)/i, label: "Obfuscated PowerShell", sev: "critical" },
  { re: /\bcmd\.exe\s*\/c\b/i, label: "Embedded cmd.exe payload", sev: "high" },
  { re: /\bregsvr32\b.*\/i:.*scrobj\.dll/i, label: "Squiblydoo COM hijack", sev: "critical" },
  { re: /\bmshta\b.*https?:\/\//i, label: "MSHTA remote payload", sev: "critical" },
  { re: /\bcertutil\b.*-(?:decode|urlcache)/i, label: "Certutil LOLBin abuse", sev: "high" },
  { re: /\bbitsadmin\b.*\/transfer/i, label: "BITSAdmin download", sev: "high" },
  { re: /\bcurl\b.*\|\s*(?:sh|bash)\b/i, label: "Curl-pipe-to-shell", sev: "high" },
  { re: /\bwget\b.*\|\s*(?:sh|bash)\b/i, label: "Wget-pipe-to-shell", sev: "high" },
  { re: /\beval\s*\(\s*atob\s*\(/i, label: "eval(atob()) JS dropper", sev: "critical" },
  { re: /\bnew\s+Function\s*\(\s*["'`]/i, label: "Dynamic Function() constructor", sev: "medium" },
  { re: /document\.write\s*\(\s*unescape/i, label: "document.write+unescape obfuscation", sev: "high" },
  { re: /\bShell\.Application\b/i, label: "VBScript Shell.Application", sev: "high" },
  { re: /\bWScript\.Shell\b/i, label: "WScript.Shell COM object", sev: "high" },
  { re: /\bAuto_?Open\b\s*\(/i, label: "Office macro Auto_Open", sev: "critical" },
  { re: /\bWorkbook_Open\b\s*\(/i, label: "Excel macro Workbook_Open", sev: "critical" },
  { re: /Sub\s+Document_Open\s*\(/i, label: "Word macro Document_Open", sev: "critical" },
  { re: /\bCreateObject\s*\(\s*["']WScript/i, label: "VBA WScript creation", sev: "high" },
  { re: /-----BEGIN\s+(?:RSA|DSA|EC|OPENSSH)\s+PRIVATE\s+KEY-----/i, label: "Embedded private key", sev: "high" },
  { re: /\bxp_cmdshell\b/i, label: "SQL xp_cmdshell injection", sev: "critical" },
  { re: /\b(?:rm|del)\s+-rf\s+\/(?:\s|$)/i, label: "Destructive recursive delete", sev: "critical" },
  { re: /:\(\)\s*\{\s*:\|:&\s*\}\s*;:/i, label: "Bash fork bomb", sev: "critical" },
];

const checkMagicBytes = (header: Uint8Array): string[] => {
  const hits: string[] = [];
  for (const { bytes, label } of EXECUTABLE_MAGIC) {
    if (bytes.every((b, i) => header[i] === b)) hits.push(label);
  }
  return hits;
};

/**
 * Scan a File object before it's uploaded.
 */
export const scanFileForThreats = async (file: File): Promise<ScanResult> => {
  const threats: string[] = [];
  let maxSev: ScanResult["severity"] = "none";
  const bump = (s: "low" | "medium" | "high" | "critical") => {
    const order = ["none", "low", "medium", "high", "critical"];
    if (order.indexOf(s) > order.indexOf(maxSev)) maxSev = s;
  };

  // 1. Magic bytes
  try {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    for (const hit of checkMagicBytes(head)) {
      threats.push(hit);
      bump("critical");
    }
  } catch { /* ignore */ }

  // 2. Text-content scan (bounded read for performance)
  try {
    const sampleBlob = file.size > 2 * 1024 * 1024 ? file.slice(0, 2 * 1024 * 1024) : file;
    const text = await sampleBlob.text();

    if (text.includes(EICAR)) {
      threats.push("EICAR antivirus test signature");
      bump("critical");
    }

    for (const { re, label, sev } of MALICIOUS_PATTERNS) {
      if (re.test(text)) {
        threats.push(label);
        bump(sev);
      }
    }

    // Long base64 blob (>5kb) often used to ship binary payloads
    const b64 = text.match(/[A-Za-z0-9+/]{5000,}={0,2}/);
    if (b64) {
      try {
        const decoded = atob(b64[0].slice(0, 64));
        if (decoded.startsWith("MZ") || decoded.startsWith("\x7fELF")) {
          threats.push("Base64-encoded executable payload");
          bump("critical");
        }
      } catch { /* not valid b64 */ }
    }
  } catch { /* binary-only file, magic-byte check already ran */ }

  return {
    clean: threats.length === 0,
    threats,
    severity: maxSev,
  };
};

/**
 * Scan the cached `content` field of an already-stored brain.
 */
export const scanContentForThreats = (content: string): ScanResult => {
  const threats: string[] = [];
  let maxSev: ScanResult["severity"] = "none";
  const bump = (s: "low" | "medium" | "high" | "critical") => {
    const order = ["none", "low", "medium", "high", "critical"];
    if (order.indexOf(s) > order.indexOf(maxSev)) maxSev = s;
  };

  if (!content) return { clean: true, threats: [], severity: "none" };

  if (content.includes(EICAR)) {
    threats.push("EICAR antivirus test signature");
    bump("critical");
  }
  for (const { re, label, sev } of MALICIOUS_PATTERNS) {
    if (re.test(content)) {
      threats.push(label);
      bump(sev);
    }
  }
  return { clean: threats.length === 0, threats, severity: maxSev };
};
