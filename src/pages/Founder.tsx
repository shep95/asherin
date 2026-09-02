import { useEffect } from "react";
import FounderPhotoCarousel from "@/components/founder/FounderPhotoCarousel";
import Header from "@/components/Header";
import { Link } from "react-router-dom";
import { ArrowLeft, Instagram, Linkedin, Twitter } from "lucide-react";
import ScrollProgressBar from "@/components/landing/ScrollProgressBar";
import SiteFooter from "@/components/SiteFooter";

const SOCIALS = [
  {
    href: "https://www.instagram.com/asher_united/",
    Icon: Instagram,
    label: "instagram",
    handle: "@asher_united",
  },
  {
    href: "https://x.com/shep_newton",
    Icon: Twitter,
    label: "x",
    handle: "@shep_newton",
  },
  {
    href: "https://www.linkedin.com/in/asher-newton-2648a4277/",
    Icon: Linkedin,
    label: "linkedin",
    handle: "asher newton",
  },
] as const;

const Founder = () => {
  // SEO head (title, description, canonical, og:*, WebPage JSON-LD) is owned by
  // <RouteSeo />. Only the Person schema specific to this page is added here.
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
      description:
        "Asher Newton, founder of Asherin, and his book The Book of Asher Aureon Elion.",
      sameAs: SOCIALS.map((s) => s.href),
    });
    document.head.appendChild(ld);
    return () => {
      document.getElementById("founder-jsonld")?.remove();
    };
  }, []);

  return (
    <div className="landing-perf min-h-screen bg-background text-foreground">
      <ScrollProgressBar />
      <Header />

      <div className="zophiel-aurora-shell">
        {/* Founder */}
        <div id="top" className="relative z-10 px-6 pt-28 pb-16 sm:pt-32 scroll-mt-24">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[10px] font-extralight tracking-[0.32em] text-muted-foreground/60 hover:text-foreground transition-colors mb-12 uppercase"
          >
            <ArrowLeft className="h-3 w-3" />
            back to home
          </Link>

          <div className="mx-auto max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-12 lg:gap-16 items-center">
            <div className="order-2 lg:order-1">
              <div className="relative aspect-[4/5] w-full max-w-[460px] mx-auto rounded-[2rem] overflow-hidden border border-border/30">
                <FounderPhotoCarousel />
                <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>

            <div className="order-1 lg:order-2 text-left">
              <span className="inline-block text-xs font-light tracking-[0.32em] text-foreground/70 uppercase mb-6 border border-foreground/20 rounded-full px-3 py-1">
                founder
              </span>

              <h1 className="font-display text-6xl sm:text-7xl md:text-8xl font-light tracking-[-0.025em] leading-[0.9] text-foreground">
                asher
                <br />
                <span className="italic font-light text-foreground/70">newton</span>
              </h1>

              <p className="mt-4 text-xs font-extralight tracking-[0.32em] text-muted-foreground/70 uppercase">
                prompt engineer
              </p>


              <p className="mt-6 max-w-md text-base font-extralight leading-[1.8] text-foreground/75">
                i build asherin. it is a small project made with care, and it is
                still learning. below is a book i wrote — you are welcome to read
                it here, or take it with you.
              </p>

              <div className="mt-10 flex flex-wrap gap-3">
                {SOCIALS.map(({ href, Icon, label, handle }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-2.5 rounded-xl border border-border/30 bg-foreground/[0.03] px-4 py-2.5 text-sm font-light text-foreground/85 transition-colors hover:border-foreground/40 hover:text-foreground"
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                    <span className="tracking-wide">{label}</span>
                    <span className="text-xs text-muted-foreground/70">{handle}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* The book */}
        <div id="book" className="relative z-10 px-6 pb-28 sm:pb-36 scroll-mt-24">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-10">
              <h2 className="font-display text-4xl sm:text-5xl md:text-6xl font-light tracking-[-0.025em] leading-[1.05] text-foreground">
                the book of asher aureon elion
              </h2>
              <p className="mt-5 max-w-xl mx-auto text-base font-extralight leading-[1.75] text-foreground/70">
                read it here, page by page. scroll inside the reader, or download
                a copy.
              </p>
            </div>

            <FounderBook />
          </div>
        </div>

        <div className="relative z-10 h-12" />
      </div>

      <SiteFooter />
    </div>
  );
};

export default Founder;
