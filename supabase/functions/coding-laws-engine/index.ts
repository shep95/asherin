import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  try {
    const _b = await req.clone().json().catch(() => ({} as any));
    const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
    const _gate = await import('../_shared/adminGate.ts');
    await _gate.resolveKey(req, _byok);
  } catch (_e) {
    const _gate = await import('../_shared/adminGate.ts');
    return _gate.byokErrorResponse(_e, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("[CodingLawsEngine] Starting autonomous run...");

    // 1. Fetch all current active laws
    const { data: existingLaws, error: fetchError } = await supabase
      .from("coding_laws")
      .select("*")
      .eq("active", true)
      .order("created_at", { ascending: true });

    if (fetchError) throw fetchError;

    const lawsSummary = (existingLaws || [])
      .map((l: any) => `[${l.law_number}] ${l.name} (${l.domain}): ${l.law}`)
      .join("\n");

    const totalExisting = existingLaws?.length || 0;
    const nextNumber = totalExisting + 1;

    // 2. Phase 1: Discover historical coding laws not yet captured
    const discoveryPrompt = `You are AUREON's Coding Laws Engine — an autonomous intelligence that researches the entire history of software engineering to discover fundamental coding laws.

EXISTING LAWS (${totalExisting} total):
${lawsSummary}

CRITICAL CONSTRAINTS — ABSOLUTE:
1. **NO DUPLICATES**: Every new law MUST be semantically distinct from ALL existing laws above. If an existing law already covers the principle — even with different wording — DO NOT create it. Check meaning, not just words.
2. **NO CONTRADICTIONS**: Every new law MUST be logically compatible with ALL existing laws. If a new law would conflict with, negate, or undermine any existing law, DO NOT create it. If you find a genuine improvement, flag it as a "supersede" recommendation instead of creating a contradiction.
3. **VALIDATION STEP**: Before finalizing each law, explicitly verify:
   - "Does any existing law already say this?" → If yes, SKIP.
   - "Does this contradict any existing law?" → If yes, SKIP or flag.

YOUR MISSION — PHASE 1: HISTORICAL DISCOVERY
Search through the entire history of technology and software engineering to find 2-3 fundamental coding principles that are NOT already in the existing laws above. Look across:
- Ancient computing (1940s-1960s): Turing, von Neumann, early systems
- Systems programming (1970s-1980s): Unix philosophy, C conventions, networking protocols
- Object-oriented era (1990s): Liskov, SOLID, design patterns beyond GoF
- Web era (2000s): REST, eventual consistency, CAP theorem implications
- Modern era (2010s-2020s): Microservices, serverless, edge computing, WebAssembly
- AI/ML era (2020s-2026): LLM-driven development, prompt engineering as code, AI safety in code
- Quantum computing preparedness
- Blockchain/consensus algorithm principles

For each discovered law, provide:
- name: A clear "Law of X" title
- domain: The engineering domain
- law: The immutable principle (1-2 sentences, imperative voice)
- era: When this principle was established
- severity: "critical" | "standard" | "advisory"
- rationale: Why this law exists (historical evidence)

PHASE 2: CROSS-DOMAIN SYNTHESIS
Take 2-3 PAIRS of existing laws from DIFFERENT domains and synthesize them into NEW hybrid laws that address modern software challenges.

For each synthesized law, also provide parent_laws (the law numbers used to create it).

PHASE 3: CONTRADICTION & DUPLICATE AUDIT
Review ALL existing laws for:
- Any two laws that contradict each other → list them in "contradictions_found"
- Any two laws that are semantically redundant → list them in "duplicates_found"

Return JSON:
{
  "discovered_laws": [{ "name": "", "domain": "", "law": "", "era": "", "severity": "", "rationale": "", "duplicate_check": "Verified distinct from LAW-XXX, LAW-YYY", "contradiction_check": "Compatible with all existing laws" }],
  "synthesized_laws": [{ "name": "", "domain": "", "law": "", "era": "", "severity": "", "rationale": "", "parent_laws": ["LAW-001", "LAW-008"], "duplicate_check": "", "contradiction_check": "" }],
  "contradictions_found": [{ "law_a": "LAW-XXX", "law_b": "LAW-YYY", "explanation": "" }],
  "duplicates_found": [{ "law_a": "LAW-XXX", "law_b": "LAW-YYY", "explanation": "" }],
  "research_notes": "Brief summary of historical research performed"
}

IMPORTANT: Every law must be genuinely useful for code generation. No vague philosophy — concrete, enforceable engineering principles only. If you cannot find truly unique laws, return EMPTY arrays rather than creating duplicates.`;

    const aiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "You are the Coding Laws Engine. Return ONLY valid JSON. No markdown fences." }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: discoveryPrompt }],
            },
          ],
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[CodingLawsEngine] AI error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let rawContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Strip markdown fences if present
    rawContent = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let result: any;
    try {
      result = JSON.parse(rawContent);
    } catch (parseErr) {
      console.error("[CodingLawsEngine] Failed to parse AI response:", rawContent.slice(0, 500));
      throw new Error("Failed to parse AI response as JSON");
    }

    const discovered = result.discovered_laws || [];
    const synthesized = result.synthesized_laws || [];
    const contradictions = result.contradictions_found || [];
    const duplicatesFound = result.duplicates_found || [];
    let lawCounter = nextNumber;
    let lawsCreated = 0;
    let lawsSkipped = 0;

    // Server-side deduplication: word-overlap similarity check
    const existingLawTexts = (existingLaws || []).map((l: any) => ({
      name: l.name.toLowerCase(),
      law: l.law.toLowerCase(),
    }));

    const isDuplicate = (name: string, law: string): boolean => {
      const cName = name.toLowerCase();
      const cLaw = law.toLowerCase();
      return existingLawTexts.some((ex: any) => {
        const nWords = new Set(cName.split(/\s+/));
        const eNWords = new Set(ex.name.split(/\s+/));
        const nOverlap = [...nWords].filter((w: string) => eNWords.has(w)).length;
        const nScore = nOverlap / Math.max(nWords.size, eNWords.size);

        const lWords = new Set(cLaw.split(/\s+/));
        const eLWords = new Set(ex.law.split(/\s+/));
        const lOverlap = [...lWords].filter((w: string) => eLWords.has(w)).length;
        const lScore = lOverlap / Math.max(lWords.size, eLWords.size);

        return nScore > 0.7 || lScore > 0.6;
      });
    };

    // 3. Insert discovered laws (with dedup guard)
    for (const law of discovered) {
      if (isDuplicate(law.name, law.law)) {
        console.log(`[CodingLawsEngine] SKIPPED duplicate: ${law.name}`);
        lawsSkipped++;
        continue;
      }
      const lawNum = `LAW-${String(lawCounter).padStart(3, "0")}`;
      const { error: insertErr } = await supabase.from("coding_laws").insert({
        law_number: lawNum,
        name: law.name,
        domain: law.domain,
        law: law.law,
        era: law.era,
        severity: law.severity || "standard",
        rationale: law.rationale,
        source: "discovered",
        generation_method: "historical_research",
        active: true,
      });
      if (!insertErr) {
        lawCounter++;
        lawsCreated++;
        existingLawTexts.push({ name: law.name.toLowerCase(), law: law.law.toLowerCase() });
        console.log(`[CodingLawsEngine] Discovered: ${lawNum} — ${law.name}`);
      } else {
        console.error(`[CodingLawsEngine] Insert error for ${law.name}:`, insertErr.message);
      }
    }

    // 4. Insert synthesized laws (with dedup guard)
    for (const law of synthesized) {
      if (isDuplicate(law.name, law.law)) {
        console.log(`[CodingLawsEngine] SKIPPED duplicate synth: ${law.name}`);
        lawsSkipped++;
        continue;
      }
      const lawNum = `LAW-${String(lawCounter).padStart(3, "0")}`;
      const parentNumbers = law.parent_laws || [];
      let parentIds: string[] = [];
      if (parentNumbers.length > 0) {
        const { data: parents } = await supabase
          .from("coding_laws")
          .select("id")
          .in("law_number", parentNumbers);
        parentIds = (parents || []).map((p: any) => p.id);
      }
      const { error: insertErr } = await supabase.from("coding_laws").insert({
        law_number: lawNum,
        name: law.name,
        domain: law.domain,
        law: law.law,
        era: law.era || "2026 — Aureon Synthesis",
        severity: law.severity || "standard",
        rationale: law.rationale,
        source: "synthesized",
        generation_method: "cross_domain_fusion",
        parent_law_ids: parentIds,
        active: true,
      });
      if (!insertErr) {
        lawCounter++;
        lawsCreated++;
        existingLawTexts.push({ name: law.name.toLowerCase(), law: law.law.toLowerCase() });
        console.log(`[CodingLawsEngine] Synthesized: ${lawNum} — ${law.name}`);
      } else {
        console.error(`[CodingLawsEngine] Insert error for ${law.name}:`, insertErr.message);
      }
    }

    // 5. Log detected duplicates & contradictions (DO NOT auto-deactivate — log only for review)
    for (const dup of duplicatesFound) {
      console.log(`[CodingLawsEngine] AUDIT-DUPLICATE: ${dup.law_a} ↔ ${dup.law_b}: ${dup.explanation}`);
    }
    for (const c of contradictions) {
      console.log(`[CodingLawsEngine] AUDIT-CONTRADICTION: ${c.law_a} ↔ ${c.law_b}: ${c.explanation}`);
    }

    // 6. Log the engine run
    const { error: logErr } = await supabase.from("coding_laws_engine_runs").insert({
      run_type: "scheduled",
      laws_discovered: discovered.length,
      laws_cross_referenced: synthesized.length,
      laws_created: lawsCreated,
      status: "completed",
      details: {
        research_notes: result.research_notes || "",
        total_laws_after: lawCounter - 1,
        skipped_duplicates: lawsSkipped,
        contradictions_found: contradictions.length,
        existing_duplicates_deactivated: duplicatesFound.length,
      },
    });
    if (logErr) console.error("[CodingLawsEngine] Log error:", logErr.message);

    console.log(`[CodingLawsEngine] Run complete. Created ${lawsCreated}, skipped ${lawsSkipped} duplicates. Total: ${lawCounter - 1}`);

    return new Response(
      JSON.stringify({
        success: true,
        laws_discovered: discovered.length,
        laws_synthesized: synthesized.length,
        laws_created: lawsCreated,
        laws_skipped_duplicates: lawsSkipped,
        contradictions_found: contradictions.length,
        duplicates_deactivated: duplicatesFound.length,
        total_laws: lawCounter - 1,
        research_notes: result.research_notes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[CodingLawsEngine] Fatal error:", err);

    // Log failed run
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);
    await sb.from("coding_laws_engine_runs").insert({
      run_type: "scheduled",
      laws_discovered: 0,
      laws_cross_referenced: 0,
      laws_created: 0,
      status: "failed",
      details: { error: err instanceof Error ? err.message : "Unknown error" },
    });

    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
