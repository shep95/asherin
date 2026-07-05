// ZIAASSETS — Client-side AES-256-GCM envelope.
// Server never sees plaintext. Server stores only bcrypt(passphrase) + per-user key salt.
// Key derived locally via PBKDF2-SHA512 with 600,000 iterations.

const PBKDF2_ITERS = 600_000;
const ENC = new TextEncoder();
const DEC = new TextDecoder();

export function bytesToB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
export function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export function randomSalt(len = 32): string {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return bytesToB64(b);
}
export function randomIV(): Uint8Array {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return b;
}

export async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    ENC.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: b64ToBytes(saltB64), iterations: PBKDF2_ITERS, hash: "SHA-512" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(key: CryptoKey, plaintext: string, aad?: string) {
  const iv = randomIV();
  const params: AesGcmParams = { name: "AES-GCM", iv };
  if (aad) params.additionalData = ENC.encode(aad);
  const ct = await crypto.subtle.encrypt(params, key, ENC.encode(plaintext));
  return { ciphertext: bytesToB64(new Uint8Array(ct)), iv: bytesToB64(iv) };
}

export async function decryptText(key: CryptoKey, ciphertextB64: string, ivB64: string, aad?: string): Promise<string> {
  const params: AesGcmParams = { name: "AES-GCM", iv: b64ToBytes(ivB64) };
  if (aad) params.additionalData = ENC.encode(aad);
  const pt = await crypto.subtle.decrypt(params, key, b64ToBytes(ciphertextB64));
  return DEC.decode(pt);
}

export async function encryptBytes(key: CryptoKey, bytes: Uint8Array): Promise<{ blob: Uint8Array; iv: string }> {
  const iv = randomIV();
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes);
  return { blob: new Uint8Array(ct), iv: bytesToB64(iv) };
}

export async function decryptBytes(key: CryptoKey, cipher: Uint8Array, ivB64: string): Promise<Uint8Array> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBytes(ivB64) }, key, cipher);
  return new Uint8Array(pt);
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Sovereign passphrase strength scorer (0–100). Encourages length + diversity + resistance to
// simple patterns. This is more strict than typical rules: minimum 16 chars, ≥3 character
// classes, penalizes repetition and dictionary-shaped runs.
export function scorePassphrase(p: string): { score: number; label: string; issues: string[] } {
  const issues: string[] = [];
  let score = 0;
  const len = p.length;
  if (len < 16) issues.push("Must be at least 16 characters.");
  score += Math.min(40, len * 2);

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(p)).length;
  if (classes < 3) issues.push("Use at least 3 of: lowercase, uppercase, digits, symbols.");
  score += classes * 8;

  const unique = new Set(p).size;
  score += Math.min(20, unique);

  if (/(.)\1{2,}/.test(p)) { score -= 15; issues.push("Avoid 3+ repeated characters."); }
  if (/(0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf|zxcv)/i.test(p)) {
    score -= 20; issues.push("Avoid keyboard runs (qwerty, 1234, abcd).");
  }
  if (/(password|asher|emperor|welcome|admin|login)/i.test(p)) {
    score -= 25; issues.push("Avoid predictable words (password, admin, emperor).");
  }
  // words-with-separators bonus (diceware-style)
  if (/[ .\-_/].*[ .\-_/].*[ .\-_/]/.test(p)) score += 10;

  score = Math.max(0, Math.min(100, score));
  const label =
    score >= 85 ? "SOVEREIGN" :
    score >= 70 ? "STRONG" :
    score >= 50 ? "ACCEPTABLE" :
    score >= 30 ? "WEAK" : "UNACCEPTABLE";
  return { score, label, issues };
}
