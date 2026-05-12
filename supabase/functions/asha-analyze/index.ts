import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Robust CSV line parser that handles quoted fields with commas, newlines, and escaped quotes */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/** Parse CSV text into headers + rows using robust parser */
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ""));
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || "").replace(/^"|"$/g, "");
    });
    rows.push(row);
  }
  return { headers, rows };
}

/** Detect column type from sample values */
function detectColumnType(name: string, values: string[]): { type: string; role: string; isPII: boolean } {
  const isPII = /email|phone|ssn|address|name|first.?name|last.?name/i.test(name);

  if (isPII && /email/i.test(name)) return { type: "email", role: "pii", isPII: true };
  if (isPII && /phone/i.test(name)) return { type: "phone", role: "pii", isPII: true };
  if (isPII) return { type: "string", role: "pii", isPII: true };
  if (/^(id|_id|key)$/i.test(name) || name.toLowerCase().endsWith("_id")) return { type: "id", role: "primary_key", isPII: false };
  if (/date|time|created|updated|timestamp/i.test(name)) return { type: "date", role: "date_field", isPII: false };
  if (values.every(v => /^-?\d+(\.\d+)?$/.test(v))) {
    const type = values.some(v => v.includes(".")) ? "float" : "integer";
    return { type, role: "measure", isPII: false };
  }
  if (values.every(v => /^(true|false|0|1|yes|no)$/i.test(v))) return { type: "boolean", role: "dimension", isPII: false };
  if (/price|amount|cost|revenue|salary|total|budget/i.test(name)) return { type: "currency", role: "measure", isPII: false };
  if (/percent|pct|rate/i.test(name)) return { type: "percentage", role: "measure", isPII: false };
  if (/lat|lng|longitude|latitude/i.test(name)) return { type: "latlong", role: "dimension", isPII: false };
  if (/url|website|link|href/i.test(name)) return { type: "url", role: "auto", isPII: false };

  const uniqueCount = new Set(values).size;
  if (uniqueCount <= 20 && values.length > 20) return { type: "category", role: "dimension", isPII: false };

  return { type: "string", role: "auto", isPII: false };
}

