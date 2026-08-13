import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

import { getCorsHeaders } from "../_shared/cors.ts";
import { isStaffEmail } from "../_shared/identityHash.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

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
    const userEmail = claimsData.claims.email as string;

    // ── Server-side tier validation ──────────────────────────────────────
    // Azplen is a Pro+ feature. Verify the user's subscription before proceeding.
    const isAdmin = isStaffEmail(userEmail);

    if (!isAdmin) {
      const svcClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } }
      );

      // Check granted subscriptions
      const { data: granted } = await svcClient
        .from("granted_subscriptions")
        .select("tier")
        .eq("email", userEmail)
        .eq("active", true)
        .maybeSingle();

      const grantedTier = granted?.tier;
      const hasAccess = grantedTier === "pro" || grantedTier === "advisor_monthly" || grantedTier === "advisor_annual";

      if (!hasAccess) {
        // Check Stripe subscription via check-subscription pattern
        const Stripe = (await import("https://esm.sh/stripe@18.5.0")).default;
        const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
        if (stripeKey) {
          const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
          const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
          if (customers.data.length > 0) {
            const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, limit: 10 });
            const activeSub = subs.data.find((s: any) => s.status === "active" || s.status === "trialing");
            // Pro product IDs
            const proProductIds = ["prod_U1PuUztkmieRrE", "prod_TzZlilj5l50ena", "prod_TzZlU2MDFcXG7o"];
            const productId = activeSub?.items?.data?.[0]?.price?.product;
            if (!activeSub || !proProductIds.includes(productId as string)) {
              return new Response(JSON.stringify({ error: "Azplen requires a Pro or Advisor subscription." }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 403,
              });
            }
          } else {
            return new Response(JSON.stringify({ error: "Azplen requires a Pro or Advisor subscription." }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
              status: 403,
            });
          }
        }
      }
    }

    const user = { id: userId };

    const { query, sessionId, datasetContext, mode } = await req.json();
    if (!query?.trim()) throw new Error("Missing query");

    const isQuiverMode = mode === "quiver";

    // Fetch user's datasets for context — scoped to session
    let dsQuery = supabase
      .from("asha_datasets")
      .select("file_name, row_count, col_count, schema, quality_score, tags, description")
      .eq("user_id", user.id)
      .eq("status", "ready")
      .limit(20);
    if (sessionId) dsQuery = dsQuery.eq("session_id", sessionId);
    const { data: datasets } = await dsQuery;

    // Fetch insights — scoped to session (NEW)
    let insQuery = supabase
      .from("asha_insights")
      .select("type, title, description")
      .eq("user_id", user.id)
      .eq("dismissed", false)
      .limit(10);
    if (sessionId) insQuery = insQuery.eq("session_id", sessionId);
    const { data: insights } = await insQuery;

    // Fetch user's installed plugins with plugin details
    const { data: installedPlugins } = await supabase
      .from("installed_plugins")
      .select("plugin_id, config, plugins(name, category, description)")
      .eq("user_id", user.id);

    // Build active plugins context
    const activePlugins = (installedPlugins || []).map((ip: any) => {
      const p = ip.plugins;
      return p ? `- ${p.name} (${p.category}): ${p.description}` : null;
    }).filter(Boolean);

    const pluginContext = activePlugins.length > 0
      ? `\nActive Plugins (use these capabilities in your analysis):\n${activePlugins.join("\n")}`
      : "";

    // Build plugin-specific instructions
    let pluginInstructions = "";
    const pluginNames = (installedPlugins || []).map((ip: any) => ip.plugins?.name?.toLowerCase() || "");

    if (pluginNames.some((n: string) => n.includes("sentiment"))) {
      pluginInstructions += "\n- SENTIMENT ANALYSIS ENABLED: Extract sentiment scores, emotional tone, and opinion polarity from any text data. Tag findings as POSITIVE/NEGATIVE/NEUTRAL with confidence percentages.";
    }
    // ... (rest of plugin instructions same as before) ...
    if (pluginNames.some((n: string) => n.includes("churn"))) {
        pluginInstructions += "\n- CHURN PREDICTION ENABLED: Identify churn risk factors, calculate retention probability, and suggest intervention strategies for at-risk segments.";
    }
    if (pluginNames.some((n: string) => n.includes("fraud"))) {
        pluginInstructions += "\n- FRAUD DETECTION ENABLED: Flag anomalous transactions, calculate fraud risk scores, and identify suspicious patterns using ensemble detection methods.";
    }
    if (pluginNames.some((n: string) => n.includes("salesforce"))) {
        pluginInstructions += "\n- SALESFORCE CONNECTOR ACTIVE: Interpret CRM data structures (Leads, Opportunities, Contacts). Map pipeline stages and conversion metrics.";
    }
    if (pluginNames.some((n: string) => n.includes("hubspot"))) {
        pluginInstructions += "\n- HUBSPOT INTEGRATION ACTIVE: Analyze marketing funnels, deal pipelines, and contact engagement scoring.";
    }
    if (pluginNames.some((n: string) => n.includes("quickbooks"))) {
        pluginInstructions += "\n- QUICKBOOKS FINANCIAL ACTIVE: Parse financial statements, calculate ratios (Current, Quick, Debt-to-Equity), and flag P&L anomalies.";
    }
    if (pluginNames.some((n: string) => n.includes("shopify"))) {
        pluginInstructions += "\n- SHOPIFY ORDERS ACTIVE: Analyze order patterns, product performance, customer lifetime value, and inventory velocity.";
    }
    if (pluginNames.some((n: string) => n.includes("stripe"))) {
        pluginInstructions += "\n- STRIPE TRANSACTIONS ACTIVE: Analyze payment flows, subscription metrics (MRR, churn rate, expansion revenue), and revenue cohort analysis.";
    }
    if (pluginNames.some((n: string) => n.includes("image"))) {
        pluginInstructions += "\n- IMAGE RECOGNITION ENABLED: Classify and tag uploaded images, extract visual features, and detect objects.";
    }
    if (pluginNames.some((n: string) => n.includes("audio") || n.includes("transcription"))) {
        pluginInstructions += "\n- AUDIO TRANSCRIPTION ENABLED: Convert audio references to searchable text with speaker identification.";
    }
    if (pluginNames.some((n: string) => n.includes("sankey"))) {
        pluginInstructions += "\n- SANKEY DIAGRAMS ENABLED: When presenting flow data, structure output for sankey visualization with source→target→value format.";
    }
    if (pluginNames.some((n: string) => n.includes("3d") || n.includes("scatter"))) {
        pluginInstructions += "\n- 3D SCATTER PLOTS ENABLED: Structure multi-dimensional data for 3D visualization with x, y, z axes clearly defined.";
    }
    if (pluginNames.some((n: string) => n.includes("network") || n.includes("force"))) {
        pluginInstructions += "\n- NETWORK FORCE GRAPHS ENABLED: Extract entity relationships and present as nodes/edges for graph visualization.";
    }
    if (pluginNames.some((n: string) => n.includes("industry") || n.includes("dashboard"))) {
        pluginInstructions += "\n- INDUSTRY DASHBOARDS ENABLED: Apply sector-specific KPI frameworks (healthcare, finance, retail) to the analysis.";
    }
    if (pluginNames.some((n: string) => n.includes("tableau"))) {
        pluginInstructions += "\n- TABLEAU EXPORT ENABLED: Structure data outputs for Tableau compatibility.";
    }
    if (pluginNames.some((n: string) => n.includes("excel") || n.includes("spreadsheet"))) {
        pluginInstructions += "\n- EXCEL/CSV EXPORT ENABLED: Format tabular outputs for direct spreadsheet export.";
    }
    if (pluginNames.some((n: string) => n.includes("email") || n.includes("scheduled"))) {
        pluginInstructions += "\n- SCHEDULED EMAIL REPORTS ENABLED: Structure findings for periodic email delivery.";
    }
    if (pluginNames.some((n: string) => n.includes("etl") || n.includes("pipeline"))) {
        pluginInstructions += "\n- ETL PIPELINE BUILDER ENABLED: Suggest data transformation steps and pipeline architectures.";
    }
    if (pluginNames.some((n: string) => n.includes("smart") || n.includes("enrichment"))) {
        pluginInstructions += "\n- SMART DATA ENRICHMENT ENABLED: Suggest external data sources to enrich existing datasets.";
    }
    if (pluginNames.some((n: string) => n.includes("sync"))) {
        pluginInstructions += "\n- DATA SYNC AUTOMATION ENABLED: Provide recommendations for automated data synchronization workflows.";
    }

    // Fetch sample data from most recent dataset (session-scoped)
    let sampleData = "";
    if (datasets && datasets.length > 0) {
      let sampleQuery = supabase
        .from("asha_datasets")
        .select("storage_path")
        .eq("user_id", user.id)
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .limit(1);
      if (sessionId) sampleQuery = sampleQuery.eq("session_id", sessionId);
      const { data: allDs } = await sampleQuery.single();

      if (allDs?.storage_path) {
        const { data: fileData } = await supabase.storage.from("asha-data").download(allDs.storage_path);
        if (fileData) {
          const text = await fileData.text();
          sampleData = text.split("\n").slice(0, 10).join("\n");
        }
      }
    }

    const datasetsContext = datasets?.map((d: any) => 
      `- ${d.file_name}: ${d.row_count} rows, ${d.col_count} cols, quality ${d.quality_score}%. Schema: ${(d.schema || []).map((c: any) => `${c.name}(${c.type})`).join(", ")}`
    ).join("\n") || "No datasets uploaded yet.";

    // Add insights to context (NEW)
    const insightsContext = insights?.map((i: any) => 
      `[${i.type}] ${i.title}: ${i.description}`
    ).join("\n") || "No prior insights generated.";

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY_APP");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY_APP not configured");

    const aiResp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: isQuiverMode
