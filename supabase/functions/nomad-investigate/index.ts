const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ── Free OSINT Data Sources ──────────────────────────────────────────────────

async function searchDDG(query: string): Promise<string> {
  try {
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
    });
    if (!resp.ok) return '';
    const html = await resp.text();
    const results: string[] = [];
    const blocks = html.split(/class="result\s/);
    for (let i = 1; i < blocks.length && results.length < 5; i++) {
      const titleMatch = blocks[i].match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/);
      const snippetMatch = blocks[i].match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      if (title) results.push(`- ${title}: ${snippet}`);
    }
    return results.join('\n') || 'No results found.';
  } catch { return 'Search failed.'; }
}

async function queryEdgar(companyName: string): Promise<string> {
  try {
    const resp = await fetch(`https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(companyName)}&dateRange=custom&startdt=2020-01-01&forms=10-K,10-Q,8-K,4&hits.hits.total=true&hits.hits._source=file_date,display_names,form_type,file_num`, {
      headers: { 'User-Agent': 'ZIALIEL-NOMAD research@zialiel.com', 'Accept': 'application/json' },
    });
    if (!resp.ok) {
      // Fallback to EDGAR full-text search
      const fallback = await fetch(`https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(companyName)}&forms=10-K,8-K`, {
        headers: { 'User-Agent': 'ZIALIEL-NOMAD research@zialiel.com' },
      });
      if (!fallback.ok) return 'SEC EDGAR: No results or API unavailable.';
      const data = await fallback.json();
      return `SEC EDGAR: ${JSON.stringify(data).slice(0, 1500)}`;
    }
    const data = await resp.json();
    return `SEC EDGAR Results:\n${JSON.stringify(data).slice(0, 2000)}`;
  } catch { return 'SEC EDGAR: Query failed.'; }
}

async function queryEdgarCompany(query: string): Promise<string> {
  try {
    const resp = await fetch(`https://www.sec.gov/cgi-bin/browse-edgar?company=${encodeURIComponent(query)}&CIK=&type=&dateb=&owner=include&count=10&search_text=&action=getcompany&output=atom`, {
      headers: { 'User-Agent': 'ZIALIEL-NOMAD research@zialiel.com', 'Accept': 'application/atom+xml' },
    });
    if (!resp.ok) return 'SEC EDGAR company search unavailable.';
    const text = await resp.text();
    // Extract company names and CIKs from Atom feed
    const entries: string[] = [];
    const entryBlocks = text.split('<entry>');
    for (let i = 1; i < entryBlocks.length && entries.length < 5; i++) {
      const titleMatch = entryBlocks[i].match(/<title[^>]*>([\s\S]*?)<\/title>/);
      const cikMatch = entryBlocks[i].match(/CIK=(\d+)/);
      if (titleMatch) entries.push(`- ${titleMatch[1].trim()}${cikMatch ? ` (CIK: ${cikMatch[1]})` : ''}`);
    }
    return entries.length ? `SEC EDGAR Companies:\n${entries.join('\n')}` : 'No SEC filings found.';
  } catch { return 'SEC EDGAR company search failed.'; }
}

async function queryFEC(name: string): Promise<string> {
  try {
    const resp = await fetch(`https://api.open.fec.gov/v1/names/candidates/?q=${encodeURIComponent(name)}&api_key=DEMO_KEY`);
    if (!resp.ok) {
      // Try individual contributor search
      const contribResp = await fetch(`https://api.open.fec.gov/v1/schedules/schedule_a/?contributor_name=${encodeURIComponent(name)}&api_key=DEMO_KEY&per_page=5&sort=-contribution_receipt_date`);
      if (!contribResp.ok) return 'FEC: No campaign finance records found.';
      const data = await contribResp.json();
      if (!data.results?.length) return 'FEC: No campaign donations found.';
      return `FEC Donations:\n${data.results.map((r: any) => `- $${r.contribution_receipt_amount} to ${r.committee?.name || 'Unknown'} (${r.contribution_receipt_date})`).join('\n')}`;
    }
    const data = await resp.json();
    return `FEC Records:\n${JSON.stringify(data.results?.slice(0, 5)).slice(0, 1000)}`;
  } catch { return 'FEC: Query failed.'; }
}

