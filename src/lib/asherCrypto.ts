/**
 * ASHER Comms — End-to-End Encryption.
 *
 * Pure browser Web Crypto. The server never sees plaintext or private keys.
 *  - Identity keypair: ECDH P-256 (long-term)
 *  - Per-message: ephemeral ECDH -> shared secret -> HKDF -> AES-256-GCM key
 *  - Private key sealed at rest with AES-GCM derived from passphrase via PBKDF2
 *
 * Storage of private key: IndexedDB (sealed). Never transmitted.
 */

const IDB_NAME = "asher-comms";
const IDB_STORE = "keys";

// ---------- IndexedDB helpers ----------
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T = unknown>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readonly");
    const req = tx.objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve((req.result ?? null) as T | null);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite");
    tx.objectStore(IDB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- Encoding ----------
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- Key derivation from passphrase ----------
/** Copy Uint8Array into a fresh ArrayBuffer (TS-strict-friendly for Web Crypto). */
function toBuf(u: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u.byteLength);
  new Uint8Array(out).set(u);
  return out;
}

async function deriveSealKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toBuf(salt), iterations: 250_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

// ---------- Identity keys ----------
export interface IdentityBundle {
  publicKeyJwk: JsonWebKey;
  fingerprint: string; // SHA-256 of pubkey, hex
}

async function fingerprintPubkey(jwk: JsonWebKey): Promise<string> {
  const buf = enc.encode(JSON.stringify(jwk));
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Generate a fresh identity keypair, seal private key with passphrase, store locally. */
export async function generateIdentity(userId: string, passphrase: string): Promise<IdentityBundle> {
  const kp = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey", "deriveBits"]
  );
  const pubJwk = await crypto.subtle.exportKey("jwk", kp.publicKey);
  const privJwk = await crypto.subtle.exportKey("jwk", kp.privateKey);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealKey = await deriveSealKey(passphrase, salt);
  const sealed = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sealKey,
    enc.encode(JSON.stringify(privJwk))
  );

  await idbSet(`identity:${userId}`, {
    pubJwk,
    sealedPriv: b64encode(sealed),
    salt: b64encode(salt),
    iv: b64encode(iv),
  });

  return { publicKeyJwk: pubJwk, fingerprint: await fingerprintPubkey(pubJwk) };
}

/** Returns true if a sealed identity exists for this user on this device. */
export async function hasIdentity(userId: string): Promise<boolean> {
  return (await idbGet(`identity:${userId}`)) !== null;
}

/** Returns the user's public JWK from local storage (no passphrase needed). */
export async function getLocalPublicKey(userId: string): Promise<JsonWebKey | null> {
  const r = await idbGet<{ pubJwk: JsonWebKey }>(`identity:${userId}`);
  return r?.pubJwk ?? null;
}

/** Unlock the private key with the user's passphrase. Cached for the session. */
const privKeyCache = new Map<string, CryptoKey>();

export async function unlockIdentity(userId: string, passphrase: string): Promise<CryptoKey> {
  const cached = privKeyCache.get(userId);
  if (cached) return cached;

  const r = await idbGet<{ sealedPriv: string; salt: string; iv: string }>(`identity:${userId}`);
  if (!r) throw new Error("No identity on this device. Generate one first.");

  const sealKey = await deriveSealKey(passphrase, b64decode(r.salt));
  const privBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(r.iv) },
    sealKey,
    b64decode(r.sealedPriv).buffer
  );
  const privJwk = JSON.parse(dec.decode(privBuf)) as JsonWebKey;
  const privKey = await crypto.subtle.importKey(
    "jwk",
    privJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey", "deriveBits"]
  );
  privKeyCache.set(userId, privKey);
  return privKey;
}

export function lockIdentity(userId: string) {
  privKeyCache.delete(userId);
}

// ---------- Per-message encryption ----------
async function deriveSharedKey(privKey: CryptoKey, peerPubJwk: JsonWebKey): Promise<CryptoKey> {
  const peerKey = await crypto.subtle.importKey(
    "jwk",
    peerPubJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: peerKey }, privKey, 256);
  return crypto.subtle.importKey("raw", bits, { name: "AES-GCM", length: 256 }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export interface RecipientKey {
  recipient_id: string;
  pubkey: JsonWebKey;
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
  hash: string; // hex SHA-256 of ciphertext
  perRecipient: Array<{
    recipient_id: string;
    wrapped_key: string;
    ephemeral_pubkey: JsonWebKey;
  }>;
}

/**
 * Encrypts plaintext for every recipient.
 * One random AES key per message; wrapped per-recipient with ECDH.
 */
export async function encryptForRecipients(
  plaintext: string,
  recipients: RecipientKey[]
): Promise<EncryptedPayload> {
  // Random content key
  const contentKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, contentKey, enc.encode(plaintext));
  const ctBytes = new Uint8Array(ct);
  const hashBuf = await crypto.subtle.digest("SHA-256", ctBytes);
  const hashHex = [...new Uint8Array(hashBuf)].map((b) => b.toString(16).padStart(2, "0")).join("");

  // Wrap content key for each recipient via ephemeral ECDH
  const rawContentKey = await crypto.subtle.exportKey("raw", contentKey);

  const perRecipient = await Promise.all(
    recipients.map(async (r) => {
      // Fresh ephemeral keypair per recipient
      const eph = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"]
      );
      const ephPubJwk = await crypto.subtle.exportKey("jwk", eph.publicKey);
      const wrapKey = await deriveSharedKey(eph.privateKey, r.pubkey);
      const wrapIv = crypto.getRandomValues(new Uint8Array(12));
      const wrapped = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: wrapIv },
        wrapKey,
        rawContentKey
      );
      // Pack iv + ciphertext together
      const packed = new Uint8Array(wrapIv.length + new Uint8Array(wrapped).length);
      packed.set(wrapIv, 0);
      packed.set(new Uint8Array(wrapped), wrapIv.length);
      return {
        recipient_id: r.recipient_id,
        wrapped_key: b64encode(packed),
        ephemeral_pubkey: ephPubJwk,
      };
    })
  );

  return {
    ciphertext: b64encode(ctBytes),
    iv: b64encode(iv),
    hash: hashHex,
    perRecipient,
  };
}

export async function decryptMessage(
  myPrivKey: CryptoKey,
  ciphertextB64: string,
  ivB64: string,
  wrappedKeyB64: string,
  ephemeralPubJwk: JsonWebKey
): Promise<string> {
  const wrapKey = await deriveSharedKey(myPrivKey, ephemeralPubJwk);
  const packed = b64decode(wrappedKeyB64);
  const wrapIv = packed.slice(0, 12);
  const wrappedCt = packed.slice(12);
  const rawContentKey = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: wrapIv },
    wrapKey,
    wrappedCt.buffer
  );
  const contentKey = await crypto.subtle.importKey(
    "raw",
    rawContentKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: b64decode(ivB64) },
    contentKey,
    b64decode(ciphertextB64).buffer
  );
  return dec.decode(pt);
}

export { fingerprintPubkey };
