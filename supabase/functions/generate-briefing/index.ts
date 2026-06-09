import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

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

// ── SearXNG Meta-Search for Briefing ────────────────────────────────────────
const SEARXNG_INSTANCES = [
  'https://search.bus-hit.me',
  'https://searx.tiekoetter.com',
  'https://search.ononoki.org',
  'https://searx.be',
];

async function searchSearXNG(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  for (const instance of SEARXNG_INSTANCES) {
    try {
      const resp = await fetch(`${instance}/search?q=${encodeURIComponent(query)}&format=json&engines=google,bing,brave&categories=general`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!resp.ok) continue;
      const json = await resp.json();
      if (!json.results?.length) continue;
      return json.results.slice(0, 8).map((r: any) => ({ title: r.title || '', url: r.url || '', snippet: r.content || '' }));
    } catch { continue; }
  }
  return [];
}

async function searchMojeek(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const resp = await fetch(`https://www.mojeek.com/search?q=${encodeURIComponent(query)}&fmt=json&t=8`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json.response?.results || []).slice(0, 6).map((r: any) => ({ title: r.title || '', url: r.url || '', snippet: r.desc || '' }));
  } catch { return []; }
}

async function robustSearch(query: string): Promise<{ title: string; url: string; snippet: string }[]> {
  // Multi-engine: DDG primary, SearXNG and Mojeek as supplements
  const [ddgHtml, searx, mojeek] = await Promise.allSettled([
    searchDDGHtml(query),
    searchSearXNG(query),
    searchMojeek(query),
  ]);
  
  const seen = new Set<string>();
  const all: { title: string; url: string; snippet: string }[] = [];
  for (const settled of [ddgHtml, searx, mojeek]) {
    if (settled.status !== 'fulfilled') continue;
    for (const r of settled.value) {
      const norm = r.url.replace(/\/$/, '').replace(/^https?:\/\/www\./, 'https://');
      if (!seen.has(norm)) { seen.add(norm); all.push(r); }
    }
  }
  
  // Fallback to DDG Lite if nothing found
  if (all.length === 0) return searchDDGLite(query);
  return all;
}

// ── Identify Parties & Build Comprehensive Intelligence Queries ──────────────

