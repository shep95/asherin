import { useMemo, useState } from "react";
import { X, Check, FileEdit, Loader2 } from "lucide-react";
import { computeLineDiff, type EditPlan } from "@/lib/asherCode/aiClient";

interface Props {
  plan: EditPlan;
  currentFiles: Array<{ id: string; path: string; content: string }>;
  busy?: boolean;
  onCancel: () => void;
  onApply: (selectedPaths: string[]) => void;
}

/**
 * EditPlanReview — renders an AI-proposed multi-file edit as a side-by-side
 * approval panel. Each file is selectable; user picks which patches to apply.
 */
export default function EditPlanReview({ plan, currentFiles, busy, onCancel, onApply }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(plan.edits.map((e) => e.path)));
  const [activePath, setActivePath] = useState<string>(plan.edits[0]?.path || "");

  const diffs = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeLineDiff>>();
    for (const e of plan.edits) {
      const cur = currentFiles.find((f) => f.path === e.path);
      map.set(e.path, computeLineDiff(cur?.content || "", e.new_content));
    }
    return map;
  }, [plan, currentFiles]);

  const activeEdit = plan.edits.find((e) => e.path === activePath);
  const activeDiff = activePath ? diffs.get(activePath) : undefined;

  const stats = useMemo(() => {
    let add = 0, del = 0;
    diffs.forEach((d) => { for (const l of d) { if (l.type === "add") add++; else if (l.type === "del") del++; } });
    return { add, del };
  }, [diffs]);

  function toggle(path: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(path)) n.delete(path); else n.add(path);
      return n;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-md p-4">
      <div className="w-full max-w-6xl h-[85vh] rounded-2xl border border-border/20 bg-card/70 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/20 bg-card/40">
          <div className="flex items-center gap-2.5">
            <FileEdit className="h-3.5 w-3.5 text-emerald-300/80" />
            <div>
              <p className="text-[9px] font-light tracking-[0.3em] text-muted-foreground/70 uppercase">Edit Mode — Review Plan</p>
              <p className="text-xs font-light text-foreground/90 mt-0.5">{plan.summary}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-light text-muted-foreground">
              <span className="text-emerald-400">+{stats.add}</span> <span className="text-red-400">-{stats.del}</span> across {plan.edits.length} files
            </span>
            <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* File list */}
          <aside className="w-72 flex-shrink-0 border-r border-border/15 bg-card/20 overflow-y-auto">
            <div className="px-3 py-2 border-b border-border/15">
              <span className="text-[9px] font-light tracking-[0.25em] text-muted-foreground/70 uppercase">Files ({selected.size}/{plan.edits.length})</span>
            </div>
            {plan.edits.map((e) => {
              const isNew = !currentFiles.find((f) => f.path === e.path);
              const d = diffs.get(e.path) || [];
              const adds = d.filter((l) => l.type === "add").length;
              const dels = d.filter((l) => l.type === "del").length;
              return (
                <div key={e.path}
                  onClick={() => setActivePath(e.path)}
                  className={`px-3 py-2 border-b border-border/10 cursor-pointer hover:bg-foreground/5 ${activePath === e.path ? "bg-foreground/10" : ""}`}>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" checked={selected.has(e.path)} onChange={() => toggle(e.path)} onClick={(ev) => ev.stopPropagation()} className="mt-0.5 accent-emerald-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-light truncate">
                        {e.path}
                        {isNew && <span className="ml-1 text-[8px] tracking-[0.2em] text-emerald-400/80 uppercase">New</span>}
                      </p>
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5"><span className="text-emerald-400">+{adds}</span> <span className="text-red-400">-{dels}</span></p>
                      <p className="text-[9px] text-muted-foreground/50 mt-1 italic line-clamp-2">{e.rationale}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </aside>

          {/* Diff viewer */}
          <div className="flex-1 overflow-auto bg-background/40 font-mono text-[11px] leading-[1.55]">
            {activeEdit ? (
              <div>
                <div className="sticky top-0 px-4 py-2 border-b border-border/15 bg-card/40 backdrop-blur-md">
                  <p className="text-[11px] font-light text-foreground">{activeEdit.path}</p>
                  <p className="text-[10px] text-muted-foreground/70 italic mt-0.5">{activeEdit.rationale}</p>
                </div>
                <div>
                  {activeDiff?.map((l, i) => (
                    <div key={i} className={`flex ${l.type === "add" ? "bg-emerald-500/10" : l.type === "del" ? "bg-red-500/10" : ""}`}>
                      <span className="w-10 text-right pr-2 text-muted-foreground/40 select-none">{l.oldLine ?? ""}</span>
                      <span className="w-10 text-right pr-2 text-muted-foreground/40 select-none">{l.newLine ?? ""}</span>
                      <span className={`w-4 select-none ${l.type === "add" ? "text-emerald-400" : l.type === "del" ? "text-red-400" : "text-muted-foreground/30"}`}>
                        {l.type === "add" ? "+" : l.type === "del" ? "-" : " "}
                      </span>
                      <pre className="flex-1 whitespace-pre-wrap break-all px-2 text-foreground/85">{l.text || " "}</pre>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-xs">Select a file to view changes</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/20 bg-card/40">
          <p className="text-[10px] font-light text-muted-foreground">
            Changes are staged in editor only. Save to persist.
          </p>
          <div className="flex gap-2">
            <button onClick={onCancel} disabled={busy} className="rounded-md border border-border/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] hover:bg-foreground/5 disabled:opacity-40">Cancel</button>
            <button onClick={() => onApply(Array.from(selected))} disabled={busy || selected.size === 0} className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-40">
              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Apply {selected.size} {selected.size === 1 ? "Edit" : "Edits"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
