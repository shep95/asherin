// ═══════════════════════════════════════════════════════════════════════════
// CLOUD INTELLIGENCE MESH — CHAT BRIDGE
// ---------------------------------------------------------------------------
// The Mesh has two halves. googleMeshBridge.ts reads the user's LIVE Google
// surfaces (inbox, calendar, places). This bridge reads the other half: the
// VAULT — the persisted dossier ledger the Mesh Sentinel builds on every human
// who has ever corresponded with the operator, plus the device roster and the
// sentinel's own operating state.
//
// Design rules (all of these exist to prevent a specific failure):
//   • Never hijack an outward-facing turn. "Who is Marc Benioff" is a Zophiel
//     question. It becomes a Mesh question only when the operator names a
//     vault cue, or when the subject already exists in THEIR vault.
//   • Read through the caller's own JWT. RLS is the authorization boundary;
//     this file never touches the service role, so a forged user_id is inert.
//   • Confirmed and candidate facts stay in separate compartments, exactly as
//     the dossier engine wrote them. Candidates are never promoted by framing.
//   • One bounded on-demand build per turn, hard-capped, and only when the
//     operator explicitly asked for a dossier. A chat turn must never become
//     an unbounded collection job.
//   • Empty is a finding. If the vault has nothing, the model is told that in
//     words rather than being left to invent a background check.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Intent classification ──────────────────────────────────────────────────

const VAULT_CUES =
  /\b(dossier|dossiers|vault|background check|background on|intel on|intelligence on|profile on|who (is|are) (this|these) (person|people|contact)|contact intelligence|cloud intelligence mesh|mesh sentinel|sentinel)\b/i;
const CORRESPONDENT_CUES =
  /\b(emailed me|e-?mailed me|wrote to me|contacted me|reached out|messaged me|who has been emailing|my contacts?|correspondents?)\b/i;
