import { useState } from "react";
import {
  Search, Scale, Code, Shield, PenTool, BookOpen, Swords, Aperture,
  Plus, MessageSquare, ChevronDown, ShieldCheck, FolderOpen, Layers,
  Brain, BarChart3, Settings, CreditCard, Send, Zap, Database,
  Crosshair, Newspaper, Code2, Bot, Menu,
} from "lucide-react";

const PERSONAS = [
  { id: "analyst", name: "The Analyst", Icon: Search, description: "Cold, data-driven." },
  { id: "strategist", name: "The Strategist", Icon: Scale, description: "Long-term thinking." },
  { id: "engineer", name: "The Engineer", Icon: Code, description: "Pure technical." },
  { id: "codeforge", name: "The Code Forge", Icon: Swords, description: "7-phase code audit." },
  { id: "uiforge", name: "The UI Forge", Icon: Aperture, description: "9-phase UI audit." },
  { id: "truth", name: "The Truth Engine", Icon: Shield, description: "Uncensored. Direct." },
  { id: "writer", name: "The Writer", Icon: PenTool, description: "Voice-matched." },
  { id: "researcher", name: "The Researcher", Icon: BookOpen, description: "Source-heavy." },
];

const NAV_ITEMS = [
  { id: "search", icon: Zap, label: "Zophiel Engine" },
  { id: "briefing", icon: Newspaper, label: "Intel Briefings" },
  { id: "asha", icon: Database, label: "Asha Intelligence" },
  { id: "nomad", icon: Crosshair, label: "NOMAD Agent" },
  { id: "library", icon: FolderOpen, label: "Library" },
  { id: "snippets", icon: Code2, label: "Code Snippets" },
  { id: "projects", icon: Layers, label: "Projects" },
  { id: "memory", icon: Brain, label: "Memory Center" },
  { id: "stats", icon: BarChart3, label: "My Stats" },
  { id: "subscription", icon: CreditCard, label: "Subscription" },
  { id: "settings", icon: Settings, label: "Settings" },
];

const TABS = [
  { id: "chat", label: "Chat" },
  { id: "research", label: "Research" },
  { id: "code", label: "Code" },
  { id: "truth", label: "Truth" },
];

const MOCK_MESSAGES = [
  { role: "user", content: "Analyze the architectural flaws in this React codebase." },
  { role: "assistant", content: "**Phase 1: Scout — Context Mapping**\n\nThe codebase uses a monolithic state pattern in the root component. All conversation data, UI state, and streaming logic are colocated in a single 500-line file.\n\n**Phase 2: Bug Hunt**\n- **BUG**: Stale closure in `sendMessage` — `activeConv` references old state\n- **BUG**: Missing cleanup on `AbortController` in unmount\n- **BUG**: `trackUsage` fires before message is persisted\n\n**Phase 3: Structural Audit**\nSeparation of concerns violation: rendering, API calls, and state management are interleaved. Extract a `useChatEngine` hook." },
];

