// AVA Validate Results - re-fetches ESPN scoreboards and grades pending picks.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { getCorsHeaders } from "../_shared/cors.ts";
// CORS handled per-request via getCorsHeaders(req) — see supabase/functions/_shared/cors.ts

const LEAGUE_PATHS: Record<string, string> = {
  "NFL": "football/nfl",
  "NBA": "basketball/nba",
  "NCAA Football": "football/college-football",
  "NCAA Basketball": "basketball/mens-college-basketball",
  "NHL": "hockey/nhl",
  "MLB": "baseball/mlb",
  "Premier League": "soccer/eng.1",
  "Champions League": "soccer/uefa.champions",
};

async function fetchEvent(league: string, gameId: string): Promise<any | null> {
  const path = LEAGUE_PATHS[league];
  if (!path) return null;
  // Try summary endpoint first (specific game)
  try {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${gameId}`);
    if (r.ok) return await r.json();
  } catch { /* ignore */ }
  return null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: pending } = await supabase
      .from("ava_picks")
      .select("*")
      .eq("status", "PENDING");

    const updates: any[] = [];

    for (const pick of pending ?? []) {
      const summary = await fetchEvent(pick.league, pick.game_id);
      const comp = summary?.header?.competitions?.[0] ?? summary?.competitions?.[0];
      if (!comp) continue;
      const completed = comp?.status?.type?.completed;
      if (!completed) continue;
      const home = comp.competitors?.find((c: any) => c.homeAway === "home");
      const away = comp.competitors?.find((c: any) => c.homeAway === "away");
      if (!home || !away) continue;
      const homeScore = parseInt(home.score?.value ?? home.score ?? "0", 10);
      const awayScore = parseInt(away.score?.value ?? away.score ?? "0", 10);
      const winnerName = homeScore === awayScore
        ? "TIE"
        : homeScore > awayScore
          ? (home.team?.displayName ?? pick.home_team)
          : (away.team?.displayName ?? pick.away_team);
      const status = winnerName === "TIE" ? "PUSH" : (winnerName === pick.predicted_winner ? "WIN" : "LOSS");
      updates.push({
        id: pick.id,
        status,
        actual_winner: winnerName,
        final_score: `${pick.away_team} ${awayScore} - ${homeScore} ${pick.home_team}`,
        validated_at: new Date().toISOString(),
      });
    }

    for (const u of updates) {
      await supabase.from("ava_picks").update({
        status: u.status,
        actual_winner: u.actual_winner,
        final_score: u.final_score,
        validated_at: u.validated_at,
      }).eq("id", u.id);
    }

    // Recalc stats
    const { data: all } = await supabase.from("ava_picks").select("status");
    const arr = all ?? [];
    const wins = arr.filter((p: any) => p.status === "WIN").length;
    const losses = arr.filter((p: any) => p.status === "LOSS").length;
    const pendingCount = arr.filter((p: any) => p.status === "PENDING").length;
    const decided = wins + losses;
    const win_rate = decided > 0 ? Math.round((wins / decided) * 10000) / 100 : 0;
    const { data: row } = await supabase.from("ava_win_stats").select("id").limit(1).maybeSingle();
    const payload = { total_picks: arr.length, wins, losses, pending: pendingCount, win_rate, updated_at: new Date().toISOString() };
    if (row?.id) {
      await supabase.from("ava_win_stats").update(payload).eq("id", row.id);
    } else {
      await supabase.from("ava_win_stats").insert(payload);
    }

    return new Response(JSON.stringify({ ok: true, validated: updates.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ava-validate-results error", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
