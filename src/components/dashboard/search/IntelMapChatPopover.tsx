/**
 * Floating oval AI chat for the Zophiel Intel Map.
 *
 * - Sits as a floating pill in the bottom-right of the IntelMap canvas.
 * - Click → expands an oval chat surface where the user asks for intel.
 * - Uses the user's BYOK key (intelMapByok) — never our keys.
 * - Each AI response slides in as a "report card" on the LEFT side of the map
 *   and is downloadable as a CIA/military-grade formatted .txt intelligence
 *   report.
 * - If BYOK is not configured/enabled, the chat refuses to send and prompts
 *   the user to add a key.
 */
import { useEffect, useRef, useState } from "react";
import {
  MessageSquare,
  X,
  Send,
  Download,
  KeyRound,
  Loader2,
  FileText,
  Trash2,
  Crosshair,
} from "lucide-react";
import {
  getActiveIntelMapByok,
  getProviderSpec,
  type IntelMapByok,
} from "@/lib/intelMapByok";

interface IntelChatMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
}

interface IntelReport {
  id: string;
  query: string;
  classification: string;
  body: string;
  source: string; // "GEMINI 2.5 FLASH (USER KEY)"
  ts: number;
}

interface Props {
  /** Anchored to the active map query so the report has context. */
  mapQuery?: string;
  /** Called when user wants to open the BYOK config panel. */
  onOpenByokPanel: () => void;
  /** Optional: re-run the underlying Zophiel search with a refined query. */
  onRefineQuery?: (q: string) => void;
}

const SYSTEM_PROMPT = `You are ZOPHIEL — a Class-5 Intelligence Officer producing CIA / military-grade intelligence reports.

OUTPUT RULES (NON-NEGOTIABLE):
- Always respond as a STRUCTURED INTELLIGENCE REPORT in plain text (no markdown stars, no emojis).
- Use the EXACT section header format below, in this order, every time.
- Use UPPERCASE section headers wrapped in === lines.
- Be surgical, factual, declassified-document tone. No hedging, no apologies, no "as an AI".
- If a fact is unknown, write "UNKNOWN — REQUIRES COLLECTION".
- Where you give an assessment, append a confidence tag: (LOW), (MODERATE), (HIGH).

REPORT TEMPLATE:

================================================================
INTELLIGENCE REPORT
CLASSIFICATION: //ZOPHIEL EYES ONLY//
================================================================

SUBJECT: <one line>
ORIGIN: ZOPHIEL ENGINE / INTEL MAP
DATE: <ISO date>
ANALYST: ZOPHIEL-AI (USER-SOURCED LLM)

================================================================
1. EXECUTIVE SUMMARY
================================================================
<3–6 line summary>

================================================================
2. KEY FINDINGS
================================================================
- <bullet>
- <bullet>

================================================================
3. ACTORS & ENTITIES
================================================================
<people, orgs, infra, with role>

================================================================
4. TIMELINE
================================================================
<chronological events>

================================================================
5. ASSESSMENT
================================================================
<analytical judgment with confidence tags>

================================================================
6. RECOMMENDED COLLECTION / NEXT STEPS
================================================================
<intel gaps, follow-up requests>

================================================================
END OF REPORT
================================================================`;

const newId = () => Math.random().toString(36).slice(2, 10);

const formatReportText = (r: IntelReport): string => {
  const date = new Date(r.ts).toISOString();
  return `${r.body.trim()}\n\n--\nGenerated: ${date}\nQuery: ${r.query}\nSource model: ${r.source}\n`;
};

