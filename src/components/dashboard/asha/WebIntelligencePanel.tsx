import { useState, useRef, useEffect, useCallback } from "react";
import { Globe, Search, Loader2, Plus, Building2, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft, Send, Database, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAshaSession } from "./AshaSessionContext";
import ReactMarkdown from "react-markdown";
import { saveWebIntelSession, getWebIntelSessions } from "@/lib/messageQueue";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface WebSession {
  id: string;
  companyName: string;
  status: "collecting" | "ready" | "error";
  createdAt: Date;
  response?: string;
  answers: Record<string, string>;
  chat: ChatMessage[];
  savedToAsha?: boolean;
}

const INTAKE_QUESTIONS = [
  {
    id: "company",
    question: "What company or organization do you want to investigate?",
    placeholder: "e.g. Tesla, Goldman Sachs, OpenAI",
    required: true,
  },
  {
    id: "ticker",
    question: "Stock ticker or registration number (if applicable)?",
    placeholder: "e.g. TSLA, private, N/A",
    required: false,
  },
  {
    id: "domain",
    question: "What is their primary web domain?",
    placeholder: "e.g. tesla.com",
    required: false,
  },
  {
    id: "objective",
    question: "What is your primary intelligence objective?",
    placeholder: "e.g. Due diligence for acquisition, competitive analysis, risk assessment, partnership vetting",
    required: true,
  },
  {
    id: "concerns",
    question: "Any specific concerns, red flags, or areas to focus on?",
    placeholder: "e.g. Recent leadership changes, litigation history, financial irregularities, regulatory issues",
    required: false,
  },
  {
    id: "people",
    question: "Key individuals to investigate (executives, founders, board members)?",
    placeholder: "e.g. Elon Musk (CEO), Robyn Denholm (Chair)",
    required: false,
  },
  {
    id: "competitors",
    question: "Known competitors or related entities to cross-reference?",
    placeholder: "e.g. Rivian, Lucid Motors, BYD",
    required: false,
  },
  {
    id: "timeframe",
    question: "What time period should the analysis cover?",
    placeholder: "e.g. Last 2 years, since IPO, all time",
    required: false,
  },
];

