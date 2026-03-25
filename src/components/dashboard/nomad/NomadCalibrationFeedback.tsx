import { useState } from "react";
import { Check, ChevronDown, ChevronUp, X, AlertTriangle, Target } from "lucide-react";

type FeedbackType = "accurate" | "partially" | "inaccurate" | "missing_context" | "excellent";

interface NomadCalibrationFeedbackProps {
  messageId: string;
  onFeedback: (messageId: string, feedback: FeedbackType) => void;
}

const options: { id: FeedbackType; icon: React.ElementType; label: string; color: string }[] = [
  { id: "excellent", icon: Target, label: "Excellent", color: "text-emerald-500 hover:bg-emerald-500/10" },
  { id: "accurate", icon: Check, label: "Accurate", color: "text-blue-400 hover:bg-blue-400/10" },
  { id: "partially", icon: ChevronUp, label: "Partial", color: "text-amber-500 hover:bg-amber-500/10" },
  { id: "missing_context", icon: ChevronDown, label: "Missing context", color: "text-orange-500 hover:bg-orange-500/10" },
  { id: "inaccurate", icon: X, label: "Inaccurate", color: "text-destructive hover:bg-destructive/10" },
];

const NomadCalibrationFeedback = ({ messageId, onFeedback }: NomadCalibrationFeedbackProps) => {
  const [submitted, setSubmitted] = useState<FeedbackType | null>(null);

  if (submitted) {
    const chosen = options.find(o => o.id === submitted);
    return (
      <span className="text-[9px] font-extralight text-muted-foreground/40 flex items-center gap-1">
        {chosen && <chosen.icon className="h-2.5 w-2.5" />}
        Calibrated
      </span>
    );
  }

  return (
    <div className="flex items-center gap-0.5">
      {options.map(opt => (
        <button
          key={opt.id}
          onClick={() => { setSubmitted(opt.id); onFeedback(messageId, opt.id); }}
          title={opt.label}
          className={`rounded-md p-1 transition-colors ${opt.color}`}
        >
          <opt.icon className="h-2.5 w-2.5" />
        </button>
      ))}
    </div>
  );
};

export default NomadCalibrationFeedback;
