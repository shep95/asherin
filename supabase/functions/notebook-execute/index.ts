// Asherin Notebooks — cell execution.
//
// A cell run is: authenticate → prove ownership → resolve a source BY ID →
// run a bounded, read-only plan → scrub → persist a typed envelope.
//
// The caller never sends credentials or a connection string. Sources are
// dataset ids, library file ids, or allow-listed azplen table names, and every
// read is filtered to the caller's own rows before any query logic touches it.

import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  MAX_ROWS,
  clampTimeout,
  withTimeout,
  CellTimeout,
  parseCSV,
  runQuery,
  scrubRows,
  parseChartSpec,
  redact,
  type CellResult,
  type Row,
} from "../_shared/notebookEngine.ts";

/** Azplen surfaces a notebook may read. Everything is user-scoped on read. */
const AZPLEN_TABLES: Record<string, string> = {
  asha_datasets: "user_id",
  asha_documents: "user_id",
  asha_document_entities: "user_id",
  asha_insights: "user_id",
  asha_alerts: "user_id",
  asha_reports: "user_id",
  asha_queries: "user_id",
  asha_workflows: "user_id",
  asha_sessions: "user_id",
  asha_entity_matches: "user_id",
  asha_monitor_rules: "user_id",
};

interface SourceRef { kind: "dataset" | "library" | "azplen"; id: string }

function envelope(partial: Partial<CellResult>): CellResult {
  return {
    kind: "text",
    columns: [],
    rows: [],
    rowCount: 0,
    scanned: 0,
    truncated: false,
    elapsedMs: 0,
    source: null,
    chart: null,
    ...partial,
  };
}

