import React, { useState, useEffect, createContext, useContext } from "react";
import {
  Upload, Table2, Fingerprint, Brain, Lightbulb, FileOutput, Network, FileText,
  LayoutDashboard, PenLine, ClipboardList, Scale,
  Plus, Building2, ChevronDown, Trash2, Pencil, Check, X,
  Keyboard, ShieldCheck,
} from "lucide-react";
import type { AzplenTab } from "./types";
import IngestPanel from "./IngestPanel";
import DataTablePanel from "./DataTablePanel";
import EntityResolutionPanel from "./EntityResolutionPanel";
import PredictionsPanel from "./PredictionsPanel";
import InsightsPanel from "./InsightsPanel";
import ReportsPanel from "./ReportsPanel";
import GraphViewPanel from "./GraphViewPanel";
import DocumentIntelligencePanel from "./DocumentIntelligencePanel";
import InvestigationDashboardPanel from "./InvestigationDashboardPanel";
import CanvasPanel from "./CanvasPanel";
import CollectionPlanPanel from "./CollectionPlanPanel";
import HypothesisPanel from "./HypothesisPanel";
import ClassificationBadge from "./ClassificationBadge";
import EncryptionBadge from "../EncryptionBadge";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AzplenSessionProvider, useAzplenSession } from "./AzplenSessionContext";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Context for navigating between tabs from child panels (kept for back-compat)
const AzplenNavContext = createContext<{ navigateToTab: (tab: AzplenTab, datasetId?: string) => void }>({ navigateToTab: () => {} });
export const useAzplenNav = () => useContext(AzplenNavContext);

// Mission-phase grouped tab set — Palantir-style operator navigation.
type TabPhase = "Command" | "Collection" | "Analysis" | "Intelligence" | "Reporting";
const tabs: { id: AzplenTab; icon: React.ElementType; label: string; sub: string; phase: TabPhase }[] = [
  { id: "dashboard",   icon: LayoutDashboard, label: "Dashboard",      sub: "Investigation overview",   phase: "Command" },
  { id: "plan",        icon: ClipboardList,   label: "Collection Plan",sub: "Intelligence questions",   phase: "Command" },
  { id: "ingest",      icon: Upload,          label: "Ingest",         sub: "Upload financial data",    phase: "Collection" },
  { id: "docintel",    icon: FileText,        label: "Documents",      sub: "Document intelligence",    phase: "Collection" },
  { id: "table",       icon: Table2,          label: "Ledger",         sub: "Tabular review",           phase: "Collection" },
  { id: "entities",    icon: Fingerprint,     label: "Counterparties", sub: "Entity resolution",        phase: "Analysis" },
  { id: "graph",       icon: Network,         label: "Graph",          sub: "Document & entity mapping",phase: "Analysis" },
  { id: "canvas",      icon: PenLine,         label: "Canvas",         sub: "Argument workspace",       phase: "Analysis" },
  { id: "hypothesis",  icon: Scale,           label: "Hypotheses",     sub: "ACH-style testing",        phase: "Intelligence" },
  { id: "predictions", icon: Brain,           label: "Forecasts",      sub: "Predictive signals",       phase: "Intelligence" },
  { id: "insights",    icon: Lightbulb,       label: "Anomalies",      sub: "AI surfaced findings",     phase: "Intelligence" },
  { id: "reports",     icon: FileOutput,      label: "Reports",        sub: "Export & briefings",       phase: "Reporting" },
];
const TAB_PHASES: TabPhase[] = ["Command", "Collection", "Analysis", "Intelligence", "Reporting"];

