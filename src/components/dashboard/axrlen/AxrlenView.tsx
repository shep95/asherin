import { useState, useEffect, useCallback, useRef, useMemo, lazy, Suspense } from "react";
import { Brain, Globe, Loader2, Trash2, Clock, Send, ArrowDown, Copy, Check, MessageSquare, Zap, X, PanelRightClose, PanelRightOpen, Search, Target, Activity, TrendingUp, Plus, ChevronRight, Shield, Coins, Landmark, Radar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import AxrlenMessageRenderer from "./AxrlenMessageRenderer";

// Lazy-load heavy panels — dashboard charts (~456 lines) and brains manager (~323 lines)
// are only needed once the user opens a session or the brain editor.
const AxrlenDashboard = lazy(() => import("./AxrlenDashboard"));
const AxrlenBrainsManager = lazy(() => import("./AxrlenBrainsManager"));

export interface AxrlenSession {
  id: string;
  title: string;
  region: string | null;
  predictionType: string;
  status: string;
  predictions: any;
  resourceAnalysis: any;
  threatAssessment: any;
  policySimulations: any;
  timelineDivergences: any;
  dataSources: any;
  confidenceScore: number | null;
  aiSummary: string | null;
  createdAt: Date;
}

interface WorkflowStep {
  type: string;
  label: string;
  sections?: number;
  isPrimary?: boolean;
  status: string;
}

interface ChatMsg {
  role: "user" | "assistant" | "system";
  content: string;
  workflow?: WorkflowStep[];
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/axrlen-chat`;

const REGIONS = [
  "Global", "United States", "China", "Russia", "India", "United Kingdom",
  "Germany", "France", "Japan", "Brazil", "South Korea", "Mexico",
  "Nigeria", "South Africa", "Egypt", "Turkey", "Iran", "Saudi Arabia",
  "Australia", "Indonesia", "Pakistan", "Peru", "Canada",
];

const AxrlenView = () => {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<AxrlenSession[]>([]);
  const [activeSession, setActiveSession] = useState<AxrlenSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSessions, setShowSessions] = useState(false);
  const [sessionsQuery, setSessionsQuery] = useState("");

  // Chat state
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowStep[] | null>(null);
  const [scanProgress, setScanProgress] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Chat rail width (right side, collapsible)
  const [chatWidth, setChatWidth] = useState(38);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const resizingRef = useRef(false);

  useEffect(() => {
    if (autoScroll) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    setAutoScroll(atBottom);
    setShowScrollBtn(!atBottom);
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("axrlen_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSessions((data || []).map((s: any) => ({
        id: s.id, title: s.title, region: s.region,
        predictionType: s.prediction_type, status: s.status,
        predictions: s.predictions, resourceAnalysis: s.resource_analysis,
        threatAssessment: s.threat_assessment, policySimulations: s.policy_simulations,
        timelineDivergences: s.timeline_divergences, dataSources: s.data_sources,
        confidenceScore: s.confidence_score, aiSummary: s.ai_summary,
        createdAt: new Date(s.created_at),
      })));
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const deleteSession = async (id: string) => {
    await supabase.from("axrlen_sessions").delete().eq("id", id);
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeSession?.id === id) setActiveSession(null);
    toast({ title: "Session deleted" });
  };

  const openSession = (s: AxrlenSession) => {
    setActiveSession(s);
    setShowSessions(false);
    setMessages([{
      role: "system",
      content: `Session loaded: **${s.title}** — ${s.region || "Global"} — ${s.confidenceScore || 0}% confidence — ${Array.isArray(s.predictions) ? s.predictions.length : 0} predictions`,
    }]);
  };

  // ── Scan trigger (from chat) ──
  const runScan = async (region: string, scanType: string) => {
    setIsScanning(true);
    // Progress ticker runs ALONGSIDE the real analysis (no artificial sleep).
    // Previously this looped 8x900ms = 7.2s of pure theater BEFORE the real call.
    const steps = [
      "Initializing AXRLEN intelligence grid...",
      "Querying GDELT global event database...",
      "Fetching World Bank & IMF economic indicators...",
      "Scanning USGS seismic & NASA solar data...",
      "Processing conflict & humanitarian feeds...",
      "Applying structural/historical pattern analysis...",
      "Running multi-domain prediction engine...",
      "Generating timeline divergence analysis...",
    ];
    let stepIdx = 0;
    setScanProgress(steps[0]);
    const progressTimer = setInterval(() => {
      stepIdx = (stepIdx + 1) % steps.length;
      setScanProgress(steps[stepIdx]);
    }, 1400);


    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: sessionData, error: sessionErr } = await supabase
        .from("axrlen_sessions")
        .insert({
          user_id: user.id,
          title: `${region === "global" ? "Global" : region} — ${scanType.charAt(0).toUpperCase() + scanType.slice(1)} Analysis`,
          region,
          prediction_type: scanType,
          status: "processing",
        })
        .select()
        .single();
      if (sessionErr) throw sessionErr;

      setScanProgress("Executing deep analysis via AUREON...");
      const resp = await supabase.functions.invoke("axrlen-analyze", {
        body: { region, predictionType: scanType, sessionId: sessionData.id },
      });
      if (resp.error) throw new Error(resp.error.message || "Analysis failed");
      if (!resp.data?.success) throw new Error(resp.data?.error || "No results");

      const analysis = resp.data.analysis;
      const session: AxrlenSession = {
        id: sessionData.id,
        title: sessionData.title,
        region,
        predictionType: scanType,
        status: "complete",
        predictions: analysis.predictions,
        resourceAnalysis: analysis.resourceAnalysis,
        threatAssessment: analysis.threatAssessment,
        policySimulations: analysis.policySimulations,
        timelineDivergences: analysis.timelineDivergences,
        dataSources: analysis.dataSources,
        confidenceScore: analysis.confidenceScore,
        aiSummary: analysis.executiveSummary,
        createdAt: new Date(),
      };

      setSessions(prev => [session, ...prev]);
      setActiveSession(session);
      setMessages(prev => [...prev, {
        role: "system",
        content: `✅ **Scan complete** — ${session.title}\n\n**${Array.isArray(analysis.predictions) ? analysis.predictions.length : 0} predictions** generated across ${analysis.dataSources?.total || 0} data sources at **${analysis.confidenceScore}% confidence**.\n\nThe dashboard on the right is now populated. Ask me anything about the findings.`,
      }]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: "system",
        content: `⚠️ Scan failed: ${err.message}`,
      }]);
    } finally {
      clearInterval(progressTimer);
      setIsScanning(false);
      setScanProgress("");
    }
  };

  // ── Chat with AUREON ──
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isStreaming || isScanning) return;

    // Check for scan commands
    const scanMatch = text.match(/^(?:scan|analyze|predict)\s+(.+?)(?:\s+(?:comprehensive|security|economic|political|environmental|technological))?\s*$/i);
    if (scanMatch) {
      const regionInput = scanMatch[1].trim();
      const typeMatch = text.match(/(comprehensive|security|economic|political|environmental|technological)/i);
      const scanType = typeMatch ? typeMatch[1].toLowerCase() : "comprehensive";
      const matchedRegion = REGIONS.find(r => r.toLowerCase() === regionInput.toLowerCase()) || regionInput;

      setMessages(prev => [...prev, { role: "user", content: text }]);
      setInput("");
      await runScan(matchedRegion, scanType);
      return;
    }

    const userMsg: ChatMsg = { role: "user", content: text };
    const newMessages = [...messages.filter(m => m.role !== "system"), userMsg];
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    setActiveWorkflow(null);
    let assistantSoFar = "";
    let workflowSteps: WorkflowStep[] | null = null;
    let assistantIdx = -1; // cached index of the assistant message; avoids O(n) prev.map per token
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        // Fast path: known index — splice in place (O(1) clone of one slot).
        if (assistantIdx >= 0 && assistantIdx < prev.length && prev[assistantIdx]?.role === "assistant") {
          const next = prev.slice();
          next[assistantIdx] = { ...next[assistantIdx], content: assistantSoFar, workflow: workflowSteps || undefined };
          return next;
        }
        // First token: append assistant message and cache its index.
        assistantIdx = prev.length;
        return [...prev, { role: "assistant", content: assistantSoFar, workflow: workflowSteps || undefined }];
      });
    };

    try {
      const sessionContext = activeSession ? {
        title: activeSession.title,
        region: activeSession.region,
        confidenceScore: activeSession.confidenceScore,
        status: activeSession.status,
        aiSummary: activeSession.aiSummary,
        predictions: activeSession.predictions,
        threatAssessment: activeSession.threatAssessment,
        resourceAnalysis: activeSession.resourceAnalysis,
        policySimulations: activeSession.policySimulations,
        timelineDivergences: activeSession.timelineDivergences,
        dataSources: activeSession.dataSources,
      } : {};

      let authToken = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (s?.access_token) authToken = s.access_token;
      } catch {}

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          messages: newMessages.filter(m => m.role !== "system").map(m => ({ role: m.role, content: m.content })),
          sessionContext,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            // Handle workflow metadata event
            if (parsed.workflow) {
              workflowSteps = parsed.workflow.steps || [];
              setActiveWorkflow(workflowSteps);
              continue;
            }
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {}
        }
      }
      // Auto-save chat as a session
      if (assistantSoFar && !activeSession) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const titleSnippet = text.length > 60 ? text.slice(0, 57) + "..." : text;
            const { data: saved } = await supabase
              .from("axrlen_sessions")
              .insert({
                user_id: user.id,
                title: titleSnippet,
                prediction_type: "chat",
                status: "complete",
                ai_summary: assistantSoFar.slice(0, 2000),
              })
              .select()
              .single();
            if (saved) {
              setSessions(prev => [{
                id: saved.id, title: saved.title, region: null,
                predictionType: "chat", status: "complete",
                predictions: null, resourceAnalysis: null,
                threatAssessment: null, policySimulations: null,
                timelineDivergences: null, dataSources: null,
                confidenceScore: null, aiSummary: assistantSoFar.slice(0, 2000),
                createdAt: new Date(saved.created_at),
              }, ...prev]);
              setActiveSession({
                id: saved.id, title: saved.title, region: null,
                predictionType: "chat", status: "complete",
                predictions: null, resourceAnalysis: null,
                threatAssessment: null, policySimulations: null,
                timelineDivergences: null, dataSources: null,
                confidenceScore: null, aiSummary: assistantSoFar.slice(0, 2000),
                createdAt: new Date(saved.created_at),
              });
            }
          }
        } catch (saveErr) {
          console.error("Failed to auto-save session:", saveErr);
        }
      }
      // If already in a session, update its ai_summary
      if (assistantSoFar && activeSession) {
        try {
          await supabase.from("axrlen_sessions")
            .update({ ai_summary: assistantSoFar.slice(0, 2000), updated_at: new Date().toISOString() })
            .eq("id", activeSession.id);
        } catch {}
      }
    } catch (err: any) {
      upsert(`\n\n⚠️ Error: ${err.message}`);
    } finally {
      setIsStreaming(false);
      setActiveWorkflow(null);
    }
  };

  const copyMsg = (content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  // Resize handler
  const onMouseDown = useCallback(() => {
    resizingRef.current = true;
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const pct = ((window.innerWidth - e.clientX) / window.innerWidth) * 100;
      setChatWidth(Math.max(22, Math.min(60, pct)));
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const suggestions = [
    "Scan Iran comprehensive",
    "Scan United States security",
    "Scan China economic",
    "Analyze the Demiurgic energy patterns in the Middle East",
    "What historical empire collapse pattern matches the current US trajectory?",
    "Apply the Thucydides Trap framework to US-China relations",
  ];

  // Memoize sessions filtering/bucketing/stats. Previously this ran inline inside the
  // popout IIFE on every render — including every streaming token — burning CPU even
  // when the drawer was closed via children re-renders.
  const sessionStats = useMemo(() => {
    const q = sessionsQuery.trim().toLowerCase();
    const filtered = q
      ? sessions.filter(s => s.title.toLowerCase().includes(q) || (s.region || "").toLowerCase().includes(q))
      : sessions;
    const now = Date.now();
    const buckets: Record<string, AxrlenSession[]> = { Today: [], Yesterday: [], "Last 7 Days": [], Earlier: [] };
    for (const s of filtered) {
      const ageH = (now - s.createdAt.getTime()) / 36e5;
      if (ageH < 24) buckets.Today.push(s);
      else if (ageH < 48) buckets.Yesterday.push(s);
      else if (ageH < 24 * 7) buckets["Last 7 Days"].push(s);
      else buckets.Earlier.push(s);
    }
    let totalPredictions = 0;
    let confSum = 0;
    let confCount = 0;
    for (const s of sessions) {
      if (Array.isArray(s.predictions)) totalPredictions += s.predictions.length;
      if (s.confidenceScore != null) { confSum += s.confidenceScore; confCount += 1; }
    }
    const avgConf = confCount ? confSum / confCount : 0;
    return { filtered, buckets, totalPredictions, avgConf };
  }, [sessions, sessionsQuery]);



  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border/[0.06] px-4 py-3 flex items-center justify-between backdrop-blur-md bg-background/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-foreground/[0.04] border border-border/[0.08] flex items-center justify-center">
            <Brain className="h-4 w-4 text-foreground/60" />
          </div>
          <div>
            <h1 className="text-sm font-light tracking-[0.12em] text-foreground/90">AXRLEN</h1>
            <p className="text-[8px] text-muted-foreground/40 tracking-[0.2em] uppercase">NEXUS-PRIME · 30-Domain Predictive Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeSession && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg border border-border/[0.08] bg-foreground/[0.03]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
              <span className="text-[9px] text-foreground/50 max-w-[200px] truncate">{activeSession.title}</span>
              <span className="text-[8px] text-foreground/40">{activeSession.confidenceScore}%</span>
            </div>
          )}
          <Suspense fallback={null}><AxrlenBrainsManager /></Suspense>
          <button onClick={() => setShowSessions(!showSessions)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] tracking-wide transition-all ${showSessions ? "border-foreground/[0.12] bg-foreground/[0.06] text-foreground/70" : "border-border/[0.08] bg-foreground/[0.02] text-muted-foreground/50 hover:bg-foreground/[0.04]"}`}>
            <Clock className="h-3 w-3" /> Sessions
          </button>
        </div>
      </div>

      {/* Sessions popout — side drawer */}
      {showSessions && (() => {
        const q = sessionsQuery;
        const setQ = setSessionsQuery;
        const { filtered, buckets, totalPredictions, avgConf } = sessionStats;


        return (
          <>
            <div className="absolute inset-0 z-40 bg-background/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowSessions(false)} />
            <aside className="absolute right-0 top-0 bottom-0 z-50 w-full sm:w-[28rem] border-l border-border/20 bg-gradient-to-b from-background/95 via-background/90 to-background/95 backdrop-blur-2xl shadow-[0_0_80px_rgba(0,0,0,0.6)] flex flex-col animate-slide-in-right">
              {/* Header */}
              <div className="shrink-0 px-5 pt-5 pb-3 border-b border-border/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-foreground/[0.04] border border-border/[0.08] flex items-center justify-center">
                      <Activity className="h-3.5 w-3.5 text-foreground/60" strokeWidth={1.5} />
                    </div>
                    <div>
                      <h2 className="text-[11px] font-light tracking-[0.28em] uppercase text-foreground/85">Session Archive</h2>
                      <p className="text-[8px] tracking-[0.25em] uppercase text-muted-foreground/40 mt-0.5">NEXUS-PRIME · history</p>
                    </div>
                  </div>
                  <button onClick={() => setShowSessions(false)} className="p-1.5 rounded-lg hover:bg-foreground/[0.06] transition-colors" aria-label="Close">
                    <X className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </button>
                </div>

                {/* Stat strip */}
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  <div className="rounded-lg border border-border/[0.08] bg-foreground/[0.02] px-2.5 py-2">
                    <div className="flex items-center gap-1 text-[8px] tracking-[0.22em] uppercase text-muted-foreground/50">
                      <Target className="h-2.5 w-2.5" /> Sessions
                    </div>
                    <div className="mt-1 text-base font-extralight tabular-nums text-foreground/85">{sessions.length}</div>
                  </div>
                  <div className="rounded-lg border border-border/[0.08] bg-foreground/[0.02] px-2.5 py-2">
                    <div className="flex items-center gap-1 text-[8px] tracking-[0.22em] uppercase text-muted-foreground/50">
                      <TrendingUp className="h-2.5 w-2.5" /> Predicts
                    </div>
                    <div className="mt-1 text-base font-extralight tabular-nums text-foreground/85">{totalPredictions}</div>
                  </div>
                  <div className="rounded-lg border border-emerald-400/15 bg-emerald-400/[0.04] px-2.5 py-2">
                    <div className="flex items-center gap-1 text-[8px] tracking-[0.22em] uppercase text-emerald-300/70">
                      <Zap className="h-2.5 w-2.5" /> Avg Conf
                    </div>
                    <div className="mt-1 text-base font-extralight tabular-nums text-emerald-200/90">
                      {avgConf ? Math.round(avgConf) + "%" : "—"}
                    </div>
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/40" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search sessions, regions…"
                    className="w-full rounded-lg border border-border/15 bg-background/40 pl-8 pr-3 py-2 text-[11px] font-light tracking-wide text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/30"
                  />
                </div>
              </div>

              {/* List */}
              <div className="flex-1 overflow-auto px-4 py-3 space-y-4">
                {loading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-4 w-4 text-muted-foreground/30 animate-spin" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center py-16 gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-foreground/[0.03] border border-border/[0.08] flex items-center justify-center">
                      <Globe className="h-5 w-5 text-muted-foreground/30" />
                    </div>
                    <p className="text-[10px] tracking-[0.22em] uppercase text-foreground/40">
                      {q.trim() ? "No matches" : "No sessions yet"}
                    </p>
                    {!q.trim() && (
                      <p className="text-[10px] text-muted-foreground/50 text-center max-w-[220px] leading-relaxed">
                        Type <span className="text-foreground/70 font-medium">"Scan [region]"</span> in chat to begin your first prediction run.
                      </p>
                    )}
                  </div>
                ) : (
                  Object.entries(buckets).map(([label, items]) =>
                    items.length === 0 ? null : (
                      <div key={label}>
                        <div className="flex items-center gap-2 px-1 mb-1.5">
                          <span className="text-[8px] font-light tracking-[0.3em] uppercase text-muted-foreground/40">{label}</span>
                          <span className="h-px flex-1 bg-border/[0.08]" />
                          <span className="text-[8px] tabular-nums text-muted-foreground/30">{items.length}</span>
                        </div>
                        <div className="space-y-1.5">
                          {items.map(s => {
                            const isActive = activeSession?.id === s.id;
                            const conf = s.confidenceScore ?? 0;
                            const predCount = Array.isArray(s.predictions) ? s.predictions.length : 0;
                            return (
                              <div
                                key={s.id}
                                className={`group relative rounded-xl border transition-all overflow-hidden ${
                                  isActive
                                    ? "border-foreground/25 bg-foreground/[0.05] shadow-[0_8px_30px_-12px_rgba(255,255,255,0.1)]"
                                    : "border-border/[0.08] bg-foreground/[0.015] hover:bg-foreground/[0.04] hover:border-border/[0.15]"
                                }`}
                              >
                                {isActive && (
                                  <span aria-hidden className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-foreground/60 to-transparent" />
                                )}
                                <button onClick={() => openSession(s)} className="w-full text-left p-3 flex items-start gap-3">
                                  {/* Confidence ring */}
                                  <div className="relative shrink-0 w-9 h-9">
                                    <svg viewBox="0 0 36 36" className="w-9 h-9 -rotate-90">
                                      <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-foreground/[0.06]" />
                                      <circle
                                        cx="18" cy="18" r="15" fill="none"
                                        stroke="currentColor" strokeWidth="1.5"
                                        strokeDasharray={`${(conf / 100) * 94.25} 94.25`}
                                        strokeLinecap="round"
                                        className={conf >= 70 ? "text-emerald-400/70" : conf >= 40 ? "text-amber-300/70" : "text-foreground/30"}
                                      />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <span className="text-[8px] font-light tabular-nums text-foreground/70">{conf || "—"}</span>
                                    </div>
                                    <span className={`absolute -right-0.5 -top-0.5 w-1.5 h-1.5 rounded-full ring-2 ring-background ${
                                      s.status === "complete" ? "bg-emerald-400/80" : "bg-amber-400/80 animate-pulse"
                                    }`} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-light text-foreground/85 leading-snug line-clamp-2">{s.title}</p>
                                    <div className="mt-1.5 flex items-center gap-2 text-[8.5px] tracking-[0.18em] uppercase text-muted-foreground/45">
                                      {s.region && <span className="text-foreground/55">{s.region}</span>}
                                      {s.region && <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/30" />}
                                      <span>{predCount} pred</span>
                                      <span className="h-0.5 w-0.5 rounded-full bg-muted-foreground/30" />
                                      <span className="font-mono text-[8px] tracking-normal normal-case">
                                        {s.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                      </span>
                                    </div>
                                  </div>
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                                  className="absolute right-2 top-2 p-1.5 rounded-md hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                  aria-label="Delete session"
                                >
                                  <Trash2 className="h-3 w-3 text-muted-foreground/40 hover:text-red-400/80" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )
                  )
                )}
              </div>

              {/* Footer hint */}
              <div className="shrink-0 px-5 py-3 border-t border-border/10 text-[9px] tracking-[0.22em] uppercase text-muted-foreground/40 text-center">
                {filtered.length} of {sessions.length} sessions
              </div>
            </aside>
          </>
        );
      })()}


      {/* Main content: Dashboard primary | Chat rail right (collapsible) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ── Dashboard (primary, left) — hidden on mobile when chat is open ── */}
        {activeSession ? (
          <div className={`flex-1 min-w-0 overflow-hidden ${!chatCollapsed ? "hidden md:block" : ""}`}>
            <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="h-4 w-4 text-muted-foreground/30 animate-spin" /></div>}>
              <AxrlenDashboard session={activeSession} />
            </Suspense>
          </div>
        ) : (
          <div className={`relative flex flex-1 min-w-0 flex-col items-center justify-start px-4 py-10 sm:py-16 gap-10 overflow-y-auto ${!chatCollapsed ? "hidden md:flex" : ""}`}>
            {/* Ambient backdrop */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[420px] w-[720px] rounded-full bg-foreground/[0.04] blur-3xl" />
              <div className="absolute top-40 left-10 h-64 w-64 rounded-full bg-foreground/[0.03] blur-3xl" />
              <div className="absolute top-20 right-10 h-72 w-72 rounded-full bg-amber-400/[0.04] blur-3xl" />
            </div>

            {/* Hero */}
            <div className="relative text-center space-y-5 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/40 backdrop-blur-md px-3 py-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                </span>
                <span className="text-[9px] font-medium tracking-[0.25em] text-muted-foreground uppercase">Nexus-Prime · Predictive Intelligence</span>
              </div>
              <div className="flex items-center justify-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-2xl bg-amber-400/20 blur-xl" />
                  <div className="relative p-3.5 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-400/5 border border-amber-400/30 backdrop-blur-md">
                    <Brain className="h-7 w-7 text-amber-300" />
                  </div>
                </div>
                <h1 className="text-3xl sm:text-5xl font-extralight tracking-[0.18em] bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text text-transparent">
                  AXRLEN
                </h1>
              </div>
              <p className="text-sm sm:text-[15px] font-extralight text-muted-foreground/90 max-w-lg mx-auto leading-relaxed">
                Name a region. Pick a domain. Aureon forecasts what's next — every scan branched, scored, and timestamped.
              </p>
              <div className="px-4 py-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.04]">
                <p className="text-[10px] text-amber-300/70 tracking-wide">
                  AXRLEN works best with a Gemini API key.
                </p>
              </div>
            </div>

            {/* Quick-scan grid */}
            <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-3xl">
              {[
                { id: "comprehensive", label: "Full Scan", desc: "All 30 domains", icon: Radar, region: "Global" },
                { id: "security", label: "Security", desc: "Threats & conflict", icon: Shield, region: "Global" },
                { id: "economic", label: "Economic", desc: "Markets & resources", icon: Coins, region: "Global" },
                { id: "political", label: "Political", desc: "Power & policy", icon: Landmark, region: "Global" },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setChatCollapsed(false); setInput(`Scan ${t.region} ${t.id}`); setTimeout(() => inputRef.current?.focus(), 50); }}
                  className="relative flex flex-col items-start gap-3 rounded-2xl border border-border/30 bg-gradient-to-br from-card/60 to-card/20 backdrop-blur-md p-4 hover:border-amber-400/40 hover:from-card/80 hover:to-amber-400/5 transition-all duration-300 group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-400/0 to-amber-400/0 group-hover:from-amber-400/5 group-hover:to-transparent transition-all" />
                  <div className="relative p-2 rounded-xl bg-foreground/5 border border-border/20 group-hover:bg-amber-400/10 group-hover:border-amber-400/30 transition-colors">
                    <t.icon className="h-4 w-4 text-muted-foreground group-hover:text-amber-300 transition-colors" strokeWidth={1.5} />
                  </div>
                  <div className="relative space-y-0.5">
                    <div className="text-xs font-light tracking-wide text-foreground">{t.label}</div>
                    <div className="text-[10px] text-muted-foreground/60 leading-tight">{t.desc}</div>
                  </div>
                  <ChevronRight className="absolute top-3 right-3 h-3 w-3 text-muted-foreground/30 group-hover:text-amber-300 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>

            <div className="relative flex items-center gap-3 text-[10px] uppercase tracking-[0.3em] text-muted-foreground/40">
              <span className="h-px w-10 bg-border/40" />
              <span>or</span>
              <span className="h-px w-10 bg-border/40" />
            </div>

            <button
              onClick={() => { setChatCollapsed(false); setTimeout(() => inputRef.current?.focus(), 50); }}
              className="relative inline-flex items-center gap-2 text-xs font-light rounded-xl px-6 h-10 border border-border/40 hover:border-amber-400/40 hover:bg-amber-400/5 transition-colors text-foreground/80"
            >
              <Plus className="h-3.5 w-3.5" /> Start Custom Scan
            </button>

            {sessions.length > 0 && (
              <div className="relative w-full max-w-3xl space-y-3">
                <p className="text-[10px] font-light tracking-[0.2em] text-muted-foreground/50 uppercase px-1">Recent Sessions</p>
                <div className="space-y-1 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-2">
                  {sessions.slice(0, 6).map((s) => {
                    const conf = s.confidenceScore ?? 0;
                    return (
                      <div
                        key={s.id}
                        onClick={() => openSession(s)}
                        className="flex items-center justify-between rounded-xl px-3.5 py-2.5 hover:bg-foreground/5 transition-colors group cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="p-1.5 rounded-lg bg-muted/30 shrink-0">
                            <Globe className="h-3.5 w-3.5 text-muted-foreground/50" />
                          </div>
                          <span className="text-xs font-light text-foreground truncate">{s.title}</span>
                          <span className="text-[10px] text-muted-foreground/40 shrink-0">
                            {s.createdAt.toLocaleDateString()}
                          </span>
                          {conf > 0 && (
                            <span className="text-[9px] tabular-nums tracking-wider text-amber-300/70 shrink-0 ml-auto pr-2">{conf}%</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors" aria-label="Delete session">
                            <Trash2 className="h-3 w-3 text-destructive/60" />
                          </button>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="relative text-[9px] text-muted-foreground/30 tracking-wider pb-4">NEXUS-PRIME · 30-Domain Predictive Engine · Powered by AUREON</p>
          </div>
        )}

        {/* ── Resize handle (desktop only) ── */}
        {!chatCollapsed && (
          <div onMouseDown={onMouseDown}
            className="hidden md:block w-[3px] shrink-0 cursor-col-resize bg-border/[0.08] hover:bg-foreground/[0.18] transition-colors relative">
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}

        {/* ── Collapsed rail (icon strip) ── */}
        {chatCollapsed && (
          <div className="w-10 shrink-0 border-l border-border/[0.06] bg-background/40 backdrop-blur-md flex flex-col items-center py-3 gap-2">
            <button onClick={() => setChatCollapsed(false)}
              className="p-2 rounded-lg hover:bg-foreground/[0.06] transition" title="Expand chat">
              <PanelRightOpen className="h-3.5 w-3.5 text-foreground/60" />
            </button>
            <div className="h-px w-6 bg-border/[0.1]" />
            <div className="rotate-180 [writing-mode:vertical-rl] text-[8px] tracking-[0.32em] uppercase text-muted-foreground/40 mt-2">
              Aureon Chat
            </div>
          </div>
        )}

        {/* ── AUREON Chat rail (right) — full-width on mobile ── */}
        {!chatCollapsed && (
          <div
            className="flex flex-col border-l border-border/[0.06] bg-background/30 backdrop-blur-md w-full md:w-auto"
            style={
              typeof window !== "undefined" && window.innerWidth >= 768
                ? { width: `${chatWidth}%`, minWidth: 320 }
                : undefined
            }
          >


            {/* Rail header */}
            <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-border/[0.06]">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3 w-3 text-foreground/40" strokeWidth={1.5} />
                <span className="text-[9px] uppercase tracking-[0.22em] text-foreground/55">Aureon Chat</span>
              </div>
              <button onClick={() => setChatCollapsed(true)}
                className="p-1.5 rounded-lg hover:bg-foreground/[0.06] transition" title="Collapse">
                <PanelRightClose className="h-3.5 w-3.5 text-muted-foreground/50" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-3 space-y-3 relative">
              {messages.length === 0 && !isScanning && (
                <div className="flex flex-col items-center justify-center h-full gap-4 max-w-sm mx-auto">
                  <Brain className="h-6 w-6 text-foreground/20" />
                  <p className="text-[10px] text-muted-foreground/40 text-center leading-relaxed">
                    Type <span className="text-foreground/60 font-medium">"Scan [region]"</span> to populate the command center, or ask any question about the active session.
                  </p>
                  <div className="w-full px-3 py-2 rounded-lg border border-amber-400/15 bg-amber-400/[0.04]">
                    <p className="text-[9px] text-amber-300/70 text-center leading-relaxed">
                      AXRLEN works best with a Gemini API key.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 w-full">
                    {suggestions.map((s, i) => (
                      <button key={i} onClick={() => setInput(s)}
                        className="w-full text-left px-3 py-1.5 rounded-lg border border-border/[0.08] bg-foreground/[0.02] text-[9px] text-foreground/50 hover:bg-foreground/[0.05] transition-all">
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isScanning && (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border/[0.08] bg-foreground/[0.02]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-foreground/40 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-foreground/60 truncate">{scanProgress}</p>
                    <div className="mt-1.5 h-0.5 rounded-full bg-foreground/[0.04] overflow-hidden">
                      <div className="h-full bg-foreground/25 rounded-full animate-pulse" style={{ width: "65%" }} />
                    </div>
                  </div>
                </div>
              )}

              {messages.map((m, i) => {
                if (m.role === "system") {
                  return (
                    <div key={i} className="flex justify-center">
                      <div className="max-w-[95%] px-3 py-2 rounded-lg border border-border/[0.08] bg-foreground/[0.02] text-[9px] text-foreground/55">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={i} className={`group ${m.role === "user" ? "flex justify-end" : "flex flex-col items-start gap-1"}`}>
                    {m.role === "assistant" ? (
                      <div className="relative w-full rounded-xl border border-border/[0.08] bg-foreground/[0.02] overflow-hidden">
                        <div className="px-3 py-2.5 select-text">
                          <AxrlenMessageRenderer content={m.content} isStreaming={isStreaming && i === messages.length - 1} />
                        </div>
                        <div className="flex items-center justify-end px-2 py-1 border-t border-border/[0.05]">
                          <button onClick={() => copyMsg(m.content, i)}
                            className="opacity-0 group-hover:opacity-50 hover:!opacity-80 transition p-1" title="Copy">
                            {copiedIdx === i ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-muted-foreground/40" />}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="relative max-w-[92%] rounded-xl px-3 py-2 text-[11px] leading-relaxed bg-foreground/[0.08] text-foreground/85">
                        <span className="select-text">{m.content}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-foreground/30" />
                  <span className="text-[9px] text-muted-foreground/40">AUREON — analyzing...</span>
                </div>
              )}

              <div ref={endRef} />

              {showScrollBtn && (
                <button onClick={() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); setAutoScroll(true); setShowScrollBtn(false); }}
                  className="sticky bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-foreground/[0.1] text-[9px] text-foreground/55 shadow-lg hover:bg-foreground/[0.18] transition z-10">
                  <ArrowDown className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Input */}
            <div className="shrink-0 p-2.5 border-t border-border/[0.06]">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder='Ask AUREON, or "Scan [region]"...'
                  rows={1}
                  className="flex-1 bg-foreground/[0.03] border border-border/[0.08] rounded-xl px-3 py-2 text-[11px] text-foreground/80 placeholder:text-muted-foreground/30 outline-none focus:border-foreground/[0.18] transition-all resize-none min-h-[36px] max-h-[120px]"
                  disabled={isStreaming || isScanning}
                  style={{ height: "auto" }}
                  onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 120) + "px"; }}
                />
                <button
                  onClick={sendMessage}
                  disabled={isStreaming || isScanning || !input.trim()}
                  className="p-2.5 rounded-xl bg-foreground/[0.06] border border-border/[0.08] hover:bg-foreground/[0.12] disabled:opacity-30 transition-all self-end">
                  <Send className="h-3.5 w-3.5 text-foreground/60" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AxrlenView;
