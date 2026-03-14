import { useState, useRef, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import {
  Send, Loader2, Crosshair, Globe, Building2, User, AtSign,
  Fingerprint, MapPin, Phone, Image, Shield, Sparkles,
  History, X, Download, Clock, Check, WifiOff, GitBranch, Copy,
  Brain, TrendingUp, Network, ShieldCheck,
  Layers, Map, BarChart3, MessageSquare, Search,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import MessageDiagramPanel from "./MessageDiagramPanel";
import MermaidDigraph from "./MermaidDigraph";
import ReasoningToggle, { type ReasoningMode } from "./ReasoningToggle";

const NomadObjectExplorer = lazy(() => import("./nomad/NomadObjectExplorer"));
const NomadTimeline = lazy(() => import("./nomad/NomadTimeline"));
const NomadGraphAnalysis = lazy(() => import("./nomad/NomadGraphAnalysis"));
const NomadMapLayer = lazy(() => import("./nomad/NomadMapLayer"));
const NomadLineage = lazy(() => import("./nomad/NomadLineage"));
const NomadOntology = lazy(() => import("./nomad/NomadOntology"));
const NomadQuiver = lazy(() => import("./nomad/NomadQuiver"));
const NomadEntityWorkbench = lazy(() => import("./nomad/NomadEntityWorkbench"));
const NomadClaimsEvidence = lazy(() => import("./nomad/NomadClaimsEvidence"));
const NomadSourceIntel = lazy(() => import("./nomad/NomadSourceIntel"));
const NomadCaseManager = lazy(() => import("./nomad/NomadCaseManager"));
const NomadAdversaryView = lazy(() => import("./nomad/NomadAdversaryView"));
const NomadMediaForensics = lazy(() => import("./nomad/NomadMediaForensics"));
const NomadCollectionPipeline = lazy(() => import("./nomad/NomadCollectionPipeline"));
const NomadHandleHunter = lazy(() => import("./nomad/NomadHandleHunter"));
const NomadNetworkDiff = lazy(() => import("./nomad/NomadNetworkDiff"));

interface NomadInvestigation {
  id: string;
  query: string;
  investigation_type: string;
  sources_checked: string[];
  findings: string;
  entities_found: any[];
  created_at: string;
}

function extractEntitiesFromText(text: string) {
  const entities: { type: string; value: string; confidence: number; source?: string }[] = [];
  const seen = new Set<string>();
  const add = (type: string, value: string, confidence: number) => {
    const key = `${type}:${value}`;
    if (!seen.has(key)) { seen.add(key); entities.push({ type, value, confidence }); }
  };
  (text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || []).forEach(v => add("email", v, 1.0));
  (text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g) || []).forEach(v => add("phone", v, 0.9));
  (text.match(/\$[\d,]+(?:\.\d{2})?/g) || []).forEach(v => add("money", v, 0.95));
  (text.match(/\b[A-Z][A-Za-z\s&]+(?:Inc\.|LLC|Corp\.|Corporation)\b/g) || []).forEach(v => add("organization", v.trim(), 0.85));
  (text.match(/https?:\/\/[^\s)]+/g) || []).forEach(v => add("url", v, 1.0));
  // Extended extraction
  (text.match(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g) || []).forEach(v => add("phone", v, 0.9));
  (text.match(/\b(?:Toyota|Honda|Ford|BMW|Mercedes|Tesla|Chevrolet|Audi|Porsche)\s+[A-Z][A-Za-z0-9\s-]{2,15}/g) || []).forEach(v => add("vehicle", v.trim(), 0.8));
  (text.match(/\btransaction[:\s#]*[A-Za-z0-9-]{8,36}\b/gi) || []).forEach(v => add("transaction_id", v, 0.85));
  (text.match(/\b(?:wire|transfer|payment)\s+(?:of\s+)?\$[\d,.]+/gi) || []).forEach(v => add("transaction", v, 0.9));
  (text.match(/-?\d{1,3}\.\d{3,8},\s*-?\d{1,3}\.\d{3,8}/g) || []).forEach(v => add("coordinates", v, 0.85));
  (text.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g) || []).forEach(v => { if (v.split('.').map(Number).every(p => p >= 0 && p <= 255)) add("ip_address", v, 0.9); });
  (text.match(/\b(?:located\s+(?:in|at|near)|headquartered\s+in|based\s+in)\s+([A-Z][A-Za-z\s,]+)/g) || []).forEach(v => add("location", v.trim(), 0.8));
  (text.match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/g) || []).forEach(v => add("us_location", v, 0.85));
  (text.match(/@[\w]{3,}/g) || []).forEach(v => add("handle", v, 0.8));
  return entities;
}

interface CollectedImage {
  url: string;
  title: string;
  source: string;
  thumbnail?: string;
}

interface NomadMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  investigationType?: string;
  status?: "sending" | "queued" | "sent" | "failed";
  images?: CollectedImage[];
}

