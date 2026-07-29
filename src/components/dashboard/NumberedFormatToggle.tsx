import { useState, useEffect } from "react";
import { ListOrdered } from "lucide-react";

// Per-conversation toggle for the "numerical order answer brain" — the rule
// that forces every structured answer to come out as `1.`, `2.`, `3.` …
// Default: ON. The toggle persists "OFF" entries in localStorage; missing
// entries mean the brain stays on.
const STORAGE_KEY = "aureon_numbered_format_off";

function loadDisabledMap(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveDisabledMap(map: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* noop */
  }
}

/** Returns true when the numbered-format brain should be ACTIVE for this scope. */
export function isNumberedFormatEnabled(scopeId: string | null | undefined): boolean {
  if (!scopeId) return true;
  const map = loadDisabledMap();
  return map[scopeId] !== true;
}

interface Props {
  scopeId: string;
  className?: string;
}

const NumberedFormatToggle = ({ scopeId, className = "" }: Props) => {
  const [active, setActive] = useState<boolean>(() => isNumberedFormatEnabled(scopeId));

  useEffect(() => {
    setActive(isNumberedFormatEnabled(scopeId));
  }, [scopeId]);

  const toggle = () => {
    const map = loadDisabledMap();
    if (active) {
      map[scopeId] = true; // turn OFF
    } else {
      delete map[scopeId]; // turn back ON
    }
    saveDisabledMap(map);
    setActive(!active);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={
        active
          ? "Numbered-list brain: ON — click to let answers flow as prose"
          : "Numbered-list brain: OFF — click to force numbered answers"
      }
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-light transition-all border ${
        active
          ? "bg-foreground/10 text-foreground border-foreground/20"
          : "text-muted-foreground/50 hover:text-muted-foreground/70 border-transparent hover:border-border/20 line-through decoration-1"
      } ${className}`}
    >
      <ListOrdered className="h-3 w-3" />
      <span className="hidden sm:inline">{active ? "1·2·3" : "1·2·3"}</span>
    </button>
  );
};

export default NumberedFormatToggle;
