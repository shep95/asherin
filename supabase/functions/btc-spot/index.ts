import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SOURCES = [
  { name: "Coinbase", url: "https://api.coinbase.com/v2/prices/BTC-USD/spot", pick: (j: any) => Number(j?.data?.amount) },
  { name: "Kraken", url: "https://api.kraken.com/0/public/Ticker?pair=XBTUSD", pick: (j: any) => Number(j?.result?.XXBTZUSD?.c?.[0]) },
  { name: "Bitstamp", url: "https://www.bitstamp.net/api/v2/ticker/btcusd/", pick: (j: any) => Number(j?.last) },
  { name: "CoinGecko", url: "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", pick: (j: any) => Number(j?.bitcoin?.usd) },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  for (const s of SOURCES) {
    try {
      const r = await fetch(s.url, { headers: { "user-agent": "aureon-btc-spot/1.0" } });
      if (!r.ok) continue;
      const j = await r.json();
      const price = s.pick(j);
      if (price && price > 0) {
        return new Response(JSON.stringify({ price, source: s.name, ts: Date.now() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }
    } catch { /* next */ }
  }
  return new Response(JSON.stringify({ error: "all_sources_failed" }), {
    status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
