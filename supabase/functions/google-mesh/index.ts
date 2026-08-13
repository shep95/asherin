// ═══════════════════════════════════════════════════════════════════════════
// google-mesh — the Google Mesh control surface
// Actions: status | build_voiceprint | pattern_map | attention_ledger |
//          ghostwrite | search_mail | relationship_graph | commitments | harvest |
//          location_signals |
//          daily_digest | dossier | meet_vault | sentinel | fit_location |
//          send_draft | audit_log
// Every action is user-scoped by a verified JWT. No action sends mail without
// a two-phase human confirmation.
//
// Cost discipline: header harvests go through the Gmail batch endpoint, delta
// markers replace repeat full sweeps, and every derived read that costs more
// than one call is cached with an explicit expiry the operator can override
// with refresh:true. A cached answer always reports its own age — a stale read
// presented as live is the one failure this surface will not commit.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  adminClient, liveAccounts, harvestSentBodies, computeStylometry,
  harvestPlaces, foldPlaces, buildAttention, createDraft, audit,
  voiceInstruction, fenceUntrusted, gfetch, hasScope,
  buildRelationships, harvestBodies, extractCommitments,
  getDraft, sendExistingDraft,
  harvestHeadersFast, deltaHeaders, gmailDeltaIds, gmailProfile,
  readSyncState, saveSyncState, readMeshCache, writeMeshCache,
  listMeetFiles, fitLocationHistory, harvestContacts,
  type MailHeader, type MeshAccount,
} from "../_shared/googleMesh.ts";


const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/** Freshness windows. Six hours for structural reads, tighter for the digest. */
const TTL_LEDGER_MIN = 360;
const TTL_PLACES_MIN = 360;
const TTL_DIGEST_MIN = 360;

interface LedgerResult {
  headers: MailHeader[];
  mode: "cache" | "delta" | "full";
  ageMinutes: number | null;
  builtAt: string | null;
  accountsRead: string[];
  note: string;
}

/**
 * The mail ledger with a memory.
 *
 * Three paths, cheapest first:
 *   cache — inside the window, zero Gmail calls.
 *   delta — window expired but a valid historyId exists: fetch only the
 *           messages Gmail says changed, fold them into the stored ledger.
 *   full  — no marker, or Gmail rejected it (markers age out after about a
 *           week): one batched sweep, then store the fresh marker.
 *
 * A per-account failure degrades that account only. The merge survives.
 */
async function mailLedger(
  sb: ReturnType<typeof adminClient>,
  userId: string,
  readable: Array<MeshAccount & { token: string }>,
  opts: { days: number; limit: number; refresh: boolean },
): Promise<LedgerResult> {
  const key = `ledger:${opts.days}:${opts.limit}`;
  const cached = await readMeshCache<{ headers: MailHeader[] }>(sb, userId, key, opts.refresh);

  if (cached.fresh && cached.payload?.headers?.length) {
    return {
      headers: cached.payload.headers,
      mode: "cache",
      ageMinutes: cached.ageMinutes,
      builtAt: cached.builtAt,
      accountsRead: readable.map((a) => a.google_email),
      note: `served from the stored ledger, built ${cached.ageMinutes ?? 0} min ago — no mailbox re-read`,
    };
  }

  const after = new Date(Date.now() - opts.days * 86400000).toISOString().slice(0, 10).replace(/-/g, "/");
  const state = await readSyncState(sb, userId);
  const priorHeaders: MailHeader[] = cached.payload?.headers ?? [];
  const cutoff = Date.now() - opts.days * 86400000;

  let anyFull = false;
  const collected: MailHeader[][] = await Promise.all(readable.map(async (a) => {
    const marker = state[a.id]?.history_id ?? null;
    // Delta is only meaningful when there is a prior ledger to fold into.
    if (marker && priorHeaders.length) {
      const delta = await gmailDeltaIds(a.token, marker);
      if (delta) {
        const fresh = delta.ids.length ? await deltaHeaders(a.token, delta.ids) : [];
        await saveSyncState(sb, userId, a.id, a.google_email, delta.newHistoryId, false);
        return fresh;
      }
    }
    anyFull = true;
    const [inbound, outbound] = await Promise.all([
      harvestHeadersFast(a.token, `in:inbox -in:chats after:${after}`, opts.limit, false).catch(() => []),
      harvestHeadersFast(a.token, `in:sent -in:chats after:${after}`, opts.limit, true).catch(() => []),
    ]);
    const profile = await gmailProfile(a.token);
    await saveSyncState(sb, userId, a.id, a.google_email, profile.historyId, true);
    return [...inbound, ...outbound];
  }));

  const merged = new Map<string, MailHeader>();
  for (const h of [...priorHeaders, ...collected.flat()]) {
    if (h.at < cutoff) continue;
    merged.set(h.id, h);
  }
  const headers = [...merged.values()].sort((a, b) => a.at - b.at);

  await writeMeshCache(sb, userId, key, { headers }, readable.map((a) => a.google_email), TTL_LEDGER_MIN);

  return {
    headers,
    mode: anyFull ? "full" : "delta",
    ageMinutes: 0,
    builtAt: new Date().toISOString(),
    accountsRead: readable.map((a) => a.google_email),
    note: anyFull
      ? `full batched sweep of ${headers.length} headers`
      : `delta sync — only messages changed since the stored marker were read`,
  };
}


