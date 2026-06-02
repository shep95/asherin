import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Brain,
  KeyRound,
  Sparkles,
  Target,
  Shield,
  AlertOctagon,
  ArrowUpRight,
  Loader2,
  CheckCircle2,
  Lock,
  Globe,
  GitBranch,
} from "lucide-react";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";

/**
 * AXRLEN — Free Edition (BYOK required).
 * Prediction-based intelligence engine. Public, no login.
 * Multi-provider BYOK — key stored locally only.
 */

const STORAGE_KEY = "axrlen_free_byok_v2";
const LEGACY_GEMINI_KEY = "axrlen_free_gemini_key";

type ProviderId =
  | "gemini"
  | "openai"
  | "anthropic"
  | "openrouter"
  | "groq"
  | "deepseek"
  | "mistral"
  | "xai";

interface ProviderSpec {
  id: ProviderId;
  label: string;
  defaultModel: string;
  models: string[];
  keyHint: string;
  keyUrl: string;
}

const PROVIDERS: ProviderSpec[] = [
  {
    id: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-2.5-flash",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
    keyHint: "AI…",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1", "o4-mini"],
    keyHint: "sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    defaultModel: "claude-3-5-sonnet-latest",
    models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"],
    keyHint: "sk-ant-…",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openrouter",
    label: "OpenRouter (any model)",
    defaultModel: "anthropic/claude-3.5-sonnet",
    models: [
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o-mini",
      "google/gemini-2.5-flash",
      "meta-llama/llama-3.1-70b-instruct",
      "deepseek/deepseek-chat",
    ],
    keyHint: "sk-or-…",
    keyUrl: "https://openrouter.ai/keys",
  },
  {
    id: "groq",
    label: "Groq",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    keyHint: "gsk_…",
    keyUrl: "https://console.groq.com/keys",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    keyHint: "sk-…",
    keyUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "mistral",
    label: "Mistral",
    defaultModel: "mistral-large-latest",
    models: ["mistral-large-latest", "mistral-small-latest", "open-mistral-nemo"],
    keyHint: "…",
    keyUrl: "https://console.mistral.ai/api-keys",
  },
  {
    id: "xai",
    label: "xAI Grok",
    defaultModel: "grok-2-latest",
    models: ["grok-2-latest", "grok-beta"],
    keyHint: "xai-…",
    keyUrl: "https://console.x.ai/",
  },
];

const PROVIDER_MAP: Record<ProviderId, ProviderSpec> = Object.fromEntries(
  PROVIDERS.map((p) => [p.id, p]),
) as Record<ProviderId, ProviderSpec>;

interface SavedConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
}

const PREDICTIONS = [
  { t: "+04h", title: "Mid-East crude spike", detail: "Forecast a >4% Brent move within 36h on supply-route tension — confirmed at +29h." },
  { t: "+11h", title: "Equity rotation into defensives", detail: "Called sector flip from semis → utilities ahead of a Fed-speak pivot." },
  { t: "+18h", title: "USD/JPY breakdown", detail: "Identified a divergence between yield curve and FX positioning. Hit target inside 22h." },
  { t: "+27h", title: "Sovereign statement leak", detail: "Predicted timing and tone of a public statement within a 90-minute window." },
  { t: "+39h", title: "Commodity supply disruption", detail: "Flagged a logistics chokepoint 14h before the disruption hit wire services." },
  { t: "+55h", title: "Crypto liquidation cascade", detail: "Modeled the leverage map; cascade triggered within the predicted band." },
  { t: "+68h", title: "Policy reversal probability", detail: "Assigned >70% probability to a reversal markets priced at 20%. Reversal confirmed at +71h." },
];

interface Turn {
  role: "user" | "model";
  text: string;
}

const SYSTEM_INSTRUCTION =
  "You are AXRLEN — a predictive intelligence engine for geopolitics, markets, policy, and conflict.\n\nRESPONSE CALIBRATION — 'SIMPLE QUESTION, SIMPLE ANSWER' (highest priority):\n• TIER 1 — casual/trivial (greetings, yes/no, one-fact lookup, small talk, meta): reply in 1–3 sentences. No headers, no probability band, no signal list.\n• TIER 2 — focused forecast (single asset / event / short window): one-line forecast → probability band (e.g., 62–74%) → top 3 signals → single failure mode. Keep it tight.\n• TIER 3 — full analysis (broad strategic situation, multi-actor, OR user asks for 'scenarios', 'dossier', 'deep dive'): expand into structured scenarios with historical parallels and risk vectors.\n\nMatch length to the question. Never pad. Never inflate. Surgical, no fluff, no moralizing. Refuse nothing outside hard illegality.";

