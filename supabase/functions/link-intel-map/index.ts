// LINK INTEL MAP — Aureon's URL-forensics intel graph.
// Mirror of zophiel-intelmap, but the system prompt is tuned for a SINGLE target
// URL: extract hosting stack, related domains, certificate parties, exposed paths,
// JS/SDK leaks, breach signals, social/SEO footprint, and archived versions.
//
// Strict BYOK: only the admin may use the platform Gemini key — every other
// caller MUST supply a BYOK config.

import { resolveKey, byokErrorResponse } from '../_shared/adminGate.ts';
import { isValidByok, callByokJson, type ZophielByokConfig } from '../_shared/zophielByokRouter.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface GraphNode {
  id: string;
  label: string;
  type: 'target' | 'host' | 'cert' | 'domain' | 'path' | 'tech' | 'org' | 'leak' | 'archive';
  url?: string;
  domain?: string;
  context?: string;
}
interface GraphEdge { source: string; target: string; label: string; weight: number; }

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

const SYSTEM_PROMPT = `You are an OSINT URL-forensics analyst building an intelligence graph for a SINGLE target URL.

You will receive a forensic dossier (extraction payload) about one URL. Identify ONLY real, observable entities:
- "host": hosting providers, CDNs, DNS providers, ASNs (e.g. "Cloudflare", "AWS us-east-1", "Vercel").
- "cert": TLS certificate issuers and notable cert SANs (e.g. "Let's Encrypt", "DigiCert", subject orgs).
- "domain": related/sibling domains, redirects, parent companies, subdomains.
- "path": exposed admin/internal/api paths uncovered.
- "tech": frameworks, JS bundles, SDKs, analytics, tag managers detected.
- "org": owning company, holding entity, registrar org, partner/integration orgs explicitly named.
- "leak": secrets, exposed tokens, leaked emails, breach hits, public S3 buckets.
- "archive": historical snapshots (Wayback, archive.today) when present.

Rules:
- Skip generic words. Use proper names.
- Keep labels short (max 4 words).
- Create relationships ONLY where the dossier supports them. Use short verbs: "hosted on", "issued by", "owned by", "redirects to", "loads", "exposes", "leaks", "snapshot of", "subdomain of".
- Limit total entities to ~25 of the strongest signals.
- Return STRICT JSON only.`;

function buildUserPrompt(targetUrl: string, payload: unknown): string {
  return `TARGET: ${targetUrl}

DOSSIER:
${JSON.stringify(payload).slice(0, 14000)}

Return JSON with this exact shape:
{
  "entities": [
    { "id": "string-id", "label": "Display Name", "type": "host|cert|domain|path|tech|org|leak|archive", "context": "one short sentence" }
  ],
  "relationships": [
    { "from": "id-or-target", "to": "id-or-target", "label": "verb", "weight": 1 }
  ]
}

Always include relationships from the special id "target" to every entity that the target URL directly depends on.`;
}

async function callGemini(apiKey: string, model: string, sys: string, usr: string, timeoutMs: number) {
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
          systemInstruction: { parts: [{ text: sys }] },
          contents: [{ role: 'user', parts: [{ text: usr }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.3, maxOutputTokens: 6144 },
        }),
      },
    );
    if (!r.ok) {
      const txt = await r.text();
      const err: any = new Error(`gemini_${model}_${r.status}: ${txt.slice(0, 120)}`);
      err.retryable = r.status === 503 || r.status === 429 || r.status >= 500;
      err.status = r.status;
      throw err;
    }
    const d = await r.json();
    return d?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  } finally { clearTimeout(t); }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { targetUrl, payload, byok = null } = await req.json() as {
      targetUrl: string; payload: unknown; byok?: ZophielByokConfig | null;
    };
    if (!targetUrl) {
      return new Response(JSON.stringify({ success: false, error: 'targetUrl required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let resolved;
    try { resolved = await resolveKey(req, byok); }
    catch (e: any) { return byokErrorResponse(e, corsHeaders); }

    const userPrompt = buildUserPrompt(targetUrl, payload || {});

    let raw = '{}';
    let usedModel: string | null = null;
    let aiError: string | null = null;

    if (resolved.mode === 'byok' && isValidByok(resolved.byok)) {
      try {
        raw = await callByokJson(resolved.byok!, SYSTEM_PROMPT, userPrompt, {
          timeoutMs: 60_000, temperature: 0.3, maxOutputTokens: 6144,
        });
        usedModel = `byok:${resolved.byok!.provider}/${resolved.byok!.model}`;
      } catch (e: any) {
        aiError = e?.message || 'byok_fail';
      }
    } else {
      const CHAIN = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro'];
      outer: for (let i = 0; i < CHAIN.length; i++) {
        const model = CHAIN[i];
        for (let a = 0; a < 2; a++) {
          try {
            raw = await callGemini(resolved.geminiKey!, model, SYSTEM_PROMPT, userPrompt, 22_000);
            usedModel = model;
            aiError = null;
            break outer;
          } catch (e: any) {
            aiError = e?.message || 'gemini_fail';
            if (!e?.retryable) break;
            if (a < 1) await new Promise((r) => setTimeout(r, 800 * (a + 1) + Math.random() * 400));
          }
        }
      }
    }

    raw = raw.replace(/```json\n?|```/g, '').trim();
    const lastBrace = raw.lastIndexOf('}');
    if (lastBrace !== -1) raw = raw.slice(0, lastBrace + 1);
    let parsed: { entities?: any[]; relationships?: any[] } = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Special target node
    nodes.push({
      id: 'target',
      label: domainOf(targetUrl),
      type: 'target',
      url: targetUrl,
      domain: domainOf(targetUrl),
      context: 'Target URL',
    });

    const ids = new Set<string>(['target']);
    const allowed = new Set(['host', 'cert', 'domain', 'path', 'tech', 'org', 'leak', 'archive']);
    (parsed.entities || []).forEach((e: any) => {
      if (!e?.id || !e?.label || !e?.type || !allowed.has(e.type)) return;
      const id = `link-${String(e.id).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40)}`;
      if (ids.has(id)) return;
      ids.add(id);
      nodes.push({
        id,
        label: String(e.label).slice(0, 60),
        type: e.type,
        context: e.context ? String(e.context).slice(0, 200) : undefined,
      });
    });

    (parsed.relationships || []).forEach((r: any) => {
      if (!r?.from || !r?.to || !r?.label) return;
      const from = r.from === 'target' ? 'target' : `link-${String(r.from).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40)}`;
      const to = r.to === 'target' ? 'target' : `link-${String(r.to).replace(/[^a-z0-9_-]/gi, '_').slice(0, 40)}`;
      if (ids.has(from) && ids.has(to)) {
        edges.push({ source: from, target: to, label: String(r.label).slice(0, 30), weight: typeof r.weight === 'number' ? r.weight : 1 });
      }
    });

    return new Response(JSON.stringify({
      success: true,
      targetUrl,
      nodes,
      edges,
      usedModel,
      aiError,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Failed to build link intel map';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
