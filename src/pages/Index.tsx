import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowRight, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";

import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import AuthOverlay from "@/components/AuthOverlay";
import SubscriptionPlans from "@/components/SubscriptionPlans";
import SiteFooter from "@/components/SiteFooter";
import ScrollProgressBar from "@/components/landing/ScrollProgressBar";
import { useScrollFadeIn } from "@/hooks/useScrollFadeIn";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Homepage narrative (LANDING-KEEP-GO-REPLACE)
 * ------------------------------------------------------------------
 * A stranger lands here with no context. Five screens, in order:
 *   1. what this is           — headline + one true sentence + create account
 *   2. one live question      — a real call to the sourced chat path, not a mock
 *   3. what stays private     — only claims the server can actually honour
 *   4. what it costs          — $18 / $79, cancel in one click, no trial
 *   5. close                  — create account, one quiet origin line
 *
 * Everything removed from this file was either costume (HUD ticker, NODE /
 * ASHERIN-01, "intelligence OS"), unverifiable (named testimonials, ranks,
 * AUM figures), crawler-facing prose rendered at humans (GeoBlock), or a
 * simulation presented as a product (fake source cards, fake veracity score,
 * fake video-analysis frames). Structured data for "/" still ships from
 * RouteSeo plus the JSON-LD effect below; none of it is visible chrome.
 */

const Section = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const { ref, isVisible } = useScrollFadeIn();
  return (
    <section
      ref={ref}
      className={`relative z-10 transition-all duration-700 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      } ${className}`}
    >
      {children}
    </section>
  );
};

/** Client-side courtesy limit. The edge function owns real enforcement; this
 *  only keeps a curious visitor from hammering the field by accident. */
const MAX_PUBLIC_ASKS = 2;
const ASK_COUNT_KEY = "asherin_home_ask_count";

