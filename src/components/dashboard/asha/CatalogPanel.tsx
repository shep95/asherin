import { useState } from "react";
import { Search, Tag, Calendar, User, Table2, GitBranch, Eye, Plus, ExternalLink, Clock, FileText } from "lucide-react";

interface CatalogEntry {
  id: string;
  name: string;
  project: string;
  branch: string;
  rows: number;
  columns: number;
  lastUpdated: Date;
  tags: string[];
  owner: string;
  qualityScore: number;
  fileType: string;
  description?: string;
}

const MOCK_CATALOG: CatalogEntry[] = [
  { id: "1", name: "sales_q4_2025.csv", project: "Q4 Review", branch: "main", rows: 47832, columns: 14, lastUpdated: new Date(Date.now() - 7200000), tags: ["sales", "Q4", "2025", "revenue"], owner: "Asher Newton", qualityScore: 94, fileType: "csv", description: "Quarterly sales data including all transaction records, customer IDs, and regional breakdowns." },
  { id: "2", name: "customers.csv", project: "Q4 Review", branch: "main", rows: 12441, columns: 22, lastUpdated: new Date(Date.now() - 86400000), tags: ["customers", "CRM", "demographics"], owner: "Asher Newton", qualityScore: 88, fileType: "csv", description: "Full customer database with demographics, contact info, and account history." },
  { id: "3", name: "marketing_spend.xlsx", project: "Q4 Review", branch: "main", rows: 3840, columns: 8, lastUpdated: new Date(Date.now() - 86400000 * 3), tags: ["marketing", "budget", "campaigns"], owner: "Asher Newton", qualityScore: 97, fileType: "xlsx" },
  { id: "4", name: "support_tickets.csv", project: "Q4 Review", branch: "main", rows: 8921, columns: 11, lastUpdated: new Date(Date.now() - 86400000 * 2), tags: ["support", "tickets", "customer-service"], owner: "Asher Newton", qualityScore: 91, fileType: "csv" },
  { id: "5", name: "inventory.xlsx", project: "Operations", branch: "main", rows: 5200, columns: 16, lastUpdated: new Date(Date.now() - 86400000 * 5), tags: ["inventory", "products", "SKU"], owner: "Asher Newton", qualityScore: 82, fileType: "xlsx" },
  { id: "6", name: "employee_directory.json", project: "HR Analytics", branch: "main", rows: 342, columns: 18, lastUpdated: new Date(Date.now() - 86400000 * 7), tags: ["HR", "employees", "directory"], owner: "Asher Newton", qualityScore: 100, fileType: "json" },
  { id: "7", name: "web_analytics.csv", project: "Marketing", branch: "q1-analysis", rows: 128000, columns: 24, lastUpdated: new Date(Date.now() - 3600000 * 4), tags: ["analytics", "web", "traffic", "conversions"], owner: "Asher Newton", qualityScore: 96, fileType: "csv" },
  { id: "8", name: "finance_report.xlsx", project: "Q4 Review", branch: "finance-recon", rows: 1200, columns: 32, lastUpdated: new Date(Date.now() - 86400000 * 1), tags: ["finance", "reconciliation", "quarterly"], owner: "Asher Newton", qualityScore: 79, fileType: "xlsx", description: "Consolidated financial report with P&L, balance sheet, and cash flow data." },
];

const ALL_TAGS = Array.from(new Set(MOCK_CATALOG.flatMap((c) => c.tags)));
const ALL_PROJECTS = Array.from(new Set(MOCK_CATALOG.map((c) => c.project)));

const timeAgo = (date: Date) => {
  const diff = Date.now() - date.getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
};

