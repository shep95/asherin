// ═══════════════════════════════════════════════════════════════════════════
// INTELLIGENCE DOSSIER — the destination an alert email actually points at.
//
// Before this page existed, the "open the full dossier" link dropped the reader
// on the dashboard shell and made them hunt for the thing they were told about.
// A report link must resolve to the report. This route renders one dossier,
// print-clean, on any device, and layers a facial corroboration panel on top so
// the identity claim is checkable rather than merely asserted.
//
// Access model: the row is fetched with the reader's own session, so row-level
// security is the gate. A leaked link is inert to anyone but the owner.
// ═══════════════════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Fingerprint,
  Loader2,
  Printer,
  RefreshCw,
  ShieldAlert,
  UserSearch,
} from "lucide-react";

interface Section {
  label: string;
  value: string;
}

interface Dossier {
  id: string;
  kind: string;
  severity: "info" | "notable" | "critical" | string;
  title: string;
  body: string;
  subject_name: string | null;
  source: string | null;
  url: string | null;
  sections: Section[];
  findings: string[];
  channels_delivered: string[];
  created_at: string;
}

interface Photo {
  path: string;
  url: string | null;
  sourceUrl: string;
  sourceHost: string;
  sourceTitle: string;
}

interface PhotoMatch {
  verdict: string;
  confidence: number;
  independentSources: number;
  reasoning: string;
  observations: string[];
  falsifier: string;
  assessedAt?: string;
}

const SEVERITY_LABEL: Record<string, string> = {
  info: "ROUTINE",
  notable: "ELEVATED",
  critical: "CRITICAL",
};

const VERDICT_LABEL: Record<string, string> = {
  same_person: "CORROBORATED — same individual",
  likely_same: "PROBABLE — likely the same individual",
  inconclusive: "INCONCLUSIVE — insufficient corroboration",
  conflict: "CONFLICT — frames disagree",
  unavailable: "UNAVAILABLE — comparator did not run",
};

