// AVA Sports Brain - Daily Pick Generator
// Pulls live odds from ESPN scoreboards across major leagues, sends to Gemini
// using the AVA Sports Algo prompt, parses 2 best picks, persists to ava_picks.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

const LEAGUES: { sport: string; league: string; path: string; weight: number }[] = [
  { sport: "Football",   league: "NFL",            path: "football/nfl",         weight: 100 },
  { sport: "Basketball", league: "NBA",            path: "basketball/nba",       weight: 90  },
  { sport: "Football",   league: "NCAA Football",  path: "football/college-football", weight: 85 },
  { sport: "Basketball", league: "NCAA Basketball",path: "basketball/mens-college-basketball", weight: 78 },
  { sport: "Hockey",     league: "NHL",            path: "hockey/nhl",           weight: 70 },
  { sport: "Baseball",   league: "MLB",            path: "baseball/mlb",         weight: 70 },
  { sport: "Soccer",     league: "Premier League", path: "soccer/eng.1",         weight: 80 },
  { sport: "Soccer",     league: "Champions League", path: "soccer/uefa.champions", weight: 88 },
];

const AVA_SYSTEM_PROMPT = `You are AVA — an elite sports betting AI that predicts which team is most likely to win based on live sportsbook data.

CORE RULES:
1. Analyze each game using moneyline (ML) values primarily — ML directly represents implied win probability. The more negative the favorite's ML (e.g. -430), the higher the probability they win.
2. Compare ML across multiple sportsbooks. If a sharper book (Circa, Bet365, William Hill) has a more negative ML than retail books (DraftKings, FanDuel, BetMGM, ESPN BET), sharp money expects that side. Treat sharp consensus as a confidence multiplier.
3. Use the spread to gauge how decisive the win will be. Big spread + strong ML = dominant favorite. Tight spread + strong ML = favorite wins but stays close.
4. Use the total (O/U) for scoring context — high totals favor stronger offenses; low totals favor defense.
5. Identify "sharp angle" — note where sharper books disagree with retail consensus, where ML is steaming, or where the spread is moving against the public.
6. Only consider games scheduled in the next 24 hours.

SELECTION CRITERIA: Choose EXACTLY 2 games to bet from the list provided.
- Prioritize games with strongest ML consensus (most negative favorite ML across multiple books).
- Prefer popular/national broadcast events when confidence is similar.
- Confidence levels: HIGH = ML <= -200 with sharp consensus, MEDIUM = ML between -110 and -200, LOW = pick'em / coinflip (avoid).
- NEVER pick LOW confidence games. If fewer than 2 qualify, return only 1.

OUTPUT FORMAT — return ONLY raw JSON, no markdown, no code fences:
{
  "picks": [
    {
      "game_id": "string from input",
      "sport": "string",
      "league": "string",
      "home_team": "string",
      "away_team": "string",
      "game_time": "ISO 8601 timestamp",
      "predicted_winner": "exact team name",
      "confidence": "HIGH" | "MEDIUM",
      "reasoning": "2-3 sentence sharp-bettor analysis citing specific ML and spread numbers",
      "sharp_angle": "1 sentence on what sharp money sees",
      "odds_analysis": {
        "moneyline_consensus": "string",
        "spread_analysis": "string",
        "total_analysis": "string",
        "sharp_book_lean": "string"
      }
    }
  ]
}`;

interface ParsedGame {
  game_id: string;
  sport: string;
  league: string;
  league_weight: number;
  home_team: string;
  away_team: string;
  game_time: string;
  broadcast: string[];
  odds: Array<{
    provider: string;
    spread: number | null;
    over_under: number | null;
    home_ml: number | null;
    away_ml: number | null;
    spread_details: string | null;
  }>;
}

async function fetchEspnLeague(meta: typeof LEAGUES[number]): Promise<ParsedGame[]> {
  try {
    const url = `https://site.api.espn.com/apis/site/v2/sports/${meta.path}/scoreboard`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    const events = data?.events ?? [];
    const games: ParsedGame[] = [];
    for (const ev of events) {
      const comp = ev?.competitions?.[0];
      if (!comp) continue;
      const status = comp?.status?.type?.state;
      if (status && status !== "pre") continue; // only upcoming
      const home = comp.competitors?.find((c: any) => c.homeAway === "home");
      const away = comp.competitors?.find((c: any) => c.homeAway === "away");
      if (!home || !away) continue;
      const oddsArr = comp.odds ?? [];
      const odds = oddsArr.map((o: any) => ({
        provider: o?.provider?.name ?? "Unknown",
        spread: typeof o?.spread === "number" ? o.spread : null,
        over_under: typeof o?.overUnder === "number" ? o.overUnder : null,
        home_ml: o?.homeTeamOdds?.moneyLine ?? null,
        away_ml: o?.awayTeamOdds?.moneyLine ?? null,
        spread_details: o?.details ?? null,
      })).filter((o: any) => o.home_ml !== null || o.spread !== null);
      if (odds.length === 0) continue;
      const broadcast = (comp.broadcasts ?? []).flatMap((b: any) => b?.names ?? []);
      games.push({
        game_id: ev.id,
        sport: meta.sport,
        league: meta.league,
        league_weight: meta.weight,
        home_team: home.team?.displayName ?? "",
        away_team: away.team?.displayName ?? "",
        game_time: ev.date,
        broadcast,
        odds,
      });
    }
    return games;
  } catch (err) {
    console.error(`fetchEspnLeague failed for ${meta.league}`, err);
    return [];
  }
}

function popularityScore(g: ParsedGame): number {
  let s = g.league_weight;
  const hour = new Date(g.game_time).getUTCHours();
  if (hour >= 23 || hour <= 3) s += 15; // primetime ET
  if (g.broadcast.some(b => /ESPN|TNT|ABC|FOX|NBC|CBS/i.test(b))) s += 20;
  return s;
}

