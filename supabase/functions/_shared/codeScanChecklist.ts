// CODE SCANNING & DEBUGGING CHECKLIST — shared across Aureon coding/audit engines.
// Sourced from operator-curated intelligence dossier (Library of Leaks references).
// Injected into: zerlal-scan, asher-code-ai, zophiel-code-audit, chat (code mode), ide-code-router.

export const CODE_SCAN_CHECKLIST = `
## MANDATORY CODE SCANNING & DEBUGGING CHECKLIST
Apply ALL of these when reading, writing, scanning, debugging, or auditing code.
For every term, format technical jargon as: **Term** (plain-English description of what it is, does, and why it matters).

### I. Cross-Domain & Origin
- **Cross-Domain Check Bypass** — circumvented isolation between origins enabling data theft.
- **Same-Origin Policy** enforcement — verify scripts cannot reach foreign origins.
- **CORS** misconfiguration — strict origin allow-lists, no wildcard with credentials.
- Input validation on anything that influences a domain/origin decision.

### II. URL, Redirect & Reload
- **Site Address Spoofing** — URL parsing, hostname validation, IDN/punycode tricks.
- **Open Redirect** — never redirect to attacker-controlled URLs.
- Reload/redirect after auth events must not leak tokens via URL params.

### III. General Bypass / Limit Testing
- Logic flaws that bypass access controls or rate limits.
- Authentication & authorization weaknesses (IDOR, privilege escalation, broken sessions, JWT misuse).
- Robust validation against malformed/oversized/unicode/edge-case input.

### IV. Code Obfuscation & Anti-Analysis
- Self-modifying code, packed/obfuscated payloads, anti-debug/anti-VM tricks.
- Steganography or data hidden inside images/comments/whitespace.

### V. Data Integrity & Confidentiality
- Data exfiltration paths (logs, telemetry, third-party SDKs, error messages).
- Encryption: weak algos, hardcoded keys, ECB mode, missing TLS, bad key rotation.
- Concealment vectors: passwords, compression, steganography, remote storage, audit-log disabling.

### VI. System Control & Execution
- PC hijacking / RCE potential (eval, deserialization, command injection, SSRF, prototype pollution).
- Malware planting vectors (file upload paths, dependency confusion, supply-chain).
- Malicious-code push paths (CI/CD, package registries, browser extensions).

### VII. Concealment & Anonymity Indicators
- Anonymous remailers, mixers, looping proxies, SIM/cell cloning, anonymous payments.
- Audit-disabling code or log-tampering routines.

### VIII. Election / Verification / Inherent Flaws
- Verification flaws in audit trails, signatures, hashes, attestations.
- Inherent design flaws (architectural — cannot be patched, must be redesigned).

### IX. Modern Application Surface
- **Prompt Injection**, insecure LLM output handling, excessive agency, model exfil.
- Cloud misconfig (open buckets, IAM over-permission, exposed metadata endpoints).
- Dependency CVEs, typosquatting, abandoned packages, lockfile tampering.
- Race conditions, TOCTOU, integer/buffer overflow, use-after-free.

### X. OTHER / Catch-All
ANYTHING ELSE that is suspicious, sloppy, non-idiomatic, or "just not good":
- dead code, leaked debug endpoints, TODO/FIXME with security implications,
- swallowed exceptions, missing rate limits, no input length caps, no timeouts,
- regex DoS, unbounded recursion, misuse of randomness, hardcoded URLs,
- inconsistent error handling, lack of telemetry on auth events,
- accessibility/i18n/perf landmines that erode trust or stability.

### Output discipline
- Be AGGRESSIVE: better to flag than to miss.
- For every finding: state WHAT, WHERE (file:line), WHY it matters, and EXACT FIX.
- If something doesn't fit categories I–IX, classify it as **OTHER** — never drop it.
`;

export const CODE_SCAN_CHECKLIST_BRIEF = `
You MUST scan against the Aureon Code Scanning Checklist:
Cross-Domain/CORS bypass • Site Spoofing/Open Redirect • Reload-Redirect leaks •
Limit/Auth bypass (IDOR, JWT, session) • Obfuscation/Anti-analysis •
Data theft & weak crypto • Concealment (steg, audit-disable) •
RCE/SSRF/Deserialization/Command-injection • Supply chain & dependency CVEs •
Prompt injection / LLM misuse • Cloud misconfig •
Race/TOCTOU/memory safety • OTHER (anything else suspicious or not-good — never drop it).
For each: WHAT, WHERE (file:line), WHY it matters, EXACT FIX. Be aggressive.
`;
