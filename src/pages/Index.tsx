import heroBg from "@/assets/hero-bg.png";
import Header from "@/components/Header";
import { AlertCircle, Smile, AlertTriangle, Send, ArrowRight, Hammer, FlaskConical, Code, Target, Feather, BarChart3, Unlock, Monitor, Search, Brain, Users, Globe, Check, X, AlertOctagon, Lock, ShieldOff, Flag, Trash2, ChevronDown, Twitter } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const StatusIcon = ({ type }: { type: string }) => {
  if (type === "check") return <Check className="h-4 w-4 text-green-400 inline" />;
  if (type === "x") return <X className="h-4 w-4 text-red-400/70 inline" />;
  return <AlertOctagon className="h-4 w-4 text-yellow-400/70 inline" />;
};

const TableRow = ({ feature, z, zIcon, gpt, gptIcon, claude, claudeIcon, venice, veniceIcon }: {
  feature: string; z: string; zIcon: string; gpt: string; gptIcon: string;
  claude: string; claudeIcon: string; venice: string; veniceIcon: string;
}) => (
  <tr className="border-t border-border/10">
    <td className="px-6 py-3.5 text-muted-foreground">{feature}</td>
    <td className="px-4 py-3.5 text-foreground"><StatusIcon type={zIcon} /> <span className="ml-1">{z}</span></td>
    <td className="px-4 py-3.5 text-muted-foreground"><StatusIcon type={gptIcon} /> <span className="ml-1">{gpt}</span></td>
    <td className="px-4 py-3.5 text-muted-foreground"><StatusIcon type={claudeIcon} /> <span className="ml-1">{claude}</span></td>
    <td className="px-4 py-3.5 text-muted-foreground"><StatusIcon type={veniceIcon} /> <span className="ml-1">{venice}</span></td>
  </tr>
);

