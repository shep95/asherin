// ─────────────────────────────────────────────────────────────────────────────
// ORIGIN PANEL — the provenance dossier for a single artefact.
//
// Three clocks are shown side by side and never merged: the wall clock the
// authoring machine wrote, the absolute UTC instant it maps to, and the same
// instant rendered in the reader's own zone. Conflating those is how a "3 a.m.
// document" becomes a lunchtime one and the entire read is lost.
// ─────────────────────────────────────────────────────────────────────────────

import { memo } from "react";
import {
  Clock, Fingerprint, Globe2, MapPin, Server, ShieldAlert, Wrench, FileWarning, ExternalLink,
  Paperclip, Radar,
} from "lucide-react";


export interface OriginTimestamp {
  field: string;
  local: string | null;
  utc: string | null;
  offsetMinutes: number | null;
  offsetLabel: string | null;
  raw: string;
}

export interface OriginClaim {
  label: string;
  value: string;
  evidence: string;
  confidence: "confirmed" | "strong" | "probable" | "weak";
}

export interface OriginPlace {
  kind: "capture" | "authoring-zone" | "serving-origin" | "stated";
  label: string;
  detail: string | null;
  lat: number | null;
  lng: number | null;
  building: string | null;
  street: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postcode: string | null;
  source: string;
  confidence: OriginClaim["confidence"];
}

export interface OriginTrace {
  url: string;
  final_url: string;
  host: string;
  status: number | null;
  content_type: string;
  kind: "pdf" | "image" | "html" | "office" | "other";
  bytes: number | null;
  sha256: string | null;
  redirect_chain: string[];
  fetched_at: string;
  created: OriginTimestamp | null;
  modified: OriginTimestamp | null;
  timestamps: OriginTimestamp[];
  zone_candidates: string[];
  work_pattern: string | null;
  places: OriginPlace[];
  claims: OriginClaim[];
  toolchain: { producer: string | null; creator: string | null; device: string | null; os: string | null };
  identity: { author: string | null; company: string | null; title: string | null; subject: string | null; keywords: string | null };
  lineage: { document_id: string | null; instance_id: string | null; original_document_id: string | null; edit_span_minutes: number | null; revisions: string[] };
  serving: { server: string | null; powered_by: string | null; last_modified: string | null; cdn_pop: string | null; ip: string | null; asn: string | null; ip_place: string | null };
  selectors?: {
    emails: string[]; phones: string[]; urls: string[]; hosts: string[];
    handles: string[]; people: string[]; places: string[]; ids: string[];
  };
  upload?: { filename: string; declared_type: string } | null;
  raw_fields: Record<string, string>;
  scrubbed: boolean;
  notes: string[];
  errors: string[];
  elapsed_ms: number;
}


const CONF: Record<OriginClaim["confidence"], string> = {
  confirmed: "border-foreground/40 text-foreground/85",
  strong: "border-border/35 text-foreground/75",
  probable: "border-border/25 text-muted-foreground/70",
  weak: "border-border/15 text-muted-foreground/55",
};

const PLACE_TITLE: Record<OriginPlace["kind"], string> = {
  capture: "Capture point — where the sensor stood",
  "authoring-zone": "Authoring zone — the machine's configured offset",
  stated: "Stated address — printed inside the document",
  "serving-origin": "Serving origin — where the copy is hosted, not authored",
};

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border/15 bg-foreground/[0.02] p-4">
      <h3 className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-muted-foreground/60">
        {icon} {title}
      </h3>
      {children}
    </section>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-border/10 py-1.5 last:border-0">
      <span className="w-40 shrink-0 text-[11px] text-muted-foreground/50">{k}</span>
      <span className="min-w-0 flex-1 break-words text-[12px] text-foreground/85">{v}</span>
    </div>
  );
}

/** The same instant, three ways. */
function Clocks({ s }: { s: OriginTimestamp }) {
  const viewer = s.utc
    ? new Date(s.utc).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "medium" })
    : null;
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/45">Author's wall clock</p>
        <p className="text-[13px] text-foreground">{s.local ?? "—"}</p>
        <p className="text-[10px] text-muted-foreground/45">{s.offsetLabel ? `offset ${s.offsetLabel}` : "no zone recorded"}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/45">Absolute (UTC)</p>
        <p className="text-[13px] text-foreground/85">{s.utc ? s.utc.replace("T", " ").replace(".000Z", "Z") : "unresolvable"}</p>
        <p className="text-[10px] text-muted-foreground/45">{s.field}</p>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/45">Your local time</p>
        <p className="text-[13px] text-foreground/85">{viewer ?? "—"}</p>
        <p className="text-[10px] text-muted-foreground/45">{zone}</p>
      </div>
    </div>
  );
}
/**
 * Every pivotable string the artefact gave up. A document is rarely the answer;
 * it is the list of the next five questions, and each chip fires one of them
 * straight back into the engine rather than making the operator retype it.
 */
