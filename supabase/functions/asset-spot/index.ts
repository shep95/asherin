// asset-spot — Server-side multi-source spot quote for ETH, WTI Crude,
// S&P 500, NASDAQ 100. Query: ?asset=ETH|CRUDE|SPX|NDX
// Returns { price, source, ts }. Used by the AXRLEN multi-asset blog pages
// to avoid CORS/geo issues hitting Yahoo / Coinbase from the browser.

import { getCorsHeaders } from "../_shared/cors.ts";

type Pick = (j: any) => number | null;
type Src = { name: string; url: string; pick: Pick; ua?: boolean };

const YAHOO = (sym: string): Src => ({
  name: "Yahoo Finance",
  url: `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=2d`,
  pick: (j) => Number(j?.chart?.result?.[0]?.meta?.regularMarketPrice) || null,
  ua: true,
});

const SOURCES: Record<string, Src[]> = {
  ETH: [
    { name: "Coinbase", url: "https://api.coinbase.com/v2/prices/ETH-USD/spot", pick: (j) => Number(j?.data?.amount) || null },
    { name: "Kraken", url: "https://api.kraken.com/0/public/Ticker?pair=ETHUSD", pick: (j) => Number(j?.result?.XETHZUSD?.c?.[0]) || null },
    { name: "Bitstamp", url: "https://www.bitstamp.net/api/v2/ticker/ethusd/", pick: (j) => Number(j?.last) || null },
    { name: "CoinGecko", url: "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd", pick: (j) => Number(j?.ethereum?.usd) || null },
  ],
  CRUDE: [YAHOO("CL=F"), YAHOO("BZ=F")],
  SPX:   [YAHOO("^GSPC"), YAHOO("SPY")],
  NDX:   [YAHOO("^NDX"), YAHOO("QQQ")],
};

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  const asset = (url.searchParams.get("asset") || "").toUpperCase();
  const list = SOURCES[asset];
  if (!list) {
    return new Response(JSON.stringify({ error: "unknown_asset" }), {
      status: 400, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  for (const s of list) {
    try {
      const r = await fetch(s.url, { headers: s.ua ? { "user-agent": "Mozilla/5.0 (aureon-asset-spot/1.0)" } : { "user-agent": "aureon-asset-spot/1.0" } });
      if (!r.ok) continue;
      const j = await r.json();
      const price = s.pick(j);
      if (price && price > 0) {
        return new Response(JSON.stringify({ asset, price, source: s.name, ts: Date.now() }), {
          headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }
    } catch { /* next */ }
  }
  return new Response(JSON.stringify({ error: "all_sources_failed", asset }), {
    status: 502, headers: { ...cors, "Content-Type": "application/json" },
  });
});
