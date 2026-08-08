import { X, ExternalLink, ShieldCheck, ShieldOff, MapPin, Server, Clock } from "lucide-react";
import type { GhostRecord } from "./types";

interface Props {
  record: GhostRecord;
  onClose: () => void;
}

const Row = ({ k, v }: { k: string; v: string | number | null | undefined }) => (
  <div className="flex items-start gap-3 py-1.5 border-b border-border/10 last:border-0">
    <span className="w-36 shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground/50">{k}</span>
    <span className="flex-1 font-mono text-[11px] text-foreground/85 break-all">
      {v === null || v === undefined || v === "" ? <span className="text-muted-foreground/35">not embedded</span> : String(v)}
    </span>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-5">
    <h4 className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/45">{title}</h4>
    <div className="rounded-lg border border-border/15 bg-foreground/[0.02] px-3 py-1">{children}</div>
  </div>
);

/**
 * The shell drawer. Deliberately shows metadata only — the Asherin Engine never
 * retrieves or renders page content, so there is nothing to sanitize here.
 */
const GhostRecordPanel = ({ record: r, onClose }: Props) => {
  const bytes = r.file_size_bytes ? `${(r.file_size_bytes / 1024).toFixed(1)} KB` : null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-background/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Metadata shell"
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border/20 bg-card/95 shadow-2xl backdrop-blur-xl sm:max-w-xl"
      >
        <div className="flex items-center justify-between border-b border-border/15 px-4 py-3">
          <div className="mr-3 min-w-0 flex-1">
            <h3 className="truncate text-sm font-normal text-foreground">{r.host || "unresolved host"}</h3>
            <p className="truncate font-mono text-[10px] text-muted-foreground/40">{r.url}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={r.url} target="_blank" rel="noopener noreferrer"
              className="rounded-lg p-2 text-muted-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground"
              aria-label="Open target in a new tab"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground"
              aria-label="Close metadata shell"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-b border-border/10 px-4 py-2 text-[10px] text-muted-foreground/55">
          <span className="flex items-center gap-1"><Server className="h-3 w-3" />{r.status ?? "unreachable"}</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{r.response_ms ?? "?"} ms</span>
          <span>{r.source_type}</span>
          {bytes && <span>{bytes}</span>}
          <span className="flex items-center gap-1">
            {r.tls ? <ShieldCheck className="h-3 w-3" /> : <ShieldOff className="h-3 w-3" />}
            {r.tls ? "TLS" : "plaintext"}
          </span>
          {r.geo_source === "exif" && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />EXIF GPS</span>}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <Section title="Container shell">
            <Row k="Author" v={r.author} />
            <Row k="Device" v={r.device_id} />
            <Row k="Software" v={r.software} />
            <Row k="Created" v={r.created_at} />
            <Row k="Modified" v={r.modified_at} />
            <Row k="Coordinate" v={r.geo_lat != null ? `${r.geo_lat.toFixed(5)}, ${r.geo_lng?.toFixed(5)} (${r.geo_source})` : null} />
            <Row k="Locality" v={r.geo_label} />
          </Section>

          <Section title="Origin & routing">
            <Row k="Origin IP" v={r.network_origin_ip} />
            <Row k="ASN" v={r.asn} />
            <Row k="Server" v={r.server} />
            <Row k="HSTS" v={r.hsts ? "asserted" : "absent"} />
            <Row k="CSP" v={r.csp ? "asserted" : "absent"} />
            <Row k="Redirects" v={r.redirect_chain.length ? r.redirect_chain.join(" → ") : null} />
          </Section>

          <Section title="DNS posture">
            <Row k="A records" v={r.dns.a.join(", ")} />
            <Row k="Name servers" v={r.dns.ns.join(", ")} />
            <Row k="Mail exchangers" v={r.dns.mx.join(", ")} />
            <Row k="SPF" v={r.dns.txt_spf} />
          </Section>

          {Object.keys(r.container).length > 0 && (
            <Section title="Raw container fields">
              {Object.entries(r.container).map(([k, v]) => <Row key={k} k={k} v={v} />)}
            </Section>
          )}

          <Section title="Response headers">
            {Object.keys(r.headers).length === 0
              ? <Row k="headers" v={null} />
              : Object.entries(r.headers).map(([k, v]) => <Row key={k} k={k} v={v} />)}
          </Section>

          {r.errors.length > 0 && (
            <Section title="Probe notes">
              {r.errors.map((e, i) => <Row key={i} k={`note ${i + 1}`} v={e} />)}
            </Section>
          )}

          <p className="mt-4 text-[10px] leading-relaxed text-muted-foreground/40">
            Asherin Engine reads the shell only. No page body, image pixels, or document text was retrieved,
            stored, or interpreted to produce this record.
          </p>
        </div>
      </div>
    </>
  );
};

export default GhostRecordPanel;
