import { useEffect, useRef, useState } from "react";
import { ChevronRight, CircuitBoard } from "lucide-react";
import { useAureonThinking } from "@/hooks/useAureonThinking";
import TypingIndicator from "./TypingIndicator";

/**
 * Aureon Reasoning Process — phase-1 transparency panel.
 * Pure display: it subscribes to the thinking store and renders. It never
 * fetches, never decides when reasoning happens.
 */
const ThinkingPanel = ({
  messageId,
  autoExpand = true,
}: {
  messageId: string;
  autoExpand?: boolean;
}) => {
  const { text, phase, durationMs } = useAureonThinking(messageId);
  const [open, setOpen] = useState(autoExpand);
  const [userToggled, setUserToggled] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const live = phase === "thinking";

  // Collapse automatically once the answer takes over — unless the user has
  // taken manual control of the panel.
  useEffect(() => {
    if (userToggled) return;
    if (phase === "answering" || phase === "done") setOpen(false);
    if (phase === "thinking") setOpen(true);
  }, [phase, userToggled]);

  // Follow the stream without hijacking the page scroll.
  useEffect(() => {
    if (!live || !open) return;
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [text, live, open]);

  if (!text && !live) return null;

  const secs = durationMs ? (durationMs / 1000).toFixed(1) : null;

  return (
    <div className="mb-2 rounded-xl border border-border/30 bg-secondary/25 backdrop-blur-sm overflow-hidden">
      <button
        type="button"
        onClick={() => { setUserToggled(true); setOpen((o) => !o); }}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left outline-none transition-colors hover:bg-secondary/40 focus-visible:ring-1 focus-visible:ring-ring"
      >
        <ChevronRight
          className={`h-3 w-3 text-muted-foreground/60 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-90" : ""}`}
        />
        <CircuitBoard
          className={`h-3.5 w-3.5 text-muted-foreground/70 ${live ? "animate-pulse motion-reduce:animate-none" : ""}`}
        />
        <span className="text-[11px] font-mono font-light tracking-wide text-muted-foreground/80">
          asherin Reasoning Process
        </span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground/45">
          {live ? "processing…" : secs ? `${secs}s` : "complete"}
        </span>
      </button>

      {open && (
        <div
          ref={bodyRef}
          aria-live={live ? "polite" : "off"}
          className="max-h-56 overflow-y-auto border-t border-border/25 px-3 py-2 font-mono text-[11px] italic leading-relaxed text-muted-foreground/70 whitespace-pre-wrap break-words"
        >
          {text || "Initialising ghost chain…"}
          {live && (
            <span className="ml-0.5 inline-block h-3 w-[3px] align-text-bottom bg-muted-foreground/60 animate-pulse motion-reduce:animate-none" />
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Pre-token state: dots until the ghost chain emits its first reasoning token,
 * then the live panel. Prevents an empty bordered box flashing on screen.
 */
export const ThinkingPanelOrDots = ({ messageId }: { messageId: string }) => {
  const { text, phase } = useAureonThinking(messageId);
  if (phase === "idle" || (!text && phase !== "thinking")) return <TypingIndicator mode="thinking" />;
  return <ThinkingPanel messageId={messageId} />;
};

export default ThinkingPanel;
