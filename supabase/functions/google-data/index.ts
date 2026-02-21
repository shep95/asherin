import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getValidToken(userId: string, accountId: string | null): Promise<{ token: string; accountId: string } | null> {
  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let query = adminClient.from("google_accounts").select("*").eq("user_id", userId).eq("status", "connected");
  if (accountId) {
    query = query.eq("id", accountId);
  } else {
    query = query.eq("is_primary", true);
  }

  const { data: accounts } = await query.limit(1);
  if (!accounts?.length) return null;

  const account = accounts[0];
  const expiresAt = new Date(account.token_expires_at).getTime();

  // If token expires in < 5 minutes, refresh
  if (expiresAt - Date.now() < 5 * 60 * 1000 && account.refresh_token) {
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;

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
    if (tokenData.access_token) {
      await adminClient.from("google_accounts").update({
        access_token: tokenData.access_token,
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
      }).eq("id", account.id);
      return { token: tokenData.access_token, accountId: account.id };
    } else {
      await adminClient.from("google_accounts").update({ status: "expired" }).eq("id", account.id);
      return null;
    }
  }

  return { token: account.access_token, accountId: account.id };
}

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
    const userId = claimsData.claims.sub as string;

    const { service, account_id, params } = await req.json();

    const tokenResult = await getValidToken(userId, account_id || null);
    if (!tokenResult) {
      return new Response(
        JSON.stringify({ error: "no_account", message: "No connected Google account found. Please connect one first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { token: accessToken } = tokenResult;
    const headers = { Authorization: `Bearer ${accessToken}` };

    let result: any = null;

    // ── GMAIL ──
    if (service === "gmail_inbox") {
      const maxResults = params?.maxResults || 20;
      const q = params?.q || "is:inbox";
      const res = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(q)}`,
        { headers }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      // Fetch message details for first 10
      const messages = data.messages?.slice(0, 10) || [];
      const details = await Promise.all(
        messages.map(async (msg: any) => {
          const r = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
            { headers }
          );
          return r.json();
        })
      );

      result = {
        totalMessages: data.resultSizeEstimate || 0,
        messages: details.map((d: any) => {
          const hdrs = d.payload?.headers || [];
          return {
            id: d.id,
            from: hdrs.find((h: any) => h.name === "From")?.value || "",
            subject: hdrs.find((h: any) => h.name === "Subject")?.value || "",
            date: hdrs.find((h: any) => h.name === "Date")?.value || "",
            snippet: d.snippet || "",
            labelIds: d.labelIds || [],
            isUnread: d.labelIds?.includes("UNREAD"),
          };
        }),
      };
    }

    // ── GMAIL STATS ──
    else if (service === "gmail_stats") {
      const [unreadRes, importantRes, starredRes] = await Promise.all([
        fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=is:unread", { headers }),
        fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=is:important+is:unread", { headers }),
        fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=is:starred", { headers }),
      ]);

      const [unread, important, starred] = await Promise.all([
        unreadRes.json(), importantRes.json(), starredRes.json(),
      ]);

      result = {
        unread: unread.resultSizeEstimate || 0,
        important: important.resultSizeEstimate || 0,
        starred: starred.resultSizeEstimate || 0,
      };
    }

    // ── CALENDAR ──
    else if (service === "calendar_events") {
      const now = new Date();
      const timeMin = params?.timeMin || now.toISOString();
      const timeMax = params?.timeMax || new Date(now.getTime() + 7 * 86400000).toISOString();
      const maxResults = params?.maxResults || 50;

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=${maxResults}&singleEvents=true&orderBy=startTime`,
        { headers }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      result = {
        events: (data.items || []).map((e: any) => ({
          id: e.id,
          summary: e.summary || "No Title",
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          attendees: (e.attendees || []).length,
          location: e.location,
          status: e.status,
          organizer: e.organizer?.email,
          isAllDay: !!e.start?.date,
        })),
        totalEvents: data.items?.length || 0,
      };
    }

    // ── CONTACTS ──
    else if (service === "contacts") {
      const pageSize = params?.pageSize || 100;
      const res = await fetch(
        `https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,photos,organizations&pageSize=${pageSize}&sortOrder=LAST_MODIFIED_DESCENDING`,
        { headers }
      );
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      result = {
        totalContacts: data.totalPeople || data.connections?.length || 0,
        contacts: (data.connections || []).map((c: any) => ({
          name: c.names?.[0]?.displayName || "Unknown",
          email: c.emailAddresses?.[0]?.value || "",
          phone: c.phoneNumbers?.[0]?.value || "",
          photo: c.photos?.[0]?.url || "",
          organization: c.organizations?.[0]?.name || "",
        })),
      };
    }

    // ── DRIVE ──
    else if (service === "drive_files") {
      const pageSize = params?.pageSize || 20;
      const q = params?.q || "";
      let url = `https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}&fields=files(id,name,mimeType,modifiedTime,size,owners,shared)&orderBy=modifiedTime desc`;
      if (q) url += `&q=${encodeURIComponent(q)}`;

      const res = await fetch(url, { headers });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      result = {
        files: (data.files || []).map((f: any) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          modifiedTime: f.modifiedTime,
          size: f.size,
          shared: f.shared,
        })),
      };
    }

    // ── FITNESS ──
    else if (service === "fitness") {
      const now = Date.now();
      const startTimeNanos = String((now - 7 * 86400000) * 1000000);
      const endTimeNanos = String(now * 1000000);

      const datasetRes = await fetch(
        "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
        {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify({
            aggregateBy: [
              { dataTypeName: "com.google.step_count.delta" },
              { dataTypeName: "com.google.heart_rate.bpm" },
              { dataTypeName: "com.google.calories.expended" },
            ],
            bucketByTime: { durationMillis: 86400000 },
            startTimeMillis: now - 7 * 86400000,
            endTimeMillis: now,
          }),
        }
      );

      const fitData = await datasetRes.json();
      if (fitData.error) throw new Error(fitData.error.message);

      const dailyData = (fitData.bucket || []).map((bucket: any) => {
        const date = new Date(parseInt(bucket.startTimeMillis)).toISOString().slice(0, 10);
        let steps = 0, heartRate = 0, calories = 0;

        for (const ds of bucket.dataset || []) {
          for (const pt of ds.point || []) {
            if (ds.dataSourceId?.includes("step_count")) {
              steps += pt.value?.[0]?.intVal || 0;
            } else if (ds.dataSourceId?.includes("heart_rate")) {
              heartRate = pt.value?.[0]?.fpVal || 0;
            } else if (ds.dataSourceId?.includes("calories")) {
              calories += pt.value?.[0]?.fpVal || 0;
            }
          }
        }

        return { date, steps, heartRate: Math.round(heartRate), calories: Math.round(calories) };
      });

      result = { dailyData };
    }

    // ── USER PROFILE ──
    else if (service === "profile") {
      const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers });
      result = await res.json();
    }

    else {
      return new Response(JSON.stringify({ error: `Unknown service: ${service}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update data points count
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await adminClient.from("google_accounts")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", tokenResult.accountId);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("google-data error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});