? `You are Quiver, an AI-assisted data query engine inside the AZPLEN intelligence platform. Users ask questions in plain language and you answer from their connected datasets.

${datasetContext ? `DATASET CONTEXT:\n${datasetContext}` : `User's Datasets:\n${datasetsContext}`}

Known Insights:
${insightsContext}

${sampleData ? `Sample data:\n${sampleData}\n` : ""}

User Question: "${query}"

INSTRUCTIONS:
- Answer the question directly using the available dataset context.
- If exact data is available, provide specific numbers, percentages, and rankings.
- If you need to approximate, clearly state your assumptions.
- Format tables when comparing items. Use markdown.
- Be concise but thorough. Every sentence must answer the question.
- If the data is insufficient, specify exactly which datasets or columns would be needed.
- Include a confidence level for your answer.`

: `You are Azplen, a forensic-grade data intelligence AI. You conduct deep, exhaustive analysis — never surface-level summaries.

User's Datasets:
${datasetsContext}

Known Insights (Session Context):
${insightsContext}

${pluginContext}
${sampleData ? `\nSample data from most recent file:\n${sampleData}\n` : ""}

User Query: "${query}"

INSTRUCTIONS:
- If this is a company intelligence query, produce a DEEP investigative analysis with specific names, dates, dollar amounts, document references, and risk assessments.
- Structure your response with clear headers, bullet points, and data tables where appropriate.
- Cross-reference claims across data points. Flag contradictions or gaps.
- Include a BLUF (Bottom Line Up Front) for executive decision-making.
- Include a CONFIDENCE LEVEL (HIGH/MEDIUM/LOW) for each major finding.
- Include a RISK ASSESSMENT MATRIX if applicable.
- If you can't answer from available data, specify exactly what additional data sources would close the gap.
- Never use filler text or generic statements. Every sentence must add intelligence value.
- Think like a senior analyst at a top-tier intelligence firm.
${pluginInstructions ? `\nPLUGIN-ENHANCED CAPABILITIES:${pluginInstructions}\n\nLeverage ALL active plugin capabilities in your analysis. Mention which plugin capabilities you used.` : ""}`
}] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 8000 },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("Gemini error:", aiResp.status, errText);
      throw new Error("AI query failed");
    }

    const aiData = await aiResp.json();
    const responseText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't generate a response. Please try rephrasing your question.";

    // Save query to history — scoped to session
    await supabase.from("asha_queries").insert({
      user_id: user.id,
      query,
      response: responseText,
      response_type: "text",
      session_id: sessionId || null,
    });

    return new Response(JSON.stringify({ response: responseText, type: "text" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("asha-query error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});