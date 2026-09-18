/**
 * ArticleShell — shared long-form article frame.
 *
 * Wraps Header + SiteFooter, visible breadcrumb, byline, hero title/dek,
 * and centered prose. FAQ JSON-LD from child FaqJsonLd portals into
 * #asherin-article-faq-root so questions are on the page, not only in head.
 */
import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import LandingBackground from "@/components/LandingBackground";
import { ArrowLeft } from "lucide-react";
import { getArticleDisclosure } from "@/data/blogCatalog";

interface Props {
  eyebrow: string;
  title: string;
  dek: string;
  publishedLabel?: string;
  readTime?: string;
  backTo?: { to: string; label: string };
  image?: ReactNode;
  children: ReactNode;
}

const ArticleShell = ({
  eyebrow,
  title,
  dek,
  publishedLabel,
  readTime,
  backTo = { to: "/blog", label: "notes from asherin." },
  image,
  children,
}: Props) => {
  const [progress, setProgress] = useState(0);
  const disclosure = getArticleDisclosure(typeof window === "undefined" ? "" : window.location.pathname);

  useEffect(() => {
    const update = () => {
      const root = document.documentElement;
      const available = root.scrollHeight - root.clientHeight;
      setProgress(available > 0 ? Math.min(100, (root.scrollTop / available) * 100) : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <LandingBackground overlayOpacity="bg-background/20">
      <div className="journal-surface min-h-screen">
        <Header />

      <div className="fixed inset-x-0 top-0 z-[60] h-px bg-foreground/10" aria-hidden>
        <div className="h-full bg-accent transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>

      <article className="mx-auto max-w-7xl px-5 pb-24 pt-28 sm:px-8 sm:pt-36 lg:px-12">
        <nav
          aria-label="Breadcrumb"
          className="journal-muted mb-10 flex flex-wrap items-center gap-2 border-b journal-rule pb-4 text-[10px] font-medium uppercase tracking-[0.22em]"
        >
          <Link to="/" className="hover:text-foreground transition-colors">
            asherin
          </Link>
          <span aria-hidden className="text-border">
            /
          </span>
          <Link to={backTo.to} className="hover:text-foreground transition-colors">
            {backTo.label}
          </Link>
          <span aria-hidden className="text-border">
            /
          </span>
          <span className="normal-case tracking-normal">{title}</span>
        </nav>

        <header className="mb-14 grid gap-10 border-b journal-rule pb-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
          <div>
            <p className="journal-muted mb-5 text-[10px] font-medium uppercase tracking-[0.32em]">
              {[eyebrow, publishedLabel, readTime].filter(Boolean).join(" · ")}
            </p>
            <h1 className="font-display text-5xl font-normal leading-[0.94] sm:text-6xl lg:text-8xl">{title}</h1>
            <p className="journal-muted mt-7 max-w-3xl text-lg font-light leading-[1.7] sm:text-xl">{dek}</p>
            <p className="journal-muted mt-5 text-[10px] font-medium uppercase tracking-[0.22em]">by asher newton</p>
          </div>
          <aside aria-label="Article status and capability boundaries" className="border-l-2 border-foreground pl-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.26em]">status</p>
            <p className="font-display mt-2 text-3xl leading-none">{disclosure.statusLabel}</p>
            <dl className="mt-6 space-y-5">
              {disclosure.boundaries.map((item) => (
                <div key={item.label}>
                  <dt className="text-[9px] font-medium uppercase tracking-[0.22em]">{item.label}</dt>
                  <dd className="journal-muted mt-1 text-xs leading-relaxed">{item.detail}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </header>

        {image && <div className="mb-14 overflow-hidden border-y journal-rule py-5">{image}</div>}

        <div className="grid gap-10 lg:grid-cols-[11rem_minmax(0,44rem)_1fr]">
          <div className="hidden lg:block"><p className="sticky top-32 text-[9px] font-medium uppercase tracking-[0.24em]">field notes / public record</p></div>
          <div className="journal-body space-y-6 text-[1.02rem] font-light leading-[1.85] [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2 [&_code]:font-mono [&_code]:text-sm">
            {children}
          </div>
          <div className="hidden lg:block" aria-hidden><p className="font-display sticky top-32 text-right text-8xl leading-none text-foreground/10">a.</p></div>
        </div>

        <div id="asherin-article-faq-root" />
        <div className="mt-16 border-t journal-rule pt-8">
          <Link to={backTo.to} className="journal-muted inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.28em] transition-opacity hover:opacity-60">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {backTo.label}
          </Link>
        </div>
      </article>

        <SiteFooter />
      </div>
    </LandingBackground>
  );
};

export default ArticleShell;
