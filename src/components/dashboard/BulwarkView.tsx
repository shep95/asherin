import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { runDeviceProbe, type DeviceReport, type ProbeVerdict } from "@/lib/bulwark/deviceProbe";
import { publishPosture, fetchFleet, forgetEndpoint, type FleetPosture } from "@/lib/bulwark/deviceMesh";
import { useAuth } from "@/contexts/AuthContext";
import { Shield, RefreshCw, AlertTriangle, Radar, Cpu, FileText, Loader2, Laptop, X } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// BULWARK — Counter-Surveillance Station
// Two halves of one question: who is watching the comms, and how legible is
// the device. Both halves are deterministic; the model only narrates.
// ═══════════════════════════════════════════════════════════════════════════

type Severity = "critical" | "high" | "elevated" | "informational";

interface Evidence { signalId: string; at: string; actor: string; label: string }
interface Finding {
  code: string; title: string; severity: Severity; reading: string;
  countermeasure: string; count: number; firstSeen: string; lastSeen: string;
  evidence: Evidence[];
}
interface CommsReport {
  scanned: number; score: number; posture: string;
  findings: Finding[]; assessment: string | null; note?: string; generatedAt: string;
}

const SEV_RING: Record<Severity, string> = {
  critical: "border-foreground/60",
  high: "border-foreground/40",
  elevated: "border-foreground/25",
  informational: "border-foreground/15",
};
const SEV_DOT: Record<Severity, string> = {
  critical: "bg-foreground",
  high: "bg-foreground/70",
  elevated: "bg-foreground/45",
  informational: "bg-foreground/25",
};
const VERDICT_LABEL: Record<ProbeVerdict, string> = {
  exposed: "EXPOSED", attention: "ATTENTION", hardened: "HARDENED", unknown: "UNREADABLE",
};

