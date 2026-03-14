import { FileText, Brain, Search, Clock, Wrench } from "lucide-react";

interface ThreadReceiptProps {
  memoriesUsed?: number;
  filesUsed?: string[];
  toolsUsed?: string[];
  timestamp?: Date;
  brainName?: string;
}

const ThreadReceipt = ({ memoriesUsed, filesUsed, toolsUsed, timestamp, brainName }: ThreadReceiptProps) => {
  const hasAnything = memoriesUsed || filesUsed?.length || toolsUsed?.length || brainName;
  if (!hasAnything) return null;

  return (
    <div className="flex items-center gap-3 flex-wrap mt-1.5 pt-1.5 border-t border-border/10">
      <span className="text-[8px] text-muted-foreground/25 uppercase tracking-widest">Used:</span>
      {memoriesUsed && memoriesUsed > 0 && (
        <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/30">
          <Brain className="h-2.5 w-2.5" /> {memoriesUsed} memories
        </span>
      )}
      {brainName && (
        <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/30">
          <Brain className="h-2.5 w-2.5" /> {brainName}
        </span>
      )}
      {filesUsed && filesUsed.length > 0 && (
        <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/30">
          <FileText className="h-2.5 w-2.5" /> {filesUsed.length} file{filesUsed.length > 1 ? "s" : ""}
        </span>
      )}
      {toolsUsed && toolsUsed.length > 0 && (
        <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/30">
          <Wrench className="h-2.5 w-2.5" /> {toolsUsed.join(", ")}
        </span>
      )}
      {timestamp && (
        <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground/20">
          <Clock className="h-2.5 w-2.5" /> {timestamp.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};

export default ThreadReceipt;
