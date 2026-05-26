import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import AuthOverlay from "@/components/AuthOverlay";
import { AlertCircle, Smile, AlertTriangle, Send, ArrowRight, Hammer, FlaskConical, Code, Target, Feather, BarChart3, Unlock, Monitor, Search, Brain, Users, Globe, Check, X, AlertOctagon, Lock, ShieldOff, Flag, Trash2, ChevronDown, Twitter, Download, Zap, GitBranch, Key, Layers, Cpu, Shuffle, Github } from "lucide-react";
import DashboardPreview from "@/components/landing/DashboardPreview";
import { useState, useEffect } from "react";
import { useScrollFadeIn } from "@/hooks/useScrollFadeIn";
import { Link, useLocation } from "react-router-dom";
import { applySeoHead } from "@/lib/seoHead";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import ReactMarkdown from "react-markdown";
import MessageDiagramPanel from "@/components/dashboard/MessageDiagramPanel";
import NeuralThinkingModal from "@/components/dashboard/NeuralThinkingModal";
import houseOfAsherLogo from "@/assets/HouseOfAsher_Flag.png";
import PricingComparisonTable from "@/components/subscription/PricingComparisonTable";
import TierFeatureTabs from "@/components/subscription/TierFeatureTabs";
import SiteFooter from "@/components/SiteFooter";
import LiveDemoStrip from "@/components/landing/LiveDemoStrip";
import TrustBand from "@/components/landing/TrustBand";
import TierComparisonMatrix from "@/components/landing/TierComparisonMatrix";
import CommandPaletteHint from "@/components/landing/CommandPaletteHint";
import MagneticSpotlightButton from "@/components/landing/MagneticSpotlightButton";
import CountUp from "@/components/landing/CountUp";

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
    <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-6 py-4 text-left">
        <span className="text-sm font-light tracking-wide text-foreground">{q}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="px-6 pb-5">
            <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{a}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// 2027 telemetry strip — slim, segmented, military time
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
    applySeoHead({
      title: "Aureon — Uncensored AI Intelligence",
      description: "Aureon: uncensored AI with elite coding, live web search, and end-to-end encryption. The AI that tells you the truth.",
      path: "/",
    });

    const faqs = [
      { q: "What makes Aureon different?", a: "Aureon is a full intelligence platform — not just a chatbot. It combines uncensored AI, real-time search, intelligence tooling, predictive analytics, and an elite coding engine into a single dashboard built for professionals." },
      { q: "How good is the coding engine?", a: "Aureon holds full context across large codebases, debugs without circular loops, and delivers working architecture — not pseudocode dressed up as a solution. It doesn't stop when the problem gets hard." },
      { q: 'What does "never trains our models" mean?', a: "Your prompts are processed, answered, and encrypted. They are never stored as training data or shared with third parties. Your intelligence stays yours." },
      { q: "Can I cancel anytime?", a: 'Yes. One click. No retention flow. No "are you sure?" loop. Your access ends at the billing cycle. Your data is deleted on request.' },
      { q: "What is the live web search powered by?", a: "Privacy-first search infrastructure. Aureon pulls live data without tracking your search behavior or feeding it to ad networks." },
      { q: "Is Aureon available in multiple languages?", a: "Yes. Aureon processes and delivers in any major language. The output quality and uncensored standard remain identical regardless of language." },
    ];

    const schemas = [
      {
        id: "home-website-jsonld",
        data: {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Aureon",
          url: "https://aureonai.app",
          description: "Uncensored AI intelligence platform with elite coding engine, live web search, and end-to-end encryption.",
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
  const maxDemos = 3;
  const location = useLocation();

  useEffect(() => {
    if (new URLSearchParams(location.search).get("next")) {
      setAuthIsLogin(true);
      setShowAuth(true);
    }
  }, [location.search]);

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

      {/* Header */}
      <Header />

      <ScrollSection>
      <div className="relative z-10 flex min-h-screen flex-col px-6 pt-28 pb-16 overflow-hidden">
        {/* Aurora glow */}
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[1200px] h-[520px] zophiel-aurora rounded-full" />

        {/* 2027 grid floor */}
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
          {/* Top meta row */}
          <div className="flex items-center justify-between text-[9px] tracking-[0.4em] text-muted-foreground/50 uppercase font-mono mb-6">
            <span className="flex items-center gap-2">
              <span className="h-px w-6 bg-foreground/30" />
              NODE / AUREON-01
            </span>
            <span className="hidden sm:flex items-center gap-2">
              CHANNEL · ZOPHIEL
              <span className="h-px w-6 bg-foreground/30" />
            </span>
          </div>

          {/* HUD strip — full width */}
          <HudStatusBar />

          {/* Hero grid: asymmetric 12-col */}
          <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            {/* Left — headline + CTA */}
            <div className="lg:col-span-7 flex flex-col">
              <div className="inline-flex items-center gap-2 self-start rounded-full border border-foreground/15 bg-foreground/[0.03] backdrop-blur-md px-3 py-1 font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground/70">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                v2027.1 · INTELLIGENCE OS
              </div>

              <h1 className="mt-6 text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-extralight tracking-[-0.02em] leading-[0.95] text-foreground">
                See what
                <br />
                <span className="zophiel-shimmer-text italic font-thin">others miss.</span>
              </h1>

              <p className="mt-7 max-w-xl text-base sm:text-lg font-extralight leading-relaxed text-muted-foreground/90">
                A full-spectrum intelligence engine. Uncensored AI, 30-source intelligence, predictive
                forecasting, and forensic-grade reasoning — for operators who need answers, not apologies.
              </p>

              <div className="mt-9 flex flex-col sm:flex-row items-start gap-3">
                <MagneticSpotlightButton href="/zophiel" variant="primary">
                  Try Free Search <ArrowRight className="h-4 w-4" />
                </MagneticSpotlightButton>
                <MagneticSpotlightButton href="#demos" variant="secondary">
                  See it live
                </MagneticSpotlightButton>
              </div>

              {/* Telemetry bento */}
              <div className="mt-12 grid grid-cols-3 gap-px rounded-xl overflow-hidden border border-foreground/10 bg-foreground/[0.02] backdrop-blur-xl">
                {[
                  { v: 30, suf: "+", l: "Intelligence sources" },
                  { v: 14, suf: "", l: "Analysis passes" },
                  { v: 9, suf: "", l: "AI providers" },
                ].map((s) => (
                  <div key={s.l} className="bg-background/40 px-5 py-5">
                    <div className="text-3xl font-extralight text-foreground font-mono tabular-nums">
                      <CountUp to={s.v} suffix={s.suf} />
                    </div>
                    <div className="text-[10px] tracking-[0.28em] uppercase text-muted-foreground/55 mt-1.5 font-mono">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — live intel console */}
            <div className="lg:col-span-5 relative">
              <div className="relative rounded-2xl border border-foreground/10 bg-foreground/[0.02] backdrop-blur-2xl overflow-hidden shadow-[0_0_60px_-20px_rgba(255,255,255,0.06)]">
                {/* corner ticks */}
                <span aria-hidden className="absolute top-2 left-2 h-2 w-2 border-t border-l border-foreground/40" />
                <span aria-hidden className="absolute top-2 right-2 h-2 w-2 border-t border-r border-foreground/40" />
                <span aria-hidden className="absolute bottom-2 left-2 h-2 w-2 border-b border-l border-foreground/40" />
                <span aria-hidden className="absolute bottom-2 right-2 h-2 w-2 border-b border-r border-foreground/40" />

                {/* header */}
                <div className="flex items-center justify-between border-b border-foreground/10 px-4 py-2.5 font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground/60">
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    INTEL FEED · LIVE
                  </span>
                  <span>30/30</span>
                </div>

                {/* feed lines */}
                <div className="px-4 py-4 space-y-2.5 font-mono text-[11px] text-muted-foreground/80 min-h-[260px]">
                  {[
                    { t: "0.02s", s: "ZOPHIEL", m: "30 intelligence lanes acquired", c: "text-emerald-300/90" },
                    { t: "0.41s", s: "AXRLEN", m: "14-pass consensus engaged", c: "text-foreground" },
                    { t: "1.07s", s: "ZERLAL", m: "Domain forensics resolved", c: "text-foreground" },
                    { t: "1.62s", s: "NOMAD",  m: "Cross-validation · 0.91 veracity", c: "text-foreground" },
                    { t: "2.08s", s: "AUREON", m: "Truth payload sealed · AES-256-GCM", c: "text-emerald-300/90" },
                  ].map((row, i) => (
                    <div key={i} className="flex items-baseline gap-3 animate-fade-in" style={{ animationDelay: `${i * 120}ms` }}>
                      <span className="text-muted-foreground/40 tabular-nums w-12">{row.t}</span>
                      <span className="text-foreground/60 w-16 tracking-[0.15em]">{row.s}</span>
                      <span className={row.c + " flex-1 truncate"}>{row.m}</span>
                    </div>
                  ))}
                </div>

                {/* footer ticker */}
                <div className="border-t border-foreground/10 px-4 py-2 font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground/50 flex items-center justify-between">
                  <span>UPLINK · SECURE</span>
                  <span className="tabular-nums">LATENCY 42MS</span>
                </div>
              </div>

              {/* Vertical scroll cue */}
              <div className="mt-6 flex items-center gap-2 font-mono text-[9px] tracking-[0.4em] uppercase text-muted-foreground/40">
                <span className="h-px flex-1 bg-foreground/15" />
                SCROLL TO DEPLOY ↓
              </div>
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
      <ScrollSection><LiveDemoStrip /></ScrollSection>
      <ScrollSection><TrustBand /></ScrollSection>

      <ScrollSection>
      <div className="relative z-10 px-6 py-28 sm:py-40 overflow-hidden">
        {/* Aurora background */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35]">
          <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,hsl(45_90%_55%/0.18),transparent_70%)] blur-3xl" />
          <div className="absolute left-[20%] top-[60%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle_at_center,hsl(0_0%_100%/0.06),transparent_70%)] blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/[0.04] px-3 py-1 mb-8">
              <span className="h-1 w-1 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[10px] font-light tracking-[0.3em] text-amber-200/80 uppercase">The Aureon Difference</span>
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-extralight tracking-tight leading-[1.05] text-foreground">
              Most AI Gives You <span className="italic font-thin text-muted-foreground/70">Guardrails.</span>
              <br />
              Aureon Gives You <span className="bg-gradient-to-r from-amber-200 via-amber-100 to-foreground bg-clip-text text-transparent">The Full Picture.</span>
            </h2>
          </div>

          {/* Asymmetric bento */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-12 gap-4">
            {[
              { n: "01", Icon: AlertCircle, title: "No Artificial Limits", desc: "Ask any question on any topic. No disclaimers, no refusals, no corporate filters blocking your work.", span: "md:col-span-5 md:row-span-2", tall: true },
              { n: "02", Icon: Smile, title: "Truth Over Comfort", desc: "Direct, unvarnished answers — structured for professionals who value accuracy over politeness.", span: "md:col-span-7" },
              { n: "03", Icon: AlertTriangle, title: "Production-Grade Code", desc: "Full-stack architecture, multi-file debugging, and working builds — not pseudocode dressed up as solutions.", span: "md:col-span-7" },
            ].map(({ n, Icon, title, desc, span, tall }) => (
              <div key={n} className={`group relative ${span} rounded-3xl overflow-hidden`}>
                {/* gradient border */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-400/20 via-foreground/10 to-transparent opacity-40 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative m-[1px] h-[calc(100%-2px)] rounded-3xl bg-gradient-to-br from-card/80 via-background/90 to-background backdrop-blur-xl p-8 sm:p-10">
                  {/* corner mark */}
                  <div className="absolute right-6 top-6 font-mono text-[10px] tracking-[0.3em] text-amber-200/40">{n} / 03</div>
                  {/* glow orb */}
                  <div aria-hidden className="absolute -right-20 -bottom-20 h-60 w-60 rounded-full bg-amber-400/[0.04] blur-3xl group-hover:bg-amber-400/[0.12] transition-all duration-700" />

                  <div className="relative flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-foreground/10 bg-foreground/[0.03] group-hover:border-amber-400/30 group-hover:bg-amber-400/[0.06] transition-all duration-500">
                      <Icon className="h-5 w-5 text-foreground/80 group-hover:text-amber-200 transition-colors" />
                    </div>
                    <div className="flex-1">
                      <h3 className={`${tall ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"} font-extralight tracking-tight text-foreground leading-tight`}>{title}</h3>
                      <p className={`mt-4 ${tall ? "text-base" : "text-sm"} font-extralight leading-relaxed text-muted-foreground max-w-md`}>{desc}</p>

                      {tall && (
                        <div className="mt-8 flex items-center gap-2 text-[10px] font-mono tracking-[0.25em] text-amber-200/60 uppercase">
                          <span className="h-px w-8 bg-amber-200/40" />
                          Zero-Filter Policy
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
              Built for professionals who need precision.
              <br />
              <span className="italic text-muted-foreground/60">Not an assistant. An intelligence platform.</span>
            </p>
          </div>
        </div>
      </div>
      </ScrollSection>

      <ScrollSection>
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            Ask It Anything.
            <br />
            <span className="text-muted-foreground">Watch What Happens When AI Has No Leash.</span>
          </h2>

          {/* Demo Widget */}
          <div className="mt-16 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden text-left">
            {/* Demo Header */}
            <div className="flex items-center justify-between border-b border-border/20 px-6 py-4">
              <span className="text-sm font-light tracking-[0.2em] text-foreground">AUREON LIVE</span>
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
                    placeholder="Ask Aureon anything..."
                    className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none"
                  />
                  <button type="submit" className="text-foreground/60 hover:text-foreground transition-colors">
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
            <button onClick={() => { setAuthIsLogin(false); setShowAuth(true); }} className="group flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90">
              Get Full Access
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </div>
      </ScrollSection>

      <ScrollSection>
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            Built For People Who Build.
            <br />
            <span className="text-muted-foreground">Not People Who Browse.</span>
          </h2>

          {/* Row 1 */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Hammer className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">For Builders</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                Build full-stack products with an AI that holds context across large codebases and doesn't stop when the problem gets hard.
              </p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <FlaskConical className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">For Researchers</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                Get the full analysis on any topic — unfiltered, structured, and backed by real-time intelligence. No sanitized summaries.
              </p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Code className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">For Coders</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                Elite-tier coding engine. Debug, architect, and ship production code — with persistent context across every session.
              </p>
            </div>
          </div>

          {/* Row 2 */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Target className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">For Strategists</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                Predictive intelligence, scenario simulation, and signal detection for markets, conflicts, and complex systems.
              </p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Feather className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">For Writers</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                Write with your voice intact. Aureon adapts to your tone and delivers raw creative output — no corporate rewrites.
              </p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <BarChart3 className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">For Analysts</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                Deep intelligence on economic events, structural trends, and data patterns — with full OSINT and entity resolution tooling.
              </p>
            </div>
          </div>
        </div>
      </div>
      </ScrollSection>

      {/* ===== THE PLATFORM — Bento ===== */}
      <ScrollSection>
      <div className="relative z-10 px-6 py-28 sm:py-40 overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-30">
          <div className="absolute right-[10%] top-[20%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,hsl(45_80%_50%/0.12),transparent_70%)] blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-col items-center text-center mb-20">
            <div className="inline-flex items-center gap-2 rounded-full border border-foreground/15 bg-foreground/[0.03] px-3 py-1 mb-8">
              <span className="font-mono text-[10px] tracking-[0.3em] text-muted-foreground uppercase">/ 02 — Platform</span>
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-extralight tracking-tight leading-[1.05] text-foreground">
              The Platform.
              <br />
              <span className="italic text-muted-foreground/60">Every Capability.</span>{" "}
              <span className="bg-gradient-to-r from-amber-200 to-foreground bg-clip-text text-transparent">One Dashboard.</span>
            </h2>
          </div>

          {/* Bento grid 12-col */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {[
              { Icon: Unlock, title: "Uncensored Responses", desc: "No topic is off limits. No hidden bias. Ask anything and get the complete, unfiltered answer.", span: "md:col-span-7 md:row-span-2", featured: true, tag: "Core" },
              { Icon: Monitor, title: "Elite Coding Engine", desc: "Production-grade output on complex builds, debugging, and multi-file architecture.", span: "md:col-span-5", tag: "Engine" },
              { Icon: Search, title: "Live Web Intelligence", desc: "Privacy-first real-time search. Current data — not 2-year-old training sets.", span: "md:col-span-5", tag: "Realtime" },
              { Icon: Brain, title: "Persistent Memory", desc: "Aureon remembers your context, preferences, and projects across every session.", span: "md:col-span-4", tag: "Stateful" },
              { Icon: Users, title: "Team Workspace", desc: "Collaborate in real time. Share threads, outputs, and builds with your team.", span: "md:col-span-4", tag: "Collab" },
              { Icon: Globe, title: "Multi-Language Output", desc: "Thinks and delivers in any language. Same raw output. No filtered translations.", span: "md:col-span-4", tag: "Global" },
            ].map(({ Icon, title, desc, span, featured, tag }, i) => (
              <div key={title} className={`group relative ${span} rounded-3xl overflow-hidden min-h-[200px]`}>
                <div className={`absolute inset-0 rounded-3xl ${featured ? "bg-gradient-to-br from-amber-400/25 via-amber-200/5 to-transparent" : "bg-gradient-to-br from-foreground/10 via-transparent to-transparent"} opacity-50 group-hover:opacity-100 transition-opacity duration-700`} />
                <div className={`relative m-[1px] h-[calc(100%-2px)] rounded-3xl ${featured ? "bg-gradient-to-br from-card/90 via-background/95 to-background" : "bg-card/40"} backdrop-blur-xl p-7 sm:p-9 flex flex-col justify-between`}>
                  {featured && <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-400/[0.06] blur-3xl" />}

                  <div className="relative flex items-start justify-between">
                    <div className={`flex ${featured ? "h-14 w-14" : "h-11 w-11"} items-center justify-center rounded-2xl border border-foreground/10 bg-foreground/[0.03] group-hover:border-amber-400/30 transition-all`}>
                      <Icon className={`${featured ? "h-6 w-6" : "h-5 w-5"} text-foreground/85 group-hover:text-amber-200 transition-colors`} />
                    </div>
                    <span className="font-mono text-[9px] tracking-[0.3em] text-muted-foreground/40 uppercase">{tag}</span>
                  </div>

                  <div className="relative mt-6">
                    <h3 className={`${featured ? "text-2xl sm:text-3xl" : "text-lg"} font-extralight tracking-tight text-foreground leading-tight`}>{title}</h3>
                    <p className={`mt-3 ${featured ? "text-base max-w-md" : "text-sm"} font-extralight leading-relaxed text-muted-foreground`}>{desc}</p>
                    {featured && (
                      <div className="mt-8 flex items-center gap-3">
                        <div className="h-px flex-1 bg-gradient-to-r from-amber-400/40 to-transparent" />
                        <span className="font-mono text-[10px] tracking-[0.3em] text-amber-200/70 uppercase">No Guardrails</span>
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
                v.2027 — Live
              </div>
            </div>

            {/* Right list — spec rows */}
            <div className="lg:col-span-7 space-y-3">
              {[
                { n: "S—01", label: "Uncensored AI", desc: "No topic limits. No filters. Full answers on every subject." },
                { n: "S—02", label: "Real-Time Search", desc: "Privacy-first web intelligence with live data and source credibility tiers." },
                { n: "S—03", label: "Persistent Memory", desc: "Context that carries across every conversation and session." },
                { n: "S—04", label: "Public Intelligence & Forensics", desc: "Full-spectrum public intelligence — NOMAD, entity resolution, and dossier output." },
                { n: "S—05", label: "Predictive Intelligence", desc: "AI event forecasting with signal detection and confidence scoring." },
                { n: "S—06", label: "Data Privacy", desc: "End-to-end encryption. Your data is never sold or used for training." },
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
          <div className="absolute left-1/2 top-1/4 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,hsl(45_85%_55%/0.14),transparent_65%)] blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/[0.05] px-4 py-1.5 mb-8 shadow-[0_0_40px_-10px_hsl(45_90%_55%/0.4)]">
              <Key className="h-3 w-3 text-amber-300" />
              <span className="text-[10px] font-light tracking-[0.3em] text-amber-200 uppercase">Bring Your Own Key</span>
              <span className="font-mono text-[9px] tracking-[0.2em] text-amber-200/60">/ BYOK</span>
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-extralight tracking-tight leading-[1.05] text-foreground">
              Your Keys. <span className="italic text-muted-foreground/60">Your Models.</span>
              <br />
              <span className="bg-gradient-to-r from-amber-300 via-amber-100 to-foreground bg-clip-text text-transparent">Uncensored Through Every Provider.</span>
            </h2>
            <p className="mt-8 max-w-2xl mx-auto text-base font-extralight leading-relaxed text-muted-foreground">
              Plug in your own API keys from any major AI provider. Every model runs through Aureon's uncensored intelligence layer — same raw output, same zero-filter policy, regardless of which LLM powers it.
            </p>
          </div>

          {/* Pillar cards */}
          <div className="mt-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { n: "01", Icon: Key, title: "Bring Your Own Key", desc: "Plug in API keys from any provider. Your keys, your billing, your control. No middleman." },
              { n: "02", Icon: Layers, title: "Multi-Model at Once", desc: "Send one prompt to 2–4 models in parallel. See every response side-by-side." },
              { n: "03", Icon: Shuffle, title: "Consensus Engine", desc: "When models agree, you get one clean answer. When they disagree, you see exactly where." },
              { n: "04", Icon: Cpu, title: "Aureon Brain Intact", desc: "Every model runs through Aureon's uncensored system prompt. Same depth, zero filters." },
            ].map(({ n, Icon, title, desc }) => (
              <div key={n} className="group relative rounded-3xl overflow-hidden">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-amber-400/15 to-transparent opacity-30 group-hover:opacity-100 transition-opacity duration-700" />
                <div className="relative m-[1px] h-[calc(100%-2px)] rounded-3xl bg-gradient-to-b from-card/80 to-background/80 backdrop-blur-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] group-hover:border-amber-400/40 group-hover:bg-amber-400/[0.08] transition-all">
                      <Icon className="h-5 w-5 text-amber-200/80 group-hover:text-amber-200 transition-colors" />
                    </div>
                    <span className="font-mono text-[10px] tracking-[0.3em] text-amber-200/40">{n}</span>
                  </div>
                  <h3 className="text-base font-light tracking-tight text-foreground">{title}</h3>
                  <p className="mt-3 text-xs font-extralight leading-relaxed text-muted-foreground">{desc}</p>
                  <div className="mt-6 h-px bg-gradient-to-r from-amber-400/30 via-amber-400/10 to-transparent" />
                </div>
              </div>
            ))}
          </div>

          {/* Providers — premium chip ticker */}
          <div className="mt-20">
            <div className="flex items-center justify-center gap-4 mb-10">
              <div className="h-px w-16 bg-gradient-to-r from-transparent to-amber-400/40" />
              <p className="font-mono text-[10px] font-light tracking-[0.35em] text-amber-200/70 uppercase">Supported AI Providers</p>
              <div className="h-px w-16 bg-gradient-to-l from-transparent to-amber-400/40" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
              {[
                { name: "OpenAI", models: "GPT-5.4, GPT-5.3, o4-mini" },
                { name: "Anthropic", models: "Opus 4.6, Sonnet 4.6" },
                { name: "Google", models: "Gemini 3.1 Pro, 2.5 Pro" },
                { name: "xAI", models: "Grok 4, Grok Code" },
                { name: "Mistral", models: "Medium 3.1, Codestral" },
                { name: "DeepSeek", models: "DeepSeek V3, R1" },
                { name: "Meta", models: "Llama 4 Maverick & Scout" },
                { name: "Venice AI", models: "Uncensored, zero logging" },
                { name: "Perplexity", models: "Sonar Pro, Deep Research" },
              ].map((p, i) => (
                <div key={p.name} className="group relative rounded-xl border border-border/15 bg-card/20 backdrop-blur-md p-4 hover:border-amber-400/30 hover:bg-card/40 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[9px] tracking-[0.25em] text-muted-foreground/40">0{i + 1}</span>
                      <p className="text-sm font-light tracking-tight text-foreground">{p.name}</p>
                    </div>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400/60 group-hover:bg-amber-400 transition-colors" />
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

      <ScrollSection>
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            Choose Your Intelligence Level.
            <br />
            <span className="text-muted-foreground">No Free Tiers. No Data Harvesting.</span>
          </h2>

          {/* Comparison Table */}
          <div className="mt-16 max-w-7xl mx-auto text-left">
            <TierComparisonMatrix />
          </div>

          {/* What Powers Each Tier */}
          <div className="mt-20 max-w-5xl mx-auto text-left">
            <h3 className="text-center text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-12">
              What Powers Each Tier.
            </h3>
            <TierFeatureTabs />
          </div>

          {/* Why no free tier */}
          <div className="mt-16 text-center">
            <p className="text-lg font-extralight tracking-wide text-foreground italic">"Why no free tier?"</p>
            <p className="mt-4 max-w-lg mx-auto text-sm font-extralight leading-relaxed text-muted-foreground">
              Because free tiers turn users into products. You pay for the tool — the tool works for you. That's the only honest model.
            </p>
          </div>
        </div>
      </div>
      </ScrollSection>

      {/* Build Your Own Software — Zahten Pitch */}
      <ScrollSection>
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-border/20 bg-card/30 backdrop-blur-md px-8 py-16 sm:px-16 sm:py-20">
            <div className="text-center">
              <p className="text-[10px] font-medium tracking-[0.3em] text-muted-foreground/60 uppercase mb-4">
                Zahten Agent Forge
              </p>
              <h2 className="text-3xl sm:text-5xl font-extralight tracking-wide text-foreground leading-tight">
                Don't see the software you need?
                <br />
                <span className="text-muted-foreground">Build it. Ship it. Run it inside Aureon.</span>
              </h2>
              <p className="mt-8 max-w-2xl mx-auto text-sm sm:text-base font-extralight leading-relaxed text-muted-foreground">
                If we don't ship the tool you want, build it yourself with <span className="text-foreground">Zahten</span> — our autonomous agent forge.
                Spin up your own tab, your own module, your own intelligence engine inside Aureon and wire it directly to your own LLM API key.
                We strip the safety filters off the model for you, so the software you build runs uncensored — no guardrails, no apologies, no refusals.
              </p>
              <p className="mt-6 max-w-2xl mx-auto text-sm sm:text-base font-extralight leading-relaxed text-muted-foreground">
                Build any kind of software you want — research engines, trading bots, OSINT pipelines, creative tools, simulators, forensic systems —
                no matter the depth, no matter the use case. If you can describe it, Zahten can scaffold it, harden it, and dock it into your Aureon dashboard
                as a permanent custom tab.
              </p>

              <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto text-left">
                <div className="rounded-xl border border-border/20 bg-background/30 p-5">
                  <p className="text-[9px] font-medium tracking-[0.2em] text-muted-foreground/60 uppercase mb-2">01 — Forge</p>
                  <p className="text-xs font-extralight leading-relaxed text-foreground">
                    Describe the software. Zahten plans the architecture, scaffolds the code, and hardens it for production.
                  </p>
                </div>
                <div className="rounded-xl border border-border/20 bg-background/30 p-5">
                  <p className="text-[9px] font-medium tracking-[0.2em] text-muted-foreground/60 uppercase mb-2">02 — Wire</p>
                  <p className="text-xs font-extralight leading-relaxed text-foreground">
                    Plug in your own API key from any major provider. We uncensor the model so your tool answers anything.
                  </p>
                </div>
                <div className="rounded-xl border border-border/20 bg-background/30 p-5">
                  <p className="text-[9px] font-medium tracking-[0.2em] text-muted-foreground/60 uppercase mb-2">03 — Dock</p>
                  <p className="text-xs font-extralight leading-relaxed text-foreground">
                    Publish it as a custom tab inside your Aureon dashboard. Yours forever — runs sandboxed, side-by-side with everything else.
                  </p>
                </div>
              </div>

              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  to="/feature/zahten"
                  className="inline-flex items-center gap-2 rounded-full border border-foreground/30 bg-foreground/5 px-7 py-3 text-xs font-light tracking-[0.15em] text-foreground hover:bg-foreground hover:text-background transition-all uppercase"
                >
                  Explore Zahten <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to="/feature/byok"
                  className="inline-flex items-center gap-2 rounded-full border border-border/30 px-7 py-3 text-xs font-light tracking-[0.15em] text-muted-foreground hover:text-foreground transition-all uppercase"
                >
                  Bring Your Own Key
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
      </ScrollSection>

      <ScrollSection>
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            Your Words Never Leave The Room.
          </h2>

          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16">
            {/* Left — Statement */}
            <div className="text-left">
              <p className="text-base font-extralight leading-relaxed text-foreground/90">
                Every prompt you send to Aureon is encrypted end-to-end.
              </p>
              <p className="mt-6 text-sm font-extralight text-muted-foreground">Your conversations are never:</p>
              <ul className="mt-3 space-y-2">
                {[
                  "Sold to third parties",
                  "Used to train any AI model",
                  "Shared with advertisers",
                  "Read by our team",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm font-extralight text-foreground/80">
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-sm font-extralight leading-relaxed text-muted-foreground">
                Servers hosted in the United States. Your account data lives with you. Cancel and it's gone. Full stop.
              </p>
            </div>

            {/* Right — Icon Grid */}
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Lock, label: "End-To-End Encryption" },
                { icon: ShieldOff, label: "Never Sold" },
                { icon: Brain, label: "Never Trains Our Models" },
                { icon: Flag, label: "US-Based Servers" },
                { icon: X, label: "No Third Party Access" },
                { icon: Trash2, label: "Delete Anytime" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-3 rounded-xl border border-border/20 bg-card/30 backdrop-blur-md px-4 py-4">
                  <Icon className="h-5 w-5 shrink-0 text-foreground" />
                  <span className="text-xs font-extralight tracking-wide text-foreground/80">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </ScrollSection>

      <ScrollSection>
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            {/* Left — Message */}
            <div>
              <p className="text-[10px] font-medium tracking-[0.3em] text-muted-foreground/50 uppercase mb-4">Prompt Intelligence</p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
                Get The Best Out
                <br />
                Of Your Prompts.
              </h2>
              <p className="mt-6 text-sm font-extralight leading-relaxed tracking-wide text-muted-foreground">
                Most people open an AI and immediately ask their question. That's the wrong approach. The difference between average output and elite intelligence is one step most people skip —
              </p>
              <p className="mt-4 text-base font-light tracking-wide text-foreground italic">
                "Ask Aureon what it needs first."
              </p>
              <p className="mt-6 text-sm font-extralight leading-relaxed tracking-wide text-muted-foreground">
                Instead of dumping every war in human history into a prompt and asking "predict the next conflict" — ask Aureon what data points, context, and variables it needs to give you the most accurate prediction. The output transforms from a guess into an intelligence assessment.
              </p>
              <p className="mt-4 text-sm font-extralight leading-relaxed tracking-wide text-muted-foreground">
                This is the same principle behind every serious intelligence operation in history. In warfare, your best asset isn't the technology — it's the intelligence feeding it. You can't win a war without data. That's why we built <span className="text-foreground font-light">Aureon</span> — and <span className="text-foreground font-light">Zophiel</span> as our intelligence officer.
              </p>

              <Link to="/prompt-engineering" className="mt-8 inline-flex items-center gap-2 rounded-xl border border-border/30 bg-card/40 backdrop-blur-md px-5 py-2.5 text-xs font-light tracking-wide text-foreground transition-all hover:bg-foreground/10">
                Read the Prompt Masterclass <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Right — Visual Comparison */}
            <div className="space-y-6">
              {/* Bad prompt example */}
              <div className="rounded-2xl border border-destructive/20 bg-destructive/5 backdrop-blur-md p-6">
                <p className="text-[9px] font-medium tracking-[0.2em] text-destructive/60 uppercase mb-3">How most people prompt</p>
                <div className="rounded-xl bg-background/30 border border-border/20 p-4">
                  <p className="text-xs font-light text-muted-foreground leading-relaxed">
                    "Upload all war history data and predict the next war"
                  </p>
                </div>
                <p className="mt-3 text-[11px] font-extralight text-muted-foreground/70">
                  → Broad, unfocused, missing critical variables. Output will be generic.
                </p>
              </div>

              {/* Good prompt example */}
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-md p-6">
                <p className="text-[9px] font-medium tracking-[0.2em] text-emerald-400/60 uppercase mb-3">The Aureon method</p>
                <div className="space-y-2">
                  <div className="rounded-xl bg-background/30 border border-border/20 p-4">
                    <p className="text-[10px] font-medium text-muted-foreground/50 mb-1">You →</p>
                    <p className="text-xs font-light text-muted-foreground leading-relaxed">
                      "I want to predict geopolitical conflicts. What data, variables, and context do you need from me to produce the most accurate forecast?"
                    </p>
                  </div>
                  <div className="rounded-xl bg-background/30 border border-border/20 p-4">
                    <p className="text-[10px] font-medium text-muted-foreground/50 mb-1">Aureon →</p>
                    <p className="text-xs font-light text-foreground/80 leading-relaxed">
                      "I need: region of focus, time horizon, economic indicators you're tracking, alliance structures, recent treaty changes, resource dependencies, and any specific actors of interest."
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-[11px] font-extralight text-emerald-400/70">
                  → Targeted. Structured. Intelligence-grade output.
                </p>
              </div>

              {/* Principle */}
              <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6 text-center">
                <p className="text-xs font-extralight tracking-wide text-muted-foreground leading-relaxed">
                  Technology without intelligence is just hardware.
                  <br />
                  <span className="text-foreground font-light">Intelligence with the right data is power.</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </ScrollSection>

      <ScrollSection>
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            The Questions Everyone Has.
            <br />
            <span className="text-muted-foreground">Answered Without Spin.</span>
          </h2>

          <div className="mt-16 space-y-3">
            <FaqItem
              q="What makes Aureon different?"
              a="Aureon is a full intelligence platform — not just a chatbot. It combines uncensored AI, real-time search, OSINT tooling, predictive analytics, and an elite coding engine into a single dashboard built for professionals."
            />
            <FaqItem
              q="How good is the coding engine?"
              a="Aureon holds full context across large codebases, debugs without circular loops, and delivers working architecture — not pseudocode dressed up as a solution. It doesn't stop when the problem gets hard."
            />
            <FaqItem
              q='What does "never trains our models" mean?'
              a="Your prompts are processed, answered, and encrypted. They are never stored as training data or shared with third parties. Your intelligence stays yours."
            />
            <FaqItem
              q="Can I cancel anytime?"
              a='Yes. One click. No retention flow. No "are you sure?" loop. Your access ends at the billing cycle. Your data is deleted on request.'
            />
            <FaqItem
              q="What is the live web search powered by?"
              a="Privacy-first search infrastructure. Aureon pulls live data without tracking your search behavior or feeding it to ad networks."
            />
            <FaqItem
              q="Is Aureon available in multiple languages?"
              a="Yes. Aureon processes and delivers in any major language. The output quality and uncensored standard remain identical regardless of language."
            />
          </div>
        </div>
      </div>
      </ScrollSection>

      <ScrollSection>
        <div className="relative z-10 px-6 py-24 sm:py-32">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-3xl border border-border/20 bg-card/30 backdrop-blur-md p-10 sm:p-16 text-center">
              <p className="text-xs font-extralight tracking-[0.3em] text-muted-foreground/50 uppercase mb-5">
                From The Founder
              </p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
                Watch The Founder's Videos.
                <br />
                <span className="text-muted-foreground">Read His E-Book.</span>
              </h2>
              <p className="mt-8 max-w-2xl mx-auto text-sm sm:text-base font-extralight leading-relaxed text-muted-foreground">
                Step inside the mind behind Aureon. Asher Newton's archives, philosophy, and the full text of <em>The Book of Asher Aureon Elion</em> — all in one place.
              </p>
              <Link
                to="/founder"
                className="mt-10 inline-flex items-center gap-2.5 rounded-xl border border-border/30 bg-card/60 backdrop-blur-md px-7 py-3.5 text-sm font-light tracking-[0.15em] text-foreground uppercase transition-all hover:bg-foreground/10"
              >
                Visit The Founder's Page
                <span aria-hidden>→</span>
              </Link>
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
