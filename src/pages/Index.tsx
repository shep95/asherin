import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import { AlertCircle, Smile, AlertTriangle, Send, ArrowRight, Hammer, FlaskConical, Code, Target, Feather, BarChart3, Unlock, Monitor, Search, Brain, Users, Globe, Check, X, AlertOctagon, Lock, ShieldOff, Flag, Trash2, ChevronDown, Twitter, Download, Zap } from "lucide-react";
import DashboardPreview from "@/components/landing/DashboardPreview";
import { useState, useEffect } from "react";
import { useScrollFadeIn } from "@/hooks/useScrollFadeIn";
import { Link } from "react-router-dom";
import { usePwaInstall } from "@/hooks/use-pwa-install";
import ReactMarkdown from "react-markdown";

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

const Index = () => {
  useEffect(() => {
    document.title = "Aureon — Uncensored AI Intelligence";
  }, []);
  const [demoQuery, setDemoQuery] = useState("");
  const [demoResponse, setDemoResponse] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const { canInstall, install } = usePwaInstall();
  const [demoCount, setDemoCount] = useState(() => {
    return parseInt(localStorage.getItem("aureon_demo_count") || "0", 10);
  });
  const maxDemos = 3;

  const handleDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoQuery.trim() || isTyping || demoCount >= maxDemos) return;
    const newCount = demoCount + 1;
    setDemoCount(newCount);
    localStorage.setItem("aureon_demo_count", String(newCount));
    setIsTyping(true);
    setDemoResponse("");

    const query = demoQuery.trim();
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
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight text-foreground">
          Intelligence Without Compromise.
        </h1>
        <p className="mt-6 max-w-2xl text-base sm:text-lg font-extralight leading-relaxed tracking-wide text-muted-foreground">
          Aureon is a full-spectrum intelligence platform — uncensored AI, elite coding, real-time search, predictive analytics, and OSINT tooling built for professionals who need raw output, not filtered opinions.
        </p>
        {canInstall && (
          <button
            onClick={install}
            className="mt-8 group inline-flex items-center gap-2.5 rounded-xl border border-border/30 bg-card/60 backdrop-blur-md px-6 py-3 text-sm font-light tracking-wide text-foreground transition-all hover:bg-foreground/10"
          >
            <Download className="h-4 w-4" />
            Download App
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        )}
      </div>
      </ScrollSection>

      <ScrollSection>
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            Most AI Gives You Guardrails.
            <br />
            Aureon Gives You The Full Picture.
          </h2>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <AlertCircle className="h-8 w-8 text-foreground" />
              <h3 className="mt-4 text-lg font-light tracking-wide text-foreground">No Artificial Limits</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">Ask any question on any topic. No disclaimers, no refusals, no corporate filters blocking your work.</p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Smile className="h-8 w-8 text-foreground" />
              <h3 className="mt-4 text-lg font-light tracking-wide text-foreground">Truth Over Comfort</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">Aureon delivers direct, unvarnished answers — structured for professionals who value accuracy over politeness.</p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <AlertTriangle className="h-8 w-8 text-foreground" />
              <h3 className="mt-4 text-lg font-light tracking-wide text-foreground">Production-Grade Code</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">Full-stack architecture, multi-file debugging, and working builds — not pseudocode dressed up as solutions.</p>
            </div>
          </div>

          <p className="mt-16 text-xl sm:text-2xl font-extralight tracking-wide text-foreground">
            Built for professionals who need precision.
            <br />
            <span className="text-muted-foreground">Not an assistant. An intelligence platform.</span>
          </p>
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
                </div>
              )}
            </div>
          </div>

          {/* Below Demo CTA */}
          <div className="mt-12 flex flex-col items-center gap-4">
            <p className="text-xl font-extralight tracking-wide text-foreground">Liked what you saw?</p>
            <button className="group flex items-center gap-2 rounded-xl bg-foreground px-8 py-3 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90">
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

      <ScrollSection>
      <div className="relative z-10 px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12">
            <p className="text-sm font-extralight tracking-[0.2em] text-muted-foreground uppercase">As Featured In</p>
            <div className="flex items-center gap-8 sm:gap-12">
              <div className="h-8 w-32 rounded-lg border border-border/30 bg-card/20 flex items-center justify-center">
                <span className="text-xs font-light text-muted-foreground">FORBES</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      </ScrollSection>

      <ScrollSection>
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            The Platform.
            <br />
            <span className="text-muted-foreground">Every Capability. One Dashboard.</span>
          </h2>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Unlock className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">Uncensored Responses</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">No topic is off limits. No hidden bias. Ask anything and get the complete, unfiltered answer.</p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Monitor className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">Elite Coding Engine</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">Production-grade output on complex builds, debugging, and multi-file architecture — every time.</p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Search className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">Live Web Intelligence</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">Privacy-first real-time search. Current data, not 2-year-old training sets.</p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Brain className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">Persistent Memory</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">Aureon remembers your context, preferences, and projects across every session.</p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Users className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">Team Workspace</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">Collaborate in real time. Share threads, outputs, and builds with your team.</p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Globe className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">Multi-Language Output</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">Thinks and delivers in any language. Same raw output. No filtered translations.</p>
            </div>
          </div>
        </div>
      </div>
      </ScrollSection>

      <ScrollSection>
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            Not Just An AI Chat.
            <br />
            <span className="text-muted-foreground">A Complete Intelligence Operating System.</span>
          </h2>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { label: "Uncensored AI", desc: "No topic limits. No filters. Full answers on every subject." },
              { label: "Real-Time Search", desc: "Privacy-first web intelligence with live data and source credibility tiers." },
              { label: "Persistent Memory", desc: "Context that carries across every conversation and session." },
              { label: "OSINT & Domain Forensics", desc: "Full-spectrum OSINT tooling — NOMAD, Elion/Zohar, entity resolution." },
              { label: "Predictive Intelligence", desc: "AI event forecasting with signal detection and confidence scoring." },
              { label: "Data Privacy", desc: "End-to-end encryption. Your data is never sold or used for training." },
            ].map(({ label, desc }) => (
              <div key={label} className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6 text-left">
                <Check className="h-5 w-5 text-emerald-400 mb-3" />
                <h3 className="text-sm font-light tracking-wide text-foreground">{label}</h3>
                <p className="mt-2 text-xs font-extralight leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      </ScrollSection>

      <ScrollSection>
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            Aureon Is The Frontend.
            <br />
            <span className="text-muted-foreground">Our Backend Is Fully Automated.</span>
          </h2>
          <p className="mt-6 max-w-2xl mx-auto text-base font-extralight leading-relaxed text-muted-foreground">
            Aureon is what people see — the intelligence interface. Behind it, our proprietary Zophiel Software autonomously powers every query, every analysis, and every response you receive.
          </p>

          {/* Architecture Diagram */}
          <div className="mt-16 rounded-2xl border border-border/20 bg-card/20 backdrop-blur-md p-8 sm:p-12">
            {/* User Layer */}
            <div className="flex flex-col items-center gap-8">
              <div className="rounded-2xl border border-foreground/20 bg-foreground/5 px-8 py-4">
                <span className="text-sm font-light tracking-[0.2em] text-foreground uppercase">You — The User</span>
              </div>
              <div className="w-px h-8 bg-gradient-to-b from-foreground/30 to-accent/30" />

              {/* Aureon Frontend */}
              <div className="w-full max-w-lg rounded-2xl border border-accent/30 bg-accent/5 p-6">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <Zap className="h-5 w-5 text-accent" />
                  <span className="text-base font-light tracking-[0.2em] text-foreground uppercase">Aureon</span>
                </div>
                <p className="text-xs font-extralight text-muted-foreground text-center">
                  The Intelligence Interface — Chat, Search, IDE, OSINT, Analytics
                </p>
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {["Chat AI", "Zophiel Search", "Code Engine", "NOMAD OSINT", "Asha Data", "Predictive Intel"].map(label => (
                    <div key={label} className="rounded-xl border border-border/20 bg-card/20 px-2 py-1.5 text-center">
                      <span className="text-[9px] font-extralight text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-16 h-px bg-accent/30" />
                <span className="text-[10px] font-extralight tracking-[0.3em] text-accent/60 uppercase">Encrypted Pipeline</span>
                <div className="w-16 h-px bg-accent/30" />
              </div>

              {/* Zophiel Backend */}
              <div className="w-full max-w-lg rounded-2xl border border-border/30 bg-card/10 p-6">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <Brain className="h-5 w-5 text-muted-foreground" />
                  <span className="text-base font-light tracking-[0.2em] text-foreground uppercase">Zophiel Engine</span>
                </div>
                <p className="text-xs font-extralight text-muted-foreground text-center">
                  Proprietary Backend — Fully Automated Intelligence Processing
                </p>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {[
                    "Multi-Model Orchestration",
                    "Real-Time Source Aggregation",
                    "Entity Resolution & Correlation",
                    "Autonomous Agent Swarms",
                    "Encrypted Data Pipeline",
                    "Continuous Learning Engine",
                  ].map(label => (
                    <div key={label} className="rounded-xl border border-border/15 bg-card/15 px-3 py-2 text-center">
                      <span className="text-[9px] font-extralight text-muted-foreground/80">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="w-px h-8 bg-gradient-to-b from-border/30 to-transparent" />

              <div className="rounded-2xl border border-border/15 bg-card/10 px-8 py-4">
                <span className="text-[10px] font-extralight tracking-[0.3em] text-muted-foreground/50 uppercase">40+ Intelligence Sources · End-to-End Encrypted · Zero Data Retention</span>
              </div>
            </div>
          </div>
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

          <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start max-w-4xl mx-auto">
            {/* Aureon */}
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 sm:p-10 flex flex-col text-left">
              <p className="text-xs font-light tracking-[0.25em] text-muted-foreground uppercase">AI Intelligence</p>
              <h3 className="mt-2 text-lg font-light tracking-[0.15em] text-foreground">AUREON</h3>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl sm:text-5xl font-extralight tracking-tight text-foreground">$199</span>
                <span className="text-lg text-muted-foreground font-extralight">/ month</span>
              </div>
              <p className="mt-4 text-sm font-extralight leading-relaxed text-muted-foreground">Full access to Aureon AI — uncensored, unfiltered. 200 messages per 3-hour window across Chat & IDE.</p>
              <Link to="/pricing" className="group mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3.5 text-sm font-light tracking-wide text-background hover:bg-foreground/90 transition-all">
                Get Aureon Access <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <div className="my-8 h-px bg-border/15" />
              <ul className="space-y-3 flex-1">
                {["Uncensored AI responses on any topic", "200 messages per 3-hour window (Chat + IDE shared)", "Aureon IDE — full cloud development environment", "Elite coding engine", "Zophiel Search Engine", "Persistent memory across all sessions", "Code Snippets Vault", "End-to-end encryption", "Data never sold or trained on"].map(f => (
                  <li key={f} className="flex items-start gap-3 text-sm font-extralight text-foreground/85">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" /> {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Pro */}
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 sm:p-10 flex flex-col text-left">
              <p className="text-xs font-light tracking-[0.25em] text-muted-foreground uppercase">Full Dashboard Access</p>
              <h3 className="mt-2 text-lg font-light tracking-[0.15em] text-foreground">AUREON PRO</h3>
              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl sm:text-5xl font-extralight tracking-tight text-foreground">$740</span>
                <span className="text-lg text-muted-foreground font-extralight">/ month</span>
              </div>
              <p className="mt-4 text-sm font-extralight leading-relaxed text-muted-foreground">Complete access to every tool — IDE, Google Intelligence, Asha, NOMAD, Predictive Intelligence, and more.</p>
              <Link to="/pricing" className="group mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3.5 text-sm font-light tracking-wide text-background hover:bg-foreground/90 transition-all">
                Get Pro Access <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <div className="my-8 h-px bg-border/15" />
              <ul className="space-y-3 flex-1">
                {["Everything in Aureon — expanded", "200 messages per 3 hours", "Google Intelligence Suite", "Asha Data Intelligence Platform", "NOMAD Public Intelligence Agent", "Elion / Zohar Toolkit", "ZALI Design Intelligence Lab", "Predictive Intelligence & forecasting", "Daily Intelligence Briefings", "Security Dashboard & threat intel"].map(f => (
                  <li key={f} className="flex items-start gap-3 text-sm font-extralight text-foreground/85">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" /> {f}
                  </li>
                ))}
              </ul>
            </div>
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
                This is the same principle behind every serious intelligence operation in history. In warfare, your best asset isn't the technology — it's the intelligence feeding it. You can't win a war without data. That's why the American government built <span className="text-foreground font-light">Palantir</span>. And that's why we built <span className="text-foreground font-light">Aureon</span> for you — and <span className="text-foreground font-light">Zophiel</span> as our intelligence officer.
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
      <footer className="relative z-10 px-6 pb-8 pt-16">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md px-8 py-10 sm:px-12">
            <div className="flex flex-col gap-8">
              {/* Left — Branding */}
              <div className="text-center sm:text-left">
                <p className="text-sm font-light tracking-[0.2em] text-foreground">
                  AUREON
                </p>
                <p className="mt-1 text-xs font-extralight tracking-wide text-muted-foreground">
                  Powered by Zorak Corp & House Of Asher
                </p>
              </div>

            {/* Links Grid */}
              <div className="w-full grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-6 mt-6 sm:mt-0">
                <div className="flex flex-col gap-2">
                  <p className="text-[9px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase mb-1">Intelligence</p>
                  <Link to="/feature/google-intelligence" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Google Intelligence</Link>
                  <Link to="/feature/zophiel" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Zophiel Search</Link>
                  <Link to="/feature/nomad" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">NOMAD OSINT</Link>
                  <Link to="/feature/asha" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Asha Intelligence</Link>
                  <Link to="/feature/predictive" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Predictive Intelligence</Link>
                  <Link to="/feature/oracle-locus" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Oracle Locus</Link>
                  <Link to="/feature/security" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Security Dashboard</Link>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-[9px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase mb-1">Agents & Tools</p>
                  <Link to="/feature/personas" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">AI Personas</Link>
                  <Link to="/feature/briefings" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Daily Briefings</Link>
                  <Link to="/feature/elion" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Elion / Zohar</Link>
                  <Link to="/feature/tracker" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Location Tracker</Link>
                  <Link to="/feature/notebooks" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Notebooks</Link>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-[9px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase mb-1">Creation</p>
                  <Link to="/feature/zali" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">ZALI Design Lab</Link>
                  <Link to="/feature/imagine-to-code" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Imagine To Code</Link>
                  <Link to="/feature/ide" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Aureon IDE</Link>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-[9px] font-medium tracking-[0.2em] text-muted-foreground/50 uppercase mb-1">Company</p>
                  <Link to="/features" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">All Features</Link>
                  <Link to="/founder" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Founder</Link>
                  <Link to="/pricing" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
                  <Link to="/prompt-engineering" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Prompt Engineering</Link>
                  <Link to="/benchmarks" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Benchmarks</Link>
                  <Link to="/equity" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Equity Ownership</Link>
                  <Link to="/terms" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
                </div>
              </div>

              {/* Bottom — Copyright */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-border/15">
                <p className="text-xs font-extralight tracking-wide text-muted-foreground/50">
                  © {new Date().getFullYear()} Zorak Corp
                </p>
                <p className="text-[10px] font-extralight tracking-wide text-muted-foreground/30">
                  AUREON — Founded June 28, 2026
                </p>
                <a href="https://x.com/shep_newton" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                  <Twitter className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
      </ScrollSection>
    </LandingBackground>
  );
};

export default Index;
