import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Battery, BatteryCharging, Crosshair, Laptop, Loader2, RefreshCw, Smartphone,
  Tablet, Trash2, MonitorSmartphone,
} from "lucide-react";
import { toast } from "sonner";
import {
  batteryLabel, fetchMeshRoster, fixCaption, fmtAgo, forgetMeshDevice, liveness,
  meshDeviceId, minutesSince, reportMeshDevice, type MeshDevice,
} from "@/lib/asher/meshDevices";

/**
 * SIGNED-IN FLEET — roster of every device paired through a Google account.
 *
 * Pairing is automatic and identity-based: any device running Asherin under a
 * session that shares an active Google account with this one appears here on
 * its own. Nothing is "added". Battery and position are measured on the
 * reporting device — where a browser withholds the Battery Status API (Safari,
 * Firefox) the row says so instead of showing a fabricated percentage.
 */
interface Props {
  focused: string | null;
  onFocus: (deviceId: string) => void;
  onFly: (d: MeshDevice) => void;
  onRoute: (d: MeshDevice) => void;
  onDevices?: (rows: MeshDevice[]) => void;
}

const ICON: Record<string, typeof Laptop> = {
  laptop: Laptop,
  phone: Smartphone,
  tablet: Tablet,
  unknown: MonitorSmartphone,
};

const LIVENESS_TEXT: Record<string, string> = {
  live: "text-emerald-400",
  recent: "text-amber-400",
  stale: "text-muted-foreground",
  dark: "text-muted-foreground/60",
};

const MeshDevicesPanel = ({ focused, onFocus, onFly, onRoute, onDevices }: Props) => {
  const [rows, setRows] = useState<MeshDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const selfId = useMemo(() => meshDeviceId(), []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchMeshRoster();
      setRows(data);
      onDevices?.(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Roster unavailable");
    } finally {
      setLoading(false);
    }
  }, [onDevices]);

  // Announce this device first, then read: otherwise the panel's own machine
  // is missing from its first render and the operator thinks pairing failed.
  useEffect(() => {
    let alive = true;
    void (async () => {
      await reportMeshDevice(null, { source: "panel", force: true });
      if (alive) await load();
    })();
    const t = window.setInterval(() => { if (alive) void load(); }, 30_000);
    return () => { alive = false; window.clearInterval(t); };
  }, [load]);

  const forget = useCallback(async (d: MeshDevice) => {
    if (d.device_id === selfId) {
      toast.error("That is this device — it would re-register immediately.");
      return;
    }
    setBusy(d.device_id);
    try {
      await forgetMeshDevice(d.device_id);
      toast.success("Device removed from the fleet");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not remove device");
    } finally {
      setBusy(null);
    }
  }, [load, selfId]);

  return (
    <div className="mt-3 rounded-lg border border-border/40 bg-background/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <MonitorSmartphone className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-foreground/90">
          Signed-in fleet
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground/60">{rows.length}</span>
        <button
          onClick={() => { setLoading(true); void load(); }}
          className="rounded p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          aria-label="Refresh fleet"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {loading && rows.length === 0 && (
        <div className="space-y-2" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-md bg-foreground/5" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-[11px] text-destructive">
          {error}
          <button className="ml-2 underline" onClick={() => { setLoading(true); void load(); }}>Retry</button>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          No devices reporting yet. Sign in to Asherin on your phone with the same Google
          account and it pairs here on its own — no code to enter.
        </p>
      )}

      <div className="space-y-1.5">
        {rows.map((d) => {
          const Icon = ICON[d.form_factor] ?? MonitorSmartphone;
          const live = liveness(d);
          const isSelf = d.device_id === selfId;
          const hasFix = d.lat !== null && d.lng !== null;
          const batteryStale = d.battery_at !== null && (minutesSince(d.battery_at) ?? 0) > 60;
          const BattIcon = d.battery_charging ? BatteryCharging : Battery;
          return (
            <div
              key={d.id}
              className={`rounded-md border px-2.5 py-2 transition-colors ${
                focused === d.device_id
                  ? "border-foreground/30 bg-foreground/10"
                  : "border-border/30 hover:bg-foreground/5"
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onFocus(d.device_id)}
                >
                  <span className="block truncate text-[12px] text-foreground">
                    {d.label || "Unnamed device"}{isSelf ? " · this device" : ""}
                  </span>
                  <span className={`block text-[10px] ${LIVENESS_TEXT[live]}`}>
                    {live === "live" ? "Reporting now" : `Checked in ${fmtAgo(d.last_seen_at)}`}
                  </span>
                </button>
                <span
                  className="flex items-center gap-1 text-[10px] text-muted-foreground"
                  title={batteryStale ? `Last battery reading ${fmtAgo(d.battery_at)}` : undefined}
                >
                  <BattIcon className="h-3 w-3" />
                  {batteryLabel(d)}{batteryStale ? "*" : ""}
                </span>
              </div>

              <div className="mt-1 flex items-center gap-2 pl-5">
                <span className="truncate text-[10px] text-muted-foreground/80">{fixCaption(d)}</span>
                <div className="ml-auto flex items-center gap-1">
                  {hasFix && (
                    <>
                      <button
                        className="rounded p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                        onClick={() => onFly(d)}
                        aria-label={`Centre map on ${d.label || "device"}`}
                      >
                        <Crosshair className="h-3 w-3" />
                      </button>
                      <button
                        className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground underline hover:text-foreground"
                        onClick={() => onRoute(d)}
                      >
                        Route
                      </button>
                    </>
                  )}
                  {!isSelf && (
                    <button
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                      disabled={busy === d.device_id}
                      onClick={() => void forget(d)}
                      aria-label={`Remove ${d.label || "device"}`}
                    >
                      {busy === d.device_id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Trash2 className="h-3 w-3" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/60">
        Paired by Google account. Battery and position are measured by each device
        itself; an asterisk marks a reading older than an hour.
      </p>
    </div>
  );
};

export default MeshDevicesPanel;
