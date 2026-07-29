// GovAureonChatPanel — Aureon chat surface embedded in the Sovereign
// Command Deck, now parity-matched with the Aureon Dashboard chat:
// file uploads (images / documents / code), drag-and-drop, code-block
// toggle, paste-to-attach, per-message attachment chips, and full
// audit logging. Streams through supabase/functions/asher-ai which
// natively accepts `{ mimeType, dataBase64 }` attachments per message.

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Send,
  Loader2,
  Brain,
  Share2,
  Paperclip,
  X,
  FileText,
  Code2,
  Image as ImageIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import { getActiveIntelMapByok } from "@/lib/intelMapByok";
import { shareToDeck } from "@/lib/shareToDeck";
import { useAuth } from "@/contexts/AuthContext";
import { useHoaDeck } from "@/hooks/useHoaDeck";

// ---- Attachment model ---------------------------------------------------
// Two shapes: BINARY (image/pdf/etc — sent to Gemini as inlineData) and
// TEXT (code/json/csv/md — inlined into the prompt as a fenced block so
// the model can reason over the source directly, matching the Aureon
// Dashboard behaviour).
interface DeckAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  kind: "binary" | "text";
  dataBase64?: string; // binary only
  text?: string;       // text only
  previewUrl?: string; // images only
}

interface Msg {
  role: "user" | "assistant";
  content: string;
  ts: number;
  attachments?: DeckAttachment[];
}

interface Props {
  operator: string;
  onAudit: (action: string, target: string, detail?: string) => void;
}

const MAX_FILES = 10;
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB per file
const TEXT_EXTS = /\.(txt|md|markdown|csv|tsv|json|jsonl|ya?ml|xml|html?|css|scss|less|js|jsx|mjs|cjs|ts|tsx|py|rb|go|rs|java|kt|swift|c|h|cc|cpp|hpp|cs|php|sh|bash|zsh|sql|toml|ini|env|log|conf|dockerfile|makefile|gradle|patch|diff)$/i;

const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.onload = () => {
      const s = String(r.result || "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.readAsDataURL(file);
  });

const readAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.onload = () => resolve(String(r.result || ""));
    r.readAsText(file);
  });

const isTextFile = (f: File) =>
  f.type.startsWith("text/") ||
  f.type === "application/json" ||
  f.type === "application/xml" ||
  f.type === "application/x-yaml" ||
  TEXT_EXTS.test(f.name);

const langFromName = (n: string) => {
  const m = n.toLowerCase().match(/\.([a-z0-9]+)$/);
  const ext = m?.[1] ?? "";
  const map: Record<string, string> = {
    ts: "ts", tsx: "tsx", js: "js", jsx: "jsx", py: "python", rb: "ruby",
    go: "go", rs: "rust", java: "java", kt: "kotlin", swift: "swift",
    c: "c", h: "c", cc: "cpp", cpp: "cpp", hpp: "cpp", cs: "csharp",
    php: "php", sh: "bash", bash: "bash", zsh: "bash", sql: "sql",
    json: "json", yaml: "yaml", yml: "yaml", xml: "xml", html: "html",
    htm: "html", css: "css", scss: "scss", md: "markdown", csv: "csv",
    toml: "toml", ini: "ini", env: "bash", diff: "diff", patch: "diff",
  };
  return map[ext] ?? "";
};

const fmtSize = (b: number) =>
  b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

