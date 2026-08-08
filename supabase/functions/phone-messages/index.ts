// ═══════════════════════════════════════════════════════════════════════════
// PHONE-MESSAGES — the SMS / Google Voice channel of Cloud Intelligence
// ---------------------------------------------------------------------------
// Actions
//   sync     → pull Google Voice SMS/MMS/voicemail out of every linked Gmail
//              account and upsert into the ledger (source = "sms")
//   ingest   → accept a batch of on-device Android SMS from the companion app
//   threads  → fold the ledger into per-correspondent threads, with the
//              address book joined on phone number so a thread reads as a
//              PERSON, not a number
//   thread   → one correspondent, full message list (most recent first)
//   analyze  → model-read of a single thread: who this person is to you, what
//              they want, what is unresolved, what is suspicious
//
// Read-only against Google. No send path. Every model call receives the
// message corpus fenced as untrusted data.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { liveAccounts, hasScope, adminClient } from "../_shared/googleMesh.ts";
import {
  harvestVoiceMessages, normalizeDeviceMessages, foldThreads, fenceMessages,
  phoneKey, toE164, type PhoneThread,
} from "../_shared/phoneMessages.ts";
import { resolveKey, byokErrorResponse } from "../_shared/adminGate.ts";
import { callByokJsonWithRetry } from "../_shared/zophielByokRouter.ts";

const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

async function authUser(req: Request): Promise<{ id: string; email: string } | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data, error } = await sb.auth.getUser(auth.slice(7));
  if (error || !data?.user) return null;
  return { id: data.user.id, email: (data.user.email ?? "").toLowerCase() };
}

/** Address book join: phone digits → the human behind them. */
async function contactIndex(sb: ReturnType<typeof adminClient>, userId: string) {
  const { data } = await sb
    .from("google_signals")
    .select("actor_name, actor_email, snippet, metadata")
    .eq("user_id", userId)
    .eq("source", "contacts")
    .limit(2000);

  const idx = new Map<string, { name: string; email: string | null; role: string | null }>();
  for (const c of data ?? []) {
    const phones: string[] = (c.metadata as any)?.phones ?? [];
    for (const p of phones) {
      const k = phoneKey(String(p));
      if (k.length >= 7 && !idx.has(k)) {
        idx.set(k, {
          name: String(c.actor_name ?? "").trim(),
          email: (c.actor_email as string) ?? null,
          role: (c.snippet as string) ?? null,
        });
      }
    }
  }
  return idx;
}

