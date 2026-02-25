import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
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
Take 2-3 PAIRS of existing laws from DIFFERENT domains and synthesize them into NEW hybrid laws that address modern software challenges. For example:
- Security + Frontend Architecture = new law about client-side security boundaries
- Performance + Resilience = new law about adaptive load management
- API Engineering + AI/ML = new law about AI-safe API contracts

For each synthesized law, also provide parent_laws (the law numbers used to create it).

Return JSON:
{
  "discovered_laws": [{ "name": "", "domain": "", "law": "", "era": "", "severity": "", "rationale": "" }],
  "synthesized_laws": [{ "name": "", "domain": "", "law": "", "era": "", "severity": "", "rationale": "", "parent_laws": ["LAW-001", "LAW-008"] }],
  "research_notes": "Brief summary of historical research performed"
}

IMPORTANT: Every law must be genuinely useful for code generation. No vague philosophy — concrete, enforceable engineering principles only.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are the Coding Laws Engine. Return ONLY valid JSON. No markdown fences." },
          { role: "user", content: discoveryPrompt },
        ],
        temperature: 0.4,
        max_tokens: 4096,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[CodingLawsEngine] AI error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    let rawContent = aiData.choices?.[0]?.message?.content || "";
    
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
    let lawCounter = nextNumber;
    let lawsCreated = 0;

    // 3. Insert discovered laws
    for (const law of discovered) {
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
        console.log(`[CodingLawsEngine] Discovered: ${lawNum} — ${law.name}`);
      } else {
        console.error(`[CodingLawsEngine] Insert error for ${law.name}:`, insertErr.message);
      }
    }

    // 4. Insert synthesized (cross-domain) laws
    for (const law of synthesized) {
      const lawNum = `LAW-${String(lawCounter).padStart(3, "0")}`;
      
      // Resolve parent law UUIDs
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
        console.log(`[CodingLawsEngine] Synthesized: ${lawNum} — ${law.name}`);
      } else {
        console.error(`[CodingLawsEngine] Insert error for ${law.name}:`, insertErr.message);
      }
    }

    // 5. Log the engine run
    const { error: logErr } = await supabase.from("coding_laws_engine_runs").insert({
      run_type: "scheduled",
      laws_discovered: discovered.length,
      laws_cross_referenced: synthesized.length,
      laws_created: lawsCreated,
      status: "completed",
      details: {
        research_notes: result.research_notes || "",
        total_laws_after: lawCounter - 1,
      },
    });
    if (logErr) console.error("[CodingLawsEngine] Log error:", logErr.message);

    console.log(`[CodingLawsEngine] Run complete. Created ${lawsCreated} new laws. Total: ${lawCounter - 1}`);

    return new Response(
      JSON.stringify({
        success: true,
        laws_discovered: discovered.length,
        laws_synthesized: synthesized.length,
        laws_created: lawsCreated,
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
