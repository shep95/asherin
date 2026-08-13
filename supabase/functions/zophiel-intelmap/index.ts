import { getCorsHeaders } from "../_shared/cors.ts";
// Zophiel Intel Map - scrapes top search results and extracts an entity graph
// using Lovable AI Gateway. Returns nodes (sources, people, orgs, locations,
// topics) and edges (mentions, affiliations, references) for relationship mapping.

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

async function fetchPage(url: string, timeoutMs = 4500): Promise<string> {
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

interface ByokConfig {
  provider: 'google' | 'openai' | 'anthropic' | 'xai' | 'deepseek' | 'mistral' | 'perplexity';
  model: string;
  apiKey: string;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { query, results, offset = 0, byok = null } = await req.json() as {
      query: string;
      results: ResultIn[];
      offset?: number;
      byok?: ByokConfig | null;
    };
    if (!Array.isArray(results) || results.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No results provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // STRICT BYOK GATE — only the admin may consume the platform Gemini key.
    // Every other caller MUST send a BYOK config or get a 403.
    let _resolved;
    try {
      _resolved = await (await import('../_shared/adminGate.ts')).resolveKey(req, byok);
    } catch (e: any) {
      return (await import('../_shared/adminGate.ts')).byokErrorResponse(e, corsHeaders);
    }
    const useByok = _resolved.mode === 'byok';
    const GEMINI_API_KEY = _resolved.geminiKey || '';

    // Sequential scrape with 8s delay between pages.
    // Edge functions cap at 150s wall-clock — at 8s/page we cap input at 8 pages
    // (≈64s scraping + ~20-30s for Gemini = safe margin). The client may send up to 30 results;
    // we only fetch the top SCRAPE_LIMIT, but ALL sources still appear as nodes in the graph.
    const SCRAPE_LIMIT = 8;
    const DELAY_MS = 8_000;
    const startIdx = Math.max(0, Math.floor(Number(offset) || 0));
    const endIdx = Math.min(results.length, startIdx + SCRAPE_LIMIT);
    const top = results.slice(startIdx, endIdx);
    const nextOffset = endIdx;
    const hasMore = endIdx < results.length;

    if (top.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No more sources to scrape', nextOffset: startIdx, hasMore: false }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const scraped: Array<ResultIn & { domain: string; content: string; sourceIndex: number }> = [];
    for (let i = 0; i < top.length; i++) {
      const r = top[i];
      let content = '';
      try {
        content = await fetchPage(r.url, 8000);
        console.log(`[intelmap] scraped ${i + 1}/${top.length} (offset ${startIdx}): ${domainOf(r.url)} (${content.length} chars)`);
      } catch (e) {
        console.warn(`[intelmap] scrape failed ${i + 1}/${top.length}: ${r.url}`, e);
        content = '';
      }
      // Use a STABLE absolute index so node IDs don't collide across batches.
      scraped.push({ ...r, domain: domainOf(r.url), content, sourceIndex: startIdx + i + 1 });
      // Wait 10s before next page (skip after last)
      if (i < top.length - 1) await new Promise((res) => setTimeout(res, DELAY_MS));
    }

    // Build a compact corpus for the AI
    const corpus = scraped.map((s, i) =>
      `[SOURCE ${i + 1}] (${s.tierLabel || 'Source'}) ${s.title}
URL: ${s.url}
DOMAIN: ${s.domain}
SNIPPET: ${s.snippet || ''}
EXCERPT: ${(s.content || s.snippet || '').slice(0, 2500)}
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

    // ---- AI CALL ROUTER ----
    // If `useByok`, route to the user's chosen provider. Otherwise use the platform
    // Gemini key with our standard retry/fallback chain.

    const callGemini = async (apiKey: string, model: string, timeoutMs: number) => {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: ctl.signal,
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: systemPrompt }] },
              contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 8192 },
            }),
          },
        );
        if (!r.ok) {
          const txt = await r.text();
          console.error(`[intelmap] gemini ${model} error ${r.status}`, txt.slice(0, 200));
          const retryable = r.status === 503 || r.status === 429 || r.status >= 500;
          const err: any = new Error(`gemini_${model}_${r.status}: ${txt.slice(0, 120)}`);
          err.retryable = retryable;
          err.status = r.status;
          throw err;
        }
        const d = await r.json();
        return d?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      } finally { clearTimeout(t); }
    };

    // OpenAI-compatible (works for OpenAI, DeepSeek, xAI, Perplexity, Mistral)
    const callOpenAICompat = async (
      baseUrl: string, apiKey: string, model: string, timeoutMs: number,
      extraHeaders: Record<string, string> = {},
    ) => {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const r = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            ...extraHeaders,
          },
          signal: ctl.signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt + '\n\nReturn ONLY valid JSON. No prose, no markdown, no code fences.' },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' },
          }),
        });
        if (!r.ok) {
          const txt = await r.text();
          console.error(`[intelmap] ${baseUrl} ${model} error ${r.status}`, txt.slice(0, 200));
          const retryable = r.status === 503 || r.status === 429 || r.status >= 500;
          const err: any = new Error(`byok_${r.status}: ${txt.slice(0, 160)}`);
          err.retryable = retryable;
          err.status = r.status;
          throw err;
        }
        const d = await r.json();
        return d?.choices?.[0]?.message?.content || '{}';
      } finally { clearTimeout(t); }
    };

    const callAnthropic = async (apiKey: string, model: string, timeoutMs: number) => {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          signal: ctl.signal,
          body: JSON.stringify({
            model,
            max_tokens: 8192,
            system: systemPrompt + '\n\nReturn ONLY valid JSON with no prose, markdown, or code fences.',
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });
        if (!r.ok) {
          const txt = await r.text();
          console.error(`[intelmap] anthropic ${model} error ${r.status}`, txt.slice(0, 200));
          const retryable = r.status === 503 || r.status === 429 || r.status >= 500;
          const err: any = new Error(`anthropic_${r.status}: ${txt.slice(0, 160)}`);
          err.retryable = retryable;
          err.status = r.status;
          throw err;
        }
        const d = await r.json();
        const parts = Array.isArray(d?.content) ? d.content : [];
        const text = parts.filter((p: any) => p?.type === 'text').map((p: any) => p.text).join('') || '{}';
        return text;
      } finally { clearTimeout(t); }
    };

    const callByok = async (cfg: ByokConfig, timeoutMs: number) => {
      switch (cfg.provider) {
        case 'google':     return callGemini(cfg.apiKey, cfg.model, timeoutMs);
        case 'openai':     return callOpenAICompat('https://api.openai.com/v1', cfg.apiKey, cfg.model, timeoutMs);
        case 'anthropic':  return callAnthropic(cfg.apiKey, cfg.model, timeoutMs);
        case 'xai':        return callOpenAICompat('https://api.x.ai/v1', cfg.apiKey, cfg.model, timeoutMs);
        case 'deepseek':   return callOpenAICompat('https://api.deepseek.com/v1', cfg.apiKey, cfg.model, timeoutMs);
        case 'mistral':    return callOpenAICompat('https://api.mistral.ai/v1', cfg.apiKey, cfg.model, timeoutMs);
        case 'perplexity': return callOpenAICompat('https://api.perplexity.ai', cfg.apiKey, cfg.model, timeoutMs);
        default: throw new Error(`unsupported_provider_${(cfg as any).provider}`);
      }
    };

    let raw = '{}';
    let aiError: string | null = null;
    let usedModel: string | null = null;

    if (useByok) {
      // Single-model flow — user picked their model, we respect it. 3 attempts on transient errors.
      const attempts = 3;
      for (let a = 0; a < attempts; a++) {
        try {
          raw = await callByok(byok!, 60_000);
          usedModel = `byok:${byok!.provider}/${byok!.model}`;
          aiError = null;
          break;
        } catch (e: any) {
          aiError = e?.message || 'byok_fail';
          console.warn(`[intelmap] BYOK attempt ${a + 1}/${attempts} failed:`, aiError);
          if (!e?.retryable) break;
          if (a < attempts - 1) {
            const wait = 800 * Math.pow(2.2, a) + Math.random() * 400;
            await new Promise((r) => setTimeout(r, wait));
          }
        }
      }
    } else {
      // Platform Gemini: try fast → lite → pro with backoff
      const MODEL_CHAIN = ['gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-pro-latest'];
      outer: for (let mi = 0; mi < MODEL_CHAIN.length; mi++) {
        const model = MODEL_CHAIN[mi];
        const attempts = mi === 0 ? 3 : 2;
        for (let a = 0; a < attempts; a++) {
          try {
            raw = await callGemini(GEMINI_API_KEY, model, 22000);
            usedModel = model;
            aiError = null;
            break outer;
          } catch (e: any) {
            aiError = e?.message || 'gemini_fail';
            console.warn(`[intelmap] attempt ${a + 1}/${attempts} on ${model} failed:`, aiError);
            if (!e?.retryable) break;
            if (a < attempts - 1) {
              const wait = 800 * Math.pow(2.2, a) + Math.random() * 400;
              await new Promise((r) => setTimeout(r, wait));
            }
          }
        }
        if (mi < MODEL_CHAIN.length - 1) await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (usedModel) {
      console.log(`[intelmap] AI succeeded with model=${usedModel}`);
    } else {
      console.error('[intelmap] AI failed:', aiError);
    }

    // Strip code fences if any
    raw = raw.replace(/```json\n?|```/g, '').trim();
    const lastBrace = raw.lastIndexOf('}');
    if (lastBrace !== -1) raw = raw.slice(0, lastBrace + 1);
    let parsed: { entities?: any[]; relationships?: any[] } = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const entities = Array.isArray(parsed.entities) ? parsed.entities : [];
    const relationships = Array.isArray(parsed.relationships) ? parsed.relationships : [];

    // Build the graph: source nodes + entity nodes
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Source nodes (one per scraped page) — use STABLE absolute index so additional
    // batches append cleanly without colliding with prior IDs.
    scraped.forEach((s) => {
      nodes.push({
        id: `src-${s.sourceIndex}`,
        label: s.domain,
        type: 'source',
        tier: s.tier,
        tierLabel: s.tierLabel,
        url: s.url,
        domain: s.domain,
        context: s.title,
      });
    });

    // Entity nodes — prefix entity IDs with the batch offset so the same generic
    // label (e.g. "twitter") from a later batch doesn't merge into an old node.
    const batchPrefix = `b${startIdx}`;
    const entityIds = new Set<string>();
    entities.forEach((e: any) => {
      if (!e?.id || !e?.label || !e?.type) return;
      const allowed = ['person', 'organization', 'location', 'topic', 'event'];
      if (!allowed.includes(e.type)) return;
      const id = `ent-${batchPrefix}-${String(e.id).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40)}`;
      if (entityIds.has(id)) return;
      entityIds.add(id);
      nodes.push({
        id,
        label: String(e.label).slice(0, 60),
        type: e.type,
        mentions: Array.isArray(e.sourceIndices) ? e.sourceIndices.length : 1,
        context: e.context ? String(e.context).slice(0, 200) : undefined,
      });

      // mention edges from sources — map AI's 1..N indices back to absolute source IDs
      if (Array.isArray(e.sourceIndices)) {
        e.sourceIndices.forEach((si: number) => {
          if (si >= 1 && si <= scraped.length) {
            const absoluteIdx = scraped[si - 1].sourceIndex;
            edges.push({
              source: `src-${absoluteIdx}`,
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
      const from = `ent-${batchPrefix}-${String(r.from).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40)}`;
      const to = `ent-${batchPrefix}-${String(r.to).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40)}`;
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
        offset: startIdx,
        nextOffset,
        hasMore,
        totalAvailable: results.length,
        aiError,
        usedModel,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to build intel map';
    // Return 200 with success:false so the client's invoke() doesn't throw a generic non-2xx error
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
