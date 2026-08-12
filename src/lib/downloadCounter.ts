/**
 * Public download counter.
 *
 * Counts live in a single aggregate row per asset key, mutated only through
 * two SECURITY DEFINER routines (`get_download_count`, `record_download`).
 * The table itself is unreachable from the client, and `record_download`
 * rejects any key outside a server-side allowlist, so the counter cannot be
 * seeded with junk rows.
 *
 * Multiple cards on the same page share one in-memory value: a fetch or a
 * recorded download fans out to every subscribed component, so a click on the
 * top card updates the bottom card without a second round trip.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Listener = (count: number | null) => void;

const counts = new Map<string, number | null>();
const listeners = new Map<string, Set<Listener>>();
const inflight = new Map<string, Promise<void>>();

function emit(slug: string, value: number | null) {
  counts.set(slug, value);
  listeners.get(slug)?.forEach((fn) => fn(value));
}

async function fetchCount(slug: string): Promise<void> {
  const existing = inflight.get(slug);
  if (existing) return existing;

  const run = (async () => {
    try {
      const { data, error } = await supabase.rpc("get_download_count", { _slug: slug });
      if (error) throw error;
      emit(slug, typeof data === "number" ? data : Number(data ?? 0));
    } catch {
      // Counter is decorative — never block or surface a failure to the reader.
      emit(slug, counts.get(slug) ?? null);
    } finally {
      inflight.delete(slug);
    }
  })();

  inflight.set(slug, run);
  return run;
}

/** Record one download and optimistically advance every mounted counter. */
export async function recordDownload(slug: string): Promise<void> {
  const current = counts.get(slug);
  if (typeof current === "number") emit(slug, current + 1);

  try {
    const { data, error } = await supabase.rpc("record_download", { _slug: slug });
    if (error) throw error;
    const next = typeof data === "number" ? data : Number(data ?? 0);
    if (Number.isFinite(next) && next > 0) emit(slug, next);
  } catch {
    // Download already started in the browser; a failed tally is not the
    // reader's problem. Leave the optimistic value in place.
  }
}

/** Live download count for an asset key. `null` until the first read lands. */
export function useDownloadCount(slug: string): number | null {
  const [count, setCount] = useState<number | null>(() => counts.get(slug) ?? null);

  useEffect(() => {
    let alive = true;
    const listener: Listener = (value) => {
      if (alive) setCount(value);
    };

    const set = listeners.get(slug) ?? new Set<Listener>();
    set.add(listener);
    listeners.set(slug, set);

    if (counts.has(slug)) setCount(counts.get(slug) ?? null);
    void fetchCount(slug);

    return () => {
      alive = false;
      set.delete(listener);
      if (set.size === 0) listeners.delete(slug);
    };
  }, [slug]);

  return count;
}
