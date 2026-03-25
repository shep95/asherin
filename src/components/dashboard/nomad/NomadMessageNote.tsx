import { useState } from "react";
import { MessageSquare, Check, X } from "lucide-react";

interface NomadMessageNoteProps {
  messageId: string;
  existingNote?: string;
  onSave: (messageId: string, note: string) => void;
}

const NomadMessageNote = ({ messageId, existingNote, onSave }: NomadMessageNoteProps) => {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(existingNote || "");

  if (existingNote && !editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-[9px] font-extralight text-amber-400/60 hover:text-amber-400 transition-colors"
        title={existingNote}
      >
        <MessageSquare className="h-2.5 w-2.5" />
        Note
      </button>
    );
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-[10px] font-light text-muted-foreground/30 hover:text-muted-foreground transition-colors"
      >
        <MessageSquare className="h-3 w-3" />
        Note
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 mt-1 animate-fade-in">
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") { onSave(messageId, note); setEditing(false); } if (e.key === "Escape") setEditing(false); }}
        placeholder="Add a note..."
        className="flex-1 rounded-lg border border-border/20 bg-card/20 px-2 py-1 text-[10px] font-extralight text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-accent/30"
        autoFocus
      />
      <button onClick={() => { onSave(messageId, note); setEditing(false); }} className="text-accent hover:text-accent/80 transition-colors">
        <Check className="h-3 w-3" />
      </button>
      <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground transition-colors">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
};

export default NomadMessageNote;
