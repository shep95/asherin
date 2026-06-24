import PredictionAssetDaily from "@/components/blog/PredictionAssetDaily";

const PredictionSpxDaily = () => (
  <PredictionAssetDaily
    cfg={{
      key: "SPX",
      eyebrow: "AXRLEN · S&P 500 DAILY",
      title: "AXRLEN S&P 500 Daily — Live Long/Short Forecast",
      shortName: "S&P 500",
      venue: "S&P 500 / CME ES Futures",
      unitPrefix: "",
      unitSuffix: " pts",
      decimals: 2,
      dek: "Every day at 07:00 EST the AXRLEN engine reads live S&P 500 (^GSPC) price action and publishes a 24-hour directional call with entry, stop loss, and take profit. Wins and losses are tallied automatically.",
      description: "S&P snapshots come from Yahoo Finance (^GSPC) with SPY ETF fallback. AXRLEN weighs breadth, VIX term structure, sector leadership, rates/USD path, and overnight ES futures bias before issuing the call.",
    }}
  />
);
export default PredictionSpxDaily;
