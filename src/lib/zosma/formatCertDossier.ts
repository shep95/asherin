// Formats a ZOSMA cert-inspector report into a Markdown dossier for chat.
// When bit_length is inside the browser-tractable window (≤96 bits), the caller
// will invoke runZosmaCycle on the modulus; otherwise this dossier stands alone
// with an honest infeasibility statement — never a fabricated "cracked" result.

export interface ZosmaCertReport {
  ok: boolean;
  host: string;
  port: number;
  subject: string | null;
  issuer: string | null;
  valid_from: string | null;
  valid_to: string | null;
  subjectaltname: string | null;
  fingerprint256: string | null;
  sig_algo: string | null;
  pubkey_algo: "RSA" | "EC" | "OTHER" | null;
  bit_length: number | null;
  modulus_hex: string | null;
  exponent_hex: string | null;
  error?: string;
}

const TRACTABLE_BITS = 96;

// Rough public-record cost envelope. Sources cited inline so the number isn't magic.
function feasibilityLine(bits: number, algo: string): string {
  if (algo === "EC") {
    // ECDSA/EdDSA over standard curves — no factoring path applies; ECDLP is the barrier.
    return `Public-key algorithm is elliptic-curve (${bits}-bit). ZOSMA implements integer factorization (Pollard-rho / modified Shor's) — it does not attack ECDLP. Cycle refused.`;
  }
  if (bits <= TRACTABLE_BITS) {
    return `◈ TRACTABLE — ${bits}-bit RSA modulus is inside the browser BigInt window (≤${TRACTABLE_BITS} bits). ZOSMA will attempt the cycle.`;
  }
  if (bits < 512) {
    return `Modulus is ${bits}-bit RSA. Above the ≤${TRACTABLE_BITS}-bit browser window but small enough that CADO-NFS on a lab cluster could factor it; refused here — this UI does not spawn out-of-browser jobs.`;
  }
  if (bits < 1024) {
    return `Modulus is ${bits}-bit RSA. Public record: RSA-768 (768 bits) took ~2,000 CPU-years in 2009 (Kleinjung et al., IACR 2010/006). Not feasible from a browser tab.`;
  }
  if (bits < 2048) {
    return `Modulus is ${bits}-bit RSA. Public record: RSA-829 (829 bits) took ~2,700 CPU-core-years in 2020 (Boudot, Gaudry, Guillevic et al.). Well outside browser tractability.`;
  }
  return `Modulus is ${bits}-bit RSA — the standard TLS grade. No public factorization exists at this size; NIST estimates ≥2030 for any practical attack. Cycle refused; report is read-only cert intelligence.`;
}

// ── Pentest weakness audit ────────────────────────────────────────────
// Grades a cert against modern baselines (NIST SP 800-131A rev 2, RFC 8996,
// CA/B Forum Baseline Requirements). Emits pentest-report-ready findings.
interface Finding {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
  code: string;
  finding: string;
  reference: string;
}
function auditCert(r: ZosmaCertReport): { grade: string; findings: Finding[] } {
  const f: Finding[] = [];
  const now = Date.now();
  const notBefore = r.valid_from ? Date.parse(r.valid_from) : NaN;
  const notAfter  = r.valid_to   ? Date.parse(r.valid_to)   : NaN;

  // Validity window
  if (Number.isFinite(notAfter)) {
    if (notAfter < now) f.push({ severity: "CRITICAL", code: "CERT-EXPIRED", finding: `Certificate expired ${new Date(notAfter).toISOString().slice(0,10)}. Any TLS session accepting it violates trust chain.`, reference: "RFC 5280 §6.1" });
    else if (notAfter - now < 14 * 86400_000) f.push({ severity: "HIGH", code: "CERT-EXPIRING", finding: `Certificate expires in <14 days (${new Date(notAfter).toISOString().slice(0,10)}). Rotation SLA breached.`, reference: "CA/B BR §4.9" });
  }
  if (Number.isFinite(notBefore) && notBefore > now) f.push({ severity: "HIGH", code: "CERT-NOT-YET-VALID", finding: "notBefore is in the future — certificate not yet valid.", reference: "RFC 5280 §4.1.2.5" });

  // Public key strength
  const bits = r.bit_length ?? 0;
  if (r.pubkey_algo === "RSA") {
    if (bits < 1024)      f.push({ severity: "CRITICAL", code: "KEY-RSA-BROKEN", finding: `${bits}-bit RSA is factorable with commodity hardware (RSA-768 fell in 2009). Immediate rotation required.`, reference: "NIST SP 800-131A" });
    else if (bits < 2048) f.push({ severity: "HIGH",     code: "KEY-RSA-DEPRECATED", finding: `${bits}-bit RSA is deprecated (disallowed for signing since 2013, encryption since 2030).`, reference: "NIST SP 800-131A rev 2 Table 1" });
    else if (bits < 3072) f.push({ severity: "INFO",     code: "KEY-RSA-2048", finding: `${bits}-bit RSA meets today's baseline (≥112-bit security) but is below the ≥128-bit tier (RSA-3072).`, reference: "NIST SP 800-57 Part 1 rev 5" });
    else                   f.push({ severity: "INFO",     code: "KEY-RSA-STRONG", finding: `${bits}-bit RSA — ≥128-bit security tier.`, reference: "NIST SP 800-57" });
    // Exponent sanity — anything but 65537 is unusual and sometimes weak.
    if (r.exponent_hex && r.exponent_hex !== "10001" && r.exponent_hex !== "3") {
      f.push({ severity: "LOW", code: "KEY-RSA-EXPONENT", finding: `Non-standard public exponent 0x${r.exponent_hex}. Verify intentional; small e≤3 enables Coppersmith-style attacks on unpadded messages.`, reference: "PKCS#1 v2.2" });
    } else if (r.exponent_hex === "3") {
      f.push({ severity: "MEDIUM", code: "KEY-RSA-E3", finding: "Public exponent e=3 — enables Bleichenbacher '06 signature forgery on legacy PKCS#1 v1.5 verifiers.", reference: "CVE-2006-4340 class" });
    }
  } else if (r.pubkey_algo === "EC") {
    if (bits < 256)       f.push({ severity: "HIGH", code: "KEY-EC-WEAK", finding: `${bits}-bit EC below P-256 baseline.`, reference: "NIST SP 800-186" });
    else                   f.push({ severity: "INFO", code: "KEY-EC-OK", finding: `${bits}-bit EC — modern baseline.`, reference: "NIST SP 800-186" });
  } else {
    f.push({ severity: "MEDIUM", code: "KEY-UNKNOWN-ALGO", finding: "Public key algorithm not recognized as RSA or ECDSA.", reference: "manual review" });
  }

  // Signature algorithm — Node exposes cert.sigalg only sometimes; guard.
  const sig = (r.sig_algo ?? "").toLowerCase();
  if (sig) {
    if (sig.includes("md5"))       f.push({ severity: "CRITICAL", code: "SIG-MD5", finding: "MD5 signature — collisions demonstrated (Sotirov et al. 2008 CA breach).", reference: "RFC 6151" });
    else if (sig.includes("sha1")) f.push({ severity: "HIGH",     code: "SIG-SHA1", finding: "SHA-1 signature — SHAttered collision (Google/CWI 2017); browsers reject since 2017.", reference: "RFC 6194" });
  }

  // Self-signed heuristic
  if (r.subject && r.issuer && r.subject === r.issuer) {
    f.push({ severity: "MEDIUM", code: "CERT-SELF-SIGNED", finding: "Subject equals Issuer — self-signed certificate. No CA trust chain.", reference: "RFC 5280 §6.1" });
  }

  // Wildcard SAN scope
  if (r.subjectaltname && /DNS:\*\./i.test(r.subjectaltname)) {
    f.push({ severity: "LOW", code: "CERT-WILDCARD", finding: "Wildcard SAN present — compromise of one subdomain key compromises all peers in the wildcard scope.", reference: "CA/B BR §3.2.2.6" });
  }

  const worst = f.reduce((acc: number, x) => Math.max(acc, ({ INFO:0, LOW:1, MEDIUM:2, HIGH:3, CRITICAL:4 })[x.severity]), 0);
  const grade = ["A", "A-", "B", "C", "F"][worst];
  return { grade, findings: f };
}

