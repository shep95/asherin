import { Brain, Trash2, Edit3, Download, Plus } from "lucide-react";

const mockMemories = [
  { id: "1", content: "User prefers concise responses with bullet points", category: "Preferences", createdAt: "2 days ago" },
  { id: "2", content: "Working on a SaaS product in the AI space", category: "Context", createdAt: "5 days ago" },
  { id: "3", content: "Prefers TypeScript over JavaScript", category: "Technical", createdAt: "1 week ago" },
];

const MemoryCenterView = () => (
  <div className="max-w-3xl mx-auto p-6 space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-xl font-extralight tracking-wide text-foreground">Memory Control Center</h2>
        <p className="text-sm font-extralight text-muted-foreground mt-1">
          Full control over what Zialiel remembers about you.
        </p>
      </div>
      <div className="flex gap-2">
        <button className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm p-2 text-muted-foreground hover:text-foreground transition-colors" title="Export all">
          <Download className="h-4 w-4" />
        </button>
        <button className="rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm p-2 text-destructive hover:text-destructive/80 transition-colors" title="Wipe all">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>

    <button className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border/30 bg-card/10 p-3 text-sm font-light text-muted-foreground hover:text-foreground hover:border-border/50 transition-all">
      <Plus className="h-4 w-4" />
      Add Memory Manually
    </button>

    <div className="space-y-2">
      {mockMemories.map((m) => (
        <div key={m.id} className="group rounded-xl border border-border/20 bg-card/20 backdrop-blur-sm p-4 flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <Brain className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-light text-foreground">{m.content}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-light text-muted-foreground/60 rounded-full border border-border/20 px-2 py-0.5">{m.category}</span>
                <span className="text-[10px] text-muted-foreground/40">{m.createdAt}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors">
              <Edit3 className="h-3.5 w-3.5" />
            </button>
            <button className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default MemoryCenterView;