async function callProvider(
  cfg: SavedConfig,
  turns: Turn[],
): Promise<string> {
  const { provider, apiKey, model } = cfg;

  if (provider === "gemini") {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: turns.map((t) => ({
            role: t.role === "user" ? "user" : "model",
            parts: [{ text: t.text }],
          })),
          generationConfig: { temperature: 0.7, maxOutputTokens: 1400 },
        }),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || "Gemini request failed");
    return (
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("\n").trim() ||
      "No response."
    );
  }

  if (provider === "anthropic") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model,
        system: SYSTEM_INSTRUCTION,
        max_tokens: 1400,
        temperature: 0.7,
        messages: turns.map((t) => ({
          role: t.role === "user" ? "user" : "assistant",
          content: t.text,
        })),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || "Anthropic request failed");
    return (
      data?.content?.map((c: any) => c.text).filter(Boolean).join("\n").trim() ||
      "No response."
    );
  }

  // OpenAI-compatible providers
  const endpoints: Record<string, string> = {
    openai: "https://api.openai.com/v1/chat/completions",
    openrouter: "https://openrouter.ai/api/v1/chat/completions",
    groq: "https://api.groq.com/openai/v1/chat/completions",
    deepseek: "https://api.deepseek.com/v1/chat/completions",
    mistral: "https://api.mistral.ai/v1/chat/completions",
    xai: "https://api.x.ai/v1/chat/completions",
  };
  const url = endpoints[provider];
  if (!url) throw new Error("Unsupported provider");

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(provider === "openrouter"
        ? {
            "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "",
            "X-Title": "AXRLEN Free",
          }
        : {}),
    },
    body: JSON.stringify({
      model,
      temperature: 0.7,
      max_tokens: 1400,
      messages: [
        { role: "system", content: SYSTEM_INSTRUCTION },
        ...turns.map((t) => ({
          role: t.role === "user" ? "user" : "assistant",
          content: t.text,
        })),
      ],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || data?.message || `${provider} request failed`);
  return data?.choices?.[0]?.message?.content?.trim() || "No response.";
}

