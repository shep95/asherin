import { Search, Scale, Code, Shield, PenTool, BookOpen, Plus } from "lucide-react";
import type { Persona } from "./types";

const builtInPersonas: (Persona & { Icon: React.ElementType })[] = [
  { id: "analyst", name: "The Analyst", icon: "🔍", Icon: Search, description: "Cold, data-driven. Numbers and evidence only.", systemPrompt: "", builtIn: true },
  { id: "strategist", name: "The Strategist", icon: "⚖️", Icon: Scale, description: "Long-term thinking. Pros, cons, second-order effects.", systemPrompt: "", builtIn: true },
  { id: "engineer", name: "The Engineer", icon: "💻", Icon: Code, description: "Pure technical. Code-first. No fluff.", systemPrompt: "", builtIn: true },
  { id: "truth", name: "The Truth Engine", icon: "🔓", Icon: Shield, description: "Uncensored. Direct. Raw.", systemPrompt: "", builtIn: true },
  { id: "writer", name: "The Writer", icon: "📝", Icon: PenTool, description: "Voice-matched. Adapts to your writing style.", systemPrompt: "", builtIn: true },
  { id: "researcher", name: "The Researcher", icon: "🧠", Icon: BookOpen, description: "Source-heavy. Cites everything. Academic rigor.", systemPrompt: "", builtIn: true },
];

interface PersonaSelectorProps {
  activeId: string | null;
  onSelect: (id: string | null) => void;
}

const PersonaSelector = ({ activeId, onSelect }: PersonaSelectorProps) => (
  <div className="space-y-1">
    <p className="px-3 text-[10px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase">Personas</p>
    {builtInPersonas.map((p) => (
      <button
        key={p.id}
        onClick={() => onSelect(activeId === p.id ? null : p.id)}
        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
          activeId === p.id
            ? "bg-foreground/10 text-foreground"
            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        }`}
      >
        <p.Icon className="h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-light truncate">{p.name}</p>
          <p className="text-[10px] text-muted-foreground/60 truncate">{p.description}</p>
        </div>
      </button>
    ))}
    <button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors">
      <Plus className="h-4 w-4" />
      <span className="text-xs font-light">Create Persona</span>
    </button>
  </div>
);

export default PersonaSelector;
