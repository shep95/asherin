import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertTriangle, Check, Ear, HardDrive, Loader2, Mic, MicOff, Radio, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { SentinelEngine, deviceLabel, type EngineStatus } from "@/lib/sentinel/audio/captureEngine";
import { bufferStats, wipeLocal, DEFAULT_RETENTION_HOURS } from "@/lib/sentinel/audio/localBuffer";
import { isVadSensitivity, type VadSensitivity } from "@/lib/sentinel/audio/vad";
import { DEFAULT_PUSH_TAGS } from "@/lib/sentinel/audio/soundEvents";
import {
  ackAlert, fetchAlerts, fetchSettings, fetchTimeline, renameSpeaker, saveSettings, purgeRemote,
  type AmbientAlert, type AmbientDevice, type AmbientEvent, type AmbientSpeaker,
} from "@/lib/sentinel/audio/sync";

/**
 * asherin.sentinel — the ambient watch, and the truth about its reach.
 *
 * The room states its own boundary on its face rather than in a footnote: a
 * browser holds the microphone while this page lives, including while the tab is
 * behind others and while a desktop screen sleeps. It does NOT hold the
 * microphone after the tab closes or after a phone suspends the browser, because
 * the operating system takes the radio back. Everything captured is encrypted on
 * this device before it is sent, and the account timeline — not this tab — is the
 * record.
 */

type Tab = "live" | "timeline" | "speakers" | "alerts" | "devices";

const card = "rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";
const chip = "rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/55";

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour12: false });
const dayStamp = (iso: string) => new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });

