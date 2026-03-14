import { useState } from "react";
import { FileText, Bug, Search, Scale, X, Send } from "lucide-react";

interface StructuredInputFormsProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (formattedPrompt: string) => void;
}

type FormType = "prd" | "bug" | "research" | "legal";

const FORM_TYPES: { id: FormType; label: string; icon: React.ElementType }[] = [
  { id: "prd", label: "PRD", icon: FileText },
  { id: "bug", label: "Bug Report", icon: Bug },
  { id: "research", label: "Research", icon: Search },
  { id: "legal", label: "Legal Clause", icon: Scale },
];

interface FormField {
  key: string;
  label: string;
  placeholder: string;
  multiline?: boolean;
}

const FORM_FIELDS: Record<FormType, FormField[]> = {
  prd: [
    { key: "title", label: "Feature Name", placeholder: "e.g. Dark Mode Toggle" },
    { key: "problem", label: "Problem Statement", placeholder: "What user problem does this solve?", multiline: true },
    { key: "users", label: "Target Users", placeholder: "Who benefits from this?" },
    { key: "requirements", label: "Key Requirements", placeholder: "List the must-haves (one per line)", multiline: true },
    { key: "success", label: "Success Metrics", placeholder: "How do we know this worked?" },
    { key: "constraints", label: "Constraints", placeholder: "Budget, timeline, tech limitations" },
  ],
  bug: [
    { key: "title", label: "Bug Title", placeholder: "Brief description of the issue" },
    { key: "steps", label: "Steps to Reproduce", placeholder: "1. Go to…\n2. Click…\n3. Observe…", multiline: true },
    { key: "expected", label: "Expected Behavior", placeholder: "What should happen?" },
    { key: "actual", label: "Actual Behavior", placeholder: "What actually happens?", multiline: true },
    { key: "environment", label: "Environment", placeholder: "Browser, OS, device" },
    { key: "severity", label: "Severity", placeholder: "Critical / High / Medium / Low" },
  ],
  research: [
    { key: "question", label: "Research Question", placeholder: "What are you trying to find out?" },
    { key: "context", label: "Context", placeholder: "Background info and why this matters", multiline: true },
    { key: "scope", label: "Scope", placeholder: "What's in bounds? What's out?" },
    { key: "sources", label: "Preferred Sources", placeholder: "Academic, industry reports, primary data…" },
    { key: "format", label: "Output Format", placeholder: "Summary, comparison table, annotated list…" },
  ],
  legal: [
    { key: "type", label: "Clause Type", placeholder: "e.g. Indemnification, NDA, Limitation of Liability" },
    { key: "parties", label: "Parties", placeholder: "Who is involved?" },
    { key: "jurisdiction", label: "Jurisdiction", placeholder: "Which law governs?" },
    { key: "terms", label: "Key Terms", placeholder: "Specific conditions or requirements", multiline: true },
    { key: "tone", label: "Tone", placeholder: "Aggressive, balanced, user-friendly" },
  ],
};

const StructuredInputForms = ({ open, onClose, onSubmit }: StructuredInputFormsProps) => {
  const [activeForm, setActiveForm] = useState<FormType>("prd");
  const [values, setValues] = useState<Record<string, string>>({});

  const updateField = (key: string, val: string) => setValues(prev => ({ ...prev, [key]: val }));

  const handleSubmit = () => {
    const fields = FORM_FIELDS[activeForm];
    const formName = FORM_TYPES.find(f => f.id === activeForm)?.label || activeForm;
    const parts = [`Please help me create a ${formName}. Here are the structured inputs:\n`];
    fields.forEach(f => {
      const val = values[f.key]?.trim();
      if (val) parts.push(`**${f.label}:** ${val}`);
    });
    parts.push("\nPlease produce a polished, professional output based on these constraints.");
    onSubmit(parts.join("\n"));
    setValues({});
    onClose();
  };

  const filledCount = FORM_FIELDS[activeForm].filter(f => values[f.key]?.trim()).length;

  if (!open) return null;

  return (
    <div className="absolute bottom-full left-0 mb-2 w-96 max-h-[500px] rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden animate-scale-in flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20 shrink-0">
        <span className="text-[10px] font-light text-foreground uppercase tracking-wider">Structured Input</span>
        <button onClick={onClose} className="p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors">
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Form type selector */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border/10 shrink-0">
        {FORM_TYPES.map(f => (
          <button
            key={f.id}
            onClick={() => { setActiveForm(f.id); setValues({}); }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-light transition-colors ${
              activeForm === f.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground/50 hover:text-foreground"
            }`}
          >
            <f.icon className="h-3 w-3" />
            {f.label}
          </button>
        ))}
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto min-h-0 px-3 py-2 space-y-3">
        {FORM_FIELDS[activeForm].map(field => (
          <div key={field.key}>
            <label className="text-[10px] font-light text-muted-foreground/60 mb-1 block">{field.label}</label>
            {field.multiline ? (
              <textarea
                value={values[field.key] || ""}
                onChange={e => updateField(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                className="w-full bg-card/30 border border-border/20 rounded-lg px-2.5 py-1.5 text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none resize-none focus:border-accent/30 transition-colors"
              />
            ) : (
              <input
                value={values[field.key] || ""}
                onChange={e => updateField(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="w-full bg-card/30 border border-border/20 rounded-lg px-2.5 py-1.5 text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30 transition-colors"
              />
            )}
          </div>
        ))}
      </div>

      {/* Submit */}
      <div className="px-3 py-2.5 border-t border-border/20 flex items-center justify-between shrink-0">
        <span className="text-[9px] text-muted-foreground/40">{filledCount}/{FORM_FIELDS[activeForm].length} fields filled</span>
        <button
          onClick={handleSubmit}
          disabled={filledCount === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-light bg-accent/20 text-accent hover:bg-accent/30 disabled:opacity-30 transition-colors"
        >
          <Send className="h-3 w-3" />
          Generate
        </button>
      </div>
    </div>
  );
};

export default StructuredInputForms;
