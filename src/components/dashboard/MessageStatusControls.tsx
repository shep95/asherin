import { useState, useEffect } from "react";
import { Lock, Clock, Pin, PinOff, Star, AlertTriangle } from "lucide-react";

interface MessageStatusControlsProps {
  messageId: string;
}

interface MessageFlags {
  canonical: boolean;
  outdated: boolean;
  pinned: boolean;
}

const STORAGE_KEY = "aureon_msg_flags";

function loadFlags(): Record<string, MessageFlags> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function saveFlags(flags: Record<string, MessageFlags>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
}

const MessageStatusControls = ({ messageId }: MessageStatusControlsProps) => {
  const [flags, setFlags] = useState<MessageFlags>(() => loadFlags()[messageId] || { canonical: false, outdated: false, pinned: false });

  useEffect(() => {
    const all = loadFlags();
    all[messageId] = flags;
    saveFlags(all);
  }, [flags, messageId]);

  const toggle = (key: keyof MessageFlags) => setFlags(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={() => toggle("canonical")}
        className={`p-1 rounded transition-colors ${flags.canonical ? "text-accent" : "text-muted-foreground/30 hover:text-muted-foreground/60"}`}
        title={flags.canonical ? "Canonical (locked)" : "Mark as canonical"}
      >
        <Lock className="h-3 w-3" />
      </button>
      <button
        onClick={() => toggle("outdated")}
        className={`p-1 rounded transition-colors ${flags.outdated ? "text-amber-500" : "text-muted-foreground/30 hover:text-muted-foreground/60"}`}
        title={flags.outdated ? "Marked outdated" : "Mark as outdated"}
      >
        <Clock className="h-3 w-3" />
      </button>
      <button
        onClick={() => toggle("pinned")}
        className={`p-1 rounded transition-colors ${flags.pinned ? "text-accent" : "text-muted-foreground/30 hover:text-muted-foreground/60"}`}
        title={flags.pinned ? "Pinned" : "Pin as reference"}
      >
        {flags.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
      </button>
    </div>
  );
};

export default MessageStatusControls;

export function getMessageFlags(messageId: string): MessageFlags {
  return loadFlags()[messageId] || { canonical: false, outdated: false, pinned: false };
}
