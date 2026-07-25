/**
 * ASHERIN Client-Side Encryption Module — Hardened (audit C-05)
 *
 * AES-256-GCM via Web Crypto API.
 * Key material = PBKDF2(userId + browser-stored random secret, per-user random salt).
 *
 * Why this is materially better than the previous version:
 * - Previous: PBKDF2(userId, hardcoded global salt). Anyone with DB access
 *   could recompute every user's key.
 * - Now: salt is randomly generated per user and stored in IndexedDB on the
 *   user's device. A second random "device secret" is also stored in IndexedDB
 *   and mixed into the key material. The server NEVER sees either value, so a
 *   full database breach reveals only ciphertexts.
 * - Failures NEVER silently fall back to plaintext (audit C-09). They throw.
 *
 * Limitation (documented honestly): this is device-local E2E. A user who logs
 * in from a new device will not see old messages until they re-derive a key
 * (future work: passphrase-derived recovery key).
 */

import { supabase } from "@/integrations/supabase/client";

const DB_NAME = "asherin_e2e_db";
const DB_VERSION = 1;
const STORE = "keystore";
const ITERATIONS = 250_000; // bumped from 100k

interface DeviceKeyMaterial {
  salt: Uint8Array;
  deviceSecret: Uint8Array;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readKeyMaterial(userId: string): Promise<DeviceKeyMaterial | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.get(userId);
    req.onsuccess = () => {
      const v = req.result as DeviceKeyMaterial | undefined;
      resolve(v ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

async function writeKeyMaterial(userId: string, material: DeviceKeyMaterial): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(material, userId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function bytesToB64(b: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < b.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(b.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}
function b64ToBytes(s: string): Uint8Array {
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

// P0: Key material is NEVER synced to the server. Previously the device
// secret + salt were pushed to user_key_material, which meant anyone with
// service-role / DB access could recompute every user's AES key and
// decrypt all messages — fully defeating the stated E2E model.
//
// Trade-off: a user who logs in from a new device cannot decrypt old
// messages until a future passphrase-derived recovery key feature is added.
// This is the correct security posture for E2E.

async function getOrCreateKeyMaterial(userId: string): Promise<DeviceKeyMaterial> {
  // Device-local only. No remote fetch, no remote push.
  const local = await readKeyMaterial(userId);
  if (local) return local;

  const material: DeviceKeyMaterial = {
    salt: crypto.getRandomValues(new Uint8Array(32)),
    deviceSecret: crypto.getRandomValues(new Uint8Array(32)),
  };
  await writeKeyMaterial(userId, material);
  return material;
}

async function deriveKey(userId: string): Promise<CryptoKey> {
  const { salt, deviceSecret } = await getOrCreateKeyMaterial(userId);
  // Mix userId + device secret as input material — neither alone is enough.
  const inputBytes = new Uint8Array(deviceSecret.length + userId.length);
  inputBytes.set(deviceSecret, 0);
  inputBytes.set(new TextEncoder().encode(userId), deviceSecret.length);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    inputBytes,
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export class EncryptionError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "EncryptionError";
  }
}

export async function encryptText(plaintext: string, userId: string): Promise<string> {
  // SECURITY (C-09): never silently fall back to plaintext. Caller MUST decide.
  if (!userId) throw new EncryptionError("encryptText requires a userId");
  if (!crypto?.subtle) throw new EncryptionError("Web Crypto API unavailable in this context");

  try {
    const key = await deriveKey(userId);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

    const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    // btoa across a chunked array (avoid call-stack overflow on big payloads)
    let bin = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < combined.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, Array.from(combined.subarray(i, i + CHUNK)));
    }
    return `ENC:${btoa(bin)}`;
  } catch (e) {
    throw new EncryptionError("Failed to encrypt payload", e);
  }
}

export async function decryptText(data: string, userId: string): Promise<string> {
  if (!data.startsWith("ENC:")) return data; // legacy plaintext — passthrough

  if (!userId) throw new EncryptionError("decryptText requires a userId");
  if (!crypto?.subtle) throw new EncryptionError("Web Crypto API unavailable in this context");

  try {
    const key = await deriveKey(userId);
    const raw = Uint8Array.from(atob(data.slice(4)), (c) => c.charCodeAt(0));
    const iv = raw.slice(0, 12);
    const ciphertext = raw.slice(12);

    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch (e) {
    // Surface decryption failures honestly — different device, wrong key, or
    // tampered ciphertext. Do NOT silently return the ciphertext.
    throw new EncryptionError("Failed to decrypt payload (wrong device or tampered data)", e);
  }
}

export function isEncrypted(data: string): boolean {
  return typeof data === "string" && data.startsWith("ENC:");
}

/**
 * Best-effort wipe of per-user key material (e.g. on logout from a shared
 * device). Subsequent encrypt/decrypt for this userId will fail until the
 * user re-derives material on a fresh login.
 */
export async function wipeKeyMaterial(userId: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(userId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* no-op */
  }
}
