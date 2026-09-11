// A side-by-nothing line diff. Additions, removals and context, nothing else.
//
// Colour is never the only signal: every line carries + / − / space, so the
// diff still reads correctly without colour perception.

import { useMemo } from "react";
import { computeLineDiff } from "@/lib/asherCode/aiClient";

const DiffView = ({
  before,
  after,
  label,
  maxHeight = 320,
}: {
  before: string;
  after: string;
  label?: string;
  maxHeight?: number;
}) => {
  const lines = useMemo(() => computeLineDiff(before, after), [before, after]);
  const added = lines.filter((l) => l.type === "add").length;
  const removed = lines.filter((l) => l.type === "del").length;

  return (
    <div className="rounded-lg border border-border/20 bg-background/40">
      <div className="flex items-center gap-3 border-b border-border/15 px-3 py-1.5 text-[11px] text-muted-foreground">
        <span className="truncate text-foreground/80">{label ?? "changes"}</span>
        <span>+{added}</span>
        <span>−{removed}</span>
      </div>
      <div className="overflow-auto font-mono text-[11px] leading-relaxed" style={{ maxHeight }}>
        {lines.length === 0 ? (
          <p className="px-3 py-2 text-muted-foreground">no textual difference.</p>
        ) : (
          lines.map((l, i) => (
            <div
              key={i}
              className={`flex gap-3 px-3 ${
                l.type === "add"
                  ? "bg-emerald-500/10 text-emerald-200/90"
                  : l.type === "del"
                    ? "bg-destructive/10 text-destructive/90"
                    : "text-muted-foreground"
              }`}
            >
              <span className="w-10 shrink-0 select-none text-right text-muted-foreground/50">
                {l.oldLine ?? ""}
              </span>
              <span className="w-10 shrink-0 select-none text-right text-muted-foreground/50">
                {l.newLine ?? ""}
              </span>
              <span aria-hidden className="w-3 shrink-0 select-none">
                {l.type === "add" ? "+" : l.type === "del" ? "−" : " "}
              </span>
              <span className="whitespace-pre-wrap break-all">{l.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DiffView;
