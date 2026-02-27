import { useState, useMemo } from "react";
import { X, GitBranch, RotateCcw, Copy, Check, ChevronDown } from "lucide-react";

interface MessageDiagramPanelProps {
  open: boolean;
  content: string;
  conversationHistory?: { role: string; content: string }[];
  onClose: () => void;
}

type DiagramType = "flow" | "mind" | "timeline" | "entity";

function generateFlowDiagram(content: string): string {
  const lines = content.split("\n").filter(l => l.trim());
  const steps: string[] = [];

  // Extract headings, bullet points, and key sentences
  for (const line of lines) {
    const heading = line.match(/^#{1,3}\s+(.+)/);
    if (heading) { steps.push(heading[1].trim()); continue; }
    const bullet = line.match(/^[-*]\s+\*?\*?(.+?)\*?\*?\s*$/);
    if (bullet && bullet[1].length < 80) { steps.push(bullet[1].trim().replace(/\*/g, "")); continue; }
    const numbered = line.match(/^\d+[\.)]\s+(.+)/);
    if (numbered && numbered[1].length < 80) { steps.push(numbered[1].trim().replace(/\*/g, "")); continue; }
  }

  if (steps.length === 0) {
    // Fallback: split content into sentence chunks
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10).slice(0, 8);
    steps.push(...sentences.map(s => s.trim().slice(0, 60)));
  }

  const limited = steps.slice(0, 12);
  const nodes = limited.map((s, i) => {
    const clean = s.replace(/["\[\](){}]/g, "").slice(0, 50);
    return `  N${i}["${clean}"]`;
  });
  const links = limited.slice(1).map((_, i) => `  N${i} --> N${i + 1}`);

  return `graph TD\n${nodes.join("\n")}\n${links.join("\n")}`;
}

function generateMindMap(content: string): string {
  const lines = content.split("\n").filter(l => l.trim());
  const headings: string[] = [];
  const bullets: string[] = [];

  for (const line of lines) {
    const h = line.match(/^#{1,3}\s+(.+)/);
    if (h) { headings.push(h[1].trim().replace(/\*/g, "").slice(0, 40)); continue; }
    const b = line.match(/^[-*]\s+(.+)/);
    if (b && b[1].length < 60) { bullets.push(b[1].trim().replace(/\*/g, "").replace(/["\[\](){}]/g, "").slice(0, 40)); }
  }

  const center = headings[0] || "Aureon Analysis";
  const branches = (headings.length > 1 ? headings.slice(1) : bullets).slice(0, 8);

  if (branches.length === 0) {
    return `graph TD\n  C["${center}"]\n  C --> A["Key Point 1"]\n  C --> B["Key Point 2"]`;
  }

  const nodes = branches.map((b, i) => `  C --> N${i}["${b}"]`);
  return `graph TD\n  C["${center}"]\n${nodes.join("\n")}`;
}

function generateTimeline(content: string): string {
  const lines = content.split("\n").filter(l => l.trim());
  const events: string[] = [];

  for (const line of lines) {
    const numbered = line.match(/^\d+[\.)]\s+(.+)/);
    if (numbered) { events.push(numbered[1].trim().replace(/\*/g, "").replace(/["\[\](){}]/g, "").slice(0, 50)); continue; }
    const bullet = line.match(/^[-*]\s+(.+)/);
    if (bullet && bullet[1].length < 60) { events.push(bullet[1].trim().replace(/\*/g, "").replace(/["\[\](){}]/g, "").slice(0, 50)); }
  }

  const limited = events.slice(0, 10);
  if (limited.length < 2) {
    return `graph LR\n  S["Start"] --> E["End"]`;
  }
  const nodes = limited.map((e, i) => `  N${i}["${e}"]`);
  const links = limited.slice(1).map((_, i) => `  N${i} --> N${i + 1}`);
  return `graph LR\n${nodes.join("\n")}\n${links.join("\n")}`;
}

function generateEntityDiagram(content: string): string {
  const entities: { type: string; value: string }[] = [];
  const emailMatches = content.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || [];
  const urlMatches = content.match(/https?:\/\/[^\s)]+/g) || [];
  const orgMatches = content.match(/\b[A-Z][A-Za-z\s&]+(?:Inc\.|LLC|Corp\.|Corporation|Company)\b/g) || [];

  emailMatches.slice(0, 3).forEach(v => entities.push({ type: "Email", value: v.slice(0, 30) }));
  urlMatches.slice(0, 3).forEach(v => entities.push({ type: "URL", value: new URL(v).hostname.slice(0, 25) }));
  orgMatches.slice(0, 3).forEach(v => entities.push({ type: "Org", value: v.trim().slice(0, 25) }));

  // Also extract headings as key topics
  const headings = (content.match(/^#{1,3}\s+(.+)/gm) || []).slice(0, 4).map(h => h.replace(/^#+\s+/, "").replace(/\*/g, "").slice(0, 30));
  headings.forEach(h => entities.push({ type: "Topic", value: h }));

  if (entities.length === 0) {
    const words = content.split(/\s+/).filter(w => w.length > 5 && /^[A-Z]/.test(w)).slice(0, 5);
    words.forEach(w => entities.push({ type: "Entity", value: w.replace(/[^a-zA-Z]/g, "").slice(0, 20) }));
  }

  const limited = entities.slice(0, 10);
  if (limited.length === 0) return `graph TD\n  C["No entities detected"]`;

  const nodes = limited.map((e, i) => `  N${i}["${e.type}: ${e.value}"]`);
  const links = limited.map((_, i) => `  C --> N${i}`);
  return `graph TD\n  C["Analysis"]\n${nodes.join("\n")}\n${links.join("\n")}`;
}

const DIAGRAM_TYPES: { id: DiagramType; label: string; desc: string }[] = [
  { id: "flow", label: "Flow", desc: "Step-by-step flow" },
  { id: "mind", label: "Mind Map", desc: "Topic branches" },
  { id: "timeline", label: "Timeline", desc: "Sequential events" },
  { id: "entity", label: "Entities", desc: "Key entities & links" },
];

const MessageDiagramPanel = ({ open, content, onClose }: MessageDiagramPanelProps) => {
  const [diagramType, setDiagramType] = useState<DiagramType>("flow");
  const [copied, setCopied] = useState(false);

  const mermaidCode = useMemo(() => {
    switch (diagramType) {
      case "flow": return generateFlowDiagram(content);
      case "mind": return generateMindMap(content);
      case "timeline": return generateTimeline(content);
      case "entity": return generateEntityDiagram(content);
      default: return generateFlowDiagram(content);
    }
  }, [content, diagramType]);

  const handleCopy = () => {
    navigator.clipboard.writeText(mermaidCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  // Simple visual rendering of the mermaid graph (parsed nodes + edges)
  const parsedNodes: { id: string; label: string }[] = [];
  const parsedEdges: { from: string; to: string }[] = [];

  for (const line of mermaidCode.split("\n")) {
    const nodeMatch = line.match(/^\s+(\w+)\["(.+?)"\]/);
    if (nodeMatch) parsedNodes.push({ id: nodeMatch[1], label: nodeMatch[2] });
    const edgeMatch = line.match(/^\s+(\w+)\s*-->\s*(\w+)/);
    if (edgeMatch) parsedEdges.push({ from: edgeMatch[1], to: edgeMatch[2] });
  }

  const isHorizontal = mermaidCode.startsWith("graph LR");

  return (
    <div className="mt-3 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/15">
        <div className="flex items-center gap-2">
          <GitBranch className="h-3.5 w-3.5 text-accent" />
          <span className="text-[11px] font-light text-foreground tracking-wide">Visual Diagram</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={handleCopy} className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Copy Mermaid code">
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </button>
          <button onClick={onClose} className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Type selector */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border/10">
        {DIAGRAM_TYPES.map(dt => (
          <button
            key={dt.id}
            onClick={() => setDiagramType(dt.id)}
            title={dt.desc}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-light transition-all ${
              diagramType === dt.id
                ? "bg-accent/15 text-accent border border-accent/20"
                : "text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5"
            }`}
          >
            {dt.label}
          </button>
        ))}
      </div>

      {/* Visual Diagram */}
      <div className="p-4 overflow-x-auto">
        <div className={`flex ${isHorizontal ? "flex-row" : "flex-col"} items-center gap-2 min-w-fit`}>
          {parsedNodes.map((node, idx) => {
            const hasOutgoing = parsedEdges.some(e => e.from === node.id);
            const isCenter = node.id === "C";
            return (
              <div key={node.id} className={`flex ${isHorizontal ? "flex-row" : "flex-col"} items-center gap-2`}>
                <div
                  className={`rounded-xl border px-3 py-2 text-[11px] font-light text-foreground transition-all whitespace-nowrap ${
                    isCenter
                      ? "bg-accent/15 border-accent/30 text-accent"
                      : "bg-card/50 border-border/25 hover:border-accent/20 hover:bg-card/70"
                  }`}
                >
                  {node.label}
                </div>
                {hasOutgoing && !isCenter && idx < parsedNodes.length - 1 && (
                  <div className={`${isHorizontal ? "w-6 h-px" : "h-4 w-px"} bg-border/40`}>
                    <ChevronDown className={`h-2.5 w-2.5 text-muted-foreground/30 ${isHorizontal ? "rotate-[-90deg] translate-y-[-4px]" : ""}`} />
                  </div>
                )}
                {isCenter && (
                  <div className={`${isHorizontal ? "w-6 h-px" : "h-4 w-px"} bg-accent/30`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Mind map layout for branching */}
        {diagramType === "mind" && parsedNodes.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-2 justify-center">
            {parsedNodes.filter(n => n.id !== "C").map(node => (
              <div
                key={node.id}
                className="rounded-xl border border-border/20 bg-card/40 px-3 py-2 text-[10px] font-light text-foreground/80"
              >
                {node.label}
              </div>
            ))}
          </div>
        )}

        {/* Entity layout for entity type */}
        {diagramType === "entity" && parsedNodes.length > 1 && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {parsedNodes.filter(n => n.id !== "C").map(node => (
              <div
                key={node.id}
                className="rounded-xl border border-border/20 bg-card/40 px-3 py-2 text-[10px] font-light text-foreground/80 text-center"
              >
                {node.label}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mermaid source */}
      <details className="border-t border-border/10">
        <summary className="px-4 py-2 text-[9px] font-extralight text-muted-foreground/40 cursor-pointer hover:text-muted-foreground transition-colors">
          View Mermaid Source
        </summary>
        <pre className="px-4 pb-3 text-[10px] font-mono text-muted-foreground/60 overflow-x-auto whitespace-pre leading-relaxed">
          {mermaidCode}
        </pre>
      </details>
    </div>
  );
};

export default MessageDiagramPanel;
