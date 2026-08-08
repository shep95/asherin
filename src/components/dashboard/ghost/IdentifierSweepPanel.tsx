import { useMemo, useState } from "react";
import {
  Fingerprint, ExternalLink, ShieldAlert, FileText, Users, Code2, Landmark,
  MessagesSquare, Globe, ClipboardList, ChevronDown, AlertTriangle, Clock,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// IDENTIFIER SWEEP — the register of confirmed sightings.
//
// This panel renders proof, not links. A row exists because the engine opened
// the page and found the identifier on it; the grade says where it was found
// and the context line quotes the page. Candidates that failed confirmation
// are kept behind a disclosure so the operator can see what was rejected and
// why — a rejection is a finding too.
// ─────────────────────────────────────────────────────────────────────────────

export type SurfaceClass =
  | "paste" | "breach-index" | "people-record" | "social" | "code"
  | "document" | "registry" | "forum" | "commerce" | "web";

export type MatchGrade = "body" | "markup" | "title" | "metadata" | "url";

export interface Sighting {
  url: string;
  host: string;
  title: string;
  docClass: string;
  surfaceClass: SurfaceClass;
  grade: MatchGrade;
  forms: string[];
  occurrences: number;
  context: string;
  seenAt: string | null;
  dateBasis: string | null;
  via: string;
  corroboration: number;
  bytes: number;
}

export interface Surface {
  host: string;
  surfaceClass: SurfaceClass;
  sightings: Sighting[];
  firstSeen: string | null;
  lastSeen: string | null;
  bestGrade: MatchGrade;
}

export interface IdentifierSweepReport {
  identity: { kind: string; key: string; label: string };
  variants: string[];
  legsPlanned: number;
  leadsHarvested: number;
  opened: number;
  confirmed: number;
  surfaces: Surface[];
  unconfirmed: { url: string; host: string; title: string; reason: string }[];
  byClass: Record<string, number>;
  firstSeen: string | null;
  lastSeen: string | null;
  notes: string[];
  elapsedMs: number;
}

const CLASS_ICON: Record<SurfaceClass, React.ElementType> = {
  "breach-index": ShieldAlert,
  paste: ClipboardList,
  "people-record": Users,
  registry: Landmark,
  code: Code2,
  document: FileText,
  social: Users,
  forum: MessagesSquare,
  commerce: Globe,
  web: Globe,
};

const CLASS_LABEL: Record<SurfaceClass, string> = {
  "breach-index": "Breach index",
  paste: "Paste site",
  "people-record": "People record",
  registry: "Registry / court",
  code: "Code host",
  document: "Document",
  social: "Social platform",
  forum: "Forum",
  commerce: "Commerce",
  web: "Open web",
};

const GRADE_NOTE: Record<MatchGrade, string> = {
  body: "found in the page body",
  markup: "found in the page source — a mailto link or attribute, not visible text",
  title: "found in the page title only",
  metadata: "found in declared metadata only",
  url: "found in the address only — the page body does not carry it",
};

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : "—");

const Window = ({ first, last }: { first: string | null; last: string | null }) => {
  if (!first && !last) return <span className="text-muted-foreground/40">undated</span>;
  if (first === last) return <span>{day(first)}</span>;
  return <span>{day(first)} → {day(last)}</span>;
};

