import { useState } from "react";
import { ClipboardList, User, Building2, Shield, Globe, AtSign, Phone, Mail, ChevronDown, ChevronUp, Send, Search } from "lucide-react";

interface NomadStructuredFormsProps {
  onSubmit: (query: string) => void;
}

type InvestigationType = "person" | "company" | "domain" | "username" | "phone_email";

interface InvestigationPurpose {
  id: string;
  label: string;
}

const INVESTIGATION_TYPES: { id: InvestigationType; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "person", label: "Person", icon: User, desc: "Individual background & behavioral profile" },
  { id: "company", label: "Company", icon: Building2, desc: "Corporate due diligence & entity structure" },
  { id: "domain", label: "Domain", icon: Globe, desc: "Infrastructure forensics & certificate transparency" },
  { id: "username", label: "Username", icon: AtSign, desc: "Cross-platform identity resolution" },
  { id: "phone_email", label: "Phone / Email", icon: Mail, desc: "Contact-based intelligence gathering" },
];

const PURPOSES: InvestigationPurpose[] = [
  { id: "due_diligence", label: "Due Diligence" },
  { id: "background_check", label: "Background Check" },
  { id: "competitive_intel", label: "Competitive Intel" },
  { id: "asset_research", label: "Asset Research" },
  { id: "threat_assessment", label: "Threat Assessment" },
  { id: "reconnection", label: "Reconnection" },
];

const SOURCE_PRIORITIES = [
  { id: "government", label: "Government / Legal" },
  { id: "financial", label: "Financial" },
  { id: "social", label: "Social Media" },
  { id: "academic", label: "Academic" },
  { id: "corporate", label: "Corporate Registry" },
];

interface PersonFields {
  fullName: string;
  aliases: string;
  location: string;
  employer: string;
  email: string;
  username: string;
  ageRange: string;
}

interface CompanyFields {
  name: string;
  jurisdiction: string;
  industry: string;
  principals: string;
  context: string;
}

