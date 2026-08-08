import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithByokRetry } from "@/lib/byokInvoke";
import { enablePush, readPushStatus, type PushStatus } from "@/lib/guardianPush";
import { startScan, pickOne, listPaired, detectScanMode, type RawAdvert, type ScannerHandle } from "@/components/dashboard/zaxin/core/scanner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Radar, ShieldAlert, MapPin, Loader2, RefreshCw, EyeOff, UserCheck, FileText, Radio,
  Crosshair, BookOpen, Download,
} from "lucide-react";

/**
 * BLUETOOTH & AREA SENTINEL
 *
 * What this is honest about, in the interface, not just in a comment:
 * a browser can only hear Bluetooth advertisements while this page is open and
 * in the foreground. It cannot scan with the phone powered off, and it cannot
 * scan with the tab closed — no web platform can. So the Sentinel runs as a
 * wake-locked foreground watch that auto-resumes the moment you return, and it
 * says exactly that on screen rather than implying a radio it does not own.
 *
 * The detection question it answers is the one that matters in a stalking case:
 * has this same radio been near me across separate times and separate places?
 */

interface Device {
  id: string;
  display_name: string;
  manufacturer: string | null;
  inferred_kind: string;
  encounter_count: number;
  distinct_days: number;
  distinct_places: number;
  sighting_count: number;
  last_rssi: number | null;
  last_distance_m: number | null;
  closest_distance_m: number | null;
  is_self: boolean;
  self_reason: string | null;
  is_ignored: boolean;
  threat_tier: string;
  dossier: Record<string, any> | null;
  first_seen: string;
  last_seen: string;
}

interface GeoEvent {
  id: string;
  place_label: string | null;
  risk_level: string;
  created_at: string;
}

const TIER_STYLE: Record<string, string> = {
  breach: "border-foreground/60 bg-foreground/10 text-foreground",
  priority: "border-foreground/40 bg-foreground/[0.06] text-foreground/90",
  unknown: "border-border bg-muted/40 text-muted-foreground",
  known: "border-border bg-muted/20 text-muted-foreground",
  friendly: "border-border bg-transparent text-muted-foreground",
};

const feet = (m: number | null) => (m == null ? "—" : `${Math.round(m * 3.28084)} ft`);

async function resolveByok(): Promise<Record<string, string> | undefined> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return undefined;
    const { data: pref } = await supabase
      .from("user_model_preferences" as any)
      .select("active_provider, active_model").eq("user_id", user.id).maybeSingle();
    const provider = (pref as any)?.active_provider;
    const model = (pref as any)?.active_model;
    if (!provider || provider === "default" || !model || model === "default") return undefined;
    const { data: keyRow } = await supabase
      .from("user_api_keys" as any)
      .select("api_key").eq("user_id", user.id).eq("provider", provider).eq("is_active", true).maybeSingle();
    const apiKey = (keyRow as any)?.api_key;
    return apiKey ? { provider, model, apiKey } : undefined;
  } catch {
    return undefined;
  }
}

