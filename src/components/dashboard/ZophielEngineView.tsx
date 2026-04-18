import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Search, Zap, ArrowRight, Clock, X, Loader2, Keyboard, WifiOff, Network, Brain } from "lucide-react";
import MessageQueuePanel from "./MessageQueuePanel";
import { supabase } from "@/integrations/supabase/client";
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

const CATEGORY_LABELS: Record<string, string> = {
  primary: "Primary Sources",
  breaking: "Breaking Coverage",
  analysis: "In-Depth Analysis",
  community: "Community Discussion",
  general: "Results",
};

const ZophielEngineView = () => {
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
  const [online, setOnline] = useState(navigator.onLine);
  const [queuedSearch, setQueuedSearch] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

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

    // If offline, queue the search
    if (!navigator.onLine) {
      setQueuedSearch(q);
      saveRecent(q);
      setSearched(true);
      setShowSuggestions(false);
      return;
    }

    setDeepSearchQuery(null);
    setLoading(true);
    setSearched(true);
    setResults([]);
    setGrouped({});
    setInstantAnswer(null);
    setFreshnessAlerts({});
    setShowSuggestions(false);
    setSelectedIndex(-1);
    setQueuedSearch(null);
    saveRecent(q);

    const start = performance.now();

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
    } finally {
      setLoading(false);
    }
  }, [query, mode, filters, operatorOverrides, blockedDomains, recentSearches]);

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
    <div className="flex h-full relative">
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

      <div className={`flex flex-col min-w-0 transition-all duration-300 ${(intelMapOpen || intelSuiteOpen) && searched && results.length > 0 ? "flex-1 lg:w-2/5 lg:flex-none" : "flex-1"}`}>
        {/* Search Header */}
        <div className={`flex-shrink-0 transition-all duration-500 ${searched ? "pt-3 sm:pt-4 pb-2 sm:pb-3" : "pt-[12vh] sm:pt-[18vh] pb-4 sm:pb-6"}`}>
          <div className="max-w-2xl mx-auto px-3 sm:px-6">
            {!searched && (
              <div className="text-center mb-6 animate-fade-in">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Zap className="h-6 w-6 text-accent" />
                  <h1 className="text-2xl font-extralight tracking-[0.15em] text-foreground">ZOPHIEL ENGINE</h1>
                </div>
                <p className="text-sm font-extralight text-muted-foreground">Private search. No tracking. No profiling. Full control.</p>
              </div>
            )}

            {/* Mode selector */}
            <div className="mb-3">
              <SearchModeSelector active={mode} onChange={setMode} />
            </div>

            {/* Search bar */}
            <form onSubmit={handleSubmit} className="relative">
              <div className={`flex items-center gap-2 rounded-2xl border ${!online ? "border-amber-500/30" : "border-border/30"} bg-card/40 backdrop-blur-xl px-4 py-3 focus-within:border-accent/40 transition-colors`}>
                {!online && <WifiOff className="h-4 w-4 text-amber-400/60 shrink-0" />}
                <Search className="h-5 w-5 text-muted-foreground/50 shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setShowSuggestions(e.target.value.length > 1); }}
                  onFocus={() => { if (query.length > 1) setShowSuggestions(true); }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder={online ? "Search the web…" : "Offline — search will queue…"}
                  className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
                />
                {query && (
                  <button type="button" onClick={() => { setQuery(""); setShowSuggestions(false); inputRef.current?.focus(); }} className="p-1 rounded-lg text-muted-foreground/50 hover:text-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                )}
                <SearchOperatorsPanel filters={filters} onFiltersChange={setFilters} onOperatorString={setOperatorOverrides} />
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="rounded-xl bg-accent/20 px-4 py-1.5 text-xs font-light text-accent hover:bg-accent/30 transition-colors disabled:opacity-30"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                </button>
              </div>

              {/* Query suggestions dropdown */}
              {showSuggestions && query.length > 1 && (
                <QuerySuggestions query={query} onSelect={handleSuggestionSelect} />
              )}
            </form>

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

            {/* Keyboard hint */}
            {!searched && (
              <div className="mt-4 text-center">
                <button onClick={() => setShowShortcuts(true)} className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors">
                  <Keyboard className="h-3 w-3" />
                  Press ? for keyboard shortcuts
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results */}
        {searched && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto px-3 sm:px-6 pb-8">
              {/* Queue Panel */}
              <MessageQueuePanel
                items={queuedSearch ? [{ id: "zophiel-queued", content: queuedSearch }] : []}
                onRemove={() => setQueuedSearch(null)}
                onClear={() => setQueuedSearch(null)}
              />

              {/* Deep Search Panel */}
              {deepSearchQuery && (
                <DeepSearchPanel query={deepSearchQuery} onClose={() => setDeepSearchQuery(null)} />
              )}

              {/* Standard search results */}
              {!deepSearchQuery && (
                <>
                  {/* Meta */}
                  {!loading && results.length > 0 && (
                    <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                      <p className="text-[10px] font-light text-muted-foreground/40">
                        {results.length} results in {searchTime}ms • Mode: {mode}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setIntelMapOpen((v) => !v); if (!intelMapOpen) setIntelSuiteOpen(false); }}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-light tracking-wide transition-colors ${
                            intelMapOpen
                              ? "border-accent/40 bg-accent/15 text-accent"
                              : "border-border/30 bg-card/30 text-muted-foreground hover:text-foreground hover:border-border/50"
                          }`}
                          title="Build Palantir-style intelligence map from these results"
                        >
                          <Network className="h-3.5 w-3.5" />
                          {intelMapOpen ? "Close Map" : "Intel Map"}
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
                          {intelSuiteOpen ? "Close Intel" : "Intel Suite"}
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
                      {Object.entries(grouped).filter(([_, items]) => items.length > 0).map(([category, items]) => (
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

      {/* Intel Map split-screen panel */}
      {intelMapOpen && searched && results.length > 0 && (
        <div className="hidden lg:block lg:w-3/5 min-w-0 animate-fade-in">
          <IntelMapPanel
            query={query}
            results={results}
            onClose={() => setIntelMapOpen(false)}
          />
        </div>
      )}

      {/* Mobile: full-screen overlay for Intel Map */}
      {intelMapOpen && searched && results.length > 0 && (
        <div className="lg:hidden fixed inset-0 z-40 bg-background animate-fade-in">
          <IntelMapPanel
            query={query}
            results={results}
            onClose={() => setIntelMapOpen(false)}
          />
        </div>
      )}

      {/* Intelligence Suite split-screen panel */}
      {intelSuiteOpen && searched && results.length > 0 && (
        <div className="hidden lg:block lg:w-3/5 min-w-0 animate-fade-in">
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
    </div>
  );
};

export default ZophielEngineView;
