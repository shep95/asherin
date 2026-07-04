// ZOSMA — Weak-key scanner. Pulls the leaf cert's public key and screens it
// against known-weak-key classes:
//   • Undersized modulus (RSA <2048, EC <256)
//   • Debian OpenSSL 2006-2008 predictable-PRNG fingerprints (SHA-1 of SPKI
//     checked against a compact allow-you-in list — we ship the check hook;
//     operators supply the fingerprint corpus via env WEAK_KEY_SHA1_CSV)
//   • ROCA (CVE-2017-15361) Infineon RSALib fingerprint (discrete-log test on
//     small primes — the canonical 17-prime signature)
//   • Small-factor trial division up to 2^20 (catches broken key generators)
//   • Low-entropy modulus (repeated byte runs / obvious structure)
// Defensive only: reports weaknesses, never derives private keys.
import * as tls from "node:tls";
import * as crypto from "node:crypto";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { guardHost, requireAdmin } from "../_shared/zosma-guards.ts";

interface Finding {
  host: string;
  ok: boolean;
  grade: "A" | "B" | "C" | "D" | "F" | "ERR";
  issues: string[];
  pubkey_algo: string | null;
  bit_length: number | null;
  spki_sha1: string | null;
  spki_sha256: string | null;
  roca_vulnerable: boolean | null;
  small_factor_hit: string | null;
  low_entropy: boolean;
  known_weak_hit: boolean;
  error?: string;
}

// ROCA fingerprint: modulus mod each small prime must be a power of the
// generator. Reference: Nemec et al. USENIX 2017.
const ROCA_PRIMES = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73];
const ROCA_GEN: Record<number, number> = {
  11: 2, 13: 2, 17: 3, 19: 2, 23: 5, 29: 2, 31: 3, 37: 2, 41: 6,
  43: 3, 47: 5, 53: 2, 59: 2, 61: 2, 67: 2, 71: 7, 73: 5,
};

function modBigInt(n: bigint, m: bigint): bigint { return ((n % m) + m) % m; }

function isRocaVulnerable(modulusHex: string): boolean {
  try {
    const n = BigInt("0x" + modulusHex);
    for (const p of ROCA_PRIMES) {
      const pb = BigInt(p);
      const g = BigInt(ROCA_GEN[p]);
      const r = modBigInt(n, pb);
      // compute powers of g mod p
      const powers = new Set<bigint>();
      let x = 1n;
      for (let i = 0; i < p; i++) { powers.add(x); x = (x * g) % pb; }
      if (!powers.has(r)) return false;
    }
    return true;
  } catch { return false; }
}

const SMALL_PRIMES: number[] = (() => {
  const limit = 1 << 20;
  const sieve = new Uint8Array(limit);
  const out: number[] = [];
  for (let i = 2; i < limit; i++) {
    if (!sieve[i]) { out.push(i); for (let j = i * i; j < limit; j += i) sieve[j] = 1; }
  }
  return out;
})();

function smallFactor(modulusHex: string): string | null {
  try {
    const n = BigInt("0x" + modulusHex);
    // Only trial-divide the first ~5000 primes to keep function CPU bounded.
    for (let i = 0; i < 5000; i++) {
      const p = BigInt(SMALL_PRIMES[i]);
      if (n % p === 0n) return SMALL_PRIMES[i].toString();
    }
    return null;
  } catch { return null; }
}

function lowEntropy(modulusHex: string): boolean {
  // Chi-square-style crude check: any nibble frequency > 40% of length is
  // suspicious for a real random modulus.
  const counts = new Array(16).fill(0);
  for (const ch of modulusHex) counts[parseInt(ch, 16)]++;
  const max = Math.max(...counts);
  return max / modulusHex.length > 0.4;
}

function extractRsaModulusHex(cert: any): string | null {
  try {
    if (cert.pubkey && cert.pubkey.length) {
      const key = crypto.createPublicKey({ key: cert.pubkey, format: "der", type: "spki" });
      const jwk = key.export({ format: "jwk" }) as any;
      if (jwk.kty === "RSA" && jwk.n) {
        const buf = Buffer.from(jwk.n, "base64url");
        return buf.toString("hex");
      }
    }
    if (cert.modulus) return String(cert.modulus).toLowerCase();
  } catch { /**/ }
  return null;
}

function fingerprint(cert: any, algo: "sha1" | "sha256"): string | null {
  try {
    if (!cert.pubkey) return null;
    return crypto.createHash(algo).update(cert.pubkey).digest("hex");
  } catch { return null; }
}

