import { useState, useRef, useCallback } from "react";
import { Upload, FileText, Image, FileCode, CheckCircle2, AlertTriangle, Loader2, X, Edit3, ChevronDown, ChevronUp } from "lucide-react";
import type { AshaFile, AshaColumn, DataIssue, ColumnType, ColumnRole } from "./types";
import { ScrollArea } from "@/components/ui/scroll-area";

const fileIcon = (type: string) => {
  if (type.startsWith("image/")) return Image;
  if (type.includes("javascript") || type.includes("json") || type.includes("csv") || type.includes("xml")) return FileCode;
  return FileText;
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Simulates auto-schema detection for MVP
const detectSchema = (fileName: string): AshaColumn[] => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "csv" || ext === "xlsx" || ext === "json") {
    return [
      { name: "id", type: "id", role: "primary_key", nullable: false, uniqueCount: 100, nullCount: 0, sampleValues: ["1", "2", "3"] },
      { name: "name", type: "string", role: "dimension", nullable: false, uniqueCount: 95, nullCount: 0, sampleValues: ["Alice", "Bob"] },
      { name: "email", type: "email", role: "pii", nullable: true, uniqueCount: 90, nullCount: 5, sampleValues: ["a@b.com"], isPII: true },
      { name: "amount", type: "currency", role: "measure", nullable: false, uniqueCount: 80, nullCount: 0, sampleValues: ["$100", "$250"] },
      { name: "date", type: "date", role: "date_field", nullable: false, uniqueCount: 30, nullCount: 0, sampleValues: ["2026-01-15"] },
      { name: "region", type: "category", role: "dimension", nullable: false, uniqueCount: 5, nullCount: 0, sampleValues: ["US", "EU", "APAC"] },
    ];
  }
  return [
    { name: "content", type: "freetext", role: "auto", nullable: false, uniqueCount: 0, nullCount: 0, sampleValues: [] },
  ];
};

const detectIssues = (): DataIssue[] => [
  { type: "duplicate", description: "143 duplicate rows detected based on [id] column", rowCount: 143, severity: "medium", autoFixAvailable: true },
  { type: "null", description: "Missing values in [email] field", rowCount: 2841, severity: "low", autoFixAvailable: true },
  { type: "outlier", description: "Unusually low values in [amount] ($0.01)", rowCount: 23, severity: "high", autoFixAvailable: false },
];

