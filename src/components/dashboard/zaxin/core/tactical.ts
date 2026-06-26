// Tactical brain — turns the raw contact stream into mission state.
//
// Responsibilities:
//   • Maintain a Contact ring per id (bounded sample buffer).
//   • Detect FIRST_SEEN, LOST (no advert > lostMs), RESURRECTED.
//   • Detect CLONE-SUSPECT: same displayName, different id, both active.
//   • Apply scenario tuning (e.g. Silent Observe blocks GATT pulls).
//   • Hold watchlist + alert log.

import { resolveName } from "./naming";
import { pullGattIntel } from "./intel";
import type { RawAdvert } from "./scanner";
import type {
  Contact, RssiSample, TacticalAlert, ScenarioId, ZaxinSnapshot, HopReport,
  ProximityZone, ThreatTier, BehaviorState,
} from "./types";

export const SCENARIOS: Record<ScenarioId, {
  label: string;
  blurb: string;
  allowGattAuto: boolean;
  lostMs: number;
  alertOnNew: boolean;
}> = {
  standard:       { label: "Standard",       blurb: "Continuous sweep, balanced.",                allowGattAuto: false, lostMs: 20_000, alertOnNew: false },
  perimeter:      { label: "Perimeter",      blurb: "Alerts on every new arrival.",               allowGattAuto: false, lostMs: 15_000, alertOnNew: true  },
  asset_recovery: { label: "Asset Recovery", blurb: "Watchlist-priority, tight loss window.",     allowGattAuto: false, lostMs: 10_000, alertOnNew: false },
  silent_observe: { label: "Silent Observe", blurb: "Passive only. No GATT, no trace.",           allowGattAuto: false, lostMs: 30_000, alertOnNew: false },
  deep_pull:      { label: "Deep Pull",      blurb: "Auto-pull GATT on first contact.",           allowGattAuto: true,  lostMs: 25_000, alertOnNew: false },
};

const TX_POWER_DEFAULT = -59;
const PATH_LOSS = 2.0;
const SAMPLE_RING = 64;

function rssiToMeters(rssi: number | null, tx?: number | null): number | null {
  if (rssi == null) return null;
  const txp = tx ?? TX_POWER_DEFAULT;
  return Math.pow(10, (txp - rssi) / (10 * PATH_LOSS));
}
function rssiZone(rssi: number | null): ProximityZone {
  if (rssi == null) return "unknown";
  if (rssi >= -55) return "immediate";
  if (rssi >= -75) return "near";
  return "far";
}
function metersLabel(m: number | null): string {
  if (m == null) return "—";
  if (m < 1) return `${(m * 100).toFixed(0)} cm`;
  if (m < 10) return `${m.toFixed(1)} m`;
  return `${m.toFixed(0)} m`;
}

export interface TacticalConfig {
  scenario: ScenarioId;
  /** ID of this local node, exposed in hop reports. */
  nodeId: string;
  nodeLabel: string;
  onIntelPull?: (contact: Contact) => void;
}

export class TacticalEngine {
  private contacts = new Map<string, Contact>();
  private alerts: TacticalAlert[] = [];
  private watchlist = new Set<string>();
  private peers = new Map<string, { label: string; lastSeen: number; count: number }>();
  private cfg: TacticalConfig;
  private listeners = new Set<(s: ZaxinSnapshot) => void>();
  private poseActive = false;
  private currentHeading: number | null = null;

  constructor(cfg: TacticalConfig) { this.cfg = cfg; }

