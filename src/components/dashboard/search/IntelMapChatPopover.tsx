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
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  getActiveIntelMapByok,
  getProviderSpec,
  type IntelMapByok,
} from "@/lib/intelMapByok";
import { loadActiveBrains, type AsherBrainCategory } from "@/lib/asherBrains";

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
  extraSystem?: string,
): Promise<string> {
  const fullSystem = extraSystem
    ? `${SYSTEM_PROMPT}\n\n=== ASHERIN BRAIN CONTEXT (curated knowledge) ===\n${extraSystem}\n=== END BRAIN CONTEXT ===`
    : SYSTEM_PROMPT;
  const messages = [
    { role: "system", content: fullSystem },
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
            systemInstruction: { parts: [{ text: fullSystem }] },
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
      const sys = fullSystem;
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

// ── Asherin Brain selector ───────────────────────────────────────────────────
// Pulls active brains from the asher_brains table (admin/operator-curated)
// and picks the most relevant ones for the current query using keyword overlap.
type LoadedBrain = { name: string; category: string; content: string };
let _brainCache: { ts: number; brains: LoadedBrain[] } | null = null;
const BRAIN_CACHE_MS = 60_000;

async function getCachedBrains(): Promise<LoadedBrain[]> {
  const now = Date.now();
  if (_brainCache && now - _brainCache.ts < BRAIN_CACHE_MS) return _brainCache.brains;
  // Pull only intel-relevant categories first, fall back to all
  const cats: AsherBrainCategory[] = ["map", "general", "personality", "azplen"];
  const brains = (await loadActiveBrains(cats)) as LoadedBrain[];
  _brainCache = { ts: now, brains };
  return brains;
}

function pickRelevantBrains(brains: LoadedBrain[], query: string, maxBrains = 4, maxCharsEach = 4000): LoadedBrain[] {
  if (!brains.length) return [];
  const q = (query || "").toLowerCase();
  const tokens = Array.from(new Set(q.split(/[^a-z0-9]+/).filter((t) => t.length >= 4))).slice(0, 24);
  if (!tokens.length) return brains.slice(0, maxBrains).map((b) => ({ ...b, content: b.content.slice(0, maxCharsEach) }));
  const scored = brains.map((b) => {
    const hay = `${b.name}\n${b.content}`.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      const matches = hay.split(t).length - 1;
      score += matches;
    }
    // Category boosts
    if (b.category === "map") score += 3;
    if (b.category === "personality") score += 1;
    return { brain: b, score };
  });
  scored.sort((a, b) => b.score - a.score);
  // If nothing matched, still include a small default set
  const top = scored.filter((s) => s.score > 0).slice(0, maxBrains);
  const final = (top.length ? top : scored.slice(0, maxBrains)).map((s) => s.brain);
  return final.map((b) => ({ ...b, content: b.content.slice(0, maxCharsEach) }));
}

function formatBrainsForPrompt(brains: LoadedBrain[]): string {
  if (!brains.length) return "";
  return brains
    .map((b, i) => `[BRAIN ${i + 1}] (${b.category}) ${b.name}\n---\n${b.content}\n---`)
    .join("\n\n");
}

const IntelMapChatPopover = ({ mapQuery, onOpenByokPanel, onRefineQuery }: Props) => {
  const [open, setOpen] = useState(true);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [refining, setRefining] = useState(false);
  const [refineMode, setRefineMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<IntelChatMsg[]>([]);
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [interviewActive, setInterviewActive] = useState(false);
  const [dossier, setDossier] = useState<string[]>([]);
  const [reports, setReports] = useState<IntelReport[]>(() => {
    try {
      const raw = localStorage.getItem("zophiel_intel_reports_v1");
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  // Draggable + resizable popout state. Position is viewport-fixed.
  const POPOUT_KEY = "zophiel_intel_chat_popout_v1";
  const [pos, setPos] = useState<{ x: number; y: number; w: number; h: number }>(() => {
    try {
      const raw = localStorage.getItem(POPOUT_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (typeof p?.x === "number") return p;
      }
    } catch {}
    const w = 420, h = 560;
    return {
      x: Math.max(16, (typeof window !== "undefined" ? window.innerWidth : 1280) - w - 24),
      y: 80,
      w,
      h,
    };
  });
  useEffect(() => {
    try { localStorage.setItem(POPOUT_KEY, JSON.stringify(pos)); } catch {}
  }, [pos]);

  const dragRef = useRef<{ mode: "drag" | "resize"; startX: number; startY: number; orig: typeof pos } | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (d.mode === "drag") {
        const maxX = window.innerWidth - 80;
        const maxY = window.innerHeight - 60;
        setPos({
          ...d.orig,
          x: Math.min(maxX, Math.max(-d.orig.w + 80, d.orig.x + dx)),
          y: Math.min(maxY, Math.max(0, d.orig.y + dy)),
        });
      } else {
        setPos({
          ...d.orig,
          w: Math.max(280, Math.min(window.innerWidth - d.orig.x - 8, d.orig.w + dx)),
          h: Math.max(320, Math.min(window.innerHeight - d.orig.y - 8, d.orig.h + dy)),
        });
      }
    };
    const onUp = () => { dragRef.current = null; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    document.body.style.userSelect = "none";
    dragRef.current = { mode: "drag", startX: e.clientX, startY: e.clientY, orig: pos };
  };
  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    document.body.style.userSelect = "none";
    dragRef.current = { mode: "resize", startX: e.clientX, startY: e.clientY, orig: pos };
  };

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

  // Ask the AI to generate the next single clarifying question, given the
  // current map subject and the dossier of answers gathered so far.
  const askNextQuestion = async (currentDossier: string[]) => {
    if (!cfg) return;
    setBusy(true);
    setError(null);
    try {
      const intake = currentDossier.length
        ? currentDossier.map((d, i) => `${i + 1}. ${d}`).join("\n")
        : "(none yet)";
      const prompt = `You are a Zophiel Intelligence Officer running a SUBJECT INTAKE INTERVIEW to disambiguate the target on the Intel Map.

CURRENT MAP SUBJECT: "${mapQuery ?? "(none)"}"
ANSWERS GATHERED SO FAR:
${intake}

TASK:
Ask ONE single, surgical clarifying question that will most reduce ambiguity about the subject (e.g. full name spelling, employer, city/region, role/title, age range, known aliases, social handles, email/phone fragment, domain, organization affiliation, time period, etc.).

OUTPUT RULES:
- Output ONLY the question. No preamble. No numbering. No quotes. No markdown.
- One sentence, under 160 characters.
- End with a question mark.
- Always finish with: " — if you don't know, just type 'idk'."`;
      const brains = pickRelevantBrains(await getCachedBrains(), `${mapQuery ?? ""} ${currentDossier.join(" ")}`, 3, 2000);
      const brainCtx = formatBrainsForPrompt(brains);
      const reply = (await callUserModel(cfg, [], prompt, brainCtx)).trim();
      const question = reply.split("\n")[0].slice(0, 240);
      setMessages((m) => [
        ...m,
        { id: newId(), role: "assistant", content: question, ts: Date.now() },
      ]);
    } catch (e: any) {
      setError(e?.message || "Failed to fetch next question");
    } finally {
      setBusy(false);
    }
  };

  // When the user adds a BYOK key, automatically open the interview the first
  // time and seed it with the opening question.
  useEffect(() => {
    if (!cfg || interviewStarted) return;
    setInterviewStarted(true);
    setInterviewActive(true);
    setMessages([
      {
        id: newId(),
        role: "assistant",
        content: `INTAKE INTERVIEW INITIATED — Subject: "${mapQuery ?? "(unspecified)"}"\n\nI'll ask you one question at a time to sharpen the Intel Map. If you don't know an answer, just type 'idk' or 'i don't know' and I'll move on.`,
        ts: Date.now(),
      },
    ]);
    askNextQuestion([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg]);

  // Detect "idk" / "i don't know" style answers.
  const isUnknown = (s: string) => /^(idk|i\s*do\s*n['’]?t\s*know|dunno|no\s*idea|unknown|unsure)\b/i.test(s.trim());

  // Get the most recent assistant question so we can record the Q→A pair in the dossier.
  const lastAssistantQuestion = (): string => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].content;
    }
    return "(initial)";
  };

  const handleSend = async () => {
    const q = input.trim();
    if (!q || busy) return;
    if (!cfg) {
      setError("Bring Your Own API Key required to use Intel Chat.");
      return;
    }
    setError(null);

    // ── Interview mode: treat the input as an answer to the last question.
    if (interviewActive) {
      const userMsg: IntelChatMsg = {
        id: newId(),
        role: "user",
        content: q,
        ts: Date.now(),
      };
      setMessages((m) => [...m, userMsg]);
      setInput("");

      const question = lastAssistantQuestion();
      const unknown = isUnknown(q);
      const dossierEntry = `Q: ${question.replace(/\s+—\s+if you don't know.*$/i, "").trim()}\nA: ${unknown ? "UNKNOWN" : q}`;
      const nextDossier = unknown ? dossier : [...dossier, dossierEntry];
      setDossier(nextDossier);

      // Refine the underlying Zophiel search whenever we gain a new fact.
      if (!unknown && onRefineQuery && nextDossier.length > 0) {
        try {
          setRefining(true);
          const refinePrompt = `You are a query refinement engine for an OSINT intelligence map.

CURRENT MAP SUBJECT: "${mapQuery ?? "(none)"}"
DOSSIER (Q&A gathered):
${nextDossier.join("\n\n")}

TASK:
Fuse the subject with all known dossier facts into ONE sharpened search query that returns the correct entity. Include disambiguating tokens (employer, city, role, alias, domain, handle).

OUTPUT RULES:
- Return ONLY the refined query string. No quotes, no prefix, no explanation.
- Maximum 200 characters.
- Plain text, no markdown.`;
          const refined = (await callUserModel(cfg, [], refinePrompt))
            .trim()
            .replace(/^["'`]+|["'`]+$/g, "")
            .split("\n")[0]
            .slice(0, 200);
          if (refined) onRefineQuery(refined);
        } catch (e) {
          // refinement failures are non-fatal — keep interviewing
        } finally {
          setRefining(false);
        }
      }

      // Ask the next clarifying question.
      await askNextQuestion(nextDossier);
      return;
    }

    // ── Free-form intel report mode (interview ended / no BYOK auto-start).
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
      const brains = pickRelevantBrains(await getCachedBrains(), `${mapQuery ?? ""} ${q}`, 4, 4000);
      const brainCtx = formatBrainsForPrompt(brains);
      const reply = await callUserModel(cfg, messages, queryWithContext, brainCtx);
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

  /**
   * Ask the AI to fuse the current map subject + user-provided details into
   * a sharper, OSINT-optimized search query, then re-run the underlying
   * Zophiel search to refresh the Intel Map with more accurate data.
   */
  const handleRefine = async () => {
    const details = input.trim();
    if (!details || refining || busy) return;
    if (!cfg) {
      setError("Bring Your Own API Key required to refine the Intel Map.");
      return;
    }
    if (!onRefineQuery) {
      setError("Refinement is unavailable in this view.");
      return;
    }
    setError(null);
    setRefining(true);
    try {
      const refinePrompt = `You are a query refinement engine for an OSINT intelligence map.

CURRENT MAP SUBJECT: "${mapQuery ?? "(none)"}"
USER-PROVIDED DETAILS / CLARIFIERS:
${details}

TASK:
Fuse the subject with the user's details into ONE sharpened search query that will return the correct entity (disambiguated person / org / asset). Include disambiguating tokens (employer, city, role, alias, domain, handle, etc.) when given.

OUTPUT RULES:
- Return ONLY the refined query string. No quotes, no prefix, no explanation.
- Maximum 200 characters.
- Plain text, no markdown.`;
      const refined = (await callUserModel(cfg, [], refinePrompt))
        .trim()
        .replace(/^["'`]+|["'`]+$/g, "")
        .split("\n")[0]
        .slice(0, 200);
      if (!refined) throw new Error("Refinement returned empty query");
      const note: IntelChatMsg = {
        id: newId(),
        role: "assistant",
        content: `MAP REFINED → "${refined}"\nRe-running Zophiel search with sharpened query.`,
        ts: Date.now(),
      };
      setMessages((m) => [...m, {
        id: newId(),
        role: "user",
        content: `[REFINE] ${details}`,
        ts: Date.now(),
      }, note]);
      setInput("");
      onRefineQuery(refined);
    } catch (e: any) {
      setError(e?.message || "Refinement failed");
    } finally {
      setRefining(false);
    }
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

      {/* Floating popout — drag the header to move, drag bottom-right corner to resize. */}
      <div
        style={{ position: "fixed", left: pos.x, top: pos.y, width: pos.w, height: pos.h, zIndex: 60 }}
        className="pointer-events-auto"
      >
        <div className="h-full w-full flex flex-col overflow-hidden border border-border/30 bg-card/70 backdrop-blur-2xl shadow-2xl rounded-2xl ring-1 ring-foreground/10 relative">
          {/* Header — draggable */}
          <div
            onMouseDown={startDrag}
            className="flex items-center justify-between px-4 py-3 border-b border-border/20 bg-foreground/[0.04] cursor-move select-none"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className={`h-2 w-2 rounded-full ${cfg ? "bg-emerald-400/80 animate-pulse" : "bg-muted-foreground/40"}`} />
              <div className="min-w-0">
                <div className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground">
                  Intel Chat · Drag
                </div>
                <div className="text-xs font-light text-foreground truncate">
                  {cfg
                    ? `${providerSpec?.name ?? cfg.provider} · ${cfg.model}`
                    : "BYOK Required"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
              {reports.length > 0 && (
                <button
                  type="button"
                  onClick={() => setReportsOpen((o) => !o)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition"
                  title="Toggle reports drawer"
                >
                  <FileText className="h-3 w-3" />
                  {reports.length}
                </button>
              )}
              {interviewActive && (
                <button
                  type="button"
                  onClick={() => setInterviewActive(false)}
                  className="px-2 py-1 rounded-md text-[9px] tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition"
                  title="End interview and switch to free-form intel"
                >
                  End Q&A
                </button>
              )}
            </div>
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
                  Once a key is connected, the AI will start asking you
                  questions to sharpen the Intel Map.
                </div>
                <button
                  type="button"
                  onClick={onOpenByokPanel}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-foreground/30 bg-foreground/5 px-4 py-1.5 text-[10px] font-light tracking-[0.2em] uppercase hover:bg-foreground hover:text-background transition"
                >
                  <KeyRound className="h-3 w-3" /> Configure BYOK
                </button>
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
            {(busy || refining) && (
              <div className="mr-auto inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {refining ? "Refining map…" : interviewActive ? "Thinking of next question…" : "Composing intelligence report…"}
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
            {interviewActive && (
              <div className="mb-2 px-1 flex items-center justify-between">
                <span className="text-[9px] font-light tracking-[0.2em] uppercase text-muted-foreground">
                  Intake Interview · {dossier.length} fact{dossier.length === 1 ? "" : "s"}
                </span>
                <button
                  type="button"
                  onClick={() => { setInput("idk"); setTimeout(handleSend, 0); }}
                  disabled={!cfg || busy || refining}
                  className="text-[9px] font-light tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground transition disabled:opacity-40"
                  title="Skip this question"
                >
                  Skip · idk
                </button>
              </div>
            )}
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
                  !cfg
                    ? "Add a BYOK key to enable…"
                    : interviewActive
                    ? "Type your answer — or 'idk' if you don't know"
                    : "Request intel… (Enter to send)"
                }
                disabled={!cfg || busy || refining}
                className="flex-1 resize-none rounded-xl border border-border/30 bg-background/60 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/40 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={!cfg || busy || refining || !input.trim()}
                className="h-9 w-9 inline-flex items-center justify-center rounded-full bg-foreground text-background hover:bg-foreground/90 disabled:opacity-30 disabled:cursor-not-allowed transition"
                aria-label="Send"
              >
                {busy || refining ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Resize handle */}
          <div
            onMouseDown={startResize}
            className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
            title="Drag to resize"
            style={{
              background:
                "linear-gradient(135deg, transparent 0 50%, hsl(var(--foreground) / 0.35) 50% 60%, transparent 60% 70%, hsl(var(--foreground) / 0.35) 70% 80%, transparent 80%)",
            }}
          />
        </div>
      </div>
    </>
  );
};

export default IntelMapChatPopover;
