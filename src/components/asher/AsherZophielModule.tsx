// AsherZophielModule — embeds the Zophiel search/intel engine inside the Asher dashboard.
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";

const ZophielEngineView = lazy(() => import("@/components/dashboard/ZophielEngineView"));

const AsherZophielModule = () => (
  <div className="h-full w-full overflow-hidden bg-background">
    <Suspense fallback={
      <div className="flex h-full w-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="ml-2 text-xs font-light tracking-[0.2em] uppercase">Booting Zophiel engine…</span>
      </div>
    }>
      <ZophielEngineView />
    </Suspense>
  </div>
);

export default AsherZophielModule;
