import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const PredictiveIntelligenceView = lazy(() => import("../PredictiveIntelligenceView"));

const NomadPredictiveIntel = () => (
  <div className="h-full flex flex-col">
    <div className="px-4 py-3 border-b border-border/15 bg-card/10">
      <h3 className="text-sm font-light tracking-wide text-foreground">Predictive Intelligence</h3>
      <p className="text-[10px] font-extralight text-muted-foreground mt-0.5">
        Forecast corporate events on investigation targets — M&A, regulatory actions, leadership shifts.
      </p>
    </div>
    <div className="flex-1 overflow-auto">
      <Suspense fallback={<div className="flex items-center justify-center h-64"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
        <PredictiveIntelligenceView />
      </Suspense>
    </div>
  </div>
);

export default NomadPredictiveIntel;
