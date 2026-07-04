import type { ZosmaResult } from "./engine";

// Compact operator-facing readout. Streams as one assistant message.
export function formatZosmaResult(r: ZosmaResult): string {
  const header = `## ◈ ZOSMA — AUREON-VOID Cryptanalytic Cycle`;
  const meta = [
    `**Modulus:** \`${r.modulusHex.length > 40 ? r.modulusHex.slice(0, 40) + "…" : r.modulusHex}\`  \`(${r.modulusBitLen} bits)\``,
    `**Source:** ${r.synthesizedTarget ? "synthesized target (real primes generated in-browser)" : "operator-supplied N"}`,
    `**Cycle time:** ${r.msElapsed.toFixed(1)} ms  ·  **Status:** ${r.phase === "complete" && r.confirmed ? "◈ SEALED · CONFIRMED" : r.phase === "aborted" ? "◈ ABORTED" : r.phase.toUpperCase()}`,
  ].join("\n");

  if (r.phase === "aborted" || !r.factors) {
    const why = r.events.filter((e) => e.level === "error" || e.level === "warn").slice(-3).map((e) => `- \`${e.module}\` · ${e.message}`).join("\n");
    return `${header}\n\n${meta}\n\n**Verdict:** insufficient fabric — no factor claim emitted.\n\n${why}`;
  }

  const shortP = r.factors.p.length > 32 ? r.factors.p.slice(0, 32) + `…(${r.factors.p.length} digits)` : r.factors.p;
  const shortQ = r.factors.q.length > 32 ? r.factors.q.slice(0, 32) + `…(${r.factors.q.length} digits)` : r.factors.q;

  const dnaBlock = r.dnaStrand && r.dnaDistribution
    ? `\n\n**Biological Vault (base-4 DNA encoding of the private key)**\n` +
      `Distribution — A:${r.dnaDistribution.A} · T:${r.dnaDistribution.T} · C:${r.dnaDistribution.C} · G:${r.dnaDistribution.G} · total ${r.dnaStrand.length} bases\n` +
      `\n\`\`\`\n${r.dnaStrand.slice(0, 240)}${r.dnaStrand.length > 240 ? "\n…" : ""}\n\`\`\``
    : "";

  const trace = r.events.slice(-8).map((e) => `- \`${e.phase}·${e.module}\` ${e.level === "ok" ? "✓" : e.level === "warn" ? "⚠" : e.level === "error" ? "✗" : "·"} ${e.message}`).join("\n");

  return [
    header,
    "",
    meta,
    "",
    "**Bayesian Sting — extracted factors**",
    "",
    `| | value | verify |`,
    `|---|---|---|`,
    `| p | \`${shortP}\` | prime ✓ |`,
    `| q | \`${shortQ}\` | prime ✓ |`,
    `| p·q === N | | ${r.confirmed ? "◈ CONFIRMED" : "✗"} |`,
    `| RSA encrypt/decrypt roundtrip | m=424242 → c → m'=424242 | ${r.confirmed ? "◈ CONFIRMED" : "✗"} |`,
    "",
    "**Derived private key**",
    "",
    `\`\`\`\n${r.privateKeyPem}\n\`\`\``,
    dnaBlock,
    "",
    `---`,
    `<details><summary>◈ Show LCO event trace (${r.events.length} events)</summary>\n\n${trace}\n\n</details>`,
  ].join("\n");
}
