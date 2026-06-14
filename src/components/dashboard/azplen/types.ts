export type AzplenTab =
  | "dashboard" | "ingest" | "table" | "graph" | "pipelines" | "workflows"
  | "dashboards" | "insights" | "query" | "catalog" | "reports"
  | "webintel" | "entities" | "scenarios" | "lineage" | "threats" | "monitoring"
  | "docintel" | "files" | "predictions"
  | "pipeline-builder" | "ontology" | "workshop" | "quiver"
  | "aip-logic" | "aip-bootcamps" | "action-engine"
  | "canvas" | "plan" | "hypothesis"
  | "memory" | "playbooks" | "cases" | "workload"
  | "streams" | "evidence" | "contradictions" | "redteam"
  | "library" | "review" | "fusion"
  | "dq" | "transform" | "cluster" | "behavior" | "flows"
  | "threats-forecast" | "integrations" | "field" | "training" | "auto-questions";

export type AzplenClassification =
  | "UNCLASS" | "CUI" | "CONFIDENTIAL" | "SECRET" | "TOP SECRET" | "TS/SCI";

export interface AzplenFile {
  id: string;
  name: string;
  size: number;
  type: string;
  status: "analyzing" | "ready" | "error";
  rowCount?: number;
  colCount?: number;
  qualityScore?: number;
  schema?: AzplenColumn[];
  dateRange?: string;
  issues?: DataIssue[];
  storagePath?: string;
  createdAt: Date;
  projectId?: string;
}

export interface AzplenColumn {
  name: string;
  type: ColumnType;
  role: ColumnRole;
  nullable: boolean;
  uniqueCount?: number;
  nullCount?: number;
  sampleValues?: string[];
  isPII?: boolean;
}

export type ColumnType =
  | "integer" | "float" | "string" | "date" | "datetime"
  | "boolean" | "email" | "phone" | "url" | "address"
  | "currency" | "percentage" | "id" | "category"
  | "latlong" | "json" | "freetext" | "unknown";

export type ColumnRole =
  | "primary_key" | "foreign_key" | "join_key"
  | "date_field" | "measure" | "dimension"
  | "pii" | "ignore" | "auto";

export interface DataIssue {
  type: "duplicate" | "null" | "outlier" | "format" | "conflict";
  description: string;
  rowCount: number;
  severity: "low" | "medium" | "high";
  autoFixAvailable: boolean;
}

export interface Insight {
  id: string;
  type: "trend" | "anomaly" | "relationship" | "correlation" | "gap" | "forecast";
  icon: string;
  title: string;
  description: string;
  createdAt: Date;
  dismissed: boolean;
}

export interface DataBranch {
  id: string;
  name: string;
  parentId: string | null;
  isMain: boolean;
  isProtected: boolean;
  transformCount: number;
  createdAt: Date;
  conflicts?: number;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  category: "finance" | "sales" | "operations" | "hr" | "marketing";
  description: string;
  triggerType: string;
}

export interface PipelineNode {
  id: string;
  type: "source" | "filter" | "join" | "transform" | "aggregate" | "enrich" | "output";
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}