const DashboardPreview = () => {
  const [activePersona, setActivePersona] = useState("codeforge");
  const [activeTab, setActiveTab] = useState("code");
  const [activeNav, setActiveNav] = useState("chat");
  const [showConvos, setShowConvos] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  return (
    <div className="relative z-10 px-6 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl text-center">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
          See The Full Dashboard.
          <br />
          <span className="text-muted-foreground">Every Tool. Every Agent. One Interface.</span>
        </h2>
        <p className="mt-6 text-sm font-extralight text-muted-foreground max-w-2xl mx-auto">
          Switch between personas, modes, and intelligence tools. This is the exact interface you get — no downgrades, no locked panels.
        </p>

        {/* Dashboard Mockup */}
        <div className="mt-16 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md overflow-hidden text-left">
          <div className="flex h-[600px] sm:h-[650px] relative">

            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
              className="absolute top-3 left-3 z-20 rounded-xl border border-border/30 bg-card/60 backdrop-blur-md p-2 sm:hidden"
            >
              <Menu className="h-4 w-4 text-foreground" />
            </button>

            {/* Sidebar */}
            <div className={`${showMobileSidebar ? "absolute inset-y-0 left-0 z-10" : "hidden"} sm:relative sm:flex w-[220px] flex-shrink-0 flex-col border-r border-border/20 bg-card/40 backdrop-blur-xl overflow-hidden`}>
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border/20">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extralight tracking-[0.25em] text-foreground">AUREON</span>
                  <ShieldCheck className="h-3 w-3 text-emerald-500/70" />
                </div>
                <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-foreground/10">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto">
                {/* Past Convos toggle */}
                <div className="px-2 pt-3">
                  <button
                    onClick={() => setShowConvos(!showConvos)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-[11px] font-light transition-colors ${
                      showConvos ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Past Convos
                    </div>
                    <ChevronDown className={`h-3 w-3 transition-transform ${showConvos ? "rotate-180" : ""}`} />
                  </button>
                </div>

                {showConvos && (
                  <div className="px-2 py-1 space-y-0.5">
                    {["React auth refactor", "API rate limiting", "DB schema review"].map((t) => (
                      <div key={t} className="rounded-lg px-3 py-1.5 text-[10px] font-extralight text-muted-foreground/60 truncate cursor-default">
                        {t}
                      </div>
                    ))}
                  </div>
                )}

                {/* Personas */}
                <div className="px-2 py-2 border-t border-border/20">
                  <p className="px-3 text-[9px] font-light tracking-[0.2em] text-muted-foreground/60 uppercase mb-1">Personas</p>
                  {PERSONAS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setActivePersona(p.id)}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left transition-colors ${
                        activePersona === p.id
                          ? "bg-foreground/10 text-foreground"
                          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                      }`}
                    >
                      <p.Icon className="h-3.5 w-3.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-light truncate">{p.name}</p>
                        <p className="text-[9px] text-muted-foreground/50 truncate">{p.description}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Nav items */}
                <div className="px-2 py-2 border-t border-border/20 space-y-0.5">
                  {NAV_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => { setActiveNav(item.id); setShowMobileSidebar(false); }}
                      className={`flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-[11px] font-light transition-colors ${
                        activeNav === item.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                      }`}
                    >
                      <item.icon className="h-3.5 w-3.5" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main content area */}
            <div className="flex flex-1 flex-col min-w-0">
              {/* Mode tabs */}
              <div className="flex items-center gap-1 px-4 pt-4 pb-2">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-lg px-3 py-1.5 text-[11px] font-light tracking-wide transition-colors ${
                      activeTab === tab.id
                        ? "bg-foreground/10 text-foreground"
                        : "text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-[9px] font-extralight tracking-wider text-muted-foreground/40 uppercase">
                    {PERSONAS.find((p) => p.id === activePersona)?.name}
                  </span>
                  <Bot className="h-3.5 w-3.5 text-muted-foreground/40" />
                </div>
              </div>

              {/* Messages area */}
              <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 space-y-6">
                {MOCK_MESSAGES.map((msg, i) => (
                  <div key={i} className={`max-w-2xl ${msg.role === "user" ? "ml-auto" : ""}`}>
                    <div
                      className={`rounded-2xl px-5 py-4 text-xs font-extralight leading-relaxed ${
                        msg.role === "user"
                          ? "bg-foreground/10 text-foreground"
                          : "bg-card/30 border border-border/10 text-foreground/90"
                      }`}
                    >
                      {msg.content.split("\n").map((line, j) => (
                        <p key={j} className={`${line.startsWith("**") ? "font-light text-foreground mt-3 first:mt-0" : line.startsWith("- ") ? "ml-4 text-muted-foreground" : ""} ${j > 0 ? "mt-1.5" : ""}`}>
                          {line.replace(/\*\*/g, "")}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                <div className="max-w-2xl">
                  <div className="rounded-2xl bg-card/30 border border-border/10 px-5 py-4">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-pulse" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-pulse" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Input bar */}
              <div className="px-4 sm:px-8 pb-4">
                <div className="flex items-center gap-3 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-sm px-4 py-3">
                  <input
                    type="text"
                    placeholder="Ask Aureon anything..."
                    className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none cursor-default"
                    readOnly
                  />
                  <button className="text-muted-foreground/40 cursor-default">
                    <Send className="h-4 w-4" />
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
