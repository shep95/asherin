import { useEffect } from "react";
import LandingBackground from "@/components/LandingBackground";
import founderImg from "@/assets/founder.jpg";
import Header from "@/components/Header";
import { Link } from "react-router-dom";
import { ArrowLeft, Twitter, Globe, Zap, Shield, Eye, Instagram, BookOpen, Download, Youtube } from "lucide-react";

const bookPages = Array.from(
  { length: 116 },
  (_, index) => `/books/asher-aureon-elion-pages/page-${String(index + 1).padStart(3, "0")}.jpg`
);

const Founder = () => {
  useEffect(() => {
    document.title = "Asher Newton — Founder of Aureon";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Meet Asher Newton, the founder of Aureon — the uncensored AI intelligence platform built for researchers, developers, and truth-seekers.");
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
            </div>
          </div>
        </div>
      </div>

      {/* Books Written By Asher */}
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <p className="text-xs font-extralight tracking-[0.3em] text-muted-foreground/50 uppercase mb-4">
              Library
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
              Books Written By Asher
            </h2>
          </div>

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
                    By Asher Newton
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
        </div>
      </div>

      {/* Founders Videos Archives */}
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <p className="text-xs font-extralight tracking-[0.3em] text-muted-foreground/50 uppercase mb-4">
              Media
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extralight tracking-wide leading-tight text-foreground">
              Founders Videos Archives
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              "g7FmttXtyEw",
              "Bng9dGp3444",
              "pTA9aOdd6iw",
              "HcvAEtC4wRw",
              "xM3zKp_oYwo",
              "RxvLmhZJ8kU",
              "DFSLspaEMn0",
              "FcKzSP7_g1w",
              "hBhldKwbH6Q",
              "UispvssxFdo",
              "w_K7UrDEp98",
              "q98IqcFco9A",
              "Ak6PVkHM2cE",
              "OEksMhZ8R-Q",
              "ZecS7rqIkDc",
            ].map((id) => (
              <div
                key={id}
                className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden shadow-2xl shadow-black/30"
              >
                <div className="aspect-video">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`}
                    title="Founder Video"
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="relative z-10 h-24" />
    </LandingBackground>
  );
};

export default Founder;
