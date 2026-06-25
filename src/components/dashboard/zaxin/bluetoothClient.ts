/**
 * Zaxin BLE Client — vendored from houseofasher/bluetooth_software.
 *
 * MIT License — Copyright (c) 2026 shep95
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
 */

export type NameSource = "broadcast" | "paired" | "gatt" | "inferred" | "address";
export type ProximityZone = "immediate" | "near" | "far" | "unknown";
export type ScanPhase = "idle" | "running" | "resolving" | "pulling" | "completed" | "failed";
export type ThreatTier = "friendly" | "known" | "unknown" | "priority" | "breach";
export type ScenarioId = "standard" | "perimeter" | "asset_recovery" | "silent_observe" | "deep_pull";

export interface HealthStatus { ready: boolean; message: string; reason?: string; }
export interface ScannerLocation {
  latitude: number | null; longitude: number | null; accuracyMeters: number | null;
  address: string | null; addressShort: string | null; source: string | null; ready: boolean;
}
export interface ScannedDevice {
  id: string; displayName: string; name: string; nameSource: NameSource;
  manufacturer: string | null; inferredDetail: string | null;
  rssi: number | null; distanceMeters: number | null; distanceLabel: string;
  proximityZone: ProximityZone; lastSeen: number;
  threatTier?: ThreatTier; hopDepth?: number | null;
}
export interface TacticalSnapshot {
  brand: string; missionId: string; missionPhase: string; missionLabel: string;
  scenario: { id: ScenarioId; label: string; description: string };
  interference: { level: string; label: string; score: number };
  alerts: Array<{ ts: number; message: string; mac?: string }>;
  watchlist: string[];
  dominoBreaches: Array<{ target: string; hopDepth: number; breachLabel: string; path: string[] }>;
  ticker: string;
}
export interface ScanSnapshot {
  phase: ScanPhase; running: boolean; error: string | null;
  devices: ScannedDevice[]; count: number;
  scannerLocation: ScannerLocation;
  zeroResultHint: string | null;
  tactical?: TacticalSnapshot;
}

const DEFAULT_BASE = "http://127.0.0.1:8765";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

export class ZaxinBridge {
  constructor(private baseUrl: string = DEFAULT_BASE) {
    this.baseUrl = this.baseUrl.replace(/\/$/, "");
  }
  health() { return fetchJson<HealthStatus>(`${this.baseUrl}/api/health`); }
  devices() { return fetchJson<ScanSnapshot>(`${this.baseUrl}/api/devices`); }
  tactical() { return fetchJson<TacticalSnapshot>(`${this.baseUrl}/api/tactical`); }
  start() { return fetchJson(`${this.baseUrl}/api/scan`, { method: "POST" }); }
  stop() { return fetchJson(`${this.baseUrl}/api/stop`, { method: "POST" }); }
  setScenario(scenario: ScenarioId) {
    return fetchJson(`${this.baseUrl}/api/scenario`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario }),
    });
  }
  toggleWatchlist(address: string) {
    return fetchJson(`${this.baseUrl}/api/watchlist`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, action: "toggle" }),
    });
  }
}

/** Browser-native BLE scan via Web Bluetooth (Android Chrome). */
export interface WebBleDevice {
  id: string;
  name: string;
  rssi: number | null;
  manufacturer: string | null;
  lastSeen: number;
  proximityZone: ProximityZone;
  distanceLabel: string;
}

export function webBleSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in (navigator as any);
}

export function webBleScanSupported(): boolean {
  return webBleSupported() && typeof ((navigator as any).bluetooth)?.requestLEScan === "function";
}

function rssiToZone(rssi: number | null): ProximityZone {
  if (rssi == null) return "unknown";
  if (rssi >= -55) return "immediate";
  if (rssi >= -75) return "near";
  return "far";
}
function rssiToLabel(rssi: number | null): string {
  if (rssi == null) return "—";
  // Path-loss estimate: d = 10^((TxPower - RSSI) / (10 * n)), TxPower≈-59, n≈2
  const d = Math.pow(10, (-59 - rssi) / 20);
  if (d < 1) return `${(d * 100).toFixed(0)} cm`;
  return `${d.toFixed(1)} m`;
}

export async function startWebBleScan(
  onDevice: (d: WebBleDevice) => void,
): Promise<{ stop: () => void }> {
  if (!webBleScanSupported()) {
    throw new Error(
      "Live BLE scan needs Chrome on Android with the 'Experimental Web Platform features' flag enabled (chrome://flags). iOS Safari does not support Web Bluetooth — use the Local Bridge mode for full scanning.",
    );
  }
  const bt = (navigator as any).bluetooth as any;
  const handler = (event: any) => {
    const d: WebBleDevice = {
      id: event.device?.id ?? event.device?.name ?? "unknown",
      name: event.device?.name ?? "(unnamed)",
      rssi: event.rssi ?? null,
      manufacturer: null,
      lastSeen: Date.now(),
      proximityZone: rssiToZone(event.rssi ?? null),
      distanceLabel: rssiToLabel(event.rssi ?? null),
    };
    onDevice(d);
  };
  bt.addEventListener("advertisementreceived", handler);
  const scan = await bt.requestLEScan({ acceptAllAdvertisements: true });
  return {
    stop: () => {
      try { scan.stop(); } catch {/* */}
      bt.removeEventListener("advertisementreceived", handler);
    },
  };
}

/** One-shot device picker fallback for browsers without requestLEScan (most). */
export async function pickWebBleDevice(): Promise<WebBleDevice> {
  if (!webBleSupported()) throw new Error("Web Bluetooth not available in this browser.");
  const device = await ((navigator as any).bluetooth as any).requestDevice({ acceptAllDevices: true });
  return {
    id: device.id,
    name: device.name ?? "(unnamed)",
    rssi: null,
    manufacturer: null,
    lastSeen: Date.now(),
    proximityZone: "unknown",
    distanceLabel: "—",
  };
}