const BluetoothSentinel = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [events, setEvents] = useState<GeoEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [watching, setWatching] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [flushing, setFlushing] = useState(false);
  const [dossierFor, setDossierFor] = useState<string | null>(null);
  const [push, setPush] = useState<PushStatus>({ state: "prompt" });
  const [areaState, setAreaState] = useState<{ level: string; label: string; summary: string } | null>(null);
  const [checkingArea, setCheckingArea] = useState(false);
  const [settings, setSettings] = useState({
    recurrence_threshold: 3,
    ignore_audio: true,
    min_rssi: -95,
    ble_enabled: true,
    geo_enabled: true,
    push_enabled: true,
    email_enabled: true,
  });

  // Foreground watch machinery. Buffer is a ref so the scan callback never
  // re-renders the tree on every advertisement (hundreds per minute in a city).
  const bufferRef = useRef<Map<string, RawAdvert & { lat?: number; lng?: number; accuracy?: number }>>(new Map());
  const handleRef = useRef<ScannerHandle | null>(null);
  const wakeRef = useRef<any>(null);
  const sessionRef = useRef<string>("");
  const posRef = useRef<{ lat: number; lng: number; accuracy: number } | null>(null);
  const geoWatchRef = useRef<number | null>(null);
  const flushTimer = useRef<number | null>(null);
  const areaTimer = useRef<number | null>(null);
  const mounted = useRef(true);

  const mode = useMemo(() => detectScanMode(), []);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [d, g, s] = await Promise.all([
        supabase.functions.invoke("sentinel-ble", { body: { action: "ble.list" } }),
        supabase.functions.invoke("sentinel-ble", { body: { action: "geo.list" } }),
        supabase.functions.invoke("sentinel-ble", { body: { action: "settings.get" } }),
      ]);
      if (d.error) throw d.error;
      setDevices((d.data?.devices || []) as Device[]);
      setEvents((g.data?.events || []) as GeoEvent[]);
      if (s.data?.settings) setSettings((prev) => ({ ...prev, ...s.data.settings }));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Sentinel could not be reached.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void load();
    void readPushStatus().then(setPush);
    return () => { mounted.current = false; };
  }, [load]);

  // ── Flush: one batch per interval, deduped to strongest sample per radio ──
  const flush = useCallback(async (silent = true) => {
    const batch = Array.from(bufferRef.current.values());
    bufferRef.current.clear();
    if (!mounted.current) return;
    setLiveCount(0);
    if (!batch.length) return;
    setFlushing(true);
    try {
      const byok = await resolveByok();
      const data = await invokeWithByokRetry<any>("sentinel-ble", {
        body: {
          action: "ble.ingest",
          sessionId: sessionRef.current,
          scannerLabel: navigator.platform || "device",
          adverts: batch.map((a) => ({
            id: a.id, name: a.name, manufacturer: a.manufacturer,
            serviceUuids: a.serviceUuids, rssi: a.rssi, txPower: a.txPower,
            lat: a.lat ?? null, lng: a.lng ?? null, accuracy: a.accuracy ?? null, ts: a.ts,
          })),
          ...(byok ? { byok } : {}),
        },
        silent: true,
      });
      const alerts = data?.alerts || [];

      for (const al of alerts) {
        toast.warning(`Recurring device: ${al.name}`, { description: al.reason, duration: 12000 });
      }
      if (!silent) toast.success(`${batch.length} radios logged`);
      await load();
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : "Ingest failed");
    } finally {
      if (mounted.current) setFlushing(false);
    }
  }, [load]);

  const stopWatch = useCallback(async () => {
    if (flushTimer.current) { window.clearInterval(flushTimer.current); flushTimer.current = null; }
    if (areaTimer.current) { window.clearInterval(areaTimer.current); areaTimer.current = null; }
    if (geoWatchRef.current != null) { navigator.geolocation.clearWatch(geoWatchRef.current); geoWatchRef.current = null; }
    try { await handleRef.current?.stop(); } catch { /* noop */ }
    handleRef.current = null;
    try { await wakeRef.current?.release?.(); } catch { /* noop */ }
    wakeRef.current = null;
    await flush(false);
    if (mounted.current) setWatching(false);
  }, [flush]);

  const checkArea = useCallback(async (silent = true) => {
    const p = posRef.current;
    if (!p) { if (!silent) toast.error("No position fix yet."); return; }
    setCheckingArea(true);
    try {
      const byok = await resolveByok();
      const data = await invokeWithByokRetry<any>("sentinel-ble", {
        body: { action: "geo.check", lat: p.lat, lng: p.lng, ...(byok ? { byok } : {}) },
        silent: true,
      });
      const a = data?.assessment;
      if (a) {
        setAreaState({ level: a.risk_level, label: a.place_label || "", summary: a.summary || "" });
        if (data?.notified) {

          toast.warning(`${a.risk_level} risk area`, { description: a.summary?.slice(0, 180), duration: 14000 });
          await load();
        }
      }
    } catch (e) {
      if (!silent) toast.error(e instanceof Error ? e.message : "Area check failed");
    } finally {
      if (mounted.current) setCheckingArea(false);
    }
  }, [load]);

  const startWatch = useCallback(async () => {
    if (handleRef.current) return;
    sessionRef.current = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      handleRef.current = await startScan((a) => {
        // Keep the strongest sample per radio for this window — the closest
        // approach is the safety-relevant fact, not the average.
        const prev = bufferRef.current.get(a.id);
        const withPos = { ...a, ...(posRef.current || {}) };
        if (!prev || (a.rssi ?? -999) > (prev.rssi ?? -999)) bufferRef.current.set(a.id, withPos);
        setLiveCount(bufferRef.current.size);
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Bluetooth scan unavailable");
      return;
    }
    // Position: the "different place?" signal. Coarse-gridded server-side.
    if ("geolocation" in navigator) {
      geoWatchRef.current = navigator.geolocation.watchPosition(
        (pos) => { posRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }; },
        () => { /* denied — recurrence falls back to distinct days */ },
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 20_000 },
      );
    }
    try { wakeRef.current = await (navigator as any).wakeLock?.request("screen"); } catch { /* noop */ }
    flushTimer.current = window.setInterval(() => { void flush(true); }, 45_000);
    if (settings.geo_enabled) {
      areaTimer.current = window.setInterval(() => { void checkArea(true); }, 5 * 60_000);
      window.setTimeout(() => { void checkArea(true); }, 8_000);
    }
    setWatching(true);
    toast.success("Sentinel watching", { description: "Foreground watch active. Keep this tab open." });
  }, [flush, checkArea, settings.geo_enabled]);

  // Auto-resume: returning to the tab restores the wake lock and the scan.
  useEffect(() => {
    const onVis = async () => {
      if (document.visibilityState !== "visible" || !watching) return;
      if (!wakeRef.current) {
        try { wakeRef.current = await (navigator as any).wakeLock?.request("screen"); } catch { /* noop */ }
      }
      if (!handleRef.current) {
        try { handleRef.current = await startScan((a) => {
          const prev = bufferRef.current.get(a.id);
          const withPos = { ...a, ...(posRef.current || {}) };
          if (!prev || (a.rssi ?? -999) > (prev.rssi ?? -999)) bufferRef.current.set(a.id, withPos);
          setLiveCount(bufferRef.current.size);
        }); } catch { /* noop */ }
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [watching]);

  // Teardown on unmount: never leave a radio scan or wake lock behind.
  useEffect(() => () => {
    try { handleRef.current?.stop(); } catch { /* noop */ }
    try { wakeRef.current?.release?.(); } catch { /* noop */ }
    if (flushTimer.current) window.clearInterval(flushTimer.current);
    if (areaTimer.current) window.clearInterval(areaTimer.current);
    if (geoWatchRef.current != null) navigator.geolocation.clearWatch(geoWatchRef.current);
  }, []);

  const captureOnce = async () => {
    sessionRef.current ||= `${Date.now().toString(36)}-manual`;
    try {
      if (mode === "continuous" || mode === "native") {
        const paired = await listPaired();
        for (const a of paired) bufferRef.current.set(a.id, { ...a, ...(posRef.current || {}) });
      }
      await pickOne((a) => bufferRef.current.set(a.id, { ...a, ...(posRef.current || {}) }));
      await flush(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No device selected");
    }
  };

  const mark = async (id: string, patch: { is_self?: boolean; is_ignored?: boolean }) => {
    await supabase.functions.invoke("sentinel-ble", { body: { action: "ble.mark", deviceId: id, ...patch } });
    await load();
  };

  const buildDossier = async (id: string) => {
    setDossierFor(id);
    try {
      const byok = await resolveByok();
      await invokeWithByokRetry("sentinel-ble", { body: { action: "ble.dossier", deviceId: id, ...(byok ? { byok } : {}) } });
      toast.success("Dossier built");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Dossier failed");
    } finally {
      setDossierFor(null);
    }
  };

  const saveSettings = async (next: Partial<typeof settings>) => {
    const merged = { ...settings, ...next };
    setSettings(merged);
    await supabase.functions.invoke("sentinel-ble", { body: { action: "settings.set", settings: merged } });
  };

  const flagged = devices.filter((d) => !d.is_self && !d.is_ignored && ["priority", "breach"].includes(d.threat_tier));
  const rest = devices.filter((d) => !flagged.includes(d));

  const DeviceCard = ({ d }: { d: Device }) => (
    <div className={`rounded-lg border p-3 space-y-2 ${TIER_STYLE[d.threat_tier] || TIER_STYLE.unknown}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{d.display_name}</p>
          <p className="text-[11px] text-muted-foreground">
            {d.inferred_kind} · {d.manufacturer || "maker not advertised"} · closest {feet(d.closest_distance_m)}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wider border rounded px-1.5 py-0.5 shrink-0">{d.threat_tier}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {d.encounter_count} session{d.encounter_count === 1 ? "" : "s"} · {d.distinct_days} day{d.distinct_days === 1 ? "" : "s"} · {d.distinct_places} place{d.distinct_places === 1 ? "" : "s"} · last {new Date(d.last_seen).toLocaleString()}
      </p>
      {d.is_self && <p className="text-[11px] italic text-muted-foreground">{d.self_reason || "Your own hardware."}</p>}
      {d.dossier && (
        <div className="rounded border border-border/60 bg-background/40 p-2 space-y-1">
          <p className="text-xs font-medium">{String(d.dossier.headline || "")}</p>
          <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{String(d.dossier.assessment || "")}</p>
          {Array.isArray(d.dossier.actions) && d.dossier.actions.length > 0 && (
            <ul className="text-[11px] text-muted-foreground list-disc pl-4">
              {d.dossier.actions.slice(0, 5).map((a: string, i: number) => <li key={i}>{a}</li>)}
            </ul>
          )}
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Grade {String(d.dossier.grade || "THIN")}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={dossierFor === d.id} onClick={() => buildDossier(d.id)}>
          {dossierFor === d.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
          {d.dossier ? "Rebuild dossier" : "Build dossier"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => mark(d.id, { is_self: !d.is_self })}>
          <UserCheck className="h-3 w-3 mr-1" />{d.is_self ? "Not mine" : "This is mine"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => mark(d.id, { is_ignored: !d.is_ignored })}>
          <EyeOff className="h-3 w-3 mr-1" />{d.is_ignored ? "Unmute" : "Mute"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2"><Radar className="h-4 w-4" /> Bluetooth & Area Sentinel</h2>
          <p className="text-xs text-muted-foreground">
            Logs every nearby radio, flags the ones that follow you across separate times and places, and warns you when you enter an area with reported risk.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => load()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          {watching ? (
            <Button size="sm" variant="destructive" onClick={() => stopWatch()}>Stop watch</Button>
          ) : (
            <Button size="sm" onClick={() => startWatch()} disabled={mode === "unsupported"}>
              <Radio className="h-3.5 w-3.5 mr-1" /> Start watch
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground space-y-1">
        <p>
          <strong className="text-foreground">Radio reality:</strong>{" "}
          {mode === "native"
            ? "Companion app detected — the radio keeps listening while the app is in the background and while the screen is off."
            : mode === "continuous"
              ? "Continuous advertisement scanning is available on this device."
              : mode === "picker"
                ? "This browser only exposes the one-shot Bluetooth picker — use Capture once, install the Asherin companion app, or use Chrome on Android with experimental web platform features."
                : "Web Bluetooth is unavailable in this browser. Install the Asherin companion app, or use Chrome on Android."}
        </p>
        <p>
          {mode === "native"
            ? "Background and screen-off sweeps run natively. No phone can listen while it is fully powered down — the radio has no power then — so the log resumes the moment the handset boots."
            : "A web page can only listen while this tab is open and in front. It cannot scan with the tab closed — no browser can. The watch is wake-locked and auto-resumes when you return; alerts it has already raised still reach you by push and email anywhere."}
        </p>
        {watching && <p className="text-foreground">Watching · {liveCount} radio{liveCount === 1 ? "" : "s"} buffered {flushing && "· syncing"}</p>}
      </div>


      <Tabs defaultValue="devices">
        <TabsList>
          <TabsTrigger value="devices">Devices {flagged.length > 0 && `(${flagged.length})`}</TabsTrigger>
          <TabsTrigger value="area">Area risk</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="devices" className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={captureOnce}>Capture once</Button>
            <Button size="sm" variant="ghost" onClick={() => flush(false)} disabled={flushing}>Sync buffer</Button>
          </div>
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : loadError ? (
            <div className="rounded border border-border p-4 text-sm">
              <p className="text-muted-foreground">{loadError}</p>
              <Button size="sm" variant="outline" className="mt-2" onClick={() => load()}>Retry</Button>
            </div>
          ) : devices.length === 0 ? (
            <div className="rounded border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No radios logged yet. Start the watch and walk your normal route — recurrence only means something once you have moved.
            </div>
          ) : (
            <ScrollArea className="h-[520px] pr-3">
              <div className="space-y-3">
                {flagged.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <ShieldAlert className="h-3 w-3" /> Following pattern detected
                    </p>
                    {flagged.map((d) => <DeviceCard key={d.id} d={d} />)}
                  </div>
                )}
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Logged radios</p>
                {rest.map((d) => <DeviceCard key={d.id} d={d} />)}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="area" className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" onClick={() => checkArea(false)} disabled={checkingArea}>
              {checkingArea ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <MapPin className="h-3.5 w-3.5 mr-1" />}
              Assess where I am
            </Button>
          </div>
          {areaState && (
            <div className="rounded-lg border border-border p-3 space-y-1">
              <p className="text-sm font-semibold">{areaState.level} · {areaState.label}</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{areaState.summary}</p>
            </div>
          )}
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Recent area alerts</p>
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground">No area alerts yet.</p>
          ) : (
            <div className="space-y-2">
              {events.map((e) => (
                <div key={e.id} className="rounded border border-border/60 p-2">
                  <p className="text-xs font-medium">{e.risk_level} · {e.place_label || "unlabelled area"}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Alert after repeat encounters</Label>
              <p className="text-[11px] text-muted-foreground">Separate scan sessions, across at least two days or two places.</p>
            </div>
            <input
              type="number" min={2} max={20} value={settings.recurrence_threshold}
              onChange={(e) => saveSettings({ recurrence_threshold: Number(e.target.value) })}
              className="w-16 rounded border border-border bg-background px-2 py-1 text-sm"
            />
          </div>
          {[
            ["ignore_audio", "Ignore headphones & speakers", "Audio accessories repeat constantly and carry no stalking signal. Still logged."],
            ["geo_enabled", "Area risk alerts", "Assess the neighbourhood you enter against reported crime and documented activity."],
            ["push_enabled", "Push alerts", "Delivered to every registered device, app closed."],
            ["email_enabled", "Email alerts", "Full branded intelligence report."],
          ].map(([key, label, hint]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm">{label}</Label>
                <p className="text-[11px] text-muted-foreground">{hint}</p>
              </div>
              <Switch
                checked={(settings as any)[key]}
                onCheckedChange={(v) => saveSettings({ [key]: v } as any)}
              />
            </div>
          ))}
          {push.state !== "enabled" && (
            <Button size="sm" variant="outline" onClick={async () => setPush(await enablePush())}>
              Enable device push
            </Button>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BluetoothSentinel;