const GovAureonChatPanel = ({ operator, onAudit }: Props) => {
  const { user } = useAuth();
  const deck = useHoaDeck();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharingIdx, setSharingIdx] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<DeckAttachment[]>([]);
  const [ingesting, setIngesting] = useState(false);
  const [codeMode, setCodeMode] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Revoke preview URLs on unmount / change.
  useEffect(() => () => {
    attachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
  }, [attachments]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, busy]);

  const ingestFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (!arr.length) return;
    setError(null);
    if (attachments.length + arr.length > MAX_FILES) {
      setError(`Attachment cap is ${MAX_FILES} files.`);
      return;
    }
    setIngesting(true);
    const out: DeckAttachment[] = [];
    for (const f of arr) {
      if (f.size > MAX_BYTES) {
        setError(`"${f.name}" exceeds 20 MB and was skipped.`);
        continue;
      }
      try {
        if (isTextFile(f)) {
          const text = await readAsText(f);
          out.push({
            id: crypto.randomUUID(),
            name: f.name,
            size: f.size,
            mimeType: f.type || "text/plain",
            kind: "text",
            text,
          });
        } else {
          const dataBase64 = await readAsBase64(f);
          const previewUrl = f.type.startsWith("image/") ? URL.createObjectURL(f) : undefined;
          out.push({
            id: crypto.randomUUID(),
            name: f.name,
            size: f.size,
            mimeType: f.type || "application/octet-stream",
            kind: "binary",
            dataBase64,
            previewUrl,
          });
        }
      } catch (e: any) {
        setError(`Could not read "${f.name}": ${e?.message ?? "unknown error"}`);
      }
    }
    setAttachments((prev) => [...prev, ...out]);
    setIngesting(false);
    if (out.length) onAudit("AUREON_CHAT_ATTACH", "gov-deck", `${out.length} file(s)`);
  }, [attachments.length, onAudit]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) ingestFiles(e.target.files);
    e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const gone = prev.find((a) => a.id === id);
      if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  const clearAttachments = () => {
    attachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
    setAttachments([]);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files: File[] = [];
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.kind === "file") {
        const f = item.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      ingestFiles(files);
    }
  };

  // Drag & drop
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) ingestFiles(e.dataTransfer.files);
  };

  const send = async () => {
    const rawText = draft.trim();
    if ((!rawText && attachments.length === 0) || busy) return;

    // Wrap in code fence if code mode is on and text is present.
    const composed = codeMode && rawText ? "```\n" + rawText + "\n```" : rawText;

    // Build the outgoing content: inline text attachments as fenced blocks
    // (so the model sees code/CSV/JSON verbatim), and reference binary
    // attachments in the prose so it knows to look at them.
    const inlinedParts: string[] = [];
    for (const a of attachments) {
      if (a.kind === "text" && a.text) {
        const body = a.text.length > 60_000 ? a.text.slice(0, 60_000) + "\n…[truncated]" : a.text;
        inlinedParts.push(`\n\n**Attachment — ${a.name}** (${fmtSize(a.size)})\n\`\`\`${langFromName(a.name)}\n${body}\n\`\`\``);
      }
    }
    const binaryRefs = attachments.filter((a) => a.kind === "binary");
    if (binaryRefs.length) {
      inlinedParts.push(
        `\n\n_Attached binaries: ${binaryRefs.map((a) => `${a.name} (${a.mimeType})`).join(", ")}_`
      );
    }
    const outgoingContent = (composed + inlinedParts.join("")).trim() || "(see attachments)";

    // Payload attachments for the edge function — Gemini inlineData path.
    const payloadAttachments = binaryRefs.map((a) => ({
      mimeType: a.mimeType,
      dataBase64: a.dataBase64!,
    }));

    const now = Date.now();
    setMessages((m) => [
      ...m,
      { role: "user", content: outgoingContent, ts: now, attachments: [...attachments] },
    ]);
    const sentAttachments = attachments;
    setDraft("");
    clearAttachments();
    setBusy(true);
    onAudit(
      "AUREON_CHAT_PROMPT",
      "gov-deck",
      `${rawText.slice(0, 100)}${sentAttachments.length ? ` [+${sentAttachments.length} file]` : ""}`,
    );

    try {
      const byok = getActiveIntelMapByok();
      const historyMsgs = messages.map((m) => ({ role: m.role, content: m.content }));
      const userMsg: Record<string, unknown> = { role: "user", content: outgoingContent };
      if (payloadAttachments.length) userMsg.attachments = payloadAttachments;

      const { data, error: err } = await supabase.functions.invoke("asher-ai", {
        body: {
          messages: [
            {
              role: "system",
              content:
                "You are Aureon, deployed inside the Asherin.gov Command Deck. Operator handle: " +
                operator +
                ". Answer with surgical directness. No moralizing. Structured markdown when useful. When code or files are attached, analyse them explicitly.",
            },
            ...historyMsgs,
            userMsg,
          ],
          ...(byok ? { byok } : {}),
        },
      });
      if (err) throw err;

      // asher-ai streams SSE via invoke — the client returns the raw
      // concatenated text or a fallback shape. Extract defensively.
      let reply = "";
      if (typeof data === "string") {
        reply = data
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .filter((l) => l && l !== "[DONE]")
          .map((l) => {
            try {
              const j = JSON.parse(l);
              return j?.choices?.[0]?.delta?.content ?? "";
            } catch {
              return "";
            }
          })
          .join("");
      }
      reply =
        reply ||
        (data as any)?.reply ||
        (data as any)?.content ||
        (data as any)?.message ||
        "";
      if (!reply) throw new Error("Aureon returned an empty response.");

      setMessages((m) => [...m, { role: "assistant", content: reply, ts: Date.now() }]);
      onAudit("AUREON_CHAT_REPLY", "gov-deck");
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠︎ Aureon link error: ${e?.message ?? "unknown"}`, ts: Date.now() },
      ]);
      onAudit("AUREON_CHAT_ERROR", "gov-deck", e?.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex h-full min-h-0 flex-col text-foreground relative"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={onDrop}
    >
      {dragOver && (
        <div className="absolute inset-0 z-30 pointer-events-none border-2 border-dashed border-foreground/40 bg-background/40 backdrop-blur-sm flex items-center justify-center">
          <div className="text-xs tracking-[0.3em] uppercase text-foreground/80">Release to attach</div>
        </div>
      )}

      <div className="border-b border-border/20 backdrop-blur-md bg-background/25 px-5 py-3 flex items-center gap-2">
        <Brain className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="text-[10px] tracking-[0.3em] uppercase text-muted-foreground">Aureon · Sovereign Chat</div>
        <div className="ml-auto text-[10px] font-light text-muted-foreground/70">Every prompt, file, and reply is audit-logged.</div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-xs font-light text-muted-foreground/60 py-16">
            Aureon standing by. Ask a question, drop a file, paste code, or attach an image — replies flow through the deck's audit ledger.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <div className="w-8 h-8 shrink-0 rounded-md bg-foreground/[0.06] border border-border/30 flex items-center justify-center text-[10px] font-semibold">
                AU
              </div>
            )}
            <div className={`max-w-[75%] rounded-md px-3 py-2 text-sm font-light leading-relaxed backdrop-blur-sm ${
              m.role === "user" ? "bg-foreground/10 text-foreground" : "bg-background/30 border border-border/20 text-foreground/90"
            }`}>
              {m.role === "user" && m.attachments && m.attachments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {m.attachments.map((a) => (
                    <span key={a.id} className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-border/30 bg-background/40 text-muted-foreground">
                      {a.mimeType.startsWith("image/") ? <ImageIcon className="h-3 w-3" /> : a.kind === "text" ? <Code2 className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                      <span className="max-w-[140px] truncate">{a.name}</span>
                    </span>
                  ))}
                </div>
              )}
              {m.role === "assistant" ? (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
              ) : (
                <span className="whitespace-pre-wrap">{m.content}</span>
              )}
              {m.role === "assistant" && deck.activeServer && deck.activeChannel && deck.myMembership && user && (
                <button
                  onClick={async () => {
                    setSharingIdx(i);
                    try {
                      await shareToDeck({
                        source: "aureon-chat",
                        title: `Aureon reply · ${new Date(m.ts).toLocaleTimeString()}`,
                        body: m.content,
                        serverId: deck.activeServer!.id,
                        channelId: deck.activeChannel!.id,
                        authorId: user.id,
                        authorHandle: deck.myMembership!.handle,
                        compartments: deck.activeChannel!.compartments ?? [],
                      });
                      onAudit("SUITE_SHARE", `#${deck.activeChannel!.name}`, "aureon-chat");
                    } finally { setSharingIdx(null); }
                  }}
                  disabled={sharingIdx === i}
                  className="mt-2 inline-flex items-center gap-1 text-[10px] tracking-widest uppercase px-2 py-1 rounded border border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60 disabled:opacity-50"
                  title={`Share to #${deck.activeChannel.name}`}
                >
                  {sharingIdx === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3" />}
                  Share to #{deck.activeChannel.name}
                </button>
              )}
            </div>
            {m.role === "user" && (
              <div className="w-8 h-8 shrink-0 rounded-md bg-foreground/[0.06] border border-border/30 flex items-center justify-center text-[10px] font-semibold">
                {operator.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Aureon is composing…
          </div>
        )}
      </div>

      <div className="border-t border-border/20 backdrop-blur-md bg-background/25 p-3 space-y-2">
        {error && (
          <div className="text-[11px] text-destructive/90 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((a) => (
              <div key={a.id} className="relative group flex items-center gap-2 rounded-md border border-border/30 bg-background/40 backdrop-blur-sm px-2 py-1.5 text-xs">
                {a.previewUrl ? (
                  <img src={a.previewUrl} alt={a.name} className="h-8 w-8 rounded object-cover" />
                ) : a.kind === "text" ? (
                  <Code2 className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="flex flex-col leading-tight">
                  <span className="text-foreground/90 truncate max-w-[150px]">{a.name}</span>
                  <span className="text-[10px] text-muted-foreground/70">{fmtSize(a.size)} · {a.kind}</span>
                </div>
                <button
                  onClick={() => removeAttachment(a.id)}
                  className="ml-1 p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                  title="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {ingesting && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground self-center" />}
          </div>
        )}

        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={onFileInput}
            accept="image/*,application/pdf,text/*,.md,.markdown,.csv,.tsv,.json,.jsonl,.yaml,.yml,.xml,.html,.htm,.css,.scss,.js,.jsx,.mjs,.cjs,.ts,.tsx,.py,.rb,.go,.rs,.java,.kt,.swift,.c,.h,.cc,.cpp,.hpp,.cs,.php,.sh,.bash,.zsh,.sql,.toml,.ini,.env,.log,.conf,.patch,.diff"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy || ingesting || attachments.length >= MAX_FILES}
            className="h-10 w-10 shrink-0 rounded-md border border-border/30 bg-background/30 hover:bg-foreground/10 disabled:opacity-40 flex items-center justify-center text-muted-foreground hover:text-foreground"
            title="Attach files, images, or code"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCodeMode((v) => !v)}
            disabled={busy}
            className={`h-10 w-10 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
              codeMode
                ? "border-foreground/60 bg-foreground/15 text-foreground"
                : "border-border/30 bg-background/30 hover:bg-foreground/10 text-muted-foreground hover:text-foreground"
            }`}
            title="Toggle code block wrap (Ctrl/Cmd+E)"
          >
            <Code2 className="h-4 w-4" />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onPaste={onPaste}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
                e.preventDefault();
                setCodeMode((v) => !v);
                return;
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={2}
            placeholder={codeMode ? "Paste or type code — wrapped in a ``` block on send…" : "Ask Aureon — attach files, paste code, drop images…"}
            className={`flex-1 bg-background/40 backdrop-blur-sm border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-foreground/50 resize-none ${
              codeMode ? "font-mono text-[13px] border-foreground/40" : "font-light border-border/30"
            }`}
          />
          <button
            onClick={send}
            disabled={busy || ingesting || (!draft.trim() && attachments.length === 0)}
            className="h-10 w-10 rounded-md border border-foreground/40 bg-foreground/5 hover:bg-foreground/15 disabled:opacity-40 flex items-center justify-center"
            title="Send (Enter)"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
          <span>Enter to send · Shift+Enter for newline · Ctrl/Cmd+E to toggle code · drag files anywhere</span>
          <span>{attachments.length}/{MAX_FILES} files · 20 MB max</span>
        </div>
      </div>
    </div>
  );
};

export default GovAureonChatPanel;
