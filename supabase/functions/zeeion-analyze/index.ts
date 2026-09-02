import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders } from "../_shared/cors.ts";
import { retiredSurfaceResponse } from "../_shared/retiredSurfaces.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const retired = retiredSurfaceResponse(req, "zeeion");
  if (retired) return retired;

  // ── Strict BYOK gate — admin uses platform key, others must BYOK ──
  if (req.method !== 'OPTIONS') {
    try {
      const _b = await req.clone().json().catch(() => ({} as any));
      const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
      const _gate = await import('../_shared/adminGate.ts');
      await _gate.resolveKey(req, _byok);
    } catch (_e) {
      const _gate = await import('../_shared/adminGate.ts');
      return _gate.byokErrorResponse(_e, corsHeaders);
    }
  }

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseClient.auth.getUser(token);
    if (authErr || !user) throw new Error("Not authenticated");

    const { fileName, fileType, fileContent, currency } = await req.json();
    if (!fileName || !fileContent) throw new Error("Missing file data");

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY_APP not configured");

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

    // ============================================================
    // PHASE 1: ASHA DATA EXTRACTION (for unstructured/binary data)
    // ============================================================
    // ASHA's document intelligence first extracts structured financial
    // data from ANY file type — PDFs, Excel (base64), XML, etc.
    // Only clean CSV/JSON skip this step.

    let structuredData = "";
    const isPlainText = fileType === "csv" || fileType === "json";

    if (isPlainText) {
      // Already structured — pass directly
      structuredData = fileContent.substring(0, 80000);
    } else {
      // ASHA EXTRACTION PHASE: Convert unstructured → structured
      console.log(`[Zeeion] ASHA extraction phase for ${fileType} file: ${fileName}`);

      const ashaPrompt = `You are ASHA (Advanced Structured Harmonization Agent), AUREON's data extraction engine. Your job is to extract ALL financial data from this document into clean, structured CSV format.

DOCUMENT INFO:
- File: ${fileName}
- Type: ${fileType}
- Content encoding: ${fileType === "pdf" || fileType === "xlsx" || fileType === "xls" ? "base64" : "text"}

EXTRACTION RULES:
1. Extract EVERY financial transaction, line item, expense, revenue entry, or monetary value you can find
2. Detect and extract tables, invoices, receipts, budgets, P&L statements, balance sheets
3. For PDFs: Parse the text content embedded in the base64 data
4. For Excel: Parse the base64-encoded spreadsheet data
5. For XML: Parse the XML structure and extract financial nodes
6. Normalize all dates to YYYY-MM-DD format
7. Normalize all amounts to numeric values (remove $, commas, etc.)
8. Identify departments, categories, vendors, and payment methods where available
9. If you find multiple sheets/pages/sections, merge them into one unified dataset

OUTPUT FORMAT — Return ONLY a CSV block with headers:
date,description,amount,category,department,vendor,payment_method,type,notes

RULES:
- Use "income" or "expense" for the type column
- Leave fields blank if not available (don't fabricate)
- Extract REAL data from the document, do not invent transactions
- Include ALL rows you can find, not just a sample
- If the document has summary tables AND detail tables, prefer the detail
- Return ONLY the CSV data, no markdown fencing, no explanations

DOCUMENT CONTENT:
${fileContent.substring(0, 80000)}`;

      const extractResp = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: ashaPrompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 16000 },
        }),
      });

      if (!extractResp.ok) {
        const errText = await extractResp.text();
        console.error("ASHA extraction error:", errText);
        throw new Error(`ASHA data extraction failed: ${extractResp.status}`);
      }

      const extractData = await extractResp.json();
      const extractedText = extractData.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Clean up — remove any markdown fencing the model might add
      structuredData = extractedText
        .replace(/```csv\n?/gi, "")
        .replace(/```\n?/g, "")
        .trim();

      if (!structuredData || structuredData.length < 20) {
        throw new Error("ASHA could not extract structured data from this file. Please ensure the document contains financial records (transactions, invoices, budgets, etc.).");
      }

      console.log(`[Zeeion] ASHA extracted ${structuredData.split("\n").length - 1} rows from ${fileType} file`);
    }

    // ============================================================
    // PHASE 2: AUREON FINANCIAL ANALYSIS (on structured data)
    // ============================================================

    const analysisPrompt = `You are Zeeion, AUREON's elite Financial Intelligence AI. You have access to all of AUREON's analytical brains — pattern recognition, anomaly detection, forensic accounting, and predictive modeling.

This data has been pre-processed by ASHA (AUREON's data extraction engine) into structured format.

Analyze the financial data and produce a comprehensive analysis.

IMPORTANT: First, auto-detect the date range from the data. Identify the earliest and latest dates present. Use this to determine the fiscal period being analyzed.

You MUST return valid JSON with exactly this structure:
{
  "summary": {
    "totalRecords": <number>,
    "totalSpending": <number>,
    "potentialSavings": <number>,
    "efficiencyScore": <number 0-100>,
    "anomalyCount": <number>,
    "wastefulSpending": <number>,
    "departmentCount": <number>
  },
  "detectedDateRange": {
    "startMonth": "<month name>",
    "startYear": <year>,
    "endMonth": "<month name>",
    "endYear": <year>
  },
  "executiveSummary": "<3-4 paragraph executive summary>",
  "wastefulItems": [{"description":"...","annualCost":<number>,"recommendation":"...","severity":"high|medium|low"}],
  "savingsOpportunities": [{"category":"...","description":"...","currentCost":<number>,"projectedSavings":<number>,"confidence":<0-100>}],
  "departmentPerformance": [{"department":"...","totalSpending":<number>,"budget":<number>,"variance":<number>,"efficiencyScore":<0-100>}],
  "anomalies": [{"type":"...","severity":"high|medium|low","description":"...","recommendation":"..."}],
  "categoryBreakdown": [{"category":"...","amount":<number>,"percentage":<number>}]
}

If the data is insufficient, generate reasonable estimates based on what you can extract.
Currency: ${currency}.
Be thorough, realistic, and actionable. Identify real patterns, not generic advice. Apply forensic-level scrutiny — detect duplicates, round-number anomalies, weekend transactions, rapid sequences, and vendor consolidation opportunities.`;

    const aiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${analysisPrompt}\n\nStructured financial data from file "${fileName}" (extracted by ASHA):\n\n${structuredData}` }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Gemini API error:", errText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON from response
    let analysis;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in AI response");
      }
    } catch {
      analysis = {
        summary: {
          totalRecords: 0, totalSpending: 0, potentialSavings: 0,
          efficiencyScore: 50, anomalyCount: 0, wastefulSpending: 0, departmentCount: 0,
        },
        executiveSummary: "Unable to fully parse the uploaded data. Please ensure the file contains structured financial records.",
        wastefulItems: [], savingsOpportunities: [], departmentPerformance: [],
        anomalies: [], categoryBreakdown: [],
      };
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
