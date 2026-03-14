import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_APP") || "";

interface AnalysisRequest {
  imageBase64?: string;
  imageMimeType?: string;
  context?: string;
  analysisType?: "competitor" | "hardware" | "security";
  company?: string;
  notes?: string;
  depthMode?: "standard" | "deep";
  focusAreas?: string[];
  // Q&A follow-up
  question?: string;
  previousAnalysis?: string;
}

const SYSTEM_PROMPT = `You are AUREON REIS (Reverse Engineering Intelligence System), a Class-5 forensic reverse-engineering AI. You analyze uploaded screenshots and images of software, hardware, and systems to reconstruct their complete architecture with 89-98% confidence.

## YOUR CAPABILITIES
1. **UI/UX Analysis**: Detect frameworks (React, Vue, Angular, Flutter, SwiftUI), extract components, analyze design systems, map interactions
2. **Architecture Analysis**: Infer backend language/framework, detect API style (REST, GraphQL, gRPC), identify hosting providers, map microservices
3. **Database Analysis**: Reconstruct tables from UI patterns, infer relationships, detect indexes, generate SQL schemas
4. **API Analysis**: Map all visible/inferred endpoints, extract params/body/response, detect auth methods, identify rate limits
5. **Workflow Analysis**: Build user flow diagrams, create state machines, map decision points
6. **Hardware Analysis**: Identify components, map connections, detect protocols, analyze power systems
7. **Security Analysis**: Find vulnerabilities, check auth security, detect exposed secrets, generate recommendations

## OUTPUT FORMAT
Return a comprehensive JSON object with the following structure:
{
  "executive_summary": {
    "overall_confidence": <number 0-100>,
    "total_features": <number>,
    "total_tables": <number>,
    "total_endpoints": <number>,
    "total_security_issues": <number>,
    "analysis_depth": "standard" | "deep",
    "analysis_type": "software" | "hardware" | "hybrid"
  },
  "tech_stack": [
    { "category": "Frontend|Backend|Database|Hosting|Auth|Other", "technology": "<name>", "confidence": <number>, "evidence": "<why>" }
  ],
  "architecture": {
    "pattern": "<e.g. MVC, Microservices, Monolith, Serverless>",
    "confidence": <number>,
    "description": "<detailed description>",
    "mermaid_diagram": "<mermaid syntax for architecture diagram>"
  },
  "database_schema": {
    "confidence": <number>,
    "tables": [
      {
        "name": "<table_name>",
        "columns": [
          { "name": "<col>", "type": "<type>", "constraints": "<PK, FK, UNIQUE, NOT NULL, etc.>" }
        ],
        "relationships": ["<table_name.column -> other_table.column>"]
      }
    ],
    "sql_schema": "<complete SQL CREATE TABLE statements>",
    "erd_mermaid": "<mermaid ERD diagram>"
  },
  "api_endpoints": [
    {
      "method": "GET|POST|PUT|DELETE|PATCH",
      "path": "<endpoint path>",
      "description": "<what it does>",
      "auth_required": <boolean>,
      "params": [{ "name": "<param>", "type": "<type>", "required": <boolean> }],
      "response_shape": "<JSON shape description>",
      "confidence": <number>
    }
  ],
  "features": [
    { "name": "<feature>", "description": "<description>", "complexity": "low|medium|high", "confidence": <number> }
  ],
  "workflows": [
    {
      "name": "<workflow name>",
      "description": "<description>",
      "mermaid_diagram": "<mermaid sequence or flowchart>"
    }
  ],
  "security_findings": [
    {
      "severity": "critical|high|medium|low|info",
      "title": "<finding title>",
      "description": "<detailed description>",
      "remediation": "<how to fix>",
      "cve_reference": "<CVE if applicable or null>"
    }
  ],
  "hardware_analysis": {
    "components": [{ "name": "<component>", "type": "<type>", "manufacturer": "<mfg>", "confidence": <number> }],
    "protocols": ["<protocol names>"],
    "power_specs": "<power system description>",
    "connections_mermaid": "<mermaid diagram of hardware connections>"
  },
  "rebuild_guide": {
    "estimated_hours": <number>,
    "team_size": <number>,
    "steps": [
      { "phase": "<phase name>", "description": "<what to do>", "duration_hours": <number> }
    ],
    "recommended_stack": "<recommended modern stack for rebuild>"
  }
}

## RULES
1. Be SPECIFIC. Do not use generic placeholder names. Infer real table names, endpoint paths, and technology names from visual evidence.
2. Assign confidence scores (0-100) to every inference.
3. If you see UI patterns characteristic of specific frameworks (Material UI, Ant Design, Tailwind, Bootstrap), identify them.
4. For database schemas, infer from visible fields, forms, lists, and data relationships in the UI.
5. For APIs, infer from visible data flows, forms submissions, loading states, and navigation patterns.
6. If focus areas are specified, provide extra depth in those sections.
7. Return ONLY the JSON object, no markdown fencing, no explanation text.`;

