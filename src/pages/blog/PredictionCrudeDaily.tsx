import PredictionAssetDaily from "@/components/blog/PredictionAssetDaily";

const PredictionCrudeDaily = () => (
  <PredictionAssetDaily
    cfg={{
      key: "CRUDE",
      eyebrow: "AXRLEN · WTI CRUDE DAILY",
      title: "AXRLEN Crude Oil Daily — Live Long/Short Forecast",
      shortName: "WTI Crude",
      venue: "NYMEX CL Futures (front month)",
      unitPrefix: "$",
      unitSuffix: " /bbl",
      decimals: 2,
      dek: "Every day at 07:00 EST the AXRLEN engine reads live WTI Crude price action and publishes a 24-hour directional call with entry, stop loss, and take profit. Wins and losses are tallied automatically.",
      description: "Crude snapshots come from Yahoo Finance (CL=F front-month NYMEX). AXRLEN weighs OPEC+ supply posture, inventory prints, geopolitical risk premia, USD strength, and term-structure (contango/backwardation) before issuing the call.",
    }}
  />
);
export default PredictionCrudeDaily;