type NomadTab = "chat" | "objects" | "timeline" | "graph" | "map" | "lineage" | "ontology" | "quiver" | "entities" | "claims" | "sources" | "case" | "adversary" | "media" | "pipeline" | "handles" | "diff";

const INVESTIGATION_TYPES = [
  { id: "person", icon: User, label: "Person", desc: "Deep profile & predictions" },
  { id: "company", icon: Building2, label: "Company", desc: "Truth Graph analysis" },
  { id: "domain", icon: Globe, label: "Domain / IP", desc: "Infrastructure forensics" },
  { id: "email", icon: AtSign, label: "Email", desc: "Breach & identity fusion" },
  { id: "username", icon: Fingerprint, label: "Username", desc: "Cross-platform resolution" },
  { id: "address", icon: MapPin, label: "Address", desc: "Property, ownership" },
  { id: "phone", icon: Phone, label: "Phone", desc: "Carrier, reverse lookup" },
  { id: "predictive", icon: TrendingUp, label: "Predictive", desc: "Behavioral trajectories" },
];

const TABS: { id: NomadTab; icon: any; label: string }[] = [
  { id: "chat", icon: MessageSquare, label: "Intel Chat" },
  { id: "entities", icon: User, label: "Entities" },
  { id: "claims", icon: Shield, label: "Claims" },
  { id: "objects", icon: Layers, label: "Objects" },
  { id: "timeline", icon: Clock, label: "Timeline" },
  { id: "graph", icon: Network, label: "Graph" },
  { id: "map", icon: Map, label: "Map" },
  { id: "sources", icon: ShieldCheck, label: "Sources" },
  { id: "handles", icon: Fingerprint, label: "Handles" },
  { id: "adversary", icon: Crosshair, label: "Adversary" },
  { id: "media", icon: Image, label: "Media" },
  { id: "case", icon: Search, label: "Case Mgmt" },
  { id: "pipeline", icon: GitBranch, label: "Pipelines" },
  { id: "diff", icon: TrendingUp, label: "Diff" },
  { id: "lineage", icon: GitBranch, label: "Lineage" },
  { id: "ontology", icon: Layers, label: "Ontology" },
  { id: "quiver", icon: Sparkles, label: "Quiver" },
];