/** Extract entity-like values from CSV data for populating Entities tab */
function extractEntitiesFromCSV(headers: string[], sampleRows: Record<string, string>[]): { entityType: string; entityValue: string; confidence: number; context: string }[] {
  const entities: { entityType: string; entityValue: string; confidence: number; context: string }[] = [];
  const seen = new Set<string>();

  for (const header of headers) {
    const lh = header.toLowerCase();
    let entityType = "";

    if (/^(name|first.?name|last.?name|full.?name|author|owner|manager|employee|contact|person)/i.test(lh)) entityType = "person";
    else if (/^(company|organization|org|employer|vendor|supplier|client|customer|brand)/i.test(lh)) entityType = "organization";
    else if (/^(city|state|country|region|address|location|zip|postal)/i.test(lh)) entityType = "location";
    else if (/^(email|e.?mail)/i.test(lh)) entityType = "email";
    else if (/^(phone|tel|mobile|fax)/i.test(lh)) entityType = "phone";
    else if (/^(url|website|link|domain)/i.test(lh)) entityType = "url";
    else if (/^(product|item|sku|model)/i.test(lh)) entityType = "product";
    else if (/^(date|created|updated|timestamp|deadline|due)/i.test(lh)) entityType = "date";
    else if (/^(amount|price|cost|revenue|salary|total|budget|value)/i.test(lh)) entityType = "amount";
    else if (/^(title|position|role|job)/i.test(lh)) entityType = "job_title";

    if (!entityType) continue;

    for (const row of sampleRows) {
      const val = row[header]?.trim();
      if (!val || val.length < 2 || val.length > 200) continue;

      const key = `${entityType}:${val.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);

      entities.push({
        entityType,
        entityValue: val,
        confidence: 0.85,
        context: `Extracted from column "${header}" in CSV data`,
      });

      if (entities.length >= 500) break;
    }
    if (entities.length >= 500) break;
  }

  return entities;
}

/** Locale-aware number parser */
function parseNumericValue(val: string): number | null {
  if (!val) return null;
  // Remove currency symbols
  let cleaned = val.replace(/[$€£¥₹,\s]/g, "");
  // Handle European format (1.234,56 -> 1234.56)
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseUser.auth.getUser(token);
    if (authErr || !user) throw new Error("Auth failed");

    const { datasetId } = await req.json();
    if (!datasetId) throw new Error("Missing datasetId");

    // Get the dataset record
    const { data: dataset, error: dsError } = await supabaseUser
      .from("asha_datasets")
      .select("*")
      .eq("id", datasetId)
      .eq("user_id", user.id)
      .single();

    if (dsError || !dataset) throw new Error("Dataset not found");

    // Download the file from storage
    const { data: fileData, error: dlError } = await supabaseUser
      .storage
      .from("asha-data")
      .download(dataset.storage_path);

    if (dlError || !fileData) throw new Error("Failed to download file");

    const text = await fileData.text();
    const ext = dataset.file_name.split(".").pop()?.toLowerCase();

    let schema: any[] = [];
    let rowCount = 0;
    let colCount = 0;
    let issues: any[] = [];
    let qualityScore = 85;
    let csvHeaders: string[] = [];
    let csvRows: Record<string, string>[] = [];

    if (ext === "csv") {
      const parsed = parseCSV(text);
      csvHeaders = parsed.headers;
      csvRows = parsed.rows;
      colCount = csvHeaders.length;
      rowCount = csvRows.length;

      // Sample rows for analysis
      const sampleRows = csvRows.slice(0, 100);

      schema = csvHeaders.map((name, idx) => {
        const values = sampleRows
          .map(row => row[name] || "")
          .filter(v => v !== "");

        const nullCount = sampleRows.length - values.length;
        const uniqueCount = new Set(values).size;
        const sampleValues = values.slice(0, 3);

        const { type, role, isPII } = detectColumnType(name, values);

        return { name, type, role, nullable: nullCount > 0, uniqueCount, nullCount, sampleValues, isPII };
      });

      // Detect issues
      const rowSet = new Set(sampleRows.map(r => JSON.stringify(r)));
      const dupCount = sampleRows.length - rowSet.size;
      if (dupCount > 0) {
        const estimated = Math.round(dupCount * (rowCount / sampleRows.length));
        issues.push({
          type: "duplicate",
          description: `~${estimated} potential duplicate rows detected`,
          rowCount: estimated,
          severity: estimated > rowCount * 0.05 ? "high" : "medium",
          autoFixAvailable: true,
        });
      }

      schema.forEach((col: any) => {
        if (col.nullCount > sampleRows.length * 0.1) {
          const estimated = Math.round(col.nullCount * (rowCount / sampleRows.length));
          issues.push({
            type: "null",
            description: `Missing values in [${col.name}] field`,
            rowCount: estimated,
            severity: estimated > rowCount * 0.2 ? "high" : "low",
            autoFixAvailable: true,
          });
        }
      });

      // Quality score
      const nullPenalty = schema.reduce((sum: number, col: any) => sum + (col.nullCount / Math.max(sampleRows.length, 1)), 0) / Math.max(colCount, 1);
      const dupPenalty = dupCount / Math.max(sampleRows.length, 1);
      qualityScore = Math.max(50, Math.round(100 - nullPenalty * 30 - dupPenalty * 20 - issues.length * 2));

    } else if (ext === "json" || ext === "jsonl") {
      try {
        let parsed;
        if (ext === "jsonl") {
          parsed = text.split("\n").filter((l: string) => l.trim()).map((l: string) => JSON.parse(l));
        } else {
          parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) parsed = [parsed];
        }
        rowCount = parsed.length;
        if (parsed.length > 0) {
          const keys = Object.keys(parsed[0]);
          colCount = keys.length;
          csvHeaders = keys;
          schema = keys.map((name: string) => {
            const values = parsed.slice(0, 100).map((r: any) => r[name]).filter((v: any) => v != null);
            const strValues = values.map(String);
            const { type, role, isPII } = detectColumnType(name, strValues);
            return {
              name,
              type,
              role,
              nullable: values.length < Math.min(100, parsed.length),
              uniqueCount: new Set(strValues).size,
              nullCount: Math.min(100, parsed.length) - values.length,
              sampleValues: strValues.slice(0, 3),
              isPII,
            };
          });
          // Build rows for entity extraction
          csvRows = parsed.slice(0, 200).map((r: any) => {
            const row: Record<string, string> = {};
            keys.forEach(k => { row[k] = r[k] != null ? String(r[k]) : ""; });
            return row;
          });
        }
        qualityScore = 90;
      } catch {
        schema = [{ name: "content", type: "freetext", role: "auto", nullable: false, uniqueCount: 0, nullCount: 0, sampleValues: [], isPII: false }];
        rowCount = 1;
        colCount = 1;
      }
    } else {
      schema = [{ name: "content", type: "freetext", role: "auto", nullable: false, uniqueCount: 0, nullCount: 0, sampleValues: [text.slice(0, 100)], isPII: false }];
      rowCount = text.split("\n").length;
      colCount = 1;
      qualityScore = 70;
    }

    // Update the dataset with analysis results
    const { error: updateError } = await supabaseUser
      .from("asha_datasets")
      .update({
        status: "ready",
        row_count: rowCount,
        col_count: colCount,
        quality_score: qualityScore,
        schema,
        issues,
      })
      .eq("id", datasetId);

    if (updateError) throw new Error("Failed to update dataset: " + updateError.message);

    // === AUTO-EXTRACT ENTITIES from CSV/JSON columns ===
    if (csvHeaders.length > 0 && csvRows.length > 0) {
      try {
        const extractedEntities = extractEntitiesFromCSV(csvHeaders, csvRows.slice(0, 200));
        if (extractedEntities.length > 0) {
          // We need to create an asha_document record to link entities to, or use a synthetic document
          // Actually, entities link to asha_documents. Let's create a virtual document for this dataset
          const { data: docRecord } = await supabaseAdmin
            .from("asha_documents")
            .insert({
              user_id: user.id,
              file_name: dataset.file_name,
              file_type: dataset.file_type,
              file_size: dataset.file_size,
              storage_path: dataset.storage_path,
              doc_type: "dataset",
              status: "ready",
              session_id: dataset.session_id,
              extracted_text: `Dataset with ${rowCount} rows and ${colCount} columns`,
              page_count: 1,
              summary: `Auto-analyzed dataset: ${csvHeaders.join(", ")}`,
              tags: ["auto-extracted", "dataset"],
            })
            .select("id")
            .single();

          if (docRecord) {
            // Batch insert entities
            const entityInserts = extractedEntities.map(e => ({
              user_id: user.id,
              document_id: docRecord.id,
              entity_type: e.entityType,
              entity_value: e.entityValue,
              confidence: e.confidence,
              context: e.context,
            }));

            // Insert in batches of 50
            for (let i = 0; i < entityInserts.length; i += 50) {
              const batch = entityInserts.slice(i, i + 50);
              await supabaseAdmin.from("asha_document_entities").insert(batch);
            }
            console.log(`Extracted ${extractedEntities.length} entities from ${dataset.file_name}`);
          }
        }
      } catch (entityErr) {
        console.error("Entity extraction error (non-fatal):", entityErr);
      }
    }

    // === GENERATE INSIGHTS using direct Gemini / BYOK ===
    if (rowCount > 0 && schema.length > 1) {
      try {
        const schemaDesc = schema.map((c: any) => `${c.name} (${c.type}, ${c.role})`).join(", ");
        const sampleData = (ext === "csv")
          ? text.split("\n").slice(0, 6).join("\n")
          : (() => { try { return JSON.stringify(JSON.parse(text).slice?.(0, 3) ?? text.slice(0, 500)); } catch { return text.slice(0, 500); } })();

        const { data: googleKeys } = await supabaseAdmin
          .from("user_api_keys")
          .select("api_key")
          .eq("user_id", user.id)
          .eq("provider", "google")
          .eq("is_active", true)
          .limit(1);

        const GEMINI_API_KEY = googleKeys?.[0]?.api_key || Deno.env.get("GEMINI_API_KEY_APP");

        let aiText = "";

        if (GEMINI_API_KEY) {
          const aiResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `You are Azplen, a data intelligence AI. Analyze this dataset and return exactly 3 insights as JSON array. Each insight has: type (trend|anomaly|relationship|correlation|gap|forecast), icon (emoji), title (short), description (1-2 sentences).

Dataset: ${dataset.file_name}
Schema: ${schemaDesc}
Rows: ${rowCount}
Sample data:
${sampleData}

Return ONLY a valid JSON array, no markdown.` }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 1000 },
            }),
          });

          if (aiResp.ok) {
            const aiData = await aiResp.json();
            aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          }
        }

        if (aiText) {
          // Clean markdown fences
          const cleaned = aiText.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
          const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const insights = JSON.parse(jsonMatch[0]);
            for (const insight of insights) {
              await supabaseAdmin.from("asha_insights").insert({
                user_id: user.id,
                dataset_id: datasetId,
                type: insight.type || "trend",
                icon: insight.icon || "📊",
                title: insight.title,
                description: insight.description,
              });
            }
            console.log(`Generated ${insights.length} insights for ${dataset.file_name}`);
          }
        }
      } catch (e) {
        console.error("Insight generation error:", e);
      }
    }

    return new Response(JSON.stringify({ success: true, rowCount, colCount, qualityScore, schema, issues }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("asha-analyze error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
