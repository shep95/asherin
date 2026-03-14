import { ArrowDown, ArrowUp, List, AlertTriangle, BookOpen, Package } from "lucide-react";

interface AnswerControlsProps {
  onAction: (action: string) => void;
}

const controls = [
  { id: "shorter", label: "Shorter", icon: ArrowDown },
  { id: "longer", label: "Longer", icon: ArrowUp },
  { id: "examples", label: "+ Examples", icon: List },
  { id: "edge-cases", label: "+ Edge Cases", icon: AlertTriangle },
  { id: "sources", label: "+ Sources", icon: BookOpen },
  { id: "deliverable", label: "Make Deliverable", icon: Package },
];

const AnswerControls = ({ onAction }: AnswerControlsProps) => {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {controls.map(c => (
        <button
          key={c.id}
          onClick={() => onAction(c.id)}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-light text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 border border-transparent hover:border-border/20 transition-all"
        >
          <c.icon className="h-3 w-3" />
          {c.label}
        </button>
      ))}
    </div>
  );
};

export default AnswerControls;
