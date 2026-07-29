// SYSTEM CONTEXT — Temporal awareness injected into every AI system prompt.
// ─────────────────────────────────────────────────────────────────────────
// LLMs have no reliable clock. Without this block Aureon and Asher hallucinate
// dates from training data, break "yesterday / this week / N hours ago"
// reasoning, and situate live evidence (news timestamps, video publishedAt,
// GDELT records) against the wrong "now".
//
// Emits a small <temporal_context> XML block callers concatenate onto their
// system prompt. Timezone comes from the client (Intl.DateTimeFormat), falls
// back to UTC. Timestamp is computed at request time on the edge — never
// cached.

export interface TemporalInput {
  /** IANA timezone from client, e.g. "America/New_York". Optional. */
  timezone?: string | null;
  /** Optional user locale, e.g. "en-US". Defaults to en-US. */
  locale?: string | null;
}

export function getTemporalContext(input: TemporalInput = {}): string {
  const now = new Date();
  const tz = (input.timezone && String(input.timezone).trim()) || "UTC";
  const locale = (input.locale && String(input.locale).trim()) || "en-US";

  let localStr = "";
  let weekday = "";
  let localDate = "";
  let localTime = "";
  try {
    const fmt = new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      weekday: "long",
      year: "numeric", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
      timeZoneName: "short",
    });
    localStr = fmt.format(now);
    const parts = fmt.formatToParts(now);
    weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
    const y = parts.find((p) => p.type === "year")?.value ?? "";
    const m = parts.find((p) => p.type === "month")?.value ?? "";
    const d = parts.find((p) => p.type === "day")?.value ?? "";
    localDate = `${m} ${d}, ${y}`;
    const h = parts.find((p) => p.type === "hour")?.value ?? "";
    const mi = parts.find((p) => p.type === "minute")?.value ?? "";
    const dp = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
    localTime = `${h}:${mi} ${dp}`.trim();
  } catch {
    // Invalid tz — fall back to UTC.
    localStr = now.toUTCString();
    weekday = now.toUTCString().slice(0, 3);
  }

  const iso = now.toISOString();
  const unix = Math.floor(now.getTime() / 1000);

  return `<temporal_context>
  <now_utc>${iso}</now_utc>
  <now_local>${localStr}</now_local>
  <weekday>${weekday}</weekday>
  <local_date>${localDate}</local_date>
  <local_time>${localTime}</local_time>
  <timezone>${tz}</timezone>
  <unix>${unix}</unix>
</temporal_context>

TEMPORAL RULES:
- The values above are the ONLY authoritative "now" for this request. Never contradict them or invent a different date from training data.
- When the user says "today", "yesterday", "this week", "N hours ago", compute against <now_local> in <timezone>.
- When citing evidence timestamps (news, videos, filings), state the age relative to <now_local> (e.g. "posted 2 hours ago", "filed yesterday").
- If the user asks the date or time, answer from <now_local>. Do not say you cannot know it.`;
}
