import { createContext, useContext, useEffect, useState, useRef, useMemo, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { registerSession, updateSessionActivity } from "@/utils/sessionTracker";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRegisteredRef = useRef<string | null>(null);
  const activityIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;

    // Single source of truth: auth-js v2 fires INITIAL_SESSION on subscribe,
    // so we don't need a parallel getSession() call (which previously caused
    // two render cycles and a tug-of-war on `setLoading`).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      // Purge stale/corrupt JWTs (root cause of recurring 403 "missing sub
      // claim" hits in the auth gateway). When INITIAL_SESSION resolves to
      // null after a token refresh failure, wipe local storage so we stop
      // re-sending the malformed bearer on every page load.
      if (event === "INITIAL_SESSION" && !nextSession) {
        const stale = Object.keys(localStorage).some((k) =>
          k.startsWith("sb-") && k.endsWith("-auth-token")
        );
        if (stale) {
          // Local-only signOut: clears storage without round-tripping the API
          supabase.auth.signOut({ scope: "local" }).catch(() => void 0);
        }
      }

      // A revoked/rotated server session leaves a syntactically valid JWT in
      // localStorage. auth-js happily restores it, so every subsequent call
      // ships a dead bearer and comes back 401 ("Session from session_id claim
      // in JWT does not exist") — which the UI surfaces as a generic AI error
      // on every reload. Validate once against the server and purge if dead.
      if (event === "INITIAL_SESSION" && nextSession) {
        supabase.auth.getUser().then(({ error }) => {
          if (!mounted || !error) return;
          const dead =
            (error as { status?: number }).status === 401 ||
            (error as { status?: number }).status === 403 ||
            /session|jwt|token/i.test(error.message || "");
          if (dead) {
            console.warn("[auth] stale session purged:", error.message);
            supabase.auth.signOut({ scope: "local" }).catch(() => void 0);
          }
        });
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);


      if (nextSession?.user && event === "SIGNED_IN") {
        const sid = nextSession.user.id + "_" + (nextSession.access_token?.substring(0, 8) || "x");
        if (sessionRegisteredRef.current !== sid) {
          sessionRegisteredRef.current = sid;
          registerSession(nextSession.user.id, sid);
        }
      }

      if (event === "SIGNED_OUT") {
        sessionRegisteredRef.current = null;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Activity heartbeat: depend on userId only so a routine TOKEN_REFRESHED
  // (which mints a new session object every ~hour) doesn't tear down and
  // recreate the 5-minute interval.
  const userId = user?.id ?? null;
  useEffect(() => {
    if (activityIntervalRef.current) {
      clearInterval(activityIntervalRef.current);
      activityIntervalRef.current = null;
    }
    if (!userId) return;
    activityIntervalRef.current = setInterval(() => {
      // Read the latest token at tick time, not closure time.
      supabase.auth.getSession().then(({ data }) => {
        const tok = data.session?.access_token?.substring(0, 8) || "x";
        updateSessionActivity(userId, `${userId}_${tok}`);
      });
    }, 5 * 60 * 1000);
    return () => {
      if (activityIntervalRef.current) {
        clearInterval(activityIntervalRef.current);
        activityIntervalRef.current = null;
      }
    };
  }, [userId]);

  const signOut = useMemo(() => async () => {
    await supabase.auth.signOut().catch(() => void 0);
    sessionRegisteredRef.current = null;
    window.location.href = "/";
  }, []);

  const value = useMemo(
    () => ({ user, session, loading, signOut }),
    [user, session, loading, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
