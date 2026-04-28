// AsherImagineModule — Imagine canvas + Asher AI side panel (full Aureon brain).
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import AsherImagineAIPanel from "@/components/asher/AsherImagineAIPanel";

const ImagineToCodeView = lazy(() => import("@/components/dashboard/ImagineToCodeView"));

const AsherImagineModule = () => (
  <div className="relative h-full w-full overflow-hidden bg-background">
    <div className="absolute inset-0 right-[400px]">
      <Suspense fallback={
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="ml-2 text-xs font-light tracking-[0.2em] uppercase">Loading Imagine canvas…</span>
        </div>
      }>
        <ImagineToCodeView />
      </Suspense>
    </div>
    <AsherImagineAIPanel />
  </div>
);

export default AsherImagineModule;
