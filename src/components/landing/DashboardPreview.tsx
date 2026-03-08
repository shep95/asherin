import { useState, useRef, useCallback } from "react";
import {
  Zap, Globe, Terminal, Brain, Newspaper, Crosshair, Database, Activity,
  FileText, Code2, Layers, Sparkles, Users, MessagesSquare, FolderOpen,
  ShieldCheck, Puzzle, ClipboardList, BarChart3, CreditCard, Settings,
  MapPin, Plus, MessageSquare, ChevronDown, Menu, Send, Bot, Search,
  Eye, Beaker, Heart, Factory, Shield, Lock,
} from "lucide-react";

/* ── Nav structure matching real DashboardSidebar ── */
interface NavItem { id: string; icon: React.ElementType; label: string; pro?: boolean }
interface NavGroup { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Intelligence",
    items: [
      { id: "zophiel", icon: Zap, label: "Zophiel Engine" },
      { id: "google", icon: Globe, label: "Google Intel", pro: true },
      { id: "elion", icon: Terminal, label: "Elion / Zohar", pro: true },
      { id: "predictive", icon: Brain, label: "Predictive Intel", pro: true },
      { id: "briefing", icon: Newspaper, label: "Intel Briefings", pro: true },
      { id: "nomad", icon: Crosshair, label: "NOMAD Agent", pro: true },
      { id: "tracker", icon: MapPin, label: "Location Tracker", pro: true },
      { id: "imagine", icon: Crosshair, label: "Imagine Intelligence" },
      { id: "video", icon: Crosshair, label: "Video Intelligence", pro: true },
    ],
  },
  {
    label: "Data & Analysis",
    items: [
      { id: "asha", icon: Database, label: "Asha Intelligence", pro: true },
      { id: "pattern", icon: Activity, label: "Pattern Engine", pro: true },
      { id: "timeseries", icon: Activity, label: "Time-Series", pro: true },
      { id: "geo", icon: Globe, label: "Geospatial", pro: true },
      { id: "notebooks", icon: FileText, label: "Notebooks", pro: true },
    ],
  },
  {
    label: "Creation",
    items: [
      { id: "zali", icon: Zap, label: "ZALI Design Lab", pro: true },
      { id: "ide", icon: Terminal, label: "AUREON IDE" },
      { id: "i2c", icon: Code2, label: "Imagine To Code" },
      { id: "vibe-img", icon: Sparkles, label: "Vibe Imager" },
      { id: "vibe-vid", icon: Sparkles, label: "Vibe Video", pro: true },
      { id: "pdf", icon: FileText, label: "PDF Generator" },
      { id: "slideshow", icon: Layers, label: "Slideshow Generator" },
      { id: "snippets", icon: Code2, label: "Code Snippets" },
      { id: "projects", icon: Layers, label: "Projects" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { id: "teams", icon: Users, label: "Team Workspace", pro: true },
      { id: "community", icon: MessagesSquare, label: "Community", pro: true },
      { id: "personas", icon: Sparkles, label: "Persona Store" },
      { id: "library", icon: FolderOpen, label: "Library" },
      { id: "memory", icon: Brain, label: "Memory Center" },
    ],
  },
  {
    label: "System",
    items: [
      { id: "security", icon: ShieldCheck, label: "Security Center", pro: true },
      { id: "plugins", icon: Puzzle, label: "Plugins", pro: true },
      { id: "audit", icon: ClipboardList, label: "Audit Trail", pro: true },
      { id: "stats", icon: BarChart3, label: "My Stats" },
      { id: "subscription", icon: CreditCard, label: "Subscription" },
      { id: "settings", icon: Settings, label: "Settings" },
    ],
  },
];

/* ── Mock content per view ── */
const ViewContent: Record<string, React.FC> = {
  chat: ChatMock,
  zophiel: ZophielMock,
  asha: AshaMock,
  zali: ZaliMock,
  ide: IdeMock,
  nomad: NomadMock,
  briefing: BriefingMock,
  security: SecurityMock,
};

