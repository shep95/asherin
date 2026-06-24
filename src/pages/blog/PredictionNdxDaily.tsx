import PredictionAssetDaily from "@/components/blog/PredictionAssetDaily";

const PredictionNdxDaily = () => (
  <PredictionAssetDaily
    cfg={{
      key: "NDX",
      eyebrow: "AXRLEN · NASDAQ 100 DAILY",
      title: "AXRLEN NASDAQ 100 Daily — Live Long/Short Forecast",
      shortName: "NASDAQ 100",
      venue: "Nasdaq 100 / CME NQ Futures",
      unitPrefix: "",
      unitSuffix: " pts",
      decimals: 2,
      dek: "Every day at 07:00 EST the AXRLEN engine reads live NASDAQ 100 (^NDX) price action and publishes a 24-hour directional call with entry, stop loss, and take profit. Wins and losses are tallied automatically.",
      description: "NDX snapshots come from Yahoo Finance (^NDX) with QQQ ETF fallback. AXRLEN weighs mega-cap concentration, rates beta, semiconductor leadership, and NQ overnight bias before issuing the call.",
    }}
  />
);
export default PredictionNdxDaily;
