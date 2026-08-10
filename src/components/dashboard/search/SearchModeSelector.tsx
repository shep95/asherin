import { useState } from "react";
import { Globe, Newspaper, GraduationCap, Code, BarChart3, FileText, Image as ImageIcon, Crosshair, ShieldAlert, Scan, FileArchive, ChevronDown, ShieldCheck, Database, Package, BookOpen, Ghost } from "lucide-react";
import type { SearchMode } from "./types";

type ModeDef = { id: SearchMode; label: string; icon: React.ReactNode; accent?: boolean };

// Primary modes — always visible. Everything else collapses behind "More".
const primaryModes: ModeDef[] = [
  { id: "web", label: "Web", icon: <Globe className="h-3.5 w-3.5" /> },
  { id: "ghostchain", label: "Ghost Chain", icon: <Ghost className="h-3.5 w-3.5" />, accent: true },
  { id: "shadow", label: "Shadow", icon: <Ghost className="h-3.5 w-3.5" />, accent: true },
  { id: "dataengine", label: "DataEngine", icon: <Database className="h-3.5 w-3.5" />, accent: true },
  { id: "imagine", label: "Imagine", icon: <ImageIcon className="h-3.5 w-3.5" />, accent: true },
  { id: "audit", label: "ZERLAL", icon: <ShieldAlert className="h-3.5 w-3.5" />, accent: true },
  { id: "vpn", label: "OpenVPN", icon: <ShieldCheck className="h-3.5 w-3.5" />, accent: true },
];


const secondaryModes: ModeDef[] = [
  { id: "extract", label: "Link Extract", icon: <Crosshair className="h-3.5 w-3.5" />, accent: true },
  { id: "harvest", label: "Doc Harvest", icon: <Package className="h-3.5 w-3.5" />, accent: true },
  { id: "leaks", label: "Asher Archives", icon: <FileArchive className="h-3.5 w-3.5" />, accent: true },
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

const renderBtn = (m: ModeDef, active: SearchMode, onChange: (mode: SearchMode) => void) => (
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
);

const SearchModeSelector = ({ active, onChange }: SearchModeSelectorProps) => {
  // Auto-expand if the active mode lives in the secondary set
  const activeIsSecondary = secondaryModes.some((m) => m.id === active);
  const [open, setOpen] = useState(activeIsSecondary);

  return (
    <div className="-mx-1 px-1">
      <div className="flex flex-wrap items-center gap-1">
        {primaryModes.map((m) => renderBtn(m, active, onChange))}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-light whitespace-nowrap transition-all border ${
            open
              ? "border-border/40 text-foreground/80 bg-card/40"
              : "border-transparent text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5"
          }`}
        >
          More
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="flex flex-wrap items-center gap-1 w-full mt-1 animate-fade-in">
            {secondaryModes.map((m) => renderBtn(m, active, onChange))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchModeSelector;
