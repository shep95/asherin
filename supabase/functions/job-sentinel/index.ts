// ═══════════════════════════════════════════════════════════════════════════
// job-sentinel — fused local + web job discovery, and application dispatch
// ---------------------------------------------------------------------------
// FUSED SOURCING, two layers that fail independently:
//   Layer A — HYPERLOCAL. OpenStreetMap/Overpass returns the actual businesses
//     standing within the operator's radius. This is the only layer that can
//     surface a walkable employer who never posted to a job board.
//   Layer B — POSTED LISTINGS. Firecrawl search across the boards for the
//     operator's keywords scoped to their city.
//   Neither layer is allowed to take the turn down with it: each is wrapped in
//     allSettled with its own timeout, and a zero-result layer is reported as a
//     zero-result layer rather than an error.
//
// DISTANCE is computed, never asserted. Haversine against the operator's stored
// home point; anything without coordinates is marked unknown rather than guessed
// into the radius.
//
// APPLYING. Autonomous send requires BOTH the operator's autonomous switch AND
// a Google account carrying gmail.send. Without both, the application is written
// as a Gmail DRAFT and marked `prepared` — the operator's name never goes out
// under an authority the operator did not grant. Every dispatch is written to
// the agency audit trail BEFORE the side effect, so a failure mid-send still
// leaves a record.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { liveAccounts, hasScope, audit } from "../_shared/googleMesh.ts";

const json = (b: unknown, s: number, c: Record<string, string>) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...c, "Content-Type": "application/json" } });

const UA = "AsherinJobSentinel/1.0 (+https://asherin.com)";
const MILES_PER_METER = 0.000621371;

// ── Bounded fetch ──────────────────────────────────────────────────────────
async function timed(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try { return await fetch(url, { ...init, signal: ac.signal }); }
  finally { clearTimeout(t); }
}

function haversineMiles(a: [number, number], b: [number, number]): number {
  const R = 3958.8;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLng = (b[1] - a[1]) * Math.PI / 180;
  const la1 = a[0] * Math.PI / 180, la2 = b[0] * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 100) / 100;
}

// ── Geocoding (OpenStreetMap Nominatim) ────────────────────────────────────
async function geocode(q: string): Promise<{ lat: number; lng: number; label: string } | null> {
  try {
    const r = await timed(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": UA, Accept: "application/json" } },
      10_000,
    );
    if (!r.ok) return null;
    const j = await r.json();
    const hit = Array.isArray(j) ? j[0] : null;
    if (!hit) return null;
    const lat = Number(hit.lat), lng = Number(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, label: String(hit.display_name || q) };
  } catch { return null; }
}

// ── Layer A: hyperlocal employers standing inside the radius ───────────────
interface LocalEmployer { name: string; lat: number; lng: number; kind: string; website?: string }

async function overpassEmployers(lat: number, lng: number, radiusMiles: number): Promise<LocalEmployer[]> {
  const meters = Math.min(40_000, Math.round(radiusMiles / MILES_PER_METER));
  const q = `[out:json][timeout:25];
(
  nwr["name"]["shop"](around:${meters},${lat},${lng});
  nwr["name"]["office"](around:${meters},${lat},${lng});
  nwr["name"]["healthcare"](around:${meters},${lat},${lng});
  nwr["name"]["amenity"~"^(restaurant|cafe|fast_food|bar|pub|pharmacy|bank|clinic|hospital|doctors|dentist|school|college|library|childcare|veterinary|car_repair|fuel|cinema|theatre|gym)$"](around:${meters},${lat},${lng});
  nwr["name"]["leisure"~"^(fitness_centre|sports_centre)$"](around:${meters},${lat},${lng});
);
out center 250;`;
  try {
    const r = await timed("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
      body: `data=${encodeURIComponent(q)}`,
    }, 30_000);
    if (!r.ok) return [];
    const j = await r.json();
    const seen = new Set<string>();
    const out: LocalEmployer[] = [];
    for (const el of (j?.elements ?? []) as Array<Record<string, any>>) {
      const tags = el.tags ?? {};
      const name = String(tags.name || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      const eLat = Number(el.lat ?? el.center?.lat);
      const eLng = Number(el.lon ?? el.center?.lon);
      if (!Number.isFinite(eLat) || !Number.isFinite(eLng)) continue;
      seen.add(key);
      out.push({
        name, lat: eLat, lng: eLng,
        kind: String(tags.shop || tags.office || tags.healthcare || tags.amenity || tags.leisure || "business"),
        website: typeof tags.website === "string" ? tags.website : undefined,
      });
    }
    return out;
  } catch { return []; }
}

// ── Layer B: posted listings via Firecrawl search ──────────────────────────
interface WebHit { url: string; title: string; snippet: string }

