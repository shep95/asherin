import heroBg from "@/assets/hero-bg.png";
import { useState, useRef, useEffect } from "react";
import { Send, Plus, MessageSquare, Trash2, Menu, X, LogOut } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

const Dashboard = () => {
  const [conversations, setConversations] = useState<Conversation[]>([
    { id: "1", title: "New conversation", messages: [], createdAt: new Date() },
  ]);
  const [activeId, setActiveId] = useState("1");
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === activeId) ?? conversations[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [active.messages.length]);

  const sendMessage = () => {
    if (!input.trim()) return;
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              title: c.messages.length === 0 ? input.trim().slice(0, 40) : c.title,
              messages: [...c.messages, userMsg],
            }
          : c
      )
    );
    setInput("");

    // Simulated assistant response
    setTimeout(() => {
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "This is a placeholder response. Connect to your AI backend to enable real conversations.",
        timestamp: new Date(),
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, messages: [...c.messages, assistantMsg] }
            : c
        )
      );
    }, 800);
  };

  const newConversation = () => {
    const conv: Conversation = {
      id: crypto.randomUUID(),
      title: "New conversation",
      messages: [],
      createdAt: new Date(),
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setSidebarOpen(false);
  };

  const deleteConversation = (id: string) => {
    const remaining = conversations.filter((c) => c.id !== id);
    if (remaining.length === 0) {
      const fresh: Conversation = { id: crypto.randomUUID(), title: "New conversation", messages: [], createdAt: new Date() };
      setConversations([fresh]);
      setActiveId(fresh.id);
    } else {
      setConversations(remaining);
      if (activeId === id) setActiveId(remaining[0].id);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBg})` }}
      />
      <div className="fixed inset-0 bg-background/80" />

      {/* Layout */}
      <div className="relative z-10 flex h-screen">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed top-4 left-4 z-50 rounded-xl border border-border/30 bg-card/60 backdrop-blur-md p-2.5 lg:hidden"
        >
          {sidebarOpen ? <X className="h-5 w-5 text-foreground" /> : <Menu className="h-5 w-5 text-foreground" />}
        </button>

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col m-3 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl">
            {/* Sidebar header */}
            <div className="flex items-center justify-between p-4 border-b border-border/20">
              <span className="text-sm font-extralight tracking-[0.25em] text-foreground">ZIALIEL</span>
              <button
                onClick={newConversation}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                title="New conversation"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                    conv.id === activeId
                      ? "bg-foreground/10 text-foreground"
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                  }`}
                  onClick={() => {
                    setActiveId(conv.id);
                    setSidebarOpen(false);
                  }}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate text-sm font-light">{conv.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 rounded p-1 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Sidebar footer */}
            <div className="p-3 pb-5 border-t border-border/20 space-y-1">
              <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-light text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground">
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </div>
        </aside>

        {/* Overlay for mobile sidebar */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-30 bg-background/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main chat area */}
        <main className="flex flex-1 flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 pt-16 pb-4 lg:pt-6">
            {active.messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center max-w-md">
                  <h1 className="text-2xl sm:text-3xl font-extralight tracking-wide text-foreground mb-3">
                    How can I help?
                  </h1>
                  <p className="text-sm font-extralight text-muted-foreground">
                    Start a conversation — your messages are encrypted end-to-end.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mx-auto max-w-3xl space-y-4 py-4">
                {active.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm font-light leading-relaxed ${
                        msg.role === "user"
                          ? "bg-foreground/15 text-foreground backdrop-blur-sm border border-border/20"
                          : "bg-card/50 text-foreground backdrop-blur-md border border-border/20"
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="px-4 pb-4 lg:pb-6">
            <div className="mx-auto max-w-3xl">
              <div className="flex items-end gap-3 rounded-2xl border border-border/30 bg-card/40 backdrop-blur-xl p-3">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Message Zialiel…"
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-sm font-light text-foreground placeholder:text-muted-foreground/50 outline-none max-h-32"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="shrink-0 rounded-xl bg-foreground p-2.5 text-background transition-colors hover:bg-foreground/90 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-center text-xs font-extralight text-muted-foreground/50">
                Zialiel may make mistakes. Verify important information.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
