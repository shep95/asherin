import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const OracleLocusView = lazy(() => import("../OracleLocusView"));

const NomadImagineIntel = () => (
  <div className="h-full flex flex-col bg-background">
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <OracleLocusView />
    </Suspense>
  </div>
);

export default NomadImagineIntel;