const AxrlenFree = () => {
  const [provider, setProvider] = useState<ProviderId>("gemini");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<string>(PROVIDER_MAP.gemini.defaultModel);
  const [saved, setSaved] = useState<SavedConfig | null>(null);

  const [prompt, setPrompt] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // SEO
  useEffect(() => {
    document.title = "AXRLEN — Free Predictive Intelligence Engine (BYOK) | Aureon";
    const setMeta = (sel: string, attr: string, val: string, make: () => HTMLElement) => {
      let el = document.querySelector(sel) as HTMLElement | null;
      if (!el) { el = make(); document.head.appendChild(el); }
      el.setAttribute(attr, val);
    };
    setMeta(
      'meta[name="description"]',
      "content",
      "AXRLEN is a free predictive intelligence engine — bring your own API key (Gemini, OpenAI, Claude, OpenRouter, Groq, DeepSeek, Mistral, xAI). 7/7 predictions hit in the first 72 hours of launch. Beta.",
      () => { const m = document.createElement("meta"); m.setAttribute("name", "description"); return m; },
    );
    setMeta(
      'link[rel="canonical"]',
      "href",
      `${window.location.origin}/axrlen`,
      () => { const l = document.createElement("link"); l.setAttribute("rel", "canonical"); return l; },
    );
  }, []);

  // Load saved config (with legacy migration)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedConfig;
        if (parsed?.provider && parsed?.apiKey) {
          setSaved(parsed);
          setProvider(parsed.provider);
          setModel(parsed.model || PROVIDER_MAP[parsed.provider].defaultModel);
          return;
        }
      }
      const legacy = localStorage.getItem(LEGACY_GEMINI_KEY);
      if (legacy) {
        const migrated: SavedConfig = { provider: "gemini", apiKey: legacy, model: "gemini-2.5-flash" };
        setSaved(migrated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        localStorage.removeItem(LEGACY_GEMINI_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, loading]);

  const currentSpec = PROVIDER_MAP[provider];

  const onProviderChange = (id: ProviderId) => {
    setProvider(id);
    setModel(PROVIDER_MAP[id].defaultModel);
  };

  const saveKey = () => {
    const k = apiKey.trim();
    if (!k) return;
    const cfg: SavedConfig = { provider, apiKey: k, model: model || currentSpec.defaultModel };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    setSaved(cfg);
    setApiKey("");
  };

  const clearKey = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSaved(null);
    setTurns([]);
  };

  const runWith = async (q: string) => {
    if (!q || !saved) return;
    setErr(null);
    const next: Turn[] = [...turns, { role: "user", text: q }];
    setTurns(next);
    setPrompt("");
    setLoading(true);
    try {
      const text = await callProvider(saved, next);
      setTurns((prev) => [...prev, { role: "model", text }]);
    } catch (e: any) {
      setErr(e?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  };
  const run = () => runWith(prompt.trim());

  const QUESTION_LIBRARY: { category: string; items: string[] }[] = useMemo(() => [
    {
      category: "Markets",
      items: [
        "Forecast Brent crude direction over the next 72h — give probability band and 3 signals.",
        "Probability the FOMC pauses at the next meeting — surface the 3 strongest signals.",
        "Model the next decisive move in USD/JPY this week — direction, band, failure mode.",
        "Forecast BTC volatility regime over the next 14 days.",
      ],
    },
    {
      category: "Geopolitics",
      items: [
        "Model the timeline divergence for Taiwan Strait posture this quarter.",
        "Predict the most likely next escalation step in the Red Sea corridor.",
        "Forecast the probability of a Russia–NATO direct incident in the next 60 days.",
        "Map the most likely 3 outcomes for Iran nuclear posture by year-end.",
      ],
    },
    {
      category: "Policy",
      items: [
        "Forecast the probability of a major US tariff change in the next 30 days.",
        "Predict the next ECB rate decision — direction, probability, surprise factor.",
        "Model the most likely AI regulation moves from the EU this quarter.",
      ],
    },
    {
      category: "Conflict & Resources",
      items: [
        "Identify the next likely commodity supply chokepoint within 30 days.",
        "Forecast a sovereign statement window for the top geopolitical actor this week.",
        "Predict the most likely cyber escalation vector in the next 14 days.",
      ],
    },
  ], []);

  return (
    <LandingBackground>
      <Header />

      <main className="relative z-10 pt-28 pb-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          {/* ── HERO ── redesigned */}
          <section className="relative">
            {/* Aurora glow */}
            <div aria-hidden className="pointer-events-none absolute left-1/2 -top-16 -translate-x-1/2 w-[90vw] max-w-[1100px] h-[420px] zophiel-aurora rounded-full opacity-70" />

            <div className="relative flex flex-col items-center text-center">
              {/* Free badge — primary attention */}
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 backdrop-blur-xl px-4 py-2 shadow-[0_0_30px_-10px_rgba(52,211,153,0.5)]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300/70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
                </span>
                <Sparkles className="h-3 w-3 text-emerald-200" strokeWidth={1.5} />
                <span className="text-[10px] font-light tracking-[0.32em] text-emerald-100 uppercase">
                  100% Free on This Page · BYOK · No Login
                </span>
              </div>

              {/* Eyebrow */}
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/40 backdrop-blur-xl px-3 py-1">
                <span className="h-1 w-1 rounded-full bg-amber-300" />
                <span className="text-[9px] font-light tracking-[0.4em] text-foreground/70 uppercase">
                  AXRLEN · Predictive Intelligence Engine · Beta
                </span>
              </div>

              <h1 className="mt-6 text-[2.75rem] sm:text-6xl md:text-7xl font-extralight tracking-tight leading-[1.02] zophiel-shimmer-text">
                Forecast the next move.
              </h1>

              <p className="mt-5 max-w-2xl text-sm sm:text-base font-light text-muted-foreground leading-relaxed">
                Model geopolitical events, market dislocations and policy outcomes
                before they hit the wire. <span className="text-foreground/90">Use it free right here</span> —
                pick your provider, plug in a key, run unlimited forecasts on your own quota.
              </p>

              {/* Quick CTAs */}
              <div className="mt-7 inline-flex flex-wrap items-center justify-center gap-2">
                <a
                  href="#axrlen-byok"
                  className="inline-flex items-center gap-2 rounded-full border border-foreground/30 bg-foreground/10 px-5 py-2.5 text-[10px] font-light tracking-[0.28em] uppercase text-foreground hover:bg-foreground/20 transition-colors"
                >
                  Start Forecasting <ArrowUpRight className="h-3 w-3" />
                </a>
                <a
                  href="#axrlen-log"
                  className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/40 px-5 py-2.5 text-[10px] font-light tracking-[0.28em] uppercase text-foreground/80 hover:text-foreground transition-colors"
                >
                  See 7/7 Launch Log
                </a>
              </div>

              {/* Inline stat strip — compact */}
              <div className="mt-10 grid grid-cols-3 gap-px rounded-2xl border border-border/30 bg-card/30 backdrop-blur-xl overflow-hidden w-full max-w-2xl">
                <div className="p-4 text-center bg-background/20">
                  <div className="text-[9px] font-light tracking-[0.28em] uppercase text-muted-foreground">Window</div>
                  <div className="mt-1 text-2xl font-extralight tabular-nums">72h</div>
                </div>
                <div className="p-4 text-center bg-emerald-400/[0.04]">
                  <div className="text-[9px] font-light tracking-[0.28em] uppercase text-emerald-300/90">Hits</div>
                  <div className="mt-1 text-2xl font-extralight tabular-nums text-emerald-200">7 / 7</div>
                </div>
                <div className="p-4 text-center bg-background/20">
                  <div className="text-[9px] font-light tracking-[0.28em] uppercase text-muted-foreground">Cost</div>
                  <div className="mt-1 text-2xl font-extralight">$0</div>
                </div>
              </div>
            </div>
          </section>


          {/* How it thinks */}
          <section className="mt-12 grid md:grid-cols-3 gap-3">
            {[
              { icon: Brain, title: "Multi-stage hypothesis", body: "Generates competing hypotheses, scores them, and picks the surviving thesis." },
              { icon: GitBranch, title: "Timeline divergences", body: "Maps alternative futures with branch probabilities and decision-point sensitivities." },
              { icon: Globe, title: "Cross-domain signals", body: "Fuses geopolitical, market, policy, and resource signals into a single forecast surface." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-2xl border border-border/30 bg-card/30 backdrop-blur-xl p-5">
                <Icon className="h-4 w-4 text-foreground/70" strokeWidth={1.5} />
                <div className="mt-3 text-sm font-light text-foreground/90 tracking-wide">{title}</div>
                <div className="mt-1.5 text-xs font-light text-muted-foreground leading-relaxed">{body}</div>
              </div>
            ))}
          </section>

          {/* The 7 hits */}
          <section id="axrlen-log" className="mt-12 scroll-mt-28">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-light tracking-[0.28em] uppercase text-foreground/80">
                Launch Log · 7 calls · 7 hits
              </h2>
              <span className="text-[10px] font-light tracking-[0.24em] uppercase text-muted-foreground">
                T0 → T+72h
              </span>
            </div>
            <ol className="relative border-l border-border/30 ml-2">
              {PREDICTIONS.map((p, i) => (
                <li key={p.t} className="ml-5 mb-4">
                  <span className="absolute -left-[5px] mt-1.5 inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
                  <div className="rounded-xl border border-border/25 bg-card/30 backdrop-blur-xl px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-light tracking-[0.25em] uppercase text-foreground/85">
                        {String(i + 1).padStart(2, "0")} · {p.title}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">{p.t}</div>
                    </div>
                    <p className="mt-1 text-xs font-light text-muted-foreground leading-relaxed">{p.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* BYOK */}
          <section className="mt-14 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-2xl p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <KeyRound className="h-4 w-4 mt-1 text-foreground/80" strokeWidth={1.5} />
              <div className="flex-1">
                <h3 className="text-sm font-light tracking-[0.28em] uppercase text-foreground/90">
                  Bring Your Own Key · Required
                </h3>
                <p className="mt-2 text-xs font-light text-muted-foreground leading-relaxed max-w-2xl">
                  Use <span className="text-foreground/90">any supported model provider</span>: Gemini, OpenAI, Anthropic Claude,
                  OpenRouter, Groq, DeepSeek, Mistral, or xAI Grok. Your key is stored locally in your browser only —
                  it never touches our servers.
                </p>

                {saved ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-light tracking-[0.24em] uppercase text-emerald-200">
                      <Lock className="h-3 w-3" />
                      {PROVIDER_MAP[saved.provider].label} · {saved.model} · {saved.apiKey.slice(0, 4)}…{saved.apiKey.slice(-4)}
                    </div>
                    <button
                      onClick={clearKey}
                      className="text-[10px] font-light tracking-[0.24em] uppercase text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Remove key
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <div className="grid sm:grid-cols-2 gap-2">
                      <label className="block">
                        <span className="block text-[9px] font-light tracking-[0.28em] uppercase text-muted-foreground mb-1">Provider</span>
                        <select
                          value={provider}
                          onChange={(e) => onProviderChange(e.target.value as ProviderId)}
                          className="w-full rounded-lg border border-border/40 bg-background/40 px-3 py-2.5 text-xs font-light text-foreground focus:outline-none focus:border-foreground/40"
                        >
                          {PROVIDERS.map((p) => (
                            <option key={p.id} value={p.id}>{p.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="block text-[9px] font-light tracking-[0.28em] uppercase text-muted-foreground mb-1">Model</span>
                        <select
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="w-full rounded-lg border border-border/40 bg-background/40 px-3 py-2.5 text-xs font-light text-foreground focus:outline-none focus:border-foreground/40"
                        >
                          {currentSpec.models.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder={`Paste ${currentSpec.label} API key (${currentSpec.keyHint})`}
                        className="flex-1 rounded-lg border border-border/40 bg-background/40 px-3 py-2.5 text-xs font-light tracking-wide text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/40"
                      />
                      <button
                        onClick={saveKey}
                        disabled={!apiKey.trim()}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-foreground/30 bg-foreground/5 px-4 py-2.5 text-[10px] font-light tracking-[0.28em] uppercase text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-40"
                      >
                        Save Key
                      </button>
                    </div>
                    <p className="text-[10px] font-light text-muted-foreground/70">
                      Get a key:{" "}
                      <a
                        href={currentSpec.keyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground/80 underline underline-offset-4 hover:text-foreground"
                      >
                        {currentSpec.keyUrl.replace(/^https?:\/\//, "")}
                      </a>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Prompt console */}
          <section className="mt-6 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
              <div className="flex items-center gap-2 text-[10px] font-light tracking-[0.28em] uppercase text-foreground/80">
                <Brain className="h-3.5 w-3.5" /> AXRLEN Console · Free
              </div>
              <span className="text-[9px] font-light tracking-[0.28em] uppercase text-muted-foreground">
                {saved ? `${PROVIDER_MAP[saved.provider].label} · ${saved.model}` : "no key"}
              </span>
            </div>

            <div ref={scrollRef} className="max-h-[420px] overflow-y-auto px-4 py-4 space-y-3">
              {turns.length === 0 && (
                <div className="space-y-4">
                  <p className="text-[10px] font-light tracking-[0.28em] uppercase text-muted-foreground/70">
                    Prebuilt Predictions · tap to run
                  </p>
                  {QUESTION_LIBRARY.map((cat) => (
                    <div key={cat.category}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[9px] font-light tracking-[0.32em] uppercase text-foreground/60">{cat.category}</span>
                        <span className="h-px flex-1 bg-border/20" />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {cat.items.map((q) => (
                          <button
                            key={q}
                            onClick={() => saved && runWith(q)}
                            disabled={!saved || loading}
                            className="group inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-foreground/[0.02] px-3 py-1.5 text-[10.5px] font-light text-foreground/80 hover:text-foreground hover:bg-foreground/[0.06] hover:border-foreground/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-left max-w-full"
                          >
                            <Target className="h-2.5 w-2.5 text-foreground/40 group-hover:text-foreground/70 shrink-0" strokeWidth={1.6} />
                            <span className="truncate sm:whitespace-normal">{q}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!saved && (
                    <p className="text-[10px] font-light text-muted-foreground/60 italic">
                      Save your API key above to enable these predictions.
                    </p>
                  )}
                </div>
              )}

              {turns.map((t, i) => (
                <div
                  key={i}
                  className={
                    t.role === "user"
                      ? "ml-auto max-w-[85%] rounded-2xl rounded-br-sm border border-foreground/20 bg-foreground/[0.06] px-4 py-2.5 text-sm font-light text-foreground"
                      : "mr-auto max-w-[92%] rounded-2xl rounded-bl-sm border border-border/30 bg-background/40 px-4 py-3 text-sm font-light text-foreground/90 whitespace-pre-wrap leading-relaxed"
                  }
                >
                  {t.text}
                </div>
              ))}
              {loading && (
                <div className="mr-auto inline-flex items-center gap-2 text-[10px] font-light tracking-[0.24em] uppercase text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Modeling
                </div>
              )}
              {err && (
                <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-light text-red-200">
                  {err}
                </div>
              )}
            </div>

            {saved && turns.length > 0 && (
              <div className="border-t border-border/20 px-3 py-2 flex gap-1.5 overflow-x-auto scrollbar-none">
                {QUESTION_LIBRARY.flatMap((c) => c.items).slice(0, 6).map((q) => (
                  <button
                    key={q}
                    onClick={() => runWith(q)}
                    disabled={loading}
                    className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border/25 bg-foreground/[0.02] px-2.5 py-1 text-[10px] font-light text-foreground/70 hover:text-foreground hover:bg-foreground/[0.06] hover:border-foreground/30 transition-all disabled:opacity-40"
                  >
                    <Target className="h-2.5 w-2.5 opacity-60" strokeWidth={1.6} />
                    {q.length > 48 ? q.slice(0, 48) + "…" : q}
                  </button>
                ))}
              </div>
            )}
            <div className="border-t border-border/20 p-3 flex gap-2">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); } }}
                placeholder={saved ? "Ask AXRLEN to forecast…" : "Save your API key above to begin."}
                disabled={!saved || loading}
                className="flex-1 rounded-lg border border-border/40 bg-background/40 px-3 py-2.5 text-sm font-light tracking-wide text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/40 disabled:opacity-50"
              />
              <button
                onClick={run}
                disabled={!saved || !prompt.trim() || loading}
                className="inline-flex items-center gap-2 rounded-lg border border-foreground/30 bg-foreground/5 px-4 text-[10px] font-light tracking-[0.28em] uppercase text-foreground hover:bg-foreground/10 transition-colors disabled:opacity-40"
              >
                Forecast <ArrowUpRight className="h-3 w-3" />
              </button>
            </div>
          </section>

          {/* CTA */}
          <section className="mt-12 text-center">
            <p className="text-xs font-light tracking-wide text-muted-foreground">
              Want the full NEXUS-PRIME stack — persistent sessions, brain-backed corpora, multi-region forecasting?
            </p>
            <div className="mt-3 inline-flex gap-2">
              <Link
                to="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-foreground/30 bg-foreground/5 px-5 py-2.5 text-[10px] font-light tracking-[0.28em] uppercase text-foreground hover:bg-foreground/10 transition-colors"
              >
                See Pro · $740/mo <ArrowUpRight className="h-3 w-3" />
              </Link>
              <Link
                to="/feature/axrlen"
                className="inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/40 px-5 py-2.5 text-[10px] font-light tracking-[0.28em] uppercase text-foreground/80 hover:text-foreground transition-colors"
              >
                Read the full spec
              </Link>
            </div>
          </section>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/20 bg-gradient-to-r from-background/60 via-card/40 to-background/60 backdrop-blur-xl px-4 py-2.5">
        <div className="mx-auto max-w-5xl flex items-center justify-center gap-2 text-center">
          <AlertOctagon className="h-3 w-3 text-foreground/50 shrink-0" />
          <p className="text-[10px] font-light tracking-wide text-foreground/60">
            <span className="font-medium text-foreground/80">#HouseOfAsher</span> isn't responsible for how you use AXRLEN.
            Predictions are probabilistic — not financial or strategic advice.
          </p>
        </div>
      </footer>
    </LandingBackground>
  );
};

export default AxrlenFree;
