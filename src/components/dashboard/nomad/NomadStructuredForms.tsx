import { useState } from "react";
import { ClipboardList, User, Building2, Shield, ChevronDown, ChevronUp, Send } from "lucide-react";

interface NomadStructuredFormsProps {
  onSubmit: (query: string) => void;
}

interface FormField {
  id: string;
  label: string;
  placeholder: string;
  required?: boolean;
}

const FORMS = [
  {
    id: "kyc",
    label: "KYC / Know Your Customer",
    icon: User,
    fields: [
      { id: "name", label: "Full Name", placeholder: "John Doe", required: true },
      { id: "dob", label: "Date of Birth", placeholder: "1990-01-01" },
      { id: "nationality", label: "Nationality", placeholder: "US" },
      { id: "company", label: "Company / Organization", placeholder: "Acme Corp" },
      { id: "role", label: "Role / Title", placeholder: "CEO" },
      { id: "extra", label: "Additional Context", placeholder: "Any other details..." },
    ] as FormField[],
    buildQuery: (v: Record<string, string>) =>
      `KYC Investigation: Perform a comprehensive Know Your Customer analysis on ${v.name || "unknown"}${v.company ? ` (${v.role || "associated with"} ${v.company})` : ""}${v.nationality ? `, nationality: ${v.nationality}` : ""}${v.dob ? `, DOB: ${v.dob}` : ""}. Check sanctions lists, PEP databases, adverse media, corporate registries, and beneficial ownership. ${v.extra || ""}`,
  },
  {
    id: "due-diligence",
    label: "Corporate Due Diligence",
    icon: Building2,
    fields: [
      { id: "company", label: "Company Name", placeholder: "Acme Corp", required: true },
      { id: "jurisdiction", label: "Jurisdiction", placeholder: "Delaware, USA" },
      { id: "industry", label: "Industry", placeholder: "Technology" },
      { id: "principals", label: "Key Principals", placeholder: "Jane Smith, John Doe" },
      { id: "context", label: "Investigation Context", placeholder: "Pre-acquisition review" },
    ] as FormField[],
    buildQuery: (v: Record<string, string>) =>
      `Corporate Due Diligence on ${v.company || "unknown"}${v.jurisdiction ? ` (${v.jurisdiction})` : ""}${v.industry ? `, industry: ${v.industry}` : ""}. Investigate corporate filings, beneficial ownership, litigation history, regulatory actions, financial health, and media footprint.${v.principals ? ` Key principals: ${v.principals}.` : ""} Context: ${v.context || "General due diligence"}.`,
  },
  {
    id: "threat",
    label: "Threat Assessment",
    icon: Shield,
    fields: [
      { id: "target", label: "Target / Subject", placeholder: "Organization or individual", required: true },
      { id: "threat_type", label: "Threat Type", placeholder: "Cyber, Physical, Financial, Reputational" },
      { id: "region", label: "Region of Interest", placeholder: "North America" },
      { id: "timeframe", label: "Timeframe", placeholder: "Last 12 months" },
      { id: "indicators", label: "Known Indicators", placeholder: "Any IOCs, suspicious activity..." },
    ] as FormField[],
    buildQuery: (v: Record<string, string>) =>
      `Threat Assessment for ${v.target || "unknown"}. Threat type: ${v.threat_type || "Comprehensive"}. Region: ${v.region || "Global"}. Timeframe: ${v.timeframe || "Current"}. Analyze attack surface, known vulnerabilities, threat actor associations, and risk vectors.${v.indicators ? ` Known indicators: ${v.indicators}.` : ""} Provide structured risk matrix.`,
  },
];

const NomadStructuredForms = ({ onSubmit }: NomadStructuredFormsProps) => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});

  const handleSubmit = (formId: string) => {
    const form = FORMS.find(f => f.id === formId);
    if (!form) return;
    const v = values[formId] || {};
    const required = form.fields.filter(f => f.required);
    if (required.some(f => !v[f.id]?.trim())) return;
    onSubmit(form.buildQuery(v));
    setExpanded(null);
    setValues(prev => ({ ...prev, [formId]: {} }));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] font-extralight tracking-wider text-muted-foreground/50 uppercase">
        <ClipboardList className="h-3 w-3" />
        Structured Investigations
      </div>
      <div className="space-y-1.5">
        {FORMS.map(form => (
          <div key={form.id} className="rounded-xl border border-border/15 bg-card/15 overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === form.id ? null : form.id)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-extralight text-foreground/80 hover:text-foreground transition-colors"
            >
              <div className="flex items-center gap-2">
                <form.icon className="h-3.5 w-3.5 text-accent/60" />
                {form.label}
              </div>
              {expanded === form.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {expanded === form.id && (
              <div className="px-4 pb-3 space-y-2 animate-fade-in">
                {form.fields.map(field => (
                  <div key={field.id}>
                    <label className="text-[9px] font-extralight text-muted-foreground/60 uppercase tracking-wider">
                      {field.label} {field.required && <span className="text-destructive">*</span>}
                    </label>
                    <input
                      value={values[form.id]?.[field.id] || ""}
                      onChange={e => setValues(prev => ({
                        ...prev,
                        [form.id]: { ...prev[form.id], [field.id]: e.target.value },
                      }))}
                      placeholder={field.placeholder}
                      className="w-full mt-0.5 rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 text-[11px] font-extralight text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30 transition-colors"
                    />
                  </div>
                ))}
                <button
                  onClick={() => handleSubmit(form.id)}
                  className="flex items-center gap-1.5 mt-2 rounded-xl bg-accent/20 border border-accent/30 px-4 py-2 text-[10px] font-extralight text-accent hover:bg-accent/30 transition-colors"
                >
                  <Send className="h-3 w-3" />
                  Launch Investigation
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default NomadStructuredForms;
