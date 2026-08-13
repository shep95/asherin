import { createContext, useContext, useEffect, useState, useRef, useMemo, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { registerSession, updateSessionActivity, isSessionRevoked } from "@/utils/sessionTracker";
import { readAssurance, sessionKeyFromToken, UNKNOWN_ASSURANCE, type Assurance } from "@/lib/accountAssurance";
import { wipeKeyMaterial } from "@/lib/encryption";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** How strongly the live session is authenticated, and whether it can go higher. */
  assurance: Assurance;
  /** True while a verified factor exists but this session is still aal1. */
  mfaRequired: boolean;
  /** Re-read the assurance level (call after enrolling or passing a challenge). */
  refreshAssurance: () => Promise<Assurance>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  assurance: UNKNOWN_ASSURANCE,
  mfaRequired: false,
  refreshAssurance: async () => UNKNOWN_ASSURANCE,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [assurance, setAssurance] = useState<Assurance>(UNKNOWN_ASSURANCE);
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

      // The session object is replaced on every TOKEN_REFRESHED (browsers mint a
      // fresh JWT when a background tab wakes). `user` must stay referentially
      // stable across those events, otherwise every consumer keyed on the user
      // object — notably the dashboard conversation loader — reloads and blanks
      // the transcript each time the operator returns to the tab.
      setSession(nextSession);
      const nextUser = nextSession?.user ?? null;
      setUser((prev) => {
        const sameIdentity = !!prev && !!nextUser && prev.id === nextUser.id;
        const refreshEvent = event === "TOKEN_REFRESHED" || event === "USER_UPDATED";
        // USER_UPDATED can carry a real profile change — only collapse it when
        // the identity fields are byte-identical.
        const identical =
          sameIdentity &&
          prev.email === nextUser.email &&
          prev.updated_at === nextUser.updated_at &&
          JSON.stringify(prev.user_metadata ?? {}) === JSON.stringify(nextUser.user_metadata ?? {});
        if (identical && refreshEvent) {

          if (import.meta.env.DEV) {
            console.debug(`[auth] ${event} kept the existing user reference — no downstream reload`);
          }
          return prev; // identical reference → dependent effects do not re-run
        }
        return nextUser;
      });
      setLoading(false);


      if (nextSession?.user && (event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        // OAuth returns to the bare origin (the only URI Google accepts), so
        // the destination the user actually asked for is replayed here — only
        // after a real session exists, and only for same-origin paths.
        try {
          const next = sessionStorage.getItem("asherin:post_auth_redirect");
          if (next) {
            sessionStorage.removeItem("asherin:post_auth_redirect");
            if (next.startsWith("/") && !next.startsWith("//") && next !== window.location.pathname) {
              window.location.replace(next);
              return;
            }
          }
        } catch {
          /* storage unavailable — stay put */
        }
      }

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
