import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { X, Brain, Zap, Eye, Copy, Check, Download, ChevronRight, Play, Pause, RotateCcw, Minus, Plus } from "lucide-react";
import NeuralVisualization from "./NeuralVisualization";

interface ThinkingStep {
  title: string;
  detail: string;
  confidence: number;
  status: "complete" | "active" | "pending";
  concepts?: string[];
}

interface AttentionWeight {
  phrase: string;
  weight: number;
}

interface NeuralThinkingModalProps {
  open: boolean;
  query: string;
  response: string;
  onClose: () => void;
}

/* ── Extract thinking data from response ── */

function extractThinkingSteps(query: string, response: string): ThinkingStep[] {
  const steps: ThinkingStep[] = [];
  const lines = response.split("\n").filter(l => l.trim());

  // Step 1: Understanding
  const keywords = query.split(/\s+/).filter(w => w.length > 3).slice(0, 5);
  steps.push({
    title: "Understanding Query",
    detail: `Identified key terms: ${keywords.map(k => `"${k}"`).join(", ")}`,
    confidence: 98,
    status: "complete",
    concepts: keywords,
  });

  // Step 2: Context Retrieval
  const headings = lines.filter(l => l.match(/^#{1,3}\s/)).map(h => h.replace(/^#+\s*/, "").replace(/\*/g, "").trim());
  const conceptCount = headings.length || Math.floor(response.length / 80);
  steps.push({
    title: "Context Retrieval",
    detail: `Accessed ${conceptCount} knowledge domains. Scanning ${response.length.toLocaleString()} chars of reasoning data.`,
    confidence: 92,
    status: "complete",
    concepts: headings.slice(0, 6),
  });

  // Step 3: Pattern Analysis
  const bulletCount = lines.filter(l => l.match(/^[-*]\s/)).length;
  const codeBlockCount = (response.match(/```/g) || []).length / 2;
  steps.push({
    title: "Pattern Analysis",
    detail: `Detected ${bulletCount} data points, ${Math.floor(codeBlockCount)} code segments. Cross-referencing patterns.`,
    confidence: 87,
    status: "complete",
  });

  // Step 4: Reasoning Synthesis
  const sentenceCount = (response.match(/[.!?]+/g) || []).length;
  steps.push({
    title: "Reasoning Synthesis",
    detail: `Synthesized ${sentenceCount} reasoning chains across ${headings.length || 1} topic branches.`,
    confidence: 91,
    status: "complete",
  });

  // Step 5: Response Generation
  steps.push({
    title: "Response Generated",
    detail: `Final output: ${response.length.toLocaleString()} chars · ${lines.length} lines · Structured with ${headings.length} sections.`,
    confidence: 94,
    status: "complete",
  });

  return steps;
}

function extractAttentionWeights(query: string): AttentionWeight[] {
  const words = query.split(/\s+/);
  const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "be", "been", "being", "in", "on", "at", "to", "for", "of", "with", "by", "from", "as", "into", "through", "during", "before", "after", "above", "below", "between", "out", "off", "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", "how", "all", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now", "what", "my", "me", "i", "it", "do", "and", "or", "but", "if", "this", "that"]);

  // Group consecutive words into phrases
  const phrases: { phrase: string; importance: number }[] = [];
  let currentPhrase: string[] = [];

  words.forEach((word) => {
    const clean = word.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (stopWords.has(clean) || clean.length <= 2) {
      if (currentPhrase.length > 0) {
        phrases.push({ phrase: currentPhrase.join(" "), importance: currentPhrase.length });
        currentPhrase = [];
      }
      // Add stop word as low-importance single
      if (clean) phrases.push({ phrase: word, importance: 0 });
    } else {
      currentPhrase.push(word);
    }
  });
  if (currentPhrase.length > 0) {
    phrases.push({ phrase: currentPhrase.join(" "), importance: currentPhrase.length });
  }

  // Normalize to weights
  const maxImportance = Math.max(...phrases.map(p => p.importance), 1);
  return phrases.map(p => ({
    phrase: p.phrase,
    weight: p.importance === 0 ? Math.floor(Math.random() * 15 + 5) : Math.floor((p.importance / maxImportance) * 60 + 35 + Math.random() * 10),
  }));
}

/* ── Animated step component ── */

const ThinkingStepCard = ({ step, index, visible }: { step: ThinkingStep; index: number; visible: boolean }) => {
  if (!visible) return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/10 bg-card/20">
      <div className="h-6 w-6 rounded-full bg-muted-foreground/10 animate-pulse" />
      <div className="flex-1 h-3 bg-muted-foreground/10 rounded animate-pulse" />
    </div>
  );

  return (
    <div className="rounded-xl border border-border/20 bg-card/40 backdrop-blur-sm px-3 py-3 animate-fade-in" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-medium bg-accent/20 text-accent">✓</div>
        <span className="text-[11px] font-light text-foreground tracking-wide">{step.title}</span>
        <span className="ml-auto text-[9px] text-muted-foreground/40">{step.confidence}%</span>
      </div>
      <p className="text-[10px] font-extralight text-muted-foreground/60 leading-relaxed pl-7">{step.detail}</p>
      <div className="mt-2 pl-7">
        <div className="h-1 rounded-full bg-border/15 overflow-hidden">
          <div className="h-full rounded-full bg-accent/50 transition-all duration-500" style={{ width: `${step.confidence}%` }} />
        </div>
      </div>
      {step.concepts && step.concepts.length > 0 && (
        <div className="mt-2 pl-7 flex flex-wrap gap-1">
          {step.concepts.map((c, i) => (
            <span key={i} className="text-[8px] font-light tracking-wider text-accent/60 border border-accent/15 rounded-full px-2 py-0.5">{c}</span>
          ))}
        </div>
      )}
    </div>
  );
};

/* ── Main Modal ── */

const SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2, 3];
const BASE_STEP_MS = 600;

const NeuralThinkingModal = ({ open, query, response, onClose }: NeuralThinkingModalProps) => {
  const [activeTab, setActiveTab] = useState<"neural" | "steps" | "stats">("neural");
  const [copied, setCopied] = useState(false);
  const [isAnimating, setIsAnimating] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [progress, setProgress] = useState(0);
  const progressTimerRef = useRef<number>(0);
  const pausedElapsedRef = useRef<number>(0);
  const playStartRef = useRef<number>(0);

  const steps = useMemo(() => extractThinkingSteps(query, response), [query, response]);
  const attentionWeights = useMemo(() => extractAttentionWeights(query), [query]);
  const overallConfidence = useMemo(() => Math.round(steps.reduce((s, st) => s + st.confidence, 0) / steps.length), [steps]);

  const totalDuration = useMemo(() => steps.length * BASE_STEP_MS + 500, [steps.length]);

  const stats = useMemo(() => ({
    neuronsActive: Math.floor(Math.random() * 800 + 400),
    pathsActive: Math.floor(Math.random() * 80 + 30),
    tokensUsed: response.split(/\s+/).length * 1.3,
    reasoningDepth: steps.length,
    processingTime: (Math.random() * 2 + 0.8).toFixed(1),
  }), [response, steps]);

  const visibleStepCount = Math.min(Math.floor(progress * (steps.length + 1)), steps.length);

  useEffect(() => {
    if (!open || !isPlaying) return;
    playStartRef.current = performance.now();
    const baseElapsed = pausedElapsedRef.current;

    const tick = () => {
      const delta = (performance.now() - playStartRef.current) * speed;
      const totalElapsed = baseElapsed + delta;
      const p = Math.min(totalElapsed / totalDuration, 1);
      setProgress(p);
      setIsAnimating(p < 1);
      if (p < 1) {
        progressTimerRef.current = requestAnimationFrame(tick);
      } else {
        pausedElapsedRef.current = totalDuration;
        setIsPlaying(false);
      }
    };

    progressTimerRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(progressTimerRef.current);
  }, [open, isPlaying, speed, totalDuration]);

  useEffect(() => {
    if (open) {
      setProgress(0);
      pausedElapsedRef.current = 0;
      setIsPlaying(true);
      setIsAnimating(true);
    }
  }, [open]);

  const handleReplay = useCallback(() => {
    setProgress(0);
    pausedElapsedRef.current = 0;
    setIsPlaying(true);
    setIsAnimating(true);
  }, []);

  const handleTogglePlay = useCallback(() => {
    if (progress >= 1) {
      handleReplay();
    } else {
      if (isPlaying) {
        pausedElapsedRef.current = progress * totalDuration;
      }
      setIsPlaying(p => !p);
    }
  }, [progress, isPlaying, totalDuration, handleReplay]);

  const handleSpeedChange = useCallback((delta: number) => {
    setSpeed(prev => {
      const idx = SPEED_OPTIONS.indexOf(prev);
      const next = idx + delta;
      if (next >= 0 && next < SPEED_OPTIONS.length) return SPEED_OPTIONS[next];
      return prev;
    });
  }, []);

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setProgress(val);
    pausedElapsedRef.current = val * totalDuration;
    setIsAnimating(val < 1);
    if (val >= 1) setIsPlaying(false);
  }, [totalDuration]);

  const handleCopy = useCallback(() => {
    const text = steps.map((s, i) => `Step ${i + 1}: ${s.title}\n${s.detail}\nConfidence: ${s.confidence}%`).join("\n\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [steps]);

  const handleDownload = useCallback(() => {
    const text = [
      `# asherin Neural Thought Process`,
      `## Query: ${query}`,
      ``,
      ...steps.map((s, i) => `### Step ${i + 1}: ${s.title}\n${s.detail}\nConfidence: ${s.confidence}%`),
      ``,
      `## Attention Weights`,
      ...attentionWeights.map(a => `- "${a.phrase}": ${a.weight}%`),
      ``,
      `## Stats`,
      `- Neurons Active: ${stats.neuronsActive}/s`,
      `- Active Paths: ${stats.pathsActive}`,
      `- Overall Confidence: ${overallConfidence}%`,
      `- Processing Time: ${stats.processingTime}s`,
    ].join("\n");
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aureon-thought-process.md";
    a.click();
    URL.revokeObjectURL(url);
  }, [query, steps, attentionWeights, stats, overallConfidence]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl border border-border/20 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col animate-scale-in" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/15">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-accent/15 flex items-center justify-center">
              <Brain className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h2 className="text-sm font-light text-foreground tracking-wide">asherin Neural Thought Process</h2>
              <p className="text-[9px] font-extralight text-muted-foreground/50 tracking-wider uppercase">Real-time reasoning visualization</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground transition-colors" title="Copy">
              {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <button onClick={handleDownload} className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground transition-colors" title="Download">
              <Download className="h-3.5 w-3.5" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Mobile Tabs */}
        <div className="flex items-center gap-1 px-5 py-2 border-b border-border/10 sm:hidden">
          {(["neural", "steps", "stats"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-light tracking-wider uppercase transition-all ${
                activeTab === tab ? "bg-accent/15 text-accent" : "text-muted-foreground/40"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 sm:gap-0">
            
            {/* Left: Neural Visualization */}
            <div className={`p-4 sm:p-5 sm:border-r border-border/10 ${activeTab !== "neural" ? "hidden sm:block" : ""}`}>
              <div className="mb-3">
                <span className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/40 uppercase">Neural Visualization</span>
              </div>
              
              <div className="rounded-xl border border-border/15 bg-background/50 overflow-hidden">
                <NeuralVisualization isThinking={isAnimating} />
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="rounded-lg border border-border/15 bg-card/30 px-2.5 py-2 text-center">
                  <p className="text-[15px] font-light text-accent tabular-nums">{stats.neuronsActive}</p>
                  <p className="text-[8px] font-extralight text-muted-foreground/40 tracking-wider uppercase">Neurons/s</p>
                </div>
                <div className="rounded-lg border border-border/15 bg-card/30 px-2.5 py-2 text-center">
                  <p className="text-[15px] font-light text-foreground tabular-nums">{stats.pathsActive}</p>
                  <p className="text-[8px] font-extralight text-muted-foreground/40 tracking-wider uppercase">Active Paths</p>
                </div>
                <div className="rounded-lg border border-border/15 bg-card/30 px-2.5 py-2 text-center">
                  <p className="text-[15px] font-light text-accent tabular-nums">{overallConfidence}%</p>
                  <p className="text-[8px] font-extralight text-muted-foreground/40 tracking-wider uppercase">Confidence</p>
                </div>
              </div>

              {/* Attention Weights */}
              <div className="mt-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Eye className="h-3 w-3 text-muted-foreground/40" />
                  <span className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/40 uppercase">Attention Weights</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {attentionWeights.map((aw, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded text-[10px] font-light transition-all"
                      style={{
                        backgroundColor: `hsla(var(--accent), ${aw.weight / 200})`,
                        color: aw.weight > 50 ? `hsl(var(--accent))` : `hsl(var(--muted-foreground))`,
                        opacity: 0.4 + aw.weight / 150,
                      }}
                      title={`Attention: ${aw.weight}%`}
                    >
                      {aw.phrase}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Thought Steps */}
            <div className={`p-4 sm:p-5 ${activeTab !== "steps" && activeTab !== "stats" ? "hidden sm:block" : ""}`}>
              <div className="flex items-center gap-1.5 mb-3">
                <Zap className="h-3 w-3 text-accent" />
                <span className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/40 uppercase">Thought Breakdown</span>
              </div>

              <div className="space-y-2">
                {steps.map((step, i) => (
                  <ThinkingStepCard key={i} step={step} index={i} visible={i < visibleStepCount} />
                ))}
              </div>

              {/* Knowledge Paths */}
              <div className="mt-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                  <span className="text-[9px] font-light tracking-[0.2em] text-muted-foreground/40 uppercase">Knowledge Paths Activated</span>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {steps.filter(s => s.concepts).flatMap(s => s.concepts || []).slice(0, 6).map((concept, i, arr) => (
                    <div key={i} className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] font-light text-foreground/70 px-2 py-1 rounded-lg border border-border/20 bg-card/40 whitespace-nowrap">
                        {concept}
                      </span>
                      {i < arr.length - 1 && <div className="w-3 h-px bg-accent/30" />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Metrics footer */}
              <div className="mt-4 pt-3 border-t border-border/10 flex flex-wrap items-center gap-3">
                <span className="text-[9px] text-muted-foreground/40">◷ {stats.processingTime}s</span>
                <span className="text-[9px] text-muted-foreground/40">◈ {Math.round(stats.tokensUsed)} tokens</span>
                <span className="text-[9px] text-muted-foreground/40">◎ Depth: {stats.reasoningDepth}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="px-5 py-3 border-t border-border/15 flex items-center gap-3">
          <button onClick={handleTogglePlay} className="h-7 w-7 rounded-lg bg-accent/15 flex items-center justify-center text-accent hover:bg-accent/25 transition-colors" title={isPlaying ? "Pause" : "Play"}>
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
          </button>
          <button onClick={handleReplay} className="h-7 w-7 rounded-lg bg-card/40 flex items-center justify-center text-muted-foreground/50 hover:text-foreground transition-colors" title="Replay">
            <RotateCcw className="h-3 w-3" />
          </button>

          {/* Progress scrubber */}
          <div className="flex-1 relative">
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={progress}
              onChange={handleScrub}
              className="w-full h-1.5 appearance-none bg-border/20 rounded-full outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-md"
            />
            <div
              className="absolute top-0 left-0 h-1.5 rounded-full bg-accent/50 pointer-events-none"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          <span className="text-[9px] font-light text-muted-foreground/50 tabular-nums w-12 text-right">
            {Math.round(progress * 100)}%
          </span>

          {/* Speed controls */}
          <div className="flex items-center gap-1 border-l border-border/15 pl-3">
            <button onClick={() => handleSpeedChange(-1)} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground transition-colors">
              <Minus className="h-2.5 w-2.5" />
            </button>
            <span className="text-[10px] font-light text-foreground/70 tabular-nums w-8 text-center">{speed}x</span>
            <button onClick={() => handleSpeedChange(1)} className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-foreground transition-colors">
              <Plus className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NeuralThinkingModal;
