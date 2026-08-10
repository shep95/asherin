import { memo, useMemo, useState } from "react";
import { Copy, Check, ShieldAlert, ShieldCheck, Fingerprint, ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// ─────────────────────────────────────────────────────────────────────────────
// ARTIFACT LEDGER — what the compiler and the signer actually did.
//
// ORIGIN answers "who wrote this" from container metadata, which a scrubber can
// erase. The ledger answers a question metadata cannot reach: is this the same
// artifact as last time, and did its defences change. Everything on this panel
// is measured from the bytes — nothing here is inferred, and the copy says so,
// because "no signature" is a fact while "unsafe" would be a guess.
// ─────────────────────────────────────────────────────────────────────────────

export interface ArtifactDrift {
  field: string;
  before: string;
  after: string;
  severity: "info" | "notice" | "alarm";
  reading: string;
}

export interface ArtifactReport {
  filename: string;
  declared_type: string;
  size_bytes: number;
  kind: string;
  format: string;
  arch: string | null;
  sha256: string;
  sha1: string;
  build_time: string | null;
  signed: "yes" | "no" | "unknown";
  signature_note: string;
  pdb_path: string | null;
  mitigations: Record<string, string>;
  banned_symbols: { symbol: string; evidence: string }[];
  posture_score: number | null;
  posture_basis: string;
  observations: { label: string; detail: string; weight: "high" | "medium" | "low" }[];
  errors: string[];
}

export interface LedgerResult {
  report: ArtifactReport;
  drift: ArtifactDrift[];
  previous: { sha256: string; last_seen: string; posture_score: number | null } | null;
  seen_count: number;
  persisted: boolean;
  note?: string;
}

const SEVERITY_RING: Record<ArtifactDrift["severity"], string> = {
  alarm: "border-foreground/40 bg-foreground/[0.07]",
  notice: "border-foreground/25 bg-foreground/[0.04]",
  info: "border-border/25",
};

function CopyChip({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          window.setTimeout(() => setDone(false), 1400);
        } catch {
          toast({ title: "Clipboard unavailable", description: "Select the value and copy it manually." });
        }
      }}
      aria-label={`Copy ${label}`}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground/60 transition-colors hover:bg-foreground/[0.06] hover:text-foreground/80 focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground/40"
    >
      {done ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-xs">
      <span className="w-32 shrink-0 font-light uppercase tracking-wide text-muted-foreground/45">{k}</span>
      <span className="min-w-0 flex-1 break-all font-light text-foreground/85">{children}</span>
    </div>
  );
}

