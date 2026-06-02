import { useEffect, useState } from "react";
import { CornerUpLeft, X } from "lucide-react";
import type { Message } from "./types";

interface StickyQuestionHeaderProps {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  messageRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  messages: Message[];
  onJump: (id: string) => void;
}

/**
 * Shows a sticky pill at the top of the chat scroll area displaying the
 * user question that the visible assistant response belongs to.
 * Appears only when the user has scrolled past at least one user message.
 */
const StickyQuestionHeader = ({ scrollContainerRef, messageRefs, messages, onJump }: StickyQuestionHeaderProps) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const update = () => {
      const cRect = container.getBoundingClientRect();
      const threshold = cRect.top + 8;
      let candidate: string | null = null;
      // Iterate user messages in order; pick the last one whose bottom edge has scrolled above the viewport top
      for (const m of messages) {
        if (m.role !== "user") continue;
        const el = messageRefs.current[m.id];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (r.bottom < threshold) {
          candidate = m.id;
        } else {
          break;
        }
      }
      setActiveId(candidate);
    };

    update();
    container.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(container);
    return () => {
      container.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [messages, messageRefs, scrollContainerRef]);

  const showId = activeId && activeId !== dismissedId ? activeId : null;
  if (!showId) return null;
  const msg = messages.find((m) => m.id === showId);
  if (!msg) return null;

  return (
    <div className="sticky top-0 z-20 pointer-events-none flex justify-center pt-2 px-2 -mb-1">
      <div className="pointer-events-auto group inline-flex items-center gap-2 max-w-[min(720px,92%)] rounded-full border border-border/40 bg-card/85 backdrop-blur-2xl pl-3 pr-1.5 py-1.5 shadow-lg shadow-black/20 animate-fade-in">
        <CornerUpLeft className="h-3 w-3 shrink-0 text-muted-foreground/60" />
        <span className="text-[10px] font-light tracking-[0.18em] uppercase text-muted-foreground/70 shrink-0">
          Your prompt
        </span>
        <button
          onClick={() => onJump(msg.id)}
          className="min-w-0 flex-1 truncate text-left text-[11.5px] font-light text-foreground/90 hover:text-foreground transition-colors"
          title="Click to jump back"
        >
          {msg.content.replace(/\s+/g, " ").trim()}
        </button>
        <button
          onClick={() => setDismissedId(msg.id)}
          className="shrink-0 p-1 rounded-full text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors"
          title="Hide"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

export default StickyQuestionHeader;
