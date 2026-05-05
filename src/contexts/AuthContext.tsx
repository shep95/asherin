import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from "react";
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Register session on sign-in events
      if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        const sid = session.user.id + "_" + (session.access_token?.substring(0, 8) || "x");
        if (sessionRegisteredRef.current !== sid && event === "SIGNED_IN") {
          sessionRegisteredRef.current = sid;
          registerSession(session.user.id, sid);
        }
      }
    });

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Register session on initial load if logged in
        if (session?.user) {
          const sid = session.user.id + "_" + (session.access_token?.substring(0, 8) || "x");
          if (sessionRegisteredRef.current !== sid) {
            sessionRegisteredRef.current = sid;
            registerSession(session.user.id, sid);
          }
        }
      })
      .catch((error) => {
        console.error("auth session restore error:", error);
        setSession(null);
        setUser(null);
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  // Update session activity every 5 minutes
  useEffect(() => {
    if (activityIntervalRef.current) clearInterval(activityIntervalRef.current);
    if (user && session) {
      const sid = user.id + "_" + (session.access_token?.substring(0, 8) || "x");
      activityIntervalRef.current = setInterval(() => {
        updateSessionActivity(user.id, sid);
      }, 5 * 60 * 1000);
    }
    return () => {
      if (activityIntervalRef.current) clearInterval(activityIntervalRef.current);
    };
  }, [user, session]);

  const signOut = async () => {
    await supabase.auth.signOut();
    sessionRegisteredRef.current = null;
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
