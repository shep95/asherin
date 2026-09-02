// asherin.defender — one screen, one big control, honest findings.
//
// Narrative check before the code: the operator does not want a settings page
// with nine accordions. They want to walk in, see whether the device is quiet,
// and hit one switch. So the bunker switch owns the top of the screen (Fitts:
// biggest target, always the same corner), status chips sit directly under it
// (recognition, not recall), and the findings list is dash-led facts with
// `this is unsure` printed wherever a browser genuinely cannot see.
//
// The flaw the old surface had was pretending — and hiding browser-capable
// work behind `npx cap`. A tab cannot stop a kernel logger, so this room never
// claims it does. What it can do, it does here: pick a Bluetooth device you
// own, freeze this origin's tracker beacons, rotate a unique 60-second poison
// map for in-page observers only. Apply is explicit, dry-run first, and never
// reaches anyone else's machine.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";
import { useAccess } from "@/hooks/useAccess";
import { emitPull } from "@/lib/connect/emitPull";
import {
  BUNKER_NEVER,
  BUNKER_TARGETS,
  RESIDUAL_BLIND_SPOTS,
  applyBunker,
  armTab,
  bunkerBlockedCount,
  collectSignals,
  hasCompanion,
  isNativeCompanion,
  pickBluetooth,
  pickHid,
  restoreBunker,
  type Signal,
  type SignalLevel,
} from "@/lib/defender/signals";
import { readCameraState, setCovertEnforcement, watchCamera, type CameraState } from "@/lib/defender/covertCamera";

const LEVEL_DOT: Record<SignalLevel, string> = {
  ok: "bg-emerald-400/70",
  watch: "bg-amber-300/70",
  alert: "bg-red-400/80",
  unsure: "bg-foreground/25",
};

const GROUPS: Array<{ id: Signal["group"]; label: string }> = [
  { id: "hardware", label: "hardware" },
  { id: "wifi", label: "wifi" },
  { id: "bluetooth", label: "bluetooth" },
  { id: "spy", label: "spy" },
  { id: "poison", label: "key-poison" },
];

