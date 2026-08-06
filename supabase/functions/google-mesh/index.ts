// ═══════════════════════════════════════════════════════════════════════════
// google-mesh — the Google Mesh control surface
// Actions: status | build_voiceprint | pattern_map | attention_ledger |
//          ghostwrite | search_mail | audit_log
// Every action is user-scoped by a verified JWT. No action sends mail.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  adminClient, liveAccounts, harvestSentBodies, computeStylometry,
  harvestPlaces, foldPlaces, buildAttention, createDraft, audit,
  voiceInstruction, fenceUntrusted, gfetch, hasScope,
} from "../_shared/googleMesh.ts";

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

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

    // ── PATTERN MAP ──────────────────────────────────────────────────────
    if (action === "pattern_map") {
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
      return json({
        nodes: nodes.slice(0, 100),
        observations: all.length,
        anomalies: nodes.filter((n) => n.anomaly).map((n) => n.label),
      }, 200, cors);
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
