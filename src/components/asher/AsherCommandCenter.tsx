// ASHER AI · Command Center — sessioned chat with file uploads (image/video/PDF).
// Asherin wallpaper background.
//
// History store: the SAME tables the main dashboard chat uses — `conversations`
// + `messages`. The map command center is a second mouth on one memory, not a
// second memory: a conversation started here shows up in the dashboard sidebar
// and vice-versa. The legacy `asher_ai_sessions` / `asher_ai_messages` rows
// were copied across (and left untouched) by migration, so nothing was lost.
//
// Files upload to the private `asher-ai-uploads` bucket and stream to the model
// as inline_data parts via the asher-ai edge function; their metadata rides in
// `messages.attachments`.


import { useEffect, useRef, useState, useCallback, memo } from "react";
import {
  Brain, Send, Loader2, Trash2, Sparkles, ShieldCheck, Database, Lock, Network,
  Plus, MessageSquare, Paperclip, X, FileText, Film, Image as ImageIcon, Pencil, Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logAsherEvent } from "@/lib/asherAudit";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";
import { routeBrainsForPrompt, type SwarmRouteResult } from "@/lib/asherBrainRouter";
import { useAuth } from "@/contexts/AuthContext";
const wallpaperAureon = "/wallpapers/wallpaper-aureon.webp";
import { isOwnerEmail } from "@/lib/adminEmail";

interface Attachment {
  name: string;
  mimeType: string;
  size: number;
  storagePath: string;     // path inside asher-ai-uploads
  dataBase64?: string;     // present only on freshly uploaded turn (for the AI call)
}

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: Attachment[];
}

interface Session {
  id: string;
  title: string;
  updated_at: string;
}
const ACCEPT = "image/*,video/mp4,video/quicktime,video/webm,application/pdf,text/plain,text/markdown,application/json";
const MAX_FILE_MB = 18; // Gemini inline limit ~20MB total

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const fmtSize = (b: number) => b < 1024 ? `${b}B` : b < 1048576 ? `${(b/1024).toFixed(1)}KB` : `${(b/1048576).toFixed(1)}MB`;

const AttIcon = ({ mime }: { mime: string }) => {
  if (mime.startsWith("image/")) return <ImageIcon className="h-3 w-3" strokeWidth={1.6} />;
  if (mime.startsWith("video/")) return <Film className="h-3 w-3" strokeWidth={1.6} />;
  return <FileText className="h-3 w-3" strokeWidth={1.6} />;
};

