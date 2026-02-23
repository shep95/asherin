import { useState, useRef, useEffect, useCallback } from "react";
import { Terminal, Maximize2, Minimize2, Trash2, Plus, X } from "lucide-react";
import type { IdeFile } from "./IdeFileTree";

interface TerminalLine {
  id: string;
  type: "input" | "output" | "error" | "system";
  text: string;
  timestamp: Date;
}

interface TerminalInstance {
  id: string;
  name: string;
  lines: TerminalLine[];
  cwd: string;
  history: string[];
  histIdx: number;
  env: Record<string, string>;
}

interface Props {
  onAiCommand?: (cmd: string) => void;
  files?: IdeFile[];
  onCreateFile?: (parentId: string | null, name: string, type: "file" | "folder") => void;
  onDeleteFile?: (id: string) => void;
  onUpdateContent?: (id: string, content: string) => void;
  /** Expose terminal output to AI */
  onTerminalOutput?: (output: string) => void;
}

const WELCOME: TerminalLine[] = [
  { id: "w1", type: "system", text: "AUREON Terminal v2.0 — Full Development Console", timestamp: new Date() },
  { id: "w2", type: "system", text: "Type 'help' for commands • '? <query>' to ask Aureon AI", timestamp: new Date() },
];

function makeLine(type: TerminalLine["type"], text: string): TerminalLine {
  return { id: crypto.randomUUID(), type, text, timestamp: new Date() };
}

function flatFiles(files: IdeFile[], path = ""): { path: string; file: IdeFile }[] {
  const result: { path: string; file: IdeFile }[] = [];
  for (const f of files) {
    const fp = path ? `${path}/${f.name}` : f.name;
    result.push({ path: fp, file: f });
    if (f.children) result.push(...flatFiles(f.children, fp));
  }
  return result;
}

function findAtPath(files: IdeFile[], pathParts: string[]): IdeFile | null {
  if (pathParts.length === 0) return null;
  for (const f of files) {
    if (f.name === pathParts[0]) {
      if (pathParts.length === 1) return f;
      if (f.children) return findAtPath(f.children, pathParts.slice(1));
    }
  }
  return null;
}

function resolvePath(cwd: string, input: string): string {
  if (input.startsWith("/")) return input.replace(/^\/+/, "");
  const parts = cwd ? cwd.split("/") : [];
  for (const seg of input.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== "." && seg !== "") parts.push(seg);
  }
  return parts.join("/");
}

function listDir(files: IdeFile[], cwd: string): IdeFile[] {
  if (!cwd) return files;
  const parts = cwd.split("/");
  const node = findAtPath(files, parts);
  return node?.children ?? [];
}

