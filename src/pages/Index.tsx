import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import AuthOverlay from "@/components/AuthOverlay";
import { AlertCircle, Smile, AlertTriangle, Send, ArrowRight, Hammer, FlaskConical, Code, Target, Feather, BarChart3, Unlock, Monitor, Search, Brain, Users, Globe, Check, X, AlertOctagon, Lock, ShieldOff, Flag, Trash2, ChevronDown, Twitter, Download, Zap, GitBranch, Key, Layers, Cpu, Shuffle, Github, Clock, Moon, FileText } from "lucide-react";
import DashboardPreview from "@/components/landing/DashboardPreview";
import { useState, useEffect } from "react";
import { useScrollFadeIn } from "@/hooks/useScrollFadeIn";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

import { usePwaInstall } from "@/hooks/use-pwa-install";
import ReactMarkdown from "react-markdown";
import MessageDiagramPanel from "@/components/dashboard/MessageDiagramPanel";
import NeuralThinkingModal from "@/components/dashboard/NeuralThinkingModal";
import houseOfAsherLogo from "@/assets/HouseOfAsher_Flag.png";
import asherPhotoAsset from "@/assets/founder-portrait-1.png.asset.json";
import SubscriptionPlans from "@/components/SubscriptionPlans";
import SiteFooter from "@/components/SiteFooter";
import LiveDemoStrip from "@/components/landing/LiveDemoStrip";
import TrustBand from "@/components/landing/TrustBand";
import GeoBlock from "@/components/seo/GeoBlock";

import ScrollProgressBar from "@/components/landing/ScrollProgressBar";


import CommandPaletteHint from "@/components/landing/CommandPaletteHint";
import MagneticSpotlightButton from "@/components/landing/MagneticSpotlightButton";
import CountUp from "@/components/landing/CountUp";
import HeroSciFiOrb from "@/components/landing/HeroSciFiOrb";


const StatusIcon = ({ type }: { type: string }) => {
  if (type === "check") return <Check className="h-4 w-4 text-emerald-400 inline" />;
  if (type === "x") return <X className="h-4 w-4 text-destructive/70 inline" />;
  return <AlertOctagon className="h-4 w-4 text-accent/70 inline" />;
};

const ScrollSection = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const { ref, isVisible } = useScrollFadeIn();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
    >
      {children}
    </div>
  );
};

const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden transition-colors hover:border-amber-300/30">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left">
        <span className="font-display text-lg sm:text-xl font-light tracking-tight text-foreground leading-snug">{q}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="px-6 pb-6">
            <p className="text-[15px] font-extralight leading-[1.75] text-muted-foreground max-w-3xl">{a}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// telemetry strip — slim, segmented, military time
const HudStatusBar = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const pad = (n: number) => n.toString().padStart(2, "0");
  const localMil = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const utcMil = `${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}Z`;
  const dateStamp = `${now.getUTCFullYear()}.${pad(now.getUTCMonth() + 1)}.${pad(now.getUTCDate())}`;
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const doy = Math.floor((now.getTime() - start) / 86400000);
  const tzOffsetMin = -now.getTimezoneOffset();
  const tzSign = tzOffsetMin >= 0 ? "+" : "-";
  const tzH = pad(Math.floor(Math.abs(tzOffsetMin) / 60));
  const tzM = pad(Math.abs(tzOffsetMin) % 60);

  const cell = "flex items-center gap-2 px-4 py-2.5 border-r border-foreground/10 last:border-r-0 whitespace-nowrap";

  return (
    <div className="relative w-full rounded-xl border border-foreground/10 bg-foreground/[0.02] backdrop-blur-xl font-mono text-[10px] tracking-[0.22em] uppercase text-muted-foreground/70 flex items-stretch overflow-hidden">
      <div className={cell}>
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/80 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
        </span>
        <span className="text-emerald-300/90">LIVE</span>
      </div>
      <div className={cell + " text-foreground tabular-nums"}>
        <span className="text-muted-foreground/40">UTC</span>{utcMil}
      </div>
      <div className={cell + " hidden sm:flex tabular-nums"}>
        <span className="text-muted-foreground/40">LOC</span>{localMil}
        <span className="text-muted-foreground/30 normal-case">{tzSign}{tzH}{tzM}</span>
      </div>
      <div className={cell + " hidden md:flex"}>
        <span className="text-muted-foreground/40">DOY</span>{pad(doy)} · {dateStamp}
      </div>
      <div className={cell + " hidden lg:flex ml-auto"}>
        <span className="text-muted-foreground/40">NODES</span>30 · SECURE
      </div>
    </div>
  );
};

