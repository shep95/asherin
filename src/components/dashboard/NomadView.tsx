import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  Send, Loader2, Crosshair, Globe, Building2, User, AtSign,
  Fingerprint, MapPin, Phone, Image, Shield, AlertTriangle, Sparkles, WifiOff, Clock, Check,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface NomadMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  investigationType?: string;
  status?: "sending" | "queued" | "sent" | "failed";
}

const NOMAD_QUEUE_KEY = "aureon_nomad_queue";
function loadNomadQueue(): NomadMessage[] {
  try { return JSON.parse(localStorage.getItem(NOMAD_QUEUE_KEY) || "[]").map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })); } catch { return []; }
}
function saveNomadQueue(q: NomadMessage[]) {
  localStorage.setItem(NOMAD_QUEUE_KEY, JSON.stringify(q));
}

const INVESTIGATION_TYPES = [
  { id: "person", icon: User, label: "Person", desc: "Name, email, username" },
  { id: "company", icon: Building2, label: "Company", desc: "Corp records, SEC, financials" },
  { id: "domain", icon: Globe, label: "Domain / IP", desc: "WHOIS, DNS, certs, infra" },
  { id: "email", icon: AtSign, label: "Email", desc: "Breach checks, linked accounts" },
  { id: "username", icon: Fingerprint, label: "Username", desc: "Cross-platform search" },
  { id: "address", icon: MapPin, label: "Address", desc: "Property, ownership, geo" },
  { id: "phone", icon: Phone, label: "Phone", desc: "Carrier, type, reverse lookup" },
  { id: "image", icon: Image, label: "Image", desc: "Reverse image search", comingSoon: true },
];

const SOURCE_CATEGORIES = [
  { label: "Digital Footprint", sources: ["DuckDuckGo", "GitHub API", "Reddit", "crt.sh", "WHOIS"], status: "live" },
  { label: "Corporate Intel", sources: ["SEC EDGAR", "ProPublica Nonprofits", "FEC Donations", "USASpending"], status: "live" },
  { label: "Public Records", sources: ["CourtListener", "FAA Registry", "EPA ECHO", "CFPB Complaints"], status: "live" },
  { label: "Breach Intel", sources: ["HaveIBeenPwned", "Dehashed"], status: "partial" },
  { label: "People Records", sources: ["Voter Registration", "Property Records", "Professional Licenses"], status: "coming" },
  { label: "News & Media", sources: ["GDELT", "Archive.org", "Google News"], status: "coming" },
];

