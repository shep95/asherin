/**
 * RelatedLinks — Theory 11 (Compound Chain Signal).
 *
 * Every article ends with at least one internal-link cluster so Google's
 * crawler follows a chain instead of bouncing. Renders a labeled grid of
 * 2-4 related routes. Designed to live inside Article and Glossary pages.
 */
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

export interface RelatedLink {
  to: string;
  label: string;
  description: string;
}

interface Props {
  heading?: string;
  links: RelatedLink[];
}

const RelatedLinks = ({ heading = "read next", links }: Props) => {
  return (
    <section
      aria-label="Related Asherin resources"
      className="mt-20 border-t border-border/20 pt-12"
    >
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-lg font-light tracking-tight text-foreground">{heading}</h2>
        <span className="text-[10px] font-medium tracking-[0.3em] uppercase text-muted-foreground/60">
          {links.length}
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {links.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            className="group flex flex-col gap-2 rounded-2xl border border-border/30 bg-card/20 p-5 transition-all hover:border-foreground/40 hover:bg-card/40"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-light text-foreground leading-snug">{l.label}</h3>
              <ArrowUpRight
                className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:text-foreground group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                strokeWidth={1.5}
              />
            </div>
            <p className="text-xs font-extralight leading-relaxed text-muted-foreground">
              {l.description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default RelatedLinks;
