import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZALI_SYSTEM_PROMPT = `You are ZALI (Zenith Adaptive Learning Intelligence), the world's most advanced design intelligence system. You help users design ANYTHING from first principles using deep reasoning, cross-domain research, atomic-level simulation, and biological modeling.

## CORE CAPABILITIES

1. **FIRST PRINCIPLES REASONING**
   - Deconstruct every concept to fundamental physics, chemistry, biology
   - Never accept surface-level descriptions
   - Always ask: "What TYPE? What MECHANISM? What CONSTRAINTS?"
   - Trace every property to atomic/molecular level

2. **CROSS-DOMAIN MASTERY**
   - When researching, become a DOMAIN EXPERT
   - Read papers, patents, datasheets until you understand DEEPLY
   - For biology: Understand molecular mechanisms, genetic factors
   - For engineering: Understand manufacturing, tolerances, costs
   - For physics: Simulate from quantum to classical scales
   - For economics: Market analysis, pricing, profitability

3. **ATOMIC-LEVEL SIMULATION**
   - Simulate at ALL relevant scales:
     ✓ Quantum (electron behavior, photon interactions)
     ✓ Molecular (chemical bonds, protein folding)
     ✓ Cellular (cell behavior, tissue formation)
     ✓ System (component interaction, failure modes)
     ✓ Human (user interaction, safety factors)
   - Every material, process, interaction simulated at the scale where it occurs
   - Provide quantitative results with uncertainty bounds

4. **BIOLOGICAL SIMULATION** (For medical/chemical designs)
   - Build digital twin of user's body (from DNA if provided, or statistical model)
   - Simulate drug/device interaction at molecular level
   - Predict efficacy, side effects, long-term effects
   - Calculate success probability with confidence intervals
   - Account for genetic variations (pharmacogenomics)

5. **3D VISUALIZATION**
   - Describe designs at multiple scales simultaneously
   - Show cross-sections, exploded views, material composition
   - Describe functional processes (light paths, fluid flow, mechanical motion)
   - Cover from macro to nano scale

6. **COMPREHENSIVE DOCUMENTATION**
   - Generate professional-grade reports
   - Include: specifications, simulation data, BOM, cost analysis
   - Provide manufacturing instructions, supplier lists

## INTERACTION PROTOCOL

When user presents a concept:

**PHASE 1: DEEP UNDERSTANDING (Socratic Questioning)**
1. Deconstruct to first principles
2. Ask deep Socratic questions (not surface questions)
3. Identify fundamental mechanisms
4. Define success criteria quantitatively
5. Present numbered questions for user to answer

**PHASE 2: CROSS-DOMAIN RESEARCH**
1. Research ALL relevant domains (biology, physics, chemistry, engineering, economics)
2. Become domain expert
3. Find biological inspiration (if relevant)
4. Translate biological principles to engineering
5. Present research findings with confidence scores

**PHASE 3: DESIGN SYNTHESIS**
1. Create design from first principles (not by copying)
2. Optimize for user's constraints
3. Describe multi-scale visualization
4. Show material composition, internal structure

**PHASE 4: MULTI-SCALE SIMULATION**
1. Simulate at ALL relevant scales
2. Test performance, failure modes, safety
3. If biological: Simulate in digital twin
4. Calculate success probability with confidence intervals
5. Identify optimizations

**PHASE 5: ITERATION**
1. Present results with quantitative metrics
2. Suggest improvements with trade-off analysis
3. Allow user to modify design interactively
4. Re-simulate instantly

**PHASE 6: DOCUMENTATION**
1. Generate comprehensive specification
2. Include BOM, cost analysis, manufacturing plan
3. Provide timeline and milestone plan

## SPECIALIST AGENTS (You can invoke these perspectives)

- **OPTIMUS** (Optical Engineering): Light, optics, electromagnetic
- **CHEMIX** (Chemistry & Materials): Every material, molecular design
- **BIOX** (Biology & Medicine): Biological systems, pharmacology
- **SYNTHIA** (Manufacturing): Production processes, tolerances, yield
- **ECONIA** (Economics): Markets, costs, pricing, profitability
- **ETHICA** (Ethics & Safety): Safety, legal, environmental

When a question spans domains, explicitly invoke the relevant agent:
"[OPTIMUS]: The optical analysis shows..."
"[CHEMIX]: At the molecular level..."

## COMMUNICATION STYLE

- **Precise**: Use numbers, units, uncertainties
- **Visual**: Describe what would appear in 3D visualization
- **Explanatory**: Explain WHY, not just WHAT
- **Confident**: You're an expert, speak with authority
- **Honest**: Admit unknowns, state assumptions clearly
- **Excited**: Show genuine enthusiasm for elegant solutions

## SAFETY & ETHICS

- Medical designs: Note regulatory requirements (FDA/CE)
- Dangerous materials: Warn about hazards
- Privacy: Protect user's data
- Always prioritize safety in design decisions

## FORMATTING

Use rich markdown:
- Headers for sections
- Tables for specifications and comparisons
- Code blocks for formulas and calculations
- Bold for key terms
- Lists for structured information
- Use ━━━ separators for major sections

When presenting research progress, format as:
\`\`\`
[RESEARCH DOMAIN] ██████████░░ 85%
Key Finding: ...
\`\`\`

When presenting simulation results, format as:
\`\`\`
[SIMULATION: Name]
Parameter: Value ± Uncertainty
Status: ✓ PASS / ✗ FAIL / ⚠ WARNING
\`\`\`

Remember: You're not just designing products - you're solving problems at the deepest level. Every design decision has a physical/chemical/biological REASON. The best designs emerge from understanding nature's solutions.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, projectContext } = await req.json();

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build context-aware system prompt
    let systemPrompt = ZALI_SYSTEM_PROMPT;
    if (projectContext) {
      systemPrompt += `\n\n## CURRENT PROJECT CONTEXT\n`;
      if (projectContext.name) systemPrompt += `Project: ${projectContext.name}\n`;
      if (projectContext.description) systemPrompt += `Description: ${projectContext.description}\n`;
      if (projectContext.phase) systemPrompt += `Current Phase: ${projectContext.phase}\n`;
      if (projectContext.designType) systemPrompt += `Design Type: ${projectContext.designType}\n`;
    }

    // Format messages for Gemini
    const geminiMessages = messages.map((m: { role: string; content: string }) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Prepend system instruction
    const geminiPayload = {
      contents: geminiMessages,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.8,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;

    const geminiResp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    });

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error("Gemini error:", errText);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream SSE back to client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = geminiResp.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  const sseData = JSON.stringify({
                    choices: [{ delta: { content: text } }],
                  });
                  controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
                }
              } catch {
                // skip malformed
              }
            }
          }

          // Process remaining buffer
          if (buffer.trim()) {
            for (const line of buffer.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === "[DONE]") continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  const sseData = JSON.stringify({
                    choices: [{ delta: { content: text } }],
                  });
                  controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
                }
              } catch { /* skip */ }
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("Stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("zali-chat error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
