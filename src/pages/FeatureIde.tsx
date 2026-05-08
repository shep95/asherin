import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import {
  Terminal, Code2, Brain, GitBranch, FolderOpen, Play, Zap,
  ArrowRight, Check, ArrowLeft, Cpu, Database, FileText, Settings,
  Shield, Download, MessageSquare, Layers, Search, Bug, Wand2,
} from "lucide-react";
import AgentArchitectureDiagram from "@/components/landing/AgentArchitectureDiagram";

const capabilities = [
  {
    icon: Code2,
    title: "Full Code Editor",
    description:
      "Multi-file editing with syntax highlighting, line numbers, undo/redo, and support for 20+ languages. Built for production, not demos.",
  },
  {
    icon: Brain,
    title: "AUREON AI Chat — In-IDE",
    description:
      "Integrated AI assistant that reads your active file, understands context, and generates production-grade code. Uses your 200-message shared pool.",
  },
  {
    icon: Terminal,
    title: "Integrated Terminal",
    description:
      "Built-in terminal emulator for running commands, scripts, and build tools — all without leaving the IDE.",
  },
  {
    icon: FolderOpen,
    title: "Virtual File System",
    description:
      "Create, rename, move, and delete files and folders. Full tree navigation with drag-and-drop support.",
  },
  {
    icon: GitBranch,
    title: "Git Integration",
    description:
      "Visual Git panel with branch management, commit history, diff viewing, and staging — connected to your GitHub repos.",
  },
  {
    icon: Download,
    title: "ZIP Export & Sessions",
    description:
      "Save and restore sessions. Export your entire project as a ZIP. Switch between workspaces instantly.",
  },
];

const ideFeatures = [
  "AI code generation with full file context awareness",
  "Unlimited messages with your own AI key — shared with Aureon Chat",
  "Multi-file project support with folder hierarchy",
  "Session persistence — your work saves automatically",
  "Custom AI prompt 'brains' for specialized coding tasks",
  "Live preview panel for HTML/CSS/JS projects",
  "Code search across all project files",
  "Git commit, push, pull, and branch operations",
  "Keyboard shortcuts for power users",
  "Problems panel with error detection",
  "AI audit log — see every AI decision",
  "Integration panel for connecting external services",
];

const apiEndpoints = [
  { category: "Auth", endpoints: "signup, login, oauth, session management", count: 8 },
  { category: "Projects", endpoints: "CRUD, files, git operations, collaboration", count: 15 },
  { category: "AI", endpoints: "chat, generate, explain, fix, test generation", count: 12 },
  { category: "Deploy", endpoints: "deploy, rollback, logs, environment config", count: 10 },
  { category: "Integrations", endpoints: "150+ external services, webhooks, APIs", count: 20 },
  { category: "Collaboration", endpoints: "real-time editing, cursors, comments", count: 8 },
  { category: "Analytics", endpoints: "metrics, errors, performance, usage", count: 10 },
];

