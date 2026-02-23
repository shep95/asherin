import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => console.log(`[BRIEFING] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

// ── Multi-Source Intelligence (from NOMAD) ──────────────────────────────────

async function searchDDGHtml(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
      },
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
      if (url.includes("duckduckgo.com/l/")) {
        const uddg = url.match(/uddg=([^&]*)/);
        if (uddg) url = decodeURIComponent(uddg[1]);
      }
      if (title) results.push({ title, url, snippet });
    }
    return results;
  } catch { return []; }
}

async function searchDDGLite(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const resp = await fetch(`https://lite.duckduckgo.com/lite/`, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "text/html",
      },
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
      if (url.includes("duckduckgo.com/l/")) {
        const uddg = url.match(/uddg=([^&]*)/);
        if (uddg) url = decodeURIComponent(uddg[1]);
      }
      if (title && url) links.push({ url, title });
    }
    const snippets: string[] = [];
    while ((m = snippetRegex.exec(html)) !== null) {
      snippets.push(m[1].replace(/<[^>]*>/g, "").trim());
    }
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
    if (data.RelatedTopics?.length) {
      return data.RelatedTopics.slice(0, 3).map((t: any) => t.Text || "").filter(Boolean).join("\n");
    }
    return "";
  } catch { return ""; }
}

