// Zaxin core types — five-brain BLE tactical scanner.
// © #houseofasher · designed from the Asher BLE theory dossier.

export type NameSource =
  | "broadcast"   // device.name from advert / picker
  | "paired"      // navigator.bluetooth.getDevices() prior consent
  | "gatt"        // 0x2a00 Device Name characteristic
  | "inferred"    // manufacturer / service-UUID heuristic
  | "id-suffix";  // last resort: opaque id tail

export type ProximityZone = "immediate" | "near" | "far" | "unknown";

export type BehaviorState =
  | "active"        // seen recently
  | "lost"          // no advert in window
  | "resurrected"   // lost → seen again
  | "clone-suspect"; // same display name, different id

export type ThreatTier = "friendly" | "known" | "unknown" | "priority" | "breach";

export type ScenarioId =
  | "standard"
  | "perimeter"
  | "asset_recovery"
  | "silent_observe"
  | "deep_pull";

export interface RssiSample {
  ts: number;
  rssi: number;
  /** compass heading in degrees, 0=N, if PoseSense is active */
  heading?: number | null;
}

export interface Contact {
  id: string;                       // opaque Web BLE id (or peer-prefixed id)
  displayName: string;
  rawName: string | null;
  nameSource: NameSource;
  manufacturer: string | null;
  inferredKind: string | null;      // "watch" | "earbuds" | "phone" | …
  serviceUuids: string[];
  rssi: number | null;
  distanceMeters: number | null;
  distanceLabel: string;
  zone: ProximityZone;
  firstSeen: number;
  lastSeen: number;
  samples: RssiSample[];            // bounded ring
  behavior: BehaviorState;
  threatTier: ThreatTier;
  watchlisted: boolean;
  /** "local" | hop nodeId */
  source: string;
  /** AR bearing estimate (deg, 0=N) if PoseSense ran */
  bearing: number | null;
  bearingConfidence: number;        // 0..1
  /** GATT pull results when available */
  intel: GattIntel | null;
}

export interface GattIntel {
  pulledAt: number;
  gattName?: string;
  manufacturer?: string;
  modelNumber?: string;
  firmwareRev?: string;
  batteryLevel?: number;
  services: string[];
  errors: string[];
}

export interface TacticalAlert {
  ts: number;
  level: "info" | "warn" | "breach";
  message: string;
  contactId?: string;
}

export interface HopReport {
  nodeId: string;
  nodeLabel: string;
  emittedAt: number;
  contacts: Contact[];
}

export interface ZaxinSnapshot {
  scenario: ScenarioId;
  scanning: boolean;
  contacts: Contact[];
  alerts: TacticalAlert[];
  watchlist: string[];
  peers: Record<string, { label: string; lastSeen: number; count: number }>;
  poseActive: boolean;
}
