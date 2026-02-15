import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => console.log(`[BRIEFING] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

async function ddgSearch(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const resp = await fetch(`https://lite.duckduckgo.com/lite/`, {
      method: "POST",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html",
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No auth header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Auth failed");
    const userId = userData.user.id;
    log("User authenticated", { userId });

    // Fetch profile
    const { data: profile } = await supabaseClient
      .from("briefing_profiles")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (!profile) throw new Error("No briefing profile configured. Set up your Intelligence Briefing first.");

    log("Profile loaded", { industry: profile.industry, competitors: profile.competitors?.length });

    // Build search queries from profile
    const searches: { category: string; query: string }[] = [];

    if (profile.company_name) {
      searches.push({ category: "company_mentions", query: `"${profile.company_name}" news today OR yesterday` });
    }
    if (profile.competitors?.length) {
      for (const comp of profile.competitors.slice(0, 5)) {
        searches.push({ category: "competitor", query: `${comp} news funding launch latest 2026` });
      }
    }
    if (profile.industry) {
      searches.push({ category: "industry", query: `${profile.industry} industry news today OR yesterday 2026` });
      searches.push({ category: "regulation", query: `${profile.industry} regulation policy bill latest 2026` });
    }
    if (profile.key_markets?.length) {
      for (const market of profile.key_markets.slice(0, 3)) {
        searches.push({ category: "market", query: `${market} market trends funding latest 2026` });
      }
    }
    if (profile.tracked_people?.length) {
      for (const person of profile.tracked_people.slice(0, 3)) {
        searches.push({ category: "person", query: `"${person}" news statement latest 2026` });
      }
    }
    if (profile.regulatory_bodies?.length) {
      for (const body of profile.regulatory_bodies.slice(0, 3)) {
        searches.push({ category: "regulatory", query: `${body} ruling update announcement latest 2026` });
      }
    }
    if (profile.custom_topics?.length) {
      for (const topic of profile.custom_topics.slice(0, 3)) {
        searches.push({ category: "custom", query: `${topic} latest news 2026` });
      }
    }

    log("Running searches", { count: searches.length });

    // Run all searches in parallel
    const searchResults = await Promise.all(
      searches.map(async (s) => {
        const results = await ddgSearch(s.query);
        return { ...s, results };
      })
    );

    const totalSources = searchResults.reduce((acc, s) => acc + s.results.length, 0);
    log("Searches complete", { totalSources });

    // Build intelligence context
    const contextBlocks = searchResults.map((s) => {
      const resultText = s.results.map((r) => `- ${r.title}: ${r.snippet} [${r.url}]`).join("\n");
      return `[${s.category.toUpperCase()}] Query: "${s.query}"\n${resultText || "No results found."}`;
    }).join("\n\n");

    // Generate briefing with Gemini
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) throw new Error("GEMINI_API_KEY not set");

    const now = new Date();
    const today = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const yesterday = new Date(now.getTime() - 86400000).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    const prompt = `You are AUREON Intelligence, generating a personalized daily intelligence briefing.

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

RAW INTELLIGENCE DATA:
${contextBlocks}

Generate a structured intelligence briefing covering the last 24-48 hours (${yesterday} through ${today}). Format it in markdown exactly like this:

# AUREON MORNING BRIEF — ${today}

## 🔴 CRITICAL (requires attention today)
List items that need immediate action or awareness. Include source links. If nothing critical, say "No critical items today."

## 🟡 SIGNIFICANT (worth knowing)
Important developments that don't need immediate action. Include analysis and source links.

## 🔵 MONITORING (background awareness)
Broader trends and developments in their space.

## 📊 MARKET SIGNALS
Any relevant market or funding data found.

---
*Generated from ${totalSources} sources checked this morning.*

Be specific, cite sources with [links], and prioritize relevance to the user's profile. Include news from both today and yesterday to ensure comprehensive coverage. If data is limited, say so honestly rather than fabricating. Keep each item concise but actionable.`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      throw new Error(`Gemini error: ${errText}`);
    }

    const geminiData = await geminiResp.json();
    const briefingContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "Failed to generate briefing.";

    // Count items by severity
    const criticalCount = (briefingContent.match(/^→/gm) || []).length;
    const significantCount = Math.max(0, (briefingContent.split("SIGNIFICANT")[1]?.match(/^→/gm) || []).length);

    // Save report to DB
    const { data: report, error: insertError } = await supabaseClient
      .from("briefing_reports")
      .insert({
        user_id: userId,
        title: `Morning Brief — ${today}`,
        content: briefingContent,
        sources_checked: totalSources,
        critical_items: criticalCount,
        significant_items: significantCount,
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
