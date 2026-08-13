import { useState, useRef, useCallback, useEffect } from "react";
import { StickyNote, X, Copy, Check, Download, Minus, Maximize2, GripHorizontal, FolderTree, MessageSquare, BookOpen, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import NoteTree from "./notepad/NoteTree";
import NotepadChat from "./notepad/NotepadChat";
import { syncNotepadToNotebook } from "./notepad/syncToNotebook";
import { loadNotepadData, saveNotepadData, loadPos, savePos, genId } from "./notepad/types";
import type { NotepadData, PosSize, NoteBranch } from "./notepad/types";

interface FloatingNotepadProps {
  open: boolean;
  onClose: () => void;
  conversationId: string;
}

const MIN_W = 320;
const MIN_H = 280;
const MAX_W = 900;
const MAX_H = 800;

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

type Tab = "notes" | "chat";

const FloatingNotepad = ({ open, onClose, conversationId }: FloatingNotepadProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<NotepadData>(() => loadNotepadData(conversationId));
  const [pos, setPos] = useState<PosSize>(loadPos);
  const [copied, setCopied] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [tab, setTab] = useState<Tab>("notes");
  const [sorting, setSorting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const activeConvRef = useRef(conversationId);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dragging = useRef(false);
  const resizing = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Reload when switching conversations
  useEffect(() => {
    activeConvRef.current = conversationId;
    setData(loadNotepadData(conversationId));
  }, [conversationId]);

  // Persist data
  useEffect(() => {
    const t = setTimeout(() => {
      if (activeConvRef.current === conversationId) {
        saveNotepadData(conversationId, data);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [data, conversationId]);

  // Persist position
  useEffect(() => { savePos(pos); }, [pos]);

  // Drag
  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    dragging.current = true;
    const pt = "touches" in e ? e.touches[0] : e;
    offset.current = { x: pt.clientX - pos.x, y: pt.clientY - pos.y };
  }, [pos.x, pos.y]);

  // Resize
  const onResizeStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = true;
    const pt = "touches" in e ? e.touches[0] : e;
    offset.current = { x: pt.clientX, y: pt.clientY };
  }, []);

  useEffect(() => {
    const getPoint = (e: MouseEvent | TouchEvent) => {
      if ("touches" in e && e.touches.length > 0) return e.touches[0];
      if ("clientX" in e) return e as MouseEvent;
      return null;
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      const pt = getPoint(e);
      if (!pt) return;
      if (dragging.current) {
        e.preventDefault();
        setPos(p => ({ ...p, x: Math.max(0, pt.clientX - offset.current.x), y: Math.max(0, pt.clientY - offset.current.y) }));
      }
      if (resizing.current) {
        e.preventDefault();
        const dx = pt.clientX - offset.current.x;
        const dy = pt.clientY - offset.current.y;
        offset.current = { x: pt.clientX, y: pt.clientY };
        setPos(p => ({ ...p, w: Math.min(MAX_W, Math.max(MIN_W, p.w + dx)), h: Math.min(MAX_H, Math.max(MIN_H, p.h + dy)) }));
      }
    };
    const onUp = () => { dragging.current = false; resizing.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, []);

  const handleChange = (newData: NotepadData) => setData(newData);

  // Auto-sync to notebooks (debounced 3s after changes)
  useEffect(() => {
    if (!user) return;
    const totalNotes = data.unsorted.length + data.branches.reduce((s, b) => s + b.notes.length, 0);
    if (totalNotes === 0) return;

    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(async () => {
      await syncNotepadToNotebook(user.id, conversationId, data);
    }, 3000);

    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [data, user, conversationId]);

  // Manual sync
  const handleSyncToNotebook = async () => {
    if (!user || syncing) return;
    setSyncing(true);
    const result = await syncNotepadToNotebook(user.id, conversationId, data);
    setSyncing(false);
    if (result.success) {
      toast({ title: "Saved to Notebooks", description: "Your notes are synced to the Notebooks tab." });
    } else {
      toast({ title: "Sync failed", description: result.error, variant: "destructive" });
    }
  };

  // AI auto-sort
  const handleAiSort = async () => {
    const allNotes = [
      ...data.unsorted,
      ...data.branches.flatMap(b => b.notes),
    ];
    if (allNotes.length === 0) return;
    setSorting(true);

    try {
      let authToken = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) authToken = session.access_token;
      } catch { /* fallback */ }

      const notesText = allNotes.map((n, i) => `${i}: ${n.content}`).join("\n");
      const existingBranches = data.branches.map(b => b.name);

      const prompt = `You are an intelligent note organizer. Given these notes (by index), sort them into logical topic branches.

Notes:
${notesText}

${existingBranches.length ? `Existing branches: ${existingBranches.join(", ")}\nReuse existing branch names when appropriate.` : ""}

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "branches": [
    { "name": "Branch Name", "noteIndices": [0, 2, 5] }
  ]
}

Rules:
- Every note must be assigned to exactly one branch
- Create 2-6 meaningful branches based on content themes
- Branch names should be short and descriptive (2-4 words)`;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          mode: "chat",
        }),
      });

      if (!resp.ok) throw new Error("Sort failed");

      // Read streamed response
      const reader = resp.body?.getReader();
      const decoder = new TextDecoder();
      let full = "";
      if (reader) {
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let nlIdx: number;
          while ((nlIdx = buf.indexOf("\n")) !== -1) {
            let line = buf.slice(0, nlIdx);
            buf = buf.slice(nlIdx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") break;
            try {
              const parsed = JSON.parse(json);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) full += delta;
            } catch { /* skip */ }
          }
        }
      }

      // Extract JSON from response
      const jsonMatch = full.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");
      const result = JSON.parse(jsonMatch[0]);

      if (result.branches && Array.isArray(result.branches)) {
        const newBranches: NoteBranch[] = result.branches.map((rb: { name: string; noteIndices: number[] }) => ({
          id: genId(),
          name: rb.name,
          notes: (rb.noteIndices || []).filter((i: number) => i >= 0 && i < allNotes.length).map((i: number) => allNotes[i]),
          collapsed: false,
        }));

        // Find any notes not assigned
        const assignedIndices = new Set(result.branches.flatMap((b: { noteIndices: number[] }) => b.noteIndices || []));
        const remaining = allNotes.filter((_, i) => !assignedIndices.has(i));

        setData({ branches: newBranches, unsorted: remaining });
      }
    } catch (err) {
      console.error("AI sort failed:", err);
    } finally {
      setSorting(false);
    }
  };

  const handleCopy = () => {
    const lines: string[] = [];
    data.branches.forEach(b => {
      lines.push(`## ${b.name}`);
      b.notes.forEach(n => lines.push(`- ${n.content}`));
      lines.push("");
    });
    if (data.unsorted.length) {
      lines.push("## Unsorted");
      data.unsorted.forEach(n => lines.push(`- ${n.content}`));
    }
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const lines: string[] = [];
    data.branches.forEach(b => {
      lines.push(`## ${b.name}`);
      b.notes.forEach(n => lines.push(`- ${n.content}`));
      lines.push("");
    });
    if (data.unsorted.length) {
      lines.push("## Unsorted");
      data.unsorted.forEach(n => lines.push(`- ${n.content}`));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aureon-notes-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalNotes = data.unsorted.length + data.branches.reduce((s, b) => s + b.notes.length, 0);

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      className="fixed z-[100] rounded-2xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col animate-scale-in select-none"
      style={{
        left: pos.x,
        top: pos.y,
        width: minimized ? 280 : pos.w,
        height: minimized ? 44 : pos.h,
      }}
    >
      {/* Title bar */}
      <div
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        className="flex items-center justify-between px-3 py-2 cursor-grab active:cursor-grabbing border-b border-border/20 shrink-0 rounded-t-2xl"
      >
        <div className="flex items-center gap-2">
          <StickyNote className="h-3.5 w-3.5 text-amber-500/70" />
          <span className="text-xs font-light text-foreground tracking-wide select-none">Notepad</span>
          {totalNotes > 0 && (
            <span className="text-[9px] text-muted-foreground/40 font-light">{totalNotes} notes</span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={handleSyncToNotebook} disabled={syncing} className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Save to Notebooks">
            {syncing ? <Loader2 className="h-3 w-3 animate-spin text-amber-500" /> : <BookOpen className="h-3 w-3" />}
          </button>
          <button onClick={handleCopy} className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Copy all">
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </button>
          <button onClick={handleDownload} className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Download">
            <Download className="h-3 w-3" />
          </button>
          <button onClick={() => setMinimized(!minimized)} className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title={minimized ? "Expand" : "Minimize"}>
            {minimized ? <Maximize2 className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          </button>
          <button onClick={onClose} className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Close">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Tab bar */}
          <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border/10">
            <button
              onClick={() => setTab("notes")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                tab === "notes" ? "bg-amber-500/15 text-amber-500" : "text-muted-foreground/50 hover:text-foreground"
              }`}
            >
              <FolderTree className="h-3 w-3" /> Notes
            </button>
            <button
              onClick={() => setTab("chat")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                tab === "chat" ? "bg-amber-500/15 text-amber-500" : "text-muted-foreground/50 hover:text-foreground"
              }`}
            >
              <MessageSquare className="h-3 w-3" /> Ask asherin
            </button>
          </div>

          {/* Content */}
          {tab === "notes" ? (
            <NoteTree data={data} onChange={handleChange} onRequestSort={handleAiSort} sorting={sorting} />
          ) : (
            <NotepadChat data={data} onAiSort={handleAiSort} sorting={sorting} />
          )}

          {/* Resize handle */}
          <div
            onMouseDown={onResizeStart}
            onTouchStart={onResizeStart}
            className="absolute bottom-0 right-0 w-8 h-8 cursor-se-resize flex items-center justify-center opacity-40 hover:opacity-70 active:opacity-70 transition-opacity"
            title="Resize"
          >
            <GripHorizontal className="h-3 w-3 text-muted-foreground rotate-[-45deg]" />
          </div>
        </>
      )}
    </div>
  );
};

export default FloatingNotepad;
