import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  if (req.method !== 'OPTIONS') {
    try {
      const _b = await req.clone().json().catch(() => ({} as any));
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      await _gate.resolveKey(req, _byok);
    } catch (_e) {
      const _gate = await import('../_shared/adminGate.ts');
      return _gate.byokErrorResponse(_e, (globalThis as any).corsHeaders ?? { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' });
    }
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) throw new Error("Unauthorized");
    const userId = claimsData.claims.sub as string;

    const { sessionId, companyName, content: rawContent } = await req.json();
    if (!sessionId) throw new Error("Missing sessionId");

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY_APP not configured");

    // [Finding #8/#11] Sanitize and truncate input content to prevent OOM / token waste
    const MAX_INPUT_CHARS = 50000;
    const sanitizeContent = (text: string): string => {
      return text
        .replace(/<[^>]*>?/gm, "")    // Strip HTML
        .replace(/\s+/g, " ")          // Collapse whitespace
        .trim()
        .slice(0, MAX_INPUT_CHARS);
    };

    // Fetch all ready documents for this session
    const { data: documents } = await supabase
      .from("asha_documents")
      .select("id, file_name, extracted_text, doc_type, summary, metadata")
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .eq("status", "ready")
      .limit(50);

    if (!documents || documents.length === 0) {
      return new Response(JSON.stringify({ documents: 0, entities: 0, insights: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalEntities = 0;

    // Process documents in batches of 5
    for (let i = 0; i < documents.length; i += 5) {
      const batch = documents.slice(i, i + 5);

      // Check which docs already have entities
      const docIds = batch.map(d => d.id);
      const { data: existingEntities } = await supabase
        .from("asha_document_entities")
        .select("document_id")
        .in("document_id", docIds);

      const processedDocIds = new Set((existingEntities || []).map(e => e.document_id));
      const unprocessed = batch.filter(d => !processedDocIds.has(d.id));

      if (unprocessed.length === 0) continue;

      // Build combined text for batch extraction
      // [Finding #8/#11] Sanitize content before sending to LLM
      const combinedText = unprocessed.map(d =>
        `[DOCUMENT: ${d.file_name} | TYPE: ${d.doc_type} | ID: ${d.id}]\n${sanitizeContent(d.extracted_text?.slice(0, 3000) || d.summary || "")}\n---`
      ).join("\n\n");

      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Extract ALL entities from these ${unprocessed.length} documents. Return ONLY a JSON array.

${combinedText}

Return format:
[{
  "document_id": "the document ID from the header",
  "entity_type": "person|organization|location|amount|date|clause|product|regulation|case_reference|email|phone|url|job_title|contract_term",
  "entity_value": "exact extracted value",
  "entity_label": "human-readable label",
  "confidence": 0.0-1.0,
  "context": "surrounding text (max 80 chars)"
}]

RULES:
- Extract EVERY person name, organization, location, dollar amount, date, product, and regulation
- Include job titles with person names
- For legal docs: extract case numbers, statutes, judges
- For financial docs: extract all dollar amounts and percentages
- Minimum 5 entities per document, aim for 15+
- Return ONLY the JSON array, no markdown` }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8000 },
        }),
      });

      if (!resp.ok) continue;

      const data = await resp.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      // [Finding #3] Strip markdown fences and preamble before parsing
      const cleanedText = rawText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
      const match = cleanedText.match(/\[[\s\S]*\]/);
      if (!match) continue;

      try {
        const entities = JSON.parse(match[0]);
        const validEntities = entities.filter((e: any) =>
          e.document_id && e.entity_type && e.entity_value &&
          docIds.includes(e.document_id)
        );

        if (validEntities.length > 0) {
          const rows = validEntities.map((e: any) => ({
            user_id: userId,
            document_id: e.document_id,
            entity_type: e.entity_type || "unknown",
            entity_value: String(e.entity_value).slice(0, 2000),
            entity_label: String(e.entity_label || "").slice(0, 500),
            confidence: Math.min(Math.max(Number(e.confidence) || 0.5, 0), 1),
            context: String(e.context || "").slice(0, 500),
            page_number: null,
            metadata: {},
          }));

          await supabase.from("asha_document_entities").insert(rows);
          totalEntities += rows.length;
        }
      } catch (parseErr) {
        console.error("Entity parse error:", parseErr);
      }
    }

    // ---------- GENERATE INSIGHTS ----------
    let insightsGenerated = 0;
    try {
      const docSummaries = documents.map(d => `- ${d.file_name} (${d.doc_type}): ${d.summary || "No summary"}`).join("\n");

      // Fetch extracted entities for insight generation
      const allDocIds = documents.map(d => d.id);
      const { data: allEntities } = await supabase
        .from("asha_document_entities")
        .select("entity_type, entity_value, confidence, document_id")
        .in("document_id", allDocIds)
        .order("confidence", { ascending: false })
        .limit(200);

      const entitySummary = (allEntities || []).slice(0, 100).map(e =>
        `${e.entity_type}: ${e.entity_value} (${(e.confidence * 100).toFixed(0)}%)`
      ).join("\n");

      const insightResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Analyze these ${documents.length} documents about ${companyName || "the subject"} and generate 5-8 intelligence insights.

DOCUMENTS:
${docSummaries}

EXTRACTED ENTITIES:
${entitySummary}

Return ONLY a JSON array:
[{
  "title": "Concise insight title (max 60 chars)",
  "description": "2-3 sentence detailed insight with specific data points",
  "type": "trend|anomaly|correlation|risk|pattern|opportunity",
  "icon": "📈|📉|⚠️|🔗|🔍|💡|🔴|🟡"
}]

RULES:
- Each insight must reference specific entities/data from the documents
- Include dollar amounts, percentages, dates where applicable
- Mix of positive and negative findings
- Focus on actionable intelligence, not generic observations
- Flag contradictions between documents` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4000 },
        }),
      });

      if (insightResp.ok) {
        const insightData = await insightResp.json();
        const rawInsightText = insightData.candidates?.[0]?.content?.parts?.[0]?.text || "";
        // [Finding #3] Strip markdown fences from insight response too
        const cleanedInsightText = rawInsightText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const insightMatch = cleanedInsightText.match(/\[[\s\S]*\]/);

        if (insightMatch) {
          const insights = JSON.parse(insightMatch[0]);
          for (const insight of insights.slice(0, 8)) {
            await supabase.from("asha_insights").insert({
              user_id: userId,
              dataset_id: null,
              title: String(insight.title || "Insight").slice(0, 200),
              description: String(insight.description || "").slice(0, 2000),
              type: insight.type || "trend",
              icon: insight.icon || "📊",
            });
            insightsGenerated++;
          }
        }
      }
    } catch (insightErr) {
      console.error("Insight generation error:", insightErr);
    }

    // ---------- AUTO-LINK DOCUMENTS ----------
    try {
      for (let i = 0; i < documents.length; i++) {
        for (let j = i + 1; j < documents.length; j++) {
          const docA = documents[i];
          const docB = documents[j];

          // Check if they share entities
          const { data: sharedEntities } = await supabase
            .from("asha_document_entities")
            .select("entity_value")
            .eq("document_id", docA.id);

          const { data: entityB } = await supabase
            .from("asha_document_entities")
            .select("entity_value")
            .eq("document_id", docB.id);

          if (sharedEntities && entityB) {
            const valuesA = new Set(sharedEntities.map(e => e.entity_value.toLowerCase()));
            const overlap = entityB.filter(e => valuesA.has(e.entity_value.toLowerCase()));

            if (overlap.length >= 2) {
              // Check if link already exists
              const { data: existingLink } = await supabase
                .from("asha_document_links")
                .select("id")
                .or(`and(source_document_id.eq.${docA.id},target_document_id.eq.${docB.id}),and(source_document_id.eq.${docB.id},target_document_id.eq.${docA.id})`)
                .limit(1);

              if (!existingLink || existingLink.length === 0) {
                await supabase.from("asha_document_links").insert({
                  user_id: userId,
                  source_document_id: docA.id,
                  target_document_id: docB.id,
                  link_type: "shared_entities",
                  link_reason: `${overlap.length} shared entities: ${overlap.slice(0, 3).map(e => e.entity_value).join(", ")}`,
                  confidence: Math.min(overlap.length * 0.15, 0.95),
                });
              }
            }
          }
        }
      }
    } catch (linkErr) {
      console.error("Document linking error:", linkErr);
    }

    return new Response(JSON.stringify({
      documents: documents.length,
      entities: totalEntities,
      insights: insightsGenerated,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("asha-extract error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
