// Account-scoped message DEK service.
// The wrapping secret never leaves this function. The DEK is returned only to
// the authenticated owner, so every device of the same account derives the
// same plaintext.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

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

async function wrapKey(secret: string, userId: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt as BufferSource,
      info: new TextEncoder().encode(`account-dek:${userId}`),
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const secret = Deno.env.get("MESSAGE_CRYPTO_SECRET");
    if (!secret) return json({ error: "crypto unavailable" }, 503);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = String(claimsData.claims.sub);

    let action = "get_or_create";
    try {
      const body = await req.json();
      if (body && typeof body.action === "string") action = body.action;
    } catch {
      /* default action */
    }
    if (action !== "get_or_create") return json({ error: "unsupported action" }, 400);

    // RLS scopes this read/write to the caller's own row.
    const { data: row, error: readError } = await supabase
      .from("account_crypto")
      .select("wrapped_dek, salt")
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) return json({ error: "crypto unavailable" }, 503);

    if (row) {
      const salt = unb64(row.salt);
      const stored = unb64(row.wrapped_dek);
      const iv = stored.subarray(0, 12);
      const ct = stored.subarray(12);
      const key = await wrapKey(secret, userId, salt);
      const dek = new Uint8Array(
        await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct),
      );
      return json({ dek_b64: b64(dek) });
    }

    const dek = crypto.getRandomValues(new Uint8Array(32));
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await wrapKey(secret, userId, salt);
    const ct = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, dek as BufferSource),
    );
    const packed = new Uint8Array(iv.length + ct.length);
    packed.set(iv);
    packed.set(ct, iv.length);

    const { error: insertError } = await supabase.from("account_crypto").insert({
      user_id: userId,
      wrapped_dek: b64(packed),
      salt: b64(salt),
    });

    if (insertError) {
      // Race: another device created the row first — read it back.
      const { data: retry } = await supabase
        .from("account_crypto")
        .select("wrapped_dek, salt")
        .eq("user_id", userId)
        .maybeSingle();
      if (!retry) return json({ error: "crypto unavailable" }, 503);
      const rSalt = unb64(retry.salt);
      const rStored = unb64(retry.wrapped_dek);
      const rKey = await wrapKey(secret, userId, rSalt);
      const rDek = new Uint8Array(
        await crypto.subtle.decrypt(
          { name: "AES-GCM", iv: rStored.subarray(0, 12) },
          rKey,
          rStored.subarray(12),
        ),
      );
      return json({ dek_b64: b64(rDek) });
    }

    return json({ dek_b64: b64(dek) });
  } catch {
    return json({ error: "crypto unavailable" }, 503);
  }
});
