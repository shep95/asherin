// sensitivity scoring — one place, so ui and storage agree.
// 0..100. deterministic. never randomised.

export type ExposureClass =
  | "orphan"
  | "code-leak"
  | "directory"
  | "config"
  | "credential"
  | "paste"
  | "subdomain"
  | "archive"
  | "identity";

const BASE: Record<ExposureClass, number> = {
  identity: 30,
  archive: 15,
  subdomain: 20,
  orphan: 30,
  directory: 45,
  paste: 55,
  code: 55,
  "code-leak": 65,
  config: 70,
  credential: 90,
} as unknown as Record<ExposureClass, number>;

const KEY_HINTS = [
  /AKIA[0-9A-Z]{16}/,           // aws access key id
  /aws_secret_access_key/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /ghp_[A-Za-z0-9]{30,}/,       // github pat
  /xox[baprs]-[A-Za-z0-9-]+/,   // slack token
  /sk-[A-Za-z0-9]{20,}/,        // openai-style
  /Bearer [A-Za-z0-9._-]{20,}/,
  /password\s*[:=]\s*["'][^"']{4,}/i,
  /DB_PASSWORD\s*[:=]/i,
  /api[_-]?key\s*[:=]/i,
];

export function scoreSensitivity(klass: ExposureClass, evidence = "", extras: { live?: boolean } = {}): number {
  let s = BASE[klass] ?? 25;
  for (const rx of KEY_HINTS) if (rx.test(evidence)) { s += 15; break; }
  if (extras.live === true) s += 5;
  if (extras.live === false) s -= 10;
  return Math.max(0, Math.min(100, s));
}

export function tierFromScore(score: number): "low" | "medium" | "high" | "critical" {
  if (score >= 85) return "critical";
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}
