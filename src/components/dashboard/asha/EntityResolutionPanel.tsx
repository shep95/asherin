import { useState } from "react";
import { Fingerprint, Link2, CheckCircle2, AlertTriangle, Eye, Merge, X, Search, Users, Building2, CreditCard, FileText, Loader2 } from "lucide-react";

interface EntityMatch {
  id: string;
  entityA: { source: string; label: string; fields: Record<string, string> };
  entityB: { source: string; label: string; fields: Record<string, string> };
  confidence: number;
  matchFields: string[];
  status: "pending" | "approved" | "rejected";
  entityType: "person" | "company" | "transaction" | "product";
}

const typeIcons: Record<string, React.ElementType> = {
  person: Users, company: Building2, transaction: CreditCard, product: FileText,
};

const DEMO_MATCHES: EntityMatch[] = [
  {
    id: "1", entityType: "person",
    entityA: { source: "customers.csv", label: "john.smith@acme.com", fields: { Name: "John Smith", Email: "john.smith@acme.com", Phone: "555-0147" } },
    entityB: { source: "transactions.csv", label: "Customer #8847", fields: { CustomerID: "8847", Name: "J. Smith", Company: "Acme Corporation" } },
    confidence: 94, matchFields: ["Name (fuzzy)", "Company"], status: "pending",
  },
  {
    id: "2", entityType: "company",
    entityA: { source: "suppliers.csv", label: "Acme Corp", fields: { Name: "Acme Corp", Domain: "acme.com", EIN: "12-3456789" } },
    entityB: { source: "contracts.pdf", label: "Acme Corporation", fields: { Party: "Acme Corporation", Address: "123 Main St", EIN: "12-3456789" } },
    confidence: 99, matchFields: ["EIN (exact)", "Name (fuzzy)"], status: "pending",
  },
  {
    id: "3", entityType: "person",
    entityA: { source: "support_tickets.csv", label: "jane.doe@techcorp.com", fields: { Email: "jane.doe@techcorp.com", Subject: "Billing issue" } },
    entityB: { source: "nps_survey.csv", label: "Phone: 555-0298", fields: { Phone: "555-0298", Rating: "3", Company: "TechCorp" } },
    confidence: 61, matchFields: ["Company (inferred)"], status: "pending",
  },
  {
    id: "4", entityType: "transaction",
    entityA: { source: "payments_q1.csv", label: "TXN-44821", fields: { Amount: "$12,450", Date: "2026-01-15", Vendor: "CloudStack Inc" } },
    entityB: { source: "invoices.csv", label: "INV-2026-0087", fields: { Total: "$12,450.00", Issued: "2026-01-14", Company: "CloudStack" } },
    confidence: 87, matchFields: ["Amount (exact)", "Date (±1 day)", "Company (fuzzy)"], status: "pending",
  },
];