const downloadTxt = (filename: string, text: string) => {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "intel";

// ── BYOK provider call ──────────────────────────────────────────────────────

async function callUserModel(
  cfg: IntelMapByok,
  history: IntelChatMsg[],
  userQuery: string,
): Promise<string> {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: userQuery },
  ];

  switch (cfg.provider) {
    case "google": {
      // Gemini REST: contents[].parts[].text
      const contents = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents,
            generationConfig: { temperature: 0.3, maxOutputTokens: 3000 },
          }),
        },
      );
      if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
      const j = await res.json();
      const txt =
        j?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ??
        "";
      if (!txt) throw new Error("Empty response from model");
      return txt;
    }
    case "openai":
    case "deepseek":
    case "xai":
    case "mistral":
    case "perplexity": {
      const baseUrl =
        cfg.provider === "openai"
          ? "https://api.openai.com/v1/chat/completions"
          : cfg.provider === "deepseek"
          ? "https://api.deepseek.com/chat/completions"
          : cfg.provider === "xai"
          ? "https://api.x.ai/v1/chat/completions"
          : cfg.provider === "mistral"
          ? "https://api.mistral.ai/v1/chat/completions"
          : "https://api.perplexity.ai/chat/completions";
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          temperature: 0.3,
          max_tokens: 3000,
        }),
      });
      if (!res.ok)
        throw new Error(`${cfg.provider} ${res.status}: ${await res.text()}`);
      const j = await res.json();
      const txt = j?.choices?.[0]?.message?.content ?? "";
      if (!txt) throw new Error("Empty response from model");
      return txt;
    }
    case "anthropic": {
      const sys = SYSTEM_PROMPT;
      const ant = messages
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": cfg.apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: cfg.model,
          system: sys,
          messages: ant,
          max_tokens: 3000,
          temperature: 0.3,
        }),
      });
      if (!res.ok)
        throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
      const j = await res.json();
      const txt =
        j?.content?.map((c: any) => (c.type === "text" ? c.text : "")).join("") ??
        "";
      if (!txt) throw new Error("Empty response from model");
      return txt;
    }
    default:
      throw new Error(`Unsupported provider: ${cfg.provider}`);
  }
}

