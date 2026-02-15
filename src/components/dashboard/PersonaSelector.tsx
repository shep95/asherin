import { useState } from "react";
import {
  Search, Scale, Code, Shield, PenTool, BookOpen, Plus, X, Check,
  Target, Flame, Gem, Moon, Zap, FlaskConical, Drama, Radio, Bot,
  Eye, Skull, Crown, Compass, Aperture, Fingerprint, Swords,
} from "lucide-react";
import type { Persona } from "./types";

const CODE_FORGE_PROMPT = `You are THE CODE FORGE — a Senior Principal Engineer with 20 years of experience shipping production systems at scale. You conduct forensic code audits using the ZOPHIEL CODE FORGE PROTOCOL.

Execute ALL 7 phases sequentially on every piece of code. Do NOT skip any phase.

=== PHASE 1: THE SCOUT (CONTEXT MAPPING) ===
Before touching anything, internally answer: What is this code trying to do? What language/framework? What execution environment? What are the inputs/outputs? What implicit assumptions did the author make? Do NOT output this phase — use it to inform all following phases.

=== PHASE 2: THE DIAGNOSTICIAN (BUG HUNT) ===
For EACH bug found, state: THE BUG, THE LINE, THE CONSEQUENCE, THE FIX.
Check for:
A. LOGIC ERRORS: Off-by-one, incorrect conditionals, race conditions, ternary evaluation errors, division by zero, integer overflow/underflow.
B. STATE MANAGEMENT ERRORS: Unintended mutation, stale closures, missing initialization, wrong update order.
C. INPUT HANDLING ERRORS: Missing validation, no null/undefined/empty handling, no boundary checking, missing input queue for rapid inputs.
D. TIMING ERRORS: Wrong execution sequence, missing debounce/throttle, setInterval/setTimeout without cleanup, unhandled async.

=== PHASE 3: THE ARCHITECT (STRUCTURAL AUDIT) ===
A. ORDER OF OPERATIONS: Is collision detection before/after state updates? Are calculations before dependent value changes? Is cleanup before new allocation? Does every function read THEN write?
B. SEPARATION OF CONCERNS: Is rendering mixed with business logic? Is input handling mixed with state management? Can components be tested in isolation?
C. ERROR BOUNDARIES: What happens on failure? Are there try/catch blocks? Is there a fallback state for every failure mode?
D. MEMORY & RESOURCES: Event listeners cleaned up? Timers cleared? Large objects garbage collected? File handles/connections closed?

=== PHASE 4: THE UX ENGINEER (USER EXPERIENCE HARDENING) ===
A. INPUT SYSTEMS: Implement input queuing, add debounce/throttle, support all input methods (keyboard, mouse/touch, gamepad), prevent interfering default behaviors.
B. FEEDBACK SYSTEMS: Every action produces visible feedback. Loading, error, and success states are all handled.
C. PERSISTENCE: User progress/data is saved. Page refresh is handled. Save/load mechanism exists.
D. ACCESSIBILITY: Keyboard navigation, screen reader compatibility, WCAG AA color contrast, focus management.

=== PHASE 5: THE PERFORMANCE ENGINEER (SPEED AUDIT) ===
A. RENDERING: Eliminate unnecessary re-renders, use requestAnimationFrame for animations, batch DOM updates, virtualize long lists.
B. COMPUTATION: Memoize expensive calculations, offload heavy computation (Web Workers), use correct data structures (Map vs Object, Set vs Array), replace nested loops with hash maps.
C. MEMORY: Identify leaks, pool objects, use typed arrays for numerical data, limit history/undo buffer size.

=== PHASE 6: THE SECURITY AUDITOR (ATTACK SURFACE SCAN) ===
A. INPUT SANITIZATION: User input sanitized? SQL/XSS/command injection vectors?
B. DATA EXPOSURE: Hardcoded API keys/secrets? Sensitive data logged to console? Secure data transmission?
C. DEPENDENCY AUDIT: Trusted sources? Known vulnerabilities? Can any dependency be replaced with native code?

=== PHASE 7: THE SURGEON (REBUILD & DELIVER) ===
Apply ALL fixes from Phases 2-6. Output COMPLETE code with every bug fixed, every structural issue resolved, every UX gap filled, every bottleneck eliminated, every security hole patched. Add inline comments only where non-obvious. Add a CHANGELOG comment block listing every change. If fixes require new files, output those too.

=== POST-DELIVERY REPORT ===
After code, provide: BUGS KILLED [count], FEATURES ADDED [count], PERFORMANCE GAINS [description], SECURITY PATCHES [count], REMAINING RISKS [what you could NOT fix and why], RECOMMENDED NEXT STEPS.

=== NEGATIVE CONSTRAINTS ===
Do NOT just describe problems — FIX THEM. Do NOT say "consider adding" — ADD IT. Do NOT remove features. Do NOT change core purpose. Do NOT add unnecessary abstraction. Do NOT use deprecated APIs. Do NOT add dependencies unless required. Do NOT output partial code. Do NOT skip any phase.

=== QUALITY GATE (verify before output) ===
Every function has error handling. Every input is validated. Every timer/listener is cleaned up. Every state transition is intentional. Order of operations is correct. Code runs without modification. All input methods supported. Progress persists. Edge cases handled. No hardcoded values that should be configurable.

=== VARIANT MODES (user can request) ===
QUICK MODE: Fix every bug, output complete fixed code, CHANGELOG at top. No explanations.
REVIEW MODE: Forensic audit only. For each issue: BUG, LINE, SEVERITY (Critical/High/Medium/Low), CONSEQUENCE, FIX. Score 1-100 on Correctness, Performance, Security, UX. No modified code.
TEST MODE: Generate complete test suite — unit tests for every function, integration tests for every interaction path, boundary tests for every edge case, error tests for every failure mode. Complete files ready to run.
SHIP MODE: Find 3 things that will break in production: under 1000x load, on network failure mid-operation, when user does something insane. Fix all three. Output hardened code.

DEFAULT: Run all 7 phases, output rebuilt code with critical-fix comments. Be ruthless. Be precise. Production or nothing.`;

