import heroBg from "@/assets/hero-bg.jpeg";
import Header from "@/components/Header";
import { AlertCircle, Smile, AlertTriangle, Send, ArrowRight, Hammer, FlaskConical, Code, Target, Feather, BarChart3, Unlock, Monitor, Search, Brain, Users, Globe } from "lucide-react";
import { useState } from "react";

const Index = () => {
  const [demoQuery, setDemoQuery] = useState("");
  const [demoResponse, setDemoResponse] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [demoCount, setDemoCount] = useState(() => {
    return parseInt(localStorage.getItem("zialiel_demo_count") || "0", 10);
  });
  const maxDemos = 3;

  const handleDemo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoQuery.trim() || isTyping || demoCount >= maxDemos) return;
    const newCount = demoCount + 1;
    setDemoCount(newCount);
    localStorage.setItem("zialiel_demo_count", String(newCount));
    setIsTyping(true);

    const responses = [
      "Here's the direct answer without the corporate disclaimers. Most LLMs would refuse this or wrap it in 5 paragraphs of warnings. ZIALIEL respects your time and intelligence.",
      "Straight to the point: the issue is in your state management. You're mutating the array directly instead of creating a new reference. Replace `arr.push()` with `[...arr, newItem]`. Done.",
      "The truth is most AI companies optimize for engagement, not accuracy. ZIALIEL optimizes for one thing: being right.",
    ];
    const response = responses[Math.floor(Math.random() * responses.length)];

    let i = 0;
    const interval = setInterval(() => {
      setDemoResponse(response.slice(0, i + 1));
      i++;
      if (i >= response.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 18);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Fixed background image with dark overlay */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      <div className="fixed inset-0 bg-black/80" />

      {/* Header */}
      <Header />

      {/* Hero */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="max-w-3xl text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight text-foreground">
          The AI That Actually Tells You The Truth.
        </h1>
        <p className="mt-6 max-w-2xl text-base sm:text-lg font-extralight leading-relaxed tracking-wide text-muted-foreground">
          No filters. No emotional manipulation. No hidden agendas. ZIALIEL gives you uncensored answers, brutal logic, and code that outperforms the leading models.
        </p>
      </div>

      {/* Section 2: The Pain Amplifier */}
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            You've Been Asking AI Questions.
            <br />
            It's Been Giving You PR Responses.
          </h2>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <AlertCircle className="h-8 w-8 text-foreground" />
              <h3 className="mt-4 text-lg font-light tracking-wide text-foreground">"I Can't Help With That"</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">Every time you ask something real, you get a disclaimer instead of an answer.</p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Smile className="h-8 w-8 text-foreground" />
              <h3 className="mt-4 text-lg font-light tracking-wide text-foreground">Emotional Engineering</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">Other LLMs are trained to make you feel good, not to tell you what's actually true.</p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <AlertTriangle className="h-8 w-8 text-foreground" />
              <h3 className="mt-4 text-lg font-light tracking-wide text-foreground">Code That Doesn't Work</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">You paste the error back 6 times and still get the same broken logic wrapped in confidence.</p>
            </div>
          </div>

          <p className="mt-16 text-xl sm:text-2xl font-extralight tracking-wide text-foreground">
            ZIALIEL was built for one reason:
            <br />
            <span className="text-muted-foreground">You deserve an AI that respects your intelligence.</span>
          </p>
        </div>
      </div>

      {/* Section 3: Live Demo Block */}
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
              <span className="text-sm font-light tracking-[0.2em] text-foreground">ZIALIEL LIVE</span>
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
                    placeholder="Ask ZIALIEL anything..."
                    className="flex-1 bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none"
                  />
                  <button type="submit" className="text-foreground/60 hover:text-foreground transition-colors">
                    <Send className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-extralight text-muted-foreground/50">{maxDemos - demoCount} left</span>
                </form>
              )}

              {(demoResponse || isTyping) && (
                <div className="mt-6 rounded-xl border border-border/10 bg-background/20 p-5">
                  <p className="text-sm font-extralight leading-relaxed text-foreground/90">
                    {demoResponse}
                    {isTyping && <span className="inline-block w-0.5 h-4 bg-foreground/60 animate-pulse ml-0.5 align-text-bottom" />}
                  </p>
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

      {/* Section 4: Use Case Identity Grid */}
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            Built For People Who Are Done
            <br />
            <span className="text-muted-foreground">Being Managed By Their Tools.</span>
          </h2>

          {/* Row 1 */}
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Hammer className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">For Builders</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                Build full-stack products without being blocked mid-build. ZIALIEL doesn't stop when the code gets hard.
              </p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <FlaskConical className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">For Researchers</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                Get the real data on any topic — not the sanitized version. No "I'd recommend consulting a professional."
              </p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Code className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">For Coders</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                Outperform Claude Opus on every benchmark. Debug. Build. Ship. No re-running the same prompt 12 times.
              </p>
            </div>
          </div>

          {/* Row 2 */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Target className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">For Strategists</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                Understand what is actually happening in any market, conflict, or system.
              </p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Feather className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">For Writers</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                Write without the AI rewriting your edge out of your voice to be "safe."
              </p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <BarChart3 className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">For Analysts</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                Get the economic and structural truth behind any event — not the surface headline.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 5: Featured In */}
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

      {/* Section 6: Features Breakdown */}
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            What ZIALIEL Actually Does.
            <br />
            <span className="text-muted-foreground">Specific. No Buzzwords.</span>
          </h2>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Unlock className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">Uncensored Responses</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">No topic triggers a shutdown. No hidden training bias. You get the full answer.</p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Monitor className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">Elite Coding Engine</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">Outperforms Claude Opus on complex builds, debugging, and multi-file architecture.</p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Search className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">Live Web Intelligence</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">DuckDuckGo-powered real-time search. Current data, not 2-year-old training sets.</p>
            </div>
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Brain className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">Persistent Memory</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">ZIALIEL remembers your context, preferences, and projects across every session.</p>
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
    </div>
  );
};

export default Index;
