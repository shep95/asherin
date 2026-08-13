// Booleans only. This function exists so the API Keys tab can show which
// providers are actually bound without any key material ever reaching the
// browser: it returns `true`/`false` per provider name and nothing else.
//
// Resolution order mirrored from _shared/keyResolution.ts:
//   byok      → the caller's own row in user_api_keys
//   platform  → the same-named Supabase edge secret
//   effective → byok || platform (what a call would actually use)

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  MODEL_PRIORITY,
  auxStatus,
  platformProviderStatus,
  userByokStatus,
} from "../_shared/keyResolution.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  let userId = "";
  try {
    const authSb = createClient(url, anon, { auth: { persistSession: false } });
    const { data } = await authSb.auth.getUser(authHeader.slice(7));
    userId = data?.user?.id || "";
  } catch {
    userId = "";
  }
  if (!userId) return json({ error: "unauthorized" }, 401);

  const adminSb = createClient(url, service, { auth: { persistSession: false } });
  const byok = await userByokStatus(adminSb, userId);
  const platform = platformProviderStatus();

  const providers = Array.from(
    new Set([...MODEL_PRIORITY, ...Object.keys(platform), ...Object.keys(byok)]),
  ).map((provider) => ({
    provider,
    byok: byok[provider] === true,
    platform: platform[provider] === true,
    effective: byok[provider] === true || platform[provider] === true,
  }));

  return json({
    providers,
    aux: auxStatus(),
    note:
      "Presence booleans only. No key material is returned by this endpoint, for BYOK or platform secrets.",
  });
});