const NomadView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<NomadMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Online/offline tracking
  useEffect(() => {
    const on = () => { setOnline(true); processNomadQueue(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Load queued messages on mount
  useEffect(() => {
    const queued = loadNomadQueue();
    if (queued.length > 0) {
      setMessages(prev => [...prev, ...queued]);
      if (navigator.onLine) processNomadQueue();
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const processNomadQueue = async () => {
    const queued = loadNomadQueue();
    if (queued.length === 0 || !navigator.onLine) return;
    for (const msg of queued) {
      if (msg.status !== "queued") continue;
      try {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "sending" } : m));
        await actualSend(msg);
        const remaining = loadNomadQueue().filter(q => q.id !== msg.id);
        saveNomadQueue(remaining);
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "sent" } : m));
      } catch {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, status: "failed" } : m));
      }
    }
  };

  const actualSend = async (userMsg: NomadMessage) => {
    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "", timestamp: new Date() }]);

    const history = messages.filter(m => m.role === "user" || m.role === "assistant").concat(userMsg).map(m => ({ role: m.role, content: m.content }));

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/nomad-investigate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: history }),
      }
    );

    if (!resp.ok || !resp.body) {
      const errData = await resp.json().catch(() => ({}));
      setMessages(prev => prev.filter(m => m.id !== assistantId));
      throw new Error(errData.error || `Request failed (${resp.status})`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = "";
    let assistantContent = "";

    while (true) {
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
        if (jsonStr === "[DONE]") break;

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) {
            assistantContent += content;
            const current = assistantContent;
            setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, content: current } : m));
          }
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }
  };

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !user) return;

    const userMsg: NomadMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
      status: "sending",
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // If offline, queue it
    if (!navigator.onLine) {
      const queuedMsg = { ...userMsg, status: "queued" as const };
      setMessages(prev => prev.map(m => m.id === userMsg.id ? queuedMsg : m));
      const queue = loadNomadQueue();
      queue.push(queuedMsg);
      saveNomadQueue(queue);
      setIsLoading(false);
      toast({ title: "Message queued", description: "NOMAD will investigate when you're back online." });
      return;
    }

    try {
      await actualSend(userMsg);
      setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, status: "sent" } : m));
    } catch (e: any) {
      // Queue for retry
      const queuedMsg = { ...userMsg, status: "queued" as const };
      setMessages(prev => prev.map(m => m.id === userMsg.id ? queuedMsg : m));
      const queue = loadNomadQueue();
      queue.push(queuedMsg);
      saveNomadQueue(queue);
      toast({ title: "NOMAD Error", description: `Queued for retry: ${e.message}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const retryMessage = (id: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;
    setMessages(prev => prev.map(m => m.id === id ? { ...m, status: "queued" } : m));
    const queue = loadNomadQueue();
    queue.push({ ...msg, status: "queued" });
    saveNomadQueue(queue);
    processNomadQueue();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickInvestigate = (type: typeof INVESTIGATION_TYPES[0]) => {
    if (type.comingSoon) {
      toast({ title: "Coming Soon", description: `${type.label} investigation is being developed.` });
      return;
    }
    setInput(`Investigate ${type.label.toLowerCase()}: `);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 bg-card/20 backdrop-blur-md px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/15 border border-orange-500/20">
              <Crosshair className="h-4.5 w-4.5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-sm font-light tracking-[0.15em] text-foreground">NOMAD</h1>
              <p className="text-[10px] font-extralight tracking-wider text-muted-foreground">
                PUBLIC INTELLIGENCE AGENT
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSources(!showSources)}
            className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 px-3 py-1.5 text-[10px] font-light tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            <Shield className="h-3 w-3" />
            {showSources ? "HIDE" : "VIEW"} SOURCES
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main chat area */}
        <div className="flex flex-1 flex-col min-h-0">
          <ScrollArea className="flex-1">
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.length === 0 ? (
                <div className="space-y-8 pt-8">
                  {/* Welcome */}
                  <div className="text-center space-y-3">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500/10 border border-orange-500/20 mx-auto">
                      <Crosshair className="h-7 w-7 text-orange-400" />
                    </div>
                    <h2 className="text-lg font-extralight tracking-wide text-foreground">
                      NOMAD Intelligence Agent
                    </h2>
                    <p className="text-xs font-extralight leading-relaxed text-muted-foreground max-w-md mx-auto">
                      Describe your investigation target. NOMAD will query 40+ public data sources, correlate findings, and generate a structured intelligence dossier.
                    </p>
                  </div>

                  {/* Quick investigation types */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {INVESTIGATION_TYPES.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => handleQuickInvestigate(type)}
                        className={`group relative flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                          type.comingSoon
                            ? "border-border/10 bg-card/10 opacity-50 cursor-not-allowed"
                            : "border-border/20 bg-card/20 hover:bg-card/40 hover:border-orange-500/20"
                        }`}
                      >
                        {type.comingSoon && (
                          <span className="absolute top-1.5 right-1.5 text-[8px] font-light tracking-wider text-muted-foreground bg-card/60 rounded px-1">
                            SOON
                          </span>
                        )}
                        <type.icon className="h-5 w-5 text-orange-400/70 group-hover:text-orange-400 transition-colors" />
                        <span className="text-[11px] font-light text-foreground">{type.label}</span>
                        <span className="text-[9px] font-extralight text-muted-foreground leading-tight">{type.desc}</span>
                      </button>
                    ))}
                  </div>

                  {/* Example prompts */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-light tracking-wider text-muted-foreground/50 text-center uppercase">
                      Example Investigations
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {[
                        "Investigate company: SpaceX — find SEC filings, federal contracts, key officers, and recent news coverage",
                        "Research domain: example.com — full DNS history, SSL certs, subdomains, and ownership data",
                        "Find all public information about email: john@techcorp.com — breach exposure, linked accounts, domain ownership",
                        "Corporate deep dive: find all nonprofits where Elon Musk is listed as an officer or director",
                      ].map((prompt) => (
                        <button
                          key={prompt}
                          onClick={() => { setInput(prompt); inputRef.current?.focus(); }}
                          className="rounded-xl border border-border/15 bg-card/15 p-3 text-left text-[11px] font-extralight leading-relaxed text-muted-foreground hover:bg-card/30 hover:text-foreground transition-colors"
                        >
                          <Sparkles className="h-3 w-3 text-orange-400/50 mb-1" />
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        msg.role === "user"
                          ? "bg-orange-500/15 border border-orange-500/20 text-foreground"
                          : "bg-card/30 border border-border/20 text-foreground"
                      }`}
                    >
                      {msg.role === "assistant" && msg.content === "" && isLoading ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-400" />
                          <span className="text-xs font-extralight tracking-wider animate-pulse">
                            SCANNING SOURCES...
                          </span>
                        </div>
                      ) : msg.role === "assistant" ? (
                        <div>
                          <div className="prose prose-invert prose-sm max-w-none font-extralight [&_h1]:text-base [&_h1]:font-light [&_h1]:tracking-wide [&_h2]:text-sm [&_h2]:font-light [&_h2]:tracking-wide [&_h3]:text-xs [&_h3]:font-light [&_ul]:space-y-1 [&_ol]:space-y-1 [&_li]:text-xs [&_p]:text-xs [&_p]:leading-relaxed [&_code]:text-[10px] [&_code]:break-all [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_pre]:text-[10px] [&_table]:text-xs [&_th]:text-[10px] [&_th]:font-light [&_th]:tracking-wider [&_strong]:text-orange-300 overflow-hidden">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                          {msg.content.length > 100 && (() => {
                            // Extract confidence from response content
                            const confMatch = msg.content.match(/confidence[:\s]*(?:level[:\s]*)?(HIGH|MEDIUM|LOW|\d+)/i);
                            const sourceMatch = msg.content.match(/source/gi);
                            const sourceCount = sourceMatch ? Math.min(sourceMatch.length, 40) : 0;
                            let confScore = 70;
                            if (confMatch) {
                              if (/HIGH/i.test(confMatch[1])) confScore = 85;
                              else if (/MEDIUM/i.test(confMatch[1])) confScore = 65;
                              else if (/LOW/i.test(confMatch[1])) confScore = 40;
                              else confScore = parseInt(confMatch[1]) || 70;
                            }
                            return (
                              <div className="mt-3 pt-3 border-t border-border/10 flex items-center gap-3">
                                <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${confScore >= 70 ? "bg-emerald-500/10 border border-emerald-500/20" : confScore >= 50 ? "bg-amber-500/10 border border-amber-500/20" : "bg-destructive/10 border border-destructive/20"}`}>
                                  <div className={`h-1.5 w-1.5 rounded-full ${confScore >= 70 ? "bg-emerald-400" : confScore >= 50 ? "bg-amber-400" : "bg-destructive"}`} />
                                  <span className={`text-[9px] font-light ${confScore >= 70 ? "text-emerald-400" : confScore >= 50 ? "text-amber-400" : "text-destructive"}`}>Confidence: {confScore}%</span>
                                </div>
                                <span className="text-[9px] text-muted-foreground/40">{sourceCount} sources referenced</span>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-extralight leading-relaxed flex-1">{msg.content}</p>
                          {msg.status === "sending" && <Loader2 className="h-2.5 w-2.5 text-accent/60 animate-spin shrink-0" />}
                          {msg.status === "queued" && <Clock className="h-2.5 w-2.5 text-amber-400/70 shrink-0" />}
                          {msg.status === "sent" && <Check className="h-2.5 w-2.5 text-muted-foreground/30 shrink-0" />}
                          {msg.status === "failed" && (
                            <button onClick={() => retryMessage(msg.id)} title="Retry">
                              <AlertTriangle className="h-2.5 w-2.5 text-destructive/70 shrink-0" />
                            </button>
                          )}
                        </div>
                      )}
                      {msg.role === "user" && msg.status === "queued" && (
                        <p className="text-[9px] text-amber-400/70 mt-1">Queued — will send when online</p>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="flex-shrink-0 border-t border-border/20 bg-card/20 backdrop-blur-md px-4 py-3">
            <div className="max-w-3xl mx-auto">
              <div className={`flex items-end gap-2 rounded-2xl border ${online ? "border-border/20" : "border-amber-500/30"} bg-card/30 p-2`}>
                {!online && <WifiOff className="h-3.5 w-3.5 text-amber-400/60 shrink-0 mb-2" />}
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={online ? "Describe your investigation target..." : "Offline — investigations will queue…"}
                  className="flex-1 resize-none bg-transparent text-xs font-extralight text-foreground placeholder:text-muted-foreground/40 outline-none min-h-[36px] max-h-[120px] py-2 px-2"
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/80 text-white hover:bg-orange-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2 px-2">
                <AlertTriangle className="h-3 w-3 text-orange-400/50" />
                <p className="text-[9px] font-extralight text-muted-foreground/50">
                  NOMAD uses only publicly available data sources. All information is legal and ethically sourced.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sources panel */}
        {showSources && (
          <div className="w-72 flex-shrink-0 border-l border-border/20 bg-card/10 backdrop-blur-md overflow-y-auto">
            <div className="p-4 space-y-4">
              <h3 className="text-[10px] font-light tracking-[0.2em] text-muted-foreground uppercase">
                Data Sources
              </h3>
              {SOURCE_CATEGORIES.map((cat) => (
                <div key={cat.label} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[11px] font-light text-foreground">{cat.label}</h4>
                    <span
                      className={`text-[8px] tracking-wider px-1.5 py-0.5 rounded ${
                        cat.status === "live"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : cat.status === "partial"
                          ? "bg-yellow-500/15 text-yellow-400"
                          : "bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      {cat.status === "live" ? "LIVE" : cat.status === "partial" ? "PARTIAL" : "COMING"}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {cat.sources.map((src) => (
                      <p key={src} className="text-[10px] font-extralight text-muted-foreground/70 pl-2">
                        → {src}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NomadView;
