import { X, Maximize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface NomadFocusModeProps {
  content: string;
  open: boolean;
  onClose: () => void;
}

const NomadFocusMode = ({ content, open, onClose }: NomadFocusModeProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col animate-fade-in">
      <div className="flex items-center justify-between px-8 py-4 border-b border-border/10">
        <div className="flex items-center gap-2 text-sm font-extralight tracking-wider text-foreground">
          <Maximize2 className="h-4 w-4 text-accent" />
          Focus Mode
        </div>
        <button onClick={onClose} className="rounded-xl p-2 text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-3xl mx-auto prose prose-invert prose-lg font-extralight [&_p]:leading-relaxed [&_p]:text-foreground/90 [&_h1]:font-light [&_h2]:font-light [&_h3]:font-light [&_strong]:text-foreground [&_a]:text-accent">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default NomadFocusMode;
