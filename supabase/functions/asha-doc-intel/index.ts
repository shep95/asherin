import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {

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

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error("Unauthorized");
    const userId = user.id;

    const body = await req.json();
    const { action } = body;

    if (action === "process") {
      return await processDocument(supabase, userId, body.documentId);
    } else if (action === "search") {
      return await searchDocuments(supabase, userId, body.query);
    } else {
      throw new Error("Invalid action");
    }
  } catch (e) {
    console.error("asha-doc-intel error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processDocument(supabase: any, userId: string, documentId: string) {
  if (!documentId) throw new Error("Missing documentId");

  const { data: doc, error: docErr } = await supabase
    .from("asha_documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (docErr || !doc) throw new Error("Document not found");

  await supabase.from("asha_documents").update({ status: "processing" }).eq("id", documentId);

  const { data: fileData, error: dlErr } = await supabase.storage.from("asha-data").download(doc.storage_path);
  if (dlErr || !fileData) {
    await supabase.from("asha_documents").update({ status: "error" }).eq("id", documentId);
    throw new Error("Failed to download file");
  }

  const text = await fileData.text();
  const truncatedText = text.slice(0, 30000);

  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY_APP not configured");

  const aiResp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `You are Azplen Document Intelligence, a forensic-grade document analysis engine. Analyze this document and extract ALL structured intelligence.

Return a JSON object with these fields:
{
  "doc_type": "contract|invoice|email|report|legal|medical|research|memo|other",
  "summary": "2-3 sentence executive summary",
  "language": "detected language code (en, es, fr, etc.)",
  "page_count_estimate": number,
  "entities": [
    {
      "entity_type": "party|date|amount|clause|obligation|vendor|person|organization|location|term|payment_term|deliverable|penalty|jurisdiction|invoice_number|line_item|sentiment|action_item|deadline|decision",
      "entity_value": "the extracted value",
      "entity_label": "human-readable label for this entity",
      "confidence": 0.0-1.0,
      "context": "surrounding text snippet (max 100 chars)",
      "page_number": null or estimated page number
    }
  ],
  "metadata": {
    "contract_type": "NDA|MSA|SOW|etc (if contract)",
    "effective_date": "if found",
    "termination_date": "if found",
    "total_value": "if found",
    "parties": ["list of parties"],
    "governing_law": "if found",
    "auto_renewal": true/false,
    "key_dates": [{"label": "...", "date": "..."}],
    "payment_schedule": "if found",
    "non_standard_clauses": ["list if found"]
  }
}

EXTRACTION RULES:
- Extract EVERY person name, organization, date, dollar amount, obligation, and clause
- For contracts: focus on parties, dates, financials, obligations, termination, governing law
- For invoices: focus on vendor, invoice number, line items, amounts, due dates
- For emails: focus on sender/recipients, sentiment, action items, deadlines, decisions
- For legal docs: focus on case references, statutes, parties, rulings
- Assign confidence scores honestly. Only use >0.9 for clearly stated facts.
- Return ONLY valid JSON. No markdown wrapping.

DOCUMENT TEXT:
${truncatedText}` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 8000 },
      }),
    }
  );

  if (!aiResp.ok) {
    const errText = await aiResp.text();
    console.error("Gemini API error:", aiResp.status, errText);
    await supabase.from("asha_documents").update({ status: "error" }).eq("id", documentId);
    throw new Error("AI extraction failed");
  }

  const aiData = await aiResp.json();
  const aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

  const jsonMatch = aiText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    await supabase.from("asha_documents").update({ status: "error" }).eq("id", documentId);
    throw new Error("Failed to parse AI response");
  }

  const extracted = JSON.parse(jsonMatch[0]);

  await supabase.from("asha_documents").update({
    status: "ready",
    doc_type: extracted.doc_type || "other",
    summary: extracted.summary || "",
    language: extracted.language || "en",
    page_count: extracted.page_count_estimate || 0,
    metadata: extracted.metadata || {},
    extracted_text: truncatedText.slice(0, 10000),
  }).eq("id", documentId);

  const entities = (extracted.entities || []).slice(0, 200);
  if (entities.length > 0) {
    const entityRows = entities.map((e: any) => ({
      user_id: userId,
      document_id: documentId,
      entity_type: e.entity_type || "unknown",
      entity_value: String(e.entity_value || "").slice(0, 2000),
      entity_label: String(e.entity_label || "").slice(0, 500),
      confidence: Math.min(Math.max(Number(e.confidence) || 0, 0), 1),
      context: String(e.context || "").slice(0, 500),
      page_number: e.page_number || null,
      metadata: {},
    }));

    await supabase.from("asha_document_entities").insert(entityRows);
  }

  const { data: existingDocs } = await supabase
    .from("asha_documents")
    .select("id, metadata, doc_type")
    .eq("user_id", userId)
    .eq("status", "ready")
    .neq("id", documentId)
    .limit(50);

  if (existingDocs && existingDocs.length > 0) {
    const docParties = (extracted.metadata?.parties || []).map((p: string) => p.toLowerCase());
    const links: any[] = [];

    for (const other of existingDocs) {
      const otherParties = (other.metadata?.parties || []).map((p: string) => p.toLowerCase());
      const overlap = docParties.filter((p: string) => otherParties.some((op: string) => op.includes(p) || p.includes(op)));
      if (overlap.length > 0) {
        links.push({
          user_id: userId,
          source_document_id: documentId,
          target_document_id: other.id,
          link_type: "related",
          link_reason: `Shared parties: ${overlap.join(", ")}`,
          confidence: Math.min(overlap.length * 0.3, 0.95),
        });
      }
    }

    if (links.length > 0) {
      await supabase.from("asha_document_links").insert(links);
    }
  }

  return new Response(JSON.stringify({
    success: true,
    doc_type: extracted.doc_type,
    summary: extracted.summary,
    entity_count: entities.length,
    metadata: extracted.metadata,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function searchDocuments(supabase: any, userId: string, query: string) {
  if (!query?.trim()) throw new Error("Missing query");

  const [{ data: docs }, { data: entities }] = await Promise.all([
    supabase.from("asha_documents").select("id, file_name, doc_type, summary, metadata, tags, created_at").eq("user_id", userId).eq("status", "ready").order("created_at", { ascending: false }).limit(100),
    supabase.from("asha_document_entities").select("document_id, entity_type, entity_value, entity_label, confidence").eq("user_id", userId).order("confidence", { ascending: false }).limit(500),
  ]);

  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY_APP not configured");

  const docIndex = (docs || []).map((d: any) => ({
    id: d.id,
    name: d.file_name,
    type: d.doc_type,
    summary: d.summary,
    metadata: d.metadata,
    date: d.created_at,
  }));

  const entityMap: Record<string, any[]> = {};
  for (const e of (entities || [])) {
    if (!entityMap[e.document_id]) entityMap[e.document_id] = [];
    entityMap[e.document_id].push(e);
  }

  const aiResp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `You are Azplen, a cross-document intelligence search engine. Search across the user's document corpus to answer their query.

DOCUMENT INDEX:
${JSON.stringify(docIndex, null, 1)}

ENTITY INDEX (by document):
${JSON.stringify(entityMap, null, 1)}

USER QUERY: "${query}"

INSTRUCTIONS:
- Search across ALL documents and entities to find relevant results
- Return structured results with document references
- Include confidence levels for each finding
- Cross-reference entities across documents
- Flag any contradictions between documents
- If the query asks about dates, amounts, or people — be specific with extracted values
- Think like a senior analyst at a top-tier intelligence firm

Return a JSON object:
{
  "answer": "Direct answer to the query in markdown format with headers and bullets",
  "matching_documents": [{"id": "doc_id", "name": "filename", "relevance": "high|medium|low", "reason": "why this doc matches"}],
  "matching_entities": [{"value": "...", "type": "...", "document": "filename", "confidence": 0.0-1.0}],
  "cross_references": ["any cross-document findings"],
  "gaps": ["what additional data would improve the answer"]
}

Return ONLY valid JSON.` }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 6000 },
      }),
    }
  );

  if (!aiResp.ok) {
    const errText = await aiResp.text();
    console.error("Gemini search error:", aiResp.status, errText);
    throw new Error("AI search failed");
  }

  const aiData = await aiResp.json();
  const aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
  const jsonMatch = aiText.match(/\{[\s\S]*\}/);

  if (!jsonMatch) throw new Error("Failed to parse search results");

  const results = JSON.parse(jsonMatch[0]);

  return new Response(JSON.stringify({ success: true, ...results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
