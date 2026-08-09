// ═══════════════════════════════════════════════════════════════════════════
// mesh-vault — automated correspondent intelligence, persisted to the Vault
//
// Actions:
//   vault_status  · queue depth, hop census, last run
//   vault_enqueue · read mail metadata → rank humans → queue hop-1 subjects
//   vault_process · drain the queue (time-bounded, resumable, idempotent)
//   vault_list    · dossier index + hop-3 cross-links folded across the vault
//   vault_get     · one full dossier
//   vault_promote · lift a hop-2 stub into the sweep queue
//   vault_refresh · re-sweep an existing dossier
//   vault_remove  · delete a dossier (owner only)
//
// Every action is scoped by a verified JWT. Reads are metadata-first; no
// message body is stored. Nothing here sends mail.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  adminClient, liveAccounts, hasScope, harvestHeaders, harvestContacts, buildRelationships,
  harvestCalendarPeople, audit,
} from "../_shared/googleMesh.ts";
import {
  selectTargets, selectContactTargets, buildDossier, foldCrossLinks, normKey,
  type MeshDossierDoc,
} from "../_shared/meshDossier.ts";
import { notifyIntel } from "../_shared/intelNotify.ts";
import {
  selectColdInbound, selectCalendarTargets, selectPhoneTargets, dedupeByIdentity,
  type ChannelTarget,
} from "../_shared/meshSentinel.ts";


