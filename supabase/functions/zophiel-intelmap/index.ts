// Zophiel Intel Map - scrapes top search results and extracts an entity graph
// using Lovable AI Gateway. Returns nodes (sources, people, orgs, locations,
// topics) and edges (mentions, affiliations, references) for Palantir-style mapping.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ResultIn {
  title: string;
  url: string;
  snippet?: string;
  source?: string;
  tier?: number;
  tierLabel?: string;
}

interface GraphNode {
  id: string;
  label: string;
  type: 'source' | 'person' | 'organization' | 'location' | 'topic' | 'event';
  tier?: number;
  tierLabel?: string;
  url?: string;
  domain?: string;
  mentions?: number;
  context?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
  weight: number;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPage(url: string, timeoutMs = 8000): Promise<string> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!r.ok) return '';
    const html = await r.text();
    // Prefer article/main content
    const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const chunk = (article?.[1] || main?.[1] || body?.[1] || html);
    return stripHtml(chunk).slice(0, 4000);
  } catch {
    clearTimeout(t);
    return '';
  }
}

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { query, results } = await req.json() as { query: string; results: ResultIn[] };
    if (!Array.isArray(results) || results.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No results provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY_APP') || Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'GEMINI_API_KEY_APP not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Limit to top 8 results for scraping budget
    const top = results.slice(0, 8);

    // Scrape pages in parallel
    const scraped = await Promise.all(
      top.map(async (r) => ({
        ...r,
        domain: domainOf(r.url),
        content: await fetchPage(r.url),
      })),
    );

    // Build a compact corpus for the AI
    const corpus = scraped.map((s, i) =>
      `[SOURCE ${i + 1}] (${s.tierLabel || 'Source'}) ${s.title}
URL: ${s.url}
DOMAIN: ${s.domain}
SNIPPET: ${s.snippet || ''}
EXCERPT: ${s.content.slice(0, 1800)}
---`,
    ).join('\n');

    const systemPrompt = `You are an OSINT intelligence analyst. From the provided web sources about a query, extract a knowledge graph of entities and relationships.

Rules:
- Identify only REAL named entities (proper nouns): specific people, organizations, locations, key topics, and events.
- Skip generic words ("the company", "users", "people").
- For each entity, capture which source(s) [1..N] mention it.
- Create relationships ONLY when the text explicitly supports them. Use short verbs: "works at", "founded", "located in", "affiliated with", "mentioned by", "owns", "partnered with", "investigated", "criticized", etc.
- Keep labels concise (max 4 words).
- Limit to the most important 6-12 people, 4-10 organizations, 3-8 locations, 4-10 topics, 0-6 events.
- Return STRICT JSON only.`;

    const userPrompt = `QUERY: "${query}"

SOURCES:
${corpus}

Return JSON with this exact shape:
{
  "entities": [
    { "id": "string-id", "label": "Display Name", "type": "person|organization|location|topic|event", "sourceIndices": [1,2], "context": "one short sentence" }
  ],
  "relationships": [
    { "from": "id", "to": "id", "label": "verb phrase", "weight": 1 }
  ]
}`;

    const aiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            { role: 'user', parts: [{ text: userPrompt }] },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      return new Response(
        JSON.stringify({ success: false, error: `Gemini error ${aiResp.status}: ${txt.slice(0, 200)}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const aiData = await aiResp.json();
    const raw = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let parsed: { entities?: any[]; relationships?: any[] } = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const entities = Array.isArray(parsed.entities) ? parsed.entities : [];
    const relationships = Array.isArray(parsed.relationships) ? parsed.relationships : [];

    // Build the graph: source nodes + entity nodes
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Source nodes (one per scraped page)
    scraped.forEach((s, idx) => {
      nodes.push({
        id: `src-${idx + 1}`,
        label: s.domain,
        type: 'source',
        tier: s.tier,
        tierLabel: s.tierLabel,
        url: s.url,
        domain: s.domain,
        context: s.title,
      });
    });

    // Entity nodes
    const entityIds = new Set<string>();
    entities.forEach((e: any) => {
      if (!e?.id || !e?.label || !e?.type) return;
      const allowed = ['person', 'organization', 'location', 'topic', 'event'];
      if (!allowed.includes(e.type)) return;
      const id = `ent-${String(e.id).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40)}`;
      if (entityIds.has(id)) return;
      entityIds.add(id);
      nodes.push({
        id,
        label: String(e.label).slice(0, 60),
        type: e.type,
        mentions: Array.isArray(e.sourceIndices) ? e.sourceIndices.length : 1,
        context: e.context ? String(e.context).slice(0, 200) : undefined,
      });

      // mention edges from sources
      if (Array.isArray(e.sourceIndices)) {
        e.sourceIndices.forEach((si: number) => {
          if (si >= 1 && si <= scraped.length) {
            edges.push({
              source: `src-${si}`,
              target: id,
              label: 'mentions',
              weight: 1,
            });
          }
        });
      }
    });

    // Relationship edges
    relationships.forEach((r: any) => {
      if (!r?.from || !r?.to || !r?.label) return;
      const from = `ent-${String(r.from).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40)}`;
      const to = `ent-${String(r.to).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40)}`;
      if (entityIds.has(from) && entityIds.has(to)) {
        edges.push({
          source: from,
          target: to,
          label: String(r.label).slice(0, 30),
          weight: typeof r.weight === 'number' ? r.weight : 1,
        });
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        query,
        nodes,
        edges,
        scrapedCount: scraped.filter((s) => s.content.length > 0).length,
        totalSources: scraped.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to build intel map';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
