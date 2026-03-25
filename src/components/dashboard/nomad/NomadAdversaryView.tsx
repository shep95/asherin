import { useState, useRef, useEffect } from "react";
import {
  Swords, Shield, AlertTriangle, Brain, RefreshCw, Send,
  Loader2, Copy, Check, ChevronDown, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";

interface NomadAdversaryViewProps {
  entities: { type: string; value: string; confidence: number }[];
  investigations: { query: string; findings: string; created_at: string }[];
}

type ViewMode = "adversary" | "redteam" | "confidence";

interface SimMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const CONFIDENCE_LABELS = [
  { label: "Raw Collection", color: "bg-blue-500/15 text-blue-400 border-blue-500/20", desc: "Unprocessed data directly from sources" },
  { label: "Analyst Inference", color: "bg-amber-500/15 text-amber-400 border-amber-500/20", desc: "Derived by analyst reasoning" },
  { label: "Speculation", color: "bg-red-500/15 text-red-400 border-red-500/20", desc: "Hypothetical, not confirmed" },
];

const NomadAdversaryView = ({ entities, investigations }: NomadAdversaryViewProps) => {
  const { user } = useAuth();
  const [mode, setMode] = useState<ViewMode>("adversary");
  const [messages, setMessages] = useState<SimMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const buildContext = () => {
    const entityList = entities.slice(0, 30).map(e => `${e.type}: ${e.value}`).join("\n");
    const invList = investigations.slice(0, 5).map(i => `Investigation: ${i.query}\n${i.findings.slice(0, 200)}`).join("\n---\n");
    return `ENTITIES:\n${entityList}\n\nINVESTIGATIONS:\n${invList}`;
  };

  const sendMessage = async (customPrompt?: string) => {
    const text = customPrompt || input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: SimMsg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    const systemPrompts: Record<ViewMode, string> = {
      adversary: `You are simulating an ADVERSARY's perspective. Given the investigation context, generate: 1) "If I were them, what would I do next?" — 3-5 next-step hypotheses. 2) For each hypothesis, what evidence would CONFIRM it and what would KILL it. Be specific and tactical.`,
      redteam: `You are a RED TEAM analyst forcing ALTERNATIVE HYPOTHESES. Your job is to challenge every conclusion. For each finding: 1) What would DISPROVE this? 2) What alternative explanation exists? 3) What confirmation bias might be at play? Reduce groupthink.`,
      confidence: `You are a CONFIDENCE AUDITOR. Review the investigation data and: 1) Separate RAW COLLECTION (facts from sources) from ANALYST INFERENCE (derived conclusions) from SPECULATION (hypothetical). 2) Color-code each finding. 3) Flag where analyst notes might be mistaken as facts.`,
    };

    try {
      const { data, error } = await supabase.functions.invoke("nomad-investigate", {
        body: {
          messages: [
            { role: "user", content: `SYSTEM CONTEXT: ${systemPrompts[mode]}\n\nINVESTIGATION DATA:\n${buildContext()}\n\nANALYST QUERY: ${text}` },
          ],
        },
      });

      if (error) throw error;
      const content = typeof data === "string" ? data : data?.choices?.[0]?.message?.content || JSON.stringify(data);
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content }]);
    } catch (e) {
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: `Error: ${e instanceof Error ? e.message : "Unknown error"}` }]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions: Record<ViewMode, { label: string; prompt: string }[]> = {
    adversary: [
      { label: "Next moves", prompt: "Based on the entities and investigations, what would the adversary do next? Generate 5 hypotheses." },
      { label: "Evasion tactics", prompt: "How would the target try to evade detection? What digital footprint cleanup would they attempt?" },
      { label: "Counter-intel", prompt: "If the target knows they're being investigated, what counter-intelligence moves would they make?" },
    ],
    redteam: [
      { label: "Challenge all", prompt: "Challenge every major conclusion in the investigations. What alternative explanations exist?" },
      { label: "Bias check", prompt: "What confirmation biases might be affecting this investigation? Where are we seeing patterns that aren't there?" },
      { label: "Devil's advocate", prompt: "Play devil's advocate: what if the primary hypothesis is completely wrong? Build the strongest counter-case." },
    ],
    confidence: [
      { label: "Audit findings", prompt: "Audit all findings. Separate raw collection from analyst inference from speculation. Flag contamination." },
      { label: "Fact vs opinion", prompt: "Which statements in the investigations are facts (verifiable) vs opinions (analyst judgment)? List each." },
      { label: "Contamination check", prompt: "Check for contamination: are any analyst notes being treated as source data? Flag instances." },
    ],
  };

  const copyContent = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Mode Selector */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border/20">
        {([
          { id: "adversary" as const, icon: Swords, label: "Adversary Sim" },
          { id: "redteam" as const, icon: Shield, label: "Red Team" },
          { id: "confidence" as const, icon: Eye, label: "Confidence Controls" },
        ]).map(m => (
          <button key={m.id} onClick={() => { setMode(m.id); setMessages([]); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-light transition-colors ${mode === m.id ? "bg-foreground/10 text-foreground" : "text-muted-foreground/40 hover:text-muted-foreground/60"}`}>
            <m.icon className="h-3 w-3" /> {m.label}
          </button>
        ))}
      </div>

      {/* Confidence Labels Legend */}
      {mode === "confidence" && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/10">
          {CONFIDENCE_LABELS.map(l => (
            <span key={l.label} className={`px-2 py-0.5 rounded text-[8px] border ${l.color}`}>{l.label}</span>
          ))}
        </div>
      )}

      {/* Chat */}
      <ScrollArea className="flex-1">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8 space-y-4">
              {mode === "adversary" && <Swords className="h-8 w-8 text-muted-foreground/20 mx-auto" />}
              {mode === "redteam" && <Shield className="h-8 w-8 text-muted-foreground/20 mx-auto" />}
              {mode === "confidence" && <Eye className="h-8 w-8 text-muted-foreground/20 mx-auto" />}
              <p className="text-[11px] text-muted-foreground/40 font-light max-w-sm mx-auto">
                {mode === "adversary" && "Simulate adversary behavior. Ask what they'd do next and what evidence would confirm or kill each hypothesis."}
                {mode === "redteam" && "Force alternative hypotheses. Challenge every conclusion to reduce confirmation bias."}
                {mode === "confidence" && "Separate raw collection from analysis. Prevent analyst notes from being mistaken as facts."}
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {quickActions[mode].map(qa => (
                  <button key={qa.label} onClick={() => sendMessage(qa.prompt)} className="px-3 py-1.5 rounded-xl text-[10px] border border-border/20 text-muted-foreground/50 hover:text-foreground hover:border-border/40 transition-colors">
                    {qa.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`${msg.role === "user" ? "flex justify-end" : ""}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${msg.role === "user" ? "bg-foreground/[0.08] border border-border/25" : "bg-card/20 border border-border/15"}`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none text-xs font-light">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-xs font-light text-foreground">{msg.content}</p>
                )}
                {msg.role === "assistant" && (
                  <button onClick={() => copyContent(msg.id, msg.content)} className="mt-2 text-[9px] text-muted-foreground/30 hover:text-foreground transition-colors">
                    {copiedId === msg.id ? <Check className="h-3 w-3 inline" /> : <Copy className="h-3 w-3 inline" />}
                  </button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground/40">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-[10px]">Analyzing...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border/20 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder={mode === "adversary" ? "Ask: what would they do next?" : mode === "redteam" ? "Challenge a finding..." : "Audit a specific claim..."}
            className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/30 outline-none rounded-xl border border-border/20 px-4 py-2.5"
          />
          <button onClick={() => sendMessage()} disabled={!input.trim() || loading} className="p-2.5 rounded-xl bg-foreground/[0.1] text-foreground hover:bg-foreground/[0.12] transition-colors disabled:opacity-30">
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NomadAdversaryView;
