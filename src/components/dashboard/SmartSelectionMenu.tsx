import { useState, useEffect, useCallback, useRef } from "react";
import { Expand, RefreshCw, Search, Copy, FolderPlus, MessageSquare, Scissors } from "lucide-react";

interface SmartSelectionMenuProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onAction: (action: string, text: string) => void;
}

interface MenuState {
  visible: boolean;
  x: number;
  y: number;
  text: string;
  isCode: boolean;
}

const SmartSelectionMenu = ({ containerRef, onAction }: SmartSelectionMenuProps) => {
  const [menu, setMenu] = useState<MenuState>({ visible: false, x: 0, y: 0, text: "", isCode: false });
  const menuRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    // Don't intercept right-click — allow native context menu (paste, etc.)
    if (e.button === 2) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      setMenu((prev) => ({ ...prev, visible: false }));
      return;
    }

    const text = sel.toString().trim();
    if (!text || text.length < 3) return;

    const container = containerRef.current;
    if (!container || !container.contains(sel.anchorNode)) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Detect if selection is inside a code block
    let node: Node | null = sel.anchorNode;
    let isCode = false;
    while (node && node !== container) {
      if (node instanceof HTMLElement && (node.tagName === "CODE" || node.tagName === "PRE")) {
        isCode = true;
        break;
      }
      node = node.parentNode;
    }

    setMenu({
      visible: true,
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8,
      text,
      isCode,
    });
  }, [containerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener("mouseup", handleMouseUp);
    const dismiss = (e: MouseEvent) => {
      // Don't dismiss on right-click so native context menu works
      if (e.button === 2) return;
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu((prev) => ({ ...prev, visible: false }));
      }
    };
    document.addEventListener("mousedown", dismiss);
    return () => {
      container.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", dismiss);
    };
  }, [handleMouseUp, containerRef]);

  const act = (action: string) => {
    onAction(action, menu.text);
    setMenu((prev) => ({ ...prev, visible: false }));
    window.getSelection()?.removeAllRanges();
  };

  if (!menu.visible) return null;

  const textActions = [
    { id: "expand", icon: Expand, label: "Expand" },
    { id: "rewrite", icon: RefreshCw, label: "Rewrite" },
    { id: "fact-check", icon: Search, label: "Fact Check" },
    { id: "copy", icon: Copy, label: "Copy" },
    { id: "ask", icon: MessageSquare, label: "Ask About" },
  ];

  const codeActions = [
    { id: "explain", icon: MessageSquare, label: "Explain" },
    { id: "debug", icon: Search, label: "Debug" },
    { id: "copy", icon: Copy, label: "Copy" },
    { id: "rewrite", icon: RefreshCw, label: "Optimize" },
  ];

  const actions = menu.isCode ? codeActions : textActions;

  return (
    <div
      ref={menuRef}
      className="absolute z-50 animate-scale-in"
      style={{ left: menu.x, top: menu.y, transform: "translate(-50%, -100%)" }}
    >
      <div className="flex items-center gap-0.5 rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl p-1 shadow-xl">
        {actions.map((a) => (
          <button
            key={a.id}
            onClick={() => act(a.id)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-light text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors whitespace-nowrap"
            title={a.label}
          >
            <a.icon className="h-3 w-3" />
            <span className="hidden sm:inline">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SmartSelectionMenu;
