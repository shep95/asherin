import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts
let corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "https://aureonai.app",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Vary": "Origin",
};

const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function refreshTokenIfNeeded(account: any): Promise<string | null> {
  const expiresAt = new Date(account.token_expires_at).getTime();
  if (expiresAt - Date.now() < 5 * 60 * 1000 && account.refresh_token) {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: Deno.env.get("GOOGLE_CLIENT_ID")!,
        client_secret: Deno.env.get("GOOGLE_CLIENT_SECRET")!,
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
      return tokenData.access_token;
    } else {
      await adminClient.from("google_accounts").update({ status: "expired" }).eq("id", account.id);
      return null;
    }
  }
  return account.access_token;
}

async function getValidToken(userId: string, accountId: string | null): Promise<{ token: string; accountId: string } | null> {
  let query = adminClient.from("google_accounts").select("*").eq("user_id", userId).eq("status", "connected");
  if (accountId) query = query.eq("id", accountId);
  const { data: accounts } = await query.order("created_at", { ascending: true }).limit(1);
  if (!accounts?.length) return null;
  const token = await refreshTokenIfNeeded(accounts[0]);
  if (!token) return null;
  return { token, accountId: accounts[0].id };
}

async function getAllValidTokens(userId: string): Promise<{ token: string; accountId: string; email: string }[]> {
  const { data: accounts } = await adminClient.from("google_accounts").select("*").eq("user_id", userId).eq("status", "connected");
  if (!accounts?.length) return [];
  const results: { token: string; accountId: string; email: string }[] = [];
  for (const account of accounts) {
    const token = await refreshTokenIfNeeded(account);
    if (token) results.push({ token, accountId: account.id, email: account.google_email });
  }
  return results;
}

// ── Extracted service data fetching ──
async function fetchServiceData(service: string, params: any, headers: Record<string, string>): Promise<any> {
  if (service === "gmail_inbox") {
    const maxResults = params?.maxResults || 20;
    const q = params?.q || "is:inbox";
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(q)}`,
      { headers }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
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
    return {
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

  if (service === "gmail_stats") {
    const [unreadRes, importantRes, starredRes] = await Promise.all([
      fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=is:unread", { headers }),
      fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=is:important+is:unread", { headers }),
      fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&q=is:starred", { headers }),
    ]);
    const [unread, important, starred] = await Promise.all([unreadRes.json(), importantRes.json(), starredRes.json()]);
    return {
      unread: unread.resultSizeEstimate || 0,
      important: important.resultSizeEstimate || 0,
      starred: starred.resultSizeEstimate || 0,
    };
  }

  if (service === "calendar_events") {
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
    return {
      events: (data.items || []).map((e: any) => ({
        id: e.id, summary: e.summary || "No Title",
        start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date,
        attendees: (e.attendees || []).length, location: e.location, status: e.status,
        organizer: e.organizer?.email, isAllDay: !!e.start?.date,
      })),
      totalEvents: data.items?.length || 0,
    };
  }

  if (service === "contacts") {
    const pageSize = params?.pageSize || 100;
    const res = await fetch(
      `https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,photos,organizations&pageSize=${pageSize}&sortOrder=LAST_MODIFIED_DESCENDING`,
      { headers }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return {
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

  if (service === "drive_files") {
    const pageSize = params?.pageSize || 20;
    const q = params?.q || "";
    let url = `https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}&fields=files(id,name,mimeType,modifiedTime,size,owners,shared)&orderBy=modifiedTime desc`;
    if (q) url += `&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return {
      files: (data.files || []).map((f: any) => ({
        id: f.id, name: f.name, mimeType: f.mimeType,
        modifiedTime: f.modifiedTime, size: f.size, shared: f.shared,
      })),
    };
  }

  if (service === "fitness") {
    const now = Date.now();
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
          if (ds.dataSourceId?.includes("step_count")) steps += pt.value?.[0]?.intVal || 0;
          else if (ds.dataSourceId?.includes("heart_rate")) heartRate = pt.value?.[0]?.fpVal || 0;
          else if (ds.dataSourceId?.includes("calories")) calories += pt.value?.[0]?.fpVal || 0;
        }
      }
      return { date, steps, heartRate: Math.round(heartRate), calories: Math.round(calories) };
    });
    return { dailyData };
  }

  if (service === "profile") {
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers });
    return await res.json();
  }

  if (service === "drive_about") {
    const res = await fetch("https://www.googleapis.com/drive/v3/about?fields=storageQuota,user", { headers });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data;
  }

  if (service === "youtube_channels") {
    const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&mine=true", { headers });
    return await res.json();
  }

  throw new Error(`Unknown service: ${service}`);
}

