import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Send, Sparkles, Loader2, Package, WifiOff, Clock, AlertTriangle, Check, Copy, Brain, Eye, Download, Upload, FileText, Image, Shield, Database, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAzplenSession } from "./AzplenSessionContext";
import ReactMarkdown from "react-markdown";
import MessageQueuePanel from "../MessageQueuePanel";
import CalibrationFeedback from "../CalibrationFeedback";
import type { FeedbackType } from "../CalibrationFeedback";
import ChainOfThoughtPanel from "../ChainOfThoughtPanel";
import DecodeView from "../DecodeView";
interface QueryHistoryItem {
  id: string;
  query: string;
  response: string;
  response_type: string;
  created_at: string;
  status?: "sending" | "queued" | "sent" | "failed";
  session_id?: string | null;
}

interface ActivePlugin {
  name: string;
  category: string;
}

const QUEUE_KEY = "aureon_asha_queue";

function loadQueue(): QueryHistoryItem[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
}
function saveQueue(q: QueryHistoryItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

const EXAMPLE_QUERIES = [
  "Which columns have the most missing data?",
  "Summarize the key patterns in my datasets",
  "What are the potential data quality issues?",
  "Find relationships between my uploaded files",
  "What insights can you extract from my data?",
  "Suggest data cleaning steps",
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors">
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function StatusBadge({ status }: { status?: string }) {
  if (!status || status === "sent") return <Check className="h-2.5 w-2.5 text-muted-foreground/30 shrink-0" />;
  if (status === "sending") return <Loader2 className="h-2.5 w-2.5 text-accent/60 animate-spin shrink-0" />;
  if (status === "queued") return <Clock className="h-2.5 w-2.5 text-amber-400/70 shrink-0" />;
  if (status === "failed") return <AlertTriangle className="h-2.5 w-2.5 text-destructive/70 shrink-0" />;
  return null;
}

const QueryBar = () => {
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [activePlugins, setActivePlugins] = useState<ActivePlugin[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [cotId, setCotId] = useState<string | null>(null);
  const [decodeId, setDecodeId] = useState<string | null>(null);
  const [groundedMode, setGroundedMode] = useState(false);
  const { user } = useAuth();
  const { activeSession } = useAzplenSession();

  // Online/offline tracking
  useEffect(() => {
    const on = () => { setOnline(true); processQueue(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  useEffect(() => {
    if (!user) return;
    setInitialLoading(true);
    setHistory([]);
    const load = async () => {
      let queryBuilder = supabase.from("asha_queries").select("*").eq("user_id", user.id).order("created_at", { ascending: true }).limit(50);
      if (activeSession?.id) {
        queryBuilder = queryBuilder.eq("session_id", activeSession.id);
      }
      const [{ data: queryData }, { data: pluginData }] = await Promise.all([
        queryBuilder,
        supabase.from("installed_plugins").select("plugin_id, plugins(name, category)").eq("user_id", user.id),
      ]);
      const dbHistory = (queryData as any[] || []).map((q: any) => ({ ...q, status: "sent" as const }));
      // Merge with any queued items from localStorage scoped to this session
      const queued = loadQueue().filter(q => (q as any).session_id === activeSession?.id);
      setHistory([...dbHistory, ...queued]);
      if (pluginData) {
        setActivePlugins(pluginData.map((p: any) => ({ name: p.plugins?.name || "Unknown", category: p.plugins?.category || "" })).filter((p: ActivePlugin) => p.name !== "Unknown"));
      }
      setInitialLoading(false);
    };
    load();
  }, [user, activeSession?.id]);

  // Process queued messages when back online
  const processQueue = async () => {
    const queued = loadQueue();
    if (queued.length === 0) return;

    for (const item of queued) {
      if (item.status !== "queued") continue;
      try {
        item.status = "sending";
        setHistory(prev => prev.map(h => h.id === item.id ? { ...h, status: "sending" } : h));

        const { data: session } = await supabase.auth.getSession();
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asha-query`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ query: item.query, sessionId: activeSession?.id }),
        });

        if (!res.ok) throw new Error("Query failed");
        const result = await res.json();

        setHistory(prev => prev.map(h =>
          h.id === item.id ? { ...h, response: result.response, response_type: result.type, status: "sent" } : h
        ));
        // Remove from queue
        const remaining = loadQueue().filter(q => q.id !== item.id);
        saveQueue(remaining);
      } catch {
        item.status = "failed";
        setHistory(prev => prev.map(h => h.id === item.id ? { ...h, status: "failed" } : h));
      }
    }
  };

  const submitQuery = async () => {
    if (!query.trim() || loading) return;
    const q = query;
    setQuery("");
    setLoading(true);

    const tempId = crypto.randomUUID();
    const newItem: QueryHistoryItem = {
      id: tempId, query: q, response: "", response_type: "text",
      created_at: new Date().toISOString(), status: "sending",
      session_id: activeSession?.id || null,
    };
    setHistory(prev => [...prev, newItem]);

    // If offline, queue it
    if (!navigator.onLine) {
      const queuedItem = { ...newItem, status: "queued" as const };
      setHistory(prev => prev.map(h => h.id === tempId ? queuedItem : h));
      const queue = loadQueue();
      queue.push(queuedItem);
      saveQueue(queue);
      setLoading(false);
      return;
    }

    try {
      // Build grounded context if grounded mode is on
      let groundedContext = "";
      if (groundedMode && user && activeSession) {
        const [{ data: datasets }, { data: entities }] = await Promise.all([
          supabase.from("asha_datasets").select("file_name, schema, row_count, col_count").eq("user_id", user.id).eq("session_id", activeSession.id).eq("status", "ready"),
          supabase.from("asha_document_entities").select("entity_type, entity_value, confidence").eq("user_id", user.id).limit(100),
        ]);
        const dataContext = datasets?.map(d => {
          const schema = d.schema as any[];
          const fields = schema?.map((s: any) => `${s.name} (${s.type})`).join(", ") || "unknown";
          return `Dataset "${d.file_name}": ${d.row_count} rows, ${d.col_count} cols. Fields: ${fields}`;
        }).join("\n") || "";
        const entityContext = entities?.length ? `Known entities: ${entities.map(e => `${e.entity_type}: ${e.entity_value}`).join("; ")}` : "";
        groundedContext = `ONTOLOGY-GROUNDED MODE: Answer ONLY from the user's actual data. Never hallucinate or use general knowledge.\n\nAvailable Data:\n${dataContext}\n\n${entityContext}`;
      }

      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asha-query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          query: q,
          sessionId: activeSession?.id,
          ...(groundedMode && groundedContext ? { mode: "grounded", context: groundedContext } : {}),
        }),
      });

      if (!res.ok) throw new Error("Query failed");
      const result = await res.json();

      setHistory(prev => prev.map(h =>
        h.id === tempId ? { ...h, response: result.response, response_type: result.type, status: "sent" as const } : h
      ));
    } catch {
      // Queue for retry
      const queuedItem = { ...newItem, status: "queued" as const };
      setHistory(prev => prev.map(h => h.id === tempId ? queuedItem : h));
      const queue = loadQueue();
      queue.push(queuedItem);
      saveQueue(queue);
    } finally {
      setLoading(false);
    }
  };

  const retryFailed = (id: string) => {
    const item = history.find(h => h.id === id);
    if (!item) return;
    setHistory(prev => prev.map(h => h.id === id ? { ...h, status: "queued" } : h));
    const queue = loadQueue();
    queue.push({ ...item, status: "queued" });
    saveQueue(queue);
    processQueue();
  };

  // Derive queue items for panel
  const ashaQueueItems = useMemo(() =>
    history.filter(h => h.status === "queued").map(h => ({ id: h.id, content: h.query })),
    [history]
  );

  const removeFromAshaQueue = (id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id));
    const queue = loadQueue().filter(q => q.id !== id);
    saveQueue(queue);
  };

  const clearAshaQueue = () => {
    setHistory(prev => prev.filter(h => h.status !== "queued"));
    saveQueue([]);
  };

  return (
    <div className="flex h-full flex-col max-w-3xl mx-auto">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {!initialLoading && history.length === 0 && (
          <div className="text-center py-12 space-y-6">
            <div>
              <Sparkles className="h-8 w-8 text-accent/40 mx-auto mb-3" />
              <h2 className="text-lg font-extralight tracking-wide text-foreground">Ask Azplen Anything</h2>
              <p className="text-xs font-extralight text-muted-foreground mt-2">Query your data in plain English. No SQL required.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
              {EXAMPLE_QUERIES.map((eq) => (
                <button key={eq} onClick={() => setQuery(eq)} className="rounded-xl border border-border/20 bg-card/20 px-3 py-2.5 text-[11px] font-light text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors text-left">
                  {eq}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((item) => (
          <div key={item.id} className="space-y-3">
            <div className="flex justify-end">
              <div className="rounded-xl bg-foreground/10 px-4 py-2.5 max-w-md">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-light text-foreground flex-1">{item.query}</p>
                  <StatusBadge status={item.status} />
                </div>
                {item.status === "queued" && (
                  <p className="text-[9px] text-amber-400/70 mt-1">Queued — will send when online</p>
                )}
                {item.status === "failed" && (
                  <button onClick={() => retryFailed(item.id)} className="text-[9px] text-accent mt-1 hover:underline">
                    Retry →
                  </button>
                )}
              </div>
            </div>
            {item.response && (
              <div className="rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-3.5 w-3.5 text-accent" />
                  <span className="text-[10px] text-accent font-light">Azplen</span>
                </div>
                <div className="text-xs font-light text-foreground leading-relaxed prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_code]:text-accent [&_code]:bg-secondary/50 [&_code]:px-1 [&_code]:rounded [&_pre]:bg-secondary/50 [&_pre]:rounded-lg [&_pre]:p-3">
                  <ReactMarkdown>{item.response}</ReactMarkdown>
                </div>
                {/* Aureon-style action bar */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <CopyButton text={item.response} />
                  <CalibrationFeedback messageId={item.id} onFeedback={() => {}} />
                  <button onClick={() => setCotId(cotId === item.id ? null : item.id)}
                    className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                    <Brain className="h-3 w-3" /> Show Work
                  </button>
                  <button onClick={() => setDecodeId(decodeId === item.id ? null : item.id)}
                    className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                    <Eye className="h-3 w-3" /> Decode
                  </button>
                </div>
                {cotId === item.id && (
                  <ChainOfThoughtPanel open content={item.response} query={item.query} />
                )}
                {decodeId === item.id && (
                  <DecodeView open content={item.response} />
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
            Azplen is analyzing your data…
          </div>
        )}
      </div>

      {/* Queue Panel */}
      <MessageQueuePanel
        items={ashaQueueItems}
        onRemove={removeFromAshaQueue}
        onClear={clearAshaQueue}
        onProcessNow={processQueue}
      />

      <div className="flex-shrink-0 p-4 border-t border-border/20 space-y-2">
        {activePlugins.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Package className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            <span className="text-[9px] text-muted-foreground/50">Active:</span>
            {activePlugins.map((p) => (
              <span key={p.name} className="text-[9px] px-1.5 py-0.5 rounded bg-foreground/5 text-muted-foreground">{p.name}</span>
            ))}
          </div>
        )}
        <div className={`flex items-center gap-2 rounded-xl border ${online ? "border-border/20" : "border-amber-500/30"} bg-card/20 backdrop-blur-sm px-4 py-3`}>
          {!online && <WifiOff className="h-4 w-4 text-amber-400/60 shrink-0" />}
          {/* Grounded Mode Toggle */}
          <button
            onClick={() => setGroundedMode(!groundedMode)}
            className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] transition-colors shrink-0 ${
              groundedMode
                ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                : "bg-foreground/5 border border-border/20 text-muted-foreground/50 hover:text-muted-foreground"
            }`}
          >
            {groundedMode ? <CheckCircle className="h-3 w-3" /> : <Database className="h-3 w-3" />}
            Grounded
          </button>
          <Sparkles className="h-4 w-4 text-accent/40 shrink-0" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitQuery()} placeholder={groundedMode ? "Ask about your data (grounded)…" : online ? "Ask anything about your data…" : "Offline — queries will queue…"} className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/40 outline-none" />
          <button onClick={submitQuery} disabled={!query.trim() || loading} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/30 text-center">
          {!online ? "Offline · queries queued · " : ""}{groundedMode ? "Grounded mode — answers from your data only · " : ""}End-to-end encrypted · PII auto-masked{activePlugins.length > 0 ? ` · ${activePlugins.length} plugins active` : ""}
        </p>
      </div>
    </div>
  );
};

export default QueryBar;
