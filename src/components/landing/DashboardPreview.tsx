import { useState, useRef, useCallback } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Zap, Globe, Terminal, Brain, Newspaper, Crosshair, Database, Activity,
  FileText, Code2, Layers, Sparkles, Users, MessagesSquare, FolderOpen,
  ShieldCheck, Puzzle, ClipboardList, BarChart3, CreditCard, Settings,
  MapPin, Plus, MessageSquare, Menu, Send, Bot, Search,
  Eye, Beaker, Heart, Factory, Shield, Lock, ArrowRight,
  Upload, Table2, Share2, GitBranch, Workflow, LayoutDashboard,
  Lightbulb, BookOpen, FileOutput, Fingerprint, FlaskConical,
  GitCommitHorizontal, Target, User, Building2, AtSign, Phone,
  Image, TrendingUp, Network, Clock, ShieldAlert, ShieldX, Bug,
  Radio, Skull, Server, Loader2, RefreshCw, AlertTriangle,
  Copy, Check, Download, Keyboard, X, Moon,
} from "lucide-react";

/* ── Nav structure matching real DashboardSidebar ── */
interface NavItem { id: string; icon: React.ElementType; label: string; pro?: boolean; desc: string }
interface NavGroup { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Intelligence",
    items: [
      { id: "search", icon: Zap, label: "Zophiel Engine", desc: "30-source OSINT search engine with Veracity Scores and cross-validation across the open and dark web." },
      { id: "briefing", icon: Newspaper, label: "Intel Briefings", desc: "Daily truth-extracted intelligence briefings synthesized from live sources, with triple-fallback parsing." },
      { id: "nomad", icon: Crosshair, label: "NOMAD Agent", desc: "Autonomous OSINT agent running 14-pass deep analysis with persistent dossier trees." },
      { id: "video", icon: Crosshair, label: "Video Intelligence", pro: true, desc: "FACS-based behavioral video tracking, micro-expression detection, and frame-by-frame locus mapping." },
      { id: "reverse", icon: Search, label: "Reverse Engineer", desc: "Architecture deconstruction from images, video, and binaries — see the blueprint behind any system." },
      { id: "zahten", icon: Workflow, label: "Zahten Agent Forge", desc: "Build hardened autonomous agents with a Mission Console, Scope Assessor, and multi-channel delivery." },
    ],
  },
  {
    label: "Data & Analysis",
    items: [
      { id: "azplen", icon: Database, label: "Azplen Intelligence", pro: true, desc: "20-tab data foundry with the asha_ schema for ingest, lineage, entities, and predictions." },
      { id: "pattern", icon: Activity, label: "Pattern Engine", pro: true, desc: "Pro-tier forecasting with fractal pattern discovery and Recharts visualizations." },
      { id: "cross", icon: Crosshair, label: "Cross", pro: true, desc: "17 analytical modes with WebM screen recording, trading strategies, and 5-level hierarchy." },
      { id: "zeeion", icon: Database, label: "Zeeion FI", pro: true, desc: "Live financial forensics with 10-state lifecycle, trustless arbitration, and workforce analytics." },
      { id: "axrlen", icon: Brain, label: "Axrlen", pro: true, desc: "Nexus Prime engine — predictive probabilistic scenarios with multi-side research." },
      { id: "zerlal", icon: Shield, label: "Zerlal", pro: true, desc: "Vulnerability scanning, Cyber Kill Chain, blast radius and takedown feasibility analysis." },
      { id: "timeseries", icon: Activity, label: "Time-Series", pro: true, desc: "Temporal analysis and anomaly detection across event streams." },
      { id: "geo", icon: Globe, label: "Geospatial", pro: true, desc: "Map-driven intelligence with locus correlation and movement reconstruction." },
      { id: "notebooks", icon: FileText, label: "Notebooks", pro: true, desc: "Intelligence notebooks with SQL execution, 800ms debounce, and SECURITY DEFINER queries." },
    ],
  },
  {
    label: "Creation",
    items: [
      { id: "zali", icon: Zap, label: "ZANOEM Design Lab", desc: "FEA / thermal simulation with material and assembly generation for engineering-grade design." },
      { id: "ide", icon: Terminal, label: "ASHERIN IDE", desc: "In-dashboard Monaco IDE with BYOK across 9 providers and a sandboxed iframe for published tabs." },
      { id: "i2c", icon: Code2, label: "Imagine To Code", desc: "Convert sketches, screenshots, and mockups directly into working component code." },
      { id: "snippets", icon: Code2, label: "Code Snippets", desc: "Encrypted vault for reusable code blocks, scripts, and prompts." },
      { id: "projects", icon: Layers, label: "Projects", desc: "Project workspaces with file management, ide_sessions, and constraint tracking." },
      { id: "vibe-img", icon: Sparkles, label: "Vibe Imager", desc: "Generate on-brand imagery with style locking and prompt sanitization." },
      { id: "pdf", icon: FileText, label: "PDF Generator", desc: "Forensic-grade PDF reports with intelligence officer formatting and tables." },
      { id: "ebook", icon: FileText, label: "E-Book Generator", desc: "Multi-session text uploads, 500 words/chapter, and PNG cover generation." },
      { id: "slideshow", icon: Layers, label: "Slideshow Generator", desc: "Auto-build presentation decks with consistent theme and dense data layouts." },
      { id: "file-scrapper", icon: FileText, label: "File Scrapper", desc: "Extract unstructured documents to clean TXT via Gemini Flash." },
      { id: "cipher", icon: Shield, label: "Cipher Toolkit", desc: "AES-256-GCM encryption, hashing, and key management utilities." },
    ],
  },
  {
    label: "Workspace",
    items: [
      { id: "teams", icon: Users, label: "Team Workspace", pro: true, desc: "RBAC workspaces with collaborative case files and role-scoped access." },
      { id: "community", icon: MessagesSquare, label: "Community", pro: true, desc: "Operator-only forum for shared intelligence, playbooks, and tradecraft." },
      { id: "library", icon: FolderOpen, label: "Library", desc: "Project Folders, Library, and Intelligence Graph for centralized knowledge." },
      { id: "memory", icon: Brain, label: "Memory Center", desc: "Persistent memory across sessions with offline-first IndexedDB sync." },
    ],
  },
  {
    label: "System",
    items: [
      { id: "agents", icon: Zap, label: "Agents", pro: true, desc: "Scheduled tasks with multi-channel webhook delivery and retry logic." },
      { id: "security", icon: ShieldCheck, label: "Security Center", pro: true, desc: "Centralized security command with RLS partitions and policy auditing." },
      { id: "guardian-vault", icon: Lock, label: "Guardian Vault", desc: "TOTP MFA auto-cleanup, encrypted secrets, and chrooted file storage." },
      { id: "plugins", icon: Puzzle, label: "Plugins", pro: true, desc: "Live plugin marketplace with an execution engine for 3rd party integrations." },
      { id: "audit", icon: ClipboardList, label: "Audit Trail", pro: true, desc: "Tamper-evident logs of every action with non-repudiation hashes." },
      { id: "self-access", icon: FileText, label: "Self-Access Learning", desc: "Personal learning hub tracking your usage patterns and skill gaps." },
      { id: "bug-reports", icon: ClipboardList, label: "Bug Reports", desc: "Private RLS portal with AI summarization for the admin." },
      { id: "stats", icon: BarChart3, label: "My Stats", desc: "Personal analytics — credits, runs, and module-level usage breakdown." },
      { id: "vedic-astrology", icon: Moon, label: "Vedic Astrology", desc: "Vedic strategy module — chart-based timing analysis for decisions." },
      { id: "subscription", icon: CreditCard, label: "Subscription", desc: "Manage Chat, Asherin, Pro, or Lifetime tier and billing." },
      { id: "settings", icon: Settings, label: "Settings", desc: "Workspace preferences, BYOK provider keys, and security controls." },
    ],
  },
];


