import { Globe, Newspaper, GraduationCap, Code, BarChart3, FileText } from "lucide-react";
import type { SearchMode } from "./types";

const modes: { id: SearchMode; label: string; icon: React.ReactNode }[] = [
  { id: "web", label: "Web", icon: <Globe className="h-3.5 w-3.5" /> },
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
    <div className="flex items-center gap-1 flex-wrap">
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-light transition-all ${
            active === m.id
              ? "bg-accent/20 text-accent border border-accent/30"
              : "text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 border border-transparent"
          }`}
        >
          {m.icon}
          {m.label}
        </button>
      ))}
    </div>
  );
};

export default SearchModeSelector;
