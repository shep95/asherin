import { useState, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Brain, BookOpen, Shield, Code2, Zap, Copy, Check, Download, Search,
  ChevronDown, ChevronRight, Scale, Lock, Bug, Gauge, Eye, RefreshCw, Terminal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CodingLaw {
  id: string;
  name: string;
  domain: string;
  law: string;
  era: string;
  severity: "critical" | "standard" | "advisory";
  active: boolean;
  rationale: string;
}

const CODING_LAWS: CodingLaw[] = [
  // FOUNDATIONAL LAWS (Origin Era)
  {
    id: "law-001", name: "Law of Single Responsibility", domain: "Architecture",
    law: "Every module, class, or function shall serve exactly ONE purpose. If it does two things, it becomes two units.",
    era: "1972 — Structured Programming", severity: "critical", active: true,
    rationale: "Derived from Dijkstra's structured programming theorem. Violations cause cascading failures in large systems."
  },
  {
    id: "law-002", name: "Law of Immutable Inputs", domain: "Security",
    law: "All external input is hostile until validated. Never trust user data, API responses, or file contents without explicit sanitization.",
    era: "1988 — Morris Worm Era", severity: "critical", active: true,
    rationale: "The Morris Worm demonstrated that trusting input destroys systems. Every modern exploit begins with unsanitized input."
  },
  {
    id: "law-003", name: "Law of Explicit Failure", domain: "Error Handling",
    law: "Code shall fail loudly, specifically, and recoverably. Silent failures are the root of data corruption.",
    era: "1990s — Enterprise Systems", severity: "critical", active: true,
    rationale: "Silent catch blocks caused billions in losses. Every exception must produce actionable diagnostics."
  },
  {
    id: "law-004", name: "Law of Minimal Privilege", domain: "Security",
    law: "Every process, user, and module operates with the absolute minimum permissions required. No exceptions.",
    era: "1975 — Saltzer & Schroeder", severity: "critical", active: true,
    rationale: "Principle of least privilege prevents lateral movement. A compromised component cannot escalate beyond its boundary."
  },
  {
    id: "law-005", name: "Law of Composition Over Inheritance", domain: "Architecture",
    law: "Prefer composing behavior from small, focused units over deep inheritance chains. Inheritance creates brittle coupling.",
    era: "1994 — GoF Design Patterns", severity: "standard", active: true,
    rationale: "The Gang of Four demonstrated that composition enables flexibility. Deep hierarchies resist change."
  },
  {
    id: "law-006", name: "Law of Idempotent Operations", domain: "API Engineering",
    law: "Any operation that can be retried must produce the same result on every execution. Network failures demand idempotency.",
    era: "2000s — Distributed Systems", severity: "critical", active: true,
    rationale: "In distributed systems, messages are delivered at-least-once. Non-idempotent operations cause duplicate charges and data corruption."
  },
  {
    id: "law-007", name: "Law of Type Safety", domain: "Language Design",
    law: "Every variable, parameter, and return value shall have an explicit type. Type inference is acceptable; type absence is not.",
    era: "2012 — TypeScript Era", severity: "standard", active: true,
    rationale: "Untyped code at scale becomes unmaintainable. Types serve as machine-verified documentation."
  },
  {
    id: "law-008", name: "Law of Observable State", domain: "Frontend Architecture",
    law: "UI state must be derived from a single source of truth. Duplicated state creates visual inconsistency and race conditions.",
    era: "2015 — React/Redux Era", severity: "standard", active: true,
    rationale: "Duplicated state inevitably diverges. Single source of truth eliminates an entire category of UI bugs."
  },
  {
    id: "law-009", name: "Law of Graceful Degradation", domain: "Resilience",
    law: "When a dependency fails, the system degrades to a reduced-functionality state — it never crashes entirely.",
    era: "2010s — Cloud Native", severity: "critical", active: true,
    rationale: "Users tolerate partial functionality. Users do not tolerate blank screens. Circuit breakers and fallbacks are mandatory."
  },
  {
    id: "law-010", name: "Law of Constant-Time Secrets", domain: "Cryptography",
    law: "All secret comparisons (passwords, tokens, keys) must use constant-time algorithms. Timing attacks extract secrets byte-by-byte.",
    era: "2003 — Side-Channel Research", severity: "critical", active: true,
    rationale: "Naive string comparison leaks secret length through microsecond timing differences. Use crypto.timingSafeEqual or equivalent."
  },
  {
    id: "law-011", name: "Law of Zero Trust Boundaries", domain: "Security",
    law: "Every service boundary is an untrusted boundary. Internal services authenticate and authorize every request — no implicit trust.",
    era: "2020s — Zero Trust Architecture", severity: "critical", active: true,
    rationale: "Perimeter security is dead. Lateral movement within networks exploits implicit trust between services."
  },
  {
    id: "law-012", name: "Law of Dependency Minimalism", domain: "Engineering",
    law: "Every dependency is a liability. Add only what you cannot reasonably build. Audit everything. Pin versions.",
    era: "2016 — left-pad Incident", severity: "standard", active: true,
    rationale: "The left-pad incident proved that a single removed package can break the internet. Supply chain attacks exploit dependency trees."
  },
  {
    id: "law-013", name: "Law of Readable Code", domain: "Craft",
    law: "Code is read 10x more than it is written. Optimize for the reader, not the writer. Clever code is hostile code.",
    era: "Timeless", severity: "standard", active: true,
    rationale: "Future maintainers (including you in 6 months) must understand intent instantly. Variable names are documentation."
  },
  {
    id: "law-014", name: "Law of Atomic Transactions", domain: "Database Engineering",
    law: "Data mutations spanning multiple records must be atomic. Partial writes corrupt state and violate user trust.",
    era: "1970 — Codd's Relational Model", severity: "critical", active: true,
    rationale: "A half-completed transaction (debit without credit) is worse than a failed transaction. Use database transactions or sagas."
  },
  {
    id: "law-015", name: "Law of Observability", domain: "Operations",
    law: "If you cannot see it, you cannot fix it. Every production system must emit structured logs, metrics, and traces.",
    era: "2018 — Observability Movement", severity: "standard", active: true,
    rationale: "Debugging production without observability is forensics without evidence. Structured telemetry reduces MTTR by orders of magnitude."
  },
  {
    id: "law-016", name: "Law of Backward Compatibility", domain: "API Engineering",
    law: "Public APIs never break existing clients. Use versioning, deprecation windows, and additive-only changes.",
    era: "2000s — REST/SOA Era", severity: "standard", active: true,
    rationale: "Breaking changes destroy trust. Clients cannot upgrade on your timeline. Semantic versioning is a contract."
  },
  {
    id: "law-017", name: "Law of Deterministic Builds", domain: "Infrastructure",
    law: "The same source code must produce the same artifact every time. Non-deterministic builds are unauditable.",
    era: "2013 — Docker Era", severity: "standard", active: true,
    rationale: "If you can't reproduce a build, you can't verify it. Lockfiles, pinned versions, and containerization enforce determinism."
  },
  {
    id: "law-018", name: "Law of Defense in Depth", domain: "Security",
    law: "No single security control is sufficient. Layer authentication, authorization, encryption, validation, and monitoring.",
    era: "Military Doctrine → Software", severity: "critical", active: true,
    rationale: "Every control can fail. Layered defenses ensure that a single bypass does not grant full access."
  },
  {
    id: "law-019", name: "Law of Efficient Algorithms", domain: "Performance",
    law: "O(n²) is acceptable for prototypes. It is never acceptable in production. Profile before optimizing, but always optimize.",
    era: "1962 — Knuth's Analysis", severity: "standard", active: true,
    rationale: "Premature optimization is the root of evil, but negligent complexity is the root of outages. Know your Big O."
  },
  {
    id: "law-020", name: "Law of Semantic Naming", domain: "Craft",
    law: "Names must describe intent, not implementation. `getUserAge()` not `calcDiff()`. `isEligible` not `flag2`.",
    era: "Timeless", severity: "advisory", active: true,
    rationale: "Code is a living document. Names that describe 'what' enable comprehension without reading 'how'."
  },
];

const DOMAIN_ICONS: Record<string, typeof Brain> = {
  "Architecture": Code2,
  "Security": Shield,
  "Error Handling": Bug,
  "API Engineering": Zap,
  "Language Design": Terminal,
  "Frontend Architecture": Eye,
  "Resilience": RefreshCw,
  "Cryptography": Lock,
  "Engineering": Gauge,
  "Craft": BookOpen,
  "Database Engineering": Code2,
  "Operations": Eye,
  "Infrastructure": Terminal,
  "Performance": Gauge,
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-400",
  standard: "border-accent/30 bg-accent/10 text-accent",
  advisory: "border-foreground/20 bg-foreground/5 text-muted-foreground",
};

const CodingLawsView = () => {
  const { toast } = useToast();
  const [laws, setLaws] = useState<CodingLaw[]>(CODING_LAWS);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedLaw, setExpandedLaw] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterDomain, setFilterDomain] = useState<string>("all");

  const activeLaws = laws.filter(l => l.active).length;
  const domains = [...new Set(laws.map(l => l.domain))];

  const filteredLaws = laws.filter(l => {
    const matchesSearch = !searchQuery || l.name.toLowerCase().includes(searchQuery.toLowerCase()) || l.law.toLowerCase().includes(searchQuery.toLowerCase()) || l.domain.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDomain = filterDomain === "all" || l.domain === filterDomain;
    return matchesSearch && matchesDomain;
  });

  const toggleLaw = (id: string) => {
    setLaws(prev => prev.map(l => l.id === id ? { ...l, active: !l.active } : l));
  };

  const copyLaw = useCallback((law: CodingLaw) => {
    navigator.clipboard.writeText(`[${law.name}]\n${law.law}\n\nRationale: ${law.rationale}\nEra: ${law.era}`);
    setCopiedId(law.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied", description: law.name });
  }, [toast]);

  const exportAll = () => {
    const active = laws.filter(l => l.active);
    const text = active.map((l, i) => 
      `LAW ${String(i + 1).padStart(3, "0")}: ${l.name}\nDomain: ${l.domain} | Severity: ${l.severity.toUpperCase()} | Era: ${l.era}\n\n${l.law}\n\nRationale: ${l.rationale}\n\n${"─".repeat(80)}`
    ).join("\n\n");
    const header = `AUREON — LAWS OF CODING\nActive Laws: ${active.length}/${laws.length}\nExported: ${new Date().toISOString()}\n${"═".repeat(80)}\n\n`;
    const blob = new Blob([header + text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aureon-coding-laws-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: `${active.length} active laws exported.` });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 bg-card/20 backdrop-blur-xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl border border-border/30 bg-card/40 flex items-center justify-center">
              <Scale className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-extralight tracking-[0.3em] uppercase text-foreground">Laws of Coding</h1>
              <p className="text-xs font-extralight text-muted-foreground tracking-wide">
                Historic principles that govern Aureon's code generation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border/30 bg-card/30 px-4 py-2">
              <span className="text-[10px] font-extralight tracking-widest uppercase text-muted-foreground">
                {activeLaws}/{laws.length} Active
              </span>
            </div>
            <button onClick={exportAll} className="flex items-center gap-2 rounded-2xl border border-border/30 bg-card/30 px-4 py-2 text-xs font-extralight tracking-wider text-muted-foreground hover:text-foreground transition-colors">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>
        </div>

        {/* Search + Filter */}
        <div className="flex items-center gap-3 mt-4">
          <div className="flex-1 flex items-center gap-2 rounded-2xl border border-border/20 bg-card/20 px-4 py-2.5">
            <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search laws..."
              className="flex-1 bg-transparent text-sm font-extralight text-foreground placeholder:text-muted-foreground/40 outline-none"
            />
          </div>
          <select
            value={filterDomain}
            onChange={e => setFilterDomain(e.target.value)}
            className="rounded-2xl border border-border/20 bg-card/20 px-4 py-2.5 text-xs font-extralight text-foreground outline-none"
          >
            <option value="all">All Domains</option>
            {domains.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Laws Grid */}
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-3">
          {filteredLaws.map((law) => {
            const Icon = DOMAIN_ICONS[law.domain] || Brain;
            const isExpanded = expandedLaw === law.id;
            return (
              <div
                key={law.id}
                className={`rounded-2xl border bg-card/20 backdrop-blur-sm transition-all ${
                  law.active ? "border-border/30" : "border-border/10 opacity-50"
                }`}
              >
                <div className="flex items-start gap-4 p-5">
                  <div className="flex-shrink-0 h-9 w-9 rounded-2xl border border-border/20 bg-card/30 flex items-center justify-center mt-0.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <button onClick={() => setExpandedLaw(isExpanded ? null : law.id)} className="flex items-center gap-1.5">
                        {isExpanded ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                        <h3 className="text-sm font-light tracking-wide text-foreground">{law.name}</h3>
                      </button>
                      <Badge variant="outline" className={`text-[9px] font-extralight tracking-wider rounded-xl ${SEVERITY_STYLES[law.severity]}`}>
                        {law.severity.toUpperCase()}
                      </Badge>
                      <span className="text-[9px] font-extralight tracking-wider text-muted-foreground/50">{law.domain}</span>
                    </div>
                    <p className="text-xs font-extralight leading-relaxed text-muted-foreground pr-4">{law.law}</p>
                    {isExpanded && (
                      <div className="mt-4 space-y-3 rounded-2xl border border-border/10 bg-card/10 p-4">
                        <div>
                          <span className="text-[10px] font-light tracking-wider text-muted-foreground/50 uppercase">Rationale</span>
                          <p className="text-xs font-extralight leading-relaxed text-foreground/80 mt-1">{law.rationale}</p>
                        </div>
                        <div>
                          <span className="text-[10px] font-light tracking-wider text-muted-foreground/50 uppercase">Origin Era</span>
                          <p className="text-xs font-extralight text-foreground/70 mt-1">{law.era}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => copyLaw(law)} className="rounded-xl p-2 text-muted-foreground hover:text-foreground transition-colors">
                      {copiedId === law.id ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                    <Switch checked={law.active} onCheckedChange={() => toggleLaw(law.id)} />
                  </div>
                </div>
              </div>
            );
          })}

          {filteredLaws.length === 0 && (
            <div className="text-center py-16">
              <Scale className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-extralight text-muted-foreground">No laws match your search.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default CodingLawsView;
