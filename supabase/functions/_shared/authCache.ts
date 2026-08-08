/**
 * AUTH CACHE — one identity round-trip per turn instead of four.
 *
 * Narrative this module answers:
 *   A single chat turn resolved the caller's identity four separate times:
 *   BYOK lookup, admin check, persistent memory, and the vault RAG pull each
 *   built their own Supabase client and each made their own network call to
 *   verify the same unchanged JWT. Those calls were sequential, so the user
 *   waited through all four before the model saw the question.
 *
 * A JWT does not change mid-turn. Verifying it once and reusing the answer is
 * not a shortcut — it is the correct reading of what the token means.
 *
 * Flaws deliberately handled:
 *  • Stale authorization — the cache is keyed on the exact token and holds for
 *    60 seconds, far shorter than any token lifetime, so a revoked session
 *    cannot be replayed for a meaningful window.
 *  • Cross-user bleed — the key IS the token, so two users can never collide.
 *  • Cached failure — a network blip must not pin the caller as anonymous for
 *    a minute; only successful verifications are retained.
 *  • Stampede — the in-flight promise is cached, so parallel callers share one
 *    verification instead of racing four.
 */

const TTL_MS = 60_000;
const MAX_ENTRIES = 200;

interface CachedUser { id: string; email: string | null }

const cache = new Map<string, { at: number; value: Promise<CachedUser | null> }>();

function bearer(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const t = authHeader.replace(/^Bearer\s+/i, "").trim();
  return t.length > 20 ? t : null;
}

/**
 * Verifies the caller once per turn. Returns null for anonymous or invalid
 * callers — callers must treat that as "not signed in", never as an error.
 */
export function resolveCallerCached(
  authHeader: string | null,
  supabaseUrl: string,
  anonKey: string,
): Promise<CachedUser | null> {
  const token = bearer(authHeader);
  if (!token || !supabaseUrl || !anonKey) return Promise.resolve(null);

  const hit = cache.get(token);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const value = (async (): Promise<CachedUser | null> => {
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
      const sb = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
      const { data } = await sb.auth.getUser(token);
      if (!data?.user) { cache.delete(token); return null; }
      return { id: data.user.id, email: data.user.email ?? null };
    } catch {
      cache.delete(token); // never pin a caller as anonymous on a network blip
      return null;
    }
  })();

  cache.set(token, { at: Date.now(), value });
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (!oldest) break;
    cache.delete(oldest);
  }
  return value;
}
