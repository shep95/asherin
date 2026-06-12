import { useState, lazy, Suspense } from "react";
import { Shield, Bell, Plus } from "lucide-react";
import ZerlalNav from "./ZerlalNav";
import DashboardScreen from "./DashboardScreen";
import ProjectView from "./ProjectView";
import FindingDetail from "./FindingDetail";
import ReportsScreen from "./ReportsScreen";
import IntegrationsScreen from "./IntegrationsScreen";
import IntelligenceModule from "./IntelligenceModule";
import DeviceSecurityScanner from "./DeviceSecurityScanner";
import DomainReconScreen from "./DomainReconScreen";
import ScanModal from "./ScanModal";
import { useZerlalFindings } from "./useZerlalData";
import type { ZerlalScreen } from "./types";
import { ScanProvider } from "./scanContext";

const SigmaRuleEngine = lazy(() => import("./SigmaRuleEngine"));
const StixTaxiiFeed = lazy(() => import("./StixTaxiiFeed"));
const LogCorrelationEngine = lazy(() => import("./LogCorrelationEngine"));
const CertTransparencyMonitor = lazy(() => import("./CertTransparencyMonitor"));
const CodeVulnScanner = lazy(() => import("./CodeVulnScanner"));
const PortScannerUI = lazy(() => import("./PortScannerUI"));
const WhoisTimeline = lazy(() => import("./WhoisTimeline"));
const TorExitNodeChecker = lazy(() => import("./TorExitNodeChecker"));
const TeamScreen = lazy(() => import("./TeamScreen"));
const SettingsScreen = lazy(() => import("./SettingsScreen"));

const intelligenceScreens: ZerlalScreen[] = [
  "compliance", "supply-chain", "quantum", "ai-security", "zero-trust",
  "ot-ics", "incident", "threat-intel", "dark-web", "ueba", "red-team",
  "exec-risk", "cvd-pipeline", "device-security", "governance", "deployment", "workforce", "pattern-engine"
];

const ZerlalView = () => {
  const [activeScreen, setActiveScreen] = useState<ZerlalScreen>("dashboard");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const { findings } = useZerlalFindings();
  const criticalCount = findings.filter(f => f.severity === "critical" && f.status === "open").length;

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
    setActiveScreen(selectedProjectId ? "project" : "dashboard");
  };

  const handleScanComplete = () => {
    setRefreshKey(k => k + 1);
  };

  const handleScanStarted = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveScreen("project");
    setScanModalOpen(false);
    setRefreshKey(k => k + 1);
  };

  const renderScreen = () => {
    const toolScreens: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
      "sigma-rules": SigmaRuleEngine,
      "stix-feed": StixTaxiiFeed,
      "log-correlation": LogCorrelationEngine,
      "cert-transparency": CertTransparencyMonitor,
      "code-scanner": CodeVulnScanner,
      "port-scanner": PortScannerUI,
      "whois-timeline": WhoisTimeline,
      "tor-checker": TorExitNodeChecker,
    };

    if (activeScreen in toolScreens) {
      const Component = toolScreens[activeScreen];
      return <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="text-[10px] text-muted-foreground/30">Loading...</div></div>}><Component /></Suspense>;
    }

    if (activeScreen === "domain-recon") {
      return <DomainReconScreen onSelectFinding={handleSelectFinding} />;
    }

    if (activeScreen === "device-security") {
      return <DeviceSecurityScanner />;
    }

    if (intelligenceScreens.includes(activeScreen)) {
      return <IntelligenceModule screen={activeScreen} />;
    }

    switch (activeScreen) {
      case "dashboard":
        return (
          <DashboardScreen
            key={refreshKey}
            onNavigate={handleNavigate}
            onSelectProject={handleSelectProject}
            onSelectFinding={handleSelectFinding}
            onOpenScan={() => setScanModalOpen(true)}
          />
        );
      case "project":
        return (
          <ProjectView
            key={`${selectedProjectId}-${refreshKey}`}
            projectId={selectedProjectId}
            onSelectProject={handleSelectProject}
            onSelectFinding={handleSelectFinding}
            onBack={handleBackFromProject}
            onRetryScan={() => setScanModalOpen(true)}
          />
        );
      case "finding":
        return selectedFindingId ? (
          <FindingDetail key={selectedFindingId} findingId={selectedFindingId} onBack={handleBackFromFinding} />
        ) : (
          <ProjectView projectId={null} onSelectProject={handleSelectProject} onSelectFinding={handleSelectFinding} onBack={handleBackFromProject} onRetryScan={() => setScanModalOpen(true)} />
        );
      case "reports":
        return <ReportsScreen />;
      case "integrations":
        return <IntegrationsScreen />;
      case "team":
        return (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="text-[10px] text-muted-foreground/30">Loading...</div></div>}>
            <TeamScreen />
          </Suspense>
        );
      case "settings":
        return (
          <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="text-[10px] text-muted-foreground/30">Loading...</div></div>}>
            <SettingsScreen />
          </Suspense>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top Bar */}
      <div className="shrink-0 border-b border-border/[0.06] px-5 py-2.5 flex items-center justify-between backdrop-blur-md bg-background/40">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-foreground/[0.04] border border-border/[0.08] flex items-center justify-center">
            <Shield className="h-3.5 w-3.5 text-foreground/60" />
          </div>
          <div>
            <h1 className="text-[11px] font-light tracking-[0.12em] text-foreground/90 uppercase">Zerlal</h1>
            <p className="text-[8px] text-muted-foreground/30 tracking-[0.15em] uppercase">Cyber Intelligence Engine</p>
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
            {criticalCount > 0 && <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-400" />}
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <ZerlalNav activeScreen={activeScreen} onNavigate={handleNavigate} criticalCount={criticalCount} />
        {renderScreen()}
      </div>

      <ScanModal open={scanModalOpen} onClose={() => setScanModalOpen(false)} onScanComplete={handleScanComplete} />
    </div>
  );
};

export default ZerlalView;
