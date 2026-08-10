// TEMPORARY self-test harness. Mints a short-lived session for the admin
// operator and replays a single prompt through the real /chat pipeline so the
// exact streamed output can be captured verbatim. Deleted after use.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));

  // Gated on an existing server-side cron token — the caller must already hold
  // a secret that never reaches the browser.
  const gateClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: tokenRow } = await gateClient
    .from("cron_tokens").select("token").eq("name", "rideshare_autopilot").maybeSingle();
  if (!tokenRow?.token || body?.token !== tokenRow.token) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const email = String(body?.email || "");
  const prompt = String(body?.prompt || "");
  if (!email || !prompt) {
    return new Response(JSON.stringify({ error: "email and prompt required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !link?.properties?.hashed_token) {
    return new Response(JSON.stringify({ error: `link: ${linkErr?.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: sess, error: otpErr } = await admin.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (otpErr || !sess?.session?.access_token) {
    return new Response(JSON.stringify({ error: `otp: ${otpErr?.message}` }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/chat`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sess.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      mode: "chat",
      responseDepth: "standard",
    }),
    signal: AbortSignal.timeout(240_000),
  });

  const raw = await res.text();
  // The chat route streams SSE; accumulate any text deltas, else return raw.
  let acc = "";
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    try {
      const j = JSON.parse(payload);
      acc += j?.choices?.[0]?.delta?.content ?? j?.content ?? j?.text ?? "";
    } catch { /* non-JSON frame */ }
  }

  return new Response(
    JSON.stringify({ status: res.status, accumulated: acc, rawHead: raw.slice(0, 1200) }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