const WebIntelligencePanel = () => {
  const [sessions, setSessions] = useState<WebSession[]>([]);
  const [showIntake, setShowIntake] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [activeSession, setActiveSession] = useState<WebSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();
  const { activeSession: ashaSession } = useAshaSession();
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load persisted sessions from IndexedDB on mount
  useEffect(() => {
    getWebIntelSessions().then(saved => {
      if (saved.length > 0) {
        const restored = saved.map((s: any) => ({
          ...s,
          createdAt: new Date(s.createdAt),
          chat: (s.chat || []).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
        }));
        setSessions(restored);
      }
    }).catch(() => {});
  }, []);

  // Persist sessions to IndexedDB whenever they change
  const persistSessions = useCallback((updatedSessions: WebSession[]) => {
    updatedSessions.forEach(s => {
      saveWebIntelSession({
        ...s,
        createdAt: s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
        chat: (s.chat || []).map(m => ({
          ...m,
          timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
        })),
      }).catch(() => {});
    });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.chat]);

  const q = INTAKE_QUESTIONS[currentQ];

  const handleNext = () => {
    if (q.required && !currentAnswer.trim()) return;
    const updated = { ...answers, [q.id]: currentAnswer.trim() };
    setAnswers(updated);
    setCurrentAnswer("");
    if (currentQ < INTAKE_QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1);
      setCurrentAnswer(updated[INTAKE_QUESTIONS[currentQ + 1].id] || "");
    } else {
      launchSession(updated);
    }
  };

  const handleBack = () => {
    if (currentQ > 0) {
      const updated = { ...answers, [q.id]: currentAnswer.trim() };
      setAnswers(updated);
      setCurrentQ(currentQ - 1);
      setCurrentAnswer(updated[INTAKE_QUESTIONS[currentQ - 1].id] || "");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleNext();
    }
  };

  const buildDeepPrompt = (finalAnswers: Record<string, string>) => `[DEEP COMPANY INTELLIGENCE INVESTIGATION]

TARGET: ${finalAnswers.company}
${finalAnswers.ticker ? `TICKER/REG: ${finalAnswers.ticker}` : ""}
${finalAnswers.domain ? `DOMAIN: ${finalAnswers.domain}` : ""}

INTELLIGENCE OBJECTIVE: ${finalAnswers.objective || "Comprehensive due diligence"}

${finalAnswers.concerns ? `SPECIFIC CONCERNS: ${finalAnswers.concerns}` : ""}
${finalAnswers.people ? `KEY INDIVIDUALS: ${finalAnswers.people}` : ""}
${finalAnswers.competitors ? `COMPETITORS/RELATED: ${finalAnswers.competitors}` : ""}
${finalAnswers.timeframe ? `TIME PERIOD: ${finalAnswers.timeframe}` : "TIME PERIOD: All available"}

INSTRUCTIONS: Conduct an exhaustive, forensic-grade intelligence analysis. This is NOT a surface-level summary. Dig deep into every available angle.

Required Analysis Sections:

1. **EXECUTIVE SUMMARY (BLUF)** — Bottom Line Up Front.

2. **CORPORATE STRUCTURE & GOVERNANCE**

3. **FINANCIAL DEEP DIVE**

4. **LEGAL & REGULATORY EXPOSURE**

5. **OPERATIONAL INTELLIGENCE**

6. **DIGITAL FOOTPRINT & INFRASTRUCTURE**

7. **POLITICAL & LOBBYING EXPOSURE**

8. **RISK ASSESSMENT MATRIX** — Financial/Legal/Reputational/Operational risk: HIGH/MEDIUM/LOW

9. **RED FLAGS & ANOMALIES**

10. **ACTIONABLE INTELLIGENCE**

Use specific names, dates, dollar amounts, and citations. Never use placeholder data.

CONFIDENCE LEVEL: Rate each section HIGH/MEDIUM/LOW based on source quality.`;

  const launchSession = async (finalAnswers: Record<string, string>) => {
    if (!finalAnswers.company?.trim() || !user) return;
    setLoading(true);
    setShowIntake(false);

    const sessionId = crypto.randomUUID();
    const newSession: WebSession = {
      id: sessionId,
      companyName: finalAnswers.company,
      status: "collecting",
      createdAt: new Date(),
      answers: finalAnswers,
      chat: [],
    };

    setSessions(prev => [newSession, ...prev]);
    setActiveSession(newSession);

    try {
      const { data: authSession } = await supabase.auth.getSession();
      const deepPrompt = buildDeepPrompt(finalAnswers);

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asha-query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession?.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ query: deepPrompt }),
      });

      if (!res.ok) throw new Error("Analysis failed");
      const result = await res.json();

      const updatedSession = { ...newSession, status: "ready" as const, response: result.response, savedToAsha: false };
      setSessions(prev => {
        const next = prev.map(s => s.id === sessionId ? updatedSession : s);
        persistSessions(next);
        return next;
      });
      setActiveSession(updatedSession);

      // Auto-save report as data file for Files tab and other Asha tabs
      if (ashaSession && result.response) {
        try {
          const content = result.response;
          const safeName = finalAnswers.company.replace(/[^a-zA-Z0-9]/g, "_");
          const fileName = `webintel_${safeName}_${Date.now()}.txt`;
          const storagePath = `${user.id}/${fileName}`;
          const blob = new Blob([content], { type: "text/plain" });

          const { error: uploadErr } = await supabase.storage.from("asha-data").upload(storagePath, blob);
          if (!uploadErr) {
            // Save as document
            await supabase.from("asha_documents").insert({
              user_id: user.id,
              session_id: ashaSession.id,
              file_name: `${finalAnswers.company} — Intelligence Report.txt`,
              file_size: blob.size,
              file_type: "text/plain",
              storage_path: storagePath,
              status: "ready",
              doc_type: "report",
              summary: `Web intelligence report on ${finalAnswers.company}. Objective: ${finalAnswers.objective || "Comprehensive due diligence"}.`,
              language: "en",
              metadata: { source: "web_intelligence", company: finalAnswers.company, objective: finalAnswers.objective || null },
              tags: ["web-intelligence", "auto-generated", safeName.toLowerCase()],
              extracted_text: content.slice(0, 10000),
            });

            // Save as dataset for Table/Graph/Insights
            await supabase.from("asha_datasets").insert({
              user_id: user.id,
              session_id: ashaSession.id,
              file_name: `${finalAnswers.company} — Web Intel Data.txt`,
              file_size: blob.size,
              file_type: "text/plain",
              storage_path: storagePath,
              status: "ready",
              description: `Auto-generated web intelligence data on ${finalAnswers.company}`,
              tags: ["web-intelligence", "auto-generated", safeName.toLowerCase()],
              quality_score: 85,
              row_count: content.split("\n").length,
              col_count: 1,
            });

            const savedSession = { ...updatedSession, savedToAsha: true };
            setSessions(prev => {
              const next = prev.map(s => s.id === sessionId ? savedSession : s);
              persistSessions(next);
              return next;
            });
            setActiveSession(savedSession);
          }
        } catch (e) {
          console.error("Auto-save to files failed:", e);
        }
      }
    } catch {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: "error" as const } : s));
      setActiveSession(prev => prev?.id === sessionId ? { ...prev, status: "error" as const } : prev);
    } finally {
      setLoading(false);
      setAnswers({});
      setCurrentQ(0);
      setCurrentAnswer("");
    }
  };

  const sendFollowUp = async () => {
    if (!chatInput.trim() || !activeSession || chatLoading || !user) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: chatInput.trim(), timestamp: new Date() };
    const updatedChat = [...(activeSession.chat || []), userMsg];
    const updated = { ...activeSession, chat: updatedChat };
    setActiveSession(updated);
    setSessions(prev => {
      const next = prev.map(s => s.id === activeSession.id ? updated : s);
      persistSessions(next);
      return next;
    });
    setChatInput("");
    setChatLoading(true);

    try {
      const { data: authSession } = await supabase.auth.getSession();

      // Build conversation history for context
      const history = updatedChat.map(m => `${m.role === "user" ? "USER" : "ASHA"}: ${m.content}`).join("\n\n");

      const followUpPrompt = `You are Asha, continuing a deep intelligence investigation on ${activeSession.companyName}.

ORIGINAL INTELLIGENCE REPORT:
${activeSession.response?.slice(0, 15000) || ""}

CONVERSATION HISTORY:
${history}

USER'S FOLLOW-UP: "${userMsg.content}"

INSTRUCTIONS:
- Answer based on the intelligence report above and your general knowledge
- Maintain the same analytical depth and forensic rigor
- Provide specific data points, names, dates, and amounts where possible
- If the user asks to drill deeper into a section, provide exhaustive detail
- If the user asks about something not covered, investigate and provide new findings
- Cross-reference against the original report findings
- Use structured formatting with headers and bullet points`;

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asha-query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession?.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ query: followUpPrompt }),
      });

      if (!res.ok) throw new Error("Follow-up failed");
      const result = await res.json();

      const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: result.response, timestamp: new Date() };
      const finalChat = [...updatedChat, assistantMsg];
      const finalSession = { ...updated, chat: finalChat };
      setActiveSession(finalSession);
      setSessions(prev => {
        const next = prev.map(s => s.id === activeSession.id ? finalSession : s);
        persistSessions(next);
        return next;
      });
    } catch {
      const errMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "⚠️ Failed to process follow-up. Please try again.", timestamp: new Date() };
      const errChat = [...updatedChat, errMsg];
      const errSession = { ...updated, chat: errChat };
      setActiveSession(errSession);
      setSessions(prev => prev.map(s => s.id === activeSession.id ? errSession : s));
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendFollowUp();
    }
  };

  const saveToAsha = async () => {
    if (!activeSession || !user || !ashaSession || saving) return;
    setSaving(true);

    try {
      // Combine report + conversation into a single document
      let fullContent = activeSession.response || "";
      if (activeSession.chat.length > 0) {
        fullContent += "\n\n---\n\n## Follow-Up Intelligence Q&A\n\n";
        for (const msg of activeSession.chat) {
          if (msg.role === "user") {
            fullContent += `### Q: ${msg.content}\n\n`;
          } else {
            fullContent += `${msg.content}\n\n---\n\n`;
          }
        }
      }

      // Upload as a text file to storage
      const fileName = `webintel_${activeSession.companyName.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}.md`;
      const storagePath = `${user.id}/${fileName}`;
      const blob = new Blob([fullContent], { type: "text/markdown" });

      const { error: uploadErr } = await supabase.storage.from("asha-data").upload(storagePath, blob);
      if (uploadErr) throw uploadErr;

      // Create asha_document record
      const { error: docErr } = await supabase.from("asha_documents").insert({
        user_id: user.id,
        session_id: ashaSession.id,
        file_name: `${activeSession.companyName} — Web Intelligence Report`,
        file_size: blob.size,
        file_type: "text/markdown",
        storage_path: storagePath,
        status: "ready",
        doc_type: "report",
        summary: `Deep intelligence investigation of ${activeSession.companyName}. Objective: ${activeSession.answers.objective || "Comprehensive due diligence"}. Includes ${activeSession.chat.length} follow-up exchanges.`,
        language: "en",
        metadata: {
          source: "web_intelligence",
          company: activeSession.companyName,
          ticker: activeSession.answers.ticker || null,
          domain: activeSession.answers.domain || null,
          objective: activeSession.answers.objective || null,
          parties: [activeSession.companyName, ...(activeSession.answers.competitors?.split(",").map(c => c.trim()) || [])],
        },
        tags: ["web-intelligence", "company-report", activeSession.companyName.toLowerCase()],
        extracted_text: fullContent.slice(0, 10000),
      });

      if (docErr) throw docErr;

      // Also save as a dataset for Table/Graph/Insights tabs
      const { error: dsErr } = await supabase.from("asha_datasets").insert({
        user_id: user.id,
        session_id: ashaSession.id,
        file_name: `${activeSession.companyName} — Web Intel`,
        file_size: blob.size,
        file_type: "text/markdown",
        storage_path: storagePath,
        status: "ready",
        description: `Web intelligence report on ${activeSession.companyName}`,
        tags: ["web-intelligence", activeSession.companyName.toLowerCase()],
        quality_score: 85,
        row_count: fullContent.split("\n").length,
        col_count: 1,
      });

      if (dsErr) throw dsErr;

      // Mark saved
      const savedSession = { ...activeSession, savedToAsha: true };
      setActiveSession(savedSession);
      setSessions(prev => prev.map(s => s.id === activeSession.id ? savedSession : s));
    } catch (err) {
      console.error("Failed to save to Asha:", err);
    } finally {
      setSaving(false);
    }
  };

  const startNew = () => {
    setShowIntake(true);
    setActiveSession(null);
    setCurrentQ(0);
    setAnswers({});
    setCurrentAnswer("");
  };

  return (
    <div className="flex h-full">
      {/* Session sidebar */}
      <div className="w-64 border-r border-border/20 bg-card/10 flex flex-col">
        <div className="p-4 border-b border-border/20">
          <button onClick={startNew} className="w-full flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 text-xs font-light text-accent hover:bg-accent/20 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            New Intelligence Session
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map(s => (
            <button key={s.id} onClick={() => { setActiveSession(s); setShowIntake(false); }}
              className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${activeSession?.id === s.id ? "bg-foreground/10" : "hover:bg-foreground/5"}`}>
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-light text-foreground truncate">{s.companyName}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {s.status === "collecting" && <Loader2 className="h-2.5 w-2.5 animate-spin text-accent" />}
                {s.status === "ready" && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />}
                {s.status === "error" && <AlertTriangle className="h-2.5 w-2.5 text-destructive" />}
                <span className="text-[10px] text-muted-foreground/50">{s.createdAt.toLocaleDateString()}</span>
                {s.chat.length > 0 && (
                  <span className="text-[10px] text-accent/60 flex items-center gap-0.5"><MessageSquare className="h-2 w-2" />{s.chat.length}</span>
                )}
              </div>
            </button>
          ))}
          {sessions.length === 0 && !showIntake && (
            <p className="text-[10px] text-muted-foreground/40 text-center py-8 px-2">No sessions yet. Create one to begin.</p>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0">
        {showIntake && (
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto p-8 flex flex-col items-center justify-center min-h-full">
              <div className="w-full mb-8">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Question {currentQ + 1} of {INTAKE_QUESTIONS.length}</span>
                  {!q.required && <span className="text-[10px] text-muted-foreground/40">Optional — press Enter to skip</span>}
                </div>
                <div className="h-1 bg-border/20 rounded-full overflow-hidden">
                  <div className="h-full bg-accent/60 rounded-full transition-all duration-300" style={{ width: `${((currentQ + 1) / INTAKE_QUESTIONS.length) * 100}%` }} />
                </div>
              </div>
              <div className="w-full space-y-6">
                <h2 className="text-xl font-extralight tracking-wide text-foreground leading-relaxed">{q.question}</h2>
                <input
                  value={currentAnswer}
                  onChange={e => setCurrentAnswer(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={q.placeholder}
                  className="w-full rounded-xl border border-border/20 bg-card/20 px-5 py-4 text-sm font-light text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/40 transition-colors"
                  autoFocus
                />
                <div className="flex items-center justify-between">
                  <button onClick={handleBack} disabled={currentQ === 0}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back
                  </button>
                  <button onClick={handleNext}
                    disabled={q.required && !currentAnswer.trim()}
                    className="flex items-center gap-2 rounded-xl bg-accent/80 text-accent-foreground px-5 py-2.5 text-sm font-light hover:bg-accent transition-colors disabled:opacity-30">
                    {currentQ === INTAKE_QUESTIONS.length - 1 ? (
                      <><Search className="h-4 w-4" /> Launch Deep Research</>
                    ) : (
                      <>Next <ArrowRight className="h-3.5 w-3.5" /></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSession && (
          <>
            {/* Scrollable report + conversation */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Header with save button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-extralight tracking-wide text-foreground">{activeSession.companyName}</h2>
                    <div className="flex items-center gap-4 mt-1">
                      {activeSession.status === "ready" && (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Deep Analysis Complete</span>
                      )}
                      {activeSession.status === "collecting" && (
                        <span className="text-[10px] text-accent flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" /> Conducting deep research…</span>
                      )}
                    </div>
                  </div>
                  {activeSession.status === "ready" && ashaSession && (
                    <button
                      onClick={saveToAsha}
                      disabled={saving || activeSession.savedToAsha}
                      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-light transition-colors ${
                        activeSession.savedToAsha
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20"
                      } disabled:opacity-50`}
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Database className="h-3.5 w-3.5" />}
                      {activeSession.savedToAsha ? "Saved to Asha" : "Save to Asha"}
                    </button>
                  )}
                </div>

                {/* Original report */}
                {activeSession.response && (
                  <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-6">
                    <div className="prose prose-sm prose-invert max-w-none font-extralight [&_h1]:text-lg [&_h1]:font-light [&_h1]:tracking-wide [&_h2]:text-base [&_h2]:font-light [&_h2]:mt-6 [&_h2]:mb-3 [&_h3]:text-sm [&_h3]:font-light [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-foreground/90 [&_p]:mb-3 [&_ul]:space-y-1.5 [&_li]:text-sm [&_strong]:text-foreground [&_code]:bg-secondary/50 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-secondary/30 [&_pre]:rounded-lg [&_pre]:p-4">
                      <ReactMarkdown>{activeSession.response}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Conversation thread */}
                {activeSession.chat.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-3.5 w-3.5 text-accent/60" />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Follow-Up Intelligence</span>
                    </div>
                    {activeSession.chat.map(msg => (
                      <div key={msg.id} className={`rounded-xl border p-4 ${
                        msg.role === "user"
                          ? "border-accent/20 bg-accent/5 ml-12"
                          : "border-border/20 bg-card/20 mr-4"
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                            {msg.role === "user" ? "You" : "Asha"}
                          </span>
                          <span className="text-[9px] text-muted-foreground/30">
                            {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm prose-invert max-w-none font-extralight [&_h2]:text-sm [&_h2]:font-light [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-xs [&_h3]:font-light [&_h3]:mt-3 [&_h3]:mb-1.5 [&_p]:text-[13px] [&_p]:leading-relaxed [&_p]:text-foreground/90 [&_p]:mb-2.5 [&_ul]:space-y-1 [&_li]:text-[13px] [&_strong]:text-foreground [&_code]:bg-secondary/50 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm font-light text-foreground">{msg.content}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {chatLoading && (
                  <div className="flex items-center gap-2 px-4 py-3">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
                    <span className="text-xs text-muted-foreground">Asha is analyzing…</span>
                  </div>
                )}

                {activeSession.status === "error" && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
                    <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
                    <p className="text-sm text-foreground">Analysis failed. Please try again.</p>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Chat input pinned to bottom */}
            {activeSession.status === "ready" && (
              <div className="flex-shrink-0 border-t border-border/20 bg-card/10 backdrop-blur-sm p-4">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={handleChatKeyDown}
                    placeholder={`Ask a follow-up about ${activeSession.companyName}…`}
                    disabled={chatLoading}
                    className="flex-1 rounded-xl border border-border/20 bg-card/20 px-4 py-3 text-sm font-light text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/40 transition-colors disabled:opacity-50"
                  />
                  <button
                    onClick={sendFollowUp}
                    disabled={!chatInput.trim() || chatLoading}
                    className="rounded-xl bg-accent/80 text-accent-foreground p-3 hover:bg-accent transition-colors disabled:opacity-30"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {!showIntake && !activeSession && (
          <div className="flex-1 flex flex-col items-center justify-center">
            <Globe className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <p className="text-sm font-extralight text-muted-foreground">Select a session or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebIntelligencePanel;