  subscribe(fn: (s: ZaxinSnapshot) => void) {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  setScenario(s: ScenarioId) {
    this.cfg.scenario = s;
    this.alert("info", `Scenario → ${SCENARIOS[s].label}`);
    this.emit();
  }

  setPose(active: boolean, heading: number | null) {
    this.poseActive = active;
    this.currentHeading = heading;
  }

  setHeading(h: number | null) { this.currentHeading = h; }

  toggleWatch(id: string) {
    if (this.watchlist.has(id)) this.watchlist.delete(id);
    else this.watchlist.add(id);
    const c = this.contacts.get(id);
    if (c) c.watchlisted = this.watchlist.has(id);
    this.emit();
  }

  clear() {
    this.contacts.clear();
    this.alerts = [];
    this.peers.clear();
    this.emit();
  }

  /** Ingest a raw local advert. */
  ingest(adv: RawAdvert, _source: string = "local") {
    const prev = this.contacts.get(adv.id);
    const now = adv.ts;
    const sample: RssiSample = { ts: now, rssi: adv.rssi ?? -120, heading: this.currentHeading };

    if (!prev) {
      const named = resolveName({
        id: adv.id,
        broadcastName: adv.name,
        manufacturer: adv.manufacturer,
        serviceUuids: adv.serviceUuids,
      });
      const meters = rssiToMeters(adv.rssi, adv.txPower);
      const c: Contact = {
        id: adv.id,
        displayName: named.displayName,
        rawName: adv.name,
        nameSource: named.nameSource,
        manufacturer: adv.manufacturer,
        inferredKind: named.inferredKind,
        serviceUuids: adv.serviceUuids,
        rssi: adv.rssi,
        distanceMeters: meters,
        distanceLabel: metersLabel(meters),
        zone: rssiZone(adv.rssi),
        firstSeen: now,
        lastSeen: now,
        samples: [sample],
        behavior: "active",
        threatTier: this.classifyTier(named.inferredKind),
        watchlisted: this.watchlist.has(adv.id),
        source: _source,
        bearing: null,
        bearingConfidence: 0,
        intel: null,
      };
      // store device handle off-record for GATT pull (don't serialize)
      (c as any).__device = adv.device;
      this.contacts.set(c.id, c);

      const cloneOf = this.findCloneSuspect(c);
      if (cloneOf) {
        c.behavior = "clone-suspect";
        this.alert("warn", `Clone suspect: ${c.displayName} appears on a second id`, c.id);
      } else if (SCENARIOS[this.cfg.scenario].alertOnNew || c.watchlisted) {
        this.alert(c.watchlisted ? "breach" : "info", `New contact · ${c.displayName}`, c.id);
      }

      if (SCENARIOS[this.cfg.scenario].allowGattAuto && adv.device) {
        // fire-and-forget — caller may also subscribe via onIntelPull
        this.pullIntel(c.id).catch(() => {/* */});
      }
    } else {
      if (prev.behavior === "lost") {
        prev.behavior = "resurrected";
        this.alert("warn", `Resurrected · ${prev.displayName}`, prev.id);
      } else if (prev.behavior !== "clone-suspect") {
        prev.behavior = "active";
      }
      prev.lastSeen = now;
      prev.rssi = adv.rssi ?? prev.rssi;
      prev.zone = rssiZone(prev.rssi);
      const meters = rssiToMeters(prev.rssi, adv.txPower);
      prev.distanceMeters = meters;
      prev.distanceLabel = metersLabel(meters);
      prev.samples.push(sample);
      if (prev.samples.length > SAMPLE_RING) prev.samples.splice(0, prev.samples.length - SAMPLE_RING);
      if (adv.name && prev.nameSource === "id-suffix") {
        prev.rawName = adv.name;
        prev.displayName = adv.name;
        prev.nameSource = "broadcast";
      }
      if (adv.manufacturer && !prev.manufacturer) prev.manufacturer = adv.manufacturer;
      if (adv.device && !(prev as any).__device) (prev as any).__device = adv.device;
      this.updateBearing(prev);
    }
    this.emit();
  }

  /** Merge a peer's hop report into the mission picture. */
  ingestHop(report: HopReport) {
    this.peers.set(report.nodeId, {
      label: report.nodeLabel,
      lastSeen: report.emittedAt,
      count: report.contacts.length,
    });
    for (const c of report.contacts) {
      const namespaced = { ...c, id: `${report.nodeId}::${c.id}`, source: report.nodeId };
      this.contacts.set(namespaced.id, namespaced);
    }
    this.emit();
  }

  /** Compute LOST transitions; call from a periodic timer. */
  tick() {
    const now = Date.now();
    const lostMs = SCENARIOS[this.cfg.scenario].lostMs;
    let changed = false;
    for (const c of this.contacts.values()) {
      if (c.source !== "local") continue; // don't time-out peer-reported
      if (c.behavior === "active" || c.behavior === "resurrected") {
        if (now - c.lastSeen > lostMs) {
          c.behavior = "lost";
          this.alert("info", `Signal lost · ${c.displayName}`, c.id);
          changed = true;
        }
      }
    }
    if (changed) this.emit();
  }

  /** Operator-triggered GATT pull. Respects Silent Observe. */
  async pullIntel(id: string): Promise<void> {
    if (this.cfg.scenario === "silent_observe") {
      this.alert("warn", "GATT pull blocked by Silent Observe");
      return;
    }
    const c = this.contacts.get(id);
    if (!c) return;
    const dev = (c as any).__device;
    if (!dev) {
      this.alert("warn", `No GATT handle for ${c.displayName}`, id);
      return;
    }
    const intel = await pullGattIntel(dev);
    c.intel = intel;
    // promote name if GATT gave us one
    if (intel.gattName && (c.nameSource === "id-suffix" || c.nameSource === "inferred")) {
      c.displayName = intel.gattName;
      c.nameSource = "gatt";
    }
    if (intel.manufacturer && !c.manufacturer) c.manufacturer = intel.manufacturer;
    this.cfg.onIntelPull?.(c);
    this.alert("info", `Intel pulled · ${c.displayName}`, id);
    this.emit();
  }

  /** Build a serializable hop report for peers. */
  emitHopReport(): HopReport {
    const contacts = [...this.contacts.values()]
      .filter((c) => c.source === "local")
      .map((c) => {
        // strip non-serializable device handle
        const { __device, ...rest } = c as any;
        void __device;
        return rest as Contact;
      });
    return {
      nodeId: this.cfg.nodeId,
      nodeLabel: this.cfg.nodeLabel,
      emittedAt: Date.now(),
      contacts,
    };
  }

  snapshot(): ZaxinSnapshot {
    return {
      scenario: this.cfg.scenario,
      scanning: false, // set by caller via emit wrapper
      contacts: [...this.contacts.values()].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999)),
      alerts: [...this.alerts].reverse().slice(0, 40),
      watchlist: [...this.watchlist],
      peers: Object.fromEntries(this.peers),
      poseActive: this.poseActive,
    };
  }

  // ---------- internals ----------
  private emit() { for (const fn of this.listeners) fn(this.snapshot()); }

  private alert(level: TacticalAlert["level"], message: string, contactId?: string) {
    this.alerts.push({ ts: Date.now(), level, message, contactId });
    if (this.alerts.length > 200) this.alerts.splice(0, this.alerts.length - 200);
  }

  private classifyTier(kind: string | null): ThreatTier {
    if (!kind) return "unknown";
    if (/tile|tracker|exposure/i.test(kind)) return "priority";
    return "known";
  }

  private findCloneSuspect(c: Contact): Contact | null {
    if (!c.displayName || c.nameSource === "id-suffix") return null;
    for (const other of this.contacts.values()) {
      if (other.id === c.id) continue;
      if (other.displayName === c.displayName) return other;
    }
    return null;
  }

  /** Estimate bearing from recent RSSI-gradient + heading samples.
   *  When the user faces the device, RSSI grows. We weight each heading
   *  sample by its positive ΔRSSI and take a circular mean. */
  private updateBearing(c: Contact) {
    const s = c.samples;
    if (s.length < 4) return;
    let sx = 0, sy = 0, w = 0;
    for (let i = 1; i < s.length; i++) {
      const h = s[i].heading;
      if (h == null) continue;
      const drssi = s[i].rssi - s[i - 1].rssi;
      if (drssi <= 0) continue;
      const wt = drssi;
      const rad = (h * Math.PI) / 180;
      sx += Math.cos(rad) * wt;
      sy += Math.sin(rad) * wt;
      w += wt;
    }
    if (w === 0) return;
    const ang = (Math.atan2(sy, sx) * 180) / Math.PI;
    c.bearing = (ang + 360) % 360;
    c.bearingConfidence = Math.min(1, w / 40);
  }
}

export type { TacticalAlert as Alert };
export { rssiZone, rssiToMeters, metersLabel };