const json = (body: unknown, status: number, cors: Record<string, string>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

/** Wall-clock guard: leave room to write results before the platform cuts us. */
const RUN_BUDGET_MS = 140_000;
const PER_SUBJECT_MS = 115_000;


/**
 * A finished dossier is an intelligence product, so it announces itself on the
 * same bus as every other report: inbox row, device push, email. Failures here
 * are logged and swallowed — the dossier itself is already safely persisted.
 */
async function announceDossier(
  userId: string,
  userEmail: string | null,
  subjectName: string,
  subjectKey: string,
  doc: MeshDossierDoc,
  summary: string,
  confidence: number,
) {
  try {
    const identityFields = Object.keys(doc?.identity ?? {}).length;
    await notifyIntel({
      userId,
      userEmail,
      kind: "dossier",
      // A dossier that actually bound an identity is worth interrupting for;
      // a thin one belongs in the inbox, not on a lock screen.
      severity: confidence >= 0.7 && identityFields > 0 ? "notable" : "info",
      title: `Dossier ready — ${subjectName}`,
      body: summary || "Correspondent dossier built from open sources.",
      subjectName,
      source: "Cloud Intelligence Mesh",
      url: `/dashboard?tab=cloud-intel&module=vault&subject=${encodeURIComponent(subjectKey)}`,
      sections: [
        { label: "Identity confidence", value: `${Math.round((confidence ?? 0) * 100)}%` },
        { label: "Jurisdiction", value: doc?.jurisdiction || "not resolved" },
        {
          label: "Collection",
          value: `${doc?.metrics?.documentsParsed ?? 0} documents parsed across ${doc?.metrics?.independentDomains ?? 0} independent domains`,
        },
        { label: "Network", value: `${doc?.hop1?.length ?? 0} direct · ${doc?.hop2?.length ?? 0} second-hop · ${doc?.hop3?.length ?? 0} cross-links` },
      ],
      findings: (doc?.gaps ?? []).slice(0, 6).map((g) => `Gap: ${g}`),
      idempotencyKey: `dossier:${subjectKey}:${doc?.builtAt ?? ""}`,
    });
  } catch (e) {
    console.error("dossier_announce_failed", e instanceof Error ? e.message : e);
  }
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const startedAt = Date.now();

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

    // ── STATUS ───────────────────────────────────────────────────────────
    if (action === "vault_status") {
      const [{ data: rows }, { data: runs }, { data: settings }] = await Promise.all([
        sb.from("mesh_dossiers").select("status, hop, channel").eq("user_id", userId),
        sb.from("mesh_dossier_runs").select("*").eq("user_id", userId)
          .order("started_at", { ascending: false }).limit(1),
        sb.from("mesh_vault_settings").select("*").eq("user_id", userId).maybeSingle(),
      ]);
      const census = { queued: 0, building: 0, ready: 0, failed: 0, linked: 0, skipped: 0 } as Record<string, number>;
      const hops = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
      for (const r of rows ?? []) {
        census[r.status] = (census[r.status] ?? 0) + 1;
        hops[r.hop] = (hops[r.hop] ?? 0) + 1;
      }
      const channels: Record<string, number> = {};
      for (const r of rows ?? []) {
        const c = (r as any).channel ?? "address_book";
        channels[c] = (channels[c] ?? 0) + 1;
      }
      return json({
        census, hops, channels, total: rows?.length ?? 0,
        lastRun: runs?.[0] ?? null,
        sentinel: settings ?? null,
      }, 200, cors);
    }

    // ── LIST ─────────────────────────────────────────────────────────────
    if (action === "vault_list") {
      const hop = body.hop ? Number(body.hop) : null;
      let q = sb.from("mesh_dossiers")
        .select("id, subject_name, subject_email, hop, via, channel, status, relationship, summary, confidence, priority, error_message, built_at, updated_at")
        .eq("user_id", userId)
        .order("hop", { ascending: true })
        .order("confidence", { ascending: false })
        .order("priority", { ascending: false })
        .limit(300);
      if (hop) q = q.eq("hop", hop);
      const { data: rows, error } = await q;
      if (error) return json({ error: "list_failed", message: error.message }, 500, cors);

      const { data: full } = await sb.from("mesh_dossiers")
        .select("subject_name, dossier").eq("user_id", userId).eq("hop", 1).eq("status", "ready").limit(80);
      const crossLinks = foldCrossLinks((full ?? []) as any);

      return json({ dossiers: rows ?? [], crossLinks }, 200, cors);
    }

    // ── GET ──────────────────────────────────────────────────────────────
    if (action === "vault_get") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "id_required" }, 400, cors);
      const { data, error } = await sb.from("mesh_dossiers")
        .select("*").eq("user_id", userId).eq("id", id).maybeSingle();
      if (error) return json({ error: "get_failed", message: error.message }, 500, cors);
      if (!data) return json({ error: "not_found" }, 404, cors);
      return json({ dossier: data }, 200, cors);
    }

    // ── REMOVE ───────────────────────────────────────────────────────────
    if (action === "vault_remove") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "id_required" }, 400, cors);
      const { error } = await sb.from("mesh_dossiers").delete().eq("user_id", userId).eq("id", id);
      if (error) return json({ error: "remove_failed", message: error.message }, 500, cors);
      return json({ removed: true }, 200, cors);
    }

    // ── PROMOTE / REFRESH (queue mutations) ──────────────────────────────
    if (action === "vault_promote" || action === "vault_refresh") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "id_required" }, 400, cors);
      const { data, error } = await sb.from("mesh_dossiers")
        .update({ status: "queued", error_message: null })
        .eq("user_id", userId).eq("id", id).select("id, subject_name, hop").maybeSingle();
      if (error) return json({ error: "queue_failed", message: error.message }, 500, cors);
      if (!data) return json({ error: "not_found" }, 404, cors);
      return json({ queued: data }, 200, cors);
    }

    // ── FOR CONTACT ──────────────────────────────────────────────────────
    // On-demand open-source sweep for ONE named correspondent, used by the
    // contact intelligence report. The report cannot wait for the background
    // queue to reach a subject — the operator is looking at that person right
    // now — so this path reads the cached dossier when it is inside its
    // half-life and builds synchronously when it is not.
    //
    // Idempotent by (user_id, subject_key): a subject already in the vault is
    // refreshed in place, never duplicated under a second key.
    if (action === "vault_for_contact") {
      const rawEmail = String(body.email ?? "").trim().toLowerCase().slice(0, 254);
      const email = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(rawEmail) ? rawEmail : null;
      const name = String(body.name ?? "").trim().slice(0, 120);
      if (!email && !name) return json({ error: "subject_required" }, 400, cors);

      // Half-life of a dossier. Public records move slowly; a fortnight-old
      // sweep is still intelligence, and re-running it would burn the budget
      // that a never-swept subject needs.
      const maxAgeMs = Math.min(Math.max(Number(body.max_age_days) || 14, 1), 180) * 86400000;
      const force = body.force === true;

      let row: Record<string, any> | null = null;
      if (email) {
        const { data } = await sb.from("mesh_dossiers")
          .select("*").eq("user_id", userId).eq("subject_email", email).limit(1);
        row = data?.[0] ?? null;
      }
      if (!row && name) {
        const { data } = await sb.from("mesh_dossiers")
          .select("*").eq("user_id", userId).eq("subject_key", `contact:${normKey(name).toLowerCase()}`).limit(1);
        row = data?.[0] ?? null;
      }

      const builtMs = row?.built_at ? Date.parse(row.built_at) : NaN;
      const fresh = Number.isFinite(builtMs) && Date.now() - builtMs < maxAgeMs;
      if (row && row.status === "ready" && fresh && !force) {
        return json({
          status: "ready", source: "cache", dossier: row.dossier,
          summary: row.summary, confidence: Number(row.confidence ?? 0),
          builtAt: row.built_at,
        }, 200, cors);
      }
      if (row && row.status === "building" && !force) {
        return json({ status: "building", dossier: row.dossier ?? null, message: "A sweep for this subject is already in flight." }, 200, cors);
      }
      if (body.build === false) {
        return json({
          status: row?.status ?? "absent", dossier: row?.dossier ?? null,
          message: row ? "Cached dossier is stale; refresh not requested." : "No dossier on file for this subject.",
        }, 200, cors);
      }

      const subjectKey = row?.subject_key ?? (email ?? `contact:${normKey(name).toLowerCase()}`);
      const rel = (row?.relationship ?? null) as any;
      const identifiers = [
        ...(Array.isArray(body.identifiers) ? body.identifiers : []),
        ...(Array.isArray(rel?.identifiers) ? rel.identifiers : []),
        ...(Array.isArray(rel?.phones) ? rel.phones : []),
      ].map((s: unknown) => String(s).slice(0, 60)).filter(Boolean).slice(0, 3);
      const hint = String(rel?.locationHint || body.location_hint || "").slice(0, 80);
      // Organisational anchors bound by the caller (employer string, or the
      // corporate domains observed alongside this subject). Validated and
      // capped here so a client can never fan the org pass out unbounded.
      const orgAnchors = (Array.isArray(body.org_anchors) ? body.org_anchors : [])
        .map((s: unknown) => String(s).trim().slice(0, 80))
        .filter((s: string) => s.length >= 3)
        .slice(0, 2);

      await sb.from("mesh_dossiers").upsert({
        user_id: userId,
        subject_key: subjectKey,
        subject_email: email,
        subject_name: name || email || "unknown",
        hop: row?.hop ?? 1,
        status: "building",
        relationship: rel ?? { source: "contact_report", channel: "address_book" },
        priority: row?.priority ?? 50,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,subject_key" });

      try {
        const { doc, summary, confidence } = await withTimeout(
          buildDossier(name || email!, email, rel && rel.email ? rel : null, {
            locationHint: hint,
            identifiers,
            orgAnchors,
            channel: rel?.channel ?? "address_book",
          }),
          PER_SUBJECT_MS,
        );

        const builtAt = new Date().toISOString();
        await sb.from("mesh_dossiers").update({
          status: "ready", dossier: doc as unknown as Record<string, unknown>,
          summary, confidence, error_message: null, built_at: builtAt,
        }).eq("user_id", userId).eq("subject_key", subjectKey);

        if ((row?.hop ?? 1) === 1) await persistHopTwo(sb, userId, name || email!, doc);
        await announceDossier(userId, user.email ?? null, name || email!, subjectKey, doc, summary, confidence);

        return json({ status: "ready", source: "fresh", dossier: doc, summary, confidence, builtAt }, 200, cors);
      } catch (e) {
        const msg = (e as Error).message.slice(0, 300);
        await sb.from("mesh_dossiers").update({ status: "failed", error_message: msg })
          .eq("user_id", userId).eq("subject_key", subjectKey);
        // The previously stored dossier, if any, is still the best product on
        // hand — returning it with the failure stated beats returning nothing.
        return json({ status: "failed", dossier: row?.dossier ?? null, message: msg }, 200, cors);
      }
    }

    // ── ENQUEUE ──────────────────────────────────────────────────────────
    if (action === "vault_enqueue") {
      const accounts = await liveAccounts(sb, userId, body.account_id ?? null);
      const readable = accounts.filter((a) => hasScope(a, "gmail.readonly"));
      const bookable = accounts.filter((a) => hasScope(a, "contacts.readonly"));
      if (!readable.length && !bookable.length) {
        return json({
          error: "tier_required",
          message: "Grant Tier 2 (Read) on a Google account before running a vault sweep.",
        }, 403, cors);
      }

      const window = Math.min(Math.max(Number(body.days) || 365, 14), 730);
      const perQuery = Math.min(Number(body.limit) || 150, 200);
      const max = Math.min(Number(body.max) || 25, 60);
      const contactMax = Math.min(Number(body.contacts_max) || 40, 120);
      const after = new Date(Date.now() - window * 86400000).toISOString().slice(0, 10).replace(/-/g, "/");
      const selfEmails = accounts.map((a) => a.google_email);

      // Mail and address book are harvested together: correspondence proves a
      // relationship is live, the book proves the user claimed it. Either
      // alone leaves a blind spot.
      const [harvested, contacts] = await Promise.all([
        Promise.all(readable.flatMap((a) => [
          harvestHeaders(a.token, `in:inbox -in:chats after:${after}`, perQuery, false).catch(() => []),
          harvestHeaders(a.token, `in:sent -in:chats after:${after}`, perQuery, true).catch(() => []),
        ])).then((r) => r.flat()),
        Promise.all(bookable.map((a) => harvestContacts(a.token, 400).catch(() => [])))
          .then((r) => r.flat()),
      ]);

      const people = buildRelationships(harvested, selfEmails);
      const { targets, skipped } = selectTargets(people, { max });

      // Idempotent: existing subjects keep their dossier and status; only the
      // relationship telemetry and priority are refreshed.
      const { data: existing } = await sb.from("mesh_dossiers")
        .select("subject_key, status").eq("user_id", userId);
      const known = new Map((existing ?? []).map((r: any) => [r.subject_key, r.status]));

      const nowIso = new Date().toISOString();
      const keep = (key: string) =>
        known.has(key) && known.get(key) !== "failed" ? known.get(key)! : "queued";

      const rows = targets.map((t) => ({
        user_id: userId,
        subject_key: t.key,
        subject_email: t.email,
        subject_name: t.name,
        hop: 1,
        status: keep(t.key),
        relationship: t.relationship as unknown as Record<string, unknown>,
        priority: t.priority,
        source_account: selfEmails[0] ?? null,
        updated_at: nowIso,
      }));

      // Contacts never collide with mail subjects: keys already claimed above
      // and keys already in the vault are both excluded.
      const claimed = new Set<string>([...known.keys(), ...rows.map((r) => r.subject_key)]);
      const dedupeSelf = new Set(selfEmails.map((e) => e.toLowerCase()));
      const book = contacts.filter((c) => !c.emails.some((e) => dedupeSelf.has(e)));
      const { targets: contactTargets, skipped: contactSkipped } =
        selectContactTargets(book, claimed, { max: contactMax });

      const contactRows = contactTargets.map((t) => ({
        user_id: userId,
        subject_key: t.key,
        subject_email: t.email,
        subject_name: t.name,
        hop: 1,
        status: keep(t.key),
        relationship: {
          ...t.profile,
          locationHint: t.locationHint,
          reason: t.reason,
        } as unknown as Record<string, unknown>,
        priority: t.priority,
        source_account: selfEmails[0] ?? null,
        updated_at: nowIso,
      }));

      const allRows = [...rows, ...contactRows];
      if (allRows.length) {
        const { error } = await sb.from("mesh_dossiers").upsert(allRows, { onConflict: "user_id,subject_key" });
        if (error) return json({ error: "enqueue_failed", message: error.message }, 500, cors);
      }

      const newlyQueued = allRows.filter((r) => r.status === "queued").length;
      await sb.from("mesh_dossier_runs").insert({
        user_id: userId, phase: "enqueue", queued: newlyQueued,
        skipped: skipped.length + contactSkipped.length,
        stats: {
          messagesAnalyzed: harvested.length, correspondents: people.length,
          contactsRead: contacts.length, contactSubjects: contactRows.length,
          windowDays: window, accounts: selfEmails,
        },
        finished_at: nowIso,
      });
      await audit(sb, userId, {
        google_email: selfEmails[0] ?? "",
        action: "vault_enqueue",
        target: `${allRows.length} subjects`,
        payload: { messagesAnalyzed: harvested.length, contactsRead: contacts.length, queued: newlyQueued },
        confirmed: true,
      });

      return json({
        messagesAnalyzed: harvested.length,
        correspondents: people.length,
        contactsRead: contacts.length,
        contactSubjects: contactRows.length,
        targets: [
          ...targets.map((t) => ({ email: t.email, name: t.name, priority: t.priority, reason: t.reason })),
          ...contactTargets.map((t) => ({ email: t.email, name: t.name, priority: t.priority, reason: t.reason })),
        ],
        queued: newlyQueued,
        skipped: [...skipped, ...contactSkipped].slice(0, 40),
        windowDays: window,
      }, 200, cors);
    }

    // ── SENTINEL ─────────────────────────────────────────────────────────
    // Watermark-driven watch across every inbound channel. Anyone who reaches
    // the user — a cold sender, a meeting organizer, an unknown number on a
    // card — becomes a queued subject the moment they appear. Idempotent:
    // the watermark only advances after a successful harvest, and existing
    // subjects are never re-queued or overwritten.
    if (action === "vault_sentinel") {
      const accounts = await liveAccounts(sb, userId, body.account_id ?? null);
      if (!accounts.length) {
        return json({
          error: "tier_required",
          message: "Connect a Google account with Read access to arm the sentinel.",
        }, 403, cors);
      }
      const readable = accounts.filter((a) => hasScope(a, "gmail.readonly"));
      const bookable = accounts.filter((a) => hasScope(a, "contacts.readonly"));
      const datable = accounts.filter((a) => hasScope(a, "calendar.readonly"));
      const selfEmails = accounts.map((a) => a.google_email);

      const { data: settings } = await sb.from("mesh_vault_settings")
        .select("*").eq("user_id", userId).maybeSingle();

      // Cold start looks back 30 days; every later run looks back only to the
      // last successful harvest, with a 6h overlap so a message that landed
      // mid-run is never skipped.
      const OVERLAP_MS = 6 * 3600_000;
      const watermark = settings?.last_watermark ? Date.parse(settings.last_watermark) : 0;
      const sinceMs = watermark ? Math.max(0, watermark - OVERLAP_MS) : Date.now() - 30 * 86400000;
      const gmailAfter = new Date(sinceMs).toISOString().slice(0, 10).replace(/-/g, "/");
      const perQuery = Math.min(Number(body.limit) || 120, 200);

      // A swallowed harvest failure is worse than a slow sweep: if Gmail 5xxs
      // and the watermark still advances, that window is skipped forever. Each
      // branch reports success or failure, and the watermark only moves when
      // every armed channel actually returned.
      const failures: Array<{ channel: string; account: string; error: string }> = [];
      const harvest = async <T>(channel: string, account: string, fn: () => Promise<T[]>): Promise<T[]> => {
        try { return await fn(); }
        catch (e) { failures.push({ channel, account, error: String((e as Error).message).slice(0, 160) }); return []; }
      };

      const [inbound, contacts, calendar] = await Promise.all([
        Promise.all(readable.map((a) => harvest("mail", a.google_email, () =>
          harvestHeaders(a.token, `in:inbox -in:chats after:${gmailAfter}`, perQuery, false),
        ))).then((r) => r.flat()),
        Promise.all(bookable.map((a) => harvest("contacts", a.google_email, () =>
          harvestContacts(a.token, 400),
        ))).then((r) => r.flat()),
        Promise.all(datable.map((a) => harvest("calendar", a.google_email, () =>
          harvestCalendarPeople(a.token, 180, selfEmails),
        ))).then((r) => r.flat()),
      ]);

      const { data: existing } = await sb.from("mesh_dossiers")
        .select("subject_key, subject_name, subject_email").eq("user_id", userId);
      const claimed = new Set((existing ?? []).map((r: any) => r.subject_key));
      // Names of subjects that carry NO address. Those are the only rows a
      // name collision can safely suppress — two different people share a name
      // constantly, and dropping a distinct address on that basis loses a real
      // subject and asserts an identity that was never established.
      const anonymousNames = new Set(
        (existing ?? []).filter((r: any) => !r.subject_email).map((r: any) => normKey(r.subject_name)),
      );

      // Prior correspondents make "first contact" a checkable claim instead of
      // an artifact of the watermark window.
      const knownCorrespondents = new Set(
        (existing ?? []).map((r: any) => String(r.subject_email ?? "").toLowerCase()).filter(Boolean),
      );

      const cold = selectColdInbound(inbound, selfEmails, claimed, { max: 25, sinceMs, knownCorrespondents });
      const cal = selectCalendarTargets(calendar, claimed, { max: 20 });
      const phone = selectPhoneTargets(contacts, claimed, { max: 25 });
      // Cards that carry an email are skipped by the phone selector; without
      // this pass they were reachable only through a manual scan, so a newly
      // saved contact with an address silently never became a subject.
      const book = selectContactTargets(contacts as any, claimed, { max: 30 });
      const bookTargets: ChannelTarget[] = book.targets.map((t) => ({
        key: t.key,
        email: t.email,
        name: t.name,
        channel: "address_book" as const,
        priority: t.priority,
        identifiers: [...(t.profile.phones ?? []), ...(t.profile.emails ?? [])].slice(0, 2),
        locationHint: t.locationHint,
        reason: t.reason,
        profile: t.profile as unknown as Record<string, unknown>,
      }));

      // One human, one subject — but only where the evidence supports the
      // merge; see dedupeByIdentity.
      const fresh = dedupeByIdentity([...cold.targets, ...cal.targets, ...phone.targets, ...bookTargets])
        .filter((t: ChannelTarget) => t.email ? !claimed.has(t.email.toLowerCase()) : !anonymousNames.has(normKey(t.name)))
        .slice(0, Math.min(Number(body.max) || 40, 80));


      const nowIso = new Date().toISOString();
      const rows = fresh.map((t) => ({
        user_id: userId,
        subject_key: t.key,
        subject_email: t.email,
        subject_name: t.name,
        hop: 1,
        channel: t.channel,
        status: "queued",
        relationship: {
          ...t.profile,
          channel: t.channel,
          identifiers: t.identifiers,
          locationHint: t.locationHint,
          reason: t.reason,
        } as unknown as Record<string, unknown>,
        priority: t.priority,
        source_account: selfEmails[0] ?? null,
        updated_at: nowIso,
      }));

      if (rows.length) {
        // ignoreDuplicates: a live dossier must never be reset by the watch.
        const { error } = await sb.from("mesh_dossiers")
          .upsert(rows, { onConflict: "user_id,subject_key", ignoreDuplicates: true });
        if (error) return json({ error: "sentinel_enqueue_failed", message: error.message }, 500, cors);
      }

      // Degraded harvest → hold the watermark. The enqueued rows still stand
      // (they are real), but the window stays open so the next sweep re-reads
      // what the failing channel never returned.
      const degraded = failures.length > 0;
      await sb.from("mesh_vault_settings").upsert({
        user_id: userId,
        sentinel_enabled: body.enabled === undefined ? (settings?.sentinel_enabled ?? true) : !!body.enabled,
        last_watermark: degraded ? (settings?.last_watermark ?? null) : nowIso,
        last_sweep_at: nowIso,
        channels: {
          mail: readable.length, contacts: bookable.length, calendar: datable.length,
          degraded, failures: failures.slice(0, 6),
        },
        updated_at: nowIso,
      }, { onConflict: "user_id" });

      await sb.from("mesh_dossier_runs").insert({
        user_id: userId, phase: "sentinel", queued: rows.length,
        skipped: cold.skipped.length + cal.skipped.length + phone.skipped.length + book.skipped.length,
        stats: {
          inboundMessages: inbound.length, calendarPeople: calendar.length,
          contactsRead: contacts.length, sinceMs, degraded, failures, channels: {
            inbound_mail: cold.targets.length, calendar: cal.targets.length,
            phone_book: phone.targets.length, address_book: bookTargets.length,
          },
        },
        finished_at: nowIso,
      });


      return json({
        newSubjects: rows.map((r) => ({
          name: r.subject_name, email: r.subject_email, channel: r.channel, priority: r.priority,
        })),
        queued: rows.length,
        scanned: {
          inboundMessages: inbound.length, calendarPeople: calendar.length, contacts: contacts.length,
        },
        since: new Date(sinceMs).toISOString(),
        watermark: degraded ? (settings?.last_watermark ?? null) : nowIso,
        degraded,
        failures,
        skipped: [...cold.skipped, ...cal.skipped, ...phone.skipped, ...book.skipped].slice(0, 30),

      }, 200, cors);
    }



    // ── PROCESS ──────────────────────────────────────────────────────────
    if (action === "vault_process") {
      const batch = Math.min(Math.max(Number(body.batch) || 1, 1), 3);
      const { data: queue, error: qErr } = await sb.from("mesh_dossiers")
        .select("id, subject_key, subject_name, subject_email, hop, channel, relationship")
        .eq("user_id", userId).eq("status", "queued")
        .order("hop", { ascending: true })
        .order("priority", { ascending: false })
        .limit(batch);
      if (qErr) return json({ error: "queue_read_failed", message: qErr.message }, 500, cors);
      if (!queue?.length) {
        return json({ processed: [], remaining: 0, done: true, message: "Queue is empty." }, 200, cors);
      }

      const processed: unknown[] = [];
      let built = 0, failed = 0;

      for (const row of queue) {
        if (Date.now() - startedAt > RUN_BUDGET_MS - 15_000) break;
        await sb.from("mesh_dossiers").update({ status: "building" }).eq("id", row.id).eq("user_id", userId);
        try {
          const rel = (row.relationship ?? null) as any;
          // A contact card's own street address beats a global hint — it is
          // first-party data about this specific subject.
          const hint = String(rel?.locationHint || body.location_hint || "").slice(0, 80);
          // Hard identifiers seed a reverse lookup when the name sweep is thin.
          const identifiers: string[] = [
            ...(Array.isArray(rel?.identifiers) ? rel.identifiers : []),
            ...(Array.isArray(rel?.phones) ? rel.phones : []),
          ].map((s: unknown) => String(s)).filter(Boolean).slice(0, 2);
          const { doc, summary, confidence } = await withTimeout(
            buildDossier(row.subject_name, row.subject_email, rel && rel.email ? rel : null, {
              locationHint: hint,
              identifiers,
              channel: (row as any).channel ?? rel?.channel ?? rel?.source ?? null,
            }),
            PER_SUBJECT_MS,
          );


          await sb.from("mesh_dossiers").update({
            status: "ready", dossier: doc as unknown as Record<string, unknown>,
            summary, confidence, error_message: null, built_at: new Date().toISOString(),
          }).eq("id", row.id).eq("user_id", userId);

          if (row.hop === 1) await persistHopTwo(sb, userId, row.subject_name, doc);
          await announceDossier(userId, user.email ?? null, row.subject_name, row.subject_key, doc, summary, confidence);
          built++;
          processed.push({ id: row.id, name: row.subject_name, confidence, hop1: doc.hop1.length, hop2: doc.hop2.length, hop3: doc.hop3.length });
        } catch (e) {
          failed++;
          const msg = (e as Error).message.slice(0, 300);
          await sb.from("mesh_dossiers").update({ status: "failed", error_message: msg })
            .eq("id", row.id).eq("user_id", userId);
          processed.push({ id: row.id, name: row.subject_name, error: msg });
        }
      }

      const { count } = await sb.from("mesh_dossiers")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("status", "queued");

      await sb.from("mesh_dossier_runs").insert({
        user_id: userId, phase: "process", built, failed,
        stats: { elapsedMs: Date.now() - startedAt, batch },
        finished_at: new Date().toISOString(),
      });

      return json({ processed, built, failed, remaining: count ?? 0, done: (count ?? 0) === 0 }, 200, cors);
    }

    return json({ error: "unknown_action", action }, 400, cors);
  } catch (e) {
    console.error("mesh-vault failure", e);
    return json({ error: "internal_error", message: (e as Error).message }, 500, cors);
  }
});

