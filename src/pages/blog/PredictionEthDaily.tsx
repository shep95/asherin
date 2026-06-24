import PredictionAssetDaily from "@/components/blog/PredictionAssetDaily";

const PredictionEthDaily = () => (
  <PredictionAssetDaily
    cfg={{
      key: "ETH",
      eyebrow: "AXRLEN · ETH DAILY",
      title: "AXRLEN ETH Daily — Live Long/Short Forecast",
      shortName: "ETH",
      venue: "Coinbase / Hyperliquid ETH-PERP",
      unitPrefix: "$",
      unitSuffix: "",
      decimals: 2,
      dek: "Every day at 07:00 EST the AXRLEN engine reads live Ethereum price action, momentum, and liquidity and publishes a 24-hour directional call with entry, stop loss, and take profit. Wins and losses are tallied automatically.",
      description: "ETH snapshots are pulled from CoinGecko (richer 24h metrics) with Coinbase/Kraken spot fallbacks. AXRLEN looks at ETH's correlation to BTC, gas dynamics, staking flows, and ETH/BTC ratio momentum before issuing the call.",
    }}
  />
);
export default PredictionEthDaily;
