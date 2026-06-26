// Intel brain — pull standard GATT services from a device on operator demand.
// Used by Deep Pull scenarios and the per-device "Pull Intel" action.

import type { GattIntel } from "./types";

const DEVICE_INFO = "device_information";
const BATTERY    = "battery_service";
const GENERIC    = "generic_access";

async function readUtf8(svc: any, char: string): Promise<string | undefined> {
  try {
    const c = await svc.getCharacteristic(char);
    const v = await c.readValue();
    return new TextDecoder().decode(v).replace(/\0+$/, "");
  } catch { return undefined; }
}

async function readU8(svc: any, char: string): Promise<number | undefined> {
  try {
    const c = await svc.getCharacteristic(char);
    const v = await c.readValue();
    return v.getUint8(0);
  } catch { return undefined; }
}

export async function pullGattIntel(device: any): Promise<GattIntel> {
  const intel: GattIntel = {
    pulledAt: Date.now(),
    services: [],
    errors: [],
  };
  if (!device?.gatt) {
    intel.errors.push("Device has no GATT interface.");
    return intel;
  }
  try {
    const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
    const services: any[] = await server.getPrimaryServices().catch(() => []);
    intel.services = services.map((s) => s.uuid);

    const di = services.find((s) => s.uuid.includes("180a"));
    if (di) {
      intel.manufacturer = await readUtf8(di, "manufacturer_name_string");
      intel.modelNumber  = await readUtf8(di, "model_number_string");
      intel.firmwareRev  = await readUtf8(di, "firmware_revision_string");
    } else {
      try {
        const s = await server.getPrimaryService(DEVICE_INFO);
        intel.manufacturer = await readUtf8(s, "manufacturer_name_string");
        intel.modelNumber  = await readUtf8(s, "model_number_string");
        intel.firmwareRev  = await readUtf8(s, "firmware_revision_string");
      } catch {/* */}
    }

    try {
      const ga = await server.getPrimaryService(GENERIC);
      intel.gattName = await readUtf8(ga, "gap.device_name");
    } catch {/* */}

    try {
      const bs = await server.getPrimaryService(BATTERY);
      intel.batteryLevel = await readU8(bs, "battery_level");
    } catch {/* */}

    try { server.disconnect?.(); } catch { /* */ }
  } catch (e) {
    intel.errors.push(e instanceof Error ? e.message : String(e));
  }
  return intel;
}
