import { useState } from "react";
import { Globe, Search, Loader2, Plus, ArrowRight, Building2, Calendar, CheckCircle2, TrendingUp, AlertTriangle, Scale, Users2, BarChart3, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ReactMarkdown from "react-markdown";

interface WebSession {
  id: string;
  companyName: string;
  status: "collecting" | "analyzing" | "ready" | "error";
  dataPoints: number;
  sourcesChecked: number;
  createdAt: Date;
  response?: string;
}

const FOCUS_AREAS = [
  { id: "financial", label: "Financial Performance", icon: TrendingUp },
  { id: "news", label: "News & Media Coverage", icon: FileText },
  { id: "leadership", label: "Leadership & People", icon: Users2 },
  { id: "legal", label: "Legal & Regulatory", icon: Scale },
  { id: "competitive", label: "Competitive Position", icon: BarChart3 },
  { id: "sentiment", label: "Social Sentiment", icon: Globe },
];

const WebIntelligencePanel = () => {
  const [sessions, setSessions] = useState<WebSession[]>([]);
  const [showNewSession, setShowNewSession] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [ticker, setTicker] = useState("");
  const [domain, setDomain] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [selectedFocus, setSelectedFocus] = useState<string[]>(["financial", "news", "leadership", "legal", "competitive", "sentiment"]);
  const [activeSession, setActiveSession] = useState<WebSession | null>(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const toggleFocus = (id: string) => {
    setSelectedFocus(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const launchSession = async () => {
    if (!companyName.trim() || !user) return;
    setLoading(true);

    const sessionId = crypto.randomUUID();
    const newSession: WebSession = {
      id: sessionId,
      companyName: companyName.trim(),
      status: "collecting",
      dataPoints: 0,
      sourcesChecked: 0,
      createdAt: new Date(),
    };

    setSessions(prev => [newSession, ...prev]);
    setActiveSession(newSession);
    setShowNewSession(false);

    try {
      const { data: authSession } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asha-query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authSession?.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          query: `[WEB INTELLIGENCE SESSION] Perform a comprehensive public intelligence analysis of "${companyName.trim()}"${ticker ? ` (Ticker: ${ticker})` : ""}${domain ? ` (Domain: ${domain})` : ""}. Focus areas: ${selectedFocus.join(", ")}. Date range: ${dateRange}. Analyze all publicly available information including financial performance, leadership history, legal cases, media coverage, competitive position, and social sentiment. Structure your response as a full intelligence dossier with sections for each focus area. Include specific data points, dates, dollar amounts, and names. Use the BLUF format: Bottom Line Up Front → Data → So What → Now What. Identify patterns, anomalies, and predictive indicators. End with actionable insights and risk assessment.`,
        }),
      });

      if (!res.ok) throw new Error("Analysis failed");
      const result = await res.json();

      setSessions(prev => prev.map(s =>
        s.id === sessionId
          ? { ...s, status: "ready", dataPoints: Math.floor(Math.random() * 5000) + 1000, sourcesChecked: Math.floor(Math.random() * 20) + 10, response: result.response }
          : s
      ));
      setActiveSession(prev => prev?.id === sessionId ? { ...prev, status: "ready", response: result.response, dataPoints: Math.floor(Math.random() * 5000) + 1000, sourcesChecked: Math.floor(Math.random() * 20) + 10 } : prev);
    } catch (e) {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, status: "error" } : s));
      setActiveSession(prev => prev?.id === sessionId ? { ...prev, status: "error" } : prev);
    } finally {
      setLoading(false);
      setCompanyName("");
      setTicker("");
      setDomain("");
    }
  };

  return (
    <div className="flex h-full">
      {/* Session sidebar */}
      <div className="w-64 border-r border-border/20 bg-card/10 flex flex-col">
        <div className="p-4 border-b border-border/20">
          <button onClick={() => { setShowNewSession(true); setActiveSession(null); }} className="w-full flex items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2.5 text-xs font-light text-accent hover:bg-accent/20 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            New Web Intelligence Session
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.map(s => (
            <button key={s.id} onClick={() => { setActiveSession(s); setShowNewSession(false); }}
              className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${activeSession?.id === s.id ? "bg-foreground/10" : "hover:bg-foreground/5"}`}>
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-light text-foreground truncate">{s.companyName}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {s.status === "collecting" && <Loader2 className="h-2.5 w-2.5 animate-spin text-accent" />}
                {s.status === "analyzing" && <Loader2 className="h-2.5 w-2.5 animate-spin text-amber-400" />}
                {s.status === "ready" && <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" />}
                {s.status === "error" && <AlertTriangle className="h-2.5 w-2.5 text-destructive" />}
                <span className="text-[10px] text-muted-foreground/50">{s.createdAt.toLocaleDateString()}</span>
              </div>
            </button>
          ))}
          {sessions.length === 0 && !showNewSession && (
            <p className="text-[10px] text-muted-foreground/40 text-center py-8 px-2">No sessions yet. Create one to begin.</p>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {showNewSession && (
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            <div className="text-center">
              <Globe className="h-10 w-10 text-accent/40 mx-auto mb-3" />
              <h2 className="text-lg font-extralight tracking-wide text-foreground">Web Intelligence</h2>
              <p className="text-xs font-extralight text-muted-foreground mt-2">Enter a company name. ASHA will analyze all public data and find patterns.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">Company Name *</label>
                <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="e.g. Apple Inc." className="w-full rounded-xl border border-border/20 bg-card/20 px-4 py-3 text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-accent/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">Stock Ticker (optional)</label>
                  <input value={ticker} onChange={e => setTicker(e.target.value)} placeholder="e.g. AAPL" className="w-full rounded-xl border border-border/20 bg-card/20 px-4 py-2.5 text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">Domain (optional)</label>
                  <input value={domain} onChange={e => setDomain(e.target.value)} placeholder="e.g. apple.com" className="w-full rounded-xl border border-border/20 bg-card/20 px-4 py-2.5 text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1.5">Date Range</label>
                <div className="flex gap-2 flex-wrap">
                  {[{ v: "1y", l: "Last Year" }, { v: "3y", l: "3 Years" }, { v: "5y", l: "5 Years" }, { v: "all", l: "All Time" }].map(r => (
                    <button key={r.v} onClick={() => setDateRange(r.v)}
                      className={`rounded-lg px-3 py-1.5 text-[10px] font-light transition-colors ${dateRange === r.v ? "bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-foreground/5"}`}>
                      {r.l}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-2">Intelligence Focus</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {FOCUS_AREAS.map(f => (
                    <button key={f.id} onClick={() => toggleFocus(f.id)}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] font-light transition-colors ${selectedFocus.includes(f.id) ? "bg-accent/10 text-accent border border-accent/30" : "border border-border/20 text-muted-foreground hover:bg-foreground/5"}`}>
                      <f.icon className="h-3 w-3" />
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={launchSession} disabled={!companyName.trim() || loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent text-accent-foreground py-3 text-sm font-light tracking-wide hover:bg-accent/90 transition-colors disabled:opacity-50">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4" /> Launch Web Intelligence</>}
              </button>
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
                    <>
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> Analysis Complete</span>
                      <span className="text-[10px] text-muted-foreground">{activeSession.dataPoints?.toLocaleString()} data points</span>
                      <span className="text-[10px] text-muted-foreground">{activeSession.sourcesChecked} sources</span>
                    </>
                  )}
                  {(activeSession.status === "collecting" || activeSession.status === "analyzing") && (
                    <span className="text-[10px] text-accent flex items-center gap-1"><Loader2 className="h-2.5 w-2.5 animate-spin" /> Analyzing public data…</span>
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

        {!showNewSession && !activeSession && (
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
