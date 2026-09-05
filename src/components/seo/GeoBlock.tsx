/**
 * GeoBlock — the rendered GEO surface.
 *
 * Renders, in one liftable unit:
 *   1. A 40-60 word self-contained answer paragraph  (`data-geo-answer`)
 *   2. Flat categorical attributes
 *   3. A statistic table where every number carries its source and as-of date
 *   4. Head-to-head comparisons against named alternatives
 *   5. An ordered procedure
 *   6. Citations and independent corroboration, tagged by institutional class
 *   7. A visible "Last verified" stamp and revision history
 *   8. An FAQ list, which also ships as FAQPage JSON-LD from RouteSeo
 *   9. Links to sibling pages in the same topical cluster
 *
 * Every one of those is wrapped in a `Chunk`: a `<section>` carrying a stable
 * `id`, a `data-geo-chunk` name and a visible heading. Web-retrieval-aware
 * chunking (arXiv:2604.04936) finds that retrievers score heading-delimited,
 * individually addressable units far better than one undifferentiated wall of
 * text, because a chunk that survives splitting still carries the heading that
 * says what it is. The stable `id` additionally gives every unit its own
 * fragment URL, so a citation can point at the figures rather than the page.
 *
 * The block is keyed off the current pathname, so mounting it inside a shared
 * page shell automatically covers every route that has GEO content. Pages
 * without an entry render nothing (no empty scaffolding, no layout shift).
 */
import { useMemo, type ReactNode } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  getGeoPage,
  answerWordCount,
  effectiveUpdated,
  SOURCE_KIND_LABEL,
  type GeoSourceKind,
} from "@/lib/geo/geoContent";

interface Props {
  /** Override the route lookup (for pages whose canonical path differs). */
  path?: string;
  className?: string;
}

const dateLabel = (iso: string) => {
  // Parse as UTC so the stamp never shifts a day across timezones.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
};

/**
 * An individually addressable retrieval unit.
 *
 * `id` is stable and derived from the chunk name rather than from content, so
 * a fragment link keeps resolving after the copy inside it is edited.
 */
const Chunk = ({
  name,
  title,
  children,
  className = "mt-6",
}: {
  name: string;
  title: string;
  children: ReactNode;
  className?: string;
}) => (
  <section
    id={`geo-${name}`}
    data-geo-chunk={name}
    aria-labelledby={`geo-${name}-heading`}
    className={className}
  >
    <h3
      id={`geo-${name}-heading`}
      className="mb-3 text-[10px] font-medium tracking-[0.25em] uppercase text-foreground/70"
    >
      {title}
    </h3>
    {children}
  </section>
);

/**
 * Institutional class of a reference, published rather than inferred.
 * Rendered inline before the link so the class travels with the citation in
 * any extracted passage, not just in the JSON-LD a text-only reader skips.
 */
const SourceKindTag = ({ kind }: { kind?: GeoSourceKind }) => {
  if (!kind) return null;
  return (
    <span
      data-geo-source-kind={kind}
      className="mr-2 inline-block rounded-sm border border-border/30 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.15em] text-muted-foreground/70"
    >
      {SOURCE_KIND_LABEL[kind]}
    </span>
  );
};