async function loadSmsRows(
  sb: ReturnType<typeof adminClient>,
  userId: string,
  days: number,
  peerKey?: string,
  limit = 2000,
) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  let q = sb
    .from("google_signals")
    .select("id, kind, occurred_at, actor_email, actor_name, direction, subject, snippet, amount, metadata")
    .eq("user_id", userId)
    .eq("source", "sms")
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (peerKey) q = q.eq("actor_email", `${peerKey}@phone.invalid`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const user = await authUser(req);
    if (!user) return json({ error: "unauthorized" }, 401, cors);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "threads");
    const days = Math.max(1, Math.min(365, Number(body?.days) || 90));
    const sb = adminClient();

    if (action === "__peek") {
      const accounts = await liveAccounts(sb, user.id, null);
      const a = accounts.find((x) => x.google_email === String(body?.email ?? "")) ?? accounts[0];
      const { gfetchPeek } = await import("../_shared/phoneMessages.ts");
      return json(await gfetchPeek(a, String(body?.q ?? "from:txt.voice.google.com")), 200, cors);
    }

    // ── SYNC: Google Voice → ledger ──────────────────────────────────────
    if (action === "sync") {
      const accounts = await liveAccounts(sb, user.id, body?.account_id ?? null);
      if (!accounts.length) {
        return json({ error: "no_account", message: "No connected Google account." }, 400, cors);
      }
      const reports: Array<Record<string, unknown>> = [];
      let ingested = 0;
      const started = Date.now();

      for (const a of accounts) {
        if (Date.now() - started > 80_000) break;
        if (!hasScope(a, "gmail.readonly")) {
          reports.push({ account: a.google_email, status: "skipped", reason: "gmail.readonly not granted" });
          continue;
        }
        try {
          const rows = await harvestVoiceMessages(user.id, a, days, 400);
          for (let i = 0; i < rows.length; i += 200) {
            const { error } = await sb
              .from("google_signals")
              .upsert(rows.slice(i, i + 200), { onConflict: "user_id,fingerprint" });
            if (error) throw new Error(error.message);
          }
          ingested += rows.length;
          reports.push({ account: a.google_email, status: "ok", harvested: rows.length });
        } catch (e) {
          reports.push({ account: a.google_email, status: "error", error: String((e as Error).message).slice(0, 300) });
        }
      }
      // Purge rows left behind by an earlier parse that truncated the body —
      // a message with no readable text is noise in every downstream fold.
      await sb.from("google_signals").delete()
        .eq("user_id", user.id).eq("source", "sms").or("snippet.is.null,snippet.eq.<");

      return json({ ok: true, ingested, reports, elapsedMs: Date.now() - started }, 200, cors);
    }

    // ── INGEST: Android companion batch ──────────────────────────────────
    if (action === "ingest") {
      const items = Array.isArray(body?.messages) ? body.messages : [];
      if (!items.length) return json({ ok: true, ingested: 0, skipped: "empty batch" }, 200, cors);
      const rows = await normalizeDeviceMessages(
        user.id,
        String(body?.device_id ?? "unknown-device"),
        user.email,
        items,
        1000,
      );
      let ingested = 0;
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await sb
          .from("google_signals")
          .upsert(rows.slice(i, i + 200), { onConflict: "user_id,fingerprint" });
        if (error) throw new Error(error.message);
        ingested += rows.slice(i, i + 200).length;
      }
      return json({ ok: true, ingested, received: items.length }, 200, cors);
    }

    // ── THREADS: per-correspondent fold ──────────────────────────────────
    if (action === "threads") {
      const rows = await loadSmsRows(sb, user.id, days);
      const idx = await contactIndex(sb, user.id);
      const threads: PhoneThread[] = foldThreads(rows).map((t) => {
        const c = idx.get(t.peerKey);
        return {
          ...t,
          name: c?.name || t.name,
          ...(c ? { identity: { email: c.email, role: c.role, source: "address_book" } } : {}),
        } as PhoneThread;
      });
      const totals = {
        messages: rows.length,
        correspondents: threads.length,
        inbound: rows.filter((r) => r.direction !== "out").length,
        outbound: rows.filter((r) => r.direction === "out").length,
        voice: rows.filter((r) => (r.metadata as any)?.channel === "google_voice").length,
        device: rows.filter((r) => (r.metadata as any)?.channel === "device_sms").length,
        unknownNumbers: threads.filter((t) => !t.name).length,
      };
      return json({ ok: true, windowDays: days, totals, threads }, 200, cors);
    }

    // ── THREAD: one correspondent, verbatim ──────────────────────────────
    if (action === "thread") {
      const key = phoneKey(String(body?.peer ?? ""));
      if (!key) return json({ error: "bad_request", message: "peer required" }, 400, cors);
      const rows = await loadSmsRows(sb, user.id, days, key, 500);
      const idx = await contactIndex(sb, user.id);
      const fold = foldThreads(rows)[0] ?? null;
      return json({
        ok: true,
        peer: toE164(key),
        identity: idx.get(key) ?? null,
        summary: fold,
        messages: rows.map((r) => ({
          id: r.id, at: r.occurred_at, direction: r.direction, kind: r.kind,
          text: r.snippet, channel: (r.metadata as any)?.channel ?? null,
        })),
      }, 200, cors);
    }

    // ── ANALYZE: comprehension over one thread ───────────────────────────
    if (action === "analyze") {
      const key = phoneKey(String(body?.peer ?? ""));
      if (!key) return json({ error: "bad_request", message: "peer required" }, 400, cors);
      const rows = await loadSmsRows(sb, user.id, days, key, 300);
      if (!rows.length) return json({ error: "empty", message: "No messages in window." }, 404, cors);

      const idx = await contactIndex(sb, user.id);
      const identity = idx.get(key) ?? null;
      const fold = foldThreads(rows)[0];

      const corpus = rows
        .slice(0, 160)
        .reverse()
        .map((r) => `[${r.occurred_at ?? "?"}] ${r.direction === "out" ? "OPERATOR" : "THEM"}: ${String(r.snippet ?? "")}`);

      const sys = [
        "You are an intelligence analyst reading a phone-message thread on behalf of the operator.",
        "You produce a factual, sourced read of the correspondent and the relationship.",
        "You never invent identity facts. If the corpus does not support a claim, say unknown.",
        "Return STRICT JSON only, matching this shape:",
        `{"who":string,"relationship":string,"confidence":"low"|"moderate"|"high","intent":string,`,
        `"open_items":string[],"commitments":string[],"tone":string,"risk":{"level":"none"|"low"|"elevated"|"high","reasons":string[]},`,
        `"notable_claims":string[],"recommended_action":string}`,
      ].join("\n");

      const measured = JSON.stringify({
        peer: toE164(key),
        addressBook: identity,
        measured: {
          messages: fold?.messages, inbound: fold?.inbound, outbound: fold?.outbound,
          reciprocity: fold?.reciprocity, medianReplyMinutes: fold?.medianReplyMinutes,
          nightMessages: fold?.nightMessages, markers: fold?.markers,
          firstAt: fold?.firstAt, lastAt: fold?.lastAt, channels: fold?.channels,
        },
      });

      const keyRes = await resolveKey(req, body?.byok);
      const cfg = keyRes.mode === "admin"
        ? { provider: "google" as const, model: "gemini-flash-latest", apiKey: keyRes.geminiKey! }
        : keyRes.byok!;

      const raw = await callByokJsonWithRetry(
        cfg,
        sys,
        `DETERMINISTIC MEASUREMENTS (trusted):\n${measured}\n\n${fenceMessages(corpus)}`,
        { temperature: 0.2, maxOutputTokens: 2400, jsonMode: true, timeoutMs: 60_000 },
      );

      let parsed: unknown = null;
      try {
        parsed = JSON.parse(raw.replace(/^```json\s*|\s*```$/g, "").trim());
      } catch {
        parsed = { who: "unparsed", raw: String(raw).slice(0, 2000) };
      }
      return json({ ok: true, peer: toE164(key), identity, measured: fold, assessment: parsed }, 200, cors);
    }

    return json({ error: "unknown_action", action }, 400, cors);
  } catch (e) {
    if ((e as any)?.code === "BYOK_REQUIRED" || (e as any)?.status === 429) {
      return byokErrorResponse(e, cors);
    }
    console.error("[phone-messages]", e);
    return json({ error: "internal_error", message: String((e as Error).message).slice(0, 400) }, 500, cors);
  }
});