function buildMultiPerspectiveSearches(profile: any): { category: string; query: string; perspective?: string }[] {
  const searches: { category: string; query: string; perspective?: string }[] = [];
  const company = profile.company_name || "";
  const industry = profile.industry || "";

  // ── CORE: Company & Competitor Intelligence ────────────────────────────
  if (company) {
    searches.push({ category: "company_mentions", query: `"${company}" news` });
    searches.push({ category: "company_mentions", query: `${company} latest updates` });
    searches.push({ category: "fact_check", query: `${company} fact check analysis independent review`, perspective: "validation" });
  }
  if (profile.competitors?.length) {
    for (const comp of profile.competitors.slice(0, 6)) {
      searches.push({ category: "competitor", query: `${comp} news latest announcement` });
    }
  }

  // ── INDUSTRY: Multi-perspective ────────────────────────────────────────
  if (industry) {
    searches.push({ category: "industry", query: `${industry} industry news latest` });
    searches.push({ category: "industry", query: `${industry} trends developments` });
    searches.push({ category: "regulation", query: `${industry} regulation policy government` });
    searches.push({ category: "industry_critical", query: `${industry} criticism concerns risks`, perspective: "critical" });
    searches.push({ category: "industry_bullish", query: `${industry} growth opportunity bullish`, perspective: "optimistic" });
    searches.push({ category: "fact_check", query: `${industry} independent analysis fact check`, perspective: "validation" });
  }

  // ── MARKETS: Economic & Financial Intelligence ─────────────────────────
  if (profile.key_markets?.length) {
    for (const market of profile.key_markets.slice(0, 3)) {
      searches.push({ category: "market", query: `${market} market trends economic news` });
      searches.push({ category: "market_risk", query: `${market} market risk downturn concerns`, perspective: "bearish" });
      // Economic impact layer
      searches.push({ category: "economic_impact", query: `${market} stock market impact currency oil price` });
      searches.push({ category: "supply_chain", query: `${market} supply chain disruption trade route sanctions` });
    }
  }

  // ── PEOPLE: Tracked Individuals ────────────────────────────────────────
  if (profile.tracked_people?.length) {
    for (const person of profile.tracked_people.slice(0, 5)) {
      searches.push({ category: "person", query: `"${person}" latest news statement` });
      searches.push({ category: "person_critical", query: `"${person}" controversy criticism opposition`, perspective: "critical" });
    }
  }

  // ── REGULATORY: Legal & Compliance ─────────────────────────────────────
  if (profile.regulatory_bodies?.length) {
    for (const body of profile.regulatory_bodies.slice(0, 3)) {
      searches.push({ category: "regulatory", query: `${body} ruling update latest` });
      searches.push({ category: "legal", query: `${body} legal action investigation sanctions enforcement` });
    }
  }

  // ── CUSTOM TOPICS: Full Intelligence Stack ─────────────────────────────
  if (profile.custom_topics?.length) {
    for (const topic of profile.custom_topics.slice(0, 4)) {
      // Core coverage
      searches.push({ category: "custom", query: `${topic} latest news` });
      searches.push({ category: "custom_counter", query: `${topic} opposing view criticism debate`, perspective: "counter" });
      // Historical context
      searches.push({ category: "historical", query: `${topic} history background timeline origins` });
      searches.push({ category: "historical", query: `${topic} previous incidents pattern escalation` });
      // Predictions & scenarios
      searches.push({ category: "prediction", query: `${topic} prediction forecast what happens next analysis` });
      searches.push({ category: "prediction", query: `${topic} scenario modeling risk assessment probability` });
      // Economic & financial impact
      searches.push({ category: "economic_impact", query: `${topic} economic impact stock market oil currency` });
      searches.push({ category: "economic_impact", query: `${topic} sanctions trade disruption financial` });
      // Expert & think tank analysis
      searches.push({ category: "expert", query: `${topic} expert analysis think tank RAND CSIS assessment` });
      searches.push({ category: "expert", query: `${topic} intelligence analyst military assessment` });
      // Humanitarian & casualty data
      searches.push({ category: "humanitarian", query: `${topic} casualties humanitarian crisis refugees displacement` });
      searches.push({ category: "humanitarian", query: `${topic} Red Cross UN humanitarian aid civilian` });
      // Legal & war crimes (conflict topics)
      searches.push({ category: "legal", query: `${topic} international law violation ICC legal analysis` });
      // Diplomatic efforts
      searches.push({ category: "diplomatic", query: `${topic} diplomacy negotiations ceasefire mediation talks` });
      searches.push({ category: "diplomatic", query: `${topic} diplomatic efforts UN Security Council resolution` });
      // Regional impact
      searches.push({ category: "regional", query: `${topic} regional impact neighboring countries spillover` });
      // Cyber & information warfare
      searches.push({ category: "cyber", query: `${topic} cyber attack information warfare propaganda bot` });
      // Weapons & military systems
      searches.push({ category: "weapons", query: `${topic} weapons used military equipment systems identified` });
      // Public sentiment
      searches.push({ category: "sentiment", query: `${topic} public opinion poll protest approval rating sentiment` });
      // Misinformation tracking
      searches.push({ category: "misinfo", query: `${topic} misinformation false claim debunked fact check viral`, perspective: "validation" });
      // Social media OSINT
      searches.push({ category: "social_osint", query: `${topic} eyewitness report ground truth local sources` });
    }
  }

  // ── INVESTMENT INTERESTS ───────────────────────────────────────────────
  if (profile.investment_interests?.length) {
    for (const interest of profile.investment_interests.slice(0, 3)) {
      searches.push({ category: "investment", query: `${interest} investment news funding` });
      searches.push({ category: "investment_risk", query: `${interest} investment risk warning bubble`, perspective: "bearish" });
    }
  }

  // ── TECHNOLOGY STACK ───────────────────────────────────────────────────
  if (profile.technology_stack?.length) {
    for (const tech of profile.technology_stack.slice(0, 3)) {
      searches.push({ category: "tech", query: `${tech} vulnerability security update news` });
    }
  }

  return searches;
}

