import { useState, useRef, useEffect } from "react";
import { Terminal, X, Maximize2, Minimize2, Trash2 } from "lucide-react";

interface TerminalLine {
  id: string;
  type: "input" | "output" | "error" | "system";
  text: string;
  timestamp: Date;
}

interface Props {
  onAiCommand?: (cmd: string) => void;
}

const WELCOME = [
  { id: "w1", type: "system" as const, text: "AUREON Terminal v1.0 — AI-Powered Development Console", timestamp: new Date() },
  { id: "w2", type: "system" as const, text: "Type 'help' for available commands or ask AI anything with '? <query>'", timestamp: new Date() },
];

const COMMANDS: Record<string, string> = {
  help: `Available commands:
  help          — Show this help
  clear         — Clear terminal
  ? <query>     — Ask AI a question
  ls            — List project files
  echo <text>   — Print text
  date          — Show current date/time
  whoami        — Show current user
  version       — Show IDE version`,
  date: new Date().toLocaleString(),
  whoami: "aureon-developer",
  version: "AUREON IDE v1.0.0 (Build 2026.02)",
  ls: "src/\n  components/\n  pages/\n  lib/\n  hooks/\npublic/\nsupabase/\npackage.json\ntsconfig.json\nvite.config.ts",
};

const IdeTerminal = ({ onAiCommand }: Props) => {
  const [lines, setLines] = useState<TerminalLine[]>(WELCOME);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [maximized, setMaximized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const addLine = (type: TerminalLine["type"], text: string) => {
    setLines(prev => [...prev, { id: crypto.randomUUID(), type, text, timestamp: new Date() }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = input.trim();
    if (!cmd) return;

    addLine("input", `$ ${cmd}`);
    setHistory(prev => [cmd, ...prev]);
    setHistIdx(-1);
    setInput("");

    if (cmd === "clear") {
      setLines([]);
      return;
    }

    if (cmd.startsWith("? ") || cmd.startsWith("ai ")) {
      const query = cmd.replace(/^\?\s*|^ai\s*/i, "");
      addLine("system", `[AI] Sending to Aureon: "${query}"`);
      onAiCommand?.(query);
      return;
    }

    if (cmd.startsWith("echo ")) {
      addLine("output", cmd.slice(5));
      return;
    }

    const result = COMMANDS[cmd];
    if (result) {
      addLine("output", result);
    } else {
      addLine("error", `command not found: ${cmd}. Type 'help' for available commands or '? <query>' to ask AI.`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const idx = Math.min(histIdx + 1, history.length - 1);
        setHistIdx(idx);
        setInput(history[idx]);
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx > 0) {
        setHistIdx(histIdx - 1);
        setInput(history[histIdx - 1]);
      } else {
        setHistIdx(-1);
        setInput("");
      }
    }
  };

  const colorMap: Record<string, string> = {
    input: "text-accent",
    output: "text-foreground/80",
    error: "text-destructive",
    system: "text-muted-foreground/60",
  };

  return (
    <div className={`flex flex-col bg-background/80 border-t border-border/20 ${maximized ? "fixed inset-0 z-50" : "h-full"}`} onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-card/20 border-b border-border/10">
        <div className="flex items-center gap-2">
          <Terminal className="h-3 w-3 text-accent/60" />
          <span className="text-[10px] font-light tracking-widest text-muted-foreground/50 uppercase">Terminal</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setLines([])} className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors" title="Clear">
            <Trash2 className="h-3 w-3" />
          </button>
          <button onClick={() => setMaximized(!maximized)} className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors">
            {maximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed min-h-0">
        {lines.map(line => (
          <div key={line.id} className={`whitespace-pre-wrap ${colorMap[line.type]}`}>
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2 border-t border-border/10">
        <span className="text-accent text-[11px] font-mono">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent font-mono text-[11px] text-foreground outline-none placeholder:text-muted-foreground/30"
          placeholder="Type command or '? ask AI'..."
          autoFocus
        />
      </form>
    </div>
  );
};

export default IdeTerminal;
