// Zophiel Intel Analysis - runs forensic analysis on search results across multiple
// intelligence dimensions: temporal, credibility, fact-check, narrative, investigative.
// Uses Lovable AI Gateway with structured tool-call output, OR the user's own
// BYOK provider when supplied (skips queue, no DB storage of the key).

import { isValidByok, callByokJsonWithRetry, type ZophielByokConfig } from '../_shared/zophielByokRouter.ts';
import { getCorsHeaders } from "../_shared/cors.ts";

type AnalysisType =
  | 'temporal'
  | 'credibility'
  | 'factcheck'
  | 'narrative'
  | 'investigative';

interface ResultIn {
  title: string;
  url: string;
  snippet?: string;
  source?: string;
  tier?: number;
  publishDate?: string;
}

const SCHEMAS: Record<AnalysisType, any> = {
  temporal: {
    name: 'temporal_analysis',
    description: 'Build a chronological timeline and detect narrative shifts.',
    parameters: {
      type: 'object',
      properties: {
        timeline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string', description: 'ISO date or human date' },
              source: { type: 'string' },
              headline: { type: 'string' },
              type: { type: 'string', enum: ['article', 'official_statement', 'leak', 'correction', 'social_post', 'analysis'] },
              keyFacts: { type: 'array', items: { type: 'string' } },
              importance: { type: 'number' },
              sentiment: { type: 'number', description: '-1 to 1' },
            },
            required: ['date', 'source', 'headline', 'type', 'keyFacts', 'importance', 'sentiment'],
            additionalProperties: false,
          },
        },
        narrativeShifts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string' },
              fromNarrative: { type: 'string' },
              toNarrative: { type: 'string' },
              trigger: { type: 'string' },
              impact: { type: 'string', enum: ['minor', 'moderate', 'major', 'paradigm_shift'] },
            },
            required: ['date', 'fromNarrative', 'toNarrative', 'trigger', 'impact'],
            additionalProperties: false,
          },
        },
        predictedDevelopments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              prediction: { type: 'string' },
              confidence: { type: 'number' },
              timeframe: { type: 'string' },
            },
            required: ['prediction', 'confidence', 'timeframe'],
            additionalProperties: false,
          },
        },
      },
      required: ['timeline', 'narrativeShifts', 'predictedDevelopments'],
      additionalProperties: false,
    },
  },
  credibility: {
    name: 'credibility_analysis',
    description: 'Assess credibility, bias, ownership and warnings for each source.',
    parameters: {
      type: 'object',
      properties: {
        sources: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string' },
              credibilityScore: { type: 'number', description: '0-100' },
              politicalBias: { type: 'number', description: '-100 far left to +100 far right' },
              biasConfidence: { type: 'number' },
              accuracyRate: { type: 'number' },
              ownership: { type: 'string' },
              fundingType: { type: 'string' },
              hasFactChecking: { type: 'boolean' },
              warnings: { type: 'array', items: { type: 'string' } },
              strengths: { type: 'array', items: { type: 'string' } },
            },
            required: ['source', 'credibilityScore', 'politicalBias', 'biasConfidence', 'accuracyRate', 'ownership', 'fundingType', 'hasFactChecking', 'warnings', 'strengths'],
            additionalProperties: false,
          },
        },
      },
      required: ['sources'],
      additionalProperties: false,
    },
  },
  factcheck: {
    name: 'fact_check',
    description: 'Extract claims, verify them, and detect contradictions.',
    parameters: {
      type: 'object',
      properties: {
        claims: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              claim: { type: 'string' },
              claimant: { type: 'string' },
              verdict: { type: 'string', enum: ['true', 'mostly_true', 'half_true', 'mostly_false', 'false', 'unverifiable'] },
              confidence: { type: 'number' },
              supportingSources: { type: 'array', items: { type: 'string' } },
              contradictingSources: { type: 'array', items: { type: 'string' } },
              consensusView: { type: 'string' },
              agreementPercent: { type: 'number' },
            },
            required: ['claim', 'claimant', 'verdict', 'confidence', 'supportingSources', 'contradictingSources', 'consensusView', 'agreementPercent'],
            additionalProperties: false,
          },
        },
        contradictions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              claim1: { type: 'string' },
              claim2: { type: 'string' },
              level: { type: 'string', enum: ['minor', 'moderate', 'severe', 'complete'] },
              explanation: { type: 'string' },
              possibleReason: { type: 'string' },
            },
            required: ['claim1', 'claim2', 'level', 'explanation', 'possibleReason'],
            additionalProperties: false,
          },
        },
      },
      required: ['claims', 'contradictions'],
      additionalProperties: false,
    },
  },
  narrative: {
    name: 'narrative_analysis',
    description: 'Detect narrative frames, sentiment, and loaded language.',
    parameters: {
      type: 'object',
      properties: {
        sentimentDistribution: {
          type: 'object',
          properties: {
            positive: { type: 'number' },
            neutral: { type: 'number' },
            negative: { type: 'number' },
          },
          required: ['positive', 'neutral', 'negative'],
          additionalProperties: false,
        },
        emotionalLanguage: {
          type: 'object',
          properties: {
            anger: { type: 'number' },
            fear: { type: 'number' },
            joy: { type: 'number' },
            sadness: { type: 'number' },
            neutral: { type: 'number' },
          },
          required: ['anger', 'fear', 'joy', 'sadness', 'neutral'],
          additionalProperties: false,
        },
        frames: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
              prevalence: { type: 'number', description: '0-100 percentage' },
              sentiment: { type: 'number', description: '-1 to 1' },
              emphasizes: { type: 'array', items: { type: 'string' } },
              downplays: { type: 'array', items: { type: 'string' } },
              ideologicalLean: { type: 'number', description: '-100 to 100' },
              sources: { type: 'array', items: { type: 'string' } },
              exampleHeadline: { type: 'string' },
            },
            required: ['name', 'description', 'prevalence', 'sentiment', 'emphasizes', 'downplays', 'ideologicalLean', 'sources', 'exampleHeadline'],
            additionalProperties: false,
          },
        },
        loadedTerms: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              term: { type: 'string' },
              count: { type: 'number' },
              connotation: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
              implication: { type: 'string' },
            },
            required: ['term', 'count', 'connotation', 'implication'],
            additionalProperties: false,
          },
        },
      },
      required: ['sentimentDistribution', 'emotionalLanguage', 'frames', 'loadedTerms'],
      additionalProperties: false,
    },
  },
  investigative: {
    name: 'investigative_assistant',
    description: 'Analyze gaps in knowledge and suggest investigation paths.',
    parameters: {
      type: 'object',
      properties: {
        confirmedFacts: { type: 'array', items: { type: 'string' } },
        likelyFacts: { type: 'array', items: { type: 'string' } },
        disputedFacts: { type: 'array', items: { type: 'string' } },
        unansweredQuestions: { type: 'array', items: { type: 'string' } },
        overallConfidence: { type: 'number' },
        gaps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              importance: { type: 'number' },
              urgency: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
              whyItMatters: { type: 'string' },
              likelyLocations: { type: 'array', items: { type: 'string' } },
              difficulty: { type: 'string', enum: ['easy', 'moderate', 'hard', 'very_hard'] },
              suggestedApproach: { type: 'string' },
              suggestedQueries: { type: 'array', items: { type: 'string' } },
            },
            required: ['description', 'importance', 'urgency', 'whyItMatters', 'likelyLocations', 'difficulty', 'suggestedApproach', 'suggestedQueries'],
            additionalProperties: false,
          },
        },
        investigationPath: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              phase: { type: 'string' },
              steps: { type: 'array', items: { type: 'string' } },
              expectedFindings: { type: 'string' },
              estimatedTime: { type: 'string' },
            },
            required: ['phase', 'steps', 'expectedFindings', 'estimatedTime'],
            additionalProperties: false,
          },
        },
      },
      required: ['confirmedFacts', 'likelyFacts', 'disputedFacts', 'unansweredQuestions', 'overallConfidence', 'gaps', 'investigationPath'],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPTS: Record<AnalysisType, string> = {
  temporal:
    'You are ZOPHIEL, an intelligence analyst. Reconstruct a chronological timeline of how a story evolved. Identify narrative shifts (when the dominant framing changed) and predict next developments. Use ONLY information present in the provided sources. If dates are missing, infer relative ordering.',
  credibility:
    'You are ZOPHIEL, a media-credibility analyst. For each unique source/domain, assess credibility (0-100), political bias (-100 left to +100 right), accuracy track record, ownership, and warnings. Be honest, evidence-based, and avoid US-centric assumptions.',
  factcheck:
    'You are ZOPHIEL, a forensic fact-checker. Extract the most important verifiable claims from the search results. For each claim, assign a verdict, confidence, supporting and contradicting sources, and a consensus view. Detect any contradictions between sources.',
  narrative:
    'You are ZOPHIEL, a narrative analyst. Detect the dominant narrative frames competing in this coverage. For each frame, identify what it emphasizes vs downplays, ideological lean, and sentiment. Flag loaded/emotional language with its implication.',
  investigative:
    'You are ZOPHIEL, a senior investigator. From the search results, distill what is confirmed, likely, disputed, and unknown. Identify the most critical information gaps, why they matter, and a concrete investigation path with phases and queries.',
};

