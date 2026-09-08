// Server-side vault crypto.
//
// The vault is the operator's private file. The server writes into it, so the
// server must be able to seal an entry with the SAME account key the browser
// uses — otherwise the operator could never open what was written for them.
//
// The key never lives here. It is fetched, per request, from the
// `message-crypto` function using the caller's own bearer token, held only for
// the life of the request, and never logged. Wire format is byte-identical to
// src/lib/encryption.ts: "ENC:" + base64(iv[12] | ciphertext).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

function b64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

/**
 * Account DEK for the caller. Returns null when crypto is unavailable or the
 * token is not assured enough to hold the key — callers must then refuse to
 * store anything sensitive rather than quietly writing plaintext.
 */
export async function getAccountKey(authHeader: string): Promise<CryptoKey | null> {
  if (!authHeader?.startsWith("Bearer ") || !SUPABASE_URL) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/message-crypto`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_or_create" }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    const dek = typeof j?.dek_b64 === "string" ? j.dek_b64 : "";
    if (!dek) return null;
    const raw = unb64(dek);
    if (raw.length !== 32) return null;
    return await crypto.subtle.importKey("raw", raw as BufferSource, { name: "AES-GCM" }, false, [
      "encrypt",
      "decrypt",
    ]);
  } catch {
    return null;
  }
}

export async function sealText(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)),
  );
  const combined = new Uint8Array(iv.length + ct.length);
  combined.set(iv);
  combined.set(ct, iv.length);
  return `ENC:${b64(combined)}`;
}

/** Opens a sealed entry. Legacy plaintext passes through, as on the client. */
export async function openText(data: string, key: CryptoKey | null): Promise<string | null> {
  if (!data.startsWith("ENC:")) return data;
  if (!key) return null;
  try {
    const raw = unb64(data.slice(4));
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: raw.slice(0, 12) },
      key,
      raw.slice(12),
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

/**
 * Stable per-user dedupe fingerprint over the PLAINTEXT, so a re-observed fact
 * collides even though its ciphertext differs every time it is sealed.
 */
export async function fingerprint(userId: string, content: string): Promise<string> {
  const norm = `${userId}${content.trim().toLowerCase().replace(/\s+/g, " ")}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(norm));
  return Array.from(new Uint8Array(digest))
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