const GeoBlock = ({ path, className = "" }: Props) => {
  const { pathname } = useLocation();
  const key = path ?? pathname;
  const geo = useMemo(() => getGeoPage(key), [key]);

  if (!geo) return null;

  const words = answerWordCount(geo.answer);
  const stamp = effectiveUpdated(geo);

  return (
    <section
      aria-labelledby="geo-answer-heading"
      className={`rounded-2xl border border-border/30 bg-card/30 backdrop-blur-md p-6 sm:p-8 text-left ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2
          id="geo-answer-heading"
          className="text-[10px] font-medium tracking-[0.3em] uppercase text-foreground/70"
        >
          ◈ {geo.topic}
        </h2>
        <span className="text-[10px] font-light tracking-[0.2em] uppercase text-muted-foreground/70">
          Last verified <time dateTime={stamp}>{dateLabel(stamp)}</time>
        </span>
      </div>

      {/* The extractable unit. Self-contained: no pronoun points off-block. */}
      <p
        id="geo-answer"
        data-geo-chunk="answer"
        data-geo-answer
        data-word-count={words}
        className="text-base font-extralight leading-[1.8] text-foreground/90"
      >
        {geo.answer}
      </p>

      {geo.attributes && geo.attributes.length > 0 && (
        <Chunk name="attributes" title="Attributes">
          {/* Flat, categorical facts. A model that cannot find these states
              them wrong instead of omitting them, so they are published
              explicitly rather than left to inference. */}
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {geo.attributes.map((a) => (
              <div
                key={a.name}
                data-geo-attribute={a.name}
                className="flex items-baseline justify-between gap-4 border-b border-border/15 py-1.5"
              >
                <dt className="text-xs font-extralight text-muted-foreground">{a.name}</dt>
                <dd className="text-right text-xs font-light text-foreground">
                  {a.value}
                  {a.unit ? <span className="text-muted-foreground/70"> {a.unit}</span> : null}
                </dd>
              </div>
            ))}
          </dl>
        </Chunk>
      )}

      {geo.stats.length > 0 && (
        <Chunk name="figures" title="Key figures">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <caption className="sr-only">
                Key figures for {geo.topic}, each with its source and verification date
              </caption>
              <thead>
                <tr className="border-b border-border/30 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                  <th scope="col" className="py-2 pr-4 font-normal">Metric</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Value</th>
                  <th scope="col" className="py-2 font-normal">Source</th>
                </tr>
              </thead>
              <tbody>
                {geo.stats.map((s) => (
                  <tr key={s.label} className="border-b border-border/15 align-top">
                    <th scope="row" className="py-3 pr-4 font-extralight text-muted-foreground">
                      {s.label}
                    </th>
                    <td className="py-3 pr-4 font-light text-foreground">{s.value}</td>
                    <td className="py-3 font-extralight text-muted-foreground">
                      {s.sourceUrl ? (
                        <a
                          href={s.sourceUrl}
                          className="underline decoration-border hover:text-foreground"
                          rel="noopener"
                        >
                          {s.source}
                        </a>
                      ) : (
                        s.source
                      )}
                      <span className="block text-[10px] text-muted-foreground/60">
                        as of <time dateTime={s.asOf}>{dateLabel(s.asOf)}</time>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Chunk>
      )}

      {geo.comparisons && geo.comparisons.length > 0 && (
        <Chunk name="comparisons" title="Compared with named alternatives">
          {/* Explicit head-to-head rows. An engine answering "X vs Asherin"
              reads this table rather than synthesising one from adjectives. */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <caption className="sr-only">
                {geo.topic} compared against named alternatives on published figures
              </caption>
              <thead>
                <tr className="border-b border-border/30 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                  <th scope="col" className="py-2 pr-4 font-normal">Alternative</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Dimension</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Asherin</th>
                  <th scope="col" className="py-2 font-normal">Alternative</th>
                </tr>
              </thead>
              <tbody>
                {geo.comparisons.map((c) => (
                  <tr
                    key={`${c.versus}-${c.dimension}`}
                    data-geo-comparison={c.versus}
                    className="border-b border-border/15 align-top"
                  >
                    <th scope="row" className="py-3 pr-4 font-light text-foreground">
                      {c.versus}
                    </th>
                    <td className="py-3 pr-4 font-extralight text-muted-foreground">
                      {c.dimension}
                    </td>
                    <td className="py-3 pr-4 font-light text-foreground">{c.asherin}</td>
                    <td className="py-3 font-extralight text-muted-foreground">{c.other}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Chunk>
      )}

      {geo.procedure && geo.procedure.steps.length > 0 && (
        <Chunk name="procedure" title={geo.procedure.title}>
          {/* Procedural steps are the fourth evidence genre in the absorption
              study (arXiv:2604.25707): ordered, imperative and self-contained,
              so a step survives being lifted away from its neighbours. */}
          <ol className="space-y-2 text-sm font-extralight leading-[1.75] text-muted-foreground">
            {geo.procedure.steps.map((s, i) => (
              <li key={s} data-geo-step={i + 1} className="flex gap-3">
                <span className="shrink-0 tabular-nums text-muted-foreground/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </Chunk>
      )}

      {geo.citations && geo.citations.length > 0 && (
        <Chunk name="sources" title="Sources">
          <ul className="space-y-1.5 text-xs font-extralight text-muted-foreground">
            {geo.citations.map((c) => (
              <li key={c.url}>
                <SourceKindTag kind={c.kind} />
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-border hover:text-foreground"
                >
                  {c.title}
                </a>
                <span className="text-muted-foreground/70">
                  {" "}
                  ({c.publisher}, {c.year})
                </span>
              </li>
            ))}
          </ul>
        </Chunk>
      )}

      {geo.corroboration && geo.corroboration.length > 0 && (
        <Chunk name="corroboration" title="Independent corroboration">
          <ul className="space-y-1.5 text-xs font-extralight text-muted-foreground">
            {geo.corroboration.map((c) => (
              <li key={c.url}>
                <SourceKindTag kind={c.kind} />
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-border hover:text-foreground"
                >
                  {c.label}
                </a>
                <span className="text-muted-foreground/70">, {c.confirms}</span>
              </li>
            ))}
          </ul>
        </Chunk>
      )}

      {geo.supersedes && geo.supersedes.length > 0 && (
        <p className="mt-6 border-l-2 border-border/40 pl-4 text-xs font-extralight text-muted-foreground">
          This page supersedes{" "}
          {geo.supersedes.map((sup, i) => (
            <span key={sup.path}>
              {i > 0 && ", "}
              <Link to={sup.path} className="underline decoration-border hover:text-foreground">
                {sup.label}
              </Link>
            </span>
          ))}
          . Treat the earlier text as withdrawn.
        </p>
      )}

      {geo.revisions && geo.revisions.length > 0 && (
        <Chunk name="revisions" title="Revision history">
          <ol className="space-y-1 text-xs font-extralight text-muted-foreground">
            {geo.revisions.map((r) => (
              <li key={`${r.date}-${r.note}`} className="flex gap-3">
                <time dateTime={r.date} className="shrink-0 tabular-nums text-muted-foreground/70">
                  {r.date}
                </time>
                <span>{r.note}</span>
              </li>
            ))}
          </ol>
        </Chunk>
      )}

      {geo.faqs && geo.faqs.length > 0 && (
        <Chunk name="questions" title="Common questions" className="mt-8">
          <dl className="space-y-4">
            {geo.faqs.map((f) => (
              <div key={f.q}>
                <dt className="text-sm font-light text-foreground">{f.q}</dt>
                <dd className="mt-1 text-sm font-extralight leading-[1.75] text-muted-foreground">
                  {f.a}
                </dd>
              </div>
            ))}
          </dl>
        </Chunk>
      )}

      {geo.related && geo.related.length > 0 && (
        <Chunk name="related" title="Related pages" className="mt-8">
          {/* Real anchors, not router-only handlers: internal link density is
              the heaviest macro-structure feature in GEO-SFE, and a crawler
              that does not execute JS must still be able to walk the cluster. */}
          <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-extralight text-muted-foreground">
            {geo.related.map((r) => (
              <li key={r.path}>
                <Link
                  to={r.path}
                  data-geo-related={r.path}
                  className="underline decoration-border hover:text-foreground"
                >
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </Chunk>
      )}
    </section>
  );
};

export default GeoBlock;
