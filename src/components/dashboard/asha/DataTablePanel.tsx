import { useState } from "react";
import { Search, Filter, Pin, Eye, EyeOff, ArrowUpDown, Flag, StickyNote, Save } from "lucide-react";

interface MockRow {
  id: number;
  name: string;
  email: string;
  amount: string;
  date: string;
  region: string;
  status: string;
}

const MOCK_DATA: MockRow[] = Array.from({ length: 50 }, (_, i) => ({
  id: i + 1,
  name: ["Alice Chen", "Bob Martinez", "Carol Williams", "David Kim", "Eva Novak", "Frank Osei"][i % 6],
  email: [`user${i + 1}@example.com`][0],
  amount: `$${(Math.random() * 10000).toFixed(2)}`,
  date: `2025-${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, "0")}`,
  region: ["US", "EU", "APAC", "LATAM", "MEA"][i % 5],
  status: ["Active", "Churned", "New", "At-risk"][i % 4],
}));

const columns = ["id", "name", "email", "amount", "date", "region", "status"] as const;

const DataTablePanel = () => {
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [flaggedRows, setFlaggedRows] = useState<Set<number>>(new Set());
  const [filterCol, setFilterCol] = useState("");
  const [filterVal, setFilterVal] = useState("");

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  };

  const toggleFlag = (id: number) => {
    setFlaggedRows((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const visibleCols = columns.filter((c) => !hiddenCols.has(c));

  let filtered = MOCK_DATA.filter((row) => {
    if (search) {
      const q = search.toLowerCase();
      return Object.values(row).some((v) => String(v).toLowerCase().includes(q));
    }
    return true;
  });

  if (filterCol && filterVal) {
    filtered = filtered.filter((row) => String((row as any)[filterCol]).toLowerCase().includes(filterVal.toLowerCase()));
  }

  if (sortCol) {
    filtered = [...filtered].sort((a, b) => {
      const av = String((a as any)[sortCol]);
      const bv = String((b as any)[sortCol]);
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-3 p-4 border-b border-border/20">
        <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-card/20 px-3 py-1.5 flex-1 max-w-md">
          <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search all columns…" className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-1.5 text-[10px]">
          <Filter className="h-3 w-3 text-muted-foreground" />
          <select value={filterCol} onChange={(e) => setFilterCol(e.target.value)} className="bg-card/30 border border-border/20 rounded px-1.5 py-1 text-[10px] text-foreground outline-none">
            <option value="">Column…</option>
            {columns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {filterCol && (
            <input value={filterVal} onChange={(e) => setFilterVal(e.target.value)} placeholder="contains…" className="bg-card/30 border border-border/20 rounded px-1.5 py-1 text-[10px] text-foreground placeholder:text-muted-foreground/40 outline-none w-24" />
          )}
        </div>

        <span className="text-[10px] text-muted-foreground/50">{filtered.length} rows</span>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card/60 backdrop-blur-sm z-10">
            <tr className="border-b border-border/20">
              <th className="w-8 px-2 py-2.5" />
              {visibleCols.map((col) => (
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
            {filtered.map((row) => (
              <tr key={row.id} className={`border-b border-border/10 transition-colors hover:bg-foreground/5 ${flaggedRows.has(row.id) ? "bg-amber-500/5" : ""}`}>
                <td className="px-2 py-2">
                  <button onClick={() => toggleFlag(row.id)} className="p-0.5">
                    <Flag className={`h-3 w-3 ${flaggedRows.has(row.id) ? "text-amber-500" : "text-muted-foreground/20 hover:text-muted-foreground"}`} />
                  </button>
                </td>
                {visibleCols.map((col) => (
                  <td key={col} className="px-3 py-2 font-light text-foreground">
                    {col === "email" ? (
                      <span className="text-muted-foreground/50 tracking-wider">••••@••••</span>
                    ) : col === "status" ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                        row.status === "Active" ? "bg-emerald-500/10 text-emerald-400" :
                        row.status === "At-risk" ? "bg-amber-500/10 text-amber-400" :
                        row.status === "Churned" ? "bg-destructive/10 text-destructive" :
                        "bg-accent/10 text-accent"
                      }`}>
                        {row.status}
                      </span>
                    ) : (
                      String((row as any)[col])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTablePanel;
