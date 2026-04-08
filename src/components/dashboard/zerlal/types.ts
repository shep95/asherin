export type ZerlalScreen = "dashboard" | "project" | "finding" | "reports" | "integrations" | "settings" | "team";

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type FindingCategory = "memory-safety" | "injection" | "secrets" | "dependencies" | "logic" | "crypto" | "auth" | "config";
export type FindingStatus = "open" | "in-progress" | "resolved" | "waived";
export type ScanStatus = "idle" | "scanning" | "complete" | "failed";
export type RiskGrade = "A" | "B" | "C" | "D" | "F";

export interface ZerlalProject {
  id: string;
  name: string;
  repoUrl: string;
  lastScanAt: string | null;
  riskGrade: RiskGrade;
  scanDuration: number | null;
  language: string;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  status: ScanStatus;
}

export interface ZerlalFinding {
  id: string;
  projectId: string;
  severity: FindingSeverity;
  title: string;
  file: string;
  line: number;
  category: FindingCategory;
  confidence: number;
  age: number; // days
  assignee: string | null;
  status: FindingStatus;
  cweId: string;
  cvssScore: number;
  description: string;
  impact: string;
  codeSnippet: string;
  suggestedFix: string;
  dataflowTrace: { file: string; line: number; label: string }[];
  chainedWith: string[];
  complianceControls: string[];
  similarCves: string[];
  discoveredAt: string;
}

export interface ScanProfile {
  id: string;
  name: string;
  description: string;
  estimatedTime: string;
  includes: string[];
}

export interface IntegrationTile {
  id: string;
  name: string;
  category: "cicd" | "issues" | "comms" | "identity" | "siem" | "compliance";
  icon: string;
  connected: boolean;
}
