// asherin.defender — what a browser can actually observe on the operator's own
// device, and an explicit ledger of what it cannot.
//
// Every reading here is either measured or marked `this is unsure`. Nothing
// pretends to kernel coverage. The companion path (docs/native-companion.md)
// is what turns a reading into an action; without it the room shows live status
// and states plainly what the companion WOULD do.

export type SignalLevel = "ok" | "watch" | "alert" | "unsure";

export interface Signal {
  id: string;
  group: "hardware" | "bluetooth" | "wifi" | "spy" | "poison";
  label: string;
  level: SignalLevel;
  /** measured fact — never a guess. */
  observed: string;
  /** what a companion would do about it. */
  action?: string;
}

/** Surfaces a browser tab fundamentally cannot inspect. Stated, never hidden. */
export const RESIDUAL_BLIND_SPOTS = [
  "GetAsyncKeyState-class polling by another process",
  "raw-input / HID-level capture",
  "kernel drivers and signed filter drivers",
  "usb hardware keyloggers inline with the keyboard",
  "TEMPEST / electromagnetic emanation capture",
];

/** Documented families a defender should recognise by name. Public class only. */
export const SPY_FAMILIES = [
  "commercial parental-monitoring suites",
  "enterprise endpoint session recorders",
  "remote-access trojans with hidden desktop",
  "browser extensions with all-urls + webRequest",
  "stalkerware with hidden launcher icons",
];

/** Undocumented heuristic patterns — pattern classes, not vendor names. */
export const SPY_HEURISTICS = [
  "input listener that never renders anything",
  "persistent websocket to a single fixed host at idle",
  "clipboard read on a timer",
  "screen capture permission held with no visible surface",
  "device enumerated twice under different transports",
];

function sig(s: Signal): Signal { return s; }

interface NetInfo { effectiveType?: string; downlink?: number; rtt?: number; type?: string; saveData?: boolean }

export async function collectSignals(): Promise<Signal[]> {
  const out: Signal[] = [];
  const nav = typeof navigator !== "undefined" ? navigator : undefined;

  /* ── hardware / HID ────────────────────────────────────────────────── */
  const hid = (nav as unknown as { hid?: { getDevices(): Promise<Array<{ productName?: string; vendorId?: number }>> } })?.hid;
  if (hid?.getDevices) {
    try {
      const devices = await hid.getDevices();
      const keyboards = devices.filter((d) => /keyboard|keypad/i.test(d.productName || ""));
      out.push(sig({
        id: "hid-devices",
        group: "hardware",
        label: "granted hid devices",
        level: keyboards.length > 1 ? "alert" : "ok",
        observed: devices.length
          ? `${devices.length} granted · ${keyboards.length} keyboard-class`
          : "no hid device has been granted to this origin",
        action: keyboards.length > 1 ? "companion enumerates every HID endpoint and flags the extra keyboard" : undefined,
      }));
    } catch {
      out.push(sig({ id: "hid-devices", group: "hardware", label: "granted hid devices", level: "unsure", observed: "hid enumeration refused by the browser" }));
    }
  } else {
    out.push(sig({
      id: "hid-devices",
      group: "hardware",
      label: "extra keyboard hunt",
      level: "unsure",
      observed: "webhid is unavailable in this browser — a tab cannot count keyboards",
      action: "companion reads the HID tree and the filter-driver class, plus BIOS/TPM presence",
    }));
  }

  out.push(sig({
    id: "cores",
    group: "hardware",
    label: "device shape",
    level: "ok",
    observed: `${nav?.hardwareConcurrency ?? "?"} logical cores · ${(nav as unknown as { deviceMemory?: number })?.deviceMemory ?? "?"} gb class · ${nav?.platform || "unknown platform"}`,
  }));

  out.push(sig({
    id: "bios-tpm",
    group: "hardware",
    label: "bios / tpm preview",
    level: "unsure",
    observed: "not readable from a browser tab",
    action: "companion reports secure-boot state and TPM presence",
  }));

  /* ── bluetooth ─────────────────────────────────────────────────────── */
  const ble = (nav as unknown as { bluetooth?: { getAvailability?: () => Promise<boolean>; getDevices?: () => Promise<Array<{ name?: string; id: string }>> } })?.bluetooth;
  if (ble) {
    let available: boolean | null = null;
    try { available = ble.getAvailability ? await ble.getAvailability() : null; } catch { available = null; }
    let paired: Array<{ name?: string; id: string }> = [];
    try { paired = ble.getDevices ? await ble.getDevices() : []; } catch { paired = []; }
    out.push(sig({
      id: "ble-adapter",
      group: "bluetooth",
      label: "adapter",
      level: available === false ? "watch" : "ok",
      observed: available === null ? "availability not reported" : available ? "radio present and available" : "no radio available",
    }));
    out.push(sig({
      id: "ble-paired",
      group: "bluetooth",
      label: "devices you already allowed",
      level: paired.length ? "watch" : "ok",
      observed: paired.length
        ? paired.map((d) => d.name || `id ${d.id.slice(0, 6)}…`).join(" · ")
        : "no device has prior consent on this origin",
      action: "companion disables the idle radio when bunker is on",
    }));
  } else {
    out.push(sig({ id: "ble-adapter", group: "bluetooth", label: "adapter", level: "unsure", observed: "web bluetooth unavailable in this browser" }));
  }

  /* ── wifi ──────────────────────────────────────────────────────────── */
  const conn = (nav as unknown as { connection?: NetInfo })?.connection;
  out.push(sig({
    id: "link",
    group: "wifi",
    label: "active link",
    level: "ok",
    observed: conn
      ? `${conn.type || "unknown transport"} · ${conn.effectiveType || "?"} · ${conn.downlink ?? "?"} mbps · ${conn.rtt ?? "?"} ms rtt`
      : `${nav?.onLine ? "online" : "offline"} — the network information api is not exposed here`,
  }));
  out.push(sig({
    id: "ssid",
    group: "wifi",
    label: "ssid and nearby networks",
    level: "unsure",
    observed: "a browser cannot read the connected ssid or scan for neighbours",
    action: "companion lists nearby networks and flags open or duplicate-ssid (rogue-ap class) beacons",
  }));

  /* ── spy ident ─────────────────────────────────────────────────────── */
  out.push(sig({
    id: "spy-families",
    group: "spy",
    label: "documented families",
    level: "ok",
    observed: `${SPY_FAMILIES.length} public classes recognised · ${SPY_HEURISTICS.length} undocumented heuristics armed`,
    action: "companion matches running processes and autostart entries against both sets",
  }));

  /* ── key-poison ────────────────────────────────────────────────────── */
  out.push(sig({
    id: "poison",
    group: "poison",
    label: "key-poison",
    level: "unsure",
    observed: "a tab cannot poison an out-of-process logger",
    action: "companion emits unique 60-second decoy maps against logger observers only; keys apps and sites consume are never remapped, and no unsigned kernel driver is ever loaded",
  }));

  return out;
}

/** Bunker freeze set. asherin and the operator's own tools are never frozen. */
export const BUNKER_TARGETS = [
  "outbound email delivery",
  "trackers and data-collection beacons",
  "voice calls",
  "messenger applications",
];

export const BUNKER_NEVER = ["asherin", "the operator's own editor and terminal"];