async function firecrawlSearch(query: string, limit = 6): Promise<WebHit[]> {
  const key = Deno.env.get("FIRECRAWL_API_KEY");
  if (!key) return [];
  try {
    const r = await timed("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
    }, 20_000);
    if (!r.ok) return [];
    const j = await r.json();
    const items = (j?.data?.web ?? j?.web ?? j?.data ?? []) as Array<Record<string, any>>;
    return (Array.isArray(items) ? items : [])
      .filter((x) => typeof x?.url === "string")
      .map((x) => ({ url: String(x.url), title: String(x.title || ""), snippet: String(x.description || x.snippet || "") }));
  } catch { return []; }
}

const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/;

// ── Deterministic match scoring — no model call, no invented affinity ──────
const STOP = new Set(["the","and","for","with","from","that","this","your","you","are","our","will","have","has","was","were","job","jobs","hiring","apply","careers","position","role","full","part","time"]);

function tokens(s: string): string[] {
  return String(s || "").toLowerCase().match(/[a-z][a-z+#.]{2,}/g)?.filter((t) => !STOP.has(t)) ?? [];
}

function scoreLead(lead: { title: string; description?: string; distance?: number | null },
                   profile: { skills: string[]; titles: string[] },
                   radius: number): { score: number; reasons: string[] } {
  const hay = new Set(tokens(`${lead.title} ${lead.description || ""}`));
  const reasons: string[] = [];
  let score = 0;

  const skillHits = profile.skills.filter((s) => tokens(s).some((t) => hay.has(t)));
  if (skillHits.length) {
    score += Math.min(45, skillHits.length * 9);
    reasons.push(`Skill overlap: ${skillHits.slice(0, 6).join(", ")}`);
  }
  const titleHits = profile.titles.filter((t) => tokens(t).some((w) => hay.has(w)));
  if (titleHits.length) {
    score += Math.min(30, titleHits.length * 15);
    reasons.push(`Title match against prior role: ${titleHits.slice(0, 2).join(", ")}`);
  }
  if (typeof lead.distance === "number" && radius > 0) {
    const prox = Math.max(0, 1 - lead.distance / radius);
    score += Math.round(prox * 25);
    reasons.push(`${lead.distance} mi from your location`);
  }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

// ── Gmail dispatch (MIME with PDF attachment) ──────────────────────────────
function b64url(s: string): string {
  return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildMime(opts: { to: string; subject: string; body: string; pdfBase64?: string; pdfName?: string }): string {
  if (!opts.pdfBase64) {
    return [
      `To: ${opts.to}`, `Subject: ${opts.subject}`,
      'Content-Type: text/plain; charset="UTF-8"', "MIME-Version: 1.0", "", opts.body,
    ].join("\r\n");
  }
  const b = `asherin_${Date.now().toString(36)}`;
  return [
    `To: ${opts.to}`, `Subject: ${opts.subject}`, "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${b}"`, "",
    `--${b}`, 'Content-Type: text/plain; charset="UTF-8"', "", opts.body, "",
    `--${b}`, `Content-Type: application/pdf; name="${opts.pdfName || "resume.pdf"}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${opts.pdfName || "resume.pdf"}"`, "",
    opts.pdfBase64.replace(/(.{76})/g, "$1\r\n"), "",
    `--${b}--`, "",
  ].join("\r\n");
}

async function gmailDispatch(
  token: string, mode: "send" | "draft",
  opts: { to: string; subject: string; body: string; pdfBase64?: string; pdfName?: string },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const raw = b64url(buildMime(opts));
  const url = mode === "send"
    ? "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"
    : "https://gmail.googleapis.com/gmail/v1/users/me/drafts";
  const payload = mode === "send" ? { raw } : { message: { raw } };
  try {
    const r = await timed(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }, 30_000);
    const text = await r.text();
    if (!r.ok) return { ok: false, error: `[${r.status}] ${text.slice(0, 300)}` };
    let id = "";
    try { id = JSON.parse(text)?.id ?? ""; } catch { /* id is optional */ }
    return { ok: true, id };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
}

// ═══════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401, cors);

  const sb: SupabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
  const { data: ud } = await sb.auth.getUser(authHeader.slice(7));
  const user = ud?.user;
  if (!user) return json({ error: "unauthorized" }, 401, cors);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, cors); }
  const action = String(body.action || "");

  try {
    // ── GEOCODE ───────────────────────────────────────────────────────────
    if (action === "geocode") {
      const q = String(body.query || "").trim().slice(0, 200);
      if (q.length < 3) return json({ error: "query_too_short" }, 400, cors);
      const hit = await geocode(q);
      if (!hit) return json({ error: "not_found", message: "That address did not resolve to a point on the map." }, 404, cors);
      return json(hit, 200, cors);
    }

    // ── DISCOVER ──────────────────────────────────────────────────────────
    if (action === "discover") {
      const { data: settings } = await sb.from("job_sentinel_settings").select("*").eq("user_id", user.id).maybeSingle();
      if (!settings?.home_lat || !settings?.home_lng) {
        return json({ error: "no_location", message: "Set your home location first — nothing can be measured against an unknown point." }, 400, cors);
      }
      const home: [number, number] = [Number(settings.home_lat), Number(settings.home_lng)];
      const radius = Math.max(0.25, Math.min(50, Number(settings.radius_miles) || 5));
      const walkRadius = Math.max(0.1, Math.min(radius, Number(settings.walk_radius_miles) || 1));
      const keywords: string[] = Array.isArray(settings.keywords) ? settings.keywords.filter(Boolean).slice(0, 6) : [];

      // Profile for scoring comes from the active resume — facts, not guesses.
      const { data: resume } = await sb.from("user_resumes")
        .select("structured").eq("user_id", user.id).eq("is_active", true)
        .order("updated_at", { ascending: false }).limit(1).maybeSingle();
      const st = (resume?.structured ?? {}) as Record<string, any>;
      const profile = {
        skills: Array.isArray(st.skills) ? st.skills.map(String).slice(0, 40) : [],
        titles: Array.isArray(st.experience) ? st.experience.map((e: any) => String(e?.title || "")).filter(Boolean).slice(0, 8) : [],
      };
      const searchTerms = keywords.length ? keywords : profile.titles.slice(0, 3);
      const city = String(settings.home_label || "").split(",").slice(0, 2).join(",").trim();

      const [localRes, webRes] = await Promise.allSettled([
        overpassEmployers(home[0], home[1], radius),
        (async () => {
          if (!searchTerms.length) return [] as WebHit[];
          const queries = searchTerms.flatMap((t) => [
            `${t} jobs hiring near ${city}`,
            `"${t}" ${city} site:indeed.com OR site:linkedin.com/jobs OR site:ziprecruiter.com`,
          ]).slice(0, 6);
          const batches = await Promise.allSettled(queries.map((q) => firecrawlSearch(q, 6)));
          return batches.flatMap((b) => (b.status === "fulfilled" ? b.value : []));
        })(),
      ]);

      const localEmployers = localRes.status === "fulfilled" ? localRes.value : [];
      const webHits = webRes.status === "fulfilled" ? webRes.value : [];

      type Draft = {
        user_id: string; source: string; title: string; company: string | null; location: string | null;
        lat: number | null; lng: number | null; distance_miles: number | null; walkable: boolean;
        url: string | null; apply_email: string | null; description: string | null;
        match_score: number; match_reasons: unknown; status: string;
      };
      const drafts: Draft[] = [];

      for (const e of localEmployers) {
        const d = haversineMiles(home, [e.lat, e.lng]);
        if (d > radius) continue;
        const title = searchTerms[0] ? `${searchTerms[0]} — ${e.name}` : `Openings at ${e.name}`;
        const desc = `Local ${e.kind.replace(/_/g, " ")} inside your radius. Discovered from the OpenStreetMap business register, not from a posted listing — availability must be confirmed with the employer.`;
        const { score, reasons } = scoreLead({ title: `${e.name} ${e.kind}`, description: desc, distance: d }, profile, radius);
        drafts.push({
          user_id: user.id, source: "local", title, company: e.name, location: e.kind,
          lat: e.lat, lng: e.lng, distance_miles: d, walkable: d <= walkRadius,
          url: e.website ?? null, apply_email: null, description: desc,
          match_score: score, match_reasons: reasons, status: "new",
        });
      }

      for (const h of webHits) {
        const blob = `${h.title} ${h.snippet}`;
        const { score, reasons } = scoreLead({ title: h.title, description: h.snippet, distance: null }, profile, radius);
        drafts.push({
          user_id: user.id, source: "web", title: h.title.slice(0, 300) || "Posted opening",
          company: null, location: city || null, lat: null, lng: null,
          distance_miles: null, walkable: false, url: h.url,
          apply_email: blob.match(EMAIL_RE)?.[0] ?? null, description: h.snippet.slice(0, 2000),
          match_score: score, match_reasons: reasons, status: "new",
        });
      }

      drafts.sort((a, b) => b.match_score - a.match_score);
      const capped = drafts.slice(0, 120);

      let inserted = 0;
      if (capped.length) {
        // Dedupe index makes re-running the sweep idempotent rather than duplicative.
        const { data: rows } = await sb.from("job_leads")
          .upsert(capped, { onConflict: "user_id,md5(lower(coalesce(url, title || coalesce(company,''))))", ignoreDuplicates: true })
          .select("id");
        inserted = rows?.length ?? 0;
      }
      await sb.from("job_sentinel_settings").update({ last_run_at: new Date().toISOString() }).eq("user_id", user.id);

      return json({
        inserted,
        layers: {
          local: { found: localEmployers.length, kept: capped.filter((d) => d.source === "local").length, ok: localRes.status === "fulfilled" },
          web: { found: webHits.length, kept: capped.filter((d) => d.source === "web").length, ok: webRes.status === "fulfilled", configured: Boolean(Deno.env.get("FIRECRAWL_API_KEY")) },
        },
        walkable: capped.filter((d) => d.walkable).length,
        radiusMiles: radius,
      }, 200, cors);
    }

    // ── APPLY ─────────────────────────────────────────────────────────────
    if (action === "apply") {
      const leadId = String(body.leadId || "");
      const coverLetter = String(body.coverLetter || "").slice(0, 8000);
      const pdfBase64 = typeof body.pdfBase64 === "string" ? body.pdfBase64 : undefined;
      const resumeText = String(body.resumeText || "").slice(0, 20_000);
      const resumeId = typeof body.resumeId === "string" ? body.resumeId : null;

      const { data: lead } = await sb.from("job_leads").select("*").eq("id", leadId).maybeSingle();
      if (!lead) return json({ error: "lead_not_found" }, 404, cors);
      if (!coverLetter) return json({ error: "no_letter", message: "Tailor the application before dispatching it." }, 400, cors);

      const { data: settings } = await sb.from("job_sentinel_settings").select("autonomous").eq("user_id", user.id).maybeSingle();
      const autonomous = Boolean(settings?.autonomous);

      // No application email means there is nothing to dispatch to. Record the
      // package so the operator can carry it to the posting's own form.
      if (!lead.apply_email) {
        const { data: app } = await sb.from("job_applications").insert({
          user_id: user.id, lead_id: lead.id, resume_id: resumeId,
          tailored_resume: resumeText, cover_letter: coverLetter,
          method: "manual", status: "prepared",
          error: "This posting has no application address — it accepts submissions through its own web form.",
        }).select().single();
        await sb.from("job_leads").update({ status: "queued" }).eq("id", lead.id);
        return json({ application: app, dispatched: false, reason: "no_apply_email", url: lead.url }, 200, cors);
      }

      const accounts = await liveAccounts(sb, user.id);
      const sender = accounts.find((a) => hasScope(a, "https://www.googleapis.com/auth/gmail.send"))
        ?? accounts.find((a) => hasScope(a, "https://www.googleapis.com/auth/gmail.compose"));

      if (!sender) {
        const { data: app } = await sb.from("job_applications").insert({
          user_id: user.id, lead_id: lead.id, resume_id: resumeId,
          tailored_resume: resumeText, cover_letter: coverLetter,
          method: "manual", status: "prepared", sent_to: lead.apply_email,
          error: "No Google account with send or compose access is connected.",
        }).select().single();
        return json({ application: app, dispatched: false, reason: "no_google_send_scope" }, 200, cors);
      }

      const canSend = hasScope(sender, "https://www.googleapis.com/auth/gmail.send");
      const mode: "send" | "draft" = autonomous && canSend ? "send" : "draft";
      const subject = `Application — ${lead.title}${lead.company ? ` at ${lead.company}` : ""}`;

      // Audit BEFORE the side effect: a crash mid-send still leaves the trail.
      await audit(sb, user.id, {
        google_email: sender.google_email,
        action: mode === "send" ? "job_application_send" : "job_application_draft",
        target: lead.apply_email,
        payload: { lead_id: lead.id, title: lead.title, autonomous },
        confirmed: mode === "send",
      });

      const result = await gmailDispatch(sender.token, mode, {
        to: lead.apply_email, subject, body: coverLetter,
        pdfBase64, pdfName: "resume.pdf",
      });

      const { data: app } = await sb.from("job_applications").insert({
        user_id: user.id, lead_id: lead.id, resume_id: resumeId,
        tailored_resume: resumeText, cover_letter: coverLetter,
        method: mode === "send" ? "email" : "draft",
        sent_to: lead.apply_email,
        status: result.ok ? (mode === "send" ? "sent" : "drafted") : "failed",
        error: result.ok ? null : result.error,
      }).select().single();

      await sb.from("job_leads").update({ status: result.ok ? (mode === "send" ? "applied" : "queued") : "failed" }).eq("id", lead.id);

      return json({
        application: app,
        dispatched: result.ok && mode === "send",
        mode,
        reason: mode === "draft" ? (autonomous ? "compose_scope_only" : "autonomous_off") : undefined,
        error: result.ok ? undefined : result.error,
      }, result.ok ? 200 : 502, cors);
    }

    return json({ error: "unknown_action" }, 400, cors);
  } catch (e) {
    const msg = (e as Error)?.message || String(e);
    console.error(`[job-sentinel] ${action} failed:`, msg);
    return json({ error: "sentinel_failed", message: msg }, 500, cors);
  }
});
