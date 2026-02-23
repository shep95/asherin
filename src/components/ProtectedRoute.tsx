import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-full bg-background">
        {/* Persistent shell skeleton — sidebar + main area */}
        <div className="w-[260px] border-r border-border/10 bg-card/5 p-4 space-y-4 hidden md:block">
          <Skeleton className="h-8 w-32 rounded-lg" />
          <Skeleton className="h-4 w-24 rounded" />
          <div className="space-y-2 mt-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="text-sm font-extralight tracking-[0.2em] text-muted-foreground animate-pulse">
            AUREON
          </div>
          <Skeleton className="h-3 w-48 rounded" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  return <>{children}</>;
};

export default ProtectedRoute;
