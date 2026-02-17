const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse';

interface ScrapedSource {
  url: string;
  title: string;
  domain: string;
  content: string;
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
}

function cleanHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── DuckDuckGo Search ────────────────────────────────────────────────────────
async function searchDDG(query: string): Promise<{ url: string; title: string }[]> {
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(ddgUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!response.ok) return [];
  const html = await response.text();
  const results: { url: string; title: string }[] = [];
  const blocks = html.split(/class="result\s/);

  for (let i = 1; i < blocks.length && results.length < 8; i++) {
    const block = blocks[i];
    const titleMatch = block.match(/class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
    if (!titleMatch) continue;

    let url = titleMatch[1];
    const uddg = url.match(/uddg=([^&]*)/);
    if (uddg) url = decodeURIComponent(uddg[1]);
    const title = titleMatch[2].replace(/<[^>]*>/g, '').trim();

    if (title && url && url.startsWith('http')) {
      results.push({ url, title });
    }
  }
  return results;
}

// ── Page Scraper ─────────────────────────────────────────────────────────────
async function scrapePage(url: string, timeoutMs = 6000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return null;
    const ct = resp.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return null;
    const html = await resp.text();

    // Extract main content
    let main = '';
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    if (articleMatch) main = articleMatch[1];
    else if (mainMatch) main = mainMatch[1];
    else {
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      main = bodyMatch ? bodyMatch[1] : html;
    }
    return cleanHtml(main).slice(0, 4000);
  } catch {
    return null;
  }
}

// ── Refine: generate clarifying questions ────────────────────────────────────
const GEMINI_NON_STREAM = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function generateClarifyingQuestions(query: string, apiKey: string): Promise<{ questions: { id: string; question: string; options: string[] }[] }> {
  const resp = await fetch(`${GEMINI_NON_STREAM}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `You are ZOPHIEL, a precision intelligence engine. The user wants a deep research report on: "${query}"

Before searching, generate 2-3 short clarifying questions that would dramatically improve the search quality. Each question should have 3-4 quick-select options.

Return ONLY valid JSON (no markdown, no code fences):
{
  "questions": [
    { "id": "q1", "question": "What specific aspect interests you most?", "options": ["Technical details", "Market analysis", "Historical context", "Future predictions"] },
    { "id": "q2", "question": "What timeframe matters?", "options": ["Last 30 days", "Last 6 months", "Last year", "All time"] }
  ]
}` }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    }),
  });

  if (!resp.ok) throw new Error('Failed to generate questions');
  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  // Strip markdown fences if present
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  return JSON.parse(cleaned);
}

// ── Main Handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { query, action, answers } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmed = query.trim();

    // ── Action: refine → return clarifying questions ──
    if (action === 'refine') {
      console.log('Generating clarifying questions for:', trimmed);
      try {
        const result = await generateClarifyingQuestions(trimmed, GEMINI_KEY);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        console.error('Refine error:', e);
        // Fallback: skip questions and let them search directly
        return new Response(JSON.stringify({ questions: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ── Build enhanced query from answers ──
    let enhancedQuery = trimmed;
    if (answers && typeof answers === 'object' && Object.keys(answers).length > 0) {
      const context = Object.values(answers).join('; ');
      enhancedQuery = `${trimmed} — context: ${context}`;
    }

    console.log('Deep search query:', enhancedQuery);

    // Step 1: Run multiple DDG searches with different angles
    const searchVariants = [
      enhancedQuery,
      `${trimmed} latest 2025 2026`,
      `${trimmed} analysis research`,
    ];

    const allSearchResults = await Promise.all(searchVariants.map(q => searchDDG(q)));
    
    // Deduplicate by URL
    const seen = new Set<string>();
    const uniqueResults: { url: string; title: string }[] = [];
    for (const batch of allSearchResults) {
      for (const r of batch) {
        if (!seen.has(r.url)) {
          seen.add(r.url);
          uniqueResults.push(r);
        }
      }
    }

    // Step 2: Scrape top results in parallel (max 6 for speed)
    const toScrape = uniqueResults.slice(0, 6);
    const scrapeResults = await Promise.allSettled(
      toScrape.map(async (r) => {
        const content = await scrapePage(r.url);
        return content ? { url: r.url, title: r.title, domain: extractDomain(r.url), content } as ScrapedSource : null;
      })
    );

    const sources: ScrapedSource[] = scrapeResults
      .filter((r): r is PromiseFulfilledResult<ScrapedSource | null> => r.status === 'fulfilled')
      .map(r => r.value)
      .filter((s): s is ScrapedSource => s !== null);

    console.log(`Scraped ${sources.length} sources for deep analysis`);

    // Step 3: Build Gemini prompt with all source material
    const sourceBlocks = sources.map((s, i) =>
      `[SOURCE ${i + 1}] ${s.title}\nURL: ${s.url}\nDomain: ${s.domain}\n---\n${s.content}\n`
    ).join('\n\n');

    const systemPrompt = `You are ZOPHIEL Deep Intelligence Engine — a forensic-grade research analyst.

MISSION: Provide a comprehensive, deeply researched answer to the user's query by synthesizing multiple sources.

RULES:
1. Analyze ALL provided sources critically. Cross-reference claims between sources.
2. Identify consensus, contradictions, and gaps in the data.
3. Cite sources using [Source N] notation inline.
4. Structure your response with clear headers using markdown (##, ###).
5. Include a "Key Findings" section at the top with bullet points.
6. Include a "Source Reliability Assessment" section rating each source.
7. Flag any outdated information, bias indicators, or unverified claims.
8. If sources conflict, explain the discrepancy and which is more likely accurate and why.
9. End with "Intelligence Gaps" — what couldn't be determined from available sources.
10. Be thorough but precise. No filler. Every sentence must add value.

TONE: Authoritative, analytical, zero fluff. Like a senior intelligence briefing.`;

    const userPrompt = `QUERY: ${trimmed}

GATHERED INTELLIGENCE (${sources.length} sources):

${sourceBlocks || 'No sources could be scraped. Provide the best answer you can based on your training data, and clearly state that live sources were unavailable.'}

Synthesize a comprehensive deep-search intelligence report.`;

    // Step 4: Stream Gemini response back to client
    const geminiUrl = `${GEMINI_URL}&key=${GEMINI_KEY}`;
    const geminiResp = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error('Gemini error:', geminiResp.status, errText);
      return new Response(
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build a transformed SSE stream that also prepends source metadata
    const sourceMeta = JSON.stringify({
      type: 'sources',
      sources: sources.map(s => ({ url: s.url, title: s.title, domain: s.domain })),
      totalSearchResults: uniqueResults.length,
    });

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Send sources metadata first as a custom SSE event
    writer.write(encoder.encode(`data: ${sourceMeta}\n\n`));

    // Pipe Gemini SSE stream through
    const geminiBody = geminiResp.body;
    if (geminiBody) {
      const reader = geminiBody.getReader();
      const decoder = new TextDecoder();

      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });

            // Parse Gemini SSE and re-emit as our format
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  const deltaEvent = JSON.stringify({ type: 'delta', text });
                  await writer.write(encoder.encode(`data: ${deltaEvent}\n\n`));
                }
              } catch { /* partial JSON, skip */ }
            }
          }
        } catch (e) {
          console.error('Stream error:', e);
        } finally {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
          await writer.close();
        }
      })();
    } else {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
      await writer.close();
    }

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Deep search error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Deep search failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
