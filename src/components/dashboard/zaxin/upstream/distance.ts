// Ported verbatim from houseofasher/bluetooth_software/src/ble/distance.ts
// Log-distance path-loss model for BLE RSSI → meters estimation.
// MIT — © #houseofasher. Browser-safe (no Node deps).

export const DEFAULT_TX_POWER = -59; // dBm at 1 m (typical BLE fallback)
export const PATH_LOSS_EXPONENT = 2.0;

export type ProximityZone = "immediate" | "near" | "far" | "unknown";

export const METERS_TO_FEET = 3.28084;
export const METERS_TO_MILES = 1 / 1609.344;

export function estimateDistanceMeters(
  rssi: number | null | undefined,
  txPower?: number | null,
  pathLossExponent: number = PATH_LOSS_EXPONENT,
): number | null {
  if (rssi == null || !isFinite(rssi)) return null;
  const tx = txPower ?? DEFAULT_TX_POWER;
  const ratio = (tx - rssi) / (10 * pathLossExponent);
  return Math.pow(10, ratio);
}

export function proximityZone(distanceM: number | null): ProximityZone {
  if (distanceM == null) return "unknown";
  if (distanceM < 1) return "immediate";
  if (distanceM < 5) return "near";
  return "far";
}

export function formatDistance(distanceM: number | null): string {
  if (distanceM == null) return "—";
  if (distanceM < 1) return `${(distanceM * 100).toFixed(0)} cm`;
  if (distanceM < 10) return `${distanceM.toFixed(1)} m`;
  if (distanceM < 1000) return `${distanceM.toFixed(0)} m`;
  return `${(distanceM / 1000).toFixed(2)} km`;
}