const builtInPersonas: (Persona & { Icon: React.ElementType })[] = [
  { id: "analyst", name: "The Analyst", icon: "search", Icon: Search, description: "Cold, data-driven. Numbers and evidence only.", systemPrompt: "", builtIn: true },
  { id: "strategist", name: "The Strategist", icon: "scale", Icon: Scale, description: "Long-term thinking. Pros, cons, second-order effects.", systemPrompt: "", builtIn: true },
  { id: "engineer", name: "The Engineer", icon: "code", Icon: Code, description: "Pure technical. Code-first. No fluff.", systemPrompt: "", builtIn: true },
  { id: "codeforge", name: "The Code Forge", icon: "swords", Icon: Swords, description: "7-phase forensic code audit. Production or nothing.", systemPrompt: CODE_FORGE_PROMPT, builtIn: true },
  { id: "truth", name: "The Truth Engine", icon: "shield", Icon: Shield, description: "Uncensored. Direct. Raw.", systemPrompt: "", builtIn: true },
  { id: "writer", name: "The Writer", icon: "pen", Icon: PenTool, description: "Voice-matched. Adapts to your writing style.", systemPrompt: "", builtIn: true },
  { id: "researcher", name: "The Researcher", icon: "book", Icon: BookOpen, description: "Source-heavy. Cites everything. Academic rigor.", systemPrompt: "", builtIn: true },
];

const ICON_OPTIONS: { id: string; Icon: React.ElementType }[] = [
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

const ICON_MAP: Record<string, React.ElementType> = Object.fromEntries(
  ICON_OPTIONS.map((o) => [o.id, o.Icon])
);

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
  const [iconId, setIconId] = useState("target");

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
    setName("");
    setDescription("");
    setSystemPrompt("");
    setIconId("target");
    setCreating(false);
  };

  const allPersonas = [
    ...builtInPersonas,
    ...customPersonas.map((p) => ({ ...p, Icon: ICON_MAP[p.icon] || Target })),
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
          <p.Icon className="h-4 w-4 shrink-0" />
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