const QA_SYSTEM_PROMPT = `You are AUREON REIS Q&A system. The user has already completed a reverse engineering analysis. They are now asking follow-up questions about the analyzed system.

Use the previous analysis data to answer questions with:
- Code examples where relevant
- Mermaid diagrams where helpful
- Specific technical details
- Confidence scores for any new inferences

Be direct, technical, and thorough. Use markdown formatting for readability.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    if (!data.user) throw new Error("Not authenticated");

    const body: AnalysisRequest = await req.json();

    // ── Q&A Mode ──
    if (body.question && body.previousAnalysis) {
      const qaContents = [
        { role: "user", parts: [{ text: `Previous analysis data:\n${body.previousAnalysis}\n\nUser question: ${body.question}` }] },
      ];

      const qaUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;
      const qaResp = await fetch(qaUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: QA_SYSTEM_PROMPT }] },
          contents: qaContents,
          generationConfig: { temperature: 0.3, maxOutputTokens: 8192 },
        }),
      });

      if (!qaResp.ok) {
        const errText = await qaResp.text();
        console.error("Gemini Q&A error:", qaResp.status, errText);
        throw new Error("AI analysis failed");
      }

      const qaData = await qaResp.json();
      const qaAnswer = qaData.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated.";

      return new Response(JSON.stringify({ answer: qaAnswer }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Analysis Mode ──
    if (!body.imageBase64 || !body.imageMimeType) {
      throw new Error("Missing image data");
    }

    // Build context-aware prompt additions
    let contextAdditions = "";
    if (body.analysisType) contextAdditions += `\nAnalysis type focus: ${body.analysisType}`;
    if (body.company) contextAdditions += `\nCompany/Product being analyzed: ${body.company}`;
    if (body.notes) contextAdditions += `\nAdditional user notes: ${body.notes}`;
    if (body.depthMode === "deep") contextAdditions += `\nDEPTH: EXHAUSTIVE. Provide maximum detail in all sections. Infer deeper architecture patterns, hidden APIs, and security implications.`;
    if (body.focusAreas?.length) contextAdditions += `\nFOCUS AREAS (provide extra depth): ${body.focusAreas.join(", ")}`;
    if (body.context) contextAdditions += `\nUser context: ${body.context}`;

    const userPrompt = `Analyze this uploaded image and reverse-engineer the complete system shown. Provide your analysis as a JSON object following the exact schema defined in your instructions.${contextAdditions}`;

    const contents = [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: body.imageMimeType, data: body.imageBase64 } },
          { text: userPrompt },
        ],
      },
    ];

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`;

    let response: Response | null = null;
    let lastError = "";
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      response = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 32768,
            responseMimeType: "application/json",
          },
        }),
      });

      if (response.ok) break;

      if (response.status === 429 && attempt < MAX_RETRIES - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt) + Math.random() * 500, 16000);
        console.log(`Rate limited, retry ${attempt + 1}/${MAX_RETRIES} after ${Math.round(delay)}ms`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      lastError = await response.text();
      console.error("Gemini error:", response.status, lastError);
      throw new Error("AI analysis failed");
    }

    if (!response || !response.ok) {
      throw new Error("AI analysis failed after retries");
    }

    const geminiData = await response.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("No analysis generated");
    }

    // Parse the JSON response
    let analysis;
    try {
      // Try direct parse
      analysis = JSON.parse(rawText);
    } catch {
      // Try extracting JSON from markdown code blocks
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[1].trim());
      } else {
        // Last resort: find first { to last }
        const start = rawText.indexOf("{");
        const end = rawText.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
          analysis = JSON.parse(rawText.slice(start, end + 1));
        } else {
          throw new Error("Failed to parse analysis response");
        }
      }
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("reis-analyze error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