/* ════════════════════════════════════════════════════════════
   FAITHFUL MOCK VIEWS — replicating actual dashboard UIs
   ════════════════════════════════════════════════════════════ */

function ChatMock() {
  return (
    <div className="flex flex-col h-full">
      {/* Mode tabs like real ChatView */}
      <div className="flex items-center gap-1.5 px-1 pb-3 border-b border-border/10">
        {["Chat", "Research", "Code", "Truth"].map((m, i) => (
          <button key={m} className={`rounded-lg px-3 py-1 text-[10px] font-light transition-colors ${i === 2 ? "bg-foreground/10 text-foreground" : "text-muted-foreground/50 hover:text-foreground"}`}>{m}</button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[9px] text-muted-foreground/30">Depth:</span>
          {["Concise", "Standard", "Deep"].map((d, i) => (
            <button key={d} className={`rounded px-1.5 py-0.5 text-[9px] ${i === 1 ? "bg-foreground/10 text-foreground" : "text-muted-foreground/30"}`}>{d}</button>
          ))}
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4">
        <div className="ml-auto max-w-[85%] rounded-2xl bg-foreground/10 px-4 py-3 text-[11px] font-extralight text-foreground">
          Analyze the architectural flaws in this React codebase.
        </div>
        <div className="max-w-[92%] rounded-2xl border border-border/10 bg-card/30 px-4 py-3 text-[10px] font-extralight text-foreground/80 space-y-1.5">
          <p className="font-light text-foreground text-[11px]">Phase 1: Scout — Context Mapping</p>
          <p className="text-muted-foreground/70 ml-2">Monolithic state pattern detected in root component. All conversation data, UI state, and streaming logic colocated in 500+ line file.</p>
          <p className="font-light text-foreground text-[11px] mt-2">Phase 2: Bug Hunt</p>
          <p className="text-muted-foreground/70 ml-2">• <span className="text-red-400/70">BUG</span>: Stale closure in `sendMessage` — references old state</p>
          <p className="text-muted-foreground/70 ml-2">• <span className="text-red-400/70">BUG</span>: Missing cleanup on `AbortController` in unmount</p>
          <p className="text-muted-foreground/70 ml-2">• <span className="text-amber-400/70">WARN</span>: `trackUsage` fires before message is persisted</p>
          <p className="font-light text-foreground text-[11px] mt-2">Phase 3: Structural Audit</p>
          <p className="text-muted-foreground/70 ml-2">Separation of concerns violation. Extract a `useChatEngine` hook.</p>
          {/* Actions bar */}
          <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border/10">
            <button className="flex items-center gap-1 text-[9px] text-muted-foreground/40"><Copy className="h-2.5 w-2.5" /> Copy</button>
            <button className="flex items-center gap-1 text-[9px] text-muted-foreground/40"><Download className="h-2.5 w-2.5" /> Export</button>
            <div className="ml-auto flex items-center gap-1">
              <span className="text-[9px] text-muted-foreground/30">Truth:</span>
              <span className="text-[9px] text-emerald-500/70">HIGH</span>
            </div>
          </div>
        </div>
        {/* Typing indicator */}
        <div className="max-w-[92%] rounded-2xl border border-border/10 bg-card/30 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-pulse" />
            <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-pulse" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-pulse" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ZophielMock() {
  return (
    <div className="flex flex-col h-full">
      {/* Mode selector like real Zophiel */}
      <div className="flex items-center gap-1 px-1 pb-3 border-b border-border/10">
        {["Web", "News", "Academic", "Code", "Images", "Deep"].map((m, i) => (
          <button key={m} className={`rounded-lg px-2.5 py-1 text-[10px] font-light ${i === 0 ? "bg-foreground/10 text-foreground" : "text-muted-foreground/40"}`}>{m}</button>
        ))}
      </div>
      {/* Search bar */}
      <div className="py-4 flex flex-col items-center">
        <div className="flex items-center gap-2 text-amber-400/70 mb-4">
          <Zap className="h-5 w-5" />
          <span className="text-sm font-extralight tracking-[0.2em]">ZOPHIEL</span>
        </div>
        <div className="w-full max-w-md flex items-center gap-2 rounded-2xl border border-border/20 bg-card/20 px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground/40" />
          <span className="text-[11px] text-muted-foreground/40 flex-1">Search the web…</span>
          <div className="rounded-xl bg-accent/20 px-3 py-1 text-[10px] text-accent">
            <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </div>
        {/* Recent searches */}
        <div className="mt-4 w-full max-w-md">
          <span className="text-[9px] font-light tracking-wider text-muted-foreground/40 uppercase">Recent</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {["quantum computing breakthroughs", "AI regulation EU 2026", "React server components"].map(s => (
              <div key={s} className="inline-flex items-center gap-1 rounded-lg border border-border/20 bg-card/20 px-2.5 py-1 text-[10px] font-light text-muted-foreground/50">
                <Clock className="h-2.5 w-2.5" />{s}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 text-center">
          <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground/25"><Keyboard className="h-2.5 w-2.5" /> Press ? for shortcuts</span>
        </div>
      </div>
    </div>
  );
}

function AzplenMock() {
  const azplenTabs = [
    { icon: Upload, label: "Ingest" }, { icon: FileText, label: "Doc Intel" },
    { icon: BookOpen, label: "Catalog" }, { icon: Table2, label: "Table" },
    { icon: Share2, label: "Graph" }, { icon: Fingerprint, label: "Entities" },
    { icon: GitCommitHorizontal, label: "Lineage" }, { icon: GitBranch, label: "Branches" },
    { icon: Workflow, label: "Workflows" }, { icon: FlaskConical, label: "Scenarios" },
    { icon: Target, label: "Threats" }, { icon: LayoutDashboard, label: "Dashboards" },
    { icon: Lightbulb, label: "Insights" }, { icon: Activity, label: "Monitoring" },
    { icon: FileOutput, label: "Reports" }, { icon: Globe, label: "Web Intel" },
    { icon: FolderOpen, label: "Files" }, { icon: Brain, label: "Predictions" },
    { icon: MessageSquare, label: "Ask Azplen" },
  ];
  return (
    <div className="flex flex-col h-full">
      {/* Session selector */}
      <div className="flex items-center gap-2 pb-2 border-b border-border/10">
        <Building2 className="h-3 w-3 text-cyan-400/70" />
        <span className="text-[10px] font-light text-foreground">Acme Corp</span>
        <span className="text-[9px] text-muted-foreground/30 ml-1">Session</span>
        <Plus className="h-3 w-3 ml-auto text-muted-foreground/30" />
      </div>
      {/* Tab ribbon */}
      <div className="flex flex-wrap gap-0.5 py-2 border-b border-border/10">
        {azplenTabs.map((t, i) => (
          <button key={t.label} className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[8px] ${i === 0 ? "bg-foreground/10 text-foreground" : "text-muted-foreground/40"}`}>
            <t.icon className="h-2.5 w-2.5" />{t.label}
          </button>
        ))}
      </div>
      {/* Ingest panel content */}
      <div className="flex-1 py-3 space-y-3">
        <div className="rounded-xl border-2 border-dashed border-border/20 bg-card/10 p-6 text-center">
          <Upload className="h-6 w-6 mx-auto text-muted-foreground/20 mb-2" />
          <p className="text-[10px] text-muted-foreground/40">Drop CSV, Excel, JSON, Parquet files here</p>
          <p className="text-[9px] text-muted-foreground/25 mt-1">or click to browse • Max 50MB</p>
        </div>
        <div className="space-y-1.5">
          <p className="text-[9px] font-light text-muted-foreground/40 uppercase tracking-wider">Recent Datasets</p>
          {[{ n: "sales_q4_2025.csv", r: "12,847 rows", q: 94 }, { n: "user_events.parquet", r: "1.2M rows", q: 87 }, { n: "market_data.json", r: "3,200 rows", q: 91 }].map(d => (
            <div key={d.n} className="flex items-center gap-2 rounded-lg border border-border/10 bg-card/20 px-3 py-2">
              <Database className="h-3 w-3 text-cyan-400/50 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-light text-foreground truncate">{d.n}</p>
                <p className="text-[9px] text-muted-foreground/40">{d.r}</p>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-1 w-8 rounded-full bg-foreground/5 overflow-hidden">
                  <div className="h-full bg-emerald-500/40 rounded-full" style={{ width: `${d.q}%` }} />
                </div>
                <span className="text-[8px] text-muted-foreground/30">{d.q}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NomadMock() {
  const types = [
    { icon: User, label: "Person", desc: "Deep profile" },
    { icon: Building2, label: "Company", desc: "Truth Graph" },
    { icon: Globe, label: "Domain", desc: "Infra forensics" },
    { icon: AtSign, label: "Email", desc: "Breach fusion" },
    { icon: Fingerprint, label: "Username", desc: "Cross-platform" },
    { icon: MapPin, label: "Address", desc: "Ownership" },
    { icon: Phone, label: "Phone", desc: "Reverse lookup" },
    { icon: TrendingUp, label: "Predictive", desc: "Trajectories" },
  ];
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 pb-3 border-b border-border/10">
        <Crosshair className="h-4 w-4 text-red-400/70" />
        <span className="text-xs font-light tracking-wider text-foreground">NOMAD AGENT</span>
        <div className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground/30">
          <Clock className="h-2.5 w-2.5" /> History
        </div>
      </div>
      {/* Investigation types */}
      <div className="grid grid-cols-4 gap-1.5 py-3">
        {types.map((t, i) => (
          <button key={t.label} className={`flex flex-col items-center gap-1 rounded-lg p-2 text-center transition-colors ${i === 0 ? "bg-foreground/10 border border-border/20" : "hover:bg-foreground/5"}`}>
            <t.icon className={`h-3.5 w-3.5 ${i === 0 ? "text-foreground" : "text-muted-foreground/40"}`} />
            <span className={`text-[9px] ${i === 0 ? "text-foreground" : "text-muted-foreground/40"}`}>{t.label}</span>
          </button>
        ))}
      </div>
      {/* Chat with investigation */}
      <div className="flex-1 overflow-y-auto space-y-3 py-2">
        <div className="ml-auto max-w-[85%] rounded-2xl bg-foreground/10 px-3 py-2 text-[10px] font-extralight text-foreground">
          Investigate Elon Musk's recent corporate filings
        </div>
        <div className="max-w-[92%] rounded-2xl border border-border/10 bg-card/30 px-3 py-2 text-[10px] space-y-1.5">
          <p className="font-light text-foreground">NOMAD Investigation Report</p>
          <p className="text-muted-foreground/60 text-[9px]">Sources: SEC EDGAR, ProPublica, FEC, GitHub, DuckDuckGo</p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {["organization", "money", "url", "email"].map(t => (
              <span key={t} className="rounded px-1.5 py-0.5 bg-red-400/10 text-[8px] text-red-400/60">{t}</span>
            ))}
          </div>
          <p className="text-muted-foreground/60 text-[9px] mt-1">14 entities extracted • Confidence: 87%</p>
        </div>
      </div>
    </div>
  );
}

function BriefingMock() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-border/10">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-amber-400/70" />
          <span className="text-xs font-light tracking-wider text-foreground">INTEL BRIEFINGS</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="rounded-lg bg-foreground/5 px-2 py-1 text-[9px] text-muted-foreground/40 flex items-center gap-1">
            <RefreshCw className="h-2.5 w-2.5" /> Generate
          </button>
          <button className="rounded-lg bg-foreground/5 px-2 py-1 text-[9px] text-muted-foreground/40 flex items-center gap-1">
            <Settings className="h-2.5 w-2.5" /> Setup
          </button>
        </div>
      </div>
      <div className="flex-1 py-3 space-y-2">
        {[
          { title: "Morning Intelligence Brief — Mar 8, 2026", critical: 3, sig: 7, mon: 12, time: "6:00 AM" },
          { title: "Evening Intelligence Brief — Mar 7, 2026", critical: 1, sig: 4, mon: 8, time: "6:00 PM" },
          { title: "Morning Intelligence Brief — Mar 7, 2026", critical: 2, sig: 5, mon: 10, time: "6:00 AM" },
        ].map(r => (
          <div key={r.title} className="rounded-xl border border-border/10 bg-card/20 p-3 hover:bg-card/30 transition-colors cursor-default">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-light text-foreground">{r.title}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-[9px] text-red-400/70"><AlertTriangle className="h-2.5 w-2.5" /> {r.critical} Critical</span>
                  <span className="flex items-center gap-1 text-[9px] text-amber-400/70">{r.sig} Significant</span>
                  <span className="flex items-center gap-1 text-[9px] text-muted-foreground/40">{r.mon} Monitoring</span>
                </div>
              </div>
              <span className="text-[9px] text-muted-foreground/30">{r.time}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SecurityMock() {
  const systems = [
    { name: "Web Application Firewall", icon: Shield, color: "text-blue-400" },
    { name: "Intrusion Detection", icon: Eye, color: "text-purple-400" },
    { name: "Incident Response", icon: Zap, color: "text-amber-400" },
    { name: "Honeypot Traps", icon: Bug, color: "text-red-400" },
    { name: "Behavior Analytics", icon: Target, color: "text-pink-400" },
    { name: "Threat Intel", icon: Skull, color: "text-orange-400" },
  ];
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-border/10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400/70" />
          <span className="text-xs font-light tracking-wider text-foreground">SECURITY CENTER</span>
        </div>
        <div className="flex items-center gap-1">
          {["Overview", "Events", "Threats", "Honeypots", "Incidents"].map((t, i) => (
            <button key={t} className={`rounded px-2 py-0.5 text-[9px] ${i === 0 ? "bg-foreground/10 text-foreground" : "text-muted-foreground/30"}`}>{t}</button>
          ))}
        </div>
      </div>
      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 py-3">
        {[
          { l: "Events (24h)", v: "2,847", c: "text-foreground" },
          { l: "Critical", v: "12", c: "text-red-400" },
          { l: "Blocked", v: "1,203", c: "text-emerald-400" },
          { l: "Threat Score", v: "23", c: "text-amber-400" },
        ].map(s => (
          <div key={s.l} className="rounded-lg border border-border/10 bg-card/20 p-2 text-center">
            <p className={`text-lg font-extralight ${s.c}`}>{s.v}</p>
            <p className="text-[8px] text-muted-foreground/40">{s.l}</p>
          </div>
        ))}
      </div>
      {/* Systems grid */}
      <div className="grid grid-cols-3 gap-1.5 py-1">
        {systems.map(s => (
          <div key={s.name} className="rounded-lg border border-border/10 bg-card/20 p-2 flex items-center gap-2">
            <s.icon className={`h-3 w-3 ${s.color} shrink-0`} />
            <div>
              <p className="text-[9px] text-foreground font-light truncate">{s.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="h-1 w-1 rounded-full bg-emerald-500/70" />
                <span className="text-[7px] text-emerald-500/50">Active</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {/* Recent events */}
      <div className="flex-1 pt-2 space-y-1">
        <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Recent Events</p>
        {[
          { type: "SQL Injection blocked", sev: "critical", ip: "45.33.32.156" },
          { type: "Rate limit exceeded", sev: "medium", ip: "192.168.1.42" },
          { type: "Honeypot triggered", sev: "high", ip: "203.0.113.50" },
        ].map(e => (
          <div key={e.type} className="flex items-center gap-2 rounded-lg border border-border/10 bg-card/10 px-2.5 py-1.5">
            <ShieldX className="h-3 w-3 text-red-400/50 shrink-0" />
            <span className="text-[9px] text-foreground/70 flex-1 truncate">{e.type}</span>
            <span className={`rounded px-1.5 py-0.5 text-[8px] ${e.sev === "critical" ? "bg-red-400/10 text-red-400/60" : e.sev === "high" ? "bg-orange-400/10 text-orange-400/60" : "bg-amber-400/10 text-amber-400/60"}`}>{e.sev}</span>
            <span className="text-[8px] text-muted-foreground/25 font-mono">{e.ip}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ZaliMock() {
  const agents = [
    { name: "OPTIMUS", icon: Eye, color: "text-blue-400", bg: "bg-blue-400/10", domain: "Optical Engineering" },
    { name: "CHEMIX", icon: Beaker, color: "text-emerald-400", bg: "bg-emerald-400/10", domain: "Chemistry & Materials" },
    { name: "BIOX", icon: Heart, color: "text-pink-400", bg: "bg-pink-400/10", domain: "Biology & Medicine" },
    { name: "SYNTHIA", icon: Factory, color: "text-amber-400", bg: "bg-amber-400/10", domain: "Manufacturing" },
  ];
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 pb-3 border-b border-border/10">
        <Zap className="h-4 w-4 text-violet-400/70" />
        <span className="text-xs font-light tracking-wider text-foreground">ZANOEM DESIGN LAB</span>
      </div>
      {/* Workspace tabs */}
      <div className="flex items-center gap-1 py-2 border-b border-border/10">
        {["Workspace", "Agents", "3D Model", "Research", "Specs", "Materials"].map((t, i) => (
          <button key={t} className={`rounded px-2 py-0.5 text-[9px] ${i === 1 ? "bg-foreground/10 text-foreground" : "text-muted-foreground/30"}`}>{t}</button>
        ))}
      </div>
      {/* Agents panel */}
      <div className="flex-1 py-3 space-y-2">
        <p className="text-[9px] text-muted-foreground/40 uppercase tracking-wider">Specialist Agents</p>
        <p className="text-[8px] text-muted-foreground/25 mb-2">Reference in chat: "[OPTIMUS]: analyze the optical system"</p>
        <div className="grid grid-cols-2 gap-2">
          {agents.map(a => (
            <div key={a.name} className="rounded-xl border border-border/10 bg-card/20 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`${a.bg} rounded-lg p-1.5`}>
                  <a.icon className={`h-3 w-3 ${a.color}`} />
                </div>
                <div>
                  <p className="text-[10px] font-light text-foreground tracking-wider">{a.name}</p>
                  <p className="text-[8px] text-muted-foreground/40">{a.domain}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <div className="h-1 w-1 rounded-full bg-emerald-500/70" />
                <span className="text-[8px] text-emerald-500/50">Available</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function IdeMock() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 pb-2 border-b border-border/10">
        <Terminal className="h-4 w-4 text-green-400/70" />
        <span className="text-xs font-light tracking-wider text-foreground">ASHERIN IDE</span>
      </div>
      {/* IDE layout */}
      <div className="flex flex-1 mt-2 gap-1.5 overflow-hidden">
        {/* File tree */}
        <div className="w-[120px] shrink-0 border-r border-border/10 pr-1.5 text-[9px] space-y-0.5">
          <p className="text-[8px] text-muted-foreground/40 uppercase tracking-wider mb-1">Explorer</p>
          {["◇ src", "  ◈ main.ts", "  ◈ agent.ts", "  ◈ config.json", "  ◇ lib", "    ◈ utils.ts", "◇ tests", "  ◈ agent.test.ts"].map(f => (
            <p key={f} className={`px-1 py-0.5 rounded text-muted-foreground/50 ${f.includes("agent.ts") && !f.includes("test") ? "bg-foreground/10 text-foreground" : ""}`}>{f}</p>
          ))}
        </div>
        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tabs */}
          <div className="flex gap-0.5 pb-1.5">
            {["main.ts", "agent.ts", "config.json"].map((f, i) => (
              <div key={f} className={`rounded-t px-2 py-0.5 text-[9px] ${i === 1 ? "bg-card/40 text-foreground border-b border-foreground/20" : "text-muted-foreground/30"}`}>{f}</div>
            ))}
          </div>
          <div className="flex-1 rounded-lg border border-border/10 bg-black/20 p-2.5 font-mono text-[9px] leading-relaxed overflow-hidden">
            <p><span className="text-muted-foreground/25 mr-2"> 1</span><span className="text-blue-400/70">import</span> {"{"} ZophielEngine {"}"} <span className="text-blue-400/70">from</span> <span className="text-emerald-400/70">"./lib/zophiel"</span>;</p>
            <p><span className="text-muted-foreground/25 mr-2"> 2</span></p>
            <p><span className="text-muted-foreground/25 mr-2"> 3</span><span className="text-blue-400/70">export class</span> <span className="text-cyan-400/70">NomadAgent</span> {"{"}</p>
            <p><span className="text-muted-foreground/25 mr-2"> 4</span>  <span className="text-blue-400/70">private</span> engine: ZophielEngine;</p>
            <p><span className="text-muted-foreground/25 mr-2"> 5</span></p>
            <p><span className="text-muted-foreground/25 mr-2"> 6</span>  <span className="text-amber-400/70">constructor</span>() {"{"}</p>
            <p><span className="text-muted-foreground/25 mr-2"> 7</span>    <span className="text-blue-400/70">this</span>.engine = <span className="text-amber-400/70">new</span> <span className="text-cyan-400/70">ZophielEngine</span>();</p>
            <p><span className="text-muted-foreground/25 mr-2"> 8</span>  {"}"}</p>
            <p><span className="text-muted-foreground/25 mr-2"> 9</span></p>
            <p><span className="text-muted-foreground/25 mr-2">10</span>  <span className="text-blue-400/70">async</span> <span className="text-foreground/70">investigate</span>(query: <span className="text-cyan-400/70">string</span>) {"{"}</p>
            <p><span className="text-muted-foreground/25 mr-2">11</span>    <span className="text-blue-400/70">const</span> results = <span className="text-blue-400/70">await</span> <span className="text-blue-400/70">this</span>.engine.search(query);</p>
            <p><span className="text-muted-foreground/25 mr-2">12</span>    <span className="text-muted-foreground/30">// 47 sources verified ✓</span></p>
            <p><span className="text-muted-foreground/25 mr-2">13</span>    <span className="text-blue-400/70">return</span> results;</p>
            <p><span className="text-muted-foreground/25 mr-2">14</span>  {"}"}</p>
            <p><span className="text-muted-foreground/25 mr-2">15</span>{"}"}</p>
          </div>
          {/* Terminal */}
          <div className="mt-1.5 rounded-lg border border-border/10 bg-black/30 p-2 font-mono text-[8px] text-green-400/50 h-[50px] overflow-hidden">
            <p>$ npm run build</p>
            <p className="text-muted-foreground/30">✓ 0 errors, 0 warnings</p>
            <p className="text-emerald-400/50">Build complete in 1.2s</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PredictiveMock() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 pb-3 border-b border-border/10">
        <Brain className="h-4 w-4 text-purple-400/70" />
        <span className="text-xs font-light tracking-wider text-foreground">PREDICTIVE INTELLIGENCE</span>
      </div>
      <div className="flex-1 py-3 space-y-3">
        {[
          { title: "Market Shift Detected", conf: 89, desc: "AI semiconductor demand surge expected Q3 2026", type: "trend" },
          { title: "Competitor Alert", conf: 76, desc: "Major product launch signals from 3 tracked entities", type: "anomaly" },
          { title: "Regulatory Forecast", conf: 92, desc: "EU AI Act enforcement timeline accelerating", type: "forecast" },
        ].map(p => (
          <div key={p.title} className="rounded-xl border border-border/10 bg-card/20 p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-light text-foreground">{p.title}</p>
                <p className="text-[9px] text-muted-foreground/50 mt-1">{p.desc}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-extralight text-purple-400/70">{p.conf}%</p>
                <span className="rounded px-1 py-0.5 bg-purple-400/10 text-[8px] text-purple-400/50">{p.type}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LibraryMock() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-border/10">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-foreground/50" />
          <span className="text-xs font-light tracking-wider text-foreground">LIBRARY</span>
        </div>
        <button className="rounded-lg bg-foreground/5 px-2 py-1 text-[9px] text-muted-foreground/40 flex items-center gap-1"><Upload className="h-2.5 w-2.5" /> Upload</button>
      </div>
      <div className="flex-1 py-3 space-y-1.5">
        {[
          { name: "Project_Aureon_Blueprint.pdf", size: "4.2 MB", type: "PDF" },
          { name: "market_research_2026.xlsx", size: "1.8 MB", type: "Excel" },
          { name: "competitor_analysis.docx", size: "890 KB", type: "Word" },
          { name: "architecture_diagram.png", size: "2.1 MB", type: "Image" },
          { name: "api_documentation.md", size: "156 KB", type: "Markdown" },
        ].map(f => (
          <div key={f.name} className="flex items-center gap-2 rounded-lg border border-border/10 bg-card/20 px-3 py-2">
            <FileText className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-light text-foreground truncate">{f.name}</p>
              <p className="text-[9px] text-muted-foreground/30">{f.size} • {f.type}</p>
            </div>
            <Download className="h-3 w-3 text-muted-foreground/20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsMock() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 pb-3 border-b border-border/10">
        <BarChart3 className="h-4 w-4 text-foreground/50" />
        <span className="text-xs font-light tracking-wider text-foreground">MY STATS</span>
      </div>
      <div className="grid grid-cols-3 gap-2 py-3">
        {[{ l: "Messages", v: "1,247" }, { l: "Searches", v: "432" }, { l: "Files", v: "89" }, { l: "Tokens Used", v: "2.4M" }, { l: "Investigations", v: "56" }, { l: "Uptime", v: "99.9%" }].map(s => (
          <div key={s.l} className="rounded-lg border border-border/10 bg-card/20 p-2.5 text-center">
            <p className="text-lg font-extralight text-foreground">{s.v}</p>
            <p className="text-[8px] text-muted-foreground/40">{s.l}</p>
          </div>
        ))}
      </div>
      {/* Mini chart */}
      <div className="flex-1 rounded-lg border border-border/10 bg-card/10 p-3">
        <p className="text-[9px] text-muted-foreground/40 mb-2">Activity (Last 7 Days)</p>
        <div className="flex items-end gap-1 h-16">
          {[40, 65, 30, 80, 55, 90, 70].map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-foreground/10" style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className="text-[7px] text-muted-foreground/25 flex-1 text-center">{d}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── View map ── */
const VIEW_MAP: Record<string, React.FC> = {
  chat: ChatMock,
  zophiel: ZophielMock,
  azplen: AzplenMock,
  nomad: NomadMock,
  briefing: BriefingMock,
  security: SecurityMock,
  zali: ZaliMock,
  ide: IdeMock,
  predictive: PredictiveMock,
  library: LibraryMock,
  stats: StatsMock,
};

function DefaultMock({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
      <Icon className="h-8 w-8 text-muted-foreground/15" />
      <span className="text-xs font-extralight text-muted-foreground/30 tracking-wider">{label}</span>
      <span className="text-[9px] text-muted-foreground/20">Hover to preview</span>
    </div>
  );
}

/* ═══════════════ MAIN COMPONENT ═══════════════ */
const DashboardPreview = () => {
  const [activeView, setActiveView] = useState("chat");
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHover = useCallback((id: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setActiveView(id), 100);
  }, []);

  const handleLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  }, []);

  const activeItem = NAV_GROUPS.flatMap(g => g.items).find(i => i.id === activeView);

  const renderContent = () => {
    const Comp = VIEW_MAP[activeView];
    if (Comp) return <Comp />;
    if (activeItem) return <DefaultMock label={activeItem.label} icon={activeItem.icon} />;
    return <ChatMock />;
  };

  return (
    <div className="relative z-10 px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
          See The Full Dashboard.
          <br />
          <span className="text-muted-foreground">Every Tool. Every Agent. One Interface.</span>
        </h2>
        <p className="mt-6 text-sm font-extralight text-muted-foreground max-w-2xl mx-auto">
          Hover over any tool to preview it live. This is the exact interface you get — no downgrades, no locked panels.
        </p>

        <div className="mt-16 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md overflow-hidden text-left">
          <div className="flex h-[640px] sm:h-[680px] relative">
            {/* Mobile toggle */}
            <button onClick={() => setShowMobileSidebar(!showMobileSidebar)} className="absolute top-3 left-3 z-20 rounded-xl border border-border/30 bg-card/60 backdrop-blur-md p-2 sm:hidden">
              <Menu className="h-4 w-4 text-foreground" />
            </button>

            {/* Sidebar */}
            <div className={`${showMobileSidebar ? "absolute inset-y-0 left-0 z-10" : "hidden"} sm:relative sm:flex w-[200px] flex-shrink-0 flex-col border-r border-border/20 bg-card/40 backdrop-blur-xl overflow-hidden`}>
              <div className="flex items-center justify-between p-3 border-b border-border/20">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extralight tracking-[0.25em] text-foreground">ASHERIN</span>
                  <ShieldCheck className="h-3 w-3 text-emerald-500/70" />
                </div>
                <Plus className="h-3 w-3 text-muted-foreground/30" />
              </div>

              <div className="flex-1 overflow-y-auto">
                {/* Chat */}
                <div className="px-2 pt-2">
                  <button onMouseEnter={() => handleHover("chat")} onMouseLeave={handleLeave} className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-[10px] font-light transition-colors ${activeView === "chat" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5"}`}>
                    <MessageSquare className="h-3 w-3" /> Chat
                  </button>
                </div>
                <TooltipProvider delayDuration={80} skipDelayDuration={50}>
                {NAV_GROUPS.map(group => (
                  <div key={group.label} className="px-2 py-1.5 border-t border-border/10">
                    <p className="px-2.5 text-[7px] font-light tracking-[0.2em] text-muted-foreground/30 uppercase mb-0.5">{group.label}</p>
                    {group.items.map(item => (
                      <Tooltip key={item.id}>
                        <TooltipTrigger asChild>
                          <button onMouseEnter={() => handleHover(item.id)} onMouseLeave={handleLeave} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-[4px] text-[9px] font-light transition-all duration-100 ${activeView === item.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground/60 hover:bg-foreground/5 hover:text-foreground"}`}>
                            <item.icon className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{item.label}</span>
                            {item.pro && <Lock className="h-2 w-2 ml-auto shrink-0 text-muted-foreground/20" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" align="start" sideOffset={8} className="max-w-xs border-border/30 bg-card/90 backdrop-blur-xl">
                          <div className="space-y-1">
                            <p className="text-[10px] font-light tracking-[0.18em] uppercase text-foreground">{item.label}</p>
                            <p className="text-[10px] font-extralight leading-relaxed text-muted-foreground">{item.desc}</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                ))}
                </TooltipProvider>
              </div>
            </div>

            {/* Main */}
            <div className="flex flex-1 flex-col min-w-0">
              <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 border-b border-border/10">
                <div className="flex items-center gap-2">
                  {activeView === "chat" ? <MessageSquare className="h-3.5 w-3.5 text-muted-foreground/40" /> : activeItem && <activeItem.icon className="h-3.5 w-3.5 text-muted-foreground/40" />}
                  <span className="text-[11px] font-light tracking-wider text-foreground">{activeView === "chat" ? "Chat" : activeItem?.label || "Chat"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-extralight tracking-wider text-muted-foreground/20 uppercase hidden sm:block">Live Preview</span>
                  <Bot className="h-3 w-3 text-muted-foreground/20" />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-3">
                {renderContent()}
              </div>

              <div className="px-4 sm:px-5 pb-3">
                <div className="flex items-center gap-3 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-sm px-4 py-2.5">
                  <input type="text" placeholder="Ask Asherin anything..." className="flex-1 bg-transparent text-[11px] font-light text-foreground placeholder:text-muted-foreground/40 outline-none cursor-default" readOnly />
                  <Send className="h-3.5 w-3.5 text-muted-foreground/30" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPreview;