// Robust search: tries HTML endpoint first, falls back to Lite, then Instant
async function robustSearch(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  let results = await searchDDGHtml(query);
  if (results.length === 0) {
    results = await searchDDGLite(query);
  }
  return results;
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
    // Support both direct auth and cron-triggered (userId in body)
    let userId: string;
    let bodyData: any = {};
    try { bodyData = await req.clone().json(); } catch {}

    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    
    if (bodyData?.userId && authHeader?.includes(serviceKey)) {
      // Cron job calling with service role key and userId in body
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

    // Fetch profile
    const { data: profile } = await supabaseClient
      .from("briefing_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!profile) throw new Error("No briefing profile configured. Set up your Intelligence Briefing first.");

    log("Profile loaded", { industry: profile.industry, competitors: profile.competitors?.length });

    // Build search queries from profile — multi-vector approach
    const searches: { category: string; query: string }[] = [];

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
    }
    if (profile.key_markets?.length) {
      for (const market of profile.key_markets.slice(0, 3)) {
        searches.push({ category: "market", query: `${market} market trends economic news` });
      }
    }
    if (profile.tracked_people?.length) {
      for (const person of profile.tracked_people.slice(0, 5)) {
        searches.push({ category: "person", query: `"${person}" latest news statement` });
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
      }
    }

    log("Running searches", { count: searches.length });

    // Run all searches in parallel using robust multi-endpoint approach
    const searchResults = await Promise.all(
      searches.map(async (s) => {
        const results = await robustSearch(s.query);
        return { ...s, results };
      })
    );

    // Also get instant answers for key topics
    const instantAnswers: string[] = [];
    const instantQueries = [
      profile.industry ? `${profile.industry} industry` : "",
      ...(profile.competitors?.slice(0, 3) || []),
    ].filter(Boolean);

    const instantResults = await Promise.all(
      instantQueries.map(q => queryDDGInstant(q))
    );
    instantResults.forEach(r => { if (r) instantAnswers.push(r); });

    const totalSources = searchResults.reduce((acc, s) => acc + s.results.length, 0) + instantAnswers.length;
    log("Searches complete", { totalSources, searchSources: searchResults.reduce((acc, s) => acc + s.results.length, 0), instantAnswers: instantAnswers.length });

    // Build intelligence context with token truncation
    const MAX_CONTEXT_CHARS = 40000; // ~10k tokens safe limit
    let contextCharsUsed = 0;
    const contextBlocks: string[] = [];

    for (const s of searchResults.filter(s => s.results.length > 0)) {
      const resultText = s.results.map((r) => `- ${r.title}: ${r.snippet} [${r.url}]`).join("\n");
      const block = `[${s.category.toUpperCase()}] Query: "${s.query}"\n${resultText}`;
      if (contextCharsUsed + block.length > MAX_CONTEXT_CHARS) break;
      contextBlocks.push(block);
      contextCharsUsed += block.length;
    }

    const contextBlocksJoined = contextBlocks.join("\n\n");

    const instantBlock = instantAnswers.length
      ? `\n\n[INSTANT INTELLIGENCE]\n${instantAnswers.join("\n")}`
      : "";

    // Generate briefing with Gemini
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) throw new Error("GEMINI_API_KEY not set");

    const now = new Date();
    const today = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const yesterday = new Date(now.getTime() - 86400000).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const prompt = `You are AUREON Intelligence, powered by the NOMAD intelligence engine. You are generating a personalized daily intelligence briefing from real gathered data.

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

RAW INTELLIGENCE DATA (gathered by NOMAD from ${totalSources} sources):
${contextBlocksJoined}${instantBlock}

${totalSources === 0 ? "NOTE: No search results were returned. Generate the briefing based on your training knowledge of recent events related to the user's profile. Clearly mark items as 'Based on available intelligence' rather than citing specific sources." : ""}

Generate a structured intelligence briefing covering the last 24-48 hours (${yesterday} through ${today}). 

IMPORTANT: Start your response with a single-line TITLE on its own, formatted as:
TITLE: [A short, unique, specific headline summarizing the most important development today, e.g. "EU AI Act Enforcement Begins as Tech Giants Scramble" or "OpenAI Launches Enterprise Tier — Market Shakes Up"]

Then format the rest in markdown exactly like this:

# AUREON MORNING BRIEF — ${today}

## 🔴 CRITICAL (requires attention today)
List items that need immediate action or awareness. Include source links when available. If nothing critical, say "No critical items identified — all monitored vectors are stable."

## 🟡 SIGNIFICANT (worth knowing)
Important developments that don't need immediate action. Include analysis and source links. Cover competitor moves, industry shifts, and tracked people activities.

## 🔵 MONITORING (background awareness)  
Broader trends and developments in their space. Include regulatory and market context.

## 📊 MARKET SIGNALS
Any relevant market, funding, or investment data. Include competitor funding rounds, IPO activity, and industry ETF movements if relevant.

---
*Generated by NOMAD Intelligence Engine from ${totalSources} sources checked.*

RULES:
- Be specific and actionable. Executives read this at 6 AM — make every line count.
- If you have real source data, cite it with [links].
- If sources are limited, use your training knowledge of recent events but mark it clearly.
- NEVER say "No items found" for every section — always provide useful intelligence context.
- Include competitor analysis even from general knowledge if specific sources are thin.
- Keep each item concise (2-3 lines max) but actionable.
- End significant items with "[Implication for ${profile.company_name || "your business"}]" analysis.`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 6000 },
        }),
      }
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      throw new Error(`Gemini error: ${errText}`);
    }

    const geminiData = await geminiResp.json();
    const rawContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Failed to generate briefing.";

    // Extract dynamic title from AI response
    let briefingTitle = `Morning Brief — ${today}`;
    let briefingContent = rawContent;
    const titleMatch = rawContent.match(/^TITLE:\s*(.+)/m);
    if (titleMatch) {
      briefingTitle = titleMatch[1].trim();
      briefingContent = rawContent.replace(/^TITLE:\s*.+\n*/m, "").trim();
    }

    // Count items by severity
    const criticalCount = (briefingContent.match(/^[-→•]/gm) || []).length;

    // Save report to DB
    const { data: report, error: insertError } = await supabaseClient
      .from("briefing_reports")
      .insert({
        user_id: userId,
        title: briefingTitle,
        content: briefingContent,
        sources_checked: totalSources,
        critical_items: criticalCount,
        significant_items: 0,
        monitoring_items: 0,
      })
      .select()
      .single();

    if (insertError) log("Insert error", insertError);

    log("Briefing generated", { reportId: report?.id, sources: totalSources });

    return new Response(JSON.stringify({ briefing: briefingContent, sources_checked: totalSources, report_id: report?.id }), {
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
