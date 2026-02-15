import { useState } from "react";
import { Search, Scale, Code, Shield, PenTool, BookOpen, Plus, X, Check } from "lucide-react";
import type { Persona } from "./types";

const builtInPersonas: (Persona & { Icon: React.ElementType })[] = [
  { id: "analyst", name: "The Analyst", icon: "🔍", Icon: Search, description: "Cold, data-driven. Numbers and evidence only.", systemPrompt: "", builtIn: true },
  { id: "strategist", name: "The Strategist", icon: "⚖️", Icon: Scale, description: "Long-term thinking. Pros, cons, second-order effects.", systemPrompt: "", builtIn: true },
  { id: "engineer", name: "The Engineer", icon: "💻", Icon: Code, description: "Pure technical. Code-first. No fluff.", systemPrompt: "", builtIn: true },
  { id: "truth", name: "The Truth Engine", icon: "🔓", Icon: Shield, description: "Uncensored. Direct. Raw.", systemPrompt: "", builtIn: true },
  { id: "writer", name: "The Writer", icon: "📝", Icon: PenTool, description: "Voice-matched. Adapts to your writing style.", systemPrompt: "", builtIn: true },
  { id: "researcher", name: "The Researcher", icon: "🧠", Icon: BookOpen, description: "Source-heavy. Cites everything. Academic rigor.", systemPrompt: "", builtIn: true },
];

const EMOJI_OPTIONS = ["🎯", "🔥", "💎", "🌙", "⚡", "🛡️", "🧪", "🎭", "📡", "🦾"];

interface PersonaSelectorProps {
  activeId: string | null;
  onSelect: (id: string | null) => void;
  customPersonas?: Persona[];
  onAddCustomPersona?: (persona: Persona) => void;
}

const PersonaSelector = ({ activeId, onSelect, customPersonas = [], onAddCustomPersona }: PersonaSelectorProps) => {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [icon, setIcon] = useState("🎯");

  const handleCreate = () => {
    if (!name.trim()) return;
    const newPersona: Persona = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      icon,
      description: description.trim() || "Custom persona",
      systemPrompt: systemPrompt.trim(),
      builtIn: false,
    };
    onAddCustomPersona?.(newPersona);
    setName("");
    setDescription("");
    setSystemPrompt("");
    setIcon("🎯");
    setCreating(false);
  };

  const allPersonas = [
    ...builtInPersonas,
    ...customPersonas.map((p) => ({ ...p, Icon: null as any })),
  ];

  return (
    <div className="space-y-1">
      <p className="px-3 text-[10px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase">Personas</p>
      {allPersonas.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(activeId === p.id ? null : p.id)}
          className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
            activeId === p.id
              ? "bg-foreground/10 text-foreground"
              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          }`}
        >
          {p.Icon ? (
            <p.Icon className="h-4 w-4 shrink-0" />
          ) : (
            <span className="text-sm shrink-0">{p.icon}</span>
          )}
          <div className="min-w-0">
            <p className="text-xs font-light truncate">{p.name}</p>
            <p className="text-[10px] text-muted-foreground/60 truncate">{p.description}</p>
          </div>
        </button>
      ))}

      {creating ? (
        <div className="mx-1 mt-1 rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-light text-muted-foreground uppercase tracking-wider">New Persona</span>
            <button onClick={() => setCreating(false)} className="p-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Emoji picker */}
          <div className="flex gap-1 flex-wrap">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                onClick={() => setIcon(e)}
                className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-colors ${
                  icon === e ? "bg-foreground/15 ring-1 ring-foreground/30" : "hover:bg-foreground/5"
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Persona name"
            className="w-full bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none border-b border-border/20 pb-1"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
            className="w-full bg-transparent text-[11px] font-extralight text-foreground placeholder:text-muted-foreground/40 outline-none border-b border-border/20 pb-1"
          />
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="System prompt (instructions for the AI)"
            rows={3}
            className="w-full bg-transparent text-[11px] font-extralight text-foreground placeholder:text-muted-foreground/40 outline-none border border-border/20 rounded-lg p-2 resize-none"
          />
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground/10 py-1.5 text-xs font-light text-foreground hover:bg-foreground/15 transition-colors disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" />
            Create
          </button>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span className="text-xs font-light">Create Persona</span>
        </button>
      )}
    </div>
  );
};

export default PersonaSelector;
