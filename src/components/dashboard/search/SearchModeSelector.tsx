import { Globe, Newspaper, GraduationCap, Code, BarChart3, FileText, Brain } from "lucide-react";
import type { SearchMode } from "./types";

const modes: { id: SearchMode; label: string; icon: React.ReactNode; accent?: boolean }[] = [
  { id: "web", label: "Web", icon: <Globe className="h-3.5 w-3.5" /> },
  { id: "deep", label: "Deep Search", icon: <Brain className="h-3.5 w-3.5" />, accent: true },
  { id: "news", label: "News", icon: <Newspaper className="h-3.5 w-3.5" /> },
  { id: "academic", label: "Academic", icon: <GraduationCap className="h-3.5 w-3.5" /> },
  { id: "code", label: "Code", icon: <Code className="h-3.5 w-3.5" /> },
  { id: "data", label: "Data", icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { id: "docs", label: "Docs", icon: <FileText className="h-3.5 w-3.5" /> },
];

interface SearchModeSelectorProps {
  active: SearchMode;
  onChange: (mode: SearchMode) => void;
}

const SearchModeSelector = ({ active, onChange }: SearchModeSelectorProps) => {
  return (
    <div className="overflow-x-auto scrollbar-none -mx-1 px-1">
      <div className="flex items-center gap-1 w-max">
        {modes.map((m) => (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-light whitespace-nowrap transition-all ${
              active === m.id
                ? m.accent ? "bg-accent/30 text-accent border border-accent/50 shadow-[0_0_8px_hsl(var(--accent)/0.2)]" : "bg-accent/20 text-accent border border-accent/30"
                : m.accent ? "text-accent/60 hover:text-accent hover:bg-accent/10 border border-accent/20" : "text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 border border-transparent"
            }`}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SearchModeSelector;
