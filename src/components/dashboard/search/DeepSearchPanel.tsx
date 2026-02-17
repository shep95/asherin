import { useState, useEffect, useRef } from "react";
import { Brain, ExternalLink, Loader2, Globe, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface DeepSource {
  url: string;
  title: string;
  domain: string;
}

interface DeepSearchPanelProps {
  query: string;
  onClose: () => void;
}

const DeepSearchPanel = ({ query, onClose }: DeepSearchPanelProps) => {
  const [sources, setSources] = useState<DeepSource[]>([]);
  const [totalFound, setTotalFound] = useState(0);
  const [content, setContent] = useState("");
  const [phase, setPhase] = useState<"searching" | "analyzing" | "streaming" | "done">("searching");
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const run = async () => {
      abortRef.current = new AbortController();
      setPhase("searching");
      setContent("");
      setSources([]);
      setError(null);

      try {
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zophiel-deep-search`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ query }),
            signal: abortRef.current.signal,
          }
        );

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({ error: "Deep search failed" }));
          throw new Error(errData.error || `HTTP ${resp.status}`);
        }

        if (!resp.body) throw new Error("No response body");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIdx: number;
          while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIdx).trim();
            buffer = buffer.slice(newlineIdx + 1);

            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);

              if (parsed.type === "sources") {
                setSources(parsed.sources || []);
                setTotalFound(parsed.totalSearchResults || 0);
                setPhase("analyzing");
                // Small delay to show the analyzing state
                await new Promise(r => setTimeout(r, 600));
                setPhase("streaming");
              } else if (parsed.type === "delta") {
                setContent(prev => prev + parsed.text);
              } else if (parsed.type === "done") {
                setPhase("done");
              }
            } catch { /* partial JSON */ }
          }
        }
        setPhase("done");
      } catch (e: any) {
        if (e.name === "AbortError") return;
        console.error("Deep search error:", e);
        setError(e.message || "Deep search failed");
        setPhase("done");
      }
    };

    run();
    return () => { abortRef.current?.abort(); };
  }, [query]);

  // Auto-scroll as content streams
  useEffect(() => {
    if (contentRef.current && phase === "streaming") {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, phase]);

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent" />
          <span className="text-xs font-medium text-foreground tracking-wide">DEEP SEARCH</span>
        </div>
        <span className="text-[10px] text-muted-foreground/50 truncate flex-1">"{query}"</span>
      </div>

      {/* Phase indicator */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-border/10 bg-card/20">
        <div className="flex items-center gap-4 text-[10px]">
          <PhaseStep label="Searching web" active={phase === "searching"} done={phase !== "searching"} />
          <PhaseStep label={`Scraping ${sources.length} sources`} active={phase === "analyzing"} done={phase === "streaming" || phase === "done"} />
          <PhaseStep label="AI synthesis" active={phase === "streaming"} done={phase === "done"} />
        </div>
      </div>

      {/* Sources bar */}
      {sources.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-border/10 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mr-1 shrink-0">Sources</span>
            {sources.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-accent/30 transition-colors shrink-0"
                title={s.title}
              >
                <Globe className="h-2.5 w-2.5" />
                {s.domain}
                <ExternalLink className="h-2 w-2 opacity-40" />
              </a>
            ))}
            {totalFound > sources.length && (
              <span className="text-[9px] text-muted-foreground/30 shrink-0">+{totalFound - sources.length} found</span>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto px-4 py-4">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {!error && !content && phase !== "done" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 animate-pulse">
            <Brain className="h-8 w-8 text-accent/40" />
            <p className="text-xs text-muted-foreground/50">
              {phase === "searching" ? "Searching multiple angles across the web…" :
               phase === "analyzing" ? "Scraping and analyzing source content…" :
               "Synthesizing intelligence report…"}
            </p>
          </div>
        )}

        {content && (
          <div className="prose prose-sm prose-invert max-w-none
            prose-headings:text-foreground prose-headings:font-medium prose-headings:tracking-wide
            prose-h2:text-sm prose-h2:mt-6 prose-h2:mb-2 prose-h2:border-b prose-h2:border-border/20 prose-h2:pb-1
            prose-h3:text-xs prose-h3:mt-4 prose-h3:mb-1.5
            prose-p:text-[12px] prose-p:leading-relaxed prose-p:text-muted-foreground
            prose-li:text-[12px] prose-li:text-muted-foreground
            prose-strong:text-foreground prose-strong:font-medium
            prose-a:text-accent prose-a:no-underline hover:prose-a:underline
            prose-code:text-accent/80 prose-code:text-[11px] prose-code:bg-accent/10 prose-code:px-1 prose-code:rounded
          ">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        )}

        {phase === "streaming" && (
          <span className="inline-block w-1.5 h-4 bg-accent/60 animate-pulse ml-0.5 align-text-bottom" />
        )}
      </div>
    </div>
  );
};

const PhaseStep = ({ label, active, done }: { label: string; active: boolean; done: boolean }) => (
  <div className={`flex items-center gap-1 transition-all ${active ? "text-accent" : done ? "text-muted-foreground/40" : "text-muted-foreground/20"}`}>
    {active ? (
      <Loader2 className="h-3 w-3 animate-spin" />
    ) : done ? (
      <CheckCircle2 className="h-3 w-3" />
    ) : (
      <div className="h-3 w-3 rounded-full border border-current" />
    )}
    <span className="whitespace-nowrap">{label}</span>
  </div>
);

export default DeepSearchPanel;