const Index = () => {
  const location = useLocation();
  const { user } = useAuth();

  const [showAuth, setShowAuth] = useState(false);
  const [authIsLogin, setAuthIsLogin] = useState(false);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const [askCount, setAskCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(window.localStorage.getItem(ASK_COUNT_KEY) || "0", 10) || 0;
  });
  const abortRef = useRef<AbortController | null>(null);

  const openSignup = () => {
    setAuthIsLogin(false);
    setShowAuth(true);
  };

  // /auth and ?next= route through this page's overlay in login mode.
  useEffect(() => {
    if (location.pathname === "/auth" || new URLSearchParams(location.search).get("next")) {
      setAuthIsLogin(true);
      setShowAuth(true);
    }
  }, [location.pathname, location.search]);

  // An in-flight stream must not outlive the page.
  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    // Title / description / canonical / og for "/" belong to RouteSeo. Only
    // page-specific structured data is added here, and only to the head.
    const faqs = [
      {
        q: "what does asherin cost?",
        a: "Asherin is $18 per month. Asherin Pro is $79 per month. There is no free tier and no trial countdown.",
      },
      {
        q: "can i cancel?",
        a: "Yes, in one click from the dashboard. No retention flow. Your data can be exported or deleted at any time.",
      },
      {
        q: "what does the $18 plan include?",
        a: "Chat with sources beside the answer, asherinx.eng, asherin.maps, asherin.defender, asherin.arvision, a private vault, and memory that persists between sessions.",
      },
      {
        q: "is my work used to train asherin?",
        a: "No. Your conversations and files are account-scoped and encrypted at rest. They are not sold and are not used as training data.",
      },
    ];

    const schemas = [
      {
        id: "home-website-jsonld",
        data: {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Asherin",
          url: "https://asherin.com",
          description:
            "asherin is a sourced research workspace: chat, asherinx.eng, asherin.maps, asherin.defender, asherin.arvision. $18/mo, $79/mo pro. honest about what it does not know.",
        },
      },
      {
        id: "home-faq-jsonld",
        data: {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        },
      },
    ];

    schemas.forEach(({ id, data }) => {
      let el = document.getElementById(id) as HTMLScriptElement | null;
      if (!el) {
        el = document.createElement("script");
        el.id = id;
        el.type = "application/ld+json";
        document.head.appendChild(el);
      }
      el.textContent = JSON.stringify(data);
    });

    return () => schemas.forEach(({ id }) => document.getElementById(id)?.remove());
  }, []);

  /**
   * Real call to the same sourced chat path the dashboard uses. If it fails we
   * say it failed — the page never fabricates an answer or a citation.
   */
  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = question.trim();
    if (!query || asking || askCount >= MAX_PUBLIC_ASKS) return;

    const next = askCount + 1;
    setAskCount(next);
    window.localStorage.setItem(ASK_COUNT_KEY, String(next));
    setQuestion("");
    setAnswer("");
    setAskError("");
    setAsking(true);

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 60_000);

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: query }],
          mode: "chat",
          depth: "standard",
        }),
      });

      if (!resp.ok || !resp.body) {
        setAskError(
          resp.status === 429
            ? "too many questions right now. try again in a minute."
            : "that request did not come back. try again, or create an account for the full workspace.",
        );
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;
          try {
            const parsed = JSON.parse(payload);
            const chunk = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (chunk) {
              full += chunk;
              setAnswer(full);
            }
          } catch {
            /* partial frame — wait for the rest */
          }
        }
      }

      if (!full) {
        setAskError("no answer came back. try a different question.");
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setAskError("the connection dropped before the answer finished.");
      }
    } finally {
      window.clearTimeout(timeout);
      setAsking(false);
    }
  };

  const asksLeft = Math.max(0, MAX_PUBLIC_ASKS - askCount);

  return (
    <LandingBackground>
      <ScrollProgressBar />
      <Header />

      {/* ───────────── 1 · hero ───────────── */}
      <Section className="flex min-h-[88vh] flex-col justify-center px-6 pt-32 pb-20">
        <div className="mx-auto w-full max-w-5xl">
          <h1 className="font-display text-6xl sm:text-7xl md:text-8xl font-light tracking-[-0.025em] leading-[0.94] text-foreground">
            asherin —
            <br />
            <span className="zophiel-shimmer-text italic font-light">look a little closer.</span>
          </h1>

          <p className="mt-8 max-w-xl text-lg sm:text-xl font-light leading-relaxed text-foreground/85">
            asherin tries to give you the fuller picture — sourced, and honest about what it does not know.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {user ? (
              <Link
                to="/dashboard"
                className="group inline-flex items-center gap-2.5 rounded-xl bg-amber-400 px-8 py-4 text-sm font-medium tracking-wide text-black transition-colors hover:bg-amber-300"
              >
                go to dashboard
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <button
                onClick={openSignup}
                className="group inline-flex items-center gap-2.5 rounded-xl bg-amber-400 px-8 py-4 text-sm font-medium tracking-wide text-black transition-colors hover:bg-amber-300"
              >
                create account
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
            <Link
              to="/pricing"
              className="inline-flex items-center min-h-[44px] px-1 text-xs tracking-[0.22em] uppercase font-light text-muted-foreground/80 transition-colors hover:text-foreground"
            >
              pricing
            </Link>
          </div>
          <p className="mt-14 max-w-2xl text-sm font-extralight leading-relaxed text-muted-foreground">
            rooms on a seat: chat, asherinx.eng, asherin.maps, asherin.defender, asherin.arvision. $18 / month. $79 /
            month pro.
          </p>
        </div>
      </Section>

      {/* ───────────── 2 · one live question ───────────── */}
      <Section className="px-6 py-24 sm:py-28">
        <div className="mx-auto w-full max-w-3xl">
          <h2 className="text-3xl sm:text-4xl font-extralight tracking-tight leading-tight text-foreground">
            ask one question.
          </h2>
          <p className="mt-4 text-sm font-extralight leading-relaxed text-muted-foreground max-w-xl">
            this field runs the same answering path the workspace uses. links in the answer are the ones it actually
            used. {asksLeft > 0 ? `${asksLeft} left before sign up.` : "sign up to keep going."}
          </p>

          <div className="mt-8 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-5 sm:p-7">
            {asksLeft === 0 ? (
              <div className="flex flex-col items-start gap-4">
                <p className="text-sm font-extralight text-muted-foreground">
                  that is the end of the public questions.
                </p>
                <button
                  onClick={openSignup}
                  className="inline-flex items-center gap-2 rounded-xl border border-foreground/25 px-6 py-3 text-xs tracking-[0.22em] uppercase font-light text-foreground transition-colors hover:bg-foreground hover:text-background"
                >
                  create account
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleAsk}
                className="flex items-center gap-3 rounded-xl border border-border/30 bg-background/30 px-4 py-3"
              >
                <label htmlFor="home-ask" className="sr-only">
                  ask asherin a question
                </label>
                <input
                  id="home-ask"
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="ask something you would want sources for…"
                  className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none"
                />
                <button
                  type="submit"
                  disabled={asking || !question.trim()}
                  aria-label="send question"
                  className="text-foreground/60 transition-colors hover:text-foreground disabled:opacity-30"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            )}

            {asking && !answer && (
              <p className="mt-5 text-xs font-mono tracking-[0.2em] uppercase text-muted-foreground/60">working…</p>
            )}

            {askError && <p className="mt-5 text-sm font-extralight text-muted-foreground">{askError}</p>}

            {answer && (
              <div className="mt-6 rounded-xl border border-border/10 bg-background/20 p-5 max-h-[52vh] overflow-y-auto">
                <div className="prose prose-invert prose-sm max-w-none font-extralight [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-foreground/90 [&_li]:text-sm [&_a]:text-accent [&_a]:underline [&_a]:break-words">
                  <ReactMarkdown>{answer}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>

          {/* three jobs, plain language */}
          <div className="mt-14 grid gap-6 sm:grid-cols-3">
            {[
              { k: "ask", d: "a question with sources beside the answer." },
              { k: "keep", d: "files and memory you can return to." },
              { k: "look at a place", d: "a map, when the question is about somewhere." },
            ].map(({ k, d }) => (
              <div key={k} className="rounded-2xl border border-border/15 bg-card/20 backdrop-blur-md p-6">
                <p className="text-sm tracking-[0.18em] uppercase font-light text-foreground/90">{k}</p>
                <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>

          <p className="mt-10 text-base font-extralight text-muted-foreground">
            for people who need sources next to an answer. chat is the mouth. files, maps, and a vault sit behind it.
          </p>
        </div>
      </Section>

      {/* ───────────── 3 · what stays private ───────────── */}
      <Section className="px-6 py-24 sm:py-28">
        <div className="mx-auto w-full max-w-3xl">
          <h2 className="text-3xl sm:text-4xl font-extralight tracking-tight leading-tight text-foreground">
            what stays private.
          </h2>
          <ul className="mt-8 space-y-4 text-sm font-extralight leading-relaxed text-muted-foreground">
            <li>your conversations, files, and vault entries are account-scoped and encrypted at rest.</li>
            <li>
              answering a question means sending it to a model, so it is not a sealed room — asherin will not claim
              otherwise.
            </li>
            <li>your work is not sold, and it is not used to train asherin.</li>
            <li>you can export everything, or delete it, whenever you want.</li>
          </ul>
          <Link
            to="/privacy"
            className="mt-8 inline-flex items-center gap-2 text-xs tracking-[0.22em] uppercase font-light text-muted-foreground/80 transition-colors hover:text-foreground"
          >
            read the privacy policy
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </Section>

      {/* ───────────── 4 · price ───────────── */}
      <Section className="px-6 py-24 sm:py-28">
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="text-center text-3xl sm:text-4xl font-extralight tracking-tight leading-tight text-foreground">
            what it costs.
          </h2>
          <p className="mt-4 text-center text-sm font-extralight text-muted-foreground">
            $18 / month. $79 / month pro. cancel in one click.
          </p>

          <div className="mt-14">
            <SubscriptionPlans compact />
          </div>

          <div className="mx-auto mt-16 max-w-3xl space-y-3">
            {[
              {
                q: "what does the $18 plan include?",
                a: "chat with sources beside the answer, asherinx.eng, asherin.maps, asherin.defender, asherin.arvision, a private vault, and memory that carries between sessions.",
              },
              {
                q: "what does pro add?",
                a: "the heavier research and analysis work: deeper source pulls, longer sessions, and the modules that need more compute.",
              },
              {
                q: "can i cancel?",
                a: "yes, in one click from the dashboard. no retention loop, no call, no email chain.",
              },
              {
                q: "is my work used to train asherin?",
                a: "no. it is account-scoped, encrypted at rest, never sold, and never turned into training data.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="rounded-xl border border-border/20 bg-card/25 backdrop-blur-md px-6 py-5">
                <p className="text-base font-light tracking-tight text-foreground">{q}</p>
                <p className="mt-2 text-sm font-extralight leading-relaxed text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ───────────── 5 · close ───────────── */}
      <Section className="px-6 py-24 sm:py-28">
        <div className="mx-auto w-full max-w-3xl">
          <h2 className="text-3xl sm:text-4xl font-extralight tracking-tight leading-tight text-foreground">
            start with one question.
          </h2>
          <p className="mt-5 max-w-xl text-sm font-extralight leading-relaxed text-muted-foreground">
            asherin exists because an answer without its sources is just a rumour with good posture. it will show you
            where something came from, and it will say when it does not know.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {user ? (
              <Link
                to="/dashboard"
                className="group inline-flex items-center gap-2.5 rounded-xl bg-amber-400 px-8 py-4 text-sm font-medium tracking-wide text-black transition-colors hover:bg-amber-300"
              >
                go to dashboard
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <button
                onClick={openSignup}
                className="group inline-flex items-center gap-2.5 rounded-xl bg-amber-400 px-8 py-4 text-sm font-medium tracking-wide text-black transition-colors hover:bg-amber-300"
              >
                create account
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
            <Link
              to="/for"
              className="inline-flex items-center min-h-[44px] px-1 text-xs tracking-[0.22em] uppercase font-light text-muted-foreground/80 transition-colors hover:text-foreground"
            >
              who it's for
            </Link>
            <Link
              to="/founder"
              className="inline-flex items-center min-h-[44px] px-1 text-xs tracking-[0.22em] uppercase font-light text-muted-foreground/80 transition-colors hover:text-foreground"
            >
              why it exists
            </Link>
          </div>
        </div>
      </Section>

      <SiteFooter />

      {showAuth && <AuthOverlay isLogin={authIsLogin} setIsLogin={setAuthIsLogin} onClose={() => setShowAuth(false)} />}
    </LandingBackground>
  );
};

export default Index;