/**
 * Turn a freshly built digest into durable alerts.
 *
 * Two triggers only: a promise that has gone past its own due date, and an
 * inner-tier correspondent whose last message was inbound and has sat for two
 * days. The dedupe key is derived from the fact itself, so re-running the
 * digest never re-alarms on something the operator already saw.
 */
async function recordSentinelEvents(
  sb: ReturnType<typeof adminClient>,
  userId: string,
  digest: {
    obligations: { overdue: Array<{ text: string; toEmail: string; dueAt: string | null; subject: string }> };
    relationships: { awaitingYourReply: Array<{ email: string; name: string; dormantDays: number }> };
  },
): Promise<void> {
  const rows: Record<string, unknown>[] = [];

  for (const c of digest.obligations.overdue.slice(0, 10)) {
    rows.push({
      user_id: userId,
      kind: "commitment_overdue",
      severity: "warn",
      title: `Overdue promise to ${c.toEmail || "a contact"}`,
      detail: c.text.slice(0, 300),
      subject_email: c.toEmail || null,
      payload: { subject: c.subject, dueAt: c.dueAt },
      dedupe_key: `overdue:${c.toEmail}:${(c.dueAt ?? "").slice(0, 10)}:${c.text.slice(0, 40)}`,
    });
  }

  for (const p of digest.relationships.awaitingYourReply.slice(0, 10)) {
    rows.push({
      user_id: userId,
      kind: "awaiting_reply",
      severity: "info",
      title: `${p.name || p.email} is waiting on you`,
      detail: `Last message was inbound ${p.dormantDays} days ago.`,
      subject_email: p.email,
      payload: { dormantDays: p.dormantDays },
      dedupe_key: `awaiting:${p.email}:${new Date().toISOString().slice(0, 10)}`,
    });
  }

  if (!rows.length) return;
  try {
    await sb.from("google_sentinel_events").upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
  } catch (e) {
    console.error("[google-mesh] sentinel write failed:", (e as Error).message);
  }
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401, cors);

    const anon = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: uErr } = await anon.auth.getUser(authHeader.slice(7));
    if (uErr || !user) return json({ error: "Unauthorized" }, 401, cors);
    const userId = user.id;

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "");
    const sb = adminClient();

    const accounts = await liveAccounts(sb, userId, body.account_id ?? null);

    // ── STATUS ───────────────────────────────────────────────────────────
    if (action === "status") {
      const [{ data: vp }, { data: places }, { data: attn }] = await Promise.all([
        sb.from("google_voiceprints").select("google_email, sample_count, built_at, stylometry").eq("user_id", userId),
        sb.from("google_place_nodes").select("id", { count: "exact", head: false }).eq("user_id", userId).limit(1),
        sb.from("google_attention_windows").select("day").eq("user_id", userId).order("day", { ascending: false }).limit(1),
      ]);
      return json({
        accounts: accounts.map((a) => ({
          id: a.id, email: a.google_email, tier: a.consent_tier,
          canRead: hasScope(a, "gmail.readonly"),
          canCompose: hasScope(a, "gmail.compose"),
          canSend: hasScope(a, "gmail.send"),
          isPrimary: (a as any).is_primary ?? false,
        })),
        voiceprints: vp ?? [],
        placesIndexed: places?.length ?? 0,
        attentionThrough: attn?.[0]?.day ?? null,
      }, 200, cors);
    }

    if (!accounts.length) {
      return json({ error: "no_account", message: "Connect a Google account first." }, 400, cors);
    }

    // ── BUILD VOICEPRINT ─────────────────────────────────────────────────
    if (action === "build_voiceprint") {
      const results: unknown[] = [];
      for (const acct of accounts) {
        if (!hasScope(acct, "gmail.readonly")) {
          results.push({ email: acct.google_email, skipped: "missing gmail.readonly (grant Tier 2)" });
          continue;
        }
        try {
          const bodies = await harvestSentBodies(acct.token, Number(body.limit) || 60);
          if (bodies.length < 5) {
            results.push({ email: acct.google_email, skipped: `only ${bodies.length} usable sent messages` });
            continue;
          }
          const stylometry = computeStylometry(bodies);
          await sb.from("google_voiceprints").upsert({
            user_id: userId,
            account_id: acct.id,
            google_email: acct.google_email,
            stylometry,
            sample_count: bodies.length,
            built_at: new Date().toISOString(),
          }, { onConflict: "user_id,google_email" });
          results.push({ email: acct.google_email, sample_count: bodies.length, stylometry });
        } catch (e) {
          results.push({ email: acct.google_email, error: (e as Error).message });
        }
      }
      return json({ voiceprints: results }, 200, cors);
    }

    // Operator override: "refresh" must always be able to force a live sweep,
    // otherwise the cache becomes a claim the operator cannot correct.
    const refresh = body.refresh === true || String(body.refresh ?? "") === "true";

    // ── PATTERN MAP ──────────────────────────────────────────────────────
    if (action === "pattern_map") {
      const cached = await readMeshCache<{ nodes: unknown[]; observations: number; anomalies: string[] }>(
        sb, userId, "places", refresh,
      );
      if (cached.fresh && cached.payload) {
        return json({
          ...cached.payload,
          cached: true,
          builtAt: cached.builtAt,
          ageMinutes: cached.ageMinutes,
          note: `stored place cartography, built ${cached.ageMinutes} min ago — pass refresh:true to re-harvest`,
        }, 200, cors);
      }

      const all = (await Promise.all(
        accounts.map((a) => harvestPlaces(a.token, Number(body.days) || 180).catch(() => [])),
      )).flat();
      const nodes = foldPlaces(all);

      if (nodes.length) {
        await sb.from("google_place_nodes").upsert(
          nodes.map((n) => ({
            user_id: userId,
            label: n.label,
            normalized_key: n.key,
            visit_count: n.visits,
            first_seen: n.firstSeen,
            last_seen: n.lastSeen,
            sources: n.sources,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "user_id,normalized_key" },
        );
      }
      const payload = {
        nodes: nodes.slice(0, 100),
        observations: all.length,
        anomalies: nodes.filter((n) => n.anomaly).map((n) => n.label),
      };
      await writeMeshCache(sb, userId, "places", payload, accounts.map((a) => a.google_email), TTL_PLACES_MIN);
      return json({ ...payload, cached: false, builtAt: new Date().toISOString() }, 200, cors);
    }


    // ── ATTENTION LEDGER ─────────────────────────────────────────────────
    if (action === "attention_ledger") {
      const days = await buildAttention(accounts[0].token, Number(body.days) || 28);
      if (days.length) {
        await sb.from("google_attention_windows").upsert(
          days.map((d) => ({
            user_id: userId,
            day: d.day,
            meeting_minutes: d.meetingMinutes,
            focus_minutes: d.focusMinutes,
            fragmentation: d.fragmentation,
            first_activity_hour: d.firstActivityHour,
            last_activity_hour: d.lastActivityHour,
            detail: { meetings: d.meetings },
          })),
          { onConflict: "user_id,day" },
        );
      }
      const totalMeet = days.reduce((s, d) => s + d.meetingMinutes, 0);
      const totalFocus = days.reduce((s, d) => s + d.focusMinutes, 0);
      return json({
        days,
        summary: {
          meetingHours: Math.round(totalMeet / 6) / 10,
          focusHours: Math.round(totalFocus / 6) / 10,
          ratio: totalFocus + totalMeet ? Math.round((totalFocus / (totalFocus + totalMeet)) * 100) : 0,
          busiestDay: days.slice().sort((a, b) => b.meetingMinutes - a.meetingMinutes)[0]?.day ?? null,
        },
      }, 200, cors);
    }

    // ── SEARCH MAIL (read-only retrieval for the chat bridge) ────────────
    if (action === "search_mail") {
      const q = String(body.query ?? "").slice(0, 200);
      if (!q) return json({ error: "query required" }, 400, cors);
      const out: unknown[] = [];
      for (const acct of accounts) {
        if (!hasScope(acct, "gmail.readonly")) continue;
        try {
          const list = await gfetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8&q=${encodeURIComponent(q)}`,
            acct.token,
          );
          for (const m of (list.messages ?? []).slice(0, 8)) {
            const d = await gfetch(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
              acct.token,
            ).catch(() => null);
            if (!d) continue;
            const h = (n: string) => d.payload?.headers?.find((x: any) => x.name === n)?.value ?? "";
            out.push({
              account: acct.google_email, id: d.id, threadId: d.threadId,
              from: h("From"), to: h("To"), subject: h("Subject"), date: h("Date"),
              snippet: d.snippet ?? "",
            });
          }
        } catch { /* per-account degradation */ }
      }
      return json({ query: q, hits: out }, 200, cors);
    }

    // ── GHOSTWRITE (Tier 4 — DRAFT ONLY) ─────────────────────────────────
    if (action === "ghostwrite") {
      const to = String(body.to ?? "").trim();
      const intent = String(body.intent ?? "").trim();
      const subject = String(body.subject ?? "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return json({ error: "Valid recipient required" }, 400, cors);
      if (!intent) return json({ error: "Describe what the email should say" }, 400, cors);

      const acct = accounts.find((a) => hasScope(a, "gmail.compose"));
      if (!acct) {
        return json({
          error: "tier_required",
          message: "Ghostwriting needs Tier 4 (Agency). Reconnect the account and grant compose access.",
        }, 403, cors);
      }

      const { data: vp } = await sb.from("google_voiceprints")
        .select("stylometry, sample_count").eq("user_id", userId)
        .eq("google_email", acct.google_email).maybeSingle();
      if (!vp?.stylometry) {
        return json({ error: "no_voiceprint", message: "Build your voiceprint first." }, 400, cors);
      }

      // Audit BEFORE the side effect, so an aborted run still leaves a trace.
      await audit(sb, userId, {
        google_email: acct.google_email,
        action: "ghostwrite_draft_requested",
        target: to,
        payload: { intent: intent.slice(0, 500), subject },
      });

      const key = Deno.env.get("GEMINI_API_KEY");
      if (!key) return json({ error: "AI unavailable" }, 503, cors);

      const prompt = [
        voiceInstruction(vp.stylometry as any),
        "",
        `Recipient: ${to}`,
        subject ? `Subject line already chosen: ${subject}` : "Also propose a subject line on the first line prefixed with 'SUBJECT: '.",
        "",
        fenceUntrusted("INTENT", intent),
      ].join("\n");

      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 45_000);
      let text = "";
      try {
        const res = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent",
          {
            method: "POST",
            signal: ac.signal,
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.55, maxOutputTokens: 1200 },
            }),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          return json({ error: "draft_generation_failed", status: res.status, details: data }, res.status, cors);
        }
        text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
      } finally {
        clearTimeout(timer);
      }
      if (!text.trim()) return json({ error: "Empty draft returned" }, 502, cors);

      let finalSubject = subject;
      let finalBody = text.trim();
      const m = finalBody.match(/^SUBJECT:\s*(.+)\n+/i);
      if (m) { finalSubject = finalSubject || m[1].trim(); finalBody = finalBody.slice(m[0].length).trim(); }
      if (!finalSubject) finalSubject = intent.split(/[.\n]/)[0].slice(0, 78);

      // preview=true returns the text without touching Gmail at all.
      if (body.preview) {
        return json({ preview: true, to, subject: finalSubject, draft: finalBody, account: acct.google_email }, 200, cors);
      }

      const created = await createDraft(acct.token, {
        to, subject: finalSubject, body: finalBody, threadId: body.thread_id,
      });
      await audit(sb, userId, {
        google_email: acct.google_email,
        action: "ghostwrite_draft_created",
        target: to,
        payload: { draftId: created.draftId, subject: finalSubject, chars: finalBody.length },
        confirmed: true,
      });

      return json({
        created: true, draftId: created.draftId, to, subject: finalSubject,
        draft: finalBody, account: acct.google_email,
        note: "Saved to Gmail Drafts. Asherin never sends — you press send.",
      }, 200, cors);
    }

    // ── RELATIONSHIP LEDGER ──────────────────────────────────────────────
    // Metadata-only. Runs across every connected account and merges the
    // ledgers, so one human who mails two of your addresses is one node.
    // Header cost is paid by mailLedger: cache, then delta, then full sweep.
    if (action === "relationship_graph") {
      const limit = Math.min(Number(body.limit) || 120, 200);
      const window = Math.min(Math.max(Number(body.days) || 180, 7), 730);
      const selfEmails = accounts.map((a) => a.google_email);
      const readable = accounts.filter((a) => hasScope(a, "gmail.readonly"));
      if (!readable.length) {
        return json({ error: "tier_required", message: "Grant Tier 2 (Read) to map your correspondence." }, 403, cors);
      }

      const ledger = await mailLedger(sb, userId, readable, { days: window, limit, refresh });
      const people = buildRelationships(ledger.headers, selfEmails);
      return json({
        windowDays: window,
        messagesAnalyzed: ledger.headers.length,
        accounts: selfEmails,
        sync: { mode: ledger.mode, ageMinutes: ledger.ageMinutes, builtAt: ledger.builtAt, note: ledger.note },
        people: people.slice(0, 80),
        inner: people.filter((p) => p.tier === "inner").length,
        dormant: people.filter((p) => p.dormant).map((p) => ({
          email: p.email, name: p.name, dormantDays: p.dormantDays,
        })),
      }, 200, cors);
    }


    // ── COMMITMENTS ──────────────────────────────────────────────────────
    // Promises you made in your own sent mail, with the clock resolved
    // against when the sentence was written — never against "now".
    if (action === "commitments") {
      const limit = Math.min(Number(body.limit) || 45, 80);
      const window = Math.min(Math.max(Number(body.days) || 45, 3), 365);
      const after = new Date(Date.now() - window * 86400000).toISOString().slice(0, 10).replace(/-/g, "/");
      const readable = accounts.filter((a) => hasScope(a, "gmail.readonly"));
      if (!readable.length) {
        return json({ error: "tier_required", message: "Grant Tier 2 (Read) to track commitments." }, 403, cors);
      }
      const msgs = (await Promise.all(
        readable.map((a) => harvestBodies(a.token, `in:sent -in:chats after:${after}`, limit).catch(() => [])),
      )).flat();
      const commitments = extractCommitments(msgs);
      return json({
        windowDays: window,
        messagesScanned: msgs.length,
        commitments: commitments.slice(0, 60),
        overdue: commitments.filter((c) => c.overdue).length,
        dueSoon: commitments.filter(
          (c) => !c.overdue && c.dueAt && Date.parse(c.dueAt) - Date.now() < 3 * 86400000,
        ).length,
      }, 200, cors);
    }

    // ── DAILY DIGEST ─────────────────────────────────────────────────────
    // The fusion surface: attention + place rhythm + obligations + decaying
    // relationships, computed together so the briefing is one coherent read.
    // Cached whole: asking twice in ten minutes must not re-read the mailbox.
    if (action === "daily_digest") {
      const cachedDigest = await readMeshCache<Record<string, unknown>>(sb, userId, "digest", refresh);
      if (cachedDigest.fresh && cachedDigest.payload) {
        return json({
          ...cachedDigest.payload,
          cached: true,
          builtAt: cachedDigest.builtAt,
          ageMinutes: cachedDigest.ageMinutes,
          note: `stored briefing, built ${cachedDigest.ageMinutes} min ago — no mailbox re-read. pass refresh:true to rebuild`,
        }, 200, cors);
      }

      const readable = accounts.filter((a) => hasScope(a, "gmail.readonly"));
      const after30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10).replace(/-/g, "/");

      const [attn, placeRows, ledger, bodySets] = await Promise.all([
        buildAttention(accounts[0].token, 14).catch(() => []),
        sb.from("google_place_nodes").select("label, visit_count, last_seen, sources")
          .eq("user_id", userId).order("visit_count", { ascending: false }).limit(12),
        mailLedger(sb, userId, readable, { days: 30, limit: 80, refresh }),
        Promise.all(readable.map((a) => harvestBodies(a.token, `in:sent -in:chats after:${after30}`, 30).catch(() => []))),
      ]);

      const people = buildRelationships(ledger.headers, accounts.map((a) => a.google_email));
      const commitments = extractCommitments(bodySets.flat());
      const recent = attn.slice(-7);
      const meetMin = recent.reduce((s, d) => s + d.meetingMinutes, 0);
      const focusMin = recent.reduce((s, d) => s + d.focusMinutes, 0);

      const digest = {
        generatedAt: new Date().toISOString(),
        accounts: accounts.map((a) => a.google_email),
        sync: { mode: ledger.mode, note: ledger.note, headersUsed: ledger.headers.length },
        attention: {
          days: recent.length,
          meetingHours: Math.round(meetMin / 6) / 10,
          focusHours: Math.round(focusMin / 6) / 10,
          focusShare: meetMin + focusMin ? Math.round((focusMin / (focusMin + meetMin)) * 100) : null,
          heaviestDay: recent.slice().sort((a, b) => b.meetingMinutes - a.meetingMinutes)[0]?.day ?? null,
        },
        obligations: {
          overdue: commitments.filter((c) => c.overdue).slice(0, 8),
          upcoming: commitments.filter((c) => !c.overdue && c.dueAt).slice(0, 8),
        },
        relationships: {
          inner: people.filter((p) => p.tier === "inner").slice(0, 8),
          decaying: people.filter((p) => p.dormant).slice(0, 8),
          awaitingYourReply: people
            .filter((p) => p.lastDirection === "in" && p.tier !== "periphery" && p.dormantDays >= 2)
            .slice(0, 8),
        },
        places: (placeRows.data ?? []).map((p) => ({
          label: p.label, visits: p.visit_count, lastSeen: p.last_seen, sources: p.sources,
        })),
      };

      await writeMeshCache(sb, userId, "digest", digest, accounts.map((a) => a.google_email), TTL_DIGEST_MIN);
      // Overdue promises and inbound mail from inner-tier people that has sat
      // unanswered are the two things worth waking someone for. Recorded as
      // in-app events with a stable dedupe key so the same fact never alarms
      // twice.
      await recordSentinelEvents(sb, userId, digest);
      return json({ ...digest, cached: false }, 200, cors);
    }

    // ── DOSSIER ──────────────────────────────────────────────────────────
    // Fusion on one human, from mailboxes you own. Not OSINT on a stranger:
    // if the person never touched a connected account, the answer says so
    // rather than inventing a profile.
    if (action === "dossier") {
      const needle = String(body.email ?? body.name ?? body.query ?? "").trim().toLowerCase();
      if (!needle) return json({ error: "email or name required" }, 400, cors);
      const readable = accounts.filter((a) => hasScope(a, "gmail.readonly"));
      if (!readable.length) {
        return json({ error: "tier_required", message: "Grant Tier 2 (Read) to build a dossier." }, 403, cors);
      }

      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(needle);
      const selfEmails = accounts.map((a) => a.google_email);

      // 1. People card — names, phones, org. Thin cards are marked, not padded.
      const contacts = (await Promise.all(
        accounts.filter((a) => hasScope(a, "contacts.readonly"))
          .map((a) => harvestContacts(a.token, 400).catch(() => [])),
      )).flat();
      const contact = contacts.find((c) =>
        (c.emails ?? []).some((e: string) => e.toLowerCase() === needle) ||
        String(c.name ?? "").toLowerCase().includes(needle)
      ) ?? null;

      const targetEmails = new Set<string>();
      if (isEmail) targetEmails.add(needle);
      for (const e of contact?.emails ?? []) targetEmails.add(String(e).toLowerCase());

      // 2. Correspondence node — reuses the cached ledger, no new sweep.
      const ledger = await mailLedger(sb, userId, readable, { days: 365, limit: 150, refresh });
      const people = buildRelationships(ledger.headers, selfEmails);
      const node = people.find((p) =>
        targetEmails.has(String(p.email).toLowerCase()) ||
        String(p.name ?? "").toLowerCase().includes(needle)
      ) ?? null;
      if (node?.email) targetEmails.add(String(node.email).toLowerCase());

      // 3. Last five subjects, drawn from the same ledger.
      const recentMail = ledger.headers
        .filter((h) => {
          const line = `${h.from} ${h.to}`.toLowerCase();
          return [...targetEmails].some((e) => line.includes(e)) ||
            (!targetEmails.size && line.includes(needle));
        })
        .sort((a, b) => b.at - a.at)
        .slice(0, 5)
        .map((h) => ({
          subject: h.subject || "(no subject)",
          at: new Date(h.at).toISOString(),
          direction: h.outbound ? "out" : "in",
        }));

      // 4. Calendar co-attendance, when the calendar scope exists.
      let coAttendance: Array<{ summary: string; start: string }> = [];
      if (targetEmails.size) {
        for (const a of accounts.filter((x) => hasScope(x, "calendar.readonly"))) {
          try {
            const timeMin = new Date(Date.now() - 180 * 86400000).toISOString();
            const ev = await gfetch(
              "https://www.googleapis.com/calendar/v3/calendars/primary/events" +
                `?timeMin=${encodeURIComponent(timeMin)}&maxResults=250&singleEvents=true&orderBy=startTime`,
              a.token,
              undefined,
              15_000,
            );
            for (const e of ev.items ?? []) {
              const attendees: string[] = (e.attendees ?? []).map((x: any) => String(x.email ?? "").toLowerCase());
              if (attendees.some((x) => targetEmails.has(x))) {
                coAttendance.push({ summary: e.summary ?? "(untitled)", start: e.start?.dateTime ?? e.start?.date ?? "" });
              }
            }
          } catch { /* per-account degradation */ }
        }
        coAttendance = coAttendance.slice(-8).reverse();
      }

      const thin = !contact && !node;
      return json({
        query: needle,
        found: !thin,
        uncertain: thin || (!contact && !!node) ? "this is unsure — the People card is thin; fields below come from mail metadata only" : null,
        identity: {
          name: contact?.name ?? node?.name ?? null,
          emails: [...targetEmails],
          phones: contact?.phones ?? [],
          org: contact?.org ?? null,
        },
        correspondence: node
          ? {
            tier: node.tier,
            reciprocity: node.reciprocity ?? null,
            lastDirection: node.lastDirection,
            dormantDays: node.dormantDays,
            received: node.received,
            sent: node.sent,
            medianReplyMinutes: node.medianReplyMinutes,
          }
          : null,
        recentSubjects: recentMail,
        coAttendance,
        sync: { mode: ledger.mode, ageMinutes: ledger.ageMinutes, note: ledger.note },
        scope: "owned mailboxes only — this is not an external record search",
      }, 200, cors);
    }

    // ── MEET RECORDS ─────────────────────────────────────────────────────
    // Drive-scoped listing of recordings and transcripts that already exist.
    // Zero files is a real answer and is quoted as such.
    if (action === "meet_vault") {
      const withDrive = accounts.filter((a) => hasScope(a, "drive.readonly"));
      if (!withDrive.length) {
        return json({
          error: "tier_required",
          message: "Listing Meet recordings needs Tier 2 Drive read access. Reconnect and grant it.",
        }, 403, cors);
      }
      const sets = await Promise.all(withDrive.map(async (a) => ({
        account: a.google_email,
        files: await listMeetFiles(a.token, Number(body.limit) || 40),
      })));
      const total = sets.reduce((s, x) => s + x.files.length, 0);
      return json({
        accounts: sets,
        total,
        note: total ? "recordings and transcripts already stored in Drive" : "none in Drive",
      }, 200, cors);
    }

    // ── SENTINEL ─────────────────────────────────────────────────────────
    // Real alerts, not a pulse icon. Gmail users.watch is attempted only when
    // a Pub/Sub topic is configured; without one the honest posture is a
    // five-minute server-side check, and the UI must say exactly that.
    if (action === "sentinel") {
      const sub = String(body.mode ?? "list");

      if (sub === "register") {
        const topic = Deno.env.get("GMAIL_PUBSUB_TOPIC");
        const primary = accounts.find((a) => (a as any).is_primary) ?? accounts[0];
        if (!topic) {
          await saveSyncState(sb, userId, primary.id, primary.google_email, null, false);
          return json({
            watch: false,
            cadence: "checked every 5 min",
            reason: "gmail users.watch needs a Google Cloud Pub/Sub topic bound to this deployment; none is configured, so the mesh polls instead",
          }, 200, cors);
        }
        try {
          const res = await gfetch(
            "https://gmail.googleapis.com/gmail/v1/users/me/watch",
            primary.token,
            { method: "POST", body: JSON.stringify({ topicName: topic, labelIds: ["INBOX"] }) },
            15_000,
          );
          await sb.from("google_gmail_sync").upsert({
            user_id: userId,
            account_id: primary.id,
            google_email: primary.google_email,
            history_id: res.historyId ? String(res.historyId) : null,
            watch_topic: topic,
            watch_expiration: res.expiration ? new Date(Number(res.expiration)).toISOString() : null,
            watch_error: null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,account_id" });
          return json({ watch: true, cadence: "push", expiration: res.expiration ?? null, account: primary.google_email }, 200, cors);
        } catch (e) {
          const detail = (e as Error).message;
          await sb.from("google_gmail_sync").upsert({
            user_id: userId, account_id: primary.id, google_email: primary.google_email,
            watch_error: detail.slice(0, 300), updated_at: new Date().toISOString(),
          }, { onConflict: "user_id,account_id" });
          return json({ watch: false, cadence: "checked every 5 min", reason: detail }, 200, cors);
        }
      }

      if (sub === "ack") {
        const id = String(body.event_id ?? "");
        if (!id) return json({ error: "event_id required" }, 400, cors);
        await sb.from("google_sentinel_events").update({ acknowledged: true })
          .eq("user_id", userId).eq("id", id);
        return json({ acknowledged: true, id }, 200, cors);
      }

      const { data: watchRow } = await sb.from("google_gmail_sync")
        .select("watch_expiration, watch_error").eq("user_id", userId).limit(1).maybeSingle();
      // Cadence is read from the background sweep's own row, never asserted.
      const { data: sweep } = await sb.from("google_sync_state")
        .select("enabled, interval_minutes, last_synced_at").eq("user_id", userId).maybeSingle();
      const { data: events } = await sb.from("google_sentinel_events")
        .select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(25);

      const live = watchRow?.watch_expiration && Date.parse(watchRow.watch_expiration) > Date.now();
      const pollMinutes = sweep?.enabled ? Math.max(5, Number(sweep.interval_minutes) || 5) : null;
      return json({
        cadence: live
          ? "push (gmail watch)"
          : pollMinutes
            ? `checked every ${pollMinutes} min`
            : "no background sweep enabled — alerts are computed when you ask for a digest",
        lastSweep: sweep?.last_synced_at ?? null,
        watchExpiration: watchRow?.watch_expiration ?? null,
        watchError: watchRow?.watch_error ?? null,
        events: events ?? [],
        unread: (events ?? []).filter((e: any) => !e.acknowledged).length,
      }, 200, cors);
    }

    // ── FIT LOCATION ─────────────────────────────────────────────────────
    // Google Fit location history. Not Find Hub. Not a device roster. Not a
    // live phone position. Absent dataset returns the absence, plainly.
    if (action === "fit_location") {
      const withFit = accounts.filter((a) => hasScope(a, "fitness.activity.read"));
      if (!withFit.length) {
        return json({
          available: false,
          label: "Google Fit location history",
          reason: "no connected account granted Fitness read access",
        }, 200, cors);
      }
      const results = await Promise.all(withFit.map(async (a) => ({
        account: a.google_email,
        ...(await fitLocationHistory(a.token, Math.min(Number(body.days) || 14, 60))),
      })));
      return json({
        label: "Google Fit location history",
        disclaimer: "points written by fitness apps during recorded activity — this is not device locating",
        accounts: results,
        available: results.some((r) => r.available),
      }, 200, cors);
    }



    // ── HARVEST ──────────────────────────────────────────────────────────
    // The inward station's collection pass over accounts the operator owns:
    // mail headers (batched, delta where Gmail gives a marker), calendar place
    // strings, and the contact roster. Nothing external is touched, and the
    // response reports which path each leg actually took so a cached read is
    // never presented as a fresh sweep.
    if (action === "harvest") {
      const readable = accounts.filter((a) => hasScope(a, "gmail.readonly"));
      const withCal = accounts.filter((a) => hasScope(a, "calendar.readonly"));
      const withContacts = accounts.filter((a) => hasScope(a, "contacts.readonly"));
      const days = Math.min(Math.max(Number(body.days) || 30, 1), 180);

      const [ledger, placeSets, contactSets] = await Promise.all([
        readable.length
          ? mailLedger(sb, userId, readable, { days, limit: Math.min(Number(body.limit) || 120, 300), refresh: true })
          : Promise.resolve<LedgerResult>({ headers: [], mode: "full", ageMinutes: null, builtAt: null, accountsRead: [], note: "no account granted gmail read" }),
        Promise.all(withCal.map((a) => harvestPlaces(a.token, days).catch(() => []))),
        Promise.all(withContacts.map((a) => harvestContacts(a.token, 400).catch(() => []))),
      ]);

      const places = foldPlaces(placeSets.flat());
      if (places.length) {
        await sb.from("google_place_nodes").upsert(
          places.slice(0, 200).map((pl) => ({
            user_id: userId,
            place_key: pl.key,
            label: pl.label,
            visit_count: pl.visitCount,
            last_seen: pl.lastSeen,
            sources: pl.sources,
          })),
          { onConflict: "user_id,place_key" },
        ).then(undefined, () => undefined);
      }

      return json({
        harvestedAt: new Date().toISOString(),
        accounts: accounts.map((a) => a.google_email),
        mail: {
          headers: ledger.headers.length,
          mode: ledger.mode,
          note: ledger.note,
          accountsRead: ledger.accountsRead,
        },
        places: { indexed: places.length, top: places.slice(0, 8).map((pl) => ({ label: pl.label, visits: pl.visitCount })) },
        contacts: { count: contactSets.flat().length },
        scope: "owned accounts only — no external record search, no third-party scrape",
      }, 200, cors);
    }

    // ── LOCATION SIGNALS ─────────────────────────────────────────────────
    // Where the operator is likely to be comes from strings they wrote into
    // their own calendar, plus Fit points when that dataset exists. Google
    // publishes no supported device-locating API for third parties: Find Hub
    // is reachable only by scraping an unofficial endpoint, and that is a line
    // this surface does not cross. The gap is returned as a gap.
    if (action === "location_signals") {
      const days = Math.min(Math.max(Number(body.days) || 90, 7), 365);
      const withCal = accounts.filter((a) => hasScope(a, "calendar.readonly"));
      const withFit = accounts.filter((a) => hasScope(a, "fitness.activity.read"));

      const [placeSets, fitSets] = await Promise.all([
        Promise.all(withCal.map((a) => harvestPlaces(a.token, days).catch(() => []))),
        Promise.all(withFit.map(async (a) => ({
          account: a.google_email,
          ...(await fitLocationHistory(a.token, 14).catch(() => ({ available: false, points: [] as unknown[] }))),
        }))),
      ]);

      const obs = placeSets.flat();
      const folded = foldPlaces(obs);
      // Rank by how often the string recurs — a rhythm, never a live position.
      const ranked = folded.slice(0, 12).map((pl) => ({
        label: pl.label,
        visits: pl.visitCount,
        lastSeen: pl.lastSeen,
        source: "calendar LOCATION string",
      }));

      return json({
        window: { days, events: obs.length },
        calendarPlaces: ranked,
        fit: {
          available: fitSets.some((f: any) => f.available),
          accounts: fitSets,
          disclaimer: "points written by fitness apps during recorded activity — not device locating",
        },
        deviceLocating: {
          available: false,
          reason: "Find Hub exposes no supported third-party API; the only route is an unofficial scrape, which this surface refuses",
          gap: true,
        },
        honesty: ranked.length
          ? "these are recurring calendar strings, not a measured position, and carry no accuracy percentage"
          : "no calendar LOCATION strings in the window — there is no location read to give",
      }, 200, cors);
    }

    // ── SEND DRAFT (Tier 5 — two-phase, human-confirmed) ─────────────────
    if (action === "send_draft") {
      const draftId = String(body.draft_id ?? "").trim();
      const confirm = String(body.confirm ?? "").trim().toUpperCase();
      if (!draftId) return json({ error: "draft_id required" }, 400, cors);
      if (confirm !== "SEND") {
        return json({
          error: "confirmation_required",
          message: 'Sending requires explicit confirmation. Echo confirm:"SEND" with the draft id.',
        }, 428, cors);
      }
      const acct = accounts.find((a) => hasScope(a, "gmail.send"));
      if (!acct) {
        return json({
          error: "tier_required",
          message: "Delegated send needs Tier 5. Reconnect the account and grant send access.",
        }, 403, cors);
      }

      // The draft must exist and be readable before we touch the send API —
      // this is what keeps the flow two-phase instead of fire-and-forget.
      let meta: { to: string; subject: string; snippet: string };
      try {
        meta = await getDraft(acct.token, draftId);
      } catch (e) {
        return json({ error: "draft_not_found", details: (e as Error).message }, 404, cors);
      }

      await audit(sb, userId, {
        google_email: acct.google_email,
        action: "send_requested",
        target: meta.to,
        payload: { draftId, subject: meta.subject },
      });

      try {
        const sent = await sendExistingDraft(acct.token, draftId);
        await audit(sb, userId, {
          google_email: acct.google_email,
          action: "send_completed",
          target: meta.to,
          payload: { draftId, messageId: sent.messageId, subject: meta.subject },
          confirmed: true,
        });
        return json({ sent: true, ...sent, to: meta.to, subject: meta.subject, account: acct.google_email }, 200, cors);
      } catch (e) {
        await audit(sb, userId, {
          google_email: acct.google_email,
          action: "send_failed",
          target: meta.to,
          payload: { draftId, error: (e as Error).message },
        });
        return json({ error: "send_failed", details: (e as Error).message }, 502, cors);
      }
    }

    // ── AUDIT LOG ────────────────────────────────────────────────────────

    if (action === "audit_log") {
      const { data } = await sb.from("google_agency_audit")
        .select("*").eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(50);
      return json({ entries: data ?? [] }, 200, cors);
    }

    return json({ error: "Unknown action" }, 400, cors);
  } catch (e) {
    console.error("[google-mesh]", (e as Error).message);
    return json({ error: (e as Error).message || "Internal error" }, 500, cors);
  }
});
