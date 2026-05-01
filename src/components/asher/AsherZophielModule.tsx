// AsherZophielModule — embeds the Zophiel search/intel engine inside the Asher dashboard.
import { lazy, Suspense, useState } from "react";
import { Loader2, Shield, X } from "lucide-react";

const ZophielEngineView = lazy(() => import("@/components/dashboard/ZophielEngineView"));

const NOTICE_KEY = "zophiel.localOnlyNoticeDismissed";

const AsherZophielModule = () => {
  const [showNotice, setShowNotice] = useState(() => localStorage.getItem(NOTICE_KEY) !== "1");

  const dismiss = () => {
    localStorage.setItem(NOTICE_KEY, "1");
    setShowNotice(false);
  };

  return (
    <div className="h-full w-full overflow-hidden bg-background flex flex-col">
      {showNotice && (
        <div className="flex-shrink-0 border-b border-border/15 bg-card/30 backdrop-blur-md px-4 py-2 flex items-center gap-3">
          <Shield className="h-3.5 w-3.5 text-foreground/60 shrink-0" strokeWidth={1.4} />
          <p className="text-[10px] font-light tracking-wide text-muted-foreground/80 leading-relaxed flex-1">
            <span className="text-foreground/80 uppercase tracking-[0.2em] mr-2">Local Storage</span>
            All Zophiel search history, blocked domains, and saved targets are stored on <strong className="text-foreground/90">your device only</strong>.
            Nothing is persisted on our servers. Clear your browser data to wipe.
          </p>
          <button
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground transition shrink-0"
            title="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="ml-2 text-xs font-light tracking-[0.2em] uppercase">Booting Zophiel engine…</span>
          </div>
        }>
          <ZophielEngineView />
        </Suspense>
      </div>
    </div>
  );
};

export default AsherZophielModule;