const EntityResolutionPanel = () => {
  const [matches, setMatches] = useState<EntityMatch[]>(DEMO_MATCHES);
  const [filterType, setFilterType] = useState("");
  const [filterConfidence, setFilterConfidence] = useState<"all" | "high" | "medium" | "low">("all");
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleAction = (id: string, action: "approved" | "rejected") => {
    setMatches(prev => prev.map(m => m.id === id ? { ...m, status: action } : m));
  };

  const runScan = () => {
    setIsScanning(true);
    setTimeout(() => setIsScanning(false), 3000);
  };

  const filtered = matches.filter(m => {
    if (filterType && m.entityType !== filterType) return false;
    if (filterConfidence === "high" && m.confidence < 85) return false;
    if (filterConfidence === "medium" && (m.confidence < 60 || m.confidence >= 85)) return false;
    if (filterConfidence === "low" && m.confidence >= 60) return false;
    return true;
  });

  const stats = {
    total: matches.length,
    autoMerged: matches.filter(m => m.confidence >= 95).length,
    pending: matches.filter(m => m.status === "pending").length,
    approved: matches.filter(m => m.status === "approved").length,
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-extralight tracking-wide text-foreground">Entity Resolution</h2>
          </div>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            ASHA automatically finds the same entities across your datasets and merges them.
          </p>
        </div>
        <button onClick={runScan} disabled={isScanning} className="flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-light text-accent hover:bg-accent/20 transition-colors disabled:opacity-50">
          {isScanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          {isScanning ? "Scanning Datasets…" : "Run Entity Scan"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Entities Found", value: stats.total, color: "text-foreground" },
          { label: "Auto-Merged (≥95%)", value: stats.autoMerged, color: "text-emerald-400" },
          { label: "Pending Review", value: stats.pending, color: "text-amber-400" },
          { label: "Approved", value: stats.approved, color: "text-accent" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-3">
            <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">{s.label}</p>
            <p className={`text-2xl font-extralight mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-card/30 border border-border/20 rounded-lg px-2 py-1.5 text-[10px] text-foreground outline-none">
          <option value="">All Types</option>
          <option value="person">Person</option>
          <option value="company">Company</option>
          <option value="transaction">Transaction</option>
          <option value="product">Product</option>
        </select>
        <div className="flex gap-1">
          {(["all", "high", "medium", "low"] as const).map(level => (
            <button key={level} onClick={() => setFilterConfidence(level)}
              className={`rounded-lg px-2.5 py-1 text-[10px] font-light transition-colors ${filterConfidence === level ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5"}`}>
              {level === "all" ? "All" : level === "high" ? "≥85%" : level === "medium" ? "60-84%" : "<60%"}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground/40 ml-auto">{filtered.length} matches</span>
      </div>

      {/* Match List */}
      <div className="space-y-3">
        {filtered.map(match => {
          const Icon = typeIcons[match.entityType] || Users;
          const isExpanded = expandedMatch === match.id;
          return (
            <div key={match.id} className={`rounded-xl border backdrop-blur-sm overflow-hidden transition-colors ${
              match.status === "approved" ? "border-emerald-500/20 bg-emerald-500/5" :
              match.status === "rejected" ? "border-destructive/20 bg-destructive/5 opacity-50" :
              "border-border/20 bg-card/20"
            }`}>
              <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpandedMatch(isExpanded ? null : match.id)}>
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-light text-foreground truncate">{match.entityA.label}</span>
                    <Link2 className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                    <span className="text-xs font-light text-foreground truncate">{match.entityB.label}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/50">
                    <span>{match.entityA.source}</span>
                    <span>↔</span>
                    <span>{match.entityB.source}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium ${
                    match.confidence >= 90 ? "bg-emerald-500/15 text-emerald-400" :
                    match.confidence >= 70 ? "bg-amber-500/15 text-amber-400" :
                    "bg-destructive/15 text-destructive"
                  }`}>
                    {match.confidence}% match
                  </div>
                  {match.status === "approved" && <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                  {match.status === "rejected" && <X className="h-4 w-4 text-destructive" />}
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border/20 p-4 space-y-4">
                  {/* Side-by-side comparison */}
                  <div className="grid grid-cols-2 gap-4">
                    {[match.entityA, match.entityB].map((entity, idx) => (
                      <div key={idx} className="rounded-lg border border-border/15 bg-card/30 p-3 space-y-2">
                        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">Source: {entity.source}</p>
                        {Object.entries(entity.fields).map(([key, val]) => (
                          <div key={key} className="flex items-center gap-2 text-[11px]">
                            <span className="text-muted-foreground/60 w-20 shrink-0">{key}:</span>
                            <span className={`font-light ${match.matchFields.some(f => f.toLowerCase().includes(key.toLowerCase())) ? "text-accent" : "text-foreground"}`}>{val}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Match explanation */}
                  <div className="rounded-lg bg-card/20 p-3">
                    <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Match Basis</p>
                    <div className="flex flex-wrap gap-2">
                      {match.matchFields.map(f => (
                        <span key={f} className="rounded-full bg-accent/10 border border-accent/20 px-2 py-0.5 text-[10px] text-accent">{f}</span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  {match.status === "pending" && (
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); handleAction(match.id, "approved"); }}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/20 px-3 py-1.5 text-[11px] text-emerald-400 hover:bg-emerald-500/25 transition-colors">
                        <Merge className="h-3 w-3" /> Merge Entities
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleAction(match.id, "rejected"); }}
                        className="flex items-center gap-1.5 rounded-lg border border-border/20 px-3 py-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                        <X className="h-3 w-3" /> Not a Match
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Fingerprint className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-xs text-muted-foreground/40 font-extralight">No entity matches found. Upload multiple datasets and run a scan.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EntityResolutionPanel;