function Meter({ value, caption, label }: { value: number; caption: string; label: string }) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-5">
      <div className="text-[10px] uppercase tracking-[0.3em] text-foreground/40">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-light tabular-nums text-foreground">{value}</span>
        <span className="text-xs text-foreground/40">/ 100</span>
      </div>
      {/* Width-only transition keeps this on the compositor; no layout thrash. */}
      <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-foreground/60 transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${Math.max(2, value)}%` }}
        />
      </div>
      <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-foreground/60">{caption}</div>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, right }: {
  icon: React.ElementType; title: string; subtitle: string; right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 text-foreground/50" strokeWidth={1.5} />
        <div>
          <h2 className="text-sm font-medium tracking-wide text-foreground">{title}</h2>
          <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-foreground/45">{subtitle}</p>
        </div>
      </div>
      {right}
    </div>
  );
}

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-lg border border-foreground/10 bg-foreground/[0.03]" />
      ))}
    </div>
  );
}

export default function BulwarkView() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const [device, setDevice] = useState<DeviceReport | null>(null);
  const [fleet, setFleet] = useState<FleetPosture | null>(null);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [comms, setComms] = useState<CommsReport | null>(null);
  const [commsBusy, setCommsBusy] = useState(false);
  const [commsError, setCommsError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  // One motion, always: probe locally, publish this endpoint to the mesh, then
  // re-read the whole fleet. The operator sees every endpoint they own from
  // whichever one they happen to be holding.
  const scanDevice = useCallback(async () => {
    setDeviceBusy(true);
    try {
      const r = await runDeviceProbe();
      setDevice(r);
      if (userId) {
        await publishPosture(userId, r);
        setFleet(await fetchFleet(userId));
      }
    } finally { setDeviceBusy(false); }
  }, [userId]);

  const dropEndpoint = useCallback(async (id: string) => {
    if (!userId) return;
    await forgetEndpoint(userId, id);
    setFleet(await fetchFleet(userId));
  }, [userId]);

  // The device probe is local and cheap — run it on mount so the station is
  // never empty, and guard the state write against an unmount mid-probe.
  useEffect(() => {
    let alive = true;
    (async () => {
      setDeviceBusy(true);
      try {
        const r = await runDeviceProbe();
        if (!alive) return;
        setDevice(r);
        if (!userId) return;
        await publishPosture(userId, r);
        const f = await fetchFleet(userId);
        if (alive) setFleet(f);
      } finally {
        if (alive) setDeviceBusy(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const scanComms = useCallback(async () => {
    setCommsBusy(true);
    setCommsError(null);
    try {
      const { data, error } = await supabase.functions.invoke("bulwark-scan", { body: { narrative: true } });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setComms(data as CommsReport);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Scan failed";
      setCommsError(msg);
    } finally {
      setCommsBusy(false);
    }
  }, []);

  // The comms half reads a server-side ledger — it has nothing to do with the
  // endpoint in the operator's hand. Running it on mount is what makes the
  // station identical on laptop and phone instead of half-empty on whichever
  // one they picked up.
  useEffect(() => {
    if (!userId) return;
    void scanComms();
  }, [userId, scanComms]);

  const exportReport = useCallback(() => {
    const L: string[] = [
      "BULWARK — COUNTER-SURVEILLANCE ASSESSMENT",
      "#houseofasher  #zia",
      `Generated ${new Date().toISOString()}`,
      "=".repeat(64), "",
      "SECTION 1 — DEVICE LEGIBILITY (FLEET)",
      fleet && fleet.nodes.length
        ? `Fleet index: ${fleet.legibility}/100 (worst-of ${fleet.liveCount} live endpoint(s)` +
          `${fleet.staleCount ? `, ${fleet.staleCount} stale` : ""}) — weakest: ${fleet.weakest?.label ?? "n/a"}`
        : "Fleet: this endpoint only.",
      ...(fleet?.nodes ?? []).map(
        (n) => `  · ${n.label}${n.isCurrent ? " (this endpoint)" : ""}${n.stale ? " [stale]" : ""} — ${n.legibility}/100, probed ${n.scannedAt.slice(0, 10)}`,
      ),
      ...(fleet?.divergent?.length
        ? ["", "Cross-endpoint divergences (fixable — one endpoint already clean):",
           ...fleet.divergent.map((d) => `  · ${d.label}: exposed on ${d.exposedOn.join(", ")} / clean on ${d.cleanOn.join(", ")}`)]
        : []),
      "",
      "THIS ENDPOINT",
      device ? `Legibility index: ${device.legibility}/100` : "Not scanned.",
      ...(device?.checks ?? []).flatMap((c) => [
        "", `[${VERDICT_LABEL[c.verdict]}] ${c.label}`,
        `  Observed: ${c.observed}`, `  Reading: ${c.reading}`,
        c.countermeasure ? `  Countermeasure: ${c.countermeasure}` : "",
      ].filter(Boolean)),
      "", "Blind spots:", ...(device?.blindSpots ?? []).map((b) => `  - ${b}`),
      "", "=".repeat(64), "",
      "SECTION 2 — COMMUNICATIONS PRESSURE",
      comms ? `Pressure index: ${comms.score}/100 — ${comms.posture} (${comms.scanned} records scanned)` : "Not scanned.",
      ...(comms?.findings ?? []).flatMap((f) => [
        "", `[${f.severity.toUpperCase()}] ${f.code} — ${f.title}`,
        `  Occurrences: ${f.count}  (${f.firstSeen.slice(0, 10)} → ${f.lastSeen.slice(0, 10)})`,
        `  Reading: ${f.reading}`, `  Countermeasure: ${f.countermeasure}`,
        "  Evidence:", ...f.evidence.map((e) => `    - ${e.at.slice(0, 10)} ${e.actor}: ${e.label}`),
      ]),
      "", comms?.assessment ? `SECTION 3 — ANALYST ASSESSMENT\n\n${comms.assessment}` : "",
    ];
    const blob = new Blob([L.filter((l) => l !== undefined).join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bulwark-assessment-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    // Revoke on the next frame so Safari has committed the download.
    requestAnimationFrame(() => URL.revokeObjectURL(url));
  }, [device, comms, fleet]);

  // The headline number is the worst live endpoint, never the average: an
  // operator is exactly as exposed as their loudest device.
  const fleetCaption = useMemo(() => {
    const v = Math.max(fleet?.legibility ?? 0, device?.legibility ?? 0);
    if (!device && !fleet?.nodes.length) return "AWAITING PROBE";
    const scope = fleet && fleet.liveCount > 1 ? `${fleet.liveCount} ENDPOINTS` : "THIS ENDPOINT";
    if (v >= 55) return `HIGHLY IDENTIFIABLE · ${scope}`;
    if (v >= 25) return `PARTIALLY IDENTIFIABLE · ${scope}`;
    return `LOW OBSERVABILITY · ${scope}`;
  }, [device, fleet]);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.35em] text-foreground/35">
          <Shield className="h-3 w-3" strokeWidth={1.5} /> Operator Eyes Only
        </div>
        <h1 className="mt-3 text-2xl font-light tracking-wide text-foreground">BULWARK</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/50">
          Counter-surveillance station. One half measures how legible this device is to a passive
          observer; the other reads your own connected-account ledger for monitoring pressure —
          legal process, agency contact, credential probing, persistence grants, and tracking
          instrumentation. Every finding cites the record that produced it.
        </p>
      </header>

      <div className="mb-10 grid gap-4 sm:grid-cols-2">
        <Meter
          label="Fleet legibility"
          value={Math.max(fleet?.legibility ?? 0, device?.legibility ?? 0)}
          caption={fleetCaption}
        />
        <Meter label="Comms pressure" value={comms?.score ?? 0} caption={comms?.posture ?? "AWAITING SCAN"} />
      </div>

      {/* ── FLEET ────────────────────────────────────────────────────────── */}
      <section className="mb-12">
        <Section
          icon={Laptop}
          title="Endpoint mesh"
          subtitle="Every device you have signed in on publishes its own posture. This station shows all of them from whichever one you are holding — the index above is the worst live endpoint, not the average."
        />
        {!fleet?.nodes.length ? (
          <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-5 text-xs leading-relaxed text-foreground/50">
            Only this endpoint has reported so far. Open BULWARK on your phone or laptop while
            signed in to the same account and it joins the mesh automatically — no pairing step.
          </div>
        ) : (
          <div className="space-y-2">
            {fleet.nodes.map((n) => {
              const exposed = n.checks.filter((c) => c.verdict === "exposed").length;
              const attention = n.checks.filter((c) => c.verdict === "attention").length;
              return (
                <div
                  key={n.deviceId}
                  className={`flex items-start gap-3 rounded-lg border p-4 ${
                    n.stale ? "border-foreground/10 opacity-60" : "border-foreground/15"
                  } bg-foreground/[0.02]`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-sm text-foreground/90">{n.label}</span>
                      {n.isCurrent && (
                        <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/45">this endpoint</span>
                      )}
                      {n.stale && (
                        <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/40">stale · not counted</span>
                      )}
                    </span>
                    <span className="mt-1.5 block font-mono text-[11px] text-foreground/50">
                      {n.legibility}/100 · {exposed} exposed · {attention} attention · probed {n.scannedAt.slice(0, 10)}
                    </span>
                  </span>
                  {!n.isCurrent && (
                    <button
                      onClick={() => dropEndpoint(n.deviceId)}
                      aria-label={`Forget ${n.label}`}
                      className="shrink-0 rounded-md border border-foreground/15 p-1.5 text-foreground/50 transition-colors hover:bg-foreground/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground/40"
                    >
                      <X className="h-3 w-3" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              );
            })}

            {fleet.divergent.length > 0 && (
              <div className="rounded-lg border border-foreground/20 bg-foreground/[0.03] p-4">
                <div className="text-[10px] uppercase tracking-[0.3em] text-foreground/35">Cross-endpoint divergence</div>
                <p className="mt-2 text-xs leading-relaxed text-foreground/50">
                  These surfaces are exposed on one device and already clean on another — proof the
                  fix is available to you, and where to copy it from.
                </p>
                <ul className="mt-3 space-y-1.5">
                  {fleet.divergent.map((d) => (
                    <li key={d.id} className="text-xs leading-relaxed text-foreground/65">
                      ◈ <span className="text-foreground/85">{d.label}</span> — exposed on{" "}
                      {d.exposedOn.join(", ")} · clean on {d.cleanOn.join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── DEVICE ───────────────────────────────────────────────────────── */}
      <section className="mb-12">
        <Section
          icon={Cpu}
          title="Device posture"
          subtitle="Measured in this tab. Only the verdicts are mirrored to your own mesh so your other devices can see this endpoint — no fingerprint hashes leave the browser."
          right={
            <button
              onClick={scanDevice}
              disabled={deviceBusy}
              className="inline-flex items-center gap-2 rounded-md border border-foreground/15 px-3 py-1.5 text-xs text-foreground/70 transition-colors hover:bg-foreground/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground/40 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${deviceBusy ? "animate-spin" : ""}`} strokeWidth={1.5} />
              {deviceBusy ? "Probing" : "Re-probe"}
            </button>
          }
        />
        {deviceBusy && !device ? <Skeleton rows={4} /> : (
          <div className="space-y-2">
            {device?.checks.map((c) => (
              <div key={c.id} className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground/85">{c.label}</span>
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.2em] text-foreground/45">
                    {VERDICT_LABEL[c.verdict]}
                  </span>
                </div>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-foreground/50">{c.observed}</p>
                <p className="mt-2 text-xs leading-relaxed text-foreground/60">{c.reading}</p>
                {c.countermeasure && (
                  <p className="mt-2 border-l border-foreground/20 pl-3 text-xs leading-relaxed text-foreground/45">
                    {c.countermeasure}
                  </p>
                )}
              </div>
            ))}
            {device && (
              <details className="rounded-lg border border-foreground/10 bg-foreground/[0.01] p-4">
                <summary className="cursor-pointer text-xs text-foreground/50">What this probe cannot see</summary>
                <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-foreground/45">
                  {device.blindSpots.map((b) => <li key={b}>◈ {b}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      {/* ── COMMS ────────────────────────────────────────────────────────── */}
      <section className="mb-12">
        <Section
          icon={Radar}
          title="Communications pressure"
          subtitle="Deterministic detectors over your own connected-account ledger. Requires a completed mesh sweep."
          right={
            <button
              onClick={scanComms}
              disabled={commsBusy}
              className="inline-flex items-center gap-2 rounded-md border border-foreground/15 px-3 py-1.5 text-xs text-foreground/70 transition-colors hover:bg-foreground/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground/40 disabled:opacity-50"
            >
              {commsBusy ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.5} /> : <Radar className="h-3 w-3" strokeWidth={1.5} />}
              {commsBusy ? "Scanning" : "Run scan"}
            </button>
          }
        />

        <div aria-live="polite">
          {commsBusy && !comms && <Skeleton rows={3} />}

          {commsError && (
            <div className="rounded-lg border border-foreground/20 bg-foreground/[0.03] p-4">
              <div className="flex items-center gap-2 text-sm text-foreground/80">
                <AlertTriangle className="h-4 w-4" strokeWidth={1.5} /> Scan failed
              </div>
              <p className="mt-2 text-xs text-foreground/50">{commsError}</p>
              <button onClick={scanComms} className="mt-3 rounded-md border border-foreground/15 px-3 py-1.5 text-xs text-foreground/70 hover:bg-foreground/5">
                Retry
              </button>
            </div>
          )}

          {comms && !comms.findings.length && (
            <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-6 text-center">
              <p className="text-sm text-foreground/70">
                {comms.note ?? "No monitoring indicators in the scanned records."}
              </p>
              <p className="mt-1 text-xs text-foreground/40">{comms.scanned} records examined.</p>
            </div>
          )}

          {comms && comms.findings.length > 0 && (
            <div className="space-y-2">
              {comms.findings.map((f) => {
                const isOpen = open === f.code;
                return (
                  <div key={f.code} className={`rounded-lg border ${SEV_RING[f.severity]} bg-foreground/[0.02]`}>
                    <button
                      onClick={() => setOpen(isOpen ? null : f.code)}
                      aria-expanded={isOpen}
                      className="flex w-full items-start gap-3 p-4 text-left focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground/40"
                    >
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${SEV_DOT[f.severity]}`} />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="text-sm text-foreground/90">{f.title}</span>
                          <span className="text-[10px] uppercase tracking-[0.2em] text-foreground/40">
                            {f.severity} · {f.count}×
                          </span>
                        </span>
                        <span className="mt-1.5 block text-xs leading-relaxed text-foreground/55">{f.reading}</span>
                      </span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-foreground/10 px-4 py-4">
                        <p className="text-xs leading-relaxed text-foreground/70">◉ {f.countermeasure}</p>
                        <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-foreground/35">Evidence</div>
                        <ul className="mt-2 space-y-1.5">
                          {f.evidence.map((e) => (
                            <li key={e.signalId} className="font-mono text-[11px] leading-relaxed text-foreground/50">
                              {e.at.slice(0, 10)} · {e.actor} · {e.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {comms?.assessment && (
            <div className="mt-4 rounded-lg border border-foreground/15 bg-foreground/[0.03] p-5">
              <div className="text-[10px] uppercase tracking-[0.3em] text-foreground/35">Analyst assessment</div>
              <div className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-foreground/70">
                {comms.assessment}
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="flex justify-end">
        <button
          onClick={exportReport}
          disabled={!device && !comms}
          className="inline-flex items-center gap-2 rounded-md border border-foreground/15 px-4 py-2 text-xs text-foreground/70 transition-colors hover:bg-foreground/5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-foreground/40 disabled:opacity-40"
        >
          <FileText className="h-3.5 w-3.5" strokeWidth={1.5} /> Export assessment (.txt)
        </button>
      </div>
    </div>
  );
}
