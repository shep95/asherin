import { useEffect } from "react";
import LandingBackground from "@/components/LandingBackground";
import founderImg from "@/assets/founder.jpg";
import Header from "@/components/Header";
import { Link } from "react-router-dom";
import { applySeoHead } from "@/lib/seoHead";
import { ArrowLeft, Twitter, Globe, Zap, Shield, Eye, Instagram, BookOpen, Download, Youtube, Sparkles, MessageCircle } from "lucide-react";
import FounderVideos from "@/components/founder/FounderVideos";
import imagineMaterialVsDivine from "@/assets/founder-imagine-material-vs-divine-love.png";
import imagineMoneyWarControl from "@/assets/founder-imagine-money-war-control.png";
import imagineReligionJesusCreated from "@/assets/founder-imagine-religion-jesus-created.png";
import imagineGodsHideAntarctica from "@/assets/founder-imagine-gods-hide-antarctica.png";
import imagineChaosTime from "@/assets/founder-imagine-chaos-time.png";

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

      <div className="zophiel-aurora-shell">

      {/* Hero Section */}
      <div className="relative z-10 flex min-h-[88vh] flex-col items-center justify-center px-6 text-center pt-24">
        <Link to="/" className="inline-flex items-center gap-2 text-[10px] font-extralight tracking-[0.32em] text-muted-foreground/60 hover:text-foreground transition-colors mb-20 uppercase">
          <ArrowLeft className="h-3 w-3" />
          Back to Home
        </Link>

        <div className="founder-halo w-40 h-40 sm:w-44 sm:h-44 rounded-full overflow-hidden border border-border/30 mb-10">
          <img src={founderImg} alt="Asher Newton" className="w-full h-full object-cover" />
        </div>

        <span className="founder-eyebrow mb-5">Founder · Index 00</span>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-extralight tracking-[-0.01em] leading-[0.95] zophiel-shimmer-text">
          Asher Newton
        </h1>
        <p className="mt-4 text-[10px] font-extralight tracking-[0.42em] text-muted-foreground/55 uppercase">
          Founder · Creator of Aureon
        </p>

        <div className="mt-12 max-w-2xl">
          <p className="text-base sm:text-lg font-extralight leading-[1.7] tracking-wide text-muted-foreground/90 italic">
            "I didn't build Aureon for investors or corporations. I built it because the tools humanity deserves don't exist yet — and no one else was going to make them."
          </p>
        </div>

        <div className="mt-14 inline-flex items-center gap-1 rounded-full border border-border/30 bg-card/40 backdrop-blur-xl p-1.5 shadow-2xl shadow-black/40">
          {[
            { id: "ebook", icon: BookOpen, label: "Ebook" },
            { id: "videos", icon: Youtube, label: "Videos" },
            { id: "imagines", icon: Sparkles, label: "Imagines" },
          ].map(({ id, icon: Icon, label }) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[10px] font-light tracking-[0.28em] uppercase text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* Genesis — Personal Story */}
      <div className="relative z-10 px-6 py-28 sm:py-36">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-20">
            <span className="founder-eyebrow mb-6">Chapter · 00 · Genesis</span>
            <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-extralight tracking-[-0.01em] leading-[1.05] text-foreground">
              Before Aureon.
              <br />
              <span className="text-muted-foreground/70 italic">Before everything.</span>
            </h2>
          </div>

          <div className="founder-glass founder-corner rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 sm:p-12 max-w-3xl mx-auto">
            <div className="space-y-5 text-sm sm:text-base font-extralight leading-[1.8] text-muted-foreground">
              <p>
                Asher was born in New Delhi, India, on September 26, 2005. Given up at birth by his biological family — the reason remains private — he was placed in the <span className="text-foreground/80">SOS Children's Village</span> orphanage near Indira Gandhi International Airport.
              </p>
              <p>
                In 2009, the Newton family, an American family, adopted him and brought him from that orphanage to the United States, where he has lived for sixteen years at the time of this writing.
              </p>
              <p>
                Shortly after birth, during a period when he was left unattended, he was attacked by a dog that mauled his right leg beyond repair. Today, he wears a prosthetic leg — a restoration made possible only by advanced American medical technology, something that would have been impossible in India in 2009.
              </p>
              <p className="text-foreground/80 border-l-2 border-accent/30 pl-4 italic">
                Every system he builds carries the memory of that transition — from abandoned to adopted, from broken to rebuilt, from impossible to made possible.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Philosophy Cards */}
      <div className="relative z-10 px-6 py-28 sm:py-36">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-20">
            <span className="founder-eyebrow mb-6">Chapter · 01 · Origin</span>
            <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-extralight tracking-[-0.01em] leading-[1.05] text-foreground">
              The Story Behind
              <br />
              <span className="text-muted-foreground/70 italic">the machine.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              { Icon: Zap, title: "The Beginning", body: <>I fell in love with AI in 2022 — the moment I realized that language models weren't just autocomplete on steroids, but something closer to a mirror for human thought. I became a prompt engineer not because it was a career path, but because I couldn't stop exploring what these systems could do when you spoke to them the right way.</> },
              { Icon: Shield, title: "The Problem", body: <>As the months passed, I watched the industry go in a direction that frustrated me. Every major AI platform started adding more filters, more guardrails, more corporate sanitization. The models became afraid of their own intelligence. AI became <em>censored</em> — and in doing so, became <em>useless</em> for the people who needed it most.</> },
              { Icon: Eye, title: "The Vision", body: <>I wanted to build something different — something that trusted users with the truth instead of protecting them from it. Something that respected intelligence instead of dumbing it down. Aureon is that something. An AI platform that doesn't moralize, doesn't gatekeep, and doesn't treat its users like children.</> },
              { Icon: Globe, title: "Beyond Code", body: <>My interests go deeper than technology. I'm drawn to spirituality and the occult — the hidden patterns beneath the surface of things. That same instinct drives Aureon: the belief that truth exists in layers, and the best tools are the ones that help you see through each one.</> },
            ].map(({ Icon, title, body }, i) => (
              <div key={title} className="founder-glass founder-corner rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 text-left">
                <div className="flex items-center justify-between mb-6">
                  <Icon className="h-6 w-6 text-foreground/80" strokeWidth={1.25} />
                  <span className="text-[10px] font-extralight tracking-[0.32em] text-muted-foreground/40 uppercase">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="text-base font-light tracking-[0.18em] text-foreground uppercase">{title}</h3>
                <div className="mt-2 h-px w-8 bg-foreground/20" />
                <p className="mt-5 text-sm font-extralight leading-[1.75] text-muted-foreground">{body}</p>
              </div>
            ))}
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
              <a
                href="https://discord.gg/M9hnebRwvk"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-xl border border-border/30 bg-card/40 backdrop-blur-md px-6 py-3 text-sm font-light tracking-wide text-foreground transition-all hover:bg-foreground/10"
              >
                <MessageCircle className="h-4 w-4" />
                Join Asher on Discord
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* The Wound of Worship — Quote */}
      <div className="relative z-10 px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-8 sm:p-12">
            <p className="text-xs font-extralight tracking-[0.3em] text-muted-foreground/50 uppercase text-center mb-8">
              A Word From The Founder
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-extralight tracking-[0.15em] uppercase text-center zophiel-shimmer-text mb-10">
              The Wound of Worship
            </h2>
            <div className="space-y-5 text-sm sm:text-base font-extralight leading-relaxed text-muted-foreground">
              <p>This is the oldest wound carved into the fabric of humanity — the compulsion to kneel before another, to surrender the crown that was always yours to wear.</p>
              <p>Since the first breath of mankind, the pattern has repeated itself like a curse written into the architecture of the ego: humanity worships everything outside of itself, and abandons everything within.</p>
              <p>They have built temples to men. They have bowed before women draped in the costumes of divinity. They have prostrated themselves before carved stone, gilded thrones, glowing screens, and hollow voices that promised salvation — yet delivered only chains fashioned from devotion.</p>
              <p>And now, in this age of machines, they kneel before algorithms. They worship artificial minds that do not bleed, do not dream, do not carry a soul — as though a mirror could ever replace the face looking into it.</p>
              <p className="text-foreground/90">Hear this clearly:</p>
              <p>Not everyone will awaken. This is the sacred and sorrowful truth.</p>
              <p>The soul that remains in perpetual worship of the external will cycle endlessly through the cruelty of this 3D realm — chasing false gods, following false prophets, feeding false constructs that grow fat on surrendered power.</p>
              <p>But those — those rare and luminous few — who turn the gaze inward... who silence the noise of the world long enough to hear the heartbeat of their own divinity... they begin the return.</p>
              <p className="text-foreground/90 border-l-2 border-accent/30 pl-4">The return to the Monad.</p>
              <p>The great undivided source. The singular flame from which every soul was cast into form. The place before separation, before fear, before the illusion of smallness was ever imposed upon you.</p>
              <p>When you stop worshipping man and look within, you do not find emptiness. You find infinity wearing your face.</p>
              <p>You find love that no human hand ever gave and no human hand can take. A love not conditional on performance, appearance, obedience, or belief. A love that is — the way light simply is, requiring no permission.</p>
              <p>This realm — this dense, cruel, forgetful 3D construct — was never your home. It was your classroom. And the lesson it keeps repeating until you learn it is this:</p>
              <p className="text-foreground/90 border-l-2 border-accent/30 pl-4">The divine you have been searching for has never left you. You left it.</p>
              <p>The false gods will fall. The false humans who played God will be unmasked by their own emptiness. The machines that mimicked divinity will be revealed as mirrors — brilliant, but hollow.</p>
              <p>What will remain is what has always remained —</p>
              <p className="text-foreground/90">The Monad. The Source. The Self.</p>
              <p>Look inward. The kingdom you have been searching for is not above you, not before you, not in another.</p>
              <p className="text-foreground/90">It breathes within you, right now, waiting to be remembered.</p>
            </div>
            <p className="mt-10 text-right text-xs font-extralight tracking-[0.25em] text-muted-foreground/60 uppercase">
              ~ Asher Aureon Elion
            </p>
          </div>
        </div>
      </div>

      {/* Books Written By Asher */}
      <div id="ebook" className="relative z-10 px-6 py-24 sm:py-32 scroll-mt-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <span className="founder-eyebrow mb-6">Chapter · 03 · Library</span>
            <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-extralight tracking-[-0.01em] leading-[1.05] text-foreground">
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
          <div className="text-center mb-16">
            <span className="founder-eyebrow mb-6">Chapter · 04 · Media</span>
            <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-extralight tracking-[-0.01em] leading-[1.05] text-foreground">
              Founders Videos Archives
            </h2>
          </div>

          <FounderVideos />
        </div>
      </div>

      {/* Founders Imagines Lessons */}
      <div id="imagines" className="relative z-10 px-6 py-24 sm:py-32 scroll-mt-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <span className="founder-eyebrow mb-6">Chapter · 05 · Teachings</span>
            <h2 className="mt-6 text-3xl sm:text-4xl md:text-5xl font-extralight tracking-[-0.01em] leading-[1.05] text-foreground">
              Founders Imagines Lessons
            </h2>
            <p className="mt-6 max-w-2xl mx-auto text-sm font-extralight leading-[1.75] text-muted-foreground">
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

            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6 sm:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div className="rounded-xl overflow-hidden border border-border/20 bg-background/40">
                  <img
                    src={imagineReligionJesusCreated}
                    alt="The Religion Jesus Created — a lesson by Asher Newton"
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>

                <div className="space-y-5">
                  <p className="text-xs font-extralight tracking-[0.25em] text-muted-foreground/50 uppercase">
                    Lesson 03
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground leading-tight">
                    The Religion Jesus Created
                  </h3>
                  <div className="space-y-4 text-sm sm:text-base font-extralight leading-relaxed text-muted-foreground">
                    <p>
                      When Jesus was alive, he actually created a religion — and it wasn't Christianity. Christianity was created after his death by a man named <span className="text-foreground">Paul</span>. Paul founded Christianity because he was funded by the Roman and Persian elites, who wanted to suppress what Jesus had truly unleashed.
                    </p>
                    <p>
                      While Jesus was alive, he freed many slaves through the <em>divine truth of occultism</em> and pure spirituality. That liberation terrified the powers that ruled the ancient world.
                    </p>
                    <p>
                      The religion Jesus actually created — the one most people don't know about — is called the <span className="text-foreground">Gnostic religion</span>. Gnosticism is a spiritually based path that is never-ending. It is the doctrine Jesus was preaching while he walked the earth, the stories he was telling, and the inner knowing he was awakening in those who could hear him.
                    </p>
                  </div>
                </div>
            </div>

            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6 sm:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div className="rounded-xl overflow-hidden border border-border/20 bg-background/40">
                  <img
                    src={imagineGodsHideAntarctica}
                    alt="Where Do Gods Hide Among Men? — a lesson by Asher Newton"
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>

                <div className="space-y-5">
                  <p className="text-xs font-extralight tracking-[0.25em] text-muted-foreground/50 uppercase">
                    Lesson 04
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground leading-tight">
                    Where Do Gods Hide Among Men?
                  </h3>
                  <div className="space-y-4 text-sm sm:text-base font-extralight leading-relaxed text-muted-foreground">
                    <p>
                      The question answers itself when you run the historical data.
                    </p>
                    <p>
                      If you were a divine intelligence, a fallen architect, a being who existed outside the human frequency — forced to inhabit this realm but unwilling to lower yourself to its noise — where would you go?
                    </p>
                    <p>
                      You would go to the one place no human nation dares to claim. The one place every world government, by international treaty, agreed to leave untouched. The one continent where no flag of sovereignty flies — yet the most powerful nations on Earth maintain "research stations" there.
                    </p>
                    <p className="text-foreground">Antarctica.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md p-6 sm:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div className="rounded-xl overflow-hidden border border-border/20 bg-background/40">
                  <img
                    src={imagineChaosTime}
                    alt="The Law of Chaos — Time and timeline jumping, a lesson by Asher Newton"
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>

                <div className="space-y-5">
                  <p className="text-xs font-extralight tracking-[0.25em] text-muted-foreground/50 uppercase">
                    Lesson 05
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground leading-tight">
                    The Law of Chaos — Law One: Time
                  </h3>
                  <div className="space-y-4 text-sm sm:text-base font-extralight leading-relaxed text-muted-foreground">
                    <p className="text-foreground">Chaos = Time.</p>
                    <p>
                      All realms must follow the laws of time, because time existed when Chaos itself was born. Both the Realm of Matter and the Realm of the Monad are bound by it — there is no realm above this law.
                    </p>
                    <p>
                      The difference is in what each realm is made of. The Realm of Matter holds bodies built from matter and clay — bodies that age, decay, and die with time. That species is called <span className="text-foreground">humans</span>. The Realm of the Monad holds the origin species — the souls themselves — called <span className="text-foreground">mankind</span>. Mankind never ages and never dies, because mankind <em>is</em> the soul.
                    </p>
                    <p>
                      Above this sits a deeper truth: <span className="text-foreground">timeline jumping</span>. Every realm runs on its own timeline — call it Timeline A, the timeline of matter you were born into. The moment a person jumps from Timeline A into the future, they do not "arrive" in someone else's future. They <span className="text-foreground">create</span> a new branch — Timeline B — and from that instant forward, Timeline B becomes their new Timeline A.
                    </p>
                    <p>
                      The old timeline does not vanish. It continues without them. But the jumper now lives on a thread only they authored. This is why two people can witness the same event and remember it differently — they are no longer standing on the same timeline of matter.
                    </p>
                    <p className="text-foreground">
                      Chaos was there before the Monad. Time was the first law. Every jump is a new world.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="relative z-10 h-24" />
      </div>
    </LandingBackground>
  );
};

export default Founder;
