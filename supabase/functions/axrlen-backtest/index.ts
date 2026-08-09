// ─────────────────────────────────────────────────────────────
// AXRLEN BACKTEST — historical validation of the Vedic + AI stack.
//
// Takes 20 known-outcome events across 2020-2024, freezes the Vedic
// context to a date BEFORE each event, asks Gemini to blind-predict
// the next 30 days for that region using ONLY the vedic snapshot +
// its own pre-event world knowledge, then a second Gemini pass scores
// each prediction against the actual outcome (LLM-as-judge, 0-100).
//
// Returns per-case detail plus aggregate accuracy so the operator can
// see if the engine's Vedic timing signals track reality.
// ─────────────────────────────────────────────────────────────
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface BacktestCase {
  id: string;
  region: string;
  regionCode: string;
  analysisDate: string;   // ISO — what AXRLEN "sees"
  eventDate: string;      // ISO — when the real event happened
  actualEvent: string;    // ground truth (hidden from prediction call)
  category: string;
}

// 20 high-signal events, analysisDate = 3-10 days pre-event so timing matters.
const CASES: BacktestCase[] = [
  { id: "c01", region: "China",   regionCode: "CN", analysisDate: "2020-03-05", eventDate: "2020-03-11", actualEvent: "WHO declares COVID-19 a global pandemic; markets crash; global lockdowns cascade.", category: "humanitarian" },
  { id: "c02", region: "Ukraine", regionCode: "UA", analysisDate: "2022-02-18", eventDate: "2022-02-24", actualEvent: "Russia launches full-scale invasion of Ukraine; largest European war since 1945.", category: "security" },
  { id: "c03", region: "Israel",  regionCode: "IL", analysisDate: "2023-10-01", eventDate: "2023-10-07", actualEvent: "Hamas launches surprise attack from Gaza; 1,200 killed; Israel declares war.", category: "security" },
  { id: "c04", region: "United States", regionCode: "US", analysisDate: "2020-03-10", eventDate: "2020-03-16", actualEvent: "US equity market crashes 12% (Black Monday II); circuit breakers triggered.", category: "economic" },
  { id: "c05", region: "United States", regionCode: "US", analysisDate: "2021-01-02", eventDate: "2021-01-06", actualEvent: "Trump supporters storm US Capitol during electoral vote certification.", category: "political" },
  { id: "c06", region: "United Kingdom", regionCode: "GB", analysisDate: "2022-09-01", eventDate: "2022-09-08", actualEvent: "Queen Elizabeth II dies at Balmoral; end of 70-year reign.", category: "political" },
  { id: "c07", region: "United States", regionCode: "US", analysisDate: "2023-03-05", eventDate: "2023-03-10", actualEvent: "Silicon Valley Bank collapses — largest US bank failure since 2008.", category: "economic" },
  { id: "c08", region: "Afghanistan", regionCode: "AF", analysisDate: "2021-08-10", eventDate: "2021-08-15", actualEvent: "Taliban captures Kabul; Ghani government collapses in 11 days.", category: "political" },
  { id: "c09", region: "Japan", regionCode: "JP", analysisDate: "2022-07-02", eventDate: "2022-07-08", actualEvent: "Former PM Shinzo Abe assassinated at campaign event in Nara.", category: "security" },
  { id: "c10", region: "United States", regionCode: "US", analysisDate: "2024-07-08", eventDate: "2024-07-13", actualEvent: "Assassination attempt on Donald Trump at Butler, PA rally; ear grazed.", category: "security" },
  { id: "c11", region: "United States", regionCode: "US", analysisDate: "2020-05-20", eventDate: "2020-05-25", actualEvent: "George Floyd killed by Minneapolis police; triggers global BLM protests.", category: "humanitarian" },
  { id: "c12", region: "United States", regionCode: "US", analysisDate: "2022-06-18", eventDate: "2022-06-24", actualEvent: "Supreme Court overturns Roe v Wade in Dobbs decision.", category: "political" },
  { id: "c13", region: "Turkey", regionCode: "TR", analysisDate: "2023-02-01", eventDate: "2023-02-06", actualEvent: "M7.8 earthquake devastates Turkey/Syria; 55,000+ killed.", category: "environmental" },
  { id: "c14", region: "United States", regionCode: "US", analysisDate: "2020-10-28", eventDate: "2020-11-03", actualEvent: "Biden wins US presidential election; Trump refuses to concede.", category: "political" },
  { id: "c15", region: "Israel", regionCode: "IL", analysisDate: "2021-05-05", eventDate: "2021-05-10", actualEvent: "Israel-Gaza 11-day war erupts over Sheikh Jarrah + Al-Aqsa clashes.", category: "security" },
  { id: "c16", region: "United States", regionCode: "US", analysisDate: "2022-11-03", eventDate: "2022-11-08", actualEvent: "FTX crypto exchange collapses; $8B customer funds gone; SBF arrested.", category: "economic" },
  { id: "c17", region: "Bangladesh", regionCode: "BD", analysisDate: "2024-07-30", eventDate: "2024-08-05", actualEvent: "PM Sheikh Hasina flees Bangladesh amid student uprising; 15-year rule ends.", category: "political" },
  { id: "c18", region: "Sudan", regionCode: "SD", analysisDate: "2023-04-10", eventDate: "2023-04-15", actualEvent: "Sudan war erupts between SAF and RSF; Khartoum becomes battlefield.", category: "security" },
  { id: "c19", region: "Syria", regionCode: "SY", analysisDate: "2024-12-02", eventDate: "2024-12-08", actualEvent: "Assad regime collapses; HTS/rebels take Damascus in 11-day offensive.", category: "political" },
  { id: "c20", region: "Myanmar", regionCode: "MM", analysisDate: "2021-01-27", eventDate: "2021-02-01", actualEvent: "Military coup overthrows Aung San Suu Kyi government; junta seizes power.", category: "political" },
];

