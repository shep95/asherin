import { useState, useEffect, useRef } from "react";
import { StickyNote, Check, X, Trash2 } from "lucide-react";

interface MessageNoteProps {
  messageId: string;
}

const STORAGE_KEY = "asherin_message_notes";

function loadNotes(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveNotes(notes: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

const MessageNote = ({ messageId }: MessageNoteProps) => {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const notes = loadNotes();
    const existing = notes[messageId] || "";
    setSaved(existing);
    setNote(existing);
  }, [messageId]);

  const openEditor = () => {
    setEditing(true);
    setNote(saved);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const save = () => {
    const notes = loadNotes();
    const trimmed = note.trim();
    if (trimmed) {
      notes[messageId] = trimmed;
    } else {
      delete notes[messageId];
    }
    saveNotes(notes);
    setSaved(trimmed);
    setEditing(false);
  };

  const remove = () => {
    const notes = loadNotes();
    delete notes[messageId];
    saveNotes(notes);
    setSaved("");
    setNote("");
    setEditing(false);
  };

  const cancel = () => {
    setEditing(false);
    setNote(saved);
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={editing ? cancel : openEditor}
        className={`flex items-center gap-1 text-[10px] font-light transition-colors ${
          saved
            ? "text-amber-500/70 hover:text-amber-500"
            : "text-muted-foreground/50 hover:text-muted-foreground"
        }`}
        title={saved ? "Edit note" : "Add note"}
      >
        <StickyNote className="h-3 w-3" />
        {saved ? "Note" : "Note"}
      </button>

      {/* Saved note display (when not editing) */}
      {saved && !editing && (
        <div
          onClick={openEditor}
          className="mt-1.5 w-full rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] font-light text-amber-200/80 cursor-pointer hover:border-amber-500/30 transition-colors"
        >
          <div className="flex items-start gap-2">
            <StickyNote className="h-3 w-3 text-amber-500/50 mt-0.5 shrink-0" />
            <span className="whitespace-pre-wrap break-words">{saved}</span>
          </div>
        </div>
      )}

      {/* Editor */}
      {editing && (
        <div className="mt-1.5 w-full rounded-lg border border-border/30 bg-card/30 backdrop-blur-sm p-2 animate-fade-in">
          <textarea
            ref={inputRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save();
              if (e.key === "Escape") cancel();
            }}
            placeholder="Write your note… (Ctrl+Enter to save)"
            rows={2}
            className="w-full bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none resize-none"
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[9px] text-muted-foreground/30">Ctrl+Enter to save</span>
            <div className="flex items-center gap-1">
              {saved && (
                <button onClick={remove} className="p-1 rounded text-destructive/50 hover:text-destructive transition-colors" title="Delete note">
                  <Trash2 className="h-3 w-3" />
                </button>
              )}
              <button onClick={cancel} className="p-1 rounded text-muted-foreground/50 hover:text-foreground transition-colors">
                <X className="h-3 w-3" />
              </button>
              <button onClick={save} className="p-1 rounded text-emerald-500/70 hover:text-emerald-500 transition-colors">
                <Check className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MessageNote;