const NomadStructuredForms = ({ onSubmit }: NomadStructuredFormsProps) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedType, setSelectedType] = useState<InvestigationType>("person");
  const [purpose, setPurpose] = useState("due_diligence");
  const [sources, setSources] = useState<string[]>(["government", "financial", "social", "corporate"]);
  const [personFields, setPersonFields] = useState<PersonFields>({
    fullName: "", aliases: "", location: "", employer: "", email: "", username: "", ageRange: "",
  });
  const [companyFields, setCompanyFields] = useState<CompanyFields>({
    name: "", jurisdiction: "", industry: "", principals: "", context: "",
  });
  const [genericInput, setGenericInput] = useState("");

  const toggleSource = (id: string) => {
    setSources(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const buildQuery = (): string => {
    const purposeLabel = PURPOSES.find(p => p.id === purpose)?.label || "General";
    const sourcePriorities = sources.map(s => SOURCE_PRIORITIES.find(sp => sp.id === s)?.label).filter(Boolean).join(", ");

    if (selectedType === "person") {
      const f = personFields;
      if (!f.fullName.trim()) return "";
      const parts = [`Investigate person: ${f.fullName}`];
      if (f.aliases) parts.push(`Known aliases: ${f.aliases}`);
      if (f.location) parts.push(`Location: ${f.location}`);
      if (f.employer) parts.push(`Employer: ${f.employer}`);
      if (f.email) parts.push(`Email: ${f.email}`);
      if (f.username) parts.push(`Username: ${f.username}`);
      if (f.ageRange) parts.push(`Age/DOB: ${f.ageRange}`);
      parts.push(`Investigation purpose: ${purposeLabel}`);
      parts.push(`Source priorities: ${sourcePriorities}`);
      return parts.join(". ");
    }

    if (selectedType === "company") {
      const f = companyFields;
      if (!f.name.trim()) return "";
      const parts = [`Investigate company: ${f.name}`];
      if (f.jurisdiction) parts.push(`Jurisdiction: ${f.jurisdiction}`);
      if (f.industry) parts.push(`Industry: ${f.industry}`);
      if (f.principals) parts.push(`Key principals: ${f.principals}`);
      if (f.context) parts.push(`Context: ${f.context}`);
      parts.push(`Investigation purpose: ${purposeLabel}`);
      return parts.join(". ");
    }

    if (selectedType === "domain") return genericInput ? `Investigate domain: ${genericInput}. Purpose: ${purposeLabel}` : "";
    if (selectedType === "username") return genericInput ? `Investigate username: ${genericInput}. Purpose: ${purposeLabel}. Cross-platform identity resolution.` : "";
    if (selectedType === "phone_email") return genericInput ? `Investigate contact: ${genericInput}. Purpose: ${purposeLabel}` : "";
    return "";
  };

  const handleSubmit = () => {
    const query = buildQuery();
    if (!query) return;
    onSubmit(query);
    setExpanded(false);
    setPersonFields({ fullName: "", aliases: "", location: "", employer: "", email: "", username: "", ageRange: "" });
    setCompanyFields({ name: "", jurisdiction: "", industry: "", principals: "", context: "" });
    setGenericInput("");
  };

  const isValid = buildQuery().length > 0;

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between rounded-xl border border-border/20 bg-card/20 hover:bg-card/30 px-4 py-3 transition-colors"
      >
        <div className="flex items-center gap-2 text-[11px] font-extralight tracking-wider text-muted-foreground/60 uppercase">
          <ClipboardList className="h-3.5 w-3.5" />
          Structured Investigation Builder
        </div>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/40" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />}
      </button>

      {expanded && (
        <div className="rounded-xl border border-border/20 bg-card/20 p-4 space-y-4 animate-fade-in">
          {/* Investigation Type Selector */}
          <div>
            <label className="text-[9px] font-extralight text-muted-foreground/50 uppercase tracking-wider mb-2 block">Investigation Type</label>
            <div className="grid grid-cols-5 gap-1.5">
              {INVESTIGATION_TYPES.map(type => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-all ${
                    selectedType === type.id
                      ? "border-foreground/15 bg-foreground/[0.06] text-foreground"
                      : "border-border/15 bg-card/15 text-muted-foreground/60 hover:text-foreground hover:border-border/30"
                  }`}
                >
                  <type.icon className="h-3.5 w-3.5" />
                  <span className="text-[9px] font-extralight">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Fields based on type */}
          <div className="space-y-2">
            <label className="text-[9px] font-extralight text-muted-foreground/50 uppercase tracking-wider block">
              Known Identifiers <span className="text-muted-foreground/30">(fill what you know)</span>
            </label>

            {selectedType === "person" && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "fullName" as const, label: "Full Name *", placeholder: "John Smith" },
                  { key: "aliases" as const, label: "Known Aliases", placeholder: "J. Smith, jsmith" },
                  { key: "location" as const, label: "Location", placeholder: "Austin, TX" },
                  { key: "employer" as const, label: "Known Employer", placeholder: "Acme Corp" },
                  { key: "email" as const, label: "Known Email", placeholder: "john@example.com" },
                  { key: "username" as const, label: "Known Username", placeholder: "@jsmith" },
                  { key: "ageRange" as const, label: "Age / DOB", placeholder: "~35 or 1990-01-15" },
                ].map(field => (
                  <div key={field.key} className={field.key === "fullName" ? "col-span-2" : ""}>
                    <label className="text-[8px] font-extralight text-muted-foreground/40 mb-0.5 block">{field.label}</label>
                    <input
                      value={personFields[field.key]}
                      onChange={e => setPersonFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 text-[11px] font-extralight text-foreground placeholder:text-muted-foreground/25 outline-none focus:border-foreground/15 transition-colors"
                    />
                  </div>
                ))}
              </div>
            )}

            {selectedType === "company" && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: "name" as const, label: "Company Name *", placeholder: "Acme Corp" },
                  { key: "jurisdiction" as const, label: "Jurisdiction", placeholder: "Delaware, USA" },
                  { key: "industry" as const, label: "Industry", placeholder: "Technology" },
                  { key: "principals" as const, label: "Key Principals", placeholder: "Jane Smith, John Doe" },
                  { key: "context" as const, label: "Investigation Context", placeholder: "Pre-acquisition review" },
                ].map(field => (
                  <div key={field.key} className={field.key === "name" || field.key === "context" ? "col-span-2" : ""}>
                    <label className="text-[8px] font-extralight text-muted-foreground/40 mb-0.5 block">{field.label}</label>
                    <input
                      value={companyFields[field.key]}
                      onChange={e => setCompanyFields(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 text-[11px] font-extralight text-foreground placeholder:text-muted-foreground/25 outline-none focus:border-foreground/15 transition-colors"
                    />
                  </div>
                ))}
              </div>
            )}

            {(selectedType === "domain" || selectedType === "username" || selectedType === "phone_email") && (
              <input
                value={genericInput}
                onChange={e => setGenericInput(e.target.value)}
                placeholder={
                  selectedType === "domain" ? "example.com" :
                  selectedType === "username" ? "jsmith99" :
                  "john@example.com or +1-555-0100"
                }
                className="w-full rounded-lg border border-border/20 bg-card/20 px-3 py-2 text-[11px] font-extralight text-foreground placeholder:text-muted-foreground/25 outline-none focus:border-foreground/15 transition-colors"
              />
            )}
          </div>

          {/* Investigation Purpose */}
          <div>
            <label className="text-[9px] font-extralight text-muted-foreground/50 uppercase tracking-wider mb-2 block">
              Investigation Purpose <span className="text-muted-foreground/30">(affects source weighting)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PURPOSES.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPurpose(p.id)}
                  className={`rounded-full px-3 py-1 text-[9px] font-extralight transition-colors ${
                    purpose === p.id
                      ? "bg-foreground/[0.08] border border-foreground/15 text-foreground"
                      : "bg-card/15 border border-border/15 text-muted-foreground/50 hover:text-foreground"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Source Priorities */}
          <div>
            <label className="text-[9px] font-extralight text-muted-foreground/50 uppercase tracking-wider mb-2 block">Source Priorities</label>
            <div className="flex flex-wrap gap-1.5">
              {SOURCE_PRIORITIES.map(s => (
                <button
                  key={s.id}
                  onClick={() => toggleSource(s.id)}
                  className={`rounded-full px-3 py-1 text-[9px] font-extralight transition-colors ${
                    sources.includes(s.id)
                      ? "bg-foreground/10 border border-foreground/20 text-foreground"
                      : "bg-card/10 border border-border/10 text-muted-foreground/30 hover:text-muted-foreground/60"
                  }`}
                >
                  {sources.includes(s.id) ? "☑" : "☐"} {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Launch Button */}
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-foreground/[0.08] border border-border/30 px-4 py-2.5 text-[11px] font-extralight text-foreground hover:bg-foreground/[0.12] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <Search className="h-3.5 w-3.5" />
            Launch Investigation
          </button>
        </div>
      )}
    </div>
  );
};

export default NomadStructuredForms;
