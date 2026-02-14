import { CheckCircle, Brain, AlertTriangle } from "lucide-react";

interface DecodeViewProps {
  open: boolean;
}

const DecodeView = ({ open }: DecodeViewProps) => {
  if (!open) return null;

  return (
    <div className="mt-3 rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm p-3 space-y-3">
      <div className="flex items-start gap-2">
        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-[10px] font-medium tracking-wider text-emerald-500 uppercase">Verified Data</p>
          <p className="text-xs font-light text-muted-foreground mt-1">
            Content sourced from verified references and live web data.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <Brain className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-[10px] font-medium tracking-wider text-amber-500 uppercase">Analytical Inference</p>
          <p className="text-xs font-light text-muted-foreground mt-1">
            Logical conclusions drawn from available data patterns.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-orange-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-[10px] font-medium tracking-wider text-orange-500 uppercase">Low Confidence</p>
          <p className="text-xs font-light text-muted-foreground mt-1">
            Speculative or uncertain — verify independently.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DecodeView;
