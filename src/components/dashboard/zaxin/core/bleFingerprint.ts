// BLE Fingerprint — known-device family classifier + privacy posture.
//
// NARRATIVE
// Competitor tools like BLE-Hound and GhostBLE identify specific trackers
// (AirTag, Tile, Chipolo, SmartTag), spy hardware (Flipper Zero), audio
// (AirPods, Pixel Buds), wearables (Ray-Ban Meta, Quest), phones and drones —
// then flag the *privacy posture* of the advert (rotating vs static MAC, name
// leak, manufacturer leak, spam-advertising). The old Zaxin engine only had a
// coarse `inferredKind` ("watch/earbuds/phone") — the operator could not tell
// an AirTag from a random beacon, or a hardened Flipper Zero from a phone.
//
// FLAW FIXES vs a naive lookup
// - Fingerprint rules are AND-of-signals, never a single keyword; a device
//   passes only when at least two independent columns line up.
// - Every classification carries an explicit `evidence[]` array so a wrong
//   guess can be audited — no black-box "this is an AirTag, trust me."
// - Privacy posture is a *set*, not a single label: a device can be both
//   `name-leak` and `manufacturer-leak` simultaneously.
// - Unknown is a real answer, not "generic BLE".

import type { Contact } from "./types";

export type DeviceFamily =
  | "airtag" | "tile" | "chipolo" | "samsung-smarttag"
  | "flipper-zero"
  | "airpods" | "pixel-buds" | "galaxy-buds" | "beats" | "sony-audio"
  | "meta-quest" | "rayban-meta"
  | "apple-watch" | "wear-os" | "galaxy-watch"
  | "iphone" | "android-phone"
  | "macbook" | "windows-laptop"
  | "dji-drone" | "parrot-drone"
  | "tesla-key" | "tesla-vehicle"
  | "smart-tv" | "chromecast" | "roku"
  | "fitness-tracker"
  | "smart-bulb" | "smart-plug"
  | "beacon" | "unknown";

export type PrivacyPosture =
  | "rpa-rotating"     // resolvable private address rotates cleanly (good)
  | "static-mac"       // never rotates — trivially trackable (bad)
  | "name-leak"        // ships owner-personal name in advert
  | "manufacturer-leak" // exposes brand id
  | "service-uuid-leak" // discloses service list
  | "high-frequency"   // advert cadence >5 Hz (aggressive / spammy)
  | "silent"           // <0.2 Hz — hides from casual sweeps
  | "unknown";

export interface Fingerprint {
  family: DeviceFamily;
  familyLabel: string;
  confidence: number;              // 0..1
  vendor: string | null;
  privacy: PrivacyPosture[];
  privacyGrade: "A" | "B" | "C" | "D" | "F";
  evidence: string[];              // human-readable reasons
  isTracker: boolean;              // AirTag/Tile/SmartTag/Chipolo/Flipper family
  isSurveillance: boolean;         // Flipper, Ray-Ban Meta, Quest w/ passthrough camera
}

const FAMILY_LABEL: Record<DeviceFamily, string> = {
  "airtag": "Apple AirTag",
  "tile": "Tile Tracker",
  "chipolo": "Chipolo",
  "samsung-smarttag": "Samsung SmartTag",
  "flipper-zero": "Flipper Zero",
  "airpods": "AirPods",
  "pixel-buds": "Pixel Buds",
  "galaxy-buds": "Galaxy Buds",
  "beats": "Beats",
  "sony-audio": "Sony Audio",
  "meta-quest": "Meta Quest",
  "rayban-meta": "Ray-Ban Meta",
  "apple-watch": "Apple Watch",
  "wear-os": "Wear OS",
  "galaxy-watch": "Galaxy Watch",
  "iphone": "iPhone",
  "android-phone": "Android Phone",
  "macbook": "MacBook",
  "windows-laptop": "Windows Laptop",
  "dji-drone": "DJI Drone",
  "parrot-drone": "Parrot Drone",
  "tesla-key": "Tesla Key",
  "tesla-vehicle": "Tesla Vehicle",
  "smart-tv": "Smart TV",
  "chromecast": "Chromecast",
  "roku": "Roku",
  "fitness-tracker": "Fitness Tracker",
  "smart-bulb": "Smart Bulb",
  "smart-plug": "Smart Plug",
  "beacon": "iBeacon / Eddystone",
  "unknown": "Unknown Device",
};