const IngestPanel = () => {
  const [files, setFiles] = useState<AshaFile[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const ingestFiles = useCallback((fileList: FileList | File[]) => {
    const arr = Array.from(fileList);
    const newFiles: AshaFile[] = arr.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
      type: f.type || "application/octet-stream",
      status: "analyzing" as const,
      createdAt: new Date(),
    }));
    setFiles((prev) => [...newFiles, ...prev]);

    // Simulate analysis
    newFiles.forEach((nf) => {
      setTimeout(() => {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === nf.id
              ? {
                  ...f,
                  status: "ready" as const,
                  rowCount: Math.floor(Math.random() * 50000) + 500,
                  colCount: Math.floor(Math.random() * 20) + 3,
                  qualityScore: Math.floor(Math.random() * 15) + 85,
                  schema: detectSchema(nf.name),
                  issues: detectIssues(),
                  dateRange: "Jan 1 — Dec 31, 2025",
                }
              : f
          )
        );
      }, 1500 + Math.random() * 2000);
    });
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) ingestFiles(e.dataTransfer.files);
  };

  const removeFile = (id: string) => setFiles((prev) => prev.filter((f) => f.id !== id));

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed transition-colors p-10 text-center ${
          dragOver ? "border-accent/50 bg-accent/5" : "border-border/30 bg-card/10 hover:border-border/50"
        }`}
      >
        <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm font-light text-foreground">Drop files here or click to browse</p>
        <p className="text-[10px] text-muted-foreground/50 mt-2">
          CSV, JSON, XLSX, XML, PDF, SQL, Parquet, GeoJSON — up to 500MB per file
        </p>
        <input ref={inputRef} type="file" multiple className="hidden" accept=".csv,.json,.jsonl,.xlsx,.xls,.xml,.pdf,.sql,.parquet,.geojson,.txt,.log,.yaml,.yml,.toml" onChange={(e) => { if (e.target.files) ingestFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {/* File cards */}
      {files.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-light tracking-[0.1em] text-muted-foreground/60 uppercase">Landing Zone</h3>
          {files.map((file) => {
            const Icon = fileIcon(file.type);
            const isExpanded = expandedFile === file.id;
            return (
              <div key={file.id} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm overflow-hidden">
                {/* File header */}
                <div className="flex items-center gap-3 p-4">
                  <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-light text-foreground truncate">{file.name}</p>
                      {file.status === "analyzing" && <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />}
                      {file.status === "ready" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground/50">{formatSize(file.size)}</span>
                      {file.rowCount && <span className="text-[10px] text-muted-foreground/50">{file.rowCount.toLocaleString()} rows</span>}
                      {file.colCount && <span className="text-[10px] text-muted-foreground/50">{file.colCount} columns</span>}
                      {file.qualityScore && (
                        <span className={`text-[10px] ${file.qualityScore >= 90 ? "text-emerald-500/70" : file.qualityScore >= 75 ? "text-amber-500/70" : "text-destructive/70"}`}>
                          {file.qualityScore}% quality
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {file.status === "ready" && (
                      <button onClick={() => setExpandedFile(isExpanded ? null : file.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    )}
                    <button onClick={() => removeFile(file.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && file.status === "ready" && (
                  <div className="border-t border-border/20 p-4 space-y-4">
                    {/* Schema */}
                    {file.schema && (
                      <div>
                        <h4 className="text-[10px] font-light tracking-[0.1em] text-muted-foreground/60 uppercase mb-2">Detected Schema</h4>
                        <div className="space-y-1">
                          {file.schema.map((col) => (
                            <div key={col.name} className="flex items-center gap-3 rounded-lg bg-card/30 px-3 py-2 text-xs">
                              <span className="font-mono text-foreground w-28 truncate">{col.name}</span>
                              <span className="rounded bg-secondary/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">{col.type}</span>
                              <span className="rounded bg-secondary/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">{col.role.replace("_", " ")}</span>
                              {col.isPII && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-400">PII ⚠️</span>}
                              {col.nullCount !== undefined && col.nullCount > 0 && (
                                <span className="text-[10px] text-muted-foreground/50">{col.nullCount} nulls</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Issues */}
                    {file.issues && file.issues.length > 0 && (
                      <div>
                        <h4 className="text-[10px] font-light tracking-[0.1em] text-muted-foreground/60 uppercase mb-2">Data Issues</h4>
                        <div className="space-y-1.5">
                          {file.issues.map((issue, i) => (
                            <div key={i} className="flex items-center justify-between rounded-lg bg-card/30 px-3 py-2">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className={`h-3.5 w-3.5 ${issue.severity === "high" ? "text-destructive" : issue.severity === "medium" ? "text-amber-500" : "text-muted-foreground"}`} />
                                <span className="text-xs font-light text-foreground">{issue.description}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">{issue.rowCount.toLocaleString()} rows</span>
                                {issue.autoFixAvailable && (
                                  <button className="rounded-md bg-accent/20 px-2 py-0.5 text-[10px] text-accent hover:bg-accent/30 transition-colors">Auto-fix</button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      <button className="rounded-lg bg-foreground/10 px-4 py-2 text-xs font-light text-foreground hover:bg-foreground/15 transition-colors">
                        Approve & Ingest
                      </button>
                      <button className="rounded-lg border border-border/20 px-4 py-2 text-xs font-light text-muted-foreground hover:text-foreground transition-colors">
                        <Edit3 className="h-3 w-3 inline mr-1" />
                        Edit Schema
                      </button>
                      <button onClick={() => removeFile(file.id)} className="rounded-lg border border-border/20 px-4 py-2 text-xs font-light text-muted-foreground hover:text-destructive transition-colors">
                        Discard
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {files.length === 0 && (
        <div className="text-center py-8">
          <p className="text-xs text-muted-foreground/40 font-extralight">Upload files to begin your intelligence analysis</p>
        </div>
      )}
    </div>
  );
};

export default IngestPanel;
