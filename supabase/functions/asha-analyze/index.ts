import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { datasetId } = await req.json();
    if (!datasetId) throw new Error("Missing datasetId");

    // Get the dataset record
    const { data: dataset, error: dsError } = await supabase
      .from("asha_datasets")
      .select("*")
      .eq("id", datasetId)
      .eq("user_id", user.id)
      .single();

    if (dsError || !dataset) throw new Error("Dataset not found");

    // Download the file from storage
    const { data: fileData, error: dlError } = await supabase
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

    if (ext === "csv") {
      const lines = text.split("\n").filter((l: string) => l.trim());
      if (lines.length > 0) {
        const headers = lines[0].split(",").map((h: string) => h.trim().replace(/^"|"$/g, ""));
        colCount = headers.length;
        rowCount = lines.length - 1;

        // Sample rows for type detection
        const sampleRows = lines.slice(1, Math.min(101, lines.length));
        schema = headers.map((name: string, idx: number) => {
          const values = sampleRows.map((row: string) => {
            const cols = row.split(",");
            return (cols[idx] || "").trim().replace(/^"|"$/g, "");
          }).filter((v: string) => v !== "");

          const nullCount = sampleRows.length - values.length;
          const uniqueCount = new Set(values).size;
          const sampleValues = values.slice(0, 3);

          // Type detection
          let type = "string";
          let role = "auto";
          const isPII = /email|phone|ssn|address|name/i.test(name);
          
          if (isPII && /email/i.test(name)) { type = "email"; role = "pii"; }
          else if (isPII && /phone/i.test(name)) { type = "phone"; role = "pii"; }
          else if (isPII) { type = "string"; role = "pii"; }
          else if (/^(id|_id|key)$/i.test(name) || name.toLowerCase().endsWith("_id")) { type = "id"; role = "primary_key"; }
          else if (/date|time|created|updated/i.test(name)) { type = "date"; role = "date_field"; }
          else if (values.every((v: string) => /^-?\d+(\.\d+)?$/.test(v))) {
            type = values.some((v: string) => v.includes(".")) ? "float" : "integer";
            role = "measure";
          }
          else if (values.every((v: string) => /^(true|false|0|1|yes|no)$/i.test(v))) { type = "boolean"; role = "dimension"; }
          else if (uniqueCount <= 20 && values.length > 20) { type = "category"; role = "dimension"; }
          else if (/price|amount|cost|revenue|salary/i.test(name)) { type = "currency"; role = "measure"; }

          return { name, type, role, nullable: nullCount > 0, uniqueCount, nullCount, sampleValues, isPII };
        });

        // Detect issues
        // Check for duplicates (simple: check if any row appears more than once)
        const rowSet = new Set(sampleRows);
        const dupCount = sampleRows.length - rowSet.size;
        if (dupCount > 0) {
          const estimated = Math.round(dupCount * (rowCount / sampleRows.length));
          issues.push({ type: "duplicate", description: `~${estimated} potential duplicate rows detected`, rowCount: estimated, severity: estimated > rowCount * 0.05 ? "high" : "medium", autoFixAvailable: true });
        }

        // Check for null columns
        schema.forEach((col: any) => {
          if (col.nullCount > sampleRows.length * 0.1) {
            const estimated = Math.round(col.nullCount * (rowCount / sampleRows.length));
            issues.push({ type: "null", description: `Missing values in [${col.name}] field`, rowCount: estimated, severity: estimated > rowCount * 0.2 ? "high" : "low", autoFixAvailable: true });
          }
        });

        // Quality score calculation
        const nullPenalty = schema.reduce((sum: number, col: any) => sum + (col.nullCount / Math.max(sampleRows.length, 1)), 0) / Math.max(colCount, 1);
        const dupPenalty = dupCount / Math.max(sampleRows.length, 1);
        qualityScore = Math.max(50, Math.round(100 - nullPenalty * 30 - dupPenalty * 20 - issues.length * 2));
      }
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
          schema = keys.map((name: string) => {
            const values = parsed.slice(0, 100).map((r: any) => r[name]).filter((v: any) => v != null);
            const type = typeof parsed[0][name] === "number" ? "float" : typeof parsed[0][name] === "boolean" ? "boolean" : "string";
            return { name, type, role: "auto", nullable: values.length < Math.min(100, parsed.length), uniqueCount: new Set(values.map(String)).size, nullCount: Math.min(100, parsed.length) - values.length, sampleValues: values.slice(0, 3).map(String), isPII: /email|phone|name/i.test(name) };
          });
        }
        qualityScore = 90;
      } catch { 
        schema = [{ name: "content", type: "freetext", role: "auto", nullable: false, uniqueCount: 0, nullCount: 0, sampleValues: [], isPII: false }];
        rowCount = 1;
        colCount = 1;
      }
    } else {
      // For other file types, treat as freetext
      schema = [{ name: "content", type: "freetext", role: "auto", nullable: false, uniqueCount: 0, nullCount: 0, sampleValues: [text.slice(0, 100)], isPII: false }];
      rowCount = text.split("\n").length;
      colCount = 1;
      qualityScore = 70;
    }

    // Update the dataset with analysis results
    const { error: updateError } = await supabase
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

    // Generate insights using AI
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (GEMINI_API_KEY && rowCount > 0 && schema.length > 1) {
      try {
        const schemaDesc = schema.map((c: any) => `${c.name} (${c.type}, ${c.role})`).join(", ");
        const sampleData = ext === "csv" ? text.split("\n").slice(0, 6).join("\n") : JSON.stringify(JSON.parse(text).slice?.(0, 3) ?? text.slice(0, 500));

        const aiResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `You are Asha, a data intelligence AI. Analyze this dataset and return exactly 3 insights as JSON array. Each insight has: type (trend|anomaly|relationship|correlation|gap|forecast), icon (emoji), title (short), description (1-2 sentences).

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
          const aiText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          // Extract JSON from response
          const jsonMatch = aiText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            const insights = JSON.parse(jsonMatch[0]);
            for (const insight of insights) {
              await supabase.from("asha_insights").insert({
                user_id: user.id,
                dataset_id: datasetId,
                type: insight.type || "trend",
                icon: insight.icon || "📊",
                title: insight.title,
                description: insight.description,
              });
            }
          }
        }
      } catch (e) {
        console.error("Insight generation error:", e);
        // Non-fatal: dataset still analyzed successfully
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
