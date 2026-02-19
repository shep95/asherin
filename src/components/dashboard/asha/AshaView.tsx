import React, { useState, useRef, createContext, useContext } from "react";
import {
  Upload, Table2, Share2, GitBranch, Workflow, LayoutDashboard,
  Lightbulb, MessageSquare, Database, Shield, BookOpen, FileOutput, Globe,
  Fingerprint, FlaskConical, GitCommitHorizontal, Target, Activity,
  Plus, Building2, ChevronDown, Trash2, FileText, FolderOpen, Pencil, Check, X,
  Brain, AlertTriangle, Keyboard,
} from "lucide-react";
import type { AshaTab } from "./types";
import IngestPanel from "./IngestPanel";
import DataTablePanel from "./DataTablePanel";
import GraphViewPanel from "./GraphViewPanel";
import InsightsPanel from "./InsightsPanel";
import EntitiesPanel from "./EntitiesPanel";
import QueryBar from "./QueryBar";
import WorkflowPanel from "./WorkflowPanel";
import DashboardBuilderPanel from "./DashboardBuilderPanel";
import BranchPanel from "./BranchPanel";
import CatalogPanel from "./CatalogPanel";
import ReportsPanel from "./ReportsPanel";
import WebIntelligencePanel from "./WebIntelligencePanel";
import EntityResolutionPanel from "./EntityResolutionPanel";
import ScenarioSimulatorPanel from "./ScenarioSimulatorPanel";
import DataLineagePanel from "./DataLineagePanel";
import ThreatModelingPanel from "./ThreatModelingPanel";
import MonitoringPanel from "./MonitoringPanel";
import DocumentIntelligencePanel from "./DocumentIntelligencePanel";
import FilesPanel from "./FilesPanel";
import PredictionsPanel from "./PredictionsPanel";
import EncryptionBadge from "../EncryptionBadge";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AshaSessionProvider, useAshaSession } from "./AshaSessionContext";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Context for navigating between tabs from child panels
const AshaNavContext = createContext<{ navigateToTab: (tab: AshaTab, datasetId?: string) => void }>({ navigateToTab: () => {} });
export const useAshaNav = () => useContext(AshaNavContext);

const tabs: { id: AshaTab; icon: React.ElementType; label: string }[] = [
  { id: "ingest", icon: Upload, label: "Ingest" },
  { id: "docintel", icon: FileText, label: "Doc Intel" },
  { id: "catalog", icon: BookOpen, label: "Catalog" },
  { id: "table", icon: Table2, label: "Table" },
  { id: "graph", icon: Share2, label: "Graph" },
  { id: "entities", icon: Fingerprint, label: "Entities" },
  { id: "lineage", icon: GitCommitHorizontal, label: "Lineage" },
  { id: "pipelines", icon: GitBranch, label: "Branches" },
  { id: "workflows", icon: Workflow, label: "Workflows" },
  { id: "scenarios", icon: FlaskConical, label: "Scenarios" },
  { id: "threats", icon: Target, label: "Threats" },
  { id: "dashboards", icon: LayoutDashboard, label: "Dashboards" },
  { id: "insights", icon: Lightbulb, label: "Insights" },
  { id: "monitoring", icon: Activity, label: "Monitoring" },
  { id: "reports", icon: FileOutput, label: "Reports" },
  { id: "webintel", icon: Globe, label: "Web Intel" },
  { id: "files", icon: FolderOpen, label: "Files" },
  { id: "predictions", icon: Brain, label: "Predictions" },
  { id: "query", icon: MessageSquare, label: "Ask Asha" },
];