const ROSTER_CUES =
  /\b(my dossiers|vault status|who('s| is| has) in my vault|mesh status|sentinel status|how many dossiers|vault queue)\b/i;
const DEVICE_CUES =
  /\b(my devices?|device mesh|which devices|devices? (are )?(connected|synced|on my)|sync(ed|ing)? across)\b/i;

const EMAIL_RE = /\b[\w.+-]+@[\w-]+\.[\w.-]{2,}\b/g;
/** Quoted or capitalised two-token names: "Tapasya Sharma", 'John Doe'. */
const QUOTED_NAME_RE = /["“']([A-Za-z][\w.'-]+(?:\s+[A-Za-z][\w.'-]+){0,3})["”']/g;
const PROPER_NAME_RE = /\b([A-Z][a-z]{1,20}\s+[A-Z][a-z]{1,20})\b/g;

/** A build is only ever attempted when the operator said so in the imperative. */
const BUILD_CUES =
  /\b(build|run|generate|create|pull|do)\s+(a\s+|an\s+|the\s+)?(deep\s+|full\s+)?(dossier|background|intel|intelligence|report|check)\b/i;

export interface VaultIntent {
  active: boolean;
  /** Explicit vault/dossier language was used. */
  explicit: boolean;
  /** Operator asked for the roster / sentinel state rather than one subject. */
  roster: boolean;
  /** Operator asked about their synced device fleet. */
  devices: boolean;
  /** Operator authorised an on-demand build this turn. */
  build: boolean;
  emails: string[];
  names: string[];
}

const STOP_NAMES = new Set([
  "Cloud Intelligence", "Intelligence Mesh", "Mesh Sentinel", "United States",
  "New York", "Los Angeles", "Asher Newton", "House Of",
]);

export function classifyVaultIntent(text: string): VaultIntent {
  const t = String(text ?? "").slice(0, 2000);
  const explicit = VAULT_CUES.test(t) || CORRESPONDENT_CUES.test(t);
  const roster = ROSTER_CUES.test(t) || (CORRESPONDENT_CUES.test(t) && !EMAIL_RE.test(t));
  const devices = DEVICE_CUES.test(t);

  // Fresh lastIndex on every call — a module-scope /g regex is stateful and a
  // shared one would silently skip every other match.
  const emails = Array.from(t.matchAll(new RegExp(EMAIL_RE.source, "gi")))
    .map((m) => m[0].toLowerCase());

  const names: string[] = [];
  for (const m of t.matchAll(new RegExp(QUOTED_NAME_RE.source, "g"))) names.push(m[1]);
  for (const m of t.matchAll(new RegExp(PROPER_NAME_RE.source, "g"))) names.push(m[1]);

  const cleanNames = Array.from(new Set(names))
    .filter((n) => !STOP_NAMES.has(n))
    .slice(0, 3);

  return {
    // `active` stays true even with no subject: a roster/device/vault question
    // is answerable on its own. Subject-less, cue-less turns return false and
    // the bridge costs nothing.
    active: explicit || roster || devices,
    explicit,
    roster,
    devices,
    build: BUILD_CUES.test(t) && (emails.length > 0 || cleanNames.length > 0),
    emails: Array.from(new Set(emails)).slice(0, 3),
    names: cleanNames,
  };
}

// ── Retrieval ──────────────────────────────────────────────────────────────

interface DossierRow {
  subject_name: string;
  subject_email: string | null;
  hop: number;
  via: string | null;
  status: string;
  summary: string | null;
  confidence: number;
  channel: string | null;
  source_account: string | null;
  built_at: string | null;
  dossier: Record<string, any>;
  relationship: Record<string, any>;
}

export interface VaultBundle {
  subjects: DossierRow[];
  roster: Array<{ name: string; email: string | null; hop: number; status: string; confidence: number; builtAt: string | null }>;
  counts: { ready: number; queued: number; building: number; failed: number; total: number };
  devices: Array<{ label: string; platform: string | null; lastSeen: string }>;
  settings: Record<string, any> | null;
  built: string[];
  /** Sweeps still running server-side when the chat budget expired. */
  inFlight: string[];
  notFound: string[];
  elapsedMs: number;
}

// The vault's own sweep ceiling is 115s; a chat turn cannot hold that long
// without breaching the edge limit, so the bridge waits 70s and then hands the
// job off. The mesh-vault invocation is a separate request and keeps running
// after this abort, so the dossier still lands — it is simply read next turn.
const BUILD_BUDGET_MS = 70_000;

async function fetchSubject(
  sb: SupabaseClient,
  needle: { email?: string; name?: string },
): Promise<DossierRow | null> {
  const cols =
    "subject_name, subject_email, hop, via, status, summary, confidence, channel, source_account, built_at, dossier, relationship";
  if (needle.email) {
    const { data } = await sb.from("mesh_dossiers").select(cols)
      .eq("subject_email", needle.email).limit(1).maybeSingle();
    if (data) return data as unknown as DossierRow;
  }
  if (needle.name) {
    const { data } = await sb.from("mesh_dossiers").select(cols)
      .ilike("subject_name", needle.name).limit(1).maybeSingle();
    if (data) return data as unknown as DossierRow;
  }
  return null;
}

export async function runVaultPull(
  authHeader: string,
  intent: VaultIntent,
): Promise<VaultBundle | null> {
  const started = Date.now();
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return null;
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user } } = await sb.auth.getUser(token);
    if (!user) return null;

    const bundle: VaultBundle = {
      subjects: [], roster: [], counts: { ready: 0, queued: 0, building: 0, failed: 0, total: 0 },
      devices: [], settings: null, built: [], inFlight: [], notFound: [], elapsedMs: 0,
    };

    // Named subjects first — this is the question that actually matters.
    const needles: Array<{ email?: string; name?: string }> = [
      ...intent.emails.map((email) => ({ email })),
      ...intent.names.map((name) => ({ name })),
    ];
    for (const n of needles.slice(0, 3)) {
      const row = await fetchSubject(sb, n);
      if (row) bundle.subjects.push(row);
      else bundle.notFound.push(n.email ?? n.name ?? "");
    }

    // Bounded on-demand build: only for an explicit build request, only for a
    // subject the vault has never seen, and only one per turn.
    if (intent.build && bundle.notFound.length && Date.now() - started < 20_000) {
      const target = bundle.notFound[0];
      const isEmail = target.includes("@");
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), BUILD_BUDGET_MS);
        const res = await fetch(`${url}/functions/v1/mesh-vault`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, apikey: anon, "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "vault_for_contact",
            email: isEmail ? target : undefined,
            name: isEmail ? target.split("@")[0] : target,
          }),
          signal: ctrl.signal,
        }).finally(() => clearTimeout(timer));
        if (res.ok) {
          const payload = await res.json();
          if (payload?.dossier) {
            bundle.built.push(target);
            bundle.notFound = bundle.notFound.filter((x) => x !== target);
            const row = await fetchSubject(sb, isEmail ? { email: target } : { name: target });
            if (row) bundle.subjects.push(row);
          }
        } else {
          console.error("[meshVaultBridge] build failed", res.status, (await res.text()).slice(0, 200));
        }
        // A 200 with status "building" means another sweep already owns this
        // subject — same handoff, not a miss.
        if (res.ok && !bundle.built.includes(target) && !bundle.inFlight.includes(target)) {
          bundle.inFlight.push(target);
          bundle.notFound = bundle.notFound.filter((x) => x !== target);
        }
      } catch (e) {
        // Abort is the expected outcome for a deep sweep, not a failure: the
        // collection continues server-side and the row flips to ready.
        bundle.inFlight.push(target);
        bundle.notFound = bundle.notFound.filter((x) => x !== target);
        console.error("[meshVaultBridge] build handed off:", (e as Error).message);
      }
    }

    if (intent.roster || intent.explicit) {
      const { data: rows } = await sb.from("mesh_dossiers")
        .select("subject_name, subject_email, hop, status, confidence, built_at")
        .order("confidence", { ascending: false }).limit(200);
      for (const r of rows ?? []) {
        bundle.counts.total++;
        const k = r.status as keyof VaultBundle["counts"];
        if (k in bundle.counts) (bundle.counts as any)[k]++;
      }
      bundle.roster = (rows ?? []).filter((r) => r.status === "ready").slice(0, 25).map((r) => ({
        name: r.subject_name, email: r.subject_email, hop: r.hop,
        status: r.status, confidence: Number(r.confidence ?? 0), builtAt: r.built_at,
      }));
      const { data: settings } = await sb.from("mesh_vault_settings").select("*").limit(1).maybeSingle();
      bundle.settings = settings ?? null;
    }

    if (intent.devices) {
      const { data: devs } = await sb.from("google_intel_devices")
        .select("label, platform, last_seen_at").order("last_seen_at", { ascending: false }).limit(20);
      bundle.devices = (devs ?? []).map((d) => ({
        label: d.label ?? "Unlabelled device", platform: d.platform, lastSeen: d.last_seen_at,
      }));
    }

    bundle.elapsedMs = Date.now() - started;
    const empty = !bundle.subjects.length && !bundle.roster.length && !bundle.devices.length
      && !bundle.notFound.length && !bundle.inFlight.length && !bundle.counts.total;
    return empty ? null : bundle;
  } catch (e) {
    console.error("[meshVaultBridge]", (e as Error).message);
    return null;
  }
}

