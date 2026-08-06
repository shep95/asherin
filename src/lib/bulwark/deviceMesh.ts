// ═══════════════════════════════════════════════════════════════════════════
// BULWARK — DEVICE MESH
//
// The flaw this fixes: the device probe is honest but parochial. Standing at
// the laptop, the station reported laptop legibility and nothing else; the
// phone's exposure was invisible until the operator physically picked up the
// phone. An adversary does not attack "the laptop" — it attacks the operator,
// and the operator is the union of every endpoint they sign in on. A posture
// read that omits the weakest endpoint is worse than no read, because it reads
// as reassurance.
//
// The mesh makes each endpoint publish its own posture row and every endpoint
// read all of them. Reconciliation is deliberately NOT last-write-wins: LWW is
// correct for one shared document and catastrophic for per-device facts, since
// the laptop's push would erase the phone's findings. Each device owns exactly
// one row, keyed `bulwark_posture:<deviceId>`, and the fleet view is the union.
//
// Fusion rule: worst-of. Fleet legibility is the maximum across live endpoints,
// not the mean — averaging a hardened laptop against a leaking phone produces a
// comfortable number that describes neither. Stale endpoints (not seen inside
// the horizon) are shown but excluded from the index, so a laptop left in a
// drawer for a month cannot pin the operator at red forever.
//
// Every read and write is scoped to the authenticated user by RLS. The probe
// payload carries no fingerprint hashes — only verdicts and prose.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from "@/integrations/supabase/client";
import type { DeviceReport, ProbeVerdict } from "./deviceProbe";
import { deviceId, deviceLabel } from "@/components/dashboard/google/modules/contactIntel/remoteVault";

const KIND_PREFIX = "bulwark_posture:";
/** Beyond this an endpoint is reported but no longer counted — it is a memory,
 *  not a live surface. */
const STALE_MS = 14 * 24 * 60 * 60 * 1000;

export interface FleetNode {
  deviceId: string;
  label: string;
  platform: string | null;
  legibility: number;
  checks: Array<{ id: string; label: string; verdict: ProbeVerdict; observed: string }>;
  blindSpots: string[];
  scannedAt: string;
  /** True for the endpoint the operator is reading this on. */
  isCurrent: boolean;
  /** Older than the freshness horizon — excluded from the fused index. */
  stale: boolean;
}

export interface FleetPosture {
  nodes: FleetNode[];
  /** Worst-of across live endpoints. 0 when nothing live has reported. */
  legibility: number;
  /** The endpoint carrying that number. */
  weakest: FleetNode | null;
  liveCount: number;
  staleCount: number;
  /** Check ids that are exposed on at least one endpoint but not all — the
   *  divergences worth acting on, because they prove the fix is possible. */
  divergent: Array<{ id: string; label: string; exposedOn: string[]; cleanOn: string[] }>;
}

const kindFor = (id: string) => `${KIND_PREFIX}${id}`;

/** Publish this endpoint's posture. Never throws — a mirror failure must not
 *  invalidate a good local probe. */
export async function publishPosture(
  userId: string,
  report: DeviceReport,
): Promise<"published" | "skipped" | "failed"> {
  if (!userId || !report) return "skipped";
  try {
    const payload = {
      legibility: report.legibility,
      // Deliberately drop `reading`/`countermeasure`: they are static prose
      // regenerated locally, so shipping them would triple the row for nothing.
      checks: report.checks.map((c) => ({
        id: c.id,
        label: c.label,
        verdict: c.verdict,
        observed: c.observed.slice(0, 400),
      })),
      blindSpots: report.blindSpots,
      platform: typeof navigator !== "undefined" ? navigator.platform || null : null,
    };
    const { error } = await supabase.from("google_intel_snapshots").upsert(
      {
        user_id: userId,
        kind: kindFor(deviceId()),
        saved_at: report.scannedAt,
        device_id: deviceId(),
        device_label: deviceLabel(),
        bytes: 0,
        payload: payload as never,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "user_id,kind" },
    );
    if (error) {
      console.warn("[device-mesh] publish failed:", error.message);
      return "failed";
    }
    return "published";
  } catch (e) {
    console.warn("[device-mesh] publish threw:", (e as Error).message);
    return "failed";
  }
}

/** Read every endpoint's posture and fuse it. */
export async function fetchFleet(userId: string): Promise<FleetPosture> {
  const empty: FleetPosture = {
    nodes: [], legibility: 0, weakest: null, liveCount: 0, staleCount: 0, divergent: [],
  };
  if (!userId) return empty;

  const { data, error } = await supabase
    .from("google_intel_snapshots")
    .select("kind, saved_at, device_id, device_label, payload")
    .eq("user_id", userId)
    .like("kind", `${KIND_PREFIX}%`)
    .order("saved_at", { ascending: false })
    .limit(40);
  if (error) {
    console.warn("[device-mesh] fleet read failed:", error.message);
    return empty;
  }

  const here = deviceId();
  const now = Date.now();
  const nodes: FleetNode[] = [];

  for (const row of data ?? []) {
    const p = (row.payload ?? {}) as Partial<FleetNode> & { platform?: string | null };
    if (!Array.isArray(p.checks)) continue; // shape guard — never trust jsonb
    const scannedAt = String(row.saved_at);
    const age = now - new Date(scannedAt).getTime();
    nodes.push({
      deviceId: String(row.device_id ?? ""),
      label: String(row.device_label ?? "Unknown endpoint"),
      platform: p.platform ?? null,
      legibility: Math.max(0, Math.min(100, Number(p.legibility ?? 0))),
      checks: p.checks as FleetNode["checks"],
      blindSpots: Array.isArray(p.blindSpots) ? p.blindSpots : [],
      scannedAt,
      isCurrent: String(row.device_id) === here,
      stale: Number.isFinite(age) ? age > STALE_MS : true,
    });
  }

  const live = nodes.filter((n) => !n.stale);
  // Worst-of, not mean: the operator is as legible as their loudest endpoint.
  const weakest = live.reduce<FleetNode | null>(
    (w, n) => (!w || n.legibility > w.legibility ? n : w),
    null,
  );

  // Divergence: the same check exposed here and hardened there. These are the
  // highest-value findings in the whole station — the clean endpoint is proof
  // the exposed one is fixable, and names the fix.
  const byCheck = new Map<string, { label: string; exposedOn: string[]; cleanOn: string[] }>();
  for (const n of live) {
    for (const c of n.checks) {
      const slot = byCheck.get(c.id) ?? { label: c.label, exposedOn: [], cleanOn: [] };
      if (c.verdict === "exposed" || c.verdict === "attention") slot.exposedOn.push(n.label);
      else if (c.verdict === "hardened") slot.cleanOn.push(n.label);
      byCheck.set(c.id, slot);
    }
  }
  const divergent = [...byCheck.entries()]
    .filter(([, v]) => v.exposedOn.length > 0 && v.cleanOn.length > 0)
    .map(([id, v]) => ({ id, ...v }));

  return {
    nodes,
    legibility: weakest?.legibility ?? 0,
    weakest,
    liveCount: live.length,
    staleCount: nodes.length - live.length,
    divergent,
  };
}

/** Drop an endpoint the operator no longer owns. */
export async function forgetEndpoint(userId: string, id: string): Promise<boolean> {
  if (!userId || !id) return false;
  const { error } = await supabase
    .from("google_intel_snapshots")
    .delete()
    .eq("user_id", userId)
    .eq("kind", kindFor(id));
  if (error) console.warn("[device-mesh] forget failed:", error.message);
  return !error;
}
