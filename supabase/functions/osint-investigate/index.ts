/**
 * osint-investigate — one research hop for an Asherin investigation.
 *
 * The hop is: retrieve real public sources -> classify their authority ->
 * extract candidate entities and claims -> persist everything with provenance.
 *
 * Honesty rules enforced here, not in the UI:
 *   · a claim is only written together with at least one evidence row that
 *     points at a real retrieved source. No source, no claim.
 *   · if the extraction model is not configured, sources are still stored and
 *     the hop reports `extraction: not_configured` — it does not invent claims.
 *   · if every retrieval provider is blocked, the hop finishes `unavailable`
 *     with the provider telemetry attached, never with placeholder findings.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";

interface ProviderReport {
  [id: string]: { status: "live" | "unavailable" | "not_configured" | "error"; detail?: string; checkedAt?: string };
}

const nowIso = () => new Date().toISOString();

// ── authority classification (mirrors src/lib/investigation/authority.ts) ────
const HOST_RULES: { test: RegExp; tier: number; type: string; reason: string }[] = [
  { test: /(^|\.)sec\.gov$/i, tier: 1, type: "official_filing", reason: "sec edgar — statutory filing" },
  {
    test: /(^|\.)companieshouse\.gov\.uk$|(^|\.)find-and-update\.company-information\.service\.gov\.uk$/i,
    tier: 1,
    type: "government_registry",
    reason: "companies house — statutory uk register",
  },
  { test: /(^|\.)courtlistener\.com$|(^|\.)pacer\.gov$|(^|\.)uscourts\.gov$/i, tier: 1, type: "court_record", reason: "court docket" },
  { test: /(^|\.)europa\.eu$/i, tier: 1, type: "regulatory", reason: "eu institutional publication" },
  { test: /\.gov$|\.gov\.[a-z]{2}$|\.mil$/i, tier: 1, type: "government_registry", reason: "government domain" },
  { test: /(^|\.)opencorporates\.com$/i, tier: 2, type: "government_registry", reason: "registry mirror, not the filing itself" },
  { test: /(^|\.)archive\.org$/i, tier: 2, type: "archive", reason: "archived capture" },
  { test: /\.edu$|(^|\.)doi\.org$|(^|\.)arxiv\.org$/i, tier: 2, type: "academic", reason: "academic publication" },
  { test: /(^|\.)wikipedia\.org$|(^|\.)wikidata\.org$/i, tier: 3, type: "encyclopedia", reason: "encyclopedia summary" },
  {
    test: /(^|\.)(reuters|apnews|bloomberg|ft|wsj|nytimes|bbc|theguardian|economist|cnbc|axios|politico)\.com$|(^|\.)bbc\.co\.uk$/i,
    tier: 3,
    type: "news",
    reason: "established newsroom",
  },
  { test: /(^|\.)(techcrunch|theverge|wired|arstechnica|crunchbase|pitchbook)\.com$/i, tier: 3, type: "trade_press", reason: "trade press" },
  { test: /(^|\.)(x|twitter|facebook|instagram|tiktok|linkedin|threads)\.com$/i, tier: 4, type: "social_media", reason: "self-published social account" },
  { test: /(^|\.)(reddit|quora|4chan)\.com$|news\.ycombinator\.com$/i, tier: 4, type: "forum", reason: "forum post" },
  { test: /(^|\.)(medium|substack|blogspot|wordpress|tumblr)\.com$/i, tier: 4, type: "blog", reason: "self-published blog" },
];

function classify(url: string): { tier: number; type: string; reason: string; host: string | null } {
  let host: string | null = null;
  try {
    host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    host = null;
  }
  if (!host) return { tier: 5, type: "unknown", reason: "no resolvable publisher", host };
  for (const r of HOST_RULES) if (r.test.test(host)) return { tier: r.tier, type: r.type, reason: r.reason, host };
  return { tier: 4, type: "web_page", reason: "general web page — publisher not independently established", host };
}

// ── extraction ──────────────────────────────────────────────────────────────
interface Extracted {
  entities: { kind: string; label: string; aliases?: string[]; identifiers?: { kind: string; value: string }[] }[];
  claims: {
    subject: string;
    predicate: string;
    object: string;
    statement: string;
    claimKind: string;
    validFrom?: string | null;
    volatility?: string;
    sourceUrls: string[];
    excerpt?: string;
  }[];
}

const EXTRACT_PROMPT = `You extract structured OSINT records from retrieved public web snippets.
Return STRICT JSON only: {"entities":[{"kind","label","aliases":[],"identifiers":[{"kind","value"}]}],
"claims":[{"subject","predicate","object","statement","claimKind","validFrom","volatility","sourceUrls":[],"excerpt"}]}

Rules you must obey:
- kind: person|company|organization|location|domain|role|event|other
- predicate: OWNS|WORKS_AT|FOUNDED|DIRECTOR_OF|PUBLISHED|MENTIONED_BY|LOCATED_AT|RELATED_TO|SUCCEEDED_BY|PRECEDED_BY
- claimKind: fact|observation|interpretation|hypothesis|inference|estimate|assumption
- volatility: static (never changes) | slow (changes over years) | volatile (leadership, ownership, employment)
- Every claim MUST list at least one sourceUrls entry taken verbatim from the provided snippets. Drop any claim you cannot cite.
- Never state a private home address, private phone number, private email or financial account data.
- Never infer criminality, dangerousness, health, religion, ethnicity, politics or any protected trait.
- If a snippet only hints at something, use claimKind "hypothesis", not "fact".
- Extract nothing rather than guessing. An empty array is a correct answer.`;

async function extract(question: string, snippets: string): Promise<{ data: Extracted | null; state: ProviderReport[string] }> {
  const key = Deno.env.get("GEMINI_API_KEY") || "";
  if (!key) {
    return {
      data: null,
      state: { status: "not_configured", detail: "GEMINI_API_KEY absent — sources stored, no claims extracted", checkedAt: nowIso() },
    };
  }
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: EXTRACT_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: `RESEARCH QUESTION: ${question}\n\nRETRIEVED SNIPPETS:\n${snippets}` }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) {
      return { data: null, state: { status: "error", detail: `extraction http ${res.status}`, checkedAt: nowIso() } };
    }
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") || "";
    const parsed = JSON.parse(text.replace(/^```json\s*|```$/g, "").trim());
    return {
      data: { entities: parsed.entities || [], claims: parsed.claims || [] },
      state: { status: "live", detail: "gemini-2.5-flash", checkedAt: nowIso() },
    };
  } catch (e) {
    return { data: null, state: { status: "error", detail: String((e as Error).message).slice(0, 160), checkedAt: nowIso() } };
  }
}

function canonicalize(kind: string, label: string): string {
  let t = String(label || "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9&.\s-]/g, " ").replace(/\s+/g, " ").trim();
  if (kind === "company" || kind === "organization") {
    t = t.replace(/[,\s](inc|inc\.|llc|ltd|ltd\.|limited|plc|corp|corp\.|corporation|co|co\.|gmbh|ag|holdings|group)$/g, "").trim();
  }
  return t;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { requireUser, authErrorResponse } = await import("../_shared/authMiddleware.ts");
  let user: { id: string };
  try {
    user = await requireUser(req) as { id: string };
  } catch (e) {
    return authErrorResponse(e, corsHeaders);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { investigationId, query, phase = "discover", objective, targetEntityId = null } = await req.json();
    if (!investigationId || !query) return reply({ error: "investigationId and query are required" }, 400);

    // Ownership check — RLS is bypassed by the service role, so verify by hand.
    const { data: inv } = await admin
      .from("osint_investigations")
      .select("id,user_id,question")
      .eq("id", investigationId)
      .maybeSingle();
    if (!inv || inv.user_id !== user.id) return reply({ error: "investigation not found" }, 404);

    const { count } = await admin
      .from("osint_hops")
      .select("id", { count: "exact", head: true })
      .eq("investigation_id", investigationId);

    const { data: hop } = await admin
      .from("osint_hops")
      .insert({
        user_id: user.id,
        investigation_id: investigationId,
        hop_number: (count ?? 0) + 1,
        phase,
        objective: objective || query,
        target_entity_id: targetEntityId,
        status: "running",
        started_at: nowIso(),
      })
      .select("id")
      .single();

    const providers: ProviderReport = {};

    // 1 — real retrieval
    const { runSurfaceWave } = await import("../_shared/surfaceRetrieval.ts");
    const wave = await runSurfaceWave(String(query), { limit: 12 });
    providers.surface_web = wave.liveProviders > 0
      ? { status: "live", detail: `${wave.liveProviders} provider(s), ${wave.hits.length} hits`, checkedAt: nowIso() }
      : {
          status: "unavailable",
          detail: `every surface provider returned nothing: ${wave.telemetry.map((t: any) => `${t.engine}:${t.reason || t.status || "empty"}`).join(", ")}`,
          checkedAt: nowIso(),
        };

    // 2 — corporate registry (fires only on a registry-shaped question)
    let registryHits: any[] = [];
    try {
      const { runBusinessRegistryPipeline } = await import("../_shared/businessRegistryIntel.ts");
      const reg = await runBusinessRegistryPipeline(String(query));
      registryHits = reg.hits || [];
      providers.corporate_registry = reg.fired
        ? registryHits.length
          ? { status: "live", detail: `sec edgar: ${registryHits.length} hit(s)`, checkedAt: nowIso() }
          : { status: "unavailable", detail: "registry queried, no matching filing", checkedAt: nowIso() }
        : { status: "not_configured", detail: "no registry-shaped intent in this query", checkedAt: nowIso() };
    } catch (e) {
      providers.corporate_registry = { status: "error", detail: String((e as Error).message).slice(0, 160), checkedAt: nowIso() };
    }

    // 3 — persist sources with authority (authority is never search rank)
    const sourceRows = [
      ...wave.hits.map((h: any, i: number) => {
        const c = classify(h.url);
        return {
          user_id: user.id,
          investigation_id: investigationId,
          url: h.url,
          title: (h.title || h.url).slice(0, 400),
          source_type: c.type,
          publisher: c.host,
          provider: h.engine,
          published_at: h.publishDate ? new Date(h.publishDate).toISOString() : null,
          retrieved_at: nowIso(),
          authority_tier: c.tier,
          authority_reason: c.reason,
          search_rank: i + 1,
          _snippet: h.snippet || "",
        };
      }),
      ...registryHits.map((h: any) => ({
        user_id: user.id,
        investigation_id: investigationId,
        url: h.url || null,
        title: (h.title || h.name || "registry filing").slice(0, 400),
        source_type: "official_filing",
        publisher: "sec.gov",
        provider: "sec_edgar",
        published_at: h.filedAt || h.date || null,
        retrieved_at: nowIso(),
        authority_tier: 1,
        authority_reason: "sec edgar — statutory filing",
        search_rank: null,
        _snippet: h.summary || h.snippet || JSON.stringify(h).slice(0, 500),
      })),
    ];

    const urlToSourceId = new Map<string, string>();
    let snippetBlock = "";
    if (sourceRows.length) {
      const inserts = sourceRows.map(({ _snippet, ...row }) => row);
      const { data: saved, error: srcErr } = await admin.from("osint_sources").insert(inserts).select("id,url");
      if (srcErr) throw srcErr;
      (saved ?? []).forEach((s: any) => { if (s.url) urlToSourceId.set(s.url, s.id); });
      snippetBlock = sourceRows
        .map((s) => `- [tier ${s.authority_tier}] ${s.title}\n  url: ${s.url}\n  snippet: ${String(s._snippet).slice(0, 500)}`)
        .join("\n");
    }

    if (!sourceRows.length) {
      await admin.from("osint_hops").update({
        status: "unavailable",
        finished_at: nowIso(),
        provider_state: providers,
        stats: { sources: 0, entities: 0, claims: 0 },
      }).eq("id", hop!.id);
      await admin.from("osint_investigations").update({ provider_state: providers, last_hop_at: nowIso(), updated_at: nowIso() })
        .eq("id", investigationId);
      return reply({ ok: false, reason: "no source could be retrieved for this hop", providers, hopId: hop?.id });
    }

    // 4 — extraction (skipped honestly when the model is not configured)
    const { data: ex, state: exState } = await extract(String(inv.question || query), snippetBlock);
    providers.extraction = exState;

    let entityCount = 0;
    let claimCount = 0;

    if (ex) {
      const { data: existing } = await admin
        .from("osint_entities").select("id,kind,canonical").eq("investigation_id", investigationId);
      const index = new Map<string, string>((existing ?? []).map((e: any) => [`${e.kind}::${e.canonical}`, e.id]));

      for (const ent of ex.entities.slice(0, 40)) {
        if (!ent?.label) continue;
        const canonical = canonicalize(ent.kind, ent.label);
        const key = `${ent.kind}::${canonical}`;
        if (!canonical || index.has(key)) continue;
        const { data: row } = await admin.from("osint_entities").insert({
          user_id: user.id,
          investigation_id: investigationId,
          kind: ent.kind || "other",
          label: ent.label.slice(0, 300),
          canonical,
          aliases: ent.aliases ?? [],
          // Extraction proposes; only a shared identifier or an operator resolves.
          resolution_state: "candidate",
          confidence: 0.4,
          origin: "public_record",
        }).select("id").single();
        if (row) {
          index.set(key, row.id);
          entityCount++;
          for (const id of (ent.identifiers ?? []).slice(0, 5)) {
            if (!id?.kind || !id?.value) continue;
            await admin.from("osint_identifiers").insert({
              user_id: user.id, investigation_id: investigationId, entity_id: row.id,
              kind: String(id.kind).toLowerCase(), value: String(id.value),
            });
          }
        }
      }

      for (const claim of ex.claims.slice(0, 40)) {
        const cited = (claim.sourceUrls || []).map((u) => urlToSourceId.get(u)).filter(Boolean) as string[];
        if (!cited.length) continue; // uncited claims are dropped, not stored as facts
        const subjectId = index.get(`company::${canonicalize("company", claim.subject)}`)
          ?? index.get(`person::${canonicalize("person", claim.subject)}`)
          ?? index.get(`organization::${canonicalize("organization", claim.subject)}`)
          ?? null;
        const { data: crow } = await admin.from("osint_claims").insert({
          user_id: user.id,
          investigation_id: investigationId,
          subject_entity_id: subjectId,
          predicate: claim.predicate || "RELATED_TO",
          object_value: claim.object ?? null,
          statement: (claim.statement || `${claim.subject} ${claim.predicate} ${claim.object}`).slice(0, 1000),
          claim_kind: claim.claimKind || "observation",
          // Status starts unresolved; confidence.ts promotes it from evidence.
          status: "unresolved",
          origin: "public_record",
          valid_from: claim.validFrom || null,
          volatility: claim.volatility || "slow",
          confidence: 0.3,
          confidence_reason: "awaiting authority assessment",
        }).select("id").single();
        if (!crow) continue;
        claimCount++;
        for (const sourceId of cited.slice(0, 6)) {
          const src = sourceRows.find((s) => urlToSourceId.get(String(s.url)) === sourceId);
          await admin.from("osint_evidence").insert({
            user_id: user.id,
            investigation_id: investigationId,
            claim_id: crow.id,
            source_id: sourceId,
            stance: "supports",
            excerpt: (claim.excerpt || src?._snippet || "").slice(0, 1000) || null,
            authority_tier: src?.authority_tier ?? 4,
            retrieved_at: nowIso(),
          });
        }
      }
    }

    await admin.from("osint_hops").update({
      status: "done",
      finished_at: nowIso(),
      provider_state: providers,
      stats: { sources: sourceRows.length, entities: entityCount, claims: claimCount },
    }).eq("id", hop!.id);

    await admin.from("osint_investigations").update({
      provider_state: providers,
      last_hop_at: nowIso(),
      updated_at: nowIso(),
    }).eq("id", investigationId);

    return reply({
      ok: true,
      hopId: hop?.id,
      providers,
      stats: { sources: sourceRows.length, entities: entityCount, claims: claimCount },
    });
  } catch (e) {
    console.error("osint-investigate error", e);
    return reply({ error: (e as Error).message || "hop failed" }, 500);
  }
});