// ── Merge results from multiple accounts ──
function mergeResults(service: string, results: any[]): any {
  if (!results.length) return {};

  if (service === "gmail_inbox") {
    const allMessages = results.flatMap(r => (r.messages || []).map((m: any) => ({ ...m, _account: r._account_email })));
    allMessages.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { totalMessages: results.reduce((s, r) => s + (r.totalMessages || 0), 0), messages: allMessages.slice(0, 20) };
  }

  if (service === "gmail_stats") {
    return {
      unread: results.reduce((s, r) => s + (r.unread || 0), 0),
      important: results.reduce((s, r) => s + (r.important || 0), 0),
      starred: results.reduce((s, r) => s + (r.starred || 0), 0),
      _per_account: results.map(r => ({ email: r._account_email, unread: r.unread || 0, important: r.important || 0, starred: r.starred || 0 })),
    };
  }

  if (service === "calendar_events") {
    const allEvents = results.flatMap(r => (r.events || []).map((e: any) => ({ ...e, _account: r._account_email })));
    allEvents.sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return { events: allEvents, totalEvents: allEvents.length };
  }

  if (service === "contacts") {
    const allContacts = results.flatMap(r => (r.contacts || []).map((c: any) => ({ ...c, _account: r._account_email })));
    return { totalContacts: allContacts.length, contacts: allContacts };
  }

  if (service === "drive_files") {
    const allFiles = results.flatMap(r => (r.files || []).map((f: any) => ({ ...f, _account: r._account_email })));
    allFiles.sort((a: any, b: any) => new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime());
    return { files: allFiles };
  }

  // For fitness and other services, DON'T merge — return the first account's data
  // Fitness data (steps, heart rate) should not be summed across accounts
  if (service === "fitness") {
    return results[0] || {};
  }

  // For other services, return array of per-account results
  return { accounts: results };
}

Deno.serve(async (req) => {
  corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const { service, account_id, params, aggregate } = await req.json();

    // Aggregate mode: fetch from ALL connected accounts and merge
    if (aggregate && !account_id) {
      const allTokens = await getAllValidTokens(userId);
      if (!allTokens.length) {
        return new Response(
          JSON.stringify({ error: "no_account", message: "No connected Google account found." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const allResults: any[] = [];
      for (const t of allTokens) {
        try {
          const singleResult = await fetchServiceData(service, params, { Authorization: `Bearer ${t.token}` });
          if (singleResult) allResults.push({ ...singleResult, _account_email: t.email, _account_id: t.accountId });
          await adminClient.from("google_accounts").update({ last_sync_at: new Date().toISOString() }).eq("id", t.accountId);
        } catch (e) {
          console.error(`Error fetching ${service} for ${t.email}:`, e);
        }
      }

      const merged = mergeResults(service, allResults);
      return new Response(JSON.stringify(merged), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Single account mode
    const tokenResult = await getValidToken(userId, account_id || null);
    if (!tokenResult) {
      return new Response(
        JSON.stringify({ error: "no_account", message: "No connected Google account found. Please connect one first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await fetchServiceData(service, params, { Authorization: `Bearer ${tokenResult.token}` });

    await adminClient.from("google_accounts")
      .update({ last_sync_at: new Date().toISOString() })
      .eq("id", tokenResult.accountId);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("google-data error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
