import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import LandingBackground from "@/components/LandingBackground";
import { ArrowLeft, ArrowRight, Key, Brain, Zap, Shield, RefreshCw, Settings, ToggleRight, Cpu } from "lucide-react";

const providers = [
  { icon: "◈", name: "Google AI (Gemini)", models: "Gemini 3.1 Pro, 3.1 Flash Lite, 2.5 Pro, 2.5 Flash" },
  { icon: "◉", name: "OpenAI", models: "GPT-5.4, GPT-5.3, GPT-5.2, GPT-4.1, o4-mini, o3" },
  { icon: "◎", name: "Anthropic (Claude)", models: "Claude Opus 4.6, Sonnet 4.6, Sonnet 4, 3.5 Haiku" },
  { icon: "◇", name: "Meta AI (Llama)", models: "Llama 4 Maverick, Llama 4 Scout, 3.3 70B, 3.1 405B" },
  { icon: "◆", name: "Venice AI", models: "Llama 3.1 405B, Dolphin 2.9, Nous Hermes 2 — uncensored" },
  { icon: "◌", name: "xAI (Grok)", models: "Grok 4, Grok 4 Fast, Grok Code, Grok 3" },
  { icon: "◐", name: "Mistral AI", models: "Medium 3.1, Large, Codestral, Small, Pixtral Large" },
  { icon: "◔", name: "DeepSeek", models: "DeepSeek V3, DeepSeek R1" },
  { icon: "◈", name: "Perplexity AI", models: "Sonar Pro, Sonar, Reasoning Pro, Deep Research" },
];

const capabilities = [
  { icon: Key, title: "Secure Key Storage", description: "API keys are stored encrypted in your account. Never shared, never logged, never used for anything except your requests." },
  { icon: Brain, title: "Model Selection", description: "Choose exactly which model to use per-provider. Switch between GPT-4o and Claude Sonnet 4 in seconds from Settings." },
  { icon: Zap, title: "Platform-Wide Integration", description: "Your chosen model powers everything — Chat, IDE, Zophiel Search, NOMAD, Azplen, Briefings, and all other Aureon tools." },
  { icon: RefreshCw, title: "Automatic Fallback", description: "If your API key hits rate limits or errors, Aureon's built-in engine takes over seamlessly — zero downtime." },
  { icon: Settings, title: "One-Click Switching", description: "Switch between Aureon Default and any of your connected providers instantly. No restart, no reconfiguration." },
  { icon: Shield, title: "Zero Lock-In", description: "Use Aureon's built-in engine anytime. Your keys are optional — they extend capability, they don't replace it." },
];

const FeatureBYOK = () => {
  useEffect(() => {
    document.title = "Bring Your Own AI Key — Aureon | Use Your Preferred Models";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Bring your own API keys from Google, OpenAI, Claude, Meta, Venice, xAI, Mistral, DeepSeek & Perplexity. Use your preferred AI models across all Aureon tools.");
  }, []);

  return (
    <LandingBackground>
      <Header />
      <div className="relative z-10 pt-24 px-6">
        <Link to="/features" className="inline-flex items-center gap-2 text-xs font-light tracking-wide text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Features
        </Link>
      </div>

      {/* Hero */}
      <div className="relative z-10 pt-8 pb-16 px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/20 bg-card/30 px-4 py-1.5 mb-6">
          <Key className="h-3.5 w-3.5 text-accent" />
          <span className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">All Tiers</span>
        </div>
        <h1 className="max-w-3xl mx-auto text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Bring Your Own AI Key.
        </h1>
        <p className="mt-6 max-w-xl mx-auto text-base font-extralight leading-relaxed text-muted-foreground">
          Connect your own API keys and use your preferred AI models across every Aureon tool. 8 providers, dozens of models — your choice.
        </p>
      </div>

      {/* Supported Providers */}
      <div className="relative z-10 px-6 pb-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-10">
            Supported Providers.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {providers.map(({ icon, name, models }) => (
              <div key={name} className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-md p-5 transition-all hover:border-border/30">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{icon}</span>
                  <h3 className="text-sm font-light tracking-wide text-foreground">{name}</h3>
                </div>
                <p className="text-[11px] font-extralight leading-relaxed text-muted-foreground">{models}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Capabilities */}
      <div className="relative z-10 px-6 pb-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-10">
            How It Works.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {capabilities.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-md p-5 transition-all hover:border-border/30">
                <Icon className="h-5 w-5 text-foreground mb-3" />
                <h3 className="text-sm font-light tracking-wide text-foreground mb-2">{title}</h3>
                <p className="text-xs font-extralight leading-relaxed text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How to Set Up */}
      <div className="relative z-10 px-6 pb-24">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 sm:p-10">
            <ToggleRight className="h-8 w-8 text-foreground mx-auto mb-4" />
            <h2 className="text-center text-xl font-extralight tracking-wide text-foreground mb-6">Setup in 30 Seconds.</h2>
            <ol className="space-y-4">
              {[
                "Open Dashboard → Settings → AI Model Keys",
                "Expand any provider and paste your API key",
                "Select the model you want to use",
                "Done — your chosen model now powers all Aureon tools",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full border border-border/20 bg-card/20 text-xs font-light text-foreground shrink-0">{i + 1}</span>
                  <span className="text-sm font-extralight leading-relaxed text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="relative z-10 px-6 pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md px-8 py-10">
            <h2 className="text-2xl font-extralight tracking-wide text-foreground">Your Models. Your Keys. Your Intelligence.</h2>
            <p className="mt-4 text-sm font-extralight text-muted-foreground">Available on all subscription tiers.</p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/pricing" className="group flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-light tracking-wide text-background hover:bg-foreground/90 transition-all">
                View Pricing <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link to="/features" className="group flex items-center gap-2 rounded-xl border border-border/30 bg-card/30 px-6 py-3 text-sm font-light tracking-wide text-foreground hover:bg-card/50 transition-all">
                All Features <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 px-6 pb-8 pt-4">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
            <p className="text-sm font-light tracking-[0.2em] text-foreground">AUREON</p>
            <div className="flex items-center gap-6 flex-wrap justify-center">
              <Link to="/" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Home</Link>
              <Link to="/features" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Features</Link>
              <Link to="/pricing" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Pricing</Link>
              <Link to="/terms" className="text-xs font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors">Terms</Link>
            </div>
            <p className="text-xs font-extralight tracking-wide text-muted-foreground/50">© {new Date().getFullYear()} Zorak Corp</p>
          </div>
        </div>
      </footer>
    </LandingBackground>
  );
};

export default FeatureBYOK;