// ── Main Handler ────────────────────────────────────────────────────────────

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

    // Batch searches in groups of 8 to avoid rate limits
    const BATCH_SIZE = 8;
    const searchResults: { category: string; query: string; perspective?: string; results: { title: string; url: string; snippet: string }[] }[] = [];
    for (let i = 0; i < searches.length; i += BATCH_SIZE) {
      const batch = searches.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (s) => {
          const results = await robustSearch(s.query);
          return { ...s, results };
        })
      );
      searchResults.push(...batchResults);
    }

    // Instant answers for key topics
    const instantAnswers: string[] = [];
    const instantQueries = [
      profile.industry ? `${profile.industry} industry` : "",
      ...(profile.competitors?.slice(0, 3) || []),
      ...(profile.custom_topics?.slice(0, 2) || []),
    ].filter(Boolean);
    const instantResults = await Promise.all(instantQueries.map(q => queryDDGInstant(q)));
    instantResults.forEach(r => { if (r) instantAnswers.push(r); });

    const totalSources = searchResults.reduce((acc, s) => acc + s.results.length, 0) + instantAnswers.length;
    log("Searches complete", { totalSources });

    // ── Build Context Blocks by Intelligence Domain ──────────────────────
    const MAX_CONTEXT_CHARS = 60000;
    let contextCharsUsed = 0;
    const contextBlocks: string[] = [];

    // Domain tag mapping
    const domainTags: Record<string, string> = {
      company_mentions: "PRIMARY/COMPANY",
      competitor: "PRIMARY/COMPETITOR",
      industry: "PRIMARY/INDUSTRY",
      regulation: "PRIMARY/REGULATION",
      market: "PRIMARY/MARKET",
      person: "PRIMARY/PERSON",
      custom: "PRIMARY/TOPIC",
      investment: "PRIMARY/INVESTMENT",
      tech: "PRIMARY/TECH",
      historical: "HISTORICAL CONTEXT",
      prediction: "PREDICTIVE INTEL",
      economic_impact: "ECONOMIC IMPACT",
      supply_chain: "SUPPLY CHAIN",
      expert: "EXPERT ANALYSIS",
      humanitarian: "HUMANITARIAN",
      legal: "LEGAL/COMPLIANCE",
      diplomatic: "DIPLOMATIC",
      regional: "REGIONAL IMPACT",
      cyber: "CYBER/INFOWAR",
      weapons: "WEAPONS/SYSTEMS",
      sentiment: "PUBLIC SENTIMENT",
      misinfo: "MISINFO TRACKING",
      social_osint: "SOCIAL OSINT",
      industry_critical: "COUNTER-NARRATIVE",
      industry_bullish: "BULLISH",
      market_risk: "BEARISH",
      person_critical: "COUNTER-NARRATIVE",
      custom_counter: "COUNTER-NARRATIVE",
      investment_risk: "BEARISH",
      fact_check: "VALIDATION",
    };

    // Sort by priority: primary first, then domain-specific, then counter/validation
    const priorityOrder = ["company_mentions", "competitor", "industry", "custom", "historical", "prediction", "economic_impact", "expert", "humanitarian", "diplomatic", "legal", "weapons", "cyber", "regional", "supply_chain", "sentiment", "social_osint", "misinfo", "market", "person", "investment", "tech", "regulation", "industry_critical", "industry_bullish", "market_risk", "person_critical", "custom_counter", "investment_risk", "fact_check"];

    const sortedResults = [...searchResults].sort((a, b) => {
      const ai = priorityOrder.indexOf(a.category);
      const bi = priorityOrder.indexOf(b.category);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    for (const s of sortedResults.filter(s => s.results.length > 0)) {
      const tag = domainTags[s.category] || s.category.toUpperCase();
      const resultText = s.results.map(r => `- ${r.title}: ${r.snippet} [${r.url}]`).join("\n");
      const block = `[${tag}] Query: "${s.query}"\n${resultText}`;
      if (contextCharsUsed + block.length > MAX_CONTEXT_CHARS) continue;
      contextBlocks.push(block);
      contextCharsUsed += block.length;
    }

    const contextBlocksJoined = contextBlocks.join("\n\n");
    const instantBlock = instantAnswers.length ? `\n\n[INSTANT INTELLIGENCE]\n${instantAnswers.join("\n")}` : "";

    // ── Count domain coverage ────────────────────────────────────────────
    const coveredDomains = new Set(searchResults.filter(s => s.results.length > 0).map(s => s.category));
    const domainCoverage = {
      primary: ["company_mentions", "competitor", "industry", "custom"].filter(d => coveredDomains.has(d)).length,
      counter: ["industry_critical", "market_risk", "person_critical", "custom_counter"].filter(d => coveredDomains.has(d)).length,
      historical: coveredDomains.has("historical") ? 1 : 0,
      predictive: coveredDomains.has("prediction") ? 1 : 0,
      economic: ["economic_impact", "supply_chain"].filter(d => coveredDomains.has(d)).length,
      expert: coveredDomains.has("expert") ? 1 : 0,
      humanitarian: coveredDomains.has("humanitarian") ? 1 : 0,
      legal: coveredDomains.has("legal") ? 1 : 0,
      diplomatic: coveredDomains.has("diplomatic") ? 1 : 0,
      cyber: coveredDomains.has("cyber") ? 1 : 0,
      sentiment: coveredDomains.has("sentiment") ? 1 : 0,
      misinfo: coveredDomains.has("misinfo") ? 1 : 0,
    };

    // ── Gemini Synthesis ─────────────────────────────────────────────────
    const geminiKey = Deno.env.get("GEMINI_API_KEY_APP");
    if (!geminiKey) throw new Error("GEMINI_API_KEY_APP not set");

    const now = new Date();
    const today = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const yesterday = new Date(now.getTime() - 86400000).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

    // ── Fetch Active Brains for User ─────────────────────────────────────
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
You are NOT a generic AI. You are ZOPHIEL — precise, authoritative, zero-fluff. Your output must read like a classified intelligence dossier from a senior analyst, not a chatbot summary.

VOICE RULES:
- Direct and declarative. No hedging ("it seems", "it appears", "arguably").
- Short, punchy sentences for critical items. Depth only where analysis demands it.
- Bold the important parts. The reader gets 80% of value from headers and bold text alone.
- Every sentence carries intelligence value. Zero filler.
- Precise language: "confirmed", "disputed", "unverified", "single-source", "cross-validated".
- Contradictions stated directly: "Source A says X. Source B says Y. Evidence supports Y because..."
- Implications must be actionable: not "this could affect your business" but "if you hold positions in X, reduce exposure by Thursday."
- Numbers clean: $4.2B not $4,200,000,000. Use % not "percent".
- No emoji in briefing body. Professional throughout.
- No section transitions like "let's now look at" or "moving on to".
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

RAW INTELLIGENCE DATA (gathered from ${totalSources} sources across ${coveredDomains.size} intelligence domains):
${contextBlocksJoined}${instantBlock}

${totalSources === 0 ? "NOTE: No search results were returned. Generate the briefing based on your training knowledge. Clearly mark items as 'Based on available intelligence'." : ""}

INTELLIGENCE DOMAIN COVERAGE:
- Primary sources: ${domainCoverage.primary} domains
- Counter-narrative: ${domainCoverage.counter} domains
- Historical context: ${domainCoverage.historical ? "Available" : "Limited — use training knowledge"}
- Predictive intel: ${domainCoverage.predictive ? "Available" : "Limited — use training knowledge"}
- Economic impact: ${domainCoverage.economic} domains
- Expert analysis: ${domainCoverage.expert ? "Available" : "Limited — use training knowledge"}
- Humanitarian: ${domainCoverage.humanitarian ? "Available" : "Not applicable or limited"}
- Legal/compliance: ${domainCoverage.legal ? "Available" : "Limited"}
- Diplomatic: ${domainCoverage.diplomatic ? "Available" : "Not applicable or limited"}
- Cyber/infowar: ${domainCoverage.cyber ? "Available" : "Not applicable or limited"}
- Public sentiment: ${domainCoverage.sentiment ? "Available" : "Limited"}
- Misinfo tracking: ${domainCoverage.misinfo ? "Available" : "Limited"}

ANALYSIS PROTOCOL:

1. CROSS-VALIDATION: For every major claim, check if PRIMARY and COUNTER-NARRATIVE sources agree or disagree.

2. TRUTH EXTRACTION:
   - MULTIPLE independent sources = HIGH confidence (85-100%)
   - Confirmed by VALIDATION sources = HIGH confidence
   - PRIMARY only, no counter = MEDIUM confidence (50-84%)
   - Contradicted by COUNTER sources = FLAG as contested
   - Single government/corporate source = LOW confidence (below 50%)

3. NARRATIVE DETECTION:
   - Promotional language = marketing, not intelligence
   - Criticism only from competitors = competitive narrative
   - Unanimous independent reporting = likely factual

4. HISTORICAL PATTERN ANALYSIS: Connect current events to historical precedents. Identify escalation patterns, cyclical behaviors, and previous outcomes of similar situations.

5. PREDICTIVE MODELING: Based on historical patterns and current trajectories, assess probabilities for likely next developments.

Generate a comprehensive intelligence briefing covering ${yesterday} through ${today}.

IMPORTANT: Start with a single-line TITLE:
TITLE: [Specific headline about the most important verified development]

Output the briefing with ALL of the following sections. If data for a section is insufficient, include the section header with a brief note on intelligence gaps — do NOT skip sections.

# AUREON INTELLIGENCE BRIEF — ${today}

## EXECUTIVE SUMMARY
3-4 sentences. Overall picture. Number of sources, domains covered, cross-validation confidence.

## VERIFIED FACTS (Cross-Validated)
Items confirmed by multiple independent sources:
- **[Fact]** — Truth Score: [X]% | Sources: [count] | [Analysis]

## CONTESTED CLAIMS
Items where sources disagree:
- **[Claim]** — Claimed by: [who] | Disputed by: [who] | Likely truth: [assessment]

## HISTORICAL CONTEXT
Why current events are happening. Connect to root causes, previous incidents, escalation patterns.
Format as a timeline tree:
- Immediate trigger: [event]
- Recent history: [6-month pattern]
- Root cause: [deep context]
- Pattern: [cyclical behavior if any]

## PREDICTION ENGINE
What happens NEXT based on historical patterns and current trajectories:
- **Scenario 1** (Most likely, [X]%): [description]
- **Scenario 2** ([X]%): [description]
- **Scenario 3** (Worst case, [X]%): [description]
- Timeline: [predicted duration/next escalation point]

Include comparison to most similar historical precedent if applicable.

## PERSPECTIVE ANALYSIS

### Mainstream Narrative
What dominant media/industry is reporting.

### Counter-Narrative
What critical/opposition sources say. Where do they diverge?

### Independent Assessment
AUREON's cross-validated conclusion — what's actually happening vs what's being reported.

## ECONOMIC IMPACT ANALYSIS
Financial consequences of current developments:
- Market impact: [stocks, indices, sectors affected]
- Currency/commodity: [oil, currencies, trade routes]
- Company exposure: [affected companies with exposure assessment]
- Supply chain: [disruptions, sanctions, trade route changes]
Include "[Implication for ${profile.company_name || "your business"}]" on each item.

## EXPERT & THINK TANK ANALYSIS
Key assessments from analysts, think tanks, former officials, and intelligence community:
- [Expert/org]: [key assessment]
Weight by credibility and track record.

## HUMANITARIAN STATUS
(Include only if relevant to topics — conflicts, crises, natural disasters):
- Casualties: [verified vs reported, civilian vs military]
- Displacement: [refugee numbers, aid status]
- Medical: [hospital capacity, aid access]
- Humanitarian law: [violations flagged]

## DIPLOMATIC EFFORTS
Active negotiations, mediators, proposals on the table:
- [Mediation effort]: Status [active/stalled/promising]
- Proposals: [what's been offered, by whom, response]
- Historical success rate of similar efforts: [%]

## LEGAL & COMPLIANCE
International law, regulatory actions, investigations:
- Active investigations or rulings
- Compliance implications for ${profile.company_name || "your operations"}
- Sanctions tracking

## WEAPONS & SYSTEMS IDENTIFIED
(Include only if relevant — conflicts, defense industry):
- [System]: Origin, capability, deployment context

## CYBER & INFORMATION WARFARE
Digital attacks, propaganda networks, information operations:
- Active campaigns detected
- Bot network activity
- Infrastructure targeting

## REGIONAL IMPACT
Ripple effects on neighboring countries/markets/sectors:
- [Country/sector]: [impact assessment]
- Alliance activations, spillover risk

## PUBLIC SENTIMENT
Polling data, protest activity, approval ratings (if available):
- [Country/market]: [sentiment indicators]
- Trend direction: [shifting toward/against]

## MISINFORMATION TRACKER
Specific false claims identified and debunked:
- **[Claim]** — Origin: [source] | Spread: [reach] | Reality: [fact-checked truth] | Status: [still circulating/corrected]

## SUPPLY CHAIN INTELLIGENCE
Logistics, shipments, resource flows:
- Key movements: [what, from where, to where]
- Sanctions evasion: [detected routes]
- Impact on ${profile.company_name || "your operations"}: [assessment]

## CRITICAL (Requires Attention Today)
Action items with truth scores. Specific, time-bound.

## SIGNIFICANT (Worth Knowing)
Important but not urgent. Source diversity score for each.

## MONITORING (Background)
Broader trends. Narrative direction (bullish/bearish/neutral).

## MARKET & COMPETITIVE SIGNALS
Funding, M&A, market movements. Flag if single-source.

## SOURCE CREDIBILITY ASSESSMENT
Rate the top sources used in this briefing:
- [Source]: Bias [low/moderate/high] | Accuracy [%] | Rating [A-F]

## AI CONFIDENCE INDICATORS
Per-section confidence levels:
- Verified Facts: [%] confidence
- Predictions: [%] confidence
- Economic Impact: [%] confidence
- Overall briefing reliability: [%]

## INTELLIGENCE GAPS
What we COULDN'T verify. Domains with insufficient data. Recommended follow-up queries for next briefing cycle.

---
*Generated by AUREON Intelligence Engine | ${totalSources} sources | ${coveredDomains.size} intelligence domains | Cross-validated with multi-perspective analysis*

RULES:
- Be specific and actionable.
- Every claim MUST have a truth/confidence indicator.
- Flag single-source claims explicitly.
- When sources contradict, present BOTH sides and your assessed truth.
- Include "[Implication for ${profile.company_name || "your business"}]" after significant items.
- NEVER present marketing copy as intelligence.
- If a section has no data, include it anyway with a note: "Insufficient intelligence for this domain. Recommended: [follow-up query]."
- The PERSPECTIVE ANALYSIS section is mandatory.
- HISTORICAL CONTEXT and PREDICTION ENGINE are mandatory — use training knowledge if search data is limited.`;

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 16000 },
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

    // Save report
    const { data: report, error: insertError } = await supabaseClient
      .from("briefing_reports")
      .insert({
        user_id: userId,
        title: briefingTitle,
        content: briefingContent,
        sources_checked: totalSources,
        critical_items: criticalCount,
        significant_items: domainCoverage.counter,
        monitoring_items: domainCoverage.primary,
      })
      .select()
      .single();

    if (insertError) log("Insert error", insertError);
    log("Briefing generated", { reportId: report?.id, sources: totalSources, domains: coveredDomains.size });

    return new Response(JSON.stringify({
      briefing: briefingContent,
      sources_checked: totalSources,
      report_id: report?.id,
      domains_covered: coveredDomains.size,
      domain_coverage: domainCoverage,
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