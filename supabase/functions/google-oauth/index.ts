import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const body = await req.json();
    const { action } = body;

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    // ── GET AUTH URL ──
    if (action === "get_auth_url") {
      // ── Staged consent (Google Mesh) ──────────────────────────────────
      // Tier 1 Identity → 2 Read → 3 Comprehension → 4 Agency (compose only).
      // Requesting everything up front is what makes users abandon consent, and
      // it hands the app write power it does not yet need. Tiers are cumulative
      // and default to 3 so existing callers keep their previous capability set.
      const { scopesForTier } = await import("../_shared/googleMesh.ts");
      const requestedTier = Number(body.tier) || 3;
      const scopes = scopesForTier(requestedTier);


      // [Finding #1/#5] Generate a cryptographic state nonce tied to the user
      const stateNonce = crypto.randomUUID();
      // The launching origin rides inside `state` so the popup — which lands on
      // the single Google-registered redirect origin — knows which window to
      // hand the authorization code back to. Only same-scheme https app
      // origins are carried; anything else is dropped rather than echoed.
      const rawOrigin = typeof body.origin === "string" ? body.origin : "";
      const launchOrigin = /^https:\/\/[a-z0-9.-]+(\.lovable\.app|\.lovableproject\.com|asherin\.com)$/i.test(rawOrigin)
        ? rawOrigin
        : null;
      const statePayload = JSON.stringify({ nonce: stateNonce, userId, ts: Date.now(), origin: launchOrigin });
      const stateB64 = btoa(statePayload);

      // Store the nonce in a short-lived DB record for validation on callback
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await adminClient.from("google_accounts").upsert({
        user_id: userId,
        google_email: `pending_oauth_${stateNonce}`,
        access_token: "pending",
        refresh_token: "pending",
        token_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        status: "pending_oauth",
        scopes: [],
        is_primary: false,
      }, { onConflict: "user_id,google_email" }).select("id").single();

      // Sweep abandoned consent attempts so the placeholder rows cannot
      // accumulate and pollute the account list.
      await adminClient.from("google_accounts")
        .delete()
        .eq("user_id", userId)
        .eq("status", "pending_oauth")
        .lt("token_expires_at", new Date().toISOString());

      const redirectUri = body.redirect_uri || `${req.headers.get("origin") || "https://ziali-magic-pixels.lovable.app"}/dashboard`;
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes.join(" "),
        access_type: "offline",
        // "select_account" is what makes multi-account real: without it Google
        // silently re-authorizes whichever account is already signed in, so
        // "Add account" would keep relinking the same mailbox.
        prompt: "consent select_account",
        include_granted_scopes: "true",
        state: stateB64,
      });

      return new Response(
        JSON.stringify({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}`, state: stateB64 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── EXCHANGE CODE ──
    if (action === "exchange_code") {
      const authCode = body.code;
      const rUri = body.redirect_uri;
      const receivedState = body.state;

      if (!authCode) {
        return new Response(JSON.stringify({ error: "Missing authorization code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // [Finding #1/#5] Validate the state parameter to prevent CSRF
      if (receivedState) {
        try {
          const decoded = JSON.parse(atob(receivedState));
          if (decoded.userId !== userId) {
            return new Response(JSON.stringify({ error: "State mismatch — possible CSRF" }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          // Check state isn't older than 10 minutes
          if (Date.now() - decoded.ts > 10 * 60 * 1000) {
            return new Response(JSON.stringify({ error: "OAuth state expired" }), {
              status: 403,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } catch {
          return new Response(JSON.stringify({ error: "Invalid state parameter" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: authCode,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: rUri || "https://ziali-magic-pixels.lovable.app/dashboard",
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        console.error("Token exchange error:", tokenData);
        return new Response(JSON.stringify({ error: tokenData.error_description || tokenData.error }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get user info
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const userInfo = await userInfoRes.json();

      const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      // Derive the consent tier actually GRANTED (not requested) — users can
      // uncheck scopes on Google's screen, and the UI must reflect reality.
      const grantedScopes: string[] = tokenData.scope?.split(" ") || [];
      const grantedTier = grantedScopes.some((s: string) => s.includes("gmail.compose")) ? 4
        : grantedScopes.some((s: string) => s.includes("fitness.")) ? 3
        : grantedScopes.some((s: string) => s.includes("gmail.readonly")) ? 2
        : 1;

      // Check if account already exists
      const { data: existing } = await supabase
        .from("google_accounts")
        .select("id")
        .eq("user_id", userId)
        .eq("google_email", userInfo.email)
        .maybeSingle();

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { count: liveCount } = await adminClient
        .from("google_accounts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "connected");
      const hasPrimary = (liveCount ?? 0) > 0;

      // Drop the placeholder row this consent round created.
      await adminClient.from("google_accounts")
        .delete()
        .eq("user_id", userId)
        .eq("status", "pending_oauth");

      if (existing) {
        await adminClient.from("google_accounts").update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || undefined,
          token_expires_at: expiresAt,
          display_name: userInfo.name,
          avatar_url: userInfo.picture,
          status: "connected",
          scopes: grantedScopes,
          consent_tier: grantedTier,
          last_sync_at: new Date().toISOString(),
        }).eq("id", existing.id);
      } else {
        await adminClient.from("google_accounts").insert({
          user_id: userId,
          google_email: userInfo.email,
          display_name: userInfo.name,
          avatar_url: userInfo.picture,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_expires_at: expiresAt,
          status: "connected",
          scopes: grantedScopes,
          consent_tier: grantedTier,
          // Primary is "the first mailbox you connected", not "the last one".
          is_primary: !hasPrimary,
        });
      }

      return new Response(
        JSON.stringify({ success: true, email: userInfo.email, name: userInfo.name }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── REFRESH TOKEN ──
    if (action === "refresh_token") {
      const accountId = body.account_id;

      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const { data: account } = await adminClient
        .from("google_accounts")
        .select("*")
        .eq("id", accountId)
        .eq("user_id", userId)
        .single();

      if (!account?.refresh_token) {
        return new Response(JSON.stringify({ error: "No refresh token" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: account.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.error) {
        await adminClient.from("google_accounts").update({ status: "expired" }).eq("id", accountId);
        return new Response(JSON.stringify({ error: "Token refresh failed" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.from("google_accounts").update({
        access_token: tokenData.access_token,
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        status: "connected",
      }).eq("id", accountId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── LIST ACCOUNTS ──
    if (action === "list_accounts") {
      const { data: accounts } = await supabase
        .from("google_accounts")
        .select("id, google_email, display_name, avatar_url, status, scopes, last_sync_at, data_points_count, is_primary, consent_tier")
        .eq("user_id", userId)
        .neq("status", "pending_oauth")
        .order("created_at", { ascending: true });

      return new Response(
        JSON.stringify({ accounts: accounts || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── DISCONNECT ──
    if (action === "disconnect") {
      await supabase
        .from("google_accounts")
        .delete()
        .eq("id", body.account_id)
        .eq("user_id", userId);

      // Never leave the mesh without a primary: promote the oldest survivor.
      const { data: remaining } = await supabase
        .from("google_accounts")
        .select("id, is_primary")
        .eq("user_id", userId)
        .eq("status", "connected")
        .order("created_at", { ascending: true });
      if ((remaining ?? []).length && !(remaining ?? []).some((r: any) => r.is_primary)) {
        await supabase.from("google_accounts")
          .update({ is_primary: true })
          .eq("id", remaining![0].id);
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("google-oauth error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});