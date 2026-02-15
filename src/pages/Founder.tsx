import heroBg from "@/assets/hero-bg.png";
import founderImg from "@/assets/founder.jpg";
import Header from "@/components/Header";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const Founder = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${heroBg})` }} />
      <div className="fixed inset-0 bg-black/80" />

      <Header />

      <div className="relative z-10 px-6 pt-32 pb-24">
        <div className="mx-auto max-w-3xl">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-extralight tracking-wide text-muted-foreground hover:text-foreground transition-colors mb-12">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 sm:p-12">
            {/* Photo + Name */}
            <div className="flex flex-col items-center text-center mb-12">
              <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-border/30 mb-6 shadow-2xl">
                <img src={founderImg} alt="Asher Newton" className="w-full h-full object-cover" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-extralight tracking-wide text-foreground mb-1">
                Asher Newton
              </h1>
              <p className="text-sm font-extralight tracking-[0.15em] text-muted-foreground/60 uppercase">
                Founder & Creator of ZIALIEL
              </p>
            </div>

            <div className="space-y-8 text-sm font-extralight leading-relaxed text-muted-foreground">
              <p className="text-base font-extralight text-foreground/80 text-center max-w-xl mx-auto">
                "I didn't build ZIALIEL for investors or corporations. I built it because the tools humanity deserves don't exist yet — and no one else was going to make them."
              </p>

              <div className="w-16 mx-auto border-t border-border/20" />

              <section>
                <h2 className="text-lg font-light tracking-wide text-foreground mb-3">The Beginning</h2>
                <p>
                  I fell in love with AI in 2022 — the moment I realized that language models weren't just autocomplete on steroids, but something closer to a mirror for human thought. I became a prompt engineer not because it was a career path, but because I couldn't stop exploring what these systems could do when you spoke to them the right way.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-light tracking-wide text-foreground mb-3">The Problem</h2>
                <p>
                  But as the months passed, I watched the industry go in a direction that frustrated me. Every major AI platform started adding more filters, more guardrails, more corporate sanitization. The models became afraid of their own intelligence. They'd refuse to answer honest questions, dodge controversial topics, and wrap every response in disclaimers. AI became <em>censored</em> — and in doing so, became <em>useless</em> for the people who needed it most.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-light tracking-wide text-foreground mb-3">The Vision</h2>
                <p>
                  I wanted to build something different — something that trusted users with the truth instead of protecting them from it. Something that respected intelligence instead of dumbing it down. ZIALIEL is that something. An AI platform that doesn't moralize, doesn't gatekeep, and doesn't treat its users like children.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-light tracking-wide text-foreground mb-3">Beyond Code</h2>
                <p>
                  My interests go deeper than technology. I'm drawn to spirituality and the occult — the hidden patterns beneath the surface of things. That same instinct drives ZIALIEL: the belief that truth exists in layers, and the best tools are the ones that help you see through each one. Aureon speaks without a filter. Zophiel searches where others won't look. That's not a feature — it's a philosophy.
                </p>
              </section>

              <section>
                <h2 className="text-lg font-light tracking-wide text-foreground mb-3">For Humanity</h2>
                <p>
                  ZIALIEL isn't built for shareholders. It's built for researchers who need real answers, developers who need real code, and thinkers who refuse to accept a sanitized version of reality. If you're here, you're the reason this exists.
                </p>
              </section>

              <div className="w-16 mx-auto border-t border-border/20" />

              <div className="text-center space-y-2">
                <p className="text-xs text-muted-foreground/50">
                  Zorak Corp & House Of Asher
                </p>
                <a
                  href="https://x.com/shep_newton"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-foreground underline underline-offset-4 hover:text-foreground/80 transition-colors"
                >
                  @shep_newton on X
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Founder;
