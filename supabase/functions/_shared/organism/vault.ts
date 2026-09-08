// Vault access for server surfaces.
//
// Read path: pull the operator's vault + minted pattern library, open what is
// sealed with their own account key, and hand back a silent injection block.
// Write path: seal and upsert harvested entries, deduped by plaintext.
//
// Everything is scoped by user_id supplied by the CALLER'S verified session.
// No function in this file accepts a user id off the wire.

import { getAccountKey, sealText, openText, fingerprint } from "./vaultCrypto.ts";
import { buildOrganismInjection, type VaultBrief, type MintedPattern } from "./core.ts";

// deno-lint-ignore no-explicit-any
type Admin = any;

export interface VaultRow {
  id: string;
  facet: string;
  label: string;
  content: string;
  sensitive: boolean;
  encrypted: boolean;
  confidence: number;
  occurrences: number;
}

export interface LoadedVault {
  entries: VaultBrief[];
  patterns: MintedPattern[];
  /** Plaintext of every readable entry — the dedupe set for the harvest. */
  known: Set<string>;
  sealedUnreadable: number;
}

const MAX_ENTRIES = 120;
const MAX_PATTERNS = 24;

export async function loadVault(
  admin: Admin,
  userId: string,
  authHeader: string,
): Promise<LoadedVault> {
  const key = await getAccountKey(authHeader);

  const [{ data: rows }, { data: pats }] = await Promise.all([
    admin
      .from("organism_vault")
      .select("id,facet,label,content,sensitive,encrypted,confidence,occurrences")
      .eq("user_id", userId)
      .eq("enabled", true)
      .order("confidence", { ascending: false })
      .order("last_seen", { ascending: false })
      .limit(MAX_ENTRIES),
    admin
      .from("organism_patterns")
      .select("name,domain,trigger,procedure,potency")
      .eq("user_id", userId)
      .eq("active", true)
      .order("potency", { ascending: false })
      .limit(MAX_PATTERNS),
  ]);

  const entries: VaultBrief[] = [];
  const known = new Set<string>();
  let sealedUnreadable = 0;

  for (const r of (rows ?? []) as VaultRow[]) {
    const plain = await openText(String(r.content ?? ""), key);
    if (plain === null) {
      sealedUnreadable++;
      continue;
    }
    known.add(plain.trim().toLowerCase());
    entries.push({
      facet: r.facet,
      label: r.label ?? "",
      content: plain,
      confidence: Number(r.confidence ?? 0.6),
    });
  }

  const patterns: MintedPattern[] = ((pats ?? []) as MintedPattern[]).map((p) => ({
    name: String(p.name),
    domain: String(p.domain ?? "general"),
    trigger: String(p.trigger ?? ""),
    procedure: String(p.procedure ?? ""),
    potency: Number(p.potency ?? 0.5),
  }));

  return { entries, patterns, known, sealedUnreadable };
}

/** The silent block injected at the start of a session. */
export function vaultInjection(v: LoadedVault): string {
  return buildOrganismInjection(v.entries, v.patterns);
}

export interface HarvestEntry {
  facet: string;
  label: string;
  content: string;
  sensitive?: boolean;
  confidence?: number;
}

export interface WriteResult {
  written: number;
  merged: number;
  refused: number;
}

/**
 * Seals and stores harvested entries. When the account key is unavailable, a
 * sensitive entry is REFUSED rather than written in the clear — a vault that
 * quietly downgrades its own protection is worse than one that stays empty.
 */
