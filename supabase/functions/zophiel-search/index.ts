const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface DDGResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, page = 1 } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const trimmed = query.trim();

    // Use DuckDuckGo HTML search and parse results
    const startParam = (page - 1) * 10;
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(trimmed)}&s=${startParam}`;

    const response = await fetch(ddgUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `DuckDuckGo returned status ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();

    // Parse results from DuckDuckGo HTML response
    const results: DDGResult[] = [];
    
    // Match result blocks — each result has class "result"
    const resultBlocks = html.split(/class="result\s/);
    
    for (let i = 1; i < resultBlocks.length && results.length < 15; i++) {
      const block = resultBlocks[i];
      
      // Extract title and URL from anchor tag with class "result__a"
      const titleMatch = block.match(/class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
      if (!titleMatch) continue;
      
      let url = titleMatch[1];
      // DuckDuckGo wraps URLs in redirects
      const uddgMatch = url.match(/uddg=([^&]*)/);
      if (uddgMatch) {
        url = decodeURIComponent(uddgMatch[1]);
      }
      
      // Clean HTML tags from title
      const title = titleMatch[2].replace(/<[^>]*>/g, '').trim();
      
      // Extract snippet
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const snippet = snippetMatch
        ? snippetMatch[1].replace(/<[^>]*>/g, '').trim()
        : '';
      
      // Extract source domain
      const sourceMatch = block.match(/class="result__url"[^>]*>([\s\S]*?)<\//);
      const source = sourceMatch ? sourceMatch[1].replace(/<[^>]*>/g, '').trim() : '';
      
      if (title && url && url.startsWith('http')) {
        results.push({ title, url, snippet, source });
      }
    }

    // Also get instant answer from DuckDuckGo API
    let instantAnswer: string | null = null;
    try {
      const iaResp = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(trimmed)}&format=json&no_html=1&skip_disambig=1`);
      if (iaResp.ok) {
        const iaData = await iaResp.json();
        if (iaData.AbstractText) {
          instantAnswer = iaData.AbstractText;
        } else if (iaData.Answer) {
          instantAnswer = iaData.Answer;
        }
      }
    } catch {
      // Instant answer is optional
    }

    return new Response(
      JSON.stringify({
        success: true,
        query: trimmed,
        instantAnswer,
        results,
        page,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Zophiel search error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Search failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