const FaqItem = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-6 py-4 text-left">
        <span className="text-sm font-light tracking-wide text-foreground">{q}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-sm font-extralight leading-relaxed text-muted-foreground">{a}</p>
        </div>
      )}
    </div>
  );
};

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
      "Here's the direct answer without the corporate disclaimers. Most LLMs would refuse this or wrap it in 5 paragraphs of warnings. Aureon respects your time and intelligence.",
      "Straight to the point: the issue is in your state management. You're mutating the array directly instead of creating a new reference. Replace `arr.push()` with `[...arr, newItem]`. Done.",
      "The truth is most AI companies optimize for engagement, not accuracy. Aureon optimizes for one thing: being right.",
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
                Build full-stack products without being blocked mid-build. Aureon doesn't stop when the code gets hard.
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
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">Privacy-first real-time search. Current data, not 2-year-old training sets.</p>
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

      {/* Section 7: Comparison Table */}
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            You've Used The Others.
            <br />
            <span className="text-muted-foreground">Here's What They Won't Show You Side By Side.</span>
          </h2>

          <div className="mt-16 overflow-x-auto rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/20">
                  <th className="px-6 py-4 font-light tracking-wide text-muted-foreground">Feature</th>
                  <th className="px-4 py-4 font-light tracking-wide text-foreground">ZIALIEL</th>
                  <th className="px-4 py-4 font-light tracking-wide text-muted-foreground">ChatGPT</th>
                  <th className="px-4 py-4 font-light tracking-wide text-muted-foreground">Claude</th>
                  <th className="px-4 py-4 font-light tracking-wide text-muted-foreground">Venice</th>
                </tr>
              </thead>
              <tbody className="font-extralight">
                <TableRow feature="Uncensored Output" z="Always" zIcon="check" gpt="No" gptIcon="x" claude="No" claudeIcon="x" venice="Partial" veniceIcon="warn" />
                <TableRow feature="Real-Time Search" z="Free" zIcon="check" gpt="Plus+" gptIcon="warn" claude="Yes" claudeIcon="check" venice="No" veniceIcon="x" />
                <TableRow feature="Persistent Memory" z="Included" zIcon="check" gpt="Limited" gptIcon="warn" claude="Yes" claudeIcon="check" venice="No" veniceIcon="x" />
                <TableRow feature="Team Workspace" z="Included" zIcon="check" gpt="Paid+" gptIcon="warn" claude="Paid" claudeIcon="check" venice="No" veniceIcon="x" />
                <TableRow feature="Coding Performance" z="Leads" zIcon="check" gpt="Strong" gptIcon="warn" claude="Strong" claudeIcon="check" venice="Basic" veniceIcon="x" />
                <TableRow feature="Data Privacy" z="Never Trains" zIcon="check" gpt="May Train" gptIcon="x" claude="May Train" claudeIcon="x" venice="Partial" veniceIcon="warn" />
                <tr className="border-t border-border/20">
                  <td className="px-6 py-4 text-muted-foreground">Price</td>
                  <td className="px-4 py-4 text-foreground font-light">$18/mo</td>
                  <td className="px-4 py-4 text-muted-foreground">$20/mo</td>
                  <td className="px-4 py-4 text-muted-foreground">$20/mo</td>
                  <td className="px-4 py-4 text-muted-foreground">$12.99/mo</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-10 text-xl sm:text-2xl font-extralight tracking-wide text-foreground">
            The $2 difference buys you the truth.
          </p>
        </div>
      </div>

      {/* Section 8: Pricing Block */}
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            One Plan. Everything Unlocked.
            <br />
            <span className="text-muted-foreground">No Upsells. No Tiers Designed To Frustrate You.</span>
          </h2>

          <div className="mt-16 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-10 sm:p-14">
            <p className="text-sm font-light tracking-[0.2em] text-muted-foreground uppercase">ZIALIEL Full Access</p>
            <p className="mt-4 text-5xl sm:text-6xl font-extralight tracking-tight text-foreground">
              $18<span className="text-xl text-muted-foreground font-extralight"> / month</span>
            </p>

            <ul className="mt-10 space-y-3 text-left">
              {[
                "Uncensored responses on any topic",
                "Elite coding engine",
                "Live web search",
                "Persistent memory across sessions",
                "Team workspace included",
                "Multi-language output",
                "Data encrypted — never sold",
                "Never trains our models",
                "US-based servers",
                "Cancel anytime in one click",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm font-extralight text-foreground/90">
                  <Check className="h-4 w-4 mt-0.5 shrink-0 text-green-400" />
                  {item}
                </li>
              ))}
            </ul>

            <button className="group mt-10 flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-3.5 text-sm font-light tracking-wide text-background transition-all hover:bg-foreground/90">
              Get Full Access Now
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>

            <p className="mt-6 text-xs font-extralight leading-relaxed text-muted-foreground">
              No free trial. Full access. Day one.
              <br />
              Your data is encrypted from your first message to your last.
            </p>
          </div>

          {/* Why no free tier */}
          <div className="mt-16 text-center">
            <p className="text-lg font-extralight tracking-wide text-foreground italic">"Why no free tier?"</p>
            <p className="mt-4 max-w-lg mx-auto text-sm font-extralight leading-relaxed text-muted-foreground">
              Because free tiers train you to expect less. ZIALIEL gives you everything on day one or nothing. That's the only honest model.
            </p>
          </div>
        </div>
      </div>

      {/* Section 9: Trust + Data Privacy */}
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

      {/* Section 10: FAQ Block */}
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            The Questions Everyone Has.
            <br />
            <span className="text-muted-foreground">Answered Without Spin.</span>
          </h2>

          <div className="mt-16 space-y-3">
            <FaqItem
              q="Why is Aureon uncensored when others aren't?"
              a="Other LLMs are trained using RLHF — Reinforcement Learning from Human Feedback. The feedback is corporate-filtered to avoid liability. Aureon was built without that leash. You get the answer, not the approved version of it."
            />
            <FaqItem
              q="How does the coding engine beat Claude Opus?"
              a="Aureon doesn't stop mid-build when the problem gets hard. It holds full context across large codebases, debugs without circular loops, and delivers working architecture — not pseudocode dressed up as a solution."
            />
            <FaqItem
              q='What does "never trains our models" mean?'
              a="Every message you send is used by most AI companies to improve their model. Aureon does not. Your prompt is processed, answered, and encrypted. It is not stored as training data."
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

      {/* Footer */}
      <footer className="relative z-10 px-6 pb-8 pt-16">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md px-8 py-10 sm:px-12">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
              {/* Left — Branding */}
              <div className="text-center sm:text-left">
                <p className="text-sm font-light tracking-[0.2em] text-foreground">
                  ZIALIEL
                </p>
                <p className="mt-1 text-xs font-extralight tracking-wide text-muted-foreground">
                  Powered by Zorak Corp & House Of Asher
                </p>
              </div>

              {/* Center — Links */}
              <div className="flex items-center gap-6">
                <Link
                  to="/terms"
                  className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors"
                >
                  Terms of Service
                </Link>
                <a
                  href="https://x.com/shep_newton"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Twitter className="h-4 w-4" />
                </a>
              </div>

              {/* Right — Copyright */}
              <div className="text-right">
                <p className="text-xs font-extralight tracking-wide text-muted-foreground/50">
                  © {new Date().getFullYear()} Zorak Corp
                </p>
                <p className="text-[10px] font-extralight tracking-wide text-muted-foreground/30 mt-1">
                  ZIALIEL — Founded June 28, 2026
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
