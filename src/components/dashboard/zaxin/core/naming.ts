// Naming brain — turn an unknown radio into a readable label.
// Cascade: broadcast → paired → GATT (caller-supplied) → inferred → id-suffix.

import type { NameSource } from "./types";

/** Apple Bluetooth manufacturer prefix (Company ID 0x004C). */
const MFG_HINTS: Array<{ test: (mfg: string) => boolean; kind: string }> = [
  { test: (m) => /apple/i.test(m), kind: "Apple device" },
  { test: (m) => /samsung/i.test(m), kind: "Samsung device" },
  { test: (m) => /google|fitbit|nest/i.test(m), kind: "Google / Fitbit" },
  { test: (m) => /xiaomi|huami|amazfit/i.test(m), kind: "Xiaomi / Amazfit" },
  { test: (m) => /garmin/i.test(m), kind: "Garmin tracker" },
  { test: (m) => /tile/i.test(m), kind: "Tile tag" },
  { test: (m) => /microsoft/i.test(m), kind: "Microsoft device" },
];

// Standard service UUID → kind (lowercased, no dashes for stability)
const SERVICE_HINTS: Record<string, string> = {
  "0000180d": "Heart rate sensor",
  "00001812": "HID peripheral",
  "0000110b": "Audio sink",
  "0000110a": "Audio source",
  "0000fd6f": "Exposure-notification beacon",
  "0000fe9f": "Google Fast Pair",
  "0000fdab": "Apple Continuity",
};

export interface NameResolveInput {
  id: string;
  broadcastName: string | null;
  pairedName?: string | null;
  gattName?: string | null;
  manufacturer?: string | null;
  serviceUuids?: string[];
}

export interface NameResolveOutput {
  displayName: string;
  nameSource: NameSource;
  inferredKind: string | null;
}

export function resolveName(input: NameResolveInput): NameResolveOutput {
  const kind = inferKind(input.manufacturer, input.serviceUuids);

  if (input.broadcastName && input.broadcastName.trim()) {
    return { displayName: input.broadcastName.trim(), nameSource: "broadcast", inferredKind: kind };
  }
  if (input.pairedName && input.pairedName.trim()) {
    return { displayName: input.pairedName.trim(), nameSource: "paired", inferredKind: kind };
  }
  if (input.gattName && input.gattName.trim()) {
    return { displayName: input.gattName.trim(), nameSource: "gatt", inferredKind: kind };
  }
  if (kind) {
    return { displayName: kind, nameSource: "inferred", inferredKind: kind };
  }
  const tail = input.id.slice(-6).toUpperCase();
  return { displayName: `Unknown · ${tail}`, nameSource: "id-suffix", inferredKind: null };
}

export function inferKind(
  manufacturer: string | null | undefined,
  services: string[] | undefined,
): string | null {
  if (manufacturer) {
    for (const h of MFG_HINTS) if (h.test(manufacturer)) return h.kind;
  }
  if (services?.length) {
    for (const s of services) {
      const key = s.toLowerCase().replace(/-/g, "").slice(0, 8);
      if (SERVICE_HINTS[key]) return SERVICE_HINTS[key];
    }
  }
  return null;
}
