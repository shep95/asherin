import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
import {
  FORENSIC_HEADERS, analyzeMessage, geolocateIps, attachGeo, aggregate,
  type MessageForensics,
} from "../_shared/emailForensics.ts";
import {
  VOICE_QUERY, analyzeVoiceEnvelope, applyClockFrame, profilePeers, aggregateVoice,
  type VoiceEnvelope, type PeerProfile,
} from "../_shared/voiceprint.ts";

// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts


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

// ── Bounded-concurrency map. Google rate-limits hard above ~10 parallel
// per-user reads, and an unbounded Promise.all over 100 ids trips 429s that
// surface to the operator as an empty roster. Cap the pool, keep order. ──
async function pooled<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

// ── Extracted service data fetching ──
async function fetchServiceData(service: string, params: any, headers: Record<string, string>): Promise<any> {
  if (service === "gmail_inbox") {
    // The old path requested `maxResults` then silently sliced to 10, so every
    // downstream analyzer was reasoning over a 10-message keyhole. Honor the
    // caller's ask, ceilinged at a value the function's CPU budget survives.
    const maxResults = Math.max(1, Math.min(120, Number(params?.maxResults) || 20));
    const q = params?.q || "is:inbox";
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(q)}`,
      { headers }
    );
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    const messages = (data.messages || []).slice(0, maxResults);
    const details = await pooled(messages, 8, async (msg: any) => {
      try {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata` +
            `&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject` +
            `&metadataHeaders=Date&metadataHeaders=In-Reply-To&metadataHeaders=List-Unsubscribe`,
          { headers }
        );
        if (!r.ok) return null;
        return await r.json();
      } catch {
        // One dropped message must not void the whole sweep.
        return null;
      }
    });
    const hdr = (d: any, name: string) =>
      (d.payload?.headers || []).find((h: any) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
    return {
      totalMessages: data.resultSizeEstimate || 0,
      messages: details.filter(Boolean).map((d: any) => ({
        id: d.id,
        threadId: d.threadId || null,
        from: hdr(d, "From"),
        to: hdr(d, "To"),
        cc: hdr(d, "Cc"),
        subject: hdr(d, "Subject"),
        date: hdr(d, "Date"),
        // internalDate is the server clock in ms — authoritative, unlike the
        // Date header which the sender controls and can be skewed or absent.
        internalDate: d.internalDate ? Number(d.internalDate) : null,
        inReplyTo: hdr(d, "In-Reply-To") || null,
        isBulk: !!hdr(d, "List-Unsubscribe"),
        snippet: d.snippet || "",
        sizeEstimate: d.sizeEstimate ?? null,
        labelIds: d.labelIds || [],
        isUnread: d.labelIds?.includes("UNREAD"),
      })),
    };
  }

  // ── POSTMARK — full header forensics ─────────────────────────────────────
  // Same Gmail read cost as gmail_inbox (one list + one metadata GET per
  // message), but asking for the whole forensic header set instead of six
  // display fields. Parsing is local; only relay-IP geolocation leaves.
  if (service === "gmail_forensics") {
    const maxResults = Math.max(1, Math.min(120, Number(params?.maxResults) || 40));
    const q = params?.q || "in:anywhere -in:chats";
    const geoEnabled = params?.geo !== false;

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(q)}`,
      { headers }
    );
    const list = await listRes.json();
    if (list.error) throw new Error(list.error.message);
    const ids = (list.messages || []).slice(0, maxResults);

    const headerQuery = FORENSIC_HEADERS.map((h) => `&metadataHeaders=${encodeURIComponent(h)}`).join("");
    const raws = await pooled(ids, 8, async (msg: any) => {
      try {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata${headerQuery}`,
          { headers }
        );
        if (!r.ok) return null;
        return await r.json();
      } catch {
        return null;
      }
    });

    const reports = raws.filter(Boolean).map((d: any) => analyzeMessage(d));
    if (geoEnabled) {
      const ips = reports.flatMap((r) => r.hops.map((h) => h.ip).filter(Boolean) as string[]);
      try {
        attachGeo(reports, await geolocateIps(ips));
      } catch (e) {
        // Geolocation is corroboration, not the finding. Never void the sweep.
        console.error("gmail_forensics geo enrichment failed:", e);
      }
    }
    return {
      scannedEstimate: list.resultSizeEstimate || reports.length,
      query: q,
      geoEnabled,
      messages: reports,
      aggregate: aggregate(reports),
    };
  }

  // ── VOICEPRINT — Google Voice envelope forensics ─────────────────────────
  // Same shape of read as POSTMARK, aimed at the Voice mirror instead of the
  // mailbox at large. `format=metadata` with no header allow-list returns the
  // COMPLETE header set and never the body — which is exactly the contract we
  // want: everything the switch stamped, nothing the correspondent wrote.
  if (service === "voice_forensics") {
    const maxResults = Math.max(1, Math.min(200, Number(params?.maxResults) || 120));
    const days = Math.max(1, Math.min(365, Number(params?.days) || 90));
    const extra = typeof params?.q === "string" && params.q.trim() ? ` ${params.q.trim()}` : "";
    const q = `${VOICE_QUERY} newer_than:${days}d -in:spam -in:trash${extra}`;

    const listRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=${encodeURIComponent(q)}`,
      { headers }
    );
    const list = await listRes.json();
    if (list.error) throw new Error(list.error.message);
    const ids = (list.messages || []).slice(0, maxResults);

    const raws = await pooled(ids, 8, async (msg: any) => {
      try {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata`,
          { headers }
        );
        if (!r.ok) return null;
        return await r.json();
      } catch {
        // One malformed envelope must never void the sweep.
        return null;
      }
    });

    const envelopes = raws
      .filter(Boolean)
      .map((d: any) => analyzeVoiceEnvelope(d))
      .filter(Boolean) as ReturnType<typeof analyzeVoiceEnvelope>[];
    const clean = envelopes.filter((e): e is NonNullable<typeof e> => !!e);
    clean.sort((a, b) => (b.internalDate ?? 0) - (a.internalDate ?? 0));
    // Establish the operator's own clock BEFORE profiling — cadence, burst and
    // overnight findings are all statements about their day, not about UTC.
    const frame = applyClockFrame(clean);
    const peers = profilePeers(clean);

    return {
      query: q,
      days,
      scannedEstimate: list.resultSizeEstimate || clean.length,
      // Envelopes that matched the query but were not Voice conversation
      // (account notices, forwarded mail) — reported, never silently dropped.
      rejected: raws.filter(Boolean).length - clean.length,
      messages: clean,
      peers,
      aggregate: aggregateVoice(clean, peers, frame),

    };
  }




  if (service === "gmail_stats") {
    // `messages?q=…&maxResults=1` returns `resultSizeEstimate`, which Gmail
    // computes from a *page* heuristic — for large mailboxes it collapses to
    // the same rounded number for every query, which is why unread/important/
    // starred previously all read identical. The labels endpoint returns exact
    // server-side counters instead, so each figure is independently true.
    const labelIds = ["INBOX", "UNREAD", "IMPORTANT", "STARRED", "SENT", "DRAFT", "SPAM", "TRASH", "CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL"];
    const counters: Record<string, { messages: number; threads: number; unread: number }> = {};
    await Promise.all(
      labelIds.map(async (id) => {
        try {
          const r = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/labels/${id}`, { headers });
          if (!r.ok) return;
          const d = await r.json();
          counters[id] = {
            messages: Number(d.messagesTotal) || 0,
            threads: Number(d.threadsTotal) || 0,
            unread: Number(d.messagesUnread) || 0,
          };
        } catch {
          // A single missing system label must not void the whole read.
        }
      })
    );
    let mailboxTotal = 0;
    try {
      const pr = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers });
      if (pr.ok) mailboxTotal = Number((await pr.json()).messagesTotal) || 0;
    } catch { /* profile is a bonus, not a requirement */ }

    const inbox = counters.INBOX || { messages: 0, threads: 0, unread: 0 };
    return {
      // Backwards-compatible keys.
      unread: counters.UNREAD?.messages ?? inbox.unread,
      important: counters.IMPORTANT?.unread ?? 0,
      starred: counters.STARRED?.messages ?? 0,
      // Richer, exact counters for the synthesis layer.
      inboxTotal: inbox.messages,
      inboxThreads: inbox.threads,
      inboxUnread: inbox.unread,
      importantTotal: counters.IMPORTANT?.messages ?? 0,
      sentTotal: counters.SENT?.messages ?? 0,
      draftTotal: counters.DRAFT?.messages ?? 0,
      spamTotal: counters.SPAM?.messages ?? 0,
      trashTotal: counters.TRASH?.messages ?? 0,
      promotionsTotal: counters.CATEGORY_PROMOTIONS?.messages ?? 0,
      socialTotal: counters.CATEGORY_SOCIAL?.messages ?? 0,
      mailboxTotal,
      // Reciprocity across the whole mailbox, not just the sampled window.
      lifetimeReciprocity:
        inbox.messages + (counters.SENT?.messages ?? 0) > 0
          ? (counters.SENT?.messages ?? 0) / (inbox.messages + (counters.SENT?.messages ?? 0))
          : null,
      source: "gmail.labels",
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
        attendeeEmails: (e.attendees || []).map((a: any) => a.email).filter(Boolean),
      })),
      totalEvents: data.items?.length || 0,
    };
  }

  if (service === "contacts") {
    // "All contacts need to be important" — a single 100-row page is not the
    // address book, it is a sample of it. Walk pageToken until the book is
    // exhausted or the ceiling is hit, and keep EVERY address, not just [0].
    const ceiling = Math.max(1, Math.min(2000, Number(params?.pageSize) || 1000));
    const personFields =
      "names,emailAddresses,phoneNumbers,photos,organizations,biographies,nicknames,urls,relations,addresses,birthdays,metadata,memberships";
    const connections: any[] = [];
    let pageToken: string | undefined;
    let totalPeople = 0;
    for (let page = 0; page < 20 && connections.length < ceiling; page++) {
      const pageSize = Math.min(1000, ceiling - connections.length);
      const url =
        `https://people.googleapis.com/v1/people/me/connections?personFields=${personFields}` +
        `&pageSize=${pageSize}&sortOrder=LAST_MODIFIED_DESCENDING` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      totalPeople = data.totalPeople || totalPeople;
      connections.push(...(data.connections || []));
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return {
      totalContacts: totalPeople || connections.length,
      fetched: connections.length,
      contacts: connections.map((c: any) => {
        const emails = (c.emailAddresses || []).map((e: any) => e.value).filter(Boolean);
        const phones = (c.phoneNumbers || []).map((p: any) => p.value).filter(Boolean);
        return {
          resourceName: c.resourceName || null,
          name: c.names?.[0]?.displayName || "Unknown",
          givenName: c.names?.[0]?.givenName || "",
          familyName: c.names?.[0]?.familyName || "",
          nickname: c.nicknames?.[0]?.value || "",
          email: emails[0] || "",
          emails,
          phone: phones[0] || "",
          phones,
          photo: c.photos?.[0]?.url || "",
          organization: c.organizations?.[0]?.name || "",
          jobTitle: c.organizations?.[0]?.title || "",
          bio: c.biographies?.[0]?.value || "",
          urls: (c.urls || []).map((u: any) => u.value).filter(Boolean),
          relations: (c.relations || []).map((r: any) => ({ person: r.person, type: r.type })),
          city: c.addresses?.[0]?.city || "",
          region: c.addresses?.[0]?.region || "",
          country: c.addresses?.[0]?.country || "",
          birthday: c.birthdays?.[0]?.date
            ? [c.birthdays[0].date.year, c.birthdays[0].date.month, c.birthdays[0].date.day].filter(Boolean).join("-")
            : "",
          updatedAt: c.metadata?.sources?.[0]?.updateTime || null,
          groups: (c.memberships || [])
            .map((m: any) => m.contactGroupMembership?.contactGroupId)
            .filter(Boolean),
        };
      }),
    };
  }


  if (service === "drive_files") {
    // A raw file list is inventory, not intelligence. Pull the fields the
    // synthesis layer needs to score risk (who owns it, who it is shared with,
    // when it was created vs. last touched, and a content hash for duplicate
    // detection) and page until the ceiling so the corpus is representative.
    const ceiling = Math.max(1, Math.min(1000, Number(params?.pageSize) || 100));
    const q = params?.q || "";
    const fields =
      "nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,size,shared,starred,trashed,webViewLink,iconLink,md5Checksum,quotaBytesUsed,parents,owners(displayName,emailAddress),lastModifyingUser(displayName,emailAddress),sharingUser(displayName,emailAddress),permissions(id,type,role,emailAddress,domain),viewedByMeTime)";
    const files: any[] = [];
    let pageToken: string | undefined;
    for (let page = 0; page < 10 && files.length < ceiling; page++) {
      const pageSize = Math.min(200, ceiling - files.length);
      let url =
        `https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}` +
        `&fields=${encodeURIComponent(fields)}&orderBy=modifiedTime desc` +
        `&supportsAllDrives=true&includeItemsFromAllDrives=true`;
      if (q) url += `&q=${encodeURIComponent(q)}`;
      if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      files.push(...(data.files || []));
      pageToken = data.nextPageToken;
      if (!pageToken) break;
    }
    return {
      files: files.map((f: any) => {
        const perms = f.permissions || [];
        return {
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          createdTime: f.createdTime || null,
          modifiedTime: f.modifiedTime || null,
          viewedByMeTime: f.viewedByMeTime || null,
          size: f.size ?? f.quotaBytesUsed ?? null,
          shared: !!f.shared,
          starred: !!f.starred,
          trashed: !!f.trashed,
          webViewLink: f.webViewLink || null,
          md5Checksum: f.md5Checksum || null,
          owner: f.owners?.[0]?.emailAddress || null,
          ownerName: f.owners?.[0]?.displayName || null,
          lastModifiedBy: f.lastModifyingUser?.emailAddress || null,
          sharedBy: f.sharingUser?.emailAddress || null,
          // Exposure surface: `anyone` = public link, `domain` = org-wide.
          isPublic: perms.some((p: any) => p.type === "anyone"),
          isDomainWide: perms.some((p: any) => p.type === "domain"),
          sharedWith: perms
            .filter((p: any) => p.type === "user" && p.emailAddress)
            .map((p: any) => ({ email: p.emailAddress, role: p.role })),
          externalEditors: perms.filter((p: any) => p.role === "writer" || p.role === "owner").length,
        };
      }),
      fetched: files.length,
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
    // Sort on the server clock, not the sender-controlled Date header, and do
    // not truncate: the caller already declared its appetite via maxResults.
    const at = (m: any) => m.internalDate ?? Date.parse(m.date || "") ?? 0;
    allMessages.sort((a: any, b: any) => (at(b) || 0) - (at(a) || 0));
    return { totalMessages: results.reduce((s, r) => s + (r.totalMessages || 0), 0), messages: allMessages };
  }

  if (service === "gmail_forensics") {
    // Re-aggregate over the union rather than summing per-account rollups:
    // domain reputation and country spread are only meaningful across the
    // operator's whole correspondence, not per mailbox.
    const allReports: MessageForensics[] = results.flatMap((r) =>
      (r.messages || []).map((m: MessageForensics) => ({ ...m, _account: r._account_email } as MessageForensics))
    );
    allReports.sort((a, b) => (b.internalDate ?? 0) - (a.internalDate ?? 0));
    return {
      scannedEstimate: results.reduce((s, r) => s + (r.scannedEstimate || 0), 0),
      query: results[0]?.query ?? null,
      geoEnabled: results.some((r) => r.geoEnabled),
      messages: allReports,
      aggregate: aggregate(allReports),
    };
  }

  if (service === "voice_forensics") {
    // One human texting two of the operator's Voice lines is ONE correspondent.
    // Re-profiling over the union (rather than concatenating per-mailbox peer
    // lists) is what makes the cadence, burst and reciprocity figures true.
    const allEnvelopes: VoiceEnvelope[] = results.flatMap((r) =>
      (r.messages || []).map((m: VoiceEnvelope) => ({ ...m, _account: r._account_email } as VoiceEnvelope))
    );
    allEnvelopes.sort((a, b) => (b.internalDate ?? 0) - (a.internalDate ?? 0));
    // Re-resolve the frame over the union: two mailboxes can carry two Voice
    // lines, and the dominant one across both is the operator's real clock.
    const frame = applyClockFrame(allEnvelopes);
    const peers: PeerProfile[] = profilePeers(allEnvelopes);
    return {
      query: results[0]?.query ?? null,
      days: results[0]?.days ?? null,
      scannedEstimate: results.reduce((s, r) => s + (r.scannedEstimate || 0), 0),
      rejected: results.reduce((s, r) => s + (r.rejected || 0), 0),
      messages: allEnvelopes,
      peers,
      aggregate: aggregateVoice(allEnvelopes, peers, frame),

    };
  }





  if (service === "gmail_stats") {
    // Every exact counter must survive the fold. Summing only the three legacy
    // keys was what forced the synthesis layer back onto estimates when more
    // than one account was linked.
    const sum = (k: string) => results.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const inboxTotal = sum("inboxTotal");
    const sentTotal = sum("sentTotal");
    return {
      unread: sum("unread"),
      important: sum("important"),
      starred: sum("starred"),
      inboxTotal,
      inboxThreads: sum("inboxThreads"),
      inboxUnread: sum("inboxUnread"),
      importantTotal: sum("importantTotal"),
      sentTotal,
      draftTotal: sum("draftTotal"),
      spamTotal: sum("spamTotal"),
      trashTotal: sum("trashTotal"),
      promotionsTotal: sum("promotionsTotal"),
      socialTotal: sum("socialTotal"),
      mailboxTotal: sum("mailboxTotal"),
      lifetimeReciprocity: inboxTotal + sentTotal > 0 ? sentTotal / (inboxTotal + sentTotal) : null,
      source: "gmail.labels",
      _per_account: results.map(r => ({
        email: r._account_email,
        unread: r.unread || 0,
        important: r.important || 0,
        starred: r.starred || 0,
        inboxTotal: r.inboxTotal || 0,
        sentTotal: r.sentTotal || 0,
      })),
    };
  }


  if (service === "calendar_events") {
    const allEvents = results.flatMap(r => (r.events || []).map((e: any) => ({ ...e, _account: r._account_email })));
    allEvents.sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return { events: allEvents, totalEvents: allEvents.length };
  }

  if (service === "contacts") {
    // The same human sitting in two address books is one human. Fold on the
    // strongest available identifier and union their channels — never on name
    // alone, which merges distinct people who happen to share one.
    const byKey = new Map<string, any>();
    let order = 0;
    for (const r of results) {
      for (const c of r.contacts || []) {
        const keys = [
          ...(c.emails || []).map((e: string) => `e:${e.toLowerCase().trim()}`),
          ...(c.phones || []).map((p: string) => `p:${String(p).replace(/[^\d]/g, "").slice(-10)}`),
        ].filter((k) => k.length > 3);
        const key = keys[0] ?? `r:${c.resourceName || `${c.name}#${order}`}`;
        const prior = byKey.get(key);
        if (!prior) {
          byKey.set(key, { ...c, _account: r._account_email, _accounts: [r._account_email], _order: order++ });
        } else {
          prior.emails = Array.from(new Set([...(prior.emails || []), ...(c.emails || [])]));
          prior.phones = Array.from(new Set([...(prior.phones || []), ...(c.phones || [])]));
          prior.photo = prior.photo || c.photo;
          prior.organization = prior.organization || c.organization;
          prior.jobTitle = prior.jobTitle || c.jobTitle;
          prior.bio = prior.bio || c.bio;
          prior.birthday = prior.birthday || c.birthday;
          if (!prior._accounts.includes(r._account_email)) prior._accounts.push(r._account_email);
        }
      }
    }
    const allContacts = [...byKey.values()].sort((a, b) => a._order - b._order);
    return {
      totalContacts: allContacts.length,
      rawTotal: results.reduce((s, r) => s + (r.totalContacts || 0), 0),
      contacts: allContacts,
    };
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
  const corsHeaders = getCorsHeaders(req);
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
