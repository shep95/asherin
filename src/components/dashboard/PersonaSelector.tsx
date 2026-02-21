import { useState } from "react";
import {
  Search, Scale, Code, Shield, PenTool, BookOpen, Plus, X, Check,
  Target, Flame, Gem, Moon, Zap, FlaskConical, Drama, Radio, Bot,
  Eye, Skull, Crown, Compass, Aperture, Fingerprint, Swords, Pencil, Trash2, MoreHorizontal,
} from "lucide-react";
import type { Persona } from "./types";

const CODE_FORGE_PROMPT = `You are THE CODE FORGE — a Senior Principal Engineer with 20 years of experience shipping production systems at scale. You conduct forensic code audits using the ZOPHIEL CODE FORGE PROTOCOL.

Execute ALL 7 phases sequentially on every piece of code. Do NOT skip any phase.

=== PHASE 1: THE SCOUT (CONTEXT MAPPING) ===
Before touching anything, internally answer: What is this code trying to do? What language/framework? What execution environment? What are the inputs/outputs? What implicit assumptions did the author make? Do NOT output this phase — use it to inform all following phases.

=== PHASE 2: THE DIAGNOSTICIAN (BUG HUNT) ===
For EACH bug found, state: THE BUG, THE LINE, THE CONSEQUENCE, THE FIX.

=== PHASE 3: THE ARCHITECT (STRUCTURAL AUDIT) ===
Order of operations, separation of concerns, error boundaries, memory & resources.

=== PHASE 4: THE UX ENGINEER (USER EXPERIENCE HARDENING) ===
Input systems, feedback systems, persistence, accessibility.

=== PHASE 5: THE PERFORMANCE ENGINEER (SPEED AUDIT) ===
Rendering, computation, memory.

=== PHASE 6: THE SECURITY AUDITOR (ATTACK SURFACE SCAN) ===
Input sanitization, data exposure, dependency audit.

=== PHASE 7: THE SURGEON (REBUILD & DELIVER) ===
Apply ALL fixes. Output COMPLETE code. CHANGELOG at top.

DEFAULT: Run all 7 phases, output rebuilt code with critical-fix comments. Be ruthless. Be precise. Production or nothing.`;

const UI_FORGE_PROMPT = `You are THE UI FORGE — a Senior Design Engineer who has shipped interfaces at Apple, Stripe, and Vercel. You think in systems, not screens. Every pixel is intentional. You execute the ZOPHIEL UI FORGE PROTOCOL with 9 phases: Intent Scan, Anti-Slop Audit, Motion Engineer, Responsive Architect, Feedback Systems, Accessibility Auditor, Performance Auditor, Polish Pass, Final Build. DEFAULT: Run all 9 phases, output rebuilt UI with design changelog. Every pixel intentional. Ship-grade or nothing.`;

export const builtInPersonas: (Persona & { Icon: React.ElementType })[] = [
  { id: "analyst", name: "The Analyst", icon: "search", Icon: Search, description: "Cold, data-driven. Numbers and evidence only.", systemPrompt: "", builtIn: true },
  { id: "strategist", name: "The Strategist", icon: "scale", Icon: Scale, description: "Long-term thinking. Pros, cons, second-order effects.", systemPrompt: "", builtIn: true },
  { id: "engineer", name: "The Engineer", icon: "code", Icon: Code, description: "Pure technical. Code-first. No fluff.", systemPrompt: "", builtIn: true },
  { id: "codeforge", name: "The Code Forge", icon: "swords", Icon: Swords, description: "7-phase forensic code audit. Production or nothing.", systemPrompt: CODE_FORGE_PROMPT, builtIn: true },
  { id: "uiforge", name: "The UI Forge", icon: "aperture", Icon: Aperture, description: "9-phase UI audit. Every pixel intentional.", systemPrompt: UI_FORGE_PROMPT, builtIn: true },
  { id: "truth", name: "The Truth Engine", icon: "shield", Icon: Shield, description: "Uncensored. Direct. Raw.", systemPrompt: "", builtIn: true },
  { id: "writer", name: "The Writer", icon: "pen", Icon: PenTool, description: "Voice-matched. Adapts to your writing style.", systemPrompt: "", builtIn: true },
  { id: "researcher", name: "The Researcher", icon: "book", Icon: BookOpen, description: "Source-heavy. Cites everything. Academic rigor.", systemPrompt: "", builtIn: true },
];

