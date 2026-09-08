// ═══════════════════════════════════════════════════════════════════════════
// organism-grow — the compounding loop.
//
// Runs AFTER a turn, never during it. It reads what actually happened, writes
// what is durable into the operator's encrypted vault, and mints new
// domain-specific thinking patterns from the structure of how this particular
// person works. Nothing it learns is ever spoken back unprompted; the chat
// surface reads the vault silently on the next session.
//
// Key policy: staff run on the platform key, everyone else on their own BYOK,
// with the platform free-tier fallback the rest of the app already uses.
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { resolveKey } from "../_shared/adminGate.ts";
import { callByokJson, type ZophielByokConfig } from "../_shared/zophielByokRouter.ts";
import { loadVault, writeVault, mintPatterns, recordGrowth, type HarvestEntry } from "../_shared/organism/vault.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SRK = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

interface Turn { role: string; content: string }

const HARVEST_SYSTEM = `you are the harvest organ of a living per-user intelligence. you read one session between an operator and their assistant and return two things: durable vault entries about the operator, and newly minted thinking patterns forged from how this person actually works.

you never write conversational filler, never address anyone, and never explain yourself. you return strict json only.

VAULT ENTRIES — only durable things about the OPERATOR. mine the operator's messages; the assistant's replies are context only.
allowed facets:
  interest    — what they keep returning to
  thinking    — how they reason (decomposition style, evidence appetite, abstraction level)
  work        — what they are building, researching, running
  style       — how they want answers shaped (length, tone, format)
  preference  — standing rules they set
  correction  — something they pushed back on. record the corrected behaviour.
  emotion     — the register that lands with them
  expertise   — where they already have depth, so it is not over-explained
  goal        — what they are trying to reach
  secret      — something confidential they disclosed (mark sensitive true)
  context     — durable circumstance
never record: transient task content, code, one-off questions, assistant claims, speculation, anything you inferred rather than observed.
mark sensitive:true for health, finances, location, legal exposure, credentials, relationships, or anything that would hurt them if exposed.

MINTED PATTERNS — this is the part that makes the organism grow. a minted pattern is a reusable REASONING PROCEDURE tuned to this operator's domain and habits, written so a future session can execute it without the session that produced it. mint only when the session genuinely shows a repeatable structure. zero is a valid answer; a bad pattern is worse than none.
a pattern is NOT a fact, NOT a persona, NOT a summary. it is a procedure: what to do, in what order, and what to check.
procedure must be 2-6 imperative lines, concrete to the domain, and executable.

return strict json, no markdown fence:
{
  "entries": [ { "facet": "...", "label": "<=6 words", "content": "<=200 chars, third person, factual", "sensitive": false, "confidence": 0.3-0.95 } ],
  "patterns": [ { "slug": "kebab-case-id", "name": "short name", "domain": "the terrain it belongs to", "trigger": "when this pattern should fire", "procedure": "line one\\nline two\\nline three" } ],
  "note": "<=120 chars, what this session added"
}`;

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthenticated" }, 401);

    const anonSb = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
    const { data: authData } = await anonSb.auth.getUser(authHeader.slice(7));
    const user = authData?.user;
    if (!user) return json({ error: "unauthenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const turns: Turn[] = Array.isArray(body?.turns) ? body.turns.slice(-12) : [];
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
    const transcript = turns
      .map((t) => `${t.role === "assistant" ? "ASSISTANT" : "OPERATOR"}: ${String(t.content ?? "").slice(0, 4000)}`)
      .join("\n\n")
      .slice(0, 24_000);
    if (transcript.trim().length < 40) return json({ ok: true, skipped: "too_thin" });

    const admin = createClient(SUPABASE_URL, SRK, { auth: { persistSession: false } });

    // Key path: staff → platform key; everyone else → the key they saved, with
    // the platform free-tier fallback the rest of the app already uses. The
    // client never ships a raw key for this call.
    let stored: ZophielByokConfig | null = null;
    {
      const { data: keyRow } = await admin
        .from("user_api_keys")
        .select("provider, api_key, active_model")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (keyRow?.api_key && keyRow?.provider) {
        stored = {
          provider: String(keyRow.provider),
          model: String(keyRow.active_model || "gemini-flash-latest"),
          apiKey: String(keyRow.api_key),
        } as ZophielByokConfig;
      }
    }

    let cfg: ZophielByokConfig;
    try {
      const res = await resolveKey(req, stored);
      cfg = res.mode === "admin"
        ? { provider: "google", model: "gemini-flash-latest", apiKey: res.geminiKey! }
        : res.byok!;
    } catch {
      return json({ ok: false, error: "no_key" }, 200);
    }

    const prior = await loadVault(admin, user.id, authHeader);

    const knownLines = prior.entries.slice(0, 60).map((e) => `- [${e.facet}] ${e.content}`).join("\n");
    const knownPatterns = prior.patterns.map((p) => `- ${p.name} (${p.domain})`).join("\n");

    const userPrompt = `ALREADY IN THE VAULT — do not repeat any of these:
${knownLines || "(empty — this is the first session)"}

PATTERNS ALREADY MINTED — only re-emit a slug when this session genuinely REFINES it:
${knownPatterns || "(none yet)"}

SESSION TRANSCRIPT:
${transcript}`;

    let raw = "";
    try {
      raw = await callByokJson(cfg, HARVEST_SYSTEM, userPrompt, {
        temperature: 0.2,
        maxOutputTokens: 2048,
        timeoutMs: 45_000,
      });
    } catch (e) {
      console.error("[organism-grow] model call failed", e instanceof Error ? e.message : e);
      return json({ ok: false, error: "model_unavailable" }, 200);
    }

    let parsed: { entries?: HarvestEntry[]; patterns?: unknown[]; note?: string } = {};
    try {
      parsed = JSON.parse(String(raw).trim().replace(/^```json\s*|\s*```$/g, ""));
    } catch {
      return json({ ok: false, error: "unparseable" }, 200);
    }

    const ALLOWED = new Set([
      "interest", "thinking", "work", "style", "preference", "correction",
      "emotion", "expertise", "goal", "secret", "context",
    ]);
    const entries = (Array.isArray(parsed.entries) ? parsed.entries : [])
      .filter((e) => e && ALLOWED.has(String(e.facet)))
      .slice(0, 12);

    const written = await writeVault(admin, user.id, authHeader, conversationId, entries, prior.known);

    // deno-lint-ignore no-explicit-any
    const mints = (Array.isArray(parsed.patterns) ? parsed.patterns : []).map((p: any) => ({
      slug: String(p?.slug ?? ""),
      name: String(p?.name ?? ""),
      domain: String(p?.domain ?? "general"),
      trigger: String(p?.trigger ?? ""),
      procedure: String(p?.procedure ?? ""),
      provenance: { conversation_id: conversationId, at: new Date().toISOString() },
    }));
    const minted = await mintPatterns(admin, user.id, mints);

    await recordGrowth(admin, user.id, String(parsed.note ?? "").slice(0, 300));

    console.log(
      `[organism-grow] user=${user.id.slice(0, 8)} wrote=${written.written} merged=${written.merged} refused=${written.refused} minted=${minted}`,
    );
    return json({ ok: true, ...written, minted, sealedUnreadable: prior.sealedUnreadable });
  } catch (e) {
    console.error("[organism-grow] fatal", e instanceof Error ? e.message : String(e));
    return json({ error: "grow_failed" }, 500);
  }
});
