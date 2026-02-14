import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-sm font-extralight tracking-[0.2em] text-muted-foreground animate-pulse">
          ZIALIEL
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