const CatalogPanel = () => {
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("");
  const [filterTag, setFilterTag] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  let filtered = MOCK_CATALOG;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.tags.some((t) => t.toLowerCase().includes(q)) ||
      c.description?.toLowerCase().includes(q) ||
      c.project.toLowerCase().includes(q)
    );
  }
  if (filterProject) filtered = filtered.filter((c) => c.project === filterProject);
  if (filterTag) filtered = filtered.filter((c) => c.tags.includes(filterTag));

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-extralight tracking-wide text-foreground">Data Catalog</h2>
          <p className="text-xs font-extralight text-muted-foreground mt-1">
            {MOCK_CATALOG.length} datasets · {MOCK_CATALOG.reduce((s, c) => s + c.rows, 0).toLocaleString()} total rows
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm px-4 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search datasets, tags, columns, content…"
            className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Tag className="h-3 w-3" />
            <select value={filterTag} onChange={(e) => setFilterTag(e.target.value)} className="bg-card/30 border border-border/20 rounded-lg px-2 py-1 text-[10px] text-foreground outline-none">
              <option value="">All tags</option>
              {ALL_TAGS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <FileText className="h-3 w-3" />
            <select value={filterProject} onChange={(e) => setFilterProject(e.target.value)} className="bg-card/30 border border-border/20 rounded-lg px-2 py-1 text-[10px] text-foreground outline-none">
              <option value="">All projects</option>
              {ALL_PROJECTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          {(filterTag || filterProject) && (
            <button onClick={() => { setFilterTag(""); setFilterProject(""); }} className="text-[10px] text-accent hover:underline">Clear filters</button>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground/40">{filtered.length} results</span>
        </div>
      </div>

      {/* Catalog entries */}
      <div className="space-y-2">
        {filtered.map((entry) => (
          <div key={entry.id} className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm overflow-hidden">
            <div
              className="flex items-center gap-4 p-4 cursor-pointer hover:bg-foreground/5 transition-colors"
              onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-light text-foreground truncate">{entry.name}</p>
                  <span className="rounded bg-secondary/50 px-1.5 py-0.5 text-[9px] text-muted-foreground uppercase">{entry.fileType}</span>
                </div>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground/50">
                  <span>{entry.project}</span>
                  <span>·</span>
                  <span className="flex items-center gap-0.5"><GitBranch className="h-2.5 w-2.5" />{entry.branch}</span>
                  <span>·</span>
                  <span>{entry.rows.toLocaleString()} rows</span>
                  <span>·</span>
                  <span>{entry.columns} columns</span>
                  <span>·</span>
                  <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{timeAgo(entry.lastUpdated)}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  {entry.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-secondary/30 px-2 py-0.5 text-[9px] text-muted-foreground">{tag}</span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`text-[10px] ${entry.qualityScore >= 90 ? "text-emerald-400" : entry.qualityScore >= 75 ? "text-amber-400" : "text-destructive"}`}>
                  {entry.qualityScore}% quality
                </span>
                <span className="text-[10px] text-muted-foreground/40 flex items-center gap-1"><User className="h-2.5 w-2.5" />{entry.owner}</span>
              </div>
            </div>

            {expanded === entry.id && (
              <div className="border-t border-border/20 p-4 space-y-3">
                {entry.description && (
                  <p className="text-xs font-extralight text-muted-foreground leading-relaxed">{entry.description}</p>
                )}
                <div className="flex items-center gap-2">
                  <button className="rounded-lg bg-foreground/10 px-3 py-1.5 text-[10px] text-foreground hover:bg-foreground/15 transition-colors flex items-center gap-1">
                    <Eye className="h-3 w-3" />Open in Table
                  </button>
                  <button className="rounded-lg border border-border/20 px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <Table2 className="h-3 w-3" />View Schema
                  </button>
                  <button className="rounded-lg border border-border/20 px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <Plus className="h-3 w-3" />Add to Pipeline
                  </button>
                  <button className="rounded-lg border border-border/20 px-3 py-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />Export
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <Search className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
            <p className="text-xs text-muted-foreground/40 font-extralight">No datasets match your search</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CatalogPanel;
