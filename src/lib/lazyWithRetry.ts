import React from "react";

/**
 * Wraps React.lazy with auto-recovery for stale chunk errors.
 * When the deployed bundle is updated, previously-rendered pages may try
 * to fetch chunk files that no longer exist ("Failed to fetch dynamically
 * imported module"). We retry once with a cache-bust, and if that still
 * fails we force a one-time hard reload so the user gets the new bundle.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  name = "chunk"
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const reloadKey = `__chunk_reload__${name}`;
    const MAX_ATTEMPTS = 3;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        return await factory();
      } catch (err: any) {
        lastErr = err;
        const msg = String(err?.message || err);
        const isChunkError =
          msg.includes("Failed to fetch dynamically imported module") ||
          msg.includes("Importing a module script failed") ||
          msg.includes("error loading dynamically imported module") ||
          msg.includes("ChunkLoadError");
        const is404 = msg.includes("404") || msg.toLowerCase().includes("not found");

        // 404 means the chunk was permanently removed (deploy churn). One
        // reload may help, but loop-reloading is worse than showing an error.
        if (!isChunkError) throw err;
        if (is404 && attempt > 1) break; // give up after one retry on 404

        // Exponential backoff between attempts
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 250 * 2 ** (attempt - 1)));
        }
      }
    }

    // Exhausted retries — try ONE hard reload, then surface the error.
    if (typeof window !== "undefined" && !sessionStorage.getItem(reloadKey)) {
      sessionStorage.setItem(reloadKey, "1");
      window.location.reload();
      return new Promise(() => {}) as any;
    }
    throw lastErr;
  });
}
