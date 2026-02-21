import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const { action } = body;

    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

    // ── GET AUTH URL ──
    if (action === "get_auth_url") {
      const scopes = [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/contacts.readonly",
        "https://www.googleapis.com/auth/drive.metadata.readonly",
        "https://www.googleapis.com/auth/fitness.activity.read",
        "https://www.googleapis.com/auth/fitness.heart_rate.read",
        "https://www.googleapis.com/auth/fitness.sleep.read",
        "https://www.googleapis.com/auth/fitness.body.read",
      ];

      const redirectUri = body.redirect_uri || `${req.headers.get("origin") || "https://ziali-magic-pixels.lovable.app"}/dashboard`;
      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: "code",
        scope: scopes.join(" "),
        access_type: "offline",
        prompt: "consent",
        state: "google_intel",
      });

      return new Response(
        JSON.stringify({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── EXCHANGE CODE ──
    if (action === "exchange_code") {
      const authCode = body.code;
      const rUri = body.redirect_uri;

      if (!authCode) {
        return new Response(JSON.stringify({ error: "Missing authorization code" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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

      if (existing) {
        await adminClient.from("google_accounts").update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || undefined,
          token_expires_at: expiresAt,
          display_name: userInfo.name,
          avatar_url: userInfo.picture,
          status: "connected",
          scopes: tokenData.scope?.split(" ") || [],
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
          scopes: tokenData.scope?.split(" ") || [],
          is_primary: true,
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
        .select("id, google_email, display_name, avatar_url, status, scopes, last_sync_at, data_points_count, is_primary")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      return new Response(
        JSON.stringify({ accounts: accounts || [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── DISCONNECT ──
    if (action === "disconnect") {
      const { data } = await supabase
        .from("google_accounts")
        .delete()
        .eq("id", body.account_id)
        .eq("user_id", userId);

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