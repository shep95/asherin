// ─────────────────────────────────────────────────────────────────────────────
// DEEP TIME PANEL — the engine's own reach-back.
//
// The intercept surface answers "what is being served about this right now".
// This one answers "how far back does the record go, and which hosts died".
// Every row is a document the Ghost Engine opened and dated itself — no outside
// capture archive is consulted, and nothing is interpolated between years.
// ─────────────────────────────────────────────────────────────────────────────

import { memo, useMemo, useState } from "react";
import { Clock, ExternalLink, Library, Radar, Ghost, Skull, FileText, Fingerprint, Tags, Quote } from "lucide-react";

export type DateProof =
  | "http-last-modified" | "jsonld" | "meta-published"
  | "time-element" | "url-path" | "copyright" | "body-text" | "doc-metadata";

export type DocClass =
  | "webpage" | "pdf" | "office" | "code" | "data" | "image" | "share" | "other";

export interface TermHit {
  term: string;
  count: number;
  where: Array<"url" | "title" | "meta" | "keywords" | "body">;
  snippet: string;
}

export interface TimeCapture {
  url: string;
  evidence_url: string;
  timestamp: string;
  year: number;
  status: string;
  mime: string;
  proof: DateProof;
  raw: string;
  title: string;
  source: "probe";
  doc_class: DocClass;
  meta: Record<string, string>;
  keywords: string[];
  terms: TermHit[];
  bytes: number;
}

export interface HostLifespan {
  host: string;
  first_year: number | null;
  last_year: number | null;
  documents: number;
  alive: boolean;
  resolves: boolean;
}

export interface TimeEra {
  year: number;
  captures: number;
  hosts: string[];
  sample_url: string | null;
  sample_evidence: string | null;
}

export interface TimeMachineReport {
  selector: string;
  kind: string;
  window: { from: number; to: number };
  earliest: TimeCapture | null;
  latest: TimeCapture | null;
  eras: TimeEra[];
  captures: TimeCapture[];
  hosts: HostLifespan[];
  hosts_probed: string[];
  dead_hosts: string[];
  classes: Array<{ doc_class: DocClass; documents: number }>;
  keywords: Array<{ keyword: string; documents: number }>;
  authors: Array<{ value: string; field: string; documents: number; sample_url: string }>;
  term_coverage: Array<{ term: string; documents: number; hits: number }>;
  corpora: Array<{ name: string; ok: boolean; records: number; note: string | null }>;
  elapsed_ms: number;
}

const fmtDate = (iso: string) => (iso ? iso.slice(0, 10) : "undated");

const CLASS_LABEL: Record<DocClass, string> = {
  webpage: "web page", pdf: "PDF", office: "office file", code: "source file",
  data: "data file", image: "image", share: "shared drive", other: "other",
};

/** Metadata worth surfacing on a row — the authoring trail, not the whole dump. */
const ROW_META = [
  "pdf:Author", "pdf:Creator", "pdf:Producer", "xmp:dc:creator",
  "office:creator", "office:lastModifiedBy", "office:application",
  "html:author", "html:generator", "exif:Make", "exif:Model", "exif:Software",
];

function CaptureRow({ c }: { c: TimeCapture }) {
  const trail = ROW_META.map((f) => (c.meta?.[f] ? `${f.split(":").pop()}: ${c.meta[f]}` : null))
    .filter(Boolean).slice(0, 3) as string[];
  return (
    <li>
      <a
        href={c.evidence_url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="block rounded px-1 py-1 transition-colors hover:bg-foreground/[0.04]"
      >
        <span className="flex items-baseline gap-2 text-[11.5px] text-muted-foreground/70">
          <span className="shrink-0 font-mono text-[10px] text-muted-foreground/45">{fmtDate(c.timestamp)}</span>
          <span className="shrink-0 rounded border border-border/25 px-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground/50">
            {CLASS_LABEL[c.doc_class] ?? "document"}
          </span>
          <span className="min-w-0 flex-1 truncate text-foreground/80">{c.title || c.url}</span>
          <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.08em] text-muted-foreground/35">{c.proof}</span>
          <ExternalLink className="h-3 w-3 shrink-0 opacity-40" />
        </span>
        {trail.length > 0 && (
          <span className="mt-0.5 block truncate font-mono text-[10px] text-muted-foreground/45">{trail.join("  ·  ")}</span>
        )}
        {c.terms?.length > 0 && (
          <span className="mt-0.5 block text-[10.5px] leading-snug text-muted-foreground/55">
            <Quote className="mr-1 inline h-2.5 w-2.5 opacity-50" />
            {c.terms[0].snippet || c.terms.map((t) => t.term).join(", ")}
          </span>
        )}
      </a>
    </li>
  );
}

