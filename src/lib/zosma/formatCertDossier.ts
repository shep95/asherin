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

export function formatZosmaCertDossier(r: ZosmaCertReport, url: string): string {
  const header = `## ◈ ZOSMA — TLS Certificate Dossier`;
  if (!r.ok || r.error) {
    return `${header}\n\n**Target:** \`${url}\`\n\n**Verdict:** could not retrieve peer certificate.\n\n\`${r.error ?? "unknown transport error"}\``;
  }
  const bits = r.bit_length ?? 0;
  const algo = r.pubkey_algo ?? "OTHER";
  const feas = feasibilityLine(bits, algo);

  const modLine = r.modulus_hex
    ? `\`${r.modulus_hex.length > 96 ? r.modulus_hex.slice(0, 96) + `…(${r.modulus_hex.length} hex chars)` : r.modulus_hex}\``
    : "_n/a (non-RSA key)_";

  return [
    header,
    "",
    `**Target:** \`${url}\`  ·  **Host:** \`${r.host}:${r.port}\``,
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
    "",
    `**Cryptanalytic verdict:** ${feas}`,
  ].join("\n");
}

export const ZOSMA_TRACTABLE_BITS = TRACTABLE_BITS;