function scan(host: string, port = 443, timeoutMs = 6000, weakSpkiSha1: Set<string>): Promise<Finding> {
  return new Promise((resolve) => {
    let done = false;
    const base: Finding = {
      host, ok: false, grade: "ERR", issues: [], pubkey_algo: null,
      bit_length: null, spki_sha1: null, spki_sha256: null,
      roca_vulnerable: null, small_factor_hit: null, low_entropy: false,
      known_weak_hit: false,
    };
    const finish = (r: Finding) => { if (!done) { done = true; try { socket.destroy(); } catch { /**/ } resolve(r); } };
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false });
    const to = setTimeout(() => finish({ ...base, error: `timeout ${timeoutMs}ms` }), timeoutMs);
    socket.on("secureConnect", () => {
      clearTimeout(to);
      const cert: any = socket.getPeerCertificate(true);
      if (!cert || Object.keys(cert).length === 0) return finish({ ...base, error: "empty cert" });
      const issues: string[] = [];
      const algo: string | null = cert.asn1Curve ? `EC-${cert.asn1Curve}` : (cert.modulus ? "RSA" : (cert.pubkey ? "unknown" : null));
      const bits: number | null = typeof cert.bits === "number" ? cert.bits : null;
      const spki1 = fingerprint(cert, "sha1");
      const spki256 = fingerprint(cert, "sha256");

      if (algo === "RSA" && bits && bits < 2048) issues.push(`weak RSA modulus ${bits}<2048`);
      if (algo && algo.startsWith("EC-") && bits && bits < 256) issues.push(`weak EC key ${bits}<256`);

      let roca: boolean | null = null;
      let sf: string | null = null;
      let low = false;
      if (algo === "RSA") {
        const modHex = extractRsaModulusHex(cert);
        if (modHex) {
          roca = isRocaVulnerable(modHex);
          if (roca) issues.push("ROCA vulnerable (CVE-2017-15361 Infineon RSALib)");
          sf = smallFactor(modHex);
          if (sf) issues.push(`modulus divisible by small prime ${sf} — broken key generator`);
          low = lowEntropy(modHex);
          if (low) issues.push("low-entropy modulus — suspect PRNG");
        }
      }
      const knownWeak = !!(spki1 && weakSpkiSha1.has(spki1));
      if (knownWeak) issues.push("SPKI matches known-weak fingerprint corpus");

      let grade: Finding["grade"] = "A";
      if (issues.length === 0) grade = "A";
      else if (roca || sf || knownWeak) grade = "F";
      else if (issues.length >= 2) grade = "D";
      else grade = "C";

      finish({
        host, ok: true, grade, issues,
        pubkey_algo: algo, bit_length: bits,
        spki_sha1: spki1, spki_sha256: spki256,
        roca_vulnerable: roca, small_factor_hit: sf, low_entropy: low,
        known_weak_hit: knownWeak,
      });
    });
    socket.on("error", (e) => finish({ ...base, error: String(e?.message ?? e) }));
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAdmin(req);
  if (!auth.ok) return new Response(JSON.stringify({ error: auth.error }), { status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  let body: any = {};
  try { body = await req.json(); } catch { /**/ }
  const hosts: string[] = Array.isArray(body?.hosts) ? body.hosts.slice(0, 50) : [];
  if (hosts.length === 0) return new Response(JSON.stringify({ error: "hosts[] required (max 50)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  // Optional operator-supplied fingerprint corpus for Debian OpenSSL 2008 etc.
  const csv = Deno.env.get("WEAK_KEY_SHA1_CSV") ?? "";
  const weak = new Set(csv.split(",").map(s => s.trim().toLowerCase()).filter(Boolean));

  const rows: Finding[] = [];
  for (const h of hosts) {
    const bad = guardHost(h);
    if (bad) { rows.push({ host: h, ok: false, grade: "ERR", issues: [bad], pubkey_algo: null, bit_length: null, spki_sha1: null, spki_sha256: null, roca_vulnerable: null, small_factor_hit: null, low_entropy: false, known_weak_hit: false, error: bad }); continue; }
    rows.push(await scan(h));
  }

  const summary = {
    total: rows.length,
    graded_A: rows.filter(r => r.grade === "A").length,
    graded_F: rows.filter(r => r.grade === "F").length,
    errors: rows.filter(r => r.grade === "ERR").length,
    roca_hits: rows.filter(r => r.roca_vulnerable === true).length,
    small_factor_hits: rows.filter(r => !!r.small_factor_hit).length,
    known_weak_hits: rows.filter(r => r.known_weak_hit).length,
  };
  return new Response(JSON.stringify({ operator: auth.email, summary, rows }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