const IdeTerminal = ({ onAiCommand, files = [], onCreateFile, onDeleteFile, onUpdateContent, onTerminalOutput }: Props) => {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([
    { id: "t1", name: "Terminal 1", lines: [...WELCOME], cwd: "", history: [], histIdx: -1, env: { USER: "aureon-dev", HOME: "/", SHELL: "/bin/zsh", NODE_ENV: "development" } },
  ]);
  const [activeTermId, setActiveTermId] = useState("t1");
  const [input, setInput] = useState("");
  const [maximized, setMaximized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeTerm = terminals.find(t => t.id === activeTermId) ?? terminals[0];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeTerm?.lines]);

  const updateTerm = useCallback((id: string, update: Partial<TerminalInstance>) => {
    setTerminals(prev => prev.map(t => t.id === id ? { ...t, ...update } : t));
  }, []);

  const addLine = useCallback((id: string, type: TerminalLine["type"], text: string) => {
    const line = makeLine(type, text);
    setTerminals(prev => prev.map(t => t.id === id ? { ...t, lines: [...t.lines, line] } : t));
    if (onTerminalOutput && (type === "output" || type === "error")) {
      onTerminalOutput(`[${type}] ${text}`);
    }
  }, [onTerminalOutput]);

  const processCommand = useCallback((raw: string) => {
    const tid = activeTermId;
    const term = terminals.find(t => t.id === tid);
    if (!term) return;

    const cmd = raw.trim();
    if (!cmd) return;

    addLine(tid, "input", `${term.cwd || "~"} $ ${cmd}`);
    updateTerm(tid, { history: [cmd, ...term.history], histIdx: -1 });

    const args = cmd.split(/\s+/);
    const base = args[0].toLowerCase();

    // Clear
    if (base === "clear") { updateTerm(tid, { lines: [] }); return; }

    // AI query
    if (cmd.startsWith("? ") || cmd.startsWith("ai ")) {
      const query = cmd.replace(/^\?\s*|^ai\s*/i, "");
      addLine(tid, "system", `[AUREON] Processing: "${query}"`);
      onAiCommand?.(query);
      return;
    }

    // Help
    if (base === "help") {
      addLine(tid, "output", `AUREON Terminal v2.0 — Command Reference
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE SYSTEM
  ls [path]         List files and directories
  cd <path>         Change directory
  pwd               Print working directory
  cat <file>        Display file contents
  touch <name>      Create a new file
  mkdir <name>      Create a new directory
  rm <file>         Delete a file
  cp <src> <dest>   Copy a file
  mv <src> <dest>   Move/rename a file
  tree              Show directory tree
  find <pattern>    Find files matching pattern
  wc <file>         Word/line/char count

DEVELOPMENT
  npm install       Simulate package install
  npm run dev       Start dev server
  npm run build     Build project
  npm test          Run tests
  npx <cmd>         Execute package command
  node <file>       Run JavaScript file
  git status        Show git status
  git log           Show git log
  git branch        List branches
  git diff          Show changes

UTILITIES
  echo <text>       Print text
  date              Show current date/time
  whoami            Show current user
  env               Show environment variables
  export K=V        Set environment variable
  history           Show command history
  grep <pat> <file> Search in file
  curl <url>        Simulate HTTP request
  ping <host>       Simulate ping
  uptime            Show session uptime

AI
  ? <query>         Ask Aureon AI
  ai <query>        Ask Aureon AI
  explain <file>    Ask AI to explain file
  fix <file>        Ask AI to fix issues
  test <file>       Ask AI to generate tests

  clear             Clear terminal
  exit              Close terminal instance`);
      return;
    }

    // pwd
    if (base === "pwd") { addLine(tid, "output", "/" + (term.cwd || "")); return; }

    // cd
    if (base === "cd") {
      const target = args[1] ?? "";
      if (!target || target === "~" || target === "/") { updateTerm(tid, { cwd: "" }); return; }
      const resolved = resolvePath(term.cwd, target);
      if (!resolved) { updateTerm(tid, { cwd: "" }); return; }
      const parts = resolved.split("/");
      const node = findAtPath(files, parts);
      if (node && node.type === "folder") { updateTerm(tid, { cwd: resolved }); }
      else { addLine(tid, "error", `cd: not a directory: ${target}`); }
      return;
    }

    // ls
    if (base === "ls") {
      const target = args[1] ? resolvePath(term.cwd, args[1]) : term.cwd;
      const entries = listDir(files, target);
      if (entries.length === 0) { addLine(tid, "output", "(empty)"); return; }
      const output = entries.map(e => e.type === "folder" ? `[dir] ${e.name}/` : `[file] ${e.name}`).join("\n");
      addLine(tid, "output", output);
      return;
    }

    // tree
    if (base === "tree") {
      const buildTree = (nodes: IdeFile[], prefix = ""): string => {
        return nodes.map((n, i) => {
          const isLast = i === nodes.length - 1;
          const connector = isLast ? "└── " : "├── ";
          const childPrefix = isLast ? "    " : "│   ";
          let line = `${prefix}${connector}${n.name}${n.type === "folder" ? "/" : ""}`;
          if (n.children && n.children.length > 0) {
            line += "\n" + buildTree(n.children, prefix + childPrefix);
          }
          return line;
        }).join("\n");
      };
      const entries = listDir(files, term.cwd);
      addLine(tid, "output", entries.length > 0 ? buildTree(entries) : "(empty)");
      return;
    }

    // cat
    if (base === "cat") {
      if (!args[1]) { addLine(tid, "error", "cat: missing file operand"); return; }
      const resolved = resolvePath(term.cwd, args[1]);
      const parts = resolved.split("/");
      const node = findAtPath(files, parts);
      if (!node) { addLine(tid, "error", `cat: ${args[1]}: No such file`); return; }
      if (node.type === "folder") { addLine(tid, "error", `cat: ${args[1]}: Is a directory`); return; }
      addLine(tid, "output", node.content ?? "(empty file)");
      return;
    }

    // touch
    if (base === "touch") {
      if (!args[1]) { addLine(tid, "error", "touch: missing file operand"); return; }
      onCreateFile?.(null, args[1], "file");
      addLine(tid, "output", `Created: ${args[1]}`);
      return;
    }

    // mkdir
    if (base === "mkdir") {
      if (!args[1]) { addLine(tid, "error", "mkdir: missing operand"); return; }
      onCreateFile?.(null, args[1], "folder");
      addLine(tid, "output", `Created directory: ${args[1]}`);
      return;
    }

    // rm
    if (base === "rm") {
      if (!args[1]) { addLine(tid, "error", "rm: missing operand"); return; }
      const resolved = resolvePath(term.cwd, args[1]);
      const all = flatFiles(files);
      const match = all.find(f => f.path === resolved);
      if (!match) { addLine(tid, "error", `rm: ${args[1]}: No such file`); return; }
      onDeleteFile?.(match.file.id);
      addLine(tid, "output", `Removed: ${args[1]}`);
      return;
    }

    // find
    if (base === "find") {
      const pattern = args[1] ?? "";
      if (!pattern) { addLine(tid, "error", "find: missing pattern"); return; }
      const all = flatFiles(files);
      const matches = all.filter(f => f.path.toLowerCase().includes(pattern.toLowerCase()));
      if (matches.length === 0) addLine(tid, "output", "No matches found");
      else addLine(tid, "output", matches.map(m => m.path).join("\n"));
      return;
    }

    // wc
    if (base === "wc") {
      if (!args[1]) { addLine(tid, "error", "wc: missing file operand"); return; }
      const resolved = resolvePath(term.cwd, args[1]);
      const node = findAtPath(files, resolved.split("/"));
      if (!node || node.type === "folder") { addLine(tid, "error", `wc: ${args[1]}: not a file`); return; }
      const content = node.content ?? "";
      const lines = content.split("\n").length;
      const words = content.split(/\s+/).filter(Boolean).length;
      const chars = content.length;
      addLine(tid, "output", `  ${lines} lines  ${words} words  ${chars} chars  ${args[1]}`);
      return;
    }

    // grep
    if (base === "grep") {
      if (args.length < 3) { addLine(tid, "error", "grep: usage: grep <pattern> <file>"); return; }
      const pattern = args[1];
      const resolved = resolvePath(term.cwd, args[2]);
      const node = findAtPath(files, resolved.split("/"));
      if (!node || !node.content) { addLine(tid, "error", `grep: ${args[2]}: No such file`); return; }
      const matches = node.content.split("\n").filter(line => line.toLowerCase().includes(pattern.toLowerCase()));
      if (matches.length === 0) addLine(tid, "output", "(no matches)");
      else addLine(tid, "output", matches.map((m, i) => `${i + 1}: ${m}`).join("\n"));
      return;
    }

    // echo
    if (base === "echo") { addLine(tid, "output", args.slice(1).join(" ")); return; }

    // date
    if (base === "date") { addLine(tid, "output", new Date().toString()); return; }

    // whoami
    if (base === "whoami") { addLine(tid, "output", term.env.USER ?? "aureon-dev"); return; }

    // env
    if (base === "env") {
      addLine(tid, "output", Object.entries(term.env).map(([k, v]) => `${k}=${v}`).join("\n"));
      return;
    }

    // export
    if (base === "export") {
      const kv = args[1];
      if (!kv || !kv.includes("=")) { addLine(tid, "error", "export: usage: export KEY=VALUE"); return; }
      const [k, ...vp] = kv.split("=");
      updateTerm(tid, { env: { ...term.env, [k]: vp.join("=") } });
      addLine(tid, "output", `${k}=${vp.join("=")}`);
      return;
    }

    // history
    if (base === "history") {
      addLine(tid, "output", term.history.slice(0, 50).map((h, i) => `  ${i + 1}  ${h}`).reverse().join("\n"));
      return;
    }

    // uptime
    if (base === "uptime") {
      addLine(tid, "output", `Session started: ${WELCOME[0].timestamp.toLocaleTimeString()} — up ${Math.floor((Date.now() - WELCOME[0].timestamp.getTime()) / 60000)} minutes`);
      return;
    }

    // npm commands
    if (base === "npm") {
      const sub = args[1] ?? "";
      if (sub === "install" || sub === "i") {
        const pkg = args[2];
        if (pkg) {
          addLine(tid, "system", `Installing ${pkg}...`);
          setTimeout(() => addLine(tid, "output", `added 1 package in 1.2s\n\n+ ${pkg}@latest\nadded 1 package, removed 0, changed 0 (audited 142 packages in 1.2s)`), 800);
        } else {
          addLine(tid, "system", "Installing dependencies...");
          setTimeout(() => addLine(tid, "output", "added 142 packages in 3.4s\n\n142 packages are looking for funding\n  run `npm fund` for details\n\nfound 0 vulnerabilities"), 1500);
        }
        return;
      }
      if (sub === "run") {
        const script = args[2] ?? "";
        if (script === "dev") {
          addLine(tid, "system", "Starting development server...");
          setTimeout(() => addLine(tid, "output", `  VITE v5.4.0  ready in 340ms\n\n  ➜  Local:   http://localhost:5173/\n  ➜  Network: http://192.168.1.42:5173/\n  ➜  press h + enter to show help`), 600);
        } else if (script === "build") {
          addLine(tid, "system", "Building for production...");
          setTimeout(() => addLine(tid, "output", `vite v5.4.0 building for production...\n✓ 127 modules transformed.\ndist/index.html          0.46 kB │ gzip: 0.30 kB\ndist/assets/index.css    8.12 kB │ gzip: 2.41 kB\ndist/assets/index.js   142.67 kB │ gzip: 45.23 kB\n✓ built in 2.1s`), 1200);
        } else if (script === "test") {
          addLine(tid, "system", "Running tests...");
          setTimeout(() => addLine(tid, "output", `✓ src/App.test.tsx (2 tests) 45ms\n✓ src/utils.test.ts (5 tests) 12ms\n\nTest Files  2 passed (2)\n     Tests  7 passed (7)\n  Duration  1.23s`), 1000);
        } else {
          addLine(tid, "error", `Missing script: "${script}"\n\nAvailable scripts:\n  dev    - Start development server\n  build  - Build for production\n  test   - Run tests`);
        }
        return;
      }
      if (sub === "test") {
        addLine(tid, "system", "Running tests...");
        setTimeout(() => addLine(tid, "output", `✓ All tests passed (7/7) in 1.23s`), 800);
        return;
      }
      addLine(tid, "error", `npm: unknown command "${sub}". Try: install, run, test`);
      return;
    }

    // npx
    if (base === "npx") {
      addLine(tid, "system", `Executing: ${args.slice(1).join(" ")}...`);
      setTimeout(() => addLine(tid, "output", "Done."), 500);
      return;
    }

    // node
    if (base === "node") {
      if (!args[1]) { addLine(tid, "system", "Node.js v20.11.0 REPL (type .exit to quit)"); return; }
      addLine(tid, "system", `Running ${args[1]}...`);
      const resolved = resolvePath(term.cwd, args[1]);
      const node = findAtPath(files, resolved.split("/"));
      if (!node) { addLine(tid, "error", `Cannot find module '${args[1]}'`); return; }
      addLine(tid, "output", `[Executed ${args[1]}] — output simulated in sandbox`);
      return;
    }

    // git commands
    if (base === "git") {
      const sub = args[1] ?? "";
      if (sub === "status") {
        const allFiles = flatFiles(files);
        addLine(tid, "output", `On branch main\nYour branch is up to date with 'origin/main'.\n\nChanges not staged for commit:\n${allFiles.filter(f => f.file.type === "file").slice(0, 5).map(f => `  modified: ${f.path}`).join("\n")}\n\nno changes added to commit`);
      } else if (sub === "log") {
        addLine(tid, "output", `commit a1b2c3d (HEAD -> main)\nAuthor: aureon-dev <dev@aureon.app>\nDate:   ${new Date().toUTCString()}\n\n    Initial commit\n\ncommit e4f5g6h\nAuthor: aureon-dev <dev@aureon.app>\nDate:   ${new Date(Date.now() - 86400000).toUTCString()}\n\n    Project setup`);
      } else if (sub === "branch") {
        addLine(tid, "output", `* main\n  develop\n  feature/auth`);
      } else if (sub === "diff") {
        addLine(tid, "output", `diff --git a/src/App.tsx b/src/App.tsx\n--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -1,4 +1,4 @@\n-import React from "react";\n+import React, { useState } from "react";`);
      } else if (sub === "init") {
        addLine(tid, "output", `Initialized empty Git repository in /project/.git/`);
      } else if (sub === "add") {
        addLine(tid, "output", `Added ${args[2] ?? "."} to staging`);
      } else if (sub === "commit") {
        addLine(tid, "output", `[main a1b2c3d] ${args.slice(3).join(" ") || "update"}\n 1 file changed, 1 insertion(+)`);
      } else {
        addLine(tid, "error", `git: '${sub}' is not a git command. Try: status, log, branch, diff, init, add, commit`);
      }
      return;
    }

    // curl
    if (base === "curl") {
      const url = args[1] ?? "";
      if (!url) { addLine(tid, "error", "curl: missing URL"); return; }
      addLine(tid, "system", `Fetching ${url}...`);
      setTimeout(() => addLine(tid, "output", `HTTP/1.1 200 OK\nContent-Type: application/json\n\n{"status":"ok","message":"Response simulated in sandbox"}`), 600);
      return;
    }

    // ping
    if (base === "ping") {
      const host = args[1] ?? "localhost";
      addLine(tid, "system", `PING ${host}`);
      let count = 0;
      const interval = setInterval(() => {
        count++;
        addLine(tid, "output", `64 bytes from ${host}: icmp_seq=${count} ttl=64 time=${(Math.random() * 20 + 5).toFixed(1)} ms`);
        if (count >= 4) { clearInterval(interval); addLine(tid, "output", `\n--- ${host} ping statistics ---\n4 packets transmitted, 4 received, 0% packet loss`); }
      }, 400);
      return;
    }

    // explain / fix / test (AI shortcuts)
    if (base === "explain" || base === "fix" || base === "test") {
      const target = args[1] ?? "";
      const resolved = target ? resolvePath(term.cwd, target) : "";
      const node = resolved ? findAtPath(files, resolved.split("/")) : null;
      const context = node?.content ? `\n\`\`\`\n${node.content.slice(0, 3000)}\n\`\`\`` : "";
      const query = base === "explain" ? `Explain this code:${context}` : base === "fix" ? `Fix issues in this code:${context}` : `Generate unit tests for:${context}`;
      addLine(tid, "system", `[AUREON] ${base} ${target || "current file"}...`);
      onAiCommand?.(query);
      return;
    }

    // exit
    if (base === "exit") {
      if (terminals.length > 1) {
        setTerminals(prev => prev.filter(t => t.id !== tid));
        setActiveTermId(terminals.find(t => t.id !== tid)?.id ?? "t1");
      } else {
        addLine(tid, "system", "Cannot close last terminal");
      }
      return;
    }

    // Unknown
    addLine(tid, "error", `zsh: command not found: ${base}\nType 'help' for available commands.`);
  }, [activeTermId, terminals, files, onAiCommand, onCreateFile, onDeleteFile, addLine, updateTerm]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processCommand(input);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (activeTerm.history.length > 0) {
        const idx = Math.min(activeTerm.histIdx + 1, activeTerm.history.length - 1);
        updateTerm(activeTermId, { histIdx: idx });
        setInput(activeTerm.history[idx]);
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (activeTerm.histIdx > 0) {
        updateTerm(activeTermId, { histIdx: activeTerm.histIdx - 1 });
        setInput(activeTerm.history[activeTerm.histIdx - 1]);
      } else {
        updateTerm(activeTermId, { histIdx: -1 });
        setInput("");
      }
    }
    if (e.key === "Tab") {
      e.preventDefault();
      // Tab completion
      const parts = input.split(/\s+/);
      const lastPart = parts[parts.length - 1] ?? "";
      if (lastPart) {
        const entries = listDir(files, activeTerm.cwd);
        const match = entries.find(e => e.name.toLowerCase().startsWith(lastPart.toLowerCase()));
        if (match) {
          parts[parts.length - 1] = match.name;
          setInput(parts.join(" "));
        }
      }
    }
    if (e.key === "c" && e.ctrlKey) {
      e.preventDefault();
      addLine(activeTermId, "system", "^C");
      setInput("");
    }
    if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      updateTerm(activeTermId, { lines: [] });
    }
  };

  const addTerminal = () => {
    const id = crypto.randomUUID();
    const name = `Terminal ${terminals.length + 1}`;
    setTerminals(prev => [...prev, { id, name, lines: [makeLine("system", `${name} started`)], cwd: "", history: [], histIdx: -1, env: { USER: "aureon-dev", HOME: "/", SHELL: "/bin/zsh", NODE_ENV: "development" } }]);
    setActiveTermId(id);
  };

  const colorMap: Record<string, string> = {
    input: "text-accent",
    output: "text-foreground/80",
    error: "text-destructive",
    system: "text-muted-foreground/60",
  };

  return (
    <div className={`flex flex-col bg-background/80 ${maximized ? "fixed inset-0 z-50" : "h-full"}`} onClick={() => inputRef.current?.focus()}>
      {/* Tab bar */}
      <div className="flex items-center justify-between px-1 bg-card/20 border-b border-border/10 shrink-0">
        <div className="flex items-center gap-0 overflow-x-auto min-w-0">
          {terminals.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTermId(t.id)}
              className={`flex items-center gap-1 px-2 py-1 text-[9px] font-light whitespace-nowrap transition-colors ${t.id === activeTermId ? "bg-accent/15 text-accent border-b border-accent" : "text-muted-foreground/40 hover:text-foreground"}`}
            >
              <Terminal className="h-2.5 w-2.5" />
              {t.name}
              {terminals.length > 1 && (
                <X className="h-2.5 w-2.5 ml-1 opacity-50 hover:opacity-100" onClick={(e) => { e.stopPropagation(); if (terminals.length > 1) { setTerminals(prev => prev.filter(x => x.id !== t.id)); if (activeTermId === t.id) setActiveTermId(terminals.find(x => x.id !== t.id)?.id ?? "t1"); } }} />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 shrink-0 px-1">
          <button onClick={addTerminal} className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors" title="New Terminal">
            <Plus className="h-3 w-3" />
          </button>
          <button onClick={() => updateTerm(activeTermId, { lines: [] })} className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors" title="Clear">
            <Trash2 className="h-3 w-3" />
          </button>
          <button onClick={() => setMaximized(!maximized)} className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors">
            {maximized ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* Output */}
      <div className="flex-1 overflow-y-auto px-2 sm:px-3 py-2 font-mono text-[10px] sm:text-[11px] leading-relaxed min-h-0">
        {activeTerm.lines.map(line => (
          <div key={line.id} className={`whitespace-pre-wrap break-all ${colorMap[line.type]}`}>
            {line.text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/&lt;/g, "<").replace(/&gt;/g, ">") ? line.text : line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-2 sm:px-3 py-2 border-t border-border/10">
        <span className="text-accent text-[10px] font-mono shrink-0">{activeTerm.cwd || "~"} $</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent font-mono text-[10px] sm:text-[11px] text-foreground outline-none placeholder:text-muted-foreground/30 min-w-0"
          placeholder="command..."
          autoFocus
        />
      </form>
    </div>
  );
};

export default IdeTerminal;