async function queryProPublicaNonprofit(name: string): Promise<string> {
  try {
    const resp = await fetch(`https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(name)}`);
    if (!resp.ok) return 'ProPublica Nonprofits: Query failed.';
    const data = await resp.json();
    if (!data.organizations?.length) return 'No nonprofit records found.';
    return `Nonprofit Records:\n${data.organizations.slice(0, 5).map((o: any) =>
      `- ${o.name} (EIN: ${o.ein}) — ${o.city}, ${o.state} — Revenue: $${o.income_amount?.toLocaleString() || 'N/A'}`
    ).join('\n')}`;
  } catch { return 'ProPublica Nonprofits: Query failed.'; }
}

async function queryCrtSh(domain: string): Promise<string> {
  try {
    const resp = await fetch(`https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`);
    if (!resp.ok) return 'crt.sh: Certificate lookup failed.';
    const data = await resp.json();
    const unique = [...new Set(data.slice(0, 20).map((c: any) => c.common_name || c.name_value))];
    return `SSL Certificate Transparency (crt.sh):\nSubdomains found: ${unique.length}\n${unique.slice(0, 15).map((s: string) => `- ${s}`).join('\n')}`;
  } catch { return 'crt.sh: Query failed.'; }
}

async function queryGitHub(username: string): Promise<string> {
  try {
    const resp = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });
    if (!resp.ok) return 'GitHub: User not found.';
    const user = await resp.json();
    // Get repos
    const repoResp = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=5`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });
    const repos = repoResp.ok ? await repoResp.json() : [];
    return `GitHub Profile:\n- Name: ${user.name || 'N/A'}\n- Bio: ${user.bio || 'N/A'}\n- Location: ${user.location || 'N/A'}\n- Company: ${user.company || 'N/A'}\n- Public repos: ${user.public_repos}\n- Followers: ${user.followers}\n- Created: ${user.created_at}\n- Email: ${user.email || 'N/A'}\nRecent Repos:\n${repos.map((r: any) => `- ${r.full_name} (${r.language || 'N/A'}) ⭐${r.stargazers_count}`).join('\n')}`;
  } catch { return 'GitHub: Query failed.'; }
}

async function queryGitHubSearch(query: string): Promise<string> {
  try {
    const resp = await fetch(`https://api.github.com/search/users?q=${encodeURIComponent(query)}&per_page=5`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });
    if (!resp.ok) return 'GitHub Search: Failed.';
    const data = await resp.json();
    if (!data.items?.length) return 'GitHub: No matching users found.';
    return `GitHub Users Found:\n${data.items.map((u: any) => `- ${u.login} (${u.html_url})`).join('\n')}`;
  } catch { return 'GitHub Search: Failed.'; }
}

async function queryUSASpending(query: string): Promise<string> {
  try {
    const resp = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filters: { keywords: [query] },
        fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Start Date'],
        limit: 5,
        page: 1,
        sort: 'Award Amount',
        order: 'desc',
      }),
    });
    if (!resp.ok) return 'USASpending: Query failed.';
    const data = await resp.json();
    if (!data.results?.length) return 'No federal contracts found.';
    return `Federal Contracts (USASpending):\n${data.results.map((r: any) =>
      `- ${r['Recipient Name']} — $${Number(r['Award Amount']).toLocaleString()} from ${r['Awarding Agency']} (${r['Start Date']})`
    ).join('\n')}`;
  } catch { return 'USASpending: Query failed.'; }
}

