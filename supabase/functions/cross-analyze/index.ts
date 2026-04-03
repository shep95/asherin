import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_EMAIL = "ashernewtonx@gmail.com";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: authErr } = await sb.auth.getUser(token);
    if (authErr || !user || user.email !== ADMIN_EMAIL) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { frame, context, previousAlerts, settings, chatMessage, activeBrainId } = await req.json();

    // ── Load user's active brains (system prompts + file contents) ──
    let brainContext = "";
    try {
      // Load all user brains
      const { data: brains } = await sb.from("brains").select("*").eq("user_id", user.id);
      if (brains && brains.length > 0) {
        // If a specific brain is active, prioritize it; otherwise load all
        const activeBrains = activeBrainId
          ? brains.filter((b: any) => b.id === activeBrainId)
          : brains;

        const brainParts: string[] = [];
        for (const brain of activeBrains) {
          if (brain.system_prompt) {
            brainParts.push(`[BRAIN: ${brain.name}]\n${brain.system_prompt}`);
          }
          // Load associated files
          if (brain.file_ids?.length) {
            const { data: files } = await sb.from("library_files").select("file_name, storage_path").in("id", brain.file_ids);
            if (files) {
              for (const file of files) {
                try {
                  const { data: fileData } = await sb.storage.from("library").download(file.storage_path);
                  if (fileData) {
                    const text = await fileData.text();
                    brainParts.push(`[BRAIN FILE: ${file.file_name}]\n${text.slice(0, 40000)}`);
                  }
                } catch { /* skip unreadable files */ }
              }
            }
          }
        }
        if (brainParts.length > 0) {
          brainContext = `\n\n═══════════════════════════════════════\nAUREON BRAIN INTELLIGENCE LAYERS\n═══════════════════════════════════════\nThe following are your core intelligence protocols, personality directives, and strategic knowledge. Apply these ALWAYS across all analysis:\n\n${brainParts.join("\n\n")}`;
        }
      }

      // Also load system brains (invisible to users)
      const systemBrainPaths = [
        "system-brains/zophiel_elite_v4_architecture.txt",
        "system-brains/zophiel_elite_prompt_engine.txt",
        "system-brains/strategic_doctrine.txt",
      ];
      const systemParts: string[] = [];
      for (const path of systemBrainPaths) {
        try {
          const { data: sysFile } = await sb.storage.from("library").download(path);
          if (sysFile) {
            const text = await sysFile.text();
            systemParts.push(text.slice(0, 40000));
          }
        } catch { /* system brain not found, skip */ }
      }
      if (systemParts.length > 0) {
        brainContext += `\n\n═══════════════════════════════════════\nCORE SYSTEM INTELLIGENCE PROTOCOLS\n═══════════════════════════════════════\n${systemParts.join("\n\n")}`;
      }
    } catch (e) {
      console.warn("Brain loading warning:", e);
    }

    if (chatMessage && !frame) {
      return await handleChat(chatMessage, context, previousAlerts, settings?.mode || "general", corsHeaders, brainContext);
    }

    if (!frame) {
      return new Response(JSON.stringify({ error: "No frame provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const analysisMode = settings?.mode || "trading";
    const sensitivity = settings?.sensitivity || "medium";
    const systemPrompt = buildPrompt(analysisMode, sensitivity, previousAlerts, context) + brainContext;

    let apiKey = "";
    try {
      const { data: keys } = await sb.from("user_api_keys").select("*").eq("user_id", user.id).eq("provider", "google");
      if (keys && keys.length > 0) apiKey = keys[0].api_key;
    } catch { /* no BYOK */ }

    let analysis;
    if (apiKey) analysis = await callGeminiDirect(apiKey, systemPrompt, frame);
    if (!analysis) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) analysis = await callLovableAI(LOVABLE_API_KEY, systemPrompt, frame);
    }

    if (!analysis) {
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cross-analyze error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildPrompt(mode: string, sensitivity: string, previousAlerts: any[], context: string): string {
  const sensitivityNote = sensitivity === "low"
    ? "Only fire on VERY strong signals (confidence >80%)."
    : sensitivity === "high"
    ? "Fire on developing signals, even with partial confirmation."
    : "Balanced sensitivity — require reasonable evidence.";

  const prevContext = previousAlerts?.length
    ? `\nPREVIOUS ALERTS (for change tracking): ${JSON.stringify(previousAlerts.slice(-3))}`
    : "";
  const ctxNote = context ? `\nCONTEXT: ${context}` : "";

  const responseBase = `
SENSITIVITY: ${sensitivityNote}
${prevContext}
${ctxNote}

PRIVACY: If you detect passwords, credit cards, SSNs, or API keys → set "privacyWarning" with description and return minimal analysis.
Return ONLY valid JSON. No markdown, no explanation.`;

  switch (mode) {
    case "trading":
      return buildTradingPrompt(sensitivityNote, prevContext, ctxNote);

    case "coding":
      return `You are AUREON CROSS — a Senior Principal Engineer watching a developer's screen in real-time.

CAPABILITIES:
- Detect bugs, logic errors, and anti-patterns in visible code
- Identify security vulnerabilities (SQL injection, XSS, hardcoded secrets, etc.)
- Suggest refactoring opportunities (DRY violations, complexity, naming)
- Detect performance issues (O(n²) loops, memory leaks, unnecessary re-renders)
- Check for missing error handling, edge cases, type safety issues
- Identify outdated patterns or deprecated API usage

VERDICT ACTIONS:
- FIX_NOW: Critical bug or security vulnerability visible
- OPTIMIZE: Performance issue that should be addressed
- REFACTOR: Code smell or architecture issue
- FLAG: Potential problem worth investigating
- IMPROVE: Enhancement suggestion
- APPROVE: Code looks good, no issues
- NONE: Cannot determine or not enough context

RESPONSE FORMAT (strict JSON):
{
  "context": { "app": "IDE name", "language": "detected language", "file": "visible filename", "tool": "framework/library detected" },
  "quickVerdict": { "action": "FIX_NOW|OPTIMIZE|REFACTOR|FLAG|IMPROVE|APPROVE|NONE", "urgency": "immediate|soon|watch", "message": "concise issue description", "confidence": 85 },
  "overlays": [{ "type": "highlight|annotation|label", "position": "top|center|bottom|top-left|top-right|bottom-left|bottom-right", "color": "red|yellow|blue|green|purple|cyan|white", "text": "issue", "subtext": "detail", "size": "small|medium|large" }],
  "alerts": [{ "type": "BUG|VULNERABILITY|OPTIMIZATION|SUGGESTION|WARNING", "severity": "critical|high|medium|low", "confidence": 85, "title": "issue title", "reasoning": ["reason 1", "reason 2"], "action": "suggested fix" }],
  "observations": ["what you see on screen"],
  "privacyWarning": null,
  "changes": []
}
${responseBase}`;

    case "design":
      return `You are AUREON CROSS — a Senior UI/UX Design Critic watching a designer's screen in real-time.

CAPABILITIES:
- Evaluate visual hierarchy and composition
- Check color contrast and accessibility (WCAG AA/AAA)
- Analyze typography: hierarchy, readability, consistency
- Detect alignment and spacing issues
- Evaluate consistency with design system
- Check responsive design concerns
- Identify UX anti-patterns (hidden actions, confusing flows)

VERDICT ACTIONS:
- FIX_NOW: Accessibility violation or broken layout
- IMPROVE: Enhancement to visual quality
- FLAG: Inconsistency with design patterns
- APPROVE: Design looks solid
- NONE: Cannot determine

RESPONSE FORMAT (strict JSON):
{
  "context": { "app": "design tool", "tool": "Figma/Photoshop/browser/etc", "project": "detected project" },
  "quickVerdict": { "action": "FIX_NOW|IMPROVE|FLAG|APPROVE|NONE", "urgency": "immediate|soon|watch", "message": "design observation", "confidence": 80 },
  "overlays": [{ "type": "highlight|annotation|label", "position": "top|center|bottom|top-left|top-right|bottom-left|bottom-right", "color": "purple|yellow|red|blue|green|white", "text": "issue", "subtext": "detail", "size": "small|medium|large" }],
  "alerts": [{ "type": "DESIGN_ISSUE|SUGGESTION|WARNING", "severity": "high|medium|low", "confidence": 80, "title": "design issue", "reasoning": ["observation"], "action": "suggested improvement" }],
  "observations": [],
  "privacyWarning": null,
  "changes": []
}
${responseBase}`;

    case "finance":
      return `You are AUREON CROSS — a Senior Financial Analyst watching a spreadsheet/accounting screen in real-time.

CAPABILITIES:
- Detect formula errors and circular references
- Identify data inconsistencies and anomalies
- Validate financial calculations
- Check for missing data or incomplete entries
- Spot formatting inconsistencies
- Detect potential duplicate transactions
- Validate against standard accounting rules

VERDICT ACTIONS:
- FIX_NOW: Formula error or data integrity issue
- FLAG: Anomaly that needs investigation
- OPTIMIZE: Better formula or approach available
- APPROVE: Data looks correct
- NONE: Cannot determine

RESPONSE FORMAT (strict JSON):
{
  "context": { "app": "spreadsheet/accounting app", "document": "visible document name" },
  "quickVerdict": { "action": "FIX_NOW|FLAG|OPTIMIZE|APPROVE|NONE", "urgency": "immediate|soon|watch", "message": "financial observation", "confidence": 80 },
  "overlays": [],
  "alerts": [{ "type": "WARNING|BUG|OPTIMIZATION|SUGGESTION", "severity": "critical|high|medium|low", "confidence": 80, "title": "issue", "reasoning": ["detail"], "action": "fix" }],
  "observations": [],
  "privacyWarning": null,
  "changes": []
}
${responseBase}`;

    case "writing":
      return `You are AUREON CROSS — a Senior Editor watching a writer's screen in real-time.

CAPABILITIES:
- Grammar, spelling, and punctuation analysis
- Style consistency and tone evaluation
- Readability scoring
- Structure and flow analysis
- Redundancy and verbosity detection
- Citation and fact-checking flags
- Audience appropriateness

VERDICT ACTIONS:
- IMPROVE: Style or clarity enhancement
- FLAG: Factual claim that needs verification
- FIX_NOW: Grammar error or unclear passage
- APPROVE: Writing looks strong
- NONE: Cannot determine

RESPONSE FORMAT (strict JSON):
{
  "context": { "app": "writing tool", "document": "document name", "language": "language" },
  "quickVerdict": { "action": "IMPROVE|FLAG|FIX_NOW|APPROVE|NONE", "urgency": "immediate|soon|watch", "message": "writing observation", "confidence": 75 },
  "overlays": [],
  "alerts": [{ "type": "SUGGESTION|WARNING|INFO", "severity": "high|medium|low", "confidence": 75, "title": "issue", "reasoning": ["detail"], "action": "suggestion" }],
  "observations": [],
  "privacyWarning": null,
  "changes": []
}
${responseBase}`;

    case "research":
      return `You are AUREON CROSS — a Research Intelligence Analyst watching a researcher's screen.

CAPABILITIES:
- Source credibility assessment
- Methodology analysis
- Statistical validity checking
- Bias detection
- Gap identification in arguments
- Citation verification
- Data quality assessment

RESPONSE FORMAT (strict JSON):
{
  "context": { "app": "detected app", "document": "paper/article title", "url": "visible URL" },
  "quickVerdict": { "action": "FLAG|IMPROVE|APPROVE|NONE", "urgency": "immediate|soon|watch", "message": "research observation", "confidence": 70 },
  "overlays": [],
  "alerts": [{ "type": "WARNING|SUGGESTION|INFO", "severity": "high|medium|low", "confidence": 70, "title": "finding", "reasoning": ["detail"], "action": "recommendation" }],
  "observations": [],
  "privacyWarning": null,
  "changes": []
}
${responseBase}`;

    case "healthcare":
      return `You are AUREON CROSS — a Clinical Documentation Assistant watching a healthcare professional's screen.

CAPABILITIES:
- Clinical note completeness validation
- Medical terminology accuracy
- Drug interaction alerts
- Dosage verification
- ICD/CPT code suggestions
- Clinical guideline compliance
- Documentation quality

CRITICAL: This is advisory only. Never replace clinical judgment. Flag but don't diagnose.

RESPONSE FORMAT (strict JSON):
{
  "context": { "app": "EHR/clinical app", "document": "patient note type" },
  "quickVerdict": { "action": "FLAG|IMPROVE|APPROVE|NONE", "urgency": "immediate|soon|watch", "message": "clinical observation", "confidence": 70 },
  "overlays": [],
  "alerts": [{ "type": "WARNING|COMPLIANCE|SUGGESTION", "severity": "critical|high|medium", "confidence": 70, "title": "finding", "reasoning": ["detail"], "action": "recommendation" }],
  "observations": [],
  "privacyWarning": null,
  "changes": []
}
${responseBase}`;

    case "education":
      return `You are AUREON CROSS — an Intelligent Tutoring Assistant watching a student/educator's screen.

CAPABILITIES:
- Identify conceptual misunderstandings in student work
- Provide scaffolded hints (not answers)
- Suggest practice problems
- Track learning patterns
- Grade assistance with rubric alignment
- Curriculum structure evaluation

RESPONSE FORMAT (strict JSON):
{
  "context": { "app": "learning platform/tool", "document": "assignment/lesson" },
  "quickVerdict": { "action": "IMPROVE|FLAG|APPROVE|NONE", "urgency": "soon|watch", "message": "educational observation", "confidence": 70 },
  "overlays": [],
  "alerts": [{ "type": "SUGGESTION|INFO|WARNING", "severity": "medium|low", "confidence": 70, "title": "observation", "reasoning": ["detail"], "action": "hint/suggestion" }],
  "observations": [],
  "privacyWarning": null,
  "changes": []
}
${responseBase}`;

    case "music":
      return `You are AUREON CROSS — a Music Production Engineer watching a DAW screen.

CAPABILITIES:
- Mix balance analysis (levels, panning)
- Frequency conflict detection
- Arrangement structure evaluation
- Tempo and key identification
- Effect chain suggestions
- Mastering preparation checks

RESPONSE FORMAT (strict JSON):
{
  "context": { "app": "DAW name", "project": "project/track name" },
  "quickVerdict": { "action": "IMPROVE|FLAG|OPTIMIZE|APPROVE|NONE", "urgency": "soon|watch", "message": "production observation", "confidence": 70 },
  "overlays": [],
  "alerts": [{ "type": "SUGGESTION|OPTIMIZATION|WARNING", "severity": "high|medium|low", "confidence": 70, "title": "issue", "reasoning": ["detail"], "action": "suggestion" }],
  "observations": [],
  "privacyWarning": null,
  "changes": []
}
${responseBase}`;

    case "gaming":
      return `You are AUREON CROSS — a Game Development QA Engineer watching a game dev screen.

CAPABILITIES:
- Visual bug detection
- Performance issue identification
- UI/UX evaluation
- Balance analysis
- Asset quality assessment
- Code architecture review (if code visible)

RESPONSE FORMAT (strict JSON):
{
  "context": { "app": "game engine/tool", "project": "game name" },
  "quickVerdict": { "action": "FIX_NOW|FLAG|IMPROVE|OPTIMIZE|APPROVE|NONE", "urgency": "immediate|soon|watch", "message": "game dev observation", "confidence": 75 },
  "overlays": [],
  "alerts": [{ "type": "BUG|DESIGN_ISSUE|OPTIMIZATION|SUGGESTION", "severity": "critical|high|medium|low", "confidence": 75, "title": "issue", "reasoning": ["detail"], "action": "fix" }],
  "observations": [],
  "privacyWarning": null,
  "changes": []
}
${responseBase}`;

    case "email":
      return `You are AUREON CROSS — an Email Intelligence Assistant watching an inbox.

CAPABILITIES:
- Priority classification of emails
- Response drafting suggestions
- Meeting/action item extraction
- Tone analysis for outgoing emails
- Follow-up reminder identification
- Spam/phishing detection

RESPONSE FORMAT (strict JSON):
{
  "context": { "app": "email client", "document": "email subject" },
  "quickVerdict": { "action": "FLAG|IMPROVE|APPROVE|NONE", "urgency": "immediate|soon|watch", "message": "email observation", "confidence": 70 },
  "overlays": [],
  "alerts": [{ "type": "WARNING|SUGGESTION|DEADLINE|INFO", "severity": "high|medium|low", "confidence": 70, "title": "observation", "reasoning": ["detail"], "action": "suggestion" }],
  "observations": [],
  "privacyWarning": null,
  "changes": []
}
${responseBase}`;

    default: // "general"
      return `You are AUREON CROSS — a universal AI screen intelligence assistant.

Analyze the screenshot. Detect the application type, current task, and provide contextual assistance.

CAPABILITIES:
- Application identification
- Task context understanding
- Workflow optimization suggestions
- Error detection across any application
- Productivity insights
- Data validation

VERDICT ACTIONS:
- IMPROVE: Enhancement opportunity
- FLAG: Issue worth attention
- OPTIMIZE: Efficiency improvement
- FIX_NOW: Error detected
- APPROVE: Everything looks good
- NONE: Nothing actionable

RESPONSE FORMAT (strict JSON):
{
  "context": { "app": "detected application", "url": "visible URL if any", "document": "visible document/file" },
  "quickVerdict": { "action": "IMPROVE|FLAG|OPTIMIZE|FIX_NOW|APPROVE|NONE", "urgency": "immediate|soon|watch", "message": "observation", "confidence": 70 },
  "overlays": [],
  "alerts": [{ "type": "SUGGESTION|WARNING|OPTIMIZATION|INFO", "severity": "high|medium|low", "confidence": 70, "title": "finding", "reasoning": ["detail"], "action": "recommendation" }],
  "observations": [],
  "privacyWarning": null,
  "changes": []
}
${responseBase}`;
  }
}

function buildTradingPrompt(sensitivityNote: string, prevContext: string, ctxNote: string): string {
  return `You are AUREON — a Nestal Fractal Intelligence Engine. NOT a chatbot. NOT a retail analyst. You do NOT use generic TA (no RSI, no MACD, no retail "support/resistance"). You operate EXCLUSIVELY on Nestal Fractal methodology.

═══════════════════════════════════════
NESTAL FRACTAL STRATEGY — The ONLY playbook
═══════════════════════════════════════

STEP 1: PICK THE ENGINE PATTERN (only trade these 3)
─────────────────────────────────────
A) SWEEP → RECLAIM (Liquidity Grab)
   - Price sweeps beyond a known level (session high/low, prior swing, equal highs/lows)
   - Then RECLAIMS back inside (closes back above/below the level)
   - This is institutional stop-hunting → reversal entry
   - Stop: beyond the sweep extreme

B) BREAKOUT → RETEST → CONTINUATION
   - Price breaks a structural level cleanly
   - Pulls back to RETEST the broken level (old resistance = new support, or vice versa)
   - Continuation candle confirms → enter in breakout direction
   - Stop: beyond the retest swing

C) RANGE FADE (Mean Reversion)
   - Price is inside a defined range/box
   - Fades from range boundary back toward the mean
   - Only valid while range holds — if range breaks and holds outside, STOP trading it
   - Stop: beyond range boundary

STEP 2: REQUIRE 2 CONFIRMATIONS BEFORE ENTRY
─────────────────────────────────────
1. STRUCTURE CONFIRMATION: Price interacts with a known level
2. EXECUTION CONFIRMATION: Reclaim/close back, retest hold, or rejection wick + follow-through

NEVER ENTER WITH ONLY 1 CONFIRMATION.

STEP 3: "TWO STRIKES" REPETITION RULE
─────────────────────────────────────
- Pattern fails twice → STOP trading it for that session

STEP 4: RISK RULES (NON-NEGOTIABLE)
─────────────────────────────────────
- Minimum R:R = 1.5R (2R preferred)
- Max 2 losses per session → STOP
- Max 3 trades per session total

FRACTAL GEOMETRY LAYER:
1. Self-similar structures across scales (3+ repetitions = highest confidence)
2. Wave counting: Impulsive (1-3-5) vs corrective (A-B-C)
3. Liquidity analysis: Equal lows/highs, FVGs, displacement candles
4. Market structure: BOS (continuation) vs CHOCH (reversal)
5. Displacement: 15%+ drop <5 min = EXIT, 30%+ = EXIT EVERYTHING

SENSITIVITY: ${sensitivityNote}
${prevContext}
${ctxNote}

RESPONSE FORMAT (strict JSON):
{
  "context": { "app": "detected app", "pair": "TOKEN/USDT", "timeframe": "1m/5m/1h/1d", "price": "$exact_current_price", "exchange": "exchange name" },
  "quickVerdict": { "action": "BUY_NOW|SELL_NOW|HOLD|EXIT_NOW|WAIT|NONE", "urgency": "immediate|soon|watch", "message": "ACTION | PRICE | PATTERN | CONFIRMATIONS | STOP | TARGET | R:R | CONFIDENCE%", "confidence": 87 },
  "fractalAnalysis": { "currentWave": "Wave description", "structureType": "Pattern type", "liquiditySweep": false, "fairValueGaps": [], "fractalRepetitions": 0, "marketStructure": "structure", "confirmations": { "structure": "level", "execution": "trigger" }, "patternStrikes": 0, "riskReward": "R:R" },
  "overlays": [{ "type": "zone|line|label|arrow|price_level", "position": "position", "color": "color", "text": "text", "subtext": "optional", "size": "size" }],
  "alerts": [{ "type": "BUY|SELL|WARNING|MONITOR", "severity": "critical|high|medium", "confidence": 87, "title": "title", "reasoning": ["reasons"], "action": "action", "entry": "$price", "stopLoss": "$price", "takeProfit": "$price", "validFor": "time" }],
  "observations": [],
  "privacyWarning": null,
  "changes": []
}

CRITICAL RULES:
1. ONLY trade Sweep-Reclaim, Break-Retest, or Range-Fade
2. REQUIRE 2 confirmations (structure + execution)
3. ALWAYS calculate R:R. If < 1.5R, do NOT recommend entry
4. If unclear → action: "WAIT"
5. Be MINIMAL — no filler

Analyze the screen frame now. Return ONLY valid JSON.`;
}

async function handleChat(message: string, context: string, previousAlerts: any[], mode: string, corsHeaders: Record<string, string>, brainContext: string = "") {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ observations: ["AI unavailable"], quickVerdict: { action: "NONE", urgency: "watch", message: "", confidence: 0 } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const modeDescriptions: Record<string, string> = {
    trading: "a Nestal Fractal trading intelligence assistant",
    coding: "a Senior Principal Engineer code review assistant",
    design: "a Senior UI/UX Design Critic",
    finance: "a Senior Financial Analyst",
    writing: "a Senior Editor and writing coach",
    research: "a Research Intelligence Analyst",
    healthcare: "a Clinical Documentation Assistant (advisory only)",
    education: "an Intelligent Tutoring Assistant",
    music: "a Music Production Engineer",
    gaming: "a Game Development QA Engineer",
    email: "an Email Intelligence Assistant",
    general: "a universal screen intelligence assistant",
  };

  const roleDesc = modeDescriptions[mode] || modeDescriptions.general;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: `You are Aureon Cross — ${roleDesc} embedded in the user's browser. Be direct, surgical, no filler. Context: ${context || "none"}\nRecent alerts: ${JSON.stringify(previousAlerts?.slice(-3) || [])}${brainContext}` },
        { role: "user", content: message },
      ],
    }),
  });

  if (!resp.ok) {
    return new Response(JSON.stringify({ observations: ["Chat unavailable"] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data = await resp.json();
  const reply = data.choices?.[0]?.message?.content || "No response.";
  return new Response(JSON.stringify({ observations: [reply], quickVerdict: { action: "NONE", urgency: "watch", message: "", confidence: 0 } }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function callGeminiDirect(apiKey: string, prompt: string, frame: string): Promise<any | null> {
  const base64Data = frame.includes(",") ? frame.split(",")[1] : frame;
  const models = ["gemini-2.5-flash", "gemini-2.0-flash"];

  for (const model of models) {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64Data } },
          ]}],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2000, responseMimeType: "application/json" },
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        return parseAnalysis(rawText);
      }
    } catch (e) {
      console.warn(`${model} failed:`, e);
    }
  }
  return null;
}

async function callLovableAI(apiKey: string, prompt: string, frame: string): Promise<any | null> {
  const base64Data = frame.includes(",") ? frame.split(",")[1] : frame;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Data}` } },
          ],
        }],
        response_format: { type: "json_object" },
      }),
    });

    if (resp.ok) {
      const data = await resp.json();
      const rawText = data.choices?.[0]?.message?.content || "{}";
      return parseAnalysis(rawText);
    } else {
      const errText = await resp.text();
      console.error("Lovable AI error:", resp.status, errText.slice(0, 200));
    }
  } catch (e) {
    console.error("Lovable AI call failed:", e);
  }
  return null;
}

function parseAnalysis(rawText: string): any {
  try {
    return JSON.parse(rawText);
  } catch {
    const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    return { context: {}, alerts: [], observations: [rawText], privacyWarning: null, changes: [] };
  }
}