function SelectorHarvest({ trace, onPivot }: { trace: OriginTrace; onPivot?: (s: string) => void }) {
  const s = trace.selectors;
  if (!s) return null;
  const groups: Array<[string, string[]]> = [
    ["Email addresses", s.emails],
    ["Phone numbers", s.phones],
    ["People named", s.people],
    ["Hosts", s.hosts],
    ["Handles", s.handles],
    ["Addresses", s.places],
    ["Reference numbers", s.ids],
    ["Links", s.urls],
  ];
  const live = groups.filter(([, v]) => v.length > 0);
  if (!live.length) return null;

  return (
    <Section icon={<Radar className="h-3.5 w-3.5" />} title="Selectors carved out of the file">
      <div className="space-y-3">
        {live.map(([label, values]) => (
          <div key={label}>
            <p className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/45">
              {label} · {values.length}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {values.slice(0, 24).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onPivot?.(v)}
                  disabled={!onPivot}
                  title={onPivot ? `Intercept ${v}` : v}
                  className="max-w-full truncate rounded-full border border-border/20 px-2.5 py-1 text-[11px] text-muted-foreground/75 transition-colors hover:border-foreground/35 hover:text-foreground disabled:cursor-default disabled:hover:border-border/20 disabled:hover:text-muted-foreground/75"
                >
                  {v}
                </button>
              ))}
              {values.length > 24 && (
                <span className="self-center text-[10px] text-muted-foreground/40">+{values.length - 24} more</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}


function OriginPanelBase({ trace, onPivot }: { trace: OriginTrace; onPivot?: (selector: string) => void }) {
  const raw = Object.entries(trace.raw_fields);
  const uploaded = !!trace.upload;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-lg border border-border/20 bg-foreground/[0.03] p-4">
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/55">
          <span className="rounded border border-border/25 px-1.5 py-0.5">{trace.kind}</span>
          {uploaded && <span className="rounded border border-foreground/30 px-1.5 py-0.5 text-foreground/70">Uploaded</span>}
          {!uploaded && trace.status != null && <span>HTTP {trace.status}</span>}
          {trace.content_type && <span>{trace.content_type}</span>}
          {trace.bytes != null && <span>{(trace.bytes / 1024).toFixed(0)} KB</span>}
          <span className="ml-auto normal-case tracking-normal">{trace.elapsed_ms} ms</span>
        </div>
        {uploaded ? (
          <p className="mt-2 flex items-center gap-1.5 break-all text-[12.5px] text-foreground/85">
            <Paperclip className="h-3 w-3 shrink-0 opacity-50" /> {trace.upload!.filename}
          </p>
        ) : (
          <a
            href={trace.final_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-2 flex items-center gap-1.5 break-all text-[12.5px] text-foreground/85 hover:underline"
          >
            {trace.final_url} <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
          </a>
        )}
        {trace.redirect_chain.length > 0 && (
          <p className="mt-1 text-[11px] text-muted-foreground/55">
            {trace.redirect_chain.length} redirect{trace.redirect_chain.length === 1 ? "" : "s"} traversed before the bytes were served.
          </p>
        )}
        {trace.sha256 && (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground/40">sha256 {trace.sha256.slice(0, 32)}…</p>
        )}
      </div>


      {trace.errors.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-border/25 bg-foreground/[0.04] p-3 text-[11.5px] text-muted-foreground/75">
          <FileWarning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>{trace.errors.map((e, i) => <p key={i}>{e}</p>)}</div>
        </div>
      )}

      {trace.scrubbed && (
        <div className="flex items-start gap-2 rounded-lg border border-foreground/30 bg-foreground/[0.06] p-3 text-[11.5px] text-foreground/85">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Metadata scrubbed — no creation date, no toolchain, no author survived in this container.</span>
        </div>
      )}

      {/* Verdict */}
      {trace.claims.length > 0 && (
        <Section icon={<Fingerprint className="h-3.5 w-3.5" />} title="Reconstruction">
          <ul className="space-y-2">
            {trace.claims.map((c, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="w-36 shrink-0 text-[11px] text-muted-foreground/50">{c.label}</span>
                <span className="min-w-0 flex-1 text-[12.5px] text-foreground/90">{c.value}</span>
                <span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] ${CONF[c.confidence]}`}>
                  {c.confidence}
                </span>
                <span className="w-full pl-36 text-[10px] text-muted-foreground/40">{c.evidence}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Time */}
      {(trace.created || trace.modified) && (
        <Section icon={<Clock className="h-3.5 w-3.5" />} title="Creation clock">
          {trace.created && <Clocks s={trace.created} />}
          {trace.work_pattern && (
            <p className="mt-3 text-[11.5px] text-muted-foreground/70">Written during {trace.work_pattern}.</p>
          )}
          {trace.modified && (
            <div className="mt-4 border-t border-border/10 pt-3">
              <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/45">Last save</p>
              <Clocks s={trace.modified} />
            </div>
          )}
          {trace.timestamps.length > 2 && (
            <div className="mt-4 border-t border-border/10 pt-3">
              {trace.timestamps.map((s, i) => (
                <Row key={i} k={s.field} v={`${s.local ?? s.utc ?? s.raw}${s.offsetLabel ? ` ${s.offsetLabel}` : ""}`} />
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Geography */}
      {trace.places.length > 0 && (
        <Section icon={<MapPin className="h-3.5 w-3.5" />} title="Geography">
          <ul className="space-y-3">
            {trace.places.map((p, i) => (
              <li key={i}>
                <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/45">
                  {p.kind === "authoring-zone" ? <Globe2 className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                  {PLACE_TITLE[p.kind]}
                </p>
                <p className="mt-0.5 text-[13px] text-foreground/90">{p.label}</p>
                {p.detail && <p className="text-[11.5px] leading-relaxed text-muted-foreground/65">{p.detail}</p>}
                {(p.building || p.street || p.city || p.postcode) && (
                  <p className="mt-0.5 text-[11.5px] text-foreground/70">
                    {[p.building, p.street, p.city, p.region, p.postcode, p.country].filter(Boolean).join(" · ")}
                  </p>
                )}
                {p.lat != null && p.lng != null && (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=18/${p.lat}/${p.lng}`}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-foreground/70 hover:underline"
                  >
                    {p.lat.toFixed(5)}, {p.lng.toFixed(5)} <ExternalLink className="h-3 w-3 opacity-50" />
                  </a>
                )}
                <p className="text-[10px] text-muted-foreground/40">{p.source} · {p.confidence}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Toolchain + lineage */}
      <Section icon={<Wrench className="h-3.5 w-3.5" />} title="Toolchain and lineage">
        <Row k="Creator" v={trace.toolchain.creator ?? "—"} />
        <Row k="Producer" v={trace.toolchain.producer ?? "—"} />
        {trace.toolchain.device && <Row k="Hardware" v={trace.toolchain.device} />}
        <Row k="Author" v={trace.identity.author ?? "—"} />
        {trace.identity.company && <Row k="Organisation" v={trace.identity.company} />}
        {trace.identity.title && <Row k="Title" v={trace.identity.title} />}
        {trace.lineage.document_id && <Row k="Document ID" v={<span className="font-mono text-[11px]">{trace.lineage.document_id}</span>} />}
        {trace.lineage.instance_id && <Row k="Instance ID" v={<span className="font-mono text-[11px]">{trace.lineage.instance_id}</span>} />}
        {trace.lineage.original_document_id && (
          <Row k="Original document" v={<span className="font-mono text-[11px]">{trace.lineage.original_document_id}</span>} />
        )}
        {trace.lineage.revisions.length > 0 && <Row k="Recorded edits" v={trace.lineage.revisions.join(", ")} />}
      </Section>

      {/* Selectors carved out of the artefact — each one is a next search. */}
      <SelectorHarvest trace={trace} onPivot={onPivot} />

      {/* Hosting. An uploaded file was never served to anyone, so there is no
          infrastructure to report and the panel says so rather than showing
          a column of em-dashes that reads like a failed lookup. */}
      {!uploaded && (
        <Section icon={<Server className="h-3.5 w-3.5" />} title="Serving infrastructure">
          <Row k="Host" v={trace.host || "—"} />
          <Row k="Resolved IP" v={trace.serving.ip ?? "—"} />
          <Row k="Network" v={trace.serving.asn ?? "—"} />
          <Row k="Hosting geography" v={trace.serving.ip_place ?? "—"} />
          {trace.serving.server && <Row k="Server" v={trace.serving.server} />}
          {trace.serving.cdn_pop && <Row k="Edge / POP" v={trace.serving.cdn_pop} />}
          {trace.serving.last_modified && <Row k="Last-Modified" v={trace.serving.last_modified} />}
        </Section>
      )}


      {trace.notes.length > 0 && (
        <ul className="space-y-1.5 rounded-lg border border-border/15 p-3">
          {trace.notes.map((n, i) => (
            <li key={i} className="text-[11.5px] leading-relaxed text-muted-foreground/65">— {n}</li>
          ))}
        </ul>
      )}

      {raw.length > 0 && (
        <details className="rounded-lg border border-border/15 p-3">
          <summary className="cursor-pointer text-[11px] uppercase tracking-[0.14em] text-muted-foreground/55">
            Raw fields ({raw.length})
          </summary>
          <div className="mt-3">
            {raw.map(([k, v]) => (
              <Row key={k} k={k} v={<span className="font-mono text-[11px]">{v}</span>} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export const OriginPanel = memo(OriginPanelBase);
