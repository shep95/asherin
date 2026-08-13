import { useEffect } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";

/**
 * /blog/venice-integration — long-form post on how Asherin wires the
 * Venice AI uncensored stack into the default chat experience so
 * operators get unfiltered intelligence without managing a key.
 */
const BlogVeniceIntegration = () => {
  useEffect(() => {
    const id = "blog-venice-jsonld";
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = id;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline:
        "Venice AI integration in Asherin — unfiltered intelligence with zero setup",
      description:
        "How Asherin routes free-tier and BYOK traffic through Venice AI so operators get uncensored, vision-capable answers without configuring a Venice key.",
      datePublished: "2026-06-14",
      author: { "@type": "Person", name: "Asher Newton" },
      mainEntityOfPage: "https://asherin.com/blog/venice-integration",
      keywords: [
        "venice ai",
        "venice ai integration",
        "unfiltered ai",
        "uncensored ai",
        "aureon",
      ],
    });
    return () => {
      el?.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <article className="mx-auto max-w-3xl px-6 pt-32 pb-24">
        <nav className="mb-8 text-xs font-extralight tracking-[0.3em] uppercase text-muted-foreground">
          <Link to="/blog" className="hover:text-foreground transition-colors">
            ← Asherin Journal
          </Link>
        </nav>

        <header className="mb-12">
          <p className="text-[10px] font-extralight tracking-[0.4em] uppercase text-accent/80 mb-4">
            Integration · 2026-06-14 · 6 min read
          </p>
          <h1 className="text-4xl sm:text-5xl font-light tracking-tight leading-[1.1] text-foreground">
            Venice AI integration in Asherin — unfiltered intelligence with zero setup
          </h1>
          <p className="mt-6 text-lg font-extralight leading-relaxed text-foreground/75">
            Most people who search for &ldquo;Venice AI&rdquo; or &ldquo;unfiltered AI&rdquo; want one
            thing: an honest model that does not lecture them. Asherin ships that on day one — no
            account at venice.ai required, no key to paste, no Discord to join.
          </p>
        </header>

        <section className="space-y-6 text-base font-extralight leading-[1.8] text-foreground/80">
          <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
            The default path: Venice for everyone without a BYOK key
          </h2>
          <p>
            When a non-admin operator opens Asherin and has not added their own provider key, the
            backend resolver routes their chat to Venice AI&rsquo;s <code>mistral-31-24b</code>
            model. That model is uncensored, vision-capable, and strong at code — the same profile
            a power user would pick if they were wiring Venice up themselves. The Asherin platform
            pays for those tokens so the operator can keep working without a billing detour.
          </p>

          <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
            BYOK always wins — even over Venice
          </h2>
          <p>
            If you bring your own key — Gemini, OpenAI, Claude, Groq, DeepSeek, Mistral, xAI, or
            OpenRouter — Asherin uses it. The Venice fallback exists to keep the &ldquo;no setup&rdquo;
            promise honest, not to override your choices. The resolver order is simple: admin
            traffic uses the platform Gemini key, BYOK traffic uses the user&rsquo;s key, and
            everything else falls back to Venice. There is no monthly subscription gating any of
            this.
          </p>

          <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
            Why Venice over a generic &ldquo;jailbreak prompt&rdquo;
          </h2>
          <p>
            Prompt-engineered jailbreaks against a censored base model degrade quickly. Venice
            ships an uncensored stack at the model layer, which means the answers stay coherent
            under pressure — long-form analysis, security research, adversarial role-play, and
            forensic reconstructions do not collapse into refusals halfway through. Asherin&rsquo;s
            persona system stacks on top of that base, not in spite of it.
          </p>

          <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
            What you actually get
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Uncensored chat by default, with vision and code execution.</li>
            <li>No Venice account, no API key, no monthly subscription.</li>
            <li>Drop-in BYOK whenever you want to spend your own tokens.</li>
            <li>Same Asherin UI, Personas, Project Folders, and OSINT tooling on top.</li>
          </ul>

          <h2 className="text-2xl font-light tracking-tight text-foreground pt-4">
            Compare with the closed stacks
          </h2>
        </section>
      </article>

      <SiteFooter />
    </div>
  );
};

export default BlogVeniceIntegration;