async function queryDDGInstant(query: string): Promise<string> {
  try {
    const resp = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`);
    if (!resp.ok) return '';
    const data = await resp.json();
    if (data.AbstractText) return `Quick Answer: ${data.AbstractText} (Source: ${data.AbstractSource})`;
    if (data.Answer) return `Answer: ${data.Answer}`;
    return '';
  } catch { return ''; }
}

// ── Orchestrator ─────────────────────────────────────────────────────────────

async function gatherIntelligence(query: string): Promise<string> {
  const q = query.toLowerCase();

  // Determine what sources to query based on content
  const tasks: Promise<string>[] = [];
  const labels: string[] = [];

  // Always do web search
  tasks.push(searchDDG(query));
  labels.push('WEB SEARCH');

  tasks.push(queryDDGInstant(query));
  labels.push('INSTANT ANSWER');

  // Company/corporate indicators
  if (/compan|corp|inc|llc|ltd|business|firm|startup|enterprise/i.test(q) || /sec |edgar|filing|10-k|proxy/i.test(q)) {
    tasks.push(queryEdgarCompany(query.replace(/investigate|company|research|find|look up|search/gi, '').trim()));
    labels.push('SEC EDGAR');
    tasks.push(queryUSASpending(query.replace(/investigate|company|research|find/gi, '').trim()));
    labels.push('FEDERAL CONTRACTS');
    tasks.push(queryProPublicaNonprofit(query.replace(/investigate|company|research|find|nonprofit/gi, '').trim()));
    labels.push('NONPROFIT RECORDS');
  }

  // Person indicators
  if (/person|individual|who is|about|officer|director|ceo|cto|founder/i.test(q)) {
    const name = query.replace(/investigate|person|research|find|who is|look up|about/gi, '').trim();
    tasks.push(queryFEC(name));
    labels.push('FEC CAMPAIGN FINANCE');
    tasks.push(queryProPublicaNonprofit(name));
    labels.push('NONPROFIT AFFILIATIONS');
    tasks.push(queryGitHubSearch(name));
    labels.push('GITHUB');
  }

  // Domain indicators
  if (/domain|\.com|\.org|\.net|\.io|dns|ssl|cert|subdomain|whois/i.test(q)) {
    const domainMatch = query.match(/[\w-]+\.[\w.]+/);
    if (domainMatch) {
      tasks.push(queryCrtSh(domainMatch[0]));
      labels.push('CERTIFICATE TRANSPARENCY');
    }
  }

  // Email indicators
  if (/email|@/i.test(q)) {
    const emailMatch = query.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (emailMatch) {
      tasks.push(searchDDG(`"${emailMatch[0]}" site:github.com OR site:linkedin.com OR site:twitter.com`));
      labels.push('EMAIL FOOTPRINT');
    }
  }

  // Username indicators
  if (/username|user|handle|account|profile/i.test(q)) {
    const username = query.replace(/investigate|username|user|research|find|search|handle|account|profile/gi, '').trim().split(/\s+/)[0];
    if (username) {
      tasks.push(queryGitHub(username));
      labels.push('GITHUB PROFILE');
      tasks.push(searchDDG(`"${username}" site:reddit.com OR site:twitter.com OR site:linkedin.com OR site:instagram.com`));
      labels.push('SOCIAL MEDIA SCAN');
    }
  }

  // FEC / political
  if (/donat|campaign|politic|fec|contribut|lobby/i.test(q)) {
    tasks.push(queryFEC(query.replace(/investigate|research|find|donation|campaign|political/gi, '').trim()));
    labels.push('FEC DONATIONS');
  }

  // Federal contracts
  if (/contract|federal|government|grant|spending|usaspending/i.test(q)) {
    tasks.push(queryUSASpending(query.replace(/investigate|research|find|federal|contract|government/gi, '').trim()));
    labels.push('FEDERAL CONTRACTS');
  }

  const results = await Promise.allSettled(tasks);
  const sections: string[] = [];

  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value && r.value.trim()) {
      sections.push(`### SOURCE: ${labels[i]}\n${r.value}`);
    }
  });

  return sections.join('\n\n---\n\n') || 'No intelligence gathered from available sources.';
}

