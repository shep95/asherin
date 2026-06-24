// Market hours helper for asset prediction/settlement.
// All times evaluated in America/New_York.
// - ETH: 24/7 (always open)
// - CRUDE (CL=F NYMEX): Sun 18:00 ET → Fri 17:00 ET, with daily 17:00–18:00 ET break
// - SPX / NDX (cash indices): Mon–Fri 09:30 ET → 16:00 ET (regular session only)

export type AssetKey = "ETH" | "CRUDE" | "SPX" | "NDX";

interface EtParts { dow: number; hour: number; minute: number; }

function nowInET(date = new Date()): EtParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { dow: dowMap[wd] ?? 0, hour, minute };
}

export function isMarketOpen(asset: AssetKey, date = new Date()): boolean {
  if (asset === "ETH") return true;
  const { dow, hour, minute } = nowInET(date);
  const mins = hour * 60 + minute;

  if (asset === "CRUDE") {
    // Globex CL: Sunday 18:00 ET open through Friday 17:00 ET, daily break 17:00–18:00.
    if (dow === 6) return false;                          // Saturday closed
    if (dow === 0) return mins >= 18 * 60;                // Sunday: open from 18:00
    if (dow === 5) return mins < 17 * 60;                 // Friday: close at 17:00
    // Mon–Thu: open except 17:00–18:00 daily break
    return !(mins >= 17 * 60 && mins < 18 * 60);
  }

  // SPX / NDX cash indices: regular session only, Mon–Fri 09:30 → 16:00 ET.
  if (dow === 0 || dow === 6) return false;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

export function marketStatusLabel(asset: AssetKey, date = new Date()): string {
  return isMarketOpen(asset, date) ? "OPEN" : "CLOSED";
}
