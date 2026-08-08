// ─────────────────────────────────────────────────────────────────────────────
// DEEP TIME PANEL — the archived web, 1996 → today.
//
// The intercept surface answers "what is being served about this right now".
// This one answers "what was ever served, and when did it stop". Every row on
// the era ladder is backed by a dated capture the operator can open; nothing is
// interpolated between years, because a gap in the archive is itself evidence.
// ─────────────────────────────────────────────────────────────────────────────

import { memo, useMemo, useState } from "react";
import { Clock, ExternalLink, Library, Radar, Ghost, Skull } from "lucide-react";

export interface TimeCapture {
  url: string;
  wayback_url: string;
  timestamp: string;
  year: number;
  status: string;
  mime: string;
  digest: string;
  source: "wayback" | "commoncrawl";
}

export interface TimeEra {
  year: number;
  captures: number;
  hosts: string[];
  sample_url: string | null;
  sample_wayback: string | null;
}

export interface TimeMachineReport {
  selector: string;
  kind: string;
  window: { from: number; to: number };
  earliest: TimeCapture | null;
  latest: TimeCapture | null;
  eras: TimeEra[];
  captures: TimeCapture[];
  archive_items: Array<{
    id: string; title: string; creator: string; date: string;
    mediatype: string; url: string; excerpt: string;
  }>;
  hosts_probed: string[];
  dead_hosts: string[];
  corpora: Array<{ name: string; ok: boolean; records: number; note: string | null }>;
  elapsed_ms: number;
}

const fmtDate = (iso: string) => iso.slice(0, 10);

function DeepTimePanelBase({ report }: { report: TimeMachineReport }) {
  const [openYear, setOpenYear] = useState<number | null>(null);

  const peak = useMemo(
    () => report.eras.reduce((m, e) => Math.max(m, e.captures), 1),
    [report.eras],
  );

  const byYear = useMemo(() => {
    const m = new Map<number, TimeCapture[]>();
    for (const c of report.captures) {
      const list = m.get(c.year);
      if (list) list.push(c); else m.set(c.year, [c]);
    }
    return m;
  }, [report.captures]);

  const span = report.earliest && report.latest
    ? report.latest.year - report.earliest.year
    : 0;

  const empty = !report.eras.length && !report.archive_items.length;

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
            First archived trace <span className="text-foreground/90">{fmtDate(report.earliest.timestamp)}</span>
            {span > 0 && <> · a {span}-year presence through {report.latest?.year}</> }
            {" "}· {report.captures.length} dated capture{report.captures.length === 1 ? "" : "s"} across {report.eras.length} year{report.eras.length === 1 ? "" : "s"}.
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-muted-foreground/65">
            No capture index holds a dated record for this selector.
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
            {report.dead_hosts.join(", ")} answer{report.dead_hosts.length === 1 ? "s" : ""} nothing today but
            {" "}exist{report.dead_hosts.length === 1 ? "s" : ""} in the archive. The live web has forgotten this; the captures have not.
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
                        <li key={`${c.timestamp}-${c.url}`}>
                          <a
                            href={c.wayback_url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="flex items-baseline gap-2 py-0.5 text-[11.5px] text-muted-foreground/70 hover:text-foreground"
                          >
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground/45">{fmtDate(c.timestamp)}</span>
                            <span className="min-w-0 flex-1 truncate">{c.url}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-40" />
                          </a>
                        </li>
                      ))}
                      {rows.length > 40 && (
                        <li className="text-[10px] text-muted-foreground/40">+{rows.length - 40} more captures this year</li>
                      )}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Full-text corpora */}
      {report.archive_items.length > 0 && (
        <section className="rounded-lg border border-border/15 bg-foreground/[0.02] p-4">
          <h3 className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">
            <Library className="h-3.5 w-3.5" /> Full-text record · {report.archive_items.length}
          </h3>
          <ul className="space-y-3">
            {report.archive_items.map((it) => (
              <li key={it.id}>
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-[12.5px] text-foreground/85 hover:underline"
                >
                  {it.title || it.id}
                </a>
                <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground/45">
                  {[it.mediatype, it.creator, it.date?.slice(0, 10)].filter(Boolean).join(" · ")}
                </p>
                {it.excerpt && (
                  <p className="mt-1 line-clamp-3 text-[11.5px] leading-relaxed text-muted-foreground/65">{it.excerpt}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {report.hosts_probed.length > 0 && (
        <p className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground/45">
          <Radar className="h-3 w-3" /> Capture indexes queried for: {report.hosts_probed.join(", ")}
        </p>
      )}

      {empty && (
        <div className="rounded-lg border border-border/15 p-6 text-center">
          <Ghost className="mx-auto mb-3 h-7 w-7 text-foreground/20" />
          <p className="text-[12.5px] text-muted-foreground/70">
            The archives hold nothing dated for this selector.
          </p>
          <p className="mx-auto mt-2 max-w-lg text-[11.5px] leading-relaxed text-muted-foreground/45">
            Capture indexes are keyed by URL, not by person. A name reaches them only through the full-text corpora
            or through a host already tied to it — run an intercept first, then come back and the hosts it found will
            be carried into the reach-back.
          </p>
        </div>
      )}
    </div>
  );
}

export const DeepTimePanel = memo(DeepTimePanelBase);