const SessionSelector = () => {
  const { sessions, activeSession, setActiveSession, createSession, renameSession, deleteSession } = useAshaSession();
  const [open, setOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createSession(newName.trim(), newCompany.trim());
    setNewName(""); setNewCompany(""); setShowCreate(false); setOpen(false);
  };

  const startRename = (s: { id: string; name: string }) => {
    setRenamingId(s.id);
    setRenameValue(s.name);
  };

  const confirmRename = async () => {
    if (renamingId && renameValue.trim()) {
      await renameSession(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue("");
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-border/20 bg-card/30 px-3 py-1.5 hover:bg-card/50 transition-colors">
        <Building2 className="h-3.5 w-3.5 text-accent" />
        <span className="text-xs font-light text-foreground max-w-[140px] truncate">
          {activeSession ? activeSession.name : "No Session"}
        </span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setShowCreate(false); setRenamingId(null); }} />
          <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-xl border border-border/20 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
            {/* Session list */}
            <div className="max-h-64 overflow-y-auto p-1.5">
              {sessions.map(s => (
                <div key={s.id} className={`flex items-center gap-2 rounded-lg px-3 py-2.5 transition-colors group ${activeSession?.id === s.id ? "bg-foreground/10" : "hover:bg-foreground/5"}`}>
                  {renamingId === s.id ? (
                    <div className="flex-1 flex items-center gap-1.5">
                      <input
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") setRenamingId(null); }}
                        className="flex-1 bg-background/50 border border-border/20 rounded px-2 py-1 text-xs text-foreground outline-none focus:border-accent/30"
                        autoFocus
                        onClick={e => e.stopPropagation()}
                      />
                      <button onClick={(e) => { e.stopPropagation(); confirmRename(); }} className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10">
                        <Check className="h-3 w-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setRenamingId(null); }} className="p-1 rounded text-muted-foreground hover:text-foreground">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => { setActiveSession(s); setOpen(false); }} className="flex-1 flex items-center gap-2.5 text-left min-w-0">
                        <Database className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-light text-foreground truncate">{s.name}</p>
                          {s.companyName && <p className="text-[9px] text-muted-foreground/50 truncate">{s.companyName}</p>}
                        </div>
                      </button>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); startRename(s); }}
                          className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-all">
                          <Pencil className="h-3 w-3" />
                        </button>
                        {activeSession?.id !== s.id && confirmDeleteId !== s.id && (
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(s.id); }}
                            className="p-1 rounded text-muted-foreground/40 hover:text-destructive transition-all">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                        {confirmDeleteId === s.id && (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <span className="text-[9px] text-destructive font-medium mr-0.5">Delete?</span>
                            <button onClick={() => { deleteSession(s.id); setConfirmDeleteId(null); }}
                              className="p-1 rounded text-destructive hover:bg-destructive/10 transition-all">
                              <Check className="h-3 w-3" />
                            </button>
                            <button onClick={() => setConfirmDeleteId(null)}
                              className="p-1 rounded text-muted-foreground hover:text-foreground transition-all">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
              {sessions.length === 0 && !showCreate && (
                <p className="text-[10px] text-muted-foreground/40 text-center py-4">No sessions yet</p>
              )}
            </div>

            {/* Create new */}
            <div className="border-t border-border/20 p-2">
              {showCreate ? (
                <div className="space-y-2 p-1.5">
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Session name…"
                    className="w-full bg-background/50 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/30" autoFocus />
                  <input value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder="Company (optional)…"
                    className="w-full bg-background/50 border border-border/20 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/30" />
                  <div className="flex gap-2">
                    <button onClick={handleCreate} disabled={!newName.trim()}
                      className="flex-1 rounded-lg bg-accent/20 py-1.5 text-xs text-accent hover:bg-accent/30 transition-colors disabled:opacity-40">Create</button>
                    <button onClick={() => { setShowCreate(false); setNewName(""); setNewCompany(""); }}
                      className="rounded-lg border border-border/20 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowCreate(true)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-light text-accent hover:bg-accent/10 transition-colors">
                  <Plus className="h-3 w-3" /> New Session
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ErrorBoundary is now imported from @/components/ErrorBoundary


const AshaInner = () => {
  const [activeTab, setActiveTab] = useState<AshaTab>("ingest");
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { activeSession, loading } = useAshaSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcuts
  const shortcuts = [
    { key: 'u', metaKey: true, callback: () => { setActiveTab('ingest'); }, description: 'Go to Ingest' },
    { key: 'f', metaKey: true, callback: () => { const input = document.querySelector<HTMLInputElement>('input[type="text"]'); input?.focus(); }, description: 'Focus search' },
    { key: '/', metaKey: true, callback: () => setShowShortcuts(true), description: 'Show shortcuts' },
    { key: '1', metaKey: true, callback: () => setActiveTab('ingest'), description: 'Ingest tab' },
    { key: '2', metaKey: true, callback: () => setActiveTab('table'), description: 'Table tab' },
    { key: '3', metaKey: true, callback: () => setActiveTab('entities'), description: 'Entities tab' },
    { key: '4', metaKey: true, callback: () => setActiveTab('graph'), description: 'Graph tab' },
    { key: '5', metaKey: true, callback: () => setActiveTab('insights'), description: 'Insights tab' },
    { key: 'Escape', callback: () => setShowShortcuts(false), description: 'Close modals' },
  ];
  useKeyboardShortcuts(shortcuts);

  const navigateToTab = (tab: AshaTab, datasetId?: string) => {
    setActiveTab(tab);
    if (datasetId) setSelectedDatasetId(datasetId);
  };

  const renderPanel = () => {
    if (!activeSession) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <Database className="h-12 w-12 text-muted-foreground/20" />
          <div className="text-center">
            <p className="text-sm font-extralight text-muted-foreground">Create a session to start analyzing data</p>
            <p className="text-[10px] text-muted-foreground/40 mt-1">Each session scopes your datasets, insights, and analysis</p>
          </div>
        </div>
      );
    }

    const panel = (() => {
      switch (activeTab) {
        case "ingest": return <IngestPanel />;
        case "docintel": return <DocumentIntelligencePanel />;
        case "catalog": return <CatalogPanel />;
        case "table": return <DataTablePanel initialDatasetId={selectedDatasetId} />;
        case "graph": return <GraphViewPanel />;
        case "entities": return <EntitiesPanel />;
        case "lineage": return <DataLineagePanel />;
        case "pipelines": return <BranchPanel />;
        case "workflows": return <WorkflowPanel />;
        case "scenarios": return <ScenarioSimulatorPanel />;
        case "threats": return <ThreatModelingPanel />;
        case "dashboards": return <DashboardBuilderPanel />;
        case "insights": return <InsightsPanel />;
        case "monitoring": return <MonitoringPanel />;
        case "reports": return <ReportsPanel />;
        case "webintel": return <WebIntelligencePanel />;
        case "files": return <FilesPanel />;
        case "predictions": return <PredictionsPanel />;
        case "query": return <QueryBar />;
      }
    })();

    return <ErrorBoundary key={activeTab}>{panel}</ErrorBoundary>;
  };

  return (
    <TooltipProvider>
      <AshaNavContext.Provider value={{ navigateToTab }}>
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex-shrink-0 border-b border-border/20 bg-card/20 backdrop-blur-sm px-3 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-accent" />
                <div>
                  <h1 className="text-lg font-extralight tracking-wide text-foreground">ASHA</h1>
                  <p className="text-[10px] font-extralight tracking-[0.15em] text-muted-foreground/60 uppercase hidden sm:block">Data Intelligence Platform</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <SessionSelector />
                <EncryptionBadge />
                <div className="hidden md:flex items-center gap-1 rounded-lg border border-border/20 bg-card/30 px-2 py-1">
                  <Shield className="h-3 w-3 text-emerald-500/70" />
                  <span className="text-[10px] text-muted-foreground">PII Protected</span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => setShowShortcuts(true)} className="hidden sm:flex p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground transition-colors">
                      <Keyboard className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent><p>Keyboard shortcuts (⌘/)</p></TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Tab bar - scrollable with mobile touch targets */}
            {activeSession && (
              <div className="relative mt-3 sm:mt-4">
                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                  {tabs.map((tab) => (
                    <Tooltip key={tab.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => { setActiveTab(tab.id); setSelectedDatasetId(null); }}
                          className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 min-h-[40px] sm:min-h-0 text-xs font-light transition-colors ${
                            activeTab === tab.id
                              ? "bg-foreground/10 text-foreground"
                              : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                          }`}
                        >
                          <tab.icon className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{tab.label}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="sm:hidden"><p>{tab.label}</p></TooltipContent>
                    </Tooltip>
                  ))}
                </div>
                {/* Scroll fade indicator */}
                <div className="absolute right-0 top-0 bottom-1 w-6 bg-gradient-to-l from-card/20 to-transparent pointer-events-none sm:hidden" />
              </div>
            )}
          </div>

          {/* Panel content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
            ) : renderPanel()}
          </div>

          {/* Keyboard shortcuts modal */}
          {showShortcuts && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
              <div className="bg-card rounded-xl border border-border/20 p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-light text-foreground mb-4">Keyboard Shortcuts</h3>
                <div className="space-y-2">
                  {shortcuts.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{s.description}</span>
                      <kbd className="px-2 py-1 rounded bg-card/50 border border-border/20 text-xs font-mono text-foreground">
                        {s.metaKey && '⌘ '}{s.key === 'Escape' ? 'Esc' : s.key.toUpperCase()}
                      </kbd>
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowShortcuts(false)} className="mt-6 w-full px-4 py-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-sm">Close</button>
              </div>
            </div>
          )}
        </div>
      </AshaNavContext.Provider>
    </TooltipProvider>
  );
};

const AshaView = () => (
  <AshaSessionProvider>
    <AshaInner />
  </AshaSessionProvider>
);

export default AshaView;