const fmt = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.toUTCString()}`;
};

export default function IntelligenceReport() {
  const { id = "" } = useParams();
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [match, setMatch] = useState<PhotoMatch | null>(null);
  const [matching, setMatching] = useState(false);
  const [copied, setCopied] = useState(false);
  // Guards the auto-run so React 18 StrictMode's double effect cannot fire
  // two harvests (each of which spends egress and model budget).
  const autoRan = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("intel_notifications")
        .select(
          "id, kind, severity, title, body, subject_name, source, url, sections, findings, channels_delivered, created_at, photos, photo_match",
        )
        .eq("id", id)
        .maybeSingle();
      if (!alive) return;
      if (error) {
        setLoadError("This report could not be loaded.");
      } else if (!data) {
        setLoadError("This report does not exist, or it belongs to another account.");
      } else {
        const row = data as unknown as Dossier & { photos?: Photo[]; photo_match?: PhotoMatch };
        setDossier({
          ...row,
          sections: Array.isArray(row.sections) ? row.sections : [],
          findings: Array.isArray(row.findings) ? row.findings : [],
        });
        if (row.photo_match) setMatch(row.photo_match);
        // Read the row's read receipt while we are here.
        supabase
          .from("intel_notifications")
          .update({ read_at: new Date().toISOString() })
          .eq("id", id)
          .is("read_at", null)
          .then(undefined, () => {});
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const runMatch = useCallback(
    async (refresh: boolean) => {
      if (!id) return;
      setMatching(true);
      try {
        const { data, error } = await supabase.functions.invoke("intel-photo-match", {
          body: { notificationId: id, refresh },
        });
        if (error) throw error;
        setPhotos(Array.isArray(data?.photos) ? data.photos : []);
        setMatch(data?.match ?? null);
      } catch (e) {
        setMatch({
          verdict: "unavailable",
          confidence: 0,
          independentSources: 0,
          reasoning: "n/a — the corroboration service could not be reached from this session.",
          observations: [],
          falsifier: "Retry the cross-match.",
        });
      } finally {
        setMatching(false);
      }
    },
    [id],
  );

  // Auto-harvest once per dossier that names a subject: the reader opened the
  // link to see the answer, not to press another button first.
  useEffect(() => {
    if (!dossier || autoRan.current) return;
    if (!dossier.subject_name) return;
    autoRan.current = true;
    void runMatch(false);
  }, [dossier, runMatch]);

  const severityTone = useMemo(() => {
    switch (dossier?.severity) {
      case "critical":
        return "border-destructive/60 text-destructive";
      case "notable":
        return "border-foreground/40 text-foreground";
      default:
        return "border-border text-muted-foreground";
    }
  }, [dossier?.severity]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied — the URL bar still holds the link */
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-sm font-extralight tracking-[0.25em] text-muted-foreground">
          RETRIEVING DOSSIER
        </div>
      </div>
    );
  }

  if (loadError || !dossier) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md text-center">
          <ShieldAlert className="mx-auto mb-4 h-8 w-8 text-muted-foreground" strokeWidth={1} />
          <h1 className="mb-2 text-lg font-light tracking-wide text-foreground">Dossier unavailable</h1>
          <p className="mb-6 text-sm font-light leading-relaxed text-muted-foreground">{loadError}</p>
          <Button asChild variant="outline" size="sm">
            <Link to="/dashboard">Return to Asherin</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10 print:bg-white print:px-0 print:py-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .dossier-sheet { box-shadow: none !important; border: none !important; max-width: 100% !important; }
          .dossier-page { break-inside: avoid; }
          @page { margin: 16mm; }
        }
      `}</style>

      <div className="mx-auto max-w-3xl">
        <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground">
            <Link to={dossier.url || "/dashboard"}>
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back to Asherin
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={copyLink}>
              {copied ? <Check className="h-3.5 w-3.5" strokeWidth={1.5} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Button size="sm" className="gap-2" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" strokeWidth={1.5} /> Download PDF
            </Button>
          </div>
        </div>

        <article className="dossier-sheet rounded-lg border border-border bg-card/40 p-8 shadow-sm backdrop-blur-sm print:rounded-none print:bg-white">
          <header className="dossier-page mb-8 border-b border-border pb-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[10px] font-light tracking-[0.35em] text-muted-foreground">
                ASHERIN · INTELLIGENCE DOSSIER
              </span>
              <span className={`rounded-full border px-3 py-0.5 text-[10px] tracking-[0.2em] ${severityTone}`}>
                {SEVERITY_LABEL[dossier.severity] ?? dossier.severity.toUpperCase()}
              </span>
            </div>
            <h1 className="mb-3 text-2xl font-light leading-snug tracking-tight text-foreground">
              {dossier.title}
            </h1>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs font-light text-muted-foreground sm:grid-cols-4">
              <div>
                <dt className="tracking-[0.15em] text-[10px]">SUBJECT</dt>
                <dd className="text-foreground">{dossier.subject_name || "—"}</dd>
              </div>
              <div>
                <dt className="tracking-[0.15em] text-[10px]">SOURCE MODULE</dt>
                <dd className="text-foreground">{dossier.source || "Asherin"}</dd>
              </div>
              <div>
                <dt className="tracking-[0.15em] text-[10px]">CLASS</dt>
                <dd className="text-foreground uppercase">{dossier.kind}</dd>
              </div>
              <div>
                <dt className="tracking-[0.15em] text-[10px]">GENERATED</dt>
                <dd className="text-foreground">{fmt(dossier.created_at)}</dd>
              </div>
            </dl>
          </header>

          <section className="dossier-page mb-8">
            <h2 className="mb-3 text-[11px] font-light tracking-[0.25em] text-muted-foreground">ASSESSMENT</h2>
            <p className="whitespace-pre-line text-sm font-light leading-relaxed text-foreground">
              {dossier.body || "No narrative was recorded for this alert."}
            </p>
          </section>

          {dossier.sections.length > 0 && (
            <section className="dossier-page mb-8">
              <h2 className="mb-3 text-[11px] font-light tracking-[0.25em] text-muted-foreground">KEY FACTS</h2>
              <div className="overflow-hidden rounded border border-border">
                <table className="w-full text-left text-sm font-light">
                  <tbody>
                    {dossier.sections.map((s, i) => (
                      <tr key={`${s.label}-${i}`} className="border-b border-border last:border-0">
                        <th scope="row" className="w-1/3 bg-muted/30 px-4 py-2.5 align-top text-xs font-normal text-muted-foreground">
                          {s.label}
                        </th>
                        <td className="px-4 py-2.5 align-top text-foreground">{s.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {dossier.findings.length > 0 && (
            <section className="dossier-page mb-8">
              <h2 className="mb-3 text-[11px] font-light tracking-[0.25em] text-muted-foreground">FINDINGS</h2>
              <ul className="space-y-2">
                {dossier.findings.map((f, i) => (
                  <li key={i} className="flex gap-3 text-sm font-light leading-relaxed text-foreground">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── Facial corroboration ─────────────────────────────────────── */}
          <section className="dossier-page mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-[11px] font-light tracking-[0.25em] text-muted-foreground">
                <Fingerprint className="h-3.5 w-3.5" strokeWidth={1.5} /> PHOTO CROSS-MATCH
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="no-print gap-2 text-xs text-muted-foreground"
                onClick={() => runMatch(true)}
                disabled={matching || !dossier.subject_name}
              >
                {matching ? <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} /> : <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />}
                {matching ? "Harvesting" : "Re-run"}
              </Button>
            </div>

            {matching && photos.length === 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="aspect-square animate-pulse rounded border border-border bg-muted/40" />
                ))}
              </div>
            )}

            {!matching && photos.length === 0 && !match && (
              <p className="text-sm font-light text-muted-foreground">
                No corroboration has been attempted for this dossier yet.
              </p>
            )}

            {photos.length > 0 && (
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.map((p) => (
                  <figure key={p.path} className="overflow-hidden rounded border border-border">
                    {p.url ? (
                      <img
                        src={p.url}
                        alt={`Profile image attributed to ${dossier.subject_name ?? "the subject"} from ${p.sourceHost}`}
                        width={400}
                        height={400}
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square w-full items-center justify-center bg-muted/40">
                        <UserSearch className="h-5 w-5 text-muted-foreground" strokeWidth={1} />
                      </div>
                    )}
                    <figcaption className="border-t border-border px-2 py-1.5 text-[10px] font-light leading-tight text-muted-foreground">
                      <a
                        href={p.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="underline-offset-2 hover:underline"
                      >
                        {p.sourceHost}
                      </a>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}

            {match && (
              <div className="rounded border border-border bg-muted/20 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-sm font-light text-foreground">
                    {VERDICT_LABEL[match.verdict] ?? match.verdict}
                  </span>
                  <span className="text-xs font-light text-muted-foreground">
                    confidence {Math.round((match.confidence ?? 0) * 100)}% · {match.independentSources ?? 0} independent source
                    {(match.independentSources ?? 0) === 1 ? "" : "s"}
                  </span>
                </div>
                {match.reasoning && (
                  <p className="mb-2 text-sm font-light leading-relaxed text-muted-foreground">{match.reasoning}</p>
                )}
                {match.observations?.length > 0 && (
                  <ul className="mb-2 list-disc space-y-1 pl-5 text-xs font-light text-muted-foreground">
                    {match.observations.map((o, i) => (
                      <li key={i}>{o}</li>
                    ))}
                  </ul>
                )}
                {match.falsifier && (
                  <p className="text-xs font-light italic text-muted-foreground">Falsifier: {match.falsifier}</p>
                )}
              </div>
            )}
          </section>

          <footer className="dossier-page border-t border-border pt-5 text-[11px] font-light leading-relaxed text-muted-foreground">
            <p className="mb-1">
              Open sources only. Absence of a record is not evidence of absence. Photo corroboration is advisory and must
              not be treated as biometric identification.
            </p>
            <p>
              Private to your account. Not to be republished, and not to be used for any employment, tenancy, credit or
              insurance decision. Delivered via {dossier.channels_delivered?.join(", ") || "in-app"} ·{" "}
              asherin.com
            </p>
          </footer>
        </article>
      </div>
    </div>
  );
}