const NomadView = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<NomadMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [pastInvestigations, setPastInvestigations] = useState<NomadInvestigation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [diagramId, setDiagramId] = useState<string | null>(null);
  const [reasoningMode, setReasoningMode] = useState<ReasoningMode>("deep");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<NomadTab>("chat");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Aggregate all entities from messages for panels
  const allEntities = useMemo(() => {
    const entities: { type: string; value: string; confidence: number; source?: string }[] = [];
    const seen = new Set<string>();
    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.content) continue;
      for (const e of extractEntitiesFromText(msg.content)) {
        const key = `${e.type}:${e.value}`;
        if (!seen.has(key)) { seen.add(key); entities.push(e); }
      }
    }
    return entities;
  }, [messages]);

  // Build cross-reference map
  const crossRefMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const msg of messages) {
      if (msg.role !== "assistant" || !msg.content) continue;
      const msgEntities = extractEntitiesFromText(msg.content);
      for (const e of msgEntities) {
        const key = `${e.type}:${e.value.toLowerCase().trim()}`;
        if (!map[key]) map[key] = [];
        if (!map[key].includes(msg.id)) map[key].push(msg.id);
      }
    }
    return map;
  }, [messages]);

  // Convert messages to investigation-like format for Timeline/Map
  const sessionInvestigations = useMemo(() => {
    return messages.filter(m => m.role === "assistant" && m.content).map((m, idx) => {
      const userMsg = messages.slice(0, messages.indexOf(m)).reverse().find(u => u.role === "user");
      return {
        query: userMsg?.content || "",
        findings: m.content,
        created_at: m.timestamp.toISOString(),
        entities_found: extractEntitiesFromText(m.content),
        sources_checked: ["NOMAD Session"],
      };
    });
  }, [messages]);

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
          // Handle image events
          if (parsed.type === 'images' && parsed.images) {
            const imgs = parsed.images as CollectedImage[];
            setMessages(prev => prev.map(m => m.id === assistantId ? { ...m, images: imgs } : m));
            continue;
          }
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

    if (assistantContent && user) {
      try {
        const entities = extractEntitiesFromText(assistantContent);
        const { data: investigation } = await (supabase.from as any)("nomad_investigations")
          .insert({
            user_id: user.id,
            query: userMsg.content,
            investigation_type: userMsg.investigationType || "general",
            sources_checked: ["DuckDuckGo", "SEC EDGAR", "FEC", "ProPublica", "crt.sh", "GitHub", "USASpending"],
            findings: assistantContent,
            entities_found: entities,
          })
          .select()
          .single();

        if (investigation && entities.length > 0) {
          for (const entity of entities.slice(0, 50)) {
            await (supabase.from as any)("nomad_entities").insert({
              investigation_id: investigation.id,
              user_id: user.id,
              entity_type: entity.type,
              entity_value: entity.value,
              confidence: entity.confidence,
              source: "nomad-investigation",
            });
          }
        }
      } catch (e) {
        console.error("Failed to save investigation:", e);
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

    try {
      await actualSend(userMsg);
      setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, status: "sent" } : m));
    } catch (e: any) {
      toast({ title: "NOMAD Error", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickInvestigate = (type: typeof INVESTIGATION_TYPES[0]) => {
    setInput(`Investigate ${type.label.toLowerCase()}: `);
    setActiveTab("chat");
    inputRef.current?.focus();
  };

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    const { data } = await (supabase.from as any)("nomad_investigations")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setPastInvestigations((data || []) as NomadInvestigation[]);
    setHistoryLoading(false);
    setShowHistory(true);
  }, [user]);

  const exportInvestigation = (inv: NomadInvestigation) => {
    const blob = new Blob([inv.findings], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `nomad-${inv.query.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Entity count badge for tabs
  const entityCount = allEntities.length;

  return (
    <div className="flex flex-1 flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/20 bg-card/20 backdrop-blur-md px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Crosshair className="h-4 w-4 text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-light tracking-[0.2em] text-foreground uppercase">NOMAD</h1>
              <p className="text-[10px] font-extralight tracking-wider text-muted-foreground">Gotham-Grade Intelligence Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ReasoningToggle mode={reasoningMode} onChange={setReasoningMode} />
            <button
              onClick={loadHistory}
              className="flex items-center gap-2 rounded-2xl border border-border/20 bg-card/30 px-4 py-2 text-[10px] font-extralight tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              <History className="h-3 w-3" />
              History
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex items-center gap-1 mt-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-extralight tracking-wider transition-all ${
                activeTab === tab.id
                  ? "bg-accent/15 text-accent border border-accent/20"
                  : "text-muted-foreground/60 hover:text-foreground hover:bg-card/30 border border-transparent"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.id !== "chat" && entityCount > 0 && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent/70">{entityCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* History Overlay */}
      {showHistory && (
        <div className="absolute inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-border/20">
            <h2 className="text-sm font-light tracking-[0.2em] text-foreground uppercase">Investigation History</h2>
            <button onClick={() => setShowHistory(false)} className="rounded-2xl p-2 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-3">
              {historyLoading ? (
                <div className="text-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" /></div>
              ) : pastInvestigations.length === 0 ? (
                <p className="text-center text-sm font-extralight text-muted-foreground py-12">No past investigations.</p>
              ) : pastInvestigations.map(inv => (
                <div key={inv.id} className="rounded-2xl border border-border/20 bg-card/20 p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-light text-foreground truncate">{inv.query}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] font-extralight text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</span>
                        <span className="text-[10px] font-extralight text-muted-foreground/50">{inv.sources_checked?.length || 0} sources</span>
                        <span className="text-[10px] font-extralight text-muted-foreground/50">{inv.entities_found?.length || 0} entities</span>
                      </div>
                    </div>
                    <button onClick={() => exportInvestigation(inv)} className="rounded-2xl p-2 text-muted-foreground hover:text-foreground transition-colors">
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex flex-1 flex-col min-h-0">
        {activeTab === "chat" ? (
          <>
            <ScrollArea className="flex-1">
              <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                {messages.length === 0 ? (
                  <div className="space-y-8 pt-12">
                    <div className="text-center space-y-4">
                      <div className="h-16 w-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto">
                        <Crosshair className="h-7 w-7 text-accent" />
                      </div>
                      <h2 className="text-xl font-extralight tracking-wide text-foreground">NOMAD v3.0</h2>
                      <p className="text-sm font-extralight text-muted-foreground max-w-md mx-auto leading-relaxed">
                        ESRC Deanonymization Framework — Extract, Search, Reason, Calibrate. Describe your target — NOMAD executes the full ESRC pipeline across 40+ attested sources.
                      </p>
                      <div className="flex items-center justify-center gap-4 flex-wrap text-[9px] font-extralight tracking-wider text-muted-foreground/50">
                        <span className="flex items-center gap-1"><Crosshair className="h-3 w-3" /> EXTRACT</span>
                        <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> SEARCH</span>
                        <span className="flex items-center gap-1"><Brain className="h-3 w-3" /> REASON</span>
                        <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> CALIBRATE</span>
                        <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> BRADLEY-TERRY</span>
                        <span className="flex items-center gap-1"><Network className="h-3 w-3" /> ENTITY RESOLUTION</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
                      {INVESTIGATION_TYPES.map(type => (
                        <button
                          key={type.id}
                          onClick={() => handleQuickInvestigate(type)}
                          className="group relative flex flex-col items-center gap-2.5 rounded-2xl border border-border/20 bg-card/20 hover:bg-card/40 hover:border-accent/20 p-4 text-center transition-all"
                        >
                          <type.icon className="h-5 w-5 text-accent/60 group-hover:text-accent transition-colors" />
                          <span className="text-[11px] font-light text-foreground">{type.label}</span>
                          <span className="text-[9px] font-extralight text-muted-foreground leading-tight">{type.desc}</span>
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2 max-w-2xl mx-auto">
                      <p className="text-[10px] font-extralight tracking-wider text-muted-foreground/40 text-center uppercase">Examples</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          "Investigate company: SpaceX — Truth Graph analysis with predictive trajectories",
                          "Deep dive on domain: example.com — infrastructure forensics & provenance attestation",
                          "Research person: Elon Musk — entity resolution, network mapping & behavioral predictions",
                          "Predictive analysis: What is the probability Tesla acquires a lithium mining company?",
                        ].map(ex => (
                          <button
                            key={ex}
                            onClick={() => { setInput(ex); inputRef.current?.focus(); }}
                            className="rounded-2xl border border-border/15 bg-card/15 px-4 py-3 text-left text-[11px] font-extralight text-muted-foreground hover:text-foreground hover:bg-card/30 transition-all leading-relaxed"
                          >
                            {ex}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[85%]">
                        <div className={`rounded-2xl px-5 py-4 ${
                          msg.role === "user"
                            ? "bg-accent/15 border border-accent/20"
                            : "bg-card/30 border border-border/20"
                        }`}>
                          {msg.role === "assistant" && !msg.content ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                              <span className="text-xs font-extralight text-muted-foreground animate-pulse">Investigating…</span>
                            </div>
                          ) : msg.role === "assistant" ? (<>
                            <div className="prose prose-invert prose-sm max-w-none font-extralight [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-foreground/90 [&_h1]:text-base [&_h1]:font-light [&_h2]:text-sm [&_h2]:font-light [&_h3]:text-sm [&_h3]:font-light [&_li]:text-sm [&_code]:bg-secondary/50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-lg [&_pre]:bg-secondary/30 [&_pre]:rounded-2xl [&_pre]:p-4 [&_strong]:text-foreground [&_a]:text-accent">
                              {(() => {
                                const parts = msg.content.split(/(```mermaid[\s\S]*?```)/g);
                                return parts.map((part, idx) => {
                                  const mermaidMatch = part.match(/```mermaid\s*([\s\S]*?)```/);
                                  if (mermaidMatch) {
                                    return <MermaidDigraph key={idx} code={mermaidMatch[1]} />;
                                  }
                                  if (part.trim()) {
                                    return <ReactMarkdown key={idx}>{part}</ReactMarkdown>;
                                  }
                                  return null;
                                });
                              })()}
                            </div>
                            {/* Image Gallery */}
                            {msg.images && msg.images.length > 0 && (
                              <div className="mt-4 border-t border-border/10 pt-3">
                                <button
                                  onClick={() => setExpandedImages(expandedImages === msg.id ? null : msg.id)}
                                  className="flex items-center gap-2 text-[10px] font-light text-accent/70 hover:text-accent transition-colors mb-2"
                                >
                                  <Image className="h-3 w-3" />
                                  {msg.images.length} image{msg.images.length !== 1 ? 's' : ''} collected
                                  <span className="text-[8px] text-muted-foreground/50">
                                    {expandedImages === msg.id ? '▼' : '▶'}
                                  </span>
                                </button>
                                {expandedImages === msg.id && (
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 animate-fade-in">
                                    {msg.images.map((img, imgIdx) => (
                                      <a
                                        key={imgIdx}
                                        href={img.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group relative rounded-xl overflow-hidden border border-border/15 bg-card/20 hover:border-accent/30 transition-all"
                                      >
                                        <img
                                          src={img.thumbnail || img.url}
                                          alt={img.title || 'Investigation image'}
                                          className="w-full h-24 object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                          loading="lazy"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-1.5">
                                          <p className="text-[8px] font-extralight text-foreground/70 truncate">
                                            {img.title || img.source}
                                          </p>
                                        </div>
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          ) : (
                            <p className="text-sm font-extralight text-foreground">{msg.content}</p>
                          )}
                          {msg.role === "user" && msg.status && msg.status !== "sent" && (
                            <div className="flex items-center gap-1.5 mt-2">
                              {msg.status === "sending" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                              {msg.status === "queued" && <Clock className="h-3 w-3 text-muted-foreground" />}
                              {msg.status === "failed" && <X className="h-3 w-3 text-destructive" />}
                              <span className="text-[9px] font-extralight text-muted-foreground capitalize">{msg.status}</span>
                            </div>
                          )}
                        </div>
                        {msg.role === "assistant" && msg.content && !isLoading && (
                          <div className="flex items-center gap-2 mt-1.5 px-1 animate-fade-in">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(msg.content);
                                setCopiedId(msg.id);
                                setTimeout(() => setCopiedId(null), 2000);
                              }}
                              className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                            >
                              {copiedId === msg.id ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
                              {copiedId === msg.id ? "Copied" : "Copy"}
                            </button>
                            <button
                              onClick={() => setDiagramId(diagramId === msg.id ? null : msg.id)}
                              className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                            >
                              <GitBranch className="h-3 w-3" />
                              Diagram
                            </button>
                            {/* Quick nav to panels */}
                            {allEntities.length > 0 && (
                              <>
                                <button onClick={() => setActiveTab("objects")} className="flex items-center gap-1 text-[10px] font-light text-accent/50 hover:text-accent transition-colors">
                                  <Layers className="h-3 w-3" /> Objects
                                </button>
                                <button onClick={() => setActiveTab("graph")} className="flex items-center gap-1 text-[10px] font-light text-accent/50 hover:text-accent transition-colors">
                                  <Network className="h-3 w-3" /> Graph
                                </button>
                                <button onClick={() => setActiveTab("map")} className="flex items-center gap-1 text-[10px] font-light text-accent/50 hover:text-accent transition-colors">
                                  <Map className="h-3 w-3" /> Map
                                </button>
                              </>
                            )}
                          </div>
                        )}
                        {msg.role === "assistant" && diagramId === msg.id && (
                          <MessageDiagramPanel
                            open={true}
                            content={msg.content}
                            onClose={() => setDiagramId(null)}
                          />
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <div className="flex-shrink-0 border-t border-border/20 bg-card/20 backdrop-blur-md px-4 py-4">
              <div className="max-w-3xl mx-auto flex items-end gap-3">
                <div className="flex-1 rounded-2xl border border-border/20 bg-card/30 px-4 py-3">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe your investigation target..."
                    rows={1}
                    className="w-full bg-transparent text-sm font-extralight text-foreground placeholder:text-muted-foreground/40 outline-none resize-none"
                  />
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="rounded-2xl bg-accent/20 border border-accent/30 p-3 text-accent hover:bg-accent/30 transition-colors disabled:opacity-30"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          }>
            {activeTab === "objects" && (
              <NomadObjectExplorer entities={allEntities} crossRefMap={crossRefMap} />
            )}
            {activeTab === "timeline" && (
              <NomadTimeline investigations={sessionInvestigations} sessionEntities={allEntities} />
            )}
            {activeTab === "graph" && (
              <NomadGraphAnalysis entities={allEntities} crossRefMap={crossRefMap} />
            )}
            {activeTab === "map" && (
              <NomadMapLayer entities={allEntities} investigations={sessionInvestigations} />
            )}
            {activeTab === "lineage" && (
              <NomadLineage entities={allEntities} investigations={sessionInvestigations} />
            )}
            {activeTab === "ontology" && (
              <NomadOntology entities={allEntities} investigations={sessionInvestigations} />
            )}
            {activeTab === "quiver" && (
              <NomadQuiver entities={allEntities} investigations={sessionInvestigations} />
            )}
            {activeTab === "entities" && (
              <NomadEntityWorkbench entities={allEntities} crossRefMap={crossRefMap} investigations={sessionInvestigations} />
            )}
            {activeTab === "claims" && (
              <NomadClaimsEvidence entities={allEntities} investigations={sessionInvestigations} />
            )}
            {activeTab === "sources" && (
              <NomadSourceIntel investigations={sessionInvestigations} />
            )}
            {activeTab === "case" && (
              <NomadCaseManager entities={allEntities} investigations={sessionInvestigations} />
            )}
            {activeTab === "adversary" && (
              <NomadAdversaryView entities={allEntities} investigations={sessionInvestigations} />
            )}
            {activeTab === "media" && (
              <NomadMediaForensics entities={allEntities} investigations={sessionInvestigations} />
            )}
            {activeTab === "pipeline" && (
              <NomadCollectionPipeline />
            )}
            {activeTab === "handles" && (
              <NomadHandleHunter entities={allEntities} />
            )}
            {activeTab === "diff" && (
              <NomadNetworkDiff entities={allEntities} investigations={sessionInvestigations} />
            )}
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default NomadView;