// ── Rendering ──────────────────────────────────────────────────────────────

function factLines(map: Record<string, any[]> | undefined, cap = 4): string[] {
  const out: string[] = [];
  for (const [field, facts] of Object.entries(map ?? {})) {
    const vals = (facts ?? []).slice(0, cap)
      .map((f: any) => `${String(f.value).slice(0, 120)}${f.domain ? ` (${f.domain})` : ""}`);
    if (vals.length) out.push(`  - ${field}: ${vals.join(" | ")}`);
  }
  return out;
}

export function formatVaultContext(b: VaultBundle | null): string {
  if (!b) return "";
  const L: string[] = [
    "\n\n## CLOUD INTELLIGENCE MESH — VAULT (the operator's own dossier ledger)",
    `Read live from the Mesh vault through the operator's own credentials in ${b.elapsedMs}ms.`,
    "Rules: this is persisted, already-collected intelligence — answer directly from it and cite the source domain for every claim. CONFIRMED facts cleared strong identity matching; CANDIDATE facts did not and may belong to a different person of the same name — never state a candidate as fact. If a subject is absent below, say the vault has no dossier on them rather than improvising a background check.",
  ];

  for (const s of b.subjects) {
    const doc = s.dossier ?? {};
    const m = doc.metrics ?? {};
    L.push(
      `\n### SUBJECT — ${s.subject_name}${s.subject_email ? ` <${s.subject_email}>` : ""}`,
      `Hop ${s.hop}${s.via ? ` via ${s.via}` : ""} · status ${s.status} · confidence ${Math.round(Number(s.confidence ?? 0) * 100)}%` +
        `${s.built_at ? ` · built ${s.built_at.slice(0, 10)}` : ""}${s.channel ? ` · channel ${s.channel}` : ""}`,
    );
    if (s.summary) L.push(s.summary.slice(0, 900));
    const conf = factLines(doc.identity);
    if (conf.length) L.push("CONFIRMED IDENTITY FACTS:", ...conf);
    const cand = factLines(doc.candidates);
    if (cand.length) L.push("CANDIDATE VALUES (unverified — same-name collision possible):", ...cand);
    const hop1 = (doc.hop1 ?? []).slice(0, 10).map((n: any) => `${n.label}${n.kind ? ` [${n.kind}]` : ""}`);
    if (hop1.length) L.push(`ASSOCIATIONS (hop 1): ${hop1.join(", ")}`);
    const hop2 = (doc.hop2 ?? []).slice(0, 10).map((n: any) => n.label);
    if (hop2.length) L.push(`EXTENDED RING (hop 2): ${hop2.join(", ")}`);
    const src = (doc.sources ?? []).slice(0, 12).map((x: any) => `${x.domain}${x.url ? ` — ${x.url}` : ""}`);
    if (src.length) L.push(`SOURCE REGISTER (${(doc.sources ?? []).length} total): ${src.join(" ; ")}`);
    if (Object.keys(m).length) {
      L.push(`COLLECTION METRICS: ${m.documentsParsed ?? 0} documents parsed, ${m.independentDomains ?? 0} independent domains, ${m.authoritativeSources ?? 0} authoritative, ${m.rejectedIdentityHits ?? 0} hits rejected on identity.`);
    }
    if ((doc.gaps ?? []).length) L.push(`INTELLIGENCE GAPS: ${doc.gaps.slice(0, 6).join(" · ")}`);
  }

  if (b.inFlight.length) {
    L.push(
      `\n### SWEEP IN FLIGHT\nA full Mesh sweep on ${b.inFlight.join(", ")} was launched during this turn and is still collecting server-side. Tell the operator the dossier is building now and will be readable in about a minute by asking for that subject again — do NOT answer from general knowledge in the meantime.`,
    );
  }
  if (b.built.length) L.push(`\nBuilt on demand during this turn: ${b.built.join(", ")}.`);
  if (b.notFound.length) {
    L.push(
      `\n### VAULT MISS\nNo dossier exists for: ${b.notFound.join(", ")}. State this plainly and offer to run a Mesh sweep ("build a dossier on <address>") rather than answering from general knowledge.`,
    );
  }

  if (b.counts.total) {
    L.push(
      `\n### VAULT STATE\n${b.counts.total} tracked subject(s) — ${b.counts.ready} ready, ${b.counts.building} building, ${b.counts.queued} queued, ${b.counts.failed} failed.`,
    );
    if (b.settings) {
      L.push(`Sentinel: ${b.settings.enabled ? "ARMED" : "STOOD DOWN"}${b.settings.auto_hop2 ? " · hop-2 expansion on" : ""}${b.settings.last_sweep_at ? ` · last sweep ${String(b.settings.last_sweep_at).slice(0, 16)}` : ""}.`);
    }
  }
  if (b.roster.length) {
    L.push("ROSTER (highest-confidence ready dossiers):");
    L.push(b.roster.map((r) =>
      `- ${r.name}${r.email ? ` <${r.email}>` : ""} — hop ${r.hop}, ${Math.round(r.confidence * 100)}% confidence${r.builtAt ? `, built ${r.builtAt.slice(0, 10)}` : ""}`).join("\n"));
  }

  if (b.devices.length) {
    L.push("\n### DEVICE MESH");
    L.push(b.devices.map((d) =>
      `- ${d.label}${d.platform ? ` (${d.platform})` : ""} — last seen ${d.lastSeen.slice(0, 16).replace("T", " ")}Z`).join("\n"));
  }

  return L.join("\n");
}

