import { useState, useEffect } from "react";
import { Search, Filter, ArrowUpDown, Flag, Loader2, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAzplenSession } from "./AzplenSessionContext";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const PAGE_SIZE = 50;

const DataTablePanel = ({ initialDatasetId }: { initialDatasetId?: string | null }) => {
  const [datasets, setDatasets] = useState<any[]>([]);
  const [selectedDs, setSelectedDs] = useState<string>("");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [flaggedRows, setFlaggedRows] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [page, setPage] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const { user } = useAuth();
  const { activeSession } = useAzplenSession();
  const { toast } = useToast();

  const exportToCSV = () => {
    if (filtered.length === 0) return;
    const csvRows = [
      columns.join(','),
      ...filtered.map(row =>
        columns.map(col => {
          const value = row[col] || '';
          return value.includes(',') || value.includes('"')
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        }).join(',')
      )
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${datasets.find(d => d.id === selectedDs)?.file_name || 'data'}_export.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: `${filtered.length} rows exported to CSV` });
  };

  const loadDatasets = async () => {
    if (!user || !activeSession) return;
    const { data } = await supabase
      .from("asha_datasets")
      .select("id, file_name, storage_path, schema, row_count")
      .eq("user_id", user.id)
      .eq("status", "ready")
      .eq("session_id", activeSession.id)
      .order("created_at", { ascending: false });
    if (data && data.length > 0) {
      setDatasets(data);
      setSelectedDs(prev => prev && data.some((d: any) => d.id === prev) ? prev : (initialDatasetId && data.some((d: any) => d.id === initialDatasetId) ? initialDatasetId : data[0].id));
    } else {
      setDatasets([]);
      setSelectedDs("");
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user || !activeSession) return;
    setLoading(true);
    loadDatasets();
  }, [user, activeSession]);

  // Realtime subscription
  useEffect(() => {
    if (!activeSession) return;
    const channel = supabase
      .channel(`dt-datasets-${activeSession.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asha_datasets', filter: `session_id=eq.${activeSession.id}` }, () => {
        loadDatasets();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeSession, user]);

  useEffect(() => {
    if (!selectedDs || !user) return;
    const ds = datasets.find((d) => d.id === selectedDs);
    if (!ds) return;
    setPage(0); // Reset page on dataset change

    const loadData = async () => {
      setLoadingData(true);
      try {
        const { data: fileData } = await supabase.storage.from("asha-data").download(ds.storage_path);
        if (!fileData) return;
        const text = await fileData.text();
        const ext = ds.file_name.split(".").pop()?.toLowerCase();

        if (ext === "csv") {
          const lines = text.split("\n").filter((l: string) => l.trim());
          if (lines.length > 0) {
            const parseCSVLine = (line: string): string[] => {
              const fields: string[] = [];
              let current = "";
              let inQuotes = false;
              for (let i = 0; i < line.length; i++) {
                const ch = line[i];
                if (inQuotes) {
                  if (ch === '"') {
                    if (i + 1 < line.length && line[i + 1] === '"') { current += '"'; i++; }
                    else { inQuotes = false; }
                  } else { current += ch; }
                } else {
                  if (ch === '"') { inQuotes = true; }
                  else if (ch === ',') { fields.push(current.trim()); current = ""; }
                  else { current += ch; }
                }
              }
              fields.push(current.trim());
              return fields;
            };
            const headers = parseCSVLine(lines[0]).map((h: string) => h.replace(/^"|"$/g, ""));
            setColumns(headers);
            setTotalRows(lines.length - 1);
            const dataRows = lines.slice(1).map((line: string) => {
              const vals = parseCSVLine(line);
              const row: Record<string, string> = {};
              headers.forEach((h, i) => { row[h] = (vals[i] || "").replace(/^"|"$/g, ""); });
              return row;
            });
            setRows(dataRows);
          }
        } else if (ext === "json" || ext === "jsonl") {
          try {
            let parsed = ext === "jsonl"
              ? text.split("\n").filter((l: string) => l.trim()).map((l: string) => JSON.parse(l))
              : JSON.parse(text);
            if (!Array.isArray(parsed)) parsed = [parsed];
            if (parsed.length > 0) {
              const keys = Object.keys(parsed[0]);
              setColumns(keys);
              setTotalRows(parsed.length);
              setRows(parsed.map((r: any) => {
                const row: Record<string, string> = {};
                keys.forEach((k) => { row[k] = r[k] != null ? String(r[k]) : ""; });
                return row;
              }));
            }
          } catch { setRows([]); setColumns([]); setTotalRows(0); }
        } else if (ext === "tsv") {
          const lines = text.split("\n").filter((l: string) => l.trim());
          if (lines.length > 0) {
            const headers = lines[0].split("\t").map((h: string) => h.trim());
            setColumns(headers);
            setTotalRows(lines.length - 1);
            const dataRows = lines.slice(1).map((line: string) => {
              const vals = line.split("\t");
              const row: Record<string, string> = {};
              headers.forEach((h, i) => { row[h] = (vals[i] || "").trim(); });
              return row;
            });
            setRows(dataRows);
          }
        } else {
          // For TXT, PDF text, and other unstructured files — render as line-based content
          const lines = text.split("\n").filter((l: string) => l.trim());
          if (lines.length > 0) {
            setColumns(["Line", "Content"]);
            setTotalRows(lines.length);
            setRows(lines.map((line: string, i: number) => ({
              "Line": String(i + 1),
              "Content": line.trim(),
            })));
          } else {
            setRows([]);
            setColumns(["content"]);
            setTotalRows(0);
          }
        }
      } finally {
        setLoadingData(false);
      }
    };
    loadData();
  }, [selectedDs, datasets, user]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const toggleFlag = (idx: number) => {
    setFlaggedRows((prev) => { const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next; });
  };

  let filtered = rows;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter((row) => Object.values(row).some((v) => v.toLowerCase().includes(q)));
  }
  if (sortCol) {
    filtered = [...filtered].sort((a, b) => sortAsc ? (a[sortCol] || "").localeCompare(b[sortCol] || "") : (b[sortCol] || "").localeCompare(a[sortCol] || ""));
  }

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginatedRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>;

  if (datasets.length === 0) {
    return <div className="flex justify-center items-center h-full"><p className="text-xs text-muted-foreground/40">No datasets available. Upload files first.</p></div>;
  }

  return (
    <TooltipProvider>
    <div className="flex h-full flex-col">
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 sm:gap-3 p-3 sm:p-4 border-b border-border/20">
        <select value={selectedDs} onChange={(e) => setSelectedDs(e.target.value)} className="bg-card/30 border border-border/20 rounded-lg px-3 py-1.5 text-xs text-foreground outline-none max-w-[140px] sm:max-w-none">
          {datasets.map((d) => <option key={d.id} value={d.id}>{d.file_name}</option>)}
        </select>
        <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 flex-1 min-w-0 max-w-md">
          <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none min-w-0" />
        </div>
        <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">{filtered.length} rows</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={exportToCSV}
              disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/20 bg-card/30 hover:bg-card/50 transition-colors text-xs text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </TooltipTrigger>
          <TooltipContent><p>Export to CSV</p></TooltipContent>
        </Tooltip>
      </div>

      {loadingData ? (
        <div className="flex justify-center items-center flex-1"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card/60 backdrop-blur-sm z-10">
              <tr className="border-b border-border/20">
                <th className="w-8 px-2 py-2.5" />
                {columns.map((col) => (
                  <th key={col} className="px-3 py-2.5 text-left font-light text-muted-foreground/60 uppercase tracking-wider text-[10px]">
                    <button onClick={() => toggleSort(col)} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      {col}
                      <ArrowUpDown className="h-2.5 w-2.5" />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, idx) => {
                const globalIdx = page * PAGE_SIZE + idx;
                return (
                  <tr key={globalIdx} className={`border-b border-border/10 transition-colors hover:bg-foreground/5 ${flaggedRows.has(globalIdx) ? "bg-amber-500/5" : ""}`}>
                    <td className="px-2 py-2">
                      <button onClick={() => toggleFlag(globalIdx)} className="p-0.5">
                        <Flag className={`h-3 w-3 ${flaggedRows.has(globalIdx) ? "text-amber-500" : "text-muted-foreground/20 hover:text-muted-foreground"}`} />
                      </button>
                    </td>
                    {columns.map((col) => (
                      <td key={col} className="px-3 py-2 font-light text-foreground max-w-xs truncate">
                        {/email|phone|ssn/i.test(col) ? <span className="text-muted-foreground/50 tracking-wider">••••</span> : row[col]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-border/20">
          <span className="text-[10px] text-muted-foreground/50">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 rounded-lg border border-border/20 bg-card/30 px-2.5 py-1.5 text-[10px] text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-3 w-3" /> Prev
            </button>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 rounded-lg border border-border/20 bg-card/30 px-2.5 py-1.5 text-[10px] text-foreground hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
};

export default DataTablePanel;