const SentinelView = () => {
  const { toast } = useToast();
  const engineRef = useRef<SentinelEngine | null>(null);
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [tab, setTab] = useState<Tab>("live");
  const [events, setEvents] = useState<AmbientEvent[]>([]);
  const [speakers, setSpeakers] = useState<AmbientSpeaker[]>([]);
  const [devices, setDevices] = useState<AmbientDevice[]>([]);
  const [alerts, setAlerts] = useState<AmbientAlert[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [speakerFilter, setSpeakerFilter] = useState<string>("");
  const [buffer, setBuffer] = useState({ total: 0, pending: 0, oldestAt: null as number | null });
  const [transcribeOn, setTranscribeOn] = useState(true);
  const [pushNewSpeaker, setPushNewSpeaker] = useState(true);
  const [retention, setRetention] = useState(DEFAULT_RETENTION_HOURS);
  const [sensitivity, setSensitivity] = useState<VadSensitivity>("balanced");
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const pushNote = useCallback((note: string) => {
    setNotes((prev) => (prev.includes(note) ? prev : [note, ...prev].slice(0, 6)));
  }, []);

  const engine = useMemo(() => {
    if (!engineRef.current) {
      engineRef.current = new SentinelEngine({
        onStatus: setStatus,
        onNote: pushNote,
        onIngest: (result) => {
          if (result.events?.length) setEvents((prev) => [...result.events, ...prev].slice(0, 400));
          if (result.speakers?.length) {
            setSpeakers((prev) => {
              const map = new Map(prev.map((s) => [s.id, s]));
              for (const s of result.speakers) map.set(s.id, s);
              return [...map.values()].sort((a, b) => a.first_heard_at.localeCompare(b.first_heard_at));
            });
          }
          if (result.alerts?.length) setAlerts((prev) => [...result.alerts, ...prev].slice(0, 100));
        },
      });
    }
    return engineRef.current;
  }, [pushNote]);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const [timeline, alertList, settings] = await Promise.all([
        fetchTimeline({ limit: 200, query: query.trim() || undefined, speakerId: speakerFilter || undefined }),
        fetchAlerts(),
        fetchSettings(),
      ]);
      setEvents(timeline.events);
      setSpeakers(timeline.speakers);
      setDevices(timeline.devices);
      setAlerts(alertList.alerts);
      const prefs = settings.prefs as { transcribe?: boolean; pushNewSpeaker?: boolean; sensitivity?: unknown };
      setTranscribeOn(prefs.transcribe !== false);
      setPushNewSpeaker(prefs.pushNewSpeaker !== false);
      setRetention(settings.retentionHours || DEFAULT_RETENTION_HOURS);
      const sens: VadSensitivity = isVadSensitivity(prefs.sensitivity) ? prefs.sensitivity : "balanced";
      setSensitivity(sens);
      engineRef.current?.setSensitivity(sens);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "the account timeline could not be read.");
    } finally {
      setLoading(false);
    }
  }, [query, speakerFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const tick = window.setInterval(() => void bufferStats().then(setBuffer), 4000);
    void bufferStats().then(setBuffer);
    return () => window.clearInterval(tick);
  }, []);

  // Release the microphone when the operator leaves the room. Holding a live
  // stream behind a navigated-away view is exactly the behaviour this product
  // must never exhibit.
  useEffect(() => () => { void engineRef.current?.stop(); }, []);

  const listening = status?.state === "listening";

  const toggle = async () => {
    setBusy(true);
    try {
      if (listening) await engine.stop();
      else {
        const ok = await engine.start();
        if (!ok) toast({ title: "the watch did not start", description: engine.getStatus().message ?? "", variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  const persistSettings = async (patch: { transcribe?: boolean; pushNewSpeaker?: boolean; retentionHours?: number; sensitivity?: VadSensitivity }) => {
    const next = {
      transcribe: patch.transcribe ?? transcribeOn,
      pushNewSpeaker: patch.pushNewSpeaker ?? pushNewSpeaker,
      sensitivity: patch.sensitivity ?? sensitivity,
      pushTags: DEFAULT_PUSH_TAGS,
    };
    setTranscribeOn(next.transcribe);
    setPushNewSpeaker(next.pushNewSpeaker);
    setSensitivity(next.sensitivity);
    engineRef.current?.setSensitivity(next.sensitivity);
    const hours = patch.retentionHours ?? retention;
    setRetention(hours);
    try {
      await saveSettings(next, hours);
    } catch (e) {
      pushNote(e instanceof Error ? e.message : "settings could not be saved.");
    }
  };

  const speakerName = (id: string | null) => {
    if (!id) return "unattributed voice";
    const s = speakers.find((x) => x.id === id);
    return s?.name || s?.label || "unknown voice";
  };

  const tabs: Array<{ key: Tab; label: string; icon: typeof Ear }> = [
    { key: "live", label: "live", icon: Radio },
    { key: "timeline", label: "timeline", icon: Activity },
    { key: "speakers", label: "speakers", icon: Users },
    { key: "alerts", label: "alerts", icon: AlertTriangle },
    { key: "devices", label: "devices", icon: HardDrive },
  ];

  const meterWidth = Math.min(100, Math.round((status?.level ?? 0) * 900));

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <header className={`${card} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-[240px]">
            <h1 className="font-light tracking-tight text-2xl text-white/90">asherin.sentinel</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/50">
              an ambient watch. it separates voices, learns them from their own words, tags the sounds around them, and
              keeps every turn in one searchable account timeline.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-[11px] leading-tight text-white/40">
              <div>{deviceLabel()}</div>
              <div>{buffer.pending} buffered · {buffer.total} on device</div>
            </div>
            <Button
              onClick={toggle}
              disabled={busy}
              className={`h-11 rounded-xl border px-5 font-light ${listening ? "border-white/20 bg-white/[0.08] text-white/90" : "border-white/15 bg-white/[0.05] text-white/70"}`}
            >
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : listening ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />}
              {listening ? "stop listening" : "start listening"}
            </Button>
          </div>
        </div>

        <div className={`mt-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3`}>
          <p className="text-xs leading-relaxed text-amber-200/80">
            <span className="font-medium text-amber-200/95">truth boundary:</span> sentinel listens only while this page is open. it survives the tab being backgrounded and the desktop screen locking, but it cannot survive the tab closing, the browser quitting, the phone sleeping the browser, or the device powering off. it will not pretend to be always-on. the account timeline is the authoritative record of what was captured.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className={chip}>{status?.state ?? "idle"}</span>
          {listening && <span className={chip}>{status?.speaking ? "voice" : "ambient"}</span>}
          {listening && <span className={chip}>floor {(status?.noiseFloor ?? 0).toFixed(4)}</span>}
          {listening && <span className={chip}>{status?.sampleRate ?? 0} hz</span>}
          <div className="h-1.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-white/40 transition-[width] duration-150" style={{ width: `${meterWidth}%` }} />
          </div>
        </div>

        {status?.message && (
          <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/60">{status.message}</p>
        )}
        {notes.length > 0 && (
          <ul className="mt-3 space-y-1">
            {notes.map((n) => (
              <li key={n} className="text-[11px] text-white/45">— {n}</li>
            ))}
          </ul>
        )}
      </header>

      <nav className="flex flex-wrap gap-2">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-light tracking-wide transition-colors ${
              tab === key ? "border-white/20 bg-white/[0.08] text-white/90" : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white/75"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {key === "alerts" && alerts.some((a) => !a.acknowledged_at) && (
              <span className="ml-1 h-1.5 w-1.5 rounded-full bg-white/70" />
            )}
          </button>
        ))}
      </nav>

      {loadError && (
        <div className={`${card} flex items-center justify-between gap-3 p-4 text-sm text-white/60`}>
          <span>{loadError}</span>
          <Button variant="ghost" className="h-8 rounded-lg text-xs text-white/70" onClick={() => void reload()}>retry</Button>
        </div>
      )}

      {loading ? (
        <div className={`${card} flex items-center gap-3 p-6 text-sm text-white/50`}>
          <Loader2 className="h-4 w-4 animate-spin" /> reading the account timeline
        </div>
      ) : tab === "live" ? (
        <section className={`${card} p-5`}>
          <h2 className="mb-3 text-sm font-light tracking-wide text-white/70">live feed</h2>
          {!listening && (
            <p className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-white/55">
              the watch is not running. when you start it, this device asks for the microphone once, keeps every captured
              turn encrypted here first, and uploads it to your account. recording other people may require their consent
              where you are; that is your call to make, not the software's.
            </p>
          )}
          <div className="space-y-2">
            {events.slice(0, 40).map((ev) => (
              <EventRow key={ev.id} ev={ev} name={speakerName(ev.speaker_id)} />
            ))}
            {!events.length && (
              <p className="py-8 text-center text-sm text-white/40">
                nothing captured yet. start the watch and speak — a turn appears here the moment it closes and syncs.
              </p>
            )}
          </div>
        </section>
      ) : tab === "timeline" ? (
        <section className={`${card} p-5`}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/35" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="search what was said"
                className="h-10 rounded-xl border-white/10 bg-white/[0.04] pl-9 text-sm text-white/80 placeholder:text-white/30"
              />
            </div>
            <select
              value={speakerFilter}
              onChange={(e) => setSpeakerFilter(e.target.value)}
              className="h-10 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm text-white/70"
            >
              <option value="">every voice</option>
              {speakers.map((s) => (
                <option key={s.id} value={s.id}>{s.name || s.label}</option>
              ))}
            </select>
            <Button variant="ghost" className="h-10 rounded-xl text-xs text-white/60" onClick={() => void reload()}>refresh</Button>
          </div>
          <div className="space-y-2">
            {events.map((ev) => (
              <EventRow key={ev.id} ev={ev} name={speakerName(ev.speaker_id)} showDay />
            ))}
            {!events.length && <p className="py-8 text-center text-sm text-white/40">no turn matches that.</p>}
          </div>
        </section>
      ) : tab === "speakers" ? (
        <section className={`${card} p-5`}>
          <h2 className="mb-1 text-sm font-light tracking-wide text-white/70">speakers</h2>
          <p className="mb-4 text-xs leading-relaxed text-white/45">
            identity here is acoustic similarity across this account's own samples — pitch register, resonance, cadence.
            it is not forensic voice verification, and the confidence shown is a similarity margin, not a probability of
            identity. a name only binds itself when someone states it about themselves; you can rename anyone.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {speakers.map((s) => (
              <div key={s.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-white/85">{s.name || s.label}</div>
                    <div className="mt-1 text-[11px] text-white/40">
                      {s.sample_count} sample{s.sample_count === 1 ? "" : "s"} · confidence {s.confidence.toFixed(2)}
                    </div>
                    {s.name_source && <div className="mt-1 text-[11px] italic text-white/35">{s.name_source}</div>}
                  </div>
                  <Button
                    variant="ghost"
                    className="h-7 rounded-lg px-2 text-[11px] text-white/55"
                    onClick={() => setRenaming({ id: s.id, value: s.name || "" })}
                  >
                    rename
                  </Button>
                </div>
                {renaming?.id === s.id && (
                  <div className="mt-3 flex gap-2">
                    <Input
                      value={renaming.value}
                      onChange={(e) => setRenaming({ id: s.id, value: e.target.value })}
                      className="h-9 rounded-lg border-white/10 bg-white/[0.05] text-sm text-white/80"
                      placeholder="their name"
                    />
                    <Button
                      className="h-9 rounded-lg border border-white/15 bg-white/[0.06] text-xs text-white/80"
                      onClick={async () => {
                        const name = renaming.value.trim();
                        if (!name) return;
                        try {
                          const { speaker } = await renameSpeaker(s.id, name);
                          setSpeakers((prev) => prev.map((x) => (x.id === speaker.id ? speaker : x)));
                          setRenaming(null);
                        } catch (e) {
                          pushNote(e instanceof Error ? e.message : "the rename did not save.");
                        }
                      }}
                    >
                      save
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {!speakers.length && <p className="py-8 text-center text-sm text-white/40">no voice has been heard yet.</p>}
          </div>
        </section>
      ) : tab === "alerts" ? (
        <section className={`${card} p-5`}>
          <h2 className="mb-4 text-sm font-light tracking-wide text-white/70">alerts</h2>
          <div className="space-y-2">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm text-white/80">{a.message}</div>
                  <div className="text-[11px] text-white/40">{dayStamp(a.created_at)} {clock(a.created_at)} · {a.kind}</div>
                </div>
                {a.acknowledged_at ? (
                  <Check className="h-4 w-4 shrink-0 text-white/35" />
                ) : (
                  <Button
                    variant="ghost"
                    className="h-8 shrink-0 rounded-lg text-[11px] text-white/60"
                    onClick={async () => {
                      try {
                        await ackAlert(a.id);
                        setAlerts((prev) => prev.map((x) => (x.id === a.id ? { ...x, acknowledged_at: new Date().toISOString() } : x)));
                      } catch { pushNote("the alert could not be acknowledged."); }
                    }}
                  >
                    acknowledge
                  </Button>
                )}
              </div>
            ))}
            {!alerts.length && <p className="py-8 text-center text-sm text-white/40">nothing has met an alert threshold.</p>}
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div className={`${card} p-5`}>
            <h2 className="mb-4 text-sm font-light tracking-wide text-white/70">devices</h2>
            <div className="space-y-2">
              {devices.map((d) => {
                const stale = Date.now() - Date.parse(d.last_seen_at) > 5 * 60_000;
                return (
                  <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-white/80">{d.label}</div>
                      <div className="text-[11px] text-white/40">{d.platform} · last seen {clock(d.last_seen_at)} {dayStamp(d.last_seen_at)}</div>
                    </div>
                    <span className={chip}>{stale ? "offline" : d.status}</span>
                  </div>
                );
              })}
              {!devices.length && <p className="py-6 text-center text-sm text-white/40">no device has registered yet.</p>}
            </div>
          </div>

          <div className={`${card} space-y-4 p-5`}>
            <h2 className="text-sm font-light tracking-wide text-white/70">watch settings</h2>
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm text-white/65">transcribe speech turns</span>
              <Switch checked={transcribeOn} onCheckedChange={(v) => void persistSettings({ transcribe: v })} />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm text-white/65">alert when a new voice appears</span>
              <Switch checked={pushNewSpeaker} onCheckedChange={(v) => void persistSettings({ pushNewSpeaker: v })} />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm text-white/65">pickup sensitivity</span>
              <select
                value={sensitivity}
                onChange={(e) => void persistSettings({ sensitivity: e.target.value as VadSensitivity })}
                className="h-9 rounded-lg border border-white/10 bg-white/[0.05] px-2 text-sm text-white/75"
              >
                <option value="near">near — speaker beside the device</option>
                <option value="balanced">balanced — across a desk</option>
                <option value="far">far — across a room</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-4">
              <span className="text-sm text-white/65">keep on this device for</span>
              <select
                value={retention}
                onChange={(e) => void persistSettings({ retentionHours: Number(e.target.value) })}
                className="h-9 rounded-lg border border-white/10 bg-white/[0.05] px-2 text-sm text-white/75"
              >
                {[12, 24, 72, 168].map((h) => (
                  <option key={h} value={h}>{h} hours</option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="ghost"
                className="h-9 rounded-lg border border-white/10 text-xs text-white/60"
                onClick={async () => { await wipeLocal(); setBuffer({ total: 0, pending: 0, oldestAt: null }); pushNote("the local buffer on this device was wiped."); }}
              >
                wipe this device's buffer
              </Button>
              <Button
                variant="ghost"
                className="h-9 rounded-lg border border-white/10 text-xs text-white/60"
                onClick={async () => {
                  try {
                    const { deleted } = await purgeRemote(new Date().toISOString());
                    setEvents([]);
                    pushNote(`${deleted} stored turns were deleted from the account.`);
                  } catch (e) { pushNote(e instanceof Error ? e.message : "the purge did not run."); }
                }}
              >
                delete the account timeline
              </Button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

const EventRow = ({ ev, name, showDay }: { ev: AmbientEvent; name: string; showDay?: boolean }) => {
  const meta = ev.meta as { ambiguousVoice?: boolean; nameBoundFrom?: string | null };
  const sound = ev.kind === "sound";
  return (
    <div className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
      <div className="w-[86px] shrink-0 font-mono text-[11px] leading-5 text-white/35">
        {showDay && <div>{dayStamp(ev.started_at)}</div>}
        {clock(ev.started_at)}
      </div>
      <div className="min-w-0 flex-1">
        {sound ? (
          <div className="text-sm text-white/60">
            <span className="mr-2 rounded-md border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[11px] uppercase tracking-wider text-white/55">
              {ev.tag}
            </span>
            {ev.confidence !== null && <span className="text-[11px] text-white/35">confidence {ev.confidence.toFixed(2)}</span>}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[11px] text-white/45">
              <Ear className="h-3 w-3" />
              <span className="text-white/70">{name}</span>
              {meta?.ambiguousVoice && <span className="text-white/35">— two stored voices matched too closely to separate</span>}
              {meta?.nameBoundFrom && <span className="text-white/35">— named from “{meta.nameBoundFrom}”</span>}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-white/80">
              {ev.transcript || <span className="text-white/35">no transcript for this turn</span>}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default SentinelView;
