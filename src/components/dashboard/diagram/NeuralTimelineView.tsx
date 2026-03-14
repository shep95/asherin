import { useMemo } from "react";

interface NeuronNode {
  id: string;
  label: string;
  type: "input" | "process" | "insight" | "output";
  detail?: string;
  connections: string[];
  fireDelay: number;
}

function extractNeuralTimeline(content: string): NeuronNode[] {
  const nodes: NeuronNode[] = [];
  const lines = content.split("\n").filter(l => l.trim());
  let idx = 0;

  const firstLine = lines[0]?.replace(/[#*]/g, "").trim().slice(0, 60);
  if (firstLine) {
    nodes.push({ id: `n${idx}`, label: "Input Received", type: "input", detail: firstLine, connections: [], fireDelay: 0 });
    idx++;
  }

  const headings: string[] = [];
  const bulletsByHeading: Record<string, string[]> = {};
  let currentH = "";
  for (const line of lines) {
    const hMatch = line.match(/^#{1,3}\s+(.+)/);
    if (hMatch) {
      currentH = hMatch[1].replace(/\*/g, "").trim().slice(0, 50);
      headings.push(currentH);
      bulletsByHeading[currentH] = [];
      continue;
    }
    const bMatch = line.match(/^[-*]\s+(.+)/);
    if (bMatch && currentH) {
      bulletsByHeading[currentH]?.push(bMatch[1].replace(/\*/g, "").trim().slice(0, 60));
    }
  }

  if (headings.length > 0) {
    nodes.push({ id: `n${idx}`, label: "Context Retrieval", type: "process", detail: `Scanning ${headings.length} knowledge domains`, connections: [nodes[0]?.id].filter(Boolean), fireDelay: 0.1 });
    idx++;

    headings.slice(0, 6).forEach((h, i) => {
      const bullets = bulletsByHeading[h] || [];
      nodes.push({
        id: `n${idx}`, label: h, type: "process",
        detail: bullets[0] || `Processing ${h}`,
        connections: [`n${idx - 1}`], fireDelay: 0.15 + i * 0.1,
      });
      idx++;
      bullets.slice(1, 3).forEach((b) => {
        nodes.push({ id: `n${idx}`, label: b.slice(0, 40), type: "insight", connections: [`n${idx - 1}`], fireDelay: 0.2 + i * 0.1 });
        idx++;
      });
    });
  } else {
    const sentences = content.replace(/\n/g, " ").match(/[^.!?]+[.!?]+/g) || [];
    nodes.push({ id: `n${idx}`, label: "Pattern Analysis", type: "process", detail: `Analyzing ${sentences.length} data points`, connections: [nodes[0]?.id].filter(Boolean), fireDelay: 0.1 });
    idx++;
    sentences.slice(0, 8).forEach((s, i) => {
      const clean = s.replace(/\*/g, "").trim().slice(0, 50);
      if (clean.length > 10) {
        nodes.push({ id: `n${idx}`, label: clean, type: i < sentences.length / 2 ? "process" : "insight", connections: [`n${idx - 1}`], fireDelay: 0.15 + i * 0.08 });
        idx++;
      }
    });
  }

  nodes.push({ id: `n${idx}`, label: "Reasoning Synthesis", type: "process", detail: "Cross-referencing all pathways", connections: nodes.filter(n => n.type === "insight").slice(-3).map(n => n.id), fireDelay: 0.85 });
  idx++;
  nodes.push({ id: `n${idx}`, label: "Response Generated", type: "output", detail: `${content.length} chars · ${lines.length} lines`, connections: [`n${idx - 1}`], fireDelay: 1.0 });

  return nodes;
}

const NeuralTimelineView = ({ content }: { content: string }) => {
  const neurons = useMemo(() => extractNeuralTimeline(content), [content]);

  const typeStyles: Record<string, { bg: string; border: string; dot: string; label: string }> = {
    input: { bg: "bg-accent/10", border: "border-accent/30", dot: "bg-accent", label: "INPUT" },
    process: { bg: "bg-card/50", border: "border-border/25", dot: "bg-muted-foreground/50", label: "PROCESS" },
    insight: { bg: "bg-primary/8", border: "border-primary/20", dot: "bg-primary/60", label: "INSIGHT" },
    output: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", dot: "bg-emerald-500", label: "OUTPUT" },
  };

  if (neurons.length === 0) {
    return <div className="text-center text-[11px] text-muted-foreground/40 py-6">No reasoning structure detected</div>;
  }

  return (
    <div className="relative">
      <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gradient-to-b from-accent/40 via-border/20 to-emerald-500/40" />
      <div className="space-y-1.5">
        {neurons.map((neuron) => {
          const style = typeStyles[neuron.type] || typeStyles.process;
          return (
            <div key={neuron.id} className="flex items-start gap-3 pl-1 animate-fade-in" style={{ animationDelay: `${neuron.fireDelay * 600}ms`, animationFillMode: "both" }}>
              <div className="relative shrink-0 mt-2.5">
                <div className={`h-3 w-3 rounded-full ${style.dot} z-10 relative`} />
                <div className={`absolute inset-0 h-3 w-3 rounded-full ${style.dot} animate-ping opacity-30`} style={{ animationDelay: `${neuron.fireDelay * 800}ms`, animationDuration: "1.5s", animationIterationCount: "1" }} />
                {neuron.connections.length > 1 && <div className="absolute -left-1 top-1.5 w-2 h-px bg-accent/20" />}
              </div>
              <div className={`flex-1 rounded-xl border ${style.border} ${style.bg} px-3 py-2 transition-all hover:border-accent/30 hover:bg-card/60 group`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[8px] font-medium tracking-[0.2em] text-muted-foreground/40 uppercase">{style.label}</span>
                  <span className="text-[8px] text-muted-foreground/25">{Math.round(neuron.fireDelay * 100)}ms</span>
                </div>
                <p className="text-[11px] font-light text-foreground/90 leading-relaxed">{neuron.label}</p>
                {neuron.detail && <p className="text-[9px] font-extralight text-muted-foreground/50 mt-0.5 leading-relaxed">{neuron.detail}</p>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-border/10 flex flex-wrap items-center gap-3">
        {Object.entries(typeStyles).map(([key, style]) => {
          const count = neurons.filter(n => n.type === key).length;
          if (count === 0) return null;
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${style.dot}`} />
              <span className="text-[9px] text-muted-foreground/40">{count} {style.label.toLowerCase()}{count !== 1 ? "s" : ""}</span>
            </div>
          );
        })}
        <span className="text-[9px] text-muted-foreground/30 ml-auto">{neurons.length} neurons fired</span>
      </div>
    </div>
  );
};

export default NeuralTimelineView;
