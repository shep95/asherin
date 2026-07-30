import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = false; }
      } else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(current.trim()); current = ""; }
      else { current += ch; }
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(text: string) {
  const lines = text.trim().split("\n");
  if (lines.length === 0) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, ""));
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || "").replace(/^"|"$/g, "");
    });
    rows.push(row);
  }
  return rows;
}

function executeSimpleQuery(rows: Record<string, string>[], content: string) {
  let result = rows;

  // Parse LIMIT
  const limitMatch = content.match(/LIMIT\s+(\d+)/i);
  const limit = limitMatch ? parseInt(limitMatch[1]) : 10;

  // Parse WHERE (simple equality)
  const whereMatch = content.match(/WHERE\s+(\w+)\s*=\s*['"]([^'"]+)['"]/i);
  if (whereMatch) {
    const [, col, val] = whereMatch;
    result = result.filter(r => r[col]?.toLowerCase() === val.toLowerCase());
  }

  // Parse ORDER BY
  const orderMatch = content.match(/ORDER\s+BY\s+(\w+)\s*(ASC|DESC)?/i);
  if (orderMatch) {
    const [, col, dir] = orderMatch;
    const desc = dir?.toUpperCase() === "DESC";
    result.sort((a, b) => {
      const aVal = parseFloat(a[col]) || a[col] || "";
      const bVal = parseFloat(b[col]) || b[col] || "";
      if (typeof aVal === "number" && typeof bVal === "number") return desc ? bVal - aVal : aVal - bVal;
      return desc ? String(bVal).localeCompare(String(aVal)) : String(aVal).localeCompare(String(bVal));
    });
  }

  // Parse SELECT columns
  const selectMatch = content.match(/SELECT\s+([\w\s,*]+)\s+FROM/i);
  if (selectMatch && selectMatch[1].trim() !== "*") {
    const cols = selectMatch[1].split(",").map(c => c.trim());
    result = result.map(r => {
      const filtered: Record<string, string> = {};
      cols.forEach(c => { if (r[c] !== undefined) filtered[c] = r[c]; });
      return filtered;
    });
  }

  // Parse COUNT(*)
  if (/SELECT\s+COUNT\s*\(\s*\*\s*\)/i.test(content)) {
    return [{ count: result.length.toString() }];
  }

  return result.slice(0, limit);
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !userData.user) throw new Error("Auth failed");

    const userId = userData.user.id;
    const { cellId, cellType, content, datasetId } = await req.json();
    let output = "";

    // Ownership check: caller must own the notebook that contains this cell
    if (cellId) {
      const { data: cellRow } = await supabase
        .from("notebook_cells")
        .select("notebook_id, notebooks!inner(owner_id)")
        .eq("id", cellId)
        .maybeSingle();
      // @ts-ignore — embedded relation
      const ownerId = cellRow?.notebooks?.owner_id;
      if (!cellRow || ownerId !== userId) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (cellType === "query" || cellType === "code") {
      if (datasetId) {
        // Try to load dataset and execute query against it — scoped to caller
        const { data: dataset } = await supabase
          .from("asha_datasets")
          .select("storage_path, file_name")
          .eq("id", datasetId)
          .eq("user_id", userId)
          .single();

        if (dataset) {
          const { data: file } = await supabase.storage
            .from("asha-data")
            .download(dataset.storage_path);

          if (file) {
            const csvText = await file.text();
            const rows = parseCSV(csvText);

            if (cellType === "query") {
              const result = executeSimpleQuery(rows, content);
              output = `-- Results from ${dataset.file_name} (${rows.length} total rows)\n\n${JSON.stringify(result, null, 2)}`;
            } else {
              // For code cells, provide data summary
              const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
              output = `# Data loaded: ${dataset.file_name}\n# Rows: ${rows.length}, Columns: ${headers.length}\n# Columns: ${headers.join(", ")}\n\n# Code execution sandbox coming soon.\n# For now, here's a data preview:\n${JSON.stringify(rows.slice(0, 5), null, 2)}`;
            }
          } else {
            output = "Error: Could not download dataset file.";
          }
        } else {
          output = "Error: Dataset not found.";
        }
      } else if (cellType === "query") {
        output = "-- No dataset selected. Use the dataset selector to connect a data source.";
      } else {
        output = "# Code execution sandbox coming soon.\n# Connect a dataset to analyze data.";
      }
    } else if (cellType === "visualization") {
      output = `Chart configuration parsed. Visualization rendering available in UI.\n\nConfig:\n${content}`;
    } else if (cellType === "text") {
      output = `[Processed at ${new Date().toISOString()}] — Text cell rendered.`;
    } else if (cellType === "data_source") {
      output = `[Data source connected at ${new Date().toISOString()}]`;
    } else {
      output = `[Executed at ${new Date().toISOString()}] — Cell type: ${cellType}`;
    }

    // Update cell output in DB
    await supabase
      .from("notebook_cells")
      .update({ output })
      .eq("id", cellId);

    return new Response(JSON.stringify({ output }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ output: `Error: ${msg}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
