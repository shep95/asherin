import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Loader2, Maximize2, RotateCcw, Box, Atom, Dna, Layers } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "zali";
  content: string;
  timestamp: Date;
}

interface ZaliChatPanelProps {
  onModeChange: (mode: string) => void;
}

const ZaliChatPanel = ({ onModeChange }: ZaliChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "zali",
      content: "I am ZALI. What are we building today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // Simulate ZALI thinking and response (integration with backend would go here)
    setTimeout(() => {
      let response = "I've analyzed your request. Deconstructing to first principles...";
      let newMode = "assembly";

      if (input.toLowerCase().includes("biological") || input.toLowerCase().includes("medical")) {
        response = "Initiating biological simulation protocol. Building digital twin...";
        newMode = "biological";
      } else if (input.toLowerCase().includes("atomic") || input.toLowerCase().includes("molecule")) {
        response = "Zooming to atomic scale. Calculating quantum interactions...";
        newMode = "atomic";
      }

      const zaliMsg: Message = {
        id: crypto.randomUUID(),
        role: "zali",
        content: response,
        timestamp: new Date(),
      };
      
      setMessages(prev => [...prev, zaliMsg]);
      setLoading(false);
      onModeChange(newMode);
    }, 1500);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-card/20 backdrop-blur-xl border-l border-border/20">
      <div className="p-4 border-b border-border/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <span className="text-sm font-bold tracking-wider text-foreground">ZALI CORE</span>
        </div>
        <div className="flex gap-1">
          <button className="p-1.5 hover:bg-white/5 rounded-md text-muted-foreground transition-colors">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button className="p-1.5 hover:bg-white/5 rounded-md text-muted-foreground transition-colors">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-accent/10 text-foreground border border-accent/20"
                    : "bg-card/40 text-foreground border border-border/20"
                }`}
              >
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-card/40 rounded-2xl px-4 py-3 border border-border/20 flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin text-accent" />
                <span className="text-xs text-muted-foreground font-mono">CALCULATING...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-border/20">
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          <button 
            onClick={() => onModeChange("assembly")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/5 hover:bg-accent/10 text-xs font-mono text-accent border border-accent/20 transition-colors whitespace-nowrap"
          >
            <Box className="h-3 w-3" /> ASSEMBLY
          </button>
          <button 
            onClick={() => onModeChange("atomic")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/5 hover:bg-accent/10 text-xs font-mono text-accent border border-accent/20 transition-colors whitespace-nowrap"
          >
            <Atom className="h-3 w-3" /> ATOMIC
          </button>
          <button 
            onClick={() => onModeChange("biological")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/5 hover:bg-accent/10 text-xs font-mono text-accent border border-accent/20 transition-colors whitespace-nowrap"
          >
            <Dna className="h-3 w-3" /> BIOLOGICAL
          </button>
        </div>
        <div className="relative">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Describe what to build..."
            className="w-full bg-background/50 border border-border/20 rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-accent/50 transition-colors"
          />
          <button
            onClick={sendMessage}
            className="absolute right-2 top-2 p-1.5 bg-accent rounded-lg text-black hover:bg-accent/90 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ZaliChatPanel;
