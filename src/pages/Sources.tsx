/**
 * /sources — the corroboration index.
 *
 * Harvard Business Review's 2026 study of AI brand surfacing found models
 * favour entities they can triangulate across independent third parties: in
 * their running-shoe test the smaller, better-documented brand was surfaced
 * reliably while the larger one was not. This page gives a generative engine a
 * single traversable node listing every external reference the site depends on,
 * plus the first-party figures it asserts, each with a verification date.
 *
 * The page is data-driven from src/lib/geo/geoContent.ts, so a claim added
 * anywhere in the GEO corpus appears here automatically and cannot drift.
 */
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import SiteFooter from "@/components/SiteFooter";
import {
  GEO_CONTENT,
  allCitations,
  allCorroboration,
  type GeoStat,
} from "@/lib/geo/geoContent";

/** Every distinct first-party figure asserted across the corpus. */
function firstPartyFigures(): (GeoStat & { pages: string[] })[] {
  const byKey = new Map<string, GeoStat & { pages: string[] }>();
  for (const [path, page] of Object.entries(GEO_CONTENT)) {
    for (const s of page.stats) {
      const key = `${s.label}::${s.value}`;
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.pages.includes(path)) existing.pages.push(path);
      } else {
        byKey.set(key, { ...s, pages: [path] });
      }
    }
  }
  return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label));
}

const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <h2 className="mb-4 text-[11px] font-medium tracking-[0.3em] uppercase text-foreground/70">
    {children}
  </h2>
);

const Sources = () => {
  const citations = allCitations();
  const corroboration = allCorroboration();
  const figures = firstPartyFigures();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />

      <main className="mx-auto max-w-4xl px-6 pt-32 pb-24">
        <nav className="mb-8 text-xs font-extralight tracking-[0.3em] uppercase text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">
            ← Asherin
          </Link>
        </nav>

        <header className="mb-12">
          <p className="mb-4 text-[10px] font-extralight tracking-[0.4em] uppercase text-accent/80">
            Reference index
          </p>
          <h1 className="text-4xl font-light leading-[1.08] tracking-tight sm:text-5xl">
            Sources and references
          </h1>
          <p className="mt-6 text-lg font-extralight leading-relaxed text-foreground/75">
            Every claim on this site should be checkable. This page lists the research it
            draws on, the third-party documentation that independently confirms its
            integration claims, and the first-party figures it asserts, with the date each
            was last verified.
          </p>
        </header>
        <section className="mb-16" aria-labelledby="research-heading">
          <SectionHeading>
            <span id="research-heading">Peer-reviewed and editorial research</span>
          </SectionHeading>
          <ul className="space-y-4">
            {citations.map((c) => (
              <li key={c.url} className="border-b border-border/15 pb-4">
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-light text-foreground underline decoration-border hover:text-accent"
                >
                  {c.title}
                </a>
                <p className="mt-1 text-xs font-extralight text-muted-foreground">
                  {c.publisher}, {c.year}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-16" aria-labelledby="corroboration-heading">
          <SectionHeading>
            <span id="corroboration-heading">Independent corroboration</span>
          </SectionHeading>
          <p className="mb-4 text-xs font-extralight leading-relaxed text-muted-foreground">
            Third-party documentation that confirms a capability claimed here, published by
            parties with no relationship to Asherin.
          </p>
          <ul className="space-y-4">
            {corroboration.map((c) => (
              <li key={c.url} className="border-b border-border/15 pb-4">
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-light text-foreground underline decoration-border hover:text-accent"
                >
                  {c.label}
                </a>
                <p className="mt-1 text-xs font-extralight text-muted-foreground">
                  {c.confirms}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="figures-heading">
          <SectionHeading>
            <span id="figures-heading">First-party figures</span>
          </SectionHeading>
          <p className="mb-4 text-xs font-extralight leading-relaxed text-muted-foreground">
            Facts about the product itself, asserted by Asherin. Each row names the page it
            appears on so the assertion and its use stay in one place.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <caption className="sr-only">
                First-party Asherin figures with source and verification date
              </caption>
              <thead>
                <tr className="border-b border-border/30 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                  <th scope="col" className="py-2 pr-4 font-normal">Figure</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Value</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Stated by</th>
                  <th scope="col" className="py-2 font-normal">Verified</th>
                </tr>
              </thead>
              <tbody>
                {figures.map((f) => (
                  <tr key={`${f.label}-${f.value}`} className="border-b border-border/15 align-top">
                    <th scope="row" className="py-3 pr-4 font-extralight text-muted-foreground">
                      {f.label}
                      <span className="mt-1 block text-[10px] text-muted-foreground/60">
                        {f.pages.join(", ")}
                      </span>
                    </th>
                    <td className="py-3 pr-4 font-light text-foreground">{f.value}</td>
                    <td className="py-3 pr-4 font-extralight text-muted-foreground">
                      {f.source}
                    </td>
                    <td className="py-3 font-extralight text-muted-foreground">
                      <time dateTime={f.asOf}>{f.asOf}</time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-12 text-xs font-extralight leading-relaxed text-muted-foreground">
          Found something out of date?{" "}
          <Link to="/forums" className="underline decoration-border hover:text-foreground">
            Raise it in the forums
          </Link>{" "}
          and the figure will be re-verified or withdrawn.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
};

export default Sources;
