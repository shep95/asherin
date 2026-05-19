// Server-side verification of the Asher Brains vault passcode.
// The passcode lives ONLY in the ASHER_BRAINS_PASSCODE secret — never in client code.
// Uses constant-time comparison to prevent timing attacks.

import { getCorsHeaders } from "../_shared/cors.ts";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still iterate over the longer string to keep comparison time roughly constant.
    let _diff = 1;
    const longer = a.length > b.length ? a : b;
    for (let i = 0; i < longer.length; i++) _diff |= 1;
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const expected = Deno.env.get("ASHER_BRAINS_PASSCODE");
    if (!expected) {
      return new Response(
        JSON.stringify({ ok: false, error: "Vault not configured" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const { code } = await req.json().catch(() => ({ code: "" }));
    const submitted = typeof code === "string" ? code : "";
    const ok = timingSafeEqual(submitted, expected);

    // Small jitter to further blur timing oracles.
    await new Promise((r) => setTimeout(r, 80 + Math.random() * 80));

    return new Response(
      JSON.stringify({ ok }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (_e) {
    return new Response(
      JSON.stringify({ ok: false, error: "Verification failed" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
