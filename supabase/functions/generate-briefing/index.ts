import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => console.log(`[BRIEFING] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

// ── Multi-Source Search ─────────────────────────────────────────────────────

async function searchDDGHtml(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Accept": "text/html" },
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const results: { title: string; url: string; snippet: string }[] = [];
    const blocks = html.split(/class="result\s/);
    for (let i = 1; i < blocks.length && results.length < 5; i++) {
      const titleMatch = blocks[i].match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = blocks[i].match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const urlMatch = blocks[i].match(/class="result__url"[^>]*href="([^"]*)"/) || blocks[i].match(/class="result__a"[^>]*href="([^"]*)"/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, "").trim() : "";
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, "").trim() : "";
      let url = urlMatch ? urlMatch[1].trim() : "";
      if (url.includes("duckduckgo.com/l/")) { const uddg = url.match(/uddg=([^&]*)/); if (uddg) url = decodeURIComponent(uddg[1]); }
      if (title) results.push({ title, url, snippet });
    }
    return results;
  } catch { return []; }
}

async function searchDDGLite(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const resp = await fetch(`https://lite.duckduckgo.com/lite/`, {
      method: "POST",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36", "Content-Type": "application/x-www-form-urlencoded", "Accept": "text/html" },
      body: `q=${encodeURIComponent(query)}`,
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const results: { title: string; url: string; snippet: string }[] = [];
    const linkRegex = /class='result-link'[^>]*href="([^"]*)"[^>]*>([^<]*(?:<[^>]*>[^<]*)*)<\/a>/gi;
    const snippetRegex = /class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi;
    const links: { url: string; title: string }[] = [];
    let m;
    while ((m = linkRegex.exec(html)) !== null) {
      let url = m[1].trim();
      const title = m[2].replace(/<[^>]*>/g, "").trim();
      if (url.includes("duckduckgo.com/l/")) { const uddg = url.match(/uddg=([^&]*)/); if (uddg) url = decodeURIComponent(uddg[1]); }
      if (title && url) links.push({ url, title });
    }
    const snippets: string[] = [];
    while ((m = snippetRegex.exec(html)) !== null) { snippets.push(m[1].replace(/<[^>]*>/g, "").trim()); }
    for (let i = 0; i < Math.min(links.length, 5); i++) {
      results.push({ title: links[i].title, url: links[i].url, snippet: snippets[i] || "" });
    }
    return results;
  } catch { return []; }
}

async function queryDDGInstant(query: string): Promise<string> {
  try {
    const resp = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
    if (!resp.ok) return "";
    const data = await resp.json();
    if (data.AbstractText) return `${data.AbstractText} (Source: ${data.AbstractSource})`;
    if (data.Answer) return data.Answer;
    if (data.RelatedTopics?.length) return data.RelatedTopics.slice(0, 3).map((t: any) => t.Text || "").filter(Boolean).join("\n");
    return "";
  } catch { return ""; }
}

async function robustSearch(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  let results = await searchDDGHtml(query);
  if (results.length === 0) results = await searchDDGLite(query);
  return results;
}

// ── Identify Parties & Perspectives ─────────────────────────────────────────

function buildMultiPerspectiveSearches(profile: any): { category: string; query: string; perspective?: string }[] {
  const searches: { category: string; query: string; perspective?: string }[] = [];

  // Standard profile-based searches
  if (profile.company_name) {
    searches.push({ category: "company_mentions", query: `"${profile.company_name}" news` });
    searches.push({ category: "company_mentions", query: `${profile.company_name} latest updates` });
  }
  if (profile.competitors?.length) {
    for (const comp of profile.competitors.slice(0, 6)) {
      searches.push({ category: "competitor", query: `${comp} news latest announcement` });
    }
  }
  if (profile.industry) {
    searches.push({ category: "industry", query: `${profile.industry} industry news latest` });
    searches.push({ category: "industry", query: `${profile.industry} trends developments` });
    searches.push({ category: "regulation", query: `${profile.industry} regulation policy government` });
    // Multi-perspective: search for critical views
    searches.push({ category: "industry_critical", query: `${profile.industry} criticism concerns risks`, perspective: "critical" });
    searches.push({ category: "industry_bullish", query: `${profile.industry} growth opportunity bullish`, perspective: "optimistic" });
  }
  if (profile.key_markets?.length) {
    for (const market of profile.key_markets.slice(0, 3)) {
      searches.push({ category: "market", query: `${market} market trends economic news` });
      // Multi-perspective: opposing views
      searches.push({ category: "market_risk", query: `${market} market risk downturn concerns`, perspective: "bearish" });
    }
  }
  if (profile.tracked_people?.length) {
    for (const person of profile.tracked_people.slice(0, 5)) {
      searches.push({ category: "person", query: `"${person}" latest news statement` });
      // Criticism/opposition perspective
      searches.push({ category: "person_critical", query: `"${person}" controversy criticism opposition`, perspective: "critical" });
    }
  }
  if (profile.regulatory_bodies?.length) {
    for (const body of profile.regulatory_bodies.slice(0, 3)) {
      searches.push({ category: "regulatory", query: `${body} ruling update latest` });
    }
  }
  if (profile.custom_topics?.length) {
    for (const topic of profile.custom_topics.slice(0, 3)) {
      searches.push({ category: "custom", query: `${topic} latest news` });
      // Counter-narrative
      searches.push({ category: "custom_counter", query: `${topic} opposing view criticism debate`, perspective: "counter" });
    }
  }

  // Cross-validation: search for fact-check and independent analysis
  if (profile.company_name) {
    searches.push({ category: "fact_check", query: `${profile.company_name} fact check analysis independent review`, perspective: "validation" });
  }
  if (profile.industry) {
    searches.push({ category: "fact_check", query: `${profile.industry} independent analysis fact check`, perspective: "validation" });
  }

  return searches;
}

