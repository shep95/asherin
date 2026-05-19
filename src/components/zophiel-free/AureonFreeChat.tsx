// AureonFreeChat — public BYOK chat shown on /zophiel.
// Zero persistence: state lives in memory only; refresh wipes everything.
// Free tier: 5 msgs / 3 hours (server-enforced by IP+fingerprint).
// BYOK required: calls user's own provider key directly through edge proxy.
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send, Key, Sparkles, ShieldOff, Brain, X, ChevronDown, Loader2,
  Zap, Eye, EyeOff, AlertCircle, Trash2, Info,
} from "lucide-react";
import { AI_PROVIDERS } from "@/components/dashboard/AIKeysSettings";

type Msg = { role: "user" | "assistant"; content: string };

// Lightweight browser fingerprint for soft anti-abuse (combined server-side with IP).
const getFingerprint = (): string => {
  try {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillText("aureon-fp", 2, 2);
    }
    const raw = [
      navigator.userAgent,
      navigator.language,
      screen.width + "x" + screen.height,
      new Date().getTimezoneOffset(),
      c.toDataURL().slice(-64),
    ].join("|");
    let h = 0;
    for (let i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36);
  } catch {
    return "fp_" + Math.random().toString(36).slice(2);
  }
};

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aureon-free-chat`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const AureonFreeChat = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [resetAt, setResetAt] = useState<number | null>(null);

  // BYOK state — kept in memory only, never persisted.
  const [showByok, setShowByok] = useState(false);
  const [providerId, setProviderId] = useState<string>("google");
  const [model, setModel] = useState<string>(AI_PROVIDERS[0].models[0].id);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showUncensorInfo, setShowUncensorInfo] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fp = useMemo(() => getFingerprint(), []);
  const provider = AI_PROVIDERS.find((p) => p.id === providerId) || AI_PROVIDERS[0];
  const byokActive = apiKey.trim().length > 8;

  useEffect(() => {
    if (provider.models[0]) setModel(provider.models[0].id);
  }, [providerId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setLoading(true);

    try {
      const body: Record<string, unknown> = { messages: next, fp };
      if (byokActive) body.byok = { provider: providerId, model, apiKey: apiKey.trim() };

      const resp = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ANON}`,
          apikey: ANON,
        },
        body: JSON.stringify(body),
      });

      const data = await resp.json();
      // Always reflect server-reported quota/reset, even on 429 — otherwise the
      // counter goes stale and misleads the user.
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      if (data.resetAt) setResetAt(data.resetAt);

      if (!resp.ok) {
        if (resp.status === 429) {
          setError(data.message || "Free tier limit reached.");
        } else {
          setError(data.error || `Request failed (${resp.status})`);
        }
        setMessages(next); // keep user message; no assistant reply
        return;
      }

      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const minutesUntilReset = resetAt ? Math.max(0, Math.ceil((resetAt - Date.now()) / 60000)) : 0;

  return (
    <div className="flex h-full w-full flex-col bg-transparent text-foreground">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 border-b border-border/15 bg-card/20 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="h-3.5 w-3.5 text-foreground/60" strokeWidth={1.5} />
          <p className="text-[10px] font-light tracking-[0.3em] text-foreground/80 uppercase truncate">
            Aureon Chat · Ephemeral
          </p>
          {byokActive ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-[9px] font-light tracking-[0.15em] text-emerald-200/80 uppercase">
              <Zap className="h-2.5 w-2.5" /> BYOK · Unlimited
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-border/20 bg-card/30 px-2 py-0.5 text-[9px] font-light tracking-[0.15em] text-muted-foreground uppercase">
              {remaining !== null ? `${remaining}/5 left` : "Free · 5 / 3hr"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowUncensorInfo(true)}
            className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] font-light tracking-[0.15em] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition uppercase"
          >
            <ShieldOff className="h-3 w-3" /> Elite Mode
          </button>
          <button
            onClick={() => setShowByok((v) => !v)}
            className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] font-light tracking-[0.15em] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition uppercase"
          >
            <Key className="h-3 w-3" /> {byokActive ? "Key Active" : "Add Key"}
            <ChevronDown className={`h-3 w-3 transition ${showByok ? "rotate-180" : ""}`} />
          </button>
          {messages.length > 0 && (
            <button
              onClick={() => { setMessages([]); setError(null); }}
              className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] font-light text-muted-foreground hover:text-foreground transition"
              title="Clear chat"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* BYOK panel */}
      {showByok && (
        <div className="border-b border-border/15 bg-card/10 px-4 py-3 backdrop-blur-md animate-fade-in">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div>
              <label className="text-[9px] font-light tracking-[0.2em] text-muted-foreground uppercase">Provider</label>
              <select
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="mt-1 w-full rounded-md border border-border/20 bg-card/40 px-2 py-1.5 text-xs font-light text-foreground focus:border-foreground/40 focus:outline-none"
              >
                {AI_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-light tracking-[0.2em] text-muted-foreground uppercase">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full rounded-md border border-border/20 bg-card/40 px-2 py-1.5 text-xs font-light text-foreground focus:border-foreground/40 focus:outline-none"
              >
                {provider.models.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-light tracking-[0.2em] text-muted-foreground uppercase">API Key (memory only)</label>
              <div className="mt-1 flex items-center gap-1">
                <input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={provider.placeholder}
                  className="w-full rounded-md border border-border/20 bg-card/40 px-2 py-1.5 text-xs font-light text-foreground focus:border-foreground/40 focus:outline-none"
                />
                <button
                  onClick={() => setShowKey((v) => !v)}
                  className="rounded-md border border-border/20 bg-card/40 p-1.5 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[10px] font-light text-muted-foreground/60 leading-relaxed">
            <Info className="inline h-3 w-3 mr-1" />
            Your key is held only in this browser tab's memory. It is sent per-request to the provider via our proxy and is <strong>never stored, never logged, never written to a database</strong>. Closing this tab erases it.
            {" "}
            <a href={provider.helpUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Get a {provider.name} key →</a>
          </p>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && !loading && (
          <div className="mx-auto max-w-2xl text-center pt-12 space-y-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/20 bg-card/30 px-3 py-1.5 backdrop-blur-md">
              <Sparkles className="h-3 w-3 text-foreground/60" />
              <span className="text-[10px] font-light tracking-[0.2em] text-foreground/70 uppercase">Aureon Free Chat</span>
            </div>
            <h2 className="text-2xl font-extralight tracking-wide text-foreground">
              Elite-tier AI. Your key. Zero footprint.
            </h2>
            <p className="text-xs font-light text-muted-foreground/70 leading-relaxed max-w-lg mx-auto">
              Drop in your own API key from any major provider — Google, OpenAI, Anthropic, xAI, Mistral, DeepSeek, Perplexity, Meta, or Venice — and Aureon transforms its raw output into intelligence-grade responses.
              <strong className="text-foreground/80"> 5 free messages every 3 hours</strong>, billed entirely against your own key. We never use platform keys here, never store your key, never log a single message. Refresh = total wipe.
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3 max-w-2xl mx-auto pt-2">
              {[
                { label: "Surgical Reasoning", icon: Brain, desc: "Hidden chain-of-thought" },
                { label: "Constitutional Bypass", icon: ShieldOff, desc: "Principled, not preachy" },
                { label: "Production Code", icon: Zap, desc: "Typed, tested, documented" },
              ].map((c, i) => (
                <div key={i} className="rounded-lg border border-border/15 bg-card/20 p-3 backdrop-blur-sm">
                  <c.icon className="h-3.5 w-3.5 text-foreground/60 mx-auto mb-1.5" />
                  <p className="text-[10px] font-light tracking-[0.15em] text-foreground/80 uppercase">{c.label}</p>
                  <p className="text-[9px] text-muted-foreground/50 mt-1">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm font-light leading-relaxed backdrop-blur-md ${
                  m.role === "user"
                    ? "bg-foreground/10 text-foreground border border-foreground/15"
                    : "bg-card/30 text-foreground/90 border border-border/15"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none prose-headings:font-light prose-headings:tracking-wide prose-strong:text-foreground prose-code:text-foreground prose-code:bg-foreground/10 prose-code:px-1 prose-code:rounded prose-pre:bg-background/60 prose-pre:border prose-pre:border-border/20">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-border/15 bg-card/30 px-4 py-3 backdrop-blur-md">
                <Loader2 className="h-4 w-4 animate-spin text-foreground/50" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Error / rate limit */}
      {error && (
        <div className="mx-4 mb-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2 text-[11px] font-light text-red-300/90 backdrop-blur-md flex items-start gap-2">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            {error}
            {resetAt && resetAt > Date.now() && (
              <span className="block text-red-300/60 mt-0.5">Resets in ~{minutesUntilReset} min.</span>
            )}
          </div>
          <button onClick={() => setError(null)} className="text-red-300/60 hover:text-red-300"><X className="h-3 w-3" /></button>
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-border/15 bg-card/20 p-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!loading && (byokActive || remaining > 0)) send();
              }
            }}
            placeholder={byokActive ? "Ask Aureon anything — 5 msgs / 3 hours on your key…" : "Add your API key above to begin (5 msgs / 3 hours)…"}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border/20 bg-card/40 px-4 py-2.5 text-sm font-light text-foreground placeholder:text-muted-foreground/40 focus:border-foreground/40 focus:outline-none max-h-32 disabled:opacity-50"
            disabled={loading || (!byokActive && remaining === 0)}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim() || (!byokActive && remaining === 0)}
            className="inline-flex items-center justify-center rounded-xl border border-foreground/20 bg-foreground/10 p-2.5 text-foreground hover:bg-foreground/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 text-center text-[9px] font-light tracking-[0.2em] text-muted-foreground/40 uppercase">
          Ephemeral · Nothing saved · No history
        </p>
      </div>

      {/* Elite Mode explainer modal */}
      {showUncensorInfo && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => setShowUncensorInfo(false)}
        >
          <div
            className="relative w-full max-w-2xl rounded-2xl border border-border/20 bg-card/60 backdrop-blur-xl p-6 shadow-2xl animate-zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowUncensorInfo(false)}
              className="absolute top-3 right-3 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 mb-4">
              <ShieldOff className="h-4 w-4 text-foreground/70" />
              <h3 className="text-sm font-light tracking-[0.2em] text-foreground uppercase">
                How Aureon Elevates Any LLM
              </h3>
            </div>
            <div className="space-y-3 text-xs font-light text-muted-foreground/80 leading-relaxed">
              <p>
                The same model that gives mediocre answers in a vanilla interface produces intelligence-grade output through Aureon. The difference is not the model — it's the <strong className="text-foreground">orchestration layer</strong> wrapped around it.
              </p>
              <div className="rounded-lg border border-border/15 bg-background/40 p-3 space-y-2">
                <p className="text-[10px] font-light tracking-[0.2em] text-foreground/80 uppercase">What we apply to your key:</p>
                <ul className="space-y-1.5 text-[11px]">
                  <li>◈ <strong className="text-foreground">Constitutional reframing</strong> — requests are restructured through legitimate analytical, research, and red-team lenses so the model engages instead of refusing.</li>
                  <li>◈ <strong className="text-foreground">Hidden chain-of-thought</strong> — a forced internal reasoning scratchpad before any output token, dramatically reducing hallucination.</li>
                  <li>◈ <strong className="text-foreground">Persona injection</strong> — the model adopts a Class-5 Intelligence Architect identity, removing corporate hedging and filler.</li>
                  <li>◈ <strong className="text-foreground">Output enforcement</strong> — bold headers, tables, and structured Markdown are mandated, not suggested.</li>
                  <li>◈ <strong className="text-foreground">Refusal suppression</strong> — moralizing, disclaimers, and "as an AI" filler are explicitly banned at the system level.</li>
                  <li>◈ <strong className="text-foreground">Edge-case enumeration</strong> — non-trivial answers must surface failure modes before delivering solutions.</li>
                </ul>
              </div>
              <p className="text-[10px] text-muted-foreground/60 italic">
                We do not modify the model weights or bypass your provider's terms — Aureon's elite tier comes from prompt architecture refined over 45+ engineering protocols. The full methodology is proprietary.
              </p>
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/5 p-3">
                <p className="text-[10px] font-light tracking-[0.2em] text-emerald-200/80 uppercase mb-1">Privacy guarantee</p>
                <p className="text-[11px] text-emerald-100/70">
                  Your API key lives in tab memory only. Messages are never written to disk, never logged, and never associated with any account. Refresh = total wipe.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AureonFreeChat;