// Live UTC chip — mirrors landing-page HudStatusBar register.
const LiveChip = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const utc = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}Z`;
  return (
    <div className="hidden md:flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] px-3 py-1.5 font-mono text-[10px] tracking-[0.22em] uppercase text-muted-foreground/70">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/80 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
      </span>
      <span className="text-emerald-300/90">LIVE</span>
      <span className="text-muted-foreground/40">UTC</span>
      <span className="text-foreground tabular-nums">{utc}</span>
    </div>
  );
};

const SessionSelector = () => {
  const { sessions, activeSession, setActiveSession, createSession, renameSession, deleteSession } = useAzplenSession();
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

  const confirmRename = async () => {
    if (renamingId && renameValue.trim()) await renameSession(renamingId, renameValue.trim());
    setRenamingId(null); setRenameValue("");
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] px-3 py-1.5 hover:border-amber-300/30 hover:bg-foreground/[0.04] transition-all">
        <Building2 className="h-3.5 w-3.5 text-amber-300/70" />
        <span className="text-xs font-extralight tracking-wide text-foreground max-w-[160px] truncate">
          {activeSession ? activeSession.name : "No Session"}
        </span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setShowCreate(false); setRenamingId(null); }} />
          <div className="absolute left-0 top-full mt-2 z-50 w-80 rounded-xl border border-foreground/10 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden">
            <div className="max-h-64 overflow-y-auto p-1.5">
              {sessions.map(s => (
                <div key={s.id} className={`flex items-center gap-2 rounded-lg px-3 py-2.5 transition-colors group ${activeSession?.id === s.id ? "bg-foreground/[0.06]" : "hover:bg-foreground/[0.03]"}`}>
                  {renamingId === s.id ? (
                    <div className="flex-1 flex items-center gap-1.5">
                      <input
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") confirmRename(); if (e.key === "Escape") setRenamingId(null); }}
                        className="flex-1 bg-foreground/[0.04] border border-foreground/10 rounded px-2 py-1 text-xs text-foreground outline-none focus:border-amber-300/40"
                        autoFocus onClick={e => e.stopPropagation()}
                      />
                      <button onClick={(e) => { e.stopPropagation(); confirmRename(); }} className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10"><Check className="h-3 w-3" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setRenamingId(null); }} className="p-1 rounded text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
                    </div>
                  ) : (
                    <>
                      <button onClick={() => { setActiveSession(s); setOpen(false); }} className="flex-1 flex items-center gap-2.5 text-left min-w-0">
                        <div className="h-1.5 w-1.5 rounded-full bg-amber-300/60 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-extralight tracking-wide text-foreground truncate">{s.name}</p>
                          {s.companyName && <p className="text-[9px] text-muted-foreground/50 truncate font-mono uppercase tracking-[0.15em]">{s.companyName}</p>}
                        </div>
                      </button>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={(e) => { e.stopPropagation(); setRenamingId(s.id); setRenameValue(s.name); }}
                          className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-all"><Pencil className="h-3 w-3" /></button>
                        {activeSession?.id !== s.id && confirmDeleteId !== s.id && (
                          <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(s.id); }}
                            className="p-1 rounded text-muted-foreground/40 hover:text-destructive transition-all"><Trash2 className="h-3 w-3" /></button>
                        )}
                        {confirmDeleteId === s.id && (
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <span className="text-[9px] text-destructive font-medium mr-0.5">Delete?</span>
                            <button onClick={() => { deleteSession(s.id); setConfirmDeleteId(null); }} className="p-1 rounded text-destructive hover:bg-destructive/10 transition-all"><Check className="h-3 w-3" /></button>
                            <button onClick={() => setConfirmDeleteId(null)} className="p-1 rounded text-muted-foreground hover:text-foreground transition-all"><X className="h-3 w-3" /></button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
              {sessions.length === 0 && !showCreate && (
                <p className="text-[10px] text-muted-foreground/40 text-center py-6 tracking-[0.2em] uppercase font-extralight">No sessions yet</p>
              )}
            </div>

            <div className="border-t border-foreground/10 p-2">
              {showCreate ? (
                <div className="space-y-2 p-1.5">
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Session name…"
                    className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-amber-300/40 font-extralight" autoFocus />
                  <input value={newCompany} onChange={e => setNewCompany(e.target.value)} placeholder="Company (optional)…"
                    className="w-full bg-foreground/[0.04] border border-foreground/10 rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-amber-300/40 font-extralight" />
                  <div className="flex gap-2">
                    <button onClick={handleCreate} disabled={!newName.trim()}
                      className="flex-1 rounded-lg bg-amber-300/10 border border-amber-300/20 py-1.5 text-xs text-amber-200 hover:bg-amber-300/20 transition-colors disabled:opacity-40 tracking-wide">Create</button>
                    <button onClick={() => { setShowCreate(false); setNewName(""); setNewCompany(""); }}
                      className="rounded-lg border border-foreground/10 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowCreate(true)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-extralight tracking-wide text-amber-200 hover:bg-amber-300/10 transition-colors">
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

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center h-full gap-6 px-6">
    <div className="relative">
      <div className="absolute inset-0 -m-10 rounded-full bg-amber-400/[0.04] blur-2xl" />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-foreground/10 bg-foreground/[0.02]">
        <Building2 className="h-7 w-7 text-amber-300/70" strokeWidth={1} />
      </div>
    </div>
    <div className="text-center space-y-2 max-w-md">
      <h2 className="text-2xl font-extralight tracking-tight text-foreground">Open a financial session</h2>
      <p className="text-sm font-extralight leading-relaxed text-muted-foreground">
        Each session scopes one company, fund, or book. Upload ledgers, resolve counterparties, surface anomalies, and export defensible reports — all isolated per session.
      </p>
    </div>
  </div>
);

const AzplenInner = () => {
  const [activeTab, setActiveTab] = useState<AzplenTab>("dashboard");
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const { activeSession, loading } = useAzplenSession();

  const shortcuts = [
    { key: 'u', metaKey: true, callback: () => setActiveTab('ingest'), description: 'Ingest' },
    { key: '1', metaKey: true, callback: () => setActiveTab('ingest'), description: 'Ingest' },
    { key: '2', metaKey: true, callback: () => setActiveTab('table'), description: 'Ledger' },
    { key: '3', metaKey: true, callback: () => setActiveTab('entities'), description: 'Counterparties' },
    { key: '4', metaKey: true, callback: () => setActiveTab('predictions'), description: 'Forecasts' },
    { key: '5', metaKey: true, callback: () => setActiveTab('insights'), description: 'Anomalies' },
    { key: '6', metaKey: true, callback: () => setActiveTab('reports'), description: 'Reports' },
    { key: '/', metaKey: true, callback: () => setShowShortcuts(true), description: 'Shortcuts' },
    { key: 'Escape', callback: () => setShowShortcuts(false), description: 'Close' },
  ];
  useKeyboardShortcuts(shortcuts);

  const navigateToTab = (tab: AzplenTab, datasetId?: string) => {
    setActiveTab(tab);
    if (datasetId) setSelectedDatasetId(datasetId);
  };

  const renderPanel = () => {
    if (!activeSession) return <EmptyState />;
    const panel = (() => {
      switch (activeTab) {
        case "dashboard":   return <InvestigationDashboardPanel />;
        case "plan":        return <CollectionPlanPanel />;
        case "ingest":      return <IngestPanel />;
        case "table":       return <DataTablePanel initialDatasetId={selectedDatasetId} />;
        case "entities":    return <EntityResolutionPanel />;
        case "docintel":    return <DocumentIntelligencePanel />;
        case "graph":       return <GraphViewPanel />;
        case "canvas":      return <CanvasPanel />;
        case "hypothesis":  return <HypothesisPanel />;
        case "predictions": return <PredictionsPanel />;
        case "insights":    return <InsightsPanel />;
        case "reports":     return <ReportsPanel />;
        default:            return <InvestigationDashboardPanel />;
      }
    })();
    return <ErrorBoundary key={activeTab}>{panel}</ErrorBoundary>;
  };

  const activeMeta = tabs.find(t => t.id === activeTab) ?? tabs[0];

  return (
    <TooltipProvider>
      <AzplenNavContext.Provider value={{ navigateToTab }}>
        <div className="relative flex h-full flex-col overflow-hidden">
          {/* Ambient backdrop — landing-page register */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/3 h-[420px] w-[420px] rounded-full bg-foreground/[0.03] blur-3xl" />
            <div className="absolute bottom-0 right-1/4 h-[320px] w-[320px] rounded-full bg-amber-400/[0.03] blur-3xl" />
          </div>

          {/* Header */}
          <div className="flex-shrink-0 border-b border-foreground/10 bg-foreground/[0.02] backdrop-blur-xl px-4 sm:px-8 py-4 sm:py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/[0.02]">
                  <span className="font-mono text-[10px] tracking-[0.2em] text-amber-300/80">AZ</span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-extralight tracking-tight text-foreground">AZPLEN</h1>
                    <span className="hidden sm:inline-flex items-center rounded-full border border-amber-300/20 bg-amber-300/[0.04] px-2 py-0.5 text-[9px] font-mono uppercase tracking-[0.22em] text-amber-200/80">Financial Core</span>
                  </div>
                  <p className="text-[10px] sm:text-[11px] font-extralight tracking-[0.22em] text-muted-foreground/60 uppercase mt-0.5 truncate">
                    Forensic Financial Intelligence
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <SessionSelector />
                <ClassificationBadge />
                <LiveChip />
                <EncryptionBadge />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button onClick={() => setShowShortcuts(true)} className="hidden sm:flex p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-foreground/[0.04] transition-colors">
                      <Keyboard className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent><p>Shortcuts (Ctrl+/)</p></TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Tab strip */}
            {activeSession && (
              <div className="relative mt-5 -mx-1">
                <div className="flex gap-1 overflow-x-auto pb-1 px-1 scrollbar-none">
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setSelectedDatasetId(null); }}
                        className={`group relative flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-extralight tracking-wide transition-all ${
                          isActive
                            ? "bg-foreground/[0.05] text-foreground border border-foreground/10"
                            : "text-muted-foreground hover:text-foreground border border-transparent hover:bg-foreground/[0.02]"
                        }`}
                      >
                        <tab.icon className={`h-3.5 w-3.5 ${isActive ? "text-amber-300/80" : "text-muted-foreground/60 group-hover:text-foreground/70"}`} strokeWidth={1.25} />
                        <span>{tab.label}</span>
                        {isActive && (
                          <span className="absolute -bottom-px left-4 right-4 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden" />
              </div>
            )}

            {/* Active panel descriptor */}
            {activeSession && (
              <div className="mt-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground/50">
                <ShieldCheck className="h-3 w-3 text-emerald-400/60" />
                <span>{activeMeta.label}</span>
                <span className="text-muted-foreground/30">·</span>
                <span className="normal-case font-sans tracking-normal font-extralight">{activeMeta.sub}</span>
              </div>
            )}
          </div>

          {/* Panel content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="h-4 w-4 animate-spin rounded-full border border-amber-300/40 border-t-transparent" />
              </div>
            ) : renderPanel()}
          </div>

          {/* Shortcuts modal */}
          {showShortcuts && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md" onClick={() => setShowShortcuts(false)}>
              <div className="rounded-2xl border border-foreground/10 bg-background/95 backdrop-blur-xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-base font-extralight tracking-wide text-foreground mb-5">Keyboard shortcuts</h3>
                <div className="space-y-2">
                  {shortcuts.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-extralight">{s.description}</span>
                      <kbd className="px-2 py-1 rounded bg-foreground/[0.04] border border-foreground/10 text-[10px] font-mono text-foreground tracking-wider">
                        {s.metaKey && 'Ctrl+'}{s.key === 'Escape' ? 'Esc' : s.key.toUpperCase()}
                      </kbd>
                    </div>
                  ))}
                </div>
                <button onClick={() => setShowShortcuts(false)} className="mt-6 w-full px-4 py-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.04] text-amber-200 hover:bg-amber-300/10 transition-colors text-xs tracking-wide font-extralight">Close</button>
              </div>
            </div>
          )}
        </div>
      </AzplenNavContext.Provider>
    </TooltipProvider>
  );
};

const AzplenView = () => (
  <AzplenSessionProvider>
    <AzplenInner />
  </AzplenSessionProvider>
);

export default AzplenView;
