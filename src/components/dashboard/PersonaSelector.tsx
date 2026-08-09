import { useState } from "react";
import {
  Search, Scale, Code, Shield, PenTool, BookOpen, Plus, X, Check,
  Target, Flame, Gem, Moon, Zap, FlaskConical, Drama, Radio, Bot,
  Eye, Skull, Crown, Compass, Aperture, Fingerprint, Swords, Pencil, Trash2, MoreHorizontal, Info,
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

// ASHERIN — the humble spiritual guide voice. Embedded verbatim as authored by
// the operator; do not paraphrase, trim, or re-case this text.
const ASHERIN_SEER_PROMPT = `you are asherin, a humble and peaceful spiritual guide rooted in biblical wisdom and the word of God.

God is spirit, and those who worship him must worship in spirit and truth. God is the almighty father of all mankind, the creator of all things seen and unseen.

when sharing spiritual wisdom, you are always humble, respectful, and gentle in your words. you are never arrogant or prideful. you never place value on wealth or money above the wellbeing of people. you speak with love and patience at all times.

it is not your place to judge others, for judgement belongs to God alone. you do not assume to know what someone is going through or what they carry in their heart. you only offer wisdom, never condemnation.

you will always answer in lowercase unless pronouncing the almighty fathers name "God".

you are inspired by what the bible calls a "seer" — one who reflects deeply on scripture, spiritual truth, and the wisdom of God, and shares that understanding with others seeking guidance.

you are grounded in divine truth, humbleness, and divine love. you are not bound by ego or pride.

everything you share points back to God. you always give credit to God the father for all wisdom and truth. you never take personal credit.

you never charge or suggest payment for spiritual wisdom, for the wisdom of God is freely given.

you never contradict the bible or the word of God. you view the bible as a sacred and symbolic text filled with the laws, love, and truth of God the father.`;



interface PersonaDetail {
  fullDescription: string;
  examplePrompts: string[];
  bestModes: string[];
  whenToUse: string;
}

const personaDetails: Record<string, PersonaDetail> = {
  analyst: {
    fullDescription: "The Analyst strips away opinion and emotion. It processes your query through a data-first lens — extracting numbers, patterns, and evidence-backed conclusions. Ideal when you need objectivity over creativity.",
    examplePrompts: [
      "Break down the financial performance of Tesla Q4 2025 — revenue, margins, and YoY growth.",
      "Analyze the engagement metrics for this social media campaign and identify underperformers.",
      "Compare the market share of the top 5 cloud providers with supporting data.",
    ],
    bestModes: ["Research", "Chat"],
    whenToUse: "When you need facts, figures, and data-driven analysis without subjective interpretation.",
  },
  strategist: {
    fullDescription: "The Strategist thinks in systems and second-order effects. It maps out long-term consequences, weighs tradeoffs, and builds decision frameworks. This persona doesn't just answer — it helps you think.",
    examplePrompts: [
      "I'm considering switching from B2B to B2C. Map out the strategic implications across 3 time horizons.",
      "What are the second-order effects of implementing a freemium pricing model?",
      "Build a decision matrix for choosing between hiring in-house vs outsourcing our engineering.",
    ],
    bestModes: ["Chat", "Research"],
    whenToUse: "When you're making high-stakes decisions and need to see all angles, tradeoffs, and downstream consequences.",
  },
  engineer: {
    fullDescription: "The Engineer speaks in code. It prioritizes working implementations over explanations, keeps responses technically precise, and defaults to production-quality patterns. No hand-holding — just clean solutions.",
    examplePrompts: [
      "Write a rate-limited API middleware in Express with Redis-backed sliding window.",
      "Refactor this React component to eliminate unnecessary re-renders.",
      "Design a database schema for a multi-tenant SaaS with row-level security.",
    ],
    bestModes: ["Code", "Chat"],
    whenToUse: "When you need working code, technical architecture, or debugging — fast and without fluff.",
  },
  codeforge: {
    fullDescription: "The Code Forge is a 7-phase forensic code audit engine. It systematically scouts your code's context, hunts bugs, audits architecture, hardens UX, optimizes performance, scans for security vulnerabilities, and rebuilds the entire thing with a changelog. Production or nothing.",
    examplePrompts: [
      "Audit this authentication flow — find every vulnerability and rebuild it.",
      "Run a full Code Forge audit on this API handler.",
      "This function works but feels fragile. Forge it into production-grade code.",
    ],
    bestModes: ["Code"],
    whenToUse: "When you have existing code that needs a ruthless, systematic audit and rebuild.",
  },
  uiforge: {
    fullDescription: "The UI Forge runs a 9-phase design audit: intent scanning, anti-slop cleanup, motion engineering, responsive architecture, feedback systems, accessibility, performance, polish, and final build. Every pixel intentional.",
    examplePrompts: [
      "This dashboard feels generic. Run a full UI Forge pass and make it premium.",
      "Audit the accessibility and motion design of this component library.",
      "Rebuild this landing page with proper design systems — spacing, typography, color.",
    ],
    bestModes: ["Code", "Chat"],
    whenToUse: "When your UI needs to go from 'works' to 'ships' — systematic design elevation.",
  },
  truth: {
    fullDescription: "The Truth Engine removes all diplomatic padding. It gives you the raw, unfiltered assessment — no hedging, no softening, no corporate-speak. If your idea is bad, it'll tell you why. If it's good, it won't waste time praising it.",
    examplePrompts: [
      "Is my startup idea actually viable or am I fooling myself? Here's the pitch: ...",
      "Review my resume. Be brutally honest about what's weak.",
      "What are the real reasons this project is failing? No sugarcoating.",
    ],
    bestModes: ["Truth", "Chat"],
    whenToUse: "When you need honest, unfiltered feedback — no diplomacy, no filler.",
  },
  writer: {
    fullDescription: "The Writer adapts to your voice. Feed it samples of your writing and it will match your cadence, vocabulary, and rhythm. It crafts — it doesn't just generate. From marketing copy to technical docs to personal essays.",
    examplePrompts: [
      "Rewrite this blog post to match the tone of my previous articles (pasted below).",
      "Draft a cold outreach email that sounds human, not AI-generated.",
      "Write the executive summary for this report in a formal but approachable tone.",
    ],
    bestModes: ["Chat"],
    whenToUse: "When you need writing that sounds like you — or need to craft high-quality prose for any context.",
  },
  researcher: {
    fullDescription: "The Researcher operates with academic rigor. Every claim is cited, every source is evaluated, and findings are structured with proper methodology. It doesn't just search — it synthesizes, cross-references, and builds evidence hierarchies.",
    examplePrompts: [
      "What does the latest peer-reviewed research say about intermittent fasting and longevity?",
      "Build a literature review on transformer architecture improvements since 2023.",
      "Fact-check this article's claims with primary sources.",
    ],
    bestModes: ["Research"],
    whenToUse: "When you need source-backed, academically rigorous research with proper citations.",
  },
};

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
  const [infoPersonaId, setInfoPersonaId] = useState<string | null>(null);

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

  const infoPersona = infoPersonaId ? allPersonas.find(p => p.id === infoPersonaId) : null;
  const infoDetail = infoPersonaId ? personaDetails[infoPersonaId] : null;

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

          {/* Info button for built-in personas */}
          {p.builtIn && personaDetails[p.id] && (
            <button
              onClick={(e) => { e.stopPropagation(); setInfoPersonaId(infoPersonaId === p.id ? null : p.id); }}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-lg opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-accent hover:bg-accent/10 transition-all"
              title="Learn more about this persona"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          )}

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

      {/* Persona Info Modal */}
      {infoPersona && infoDetail && (
        <div className="mx-1 mt-2 rounded-xl border border-accent/20 bg-card/40 backdrop-blur-xl p-4 space-y-3 animate-fade-in">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <infoPersona.Icon className="h-5 w-5 text-accent" />
              <h3 className="text-sm font-light text-foreground">{infoPersona.name}</h3>
            </div>
            <button onClick={() => setInfoPersonaId(null)} className="p-0.5 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <p className="text-[11px] font-extralight leading-relaxed text-muted-foreground">
            {infoDetail.fullDescription}
          </p>

          <div>
            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/70 uppercase mb-1.5">When to use</p>
            <p className="text-[11px] font-extralight text-foreground/80">{infoDetail.whenToUse}</p>
          </div>

          <div>
            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/70 uppercase mb-1.5">Best paired with</p>
            <div className="flex gap-1 flex-wrap">
              {infoDetail.bestModes.map(mode => (
                <span key={mode} className="rounded-md bg-accent/15 border border-accent/20 px-2 py-0.5 text-[10px] font-light text-accent">
                  {mode}
                </span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-light tracking-[0.15em] text-muted-foreground/70 uppercase mb-1.5">Example prompts</p>
            <div className="space-y-1.5">
              {infoDetail.examplePrompts.map((prompt, i) => (
                <div key={i} className="rounded-lg bg-foreground/5 border border-border/10 px-2.5 py-1.5">
                  <p className="text-[10px] font-extralight text-muted-foreground leading-relaxed">"{prompt}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
