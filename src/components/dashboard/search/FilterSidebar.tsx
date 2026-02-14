import { useState } from "react";
import { Filter, X, Save, Trash2 } from "lucide-react";
import type { SearchFilters, SourceTier } from "./types";

interface FilterProfile {
  name: string;
  filters: SearchFilters;
}

const DEFAULT_PROFILES: FilterProfile[] = [
  { name: "Research Mode", filters: { credibilityMin: 2, fileType: "pdf" } },
  { name: "Quick News", filters: { dateRange: "day", sourceType: ["news"] } },
  { name: "Deep Search", filters: {} },
];

interface FilterSidebarProps {
  filters: SearchFilters;
  onFiltersChange: (f: SearchFilters) => void;
  blockedDomains: string[];
  onBlockDomain: (domain: string) => void;
  onUnblockDomain: (domain: string) => void;
}

const FilterSidebar = ({ filters, onFiltersChange, blockedDomains, onBlockDomain, onUnblockDomain }: FilterSidebarProps) => {
  const [open, setOpen] = useState(false);
  const [blockInput, setBlockInput] = useState("");
  const [profiles] = useState<FilterProfile[]>(() => {
    const saved = localStorage.getItem("zophiel_filter_profiles");
    return saved ? JSON.parse(saved) : DEFAULT_PROFILES;
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-light text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 border border-transparent transition-all">
        <Filter className="h-3.5 w-3.5" />
        Filters
      </button>
    );
  }

  return (
    <div className="w-64 shrink-0 border-r border-border/15 bg-card/10 backdrop-blur-sm p-4 overflow-y-auto animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-foreground tracking-wider uppercase">Refine Results</h3>
        <button onClick={() => setOpen(false)} className="p-1 rounded-lg text-muted-foreground/50 hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Saved Profiles */}
      <div className="mb-4">
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Quick Profiles</p>
        <div className="space-y-1">
          {profiles.map(p => (
            <button key={p.name} onClick={() => onFiltersChange(p.filters)} className="w-full text-left rounded-lg px-2.5 py-1.5 text-[11px] font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Date */}
      <div className="mb-4">
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Date</p>
        {(['', 'day', 'week', 'month', 'year'] as const).map(d => (
          <label key={d || 'any'} className="flex items-center gap-2 py-1 text-[11px] font-light text-muted-foreground hover:text-foreground cursor-pointer">
            <input type="radio" name="dateRange" checked={(filters.dateRange || '') === d} onChange={() => onFiltersChange({ ...filters, dateRange: d || undefined })} className="accent-accent" />
            {d ? `Last ${d}` : 'Any time'}
          </label>
        ))}
      </div>

      {/* Credibility */}
      <div className="mb-4">
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Credibility</p>
        {([undefined, 2, 1] as const).map(tier => (
          <label key={tier ?? 'all'} className="flex items-center gap-2 py-1 text-[11px] font-light text-muted-foreground hover:text-foreground cursor-pointer">
            <input type="radio" name="credibility" checked={(filters.credibilityMin ?? undefined) === tier} onChange={() => onFiltersChange({ ...filters, credibilityMin: tier as SourceTier | undefined })} className="accent-accent" />
            {tier === undefined ? 'All sources' : tier === 2 ? 'Established only' : 'Primary only'}
          </label>
        ))}
      </div>

      {/* Blocked Domains */}
      <div className="mb-4">
        <p className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mb-2">Blocked Domains</p>
        <div className="flex gap-1 mb-2">
          <input value={blockInput} onChange={e => setBlockInput(e.target.value)} placeholder="domain.com" className="flex-1 rounded-lg border border-border/20 bg-background/50 px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/30 outline-none" onKeyDown={e => { if (e.key === 'Enter' && blockInput.trim()) { onBlockDomain(blockInput.trim()); setBlockInput(''); } }} />
          <button onClick={() => { if (blockInput.trim()) { onBlockDomain(blockInput.trim()); setBlockInput(''); } }} className="rounded-lg bg-destructive/20 px-2 py-1 text-[10px] text-destructive hover:bg-destructive/30">Block</button>
        </div>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {blockedDomains.map(d => (
            <div key={d} className="flex items-center justify-between rounded-lg bg-background/30 px-2 py-1">
              <span className="text-[10px] text-muted-foreground">{d}</span>
              <button onClick={() => onUnblockDomain(d)} className="text-muted-foreground/30 hover:text-foreground"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      </div>

      <button onClick={() => onFiltersChange({})} className="w-full rounded-lg border border-border/20 py-1.5 text-[11px] font-light text-muted-foreground hover:text-foreground transition-colors">
        Reset All Filters
      </button>
    </div>
  );
};

export default FilterSidebar;
