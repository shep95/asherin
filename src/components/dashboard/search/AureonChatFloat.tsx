import { useEffect, useRef, useState } from "react";
import { MessageSquare, Loader2, X, Send, Brain, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";
import ReactMarkdown from "react-markdown";

interface Props {
  targetUrl: string;
  dossier: unknown;
  intelMap?: unknown;
  onClose: () => void;
}
interface ChatMsg { role: "user" | "assistant"; content: string; }

const MIN_W = 320;
const MIN_H = 280;

const AureonChatFloat = ({ targetUrl, dossier, intelMap, onClose }: Props) => {
  const [pos, setPos] = useState({ x: Math.max(16, window.innerWidth - 460), y: 96 });
  const [size, setSize] = useState({ w: 420, h: 520 });
  const [minimized, setMinimized] = useState(false);

  const [brains, setBrains] = useState<{ id: string; name: string }[]>([]);
  const [activeBrainIds, setActiveBrainIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Drag
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);
  const onHeaderDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };
  const onHeaderMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const x = Math.max(0, Math.min(window.innerWidth - 80, e.clientX - dragRef.current.dx));
    const y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragRef.current.dy));
    setPos({ x, y });
  };
  const onHeaderUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  // Resize (bottom-right corner)
  const resizeRef = useRef<{ sx: number; sy: number; w: number; h: number } | null>(null);
  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    resizeRef.current = { sx: e.clientX, sy: e.clientY, w: size.w, h: size.h };
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!resizeRef.current) return;
    const dx = e.clientX - resizeRef.current.sx;
    const dy = e.clientY - resizeRef.current.sy;
    setSize({
      w: Math.max(MIN_W, Math.min(window.innerWidth - pos.x - 8, resizeRef.current.w + dx)),
      h: Math.max(MIN_H, Math.min(window.innerHeight - pos.y - 8, resizeRef.current.h + dy)),
    });
  };
  const onResizeUp = (e: React.PointerEvent) => {
    resizeRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
  };

  // Brains are loaded server-side and applied silently — never exposed in the UI.
  // (House of Asher: classified.)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    try {
      const byok = getActiveIntelMapByok();
      const url = `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/link-extract-chat`;
      const session = (await supabase.auth.getSession()).data.session;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          messages: next,
          dossier,
          intelMap,
          brainIds: activeBrainIds,
          byok,
        }),
      });
      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => "");
        throw new Error(errText || `HTTP ${resp.status}`);
      }
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: "assistant", content: `_Chat failed: ${e?.message || e}_` }]);
    } finally {
      setSending(false);
    }
  };

  const toggleBrain = (id: string) => {
    setActiveBrainIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  return (
    <div
      className="fixed z-50 rounded-xl border border-border/40 bg-card/95 backdrop-blur-2xl shadow-2xl flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.w, height: minimized ? 44 : size.h }}
    >
      {/* Header (drag handle) */}
      <div
        onPointerDown={onHeaderDown}
        onPointerMove={onHeaderMove}
        onPointerUp={onHeaderUp}
        onPointerCancel={onHeaderUp}
        className="flex items-center justify-between px-3 py-2 border-b border-border/20 cursor-move select-none bg-foreground/[0.03]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="h-3.5 w-3.5 text-foreground/80" />
          <div className="text-[10px] font-light tracking-[0.22em] uppercase text-muted-foreground">Aureon Chat</div>
          <div className="text-[10px] font-light text-foreground/70 truncate max-w-[180px]">· {targetUrl}</div>
        </div>
        <div className="flex items-center gap-1" data-no-drag>
          <button onClick={() => setMinimized((m) => !m)} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-foreground/5">
            <Minus className="h-3 w-3" />
          </button>
          <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-foreground/5">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messages.length === 0 && (
              <div className="text-[11px] font-light text-muted-foreground">
                Ask anything about <span className="text-foreground">{targetUrl}</span>.
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`rounded-lg border px-2.5 py-1.5 text-[12px] font-light leading-relaxed ${
                m.role === "user"
                  ? "border-border/40 bg-background/60 text-foreground"
                  : "border-border/30 bg-foreground/[0.03] text-foreground/90"
              }`}>
                {m.role === "assistant"
                  ? <div className="prose prose-sm dark:prose-invert max-w-none [&_*]:font-light"><ReactMarkdown>{m.content || "…"}</ReactMarkdown></div>
                  : m.content}
              </div>
            ))}
            {sending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          </div>

          <div className="border-t border-border/20 p-2 flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask Aureon…"
              rows={2}
              className="flex-1 resize-none rounded-md border border-border/30 bg-background/50 px-2 py-1.5 text-xs font-light text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/40"
            />
            <button
              onClick={send}
              disabled={!input.trim() || sending}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md text-[11px] font-light bg-foreground text-background hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Resize handle */}
          <div
            onPointerDown={onResizeDown}
            onPointerMove={onResizeMove}
            onPointerUp={onResizeUp}
            onPointerCancel={onResizeUp}
            className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
            style={{ background: "linear-gradient(135deg, transparent 50%, hsl(var(--foreground) / 0.3) 50%)" }}
          />
        </>
      )}
    </div>
  );
};

export default AureonChatFloat;
