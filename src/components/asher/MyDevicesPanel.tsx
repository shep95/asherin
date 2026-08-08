import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Radar, ShieldAlert, Trash2, Crosshair, Check, X, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  canClaim, claimDevice, listOwnedDevices, locateGroup, releaseDevice, renameDevice,
  setDeviceState, fmtAge, STATE_COLOR, OWNED_KINDS,
  type LocatedDevice, type OwnedKind,
} from "@/lib/asher/findMy";

/**
 * ASHERIN FIND-MY — owned-device roster.
 *
 * Left-rail companion to the My Devices map layer. Claiming is gated on the
 * server (`ble_can_claim`): a fingerprint must have been heard within 5 m by
 * *your own* scanner on at least two distinct days. That single rule is what
 * stops the crowd relay from becoming a stalking tool — anything you have not
 * physically lived beside stays in the threat pipeline where it belongs.
 */

interface Candidate {
  fingerprint: string;
  display_name: string;
  inferred_kind: string;
  last_seen: string;
  closest_distance_m: number | null;
  distinct_days: number;
}

interface Props {
  devices: LocatedDevice[];
  loading: boolean;
  focused: string | null;
  onRefresh: () => void;
  onFocus: (fingerprint: string) => void;
  onFitAll: () => void;
  onRoute: (d: LocatedDevice) => void;
}

