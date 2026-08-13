/**
 * ArticleShell — shared long-form article frame.
 *
 * Wraps Header + SiteFooter, breadcrumb crumb, eyebrow, hero title/dek,
 * and centered prose container. Used by every new blog satellite,
 * glossary entry, and predictive intelligence report so structure stays
 * fractal-identical across the cluster (Theory 8 — Nested Fractal).
 */
import { type ReactNode } from "react";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";


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
  backTo = { to: "/blog", label: "← Asherin Journal" },
  image,
  children,
}: Props) => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <article className="mx-auto max-w-3xl px-6 pt-32 pb-24">
        <nav className="mb-8 text-xs font-extralight tracking-[0.3em] uppercase text-muted-foreground">
          <Link to={backTo.to} className="hover:text-foreground transition-colors">
            {backTo.label}
          </Link>
        </nav>

        <header className="mb-12">
          <p className="text-[10px] font-extralight tracking-[0.4em] uppercase text-accent/80 mb-4">
            {[eyebrow, publishedLabel, readTime].filter(Boolean).join(" · ")}
          </p>
          <h1 className="text-4xl sm:text-5xl font-light tracking-tight leading-[1.08] text-foreground">
            {title}
          </h1>
          {image && (
            <div className="mt-6 -mx-6 sm:-mx-12 lg:-mx-20">
              {image}
            </div>
          )}
          <p className="mt-6 text-lg font-extralight leading-relaxed text-foreground/75">
            {dek}
          </p>
        </header>

        {/* Extractable answer + sourced statistics (renders only where GEO content exists). */}
        <div className="space-y-6 text-base font-extralight leading-[1.8] text-foreground/80 [&_h2]:text-2xl [&_h2]:font-light [&_h2]:tracking-tight [&_h2]:text-foreground [&_h2]:pt-6 [&_h3]:text-xl [&_h3]:font-light [&_h3]:text-foreground [&_h3]:pt-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2 [&_a]:text-accent [&_a:hover]:underline [&_strong]:text-foreground [&_code]:font-mono [&_code]:text-sm [&_code]:bg-card/60 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded">
          {children}
        </div>
      </article>

      <SiteFooter />
    </div>
  );
};

export default ArticleShell;
