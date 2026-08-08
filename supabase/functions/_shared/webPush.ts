/**
 * Minimal RFC 8291 / RFC 8188 Web Push sender built on WebCrypto only.
 *
 * Written by hand rather than pulled from npm because the Deno edge runtime's
 * node-compat surface is the wrong place to discover a shim gap at 2am when a
 * rider is waiting on a safety alert.
 */

const enc = new TextEncoder();

function b64urlToBytes(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const padded = pad + "=".repeat((4 - (pad.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8);
  return new Uint8Array(bits);
}

/** ES256 VAPID authorization header for one push origin. */
async function vapidHeader(audience: string, subject: string, publicKey: string, privateKey: string): Promise<string> {
  const pub = b64urlToBytes(publicKey); // 65-byte uncompressed point
  if (pub.length !== 65 || pub[0] !== 0x04) throw new Error("vapid_public_key_malformed");
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d: bytesToB64url(b64urlToBytes(privateKey)),
    ext: true,
  };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);

  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const body = bytesToB64url(enc.encode(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: subject,
  })));
  const signing = `${header}.${body}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signing)));
  return `vapid t=${signing}.${bytesToB64url(sig)}, k=${publicKey}`;
}

async function encryptPayload(plaintext: string, p256dh: string, authSecret: string) {
  const uaPublicRaw = b64urlToBytes(p256dh);
  const auth = b64urlToBytes(authSecret);

  const uaPublic = await crypto.subtle.importKey(
    "raw", uaPublicRaw, { name: "ECDH", namedCurve: "P-256" }, false, [],
  );
  const local = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPublicRaw = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));

  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaPublic }, local.privateKey, 256),
  );

  const prk = await hkdf(
    auth,
    shared,
    concat(enc.encode("WebPush: info\0"), uaPublicRaw, asPublicRaw),
    32,
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, prk, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, prk, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const padded = concat(enc.encode(plaintext), new Uint8Array([0x02]));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, tagLength: 128 }, aesKey, padded),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPublicRaw.length]), asPublicRaw, ct);
}

export interface PushSub {
  endpoint: string;
  p256dh: string;
  auth_key: string;
}

export interface PushOutcome {
  endpoint: string;
  ok: boolean;
  status: number;
  /** true when the endpoint is permanently dead and its row should be dropped */
  gone: boolean;
  error?: string;
}

/** Send one notification. Never throws — the caller must not lose a report to a push failure. */
export async function sendWebPush(
  sub: PushSub,
  payload: Record<string, unknown>,
  opts: { ttl?: number; urgency?: "very-low" | "low" | "normal" | "high"; timeoutMs?: number } = {},
): Promise<PushOutcome> {
  const base: PushOutcome = { endpoint: sub.endpoint, ok: false, status: 0, gone: false };
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:support@asherin.com";
  if (!publicKey || !privateKey) return { ...base, error: "vapid_not_configured" };

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? 10_000);
  try {
    const audience = new URL(sub.endpoint).origin;
    const [auth, body] = await Promise.all([
      vapidHeader(audience, subject, publicKey, privateKey),
      encryptPayload(JSON.stringify(payload), sub.p256dh, sub.auth_key),
    ]);

    const res = await fetch(sub.endpoint, {
      method: "POST",
      signal: ac.signal,
      headers: {
        Authorization: auth,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(opts.ttl ?? 1800),
        Urgency: opts.urgency ?? "high",
      },
      body,
    });

    if (res.ok) return { ...base, ok: true, status: res.status };
    const text = await res.text().catch(() => "");
    return {
      ...base,
      status: res.status,
      gone: res.status === 404 || res.status === 410,
      error: `push_${res.status}: ${text.slice(0, 200)}`,
    };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "push_failed" };
  } finally {
    clearTimeout(timer);
  }
}
