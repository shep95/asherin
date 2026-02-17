import { useState, useEffect } from "react";
import { Search, Filter, ArrowUpDown, Flag, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAshaSession } from "./AshaSessionContext";

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
  const { user } = useAuth();
  const { activeSession } = useAshaSession();

  useEffect(() => {
    if (!user || !activeSession) return;
    setLoading(true);
    const load = async () => {
      const { data } = await supabase
        .from("asha_datasets")
        .select("id, file_name, storage_path, schema")
        .eq("user_id", user.id)
        .eq("status", "ready")
        .eq("session_id", activeSession.id)
        .order("created_at", { ascending: false });
      if (data && data.length > 0) {
        setDatasets(data);
        setSelectedDs(initialDatasetId && data.some((d: any) => d.id === initialDatasetId) ? initialDatasetId : data[0].id);
      } else {
        setDatasets([]);
        setSelectedDs("");
      }
      setLoading(false);
    };
    load();
  }, [user, activeSession]);

  useEffect(() => {
    if (!selectedDs || !user) return;
    const ds = datasets.find((d) => d.id === selectedDs);
    if (!ds) return;

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
            const headers = lines[0].split(",").map((h: string) => h.trim().replace(/^"|"$/g, ""));
            setColumns(headers);
            const dataRows = lines.slice(1, 201).map((line: string) => {
              const vals = line.split(",").map((v: string) => v.trim().replace(/^"|"$/g, ""));
              const row: Record<string, string> = {};
              headers.forEach((h, i) => { row[h] = vals[i] || ""; });
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
              setRows(parsed.slice(0, 200).map((r: any) => {
                const row: Record<string, string> = {};
                keys.forEach((k) => { row[k] = r[k] != null ? String(r[k]) : ""; });
                return row;
              }));
            }
          } catch { setRows([]); setColumns([]); }
        } else {
          setRows([]);
          setColumns(["content"]);
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

  if (loading) return <div className="flex justify-center items-center h-full"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>;

  if (datasets.length === 0) {
    return <div className="flex justify-center items-center h-full"><p className="text-xs text-muted-foreground/40">No datasets available. Upload files first.</p></div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-shrink-0 flex flex-wrap items-center gap-3 p-4 border-b border-border/20">
        <select value={selectedDs} onChange={(e) => setSelectedDs(e.target.value)} className="bg-card/30 border border-border/20 rounded-lg px-3 py-1.5 text-xs text-foreground outline-none">
          {datasets.map((d) => <option key={d.id} value={d.id}>{d.file_name}</option>)}
        </select>
        <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 flex-1 max-w-md">
          <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
        </div>
        <span className="text-[10px] text-muted-foreground/50">{filtered.length} rows</span>
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
              {filtered.map((row, idx) => (
                <tr key={idx} className={`border-b border-border/10 transition-colors hover:bg-foreground/5 ${flaggedRows.has(idx) ? "bg-amber-500/5" : ""}`}>
                  <td className="px-2 py-2">
                    <button onClick={() => toggleFlag(idx)} className="p-0.5">
                      <Flag className={`h-3 w-3 ${flaggedRows.has(idx) ? "text-amber-500" : "text-muted-foreground/20 hover:text-muted-foreground"}`} />
                    </button>
                  </td>
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-2 font-light text-foreground max-w-xs truncate">
                      {/email|phone|ssn/i.test(col) ? <span className="text-muted-foreground/50 tracking-wider">••••</span> : row[col]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DataTablePanel;
