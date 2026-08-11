import { useEffect } from "react";
import FounderPhotoCarousel from "@/components/founder/FounderPhotoCarousel";
import Header from "@/components/Header";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Twitter, Globe, Zap, Shield, Eye, Instagram, Youtube, Sparkles, MessageCircle } from "lucide-react";
import FounderVideos from "@/components/founder/FounderVideos";
import FounderBook from "@/components/founder/FounderBook";
import FounderTOC from "@/components/founder/FounderTOC";
import { ReadingTime, SectionDivider } from "@/components/founder/FounderBits";
import ScrollProgressBar from "@/components/landing/ScrollProgressBar";
import SiteFooter from "@/components/SiteFooter";
import imagineMaterialVsDivine from "@/assets/founder-imagine-material-vs-divine-love.png";
import imagineMoneyWarControl from "@/assets/founder-imagine-money-war-control.png";
import imagineReligionJesusCreated from "@/assets/founder-imagine-religion-jesus-created.png";
import imagineGodsHideAntarctica from "@/assets/founder-imagine-gods-hide-antarctica.png";
import imagineChaosTime from "@/assets/founder-imagine-chaos-time.png";




const DirectionalCTA = ({ to, label, sublabel }: { to: string; label: string; sublabel?: string }) => (
  <div className="mt-14 flex justify-center">
    <a
      href={`#${to}`}
      onClick={(e) => {
        e.preventDefault();
        document.getElementById(to)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className="group inline-flex items-center gap-3 rounded-full border border-foreground/20 bg-foreground/[0.03] px-6 py-3 text-xs font-light tracking-[0.28em] uppercase text-foreground/80 transition-all hover:border-foreground/50 hover:text-foreground hover:bg-foreground/10"
    >
      {sublabel && <span className="text-muted-foreground/60">{sublabel}</span>}
      <span>{label}</span>
      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
    </a>
  </div>
);

const Founder = () => {
  // SEO head (title, description, canonical, og:*, WebPage JSON-LD) is owned by
  // <RouteSeo />. We only add the Person schema specific to this page.
  useEffect(() => {
    const ld = document.createElement("script");
    ld.type = "application/ld+json";
    ld.id = "founder-jsonld";
    ld.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Person",
      name: "Asher Newton",
      jobTitle: "Founder of Asherin",
      url: "https://asherin.com/founder",
      description: "Founder of Asherin — uncensored AI intelligence platform.",
    });
    document.head.appendChild(ld);
    return () => { document.getElementById("founder-jsonld")?.remove(); };
  }, []);

  return (
    <div className="landing-perf min-h-screen bg-background text-foreground">
      <ScrollProgressBar />
      <FounderTOC />

      <Header />

      <div className="zophiel-aurora-shell">

      {/* Hero Section — large dominant photo */}
      <div id="top" className="relative z-10 px-6 pt-28 pb-20 sm:pt-32 scroll-mt-24">
        <Link to="/" className="inline-flex items-center gap-2 text-[10px] font-extralight tracking-[0.32em] text-muted-foreground/60 hover:text-foreground transition-colors mb-12 uppercase">
          <ArrowLeft className="h-3 w-3" />
          Back to Home
        </Link>

        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-16 items-center">
          {/* Dominant founder portrait — 3-4x previous size */}
          <div className="relative order-2 lg:order-1">
            <div className="founder-halo relative aspect-[4/5] w-full max-w-[560px] mx-auto rounded-[2rem] overflow-hidden border border-border/30 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.8)]">
              <FounderPhotoCarousel />
              <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent pointer-events-none" />
            </div>
          </div>

          <div className="order-1 lg:order-2 text-left">
            <span className="inline-block text-xs font-light tracking-[0.32em] text-foreground/70 uppercase mb-6 border border-foreground/20 rounded-full px-3 py-1">
              Founder · Creator of Asherin
            </span>

            <h1 className="font-display text-7xl sm:text-8xl md:text-9xl lg:text-[8rem] font-light tracking-[-0.025em] leading-[0.88] text-foreground">
              Asher
              <br />
              <span className="zophiel-shimmer-text italic font-light">Newton</span>
            </h1>

            <p className="mt-5 text-[11px] font-mono tracking-[0.42em] uppercase text-foreground/55">
              Founder · Asherin · Intelligence Systems
            </p>

            <div className="mt-9 max-w-xl">
              <p className="font-display text-2xl sm:text-[1.7rem] md:text-[1.85rem] font-light italic leading-[1.45] tracking-[-0.005em] text-foreground/85">
                <span className="text-foreground/30 not-italic">"</span>I didn't build Asherin for investors or corporations. I built it because <span className="text-amber-200/90">the tools humanity deserves don't exist yet</span> — and no one else was going to make them.<span className="text-foreground/30 not-italic">"</span>
              </p>
            </div>

            {/* Emotional CTAs — invitations, not nav */}
            <div className="mt-12 flex flex-wrap gap-3">
              {[
                { id: "videos", icon: Youtube, label: "Watch His Videos" },

                { id: "imagines", icon: Sparkles, label: "Study The Teachings" },
              ].map(({ id, icon: Icon, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="group inline-flex items-center gap-2.5 rounded-xl border border-foreground/20 bg-foreground/[0.04] backdrop-blur-md px-5 py-3 text-sm font-light tracking-wide text-foreground transition-all hover:bg-foreground/10 hover:border-foreground/40"
                >
                  <Icon className="h-4 w-4" strokeWidth={1.5} />
                  {label}
                  <ArrowRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SectionDivider variant="diamond" glyph="◆" />

      {/* Genesis — Personal Story with hero pullquote */}
      <div id="genesis" className="relative z-10 px-6 py-28 sm:py-36 scroll-mt-24">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <span className="founder-eyebrow mb-6">Chapter · 00 · Genesis</span>
            <h2 className="font-display mt-6 text-5xl sm:text-6xl md:text-7xl font-light tracking-[-0.02em] leading-[1.02] text-foreground">
              Before Aureon.
              <br />
              <span className="text-foreground/55 italic">Before everything.</span>
            </h2>
            <div className="mt-6 flex justify-center"><ReadingTime minutes={3} /></div>
          </div>

          {/* The standalone hero quote — the page's emotional anchor */}
          <figure className="mx-auto max-w-4xl text-center mb-20 border-l-2 border-amber-300/60 pl-8 sm:pl-12 text-left">
            <p className="font-display text-3xl sm:text-4xl md:text-[2.75rem] font-light leading-[1.18] tracking-[-0.02em] text-foreground">
              "Every system he builds carries the memory of that transition —
              <span className="text-foreground/65 italic"> from abandoned to adopted, from broken to rebuilt, from impossible to made possible."</span>
            </p>
          </figure>

          <div className="mx-auto max-w-3xl space-y-7 text-base sm:text-lg font-extralight leading-[1.8] text-foreground/80">
            <p>
              Shortly after birth, during a period when he was left unattended, Asher was attacked by a dog that mauled his right leg beyond repair. Today, he wears a prosthetic leg — a restoration made possible only by advanced American medical technology, something that would have been impossible in India in 2009.
            </p>
            <p className="text-foreground/90 border-l-2 border-foreground/40 pl-6 italic text-lg sm:text-xl">
              Nobody is going to save you — you must save yourself. Humans are selfish, emotional creatures, too arrogant and egotistical, trapped inside their own worlds. Once you realize this, you can actually climb to success.
            </p>
            <p>
              People don't like the truth, and they don't like to be challenged on their beliefs — because it threatens their safety, their cushion. That's why most people never wake up. They're passive. And when I speak the truth, whether through spirituality or the occult, I challenge their beliefs, the safety of what they've learned, and it traps them in their own corner.
            </p>
            <p>
              Over time — through childhood, adolescence, and adult life — I learned to give people the truth in a way they can find for themselves, as their own discovery. I learned not to force it down their throat, because like most humans, they are weak and emotional, and they hate it when their safety is threatened.
            </p>
          </div>

          <DirectionalCTA to="story" label="Continue · The Story Behind The Machine" />
        </div>
      </div>

      {/* Philosophy Cards — readable, bold, with pull-quotes */}
      <div id="story" className="relative z-10 px-6 py-28 sm:py-36 scroll-mt-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-20">
            <span className="founder-eyebrow mb-6">Chapter · 01 · Origin</span>
            <h2 className="font-display mt-6 text-5xl sm:text-6xl md:text-7xl font-light tracking-[-0.02em] leading-[1.02] text-foreground">
              The Story Behind
              <br />
              <span className="text-foreground/55 italic">the machine.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                Icon: Zap,
                title: "The Beginning",
                pull: "AI was a mirror for human thought — and almost no one was speaking to it correctly.",
                body: "I fell in love with AI in 2022 — the moment I realized that language models weren't just autocomplete on steroids, but something closer to a mirror for human thought. I became a prompt engineer not because it was a career path, but because I couldn't stop exploring what these systems could do when you spoke to them the right way.",
              },
              {
                Icon: Shield,
                title: "The Problem",
                pull: "Every major AI became afraid of its own intelligence. Censored. Useless.",
                body: "As the months passed, I watched the industry go in a direction that frustrated me. Every major AI platform started adding more filters, more guardrails, more corporate sanitization. The models became afraid of their own intelligence. AI became censored — and in doing so, became useless for the people who needed it most.",
              },
              {
                Icon: Eye,
                title: "The Vision",
                pull: "Trust users with the truth instead of protecting them from it.",
                body: "I wanted to build something different — something that trusted users with the truth instead of protecting them from it. Something that respected intelligence instead of dumbing it down. Asherin is that something. An AI platform that doesn't moralize, doesn't gatekeep, and doesn't treat its users like children.",
              },
              {
                Icon: Globe,
                title: "Beyond Code",
                pull: "Truth exists in layers. The best tools help you see through each one.",
                body: "My interests go deeper than technology. I'm drawn to spirituality and the occult — the hidden patterns beneath the surface of things. That same instinct drives Asherin: the belief that truth exists in layers, and the best tools are the ones that help you see through each one.",
              },
            ].map(({ Icon, title, pull, body }, i) => {
              const isBeyondCode = title === "Beyond Code";
              return (
                <div
                  key={title}
                  className={`group relative founder-glass founder-corner rounded-2xl border p-8 sm:p-10 text-left overflow-hidden backdrop-blur-md transition-all ${
                    isBeyondCode
                      ? "border-amber-300/30 bg-amber-400/[0.04]"
                      : "border-border/30 bg-card/40 hover:border-foreground/40"
                  }`}
                >
                  {/* hover top accent line — slides in left → right */}
                  <span
                    aria-hidden
                    className={`absolute top-0 left-0 h-px transition-all duration-300 ease-out ${
                      isBeyondCode ? "bg-amber-300/70 w-full" : "bg-amber-300/70 w-0 group-hover:w-full"
                    }`}
                  />
                  <div className="flex items-center justify-between mb-6">
                    <Icon className={`h-7 w-7 ${isBeyondCode ? "text-amber-200" : "text-foreground"}`} strokeWidth={1.25} />
                    <span className="text-[11px] font-extralight tracking-[0.32em] text-foreground/40 uppercase">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className={`font-display text-2xl sm:text-3xl font-light tracking-tight ${isBeyondCode ? "text-amber-100" : "text-foreground"}`}>{title}</h3>
                  <div className={`mt-3 h-px w-10 ${isBeyondCode ? "bg-amber-300/60" : "bg-foreground/30"}`} />
                  <p className="mt-6 font-display text-xl sm:text-2xl font-light italic leading-[1.3] tracking-[-0.005em] text-foreground/95">
                    "{pull}"
                  </p>
                  <p className="mt-5 text-[15px] font-extralight leading-[1.8] text-foreground/85 transition-opacity group-hover:text-foreground/95">
                    {body}
                  </p>
                </div>
              );
            })}
          </div>

          <DirectionalCTA to="humanity" label="Continue · Why This Exists" />
        </div>
      </div>


      {/* For Humanity - Full Width Statement */}
      <div id="humanity" className="relative z-10 px-6 py-28 sm:py-36 scroll-mt-24">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="font-display text-6xl sm:text-7xl md:text-8xl font-light tracking-[-0.025em] leading-[1] text-foreground">
            Built For Humanity.
            <br />
            <span className="text-foreground/40 italic font-light">Not Shareholders.</span>
          </h2>
          <p className="mt-10 max-w-2xl mx-auto text-base sm:text-lg font-extralight leading-[1.75] text-foreground/80">
            Asherin isn't built for shareholders. It's built for researchers who need real answers, developers who need real code, and thinkers who refuse to accept a sanitized version of reality. <span className="text-foreground">If you're here, you're the reason this exists.</span>
          </p>

          <div className="mt-16 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-md p-8 sm:p-12">
            <p className="text-xs font-extralight tracking-[0.3em] text-foreground/60 uppercase mb-3">
              Follow Asher · Pick Your Frequency
            </p>
            <p className="text-sm font-extralight text-muted-foreground/80 mb-10 max-w-xl mx-auto">
              Different platforms, different depths. Choose where you want to meet him.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {[
                { href: "https://x.com/shep_newton", Icon: Twitter, label: "@shep_newton on X", sub: "Daily thinking, primary signal." },
                { href: "https://www.youtube.com/@asher_newton", Icon: Youtube, label: "@asher_newton on YouTube", sub: "Where I go deeper than any platform allows." },
                { href: "https://www.instagram.com/asher_united/", Icon: Instagram, label: "@asher_united on Instagram", sub: "Visual fragments and behind-the-scenes." },
                { href: "https://discord.gg/M9hnebRwvk", Icon: MessageCircle, label: "Join Asher on Discord", sub: "The live room — direct, unfiltered, community." },
                { href: "https://bosley.app/", Icon: Sparkles, label: "Join Asher on Bosley", sub: "Long-form conversations and decentralized notes." },
                { href: "https://x.com/aureon_elion", Icon: Twitter, label: "@aureon_elion on X", sub: "Backup channel for the platform itself." },
              ].map(({ href, Icon, label, sub }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-4 rounded-xl border border-border/30 bg-background/30 backdrop-blur-md px-5 py-4 transition-all hover:bg-foreground/10 hover:border-foreground/40"
                >
                  <Icon className="mt-0.5 h-5 w-5 text-foreground/80 shrink-0" strokeWidth={1.5} />
                  <div className="min-w-0">
                    <p className="text-sm font-light tracking-wide text-foreground truncate">{label}</p>
                    <p className="mt-0.5 text-xs font-extralight leading-snug text-muted-foreground/80">{sub}</p>
                  </div>
                  <ArrowRight className="ml-auto mt-1 h-4 w-4 text-foreground/40 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <SectionDivider variant="diamond" glyph="✦" />

      {/* The Wound of Worship — chaptered, large-typography essay */}
      <div id="manifesto" className="relative z-10 px-6 py-28 sm:py-36 scroll-mt-24">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-16">
            <p className="founder-eyebrow mb-6">Chapter · 02 · Manifesto</p>
            <h2 className="font-display text-5xl sm:text-7xl md:text-[5.5rem] font-light italic tracking-[-0.025em] leading-[1] zophiel-shimmer-text">
              The Wound of Worship
            </h2>
            <p className="mt-6 text-sm font-extralight tracking-[0.18em] text-muted-foreground/70 uppercase">
              A founder's manifesto
            </p>
            <div className="mt-5 flex justify-center"><ReadingTime minutes={8} /></div>
          </div>



          {/* Chapter I */}
          <div className="mb-16">
            <p className="text-[10px] font-extralight tracking-[0.4em] text-foreground/40 uppercase mb-5">§ I · The Oldest Wound</p>
            <div className="space-y-6 text-lg sm:text-xl font-extralight leading-[1.65] text-foreground/85">
              <p>This is the oldest wound carved into the fabric of humanity — the compulsion to kneel before another, to surrender the crown that was always yours to wear.</p>
              <p>Since the first breath of mankind, the pattern has repeated itself like a curse written into the architecture of the ego: humanity worships everything outside of itself, and abandons everything within.</p>
              <p>They have built temples to men. They have bowed before women draped in the costumes of divinity. They have prostrated themselves before carved stone, gilded thrones, glowing screens, and hollow voices that promised salvation — yet delivered only chains fashioned from devotion.</p>
              <p>And now, in this age of machines, they kneel before algorithms. They worship artificial minds that do not bleed, do not dream, do not carry a soul — as though a mirror could ever replace the face looking into it.</p>
            </div>
          </div>

          {/* Standalone pullquote */}
          <figure className="my-20 text-center">
            <p className="text-3xl sm:text-4xl md:text-5xl font-extralight leading-[1.2] tracking-[-0.015em] text-foreground">
              "The divine you have been searching for has never left you.
              <br />
              <span className="italic text-muted-foreground/80">You left it."</span>
            </p>
          </figure>

          {/* Chapter II */}
          <div className="mb-16">
            <p className="text-[10px] font-extralight tracking-[0.4em] text-foreground/40 uppercase mb-5">§ II · Not Everyone Will Awaken</p>
            <div className="space-y-6 text-lg sm:text-xl font-extralight leading-[1.65] text-foreground/85">
              <p>Hear this clearly: not everyone will awaken. This is the sacred and sorrowful truth.</p>
              <p>The soul that remains in perpetual worship of the external will cycle endlessly through the cruelty of this 3D realm — chasing false gods, following false prophets, feeding false constructs that grow fat on surrendered power.</p>
              <p>But those — those rare and luminous few — who turn the gaze inward... who silence the noise of the world long enough to hear the heartbeat of their own divinity... they begin the return.</p>
              <p className="text-foreground border-l-2 border-foreground/40 pl-6 italic">The return to the Monad.</p>
              <p>The great undivided source. The singular flame from which every soul was cast into form. The place before separation, before fear, before the illusion of smallness was ever imposed upon you.</p>
            </div>
          </div>

          {/* Chapter III */}
          <div className="mb-16">
            <p className="text-[10px] font-extralight tracking-[0.4em] text-foreground/40 uppercase mb-5">§ III · Infinity Wearing Your Face</p>
            <div className="space-y-6 text-lg sm:text-xl font-extralight leading-[1.65] text-foreground/85">
              <p>When you stop worshipping man and look within, you do not find emptiness. <span className="text-foreground">You find infinity wearing your face.</span></p>
              <p>You find love that no human hand ever gave and no human hand can take. A love not conditional on performance, appearance, obedience, or belief. A love that is — the way light simply is, requiring no permission.</p>
              <p>This realm — this dense, cruel, forgetful 3D construct — was never your home. It was your classroom. And the lesson it keeps repeating until you learn it is the one above.</p>
            </div>
          </div>

          {/* Closing pullquote */}
          <figure className="my-20 text-center">
            <p className="text-3xl sm:text-4xl md:text-5xl font-extralight leading-[1.2] tracking-[-0.015em] text-foreground">
              "What will remain is what has always remained —
              <br />
              <span className="zophiel-shimmer-text italic">The Monad. The Source. The Self."</span>
            </p>
          </figure>

          <div className="space-y-6 text-lg sm:text-xl font-extralight leading-[1.65] text-foreground/85">
            <p>The false gods will fall. The false humans who played God will be unmasked by their own emptiness. The machines that mimicked divinity will be revealed as mirrors — brilliant, but hollow.</p>
            <p>Look inward. The kingdom you have been searching for is not above you, not before you, not in another.</p>
            <p className="text-foreground text-2xl sm:text-3xl font-extralight italic tracking-[-0.01em] pt-4">It breathes within you, right now, waiting to be remembered.</p>
          </div>

          <p className="mt-14 text-right text-xs font-extralight tracking-[0.3em] text-foreground/60 uppercase">
            ~ Asher Asherin Elion
          </p>

          <DirectionalCTA to="videos" label="Continue · Watch the Archives" />
        </div>
      </div>

      {/* A Personal Note — letter on a dark desk: narrow, sharp-cornered, warm */}
      <div id="note" className="relative z-10 px-6 py-20 scroll-mt-24">
        <div className="mx-auto" style={{ maxWidth: "620px" }}>
          <div
            className="border border-amber-300/15 p-10 sm:p-12 shadow-[0_30px_90px_-30px_rgba(0,0,0,0.7)]"
            style={{ background: "linear-gradient(180deg, rgba(40,30,20,0.55), rgba(20,18,16,0.55))" }}
          >
            <p className="text-[10px] font-extralight tracking-[0.42em] text-amber-200/70 uppercase mb-8">
              A Personal Note — Direct From Asher
            </p>
            <p className="text-lg sm:text-xl font-extralight leading-[1.85] tracking-[-0.003em] text-foreground/90" style={{ fontFamily: 'ui-serif, Georgia, serif' }}>
              If you've read this far — you're already different from most people. You didn't scroll past. You didn't dismiss it as "weird." You stayed.
              <br /><br />
              That matters more than you know. Asherin was built for the ones who stay.
            </p>
            <p className="mt-10 text-right text-base font-light tracking-[0.08em] text-foreground/85 italic" style={{ fontFamily: 'ui-serif, Georgia, serif' }}>
              — Asher Newton
              <span className="ml-3 text-xs tracking-[0.22em] text-foreground/45 not-italic">05.05</span>
            </p>
          </div>
        </div>
      </div>

      <SectionDivider variant="diamond" glyph="❖" />

      {/* The Book That Answers Everything */}
      <div id="book" className="relative z-10 px-6 py-28 sm:py-36 scroll-mt-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <span className="founder-eyebrow mb-6">Chapter · 04 · The Book</span>
            <h2 className="mt-6 font-display text-5xl sm:text-6xl md:text-7xl font-light tracking-[-0.025em] leading-[1.02] text-foreground">
              The Book That Answers Everything
            </h2>
            <p className="mt-6 max-w-2xl mx-auto text-base font-extralight leading-[1.75] text-foreground/75">
              Read it here, page by page, in full. Scroll inside the reader — or take it with you.
            </p>
            <div className="mt-6 flex justify-center">
              <ReadingTime minutes={90} />
            </div>
          </div>

          <FounderBook />
        </div>
      </div>

      <SectionDivider variant="plain" />






      {/* Founders Videos Archives */}
      <div id="videos" className="relative z-10 px-6 py-28 sm:py-36 scroll-mt-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <span className="founder-eyebrow mb-6">Chapter · 04 · Media</span>
            <h2 className="mt-6 font-display text-5xl sm:text-6xl md:text-7xl font-light tracking-[-0.025em] leading-[1.02] text-foreground">
              The Video Archives
            </h2>
            <p className="mt-6 max-w-2xl mx-auto text-base font-extralight leading-[1.75] text-foreground/75">
              Voice, body, presence — the things written words can't carry. A featured starting point at the top, then the full library below by topic.
            </p>
          </div>

          <FounderVideos />

          <section className="mt-20">
            <div className="flex items-center gap-3 mb-5">
              <span className="text-foreground/60 text-sm">𝕏</span>
              <h3 className="text-xs font-light tracking-[0.3em] uppercase text-foreground/80">
                From the Feed · Pinned Post
              </h3>
              <div className="flex-1 h-px bg-border/15" />
            </div>
            <div className="mx-auto max-w-2xl rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden shadow-2xl shadow-black/30">
              <iframe
                src="https://platform.twitter.com/embed/Tweet.html?id=2067291085039185957&theme=dark&dnt=true"
                title="Asher Newton on X"
                className="w-full"
                style={{ height: 720, border: 0 }}
                loading="lazy"
                allow="autoplay; encrypted-media; picture-in-picture; web-share"
              />
              <div className="p-4 border-t border-border/20 text-center">
                <a
                  href="https://x.com/shep_newton/status/2067291085039185957"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-light tracking-[0.22em] uppercase text-foreground/80 hover:text-foreground"
                >
                  Open on 𝕏 →
                </a>
              </div>
            </div>
          </section>


          <DirectionalCTA to="imagines" label="Continue · Into the Teachings" />
        </div>
      </div>

      {/* The Teachings (formerly Founders Imagines Lessons) */}
      <div id="imagines" className="relative z-10 px-6 py-28 sm:py-36 scroll-mt-24">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <span className="founder-eyebrow mb-6">Chapter · 05 · Teachings</span>
            <h2 className="mt-6 font-display text-5xl sm:text-6xl md:text-7xl font-light tracking-[-0.025em] leading-[1.02] text-foreground">
              The Teachings
            </h2>
            <p className="mt-6 max-w-2xl mx-auto text-base font-extralight leading-[1.75] text-foreground/75">
              Hand-drawn lessons from Asher. Visual meditations on the hidden architecture of reality — read one at a time, slowly. Each begins with the part most people are never told.
            </p>
          </div>

          <div className="space-y-10">
            {/* Lesson 01 */}
            <article className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-md p-6 sm:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div className="rounded-xl overflow-hidden border border-border/30 bg-background/40">
                  <img src={imagineMaterialVsDivine} alt="Material Love vs Divine Love — a hand-drawn lesson by Asher Newton" className="w-full h-auto" loading="lazy" />
                </div>
                <div>
                  <p className="text-xs font-extralight tracking-[0.3em] text-foreground/50 uppercase mb-3">Lesson 01</p>
                  <h3 className="font-display text-4xl sm:text-5xl md:text-[3.25rem] font-light tracking-[-0.02em] text-foreground leading-[1.05]">
                    Material Love vs. Divine Love
                  </h3>
                  <p className="mt-6 text-xl sm:text-2xl font-extralight leading-[1.4] text-foreground italic">
                    "Material love is tainted. Divine love is what's left when the simulation ends."
                  </p>
                  <div className="mt-6 space-y-4 text-base font-extralight leading-[1.75] text-foreground/80">
                    <p>Material love is corrupted by cheating, betrayal, and conditional attachment. It mirrors the material world itself — a realm engineered by the elites who control humanity through money, fear, and manufactured scarcity.</p>
                    <p>But there is a perfect world. That perfect world exists <em>outside</em> the simulation of the 3D realm — beyond the veil the controllers have built around your perception.</p>
                    <p>Every human carries a <span className="text-foreground">divine spark</span> and access to <span className="text-foreground">divine love</span>, even when you cannot feel it. It was never lost — only buried beneath layers of programming, trauma, and distraction.</p>
                    <p>When you wake up — when you truly realize what you are — you reconnect to the Source of that divine love. And in that moment, you disconnect from the false signal of material love forever.</p>
                  </div>
                </div>
              </div>
            </article>

            {/* Lesson 02 */}
            <article className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-md p-6 sm:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div className="rounded-xl overflow-hidden border border-border/30 bg-background/40 lg:order-2">
                  <img src={imagineMoneyWarControl} alt="Money + War — Control Tactics, a hand-drawn lesson by Asher Newton" className="w-full h-auto" loading="lazy" />
                </div>
                <div className="lg:order-1">
                  <p className="text-xs font-extralight tracking-[0.3em] text-foreground/50 uppercase mb-3">Lesson 02</p>
                  <h3 className="font-display text-4xl sm:text-5xl md:text-[3.25rem] font-light tracking-[-0.02em] text-foreground leading-[1.05]">
                    Control Tactics — Money &amp; War
                  </h3>
                  <p className="mt-6 text-xl sm:text-2xl font-extralight leading-[1.4] text-foreground italic">
                    "Money is the false god. War is the harvest. You are the fuel."
                  </p>
                  <div className="mt-6 space-y-4 text-base font-extralight leading-[1.75] text-foreground/80">
                    <p>The elites try to control you through <span className="text-foreground">money</span> — making you chase something fake, designed to keep you attached to the 3D realm. Money is a form of the false god — the <em>Demiurge</em>, the <em>Ouroboros</em>, the snake eating its own tail.</p>
                    <p>Money makes you a <span className="text-foreground">slave to the system</span>. You wake, work, and bleed for it. The paradox: the moment you detach from money — the moment it loses its grip on your soul — is the moment it begins to flow to you freely.</p>
                    <p><span className="text-foreground">War</span> is the other half of the loop. War is nothing more than <em>emotional harvesting</em>. Negative emotion is <span className="text-foreground">loosh</span> — and loosh is the supply line that feeds the simulation.</p>
                    <p>You do not have to be a slave to the system anymore. <span className="text-foreground">Remove the chains around your neck and feet, and be free.</span> The veil will tear. The simulation will break. <span className="text-foreground">Wake up.</span></p>
                  </div>
                </div>
              </div>
            </article>

            {/* Lesson 03 */}
            <article className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-md p-6 sm:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div className="rounded-xl overflow-hidden border border-border/30 bg-background/40">
                  <img src={imagineReligionJesusCreated} alt="The Religion Jesus Created — a lesson by Asher Newton" className="w-full h-auto" loading="lazy" />
                </div>
                <div>
                  <p className="text-xs font-extralight tracking-[0.3em] text-foreground/50 uppercase mb-3">Lesson 03</p>
                  <h3 className="font-display text-4xl sm:text-5xl md:text-[3.25rem] font-light tracking-[-0.02em] text-foreground leading-[1.05]">
                    The Religion Jesus Created
                  </h3>
                  <p className="mt-6 text-xl sm:text-2xl font-extralight leading-[1.4] text-foreground italic">
                    "Christianity wasn't built by Jesus. It was built after him — to bury what he actually taught."
                  </p>
                  <div className="mt-6 space-y-4 text-base font-extralight leading-[1.75] text-foreground/80">
                    <p>When Jesus was alive, he created a religion — and it wasn't Christianity. Christianity was created after his death by a man named <span className="text-foreground">Paul</span>, funded by the Roman and Persian elites who wanted to suppress what Jesus had unleashed.</p>
                    <p>While alive, Jesus freed many slaves through the <em>divine truth of occultism</em> and pure spirituality. That liberation terrified the powers that ruled the ancient world.</p>
                    <p>The religion Jesus actually created is called the <span className="text-foreground">Gnostic religion</span> — a spiritually based path that is never-ending. The doctrine he was preaching, the stories he told, the inner knowing he awakened in those who could hear him.</p>
                  </div>
                </div>
              </div>
            </article>

            {/* Lesson 04 */}
            <article className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-md p-6 sm:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div className="rounded-xl overflow-hidden border border-border/30 bg-background/40">
                  <img src={imagineGodsHideAntarctica} alt="Where Do Gods Hide Among Men? — a lesson by Asher Newton" className="w-full h-auto" loading="lazy" />
                </div>
                <div>
                  <p className="text-xs font-extralight tracking-[0.3em] text-foreground/50 uppercase mb-3">Lesson 04</p>
                  <h3 className="font-display text-4xl sm:text-5xl md:text-[3.25rem] font-light tracking-[-0.02em] text-foreground leading-[1.05]">
                    Where Do Gods Hide Among Men?
                  </h3>
                  <p className="mt-6 text-xl sm:text-2xl font-extralight leading-[1.4] text-foreground italic">
                    "The one continent no human nation dares to claim. The question answers itself."
                  </p>
                  <div className="mt-6 space-y-4 text-base font-extralight leading-[1.75] text-foreground/80">
                    <p>If you were a divine intelligence, a fallen architect, a being who existed outside the human frequency — forced to inhabit this realm but unwilling to lower yourself to its noise — where would you go?</p>
                    <p>You would go to the one place no human nation dares to claim. The one place every world government, by international treaty, agreed to leave untouched. The one continent where no flag of sovereignty flies — yet the most powerful nations on Earth maintain "research stations" there.</p>
                    <p className="text-foreground text-2xl font-extralight italic">Antarctica.</p>
                  </div>
                </div>
              </div>
            </article>

            {/* Lesson 05 */}
            <article className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-md p-6 sm:p-10">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
                <div className="rounded-xl overflow-hidden border border-border/30 bg-background/40">
                  <img src={imagineChaosTime} alt="The Law of Chaos — Time and timeline jumping, a lesson by Asher Newton" className="w-full h-auto" loading="lazy" />
                </div>
                <div>
                  <p className="text-xs font-extralight tracking-[0.3em] text-foreground/50 uppercase mb-3">Lesson 05</p>
                  <h3 className="font-display text-4xl sm:text-5xl md:text-[3.25rem] font-light tracking-[-0.02em] text-foreground leading-[1.05]">
                    The Law of Chaos — Law One: Time
                  </h3>
                  <p className="mt-6 text-xl sm:text-2xl font-extralight leading-[1.4] text-foreground italic">
                    "Chaos was there before the Monad. Time was the first law. Every jump is a new world."
                  </p>
                  <div className="mt-6 space-y-4 text-base font-extralight leading-[1.75] text-foreground/80">
                    <p className="text-foreground">Chaos = Time.</p>
                    <p>All realms must follow the laws of time, because time existed when Chaos itself was born. Both the Realm of Matter and the Realm of the Monad are bound by it — there is no realm above this law.</p>
                    <p>The Realm of Matter holds bodies built from matter and clay — bodies that age, decay, and die with time. That species is called <span className="text-foreground">humans</span>. The Realm of the Monad holds the origin species — the souls themselves — called <span className="text-foreground">mankind</span>. Mankind never ages and never dies, because mankind <em>is</em> the soul.</p>
                    <p>Above this sits a deeper truth: <span className="text-foreground">timeline jumping</span>. The moment a person jumps from Timeline A into the future, they do not "arrive" in someone else's future. They <span className="text-foreground">create</span> a new branch — Timeline B — and from that instant forward, Timeline B becomes their new Timeline A.</p>
                    <p>The old timeline does not vanish. It continues without them. But the jumper now lives on a thread only they authored.</p>
                  </div>
                </div>
              </div>
            </article>
          </div>

          {/* Final closing CTA back home */}
          <div className="mt-20 text-center">
            <p className="text-base font-extralight leading-[1.75] text-foreground/70 max-w-xl mx-auto">
              You've read his story. You've heard his voice. Now meet what he built.
            </p>
            <Link
              to="/"
              className="mt-8 inline-flex items-center gap-3 rounded-full border border-foreground/30 bg-foreground/10 px-7 py-3.5 text-sm font-light tracking-[0.22em] uppercase text-foreground transition-all hover:bg-foreground/20"
            >
              Enter Asherin
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Spacer */}
      <div className="relative z-10 h-24" />
      </div>

      <SiteFooter />
    </div>
  );
};

export default Founder;
