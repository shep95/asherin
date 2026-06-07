import { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { Search, Zap, ArrowRight, Clock, X, Loader2, Keyboard, WifiOff, Network, Brain, Download, FileText, FileJson, FileSpreadsheet, Image as ImageIcon } from "lucide-react";
import { exportPDF, exportCSV, exportJSON, exportMarkdown } from "@/lib/exportEngine";
import { logAudit } from "@/lib/auditLogger";
import IntelMapByokPanel from "./search/IntelMapByokPanel";
import { isIntelMapByokEnabled } from "@/lib/intelMapByok";
import MessageQueuePanel from "./MessageQueuePanel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { triggerByokRequired } from "@/components/ByokRequiredDialog";
import type { SearchMode, SearchFilters, SearchResponse, SearchResult, PagePreview, FreshnessAlert, InstantAnswer } from "./search/types";
import SearchModeSelector from "./search/SearchModeSelector";
import SearchOperatorsPanel from "./search/SearchOperatorsPanel";
import QuerySuggestions from "./search/QuerySuggestions";
import InstantAnswerCard from "./search/InstantAnswerCard";
import SearchResultCard from "./search/SearchResultCard";
import FilterSidebar from "./search/FilterSidebar";
import PagePreviewPanel from "./search/PagePreviewPanel";
import DeepSearchPanel from "./search/DeepSearchPanel";
import IntelMapPanel from "./search/IntelMapPanel";
import IntelligenceSuitePanel from "./search/intel/IntelligenceSuitePanel";

const OracleLocusView = lazy(() => import("./OracleLocusView"));
const LinkExtractView = lazy(() => import("./search/LinkExtractView"));
const DomainMapPanel = lazy(() => import("./search/DomainMapPanel"));
const ScribdPanel = lazy(() => import("./search/ScribdPanel"));
const CodeAuditView = lazy(() => import("./search/CodeAuditView"));
const FaceRecognitionView = lazy(() => import("./search/FaceRecognitionView"));
const DarkWebPanel = lazy(() => import("./search/DarkWebPanel"));
const LeaksPanel = lazy(() => import("./search/LeaksPanel"));
const ArchivePanel = lazy(() => import("./search/ArchivePanel"));
const OpenVpnPanel = lazy(() => import("./search/OpenVpnPanel"));
const DataEnginePanel = lazy(() => import("./search/DataEnginePanel"));
import ArchivesHarvesterPanel from "./search/ArchivesHarvesterPanel";


const CATEGORY_LABELS: Record<string, string> = {
  primary: "Primary Sources",
  breaking: "Breaking Coverage",
  analysis: "In-Depth Analysis",
  community: "Community Discussion",
  general: "Results",
};

interface ZophielEngineViewProps {
  onSearchedChange?: (searched: boolean) => void;
}

const ZophielEngineView = ({ onSearchedChange }: ZophielEngineViewProps = {}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [grouped, setGrouped] = useState<Record<string, SearchResult[]>>({});
  const [instantAnswer, setInstantAnswer] = useState<InstantAnswer | null>(null);
  const [freshnessAlerts, setFreshnessAlerts] = useState<Record<string, FreshnessAlert>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [mode, setMode] = useState<SearchMode>("web");
  const [filters, setFilters] = useState<SearchFilters>({});
  const [operatorOverrides, setOperatorOverrides] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [preview, setPreview] = useState<{ data: PagePreview; url: string } | null>(null);
  const [blockedDomains, setBlockedDomains] = useState<string[]>([]);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [deepSearchQuery, setDeepSearchQuery] = useState<string | null>(null);
  const [intelMapOpen, setIntelMapOpen] = useState(false);
  const [intelSuiteOpen, setIntelSuiteOpen] = useState(false);
  const [byokOpen, setByokOpen] = useState(false);
  const [byokActive, setByokActive] = useState<boolean>(() => isIntelMapByokEnabled());
  const [online, setOnline] = useState(navigator.onLine);
  const [queuedSearch, setQueuedSearch] = useState<string | null>(null);
  const [scope, setScope] = useState<"safe" | "mix" | "dark">(() => (localStorage.getItem("zophiel_scope") as any) || "safe");
  const [darkResults, setDarkResults] = useState<{ title: string; link: string; engine: string }[]>([]);
  const [darkSummary, setDarkSummary] = useState<string>("");
  const [darkLoading, setDarkLoading] = useState(false);
  const [splitPct, setSplitPct] = useState(50); // % width of right panel (map/suite), committed on mouseup
  const splitPctRef = useRef(50);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);

  // Hide global header right-side controls while a side panel is open
  useEffect(() => {
    const open = (intelMapOpen || intelSuiteOpen) && searched && results.length > 0;
    document.body.classList.toggle("zophiel-panel-open", open);
    return () => { document.body.classList.remove("zophiel-panel-open"); };
  }, [intelMapOpen, intelSuiteOpen, searched, results.length]);

  // High-perf drag-to-resize: bypass React re-renders, write width directly via rAF
  const startResize = useCallback(() => {
    resizingRef.current = true;
    let raf = 0;
    let pendingPct = splitPctRef.current;
    const apply = () => {
      raf = 0;
      if (leftPanelRef.current) leftPanelRef.current.style.width = `${100 - pendingPct}%`;
      if (rightPanelRef.current) rightPanelRef.current.style.width = `${pendingPct}%`;
    };
    const onMove = (e: MouseEvent) => {
      const vw = window.innerWidth;
      const rightPx = vw - e.clientX;
      pendingPct = Math.min(80, Math.max(20, (rightPx / vw) * 100));
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onUp = () => {
      resizingRef.current = false;
      if (raf) cancelAnimationFrame(raf);
      splitPctRef.current = pendingPct;
      setSplitPct(pendingPct);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const inputRef = useRef<HTMLInputElement>(null);

  // Notify parent of searched state changes
  useEffect(() => {
    onSearchedChange?.(searched);
  }, [searched, onSearchedChange]);

  // Auto-activate "searched" view when entering Imagine, Extract, Audit, or Face mode (no query needed)
  useEffect(() => {
    if (mode === "imagine" || mode === "extract" || mode === "audit" || mode === "face" || mode === "darkweb" || mode === "leaks" || mode === "archive" || mode === "vpn" || mode === "dataengine") {
      setSearched(true);
      setShowSuggestions(false);
    }
  }, [mode]);

  // Online/offline tracking
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Auto-run queued search when back online
  useEffect(() => {
    if (online && queuedSearch) {
      const q = queuedSearch;
      setQueuedSearch(null);
      search(q);
    }
  }, [online, queuedSearch]);

  // Load saved state
  useEffect(() => {
    const saved = localStorage.getItem("zophiel_recent_searches");
    if (saved) setRecentSearches(JSON.parse(saved));
    const blocked = localStorage.getItem("zophiel_blocked_domains");
    if (blocked) setBlockedDomains(JSON.parse(blocked));
    inputRef.current?.focus();
  }, []);

  const saveRecent = (q: string) => {
    const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 8);
    setRecentSearches(updated);
    localStorage.setItem("zophiel_recent_searches", JSON.stringify(updated));
  };

  const blockDomain = (domain: string) => {
    const updated = [...new Set([...blockedDomains, domain])];
    setBlockedDomains(updated);
    localStorage.setItem("zophiel_blocked_domains", JSON.stringify(updated));
    // Re-filter results
    setResults(prev => prev.filter(r => !updated.some(d => r.url.includes(d))));
  };

  const unblockDomain = (domain: string) => {
    const updated = blockedDomains.filter(d => d !== domain);
    setBlockedDomains(updated);
    localStorage.setItem("zophiel_blocked_domains", JSON.stringify(updated));
  };

  const runDarkSweep = useCallback(async (q: string) => {
    setDarkLoading(true); setDarkResults([]); setDarkSummary("");
    try {
      const byok = (await import("@/lib/intelMapByok")).getActiveIntelMapByok();
      const { data, error } = await supabase.functions.invoke("zophiel-darkweb", {
        body: { query: q, ...(byok ? { byok } : {}) },
      });
      if (error) throw error;
      if (data?.success) {
        setDarkResults(Array.isArray(data.results) ? data.results : []);
        setDarkSummary(data.summary || "");
      }
    } catch (e) {
      console.error("[zophiel] dark sweep failed", e);
    } finally { setDarkLoading(false); }
  }, []);

  const search = useCallback(async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim();
    if (!q) return;

    // Deep search mode — delegate to the streaming panel
    if (mode === "deep") {
      setSearched(true);
      setShowSuggestions(false);
      saveRecent(q);
      setDeepSearchQuery(q);
      return;
    }

    // Imagine / Extract / Audit / Face modes — handled by their own panels, do not run text search
    if (mode === "imagine" || mode === "extract" || mode === "audit" || mode === "face" || mode === "darkweb" || mode === "leaks" || mode === "archive" || mode === "vpn" || mode === "dataengine" || mode === "harvest" || mode === "scribd") {
      setSearched(true);
      setShowSuggestions(false);
      return;
    }

    // If offline, queue the search
    if (!navigator.onLine) {
      setQueuedSearch(q);
      saveRecent(q);
      setSearched(true);
      setShowSuggestions(false);
      return;
    }

    setDeepSearchQuery(null);
    setSearched(true);
    setResults([]);
    setGrouped({});
    setInstantAnswer(null);
    setFreshnessAlerts({});
    setDarkResults([]);
    setDarkSummary("");
    setShowSuggestions(false);
    setSelectedIndex(-1);
    setQueuedSearch(null);
    saveRecent(q);

    const start = performance.now();
    const wantClearnet = scope === "safe" || scope === "mix";
    const wantDark = scope === "dark" || scope === "mix";

    if (wantClearnet) setLoading(true);
    if (wantDark) runDarkSweep(q);

    if (!wantClearnet) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("zophiel-search", {
        body: { query: q, mode, filters, operatorOverrides, page: 1 },
      });

      const elapsed = Math.round(performance.now() - start);
      setSearchTime(elapsed);

      if (error) throw error;
      const res = data as SearchResponse;

      if (res.success) {
        // Filter blocked domains
        const filtered = res.results.filter(r => !blockedDomains.some(d => r.url.includes(d)));
        setResults(filtered);
        setGrouped(res.grouped);
        setInstantAnswer(res.instantAnswer);
        setFreshnessAlerts(res.freshnessAlerts || {});
      }
    } catch (e: any) {
      console.error("Search failed:", e);
      const msg = String(e?.message || e || "").toLowerCase();
      const ctx = e?.context;
      let status: number | undefined;
      let bodyText = "";
      try {
        status = ctx?.status;
        if (ctx?.body && typeof ctx.body.text === "function") {
          bodyText = (await ctx.body.text()).toLowerCase();
        }
      } catch { /* noop */ }

      const isByokIssue =
        status === 403 || status === 402 || status === 429 ||
        /byok_required|quota|rate.?limit|api[_ ]?key|overloaded|unauthor|insufficient|credit/.test(
          msg + " " + bodyText,
        );

      if (isByokIssue) {
        triggerByokRequired({
          source: "zophiel-search",
          reason: "The Zophiel search engine could not reach the AI gateway. Add your own AI key to keep searching without interruption.",
        });
      } else {
        toast({
          title: "Search engine error",
          description:
            e?.message ||
            "The Zophiel search engine failed. If this keeps happening, add your own AI key in Settings → AI Keys.",
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [query, mode, filters, operatorOverrides, blockedDomains, recentSearches, scope, runDarkSweep]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search();
  };

  const handleSuggestionSelect = (suggestion: string, filterHint?: string) => {
    setQuery(suggestion);
    setShowSuggestions(false);
    if (filterHint === "week") setFilters(f => ({ ...f, dateRange: "week" }));
    else if (filterHint === "pdf") setFilters(f => ({ ...f, fileType: "pdf" }));
    search(suggestion);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "?" && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
        setShowShortcuts(s => !s);
      }
      if (e.key === "Escape") {
        setShowSuggestions(false);
        setShowShortcuts(false);
        if (preview) setPreview(null);
      }
      // Arrow navigation in results
      if (searched && results.length > 0) {
        if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)); }
        if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, -1)); }
        if (e.key === "c" && selectedIndex >= 0 && !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
          navigator.clipboard.writeText(results[selectedIndex].url);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searched, results, selectedIndex, preview]);

  const clearRecent = () => { setRecentSearches([]); localStorage.removeItem("zophiel_recent_searches"); };

  // Determine if we should use grouped or flat display
  const hasGroups = Object.keys(grouped).length > 1;

  

  return (
    <div className="zophiel-aurora-shell flex h-full relative">
      {/* Filter Sidebar */}
      {searched && (
        <FilterSidebar
          filters={filters}
          onFiltersChange={(f) => { setFilters(f); }}
          blockedDomains={blockedDomains}
          onBlockDomain={blockDomain}
          onUnblockDomain={unblockDomain}
        />
      )}

      <div
        ref={leftPanelRef}
        className={`flex flex-col min-w-0 ${(intelMapOpen || intelSuiteOpen) && searched && results.length > 0 ? "flex-1 lg:flex-none" : "flex-1"}`}
        style={(intelMapOpen || intelSuiteOpen) && searched && results.length > 0 ? { width: `${100 - splitPct}%` } : undefined}
      >
        {/* Search Header */}
        <div className={`flex-shrink-0 transition-all duration-500 ${searched ? "pt-3 sm:pt-4 pb-2 sm:pb-3" : "pt-[14vh] sm:pt-[20vh] pb-4 sm:pb-6"}`}>
          <div className="max-w-2xl mx-auto px-3 sm:px-6">




            {/* Mode selector */}
            <div className="mb-3">
              <SearchModeSelector active={mode} onChange={setMode} />
            </div>

            {/* Scope toggle: Safe / Mix / Dark — compact, only relevant for standard search modes,
                and only after a search to keep the pre-search view calm. */}
            {searched && mode !== "imagine" && mode !== "extract" && mode !== "audit" && mode !== "face" && mode !== "darkweb" && mode !== "leaks" && mode !== "archive" && mode !== "deep" && mode !== "dataengine" && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground/50">Scope</span>
                <div className="inline-flex rounded-xl border border-border/30 bg-card/40 backdrop-blur-xl p-0.5">
                  {([
                    { id: "safe", label: "Safe", hint: "Clearnet only" },
                    { id: "mix", label: "Mix", hint: "Clearnet + dark web" },
                    { id: "dark", label: "Dark", hint: "Onion sources only" },
                  ] as const).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => { setScope(opt.id); localStorage.setItem("zophiel_scope", opt.id); }}
                      title={opt.hint}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-light tracking-wide transition-colors ${
                        scope === opt.id
                          ? "bg-accent/25 text-accent"
                          : "text-muted-foreground/60 hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search bar — hidden in imagine/extract/audit modes (use their own input UI) */}
            {mode !== "imagine" && mode !== "extract" && mode !== "audit" && mode !== "face" && mode !== "darkweb" && mode !== "leaks" && mode !== "archive" && mode !== "dataengine" && (
              <form onSubmit={handleSubmit} className="relative">
                <div className="zophiel-aurora-pulse" aria-hidden />

                <div className={`group flex items-center gap-2 rounded-2xl border ${!online ? "border-amber-500/30" : "border-foreground/15"} bg-background/50 backdrop-blur-2xl px-4 py-3.5 focus-within:border-foreground/40 focus-within:shadow-[0_0_0_1px_hsl(0_0%_100%/0.15),0_20px_60px_-20px_hsl(220_50%_60%/0.35)] transition-all duration-300`}>
                  {!online && <WifiOff className="h-4 w-4 text-amber-400/60 shrink-0" />}
                  <Search className="h-5 w-5 text-foreground/70 shrink-0 group-focus-within:text-foreground transition-colors" strokeWidth={1.5} />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setShowSuggestions(e.target.value.length > 1); }}
                    onFocus={() => { if (query.length > 1) setShowSuggestions(true); }}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder={online ? "Search…" : "Offline — queued"}
                    className="flex-1 bg-transparent text-sm font-light tracking-wide text-foreground placeholder:text-muted-foreground/40 outline-none"
                  />
                  {query && (
                    <button type="button" onClick={() => { setQuery(""); setShowSuggestions(false); inputRef.current?.focus(); }} className="p-1 rounded-lg text-muted-foreground/50 hover:text-foreground transition-colors" aria-label="Clear search">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <SearchOperatorsPanel filters={filters} onFiltersChange={setFilters} onOperatorString={setOperatorOverrides} />
                  <button
                    type="submit"
                    disabled={loading || !query.trim()}
                    className="rounded-xl border border-foreground/20 bg-foreground/[0.08] px-4 py-1.5 text-xs font-light tracking-wide text-foreground hover:bg-foreground/[0.14] hover:border-foreground/40 transition-all disabled:opacity-30"
                    aria-label="Run search"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>

                {showSuggestions && query.length > 1 && (
                  <QuerySuggestions query={query} onSelect={handleSuggestionSelect} />
                )}
              </form>
            )}


            {/* Imagine mode banner */}
            {mode === "imagine" && (
              <div className="rounded-2xl border border-accent/30 bg-accent/5 backdrop-blur-xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-3">
                <ImageIcon className="h-4 w-4 text-accent shrink-0" />
                <p className="text-[11px] sm:text-xs font-light text-foreground truncate">Image OSINT — geo, faces, forensics.</p>
              </div>
            )}

            {/* Audit mode banner */}
            {mode === "audit" && (
              <div className="rounded-2xl border border-accent/30 bg-accent/5 backdrop-blur-xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-3">
                <FileText className="h-4 w-4 text-accent shrink-0" />
                <p className="text-[11px] sm:text-xs font-light text-foreground truncate">Code audit — leaks, flaws, fixes.</p>
              </div>
            )}

            {/* Face Recognition mode — banner is rendered inside the view itself */}

            {/* Recent searches */}
            {!searched && recentSearches.length > 0 && (
              <div className="mt-4 animate-fade-in">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-light tracking-wider text-muted-foreground/50 uppercase">Recent</span>
                  <button onClick={clearRecent} className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">Clear</button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recentSearches.map(s => (
                    <button key={s} onClick={() => { setQuery(s); search(s); }} className="inline-flex items-center gap-1 rounded-lg border border-border/20 bg-card/20 px-2.5 py-1 text-[11px] font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors">
                      <Clock className="h-3 w-3" />{s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Keyboard shortcuts available via "?" — hint removed to declutter */}
          </div>
        </div>

        {/* Results */}
        {searched && (
          <div className="flex-1 overflow-y-auto">
            <div className={`${mode === "imagine" || mode === "extract" || mode === "audit" || mode === "face" || mode === "darkweb" || mode === "leaks" || mode === "archive" || mode === "vpn" || mode === "dataengine" || mode === "harvest" || mode === "scribd" ? "max-w-6xl" : "max-w-2xl"} mx-auto px-3 sm:px-6 pb-8`}>
              {/* Queue Panel */}
              <MessageQueuePanel
                items={queuedSearch ? [{ id: "zophiel-queued", content: queuedSearch }] : []}
                onRemove={() => setQueuedSearch(null)}
                onClear={() => setQueuedSearch(null)}
              />

              {/* Imagine Intelligence — image OSINT, geo-location, biometrics */}
              {mode === "imagine" && (
                <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
                  <OracleLocusView />
                </Suspense>
              )}

              {/* Link Extract — URL intelligence blueprint */}
              {mode === "extract" && (
                <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
                  <LinkExtractView />
                </Suspense>
              )}

              {/* Doc Harvest — batch domain document mapper */}
              {mode === "harvest" && (
                <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
                  <DomainMapPanel />
                </Suspense>
              )}

              {/* Scribd — pre-seeded scribd.com harvester */}
              {mode === "scribd" && (
                <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
                  <ScribdPanel />
                </Suspense>
              )}

              {/* ZERLAL — security blueprint of uploaded code file */}
              {mode === "audit" && (
                <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
                  <CodeAuditView />
                </Suspense>
              )}

              {/* Face Recognition — biometric identity matching across multi-source intelligence */}
              {mode === "face" && (
                <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
                  <FaceRecognitionView />
                </Suspense>
              )}

              {/* Dark Web — Robin (darkgoogle) Tor2Web pipeline */}
              {mode === "darkweb" && (
                <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
                  <DarkWebPanel />
                </Suspense>
              )}

              {/* Leaks — direct browse of search.libraryofleaks.org */}
              {mode === "leaks" && (
                <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
                  <LeaksPanel />
                </Suspense>
              )}

              {/* Archive — direct browse of archive.org + admin Knowledge Harvester */}
              {mode === "archive" && (
                <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
                  <div className="space-y-4">
                    <ArchivesHarvesterPanel />
                    <ArchivePanel />
                  </div>
                </Suspense>
              )}

              {/* OpenVPN — Aureon Shield full device + browser audit suite */}
              {mode === "vpn" && (
                <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
                  <OpenVpnPanel />
                </Suspense>
              )}

              {/* DataEngine — user's own files indexed locally and searched */}
              {mode === "dataengine" && (
                <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
                  <DataEnginePanel />
                </Suspense>
              )}

              {/* Deep Search Panel */}
              {mode !== "imagine" && mode !== "extract" && mode !== "audit" && mode !== "face" && mode !== "darkweb" && mode !== "leaks" && mode !== "archive" && mode !== "vpn" && mode !== "dataengine" && mode !== "harvest" && mode !== "scribd" && deepSearchQuery && (
                <DeepSearchPanel query={deepSearchQuery} onClose={() => setDeepSearchQuery(null)} />
              )}

              {/* Inline Dark Web sweep — shown when scope=mix or dark */}
              {mode !== "imagine" && mode !== "extract" && mode !== "audit" && mode !== "face" && mode !== "darkweb" && mode !== "leaks" && mode !== "archive" && mode !== "vpn" && mode !== "dataengine" && mode !== "harvest" && mode !== "scribd" && !deepSearchQuery && (scope === "mix" || scope === "dark") && (darkLoading || darkResults.length > 0 || darkSummary) && (
                <div className="mb-6 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.25em] text-accent/80">Dark Web Sweep</span>
                    {darkLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>
                  {darkSummary && (
                    <div className="rounded-2xl border border-accent/20 bg-accent/5 px-4 py-3">
                      <pre className="whitespace-pre-wrap text-[12px] font-light text-foreground/90 leading-relaxed font-sans">{darkSummary}</pre>
                    </div>
                  )}
                  {darkResults.length > 0 && (
                    <div className="space-y-1.5">
                      {darkResults.map((r, i) => (
                        <div key={r.link + i} className="rounded-xl border border-border/20 bg-card/30 px-3 py-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-light text-foreground truncate">[{i + 1}] {r.title || "(untitled)"}</p>
                              <p className="text-[10px] font-mono text-muted-foreground/60 truncate">{r.link}</p>
                            </div>
                            <span className="text-[9px] uppercase tracking-wider text-accent/70 shrink-0">{r.engine}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Standard search results */}
              {mode !== "imagine" && mode !== "extract" && mode !== "audit" && mode !== "face" && mode !== "darkweb" && mode !== "leaks" && mode !== "archive" && mode !== "vpn" && mode !== "dataengine" && !deepSearchQuery && (
                <>
                  {/* Meta */}
                  {!loading && results.length > 0 && (
                    <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                      <p className="text-[10px] font-light text-muted-foreground/40">
                        {results.length} · {searchTime}ms
                      </p>
                      <div className="flex items-center gap-2">
                        <div className="relative group/export">
                          <button
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border/30 bg-card/30 px-2.5 py-1 text-[11px] font-light tracking-wide text-muted-foreground hover:text-foreground hover:border-border/50 transition-colors"
                            title="Export results"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Export
                          </button>
                          <div className="absolute right-0 top-full mt-1 hidden group-hover/export:block bg-card border border-border rounded-lg shadow-2xl z-50 py-1 min-w-[140px]">
                            <button
                              onClick={() => { exportPDF(`Zophiel - ${query}`, results); logAudit({ action: "export", resourceType: "search_results", payload: { query, format: "pdf", count: results.length } }); }}
                              className="w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 hover:bg-muted"
                            ><FileText className="h-3 w-3" /> PDF Report</button>
                            <button
                              onClick={() => { exportCSV(`zophiel-${Date.now()}`, results); logAudit({ action: "export", resourceType: "search_results", payload: { query, format: "csv", count: results.length } }); }}
                              className="w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 hover:bg-muted"
                            ><FileSpreadsheet className="h-3 w-3" /> CSV</button>
                            <button
                              onClick={() => { exportJSON(`zophiel-${Date.now()}`, results as any, { query, mode }); logAudit({ action: "export", resourceType: "search_results", payload: { query, format: "json", count: results.length } }); }}
                              className="w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 hover:bg-muted"
                            ><FileJson className="h-3 w-3" /> JSON</button>
                            <button
                              onClick={() => { exportMarkdown(`zophiel-${Date.now()}`, results as any, { query, mode }); logAudit({ action: "export", resourceType: "search_results", payload: { query, format: "md", count: results.length } }); }}
                              className="w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2 hover:bg-muted"
                            ><FileText className="h-3 w-3" /> Markdown</button>
                          </div>
                        </div>
                        <button
                          onClick={() => { setIntelMapOpen((v) => !v); if (!intelMapOpen) setIntelSuiteOpen(false); }}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-light tracking-wide transition-colors ${
                            intelMapOpen
                              ? "border-accent/40 bg-accent/15 text-accent"
                              : "border-border/30 bg-card/30 text-muted-foreground hover:text-foreground hover:border-border/50"
                          }`}
                          title="Project these results through the ZERLAL model — rival of Gaythropic"
                        >
                          <Network className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{intelMapOpen ? "Close Map" : "Intel Map"}</span>
                          <span className="sm:hidden">Map</span>
                        </button>
                        <button
                          onClick={() => setByokOpen(true)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-light tracking-wide transition-colors ${
                            byokActive
                              ? "border-foreground/40 bg-foreground/10 text-foreground"
                              : "border-border/30 bg-card/30 text-muted-foreground hover:text-foreground hover:border-border/50"
                          }`}
                          title={byokActive
                            ? "Your AI key is active across all Zophiel tabs (Search, Deep Search, Intel Map, Intel Suite, ZERLAL, Link Extract)"
                            : "Use your own AI key across every Zophiel tab — skips the queue"}
                        >
                          <Zap className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{byokActive ? "My Key: ON" : "Use My Key"}</span>
                          <span className="sm:hidden">Key</span>
                        </button>
                        <button
                          onClick={() => { setIntelSuiteOpen((v) => !v); if (!intelSuiteOpen) setIntelMapOpen(false); }}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-light tracking-wide transition-colors ${
                            intelSuiteOpen
                              ? "border-accent/40 bg-accent/15 text-accent"
                              : "border-border/30 bg-card/30 text-muted-foreground hover:text-foreground hover:border-border/50"
                          }`}
                          title="Run forensic intelligence analysis: timeline, credibility, fact-check, narrative, gaps"
                        >
                          <Brain className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{intelSuiteOpen ? "Close Intel" : "Intel Suite"}</span>
                          <span className="sm:hidden">Intel</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Instant Answer */}
                  {instantAnswer && <InstantAnswerCard answer={instantAnswer} />}

                  {/* Loading skeleton */}
                  {loading && (
                    <div className="space-y-4 animate-fade-in">
                      {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="rounded-xl border border-border/10 bg-card/20 p-4 space-y-2">
                          <div className="h-3 w-48 bg-foreground/5 rounded animate-pulse" />
                          <div className="h-2.5 w-32 bg-foreground/5 rounded animate-pulse" />
                          <div className="h-2.5 w-full bg-foreground/5 rounded animate-pulse" />
                          <div className="h-2.5 w-3/4 bg-foreground/5 rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Grouped results */}
                  {!loading && results.length > 0 && hasGroups && (
                    <div className="space-y-6">
                      {Object.entries(grouped).filter(([cat, items]) => items.length > 0 && cat !== "primary").map(([category, items]) => (
                        <div key={category}>
                          <h2 className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase mb-3 flex items-center gap-2">
                            <span className="h-px flex-1 bg-border/20" />
                            {CATEGORY_LABELS[category] || category}
                            <span className="h-px flex-1 bg-border/20" />
                          </h2>
                          <div className="space-y-3">
                            {items.filter(r => !blockedDomains.some(d => r.url.includes(d))).map((r, i) => (
                              <SearchResultCard
                                key={r.url}
                                result={r}
                                freshnessAlert={freshnessAlerts[r.url]}
                                onPreview={(p) => setPreview({ data: p, url: r.url })}
                                index={i}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Flat results (single group) */}
                  {!loading && results.length > 0 && !hasGroups && (
                    <div className="space-y-3">
                      {results.map((r, i) => (
                        <SearchResultCard
                          key={r.url}
                          result={r}
                          freshnessAlert={freshnessAlerts[r.url]}
                          onPreview={(p) => setPreview({ data: p, url: r.url })}
                          index={i}
                        />
                      ))}
                    </div>
                  )}

                  {/* No results */}
                  {!loading && searched && results.length === 0 && (
                    <div className="text-center py-16 animate-fade-in">
                      <Search className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-sm font-extralight text-muted-foreground">No results found. Try a different query or adjust your filters.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resize divider — desktop only, when a side panel is open */}
      {(intelMapOpen || intelSuiteOpen) && searched && results.length > 0 && (
        <div
          onMouseDown={(e) => { e.preventDefault(); startResize(); }}
          className="hidden lg:flex items-center justify-center w-1.5 cursor-col-resize group relative z-30"
          title="Drag to resize"
        >
          <div className="h-full w-px bg-border/30 group-hover:bg-accent/60 transition-colors" />
          <div className="absolute h-12 w-1 rounded-full bg-foreground/20 group-hover:bg-accent/70 transition-colors" />
        </div>
      )}

      {/* Intel Map split-screen panel */}
      {intelMapOpen && searched && results.length > 0 && (
        <div
          ref={rightPanelRef}
          className="hidden lg:block min-w-0 animate-fade-in"
          style={{ width: `${splitPct}%` }}
        >
          <IntelMapPanel
            query={query}
            results={results}
            onClose={() => setIntelMapOpen(false)}
            onRefineQuery={(q) => { setQuery(q); search(q); }}
          />
        </div>
      )}

      {/* Mobile: full-screen overlay for Intel Map */}
      {intelMapOpen && searched && results.length > 0 && (
        <div className="lg:hidden fixed inset-0 z-40 bg-background/40 backdrop-blur-2xl animate-fade-in">
          <IntelMapPanel
            query={query}
            results={results}
            onClose={() => setIntelMapOpen(false)}
            onRefineQuery={(q) => { setQuery(q); search(q); }}
          />
        </div>
      )}

      {/* Intelligence Suite split-screen panel */}
      {intelSuiteOpen && searched && results.length > 0 && (
        <div ref={rightPanelRef} className="hidden lg:block min-w-0 animate-fade-in" style={{ width: `${splitPct}%` }}>
          <IntelligenceSuitePanel
            query={query}
            results={results}
            onClose={() => setIntelSuiteOpen(false)}
            onRunQuery={(q) => { setQuery(q); search(q); }}
          />
        </div>
      )}

      {/* Mobile: full-screen overlay for Intelligence Suite */}
      {intelSuiteOpen && searched && results.length > 0 && (
        <div className="lg:hidden fixed inset-0 z-40 bg-background animate-fade-in">
          <IntelligenceSuitePanel
            query={query}
            results={results}
            onClose={() => setIntelSuiteOpen(false)}
            onRunQuery={(q) => { setQuery(q); search(q); }}
          />
        </div>
      )}

      {/* Page Preview Panel */}
      {preview && (
        <PagePreviewPanel preview={preview.data} url={preview.url} onClose={() => setPreview(null)} />
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
          <div className="rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl p-6 max-w-sm w-full mx-4 shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-foreground">Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="p-1 rounded-lg text-muted-foreground/50 hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2 text-xs">
              {[
                ["/", "Focus search bar"],
                ["↑ ↓", "Navigate results"],
                ["C", "Copy selected URL"],
                ["Esc", "Close panels"],
                ["?", "Toggle shortcuts"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{desc}</span>
                  <kbd className="rounded-md border border-border/30 bg-background/50 px-2 py-0.5 text-[10px] font-mono text-muted-foreground">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <IntelMapByokPanel
        open={byokOpen}
        onClose={() => setByokOpen(false)}
        onChange={() => setByokActive(isIntelMapByokEnabled())}
      />
    </div>
  );
};

export default ZophielEngineView;
