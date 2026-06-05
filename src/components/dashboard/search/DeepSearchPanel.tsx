import { useState, useEffect, useRef } from "react";
import { Brain, ExternalLink, Loader2, Globe, CheckCircle2, Sparkles, ArrowRight, SkipForward, Shield, ShieldAlert, ShieldCheck, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";

async function getAuthHeader(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return `Bearer ${token}`;
}

interface DeepSource {
  url: string;
  title: string;
  domain: string;
  tier?: number;
  provenanceScore?: number;
  hostile?: boolean;
}

interface CrossValidation {
  totalSources: number;
  tier1Count: number;
  tier2Count: number;
  hostileCount: number;
  averageProvenance: number;
  consensusStrength: 'strong' | 'moderate' | 'weak' | 'insufficient';
}

interface ClarifyQuestion {
  id: string;
  question: string;
  options: string[];
}

interface DeepSearchPanelProps {
  query: string;
  onClose: () => void;
}

const TIER_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'PRIMARY', color: 'text-emerald-400' },
  2: { label: 'ESTABLISHED', color: 'text-blue-400' },
  3: { label: 'INSTITUTIONAL', color: 'text-amber-400' },
  4: { label: 'GENERAL', color: 'text-muted-foreground/60' },
};

const CONSENSUS_CONFIG: Record<string, { label: string; color: string; icon: typeof ShieldCheck }> = {
  strong: { label: 'STRONG', color: 'text-emerald-400', icon: ShieldCheck },
  moderate: { label: 'MODERATE', color: 'text-blue-400', icon: Shield },
  weak: { label: 'WEAK', color: 'text-amber-400', icon: ShieldAlert },
  insufficient: { label: 'INSUFFICIENT', color: 'text-red-400', icon: AlertTriangle },
};