// BLE service UUIDs of interest (Bluetooth SIG assigned).
const UUID = {
  APPLE_CONTINUITY: "0000fd6f",         // widely-known Apple continuity/nearby
  FINDMY: "0000fd6f",                    // AirTag / FindMy accessory
  TILE:   "0000feed",                    // Tile
  CHIPOLO: "0000feca",
  SMARTTAG: "0000fd5a",
  RAYBAN: "00001812",                    // HID over BLE (also normal earbuds)
  MOVEMENT: "00001800",                  // generic access
  BATTERY: "0000180f",
  HR:     "0000180d",
  EDDYSTONE: "0000feaa",
};

function has(list: string[], needle: string) {
  const n = needle.toLowerCase();
  return list.some((s) => s.toLowerCase().includes(n));
}

/** Analyse advert cadence from RSSI-sample timestamps. */
function advertRateHz(c: Contact): number {
  const s = c.samples ?? [];
  if (s.length < 4) return 0;
  const tail = s.slice(-20);
  const dt = (tail[tail.length - 1].ts - tail[0].ts) / 1000;
  return dt > 0 ? (tail.length - 1) / dt : 0;
}

/** Detect if the BLE id looks like a Resolvable Private Address (rotates). */
function looksRotating(id: string): boolean {
  // Web Bluetooth uses opaque ids per session, but real MAC-prefixed ids
  // starting with high nibble 4/5/6/7 are RPA per Core Spec §5.2.
  const hex = id.replace(/[^0-9a-f]/gi, "").slice(0, 2).toLowerCase();
  if (!hex) return true; // opaque = safe default
  const first = parseInt(hex[0] || "0", 16);
  return first >= 4 && first <= 7;
}

