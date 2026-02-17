import { useRef, useState } from "react";
import { MessageSquare, Pin, Trash2, Archive, Pencil } from "lucide-react";
import type { Conversation } from "./types";

interface SwipeableConversationItemProps {
  conv: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onRename: () => void;
}

const SWIPE_THRESHOLD = 80;

const SwipeableConversationItem = ({
  conv, isActive, onSelect, onTogglePin, onDelete, onArchive, onRename,
}: SwipeableConversationItemProps) => {
  const startX = useRef(0);
  const currentX = useRef(0);
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
    setSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swiping) return;
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;
    if (diff < 0) {
      setOffset(Math.max(diff, -120));
    }
  };

  const handleTouchEnd = () => {
    setSwiping(false);
    if (offset < -SWIPE_THRESHOLD) {
      setOffset(-100);
    } else {
      setOffset(0);
    }
  };

  const handleArchiveClick = () => {
    setOffset(0);
    onArchive();
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Archive action behind */}
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          onClick={handleArchiveClick}
          className="flex h-full items-center gap-1.5 bg-muted px-4 text-xs font-light text-muted-foreground"
        >
          <Archive className="h-4 w-4" />
          <span className="hidden sm:inline">Archive</span>
        </button>
      </div>

      {/* Swipeable foreground */}
      <div
        className={`relative z-10 group flex items-center gap-2 rounded-xl px-3 py-2 cursor-pointer transition-colors ${
          isActive
            ? "bg-foreground/10 text-foreground"
            : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        }`}
        style={{
          transform: `translateX(${offset}px)`,
          transition: swiping ? "none" : "transform 0.3s ease-out",
          backgroundColor: offset !== 0 && !isActive ? "hsl(var(--card))" : undefined,
        }}
        onClick={() => { if (offset !== 0) { setOffset(0); return; } onSelect(); }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <MessageSquare className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate text-xs font-light">{conv.title}</span>
        <div className="flex gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity bg-inherit pl-1">
          <button
            onClick={(e) => { e.stopPropagation(); onRename(); }}
            className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            title="Rename"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
            className={`p-1 rounded text-muted-foreground hover:text-foreground transition-colors ${conv.pinned ? "opacity-100 text-foreground" : ""}`}
            title="Pin"
          >
            <Pin className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
            title="Delete permanently"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SwipeableConversationItem;
