// AsherImagineAIPanel — chat side panel for the Imagine module.
// Routes through the same asher-ai brain (full Aureon brain access) and
// can also generate images via the asher-imagine edge function.

import { useEffect, useRef, useState } from "react";
import { Brain, Send, Loader2, ChevronRight, ChevronLeft, Image as ImageIcon, Sparkles, Download, Copy as CopyIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { logAsherEvent } from "@/lib/asherAudit";
import { routeBrainsForPrompt } from "@/lib/asherBrainRouter";
import { toast } from "sonner";

const IMAGINE_SESSION_KEY = "imagine_chat_messages_v1";

interface Msg {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  image?: string;
}

const WELCOME_MSG: Msg = {
  id: "welcome",
  role: "assistant",
  content:
    "**ASHER AI · Imagine Console**\n\nI'm wired into the full Aureon brain. Ask me anything or have me generate tactical imagery.\n\n- *Imagine a SAM site at sunset, top-down satellite view*\n- *Sketch a fortified compound with perimeter wall*\n- *Render an urban operations diagram*\n- *Explain the doctrinal use of an L-shaped ambush*",
};

const AsherImagineAIPanel = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const saved = sessionStorage.getItem(IMAGINE_SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as Msg[];
      }
    } catch { /* fall through */ }
    return [WELCOME_MSG];
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [imagineBusy, setImagineBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist conversation across module switches (component unmount/remount)
  useEffect(() => {
    try {
      sessionStorage.setItem(IMAGINE_SESSION_KEY, JSON.stringify(messages));
    } catch { /* quota or disabled */ }
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, imagineBusy]);

  const runImagine = async (prompt: string) => {
    setImagineBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("asher-imagine", { body: { prompt } });
      if (error) throw error;
      if (data?.image) {
        setMessages((p) => [...p, { id: crypto.randomUUID(), role: "assistant", content: `**Imagine · Generated**\n\n${prompt}`, image: data.image }]);
        // Notify the Imagine canvas (if it listens) that a new image is available.
        window.dispatchEvent(new CustomEvent("asher:imagine:result", { detail: { prompt, image: data.image } }));
        logAsherEvent("imagine_generated", { prompt: prompt.slice(0, 200) });
      } else {
        toast.error("Imagine returned no image");
      }
    } catch (e: any) {
      toast.error(e?.message || "Imagine failed");
    } finally {
      setImagineBusy(false);
    }
  };

  const detectImagineIntent = (text: string): string | null => {
    const m = text.match(/^\s*(?:imagine|sketch|render|draw|generate(?:\s+image)?(?:\s+of)?)\s*[:,-]?\s*(.+)$/i);
    return m ? m[1].trim() : null;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    logAsherEvent("imagine_chat", { len: text.length });

    // Imagine intent shortcut
    const imgPrompt = detectImagineIntent(text);
    if (imgPrompt) {
      await runImagine(imgPrompt);
      return;
    }

    setBusy(true);
    try {
      // FLAW 1 FIX — Route brains BEFORE the AI call so the Imagine
      // module gets the same context-aware brain stack the rest of
      // Aureon uses. Best-effort: failures here must not block chat.
      let brainContext: string | null = null;
      let brainRationale: unknown = undefined;
      try {
        const brainResult = await routeBrainsForPrompt(text, {
          topK: 6,
          charBudget: 60_000,
          recentMessages: messages.slice(-2).map((m) => ({ role: m.role, content: m.content })),
        });
        if (brainResult?.brains?.length) {
          brainContext = brainResult.brains
            .map((b: any) => `[BRAIN: ${b.name}]\n${b.content}`)
            .join("\n\n---\n\n");
          brainRationale = brainResult.rationale;
        }
      } catch (brainErr) {
        console.warn("[imagine] brain router failed; continuing without brain context", brainErr);
      }

      const { data, error } = await supabase.functions.invoke("asher-ai", {
        body: {
          mapContext: { module: "imagine" },
          brainContext,
          brainRationale,
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        },
      });
      if (error) throw error;
      const reply = data?.reply || data?.content || data?.message || "(no response)";
      setMessages((p) => [...p, { id: crypto.randomUUID(), role: "assistant", content: reply }]);

      // If the model returned a tool call to imagine, run it
      const tools = data?.tool_calls || [];
      for (const t of tools) {
        if (t?.name === "generate_image" && t?.arguments?.prompt) {
          await runImagine(t.arguments.prompt);
        }
      }
    } catch (e: any) {
      setMessages((p) => [...p, { id: crypto.randomUUID(), role: "assistant", content: `**Error.** ${e?.message || "request failed"}` }]);
    } finally {
      setBusy(false);
    }
  };

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute right-3 top-3 z-[60] flex items-center gap-2 rounded-xl border border-border/30 bg-card/85 backdrop-blur-md px-3 py-2 text-[10px] font-light tracking-[0.2em] text-muted-foreground hover:text-foreground uppercase"
      >
        <Brain className="h-3.5 w-3.5" strokeWidth={1.5} />
        Asher AI
        <ChevronLeft className="h-3 w-3" />
      </button>
    );
  }

  return (
    <div className="absolute right-0 top-0 bottom-0 z-[55] flex w-[400px] flex-col border-l border-border/15 bg-card/40 backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/15 px-4 py-3">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-foreground" strokeWidth={1.5} />
          <p className="text-[10px] font-light tracking-[0.3em] text-foreground uppercase">Asher AI · Imagine</p>
        </div>
        <button onClick={() => setCollapsed(true)} className="text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`text-[12px] font-light leading-relaxed ${m.role === "user" ? "text-foreground" : "text-muted-foreground"}`}>
            <p className="text-[9px] tracking-[0.3em] uppercase mb-1 text-muted-foreground/50">
              {m.role === "user" ? "Operator" : m.role === "system" ? "System" : "Asher"}
            </p>
            <div className="prose prose-invert prose-xs max-w-none [&_p]:my-1 [&_strong]:text-foreground [&_strong]:font-normal">
              <ReactMarkdown>{m.content}</ReactMarkdown>
            </div>
            {m.image && (
              <div className="mt-2 space-y-1">
                <img src={m.image} alt="Generated" className="rounded-lg border border-border/20 w-full" />
                <div className="flex gap-1">
                  <a
                    href={m.image}
                    download={`asher-imagine-${Date.now()}.png`}
                    className="flex items-center gap-1 rounded-md border border-border/30 px-2 py-1 text-[9px] tracking-[0.2em] text-muted-foreground hover:text-foreground uppercase"
                  >
                    <Download className="h-3 w-3" /> Save
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(m.image!);
                      toast.success("Image URL copied");
                    }}
                    className="flex items-center gap-1 rounded-md border border-border/30 px-2 py-1 text-[9px] tracking-[0.2em] text-muted-foreground hover:text-foreground uppercase"
                  >
                    <CopyIcon className="h-3 w-3" /> Copy URL
                  </button>
                  <button
                    onClick={() => window.dispatchEvent(new CustomEvent("asher:imagine:load", { detail: { image: m.image } }))}
                    className="flex items-center gap-1 rounded-md border border-border/30 px-2 py-1 text-[9px] tracking-[0.2em] text-muted-foreground hover:text-foreground uppercase"
                  >
                    <ImageIcon className="h-3 w-3" /> Send to canvas
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
            <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
          </div>
        )}
        {imagineBusy && (
          <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
            <Sparkles className="h-3 w-3 animate-pulse" /> Imagining…
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-border/15 p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border/30 bg-background/40 p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Imagine, ask, or command…"
            rows={2}
            className="flex-1 bg-transparent text-[12px] font-light tracking-wide text-foreground placeholder:text-muted-foreground/50 outline-none resize-none"
          />
          <button
            onClick={send}
            disabled={busy || imagineBusy || !input.trim()}
            className="rounded-md border border-border/30 p-2 text-foreground hover:bg-foreground/5 disabled:opacity-40"
            title="Send"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" strokeWidth={1.5} />}
          </button>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {["Imagine a fortified compound", "Sketch an L-shaped ambush", "Render top-down SAM site", "Explain MSR security"].map((q) => (
            <button
              key={q}
              onClick={() => setInput(q)}
              className="rounded-md border border-border/20 px-2 py-1 text-[9px] tracking-[0.15em] text-muted-foreground hover:text-foreground hover:bg-foreground/5 uppercase"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AsherImagineAIPanel;
