/**
 * BRAIN CACHE — the system brains stop being re-downloaded on every sentence.
 *
 * Narrative this module answers:
 *   The system brains are static text files in storage. They do not change
 *   between two messages typed a second apart, yet the chat function fetched
 *   every one of them again on every single turn — and fetched seven of them
 *   inside a serial `for` loop, so their latencies added instead of overlapping.
 *   The user sat through eight sequential round-trips before the model was even
 *   asked the question.
 *
 * The fix is boring and total: fetch once per isolate, hold for a TTL, and
 * fan out cold misses in parallel. Nothing about the *content* handed to the
 * model changes — only how many times we go and get it.
 *
 * Flaws deliberately handled:
 *  • Stampede — two concurrent turns on a cold isolate would both fetch. The
 *    in-flight promise is cached, not just the resolved text, so the second
 *    caller awaits the first request instead of issuing its own.
 *  • Poisoned cache — a failed fetch must never be cached as an empty brain for
 *    the next 30 minutes. Failures are evicted immediately and retried next turn.
 *  • Unbounded memory — an isolate that touches many brains keeps them all. The
 *    entry count is capped and the oldest entry is dropped first.
 *  • Hung upstream — storage stalling must not stall the answer. Every fetch is
 *    bounded by an abort timeout and degrades to "brain unavailable" (the model
 *    still answers) rather than holding the turn open.
 */

const TTL_MS = 30 * 60_000;
const MAX_ENTRIES = 24;
const FETCH_TIMEOUT_MS = 8_000;

interface Entry {
  at: number;
  /** Resolved text, or the in-flight promise during a cold fill. */
  value: Promise<string | null>;
}

const cache = new Map<string, Entry>();

function evictIfNeeded() {
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

async function fetchBrain(url: string, serviceRole: string): Promise<string | null> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${serviceRole}` },
      signal: ctl.signal,
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Cached read of one storage-hosted brain. Returns null when unavailable —
 * callers must treat that as "this brain is silent this turn", never as an error.
 */
export function loadBrain(url: string, serviceRole: string): Promise<string | null> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const value = fetchBrain(url, serviceRole).then((text) => {
    // A miss must not be remembered: evict so the next turn retries instead of
    // serving thirty minutes of silence from one bad round-trip.
    if (text === null) cache.delete(url);
    return text;
  }).catch(() => {
    cache.delete(url);
    return null;
  });

  cache.set(url, { at: Date.now(), value });
  evictIfNeeded();
  return value;
}

/** Fan-out read. Order of the returned array matches the input order. */
export function loadBrains(urls: string[], serviceRole: string): Promise<(string | null)[]> {
  return Promise.all(urls.map((u) => loadBrain(u, serviceRole)));
}

/** Hard character ceiling, applied identically to how the callers did it inline. */
export function clampBrain(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n\n[... Truncated at ${max} characters.]` : text;
}