export const ArtifactLedgerPanel = memo(function ArtifactLedgerPanel({ result }: { result: LedgerResult }) {
  const { report: r, drift, previous, seen_count, persisted, note } = result;
  const [openSymbols, setOpenSymbols] = useState(false);

  const mitigations = useMemo(() => Object.entries(r.mitigations), [r.mitigations]);
  const scoreable = r.posture_score !== null;

  return (
    <section aria-labelledby="artifact-ledger-heading" className="mt-6 rounded-xl border border-border/20 bg-background/40 p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="artifact-ledger-heading" className="flex items-center gap-2 text-sm font-light tracking-wide text-foreground/90">
            <Fingerprint className="h-4 w-4 text-foreground/40" aria-hidden />
            Artifact ledger
          </h3>
          <p className="mt-1 text-[11px] font-light leading-relaxed text-muted-foreground/55">
            Measured from the bytes, not from the file name. Presence of a signature is not proof of safety, and its
            absence is not proof of harm — both are recorded as facts, nothing more.
          </p>
        </div>
        {scoreable && (
          <div className="shrink-0 text-right">
            <div className="text-2xl font-extralight tabular-nums text-foreground/90">{r.posture_score}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground/45">posture / 100</div>
          </div>
        )}
      </header>

      {drift.length > 0 && (
        <div className="mt-4 space-y-2" role="status" aria-live="polite">
          {drift.map((d, i) => (
            <div key={`${d.field}-${i}`} className={`rounded-lg border px-3 py-2 ${SEVERITY_RING[d.severity]}`}>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground/60">
                {d.severity === "info" ? <ShieldCheck className="h-3 w-3" aria-hidden /> : <ShieldAlert className="h-3 w-3" aria-hidden />}
                {d.severity} · {d.field.replace(/_/g, " ")}
              </div>
              <p className="mt-1 text-xs font-light leading-relaxed text-foreground/85">{d.reading}</p>
              <p className="mt-1 text-[11px] font-light text-muted-foreground/50">
                before <span className="text-foreground/60">{d.before}</span> → after <span className="text-foreground/60">{d.after}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 divide-y divide-border/10">
        <Row k="Format">
          {r.format}{r.arch ? ` · ${r.arch}` : ""} · {r.size_bytes.toLocaleString()} bytes
        </Row>
        <Row k="SHA-256">
          <span className="font-mono text-[11px]">{r.sha256}</span> <CopyChip value={r.sha256} label="SHA-256" />
        </Row>
        <Row k="SHA-1">
          <span className="font-mono text-[11px]">{r.sha1}</span> <CopyChip value={r.sha1} label="SHA-1" />
        </Row>
        {r.build_time && <Row k="Build stamp">{r.build_time} <span className="text-muted-foreground/45">(compiler, not filesystem)</span></Row>}
        <Row k="Signature">
          {r.signed}
          <span className="ml-1 text-muted-foreground/50">— {r.signature_note}</span>
        </Row>
        {r.pdb_path && (
          <Row k="Build path leak">
            <span className="font-mono text-[11px]">{r.pdb_path}</span> <CopyChip value={r.pdb_path} label="build path" />
          </Row>
        )}
        {mitigations.length > 0 && (
          <Row k="Mitigations">
            <span className="flex flex-wrap gap-1.5">
              {mitigations.map(([k, v]) => (
                <span
                  key={k}
                  className={`rounded border px-1.5 py-0.5 text-[10px] ${
                    v === "on" ? "border-foreground/25 text-foreground/80"
                      : v === "off" ? "border-foreground/40 bg-foreground/[0.07] text-foreground/90"
                      : "border-border/20 text-muted-foreground/50"
                  }`}
                >
                  {k.replace(/_/g, " ")} {v}
                </span>
              ))}
            </span>
          </Row>
        )}
        <Row k="Posture basis">{r.posture_basis}</Row>
        <Row k="History">
          {persisted
            ? `Seen ${seen_count} time${seen_count === 1 ? "" : "s"}${previous ? ` · a different build of this name was last seen ${new Date(previous.last_seen).toLocaleString()}` : " · first build recorded under this name"}`
            : (note ?? "Not recorded.")}
        </Row>
      </div>

      {r.banned_symbols.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setOpenSymbols((v) => !v)}
            aria-expanded={openSymbols}
            className="flex w-full items-center justify-between rounded-lg border border-border/20 px-3 py-2 text-left text-xs font-light text-foreground/80 transition-colors hover:bg-foreground/[0.03]"
          >
            <span>{r.banned_symbols.length} banned-API symbol{r.banned_symbols.length === 1 ? "" : "s"} linked</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSymbols ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {openSymbols && (
            <div className="mt-2 rounded-lg border border-border/15 p-3">
              <p className="text-[11px] font-light leading-relaxed text-muted-foreground/55">
                Linkage proves the function is imported. It does not prove the call is reachable, nor that it is used
                unsafely — treat this as an attack-surface indicator to review, not a defect.
              </p>
              <ul className="mt-2 space-y-1">
                {r.banned_symbols.map((b) => (
                  <li key={b.symbol} className="flex justify-between gap-3 text-[11px] font-light">
                    <span className="font-mono text-foreground/85">{b.symbol}</span>
                    <span className="text-muted-foreground/45">{b.evidence}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {r.observations.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {r.observations.map((o, i) => (
            <li key={i} className="text-[11px] font-light leading-relaxed text-muted-foreground/60">
              <span className="text-foreground/75">{o.label}</span> — {o.detail}
            </li>
          ))}
        </ul>
      )}

      {r.errors.length > 0 && (
        <p className="mt-3 text-[11px] font-light text-muted-foreground/50">
          Partial read: {r.errors.join(" · ")}
        </p>
      )}
    </section>
  );
});