/**
 * Persist hop-2 nodes as dormant stubs. They are knowledge, not sweeps —
 * a stub becomes a sweep only when the user promotes it, which keeps the
 * three-hop expansion bounded by human intent instead of by combinatorics.
 */
async function persistHopTwo(
  sb: ReturnType<typeof adminClient>,
  userId: string,
  parentName: string,
  doc: MeshDossierDoc,
): Promise<void> {
  const people = (doc.hop2 ?? []).filter((n) => n.kind === "person" && n.label && n.label.length > 4).slice(0, 12);
  if (!people.length) return;
  const parentKey = normKey(parentName);
  const rows = people
    .map((n) => ({
      user_id: userId,
      subject_key: `hop2:${normKey(n.label).toLowerCase()}`,
      subject_email: null,
      subject_name: n.label,
      hop: 2,
      via: n.via ?? parentName,
      status: "linked",
      relationship: { discoveredVia: parentName, kind: n.kind, confidence: n.confidence },
      priority: Math.min(60, n.independentDomains * 10),
      updated_at: new Date().toISOString(),
    }))
    .filter((r) => normKey(r.subject_name) !== parentKey);
  if (!rows.length) return;
  // ignoreDuplicates: a stub must never overwrite a dossier already built.
  await sb.from("mesh_dossiers").upsert(rows, { onConflict: "user_id,subject_key", ignoreDuplicates: true });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`sweep exceeded ${Math.round(ms / 1000)}s`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