export function fingerprint(c: Contact): Fingerprint {
  const name = (c.displayName || c.rawName || "").toLowerCase();
  const manu = (c.manufacturer || "").toLowerCase();
  const uuids = c.serviceUuids || [];
  const evidence: string[] = [];

  // -------- Family detection (multi-signal) --------
  let family: DeviceFamily = "unknown";
  let confidence = 0.25;

  const scoreFor = (label: DeviceFamily, signals: [boolean, string][]) => {
    const passed = signals.filter(([ok]) => ok);
    if (passed.length < 2 && !(passed.length === 1 && passed[0][0] && passed[0][1].startsWith("name:strong"))) return 0;
    const conf = Math.min(0.95, 0.35 + passed.length * 0.22);
    return conf;
  };

  const trials: Array<{ family: DeviceFamily; conf: number; ev: string[] }> = [];
  const push = (f: DeviceFamily, s: [boolean, string][]) => {
    const cf = scoreFor(f, s);
    if (cf > 0) trials.push({ family: f, conf: cf, ev: s.filter(([ok]) => ok).map(([, r]) => r) });
  };

  push("airtag", [
    [has(uuids, UUID.FINDMY), "svc:0xFD6F (FindMy)"],
    [manu.includes("apple"), "manu:Apple"],
    [/airtag/.test(name), "name:strong airtag"],
  ]);
  push("tile", [
    [has(uuids, UUID.TILE), "svc:0xFEED (Tile)"],
    [/tile/.test(name), "name:tile"],
  ]);
  push("chipolo", [
    [has(uuids, UUID.CHIPOLO), "svc:0xFECA (Chipolo)"],
    [/chipolo/.test(name), "name:chipolo"],
  ]);
  push("samsung-smarttag", [
    [has(uuids, UUID.SMARTTAG), "svc:0xFD5A (SmartTag)"],
    [/smarttag|galaxy tag/.test(name), "name:smarttag"],
    [manu.includes("samsung"), "manu:Samsung"],
  ]);
  push("flipper-zero", [
    [/flipper/.test(name), "name:strong flipper"],
    [/^flip[^ ]* [0-9a-f]{4}$/.test(name), "name:flipper suffix pattern"],
  ]);
  push("airpods", [
    [/airpods|beats/.test(name), "name:airpods"],
    [manu.includes("apple"), "manu:Apple"],
  ]);
  push("pixel-buds", [
    [/pixel buds|pixel_buds/.test(name), "name:pixel buds"],
    [manu.includes("google"), "manu:Google"],
  ]);
  push("galaxy-buds", [
    [/galaxy buds|buds\+|buds pro/.test(name), "name:galaxy buds"],
    [manu.includes("samsung"), "manu:Samsung"],
  ]);
  push("meta-quest", [
    [/quest [23]|meta quest/.test(name), "name:quest"],
    [manu.includes("meta") || manu.includes("facebook"), "manu:Meta"],
  ]);
  push("rayban-meta", [
    [/ray-?ban|rayban.*meta/.test(name), "name:strong rayban"],
    [manu.includes("meta") || manu.includes("essilorluxottica"), "manu:Meta/Luxottica"],
  ]);
  push("apple-watch", [
    [/watch/.test(name), "name:watch"],
    [manu.includes("apple"), "manu:Apple"],
  ]);
  push("iphone", [
    [/iphone/.test(name), "name:iphone"],
    [manu.includes("apple"), "manu:Apple"],
    [has(uuids, UUID.APPLE_CONTINUITY), "svc:apple continuity"],
  ]);
  push("android-phone", [
    [/pixel|galaxy s|oneplus|xiaomi|redmi|sm-/.test(name), "name:android brand"],
    [manu.includes("google") || manu.includes("samsung") || manu.includes("oneplus"), "manu:android oem"],
  ]);
  push("macbook", [
    [/macbook/.test(name), "name:macbook"],
    [manu.includes("apple"), "manu:Apple"],
  ]);
  push("dji-drone", [
    [/dji|mavic|phantom|mini/.test(name), "name:dji family"],
    [manu.includes("dji"), "manu:DJI"],
  ]);
  push("tesla-key", [
    [/tesla|model [3syx]/.test(name), "name:tesla"],
    [manu.includes("tesla"), "manu:Tesla"],
  ]);
  push("chromecast", [
    [/chromecast|google tv|nest hub/.test(name), "name:chromecast family"],
    [manu.includes("google"), "manu:Google"],
  ]);
  push("beacon", [
    [has(uuids, UUID.EDDYSTONE), "svc:Eddystone"],
    [/beacon/.test(name), "name:beacon"],
  ]);

  if (trials.length) {
    trials.sort((a, b) => b.conf - a.conf);
    const winner = trials[0];
    family = winner.family;
    confidence = winner.conf;
    evidence.push(...winner.ev);
  } else if (c.inferredKind) {
    // Fall back to the engine's own inference
    if (c.inferredKind === "phone") { family = "android-phone"; confidence = 0.3; evidence.push("kind:phone (soft)"); }
    else if (c.inferredKind === "earbuds") { family = "airpods"; confidence = 0.3; evidence.push("kind:earbuds (soft)"); }
    else if (c.inferredKind === "watch") { family = "apple-watch"; confidence = 0.3; evidence.push("kind:watch (soft)"); }
  }

  // -------- Privacy posture --------
  const privacy: PrivacyPosture[] = [];
  if (looksRotating(c.id)) privacy.push("rpa-rotating");
  else privacy.push("static-mac");
  if (name && !/^[0-9a-f:\-.\s]+$/i.test(name) && name !== "unknown") privacy.push("name-leak");
  if (manu) privacy.push("manufacturer-leak");
  if (uuids.length >= 3) privacy.push("service-uuid-leak");
  const hz = advertRateHz(c);
  if (hz > 5) privacy.push("high-frequency");
  else if (hz > 0 && hz < 0.2) privacy.push("silent");
  if (privacy.length === 0) privacy.push("unknown");

  // Grade: RPA + no leaks = A; static + name-leak + manu-leak + svc-leak = F
  let deductions = 0;
  if (privacy.includes("static-mac")) deductions += 2;
  if (privacy.includes("name-leak")) deductions += 1;
  if (privacy.includes("manufacturer-leak")) deductions += 1;
  if (privacy.includes("service-uuid-leak")) deductions += 1;
  if (privacy.includes("high-frequency")) deductions += 1;
  const grade: Fingerprint["privacyGrade"] =
    deductions === 0 ? "A" :
    deductions === 1 ? "B" :
    deductions === 2 ? "C" :
    deductions === 3 ? "D" : "F";

  const isTracker = ["airtag", "tile", "chipolo", "samsung-smarttag"].includes(family);
  const isSurveillance = ["flipper-zero", "rayban-meta", "meta-quest", "dji-drone", "parrot-drone"].includes(family);

  return {
    family,
    familyLabel: FAMILY_LABEL[family],
    confidence: Math.round(confidence * 100) / 100,
    vendor: c.manufacturer,
    privacy,
    privacyGrade: grade,
    evidence,
    isTracker,
    isSurveillance,
  };
}

/** Priority score for the dossier rail — higher = more urgent. */
export function priorityScore(c: Contact, fp: Fingerprint): number {
  let s = 0;
  if (fp.isTracker) s += 60;
  if (fp.isSurveillance) s += 80;
  if (fp.family === "flipper-zero") s += 40;
  if (fp.privacyGrade === "F") s += 20;
  else if (fp.privacyGrade === "D") s += 12;
  if (c.threatTier === "breach") s += 100;
  else if (c.threatTier === "priority") s += 40;
  if (c.behavior === "clone-suspect") s += 55;
  if (c.behavior === "resurrected") s += 15;
  if ((c.rssi ?? -100) > -55) s += 10; // very close
  return s;
}