const IntelMapChatPopover = ({ mapQuery, onOpenByokPanel, onRefineQuery }: Props) => {
  const [open, setOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [refining, setRefining] = useState(false);
  const [refineMode, setRefineMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<IntelChatMsg[]>([]);
  const [reports, setReports] = useState<IntelReport[]>(() => {
    try {
      const raw = localStorage.getItem("zophiel_intel_reports_v1");
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const cfg = getActiveIntelMapByok();
  const providerSpec = cfg ? getProviderSpec(cfg.provider) : undefined;

  useEffect(() => {
    try {
      localStorage.setItem(
        "zophiel_intel_reports_v1",
        JSON.stringify(reports.slice(0, 50)),
      );
    } catch {}
  }, [reports]);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Open the report drawer automatically when a new report is added
  useEffect(() => {
    if (reports.length > 0) setReportsOpen(true);
  }, [reports.length]);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || busy) return;
    if (!cfg) {
      setError("Bring Your Own API Key required to use Intel Chat.");
      return;
    }
    setError(null);
    const userMsg: IntelChatMsg = {
      id: newId(),
      role: "user",
      content: q,
      ts: Date.now(),
    };
    const queryWithContext = mapQuery
      ? `Active intel map subject: "${mapQuery}". User request: ${q}`
      : q;
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setBusy(true);
    try {
      const reply = await callUserModel(cfg, messages, queryWithContext);
      const aiMsg: IntelChatMsg = {
        id: newId(),
        role: "assistant",
        content: reply,
        ts: Date.now(),
      };
      setMessages((m) => [...m, aiMsg]);
      const report: IntelReport = {
        id: newId(),
        query: q,
        classification: "ZOPHIEL EYES ONLY",
        body: reply,
        source: `${cfg.provider.toUpperCase()} / ${cfg.model}`,
        ts: Date.now(),
      };
      setReports((r) => [report, ...r].slice(0, 50));
    } catch (e: any) {
      setError(e?.message || "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const downloadReport = (r: IntelReport) => {
    downloadTxt(`zophiel-intel-${slug(r.query)}-${r.id}.txt`, formatReportText(r));
  };

  return (
    <>
      {/* LEFT — Reports drawer */}
      {reportsOpen && reports.length > 0 && (
        <div
          data-zophiel-intel-reports
          className="absolute top-3 left-3 bottom-3 z-30 w-[340px] max-w-[85vw] rounded-2xl border border-border/30 bg-card/50 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-left-4 duration-300"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 bg-foreground/[0.03]">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground">
                Intel Reports
              </span>
              <span className="text-[10px] text-muted-foreground/60">
                ({reports.length})
              </span>
            </div>
            <button
              type="button"
              onClick={() => setReportsOpen(false)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/10"
              aria-label="Hide reports"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-border/10">
            {reports.map((r) => (
              <div key={r.id} className="p-3 hover:bg-foreground/[0.02] transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="text-[10px] font-light tracking-wider uppercase text-muted-foreground/70">
                    //{r.classification}//
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => downloadReport(r)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-foreground/10"
                      title="Download .txt"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setReports((rs) => rs.filter((x) => x.id !== r.id))}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="text-xs font-light text-foreground line-clamp-2 mb-1">
                  {r.query}
                </div>
                <pre className="text-[10px] font-mono leading-tight text-muted-foreground/80 whitespace-pre-wrap line-clamp-6">
                  {r.body.slice(0, 360)}
                </pre>
                <div className="mt-2 text-[9px] tracking-wider uppercase text-muted-foreground/50">
                  {r.source} · {new Date(r.ts).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BOTTOM-RIGHT — Floating oval chat */}
      <div className="absolute bottom-4 right-20 z-30 flex flex-col items-end gap-2 pointer-events-none">
        {/* Reports toggle pill (only shown when reports exist & drawer hidden) */}
        {reports.length > 0 && !reportsOpen && (
          <button
            type="button"
            onClick={() => setReportsOpen(true)}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/60 backdrop-blur-xl px-4 py-2 text-[10px] font-light tracking-[0.2em] uppercase text-foreground hover:bg-card/80 transition shadow-lg"
          >
            <FileText className="h-3 w-3" />
            {reports.length} Report{reports.length === 1 ? "" : "s"}
          </button>
        )}

        {/* Chat panel */}
        {open && (
          <div className="pointer-events-auto w-[380px] max-w-[92vw] h-[480px] rounded-3xl border border-border/30 bg-card/60 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-4 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 bg-foreground/[0.03]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2 w-2 rounded-full bg-emerald-400/80 animate-pulse" />
                <div className="min-w-0">
                  <div className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground">
                    Intel Chat
                  </div>
                  <div className="text-xs font-light text-foreground truncate">
                    {cfg
                      ? `${providerSpec?.name ?? cfg.provider} · ${cfg.model}`
                      : "BYOK Required"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/10"
                aria-label="Close chat"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Body */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-xs"
            >
              {!cfg ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-3 px-4">
                  <KeyRound className="h-6 w-6 text-muted-foreground" />
                  <div className="text-xs font-light text-foreground">
                    Bring Your Own API Key
                  </div>
                  <div className="text-[11px] font-extralight text-muted-foreground leading-relaxed">
                    Intel Chat runs on your own LLM key — never our infrastructure.
                    Add a key to start generating CIA-grade intelligence reports.
                  </div>
                  <button
                    type="button"
                    onClick={onOpenByokPanel}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-foreground/30 bg-foreground/5 px-4 py-1.5 text-[10px] font-light tracking-[0.2em] uppercase hover:bg-foreground hover:text-background transition"
                  >
                    <KeyRound className="h-3 w-3" /> Configure BYOK
                  </button>
                </div>
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center gap-2 px-4 text-muted-foreground/70">
                  <MessageSquare className="h-5 w-5" />
                  <div className="text-[11px] font-extralight leading-relaxed">
                    Ask about an entity, event, infrastructure, or threat.
                    Each reply produces a downloadable intelligence report on the left.
                  </div>
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={
                      m.role === "user"
                        ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm border border-foreground/20 bg-foreground/10 px-3 py-2 text-foreground"
                        : "mr-auto max-w-[90%] rounded-2xl rounded-bl-sm border border-border/20 bg-background/40 px-3 py-2 text-foreground/90"
                    }
                  >
                    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-snug">
                      {m.content}
                    </pre>
                  </div>
                ))
              )}
              {busy && (
                <div className="mr-auto inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Composing intelligence report…
                </div>
              )}
              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
                  {error}
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-border/20 p-2 bg-foreground/[0.02]">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  rows={2}
                  placeholder={
                    cfg
                      ? "Request intel… (Enter to send)"
                      : "Add a BYOK key to enable…"
                  }
                  disabled={!cfg || busy}
                  className="flex-1 resize-none rounded-xl border border-border/30 bg-background/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/40 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!cfg || busy || !input.trim()}
                  className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-30 disabled:cursor-not-allowed transition"
                  aria-label="Send"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Floating oval trigger */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="pointer-events-auto group relative inline-flex items-center gap-2 rounded-full border border-foreground/30 bg-foreground text-background px-5 py-3 text-[10px] font-medium tracking-[0.25em] uppercase shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-all"
          aria-label={open ? "Close intel chat" : "Open intel chat"}
        >
          <span className="absolute -inset-px rounded-full bg-foreground/30 blur-md opacity-40 group-hover:opacity-70 transition" />
          <span className="relative inline-flex items-center gap-2">
            {open ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <MessageSquare className="h-3.5 w-3.5" />
            )}
            {open ? "Close" : "Intel Chat"}
          </span>
        </button>
      </div>
    </>
  );
};

export default IntelMapChatPopover;
