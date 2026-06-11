import { supabase } from "@/integrations/supabase/client";

/**
 * Helpers for serving files from PRIVATE Supabase storage buckets.
 *
 * After privatizing the `vibe-video` and `custom-wallpapers`
 * buckets, any stored `/storage/v1/object/public/<bucket>/<path>` URL stops
 * working. We keep that URL format in the database (it's a stable encoding of
 * bucket + path) and resolve it to a short-lived signed URL at display time.
 *
 * Data URLs (`data:image/...`) and external https URLs are returned as-is.
 */

const SIGNED_TTL_SECONDS = 60 * 60; // 1 hour
const REFRESH_BEFORE_MS = 5 * 60 * 1000; // refresh 5 min before expiry

type CacheEntry = { url: string; expiresAt: number };
const cache = new Map<string, CacheEntry>();

const cacheKey = (bucket: string, path: string) => `${bucket}::${path}`;

/** Extract storage path from a stored public URL, or return null if not one. */
export function extractStoragePath(url: string, bucket: string): string | null {
  if (!url) return null;
  // Match both public and signed URLs and pull out the path after the bucket.
  const re = new RegExp(`/storage/v1/object/(?:public|sign)/${bucket}/([^?]+)`);
  const m = url.match(re);
  return m ? decodeURIComponent(m[1]) : null;
}

/** Sign a path inside a private bucket. Cached + auto-refreshed. */
export async function signPath(bucket: string, path: string): Promise<string | null> {
  const key = cacheKey(bucket, path);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt - now > REFRESH_BEFORE_MS) return cached.url;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;

  cache.set(key, { url: data.signedUrl, expiresAt: now + SIGNED_TTL_SECONDS * 1000 });
  return data.signedUrl;
}

/**
 * Resolve any value (path, public URL, signed URL, data URL, external URL) to
 * a URL the browser can actually render right now.
 */
export async function toDisplayUrl(
  value: string | null | undefined,
  bucket: string,
): Promise<string> {
  if (!value) return "";
  // Pass through data URLs and non-Supabase external URLs untouched.
  if (value.startsWith("data:")) return value;

  const path = extractStoragePath(value, bucket);
  if (path) {
    const signed = await signPath(bucket, path);
    return signed ?? value;
  }

  // If caller passed a raw storage path like "userId/file.png", sign it.
  if (!value.startsWith("http")) {
    const signed = await signPath(bucket, value);
    return signed ?? value;
  }

  return value;
}

/** Batch helper for galleries / version lists. */
export async function toDisplayUrls(
  values: Array<string | null | undefined>,
  bucket: string,
): Promise<string[]> {
  return Promise.all(values.map((v) => toDisplayUrl(v, bucket)));
}
