import { useState } from "react";
import { Shield, Bell, Plus, Users } from "lucide-react";
import ZerlalNav from "./ZerlalNav";
import DashboardScreen from "./DashboardScreen";
import ProjectView from "./ProjectView";
import FindingDetail from "./FindingDetail";
import ReportsScreen from "./ReportsScreen";
import IntegrationsScreen from "./IntegrationsScreen";
import ScanModal from "./ScanModal";
import { mockFindings } from "./mockData";
import type { ZerlalScreen } from "./types";

const ZerlalView = () => {
  const [activeScreen, setActiveScreen] = useState<ZerlalScreen>("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);

  const criticalCount = mockFindings.filter((f) => f.severity === "critical" && f.status === "open").length;

  const handleNavigate = (screen: ZerlalScreen) => {
    setActiveScreen(screen);
    if (screen !== "project") setSelectedProjectId(null);
    if (screen !== "finding") setSelectedFindingId(null);
  };

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setActiveScreen("project");
  };

  const handleSelectFinding = (id: string) => {
    setSelectedFindingId(id);
    setActiveScreen("finding");
  };

  const handleBackFromProject = () => {
    setSelectedProjectId(null);
    setActiveScreen("dashboard");
  };

  const handleBackFromFinding = () => {
    setSelectedFindingId(null);
    if (selectedProjectId) {
      setActiveScreen("project");
    } else {
      setActiveScreen("dashboard");
    }
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case "dashboard":
        return (
          <DashboardScreen
            onNavigate={handleNavigate}
            onSelectProject={handleSelectProject}
            onSelectFinding={handleSelectFinding}
          />
        );
      case "project":
        return (
          <ProjectView
            projectId={selectedProjectId}
            onSelectFinding={handleSelectFinding}
            onBack={handleBackFromProject}
          />
        );
      case "finding":
        return selectedFindingId ? (
          <FindingDetail findingId={selectedFindingId} onBack={handleBackFromFinding} />
        ) : (
          <ProjectView projectId={null} onSelectFinding={handleSelectFinding} onBack={handleBackFromProject} />
        );
      case "reports":
        return <ReportsScreen />;
      case "integrations":
        return <IntegrationsScreen />;
      case "settings":
      case "team":
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 rounded-xl bg-foreground/[0.03] border border-border/[0.06] flex items-center justify-center mx-auto mb-3">
                {activeScreen === "team" ? <Users className="h-5 w-5 text-muted-foreground/20" /> : <Shield className="h-5 w-5 text-muted-foreground/20" />}
              </div>
              <p className="text-[11px] text-muted-foreground/30">{activeScreen === "team" ? "Team Management" : "Settings"} — Coming Soon</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top Bar */}
      <div className="shrink-0 border-b border-border/[0.06] px-5 py-3 flex items-center justify-between backdrop-blur-md bg-background/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-foreground/[0.04] border border-border/[0.08] flex items-center justify-center">
            <Shield className="h-3.5 w-3.5 text-foreground/60" />
          </div>
          <div>
            <h1 className="text-[11px] font-light tracking-[0.12em] text-foreground/90 uppercase">Zerlal</h1>
            <p className="text-[8px] text-muted-foreground/30 tracking-[0.15em] uppercase">Vulnerability Intelligence Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScanModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/[0.06] text-[10px] text-foreground/60 hover:bg-foreground/[0.1] transition-colors"
          >
            <Plus className="h-3 w-3" /> Scan Now
          </button>
          <button className="p-2 rounded-lg hover:bg-foreground/[0.03] transition-colors relative">
            <Bell className="h-3.5 w-3.5 text-muted-foreground/30" />
            {criticalCount > 0 && (
              <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-400" />
            )}
          </button>
          <div className="flex items-center gap-1.5 ml-1">
            <Users className="h-3 w-3 text-muted-foreground/20" />
            <span className="text-[9px] text-muted-foreground/25">3</span>
            <button className="text-[9px] text-muted-foreground/30 hover:text-foreground/50 ml-1">Invite</button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        <ZerlalNav activeScreen={activeScreen} onNavigate={handleNavigate} criticalCount={criticalCount} />
        {renderScreen()}
      </div>

      <ScanModal open={scanModalOpen} onClose={() => setScanModalOpen(false)} />
    </div>
  );
};

export default ZerlalView;