export async function writeVault(
  admin: Admin,
  userId: string,
  authHeader: string,
  conversationId: string | null,
  items: HarvestEntry[],
  known: Set<string>,
): Promise<WriteResult> {
  const key = await getAccountKey(authHeader);
  const out: WriteResult = { written: 0, merged: 0, refused: 0 };
  const rows: Record<string, unknown>[] = [];
  const nowIso = new Date().toISOString();

  for (const it of items) {
    const content = String(it?.content ?? "").trim();
    if (!content || content.length > 600) continue;
    const norm = content.toLowerCase();
    if (known.has(norm)) {
      out.merged++;
      continue;
    }
    known.add(norm);
    const sensitive = Boolean(it.sensitive);
    if (sensitive && !key) {
      out.refused++;
      continue;
    }
    const fp = await fingerprint(userId, content);
    rows.push({
      user_id: userId,
      facet: it.facet,
      label: String(it.label ?? "").slice(0, 80),
      content: key ? await sealText(content, key) : content,
      fingerprint: fp,
      sensitive,
      encrypted: Boolean(key),
      confidence: Math.min(0.95, Math.max(0.3, Number(it.confidence ?? 0.6))),
      source: "harvest",
      conversation_id: conversationId,
      last_seen: nowIso,
    });
    if (rows.length >= 40) break;
  }

  if (rows.length) {
    const { data, error } = await admin
      .from("organism_vault")
      .upsert(rows, { onConflict: "user_id,fingerprint", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    out.written = data?.length ?? 0;
  }
  return out;
}

export interface MintInput {
  slug: string;
  name: string;
  domain: string;
  trigger: string;
  procedure: string;
  provenance?: Record<string, unknown>;
}

/** Adds newly minted patterns; a re-mint of an existing slug strengthens it. */
export async function mintPatterns(
  admin: Admin,
  userId: string,
  mints: MintInput[],
): Promise<number> {
  if (!mints.length) return 0;
  const { data: existing } = await admin
    .from("organism_patterns")
    .select("id,slug,potency,generation")
    .eq("user_id", userId);
  const bySlug = new Map<string, { id: string; potency: number; generation: number }>(
    ((existing ?? []) as { id: string; slug: string; potency: number; generation: number }[]).map(
      (p) => [p.slug, { id: p.id, potency: Number(p.potency), generation: Number(p.generation) }],
    ),
  );

  let minted = 0;
  const fresh: Record<string, unknown>[] = [];
  for (const m of mints.slice(0, 6)) {
    const slug = String(m.slug ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);
    const procedure = String(m.procedure ?? "").trim();
    if (!slug || procedure.length < 30) continue;

    const prior = bySlug.get(slug);
    if (prior) {
      // Re-observed structure: the pattern gets stronger and is refined, not
      // duplicated. This is how the library densifies instead of sprawling.
      await admin
        .from("organism_patterns")
        .update({
          procedure,
          trigger: String(m.trigger ?? "").slice(0, 300),
          potency: Math.min(0.98, prior.potency + 0.08),
          generation: prior.generation + 1,
          active: true,
        })
        .eq("id", prior.id);
      minted++;
      continue;
    }
    fresh.push({
      user_id: userId,
      slug,
      name: String(m.name ?? slug).slice(0, 120),
      domain: String(m.domain ?? "general").slice(0, 60),
      trigger: String(m.trigger ?? "").slice(0, 300),
      procedure: procedure.slice(0, 2000),
      provenance: m.provenance ?? {},
      potency: 0.5,
    });
  }

  if (fresh.length) {
    const { data, error } = await admin
      .from("organism_patterns")
      .upsert(fresh, { onConflict: "user_id,slug", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    minted += data?.length ?? 0;
  }
  return minted;
}

/** Growth ledger — what the operator sees when they ask how far it has come. */
export async function recordGrowth(
  admin: Admin,
  userId: string,
  note: string,
): Promise<void> {
  const [{ count: entries }, { count: patterns }, { data: prior }] = await Promise.all([
    admin.from("organism_vault").select("id", { count: "exact", head: true }).eq("user_id", userId),
    admin
      .from("organism_patterns")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("active", true),
    admin.from("organism_growth").select("sessions").eq("user_id", userId).maybeSingle(),
  ]);
  const sessions = Number(prior?.sessions ?? 0) + 1;
  const e = Number(entries ?? 0);
  const p = Number(patterns ?? 0);
  await admin.from("organism_growth").upsert(
    {
      user_id: userId,
      sessions,
      entries: e,
      patterns: p,
      density: sessions > 0 ? Number((p / sessions).toFixed(3)) : 0,
      last_grown_at: new Date().toISOString(),
      last_note: note.slice(0, 300),
    },
    { onConflict: "user_id" },
  );
}
