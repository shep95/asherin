import { useState, useRef, useEffect, useCallback } from "react";
import { Search, Globe, ExternalLink, Loader2, Zap, ArrowRight, Clock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

interface SearchResponse {
  success: boolean;
  query: string;
  instantAnswer: string | null;
  results: SearchResult[];
  page: number;
  error?: string;
}

const ZophielEngineView = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [instantAnswer, setInstantAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("zophiel_recent_searches");
    if (saved) setRecentSearches(JSON.parse(saved));
    inputRef.current?.focus();
  }, []);

  const saveRecent = (q: string) => {
    const updated = [q, ...recentSearches.filter((s) => s !== q)].slice(0, 8);
    setRecentSearches(updated);
    localStorage.setItem("zophiel_recent_searches", JSON.stringify(updated));
  };

  const search = useCallback(async (searchQuery?: string) => {
    const q = (searchQuery ?? query).trim();
    if (!q) return;

    setLoading(true);
    setSearched(true);
    setResults([]);
    setInstantAnswer(null);
    saveRecent(q);

    const start = performance.now();

    try {
      const { data, error } = await supabase.functions.invoke("zophiel-search", {
        body: { query: q },
      });

      const elapsed = Math.round(performance.now() - start);
      setSearchTime(elapsed);

      if (error) throw error;
      const res = data as SearchResponse;

      if (res.success) {
        setResults(res.results);
        setInstantAnswer(res.instantAnswer);
      }
    } catch (e: any) {
      console.error("Search failed:", e);
    } finally {
      setLoading(false);
    }
  }, [query, recentSearches]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search();
  };

  const clearRecent = () => {
    setRecentSearches([]);
    localStorage.removeItem("zophiel_recent_searches");
  };

  const domain = (url: string) => {
    try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search Header */}
      <div className={`flex-shrink-0 transition-all duration-500 ${searched ? "pt-6 pb-4" : "pt-[20vh] pb-8"}`}>
        <div className="max-w-2xl mx-auto px-6">
          {!searched && (
            <div className="text-center mb-8 animate-fade-in">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Zap className="h-6 w-6 text-accent" />
                <h1 className="text-2xl font-extralight tracking-[0.15em] text-foreground">ZOPHIEL ENGINE</h1>
              </div>
              <p className="text-sm font-extralight text-muted-foreground">Private search. No tracking. No profiling.</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-center gap-3 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl px-4 py-3 focus-within:border-accent/40 transition-colors">
              <Search className="h-5 w-5 text-muted-foreground/50 shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the web…"
                className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none"
              />
              {query && (
                <button type="button" onClick={() => { setQuery(""); inputRef.current?.focus(); }} className="p-1 rounded-lg text-muted-foreground/50 hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="rounded-xl bg-accent/20 px-4 py-1.5 text-xs font-light text-accent hover:bg-accent/30 transition-colors disabled:opacity-30"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </form>

          {/* Recent searches — only on landing */}
          {!searched && recentSearches.length > 0 && (
            <div className="mt-4 animate-fade-in">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-light tracking-wider text-muted-foreground/50 uppercase">Recent</span>
                <button onClick={clearRecent} className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground transition-colors">Clear</button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {recentSearches.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setQuery(s); search(s); }}
                    className="inline-flex items-center gap-1 rounded-lg border border-border/20 bg-card/20 px-2.5 py-1 text-[11px] font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                  >
                    <Clock className="h-3 w-3" />
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {searched && (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 pb-8">
            {/* Meta */}
            {!loading && results.length > 0 && (
              <p className="text-[10px] font-light text-muted-foreground/40 mb-4">
                {results.length} results in {searchTime}ms
              </p>
            )}

            {/* Instant Answer */}
            {instantAnswer && (
              <div className="rounded-xl border border-accent/20 bg-accent/5 backdrop-blur-sm p-4 mb-5 animate-fade-in">
                <div className="flex items-start gap-2">
                  <Zap className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-medium tracking-wider text-accent uppercase mb-1">Instant Answer</p>
                    <p className="text-sm font-light text-foreground leading-relaxed">{instantAnswer}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading skeleton */}
            {loading && (
              <div className="space-y-4 animate-fade-in">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="rounded-xl border border-border/10 bg-card/20 p-4 space-y-2">
                    <div className="h-3 w-48 bg-foreground/5 rounded animate-pulse" />
                    <div className="h-2.5 w-32 bg-foreground/5 rounded animate-pulse" />
                    <div className="h-2.5 w-full bg-foreground/5 rounded animate-pulse" />
                    <div className="h-2.5 w-3/4 bg-foreground/5 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            )}

            {/* Results list */}
            {!loading && results.length > 0 && (
              <div className="space-y-3">
                {results.map((r, i) => (
                  <a
                    key={i}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-xl border border-border/15 bg-card/20 backdrop-blur-sm p-4 hover:bg-foreground/5 hover:border-border/30 transition-all"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Globe className="h-3 w-3 text-muted-foreground/40" />
                      <span className="text-[11px] font-light text-muted-foreground/50 truncate">{r.source || domain(r.url)}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground/30 opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0" />
                    </div>
                    <h3 className="text-sm font-normal text-accent group-hover:underline underline-offset-2 mb-1 line-clamp-1">{r.title}</h3>
                    {r.snippet && (
                      <p className="text-xs font-extralight text-muted-foreground leading-relaxed line-clamp-2">{r.snippet}</p>
                    )}
                  </a>
                ))}
              </div>
            )}

            {/* No results */}
            {!loading && searched && results.length === 0 && (
              <div className="text-center py-16 animate-fade-in">
                <Globe className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-extralight text-muted-foreground">No results found. Try a different query.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ZophielEngineView;