// Memoized bubble — Markdown re-parses only when this message's content changes,
// so streaming a token into the last assistant message no longer re-renders all
// prior bubbles (huge win on long conversations).
const MessageBubble = memo(function MessageBubble({ m }: { m: Msg }) {
  return (
    <div className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-xl px-4 py-3 text-[13px] font-light leading-relaxed ${
          m.role === "user"
            ? "bg-foreground/10 text-foreground border border-border/15"
            : "bg-card/40 text-foreground/90 border border-border/10 backdrop-blur-sm"
        }`}
      >
        {m.role === "assistant" && (
          <div className="flex items-center gap-1.5 mb-2 opacity-60">
            <Sparkles className="h-3 w-3" strokeWidth={1.5} />
            <span className="text-[8px] font-light tracking-[0.3em] uppercase">Asher</span>
          </div>
        )}
        {m.attachments && m.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {m.attachments.map((a, i) => (
              <span key={i} className="flex items-center gap-1 rounded-md bg-foreground/5 border border-border/20 px-2 py-0.5 text-[10px] font-light text-muted-foreground">
                <AttIcon mime={a.mimeType} />
                <span className="truncate max-w-[140px]">{a.name}</span>
                <span className="text-muted-foreground/50">{fmtSize(a.size)}</span>
              </span>
            ))}
          </div>
        )}
        <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-headings:mt-3 prose-headings:mb-1.5 prose-headings:font-light prose-headings:tracking-wide prose-strong:font-normal prose-strong:text-foreground prose-code:text-foreground/90 prose-code:bg-foreground/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-pre:bg-background/60 prose-pre:border prose-pre:border-border/20 prose-li:my-0.5">
          <ReactMarkdown>{m.content || " "}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
});

const AsherCommandCenter = () => {
  const { user } = useAuth();
  const isAdmin = isOwnerEmail(user?.email);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [activeBrainCount, setActiveBrainCount] = useState<number | null>(null);
  const [lastRoute, setLastRoute] = useState<SwarmRouteResult | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { document.title = "ASHER AI — Command Center"; }, []);

  // Load conversations — the shared dashboard history, not a private silo.
  const loadSessions = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("conversations")
      .select("id,title,updated_at")
      .eq("user_id", user.id)
      .eq("archived", false)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) { toast.error("Could not load history"); return; }
    const list = (data as Session[] | null) ?? [];
    setSessions(list);
    if (!activeId && list.length) setActiveId(list[0].id);
  }, [user, activeId]);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  // Load messages for the active conversation
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("id,role,content,attachments")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      setMessages(((data as any[] | null) ?? [])
        .filter((r) => r.role === "user" || r.role === "assistant")
        .map((r) => ({
          id: r.id,
          role: r.role,
          content: r.content,
          attachments: Array.isArray(r.attachments) ? r.attachments : [],
        })));
    })();
    return () => { cancelled = true; };
  }, [activeId]);


  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  useEffect(() => {
    if (!isAdmin) { setActiveBrainCount(null); return; }
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("asher_brains").select("id", { count: "exact", head: true }).eq("is_active", true);
      if (!cancelled) setActiveBrainCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [isAdmin, messages.length]);

  const newSession = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("asher_ai_sessions")
      .insert({ user_id: user.id, title: "New Conversation" })
      .select("id,title,updated_at").single();
    if (error || !data) { toast.error(error?.message || "Could not create session"); return; }
    setSessions((p) => [data as Session, ...p]);
    setActiveId(data.id);
    setMessages([]);
  };

  const deleteSession = async (id: string) => {
    if (!confirm("Delete this conversation?")) return;
    await supabase.from("asher_ai_sessions").delete().eq("id", id);
    setSessions((p) => p.filter((s) => s.id !== id));
    if (activeId === id) {
      const next = sessions.find((s) => s.id !== id);
      setActiveId(next?.id ?? null);
    }
  };

  const renameSession = async (id: string, title: string) => {
    const t = title.trim() || "Untitled";
    await supabase.from("asher_ai_sessions").update({ title: t }).eq("id", id);
    setSessions((p) => p.map((s) => s.id === id ? { ...s, title: t } : s));
    setRenameId(null);
  };

  const onPickFiles = async (list: FileList | null) => {
    if (!list) return;
    // P0: full magic-byte/MIME/extension validation before any storage write.
    const { validateFile } = await import("@/lib/file-security");
    const checked = await Promise.all(
      Array.from(list).map(async (f) => {
        if (f.size > MAX_FILE_MB * 1024 * 1024) {
          toast.error(`${f.name}: exceeds ${MAX_FILE_MB}MB`); return null;
        }
        const v = await validateFile(f);
        if (!v.valid) { toast.error(`${f.name}: ${v.error}`); return null; }
        return f;
      }),
    );
    const arr = checked.filter(Boolean) as File[];
    setPending((p) => [...p, ...arr].slice(0, 5));
  };

  const removePending = (i: number) => setPending((p) => p.filter((_, j) => j !== i));

  const ensureSession = async (): Promise<string | null> => {
    if (activeId) return activeId;
    if (!user) return null;
    const { data } = await supabase
      .from("asher_ai_sessions")
      .insert({ user_id: user.id, title: "New Conversation" })
      .select("id,title,updated_at").single();
    if (!data) return null;
    setSessions((p) => [data as Session, ...p]);
    setActiveId((data as Session).id);
    return (data as Session).id;
  };

  const send = async () => {
    const text = input.trim();
    if ((!text && pending.length === 0) || busy || !user) return;
    const sid = await ensureSession();
    if (!sid) return;

    setInput("");
    setBusy(true);

    // Upload pending files (in parallel)
    let uploaded: Attachment[] = [];
    if (pending.length) {
      setUploading(true);
      try {
        uploaded = await Promise.all(pending.map(async (f) => {
          const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${user.id}/${Date.now()}_${crypto.randomUUID().slice(0,8)}_${safe}`;
          const { error } = await supabase.storage.from("asher-ai-uploads").upload(path, f, { contentType: f.type });
          if (error) throw new Error(`${f.name}: ${error.message}`);
          const dataBase64 = await fileToBase64(f);
          return { name: f.name, mimeType: f.type, size: f.size, storagePath: path, dataBase64 };
        }));
      } catch (e: any) {
        toast.error(e?.message || "Upload failed"); setBusy(false); setUploading(false); return;
      }
      setUploading(false);
    }
    setPending([]);

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text, attachments: uploaded };
    setMessages((p) => [...p, userMsg]);

    // Persist user message (strip dataBase64 from stored attachments)
    const persistableAtts = uploaded.map(({ dataBase64, ...rest }) => rest);
    await supabase.from("asher_ai_messages").insert({
      session_id: sid, user_id: user.id, role: "user", content: text, attachments: persistableAtts,
    });

    // Auto-title from first user message
    if (messages.length === 0) {
      const t = (text || uploaded[0]?.name || "New").slice(0, 60);
      await supabase.from("asher_ai_sessions").update({ title: t }).eq("id", sid);
      setSessions((p) => p.map((s) => s.id === sid ? { ...s, title: t } : s));
    } else {
      await supabase.from("asher_ai_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sid);
    }

    logAsherEvent("module_open", { module: "asher_command_send", chars: text.length, atts: uploaded.length });

    try {
      const recent = messages.slice(-4).map((m) => ({ role: m.role, content: m.content }));
      const route = await routeBrainsForPrompt(text || "user attached files", { recentMessages: recent }).catch(() => null);
      setLastRoute(route);
      const brainContext = route ? { brains: route.brains.map((b) => ({ name: b.name, category: b.category, content: b.content })) } : null;
      const byok = getActiveIntelMapByok();

      const outboundMessages = [
        ...messages.map((m) => ({
          role: m.role,
          content: m.content,
          // only send base64 for the freshly uploaded turn (history attachments
          // are already baked into model's prior reasoning + would balloon size)
        })),
        { role: "user" as const, content: text, attachments: uploaded },
      ];

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asher-ai`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          ...(byok ? { "x-byok-gemini-key": byok.apiKey } : {}),
        },
        body: JSON.stringify({
          messages: outboundMessages,
          mapContext: { surface: "command_center" },
          brainContext,
        }),
      });

      if (resp.status === 429) { toast.error("Rate limit"); setBusy(false); return; }
      if (resp.status === 401) { toast.error("ASHER AI key invalid. Add a BYOK Gemini key in Settings."); setBusy(false); return; }
      if (resp.status === 402) { toast.error("AI credits exhausted"); setBusy(false); return; }
      if (!resp.ok || !resp.body) { throw new Error(`Stream failed (${resp.status})`); }

      const assistantId = crypto.randomUUID();
      let assistantText = "";
      setMessages((p) => [...p, { id: assistantId, role: "assistant", content: "" }]);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              assistantText += delta.content;
              setMessages((p) => p.map((m) => m.id === assistantId ? { ...m, content: assistantText } : m));
            }
          } catch { buf = line + "\n" + buf; break; }
        }
      }

      if (assistantText.trim()) {
        await supabase.from("asher_ai_messages").insert({
          session_id: sid, user_id: user.id, role: "assistant", content: assistantText, attachments: [],
        });
        await supabase.from("asher_ai_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sid);
      }
    } catch (e: any) {
      toast.error(e?.message || "ASHER AI failed");
      setMessages((p) => [...p, { id: crypto.randomUUID(), role: "assistant", content: `_Stream failed: ${e?.message || e}_` }]);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  return (
    <div className="relative flex h-full w-full text-foreground">
      {/* Asherin wallpaper background */}
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none"
        style={{ backgroundImage: `url(${wallpaperAureon})` }}
      />
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm pointer-events-none" />

      {/* Sessions sidebar */}
      <aside className="relative z-10 w-60 shrink-0 border-r border-border/15 bg-card/30 backdrop-blur-md flex flex-col">
        <div className="shrink-0 px-3 py-3 border-b border-border/15">
          <button
            onClick={newSession}
            className="w-full flex items-center justify-center gap-1.5 rounded-md bg-foreground/90 px-2 py-2 text-[10px] font-light tracking-[0.2em] text-background hover:bg-foreground uppercase"
          >
            <Plus className="h-3 w-3" /> New Convo
          </button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {sessions.length === 0 ? (
            <p className="px-3 py-4 text-[10px] font-light tracking-wide text-muted-foreground/50">No conversations yet.</p>
          ) : sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => activeId !== s.id && setActiveId(s.id)}
              className={`group mx-2 mb-1 flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer transition-colors ${
                activeId === s.id ? "bg-foreground/10 border border-border/20" : "hover:bg-foreground/5 border border-transparent"
              }`}
            >
              <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0" strokeWidth={1.6} />
              {renameId === s.id ? (
                <>
                  <input
                    autoFocus value={renameVal}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") renameSession(s.id, renameVal); if (e.key === "Escape") setRenameId(null); }}
                    className="flex-1 min-w-0 bg-transparent text-[11px] font-light text-foreground outline-none border-b border-border/30"
                  />
                  <button onClick={(e) => { e.stopPropagation(); renameSession(s.id, renameVal); }} className="p-0.5 text-muted-foreground hover:text-foreground">
                    <Check className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <>
                  <span className="flex-1 min-w-0 truncate text-[11px] font-light text-foreground">{s.title}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setRenameId(s.id); setRenameVal(s.title); }}
                    className="p-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                    className="p-0.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </aside>

      {/* Main chat */}
      <div className="relative z-10 flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="shrink-0 flex items-center justify-between border-b border-border/15 px-4 py-2.5 bg-card/30 backdrop-blur-md">
          <div className="flex items-center gap-2 min-w-0">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
            </span>
            <Brain className="h-3.5 w-3.5 text-foreground/70" strokeWidth={1.5} />
            <p className="text-[10px] font-light tracking-[0.3em] text-foreground/80 uppercase truncate">
              ASHER AI · Command Center
            </p>
            <span className="text-[9px] font-light tracking-[0.25em] text-emerald-400/70 uppercase">Live</span>
          </div>
          <div className="flex items-center gap-2">
            {activeBrainCount !== null && (
              <span className="flex items-center gap-1 rounded-md border border-border/20 bg-foreground/5 px-2 py-0.5 text-[9px] font-light tracking-[0.2em] text-muted-foreground uppercase">
                <Database className="h-2.5 w-2.5" strokeWidth={1.8} /> {activeBrainCount} Brains
              </span>
            )}
            {lastRoute && lastRoute.brains.length > 0 && (
              <span
                title={`SWARM ROUTE\n${lastRoute.rationale}\n\n${lastRoute.brains.map((b) => `• ${b.name} [${b.category}]`).join("\n")}`}
                className="flex items-center gap-1 rounded-md border border-emerald-400/30 bg-emerald-400/5 px-2 py-0.5 text-[9px] font-light tracking-[0.2em] text-emerald-300/80 uppercase cursor-help"
              >
                <Network className="h-2.5 w-2.5" strokeWidth={1.8} /> Swarm · {lastRoute.brains.length}/{lastRoute.totalScanned}
              </span>
            )}
            <span className="flex items-center gap-1 rounded-md border border-border/20 bg-foreground/5 px-2 py-0.5 text-[9px] font-light tracking-[0.2em] text-muted-foreground uppercase">
              <ShieldCheck className="h-2.5 w-2.5" strokeWidth={1.8} /> Secure
            </span>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-3xl mx-auto space-y-5">
            {messages.length === 0 && (
              <div className="rounded-xl border border-border/10 bg-card/40 backdrop-blur-sm px-4 py-3 text-foreground/90">
                <div className="flex items-center gap-1.5 mb-2 opacity-60">
                  <Sparkles className="h-3 w-3" strokeWidth={1.5} />
                  <span className="text-[8px] font-light tracking-[0.3em] uppercase">Asher</span>
                </div>
                <div className="text-[13px] font-light leading-relaxed">
                  <p><strong>ASHER AI · Online</strong></p>
                  <p className="mt-2">Direct tactical co-pilot. Attach images, MP4 video, or PDFs and ask anything about them — I see + reason in one pass.</p>
                </div>
              </div>
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} m={m} />
            ))}
            {busy && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="rounded-xl border border-border/10 bg-card/40 backdrop-blur-sm px-4 py-3">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-border/15 bg-card/30 backdrop-blur-md px-4 py-3">
          <div className="max-w-3xl mx-auto">
            {pending.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {pending.map((f, i) => (
                  <span key={i} className="flex items-center gap-1 rounded-md bg-foreground/5 border border-border/20 px-2 py-1 text-[10px] font-light text-foreground">
                    <AttIcon mime={f.type} />
                    <span className="truncate max-w-[160px]">{f.name}</span>
                    <span className="text-muted-foreground/50">{fmtSize(f.size)}</span>
                    <button onClick={() => removePending(i)} className="text-muted-foreground hover:text-destructive ml-1">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="relative flex items-end gap-2 rounded-xl border border-border/20 bg-background/40 px-3 py-2 focus-within:border-foreground/30 transition-colors">
              <input
                ref={fileRef} type="file" multiple accept={ACCEPT} className="hidden"
                onChange={(e) => { onPickFiles(e.target.files); e.currentTarget.value = ""; }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                title="Attach images, MP4, PDF"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-40"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                placeholder="Ask ASHER…  (attach files for vision analysis)"
                rows={1}
                disabled={busy}
                className="flex-1 resize-none bg-transparent text-[13px] font-light text-foreground placeholder:text-muted-foreground/40 focus:outline-none max-h-40 leading-relaxed disabled:opacity-50"
                style={{ height: "auto" }}
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 160) + "px";
                }}
              />
              <button
                onClick={() => void send()}
                disabled={busy || (!input.trim() && pending.length === 0)}
                className="flex items-center gap-1.5 rounded-lg bg-foreground/90 px-3 py-2 text-[10px] font-light tracking-[0.2em] text-background uppercase hover:bg-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy || uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                {uploading ? "Up" : "Send"}
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[9px] font-light tracking-[0.2em] text-muted-foreground/40 uppercase">
              <span className="flex items-center gap-1">
                <Lock className="h-2.5 w-2.5" strokeWidth={1.8} /> Audit-logged · Vision-enabled · Max {MAX_FILE_MB}MB/file
              </span>
              <span>{messages.length} messages</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AsherCommandCenter;
