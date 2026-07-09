// DeckComposer — sovereign composer for channel messaging.
//
// Adds three things the prior single-line textarea did not have:
//   1. A code-block toggle that wraps the current draft in fenced ```lang…```.
//   2. Slash commands (/ai, /share, /code) that mutate what gets submitted.
//      - /ai <prompt>     → routed through hoa-ai-command; posts prompt + reply
//      - /share <text>    → wraps text as a manual share card
//      - /code[:lang]     → toggles a code-block wrap
//   3. Keyboard: Enter to send, Shift+Enter newline, Ctrl/Cmd+E toggle code.
//
// The composer never talks to hoa_messages directly. It calls the two
// callbacks the parent passes (`onSend`, `onAiCommand`) so the parent
// keeps sole authority over who writes into the channel and how it audits.

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, Code2, Sparkles, AlertTriangle, Radio, Lock } from "lucide-react";
import { formatSharedMessage } from "@/lib/shareToDeck";

interface Props {
  channelName: string;
  channelKind: "text" | "voice" | "vault" | "broadcast";
  disabled?: boolean;
  disabledReason?: string;
  onSend: (body: string) => Promise<void> | void;
  onAiCommand: (prompt: string) => Promise<void>;
}

export default function DeckComposer({
  channelName, channelKind, disabled, disabledReason, onSend, onAiCommand,
}: Props) {
  const [draft, setDraft] = useState("");
  const [codeMode, setCodeMode] = useState(false);
  const [lang, setLang] = useState("ts");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const mounted = useRef(true);

  useEffect(() => () => { mounted.current = false; }, []);

  const composeAndClear = async () => {
    const raw = draft.trim();
    if (!raw || busy || aiBusy || disabled) return;

    // Slash-command interception
    if (raw.startsWith("/ai ")) {
      const prompt = raw.slice(4).trim();
      if (!prompt) { setErr("/ai needs a prompt"); return; }
      setAiBusy(true); setErr(null);
      try { await onAiCommand(prompt); if (mounted.current) setDraft(""); }
      catch (e: any) { if (mounted.current) setErr(e?.message ?? "AI command failed"); }
      finally { if (mounted.current) setAiBusy(false); }
      return;
    }
    if (raw.startsWith("/share ")) {
      const payload = raw.slice(7).trim();
      const body = formatSharedMessage("external", "Manual share", payload);
      setBusy(true); setErr(null);
      try { await onSend(body); if (mounted.current) setDraft(""); }
      catch (e: any) { if (mounted.current) setErr(e?.message ?? "send failed"); }
      finally { if (mounted.current) setBusy(false); }
      return;
    }

    const body = codeMode ? "```" + lang + "\n" + raw + "\n```" : raw;
    setBusy(true); setErr(null);
    try { await onSend(body); if (mounted.current) { setDraft(""); setCodeMode(false); } }
    catch (e: any) { if (mounted.current) setErr(e?.message ?? "send failed"); }
    finally { if (mounted.current) setBusy(false); }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void composeAndClear(); return; }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
      e.preventDefault(); setCodeMode(v => !v); areaRef.current?.focus();
    }
  };

  const placeholder = codeMode
    ? `Paste code · language: ${lang} · Enter to send`
    : draft.startsWith("/ai ")   ? "AI Gov prompt — Enter to run"
    : draft.startsWith("/share ") ? "Manual share — Enter to post"
    : `Transmit to #${channelName} · /ai · /share · Ctrl+E code`;

  if (disabled) {
    return (
      <div className="border-t border-border/20 bg-black/20 p-3">
        <div className="flex items-center gap-2 text-xs font-light text-amber-300 border border-amber-500/30 bg-amber-500/5 rounded-md px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5" /> {disabledReason ?? "Insufficient clearance to post here."}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border/20 backdrop-blur-md bg-background/25 p-3">
      <div className={`flex items-end gap-2 rounded-md border transition ${codeMode ? "border-sky-400/40" : "border-border/30"} bg-black/40`}>
        <div className="flex-1 min-w-0">
          {channelKind === "broadcast" && (
            <div className="px-3 pt-2 text-[10px] tracking-widest uppercase text-amber-300 flex items-center gap-1.5"><Radio className="h-3 w-3" /> Emergency broadcast · pins across visible feeds</div>
          )}
          {channelKind === "vault" && (
            <div className="px-3 pt-2 text-[10px] tracking-widest uppercase text-amber-300 flex items-center gap-1.5"><Lock className="h-3 w-3" /> Vault channel · outbound sealed by default</div>
          )}
          {codeMode && (
            <div className="px-3 pt-2 flex items-center gap-2">
              <Code2 className="h-3 w-3 text-sky-300" />
              <span className="text-[10px] tracking-widest uppercase text-sky-300/90">Code block</span>
              <input
                aria-label="Language"
                value={lang}
                onChange={e => setLang(e.target.value.replace(/[^a-z0-9-]/gi, "").slice(0, 12) || "text")}
                className="ml-1 w-20 bg-black/40 border border-border/30 rounded px-1.5 py-0.5 text-[10px] font-mono"
              />
            </div>
          )}
          <textarea
            ref={areaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={codeMode ? 5 : 2}
            placeholder={placeholder}
            className={`w-full bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none resize-none ${codeMode ? "font-mono text-[12.5px]" : "font-light"}`}
          />
        </div>
        <div className="flex flex-col gap-1 p-2">
          <button
            type="button"
            onClick={() => setCodeMode(v => !v)}
            aria-label="Toggle code block"
            aria-pressed={codeMode}
            title="Ctrl/Cmd+E · code block"
            className={`h-8 w-8 rounded-md border flex items-center justify-center transition
              ${codeMode ? "border-sky-400/60 text-sky-300 bg-sky-400/10" : "border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60"}`}
          >
            <Code2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setDraft(d => d.startsWith("/ai ") ? d : "/ai " + d); setTimeout(() => areaRef.current?.focus(), 0); }}
            aria-label="Ask AI Gov"
            title="Prefix /ai to route through the AI Gov"
            className="h-8 w-8 rounded-md border border-border/30 text-muted-foreground hover:text-foreground hover:border-border/60 flex items-center justify-center"
          >
            <Sparkles className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={composeAndClear}
            disabled={busy || aiBusy || !draft.trim()}
            aria-label="Send"
            className="h-8 w-8 rounded-md border border-foreground/40 bg-foreground/5 hover:bg-foreground/15 disabled:opacity-40 flex items-center justify-center"
          >
            {busy || aiBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="mt-1.5 text-[10px] text-muted-foreground/60 flex items-center gap-3 flex-wrap">
        <span>Enter · send</span>
        <span>Shift+Enter · newline</span>
        <span>Ctrl/Cmd+E · code</span>
        <span>/ai · AI Gov</span>
        <span>/share · manual share</span>
        {aiBusy && <span className="text-sky-300 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> AI Gov composing…</span>}
        {err && <span className="text-amber-300 ml-auto flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {err}</span>}
        {!err && <span className="ml-auto">Mirrored to #houseofasher & audit-logged.</span>}
      </div>
    </div>
  );
}