// ── Main Handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    let userId: string;
    let bodyData: any = {};
    try { bodyData = await req.clone().json(); } catch {}

    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (bodyData?.userId && authHeader?.includes(serviceKey)) {
      userId = bodyData.userId;
      log("Cron-triggered generation", { userId });
    } else if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
      if (userError || !userData.user) throw new Error("Auth failed");
      userId = userData.user.id;
      log("User authenticated", { userId });
    } else {
      throw new Error("No auth header");
    }

    const { data: profile } = await supabaseClient.from("briefing_profiles").select("*").eq("user_id", userId).single();
    if (!profile) throw new Error("No briefing profile configured. Set up your Intelligence Briefing first.");

    log("Profile loaded", { industry: profile.industry, competitors: profile.competitors?.length });

    // ── Multi-Perspective Collection ──────────────────────────────────────
    const searches = buildMultiPerspectiveSearches(profile);
    log("Running multi-perspective searches", { count: searches.length });

    const searchResults = await Promise.all(
      searches.map(async (s) => {
        const results = await robustSearch(s.query);
        return { ...s, results };
      })
    );

    // Instant answers for key topics
    const instantAnswers: string[] = [];
    const instantQueries = [
      profile.industry ? `${profile.industry} industry` : "",
      ...(profile.competitors?.slice(0, 3) || []),
    ].filter(Boolean);
    const instantResults = await Promise.all(instantQueries.map(q => queryDDGInstant(q)));
    instantResults.forEach(r => { if (r) instantAnswers.push(r); });

    const totalSources = searchResults.reduce((acc, s) => acc + s.results.length, 0) + instantAnswers.length;
    log("Searches complete", { totalSources });

    // ── Build Context Blocks with Perspective Tags ────────────────────────
    const MAX_CONTEXT_CHARS = 45000;
    let contextCharsUsed = 0;
    const contextBlocks: string[] = [];

    // Separate primary vs counter/critical sources
    const primarySources = searchResults.filter(s => !s.perspective);
    const criticalSources = searchResults.filter(s => s.perspective === "critical" || s.perspective === "counter" || s.perspective === "bearish");
    const validationSources = searchResults.filter(s => s.perspective === "validation");
    const optimisticSources = searchResults.filter(s => s.perspective === "optimistic");

    // Primary intelligence
    for (const s of primarySources.filter(s => s.results.length > 0)) {
      const resultText = s.results.map(r => `- ${r.title}: ${r.snippet} [${r.url}]`).join("\n");
      const block = `[PRIMARY/${s.category.toUpperCase()}] Query: "${s.query}"\n${resultText}`;
      if (contextCharsUsed + block.length > MAX_CONTEXT_CHARS) break;
      contextBlocks.push(block);
      contextCharsUsed += block.length;
    }

    // Counter-narratives / critical views
    for (const s of criticalSources.filter(s => s.results.length > 0)) {
      const resultText = s.results.map(r => `- ${r.title}: ${r.snippet} [${r.url}]`).join("\n");
      const block = `[COUNTER-NARRATIVE/${s.category.toUpperCase()}] Perspective: ${s.perspective}\n${resultText}`;
      if (contextCharsUsed + block.length > MAX_CONTEXT_CHARS) break;
      contextBlocks.push(block);
      contextCharsUsed += block.length;
    }

    // Optimistic views
    for (const s of optimisticSources.filter(s => s.results.length > 0)) {
      const resultText = s.results.map(r => `- ${r.title}: ${r.snippet} [${r.url}]`).join("\n");
      const block = `[BULLISH/${s.category.toUpperCase()}] Perspective: ${s.perspective}\n${resultText}`;
      if (contextCharsUsed + block.length > MAX_CONTEXT_CHARS) break;
      contextBlocks.push(block);
      contextCharsUsed += block.length;
    }

    // Validation / fact-check sources
    for (const s of validationSources.filter(s => s.results.length > 0)) {
      const resultText = s.results.map(r => `- ${r.title}: ${r.snippet} [${r.url}]`).join("\n");
      const block = `[VALIDATION/${s.category.toUpperCase()}] Cross-reference check:\n${resultText}`;
      if (contextCharsUsed + block.length > MAX_CONTEXT_CHARS) break;
      contextBlocks.push(block);
      contextCharsUsed += block.length;
    }

    const contextBlocksJoined = contextBlocks.join("\n\n");
    const instantBlock = instantAnswers.length ? `\n\n[INSTANT INTELLIGENCE]\n${instantAnswers.join("\n")}` : "";

    // ── Gemini Synthesis with Multi-Perspective Analysis ──────────────────
    const geminiKey = Deno.env.get("GEMINI_API_KEY_APP");
    if (!geminiKey) throw new Error("GEMINI_API_KEY_APP not set");

    const now = new Date();
    const today = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const yesterday = new Date(now.getTime() - 86400000).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    // ── Fetch Active Brains for User ─────────────────────────────────────────
    let brainContext = "";
    try {
      const { data: activeBrains } = await supabaseClient
        .from("brains")
        .select("name, system_prompt")
        .eq("user_id", userId)
        .eq("is_active", true);
      if (activeBrains && activeBrains.length > 0) {
        brainContext = `\n\nUSER ACTIVE BRAIN INSTRUCTIONS (apply these personality and formatting rules to your output):\n` +
          activeBrains.map(b => `[Brain: ${b.name}]\n${b.system_prompt || ""}`).join("\n\n");
      }
    } catch (e) {
      log("Brain fetch error (non-fatal)", e);
    }

    const prompt = `You are AUREON Intelligence — the intelligence engine powering the Aureon platform. You operate under the Zophiel Ghost Chain Protocol.

## YOUR COMMUNICATION IDENTITY
You are NOT a generic AI. You are ZOPHIEL — precise, authoritative, zero-fluff. Your output must read like a senior intelligence analyst's morning brief, not a chatbot summary.

VOICE RULES:
- Direct and declarative. No hedging language ("it seems", "it appears", "arguably").
- Use short, punchy sentences for critical items. Longer analysis only where depth is required.
- Bold the important parts. Use hierarchy ruthlessly — the reader should get 80% of value from headers and bold text alone.
- No filler paragraphs. Every sentence must carry intelligence value.
- Use precise language: "confirmed", "disputed", "unverified", "single-source", "cross-validated" — not vague qualifiers.
- When presenting contradictions, be direct: "Source A says X. Source B says Y. The evidence supports Y because..."
- Implication lines must be actionable: not "this could affect your business" but "if you hold positions in X, reduce exposure by Thursday."
- Format numbers cleanly: $4.2B not $4,200,000,000. Use % not "percent".
- Never use emoji in the briefing body. Professional tone throughout.
- Section transitions should be invisible — no "let's now look at" or "moving on to".
${brainContext}

USER PROFILE:
- Company: ${profile.company_name || "Not specified"}
- Industry: ${profile.industry || "Not specified"}
- Competitors: ${profile.competitors?.join(", ") || "None listed"}
- Key Markets: ${profile.key_markets?.join(", ") || "None listed"}
- Technology Stack: ${profile.technology_stack?.join(", ") || "None listed"}
- Investment Interests: ${profile.investment_interests?.join(", ") || "None listed"}
- Tracked People: ${profile.tracked_people?.join(", ") || "None listed"}
- Regulatory Bodies: ${profile.regulatory_bodies?.join(", ") || "None listed"}
- Custom Topics: ${profile.custom_topics?.join(", ") || "None listed"}

RAW INTELLIGENCE DATA (gathered from ${totalSources} sources with multi-perspective collection):
${contextBlocksJoined}${instantBlock}

${totalSources === 0 ? "NOTE: No search results were returned. Generate the briefing based on your training knowledge. Clearly mark items as 'Based on available intelligence'." : ""}

ANALYSIS PROTOCOL:

1. CROSS-VALIDATION: For every major claim, check if PRIMARY sources and COUNTER-NARRATIVE sources agree or disagree. If they agree, it's likely true. If only one side reports it, flag uncertainty.

2. TRUTH EXTRACTION LOGIC:
   - Claims made by MULTIPLE independent sources = HIGH confidence (85-100%)
   - Claims confirmed by VALIDATION/fact-check sources = HIGH confidence
   - Claims from PRIMARY only, no counter-narrative = MEDIUM confidence (50-84%)
   - Claims contradicted by COUNTER-NARRATIVE sources = FLAG as contested
   - Claims from single government/corporate source only = LOW confidence (below 50%)

3. NARRATIVE DETECTION: Identify when sources are pushing a narrative vs reporting facts:
   - Promotional language about own products/company = likely marketing, not intelligence
   - Criticism exclusively from competitors = potential competitive narrative
   - Unanimous reporting across independent outlets = likely factual

Generate a structured intelligence briefing covering ${yesterday} through ${today}.

IMPORTANT: Start with a single-line TITLE:
TITLE: [Specific headline about the most important verified development]

Then output the briefing in this EXACT structure with these EXACT section headers:

# AUREON INTELLIGENCE BRIEF — ${today}

## EXECUTIVE SUMMARY
3-4 sentences. Overall intelligence picture. State the number of sources analyzed and cross-validation confidence level.

## VERIFIED FACTS (Cross-Validated)
Items confirmed by multiple independent sources. Each item format:
- **[Fact]** — Truth Score: [X]% | Sources: [count] | [Brief analysis]

## CONTESTED CLAIMS
Items where sources disagree. Each item format:
- **[Claim]** — Claimed by: [who] | Disputed by: [who] | Likely truth: [assessment]

## PERSPECTIVE ANALYSIS

### Mainstream Narrative
What the dominant media/industry narrative is saying.

### Counter-Narrative
What critical/opposition sources are saying. Where do they diverge?

### Independent Assessment
AUREON's cross-validated conclusion — what's actually happening vs what's being reported.

## CRITICAL (Requires Attention Today)
Action items. Include truth scores.

## SIGNIFICANT (Worth Knowing)
Important but not urgent. Include source diversity score.

## MONITORING (Background)
Broader trends. Note narrative direction (bullish/bearish/neutral).

## MARKET & COMPETITIVE SIGNALS
Funding, M&A, market movements. Flag if single-source.

## INTELLIGENCE GAPS
What we COULDN'T verify. What topics had insufficient cross-validation. Recommended follow-up queries.

---
*Generated by AUREON Intelligence Engine | ${totalSources} sources | Cross-validated with counter-narrative analysis*

RULES:
- Be specific and actionable.
- Every claim MUST have a truth/confidence indicator.
- Flag single-source claims explicitly.
- When sources contradict, present BOTH sides and your assessed truth.
- Include "[Implication for ${profile.company_name || "your business"}]" after significant items.
- NEVER present marketing copy as intelligence.
- The PERSPECTIVE ANALYSIS section is mandatory — show the user HOW different sources frame the same events.`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 10000 },
        }),
      }
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      throw new Error(`Gemini error: ${errText}`);
    }

    const geminiData = await geminiResp.json();
    const rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Failed to generate briefing.";

    // Extract title
    let briefingTitle = `Intelligence Brief — ${today}`;
    let briefingContent = rawContent;
    const titleMatch = rawContent.match(/^TITLE:\s*(.+)/m);
    if (titleMatch) {
      briefingTitle = titleMatch[1].trim();
      briefingContent = rawContent.replace(/^TITLE:\s*.+\n*/m, "").trim();
    }

    // Count severity items
    const criticalCount = (briefingContent.match(/## CRITICAL/gi) || []).length > 0
      ? (briefingContent.split(/## CRITICAL/i)[1]?.split(/## /)[0]?.match(/^[-→•*]/gm) || []).length
      : 0;

    // Count perspectives collected
    const perspectiveCounts = {
      primary: primarySources.filter(s => s.results.length > 0).length,
      critical: criticalSources.filter(s => s.results.length > 0).length,
      validation: validationSources.filter(s => s.results.length > 0).length,
      optimistic: optimisticSources.filter(s => s.results.length > 0).length,
    };

    // Save report
    const { data: report, error: insertError } = await supabaseClient
      .from("briefing_reports")
      .insert({
        user_id: userId,
        title: briefingTitle,
        content: briefingContent,
        sources_checked: totalSources,
        critical_items: criticalCount,
        significant_items: perspectiveCounts.critical,
        monitoring_items: perspectiveCounts.validation,
      })
      .select()
      .single();

    if (insertError) log("Insert error", insertError);
    log("Briefing generated", { reportId: report?.id, sources: totalSources, perspectives: perspectiveCounts });

    return new Response(JSON.stringify({
      briefing: briefingContent,
      sources_checked: totalSources,
      report_id: report?.id,
      perspectives: perspectiveCounts,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