export function formatZosmaCertDossier(r: ZosmaCertReport, url: string): string {
  const header = `## ◈ ZOSMA — TLS Certificate Dossier`;
  if (!r.ok || r.error) {
    return `${header}\n\n**Target:** \`${url}\`\n\n**Verdict:** could not retrieve peer certificate.\n\n\`${r.error ?? "unknown transport error"}\``;
  }
  const bits = r.bit_length ?? 0;
  const algo = r.pubkey_algo ?? "OTHER";
  const feas = feasibilityLine(bits, algo);
  const audit = auditCert(r);

  const modLine = r.modulus_hex
    ? `\`${r.modulus_hex.length > 96 ? r.modulus_hex.slice(0, 96) + `…(${r.modulus_hex.length} hex chars)` : r.modulus_hex}\``
    : "_n/a (non-RSA key)_";

  const findingsBlock = audit.findings.length
    ? [
        "",
        "**Pentest audit findings**",
        "",
        "| sev | code | finding | ref |",
        "|---|---|---|---|",
        ...audit.findings.map((x) => `| **${x.severity}** | \`${x.code}\` | ${x.finding} | ${x.reference} |`),
      ].join("\n")
    : "\n_No cert-level weaknesses detected in scoped checks._";

  return [
    header,
    "",
    `**Target:** \`${url}\`  ·  **Host:** \`${r.host}:${r.port}\`  ·  **Grade:** **${audit.grade}**`,
    "",
    `| field | value |`,
    `|---|---|`,
    `| Subject | \`${r.subject ?? "—"}\` |`,
    `| Issuer | \`${r.issuer ?? "—"}\` |`,
    `| Valid from | ${r.valid_from ?? "—"} |`,
    `| Valid to | ${r.valid_to ?? "—"} |`,
    `| SANs | \`${(r.subjectaltname ?? "—").slice(0, 240)}\` |`,
    `| Signature algo | \`${r.sig_algo ?? "—"}\` |`,
    `| Public key algo | \`${algo}\` |`,
    `| Bit length | **${bits || "—"}** |`,
    `| SHA-256 fingerprint | \`${(r.fingerprint256 ?? "—").slice(0, 96)}\` |`,
    "",
    `**Modulus (N):** ${modLine}`,
    `**Exponent (e):** \`${r.exponent_hex ?? "—"}\``,
    findingsBlock,
    "",
    `**Cryptanalytic verdict:** ${feas}`,
    "",
    `_Report scoped to public certificate metadata only. Traffic decryption not attempted — authorized or otherwise, RSA≥2048 is not browser-tractable._`,
  ].join("\n");
}

export const ZOSMA_TRACTABLE_BITS = TRACTABLE_BITS;

