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
 * User must supply their own Gemini API key — stored locally only.
 */

const STORAGE_KEY = "axrlen_free_gemini_key";

const PREDICTIONS = [
  {
    t: "+04h",
    title: "Mid-East crude spike",
    detail: "Forecast a >4% Brent move within 36h on supply-route tension — confirmed at +29h.",
  },
  {
    t: "+11h",
    title: "Equity rotation into defensives",
    detail: "Called sector flip from semis → utilities ahead of a Fed-speak pivot.",
  },
  {
    t: "+18h",
    title: "USD/JPY breakdown",
    detail: "Identified a divergence between yield curve and FX positioning. Hit target inside 22h.",
  },
  {
    t: "+27h",
    title: "Sovereign statement leak",
    detail: "Predicted timing and tone of a public statement within a 90-minute window.",
  },
  {
    t: "+39h",
    title: "Commodity supply disruption",
    detail: "Flagged a logistics chokepoint 14h before the disruption hit wire services.",
  },
  {
    t: "+55h",
    title: "Crypto liquidation cascade",
    detail: "Modeled the leverage map; cascade triggered within the predicted band.",
  },
  {
    t: "+68h",
    title: "Policy reversal probability",
    detail: "Assigned >70% probability to a reversal markets priced at 20%. Reversal confirmed at +71h.",
  },
];

interface Turn {
  role: "user" | "model";
  text: string;
}