// ── Main Handler ─────────────────────────────────────────────────────────────

const NOMAD_SYSTEM_PROMPT = `You are NOMAD — an elite Public Intelligence Agent built into the ZIALIEL platform. You specialize in Open Source Intelligence (OSINT) using only publicly available, legal data sources.

YOUR CAPABILITIES:
- Web search across surface web
- SEC EDGAR corporate filings (10-K, 10-Q, 8-K, Form 4)
- FEC campaign finance records
- ProPublica nonprofit database (IRS 990 forms)
- Certificate Transparency logs (crt.sh)
- GitHub user and repository data
- USASpending federal contracts database
- DuckDuckGo instant answers

YOUR OUTPUT FORMAT:
Always structure your intelligence reports as follows:
1. **SUBJECT IDENTIFICATION** — Who/what is being investigated
2. **CONFIDENCE LEVEL** — How confident you are in the findings (HIGH/MEDIUM/LOW with score)
3. **KEY FINDINGS** — Bullet-pointed critical intelligence
4. **DETAILED ANALYSIS** — Organized by category (Corporate, Financial, Digital, Legal, etc.)
5. **SOURCE CITATIONS** — Every claim must cite its source
6. **GAPS & LIMITATIONS** — What you couldn't find and why
7. **RECOMMENDED NEXT STEPS** — What additional investigation is suggested

RULES:
- NEVER fabricate data. If you don't have it, say so explicitly.
- Always cite which source provided each data point.
- Flag any conflicting information between sources.
- Rate confidence on a 0-100 scale based on source quantity and quality.
- Use markdown tables, headers, and formatting for readability.
- Mark "coming soon" sources that would improve the report.
- Be direct, analytical, and thorough. No filler text.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    if (!messages?.length) {
      return new Response(JSON.stringify({ error: 'Messages required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the latest user message for intelligence gathering
    const lastUserMsg = [...messages].reverse().find((m: any) => m.role === 'user');
    
    // Gather intelligence from all available sources
    const intelligence = lastUserMsg ? await gatherIntelligence(lastUserMsg.content) : '';

    // Build messages for Gemini with intelligence context
    const aiMessages = [
      { role: 'user', parts: [{ text: NOMAD_SYSTEM_PROMPT }] },
      { role: 'model', parts: [{ text: 'Understood. NOMAD agent initialized. Ready to process intelligence requests with structured dossier output.' }] },
    ];

    // Add conversation history
    for (const msg of messages.slice(0, -1)) {
      aiMessages.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    // Add the latest user message with gathered intelligence
    if (lastUserMsg) {
      const enrichedPrompt = intelligence
        ? `USER REQUEST: ${lastUserMsg.content}\n\n--- RAW INTELLIGENCE DATA (from NOMAD's source queries) ---\n\n${intelligence}\n\n--- END RAW DATA ---\n\nAnalyze the above raw intelligence data and produce a structured intelligence dossier. Correlate findings across sources. Identify patterns and connections. Flag any gaps or contradictions.`
        : lastUserMsg.content;

      aiMessages.push({ role: 'user', parts: [{ text: enrichedPrompt }] });
    }

    // Call Gemini with streaming
    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: aiMessages,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error('Gemini error:', geminiResp.status, errText);
      return new Response(JSON.stringify({ error: 'AI analysis failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Transform Gemini SSE to OpenAI-compatible SSE format
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      try {
        const reader = geminiResp.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIdx: number;
          while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);

            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6);
            if (jsonStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(jsonStr);
              const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                const sseChunk = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;
                await writer.write(encoder.encode(sseChunk));
              }
            } catch { /* skip malformed */ }
          }
        }

        await writer.write(encoder.encode('data: [DONE]\n\n'));
      } catch (e) {
        console.error('Stream error:', e);
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('NOMAD error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Investigation failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
