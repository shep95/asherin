import { useAuth } from "@/contexts/AuthContext";
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [timedOut, setTimedOut] = useState(false);

  // Escape hatch: if auth hydration stalls past 8s, fall back to home
  // instead of trapping the user on an infinite "AUREON" pulse.
  useEffect(() => {
    if (!loading) return;
    const t = window.setTimeout(() => setTimedOut(true), 8000);
    return () => window.clearTimeout(t);
  }, [loading]);

  if (loading && !timedOut) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-sm font-extralight tracking-[0.2em] text-muted-foreground animate-pulse">
          AUREON
        </div>
      </div>
    );
  }

  if (!user) {
    const next = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/?next=${next}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