// ═══════════════════════════════════════════════════════════════════════════
// VAULT PRIOR — the check that should happen before any fresh sweep
//
// The bridge above only fires on vault-SHAPED phrasing ("my vault", "who
// emailed me"). That left a hole big enough to drive a minute of latency
// through: a plain outward lookup — "who is Asher Shepherd Newton in Cape
// Coral" — never consulted the vault at all, so a subject the operator
// already has a finished, high-confidence dossier on was re-investigated
// from zero by two separate research engines.
//
// This is the cheap read that closes it: one indexed lookup by email or
// name, no sweep, no build, no network beyond the operator's own database,
// bounded so it can never itself become the thing that makes the turn slow.
// A hit short-circuits the expensive path; a miss costs single-digit
// milliseconds and changes nothing.
// ═══════════════════════════════════════════════════════════════════════════

export interface VaultPrior {
  subject: DossierRow;
  /** Confidence high enough to answer from without a fresh sweep. */
  authoritative: boolean;
  ageDays: number;
  elapsedMs: number;
}

/** Below this the dossier is a lead, not an answer — the sweep still runs. */
const PRIOR_CONFIDENCE_FLOOR = 0.7;
/** Past this the world has moved on; the dossier informs but does not replace. */
const PRIOR_MAX_AGE_DAYS = 45;
/** A prior lookup that cannot answer in this long is not worth waiting for. */
const PRIOR_BUDGET_MS = 2_500;

