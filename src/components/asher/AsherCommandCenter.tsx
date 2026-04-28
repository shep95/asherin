import { useEffect, useRef, useState } from "react";
import { Brain, ExternalLink, RefreshCw, Maximize2, Minimize2 } from "lucide-react";

/**
 * Aureon Command Center embedded inside Asher.
 * Loads the full Aureon Dashboard (chat, brains, conversations, models,
 * everything) inside an iframe so the Asher operator has access to the
 * complete Aureon AI brain — rebranded ASHER AI in this surface — without
 * leaving the Asher workspace.
 *
 * 100% live: this is the same /dashboard route end users use; no mocked layer.
 */
const AsherCommandCenter = () => {
  const [key, setKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLIFrameElement>(null);

  useEffect(() => { document.title = "ASHER AI — Command Center"; }, []);

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between border-b border-border/15 px-4 py-2 bg-card/30 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-foreground/60" strokeWidth={1.5} />
          <p className="text-[10px] font-light tracking-[0.3em] text-foreground/80 uppercase">
            ASHER AI · Command Center
          </p>
          <span className="text-[9px] font-light tracking-[0.25em] text-emerald-400/70 uppercase">Live</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setKey((k) => k + 1)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            title="Reload command center"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            title={expanded ? "Restore" : "Maximize"}
          >
            {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <a
            href="/dashboard"
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5"
            title="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
          </a>
        </div>
      </div>

      <div className={`flex-1 ${expanded ? "fixed inset-0 z-[2000] bg-background" : ""}`}>
        <iframe
          ref={ref}
          key={key}
          src="/dashboard"
          title="Aureon Command Center"
          className="h-full w-full border-0"
          allow="clipboard-read; clipboard-write; microphone; camera; geolocation"
        />
      </div>
    </div>
  );
};

export default AsherCommandCenter;