const DeepSearchPanel = ({ query, onClose }: DeepSearchPanelProps) => {
  const [sources, setSources] = useState<DeepSource[]>([]);
  const [totalFound, setTotalFound] = useState(0);
  const [validation, setValidation] = useState<CrossValidation | null>(null);
  const [content, setContent] = useState("");
  const [phase, setPhase] = useState<"clarifying" | "searching" | "validating" | "analyzing" | "streaming" | "done">("clarifying");
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const fetchQuestions = async () => {
      setLoadingQuestions(true);
      try {
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zophiel-deep-search`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: await getAuthHeader(),
            },
            body: JSON.stringify({ query, action: "refine" }),
            signal: controller.signal,
          }
        );
        if (controller.signal.aborted) return;
        if (resp.ok) {
          const data = await resp.json();
          if (data.questions && data.questions.length > 0) {
            setQuestions(data.questions);
            setLoadingQuestions(false);
            return;
          }
        }
      } catch (e: any) {
        if (e.name === "AbortError") return;
      }
      if (!controller.signal.aborted) {
        setLoadingQuestions(false);
        startDeepSearch({});
      }
    };
    fetchQuestions();
    return () => controller.abort();
  }, [query]);

  const selectAnswer = (questionId: string, option: string) => {
    setAnswers(prev => {
      const current = prev[questionId];
      if (current === option) {
        const { [questionId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [questionId]: option };
    });
  };

  const startDeepSearch = async (finalAnswers: Record<string, string>) => {
    setPhase("searching");
    abortRef.current = new AbortController();
    setContent("");
    setSources([]);
    setValidation(null);
    setError(null);

    try {
      const { getActiveIntelMapByok } = await import("@/lib/intelMapByok");
      const byok = getActiveIntelMapByok();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zophiel-deep-search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ query, answers: finalAnswers, ...(byok ? { byok } : {}) }),
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
              if (parsed.validation) setValidation(parsed.validation);
              setPhase("validating");
              await new Promise(r => setTimeout(r, 800));
              setPhase("analyzing");
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
      setError(e.message || "Deep search failed");
      setPhase("done");
    }
  };

  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  useEffect(() => {
    if (contentRef.current && phase === "streaming") {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, phase]);

  const consensusInfo = validation ? CONSENSUS_CONFIG[validation.consensusStrength] : null;

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 px-4 py-3 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent" />
          <span className="text-xs font-medium text-foreground tracking-wide">DEEP SEARCH</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-mono">TRUTH GRAPH</span>
        </div>
        <span className="text-[10px] text-muted-foreground/50 truncate flex-1">"{query}"</span>
      </div>

      {/* Clarification Phase */}
      {phase === "clarifying" && (
        <div className="flex-1 overflow-y-auto px-4 py-6">
          {loadingQuestions ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Sparkles className="h-6 w-6 text-accent animate-pulse" />
              <p className="text-xs text-muted-foreground/60">Semantic Intent Engine analyzing query vector…</p>
            </div>
          ) : questions.length > 0 ? (
            <div className="max-w-lg mx-auto space-y-5">
              <div className="text-center space-y-1.5 mb-6">
                <h3 className="text-sm font-medium text-foreground tracking-wide">SEMANTIC INTENT CALIBRATION</h3>
                <p className="text-[11px] text-muted-foreground/60">Calibrate the Truth Graph for maximum precision targeting</p>
              </div>

              {questions.map((q) => (
                <div key={q.id} className="space-y-2">
                  <p className="text-xs font-medium text-foreground/90">{q.question}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {q.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => selectAnswer(q.id, opt)}
                        className={`px-3 py-1.5 rounded-lg border text-[11px] transition-all ${
                          answers[q.id] === opt
                            ? "border-accent bg-accent/15 text-accent font-medium"
                            : "border-border/30 bg-card/30 text-muted-foreground hover:border-accent/30 hover:text-foreground"
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-2 pt-4">
                <button
                  onClick={() => startDeepSearch(answers)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-xs font-medium hover:bg-accent/90 transition-all"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  Execute Truth Graph Protocol
                </button>
                <button
                  onClick={() => startDeepSearch({})}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border/20 text-[11px] text-muted-foreground hover:text-foreground hover:border-border/40 transition-all"
                >
                  <SkipForward className="h-3 w-3" />
                  Skip
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Phase indicator (post-clarification) */}
      {phase !== "clarifying" && (
        <div className="flex-shrink-0 px-4 py-2.5 border-b border-border/10 bg-card/20">
          <div className="flex items-center gap-4 text-[10px]">
            <PhaseStep label="Multi-vector search" active={phase === "searching"} done={phase !== "searching"} />
            <PhaseStep label="Cross-source validation" active={phase === "validating"} done={["analyzing", "streaming", "done"].includes(phase)} />
            <PhaseStep label={`Scraping ${sources.length} sources`} active={phase === "analyzing"} done={phase === "streaming" || phase === "done"} />
            <PhaseStep label="Truth Graph synthesis" active={phase === "streaming"} done={phase === "done"} />
          </div>
        </div>
      )}

      {/* Truth Graph Validation Bar */}
      {validation && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-border/10 bg-card/10">
          <div className="flex items-center gap-3 text-[10px]">
            {consensusInfo && (
              <div className={`flex items-center gap-1 ${consensusInfo.color}`}>
                <consensusInfo.icon className="h-3 w-3" />
                <span className="font-medium">CONSENSUS: {consensusInfo.label}</span>
              </div>
            )}
            <span className="text-muted-foreground/30">|</span>
            <span className="text-muted-foreground/50">
              {validation.tier1Count} primary · {validation.tier2Count} established · {validation.averageProvenance > 0 ? `${Math.round(validation.averageProvenance * 100)}% avg provenance` : ''}
            </span>
            {validation.hostileCount > 0 && (
              <>
                <span className="text-muted-foreground/30">|</span>
                <span className="text-red-400/70 flex items-center gap-1">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {validation.hostileCount} hostile flagged
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sources bar */}
      {sources.length > 0 && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-border/10 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] text-muted-foreground/40 uppercase tracking-wider mr-1 shrink-0">Sources</span>
            {sources.map((s, i) => {
              const tierInfo = TIER_LABELS[s.tier || 4];
              return (
                <a
                  key={i}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] transition-colors shrink-0 ${
                    s.hostile
                      ? 'border-red-500/30 bg-red-500/5 text-red-400 hover:border-red-500/50'
                      : 'border-border/20 bg-card/30 text-muted-foreground hover:text-foreground hover:border-accent/30'
                  }`}
                  title={`${s.title} — ${tierInfo.label} (${s.provenanceScore ? Math.round(s.provenanceScore * 100) : '?'}% provenance)`}
                >
                  {s.hostile ? <AlertTriangle className="h-2.5 w-2.5" /> : <Globe className="h-2.5 w-2.5" />}
                  <span className={`text-[8px] font-mono ${tierInfo.color}`}>{(s.tier || 4) === 1 ? '■' : (s.tier || 4) === 2 ? '◆' : '○'}</span>
                  {s.domain}
                  <ExternalLink className="h-2 w-2 opacity-40" />
                </a>
              );
            })}
            {totalFound > sources.length && (
              <span className="text-[9px] text-muted-foreground/30 shrink-0">+{totalFound - sources.length} found</span>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {phase !== "clarifying" && (
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
                {phase === "searching" ? "Executing multi-vector search across web intelligence…" :
                 phase === "validating" ? "Cross-referencing sources against Immutable Truth Graph…" :
                 phase === "analyzing" ? "Scraping and validating source integrity…" :
                 "Constructing Causal Chain of Knowledge synthesis…"}
              </p>
            </div>
          )}

          {content && (
            <div className="prose prose-sm prose-invert max-w-none space-y-4
              prose-headings:text-foreground prose-headings:font-medium prose-headings:tracking-wide
              prose-h2:text-base prose-h2:mt-8 prose-h2:mb-3 prose-h2:border-b prose-h2:border-border/20 prose-h2:pb-2
              prose-h3:text-sm prose-h3:mt-6 prose-h3:mb-2
              prose-p:text-[13px] prose-p:leading-[1.8] prose-p:text-muted-foreground prose-p:mb-4
              prose-li:text-[13px] prose-li:text-muted-foreground prose-li:leading-[1.8] prose-li:mb-1.5
              prose-ul:my-3 prose-ol:my-3
              prose-strong:text-foreground prose-strong:font-medium
              prose-a:text-accent prose-a:no-underline hover:prose-a:underline
              prose-code:text-accent/80 prose-code:text-[11px] prose-code:bg-accent/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
              prose-blockquote:border-accent/30 prose-blockquote:bg-accent/5 prose-blockquote:rounded-r-lg prose-blockquote:py-2 prose-blockquote:px-4 prose-blockquote:my-4
              prose-hr:border-border/20 prose-hr:my-6
            ">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          )}

          {phase === "streaming" && (
            <span className="inline-block w-1.5 h-4 bg-accent/60 animate-pulse ml-0.5 align-text-bottom" />
          )}
        </div>
      )}
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
