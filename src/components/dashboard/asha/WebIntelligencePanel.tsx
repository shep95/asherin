import { useState } from "react";
import { Globe, Search, Loader2, Plus, Building2, CheckCircle2, AlertTriangle, ArrowRight, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ReactMarkdown from "react-markdown";

interface WebSession {
  id: string;
  companyName: string;
  status: "collecting" | "ready" | "error";
  createdAt: Date;
  response?: string;
  answers: Record<string, string>;
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
  const { user } = useAuth();

  const q = INTAKE_QUESTIONS[currentQ];

  const handleNext = () => {
    if (q.required && !currentAnswer.trim()) return;
    const updated = { ...answers, [q.id]: currentAnswer.trim() };
    setAnswers(updated);
    setCurrentAnswer("");
    if (currentQ < INTAKE_QUESTIONS.length - 1) {
      setCurrentQ(currentQ + 1);
      // Pre-fill if already answered
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
    };

    setSessions(prev => [newSession, ...prev]);
    setActiveSession(newSession);

    try {
      const { data: authSession } = await supabase.auth.getSession();

      const deepPrompt = `[DEEP COMPANY INTELLIGENCE INVESTIGATION]

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

1. **EXECUTIVE SUMMARY (BLUF)** — Bottom Line Up Front. What does a decision-maker need to know in 30 seconds?

2. **CORPORATE STRUCTURE & GOVERNANCE**
   - Legal entity structure, subsidiaries, parent companies
   - Board composition, executive team, recent leadership changes
   - Ownership structure, major shareholders, insider transactions
   - Corporate governance issues or controversies

3. **FINANCIAL DEEP DIVE**
   - Revenue trajectory, profitability, cash flow analysis
   - Debt structure, credit ratings, financial health indicators
   - Unusual transactions, related-party dealings, off-balance-sheet items
   - Comparison against industry benchmarks

4. **LEGAL & REGULATORY EXPOSURE**
   - Active litigation, settlements, class actions
   - Regulatory actions, fines, compliance issues
   - Intellectual property disputes, patent portfolio
   - Government investigations or enforcement actions

5. **OPERATIONAL INTELLIGENCE**
   - Market position, competitive advantages/vulnerabilities
   - Supply chain dependencies, key partnerships
   - Technology stack, R&D investments, patent filings
   - Workforce analysis: hiring trends, layoffs, Glassdoor sentiment

6. **DIGITAL FOOTPRINT & INFRASTRUCTURE**
   - Web presence, domain history, SSL/infrastructure
   - Social media sentiment analysis
   - Data breach history, cybersecurity posture
   - Technical infrastructure indicators

7. **POLITICAL & LOBBYING EXPOSURE**
   - Campaign contributions (FEC), lobbying spend
   - Government contracts, grants received
   - Political affiliations of key executives
   - Regulatory capture indicators

8. **RISK ASSESSMENT MATRIX**
   - Financial risk: HIGH/MEDIUM/LOW with justification
   - Legal risk: HIGH/MEDIUM/LOW with justification
   - Reputational risk: HIGH/MEDIUM/LOW with justification
   - Operational risk: HIGH/MEDIUM/LOW with justification
   - Overall risk score

9. **RED FLAGS & ANOMALIES**
   - Patterns that deviate from industry norms
   - Unexplained gaps in public record
   - Contradictions between public statements and filings
   - Connections to sanctioned entities or persons of interest

10. **ACTIONABLE INTELLIGENCE**
    - Specific recommendations based on the stated objective
    - Follow-up investigation targets
    - Data sources that should be checked but weren't available
    - Timeline of critical upcoming events (earnings, court dates, regulatory deadlines)

Use specific names, dates, dollar amounts, and citations. Never use placeholder data. If information is unavailable, explicitly state what's missing and why it matters.

CONFIDENCE LEVEL: Rate each section HIGH/MEDIUM/LOW based on source quality and completeness.`;

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

      setSessions(prev => prev.map(s =>
        s.id === sessionId ? { ...s, status: "ready", response: result.response } : s
      ));
      setActiveSession(prev => prev?.id === sessionId ? { ...prev, status: "ready", response: result.response } : prev);
    } catch {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: "error" } : s));
      setActiveSession(prev => prev?.id === sessionId ? { ...prev, status: "error" } : prev);
    } finally {
      setLoading(false);
      setAnswers({});
      setCurrentQ(0);
      setCurrentAnswer("");
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
              </div>
            </button>
          ))}
          {sessions.length === 0 && !showIntake && (
            <p className="text-[10px] text-muted-foreground/40 text-center py-8 px-2">No sessions yet. Create one to begin.</p>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {showIntake && (
          <div className="max-w-2xl mx-auto p-8 flex flex-col items-center justify-center min-h-full">
            {/* Progress */}
            <div className="w-full mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Question {currentQ + 1} of {INTAKE_QUESTIONS.length}</span>
                {!q.required && <span className="text-[10px] text-muted-foreground/40">Optional — press Enter to skip</span>}
              </div>
              <div className="h-1 bg-border/20 rounded-full overflow-hidden">
                <div className="h-full bg-accent/60 rounded-full transition-all duration-300" style={{ width: `${((currentQ + 1) / INTAKE_QUESTIONS.length) * 100}%` }} />
              </div>
            </div>

            {/* Question */}
            <div className="w-full space-y-6">
              <h2 className="text-xl font-extralight tracking-wide text-foreground leading-relaxed">
                {q.question}
              </h2>
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
        )}

        {activeSession && (
          <div className="p-6 space-y-6">
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
            </div>

            {activeSession.response && (
              <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-6">
                <div className="prose prose-sm prose-invert max-w-none font-extralight [&_h1]:text-lg [&_h1]:font-light [&_h1]:tracking-wide [&_h2]:text-base [&_h2]:font-light [&_h3]:text-sm [&_h3]:font-light [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-foreground/90 [&_ul]:space-y-1 [&_li]:text-sm [&_strong]:text-foreground [&_code]:bg-secondary/50 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_pre]:bg-secondary/30 [&_pre]:rounded-lg [&_pre]:p-4">
                  <ReactMarkdown>{activeSession.response}</ReactMarkdown>
                </div>
              </div>
            )}

            {activeSession.status === "error" && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center">
                <AlertTriangle className="h-6 w-6 text-destructive mx-auto mb-2" />
                <p className="text-sm text-foreground">Analysis failed. Please try again.</p>
              </div>
            )}
          </div>
        )}

        {!showIntake && !activeSession && (
          <div className="flex flex-col items-center justify-center h-full">
            <Globe className="h-12 w-12 text-muted-foreground/20 mb-4" />
            <p className="text-sm font-extralight text-muted-foreground">Select a session or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebIntelligencePanel;