async function loadSource(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  ref: SourceRef,
  signal: AbortSignal,
): Promise<{ rows: Record<string, unknown>[]; label: string }> {
  if (ref.kind === "dataset") {
    const { data: ds } = await supabase
      .from("asha_datasets")
      .select("storage_path, file_name")
      .eq("id", ref.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!ds) throw new Error("Dataset not found for this account.");
    const { data: file, error } = await supabase.storage.from("asha-data").download(ds.storage_path as string);
    if (error || !file) throw new Error("Dataset file could not be read.");
    if (signal.aborted) throw new CellTimeout(0);
    return { rows: parseCSV(await file.text()), label: `dataset:${ds.file_name}` };
  }

  if (ref.kind === "library") {
    const { data: lf } = await supabase
      .from("library_files")
      .select("storage_path, file_name, file_type, extracted_text")
      .eq("id", ref.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!lf) throw new Error("Library file not found for this account.");
    const name = String(lf.file_name ?? "file");
    const isCsv = /\.csv$/i.test(name) || String(lf.file_type ?? "").includes("csv");
    if (!isCsv) throw new Error(`"${name}" is not tabular. Notebooks read CSV library files; use Library search for documents.`);
    const { data: file, error } = await supabase.storage.from("library").download(lf.storage_path as string);
    if (error || !file) throw new Error("Library file could not be read.");
    if (signal.aborted) throw new CellTimeout(0);
    return { rows: parseCSV(await file.text()), label: `library:${name}` };
  }

  const scopeCol = AZPLEN_TABLES[ref.id];
  if (!scopeCol) throw new Error(`Table "${ref.id}" is not exposed to notebooks.`);
  const { data, error } = await supabase
    .from(ref.id)
    .select("*")
    .eq(scopeCol, userId)
    .limit(MAX_ROWS * 4);
  if (error) throw new Error(`Azplen read failed: ${error.message}`);
  return { rows: (data ?? []) as Record<string, unknown>[], label: `azplen:${ref.id}` };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const started = Date.now();
  let cellId: string | undefined;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const { data: userData, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !userData.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    cellId = typeof body.cellId === "string" ? body.cellId : undefined;
    const cellType = String(body.cellType ?? "text");
    const content = String(body.content ?? "");
    const timeoutMs = clampTimeout(body.timeoutMs);

    let source: SourceRef | null = null;
    if (body.source && typeof body.source === "object" && body.source.kind && body.source.id) {
      const kind = String(body.source.kind);
      if (kind === "dataset" || kind === "library" || kind === "azplen") {
        source = { kind, id: String(body.source.id).slice(0, 128) };
      }
    } else if (typeof body.datasetId === "string" && body.datasetId) {
      source = { kind: "dataset", id: body.datasetId };
    }

    if (!cellId) return json({ error: "cellId required" }, 400);

    // Ownership: the caller must own the notebook holding this cell.
    const { data: cellRow } = await supabase
      .from("notebook_cells")
      .select("notebook_id, notebooks!inner(owner_id)")
      .eq("id", cellId)
      .maybeSingle();
    // deno-lint-ignore no-explicit-any
    const ownerId = (cellRow as any)?.notebooks?.owner_id;
    if (!cellRow || ownerId !== userId) return json({ error: "Forbidden" }, 403);

    let result: CellResult;

    try {
      result = await withTimeout(timeoutMs, async (signal): Promise<CellResult> => {
        // Markdown / notes — rendered client-side, nothing to compute.
        if (cellType === "text" || cellType === "markdown") {
          return envelope({ kind: "text", text: "" });
        }

        if (cellType === "data_source") {
          if (!source) return envelope({ kind: "text", text: "No source bound." });
          const { rows, label } = await loadSource(supabase, userId, source, signal);
          const preview = scrubRows(rows.slice(0, 10));
          return envelope({
            kind: "table",
            columns: preview.columns,
            rows: preview.rows,
            rowCount: preview.rows.length,
            scanned: rows.length,
            truncated: rows.length > 10,
            source: label,
          });
        }

        if (cellType === "query" || cellType === "sql" || cellType === "code") {
          if (!source) throw new Error("Bind a source (dataset, library CSV, or azplen table) before running this cell.");
          const { rows, label } = await loadSource(supabase, userId, source, signal);
          const sql = /^\s*select\b/i.test(content) ? content : `SELECT * FROM data LIMIT 25`;
          const out = runQuery(rows, sql);
          return envelope({
            kind: "table",
            columns: out.columns,
            rows: out.rows,
            rowCount: out.rows.length,
            scanned: out.scanned,
            truncated: out.truncated,
            source: label,
          });
        }

        if (cellType === "visualization" || cellType === "chart") {
          const spec = parseChartSpec(content);
          if (!source) throw new Error("Bind a source before rendering a chart.");
          const { rows, label } = await loadSource(supabase, userId, source, signal);
          const out = runQuery(rows, spec.query && /^\s*select\b/i.test(spec.query) ? spec.query : "SELECT *");
          const missing = [spec.x, ...spec.y].filter((c) => !out.columns.includes(c));
          if (missing.length > 0) {
            throw new Error(`Column(s) not in result: ${missing.join(", ")}. Available: ${out.columns.join(", ") || "none"}`);
          }
          const points: Row[] = out.rows.slice(0, 200).map((r) => {
            const p: Row = { [spec.x]: r[spec.x] };
            for (const y of spec.y) {
              const raw = r[y];
              const n = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/[$,%\s,]/g, ""));
              p[y] = Number.isFinite(n) ? n : 0;
            }
            return p;
          });
          return envelope({
            kind: "table",
            columns: [spec.x, ...spec.y],
            rows: points,
            rowCount: points.length,
            scanned: out.scanned,
            truncated: out.rows.length > points.length || out.truncated,
            source: label,
            chart: { type: spec.type, x: spec.x, y: spec.y, title: spec.title },
          });
        }

        return envelope({ kind: "text", text: `Cell type "${cellType}" has no runner.` });
      });
    } catch (err) {
      const timedOut = err instanceof CellTimeout;
      result = envelope({
        kind: "error",
        text: redact(err instanceof Error ? err.message : String(err)),
        source: source ? `${source.kind}:${source.id}` : null,
        meta: undefined,
        // a timeout must read as a timeout, not a generic failure
        ...(timedOut ? { text: `Timed out after ${timeoutMs}ms — narrow the query or reduce the row count.` } : {}),
      } as Partial<CellResult>);
    }

    result.elapsedMs = Date.now() - started;

    // Persist the envelope. Output is JSON so the UI renders tables/charts
    // instead of re-parsing prose.
    await supabase.from("notebook_cells").update({ output: JSON.stringify(result) }).eq("id", cellId);

    return json({ result, output: JSON.stringify(result) }, result.kind === "error" ? 200 : 200);
  } catch (error) {
    const msg = redact(error instanceof Error ? error.message : String(error));
    return json({ result: envelope({ kind: "error", text: msg, elapsedMs: Date.now() - started }) }, 500);
  }
});