function ChatMock() {
  return (
    <div className="space-y-4">
      <div className="ml-auto max-w-[80%] rounded-2xl bg-foreground/10 px-4 py-3 text-[11px] font-extralight text-foreground">
        Analyze the architectural flaws in this React codebase.
      </div>
      <div className="max-w-[90%] rounded-2xl border border-border/10 bg-card/30 px-4 py-3 text-[11px] font-extralight text-foreground/80 space-y-2">
        <p className="font-light text-foreground text-[11px]">Phase 1: Scout — Context Mapping</p>
        <p className="text-muted-foreground text-[10px]">Monolithic state pattern detected. 500+ line root component with colocated API, streaming, and UI logic.</p>
        <p className="font-light text-foreground text-[11px] mt-2">Phase 2: Bug Hunt</p>
        <p className="text-muted-foreground text-[10px]">• Stale closure in sendMessage — references old state</p>
        <p className="text-muted-foreground text-[10px]">• Missing AbortController cleanup on unmount</p>
      </div>
      <div className="max-w-[90%] rounded-2xl border border-border/10 bg-card/30 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-pulse" />
          <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-pulse" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-pulse" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function ZophielMock() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-4 w-4 text-amber-400" />
        <span className="text-xs font-light text-foreground tracking-wider">ZOPHIEL SEARCH ENGINE</span>
      </div>
      <div className="rounded-xl border border-border/20 bg-card/20 p-3">
        <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-background/30 px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
          <span className="text-[11px] text-muted-foreground/40">Search across the entire internet...</span>
        </div>
      </div>
      {["Deep Web Results", "Academic Sources", "News Intel"].map((t, i) => (
        <div key={t} className="rounded-lg border border-border/10 bg-card/20 p-3">
          <p className="text-[10px] font-light text-foreground">{t}</p>
          <div className="mt-1.5 h-1.5 rounded-full bg-foreground/5 overflow-hidden">
            <div className="h-full bg-amber-500/30 rounded-full" style={{ width: `${80 - i * 20}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function AshaMock() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Database className="h-4 w-4 text-cyan-400" />
        <span className="text-xs font-light text-foreground tracking-wider">ASHA INTELLIGENCE</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[{ l: "Datasets", v: "12" }, { l: "Insights", v: "47" }, { l: "Quality", v: "94%" }].map((s) => (
          <div key={s.l} className="rounded-lg border border-border/10 bg-card/20 p-2.5 text-center">
            <p className="text-lg font-extralight text-foreground">{s.v}</p>
            <p className="text-[9px] text-muted-foreground/50">{s.l}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border/10 bg-card/20 p-3">
        <p className="text-[10px] font-light text-foreground mb-2">Active Pipelines</p>
        {["ETL → Clean → Enrich → Output", "Ingest → Validate → Store"].map((p) => (
          <div key={p} className="flex items-center gap-2 py-1">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500/70" />
            <span className="text-[10px] text-muted-foreground/60">{p}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ZaliMock() {
  const agents = [
    { name: "OPTIMUS", icon: Eye, color: "text-blue-400", bg: "bg-blue-400/10" },
    { name: "CHEMIX", icon: Beaker, color: "text-emerald-400", bg: "bg-emerald-400/10" },
    { name: "BIOX", icon: Heart, color: "text-pink-400", bg: "bg-pink-400/10" },
    { name: "SYNTHIA", icon: Factory, color: "text-amber-400", bg: "bg-amber-400/10" },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-4 w-4 text-violet-400" />
        <span className="text-xs font-light text-foreground tracking-wider">ZALI DESIGN LAB</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {agents.map((a) => (
          <div key={a.name} className="rounded-lg border border-border/10 bg-card/20 p-2.5 flex items-center gap-2">
            <div className={`${a.bg} rounded-md p-1.5`}>
              <a.icon className={`h-3 w-3 ${a.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-light text-foreground">{a.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <div className="h-1 w-1 rounded-full bg-emerald-500/70" />
                <span className="text-[8px] text-emerald-500/60">Online</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function IdeMock() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Terminal className="h-4 w-4 text-green-400" />
        <span className="text-xs font-light text-foreground tracking-wider">AUREON IDE</span>
      </div>
      <div className="rounded-lg border border-border/10 bg-black/30 p-3 font-mono text-[10px] text-green-400/80 space-y-1 leading-relaxed">
        <p><span className="text-blue-400">const</span> <span className="text-foreground">agent</span> = <span className="text-amber-400">new</span> <span className="text-cyan-400">ZophielEngine</span>();</p>
        <p><span className="text-blue-400">await</span> agent.<span className="text-foreground">search</span>(<span className="text-emerald-400">"quantum computing"</span>);</p>
        <p><span className="text-blue-400">const</span> results = agent.<span className="text-foreground">getResults</span>();</p>
        <p className="text-muted-foreground/30">// 47 sources verified ✓</p>
      </div>
      <div className="flex gap-1">
        {["main.ts", "agent.ts", "config.json"].map((f) => (
          <div key={f} className="rounded px-2 py-1 bg-card/20 border border-border/10 text-[9px] text-muted-foreground/50">{f}</div>
        ))}
      </div>
    </div>
  );
}

function NomadMock() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Crosshair className="h-4 w-4 text-red-400" />
        <span className="text-xs font-light text-foreground tracking-wider">NOMAD AGENT</span>
      </div>
      <div className="rounded-lg border border-border/10 bg-card/20 p-3 space-y-2">
        <p className="text-[10px] font-light text-foreground">Active Investigation</p>
        {["Entity extraction: 14 found", "Cross-referencing 3 databases", "Confidence: 87%"].map((l) => (
          <div key={l} className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-red-400/60" />
            <span className="text-[10px] text-muted-foreground/60">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BriefingMock() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <Newspaper className="h-4 w-4 text-amber-400" />
        <span className="text-xs font-light text-foreground tracking-wider">INTEL BRIEFINGS</span>
      </div>
      {["Market Disruption Alert", "Competitor Movement", "Regulatory Update"].map((t) => (
        <div key={t} className="rounded-lg border border-border/10 bg-card/20 p-3 flex items-center justify-between">
          <span className="text-[10px] font-light text-foreground">{t}</span>
          <span className="text-[9px] text-muted-foreground/40">2h ago</span>
        </div>
      ))}
    </div>
  );
}

function SecurityMock() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="h-4 w-4 text-emerald-400" />
        <span className="text-xs font-light text-foreground tracking-wider">SECURITY CENTER</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[{ l: "Threats Blocked", v: "2,847" }, { l: "Uptime", v: "99.97%" }, { l: "Encryption", v: "AES-256" }, { l: "Score", v: "A+" }].map((s) => (
          <div key={s.l} className="rounded-lg border border-border/10 bg-card/20 p-2 text-center">
            <p className="text-sm font-extralight text-foreground">{s.v}</p>
            <p className="text-[9px] text-muted-foreground/50">{s.l}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DefaultMock({ label, icon: Icon }: { label: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
      <Icon className="h-8 w-8 text-muted-foreground/20" />
      <span className="text-xs font-light text-muted-foreground/40 tracking-wider">{label}</span>
    </div>
  );
}

/* ── Main Component ── */
const DashboardPreview = () => {
  const [activeView, setActiveView] = useState("chat");
  const [showConvos, setShowConvos] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHover = useCallback((id: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setActiveView(id), 120);
  }, []);

  const handleLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
  }, []);

  const activeItem = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === activeView);

  const renderContent = () => {
    const Comp = ViewContent[activeView];
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

        {/* Dashboard Shell */}
        <div className="mt-16 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md overflow-hidden text-left">
          <div className="flex h-[620px] sm:h-[660px] relative">

            {/* Mobile toggle */}
            <button
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
              className="absolute top-3 left-3 z-20 rounded-xl border border-border/30 bg-card/60 backdrop-blur-md p-2 sm:hidden"
            >
              <Menu className="h-4 w-4 text-foreground" />
            </button>

            {/* Sidebar */}
            <div className={`${showMobileSidebar ? "absolute inset-y-0 left-0 z-10" : "hidden"} sm:relative sm:flex w-[210px] flex-shrink-0 flex-col border-r border-border/20 bg-card/40 backdrop-blur-xl overflow-hidden`}>
              {/* Sidebar header */}
              <div className="flex items-center justify-between p-3 border-b border-border/20">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extralight tracking-[0.25em] text-foreground">AUREON</span>
                  <ShieldCheck className="h-3 w-3 text-emerald-500/70" />
                </div>
                <button className="rounded-lg p-1 text-muted-foreground hover:bg-foreground/10">
                  <Plus className="h-3 w-3" />
                </button>
              </div>

              {/* Scrollable nav */}
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {/* Chat button */}
                <div className="px-2 pt-2">
                  <button
                    onMouseEnter={() => handleHover("chat")}
                    onMouseLeave={handleLeave}
                    className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-[10px] font-light transition-colors ${
                      activeView === "chat" ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5"
                    }`}
                  >
                    <MessageSquare className="h-3 w-3" />
                    Chat
                  </button>
                </div>

                {/* Nav groups */}
                {NAV_GROUPS.map((group) => (
                  <div key={group.label} className="px-2 py-1.5 border-t border-border/10 first:border-t-0">
                    <p className="px-2.5 text-[8px] font-light tracking-[0.2em] text-muted-foreground/40 uppercase mb-1">{group.label}</p>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onMouseEnter={() => handleHover(item.id)}
                        onMouseLeave={handleLeave}
                        className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-[5px] text-[10px] font-light transition-all duration-150 ${
                          activeView === item.id
                            ? "bg-foreground/10 text-foreground"
                            : "text-muted-foreground/70 hover:bg-foreground/5 hover:text-foreground"
                        }`}
                      >
                        <item.icon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{item.label}</span>
                        {item.pro && <Lock className="h-2.5 w-2.5 ml-auto shrink-0 text-muted-foreground/30" />}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Main content */}
            <div className="flex flex-1 flex-col min-w-0">
              {/* Top bar */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/10">
                <div className="flex items-center gap-2">
                  {activeItem && <activeItem.icon className="h-3.5 w-3.5 text-muted-foreground/50" />}
                  <span className="text-[11px] font-light tracking-wider text-foreground">
                    {activeView === "chat" ? "Chat" : activeItem?.label || "Chat"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-extralight tracking-wider text-muted-foreground/30 uppercase hidden sm:block">
                    Live Preview
                  </span>
                  <Bot className="h-3.5 w-3.5 text-muted-foreground/30" />
                </div>
              </div>

              {/* Content area */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                {renderContent()}
              </div>

              {/* Input bar */}
              <div className="px-4 sm:px-6 pb-3">
                <div className="flex items-center gap-3 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-sm px-4 py-2.5">
                  <input
                    type="text"
                    placeholder="Ask Aureon anything..."
                    className="flex-1 bg-transparent text-[11px] font-light text-foreground placeholder:text-muted-foreground/40 outline-none cursor-default"
                    readOnly
                  />
                  <button className="text-muted-foreground/40 cursor-default">
                    <Send className="h-3.5 w-3.5" />
                  </button>
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