function buildUserPrompt(query: string, results: ResultIn[]): string {
  const lines = results.slice(0, 20).map((r, i) => {
    const date = r.publishDate ? ` [${r.publishDate}]` : '';
    const tier = r.tier ? ` (tier ${r.tier})` : '';
    return `[${i + 1}]${date} ${r.source || new URL(r.url).hostname}${tier}\nTitle: ${r.title}\nSnippet: ${r.snippet || '(no snippet)'}\nURL: ${r.url}`;
  });
  return `Query: "${query}"\n\nSources (${results.length}):\n\n${lines.join('\n\n')}\n\nProduce the structured analysis now.`;
}

// Gemini's function-declaration schema rejects `additionalProperties` and a few
// other JSON-Schema keywords. Recursively strip them so the same OpenAI-style
// schema can be reused.
function sanitizeForGemini(node: any): any {
  if (Array.isArray(node)) return node.map(sanitizeForGemini);
  if (node && typeof node === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(node)) {
      if (k === 'additionalProperties' || k === '$schema' || k === 'definitions') continue;
      out[k] = sanitizeForGemini(v);
    }
    return out;
  }
  return node;
}

async function callGateway(type: AnalysisType, query: string, results: ResultIn[], apiKey: string) {
  if (!apiKey) throw new Error('GEMINI key missing');

  const schema = SCHEMAS[type];
  const systemPrompt = SYSTEM_PROMPTS[type];
  const cleanParameters = sanitizeForGemini(schema.parameters);

  // Convert OpenAI-style JSON Schema to Gemini function declaration
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [
          { role: 'user', parts: [{ text: buildUserPrompt(query, results) }] },
        ],
        tools: [{
          functionDeclarations: [{
            name: schema.name,
            description: schema.description,
            parameters: cleanParameters,
          }],
        }],
        toolConfig: {
          functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [schema.name] },
        },
      }),
    },
  );

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Gemini API ${r.status}: ${t.slice(0, 300)}`);
  }
  const data = await r.json();
  const fc = data?.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall)?.functionCall;
  if (!fc?.args) throw new Error('No function call returned');
  return fc.args;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { query, results, type, byok } = await req.json();

    if (!query || !Array.isArray(results) || results.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'query and results[] required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!type || !(type in SCHEMAS)) {
      return new Response(
        JSON.stringify({ success: false, error: 'type must be one of: temporal, credibility, factcheck, narrative, investigative' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // STRICT BYOK GATE — only the admin may use the platform Gemini key.
    let _resolved;
    try {
      _resolved = await (await import('../_shared/adminGate.ts')).resolveKey(req, byok);
    } catch (e: any) {
      return (await import('../_shared/adminGate.ts')).byokErrorResponse(e, corsHeaders);
    }

    let analysis: unknown;
    if (_resolved.mode === 'byok') {
      const t = type as AnalysisType;
      const schema = SCHEMAS[t];
      const sys = SYSTEM_PROMPTS[t] +
        `\n\nReturn ONLY a single valid JSON object that matches this schema (no extra prose, no markdown):\n` +
        JSON.stringify({ name: schema.name, parameters: schema.parameters });
      try {
        const raw = await callByokJsonWithRetry(_resolved.byok as ZophielByokConfig, sys, buildUserPrompt(query, results as ResultIn[]), {
          timeoutMs: 60_000,
          temperature: 0.25,
          maxOutputTokens: 8192,
          attempts: 2,
        });
        let cleaned = (raw || '').replace(/```json\n?|```/g, '').trim();
        const lastBrace = cleaned.lastIndexOf('}');
        if (lastBrace !== -1) cleaned = cleaned.slice(0, lastBrace + 1);
        analysis = JSON.parse(cleaned);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'BYOK call failed';
        console.error('[intel-analysis] BYOK error', msg);
        return new Response(JSON.stringify({ success: false, error: `Your AI key call failed: ${msg}` }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      analysis = await callGateway(type as AnalysisType, query, results as ResultIn[], _resolved.geminiKey || '');
    }

    return new Response(
      JSON.stringify({ success: true, type, query, analysis, generatedAt: new Date().toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('zophiel-intel-analysis error:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    const status = msg.includes('429') ? 429 : msg.includes('402') ? 402 : 500;
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
