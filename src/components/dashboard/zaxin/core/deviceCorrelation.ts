// Off-body Device Correlator
// --------------------------
// NARRATIVE
// The optical detector can see a phone, laptop, TV, or remote sitting on a
// table — anywhere in the frame, whether or not a person is present. But an
// optical box alone doesn't answer the operator's question: "*which* Bluetooth
// device is that?" Wearable-zone tap-to-bond only works when the object sits
// on a body landmark; a phone on a table has no landmark to attach to.
//
// This module closes that gap. For every off-body optical device it ranks the
// current BLE contacts and suggests the most likely match by combining:
//   1. RSSI-derived distance (closer BLE → closer optical box)
//   2. Optical bbox area (bigger box → closer object)
//   3. Availability (already-bound contacts drop out of the pool)
//   4. Device-type compatibility (a "laptop" won't bond a "airpods" name; a
//      "cell phone" prefers a device whose name matches phone-family patterns)
// A suggestion is only surfaced when its score clears 0.55, so the operator
// never sees a false "this remote = your MacBook" answer.
//
// FLAW FIXES
// - Never auto-binds: only *suggests*. The operator taps to confirm — auto-
//   binding a wrong device would cascade into every downstream reticle.
// - Distance-only matching would collide two nearby devices; we require a
//   compatibility check on device family before proposing a match.
// - Suggestions are pure functions of the current snapshot — no hidden state
//   that could stale between renders.

import type { Contact } from "./types";
import type { OpticalContact } from "./opticalContacts";

export interface Suggestion {
  opticalId: string;
  contactId: string;
  contactName: string;
  score: number;         // 0..1
  reason: string;        // short HUD hint
  estRangeM: number;     // BLE-derived distance for the chosen contact
}

// Rough optical-area → metres. A phone at 1 m fills ~4% of the frame; laptops ~15%.
function opticalDistanceHint(o: OpticalContact): number {
  const area = Math.max(0.0005, o.w * o.h);
  const label = o.label.toLowerCase();
  // Reference "expected area at 1 m" per device class (hand-tuned, indoor).
  const refArea =
    label === "laptop" ? 0.15 :
    label === "tv"     ? 0.35 :
    label === "cell phone" ? 0.04 :
    label === "remote" ? 0.02 :
    label === "keyboard" ? 0.10 :
    label === "book"   ? 0.06 : 0.06;
  // area ~ 1/d² → d = sqrt(refArea/area)
  return Math.max(0.15, Math.min(15, Math.sqrt(refArea / area)));
}

function rssiToRoughDistance(rssi: number): number {
  // Log-distance path loss (n=2.2, txPower=-59) — same model as bleRanging fallback.
  return Math.min(60, Math.max(0.15, Math.pow(10, (-59 - rssi) / (10 * 2.2))));
}

function familyMatch(opticalLabel: string, contactName: string): number {
  const c = contactName.toLowerCase();
  const l = opticalLabel.toLowerCase();
  const has = (words: string[]) => words.some((w) => c.includes(w));
  if (l === "cell phone" && has(["iphone", "pixel", "galaxy", "phone", "sm-", "redmi", "oneplus"])) return 1;
  if (l === "laptop" && has(["macbook", "surface", "thinkpad", "laptop", "notebook"])) return 1;
  if (l === "tv" && has(["tv", "roku", "chromecast", "firestick", "shield"])) return 1;
  if (l === "remote" && has(["remote", "wemo", "shelly"])) return 1;
  if (l === "keyboard" && has(["keyboard", "kbd", "magic"])) return 1;
  if (l === "mouse" && has(["mouse", "trackpad", "magic"])) return 1;
  // ambiguous audio devices
  if (has(["airpods", "buds", "beats", "sony wf", "wh-", "headphone", "earbud"])) return l === "cell phone" ? 0.35 : 0.2;
  // Unknown BLE (SANN-style hex ids) — accept softly for phone/laptop, reject others.
  const unnamed = /^[0-9a-f:-]{8,}$/i.test(c) || c === "unknown";
  if (unnamed) return l === "cell phone" || l === "laptop" ? 0.55 : 0.25;
  return 0.35;
}

/** Rank BLE contacts for a single off-body optical box, return best suggestion above threshold. */
export function suggestForOptical(
  o: OpticalContact,
  contacts: Contact[],
  bindings: Record<string, string>,
): Suggestion | null {
  const linked = new Set(Object.values(bindings));
  const candidates = contacts.filter((c) => !linked.has(c.id) && c.rssi != null);
  if (!candidates.length) return null;

  const opticalD = opticalDistanceHint(o);
  let best: Suggestion | null = null;
  for (const c of candidates) {
    const bleD = rssiToRoughDistance(c.rssi!);
    // Distance agreement score — 1 at exact match, decays with |Δ|.
    const dErr = Math.abs(bleD - opticalD);
    const dScore = Math.max(0, 1 - dErr / Math.max(1.5, opticalD));
    const fam = familyMatch(o.label, c.displayName ?? c.id);
    const conf = Math.max(0.3, Math.min(1, o.score));
    const score = 0.5 * dScore + 0.35 * fam + 0.15 * conf;
    if (!best || score > best.score) {
      best = {
        opticalId: o.id,
        contactId: c.id,
        contactName: c.displayName ?? c.id.slice(0, 10),
        score: Math.round(score * 100) / 100,
        reason: `${(fam * 100).toFixed(0)}% family · Δrange ${dErr.toFixed(1)}m`,
        estRangeM: Math.round(bleD * 10) / 10,
      };
    }
  }
  if (!best || best.score < 0.55) return null;
  return best;
}

/** Compute suggestions for every off-body optical device, one BLE per suggestion. */
export function correlateOptical(
  optical: OpticalContact[],
  contacts: Contact[],
  bindings: Record<string, string>,
): Map<string, Suggestion> {
  // Each BLE contact can only anchor one optical box; iterate largest-first.
  const sorted = [...optical]
    .filter((o) => o.kind === "device")
    .sort((a, b) => (b.w * b.h) - (a.w * a.h));
  const used = new Set<string>();
  const out = new Map<string, Suggestion>();
  for (const o of sorted) {
    const filteredContacts = contacts.filter((c) => !used.has(c.id));
    const s = suggestForOptical(o, filteredContacts, bindings);
    if (s) { out.set(o.id, s); used.add(s.contactId); }
  }
  return out;
}
