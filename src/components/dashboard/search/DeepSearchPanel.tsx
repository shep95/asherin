import { useState, useEffect, useRef } from "react";
import { Brain, ExternalLink, Globe, Shield, ShieldAlert, ShieldCheck, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
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
  snippet?: string;
}

interface CrossValidation {
  totalSources: number;
  tier1Count: number;
  tier2Count: number;
  hostileCount: number;
  averageProvenance: number;
  consensusStrength: 'strong' | 'moderate' | 'weak' | 'insufficient';
}

interface DeepSearchPanelProps {
  query: string;
  onClose: () => void;
}

const TIER_LABELS: Record<number, { label: string; color: string; mark: string }> = {
  1: { label: 'PRIMARY', color: 'text-emerald-400', mark: '■' },
  2: { label: 'ESTABLISHED', color: 'text-blue-400', mark: '◆' },
  3: { label: 'INSTITUTIONAL', color: 'text-amber-400', mark: '◉' },
  4: { label: 'GENERAL', color: 'text-muted-foreground/60', mark: '○' },
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
  const [phase, setPhase] = useState<"searching" | "validating" | "done">("searching");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const run = async () => {
      abortRef.current = new AbortController();
      setSources([]);
      setValidation(null);
      setError(null);
      setPhase("searching");

      try {
        const { getActiveIntelMapByok } = await import("@/lib/intelMapByok");
        const byok = getActiveIntelMapByok();
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zophiel-deep-search`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: await getAuthHeader(),
            },
            body: JSON.stringify({ query, answers: {}, ...(byok ? { byok } : {}) }),
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
          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
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
              } else if (parsed.type === "done") {
                setPhase("done");
              }
            } catch { /* partial */ }
          }
        }
        setPhase("done");
      } catch (e: any) {
        if (e.name === "AbortError") return;
        setError(e.message || "Deep search failed");
        setPhase("done");
      }
    };
    run();
    return () => abortRef.current?.abort();
  }, [query]);

  const consensusInfo = validation ? CONSENSUS_CONFIG[validation.consensusStrength] : null;

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 px-4 py-3 flex items-center gap-3">
        <Brain className="h-4 w-4 text-accent" />
        <span className="text-xs font-medium text-foreground tracking-wide">DEEP SEARCH</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-mono">TRUTH GRAPH</span>
        <span className="text-[10px] text-muted-foreground/50 truncate flex-1">"{query}"</span>
      </div>

      {/* Phase indicator */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-border/10 bg-card/20">
        <div className="flex items-center gap-4 text-[10px]">
          <PhaseStep label="Multi-vector search" active={phase === "searching"} done={phase !== "searching"} />
          <PhaseStep label="Cross-source validation" active={phase === "validating"} done={phase === "done"} />
          <PhaseStep label={`${sources.length} validated sources`} active={false} done={phase === "done"} />
        </div>
      </div>

      {/* Truth Graph Validation Bar */}
      {validation && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-border/10 bg-card/10">
          <div className="flex items-center gap-3 text-[10px] flex-wrap">
            {consensusInfo && (
              <div className={`flex items-center gap-1 ${consensusInfo.color}`}>
                <consensusInfo.icon className="h-3 w-3" />
                <span className="font-medium">CONSENSUS: {consensusInfo.label}</span>
              </div>
            )}
            <span className="text-muted-foreground/30">|</span>
            <span className="text-muted-foreground/50">
              {validation.tier1Count} primary · {validation.tier2Count} established
              {validation.averageProvenance > 0 ? ` · ${Math.round(validation.averageProvenance * 100)}% avg provenance` : ''}
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
            {totalFound > sources.length && (
              <>
                <span className="text-muted-foreground/30">|</span>
                <span className="text-muted-foreground/50">{totalFound} total candidates</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {!error && sources.length === 0 && phase !== "done" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 animate-pulse">
            <Brain className="h-8 w-8 text-accent/40" />
            <p className="text-xs text-muted-foreground/50">
              {phase === "searching"
                ? "Executing multi-vector search across web intelligence…"
                : "Cross-referencing sources against Immutable Truth Graph…"}
            </p>
          </div>
        )}

        {!error && sources.length === 0 && phase === "done" && (
          <div className="text-center py-12 text-xs text-muted-foreground/50">
            No validated sources returned for this query.
          </div>
        )}

        {sources.map((s, i) => {
          const tierInfo = TIER_LABELS[s.tier || 4];
          return (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`block rounded-lg border px-3 py-2.5 transition-colors group ${
                s.hostile
                  ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/50'
                  : 'border-border/20 bg-card/30 hover:border-accent/40 hover:bg-card/50'
              }`}
            >
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 mb-1">
                {s.hostile ? <AlertTriangle className="h-3 w-3 text-red-400" /> : <Globe className="h-3 w-3" />}
                <span className={`font-mono ${tierInfo.color}`}>{tierInfo.mark}</span>
                <span className={`font-mono ${tierInfo.color}`}>{tierInfo.label}</span>
                <span className="text-muted-foreground/30">·</span>
                <span className="truncate">{s.domain}</span>
                {typeof s.provenanceScore === 'number' && (
                  <>
                    <span className="text-muted-foreground/30">·</span>
                    <span>{Math.round(s.provenanceScore * 100)}% provenance</span>
                  </>
                )}
                <ExternalLink className="h-2.5 w-2.5 opacity-40 ml-auto group-hover:opacity-100" />
              </div>
              <div className="text-[13px] font-medium text-foreground group-hover:text-accent transition-colors leading-snug">
                {s.title || s.url}
              </div>
              {s.snippet && (
                <div className="text-[12px] text-muted-foreground/80 leading-relaxed mt-1.5 line-clamp-3">
                  {s.snippet}
                </div>
              )}
            </a>
          );
        })}
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