const FeatureIde = () => {
  useEffect(() => {
    document.title = "AUREON IDE — Full Cloud Development Environment";
  }, []);

  return (
    <LandingBackground>
      <Header />

      {/* Back link */}
      <div className="relative z-10 pt-24 px-6">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-light tracking-wide text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>
      </div>

      {/* Hero */}
      <section className="relative z-10 flex min-h-[70vh] flex-col items-center justify-center px-6 pt-24 text-center">
        <div className="rounded-full border border-border/20 bg-card/30 backdrop-blur-md px-4 py-1.5 mb-8">
          <span className="text-[10px] font-light tracking-[0.3em] text-muted-foreground uppercase">Cloud Development</span>
        </div>
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Code Anywhere.
          <br />
          <span className="text-muted-foreground">AI Everywhere.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground">
          AUREON IDE is a full cloud development environment with integrated AI chat, terminal, Git, and session management.
          Write, debug, and deploy — all from your browser.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link to="/pricing" className="group flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90">
            Get Access <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link to="/features" className="rounded-xl border border-border/30 px-8 py-3 text-sm font-light tracking-wide text-foreground transition-colors hover:bg-foreground/5">
            All Features
          </Link>
        </div>
      </section>

      {/* Capabilities */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
            Core Capabilities
          </h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 max-w-2xl">
            Every tool a developer needs — from code editing to AI generation to Git operations — unified in one browser-based environment.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {capabilities.map((cap) => (
              <div key={cap.title} className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 transition-all hover:border-border/40 hover:bg-card/30">
                <cap.icon className="h-6 w-6 text-foreground/80 mb-4" />
                <h3 className="text-base font-light tracking-wide text-foreground mb-3">{cap.title}</h3>
                <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{cap.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI System Access */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4 text-center">
            AI System Access
          </h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 text-center max-w-2xl mx-auto">
            The AUREON AI inside the IDE has deep access to your project context — enabling intelligent code generation, debugging, and architecture decisions.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: FolderOpen, label: "Full Codebase", desc: "Read/write access to all project files" },
              { icon: Brain, label: "User Patterns", desc: "Learned preferences and coding style" },
              { icon: MessageSquare, label: "Conversation History", desc: "Full context across all sessions" },
              { icon: Search, label: "External Knowledge", desc: "Web search, docs, GitHub integration" },
              { icon: Database, label: "Integrations", desc: "Database schema, APIs, env variables" },
              { icon: Bug, label: "Error Logs", desc: "Stack traces and debugging context" },
              { icon: Wand2, label: "Code Generation", desc: "Generate complete files, not snippets" },
              { icon: Shield, label: "Auto-Fix Bugs", desc: "Detect and fix issues with approval" },
              { icon: Play, label: "Test Generation", desc: "Automatically generate test suites" },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="rounded-xl border border-border/15 bg-card/20 backdrop-blur-md p-5 transition-all hover:border-border/30">
                <div className="flex items-center gap-3 mb-2">
                  <Icon className="h-4 w-4 text-foreground/70" />
                  <h3 className="text-sm font-light tracking-wide text-foreground">{label}</h3>
                </div>
                <p className="text-xs font-extralight leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* API Endpoints */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4 text-center">
            100+ API Endpoints
          </h2>
          <p className="text-sm font-extralight text-muted-foreground mb-12 text-center">
            A complete backend powering every IDE operation.
          </p>
          <div className="space-y-3">
            {apiEndpoints.map((ep) => (
              <div key={ep.category} className="flex items-center justify-between rounded-xl border border-border/15 bg-card/20 backdrop-blur-md px-6 py-4">
                <div>
                  <h3 className="text-sm font-light tracking-wide text-foreground">/api/{ep.category.toLowerCase()}/*</h3>
                  <p className="text-xs font-extralight text-muted-foreground mt-0.5">{ep.endpoints}</p>
                </div>
                <span className="text-xs font-light text-muted-foreground/60">{ep.count}+ routes</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture */}
      <AgentArchitectureDiagram
        title="IDE Intelligence Architecture"
        subtitle="A unified development pipeline connecting your editor, AI engine, Git operations, and deployment — all running in the browser with full session persistence."
        layers={[
          {
            label: "Editor Layer",
            nodes: [
              { id: "e1", label: "Code Editor", sublabel: "Multi-file, syntax highlighting, 20+ languages", type: "input", icon: Code2 },
              { id: "e2", label: "File System", sublabel: "Virtual FS with tree navigation", type: "input", icon: FolderOpen },
              { id: "e3", label: "Terminal", sublabel: "Integrated command line", type: "input", icon: Terminal },
            ],
          },
          {
            label: "AI Engine",
            nodes: [
              { id: "a1", label: "AUREON Chat", sublabel: "Context-aware code generation", type: "agent", icon: Brain, accent: "text-accent/70" },
              { id: "a2", label: "Code Analyzer", sublabel: "Bug detection & auto-fix", type: "agent", icon: Bug, accent: "text-accent/70" },
              { id: "a3", label: "Custom Brains", sublabel: "Specialized prompt injection", type: "agent", icon: Wand2, accent: "text-accent/70" },
            ],
          },
          {
            label: "Operations",
            nodes: [
              { id: "g1", label: "Git Engine", sublabel: "Branch, commit, push, pull, diff", type: "engine", icon: GitBranch, accent: "text-accent/60" },
              { id: "g2", label: "Session Manager", sublabel: "Auto-save, restore, switch", type: "engine", icon: Settings, accent: "text-accent/60" },
            ],
          },
          {
            label: "Output",
            nodes: [
              { id: "o1", label: "Live Preview", sublabel: "Real-time HTML/CSS/JS rendering", type: "output", icon: Play },
              { id: "o2", label: "ZIP Export", sublabel: "Full project download", type: "output", icon: Download },
              { id: "o3", label: "Deploy", sublabel: "One-click deployment", type: "output", icon: Zap },
            ],
          },
        ]}
        features={["session persistence", "AI code generation", "virtual file system", "git integration", "live preview", "offline capable"]}
      />

      {/* Feature List */}
      <section className="relative z-10 px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12 text-center">
            Everything Included
          </h2>
          <div className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-8 sm:p-12">
            <ul className="space-y-4">
              {ideFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3 text-sm font-extralight text-foreground/80">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400/60" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-24 text-center">
        <h2 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-4">
          Your IDE. Your AI. Your Browser.
        </h2>
        <p className="text-sm font-extralight text-muted-foreground mb-8">Included in every Aureon plan — starting at $199/mo.</p>
        <Link to="/pricing" className="group inline-flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90">
          View Plans <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/10 py-8 text-center">
        <p className="text-xs font-extralight text-muted-foreground/50">© {new Date().getFullYear()} Aureon. All rights reserved.</p>
      </footer>
    </LandingBackground>
  );
};

export default FeatureIde;
