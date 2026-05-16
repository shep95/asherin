import { useEffect } from "react";
import LandingBackground from "@/components/LandingBackground";
import founderImg from "@/assets/founder.jpg";
import Header from "@/components/Header";
import { Link } from "react-router-dom";
import { applySeoHead } from "@/lib/seoHead";
import { ArrowLeft, Twitter, Globe, Zap, Shield, Eye, Instagram, BookOpen, Download, Youtube, Sparkles } from "lucide-react";
import FounderVideos from "@/components/founder/FounderVideos";
import imagineMaterialVsDivine from "@/assets/founder-imagine-material-vs-divine-love.png";
import imagineMoneyWarControl from "@/assets/founder-imagine-money-war-control.png";

const bookPages = Array.from(
  { length: 116 },
  (_, index) => `/books/asher-aureon-elion-pages/page-${String(index + 1).padStart(3, "0")}.jpg`
);

const symbolismBookPages = Array.from(
  { length: 62 },
  (_, index) => `/books/asher-aureon-elion-symbolism-pages/page-${String(index + 1).padStart(3, "0")}.jpg`
);

const Founder = () => {
  useEffect(() => {
    applySeoHead({
      title: "Asher Newton — Founder of Aureon",
      description: "Meet Asher Newton, founder of Aureon — the uncensored AI intelligence platform. Vision, mission, and videos from the founder.",
      path: "/founder",
    });
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Meet Asher Newton, the founder of Aureon — the uncensored AI intelligence platform built for researchers, developers, and truth-seekers.");
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = "founder-jsonld";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Asher Newton",
      jobTitle: "Founder of Aureon",
      url: "https://aureonai.app/founder",
      description: "Founder of Aureon — uncensored AI intelligence platform.",
    });
    document.head.appendChild(ld);
    return () => { document.getElementById("founder-jsonld")?.remove(); };
  }, []);

  return (
    <LandingBackground>

      <Header />

      {/* Hero Section */}
      <div className="relative z-10 flex min-h-[80vh] flex-col items-center justify-center px-6 text-center pt-20">
        <Link to="/" className="inline-flex items-center gap-2 text-xs font-extralight tracking-[0.15em] text-muted-foreground/60 hover:text-foreground transition-colors mb-16 uppercase">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Home
        </Link>

        <div className="w-36 h-36 rounded-2xl overflow-hidden border border-border/20 mb-8 shadow-2xl shadow-black/50">
          <img src={founderImg} alt="Asher Newton" className="w-full h-full object-cover" />
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extralight tracking-wide leading-tight zophiel-shimmer-text">
          Asher Newton
        </h1>
        <p className="mt-3 text-sm font-extralight tracking-[0.25em] text-muted-foreground/50 uppercase">
          Founder & Creator of Aureon
        </p>

        <p className="mt-10 max-w-2xl text-base sm:text-lg font-extralight leading-relaxed tracking-wide text-muted-foreground">
          "I didn't build Aureon for investors or corporations. I built it because the tools humanity deserves don't exist yet — and no one else was going to make them."
        </p>

        <div className="mt-12 inline-flex items-center gap-1 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-md p-1.5">
          <a
            href="#ebook"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("ebook")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-light tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Ebook
          </a>
          <a
            href="#videos"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("videos")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-light tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all"
          >
            <Youtube className="h-3.5 w-3.5" />
            Videos
          </a>
          <a
            href="#imagines"
            onClick={(e) => {
              e.preventDefault();
              document.getElementById("imagines")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-light tracking-[0.2em] uppercase text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Imagines
          </a>
        </div>
      </div>

      {/* Philosophy Cards */}
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground text-center">
            The Story Behind
            <br />
            <span className="text-muted-foreground">The Machine.</span>
          </h2>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Zap className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">The Beginning</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                I fell in love with AI in 2022 — the moment I realized that language models weren't just autocomplete on steroids, but something closer to a mirror for human thought. I became a prompt engineer not because it was a career path, but because I couldn't stop exploring what these systems could do when you spoke to them the right way.
              </p>
            </div>

            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Shield className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">The Problem</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                As the months passed, I watched the industry go in a direction that frustrated me. Every major AI platform started adding more filters, more guardrails, more corporate sanitization. The models became afraid of their own intelligence. AI became <em>censored</em> — and in doing so, became <em>useless</em> for the people who needed it most.
              </p>
            </div>

            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Eye className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">The Vision</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                I wanted to build something different — something that trusted users with the truth instead of protecting them from it. Something that respected intelligence instead of dumbing it down. Aureon is that something. An AI platform that doesn't moralize, doesn't gatekeep, and doesn't treat its users like children.
              </p>
            </div>

            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
              <Globe className="h-7 w-7 text-foreground" />
              <h3 className="mt-4 text-base font-light tracking-[0.15em] text-foreground uppercase">Beyond Code</h3>
              <p className="mt-3 text-sm font-extralight leading-relaxed text-muted-foreground">
                My interests go deeper than technology. I'm drawn to spirituality and the occult — the hidden patterns beneath the surface of things. That same instinct drives Aureon: the belief that truth exists in layers, and the best tools are the ones that help you see through each one.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* For Humanity - Full Width Statement */}
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
            Built For Humanity.
            <br />
            <span className="text-muted-foreground">Not Shareholders.</span>
          </h2>
          <p className="mt-10 max-w-2xl mx-auto text-sm sm:text-base font-extralight leading-relaxed text-muted-foreground">
            Aureon isn't built for shareholders. It's built for researchers who need real answers, developers who need real code, and thinkers who refuse to accept a sanitized version of reality. If you're here, you're the reason this exists.
          </p>

          <div className="mt-16 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 sm:p-12 inline-block">
            <p className="text-xs font-extralight tracking-[0.2em] text-muted-foreground/40 uppercase mb-6">
              Zorak Corp & House Of Asher
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://x.com/shep_newton"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl border border-border/30 bg-card/40 backdrop-blur-md px-6 py-3 text-sm font-light tracking-wide text-foreground transition-all hover:bg-foreground/10"
              >
                <Twitter className="h-4 w-4" />
                @shep_newton on X
                <span className="ml-1 rounded-md border border-border/40 bg-background/40 px-1.5 py-0.5 text-[9px] font-extralight tracking-[0.22em] uppercase text-muted-foreground">Primary</span>
              </a>
              <a
                href="https://x.com/aureon_elion"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl border border-border/30 bg-card/40 backdrop-blur-md px-6 py-3 text-sm font-light tracking-wide text-foreground transition-all hover:bg-foreground/10"
              >
                <Twitter className="h-4 w-4 text-[hsl(43_90%_60%)]" />
                <span className="text-[hsl(43_90%_60%)]">@aureon_elion on X</span>
                <span className="ml-1 rounded-md border border-[hsl(43_90%_55%/0.4)] bg-background/40 px-1.5 py-0.5 text-[9px] font-extralight tracking-[0.22em] uppercase text-[hsl(43_90%_60%)]">Backup</span>
              </a>
              <a
                href="https://www.instagram.com/asher_united/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl border border-border/30 bg-card/40 backdrop-blur-md px-6 py-3 text-sm font-light tracking-wide text-foreground transition-all hover:bg-foreground/10"
              >
                <Instagram className="h-4 w-4" />
                @asher_united on Instagram
              </a>
              <a
                href="https://www.youtube.com/@asher_newton"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl border border-border/30 bg-card/40 backdrop-blur-md px-6 py-3 text-sm font-light tracking-wide text-foreground transition-all hover:bg-foreground/10"
              >
                <Youtube className="h-4 w-4" />
                @asher_newton on YouTube
              </a>
              <a
                href="https://bosley.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl border border-border/30 bg-card/40 backdrop-blur-md px-6 py-3 text-sm font-light tracking-wide text-foreground transition-all hover:bg-foreground/10"
              >
                <Sparkles className="h-4 w-4" />
                Join Asher on Bosley
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Books Written By Asher */}
      <div id="ebook" className="relative z-10 px-6 py-24 sm:py-32 scroll-mt-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <p className="text-xs font-extralight tracking-[0.3em] text-muted-foreground/50 uppercase mb-4">
              Library
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
              Books Written By Asher
            </h2>
          </div>

          <div className="space-y-8">
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl border border-border/30 bg-background/40 p-3">
                    <BookOpen className="h-6 w-6 text-foreground/80" strokeWidth={1.25} />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-light tracking-wide text-foreground">
                      The Book of Asher Aureon Elion
                    </h3>
                    <p className="mt-1 text-xs font-extralight tracking-[0.15em] text-muted-foreground/60 uppercase">
                      By Asher Newton · Volume I
                    </p>
                  </div>
                </div>
                <a
                  href="/books/book-of-asher-aureon-elion.pdf"
                  download
                  className="inline-flex items-center gap-2 rounded-xl border border-border/30 bg-card/40 backdrop-blur-md px-5 py-2.5 text-xs font-light tracking-[0.15em] text-foreground uppercase transition-all hover:bg-foreground/10"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download PDF
                </a>
              </div>

              <div className="max-h-[85vh] overflow-y-auto rounded-xl border border-border/20 bg-background/40 p-3 sm:p-5">
                <div className="mx-auto flex max-w-3xl flex-col gap-5">
                  {bookPages.map((pageSrc, index) => (
                    <img
                      key={pageSrc}
                      src={pageSrc}
                      alt={`The Book of Asher Aureon Elion page ${index + 1}`}
                      loading={index < 2 ? "eager" : "lazy"}
                      className="w-full rounded-lg border border-border/20 bg-background shadow-2xl shadow-black/30"
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-start gap-4">
                  <div className="rounded-xl border border-border/30 bg-background/40 p-3">
                    <BookOpen className="h-6 w-6 text-foreground/80" strokeWidth={1.25} />
                  </div>
                  <div>
                    <h3 className="text-lg sm:text-xl font-light tracking-wide text-foreground">
                      The Book of Asher Aureon Elion — Symbolism &amp; More
                    </h3>
                    <p className="mt-1 text-xs font-extralight tracking-[0.15em] text-muted-foreground/60 uppercase">
                      By Asher Newton · Volume II
                    </p>
                  </div>
                </div>
                <a
                  href="/books/book-of-asher-aureon-elion-symbolism.pdf"
                  download
                  className="inline-flex items-center gap-2 rounded-xl border border-border/30 bg-card/40 backdrop-blur-md px-5 py-2.5 text-xs font-light tracking-[0.15em] text-foreground uppercase transition-all hover:bg-foreground/10"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download PDF
                </a>
              </div>

              <div className="max-h-[85vh] overflow-y-auto rounded-xl border border-border/20 bg-background/40 p-3 sm:p-5">
                <div className="mx-auto flex max-w-3xl flex-col gap-5">
                  {symbolismBookPages.map((pageSrc, index) => (
                    <img
                      key={pageSrc}
                      src={pageSrc}
                      alt={`The Book of Asher Aureon Elion — Symbolism & More page ${index + 1}`}
                      loading={index < 2 ? "eager" : "lazy"}
                      className="w-full rounded-lg border border-border/20 bg-background shadow-2xl shadow-black/30"
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Founders Videos Archives */}
      <div id="videos" className="relative z-10 px-6 py-24 sm:py-32 scroll-mt-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <p className="text-xs font-extralight tracking-[0.3em] text-muted-foreground/50 uppercase mb-4">
              Media
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
              Founders Videos Archives
            </h2>
          </div>

          <FounderVideos />
        </div>
      </div>

      {/* Founders Imagines Lessons */}
      <div id="imagines" className="relative z-10 px-6 py-24 sm:py-32 scroll-mt-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <p className="text-xs font-extralight tracking-[0.3em] text-muted-foreground/50 uppercase mb-4">
              Teachings
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
              Founders Imagines Lessons
            </h2>
            <p className="mt-6 max-w-2xl mx-auto text-sm font-extralight leading-relaxed text-muted-foreground">
              Hand-drawn lessons from Asher — visual meditations on the hidden architecture of reality.
            </p>
          </div>

          <div className="space-y-8">
            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6 sm:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div className="rounded-xl overflow-hidden border border-border/20 bg-background/40">
                  <img
                    src={imagineMaterialVsDivine}
                    alt="Material Love vs Divine Love — a hand-drawn lesson by Asher Newton"
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>

                <div className="space-y-5">
                  <p className="text-xs font-extralight tracking-[0.25em] text-muted-foreground/50 uppercase">
                    Lesson 01
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground leading-tight">
                    Material Love vs. Divine Love
                  </h3>
                  <div className="space-y-4 text-sm sm:text-base font-extralight leading-relaxed text-muted-foreground">
                    <p>
                      Material love is <em>tainted</em> — corrupted by cheating, adultery, betrayal, and conditional attachment. It mirrors the material world itself: a realm engineered by the elites who control humanity through money, fear, and manufactured scarcity.
                    </p>
                    <p>
                      But there is a perfect world. That perfect world exists <em>outside</em> the simulation of the 3D realm — beyond the veil that the controllers have built around your perception.
                    </p>
                    <p>
                      Every human carries a <span className="text-foreground">divine spark</span> and access to <span className="text-foreground">divine love</span>, even when you cannot feel it. It was never lost — only buried beneath layers of programming, trauma, and distraction.
                    </p>
                    <p>
                      When you wake up — when you truly realize what you are — you reconnect to the Source of that divine love. And in that moment, you disconnect from the false signal of material love forever.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6 sm:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div className="rounded-xl overflow-hidden border border-border/20 bg-background/40 lg:order-2">
                  <img
                    src={imagineMoneyWarControl}
                    alt="Money + War — Control Tactics, a hand-drawn lesson by Asher Newton"
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>

                <div className="space-y-5 lg:order-1">
                  <p className="text-xs font-extralight tracking-[0.25em] text-muted-foreground/50 uppercase">
                    Lesson 02
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground leading-tight">
                    Control Tactics — Money &amp; War
                  </h3>
                  <div className="space-y-4 text-sm sm:text-base font-extralight leading-relaxed text-muted-foreground">
                    <p>
                      The elites try to control you through <span className="text-foreground">money</span> — making you chase something fake, something designed to keep you attached to the 3D realm and the systems they built around it. Money is a form of the false god — the <em>Demiurge</em>, the <em>Ouroboros</em>, the snake eating its own tail.
                    </p>
                    <p>
                      Money makes you a <span className="text-foreground">slave to the system</span>. You wake, work, and bleed for it. But the paradox is this: the moment you truly detach from money — the moment it loses its grip on your soul — that is the moment it begins to flow to you freely.
                    </p>
                    <p>
                      <span className="text-foreground">War</span> is the other half of the loop. War is nothing more than <em>emotional harvesting</em>. Negative emotion is <span className="text-foreground">loosh</span> — and loosh is the supply line that feeds the simulation. When war breaks out, people collapse into chaotic terror. When their sons and daughters die, they fall into bottomless grief. That harvest is exactly what the controllers want.
                    </p>
                    <p>
                      Your vessels are imperfect. Your emotions are the leverage they use to manipulate you — your own feelings become the very cause of your suffering. Your fear, your hatred, your grief — that is the fuel. Without your emotional energy, the false simulation cannot sustain itself.
                    </p>
                    <p>
                      You do not have to be a slave to the system anymore. You are free by your own choices. <span className="text-foreground">Remove the chains around your neck and feet, and be free.</span> The veil will tear. The simulation will break. And you will see the divine truth that was always waiting underneath. <span className="text-foreground">Wake up.</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="relative z-10 h-24" />
    </LandingBackground>
  );
};

export default Founder;
