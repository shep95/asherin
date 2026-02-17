/**
 * AUREON Client-Side Encryption Module
 * AES-256-GCM encryption using Web Crypto API
 * Key derived from user ID via PBKDF2
 */

const SALT = new TextEncoder().encode("ZIALIEL-E2E-SALT-v1");
const ITERATIONS = 100_000;

async function deriveKey(userId: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(userId),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(plaintext: string, userId: string): Promise<string> {
  try {
    const key = await deriveKey(userId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoded
    );

    // Combine IV + ciphertext and encode as base64
    const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return `ENC:${btoa(String.fromCharCode(...combined))}`;
  } catch {
    // Fallback: return plaintext if encryption fails
    return plaintext;
  }
}

export async function decryptText(data: string, userId: string): Promise<string> {
  try {
    if (!data.startsWith("ENC:")) return data; // Not encrypted, return as-is

    const key = await deriveKey(userId);
    const raw = Uint8Array.from(atob(data.slice(4)), (c) => c.charCodeAt(0));

    const iv = raw.slice(0, 12);
    const ciphertext = raw.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch {
    // Fallback: return raw data if decryption fails
    return data.startsWith("ENC:") ? "[Encrypted message - unable to decrypt]" : data;
  }
}

export function isEncrypted(data: string): boolean {
  return data.startsWith("ENC:");
}
