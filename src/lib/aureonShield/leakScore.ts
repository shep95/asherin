// Geo-Drift Leak Score — 0 (perfectly anonymous) → 100 (fully exposed).
// Pure function so the status strip and any tab can render the same number.

type Identity = { ip: string; city: string; country: string; org: string; timezone: string; latitude?: number; longitude?: number } | null;
type WebRTC = { leaked: boolean; ips: string[] } | null;
type Dns = { colo: string; loc: string } | null;
type Perms = Record<string, string> | null;
type Device = { timezone: string; cookiesEnabled: boolean; doNotTrack: string | null; storageQuotaMB: number | null } | null;
type Fp = { hash: string } | null;

export interface LeakScoreBreakdown {
  score: number;          // 0..100 (higher = more leaks)
  band: "low" | "medium" | "high" | "critical";
  signals: { label: string; weight: number; tripped: boolean; detail: string }[];
}

export function computeLeakScore(args: {
  identity: Identity; baseline: Identity; webrtc: WebRTC; dns: Dns;
  perms: Perms; device: Device; fp: Fp;
}): LeakScoreBreakdown {
  const { identity, baseline, webrtc, dns, perms, device, fp } = args;

  const signals: LeakScoreBreakdown["signals"] = [
    {
      label: "WebRTC IP exposure",
      weight: 22,
      tripped: !!webrtc?.leaked,
      detail: webrtc?.leaked ? `${webrtc.ips.length} IPs leak around the tunnel` : "No WebRTC leak detected",
    },
    {
      label: "DNS / IP country mismatch",
      weight: 14,
      tripped: !!(dns?.loc && identity?.country && dns.loc !== identity.country?.slice(0, 2).toUpperCase()),
      detail: dns ? `Resolver ${dns.colo} (${dns.loc}) vs IP ${identity?.country || "?"}` : "DNS unknown",
    },
    {
      label: "Timezone / IP geo mismatch",
      weight: 12,
      tripped: !!(device?.timezone && identity?.country && !device.timezone.toLowerCase().includes((identity.country || "").split(" ")[0].toLowerCase().slice(0, 4))),
      detail: device?.timezone ? `TZ ${device.timezone} · IP ${identity?.country || "?"}` : "—",
    },
    {
      label: "Baseline drift",
      weight: 14,
      tripped: !!(baseline && identity && baseline.ip !== identity.ip),
      detail: baseline && identity ? (baseline.ip !== identity.ip ? `${baseline.ip} → ${identity.ip}` : "Identity stable") : "—",
    },
    {
      label: "Sensor permissions granted",
      weight: 10,
      tripped: !!perms && Object.values(perms).filter((v) => v === "granted").length > 0,
      detail: perms ? `${Object.values(perms).filter((v) => v === "granted").length} granted` : "—",
    },
    {
      label: "Tracking signals (cookies + no DNT)",
      weight: 8,
      tripped: !!device?.cookiesEnabled && device?.doNotTrack !== "1",
      detail: device?.cookiesEnabled ? `Cookies on · DNT ${device.doNotTrack === "1" ? "set" : "off"}` : "Cookies blocked",
    },
    {
      label: "Persistent storage available",
      weight: 6,
      tripped: (device?.storageQuotaMB ?? 0) > 1024,
      detail: device?.storageQuotaMB ? `${device.storageQuotaMB} MB quota` : "—",
    },
    {
      label: "Stable canvas/audio fingerprint",
      weight: 14,
      tripped: !!fp?.hash,
      detail: fp?.hash ? `Hash ${fp.hash.slice(0, 8)}…` : "—",
    },
  ];

  const score = Math.min(100, signals.reduce((acc, s) => acc + (s.tripped ? s.weight : 0), 0));
  const band: LeakScoreBreakdown["band"] =
    score >= 65 ? "critical" : score >= 40 ? "high" : score >= 18 ? "medium" : "low";

  return { score, band, signals };
}

export function bandColor(band: LeakScoreBreakdown["band"]): string {
  return band === "critical" ? "text-red-400"
       : band === "high"     ? "text-orange-400"
       : band === "medium"   ? "text-yellow-400"
       :                       "text-emerald-400";
}
