import { useState, useEffect, useCallback, useRef } from "react";
import { Brain, Globe, Loader2, Trash2, Clock, Send, ArrowDown, Copy, Check, MessageSquare, Zap, X, PanelRightClose, PanelRightOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import AxrlenDashboard from "./AxrlenDashboard";
import AxrlenMessageRenderer from "./AxrlenMessageRenderer";
import AxrlenBrainsManager from "./AxrlenBrainsManager";

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
    const steps = [
      "Initializing AXRLEN intelligence grid...",
      "Querying GDELT global event database...",
      "Fetching World Bank & IMF economic indicators...",
      "Scanning USGS seismic & NASA solar data...",
      "Processing conflict & humanitarian feeds...",
      "Applying occult/historical pattern analysis...",
      "Running multi-domain prediction engine...",
      "Generating timeline divergence analysis...",
    ];

    for (const step of steps) {
      setScanProgress(step);
      await new Promise(r => setTimeout(r, 900));
    }

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
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar, workflow: workflowSteps || undefined } : m);
        }
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
          <AxrlenBrainsManager />
          <button onClick={() => setShowSessions(!showSessions)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] tracking-wide transition-all ${showSessions ? "border-foreground/[0.12] bg-foreground/[0.06] text-foreground/70" : "border-border/[0.08] bg-foreground/[0.02] text-muted-foreground/50 hover:bg-foreground/[0.04]"}`}>
            <Clock className="h-3 w-3" /> Sessions
          </button>
        </div>
      </div>

      {/* Sessions overlay */}
      {showSessions && (
        <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/[0.06]">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">Prediction Sessions</h2>
            <button onClick={() => setShowSessions(false)} className="p-1.5 rounded-lg hover:bg-foreground/[0.06]">
              <X className="h-4 w-4 text-muted-foreground/40" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-2 max-w-3xl mx-auto w-full">
            {loading ? (
              <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 text-muted-foreground/30 animate-spin" /></div>
            ) : sessions.length === 0 ? (
              <div className="flex flex-col items-center py-20 gap-3">
                <Globe className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-[11px] text-foreground/40">No sessions yet — type "Scan [region]" in chat to begin</p>
              </div>
            ) : sessions.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl border border-border/[0.08] bg-foreground/[0.02] hover:bg-foreground/[0.04] transition-all group">
                <button onClick={() => openSession(s)} className="flex items-center gap-3 flex-1 text-left">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${s.status === "complete" ? "bg-emerald-400/60" : "bg-amber-400/60 animate-pulse"}`} />
                  <div className="min-w-0">
                    <p className="text-[11px] text-foreground/70 truncate">{s.title}</p>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[8px] text-muted-foreground/30">{s.createdAt.toLocaleDateString()}</span>
                      {s.confidenceScore != null && <span className="text-[8px] text-foreground/40">{s.confidenceScore}%</span>}
                      {s.predictions && <span className="text-[8px] text-foreground/40">{Array.isArray(s.predictions) ? s.predictions.length : 0} predictions</span>}
                    </div>
                  </div>
                </button>
                <button onClick={() => deleteSession(s.id)}
                  className="p-2 rounded-lg hover:bg-foreground/[0.06] opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 className="h-3 w-3 text-muted-foreground/30 hover:text-red-400/60" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content: Chat left | Dashboard right */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ── AUREON Chat (left) ── */}
        <div className="flex flex-col" style={{ width: activeSession ? `${100 - dashboardWidth}%` : "100%" }}>
          {/* Messages */}
          <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-3 relative">
            {messages.length === 0 && !isScanning && (
              <div className="flex flex-col items-center justify-center h-full gap-6 max-w-md mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-foreground/[0.03] border border-border/[0.08] flex items-center justify-center">
                  <Brain className="h-7 w-7 text-foreground/20" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-sm font-light text-foreground/60 tracking-wide">AXRLEN Intelligence</h2>
                  <p className="text-[10px] text-muted-foreground/30 leading-relaxed max-w-sm">
                    NEXUS-PRIME 30-domain predictive engine combining live data, occultism, Vedic Jyotish, history, religion, war strategy, philosophy, psychology, economics, Kabbalistic timing, Hermetic principles, and astronomical cycles.
                  </p>
                  <p className="text-[9px] text-muted-foreground/25 mt-3">
                    Type <span className="text-foreground/40 font-medium">"Scan [region]"</span> to start a prediction scan, or ask any question.
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-1.5 w-full max-w-sm">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => setInput(s)}
                      className="w-full text-left px-3 py-2 rounded-xl border border-border/[0.08] bg-foreground/[0.02] text-[10px] text-foreground/45 hover:bg-foreground/[0.05] transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Scan progress */}
            {isScanning && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/[0.08] bg-foreground/[0.02]">
                <Loader2 className="h-4 w-4 animate-spin text-foreground/40 shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] text-foreground/60">{scanProgress}</p>
                  <div className="mt-2 h-1 rounded-full bg-foreground/[0.04] overflow-hidden">
                    <div className="h-full bg-foreground/20 rounded-full animate-pulse" style={{ width: "65%" }} />
                  </div>
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              if (m.role === "system") {
                return (
                  <div key={i} className="flex justify-center">
                    <div className="max-w-[85%] px-4 py-2.5 rounded-xl border border-border/[0.08] bg-foreground/[0.02] text-[10px] text-foreground/50">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  </div>
                );
              }
              return (
              <div key={i} className={`group ${m.role === "user" ? "flex justify-end" : "flex flex-col items-start gap-1"}`}>
                  {m.role === "assistant" ? (
                    <>
                      {/* Workflow steps hidden — output only */}
                      <div className="relative w-full max-w-[95%] rounded-xl border border-border/[0.08] bg-foreground/[0.02] overflow-hidden">
                        <div className="px-5 py-4 select-text">
                          <AxrlenMessageRenderer content={m.content} isStreaming={isStreaming && i === messages.length - 1} />
                        </div>
                        <div className="flex items-center justify-end px-3 py-1.5 border-t border-border/[0.05]">
                          <button onClick={() => copyMsg(m.content, i)}
                            className="opacity-0 group-hover:opacity-50 hover:!opacity-80 transition p-1" title="Copy">
                            {copiedIdx === i ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3 text-muted-foreground/40" />}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="relative max-w-[85%] rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed bg-foreground/[0.08] text-foreground/80">
                      <span className="select-text">{m.content}</span>
                      <div className="flex items-center justify-end mt-1">
                        <button onClick={() => copyMsg(m.content, i)}
                          className="opacity-0 group-hover:opacity-40 hover:!opacity-80 transition p-0.5" title="Copy">
                          {copiedIdx === i ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex items-center gap-2 px-3 py-2">
                <Loader2 className="h-3 w-3 animate-spin text-foreground/30" />
                <span className="text-[9px] text-muted-foreground/30">AUREON — analyzing...</span>
              </div>
            )}

            <div ref={endRef} />

            {showScrollBtn && (
              <button onClick={() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); setAutoScroll(true); setShowScrollBtn(false); }}
                className="sticky bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-foreground/[0.1] text-[9px] text-foreground/50 shadow-lg hover:bg-foreground/[0.15] transition z-10">
                <ArrowDown className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 p-3 border-t border-border/[0.06]">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                placeholder='Ask AUREON anything, or type "Scan [region]" to begin...'
                rows={1}
                className="flex-1 bg-foreground/[0.03] border border-border/[0.08] rounded-xl px-3 py-2.5 text-[11px] text-foreground/70 placeholder:text-muted-foreground/25 outline-none focus:border-foreground/[0.15] transition-all resize-none min-h-[38px] max-h-[120px]"
                disabled={isStreaming || isScanning}
                style={{ height: "auto" }}
                onInput={e => { const t = e.target as HTMLTextAreaElement; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 120) + "px"; }}
              />
              <button
                onClick={sendMessage}
                disabled={isStreaming || isScanning || !input.trim()}
                className="p-2.5 rounded-xl bg-foreground/[0.06] border border-border/[0.08] hover:bg-foreground/[0.1] disabled:opacity-30 transition-all self-end">
                <Send className="h-3.5 w-3.5 text-foreground/50" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Resize handle ── */}
        {activeSession && (
          <div onMouseDown={onMouseDown}
            className="w-[3px] shrink-0 cursor-col-resize bg-border/[0.08] hover:bg-foreground/[0.15] transition-colors relative group">
            <div className="absolute inset-y-0 -left-1 -right-1" />
          </div>
        )}

        {/* ── Dashboard (right) ── */}
        {activeSession && (
          <div className="overflow-hidden" style={{ width: `${dashboardWidth}%` }}>
            <AxrlenDashboard session={activeSession} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AxrlenView;
