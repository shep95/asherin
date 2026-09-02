// GovSuiteMount — lazy-loads an Asherin engine (Zophiel, AXRLEN, ZERLAL,
// Asherin Chat, Asherin IDE) inside the Sovereign Command Deck's main pane.
//
// Countries operating on asherin.gov use these mounts *instead of* running
// the software themselves — the deck is the sovereign runtime for every
// engine. Every mount enter/exit is written to the deck's audit ledger by
// the parent dashboard.

import { lazy, Suspense, useEffect } from "react";
import { Loader2, Search, ShieldAlert, Brain, Code2 } from "lucide-react";

export type SuiteId = "aureon-chat" | "zophiel" | "zerlal" | "ide";

export interface SuiteDef {
  id: SuiteId;
  label: string;
  code: string;         // 3-letter rail glyph
  blurb: string;
  minClearanceRank: number; // matches CLEARANCE_LEVELS index in the deck
  icon: React.ComponentType<{ className?: string }>;
}

export const SUITES: SuiteDef[] = [
  { id: "aureon-chat", label: "Asherin Chat", code: "AUR", blurb: "Sovereign analytical AI. Legal, doctrinal, OSINT reasoning.", minClearanceRank: 1, icon: Brain },
  { id: "zophiel", label: "Zophiel Search", code: "ZOP", blurb: "multi-engine OSINT + Ghost Chain live scrape.", minClearanceRank: 1, icon: Search },
  { id: "zerlal", label: "ZERLAL Cyber", code: "ZRL", blurb: "Vulnerability & kill-chain analysis of sovereign code.", minClearanceRank: 3, icon: ShieldAlert },
  { id: "ide", label: "Sovereign IDE", code: "IDE", blurb: "Asherin IDE. Countries build & run software here, not locally.", minClearanceRank: 3, icon: Code2 },
];

// Lazy imports — the deck stays fast until an operator opens a suite.
const AureonChat = lazy(() => import("./GovAureonChatPanel"));
const Zophiel = lazy(() => import("@/components/asher/AsherZophielModule"));
// IDE requires deck runtime, Zerlal has its own sovereign wrapper below.
const AsherCodeModule = lazy(() => import("@/components/asher/AsherCodeModule"));
const GovZerlalPanel = lazy(() => import("./GovZerlalPanel"));

export interface GovSuiteContext {
  serverId: string | null;
  serverName?: string | null;
  channelName?: string | null;
  channelMessages: Array<{ id: string; body: string | null; created_at: string; operator_handle?: string | null }>;
}

interface Props {
  suite: SuiteId;
  operator: string;
  onAudit: (action: string, target: string, detail?: string) => void;
  context?: GovSuiteContext;
}

const GovSuiteMount = ({ suite, operator, onAudit, context }: Props) => {
  useEffect(() => {
    onAudit("SUITE_MOUNT", suite);
    return () => onAudit("SUITE_UNMOUNT", suite);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suite]);

  const Fallback = (
    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="ml-2 text-xs font-light tracking-[0.2em] uppercase">
        Booting sovereign engine…
      </span>
    </div>
  );

  return (
    <Suspense fallback={Fallback}>
      {suite === "aureon-chat" && <AureonChat operator={operator} onAudit={onAudit} />}
      {suite === "zophiel" && <Zophiel />}
      {suite === "zerlal" && (
        <GovZerlalPanel
          serverId={context?.serverId ?? null}
          serverName={context?.serverName ?? null}
          channelName={context?.channelName ?? null}
          channelMessages={context?.channelMessages ?? []}
          operator={operator}
          onAudit={onAudit}
        />
      )}
      {suite === "ide"         && (
        <div className="h-full w-full overflow-hidden bg-background">
          <AsherCodeModule />
        </div>
      )}
    </Suspense>
  );
};

export default GovSuiteMount;