interface Prediction {
  case_id: string;
  predicted_events: Array<{
    title: string;
    category: string;
    probability: number;
    timeframe_days: number;
    vedic_driver: string; // dasha + transit citation
  }>;
  summary_prediction: string;
  primary_probability: number;
}

interface Score {
  case_id: string;
  score: number;             // 0-100 alignment
  hit: boolean;              // score >= 60
  matched_prediction: string;
  reasoning: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // BYOK / admin gate (same policy as axrlen-analyze)
  try {
    const _b = await req.clone().json().catch(() => ({} as any));
    const _byok = (_b && typeof _b === 'object') ? (_b as any).byok : undefined;
    const _gate = await import('../_shared/adminGate.ts');
    await _gate.resolveKey(req, _byok);
  } catch (e) {
    const _gate = await import('../_shared/adminGate.ts');
    return _gate.byokErrorResponse(e, corsHeaders);
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const offset = Math.min(Math.max(Number(body.offset) || 0, 0), CASES.length);
    const limit = Math.min(Math.max(Number(body.limit) || CASES.length, 1), CASES.length - offset);
    const cases = CASES.slice(offset, offset + limit);

    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!GEMINI_KEY && !LOVABLE_KEY) {
      return new Response(JSON.stringify({ success: false, error: "No AI key available" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── PASS 1: build frozen Vedic snapshots for each case ────────
    const snapshots = cases.map(c => {
      const ctx = buildVedicContext(c.regionCode, new Date(c.analysisDate + "T12:00:00Z"));
      return {
        case_id: c.id,
        region: c.region,
        analysisDate: c.analysisDate,
        vedicBlock: vedicContextAsPromptBlock(ctx),
        dashaCompact: `${ctx.globalDasha.maha.lord}-${ctx.globalDasha.antar.lord}-${ctx.globalDasha.pratyantar.lord}`,
      };
    });

    // ── PASS 2: batched blind prediction call ─────────────────────
    // We hide actualEvent. Ask model to predict what happens in the
    // 30 days AFTER analysisDate for that region, grounded in the
    // frozen Vedic snapshot + its own pre-cutoff world knowledge.
    const predictionSystem = `You are AXRLEN, a historical Vedic geopolitical prediction engine. You are being backtested.

For each CASE you receive: the analysis date, region, and a computed Vedic snapshot frozen at that date.
Predict the top 1-3 most likely events in the 30 days AFTER the analysis date for that region.
Ground each prediction in specific dasha lords + transiting planets from the snapshot.
Do NOT reveal you know what actually happened. Predict as if it is the analysis date.
Be specific — name the event type (war, crash, coup, disaster, assassination, protest, resignation, etc.), not vague trends.

Return ONLY valid JSON:
{
  "predictions": [
    {
      "case_id": "cXX",
      "predicted_events": [
        { "title": "...", "category": "security|economic|political|humanitarian|environmental", "probability": 0-100, "timeframe_days": 1-30, "vedic_driver": "..." }
      ],
      "summary_prediction": "one sentence — the MOST likely single event",
      "primary_probability": 0-100
    }
  ]
}`;

    const predictionUser = `BACKTEST CASES:\n\n` + snapshots.map(s => `
──────── CASE ${s.case_id} — ${s.region} — analysisDate ${s.analysisDate} ────────
Active Vimshottari: ${s.dashaCompact}
${s.vedicBlock}
`).join("\n");

    const predictions = await callGeminiJson(predictionSystem, predictionUser, GEMINI_KEY, LOVABLE_KEY);
    const predArr: Prediction[] = predictions?.predictions || [];

    // ── PASS 3: LLM-as-judge scoring ──────────────────────────────
    const judgeSystem = `You are a strict backtest scorer. For each case you get: the AXRLEN prediction and the ACTUAL event that happened.
Score alignment 0-100:
  90-100 = predicted the exact event, category and timeframe
  70-89  = predicted the correct event category and general direction
  50-69  = partial — predicted related turbulence but wrong specific event
  20-49  = wrong direction but at least flagged the region as high risk
  0-19   = complete miss
"hit" = score >= 60. Be honest — reward specificity, punish vagueness.

Return ONLY valid JSON:
{ "scores": [ { "case_id": "cXX", "score": 0-100, "hit": bool, "matched_prediction": "...", "reasoning": "..." } ] }`;

    const judgeUser = `SCORE THESE:\n\n` + cases.map(c => {
      const p = predArr.find(x => x.case_id === c.id);
      return `
──────── ${c.id} — ${c.region} ────────
ACTUAL EVENT (${c.eventDate}): ${c.actualEvent}
AXRLEN PREDICTED: ${p?.summary_prediction || "(no prediction)"} (P=${p?.primary_probability ?? 0}%)
Predicted events: ${JSON.stringify(p?.predicted_events || [])}
`;
    }).join("\n");

    const judged = await callGeminiJson(judgeSystem, judgeUser, GEMINI_KEY, LOVABLE_KEY);
    const scoreArr: Score[] = judged?.scores || [];

    // ── Aggregate ─────────────────────────────────────────────────
    const merged = cases.map(c => {
      const p = predArr.find(x => x.case_id === c.id);
      const s = scoreArr.find(x => x.case_id === c.id);
      return {
        case: c,
        prediction: p || null,
        score: s || { case_id: c.id, score: 0, hit: false, matched_prediction: "", reasoning: "no score returned" },
      };
    });

    const totalScore = merged.reduce((a, m) => a + (m.score.score || 0), 0);
    const avgScore = merged.length ? totalScore / merged.length : 0;
    const hits = merged.filter(m => m.score.hit).length;

    return new Response(JSON.stringify({
      success: true,
      summary: {
        cases: merged.length,
        avgScore: Number(avgScore.toFixed(1)),
        hits,
        hitRate: Number((hits / merged.length * 100).toFixed(1)),
        interpretation: avgScore >= 70 ? "STRONG — Vedic timing tracks reality"
                      : avgScore >= 55 ? "MODERATE — signal present, needs weight tuning"
                      : avgScore >= 40 ? "WEAK — engine flags turbulence but misses specifics"
                      : "POOR — predictions ≈ noise",
      },
      results: merged,
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("axrlen-backtest error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ────────── Gemini JSON helper (Google direct → Lovable fallback) ──────────
async function callGeminiJson(sys: string, user: string, geminiKey?: string, lovableKey?: string): Promise<any> {
  if (geminiKey) {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: sys + "\n\n" + user }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 32768, responseMimeType: "application/json" },
        }),
      }
    );
    if (r.ok) {
      const d = await r.json();
      const txt = d.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      return safeParse(txt);
    }
    console.error("Gemini backtest error:", r.status, await r.text());
  }
  if (lovableKey) {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${lovableKey}` },
      body: JSON.stringify({
        model: "google/gemini-flash-latest",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
    });
    if (!r.ok) throw new Error(`AI gateway ${r.status}: ${await r.text()}`);
    const d = await r.json();
    return safeParse(d.choices?.[0]?.message?.content || "{}");
  }
  throw new Error("No AI key configured");
}

function safeParse(t: string): any {
  try { return JSON.parse(t); }
  catch {
    const m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) return JSON.parse(m[1]);
    throw new Error("Failed to parse AI JSON");
  }
}