const AsherinDefenderView = () => {
  const { hasPro, isAdmin } = useAccess();
  const proActions = hasPro || isAdmin;

  const [signals, setSignals] = useState<Signal[]>([]);
  const [scanning, setScanning] = useState(true);
  const [camera, setCamera] = useState<CameraState>(() => readCameraState());
  const [bunker, setBunker] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [showConnect, setShowConnect] = useState(false);
  const [companionTick, setCompanionTick] = useState(0);
  const [connectNote, setConnectNote] = useState<string | null>(null);
  const companion = useMemo(hasCompanion, [companionTick]);
  const native = useMemo(isNativeCompanion, [companionTick]);

  const scan = useCallback(async () => {
    setScanning(true);
    const started = performance.now();
    try {
      const next = await collectSignals();
      setSignals(next);
      void emitPull({
        organ: "defender",
        capability: "device-scan",
        fromSurface: "asherin-defender",
        status: "ok",
        latencyMs: Math.round(performance.now() - started),
        quote: `${next.length} signals · ${next.filter((s) => s.level === "alert").length} alert`,
      });
    } catch {
      void emitPull({
        organ: "defender",
        capability: "device-scan",
        fromSurface: "asherin-defender",
        status: "fail",
        quote: "scan refused",
      });
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    void scan();
  }, [scan]);
  useEffect(() => watchCamera(setCamera), []);

  const armThisTab = useCallback(async () => {
    armTab();
    setCompanionTick((n) => n + 1);
    setShowConnect(false);
    setConnectNote(
      "this tab is armed. bunker and the 60s poison map run here. ssid, bios and other-process spy match stay residual.",
    );
    void scan();
  }, [scan]);

  const connectCompanion = useCallback(async () => {
    if (isNativeCompanion()) {
      setCompanionTick((n) => n + 1);
      setShowConnect(false);
      void scan();
      return;
    }
    const notes: string[] = [];
    try {
      const d = await pickBluetooth();
      if (d) notes.push(`bluetooth · ${d.name || d.id.slice(0, 8)}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancel|abort/i.test(msg)) notes.push(`bluetooth picker: ${msg.slice(0, 80)}`);
    }
    try {
      const n = await pickHid();
      if (n) notes.push(`hid · ${n} granted`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/cancel|abort/i.test(msg)) notes.push(`hid picker: ${msg.slice(0, 80)}`);
    }
    armTab();
    setCompanionTick((n) => n + 1);
    setShowConnect(false);
    setConnectNote(notes.length ? notes.join(" · ") : "this tab is armed without a new device grant.");
    void scan();
  }, [scan]);

  const toggleBunker = useCallback(() => {
    const next = !bunker;
    setBunker(next);
    setCovertEnforcement(next);
    if (next && !dryRun && proActions) applyBunker();
    else restoreBunker();
    void emitPull({
      organ: "defender",
      capability: next ? "bunker-on" : "bunker-off",
      fromSurface: "asherin-defender",
      status: proActions ? "ok" : "skip",
      quote: next
        ? `${dryRun ? "dry-run" : "apply"} · freeze ${BUNKER_TARGETS.length} classes · blocked ${bunkerBlockedCount()}`
        : "restore",
    });
  }, [bunker, dryRun, proActions]);

  const alerts = signals.filter((s) => s.level === "alert").length;

  const chip = (label: string, tone: SignalLevel, text: string) => (
    <div
      key={label}
      className="flex items-center gap-2 rounded-full border border-foreground/12 bg-foreground/[0.03] px-3 py-1.5"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${LEVEL_DOT[tone]}`} />
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/55">{label}</span>
      <span className="text-[11px] font-extralight text-muted-foreground">{text}</span>
    </div>
  );

  const cameraTone: SignalLevel =
    camera.verdict === "covert-blocked"
      ? "alert"
      : camera.verdict === "previewed"
        ? "ok"
        : camera.verdict === "idle"
          ? "ok"
          : "unsure";

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
        {/* BUNKER — the one control a person came here to press. */}
        <section className="rounded-3xl border border-foreground/12 bg-foreground/[0.03] p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">◈ bunker</p>
              <h2 className="mt-1 text-xl font-extralight tracking-wide text-foreground">
                {bunker ? "outbound is frozen." : "outbound is open."}
              </h2>
              <p className="mt-1 text-sm font-extralight leading-relaxed text-muted-foreground">
                freeze {BUNKER_TARGETS.join(", ")}. {BUNKER_NEVER.join(" and ")} are never frozen. off restores
                everything. phone calls and messenger apps outside this origin stay residual.
              </p>
            </div>
            <button
              onClick={toggleBunker}
              disabled={!proActions}
              aria-pressed={bunker}
              className={`flex min-h-[56px] min-w-[168px] items-center justify-center gap-2 rounded-full border px-6 text-sm font-light tracking-wide transition-colors ${
                bunker
                  ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
                  : "border-foreground/20 bg-foreground/[0.05] text-foreground/80 hover:bg-foreground/[0.09]"
              } ${!proActions ? "cursor-not-allowed opacity-50" : ""}`}
            >
              {bunker ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
              {bunker ? "bunker on" : "bunker off"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setDryRun((v) => !v)}
              disabled={!proActions}
              className="min-h-[36px] rounded-full border border-foreground/12 px-3 text-[11px] font-extralight text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {dryRun ? "dry-run — nothing is applied" : "apply — explicit, this device only"}
            </button>
            {companion ? (
              <span className="text-[11px] font-extralight text-muted-foreground/70">
                {native ? "native companion present on this device." : "this tab is armed."}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowConnect(true)}
                className="min-h-[36px] rounded-full border border-foreground/20 px-3 text-[11px] font-extralight text-foreground/80 hover:bg-foreground/[0.06]"
              >
                arm this tab
              </button>
            )}
            {!proActions && (
              <span className="rounded-full border border-foreground/12 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-foreground/45">
                apply is on pro
              </span>
            )}
          </div>
          {connectNote && <p className="mt-3 text-[11px] font-extralight text-muted-foreground/80">{connectNote}</p>}
        </section>

        {/* STATUS CHIPS — one glance. */}
        <div className="mt-5 flex flex-wrap gap-2">
          {chip("camera", cameraTone, camera.verdict === "covert-blocked" ? "covert · blocked" : camera.verdict)}
          {chip("wifi", "unsure", typeof navigator !== "undefined" && navigator.onLine ? "linked" : "offline")}
          {chip(
            "bluetooth",
            signals.find((s) => s.id === "ble-adapter")?.level ?? "unsure",
            signals.find((s) => s.id === "ble-adapter")?.observed.slice(0, 28) ?? "reading",
          )}
          {chip("spy", alerts ? "alert" : "ok", alerts ? `${alerts} to read` : "nothing matched")}
          {companion ? (
            chip("poison", "ok", "60s map armed")
          ) : (
            <button
              type="button"
              onClick={() => setShowConnect(true)}
              className="flex min-h-[36px] items-center gap-2 rounded-full border border-foreground/12 bg-foreground/[0.03] px-3 py-1.5 text-left"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/25" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-foreground/55">poison</span>
              <span className="text-[11px] font-extralight text-muted-foreground">arm this tab</span>
            </button>
          )}
        </div>

        {showConnect && !companion && (
          <section className="mt-5 rounded-2xl border border-foreground/12 bg-foreground/[0.02] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">◈ arm this tab</p>
            <p className="mt-2 text-sm font-extralight text-foreground/85">
              this web room protects this tab and devices you explicitly pair. it cannot monitor every browser tab,
              search engine, or process on the laptop, and it cannot change a device fingerprint. whole-device coverage
              would require a separately installed, signed companion with explicit os permissions and an audit trail.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void connectCompanion()}
                className="min-h-[36px] rounded-full border border-foreground/20 px-3 text-[11px] font-extralight"
              >
                pick bluetooth / hid
              </button>
              <button
                type="button"
                onClick={() => void armThisTab()}
                className="min-h-[36px] rounded-full border border-foreground/20 px-3 text-[11px] font-extralight"
              >
                arm without a picker
              </button>
              <button
                type="button"
                onClick={() => setShowConnect(false)}
                className="min-h-[36px] rounded-full border border-foreground/12 px-3 text-[11px] font-extralight text-muted-foreground"
              >
                hide
              </button>
            </div>
          </section>
        )}

        {/* COVERT CAMERA */}
        <section className="mt-5 rounded-2xl border border-foreground/12 bg-foreground/[0.02] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">◈ covert-camera law</p>
              <p className="mt-2 text-sm font-extralight text-foreground/85">{camera.detail}</p>
            </div>
            {camera.verdict === "covert-blocked" && (
              <span className="shrink-0 rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-red-200">
                blocked
              </span>
            )}
          </div>
          <ul className="mt-3 space-y-1">
            {camera.uncovered.map((u) => (
              <li key={u} className="text-[11px] font-extralight text-muted-foreground/70">
                — not covered: {u}
              </li>
            ))}
          </ul>
        </section>

        {/* FINDINGS */}
        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">◈ findings</p>
            <button
              onClick={() => void scan()}
              className="flex min-h-[36px] items-center gap-2 rounded-full border border-foreground/12 px-3 text-[11px] font-extralight text-muted-foreground hover:text-foreground"
            >
              {scanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
              rescan
            </button>
          </div>

          <div className="space-y-4">
            {GROUPS.map((g) => {
              const rows = signals.filter((s) => s.group === g.id);
              if (!rows.length) return null;
              return (
                <div key={g.id} className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-foreground/40">{g.label}</p>
                  <ul className="mt-2 space-y-2">
                    {rows.map((s) => (
                      <li key={s.id} className="flex gap-2.5">
                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${LEVEL_DOT[s.level]}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-extralight text-foreground/85">
                            {s.label} — {s.observed}
                            {s.level === "unsure" && (
                              <span className="text-muted-foreground/60"> · this is unsure</span>
                            )}
                          </p>
                          {s.action && (
                            <p className="mt-0.5 text-[11px] font-extralight text-muted-foreground/70">— {s.action}</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>

        {/* RESIDUAL HONESTY */}
        <section className="mt-5 rounded-2xl border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-foreground/40">
            ◈ not covered by anything here
          </p>
          <ul className="mt-2 space-y-1">
            {RESIDUAL_BLIND_SPOTS.map((b) => (
              <li key={b} className="text-[11px] font-extralight text-muted-foreground/70">
                — {b}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] font-extralight text-muted-foreground/60">
            counter-measures run locally on your own device and default to dry-run. nothing here reaches another
            person's machine.
          </p>
        </section>
      </div>
    </div>
  );
};

export default AsherinDefenderView;