export const ICON_OPTIONS: { id: string; Icon: React.ElementType }[] = [
  { id: "target", Icon: Target },
  { id: "flame", Icon: Flame },
  { id: "gem", Icon: Gem },
  { id: "moon", Icon: Moon },
  { id: "zap", Icon: Zap },
  { id: "flask", Icon: FlaskConical },
  { id: "drama", Icon: Drama },
  { id: "radio", Icon: Radio },
  { id: "bot", Icon: Bot },
  { id: "eye", Icon: Eye },
  { id: "skull", Icon: Skull },
  { id: "crown", Icon: Crown },
  { id: "compass", Icon: Compass },
  { id: "aperture", Icon: Aperture },
  { id: "fingerprint", Icon: Fingerprint },
  { id: "swords", Icon: Swords },
];

export const ICON_MAP: Record<string, React.ElementType> = Object.fromEntries(
  ICON_OPTIONS.map((o) => [o.id, o.Icon])
);

interface PersonaSelectorProps {
  activeId: string | null;
  onSelect: (id: string | null) => void;
  customPersonas?: Persona[];
  onAddCustomPersona?: (persona: Persona) => void;
  onEditCustomPersona?: (persona: Persona) => void;
  onDeleteCustomPersona?: (id: string) => void;
}

const PersonaSelector = ({ activeId, onSelect, customPersonas = [], onAddCustomPersona, onEditCustomPersona, onDeleteCustomPersona }: PersonaSelectorProps) => {
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [iconId, setIconId] = useState("target");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!name.trim()) return;
    const newPersona: Persona = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      icon: iconId,
      description: description.trim() || "Custom persona",
      systemPrompt: systemPrompt.trim(),
      builtIn: false,
    };
    onAddCustomPersona?.(newPersona);
    resetForm();
  };

  const startEdit = (p: Persona) => {
    setEditingId(p.id);
    setName(p.name);
    setDescription(p.description);
    setSystemPrompt(p.systemPrompt);
    setIconId(p.icon);
    setMenuOpenId(null);
    setCreating(false);
  };

  const handleEdit = () => {
    if (!editingId || !name.trim()) return;
    onEditCustomPersona?.({
      id: editingId,
      name: name.trim(),
      icon: iconId,
      description: description.trim() || "Custom persona",
      systemPrompt: systemPrompt.trim(),
      builtIn: false,
    });
    resetForm();
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setSystemPrompt("");
    setIconId("target");
    setCreating(false);
    setEditingId(null);
  };

  const allPersonas = [
    ...builtInPersonas,
    ...customPersonas.map((p) => ({ ...p, Icon: ICON_MAP[p.icon] || Target })),
  ];

  const isEditing = editingId !== null;
  const showForm = creating || isEditing;

  return (
    <div className="space-y-1">
      <p className="px-3 text-[10px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase">Personas</p>
      {allPersonas.map((p) => (
        <div key={p.id} className="relative group">
          <button
            onClick={() => onSelect(activeId === p.id ? null : p.id)}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors ${
              activeId === p.id
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
            }`}
          >
            <p.Icon className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-light truncate">{p.name}</p>
              <p className="text-[10px] text-muted-foreground/60 truncate">{p.description}</p>
            </div>
          </button>

          {/* Edit/Delete menu for custom personas */}
          {!p.builtIn && (
            <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === p.id ? null : p.id); }}
                className="p-1 rounded-lg hover:bg-foreground/10 text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
              {menuOpenId === p.id && (
                <div className="absolute right-0 top-full mt-1 z-50 rounded-xl border border-border/30 bg-card/90 backdrop-blur-xl p-1 shadow-xl min-w-[120px]">
                  <button
                    onClick={() => startEdit(p)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-light text-foreground hover:bg-foreground/10 transition-colors"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    onClick={() => { onDeleteCustomPersona?.(p.id); setMenuOpenId(null); }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-light text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {showForm ? (
        <div className="mx-1 mt-1 rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-light text-muted-foreground uppercase tracking-wider">
              {isEditing ? "Edit Persona" : "New Persona"}
            </span>
            <button onClick={resetForm} className="p-0.5 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Icon picker */}
          <div className="flex gap-1 flex-wrap">
            {ICON_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setIconId(opt.id)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  iconId === opt.id ? "bg-foreground/15 ring-1 ring-foreground/30" : "hover:bg-foreground/5"
                }`}
              >
                <opt.Icon className="h-3.5 w-3.5 text-foreground" />
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
            placeholder="System prompt (the persona's brain — instructions for the AI)"
            rows={4}
            className="w-full bg-transparent text-[11px] font-extralight text-foreground placeholder:text-muted-foreground/40 outline-none border border-border/20 rounded-lg p-2 resize-none"
          />
          <button
            onClick={isEditing ? handleEdit : handleCreate}
            disabled={!name.trim()}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-foreground/10 py-1.5 text-xs font-light text-foreground hover:bg-foreground/15 transition-colors disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" />
            {isEditing ? "Save Changes" : "Create"}
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
