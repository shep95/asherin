import { useState, useRef, useEffect } from "react";
import { Send, Square, Loader2 } from "lucide-react";
import type { ZaliMessage, ZaliProject } from "./types";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  messages: ZaliMessage[];
  project: ZaliProject | null;
  isStreaming: boolean;
  onSend: (content: string) => void;
  onStop: () => void;
}

const ZaliChatPanel = ({ messages, project, isStreaming, onSend, onStop }: Props) => {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-4 py-3 border-b border-border/20 hidden md:block">
        <h3 className="text-xs font-light tracking-[0.15em] text-muted-foreground uppercase">Conversation</h3>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8 sm:py-12">
              <p className="text-sm font-extralight text-muted-foreground">
                {project ? "Describe what you want to design..." : "Create a project to start designing"}
              </p>
              {project && (
                <div className="mt-4 space-y-1.5 sm:space-y-2">
                  <p className="text-[10px] text-muted-foreground/50">Example prompts:</p>
                  {[
                    "Design a camera with human eye quality",
                    "Create a biodegradable phone case from mushroom mycelium",
                    "Engineer a water purification tablet for disaster zones",
                    "Design a neural interface for paralysis patients",
                  ].map((p) => (
                    <button
                      key={p}
                      onClick={() => onSend(p)}
                      className="block w-full text-left text-[11px] text-muted-foreground/60 hover:text-foreground rounded-lg px-3 py-2 hover:bg-foreground/5 transition-colors"
                    >
                      → {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-3 sm:px-4 py-2.5 sm:py-3 text-xs font-light leading-relaxed ${
                  msg.role === "user"
                    ? "bg-accent/20 text-foreground"
                    : "bg-card/40 border border-border/10 text-foreground"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-invert prose-xs max-w-none [&_p]:text-xs [&_p]:font-light [&_p]:leading-relaxed [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_li]:text-xs [&_code]:text-[10px] [&_pre]:bg-background/50 [&_pre]:border [&_pre]:border-border/20 [&_table]:text-[10px] [&_th]:text-[10px] [&_td]:text-[10px]">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}

          {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex justify-start">
              <div className="bg-card/40 border border-border/10 rounded-2xl px-4 py-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="flex-shrink-0 p-2.5 sm:p-3 border-t border-border/20">
        <div className="flex items-center gap-2 rounded-xl border border-border/20 bg-card/30 px-3 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={project ? "Describe your design concept..." : "Create a project first"}
            disabled={!project || isStreaming}
            className="flex-1 bg-transparent text-xs font-light text-foreground placeholder:text-muted-foreground/40 outline-none disabled:opacity-40"
          />
          {isStreaming ? (
            <button type="button" onClick={onStop} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors">
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || !project}
              className="p-1.5 rounded-lg text-accent hover:bg-accent/10 transition-colors disabled:opacity-30"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default ZaliChatPanel;