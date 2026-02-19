import { useState, useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import {
  Shield, Search, Globe, Cpu, Eye, GitBranch, Layers, Activity,
  FileSearch, Terminal, Network, Database, Lock, Unlock, Zap,
  ChevronRight, ChevronDown, Copy, Download, AlertTriangle,
  CheckCircle2, Clock, Loader2, X, Plus, Play, RotateCcw,
  Code2, Server, Hash, User, Link2, Key, FileText, Info,
  BookOpen, Crosshair, Radio
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ModuleCategory = "identity" | "deepdive" | "hivemind" | "ghost" | "crypto";

interface ElionModule {
  id: string;
  name: string;
  phase?: number;
  icon: React.ElementType;
  category: ModuleCategory;
  description: string;
  inputLabel: string;
  inputPlaceholder: string;
  inputType?: "url" | "text" | "email" | "domain";
}

interface ModuleResult {
  moduleId: string;
  moduleName: string;
  query: string;
  timestamp: Date;
  status: "running" | "complete" | "error";
  output: string;
  artifacts?: { label: string; value: string }[];
}

// ─── Module Registry ──────────────────────────────────────────────────────────

const MODULES: ElionModule[] = [
  // Identity Recon
  { id: "identity-breach", name: "Breach Checker", icon: Shield, category: "identity", description: "Check email/username against known data breaches and leaked credential databases.", inputLabel: "Email or Username", inputPlaceholder: "target@domain.com", inputType: "email" },
  { id: "identity-dossier", name: "Dossier Builder", icon: User, category: "identity", description: "Aggregate public profile data, social accounts, and entity resolution into a structured dossier.", inputLabel: "Full Name or Handle", inputPlaceholder: "John Doe or @handle", inputType: "text" },
  { id: "identity-entity", name: "Entity Resolution", icon: GitBranch, category: "identity", description: "Resolve and correlate entities across multiple data sources to build an identity graph.", inputLabel: "Entity (name, email, phone, or domain)", inputPlaceholder: "entity to resolve", inputType: "text" },

  // DeepDive Phases
  { id: "deepdive-2", name: "Phase 2 — Web Recon", phase: 2, icon: Globe, category: "deepdive", description: "Enumerate public web footprint, WHOIS, DNS records, and hosting infrastructure.", inputLabel: "Target Domain or URL", inputPlaceholder: "example.com", inputType: "domain" },
  { id: "deepdive-3", name: "Phase 3 — Forum Hunt", phase: 3, icon: Search, category: "deepdive", description: "Scan forums, Discord servers, Reddit, and community platforms for target mentions.", inputLabel: "Target (name, handle, or keyword)", inputPlaceholder: "search term", inputType: "text" },
  { id: "deepdive-4", name: "Phase 4 — Keyword Map", phase: 4, icon: Hash, category: "deepdive", description: "Build a comprehensive keyword and topic map from target's public digital footprint.", inputLabel: "Seed Keyword or Domain", inputPlaceholder: "keyword or domain", inputType: "text" },
  { id: "deepdive-5", name: "Phase 5 — Code Hunt", phase: 5, icon: Code2, category: "deepdive", description: "Search GitHub, GitLab, and code repositories for target-associated commits, emails, and secrets.", inputLabel: "Username, Email, or Org", inputPlaceholder: "github-user or org", inputType: "text" },
  { id: "deepdive-6", name: "Phase 6 — Admin Fuzz", phase: 6, icon: Terminal, category: "deepdive", description: "Enumerate admin panels, login endpoints, and management interfaces on the target domain.", inputLabel: "Target Domain", inputPlaceholder: "example.com", inputType: "domain" },
  { id: "deepdive-7", name: "Phase 7 — Storage Scan", phase: 7, icon: Database, category: "deepdive", description: "Discover exposed S3 buckets, Azure blobs, GCS buckets, and misconfigured cloud storage.", inputLabel: "Organization or Domain", inputPlaceholder: "company or domain", inputType: "text" },
  { id: "deepdive-8", name: "Phase 8 — Blueprint Extract", phase: 8, icon: FileSearch, category: "deepdive", description: "Extract tech stack, framework fingerprints, and architecture blueprints from target infrastructure.", inputLabel: "Target URL", inputPlaceholder: "https://target.com", inputType: "url" },
  { id: "deepdive-9", name: "Phase 9 — Infiltration", phase: 9, icon: Eye, category: "deepdive", description: "Passive network infiltration mapping — enumerate services, open ports, and vulnerable endpoints.", inputLabel: "Target Domain or IP", inputPlaceholder: "example.com or 1.2.3.4", inputType: "text" },
  { id: "deepdive-10", name: "Phase 10 — Header Hunt", phase: 10, icon: Server, category: "deepdive", description: "Analyze HTTP response headers for security misconfigurations, server leaks, and fingerprinting data.", inputLabel: "Target URL", inputPlaceholder: "https://target.com", inputType: "url" },
  { id: "deepdive-11", name: "Phase 11 — Local Header Hunt", phase: 11, icon: Network, category: "deepdive", description: "Deep header analysis including caching behavior, CORS policies, and transport security settings.", inputLabel: "Target URL", inputPlaceholder: "https://target.com", inputType: "url" },
  { id: "deepdive-12", name: "Phase 12 — Future Models", phase: 12, icon: Cpu, category: "deepdive", description: "Predict future infrastructure changes and service migrations based on current footprint signals.", inputLabel: "Organization or Domain", inputPlaceholder: "company.com", inputType: "domain" },
  { id: "deepdive-13", name: "Phase 13 — Comms Hunt", phase: 13, icon: Link2, category: "deepdive", description: "Map communication channels — Slack workspaces, Discord servers, Telegram groups, and email patterns.", inputLabel: "Organization Name or Domain", inputPlaceholder: "CompanyName or domain", inputType: "text" },
  { id: "deepdive-14", name: "Phase 14 — Header Injection", phase: 14, icon: AlertTriangle, category: "deepdive", description: "Test for HTTP header injection vulnerabilities, host header attacks, and request smuggling vectors.", inputLabel: "Target URL", inputPlaceholder: "https://target.com", inputType: "url" },
  { id: "deepdive-15", name: "Phase 15 — API Discovery", phase: 15, icon: Key, category: "deepdive", description: "Enumerate REST APIs, GraphQL endpoints, and undocumented API routes through passive and active discovery.", inputLabel: "Target Domain or URL", inputPlaceholder: "api.example.com", inputType: "url" },
  { id: "deepdive-16", name: "Phase 16 — Source Map Hunt", phase: 16, icon: FileSearch, category: "deepdive", description: "Discover exposed JavaScript source maps that reveal minified source code and internal file paths.", inputLabel: "Target URL", inputPlaceholder: "https://target.com", inputType: "url" },
  { id: "deepdive-17", name: "Phase 17 — Feature Fuzz", phase: 17, icon: Activity, category: "deepdive", description: "Fuzz application features to discover hidden functionality, rate limits, and undocumented behaviors.", inputLabel: "Target URL", inputPlaceholder: "https://target.com", inputType: "url" },
  { id: "deepdive-18", name: "Phase 18 — Content Analysis", phase: 18, icon: Layers, category: "deepdive", description: "Deep content intelligence — sentiment analysis, authorship fingerprinting, and topic extraction from target content.", inputLabel: "URL or Text Content", inputPlaceholder: "https://target.com/blog or paste text", inputType: "url" },
  { id: "deepdive-19", name: "Phase 19 — Secret Miner", phase: 19, icon: Lock, category: "deepdive", description: "Mine public repositories and web assets for accidentally exposed API keys, tokens, and credentials.", inputLabel: "Organization, Repo, or Domain", inputPlaceholder: "org/repo or domain.com", inputType: "text" },
  { id: "deepdive-20", name: "Phase 20 — Code Context", phase: 20, icon: Code2, category: "deepdive", description: "Deep code analysis — extract business logic, data flows, and security patterns from public codebases.", inputLabel: "Repository or Organization", inputPlaceholder: "org/repo or github.com/org", inputType: "text" },

  // HiveMind Orchestrator
  { id: "hivemind-chain", name: "HiveMind Chain", icon: GitBranch, category: "hivemind", description: "Orchestrate multiple DeepDive phases in sequence, with each phase feeding intelligence into the next.", inputLabel: "Primary Target", inputPlaceholder: "domain, email, or entity", inputType: "text" },
  { id: "hivemind-parallel", name: "Parallel Strike", icon: Zap, category: "hivemind", description: "Launch all identity and web recon modules simultaneously against a single target for maximum coverage.", inputLabel: "Target", inputPlaceholder: "domain or identity target", inputType: "text" },

  // Ghost Mode
  { id: "ghost-route", name: "Ghost Routing", icon: Unlock, category: "ghost", description: "Privacy-hardened request routing analysis — enumerate proxy chains, Tor exit nodes, and anonymization paths.", inputLabel: "Target URL or Service", inputPlaceholder: "https://target.com", inputType: "url" },
  { id: "ghost-latency", name: "Latency Humanizer", icon: Clock, category: "ghost", description: "Analyze and simulate human-like request timing patterns with Gaussian jitter to bypass bot detection.", inputLabel: "Target Domain", inputPlaceholder: "example.com", inputType: "domain" },

  // Crypto/Stego
  { id: "crypto-stego", name: "Steganographic Analysis", icon: Eye, category: "crypto", description: "Detect and analyze steganographic content hidden in images, documents, and media files.", inputLabel: "File URL or Content URL", inputPlaceholder: "https://target.com/image.jpg", inputType: "url" },
  { id: "crypto-hash", name: "Hash & Signature Analysis", icon: Hash, category: "crypto", description: "Analyze cryptographic signatures, hash patterns, and entropy measurements in target content.", inputLabel: "URL, Hash, or Content", inputPlaceholder: "hash or https://target.com/file", inputType: "text" },
];

const CATEGORY_META: Record<ModuleCategory, { label: string; icon: React.ElementType; color: string }> = {
  identity: { label: "Identity Recon", icon: User, color: "text-blue-400" },
  deepdive: { label: "DeepDive Phases", icon: Layers, color: "text-accent" },
  hivemind: { label: "HiveMind Orchestrator", icon: GitBranch, color: "text-violet-400" },
  ghost: { label: "Ghost Mode", icon: Shield, color: "text-emerald-400" },
  crypto: { label: "Crypto / Stego", icon: Lock, color: "text-amber-400" },
};

// ─── About / Info Sections ────────────────────────────────────────────────────

const ABOUT_SECTIONS = [
  {
    icon: Crosshair,
    title: "What is Elion?",
    content: `Elion is a forensic-grade OSINT intelligence toolkit — a full web-native port of the Zohar Intelligence Framework. 
It provides 27 specialized modules organized across 5 intelligence categories: Identity Recon, 20 DeepDive Phases, HiveMind Orchestration, Ghost Mode, and Cryptographic Analysis.

Each module is powered by Aureon's intelligence engine, delivering structured, actionable intelligence reports formatted to professional analyst standards.`
  },
  {
    icon: Layers,
    title: "20 DeepDive Phases",
    content: `The DeepDive system provides systematic, phase-by-phase OSINT coverage of any target:

**Phases 2–5** cover web footprint, forum intelligence, keyword mapping, and code repository analysis.
**Phases 6–11** focus on infrastructure: admin enumeration, cloud storage, blueprint extraction, network mapping, and header intelligence.
**Phases 12–17** advance into predictive modeling, communication channel mapping, injection testing, API discovery, source map hunting, and feature fuzzing.
**Phases 18–20** deliver deep content intelligence, secret mining across public repositories, and code context analysis.`
  },
  {
    icon: GitBranch,
    title: "HiveMind Orchestrator",
    content: `HiveMind coordinates multiple modules into unified intelligence operations.

**Chain Mode** runs phases sequentially — each finding feeds the next phase for compound intelligence depth. **Parallel Strike** activates all identity and web recon modules simultaneously against a single target for maximum coverage and speed.

The orchestrator synthesizes all findings into a unified Executive Intelligence Assessment with prioritized, correlated findings.`
  },
  {
    icon: Shield,
    title: "Ghost Mode",
    content: `Ghost Mode activates maximum OPSEC analysis across all modules. When enabled, every analysis includes anonymization pathway evaluation, traffic correlation risk assessment, and operational security guidance.

The Latency Humanizer module models Gaussian-distributed request timing to simulate natural human behavior and bypass behavioral detection systems.`
  },
  {
    icon: Radio,
    title: "Intelligence Report",
    content: `After running multiple modules, use the **Generate Intelligence Report** feature to compile all findings into a single Aureon-authored briefing.

The report synthesizes across all completed module outputs, identifies cross-module correlations, assigns aggregate risk ratings, and delivers a formatted intelligence summary — ready for export or further analysis.`
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

const ElionView = () => {
  const [selectedModule, setSelectedModule] = useState<ElionModule | null>(null);
  const [activeTab, setActiveTab] = useState<"modules" | "report" | "about">("modules");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ModuleResult[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    identity: true,
    deepdive: true,
    hivemind: false,
    ghost: false,
    crypto: false,
  });
  const [expandedAbout, setExpandedAbout] = useState<Record<number, boolean>>({ 0: true });
  const [activeResult, setActiveResult] = useState<ModuleResult | null>(null);
  const [ghostMode, setGhostMode] = useState(false);
  const [reportOutput, setReportOutput] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const toggleCategory = (cat: string) =>
    setExpandedCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const toggleAbout = (idx: number) =>
    setExpandedAbout((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const modulesByCategory = MODULES.reduce<Record<ModuleCategory, ElionModule[]>>((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {} as Record<ModuleCategory, ElionModule[]>);

  const completedResults = results.filter((r) => r.status === "complete");

  const runModule = useCallback(async () => {
    if (!selectedModule || !query.trim()) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    const result: ModuleResult = {
      moduleId: selectedModule.id,
      moduleName: selectedModule.name,
      query: query.trim(),
      timestamp: new Date(),
      status: "running",
      output: "",
      artifacts: [],
    };

    setResults((prev) => [result, ...prev]);
    setActiveResult(result);

    try {
      const { data, error } = await supabase.functions.invoke("elion-execute", {
        body: {
          moduleId: selectedModule.id,
          moduleName: selectedModule.name,
          category: selectedModule.category,
          query: query.trim(),
          ghostMode,
        },
      });

      if (error) throw error;

      const updated: ModuleResult = {
        ...result,
        status: "complete",
        output: data.output || "No output returned.",
        artifacts: data.artifacts || [],
      };
      setResults((prev) => prev.map((r) => (r.timestamp === result.timestamp ? updated : r)));
      setActiveResult(updated);
    } catch (e: any) {
      const errResult: ModuleResult = {
        ...result,
        status: "error",
        output: `Error: ${e.message || "Module execution failed"}`,
      };
      setResults((prev) => prev.map((r) => (r.timestamp === result.timestamp ? errResult : r)));
      setActiveResult(errResult);
    }
  }, [selectedModule, query, ghostMode]);

  const generateReport = useCallback(async () => {
    if (completedResults.length === 0) return;
    setReportLoading(true);
    setReportOutput("");
    setActiveTab("report");

    try {
      const summaryContext = completedResults.map((r) =>
        `MODULE: ${r.moduleName}\nTARGET: ${r.query}\nFINDINGS:\n${r.output}`
      ).join("\n\n---\n\n");

      const { data, error } = await supabase.functions.invoke("elion-execute", {
        body: {
          moduleId: "summary-report",
          moduleName: "Intelligence Report",
          category: "summary",
          query: summaryContext,
          ghostMode,
        },
      });

      if (error) throw error;
      setReportOutput(data.output || "No report generated.");
    } catch (e: any) {
      setReportOutput(`Error generating report: ${e.message}`);
    } finally {
      setReportLoading(false);
    }
  }, [completedResults, ghostMode]);

  const copyOutput = (text: string) => navigator.clipboard.writeText(text);
  const downloadOutput = (result: ModuleResult) => {
    const blob = new Blob([result.output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `elion-${result.moduleId}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const downloadReport = () => {
    const blob = new Blob([reportOutput], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aureon-intelligence-report-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Module Browser ── */}
      <div className="w-72 flex-shrink-0 border-r border-border/20 flex flex-col bg-card/10">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-border/20">
          <div className="flex items-center gap-2 mb-1">
            <Terminal className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-extralight tracking-[0.2em] text-foreground">ELION</h2>
            <span className="text-[9px] font-light tracking-widest text-muted-foreground/50 border border-border/20 rounded px-1">ZOHAR v2.0</span>
          </div>
          <p className="text-[10px] font-light text-muted-foreground/50">Forensic OSINT Toolkit</p>
        </div>

        {/* Tab Nav */}
        <div className="flex-shrink-0 flex border-b border-border/20">
          {([
            { id: "modules", label: "Modules", icon: Terminal },
            { id: "report", label: "Report", icon: FileText },
            { id: "about", label: "About", icon: Info },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-light tracking-wider transition-colors ${
                activeTab === id
                  ? "text-accent border-b-2 border-accent"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        {/* Ghost Mode Toggle */}
        <div className="flex-shrink-0 px-3 py-2 border-b border-border/20">
          <button
            onClick={() => setGhostMode(!ghostMode)}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-light transition-all ${
              ghostMode
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground border border-transparent"
            }`}
          >
            {ghostMode ? <Unlock className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5" />}
            Ghost Mode {ghostMode ? "ACTIVE" : "OFF"}
            <div className={`ml-auto h-1.5 w-1.5 rounded-full ${ghostMode ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/30"}`} />
          </button>
        </div>

        {/* Sidebar Content */}
        {activeTab === "modules" && (
          <>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-2 space-y-1">
                {(Object.keys(CATEGORY_META) as ModuleCategory[]).map((cat) => {
                  const meta = CATEGORY_META[cat];
                  const Icon = meta.icon;
                  const modules = modulesByCategory[cat] || [];
                  const expanded = expandedCategories[cat];

                  return (
                    <div key={cat}>
                      <button
                        onClick={() => toggleCategory(cat)}
                        className="flex w-full items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-medium tracking-[0.15em] text-muted-foreground/60 hover:text-muted-foreground transition-colors uppercase"
                      >
                        <Icon className={`h-3 w-3 ${meta.color}`} />
                        {meta.label}
                        <span className="ml-auto text-[9px] bg-foreground/5 px-1.5 py-0.5 rounded">{modules.length}</span>
                        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>

                      {expanded && (
                        <div className="space-y-0.5 mb-1">
                          {modules.map((mod) => {
                            const ModIcon = mod.icon;
                            const isActive = selectedModule?.id === mod.id && activeTab === "modules";
                            const hasResult = results.find((r) => r.moduleId === mod.id && r.status === "complete");
                            return (
                              <button
                                key={mod.id}
                                onClick={() => { setSelectedModule(mod); setQuery(""); setActiveTab("modules"); }}
                                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-light transition-all text-left ${
                                  isActive
                                    ? "bg-accent/15 text-accent border border-accent/20"
                                    : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                                }`}
                              >
                                <ModIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                <span className="flex-1 truncate">{mod.name}</span>
                                {hasResult && <CheckCircle2 className="h-3 w-3 text-emerald-500/60 flex-shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Stats + Generate Report */}
            <div className="flex-shrink-0 p-3 border-t border-border/20 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-foreground/5 px-2 py-1.5 text-center">
                  <p className="text-[10px] text-muted-foreground/50">Modules</p>
                  <p className="text-sm font-light text-foreground">{MODULES.length}</p>
                </div>
                <div className="rounded-lg bg-foreground/5 px-2 py-1.5 text-center">
                  <p className="text-[10px] text-muted-foreground/50">Executed</p>
                  <p className="text-sm font-light text-foreground">{completedResults.length}</p>
                </div>
              </div>
              {completedResults.length > 0 && (
                <button
                  onClick={generateReport}
                  disabled={reportLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent/15 border border-accent/25 px-3 py-2 text-xs font-light text-accent hover:bg-accent/25 transition-all disabled:opacity-50"
                >
                  {reportLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  Generate Intelligence Report
                </button>
              )}
            </div>
          </>
        )}

        {activeTab === "report" && (
          <div className="flex-1 flex flex-col overflow-hidden p-3">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-3.5 w-3.5 text-accent" />
              <span className="text-[10px] font-light tracking-wider text-muted-foreground/70 uppercase">Aureon Report</span>
            </div>
            {completedResults.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 px-2">
                <FileText className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-[10px] text-muted-foreground/40 leading-relaxed">Run at least one module to generate an intelligence report</p>
              </div>
            ) : (
              <>
                <p className="text-[10px] text-muted-foreground/50 mb-3 leading-relaxed">
                  {completedResults.length} module{completedResults.length !== 1 ? "s" : ""} completed. Generate a synthesized Aureon intelligence brief.
                </p>
                <div className="space-y-1 mb-3">
                  {completedResults.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg bg-foreground/5 px-2.5 py-1.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500/70 flex-shrink-0" />
                      <span className="text-[10px] text-foreground/70 truncate">{r.moduleName}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={generateReport}
                  disabled={reportLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent/15 border border-accent/25 px-3 py-2.5 text-xs font-light text-accent hover:bg-accent/25 transition-all disabled:opacity-50"
                >
                  {reportLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                  {reportLoading ? "Generating..." : "Generate Report"}
                </button>
              </>
            )}
          </div>
        )}

        {activeTab === "about" && (
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 space-y-1">
              {ABOUT_SECTIONS.map((section, idx) => {
                const Icon = section.icon;
                const isOpen = expandedAbout[idx];
                return (
                  <div key={idx} className="rounded-xl border border-border/20 overflow-hidden">
                    <button
                      onClick={() => toggleAbout(idx)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-foreground/5 transition-colors"
                    >
                      <Icon className="h-3.5 w-3.5 text-accent flex-shrink-0" />
                      <span className="flex-1 text-[11px] font-light text-foreground">{section.title}</span>
                      {isOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground/40" /> : <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 border-t border-border/10">
                        <div className="pt-2 prose prose-sm prose-invert max-w-none">
                          <ReactMarkdown
                            components={{
                              p: ({ children }) => <p className="text-[10px] font-light text-muted-foreground leading-relaxed mb-2 last:mb-0">{children}</p>,
                              strong: ({ children }) => <strong className="text-foreground font-normal">{children}</strong>,
                            }}
                          >
                            {section.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* ── Main Workspace ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">

        {/* ── Intelligence Report Tab ── */}
        {activeTab === "report" && (
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            {/* Report Header */}
            <div className="flex-shrink-0 px-6 py-4 border-b border-border/20 bg-card/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-border/20 bg-card/40 p-2.5">
                    <FileText className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-extralight tracking-wide text-foreground">Intelligence Report</h2>
                      <span className="text-[9px] tracking-widest uppercase border rounded px-1.5 py-0.5 text-accent border-accent/20">
                        Aureon Authored
                      </span>
                    </div>
                    <p className="text-xs font-light text-muted-foreground mt-0.5">
                      Synthesized brief across {completedResults.length} completed module{completedResults.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                {reportOutput && !reportLoading && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => copyOutput(reportOutput)}
                      className="p-2 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors"
                      title="Copy report"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      onClick={downloadReport}
                      className="p-2 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors"
                      title="Download report"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-6">
                {reportLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="relative">
                      <Terminal className="h-10 w-10 text-accent/30" />
                      <Loader2 className="h-4 w-4 text-accent animate-spin absolute -bottom-1 -right-1" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-extralight text-foreground">Aureon is compiling your intelligence report</p>
                      <p className="text-xs text-muted-foreground/50">Synthesizing {completedResults.length} module outputs...</p>
                    </div>
                  </div>
                ) : reportOutput ? (
                  <div className="max-w-3xl mx-auto">
                    {/* Report watermark header */}
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border/20">
                      <div className="flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-accent" />
                        <span className="text-xs font-extralight tracking-[0.2em] text-accent">ELION / ZOHAR</span>
                      </div>
                      <span className="text-muted-foreground/20">|</span>
                      <span className="text-[10px] text-muted-foreground/40 font-light tracking-wider">AUREON INTELLIGENCE BRIEF</span>
                      <span className="ml-auto text-[10px] text-muted-foreground/30">{new Date().toLocaleString()}</span>
                    </div>

                    {/* Report Content */}
                    <div className="prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown
                        components={{
                          h1: ({ children }) => <h1 className="text-xl font-extralight tracking-wide text-foreground mt-6 mb-3 first:mt-0">{children}</h1>,
                          h2: ({ children }) => <h2 className="text-base font-extralight tracking-wide text-foreground mt-5 mb-2 flex items-center gap-2">
                            <span className="h-px flex-1 bg-border/20" />
                            <span>{children}</span>
                            <span className="h-px flex-1 bg-border/20" />
                          </h2>,
                          h3: ({ children }) => <h3 className="text-sm font-light text-foreground/90 mt-4 mb-1.5">{children}</h3>,
                          p: ({ children }) => <p className="text-sm font-light text-muted-foreground leading-relaxed mb-3">{children}</p>,
                          strong: ({ children }) => <strong className="text-foreground font-normal">{children}</strong>,
                          ul: ({ children }) => <ul className="space-y-1 mb-3 pl-4">{children}</ul>,
                          li: ({ children }) => <li className="text-sm font-light text-muted-foreground flex items-start gap-2 before:content-['▸'] before:text-accent/50 before:text-xs before:mt-0.5 before:flex-shrink-0">{children}</li>,
                          code: ({ children }) => <code className="text-xs font-mono text-accent/80 bg-accent/10 px-1.5 py-0.5 rounded">{children}</code>,
                          blockquote: ({ children }) => <blockquote className="border-l-2 border-accent/30 pl-4 italic text-muted-foreground/70">{children}</blockquote>,
                          hr: () => <hr className="border-border/20 my-4" />,
                        }}
                      >
                        {reportOutput}
                      </ReactMarkdown>
                    </div>

                    {/* Report Footer */}
                    <div className="mt-8 pt-4 border-t border-border/20 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground/30">Generated by Aureon</span>
                        <span className="text-muted-foreground/20">·</span>
                        <span className="text-[10px] text-muted-foreground/30">Elion / Zohar v2.0</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/30 uppercase tracking-wider">
                        {ghostMode ? "GHOST MODE ACTIVE" : "STANDARD MODE"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
                    <div className="rounded-2xl border border-border/20 bg-card/20 p-6 max-w-sm">
                      <FileText className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-sm font-extralight text-muted-foreground mb-1">No report generated yet</p>
                      <p className="text-xs text-muted-foreground/40 leading-relaxed">
                        Run modules from the Modules tab, then generate a unified Aureon intelligence brief from all completed findings.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* ── About Tab Main Content ── */}
        {activeTab === "about" && (
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div className="flex-shrink-0 px-6 py-5 border-b border-border/20 bg-card/10">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-border/20 bg-card/40 p-2.5">
                  <BookOpen className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-base font-extralight tracking-wide text-foreground">About Elion / Zohar</h2>
                  <p className="text-xs font-light text-muted-foreground mt-0.5">Forensic OSINT Intelligence Platform — Aureon Pro & Advisor</p>
                </div>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-6 max-w-3xl mx-auto space-y-5">
                {/* Hero stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "OSINT Modules", value: "27", color: "text-accent" },
                    { label: "DeepDive Phases", value: "20", color: "text-blue-400" },
                    { label: "Intel Categories", value: "5", color: "text-violet-400" },
                    { label: "Access Tier", value: "Pro+", color: "text-emerald-400" },
                  ].map((stat) => (
                    <div key={stat.label} className="rounded-xl border border-border/20 bg-card/20 p-4 text-center">
                      <p className={`text-2xl font-extralight ${stat.color}`}>{stat.value}</p>
                      <p className="text-[10px] text-muted-foreground/50 mt-1 tracking-wider">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Module category breakdown */}
                <div className="rounded-2xl border border-border/20 bg-card/15 p-5">
                  <h3 className="text-sm font-extralight tracking-wider text-foreground mb-4 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-accent" />
                    Module Categories
                  </h3>
                  <div className="space-y-2">
                    {(Object.keys(CATEGORY_META) as ModuleCategory[]).map((cat) => {
                      const meta = CATEGORY_META[cat];
                      const Icon = meta.icon;
                      const count = (modulesByCategory[cat] || []).length;
                      return (
                        <div key={cat} className="flex items-center gap-3 rounded-lg bg-foreground/5 px-3 py-2.5">
                          <Icon className={`h-4 w-4 ${meta.color} flex-shrink-0`} />
                          <span className="flex-1 text-xs font-light text-foreground">{meta.label}</span>
                          <span className="text-[10px] text-muted-foreground/50 bg-foreground/5 rounded px-1.5 py-0.5">{count} modules</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* What Elion can do cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: User, title: "Identity Intelligence", desc: "Breach detection, dossier building, and cross-platform entity resolution for any target identity.", color: "text-blue-400" },
                    { icon: Globe, title: "Infrastructure Recon", desc: "WHOIS, DNS, cloud storage enumeration, admin surface mapping, and API endpoint discovery.", color: "text-accent" },
                    { icon: GitBranch, title: "Orchestrated Operations", desc: "HiveMind coordinates multi-phase operations, synthesizing all findings into unified threat intelligence.", color: "text-violet-400" },
                    { icon: Shield, title: "Ghost Mode OPSEC", desc: "Privacy-hardened analysis with anonymization pathway evaluation and behavioral detection bypass.", color: "text-emerald-400" },
                    { icon: Lock, title: "Cryptographic Analysis", desc: "Steganography detection, hash forensics, entropy measurement, and hidden data analysis.", color: "text-amber-400" },
                    { icon: FileText, title: "Aureon Intelligence Reports", desc: "AI-authored briefings that synthesize all module findings into executive-grade intelligence summaries.", color: "text-rose-400" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="rounded-xl border border-border/20 bg-card/15 p-4 space-y-2 hover:bg-card/25 transition-colors">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 ${item.color}`} />
                          <span className="text-sm font-light text-foreground">{item.title}</span>
                        </div>
                        <p className="text-[11px] font-light text-muted-foreground/70 leading-relaxed">{item.desc}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Access note */}
                <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 flex items-start gap-3">
                  <Info className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-light text-foreground mb-1">Pro & Advisor Access</p>
                    <p className="text-[11px] font-light text-muted-foreground/70 leading-relaxed">
                      Elion is available on Aureon Pro ($399/mo) and Advisor ($20,000/mo) plans. All intelligence operations are processed through Aureon's secure AI engine. No raw target data is retained beyond your session.
                    </p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        )}

        {/* ── Modules Tab Main Content ── */}
        {activeTab === "modules" && (
          <>
            {selectedModule ? (
              <>
                {/* Module Header */}
                <div className="flex-shrink-0 p-4 sm:p-6 border-b border-border/20 bg-card/10">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl border border-border/20 bg-card/40 p-2.5">
                      {(() => { const Icon = selectedModule.icon; return <Icon className="h-5 w-5 text-accent" />; })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-extralight tracking-wide text-foreground">{selectedModule.name}</h2>
                        <span className={`text-[9px] tracking-widest uppercase border rounded px-1.5 py-0.5 ${CATEGORY_META[selectedModule.category].color} border-current/20`}>
                          {CATEGORY_META[selectedModule.category].label}
                        </span>
                        {ghostMode && (
                          <span className="text-[9px] tracking-widest uppercase text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5">Ghost</span>
                        )}
                      </div>
                      <p className="text-xs font-light text-muted-foreground mt-0.5">{selectedModule.description}</p>
                    </div>
                  </div>

                  {/* Input */}
                  <div className="mt-4 flex gap-2">
                    <div className="flex-1 flex items-center gap-2 rounded-xl border border-border/30 bg-card/30 px-4 py-2.5 focus-within:border-accent/40 transition-colors">
                      <Search className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") runModule(); }}
                        placeholder={selectedModule.inputPlaceholder}
                        type={selectedModule.inputType === "email" ? "email" : "text"}
                        className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
                      />
                      {query && (
                        <button onClick={() => setQuery("")} className="p-0.5 text-muted-foreground/50 hover:text-foreground transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <button
                      onClick={runModule}
                      disabled={!query.trim() || results.some((r) => r.moduleId === selectedModule.id && r.status === "running")}
                      className="flex items-center gap-2 rounded-xl bg-accent/20 px-4 py-2.5 text-xs font-light text-accent hover:bg-accent/30 transition-colors disabled:opacity-40"
                    >
                      {results.some((r) => r.moduleId === selectedModule.id && r.status === "running") ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                      Execute
                    </button>
                  </div>
                </div>

                {/* Output Area */}
                <div className="flex flex-1 min-h-0 overflow-hidden">
                  {/* Active Result */}
                  <div className="flex-1 overflow-hidden flex flex-col">
                    {activeResult ? (
                      <>
                        {/* Result Header */}
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-2 border-b border-border/10 bg-card/5">
                          <div className="flex items-center gap-2">
                            {activeResult.status === "running" && <Loader2 className="h-3.5 w-3.5 text-accent animate-spin" />}
                            {activeResult.status === "complete" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                            {activeResult.status === "error" && <AlertTriangle className="h-3.5 w-3.5 text-red-400" />}
                            <span className="text-xs font-light text-muted-foreground truncate max-w-[200px]">
                              {activeResult.query}
                            </span>
                            <span className="text-[10px] text-muted-foreground/40">
                              {activeResult.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => copyOutput(activeResult.output)}
                              className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors"
                              title="Copy output"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => downloadOutput(activeResult)}
                              className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors"
                              title="Download as .txt"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <ScrollArea className="flex-1 min-h-0">
                          <div className="p-4">
                            {/* Artifacts */}
                            {activeResult.artifacts && activeResult.artifacts.length > 0 && (
                              <div className="mb-4 grid grid-cols-2 gap-2">
                                {activeResult.artifacts.map((a, i) => (
                                  <div key={i} className="rounded-xl border border-border/20 bg-card/20 p-3">
                                    <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-1">{a.label}</p>
                                    <p className="text-xs font-light text-foreground break-words">{a.value}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Main Output */}
                            <div className="rounded-xl border border-border/10 bg-card/10 p-4">
                              {activeResult.status === "running" ? (
                                <div className="flex items-center gap-3 text-muted-foreground">
                                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                                  <span className="text-xs font-light">Executing {activeResult.moduleName}...</span>
                                </div>
                              ) : (
                                <div className="prose prose-sm prose-invert max-w-none">
                                  <ReactMarkdown
                                    components={{
                                      h1: ({ children }) => <h1 className="text-base font-extralight text-foreground mt-4 mb-2 first:mt-0">{children}</h1>,
                                      h2: ({ children }) => <h2 className="text-sm font-light text-foreground mt-3 mb-1.5">{children}</h2>,
                                      h3: ({ children }) => <h3 className="text-xs font-light text-foreground/90 mt-2 mb-1">{children}</h3>,
                                      p: ({ children }) => <p className="text-xs font-light text-foreground/80 leading-relaxed mb-2">{children}</p>,
                                      strong: ({ children }) => <strong className="text-foreground font-normal">{children}</strong>,
                                      ul: ({ children }) => <ul className="space-y-1 mb-2 pl-3">{children}</ul>,
                                      li: ({ children }) => <li className="text-xs font-light text-foreground/80 flex items-start gap-1.5 before:content-['▸'] before:text-accent/50 before:text-[10px] before:mt-px before:flex-shrink-0">{children}</li>,
                                      code: ({ children }) => <code className="text-[11px] font-mono text-accent/80 bg-accent/10 px-1 py-0.5 rounded">{children}</code>,
                                      hr: () => <hr className="border-border/20 my-3" />,
                                    }}
                                  >
                                    {activeResult.output}
                                  </ReactMarkdown>
                                </div>
                              )}
                            </div>
                          </div>
                        </ScrollArea>
                      </>
                    ) : (
                      <div className="flex flex-1 items-center justify-center p-8 text-center">
                        <div className="space-y-3">
                          {(() => { const Icon = selectedModule.icon; return <Icon className="h-10 w-10 text-muted-foreground/20 mx-auto" />; })()}
                          <p className="text-sm font-extralight text-muted-foreground">Enter a target and press Execute to run {selectedModule.name}</p>
                          <p className="text-xs text-muted-foreground/50">{selectedModule.inputLabel}: {selectedModule.inputPlaceholder}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Run History */}
                  {results.length > 0 && (
                    <div className="w-56 flex-shrink-0 border-l border-border/20 flex flex-col bg-card/5">
                      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-border/10">
                        <span className="text-[10px] font-light tracking-wider text-muted-foreground/50 uppercase">Run History</span>
                        <button
                          onClick={() => { setResults([]); setActiveResult(null); setReportOutput(""); }}
                          className="text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      </div>
                      <ScrollArea className="flex-1 min-h-0">
                        <div className="p-2 space-y-1">
                          {results.map((r, i) => (
                            <button
                              key={i}
                              onClick={() => setActiveResult(r)}
                              className={`flex w-full flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                                activeResult?.timestamp === r.timestamp
                                  ? "bg-accent/10 border border-accent/20"
                                  : "hover:bg-foreground/5"
                              }`}
                            >
                              <div className="flex items-center gap-1.5">
                                {r.status === "running" && <Loader2 className="h-3 w-3 text-accent animate-spin" />}
                                {r.status === "complete" && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                                {r.status === "error" && <AlertTriangle className="h-3 w-3 text-red-400" />}
                                <span className="text-[10px] font-light text-foreground truncate">{r.moduleName}</span>
                              </div>
                              <span className="text-[9px] text-muted-foreground/40 truncate pl-4">{r.query}</span>
                            </button>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Welcome State */
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="max-w-lg space-y-6 animate-fade-in">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <Terminal className="h-8 w-8 text-accent" />
                    <h1 className="text-3xl font-extralight tracking-[0.2em] text-foreground">ELION</h1>
                  </div>
                  <p className="text-sm font-extralight text-muted-foreground leading-relaxed">
                    Forensic-grade OSINT toolkit — a web-native port of the Zohar Intelligence Framework.
                    Select a module to begin your investigation.
                  </p>

                  {/* Quick Launch Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-6">
                    {MODULES.slice(0, 6).map((mod) => {
                      const Icon = mod.icon;
                      return (
                        <button
                          key={mod.id}
                          onClick={() => setSelectedModule(mod)}
                          className="flex flex-col items-start gap-1.5 rounded-xl border border-border/20 bg-card/20 p-3 text-left hover:bg-card/40 hover:border-accent/30 transition-all group"
                        >
                          <Icon className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors" />
                          <span className="text-xs font-light text-foreground">{mod.name}</span>
                          <span className="text-[9px] text-muted-foreground/50">{CATEGORY_META[mod.category].label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Shortcut hints */}
                  <div className="flex items-center justify-center gap-4 pt-2">
                    <button
                      onClick={() => setActiveTab("about")}
                      className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                    >
                      <Info className="h-3 w-3" />
                      Learn about Elion
                    </button>
                    <span className="text-muted-foreground/20">·</span>
                    <span className="text-[10px] text-muted-foreground/30">
                      {MODULES.length} modules · {Object.keys(CATEGORY_META).length} categories
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ElionView;