function DeepTimePanelBase({ report }: { report: TimeMachineReport }) {
  const [openYear, setOpenYear] = useState<number | null>(null);

  const peak = useMemo(
    () => report.eras.reduce((m, e) => Math.max(m, e.captures), 1),
    [report.eras],
  );

  const byYear = useMemo(() => {
    const m = new Map<number, TimeCapture[]>();
    for (const c of report.captures) {
      if (!c.year) continue;
      const list = m.get(c.year);
      if (list) list.push(c); else m.set(c.year, [c]);
    }
    return m;
  }, [report.captures]);

  const span = report.earliest && report.latest
    ? report.latest.year - report.earliest.year
    : 0;

  const undated = useMemo(
    () => report.captures.filter((c) => !c.year),
    [report.captures],
  );

  const empty = !report.eras.length && !undated.length;

  return (
    <div className="space-y-4">
      {/* Verdict strip */}
      <div className="rounded-lg border border-border/20 bg-foreground/[0.03] p-4">
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/55">
          <span className="rounded border border-border/25 px-1.5 py-0.5">{report.kind}</span>
          <span>{report.window.from} → {report.window.to}</span>
          <span className="ml-auto normal-case tracking-normal">{report.elapsed_ms} ms</span>
        </div>
        <p className="mt-2 break-all text-[13px] text-foreground/90">{report.selector}</p>
        {report.earliest ? (
          <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground/75">
            Oldest dated document <span className="text-foreground/90">{fmtDate(report.earliest.timestamp)}</span>
            {span > 0 && <> · a {span}-year presence through {report.latest?.year}</> }
            {" "}· {report.captures.length} dated document{report.captures.length === 1 ? "" : "s"} across {report.eras.length} year{report.eras.length === 1 ? "" : "s"}.
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-muted-foreground/65">
            Nothing the engine reached carried a date it could prove.
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {report.corpora.map((c) => (
            <span
              key={c.name}
              title={c.note ?? undefined}
              className={`rounded-full border px-2 py-0.5 text-[10px] ${
                c.records > 0
                  ? "border-foreground/30 text-foreground/75"
                  : "border-border/20 text-muted-foreground/45"
              }`}
            >
              {c.name} · {c.records}
            </span>
          ))}
        </div>
      </div>

      {report.dead_hosts.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-foreground/30 bg-foreground/[0.06] p-3 text-[11.5px] text-foreground/85">
          <Skull className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {report.dead_hosts.join(", ")} carried this selector but answer{report.dead_hosts.length === 1 ? "s" : ""} nothing
            {" "}today. A host that went dark is the highest-value lead in an origins search.
          </span>
        </div>
      )}

      {/* Era ladder */}
      {report.eras.length > 0 && (
        <section className="rounded-lg border border-border/15 bg-foreground/[0.02] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">
            <Clock className="h-3.5 w-3.5" /> Era ladder
          </h3>
          <div className="space-y-1">
            {report.eras.map((e) => {
              const open = openYear === e.year;
              const rows = byYear.get(e.year) ?? [];
              return (
                <div key={e.year}>
                  <button
                    type="button"
                    onClick={() => setOpenYear(open ? null : e.year)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 rounded px-1 py-1.5 text-left transition-colors hover:bg-foreground/[0.04]"
                  >
                    <span className="w-11 shrink-0 font-mono text-[11.5px] text-foreground/80">{e.year}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                      <span
                        className="block h-full rounded-full bg-foreground/40"
                        style={{ width: `${Math.max(3, (e.captures / peak) * 100)}%` }}
                      />
                    </span>
                    <span className="w-10 shrink-0 text-right text-[10.5px] text-muted-foreground/55">{e.captures}</span>
                    <span className="hidden w-52 shrink-0 truncate text-[10.5px] text-muted-foreground/45 sm:block">
                      {e.hosts.join(", ")}
                    </span>
                  </button>
                  {open && (
                    <ul className="mb-2 ml-11 space-y-1 border-l border-border/15 pl-3">
                      {rows.slice(0, 40).map((c) => (
                        <CaptureRow key={`${c.timestamp}-${c.url}`} c={c} />
                      ))}
                      {rows.length > 40 && (
                        <li className="text-[10px] text-muted-foreground/40">+{rows.length - 40} more documents this year</li>
                      )}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Document surfaces + term corroboration */}
      {(report.classes?.length > 0 || report.term_coverage?.length > 0) && (
        <section className="rounded-lg border border-border/15 bg-foreground/[0.02] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">
            <FileText className="h-3.5 w-3.5" /> What the engine read
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {(report.classes ?? []).map((c) => (
              <span key={c.doc_class} className="rounded-full border border-border/25 px-2 py-0.5 text-[10.5px] text-foreground/75">
                {CLASS_LABEL[c.doc_class] ?? c.doc_class} · {c.documents}
              </span>
            ))}
          </div>
          {report.term_coverage?.length > 0 && (
            <ul className="mt-3 space-y-1">
              {report.term_coverage.map((t) => (
                <li key={t.term} className="flex items-center gap-3 text-[11.5px]">
                  <span className="min-w-0 flex-1 truncate text-foreground/85">{t.term}</span>
                  <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground/55">
                    {t.documents} doc{t.documents === 1 ? "" : "s"} · {t.hits} hit{t.hits === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Authoring metadata recovered from the files themselves */}
      {report.authors?.length > 0 && (
        <section className="rounded-lg border border-border/15 bg-foreground/[0.02] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">
            <Fingerprint className="h-3.5 w-3.5" /> Authoring trail · {report.authors.length}
          </h3>
          <ul className="space-y-1">
            {report.authors.map((a) => (
              <li key={`${a.field}-${a.value}`} className="flex items-center gap-3 text-[11.5px]">
                <span className="w-36 shrink-0 truncate font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground/45">{a.field}</span>
                <a
                  href={a.sample_url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="min-w-0 flex-1 truncate text-foreground/85 hover:underline"
                >
                  {a.value}
                </a>
                <span className="w-8 shrink-0 text-right text-[10.5px] text-muted-foreground/45">{a.documents}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Declared keywords */}
      {report.keywords?.length > 0 && (
        <section className="rounded-lg border border-border/15 bg-foreground/[0.02] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">
            <Tags className="h-3.5 w-3.5" /> Keywords the corpus declared
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {report.keywords.map((k) => (
              <span key={k.keyword} className="rounded-full border border-border/20 px-2 py-0.5 text-[10.5px] text-muted-foreground/70">
                {k.keyword}{k.documents > 1 && <span className="text-muted-foreground/40"> ·{k.documents}</span>}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Undated but corroborated — a missing date is not irrelevance */}
      {undated.length > 0 && (
        <section className="rounded-lg border border-border/15 bg-foreground/[0.02] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">
            <FileText className="h-3.5 w-3.5" /> Undated · matched on your terms · {undated.length}
          </h3>
          <ul className="space-y-1">
            {undated.slice(0, 40).map((c) => <CaptureRow key={c.url} c={c} />)}
          </ul>
        </section>
      )}

      {/* Host lifespans */}
      {report.hosts.length > 0 && (
        <section className="rounded-lg border border-border/15 bg-foreground/[0.02] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">
            <Library className="h-3.5 w-3.5" /> Host lifespans · {report.hosts.length}
          </h3>
          <ul className="space-y-1.5">
            {report.hosts.map((h) => (
              <li key={h.host} className="flex items-center gap-3 text-[11.5px]">
                <span className="min-w-0 flex-1 truncate text-foreground/85">{h.host}</span>
                <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground/55">
                  {h.first_year ? `${h.first_year}${h.last_year && h.last_year !== h.first_year ? `–${h.last_year}` : ""}` : "undated"}
                </span>
                <span className="w-10 shrink-0 text-right text-[10.5px] text-muted-foreground/45">{h.documents}</span>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] uppercase tracking-[0.1em] ${
                  h.alive ? "border-border/25 text-muted-foreground/55" : "border-foreground/35 text-foreground/85"
                }`}>
                  {h.alive ? "live" : h.resolves ? "silent" : "gone"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.hosts_probed.length > 0 && (
        <p className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground/45">
          <Radar className="h-3 w-3" /> Hosts the engine probed: {report.hosts_probed.join(", ")}
        </p>
      )}

      {empty && (
        <div className="rounded-lg border border-border/15 p-6 text-center">
          <Ghost className="mx-auto mb-3 h-7 w-7 text-foreground/20" />
          <p className="text-[12.5px] text-muted-foreground/70">
            Nothing the engine reached carried a provable date.
          </p>
          <p className="mx-auto mt-2 max-w-lg text-[11.5px] leading-relaxed text-muted-foreground/45">
            Deep Time dates documents the engine opens itself. A bare name reaches further once hosts are tied to it —
            run an intercept first, then come back and the hosts it found are carried into the reach-back.
          </p>
        </div>
      )}
    </div>
  );
}

export const DeepTimePanel = memo(DeepTimePanelBase);