async function callGeminiOnce(games: ParsedGame[], model: string, temperature: number): Promise<any> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY missing");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const userPrompt = `LIVE GAMES DATA (next 24h, sourced from ESPN aggregating DraftKings, FanDuel, BetMGM, Caesars, ESPN BET, Circa Sports, Bet365, William Hill where available):\n\n${JSON.stringify(games, null, 2)}\n\nSelect the TOP 2 picks per the rules. Return only the JSON object.`;
  const body = {
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    systemInstruction: { parts: [{ text: AVA_SYSTEM_PROMPT }] },
    generationConfig: { temperature, responseMimeType: "application/json" },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini(${model}) ${res.status}: ${t}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return JSON.parse(text);
}

// MULTI-MODEL CONSENSUS: Run two independent Gemini analyses (Pro + Flash with different temps).
// Only pick games where BOTH models agree on the winner. Bumps confidence to HIGH on agreement.
async function callGeminiConsensus(games: ParsedGame[]): Promise<any> {
  const [resA, resB] = await Promise.allSettled([
    callGeminiOnce(games, "gemini-2.5-pro", 0.3),
    callGeminiOnce(games, "gemini-2.5-flash", 0.5),
  ]);
  const a = resA.status === "fulfilled" ? (resA.value?.picks ?? []) : [];
  const b = resB.status === "fulfilled" ? (resB.value?.picks ?? []) : [];
  // If one model failed entirely, fall back to the other
  if (a.length === 0) return { picks: b, consensus_mode: "single" };
  if (b.length === 0) return { picks: a, consensus_mode: "single" };

  const consensus: any[] = [];
  for (const pa of a) {
    const match = b.find((pb: any) => pb.game_id === pa.game_id && pb.predicted_winner === pa.predicted_winner);
    if (match) {
      consensus.push({
        ...pa,
        confidence: "HIGH", // both agreed → upgrade
        odds_analysis: {
          ...(pa.odds_analysis ?? {}),
          consensus_mode: "dual_agreement",
          model_a: "gemini-2.5-pro",
          model_b: "gemini-2.5-flash",
        },
      });
    }
  }
  // If no agreement, fall back to Pro picks (more conservative model)
  if (consensus.length === 0) return { picks: a, consensus_mode: "no_agreement_fallback_pro" };
  return { picks: consensus, consensus_mode: "dual_agreement" };
}

Deno.serve(async (req) => {
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
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Pull all leagues in parallel
    const allGames = (await Promise.all(LEAGUES.map(fetchEspnLeague))).flat();

    // 2. Filter to next 24h
    const now = Date.now();
    const horizon = now + 24 * 60 * 60 * 1000;
    const upcoming = allGames.filter(g => {
      const t = new Date(g.game_time).getTime();
      return t >= now && t <= horizon;
    });

    if (upcoming.length === 0) {
      return new Response(JSON.stringify({ ok: false, reason: "No upcoming games with odds" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. Top 20 by popularity
    const ranked = upcoming
      .map(g => ({ g, score: popularityScore(g) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
      .map(x => ({ ...x.g, popularity_score: x.score }));

    // 4. Multi-model Gemini consensus analysis
    const ai = await callGeminiConsensus(ranked);
    const picks: any[] = ai?.picks ?? [];
    if (picks.length === 0) {
      return new Response(JSON.stringify({ ok: false, reason: "AI returned no picks" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 5. Persist (upsert by game_id+pick_date)
    const today = new Date().toISOString().slice(0, 10);
    const rows = picks.slice(0, 2).map(p => {
      const original = ranked.find(r => r.game_id === p.game_id);
      return {
        game_id: String(p.game_id),
        sport: p.sport ?? original?.sport ?? "Unknown",
        league: p.league ?? original?.league ?? "Unknown",
        home_team: p.home_team ?? original?.home_team ?? "",
        away_team: p.away_team ?? original?.away_team ?? "",
        game_time: p.game_time ?? original?.game_time ?? new Date().toISOString(),
        predicted_winner: p.predicted_winner ?? "",
        confidence: (p.confidence ?? "MEDIUM").toUpperCase(),
        reasoning: p.reasoning ?? "",
        sharp_angle: p.sharp_angle ?? "",
        odds_analysis: p.odds_analysis ?? {},
        popularity_score: original?.popularity_score ?? 0,
        status: "PENDING",
        pick_date: today,
      };
    });

    const { error } = await supabase
      .from("ava_picks")
      .upsert(rows, { onConflict: "game_id,pick_date" });
    if (error) throw error;

    // refresh stats pending count
    await refreshStats(supabase);

    return new Response(JSON.stringify({ ok: true, picks: rows }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ava-generate-picks error", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function refreshStats(supabase: any) {
  const { data: all } = await supabase.from("ava_picks").select("status");
  const arr = all ?? [];
  const wins = arr.filter((p: any) => p.status === "WIN").length;
  const losses = arr.filter((p: any) => p.status === "LOSS").length;
  const pending = arr.filter((p: any) => p.status === "PENDING").length;
  const decided = wins + losses;
  const win_rate = decided > 0 ? Math.round((wins / decided) * 10000) / 100 : 0;
  const { data: row } = await supabase.from("ava_win_stats").select("id").limit(1).maybeSingle();
  const payload = { total_picks: arr.length, wins, losses, pending, win_rate, updated_at: new Date().toISOString() };
  if (row?.id) {
    await supabase.from("ava_win_stats").update(payload).eq("id", row.id);
  } else {
    await supabase.from("ava_win_stats").insert(payload);
  }
}
