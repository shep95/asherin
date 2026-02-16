import { useState } from "react";
import {
  Upload, Table2, Share2, GitBranch, Workflow, LayoutDashboard,
  Lightbulb, MessageSquare, Database, Shield, BookOpen, FileOutput, Globe,
  Fingerprint, FlaskConical, GitCommitHorizontal, Target, Activity, Bell,
} from "lucide-react";
import type { AshaTab } from "./types";
import IngestPanel from "./IngestPanel";
import DataTablePanel from "./DataTablePanel";
import GraphViewPanel from "./GraphViewPanel";
import InsightsPanel from "./InsightsPanel";
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
import EncryptionBadge from "../EncryptionBadge";

const tabs: { id: AshaTab; icon: React.ElementType; label: string }[] = [
  { id: "ingest", icon: Upload, label: "Ingest" },
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
  { id: "query", icon: MessageSquare, label: "Ask Asha" },
];

const AshaView = () => {
  const [activeTab, setActiveTab] = useState<AshaTab>("ingest");

  const renderPanel = () => {
    switch (activeTab) {
      case "ingest": return <IngestPanel />;
      case "catalog": return <CatalogPanel />;
      case "table": return <DataTablePanel />;
      case "graph": return <GraphViewPanel />;
      case "entities": return <EntityResolutionPanel />;
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
      case "query": return <QueryBar />;
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 bg-card/20 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-accent" />
            <div>
              <h1 className="text-lg font-extralight tracking-wide text-foreground">ASHA</h1>
              <p className="text-[10px] font-extralight tracking-[0.15em] text-muted-foreground/60 uppercase">Data Intelligence Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <EncryptionBadge />
            <div className="flex items-center gap-1 rounded-lg border border-border/20 bg-card/30 px-2 py-1">
              <Shield className="h-3 w-3 text-emerald-500/70" />
              <span className="text-[10px] text-muted-foreground">PII Protected</span>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="mt-4 flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-light transition-colors ${
                activeTab === tab.id
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {renderPanel()}
      </div>
    </div>
  );
};

export default AshaView;