const SurfaceRow = ({ surface }: { surface: Surface }) => {
  const [open, setOpen] = useState(false);
  const Icon = CLASS_ICON[surface.surfaceClass] ?? Globe;
  const n = surface.sightings.length;

  return (
    <li className="border-b border-border/10 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-1 py-3 text-left transition-colors hover:bg-foreground/[0.02]"
      >
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground/45" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-[13px] font-normal text-foreground">{surface.host}</span>
            <span className="rounded border border-border/25 px-1.5 py-px text-[9px] uppercase tracking-[0.12em] text-muted-foreground/55">
              {CLASS_LABEL[surface.surfaceClass]}
            </span>
            <span className="text-[11px] text-muted-foreground/60">
              {n} sighting{n === 1 ? "" : "s"}
            </span>
            <span
              className="text-[10px] text-muted-foreground/45"
              title={GRADE_NOTE[surface.bestGrade]}
            >
              · {surface.bestGrade}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-[10.5px] text-muted-foreground/50">
            <Clock className="h-3 w-3 opacity-60" aria-hidden />
            <Window first={surface.firstSeen} last={surface.lastSeen} />
          </p>
        </div>
        <ChevronDown
          className={`mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul className="space-y-3 pb-3 pl-7 pr-1">
          {surface.sightings.map((s) => (
            <li key={s.url} className="border-l border-border/20 pl-3">
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-start gap-1.5 text-[12px] font-light text-foreground/85 underline-offset-2 hover:underline"
              >
                <span className="line-clamp-2">{s.title || s.url}</span>
                <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-40" aria-hidden />
              </a>
              {s.context && (
                <p className="mt-1 rounded border border-border/15 bg-foreground/[0.02] px-2 py-1.5 font-mono text-[10.5px] leading-relaxed text-muted-foreground/70">
                  {s.context}
                </p>
              )}
              <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground/45">
                <span title={GRADE_NOTE[s.grade]}>{GRADE_NOTE[s.grade]}</span>
                <span>{s.occurrences}× on page</span>
                {s.seenAt && <span title={s.dateBasis ?? undefined}>dated {day(s.seenAt)}</span>}
                {!s.seenAt && <span>no recoverable date</span>}
                <span>via {s.via}</span>
                {s.corroboration > 1 && <span>{s.corroboration} legs agreed</span>}
              </p>
              {s.forms.length > 1 && (
                <p className="mt-1 text-[10px] text-muted-foreground/40">
                  written as: {s.forms.slice(0, 4).join("  ·  ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

export const IdentifierSweepPanel = ({ report }: { report: IdentifierSweepReport }) => {
  const [showRejected, setShowRejected] = useState(false);

  const risky = useMemo(
    () => report.surfaces.filter((s) => s.surfaceClass === "breach-index" || s.surfaceClass === "paste"),
    [report.surfaces],
  );

  return (
    <div className="space-y-5">
      {/* ── Header ledger ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/20 bg-foreground/[0.02] p-4">
        <div className="flex items-center gap-2">
          <Fingerprint className="h-4 w-4 text-foreground/60" aria-hidden />
          <h2 className="text-[13px] font-normal text-foreground">{report.identity.label}</h2>
          <span className="rounded border border-border/25 px-1.5 py-px text-[9px] uppercase tracking-[0.12em] text-muted-foreground/55">
            {report.identity.kind}
          </span>
        </div>

        <p className="mt-2 text-[12px] font-light leading-relaxed text-muted-foreground/75">
          Seen on <span className="text-foreground">{report.surfaces.length}</span> surface
          {report.surfaces.length === 1 ? "" : "s"} —{" "}
          <span className="text-foreground">{report.confirmed}</span> confirmed sighting
          {report.confirmed === 1 ? "" : "s"} out of {report.opened} page
          {report.opened === 1 ? "" : "s"} opened, from {report.leadsHarvested} candidate
          {report.leadsHarvested === 1 ? "" : "s"} across {report.legsPlanned} query legs.
        </p>

        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["First seen", day(report.firstSeen)],
            ["Last seen", day(report.lastSeen)],
            ["Surfaces", String(report.surfaces.length)],
            ["Elapsed", `${(report.elapsedMs / 1000).toFixed(1)}s`],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] font-light text-muted-foreground/50">{k}</dt>
              <dd className="text-[12px] font-light text-foreground">{v}</dd>
            </div>
          ))}
        </dl>

        {Object.keys(report.byClass).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(report.byClass)
              .sort((a, b) => b[1] - a[1])
              .map(([cls, n]) => (
                <span
                  key={cls}
                  className="rounded-full border border-border/20 px-2 py-0.5 text-[10px] text-muted-foreground/60"
                >
                  {CLASS_LABEL[cls as SurfaceClass] ?? cls} · {n}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* ── Exposure callout ────────────────────────────────────────────── */}
      {risky.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-foreground/25 bg-foreground/[0.04] p-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-foreground/70" aria-hidden />
          <p className="text-[12px] font-light leading-relaxed text-foreground/85">
            The identifier is carried on {risky.length} paste or breach-index surface
            {risky.length === 1 ? "" : "s"} ({risky.map((r) => r.host).join(", ")}). Treat it as
            publicly circulated and rotate anything that used it as a recovery contact.
          </p>
        </div>
      )}

      {/* ── Surfaces ────────────────────────────────────────────────────── */}
      {report.surfaces.length > 0 ? (
        <ul className="rounded-xl border border-border/15 px-3">
          {report.surfaces.map((s) => <SurfaceRow key={s.host} surface={s} />)}
        </ul>
      ) : (
        <div className="rounded-xl border border-border/15 px-4 py-8 text-center">
          <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-foreground/20" aria-hidden />
          <p className="text-[12.5px] font-light text-muted-foreground/70">
            No confirmed sighting.
          </p>
          <p className="mx-auto mt-2 max-w-md text-[11px] leading-relaxed text-muted-foreground/45">
            The engine opened every page the index offered and did not find this identifier on any
            of them. That is a statement about the reachable public web, not proof the identifier
            is unused.
          </p>
        </div>
      )}

      {/* ── Collection notes ────────────────────────────────────────────── */}
      {report.notes.length > 0 && (
        <ul className="space-y-1">
          {report.notes.map((n) => (
            <li key={n} className="text-[10.5px] leading-relaxed text-muted-foreground/45">
              — {n}
            </li>
          ))}
        </ul>
      )}

      {/* ── Rejected candidates ─────────────────────────────────────────── */}
      {report.unconfirmed.length > 0 && (
        <div>
          <button
            onClick={() => setShowRejected((v) => !v)}
            aria-expanded={showRejected}
            className="flex items-center gap-1.5 rounded border border-border/20 px-2.5 py-1 text-[10.5px] text-muted-foreground/55 transition-colors hover:text-foreground"
          >
            <ChevronDown className={`h-3 w-3 transition-transform motion-reduce:transition-none ${showRejected ? "rotate-180" : ""}`} aria-hidden />
            {report.unconfirmed.length} candidate{report.unconfirmed.length === 1 ? "" : "s"} rejected
          </button>
          {showRejected && (
            <ul className="mt-2 space-y-1.5">
              {report.unconfirmed.map((u) => (
                <li key={u.url} className="text-[10.5px] leading-relaxed text-muted-foreground/45">
                  <span className="text-muted-foreground/65">{u.host}</span> — {u.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default IdentifierSweepPanel;