const MyDevicesPanel = ({ devices, loading, focused, onRefresh, onFocus, onFitAll, onRoute }: Props) => {
  const [adding, setAdding] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candLoading, setCandLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");

  const owned = useMemo(() => new Set(devices.map((d) => d.fingerprint)), [devices]);

  const loadCandidates = useCallback(async () => {
    setCandLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("ble_devices")
        .select("fingerprint,display_name,inferred_kind,last_seen,closest_distance_m,distinct_days")
        .order("distinct_days", { ascending: false })
        .limit(60);
      if (error) throw error;
      setCandidates(((data ?? []) as Candidate[]).filter((c) => !owned.has(c.fingerprint)));
    } catch (e: any) {
      toast.error(`Could not read your scanner log — ${e?.message ?? "unknown error"}`);
    } finally {
      setCandLoading(false);
    }
  }, [owned]);

  useEffect(() => { if (adding) void loadCandidates(); }, [adding, loadCandidates]);

  const doClaim = async (c: Candidate) => {
    setBusy(c.fingerprint);
    try {
      const verdict = await canClaim(c.fingerprint);
      if (!verdict.eligible) {
        toast.error(`Cannot claim — ${verdict.reason}`, {
          description: `Seen close on ${verdict.close_days ?? 0} of ${verdict.required_days ?? 2} required days.`,
        });
        return;
      }
      const kind = (OWNED_KINDS as readonly string[]).includes(c.inferred_kind)
        ? (c.inferred_kind as OwnedKind) : "other";
      await claimDevice({ fingerprint: c.fingerprint, label: c.display_name || "My device", kind });
      toast.success(`${c.display_name || "Device"} claimed — now tracked as an asset.`);
      setAdding(false);
      onRefresh();
    } catch (e: any) {
      toast.error(`Claim failed — ${e?.message ?? "unknown error"}`);
    } finally {
      setBusy(null);
    }
  };

  const toggleStolen = async (d: LocatedDevice) => {
    setBusy(d.fingerprint);
    try {
      const next = d.state === "stolen" ? "nominal" : "stolen";
      await setDeviceState(d, next, d.fused);
      toast[next === "stolen" ? "error" : "success"](
        next === "stolen"
          ? `${d.label} flagged STOLEN — mesh scan priority raised, audit row written.`
          : `${d.label} marked recovered.`,
      );
      onRefresh();
    } catch (e: any) {
      toast.error(`State change failed — ${e?.message ?? "unknown error"}`);
    } finally {
      setBusy(null);
    }
  };

  const doRelease = async (d: LocatedDevice) => {
    setBusy(d.fingerprint);
    try {
      await releaseDevice(d.id);
      toast.success(`${d.label} released back to the threat pipeline.`);
      onRefresh();
    } catch (e: any) {
      toast.error(`Release failed — ${e?.message ?? "unknown error"}`);
    } finally { setBusy(null); }
  };

  const commitRename = async (d: LocatedDevice) => {
    const label = draftLabel.trim();
    setEditing(null);
    if (!label || label === d.label) return;
    try {
      await renameDevice(d.id, label);
      onRefresh();
    } catch (e: any) {
      toast.error(`Rename failed — ${e?.message ?? "unknown error"}`);
    }
  };

  const positioned = devices.filter((d) => d.fused).length;

  return (
    <div className="border-t border-border/15 px-3 py-3">
      <div className="mb-2 flex items-center gap-2">
        <Radar className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">My Devices</p>
        <span className="ml-auto flex items-center gap-1">
          <button
            onClick={onRefresh}
            aria-label="Refresh device locations"
            className="rounded p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => setAdding((v) => !v)}
            aria-label={adding ? "Close claim list" : "Claim a device"}
            className="rounded p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
          >
            {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          </button>
        </span>
      </div>

      {/* CLAIM FLOW */}
      {adding && (
        <div className="mb-3 rounded-md border border-border/20 bg-background/40 p-2">
          <p className="mb-2 text-[10px] leading-relaxed text-muted-foreground/80">
            Claimable only if your own scanner heard it within 5 m on 2+ separate days.
          </p>
          {candLoading ? (
            <div className="flex items-center gap-2 py-2 text-[11px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Reading scanner log…
            </div>
          ) : candidates.length === 0 ? (
            <p className="py-2 text-[11px] text-muted-foreground/70">
              No unclaimed devices in your log yet. Run a Bluetooth sweep near your gear.
            </p>
          ) : (
            <div className="max-h-52 space-y-1 overflow-y-auto">
              {candidates.map((c) => {
                const eligible = (c.distinct_days ?? 0) >= 2 && (c.closest_distance_m ?? 999) < 5;
                return (
                  <button
                    key={c.fingerprint}
                    onClick={() => doClaim(c)}
                    disabled={busy === c.fingerprint}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-foreground/5 disabled:opacity-50"
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${eligible ? "bg-emerald-400" : "bg-muted-foreground/40"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[11px] text-foreground/90">{c.display_name || c.fingerprint.slice(0, 12)}</span>
                      <span className="block truncate text-[10px] text-muted-foreground/60">
                        {c.distinct_days ?? 0}d · closest {c.closest_distance_m != null ? `${Math.round(c.closest_distance_m)} m` : "—"}
                      </span>
                    </span>
                    {busy === c.fingerprint
                      ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      : <Check className="h-3 w-3 text-muted-foreground/60" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ROSTER */}
      {devices.length === 0 ? (
        <p className="py-1 text-[11px] leading-relaxed text-muted-foreground/70">
          No claimed devices. Tag your laptop, earbuds or tag and they appear here with a live confidence halo.
        </p>
      ) : (
        <>
          <button
            onClick={onFitAll}
            disabled={!positioned}
            className="mb-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-border/25 px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground hover:bg-foreground/5 hover:text-foreground disabled:opacity-40"
          >
            <Crosshair className="h-3 w-3" /> Fit all ({positioned}/{devices.length} located)
          </button>
          <div className="space-y-1">
            {devices.map((d) => {
              const color = STATE_COLOR[d.effectiveState];
              const isFocused = focused === d.fingerprint;
              return (
                <div
                  key={d.fingerprint}
                  className={`rounded-md border px-2 py-1.5 transition-colors ${
                    isFocused ? "border-[#c98b3a]/50 bg-foreground/5" : "border-transparent hover:bg-foreground/5"
                  } ${d.effectiveState === "stolen" ? "animate-pulse" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full ring-2 ring-offset-0" style={{ backgroundColor: "transparent", boxShadow: `0 0 0 2px ${color}` }} />
                    {editing === d.id ? (
                      <input
                        autoFocus
                        value={draftLabel}
                        onChange={(e) => setDraftLabel(e.target.value)}
                        onBlur={() => commitRename(d)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(d);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        aria-label="Device name"
                        className="min-w-0 flex-1 rounded border border-border/30 bg-background/60 px-1 py-0.5 text-[11px] outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => onFocus(d.fingerprint)}
                        onDoubleClick={() => { setEditing(d.id); setDraftLabel(d.label); }}
                        className="min-w-0 flex-1 truncate text-left text-[11px] text-foreground/90"
                        title="Click to locate · double-click to rename"
                      >
                        {d.label}
                      </button>
                    )}
                    <button
                      onClick={() => toggleStolen(d)}
                      disabled={busy === d.fingerprint}
                      aria-label={d.state === "stolen" ? "Mark recovered" : "Declare stolen"}
                      className={`rounded p-1 ${d.state === "stolen" ? "text-red-400" : "text-muted-foreground/60 hover:text-red-400"}`}
                    >
                      <ShieldAlert className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => doRelease(d)}
                      disabled={busy === d.fingerprint}
                      aria-label="Release device"
                      className="rounded p-1 text-muted-foreground/50 hover:text-foreground"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-0.5 pl-4 text-[10px] leading-snug text-muted-foreground/70">
                    {d.fused
                      ? d.fused.caption
                      : `No sighting in the last 24 h · last state ${d.effectiveState}`}
                  </p>
                  {d.fused && (
                    <div className="mt-0.5 flex items-center gap-2 pl-4">
                      <span className="text-[10px] uppercase tracking-[0.12em]" style={{ color }}>
                        {d.effectiveState}
                      </span>
                      <span className="text-[10px] text-muted-foreground/50">{fmtAge(d.fused.lastSeenAt)}</span>
                      <button
                        onClick={() => onRoute(d)}
                        className="ml-auto text-[10px] text-muted-foreground/70 underline hover:text-foreground"
                      >
                        Route
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default MyDevicesPanel;