const Index = () => {
  useEffect(() => {
    // Title/description/canonical/og for "/" are owned solely by RouteSeo
    // (src/lib/routeSeoData.ts) so the runtime head, the static index.html,
    // and the prerendered head cannot drift apart. This effect only adds FAQ
    // structured data, which is page-specific.



    const faqs = [
      { q: "What makes Asherin different?", a: "Asherin is more than a chatbot. It combines uncensored AI, real-time search, intelligence tooling, predictive analytics, and a capable coding engine into a single dashboard built for professionals." },
      { q: "How good is the coding engine?", a: "Asherin holds full context across large codebases, debugs without circular loops, and delivers working architecture, not pseudocode dressed up as a solution. It doesn't stop when the problem gets hard." },
      { q: 'What does "never trains our models" mean?', a: "Your prompts are processed, answered, and encrypted. They are never stored as training data or shared with third parties. Your intelligence stays yours." },
      { q: "Can I cancel anytime?", a: "Yes. One click from the dashboard. No retention flow. No \"are you sure?\" loop. Asherin is $18/month, Asherin Pro is $399/month, and you can cancel either at any time. Your data is exported or deleted on request." },
      { q: "What is the live web search powered by?", a: "Privacy-first search infrastructure. Asherin pulls live data without tracking your search behavior or feeding it to ad networks." },
      { q: "Is Asherin available in multiple languages?", a: "Yes. Asherin processes and delivers in any major language. The output quality and uncensored standard remain identical regardless of language." },
    ];

    const schemas = [
      {
        id: "home-website-jsonld",
        data: {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Asherin",
          url: "https://asherin.com",
          description: "AI intelligence platform with a capable coding engine, live web search, and end-to-end encryption.",
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

    return () => {
      schemas.forEach(({ id }) => document.getElementById(id)?.remove());
    };
  }, []);
  const [demoQuery, setDemoQuery] = useState("");
  const [demoResponse, setDemoResponse] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const { canInstall, install } = usePwaInstall();
  const [demoCount, setDemoCount] = useState(() => {
    return parseInt(localStorage.getItem("aureon_demo_count") || "0", 10);
  });
  const [showDiagram, setShowDiagram] = useState(false);
  const [showNeural, setShowNeural] = useState(false);
  const [lastDemoQuery, setLastDemoQuery] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [authIsLogin, setAuthIsLogin] = useState(false);
  const [showHouseLogo, setShowHouseLogo] = useState(false);
  const [arsenalExpanded, setArsenalExpanded] = useState(false);
  const maxDemos = 3;
  const location = useLocation();
  const { user, loading } = useAuth();

  useEffect(() => {
    // /auth is the sign-in surface; ?next= carries the gated path a
    // signed-out visitor tried to reach.
    if (location.pathname === "/auth" || new URLSearchParams(location.search).get("next")) {
      setAuthIsLogin(true);
      setShowAuth(true);
    }
  }, [location.search, location.pathname]);

  const handleDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoQuery.trim() || isTyping || demoCount >= maxDemos) return;
    const newCount = demoCount + 1;
    setDemoCount(newCount);
    localStorage.setItem("aureon_demo_count", String(newCount));
    setIsTyping(true);
    setDemoResponse("");

    const query = demoQuery.trim();
    setLastDemoQuery(query);
    setDemoQuery("");

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
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
        setDemoResponse("Something went wrong. Try again.");
        setIsTyping(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullText = "";
      let streamDone = false;

      while (!streamDone) {
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
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullText += content;
              setDemoResponse(fullText);
            }
          } catch { /* partial JSON, wait for more */ }
        }
      }
    } catch (err) {
      console.error("Demo chat error:", err);
      setDemoResponse("Connection failed. Please try again.");
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <LandingBackground>
      <ScrollProgressBar />

      {/* Header */}
      <Header />

      <ScrollSection>
      <div className="relative z-10 flex min-h-screen flex-col px-6 pt-28 pb-16 overflow-hidden">
        {/* Aurora glow */}
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[1200px] h-[520px] zophiel-aurora rounded-full" />

        {/* grid floor */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "72px 72px",
            maskImage: "radial-gradient(ellipse at center, black 25%, transparent 78%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 25%, transparent 78%)",
          }}
        />

        <div className="relative mx-auto w-full max-w-7xl">
          <HeroSciFiOrb />
          {/* Top meta row */}
          <div className="flex items-center justify-between text-[9px] tracking-[0.4em] text-muted-foreground/50 uppercase font-mono mb-6">
            <span className="flex items-center gap-2">
              <span className="h-px w-6 bg-foreground/30" />
              NODE / ASHERIN-01
            </span>
            <span className="hidden sm:flex items-center gap-2">
              CHANNEL · ZOPHIEL
              <span className="h-px w-6 bg-foreground/30" />
            </span>
          </div>

          {/* HUD strip — full width */}
          <HudStatusBar />

          {/* Hero: headline + CTA */}
          <div className="mt-10">
            <div className="inline-flex items-center gap-2 self-start rounded-full border border-foreground/15 bg-foreground/[0.03] backdrop-blur-md px-3 py-1 font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground/70">
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              v1.0 · INTELLIGENCE OS
            </div>

            <h1 className="font-display mt-6 text-6xl sm:text-7xl md:text-8xl lg:text-[7rem] xl:text-[8rem] font-light tracking-[-0.025em] leading-[0.92] text-foreground">
              <span className="sr-only">asherin, a private ai research workspace: </span>
              <span aria-hidden="true">look a little</span>
              <br />
              <span className="zophiel-shimmer-text italic font-light" aria-hidden="true">closer.</span>
            </h1>

            <p className="mt-7 max-w-xl text-lg sm:text-xl font-light leading-relaxed text-foreground/85">
              Asherin tries to give you the fuller picture — sourced,
              and honest about what it does not know.
            </p>


            {/* CTA cluster — Fitts (large primary), Hick (one dominant choice), Von Restorff (primary pops),
                Proximity (CTA + reassurance tightly grouped), Peak-End (first thing the user touches). */}
            <div className="mt-9 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5">
              {user ? (
                <MagneticSpotlightButton
                  href="/dashboard"
                  variant="primary"
                  size="xl"
                  ariaLabel="Go to your dashboard"
                  className="!bg-amber-400 !text-black !border-amber-300 hover:!bg-amber-300 shadow-[0_10px_40px_-8px_rgba(251,191,36,0.55)] hover:shadow-[0_14px_50px_-8px_rgba(251,191,36,0.7)]"
                >
                  Go to Dashboard <ArrowRight className="h-4 w-4" />
                </MagneticSpotlightButton>
              ) : (
                <MagneticSpotlightButton
                  onClick={() => { setAuthIsLogin(false); setShowAuth(true); }}
                  variant="primary"
                  size="xl"
                  ariaLabel="Start a free intelligence search, primary action"
                  className="!bg-amber-400 !text-black !border-amber-300 hover:!bg-amber-300 shadow-[0_10px_40px_-8px_rgba(251,191,36,0.55)] hover:shadow-[0_14px_50px_-8px_rgba(251,191,36,0.7)]"
                >
                  Start Free, No Card <ArrowRight className="h-4 w-4" />
                </MagneticSpotlightButton>
              )}
              {user ? (
                <Link
                  to="/dashboard"
                  className="group inline-flex items-center gap-2 text-xs tracking-[0.22em] uppercase font-light text-muted-foreground/80 hover:text-foreground transition-colors min-h-[44px] px-1"
                >
                  See it live
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              ) : (
                <button
                  onClick={() => { setAuthIsLogin(false); setShowAuth(true); }}
                  className="group inline-flex items-center gap-2 text-xs tracking-[0.22em] uppercase font-light text-muted-foreground/80 hover:text-foreground transition-colors min-h-[44px] px-1"
                >
                  See it live
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
              )}
            </div>
            {/* Parkinson's-Law-style reassurance: shortens the perceived commitment. */}
            <p className="mt-3 text-[11px] tracking-[0.18em] uppercase font-mono text-muted-foreground/55">
              ◈ 30-second setup · No credit card · Cancel anytime
            </p>

            {/* Scroll cue */}
            <div className="mt-8 flex items-center gap-2 font-mono text-[9px] tracking-[0.4em] uppercase text-muted-foreground/40 max-w-xl">
              <span className="h-px flex-1 bg-foreground/15" />
              SCROLL TO DEPLOY ↓
            </div>
          </div>
        </div>

        {canInstall && (
          <div className="relative mx-auto mt-10">
            <button
              onClick={install}
              className="group inline-flex items-center gap-2.5 rounded-xl border border-border/30 bg-card/60 backdrop-blur-md px-6 py-3 text-sm font-light tracking-wide text-foreground transition-all hover:bg-foreground/10"
            >
              <Download className="h-4 w-4" />
              Download App
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        )}
      </div>
      </ScrollSection>


      <div id="demos" />
      <ScrollSection>
        <h2 className="sr-only">Live Asherin Intelligence Demos</h2>
        <LiveDemoStrip />
      </ScrollSection>
      <ScrollSection><TrustBand /></ScrollSection>

      {/* Extractable answer + sourced figures for generative engines. */}
      <ScrollSection>
        <div className="relative z-10 mx-auto max-w-3xl px-6 pb-8">
          <GeoBlock />
        </div>
      </ScrollSection>



      <ScrollSection>
      <div className="relative z-10 px-6 py-28 sm:py-40 overflow-hidden">
        {/* Aurora background */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35]">
          <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,hsl(0 0% 100% / 0.18),transparent_70%)] blur-3xl" />
          <div className="absolute left-[20%] top-[60%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,hsl(0_0%_100%/0.06),transparent_70%)] blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-foreground/20 bg-foreground/[0.04] px-3 py-1 mb-8">
              <span className="h-1 w-1 rounded-full bg-foreground animate-pulse" />
              <span className="text-[10px] font-light tracking-[0.3em] text-foreground/80 uppercase">how asherin approaches the work</span>
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-extralight tracking-tight leading-[1.05] text-foreground">
              ai systems take <span className="italic font-thin text-muted-foreground/70">different approaches.</span>
              <br />
              asherin gathers <span className="bg-gradient-to-r from-foreground via-foreground to-foreground bg-clip-text text-transparent">relevant sources in one place.</span>
            </h2>
          </div>

          {/* Asymmetric bento */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-12 gap-4">
            {[
              { n: "01", Icon: AlertCircle, title: "open-ended inquiry", desc: "ask a wide range of questions and receive sources, context, and clear limitations.", span: "md:col-span-5 md:row-span-2", tall: true },
              { n: "02", Icon: Smile, title: "evidence before certainty", desc: "direct answers that distinguish observed facts, interpretation, and uncertainty.", span: "md:col-span-7" },
              { n: "03", Icon: AlertTriangle, title: "practical code support", desc: "help with architecture, multi-file debugging, and working builds, with room for review and testing.", span: "md:col-span-7" },
            ].map(({ n, Icon, title, desc, span, tall }) => (
              <div key={n} className={`group relative ${span} rounded-3xl overflow-hidden`}>
                {/* gradient border */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-foreground/20 via-foreground/10 to-transparent opacity-40 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative m-[1px] h-[calc(100%-2px)] rounded-3xl bg-gradient-to-br from-card/80 via-background/90 to-background backdrop-blur-xl p-8 sm:p-10">
                  {/* corner mark */}
                  <div className="absolute right-6 top-6 font-mono text-[10px] tracking-[0.3em] text-foreground/40">{n} / 03</div>
                  {/* glow orb */}
                  <div aria-hidden className="absolute -right-20 -bottom-20 h-60 w-60 rounded-full bg-foreground/[0.04] blur-3xl group-hover:bg-foreground/[0.12] transition-all duration-700" />

                  <div className="relative flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-foreground/10 bg-foreground/[0.03] group-hover:border-foreground/30 group-hover:bg-foreground/[0.06] transition-all duration-500">
                      <Icon className="h-5 w-5 text-foreground/80 group-hover:text-foreground transition-colors" />
                    </div>
                    <div className="flex-1">
                      <h3 className={`${tall ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"} font-extralight tracking-tight text-foreground leading-tight`}>{title}</h3>
                      <p className={`mt-4 ${tall ? "text-base" : "text-sm"} font-extralight leading-relaxed text-muted-foreground max-w-md`}>{desc}</p>

                      {tall && (
                        <div className="mt-8 flex items-center gap-2 text-[10px] font-mono tracking-[0.25em] text-foreground/60 uppercase">
                          <span className="h-px w-8 bg-foreground/40" />
                          direct-answer policy
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-20 text-center">
            <p className="text-2xl sm:text-3xl font-extralight tracking-tight text-foreground leading-snug">
              a research and work platform.
              <br />
              <span className="italic text-muted-foreground/70">built to support careful, source-aware work.</span>
            </p>
          </div>
        </div>
      </div>
      </ScrollSection>

      <ScrollSection>
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            bring a question.
            <br />
            <span className="text-muted-foreground">review the sources, reasoning, and stated limits.</span>
          </h2>

          {/* Demo Widget */}
          <div className="mt-16 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden text-left">
            {/* Demo Header */}
            <div className="flex items-center justify-between border-b border-border/20 px-6 py-4">
              <span className="text-sm font-light tracking-[0.2em] text-foreground">ASHERIN LIVE</span>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-extralight tracking-wide text-muted-foreground">LIVE</span>
              </div>
            </div>

            {/* Demo Body */}
            <div className="p-6 sm:p-8">
              <p className="text-sm font-extralight text-muted-foreground">
                Type any question below.
              </p>
              <p className="mb-6 text-sm font-extralight text-muted-foreground">
                No sign up. No filters. See the difference.
              </p>

              {demoCount >= maxDemos ? (
                <div className="rounded-xl border border-border/30 bg-background/30 px-4 py-4 text-center">
                  <p className="text-sm font-extralight text-muted-foreground">
                    You've used all {maxDemos} free demo messages. Sign up for full access.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleDemo} className="flex items-center gap-3 rounded-xl border border-border/30 bg-background/30 px-4 py-3">
                  <input
                    type="text"
                    value={demoQuery}
                    onChange={(e) => setDemoQuery(e.target.value)}
                    placeholder="Ask Asherin anything..."
                    className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none"
                  />
                  <button type="submit" aria-label="Send message" className="text-foreground/60 hover:text-foreground transition-colors">
                    <Send className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-extralight text-muted-foreground/50">{maxDemos - demoCount} left</span>
                </form>
              )}

              {(demoResponse || isTyping) && (
                <div className="mt-6 rounded-xl border border-border/10 bg-background/20 p-5 max-h-[60vh] overflow-y-auto">
                  <div className="prose prose-invert prose-sm max-w-none font-extralight overflow-hidden [&_h1]:text-lg [&_h1]:font-light [&_h1]:tracking-wide [&_h1]:mt-6 [&_h1]:mb-3 [&_h2]:text-base [&_h2]:font-light [&_h2]:tracking-wide [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-light [&_h3]:tracking-wide [&_h3]:mt-4 [&_h3]:mb-2 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-foreground/90 [&_p]:mb-3 [&_ul]:space-y-1.5 [&_ul]:my-3 [&_ol]:space-y-1.5 [&_ol]:my-3 [&_li]:text-sm [&_li]:text-foreground/90 [&_strong]:text-foreground [&_a]:text-accent [&_a]:underline [&_code]:bg-secondary/50 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:break-all [&_pre]:bg-secondary/30 [&_pre]:rounded-lg [&_pre]:p-4 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:max-w-full [&_blockquote]:border-l-2 [&_blockquote]:border-accent/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_hr]:border-border/20 [&_hr]:my-4">
                    <ReactMarkdown>{demoResponse}</ReactMarkdown>
                  </div>
                  {isTyping && <span className="inline-block w-0.5 h-4 bg-foreground/60 animate-pulse ml-1 align-text-bottom" />}
                  
                  {/* Action buttons */}
                  {!isTyping && demoResponse.length > 20 && (
                    <div className="mt-4 pt-3 border-t border-border/10 flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setShowNeural(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-light transition-all text-accent/70 hover:text-accent hover:bg-accent/10 border border-accent/20"
                      >
                        <Brain className="h-3 w-3" />
                        Show Thinking Process
                      </button>
                      <button
                        onClick={() => setShowDiagram(!showDiagram)}
                        aria-label={showDiagram ? "Hide reasoning diagram" : "Show reasoning diagram"}
                        aria-pressed={showDiagram}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-light transition-all ${
                          showDiagram
                            ? "bg-accent/15 text-accent border border-accent/20"
                            : "text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5 border border-border/15"
                        }`}
                      >
                        <GitBranch className="h-3 w-3" />
                        Diagram
                      </button>
                    </div>
                  )}

                  {/* Diagram Panel */}
                  <MessageDiagramPanel
                    open={showDiagram}
                    content={demoResponse}
                    onClose={() => setShowDiagram(false)}
                  />

                  {/* Neural Thinking Modal */}
                  <NeuralThinkingModal
                    open={showNeural}
                    query={lastDemoQuery}
                    response={demoResponse}
                    onClose={() => setShowNeural(false)}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Below Demo CTA */}
          <div className="mt-12 flex flex-col items-center gap-4">
            <p className="text-xl font-extralight tracking-wide text-foreground">Liked what you saw?</p>
            <button onClick={() => { setAuthIsLogin(false); setShowAuth(true); }} className="group flex items-center gap-2 rounded-xl bg-amber-400 px-8 py-4 text-sm font-medium tracking-wide text-black transition-all hover:bg-amber-300 shadow-[0_10px_40px_-8px_rgba(251,191,36,0.55)]">
              Get Full Access. No limits. No restrictions. No apologies.
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </div>
      </ScrollSection>

      <ScrollSection>
      <div className="relative z-10 px-6 py-24 sm:py-32 overflow-hidden">
        {/* Aurora field */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50">
          <div className="absolute left-[15%] top-[10%] h-[420px] w-[420px] rounded-full blur-3xl"
               style={{ background: "radial-gradient(circle, hsl(0 0% 100% / 0.10), transparent 70%)" }} />
          <div className="absolute right-[10%] bottom-[5%] h-[520px] w-[520px] rounded-full blur-3xl"
               style={{ background: "radial-gradient(circle, hsl(30 80% 50% / 0.06), transparent 70%)" }} />
        </div>

        <div className="relative mx-auto max-w-7xl">
          {/* Section eyebrow */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-foreground/40" />
            <span className="font-mono text-[10px] tracking-[0.35em] uppercase text-foreground/60">◊ Section · 02 / 06</span>
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-foreground/40" />
          </div>

          <h2 className="text-center text-3xl sm:text-5xl md:text-6xl font-extralight tracking-tight leading-[1.05]">
            <span className="bg-gradient-to-r from-foreground via-foreground to-foreground/80 bg-clip-text text-transparent">
              Built For People Who Build.
            </span>
            <br />
            <span className="text-muted-foreground/70 italic font-thin">Not People Who Browse.</span>
          </h2>

          <p className="mx-auto mt-6 max-w-xl text-center text-sm font-extralight tracking-wide text-muted-foreground/70">
            Six disciplines. One intelligence stack. Each pane below is a different angle of the same engine. Pick the one closest to your craft.
          </p>

          {/* Bento — 12 col asymmetric */}
          <div className="mt-16 grid grid-cols-12 gap-3 sm:gap-4">
            {[
              { idx: "01", icon: Hammer, title: "For Builders", desc: "Build full-stack products with an AI that holds context across large codebases and doesn't stop when the problem gets hard.", span: "col-span-12 md:col-span-5", tag: "Full-Stack" },
              { idx: "02", icon: FlaskConical, title: "For Researchers", desc: "Structured analysis backed by live search and cited sources, with the gaps named instead of smoothed over.", span: "col-span-12 md:col-span-4", tag: "OSINT" },
              { idx: "03", icon: Code, title: "For Coders", desc: "A coding engine that keeps your context. Debug, architect, and ship production code, with persistent context across every session.", span: "col-span-12 md:col-span-3", tag: "Production" },
              { idx: "04", icon: Target, title: "For Strategists", desc: "Predictive intelligence, scenario simulation, and signal detection for markets, conflicts, and complex systems.", span: "col-span-12 md:col-span-3", tag: "Forecast" },
              { idx: "05", icon: Feather, title: "For Writers", desc: "Write with your voice intact. Asherin adapts to your tone and delivers raw creative output, no corporate rewrites.", span: "col-span-12 md:col-span-4", tag: "Voice-True" },
              { idx: "06", icon: BarChart3, title: "For Analysts", desc: "Deep intelligence on economic events, structural trends, and data patterns, with full OSINT and entity resolution tooling.", span: "col-span-12 md:col-span-5", tag: "Entity-Res" },
            ].map(({ idx, icon: Icon, title, desc, span, tag }) => (
              <div
                key={idx}
                className={`group relative ${span} rounded-3xl border border-foreground/10 bg-gradient-to-br from-background/60 via-background/30 to-background/10 backdrop-blur-2xl p-7 sm:p-8 text-left overflow-hidden transition-all duration-700 hover:border-foreground/30 hover:-translate-y-0.5`}
              >
                {/* Golden corner accents */}
                <span aria-hidden className="absolute left-0 top-0 h-6 w-6 border-l border-t border-foreground/40 rounded-tl-3xl" />
                <span aria-hidden className="absolute right-0 bottom-0 h-6 w-6 border-r border-b border-foreground/20 rounded-br-3xl" />

                {/* Glow orb on hover */}
                <span aria-hidden
                  className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                  style={{ background: "radial-gradient(circle, hsl(0 0% 100% / 0.18), transparent 70%)" }}
                />

                {/* Top hairline */}
                <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent" />

                <div className="relative flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative grid h-11 w-11 place-items-center rounded-xl border border-foreground/15 bg-background/40">
                      <Icon className="h-5 w-5 text-foreground/90" strokeWidth={1.25} />
                      <span aria-hidden className="absolute inset-0 rounded-xl bg-gradient-to-br from-foreground/[0.08] to-transparent" />
                    </div>
                    <span className="font-mono text-[10px] tracking-[0.25em] text-foreground/40">{idx}</span>
                  </div>
                  <span className="rounded-full border border-foreground/20 bg-foreground/5 px-2.5 py-0.5 text-[9px] font-mono tracking-[0.18em] uppercase text-foreground/70">
                    {tag}
                  </span>
                </div>

                <h3 className="relative mt-7 text-xl sm:text-[22px] font-extralight tracking-tight text-foreground">
                  {title}
                </h3>
                <div aria-hidden className="relative mt-3 h-px w-10 bg-gradient-to-r from-foreground/60 to-transparent transition-all duration-500 group-hover:w-20" />
                <p className="relative mt-4 text-[14px] font-light leading-relaxed text-foreground/85">
                  {desc}
                </p>

                {/* Bottom status row */}
                <div className="relative mt-6 flex items-center gap-2 pt-4 border-t border-foreground/[0.06]">
                  <span className="h-1.5 w-1.5 rounded-full bg-foreground/80 shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
                  <span className="font-mono text-[9px] tracking-[0.25em] uppercase text-foreground/40">Live · Operational</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </ScrollSection>

      {/* ===== SOFTWARE ARSENAL — Dashboard Modules ===== */}
      <ScrollSection>
      <div className="relative z-10 px-6 py-28 sm:py-40 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute left-[10%] top-[20%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,hsl(0_0%_100%_/_0.08),transparent_70%)] blur-3xl" />
          <div className="absolute right-[5%] bottom-[10%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,hsl(0_0%_100%_/_0.05),transparent_70%)] blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-col items-center text-center mb-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/[0.03] px-3 py-1 mb-8">
              <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">/ 03 / Arsenal</span>
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-extralight tracking-tight leading-[1.05] text-foreground">
              Every Tool.
              <br />
              <span className="italic text-muted-foreground/60">One Dashboard.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-base font-extralight leading-relaxed text-muted-foreground/80">
              All software modules available inside your Asherin workspace. Core modules ship in the $18/month Asherin plan; the advanced intelligence suite (Azplen, AXRLEN, ZEEION, Zerlal and more) ships in Asherin Pro at $399/month.
            </p>
          </div>

          {[
            {
              group: "Core",
              blurb: "The intelligence engine",
              items: [
                { icon: Brain, name: "Asherin Chat", codename: "Intelligence Engine", desc: "Persistent memory, live tool calls and end-to-end encryption. Routes to Gemini, Venice mistral-31-24b, or your own key." },
              ]
            },
            {
              group: "Create",
              blurb: "Generate images, documents, and designs",
              items: [
                { icon: Zap, name: "Vibe Imager", codename: "AI Image Generation", desc: "Conversational AI image creation. Describe what you want and watch it render." },
                { icon: Cpu, name: "ZANOEM Design Lab", codename: "Universal Design", desc: "First-principles design from atoms to universes: FEA, thermal, and material simulation." },
                { icon: FileText, name: "Document Generator", codename: "PDF / eBook / Slides", desc: "Turn any content into a polished PDF, eBook, or slideshow instantly." },
              ]
            },
            {
              group: "Analyze",
              blurb: "Data intelligence, forecasting, and behavioral analysis",
              items: [
                { icon: BarChart3, name: "Azplen", codename: "Data Intelligence", desc: "Ingest, analyze, branch, and visualize datasets of any size." },
                { icon: Target, name: "Zeeion", codename: "Financial Intelligence", desc: "Cost savings, efficiency scoring, and budget optimization engine." },
                { icon: Cpu, name: "Pattern Analysis", codename: "Pattern Engine", desc: "Visual pattern recognition and forecasting across complex datasets." },
                { icon: Clock, name: "Time-Series", codename: "Temporal Analysis", desc: "Temporal analysis with anomaly detection and forecasting." },
                { icon: Globe, name: "Geospatial", codename: "Geo Intelligence", desc: "Spatial-temporal analysis and route optimization." },
              ]
            },
            {
              group: "Investigate",
              blurb: "Search, OSINT, prediction, and security tools",
              items: [
                { icon: Search, name: "Zophiel", codename: "Search Intelligence", desc: "Privacy-first source-credibility search across 30+ intelligence lanes." },
                { icon: Brain, name: "AXRLEN", codename: "Predictive Intelligence", desc: "Live global event prediction, scenario simulation, and Monte Carlo modeling." },
                { icon: Download, name: "File Scrapper", codename: "Document Extraction", desc: "Pull all text from any document format via AI-powered extraction." },
                { icon: Flag, name: "Daily Briefings", codename: "Intel Briefings", desc: "Competitor, regulatory, and market signals delivered every morning." },
              ]
            },
            {
              group: "Build",
              blurb: "IDE, notebooks, agents, and plugins",
              items: [
                { icon: Code, name: "Asherin IDE", codename: "Cloud IDE", desc: "Browser IDE with project files, terminals, sessions, and BYOK AI assistance." },
                { icon: Feather, name: "Intelligence Notebooks", codename: "Notebooks", desc: "Shared analysis sessions with live SQL execution and team collaboration." },
                { icon: GitBranch, name: "Zahten", codename: "Agent Forge", desc: "Design, scaffold, and harden autonomous agents, then publish them as custom tabs." },
                { icon: Code, name: "Code Snippets", codename: "Snippet Vault", desc: "Save, tag, and reuse code blocks across all your conversations." },
              ]
            },
            {
              group: "Workspace",
              blurb: "Library, memory, teams, and security",
              items: [
                { icon: Layers, name: "Library", codename: "Knowledge Base", desc: "Saved files, references, and centralized document repository." },
                { icon: Layers, name: "Projects", codename: "Project Folders", desc: "Organize conversations, files, and intelligence into dedicated workspaces." },
                { icon: Brain, name: "Memory Center", codename: "Long-Term Memory", desc: "Persistent context and recall that carries across every session." },
                { icon: Users, name: "Team Workspace", codename: "Teams", desc: "Collaborate in real time with role-based access control." },
                { icon: Users, name: "Community", codename: "Community Hub", desc: "Ask questions, request features, and vote on the roadmap." },
                { icon: Moon, name: "Vedic Astrology", codename: "Sidereal Charts", desc: "Sidereal chart calculations, dasha cycles, and astro-temporal forecasting." },
                { icon: Lock, name: "Guardian Vault", codename: "Security Center", desc: "Centralized security command center with TOTP MFA and credential hygiene." },
              ]
            },
          ].map((category, ci) => (
            <div key={category.group} className={`mb-16 last:mb-0 ${ci >= 2 && !arsenalExpanded ? "hidden" : ""}`}>
              <div className="flex items-center gap-4 mb-6">
                <span className="font-mono text-[10px] tracking-[0.3em] text-emerald-400/80 uppercase">{category.group}</span>
                <span className="h-px flex-1 bg-gradient-to-r from-emerald-400/20 to-transparent" />
                <span className="text-[10px] font-light tracking-wide text-muted-foreground/50">{category.blurb}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {category.items.map((item) => (
                  <div key={item.name} className="group relative rounded-2xl border border-border/15 bg-card/30 backdrop-blur-md p-5 hover:border-foreground/20 hover:bg-card/50 transition-all duration-500">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/[0.03] group-hover:border-foreground/25 transition-all">
                        <item.icon className="h-4 w-4 text-foreground/70 group-hover:text-foreground transition-colors" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-light tracking-tight text-foreground">{item.name}</h3>
                        <p className="text-[10px] font-mono tracking-wider text-muted-foreground/50 uppercase mt-0.5">{item.codename}</p>
                        <p className="mt-2 text-xs font-extralight leading-relaxed text-muted-foreground/80">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Curiosity-gap expand button */}
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => setArsenalExpanded((v) => !v)}
              className="group inline-flex items-center gap-3 rounded-full border border-foreground/25 bg-foreground/[0.04] backdrop-blur-md px-7 py-3.5 text-xs font-light tracking-[0.22em] uppercase text-foreground hover:bg-foreground hover:text-background transition-all"
            >
              {arsenalExpanded ? "Hide the rest" : "See all 30+ tools"}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${arsenalExpanded ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
      </div>
      </ScrollSection>

      {/* ===== THE PLATFORM — Bento ===== */}
      <ScrollSection>
      <div className="relative z-10 px-6 py-28 sm:py-40 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute right-[10%] top-[20%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,hsl(0 0% 100% / 0.12),transparent_70%)] blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-col items-center text-center mb-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/[0.03] px-3 py-1 mb-8">
              <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">/ 02 / Platform</span>
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-extralight tracking-tight leading-[1.05] text-foreground">
              The Platform.
              <br />
              <span className="italic text-muted-foreground/60">Every Capability.</span>{" "}
              <span className="bg-gradient-to-r from-foreground to-foreground bg-clip-text text-transparent">One Dashboard.</span>
            </h2>
          </div>

          {/* Bento grid 12-col */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {[
              { Icon: Unlock, title: "Direct Answers", desc: "Analytical answers without corporate hedging. Refusal behaviour follows the provider you route to — Venice mistral-31-24b is the permissive default, Gemini keeps its vendor policy.", span: "md:col-span-7 md:row-span-2", featured: true, tag: "Core" },
              { Icon: Monitor, title: "Coding Engine", desc: "Production-grade output on complex builds, debugging, and multi-file architecture.", span: "md:col-span-5", tag: "Engine" },
              { Icon: Search, title: "Live Web Intelligence", desc: "Privacy-first real-time search. Current data, not 2-year-old training sets.", span: "md:col-span-5", tag: "Realtime" },
              { Icon: Brain, title: "Persistent Memory", desc: "Asherin remembers your context, preferences, and projects across every session.", span: "md:col-span-4", tag: "Stateful" },
              { Icon: Users, title: "Team Workspace", desc: "Collaborate in real time. Share threads, outputs, and builds with your team.", span: "md:col-span-4", tag: "Collab" },
              { Icon: Globe, title: "Multi-Language Output", desc: "Thinks and delivers in any language. Same raw output. No filtered translations.", span: "md:col-span-4", tag: "Global" },
            ].map(({ Icon, title, desc, span, featured, tag }, i) => (
              <div key={title} className={`group relative ${span} rounded-3xl overflow-hidden min-h-[200px]`}>
                <div className={`absolute inset-0 rounded-3xl ${featured ? "bg-gradient-to-br from-foreground/25 via-foreground/5 to-transparent" : "bg-gradient-to-br from-foreground/10 via-transparent to-transparent"} opacity-50 group-hover:opacity-100 transition-opacity duration-700`} />
                <div className={`relative m-[1px] h-[calc(100%-2px)] rounded-3xl ${featured ? "bg-gradient-to-br from-card/90 via-background/95 to-background" : "bg-card/40"} backdrop-blur-xl p-7 sm:p-9 flex flex-col justify-between`}>
                  {featured && <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-foreground/[0.06] blur-3xl" />}

                  <div className="relative flex items-start justify-between">
                    <div className={`flex ${featured ? "h-14 w-14" : "h-11 w-11"} items-center justify-center rounded-2xl border border-foreground/10 bg-foreground/[0.03] group-hover:border-foreground/30 transition-all`}>
                      <Icon className={`${featured ? "h-6 w-6" : "h-5 w-5"} text-foreground/85 group-hover:text-foreground transition-colors`} />
                    </div>
                    <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground/40 uppercase">{tag}</span>
                  </div>

                  <div className="relative mt-6">
                    <h3 className={`${featured ? "text-2xl sm:text-3xl" : "text-lg"} font-extralight tracking-tight text-foreground leading-tight`}>{title}</h3>
                    <p className={`mt-3 ${featured ? "text-base max-w-md" : "text-sm"} font-extralight leading-relaxed text-muted-foreground`}>{desc}</p>
                    {featured && (
                      <div className="mt-8 flex items-center gap-3">
                        <div className="h-px flex-1 bg-gradient-to-r from-foreground/40 to-transparent" />
                        <span className="font-mono text-[10px] tracking-[0.3em] text-foreground/70 uppercase">No Guardrails</span>
                      </div>
                    )}
                  </div>

                  <div aria-hidden className="absolute bottom-3 right-4 font-mono text-[9px] tracking-[0.25em] text-muted-foreground/20">0{i + 1}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      </ScrollSection>

      {/* ===== INTELLIGENCE OS — Spec sheet ===== */}
      <ScrollSection>
      <div className="relative z-10 px-6 py-28 sm:py-40 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute left-[15%] bottom-[10%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,hsl(160_60%_50%/0.15),transparent_70%)] blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Left rail */}
            <div className="lg:col-span-5 lg:sticky lg:top-32">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.04] px-3 py-1 mb-6">
                <span className="h-1 w-1 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-light tracking-[0.3em] text-emerald-200/80 uppercase">System Spec</span>
              </div>
              <h2 className="text-4xl sm:text-5xl md:text-6xl font-extralight tracking-tight leading-[1.05] text-foreground">
                Not Just An <span className="italic text-muted-foreground/60">AI Chat.</span>
                <br />
                <span className="bg-gradient-to-r from-emerald-200 via-foreground to-foreground bg-clip-text text-transparent">A Complete Intelligence Operating System.</span>
              </h2>
              <p className="mt-6 text-sm font-extralight leading-relaxed text-muted-foreground max-w-md">
                Six discrete systems. One unified runtime. Every capability addressable from a single dashboard.
              </p>
              <div className="mt-8 flex items-center gap-3 font-mono text-[10px] tracking-[0.3em] text-muted-foreground/60 uppercase">
                <span className="h-px w-12 bg-foreground/30" />
                v1.0 Live
              </div>
            </div>

            {/* Right list — spec rows */}
            <div className="lg:col-span-7 space-y-3">
              {[
                { n: "S-01", label: "Operator-set model", desc: "You choose the provider. Venice mistral-31-24b is the permissive default; your own key overrides it." },
                { n: "S-02", label: "Real-Time Search", desc: "Privacy-first web intelligence with live data and source credibility tiers." },
                { n: "S-03", label: "Persistent Memory", desc: "Context that carries across every conversation and session." },
                { n: "S-04", label: "Public Intelligence & Forensics", desc: "Public-source intelligence: Asherin Engine reach-back, entity resolution and cited dossier output." },
                { n: "S-05", label: "Predictive Intelligence", desc: "AI event forecasting with signal detection and confidence scoring." },
                { n: "S-06", label: "Data Privacy", desc: "End-to-end encryption. Your data is never sold or used for training." },
              ].map(({ n, label, desc }) => (
                <div key={n} className="group relative rounded-2xl border border-border/15 bg-card/30 backdrop-blur-md p-6 hover:border-emerald-400/30 hover:bg-card/50 transition-all duration-500">
                  <div className="flex items-start gap-5">
                    <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground/50 uppercase pt-1 shrink-0 w-14">{n}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3">
                        <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <h3 className="text-base font-light tracking-tight text-foreground">{label}</h3>
                      </div>
                      <p className="mt-2 pl-[26px] text-sm font-extralight leading-relaxed text-muted-foreground">{desc}</p>
                    </div>
                    <span className="font-mono text-[9px] tracking-[0.25em] text-emerald-400/60 uppercase shrink-0">Online</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </ScrollSection>

      {/* ===== BYOK — Premium ===== */}
      <ScrollSection>
      <div className="relative z-10 px-6 py-28 sm:py-40 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute left-1/2 top-1/4 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,hsl(0 0% 100% / 0.14),transparent_65%)] blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-foreground/30 bg-foreground/[0.05] px-4 py-1.5 mb-8 shadow-[0_0_40px_-10px_hsl(0 0% 100% / 0.4)]">
              <Key className="h-3 w-3 text-foreground" />
              <span className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">Bring Your Own Key</span>
              <span className="font-mono text-[9px] tracking-[0.2em] text-foreground/60">/ BYOK</span>
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-extralight tracking-tight leading-[1.05] text-foreground">
              Your Keys. <span className="italic text-muted-foreground/60">Your Models.</span>
              <br />
              <span className="bg-gradient-to-r from-foreground via-foreground to-foreground bg-clip-text text-transparent">Your Key. Your Provider.</span>
            </h2>
            <p className="mt-8 max-w-2xl mx-auto text-base font-extralight leading-relaxed text-muted-foreground">
              Plug in your own API keys from any major AI provider. Asherin adds the reasoning, memory and tool layer on top; the refusal behaviour is whatever your chosen model ships with — Asherin does not remove a vendor's safety layer.
            </p>
          </div>

          {/* Pillar cards */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { n: "01", Icon: Key, title: "Bring Your Own Key", desc: "Plug in API keys from any provider. Your keys, your billing, your control. No middleman." },
              { n: "02", Icon: Layers, title: "Multi-Model at Once", desc: "Send one prompt to 2–4 models in parallel. See every response side-by-side." },
              { n: "03", Icon: Shuffle, title: "Consensus Engine", desc: "When models agree, you get one clean answer. When they disagree, you see exactly where." },
              { n: "04", Icon: Cpu, title: "Asherin Brain Intact", desc: "Every model runs through Asherin's uncensored system prompt. Same depth, zero filters." },
            ].map(({ n, Icon, title, desc }) => (
              <div key={n} className="group relative rounded-3xl overflow-hidden">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-foreground/15 to-transparent opacity-30 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative m-[1px] h-[calc(100%-2px)] rounded-3xl bg-gradient-to-b from-card/80 to-background/80 backdrop-blur-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-foreground/15 bg-foreground/[0.04] group-hover:border-foreground/40 group-hover:bg-foreground/[0.08] transition-all">
                      <Icon className="h-5 w-5 text-foreground/80 group-hover:text-foreground transition-colors" />
                    </div>
                    <span className="font-mono text-[10px] tracking-[0.3em] text-foreground/40">{n}</span>
                  </div>
                  <h3 className="text-base font-light tracking-tight text-foreground">{title}</h3>
                  <p className="mt-3 text-xs font-extralight leading-relaxed text-muted-foreground">{desc}</p>
                  <div className="mt-6 h-px bg-gradient-to-r from-foreground/30 via-foreground/10 to-transparent" />
                </div>
              </div>
            ))}
          </div>

          {/* Providers — premium chip ticker */}
          <div className="mt-20">
            <div className="flex items-center justify-center gap-4 mb-10">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-foreground/40" />
              <p className="font-mono text-[10px] font-light tracking-[0.35em] text-foreground/70 uppercase">Supported AI Providers</p>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-foreground/40" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { name: "OpenAI", country: "US", models: "GPT-5.5, GPT-3.5" },
                { name: "Anthropic", country: "US", models: "Opus 4.5, Claude 2.1" },
                { name: "Google", country: "US", models: "Gemini 3 Pro, Gemini 1.0" },
                { name: "xAI", country: "US", models: "Grok 5, Grok Beta" },
                { name: "Meta", country: "US", models: "Llama 4 Behemoth, Llama 2 70B" },
                { name: "Perplexity", country: "US", models: "Sonar Pro, PPLX 7B" },
                { name: "Venice AI", country: "US", models: "Uncensored, Llama 3 8B" },
                { name: "IBM", country: "US", models: "Granite 3.1, Granite 13B" },
                { name: "Amazon", country: "US", models: "Nova Pro, Titan Text" },
                { name: "NVIDIA", country: "US", models: "Nemotron 4, Nemotron 3" },
                { name: "Mistral", country: "FR", models: "Medium 3.1, Codestral" },
                { name: "AI21", country: "UK", models: "Jamba 1.6, Jurassic-2" },
                { name: "Reka", country: "UK", models: "Reka Core, Reka Flash" },
                { name: "Cohere", country: "CA", models: "Command R+, Embed English" },
                { name: "Sarvam AI", country: "IN", models: "Sarvam 3, Sarvam 1" },
                { name: "Krutrim", country: "IN", models: "Krutrim Pro, Krutrim Base" },
                { name: "TWO AI", country: "IN", models: "TWO 1.0, TWO Base" },
                { name: "DeepSeek", country: "CN", models: "DeepSeek V3.2, R1" },
                { name: "Alibaba Qwen", country: "CN", models: "Qwen3 Max, Coder Plus" },
                { name: "Zhipu GLM", country: "CN", models: "GLM-4.6, GLM-4.5 Air" },
                { name: "Moonshot Kimi", country: "CN", models: "Kimi K2, K2 Turbo" },
                { name: "Baidu ERNIE", country: "CN", models: "ERNIE 5.0, X1" },
                { name: "MiniMax", country: "CN", models: "M2, Text-01 (4M ctx)" },
                { name: "Maritaca", country: "BR", models: "Sabiá 3, Sabiá 2" },
                { name: "Widelabs", country: "BR", models: "Widelabs 1.0, Base" },
                { name: "Maincode", country: "AU", models: "Matrix-1, Matrix Mini" },
                { name: "Leonardo", country: "AU", models: "Phoenix 1.0, Diffusion" },
                { name: "Awarri", country: "NG", models: "LAM-1, LAM-1 Base" },
                { name: "Lelapa AI", country: "NG", models: "Vulavula, InkubaLM" },
                { name: "Latam-GPT", country: "PE", models: "Latam-GPT 1, Base" },
              ].map((p, i) => (
                <div key={p.name} className="group relative rounded-xl border border-border/15 bg-card/20 backdrop-blur-md p-4 hover:border-foreground/30 hover:bg-card/40 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[9px] tracking-[0.25em] text-muted-foreground/40">{String(i + 1).padStart(2, "0")}</span>
                      <p className="text-sm font-light tracking-tight text-foreground">{p.name} <span className="text-[9px] font-mono tracking-wider text-muted-foreground/40 ml-1">{p.country}</span></p>
                    </div>
                    <span className="h-1.5 w-1.5 rounded-full bg-foreground/60 group-hover:bg-foreground transition-colors" />
                  </div>
                  <p className="mt-2 ml-9 text-[10px] font-extralight leading-relaxed text-muted-foreground/70">{p.models}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-12 text-center text-sm font-extralight italic text-muted-foreground/70">
            No vendor lock-in. Switch models per message. Or run them all at once.
          </p>
        </div>
      </div>
      </ScrollSection>




      <ScrollSection>
      <DashboardPreview />
      </ScrollSection>




      {/* ───────── The Free Manifesto ───────── */}
      <ScrollSection>
      <div className="relative z-10 px-6 py-28 sm:py-36 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/4 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,hsl(0_0%_100%/0.05),transparent_70%)] blur-3xl" />
        <div className="mx-auto max-w-6xl text-center relative">
          <div className="inline-flex items-center gap-3 mb-7">
            <span className="h-px w-12 bg-gradient-to-r from-transparent to-foreground/30" />
            <span className="font-mono text-[10px] tracking-[0.35em] uppercase text-foreground/50">◊ Section · 03 / 06 · Free Forever</span>
            <span className="h-px w-12 bg-gradient-to-l from-transparent to-foreground/30" />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-tight leading-[1.05] text-foreground mb-16">
            Two Plans. Honest Pricing.
            <br />
            <span className="text-muted-foreground">Cancel With One Click.</span>
          </h2>
          <SubscriptionPlans compact />

        </div>
      </div>
      </ScrollSection>


      {/* ───────── Zahten Agent Forge ───────── */}
      <ScrollSection>
      <div className="relative z-10 px-6 py-28 sm:py-36 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute right-[10%] top-[20%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,hsl(0_0%_100%/0.06),transparent_70%)] blur-3xl" />
        <div className="mx-auto max-w-6xl relative">
          <div className="text-center">
            <div className="inline-flex items-center gap-3 mb-7">
              <span className="h-px w-12 bg-gradient-to-r from-transparent to-foreground/30" />
              <span className="font-mono text-[10px] tracking-[0.35em] uppercase text-foreground/50">◊ Section · 04 / 06 · Forge</span>
              <span className="h-px w-12 bg-gradient-to-l from-transparent to-foreground/30" />
            </div>
            <p className="text-[10px] font-mono tracking-[0.35em] text-foreground/40 uppercase mb-5">
              Zahten Agent Forge
            </p>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-extralight tracking-tight text-foreground leading-[1.05]">
              Don't see the software you need?
              <br />
              <span className="text-muted-foreground">Build it. Ship it. Run it inside Asherin.</span>
            </h2>
          </div>

          <div className="mt-12 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 relative rounded-3xl border border-foreground/10 bg-gradient-to-br from-background/60 via-background/30 to-background/10 backdrop-blur-2xl p-8 sm:p-10 overflow-hidden">
              <span aria-hidden className="absolute left-0 top-0 h-6 w-6 border-l border-t border-foreground/30 rounded-tl-3xl" />
              <span aria-hidden className="absolute right-0 bottom-0 h-6 w-6 border-r border-b border-foreground/20 rounded-br-3xl" />
              <p className="font-mono text-[10px] tracking-[0.3em] text-foreground/40 uppercase mb-4">◈ Mission Brief</p>
              <p className="text-sm sm:text-base font-extralight leading-relaxed text-muted-foreground">
                If we don't ship the tool you want, build it yourself with <span className="text-foreground">Zahten</span>, our autonomous agent forge.
                Spin up your own tab, your own module, your own intelligence engine inside Asherin and wire it directly to your own LLM API key.
                You pick the model and the key. Asherin supplies the reasoning, tools and memory around it, and states what it cannot verify instead of padding the answer.
              </p>
              <p className="mt-5 text-sm sm:text-base font-extralight leading-relaxed text-muted-foreground">
                Build any kind of software you want: research engines, trading bots, OSINT pipelines, creative tools, simulators, forensic systems,
                no matter the depth, no matter the use case. If you can describe it, Zahten can scaffold it, harden it, and dock it into your dashboard
                as a permanent custom tab.
              </p>
            </div>

            <div className="lg:col-span-5 grid grid-cols-1 gap-4">
              {[
                { n: "01", t: "Forge", d: "Describe the software. Zahten plans the architecture, scaffolds the code, and hardens it for production." },
                { n: "02", t: "Wire",  d: "Plug in your own API key from any major provider. We uncensor the model so your tool answers anything." },
                { n: "03", t: "Dock",  d: "Publish it as a custom tab inside your dashboard. Yours forever. It runs sandboxed, side-by-side with everything." },
              ].map(({ n, t, d }) => (
                <div key={n} className="group relative rounded-2xl border border-foreground/10 bg-gradient-to-br from-background/60 via-background/30 to-background/10 backdrop-blur-2xl p-5 overflow-hidden transition-all duration-500 hover:border-foreground/25 hover:-translate-y-0.5">
                  <span aria-hidden className="absolute right-0 top-0 h-5 w-5 border-r border-t border-foreground/25 rounded-tr-2xl" />
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-[10px] tracking-[0.3em] text-foreground/40">{n}</span>
                    <h3 className="text-base font-light tracking-tight text-foreground">{t}</h3>
                  </div>
                  <p className="mt-2 text-[12.5px] font-extralight leading-relaxed text-muted-foreground">{d}</p>
                  <div aria-hidden className="mt-3 h-px w-10 bg-gradient-to-r from-foreground/40 to-transparent transition-all duration-500 group-hover:w-20" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-foreground/30 bg-foreground/5 px-7 py-3 text-xs font-light tracking-[0.18em] text-foreground hover:bg-foreground hover:text-background transition-all uppercase"
            >
              Open Dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              to="/forums"
              className="inline-flex items-center gap-2 rounded-full border border-border/30 px-7 py-3 text-xs font-light tracking-[0.18em] text-muted-foreground hover:text-foreground transition-all uppercase"
            >
              Visit Forums
            </Link>
          </div>
        </div>
      </div>
      </ScrollSection>

      {/* ───────── Privacy ───────── */}
      <ScrollSection>
      <div className="relative z-10 px-6 py-28 sm:py-36 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute left-[15%] top-1/2 h-[450px] w-[450px] rounded-full bg-[radial-gradient(circle,hsl(0_0%_100%/0.05),transparent_70%)] blur-3xl" />
        <div className="mx-auto max-w-6xl relative">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-3 mb-7">
              <span className="h-px w-12 bg-gradient-to-r from-transparent to-foreground/30" />
              <span className="font-mono text-[10px] tracking-[0.35em] uppercase text-foreground/50">◊ Section · 05 / 06 · Vault</span>
              <span className="h-px w-12 bg-gradient-to-l from-transparent to-foreground/30" />
            </div>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-extralight tracking-tight leading-[1.05] text-foreground">
              Your Words Never Leave The Room.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-5 relative rounded-3xl border border-foreground/10 bg-gradient-to-br from-background/60 via-background/30 to-background/10 backdrop-blur-2xl p-8 sm:p-10 overflow-hidden">
              <span aria-hidden className="absolute left-0 top-0 h-6 w-6 border-l border-t border-foreground/30 rounded-tl-3xl" />
              <span aria-hidden className="absolute right-0 bottom-0 h-6 w-6 border-r border-b border-foreground/20 rounded-br-3xl" />
              <p className="font-mono text-[10px] tracking-[0.3em] text-foreground/40 uppercase mb-4">◈ Encryption Statement</p>
              <p className="text-base font-extralight leading-relaxed text-foreground/90">
                Every prompt you send to Asherin is encrypted end-to-end.
              </p>
              <p className="mt-6 text-xs font-mono tracking-[0.25em] text-foreground/40 uppercase">Never:</p>
              <ul className="mt-3 space-y-2.5">
                {[
                  "Sold to third parties",
                  "Used to train any AI model",
                  "Shared with advertisers",
                  "Read by our team",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm font-extralight text-foreground/85">
                    <span className="h-px w-4 bg-foreground/40" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-8 pt-6 border-t border-foreground/10 text-[13px] font-extralight leading-relaxed text-muted-foreground">
                Servers hosted in the United States. Your account data lives with you. Cancel and it's gone. Full stop.
              </p>
              <Link
                to="/privacy"
                className="mt-5 inline-flex items-center gap-2 text-[11px] font-mono tracking-[0.25em] uppercase text-foreground/80 hover:text-foreground transition-colors"
              >
                Read Our Full Privacy Policy <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { icon: Lock,     label: "End-To-End Encryption", n: "01" },
                { icon: ShieldOff,label: "Never Sold", n: "02" },
                { icon: Brain,    label: "Never Trains Our Models", n: "03" },
                { icon: Flag,     label: "US-Based Servers", n: "04" },
                { icon: X,        label: "No Third Party Access", n: "05" },
                { icon: Trash2,   label: "Delete Anytime", n: "06" },
              ].map(({ icon: Icon, label, n }) => (
                <div key={label} className="group relative rounded-2xl border border-foreground/10 bg-gradient-to-br from-background/60 via-background/30 to-background/10 backdrop-blur-2xl p-5 overflow-hidden transition-all duration-500 hover:border-foreground/25 hover:-translate-y-0.5">
                  <span aria-hidden className="absolute right-0 top-0 h-5 w-5 border-r border-t border-foreground/25 rounded-tr-2xl" />
                  <div className="flex items-center justify-between mb-4">
                    <div className="grid h-10 w-10 place-items-center rounded-xl border border-foreground/15 bg-foreground/[0.03]">
                      <Icon className="h-4 w-4 text-foreground" strokeWidth={1.5} />
                    </div>
                    <span className="font-mono text-[9px] tracking-[0.3em] text-foreground/30">{n}</span>
                  </div>
                  <span className="text-[13px] font-light tracking-wide text-foreground leading-snug">{label}</span>
                  <div aria-hidden className="mt-3 h-px w-8 bg-gradient-to-r from-foreground/40 to-transparent transition-all duration-500 group-hover:w-16" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </ScrollSection>

      {/* ───────── Prompt Intelligence ───────── */}
      <ScrollSection>
      <div className="relative z-10 px-6 py-28 sm:py-36 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute right-[10%] top-1/4 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,hsl(0_0%_100%/0.05),transparent_70%)] blur-3xl" />
        <div className="mx-auto max-w-6xl relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-3 mb-7">
                <span className="font-mono text-[10px] tracking-[0.35em] uppercase text-foreground/50">◊ Protocol · 06 / 06</span>
              </div>
              <p className="text-[10px] font-mono tracking-[0.35em] text-foreground/40 uppercase mb-4">◈ Prompt Intelligence</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-tight leading-[1.05] text-foreground">
                get more useful results
                <br />
                <span className="text-muted-foreground">from your prompts.</span>
              </h2>
              <p className="mt-6 text-sm font-extralight leading-relaxed tracking-wide text-muted-foreground">
                a broad first question can be a useful starting point. when context matters, one additional step can make the answer more specific:
              </p>
              <p className="mt-5 text-base font-light tracking-wide text-foreground italic border-l border-foreground/30 pl-4">
                "Ask Asherin what it needs first."
              </p>
              <p className="mt-6 text-sm font-extralight leading-relaxed tracking-wide text-muted-foreground">
                Instead of dumping every war in human history into a prompt and asking "predict the next conflict", ask Asherin what data points, context, and variables it needs to give you the most accurate prediction. The output transforms from a guess into an intelligence assessment.
              </p>
              <p className="mt-4 text-sm font-extralight leading-relaxed tracking-wide text-muted-foreground">
                this follows a simple research principle: the usefulness of an analysis depends on the relevance and quality of its inputs. <span className="text-foreground font-light">asherin</span> and <span className="text-foreground font-light">zophiel</span> are intended to help organize that work.
              </p>

              <Link to="/dashboard" className="mt-8 inline-flex items-center gap-2 rounded-full border border-foreground/30 bg-foreground/5 backdrop-blur-md px-6 py-3 text-xs font-light tracking-[0.18em] uppercase text-foreground transition-all hover:bg-foreground hover:text-background">
                Open Dashboard <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="lg:col-span-7 space-y-5">
              <div className="relative rounded-3xl border border-foreground/10 bg-gradient-to-br from-background/60 via-background/30 to-background/10 backdrop-blur-2xl p-7 overflow-hidden">
                <span aria-hidden className="absolute left-0 top-0 h-6 w-6 border-l border-t border-destructive/40 rounded-tl-3xl" />
                <div className="flex items-center justify-between mb-4">
                  <p className="font-mono text-[10px] tracking-[0.3em] text-destructive/70 uppercase">◈ a broad first prompt</p>
                  <span className="font-mono text-[9px] tracking-[0.3em] text-foreground/30">01 / starting point</span>
                </div>
                <div className="rounded-xl bg-background/40 border border-foreground/10 p-4">
                  <p className="text-xs font-light text-muted-foreground leading-relaxed font-mono">
                    "Upload all war history data and predict the next war"
                  </p>
                </div>
                <p className="mt-4 text-[11px] font-extralight text-muted-foreground/70">
                  → Broad, unfocused, missing critical variables. Output will be generic.
                </p>
              </div>

              <div className="relative rounded-3xl border border-foreground/15 bg-gradient-to-br from-background/60 via-background/30 to-background/10 backdrop-blur-2xl p-7 overflow-hidden">
                <span aria-hidden className="absolute left-0 top-0 h-6 w-6 border-l border-t border-emerald-400/40 rounded-tl-3xl" />
                <span aria-hidden className="absolute right-0 bottom-0 h-6 w-6 border-r border-b border-emerald-400/20 rounded-br-3xl" />
                <div className="flex items-center justify-between mb-4">
                  <p className="font-mono text-[10px] tracking-[0.3em] text-emerald-400/80 uppercase">◈ a more specific prompt</p>
                  <span className="font-mono text-[9px] tracking-[0.3em] text-foreground/30">02 / refined</span>
                </div>
                <div className="space-y-2">
                  <div className="rounded-xl bg-background/40 border border-foreground/10 p-4">
                    <p className="text-[10px] font-mono tracking-[0.25em] text-foreground/40 uppercase mb-1.5">You →</p>
                    <p className="text-xs font-light text-muted-foreground leading-relaxed">
                      "I want to predict geopolitical conflicts. What data, variables, and context do you need from me to produce the most accurate forecast?"
                    </p>
                  </div>
                  <div className="rounded-xl bg-background/40 border border-foreground/10 p-4">
                    <p className="text-[10px] font-mono tracking-[0.25em] text-foreground/40 uppercase mb-1.5">Asherin →</p>
                    <p className="text-xs font-light text-foreground/85 leading-relaxed">
                      "I need: region of focus, time horizon, economic indicators you're tracking, alliance structures, recent treaty changes, resource dependencies, and any specific actors of interest."
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-[11px] font-extralight text-emerald-400/80">
                  → focused, structured, and easier to evaluate.
                </p>
              </div>

              <div className="relative rounded-3xl border border-foreground/10 bg-gradient-to-br from-background/60 via-background/30 to-background/10 backdrop-blur-2xl p-6 text-center overflow-hidden">
                <span aria-hidden className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent" />
                <p className="text-xs font-extralight tracking-wide text-muted-foreground leading-relaxed">
                  Technology without intelligence is just hardware.
                  <br />
                  <span className="text-foreground font-light">careful analysis begins with relevant data.</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </ScrollSection>

      {/* ───────── FAQ ───────── */}
      <ScrollSection>
      <div className="relative z-10 px-6 py-28 sm:py-36 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,hsl(0_0%_100%/0.05),transparent_70%)] blur-3xl" />
        <div className="mx-auto max-w-3xl relative">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-3 mb-7">
              <span className="h-px w-12 bg-gradient-to-r from-transparent to-foreground/30" />
              <span className="font-mono text-[10px] tracking-[0.35em] uppercase text-foreground/50">◊ Field Manual · FAQ</span>
              <span className="h-px w-12 bg-gradient-to-l from-transparent to-foreground/30" />
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-tight leading-[1.05] text-foreground">
              The Questions Everyone Has.
              <br />
              <span className="text-muted-foreground">Answered Without Spin.</span>
            </h2>
          </div>

          <div className="space-y-3">
            <FaqItem q="How much does Asherin cost?" a='Asherin is $18/month for the core platform: chat, code, base Zophiel Search, persistent memory, workspace and E2E encryption. Asherin Pro is $399/month and adds the full intelligence suite: Azplen, Asherin Engine, advanced Briefings, Zophiel Pro, team collaboration, and 200 messages per 3-hour window. Enterprise (SSO, audit, dedicated capacity) is custom-priced.' />
            <FaqItem q="Is there a catch?" a="No. No usage trap. No data harvesting. No upsell wall after the first week. Bring your own API key on either tier, own your data, and cancel from the dashboard with one click. Asherin was built as a mission, not a funnel." />
            <FaqItem q="What makes Asherin different?" a="Asherin is more than a chatbot. It combines uncensored AI, real-time search, OSINT tooling, predictive analytics, and a capable coding engine into a single dashboard built for professionals." />
            <FaqItem q="How good is the coding engine?" a="Asherin holds full context across large codebases, debugs without circular loops, and delivers working architecture, not pseudocode dressed up as a solution. It doesn't stop when the problem gets hard." />
            <FaqItem q='What does "never trains our models" mean?' a="Your prompts are processed, answered, and encrypted. They are never stored as training data or shared with third parties. Your intelligence stays yours." />
            <FaqItem q="Can I cancel anytime?" a='Yes. One click from the dashboard. No retention flow, no "are you sure?" loop. Cancel either tier whenever you want. Your data is exported or deleted on request.' />

            <FaqItem q="What is the live web search powered by?" a="Privacy-first search infrastructure. Asherin pulls live data without tracking your search behavior or feeding it to ad networks." />
            <FaqItem q="Is Asherin available in multiple languages?" a="Yes. Asherin processes and delivers in any major language. The output quality and uncensored standard remain identical regardless of language." />
          </div>
        </div>
      </div>
      </ScrollSection>

      {/* ───────── Founder CTA ───────── */}
      <ScrollSection>
        <div className="relative z-10 px-6 py-28 sm:py-36 overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,hsl(0_0%_100%/0.06),transparent_70%)] blur-3xl" />
          <div className="mx-auto max-w-5xl relative">
            <div className="relative rounded-3xl border border-foreground/15 bg-gradient-to-br from-background/60 via-background/30 to-background/10 backdrop-blur-2xl p-8 sm:p-14 overflow-hidden">
              <span aria-hidden className="absolute left-0 top-0 h-8 w-8 border-l border-t border-foreground/40 rounded-tl-3xl" />
              <span aria-hidden className="absolute right-0 top-0 h-8 w-8 border-r border-t border-foreground/30 rounded-tr-3xl" />
              <span aria-hidden className="absolute left-0 bottom-0 h-8 w-8 border-l border-b border-foreground/30 rounded-bl-3xl" />
              <span aria-hidden className="absolute right-0 bottom-0 h-8 w-8 border-r border-b border-foreground/40 rounded-br-3xl" />
              <span aria-hidden className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-foreground/40 to-transparent" />

              <p className="font-mono text-[10px] tracking-[0.4em] text-foreground/40 uppercase mb-8 text-center sm:text-left">
                ◊ Transmission · From The Founder
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-8 sm:gap-12 items-center">
                {/* Photo */}
                <div className="sm:col-span-4 flex justify-center sm:justify-start">
                  <div className="relative">
                    <span aria-hidden className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-amber-300/20 via-foreground/10 to-transparent blur-xl" />
                    <img
                      src={asherPhotoAsset.url}
                      alt="Asher Newton, founder of Asherin"
                      className="relative h-44 w-44 sm:h-56 sm:w-56 rounded-2xl object-cover border border-foreground/20 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]"
                    />
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-background/90 border border-foreground/20 backdrop-blur font-mono text-[9px] tracking-[0.3em] uppercase text-foreground/80 whitespace-nowrap">
                      Asher Newton · Founder
                    </div>
                  </div>
                </div>

                {/* Quote + CTA */}
                <div className="sm:col-span-8 text-left">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-extralight tracking-tight leading-[1.1] text-foreground">
                    "I built Asherin because I was tired of being told what I was allowed to know."
                  </h2>
                  <p className="mt-6 text-base sm:text-lg font-extralight leading-relaxed text-foreground/85">
                    Every other platform treats you like a liability.
                    <span className="text-foreground"> You are not a liability. You are exactly who this was built for.</span>
                  </p>
                  <p className="mt-5 text-sm font-extralight leading-relaxed text-muted-foreground">
                    Read the full archive: videos, philosophy, and the complete text of <em>The Book of Asher Asherin Elion</em>.
                  </p>

                  <Link
                    to="/founder"
                    className="mt-8 inline-flex items-center gap-2.5 rounded-full border border-foreground/30 bg-foreground/5 backdrop-blur-md px-8 py-3.5 text-xs font-light tracking-[0.22em] text-foreground uppercase transition-all hover:bg-foreground hover:text-background"
                  >
                    Visit The Founder's Page
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* Updates promo strip */}
      <ScrollSection>
        <div className="relative z-10 px-6 pb-16">
          <div className="mx-auto max-w-5xl">
            <div className="relative overflow-hidden rounded-3xl border border-border/20 bg-card/20 backdrop-blur-xl p-8 sm:p-10">
              <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full bg-foreground/[0.03] blur-3xl" />
              <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />

              <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-foreground/15 text-[10px] font-medium tracking-[0.2em] uppercase text-foreground/70">
                    <Clock className="h-3 w-3" strokeWidth={1.5} />
                    Latest Deployments
                  </div>
                  <h3 className="text-xl sm:text-2xl font-extralight tracking-tight text-foreground">
                    coding improvements, measured updates, and broader model integrations.
                  </h3>
                  <p className="text-sm font-extralight text-muted-foreground max-w-xl leading-relaxed">
                    review the theories, changes, and integrations added to asherin, including what changed and what remains uncertain.
                  </p>
                </div>
                <Link
                  to="/updates"
                  className="group shrink-0 inline-flex items-center gap-2.5 rounded-full border border-foreground/30 bg-foreground/5 backdrop-blur-md px-6 py-3 text-xs font-light tracking-[0.22em] text-foreground uppercase transition-all hover:bg-foreground hover:text-background"
                >
                  View Updates
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </ScrollSection>

      <ScrollSection>
        <SiteFooter />
        <CommandPaletteHint />
      </ScrollSection>

      {showAuth && (
        <AuthOverlay
          isLogin={authIsLogin}
          setIsLogin={setAuthIsLogin}
          onClose={() => setShowAuth(false)}
        />
      )}
      {showHouseLogo && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-background/85 backdrop-blur-2xl p-8 cursor-zoom-out animate-in fade-in duration-300"
          onClick={() => setShowHouseLogo(false)}
        >
          {/* Ambient glow */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--foreground)/0.06),transparent_60%)]" />

          {/* Close */}
          <button
            type="button"
            onClick={() => setShowHouseLogo(false)}
            className="absolute top-6 right-6 rounded-full border border-border/20 bg-card/40 backdrop-blur-md p-2.5 text-muted-foreground hover:text-foreground hover:border-border/50 transition-all"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>

          {/* Card */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex flex-col items-center gap-6 rounded-3xl border border-border/20 bg-card/30 backdrop-blur-xl p-6 sm:p-8 shadow-2xl cursor-default animate-in zoom-in-95 duration-300"
          >
            <div className="flex items-center gap-2 self-start">
              <span className="h-1 w-1 rounded-full bg-foreground/60" />
              <p className="text-[9px] font-light tracking-[0.4em] text-muted-foreground uppercase">
                House of Asher · Emblem
              </p>
            </div>

            <img
              src={houseOfAsherLogo}
              alt="House of Asher emblem"
              className="max-h-[70vh] max-w-[80vw] rounded-2xl border border-border/15 object-contain"
            />

            <div className="flex w-full items-center justify-between gap-6 border-t border-border/15 pt-4">
              <p className="text-[10px] font-extralight tracking-[0.25em] text-muted-foreground/70 uppercase">
                #HouseOfAsher
              </p>
              <p className="text-[9px] font-extralight tracking-[0.3em] text-muted-foreground/40 uppercase">
                Click anywhere to close
              </p>
            </div>
          </div>
        </div>
      )}
    </LandingBackground>
  );
};

export default Index;
