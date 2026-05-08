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
    try {
      return await factory();
    } catch (err: any) {
      const msg = String(err?.message || err);
      const isChunkError =
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Importing a module script failed") ||
        msg.includes("error loading dynamically imported module") ||
        msg.includes("ChunkLoadError");
      if (!isChunkError) throw err;
      // retry once
      try {
        return await factory();
      } catch (err2) {
        if (typeof window !== "undefined" && !sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, "1");
          window.location.reload();
          // return a pending promise so React stays in Suspense until reload
          return new Promise(() => {}) as any;
        }
        throw err2;
      }
    }
  });
}