export async function lookupVaultPrior(
  authHeader: string | null,
  needle: { name?: string; email?: string },
): Promise<VaultPrior | null> {
  const started = Date.now();
  const name = String(needle.name ?? "").trim();
  const email = String(needle.email ?? "").trim().toLowerCase();
  if (!authHeader || (!name && !email)) return null;
  // A one-word "name" matches half the ledger; only a real subject qualifies.
  if (!email && name.split(/\s+/).length < 2) return null;

  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return null;
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const row = await Promise.race([
      fetchSubject(sb, { email: email || undefined, name: name || undefined }),
      new Promise<null>((r) => setTimeout(() => r(null), PRIOR_BUDGET_MS)),
    ]);
    if (!row) return null;
    if (String(row.status).toLowerCase() !== "ready") return null;

    const built = row.built_at ? new Date(row.built_at).getTime() : 0;
    const ageDays = built ? (Date.now() - built) / 86_400_000 : Number.POSITIVE_INFINITY;
    const confidence = Number(row.confidence ?? 0);

    return {
      subject: row,
      authoritative: confidence >= PRIOR_CONFIDENCE_FLOOR && ageDays <= PRIOR_MAX_AGE_DAYS,
      ageDays,
      elapsedMs: Date.now() - started,
    };
  } catch (_e) {
    // A prior is an optimisation. Its failure must never cost the turn.
    return null;
  }
}

/**
 * Render a prior for the prompt. `authoritative` decides the instruction the
 * model receives: answer from this, or treat it as a starting position that
 * the live sweep is expected to confirm or correct.
 */
export function formatVaultPriorContext(p: VaultPrior | null): string {
  if (!p) return "";
  const s = p.subject;
  const b: VaultBundle = {
    subjects: [s], roster: [], counts: { ready: 0, queued: 0, building: 0, failed: 0, total: 0 },
    devices: [], settings: null, built: [], inFlight: [], notFound: [], elapsedMs: p.elapsedMs,
  };
  const body = formatVaultContext(b);
  const age = Number.isFinite(p.ageDays) ? `${Math.round(p.ageDays)} day(s) old` : "age unknown";
  const head = p.authoritative
    ? `\n\n## KNOWN SUBJECT — ANSWER FROM THE VAULT\nThis person is already a resolved subject in the operator's own Cloud Intelligence vault at ${Math.round(Number(s.confidence ?? 0) * 100)}% confidence (${age}). No fresh sweep was run: re-investigating a subject you already hold is wasted time the operator pays for in latency. Answer from the dossier below, cite its sources, and state the build date so the operator can judge staleness. Offer a re-sweep only if they ask for something the dossier does not contain.`
    : `\n\n## KNOWN SUBJECT — VAULT PRIOR (not yet authoritative)\nThe vault already holds a dossier on this subject at ${Math.round(Number(s.confidence ?? 0) * 100)}% confidence (${age}) — below the bar to answer from alone, so live collection ran alongside it. Use this as the prior: where live evidence agrees, say so and raise confidence; where it disagrees, prefer the live source and say the vault is out of date.`;
  return `${head}\n${body}`;
}