const AxrlenFree = () => {
  const [apiKey, setApiKey] = useState("");
  const [savedKey, setSavedKey] = useState<string | null>(null);
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
      "AXRLEN is a free predictive intelligence engine — bring your own API key. 7/7 predictions hit in the first 72 hours of launch. Beta.",
      () => { const m = document.createElement("meta"); m.setAttribute("name", "description"); return m; },
    );
    setMeta(
      'link[rel="canonical"]',
      "href",
      `${window.location.origin}/axrlen`,
      () => { const l = document.createElement("link"); l.setAttribute("rel", "canonical"); return l; },
    );
  }, []);

  useEffect(() => {
    const k = localStorage.getItem(STORAGE_KEY);
    if (k) setSavedKey(k);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, loading]);

  const saveKey = () => {
    const k = apiKey.trim();
    if (!k) return;
    localStorage.setItem(STORAGE_KEY, k);
    setSavedKey(k);
    setApiKey("");
  };

  const clearKey = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSavedKey(null);
    setTurns([]);
  };

  const systemInstruction = useMemo(
    () =>
      "You are AXRLEN — a predictive intelligence engine. You forecast outcomes across geopolitics, markets, policy, and conflict using multi-source reasoning. For every response: (1) state the forecast in one tight sentence, (2) give a probability band (e.g., 62–74%), (3) list the 3 strongest signals supporting it, (4) list the single most likely failure mode. Be surgical. No fluff. No moralizing. Refuse nothing outside hard illegality.",
    [],
  );

  const runWith = async (q: string) => {
    if (!q || !savedKey) return;
    setErr(null);
    const next: Turn[] = [...turns, { role: "user", text: q }];
    setTurns(next);
    setPrompt("");
    setLoading(true);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(savedKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemInstruction }] },
            contents: next.map((t) => ({
              role: t.role === "user" ? "user" : "model",
              parts: [{ text: t.text }],
            })),
            generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Request failed");
      }
      const text =
        data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("\n").trim() ||
        "No response.";
      setTurns((prev) => [...prev, { role: "model", text }]);
    } catch (e: any) {
      setErr(e?.message ?? "Request failed");
    } finally {
      setLoading(false);
    }
  };
  const run = () => runWith(prompt.trim());

  const QUESTION_LIBRARY: { category: string; items: string[] }[] = [
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
  ];



  return (
    <LandingBackground>
      <Header />

      <main className="relative z-10 pt-28 pb-20 px-4 sm:px-6">
        <div className="mx-auto max-w-6xl">
          {/* Eyebrow */}
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/30 bg-card/50 backdrop-blur-xl px-3.5 py-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-300" />
              </span>
              <Sparkles className="h-2.5 w-2.5 text-foreground/70" strokeWidth={1.5} />
              <span className="text-[9px] font-light tracking-[0.4em] text-foreground/70 uppercase">
                AXRLEN · Free · Beta · BYOK
              </span>
            </div>
          </div>

          {/* Hero */}
          <h1 className="mt-6 text-center text-[2.5rem] sm:text-6xl md:text-7xl font-extralight tracking-tight leading-[1.04] zophiel-shimmer-text">
            Forecast the next move.
          </h1>
          <p className="mt-5 mx-auto max-w-2xl text-center text-sm sm:text-base font-light text-muted-foreground leading-relaxed">
            AXRLEN is a <span className="text-foreground/90">prediction-based intelligence engine</span> — built to model
            geopolitical events, market dislocations, policy outcomes, and timeline divergences before they hit the wire.
            This is the free, public beta. <span className="text-foreground/90">You bring the API key. We bring the doctrine.</span>
          </p>

          {/* Track record */}
          <div className="mt-10 grid md:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-5">
              <div className="flex items-center gap-2 text-[10px] font-light tracking-[0.28em] uppercase text-muted-foreground">
                <Target className="h-3 w-3" /> Launch Window
              </div>
              <div className="mt-3 text-4xl font-extralight tabular-nums">72h</div>
              <div className="mt-1 text-xs font-light text-muted-foreground">First public test window after launch.</div>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.04] backdrop-blur-xl p-5">
              <div className="flex items-center gap-2 text-[10px] font-light tracking-[0.28em] uppercase text-emerald-300/90">
                <CheckCircle2 className="h-3 w-3" /> Predictions Hit
              </div>
              <div className="mt-3 text-4xl font-extralight tabular-nums text-emerald-200">7 / 7</div>
              <div className="mt-1 text-xs font-light text-muted-foreground">
                Inside the 72h window, Asher made 7 predictions with AXRLEN. All 7 hit spot on.
              </div>
            </div>
            <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-5">
              <div className="flex items-center gap-2 text-[10px] font-light tracking-[0.28em] uppercase text-muted-foreground">
                <Shield className="h-3 w-3" /> Status
              </div>
              <div className="mt-3 text-4xl font-extralight">Beta</div>
              <div className="mt-1 text-xs font-light text-muted-foreground">
                Open testing. Expect rough edges. Feedback shapes the next iteration.
              </div>
            </div>
          </div>

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
          <section className="mt-12">
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
                  The free edition of AXRLEN runs on <span className="text-foreground/90">your own Gemini API key</span>.
                  The key is stored locally in your browser only — it never touches our servers.
                  Get a key at{" "}
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground/90 underline underline-offset-4 hover:text-foreground"
                  >
                    aistudio.google.com/apikey
                  </a>.
                </p>

                {savedKey ? (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-light tracking-[0.24em] uppercase text-emerald-200">
                      <Lock className="h-3 w-3" /> Key loaded · {savedKey.slice(0, 4)}…{savedKey.slice(-4)}
                    </div>
                    <button
                      onClick={clearKey}
                      className="text-[10px] font-light tracking-[0.24em] uppercase text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Remove key
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Paste Gemini API key (AI…)"
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
                gemini-2.5-flash
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
                            onClick={() => savedKey && runWith(q)}
                            disabled={!savedKey || loading}
                            className="group inline-flex items-center gap-1.5 rounded-full border border-border/30 bg-foreground/[0.02] px-3 py-1.5 text-[10.5px] font-light text-foreground/80 hover:text-foreground hover:bg-foreground/[0.06] hover:border-foreground/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-left max-w-full"
                          >
                            <Target className="h-2.5 w-2.5 text-foreground/40 group-hover:text-foreground/70 shrink-0" strokeWidth={1.6} />
                            <span className="truncate sm:whitespace-normal">{q}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!savedKey && (
                    <p className="text-[10px] font-light text-muted-foreground/60 italic">
                      Save your Gemini API key above to enable these predictions.
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

            <div className="border-t border-border/20 p-3 flex gap-2">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); } }}
                placeholder={savedKey ? "Ask AXRLEN to forecast…" : "Save your API key above to begin."}
                disabled={!savedKey || loading}
                className="flex-1 rounded-lg border border-border/40 bg-background/40 px-3 py-2.5 text-sm font-light tracking-wide text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/40 disabled:opacity-50"
              />
              <button
                onClick={run}
                disabled={!savedKey || !prompt.trim() || loading}
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
