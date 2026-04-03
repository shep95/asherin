/** CROSS Workflow Intelligence - Type Definitions */

export type WorkflowNodeType = "application" | "action" | "decision" | "data" | "integration" | "wait";
export type WorkflowEdgeType = "sequential" | "data_flow" | "conditional" | "parallel" | "loop";
export type WorkflowStatus = "active" | "completed" | "paused" | "error";
export type DetailLevel = 1 | 2 | 3 | 4 | 5;

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  timestamp: string;
  duration: number; // seconds
  screenshotUrl?: string;
  screenshotData?: string; // base64 thumbnail
  metadata: Record<string, any>;
  result?: "success" | "failure" | "partial" | "pending";
  children?: WorkflowNode[]; // sub-steps for drill-down
  // Decision-specific
  options?: string[];
  choiceMade?: string;
  // Data-specific
  dataFormat?: string;
  dataSize?: number;
  operations?: string[];
  // Position for rendering
  x?: number;
  y?: number;
  column?: number;
  row?: number;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type: WorkflowEdgeType;
  label?: string;
  duration?: number;
  transform?: string;
  probability?: number;
  iterationCount?: number;
}

export interface WorkflowMetrics {
  totalSteps: number;
  decisionPoints: number;
  applicationsUsed: number;
  filesAccessed: number;
  efficiencyScore: number;
  totalDuration: number;
  waitTime: number;
  activeTime: number;
  errorCount: number;
  loopCount: number;
}

export interface WorkflowInsight {
  id: string;
  type: "repetitive" | "bottleneck" | "error_pattern" | "efficiency" | "collaboration" | "skill_gap" | "data_quality" | "automation";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  impact: string;
  recommendation: string;
  potentialSavings?: string;
  automationPotential?: number; // 0-100
  occurrences?: number;
  affectedNodes: string[];
}

export interface WorkflowOptimization {
  id: string;
  title: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  savingsMinutes: number;
  description: string;
  currentApproach: string;
  optimizedApproach: string;
  implementationSteps: string[];
  roi: string;
}

export interface WorkflowGraph {
  id: string;
  name: string;
  startTime: string;
  endTime?: string;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metrics: WorkflowMetrics;
  insights: WorkflowInsight[];
  optimizations: WorkflowOptimization[];
  phases: WorkflowPhase[];
  sessionId?: string;
}

export interface WorkflowPhase {
  id: string;
  name: string;
  startIndex: number;
  endIndex: number;
  duration: number;
  nodeIds: string[];
  status: "completed" | "active" | "pending";
}

export interface WorkflowHistoryEntry {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  duration: number;
  stepCount: number;
  efficiencyScore: number;
  applicationsUsed: string[];
  status: WorkflowStatus;
}

/** Layout mode for graph rendering */
export type LayoutMode = "hierarchical" | "timeline" | "force" | "circular";
