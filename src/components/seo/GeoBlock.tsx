/**
 * GeoBlock — Priority 1 + 2 rendered surface.
 *
 * Renders, in one liftable unit:
 *   1. A 40-60 word self-contained answer paragraph  (`data-geo-answer`)
 *   2. A statistic table where every number carries its source and as-of date
 *   3. External citations, when the page makes a claim it did not originate
 *   4. A visible "Last verified" stamp
 *   5. An optional FAQ list, which also ships as FAQPage JSON-LD from RouteSeo
 *
 * The block is keyed off the current pathname, so mounting it inside a shared
 * page shell automatically covers every route that has GEO content. Pages
 * without an entry render nothing (no empty scaffolding, no layout shift).
 */
import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "react-router-dom";
import { getGeoPage, answerWordCount, effectiveUpdated } from "@/lib/geo/geoContent";

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
        data-geo-answer
        data-word-count={words}
        className="text-base font-extralight leading-[1.8] text-foreground/90"
      >
        {geo.answer}
      </p>

      {geo.attributes && geo.attributes.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-3 text-[10px] font-medium tracking-[0.25em] uppercase text-foreground/70">
            Attributes
          </h3>
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
        </div>
      )}

      {geo.stats.length > 0 && (
        <div className="mt-6 overflow-x-auto">
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
      )}

      {geo.citations && geo.citations.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-[10px] font-medium tracking-[0.25em] uppercase text-foreground/70">
            Sources
          </h3>
          <ul className="space-y-1.5 text-xs font-extralight text-muted-foreground">
            {geo.citations.map((c) => (
              <li key={c.url}>
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
        </div>
      )}

      {geo.corroboration && geo.corroboration.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-[10px] font-medium tracking-[0.25em] uppercase text-foreground/70">
            Independent corroboration
          </h3>
          <ul className="space-y-1.5 text-xs font-extralight text-muted-foreground">
            {geo.corroboration.map((c) => (
              <li key={c.url}>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-border hover:text-foreground"
                >
                  {c.label}
                </a>
                <span className="text-muted-foreground/70"> — {c.confirms}</span>
              </li>
            ))}
          </ul>
        </div>
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
        <div className="mt-6">
          <h3 className="mb-2 text-[10px] font-medium tracking-[0.25em] uppercase text-foreground/70">
            Revision history
          </h3>
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
        </div>
      )}

      {geo.faqs && geo.faqs.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-3 text-[10px] font-medium tracking-[0.25em] uppercase text-foreground/70">
            Common questions
          </h3>
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
        </div>
      )}
    </section>
  );
};

export default GeoBlock;
