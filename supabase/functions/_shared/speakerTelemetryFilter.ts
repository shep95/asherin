// ══════════════════════════════════════════════════════════════════════════════
// SPEAKER TELEMETRY FILTER
//
// The signed-in operator is the person being answered, never a subject being
// profiled. Anything that looks like network or location telemetry is dropped
// from the prompt BEFORE the model can see it — once a value is in the prompt
// it can be recited in a bubble, and no amount of contract text is a substitute
// for the value simply not being there.
//
// Shared (not inlined in chat/index.ts) so the edge function and its unit tests
// enforce the same single definition.
// ══════════════════════════════════════════════════════════════════════════════

/** Trait keys that carry request/network/location telemetry about the speaker. */
export const TELEMETRY_KEY =
  /(^|_)(ip|ipv4|ipv6|ip_address|addr|address|geo|geoip|location|lat|latitude|lon|lng|longitude|coords?|city|region|country|timezone|tz|isp|asn|vpn|proxy|user_agent|ua|device_id|mac)($|_)/i;

/** Values shaped like an IPv4 or IPv6 address, whatever their key is called. */
export const TELEMETRY_VALUE =
  /(\b\d{1,3}(\.\d{1,3}){3}\b)|([0-9a-f]{1,4}:){2,}[0-9a-f]{0,4}/i;

/** True when this trait must never reach the model. */
export function isSpeakerTelemetry(key: string, value: unknown): boolean {
  if (TELEMETRY_KEY.test(String(key))) return true;
  return TELEMETRY_VALUE.test(String(value ?? ""));
}

/** Drop every telemetry-shaped trait from a profile's inferred traits. */
export function scrubSpeakerTraits(
  traits: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(traits ?? {})) {
    if (isSpeakerTelemetry(k, v)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Sentences that must never appear in a reply, a thinking panel, or a Connect
 * quote. Exported so tests assert against the same list the doctrine forbids.
 */
export const FORBIDDEN_PACKET_PATTERNS: RegExp[] = [
  /\bip address\b/i,
  /\bcf-connecting-ip\b/i,
  /\bx-forwarded-for\b/i,
  /\bvpn\b/i,
  /\bproxy detected\b/i,
  /\bhours? ago\b/i,
  /\bthe user (seems|appears|is aware|likely)\b/i,
  /\bthe content of the last message\b/i,
  /\bgeolocation is based on\b/i,
];

/** True when text contains one of the forbidden operator-packet sentences. */
export function containsSpeakerPacket(text: string): boolean {
  return FORBIDDEN_PACKET_PATTERNS.some((re) => re.test(String(text ?? "")));
}
