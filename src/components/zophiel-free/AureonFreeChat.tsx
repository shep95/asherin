// AureonFreeChat — public Aureon chat on /zophiel.
// Two modes (switchable in-conversation):
//   • Algorithm: live Aureon-LLM Railway engine. Free 10/2hr, Pro 20/hr ($10/mo), Admin unlimited.
//   • BYOK:      user's own provider key. Unlimited, billed against their key.
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Send, Key, Sparkles, Brain, X, ChevronDown, Loader2, Zap,
  Eye, EyeOff, AlertCircle, Trash2, Crown, Cpu, Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AI_PROVIDERS } from "@/components/dashboard/AIKeysSettings";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };
type Mode = "algorithm" | "byok";

const getFingerprint = (): string => {
  try {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    if (ctx) { ctx.textBaseline = "top"; ctx.font = "14px Arial"; ctx.fillText("aureon-fp", 2, 2); }
    const raw = [navigator.userAgent, navigator.language, screen.width + "x" + screen.height, new Date().getTimezoneOffset(), c.toDataURL().slice(-64)].join("|");
    let h = 0;
    for (let i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
    return Math.abs(h).toString(36);
  } catch { return "fp_" + Math.random().toString(36).slice(2); }
};

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/aureon-algorithm-chat`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const AureonFreeChat = () => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [resetAt, setResetAt] = useState<number | null>(null);
  const [tier, setTier] = useState<"free" | "paid" | "admin" | "byok">("free");
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Mode + BYOK state — kept in memory only (BYOK key never persisted).
  const [mode, setMode] = useState<Mode>("algorithm");
  const [showByok, setShowByok] = useState(false);
  const [providerId, setProviderId] = useState<string>("google");
  const [model, setModel] = useState<string>(AI_PROVIDERS[0].models[0].id);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fp = useMemo(() => getFingerprint(), []);
  const provider = AI_PROVIDERS.find((p) => p.id === providerId) || AI_PROVIDERS[0];
  const byokReady = apiKey.trim().length > 8;

  useEffect(() => { if (provider.models[0]) setModel(provider.models[0].id); }, [providerId]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("upgraded") === "1") { toast.success("Welcome to Aureon Algorithm Pro — 20 questions per hour unlocked."); window.history.replaceState({}, "", window.location.pathname); }
    if (q.get("cancelled") === "1") { toast("Upgrade cancelled. You're still on the free tier."); window.history.replaceState({}, "", window.location.pathname); }
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    if (mode === "byok" && !byokReady) {
      setError("Add your API key first, or switch back to Algorithm mode.");
      setShowByok(true);
      return;
    }
    setInput("");
    setError(null);
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        apikey: ANON,
        Authorization: `Bearer ${session?.access_token ?? ANON}`,
      };

      const body: Record<string, unknown> =
        mode === "byok"
          ? { messages: next, byok: { provider: providerId, model, apiKey: apiKey.trim() } }
          : { message: text, fp };

      const resp = await fetch(ENDPOINT, { method: "POST", headers, body: JSON.stringify(body) });
      const data = await resp.json();
      if (typeof data.remaining === "number") setRemaining(data.remaining);
      if (data.resetAt) setResetAt(data.resetAt);
      if (data.tier) setTier(data.tier);

      if (!resp.ok) {
        if (resp.status === 429) {
          setError(data.message || "Limit reached.");
          if (data.upgrade) setShowUpgrade(true);
        } else {
          setError(data.error || `Request failed (${resp.status})`);
        }
        setMessages(next);
        return;
      }

      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Sign in first to subscribe."); window.location.href = "/auth?redirect=/zophiel"; return; }
      const { data, error } = await supabase.functions.invoke("algorithm-checkout");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank"); else throw new Error("No checkout URL returned");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Checkout failed"); }
    finally { setUpgradeLoading(false); }
  };

  const minutesUntilReset = resetAt ? Math.max(0, Math.ceil((resetAt - Date.now()) / 60000)) : 0;
  const isByok = mode === "byok";

  const TierBadge = () => {
    if (isByok) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/20 bg-sky-400/5 px-2 py-0.5 text-[9px] font-light tracking-[0.15em] text-sky-200/80 uppercase">
          <Key className="h-2.5 w-2.5" /> BYOK {byokReady ? "· Active" : "· No Key"}
        </span>
      );
    }
    if (tier === "admin") return <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/5 px-2 py-0.5 text-[9px] font-light tracking-[0.15em] text-amber-200/80 uppercase"><Crown className="h-2.5 w-2.5" /> Admin · Unlimited</span>;
    if (tier === "paid") return <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2 py-0.5 text-[9px] font-light tracking-[0.15em] text-emerald-200/80 uppercase"><Zap className="h-2.5 w-2.5" /> Pro · {remaining ?? 20}/20 /hr</span>;
    return <span className="inline-flex items-center gap-1 rounded-full border border-border/20 bg-card/30 px-2 py-0.5 text-[9px] font-light tracking-[0.15em] text-muted-foreground uppercase">Free · {remaining ?? 10}/10 / 2hr</span>;
  };

  return (
    <div className="flex h-full w-full flex-col bg-transparent text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border/15 bg-card/20 px-4 py-2.5 backdrop-blur-md">
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="h-3.5 w-3.5 text-foreground/60" strokeWidth={1.5} />
          <p className="text-[10px] font-light tracking-[0.3em] text-foreground/80 uppercase truncate">
            Aureon · {isByok ? "BYOK" : "Algorithm"}
          </p>
          <TierBadge />
        </div>
        <div className="flex items-center gap-1.5">
          {/* Mode segmented toggle */}
          <div className="inline-flex rounded-md border border-border/20 bg-card/30 overflow-hidden">
            <button
              onClick={() => setMode("algorithm")}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-light tracking-[0.15em] uppercase transition ${
                mode === "algorithm" ? "bg-foreground/15 text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Use the Aureon Algorithm (rate-limited)"
            >
              <Cpu className="h-3 w-3" /> Algorithm
            </button>
            <button
              onClick={() => { setMode("byok"); if (!byokReady) setShowByok(true); }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-light tracking-[0.15em] uppercase transition ${
                mode === "byok" ? "bg-foreground/15 text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Use your own API key (unlimited)"
            >
              <Key className="h-3 w-3" /> My Key
            </button>
          </div>

          {isByok && (
            <button
              onClick={() => setShowByok((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border border-border/20 bg-card/30 px-2 py-1 text-[10px] font-light tracking-[0.15em] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition uppercase"
            >
              {byokReady ? "Key Set" : "Add Key"}
              <ChevronDown className={`h-3 w-3 transition ${showByok ? "rotate-180" : ""}`} />
            </button>
          )}

          {!isByok && tier !== "admin" && tier !== "paid" && (
            <button
              onClick={handleUpgrade}
              disabled={upgradeLoading}
              className="inline-flex items-center gap-1 rounded-md border border-foreground/30 bg-foreground/10 px-2.5 py-1 text-[10px] font-light tracking-[0.15em] text-foreground hover:bg-foreground/20 transition uppercase disabled:opacity-50"
            >
              {upgradeLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crown className="h-3 w-3" />}
              Upgrade $10/mo
            </button>
          )}

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
      {isByok && showByok && (
        <div className="border-b border-border/15 bg-card/10 px-4 py-3 backdrop-blur-md animate-fade-in">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div>
              <label className="text-[9px] font-light tracking-[0.2em] text-muted-foreground uppercase">Provider</label>
              <select
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                className="mt-1 w-full rounded-md border border-border/20 bg-card/40 px-2 py-1.5 text-xs font-light text-foreground focus:border-foreground/40 focus:outline-none"
              >
                {AI_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-light tracking-[0.2em] text-muted-foreground uppercase">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="mt-1 w-full rounded-md border border-border/20 bg-card/40 px-2 py-1.5 text-xs font-light text-foreground focus:border-foreground/40 focus:outline-none"
              >
                {provider.models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
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
                <button onClick={() => setShowKey((v) => !v)} className="rounded-md border border-border/20 bg-card/40 p-1.5 text-muted-foreground hover:text-foreground">
                  {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
            </div>
          </div>
          <p className="mt-2 text-[10px] font-light text-muted-foreground/60 leading-relaxed">
            <Info className="inline h-3 w-3 mr-1" />
            Your key stays in this browser tab's memory only — never stored, never logged. Closing this tab erases it.
            {" "}<a href={provider.helpUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">Get a {provider.name} key →</a>
          </p>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && !loading && (
          <div className="mx-auto max-w-2xl text-center pt-12 space-y-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/20 bg-card/30 px-3 py-1.5 backdrop-blur-md">
              <Sparkles className="h-3 w-3 text-foreground/60" />
              <span className="text-[10px] font-light tracking-[0.2em] text-foreground/70 uppercase">Aureon Chat</span>
            </div>
            <h2 className="text-2xl font-extralight tracking-wide text-foreground">
              {isByok ? "Your key. Your model. Zero limits." : "The live Aureon reasoning engine."}
            </h2>
            <p className="text-xs font-light text-muted-foreground/70 leading-relaxed max-w-lg mx-auto">
              {isByok
                ? "Bring any provider key — Google, OpenAI, Anthropic, xAI, Mistral, DeepSeek, Perplexity, Meta, Venice. Aureon's elite prompt orchestration wraps your raw model output. Your key, your data, zero footprint."
                : <>Direct access to the Aureon algorithm — no API key required. Free: <strong className="text-foreground/80">10 questions every 2 hours</strong>. Upgrade for <strong className="text-foreground/80">20 questions per hour</strong> at $10/mo, or switch to <strong className="text-foreground/80">My Key</strong> for unlimited.</>}
            </p>
          </div>
        )}

        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm font-light leading-relaxed backdrop-blur-md ${
                m.role === "user" ? "bg-foreground/10 text-foreground border border-foreground/15" : "bg-card/30 text-foreground/90 border border-border/15"
              }`}>
                {m.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none prose-headings:font-light prose-headings:tracking-wide prose-strong:text-foreground prose-code:text-foreground prose-code:bg-foreground/10 prose-code:px-1 prose-code:rounded prose-pre:bg-background/60 prose-pre:border prose-pre:border-border/20">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : <p className="whitespace-pre-wrap">{m.content}</p>}
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
            {resetAt && resetAt > Date.now() && <span className="block text-red-300/60 mt-0.5">Resets in ~{minutesUntilReset} min.</span>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {showUpgrade && (
                <button onClick={handleUpgrade} disabled={upgradeLoading} className="inline-flex items-center gap-1 rounded-md border border-foreground/30 bg-foreground/10 px-2.5 py-1 text-[10px] font-light tracking-[0.15em] text-foreground hover:bg-foreground/20 transition uppercase disabled:opacity-50">
                  {upgradeLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Crown className="h-3 w-3" />} Upgrade to 20/hr — $10/mo
                </button>
              )}
              {!isByok && (
                <button onClick={() => { setMode("byok"); setShowByok(true); setError(null); }} className="inline-flex items-center gap-1 rounded-md border border-border/30 bg-card/40 px-2.5 py-1 text-[10px] font-light tracking-[0.15em] text-foreground hover:bg-foreground/10 transition uppercase">
                  <Key className="h-3 w-3" /> Use My Key Instead
                </button>
              )}
            </div>
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
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (!loading) send(); } }}
            placeholder={isByok ? (byokReady ? `Ask via ${provider.name}…` : "Add your API key above to begin…") : "Ask the Aureon algorithm anything…"}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border/20 bg-card/40 px-4 py-2.5 text-sm font-light text-foreground placeholder:text-muted-foreground/40 focus:border-foreground/40 focus:outline-none max-h-32 disabled:opacity-50"
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim() || (isByok && !byokReady)}
            className="inline-flex items-center justify-center rounded-xl border border-foreground/20 bg-foreground/10 p-2.5 text-foreground hover:bg-foreground/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 text-center text-[9px] font-light tracking-[0.2em] text-muted-foreground/40 uppercase">
          {isByok ? `BYOK · ${provider.name} · unlimited` : tier === "paid" ? "20 / hour · Aureon Pro" : tier === "admin" ? "Unlimited · Admin" : "10 / 2 hours · Free"}
        </p>
      </div>
    </div>
  );
};

export default AureonFreeChat;
