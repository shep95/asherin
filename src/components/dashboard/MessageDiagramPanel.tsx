import { useState, useMemo, useRef } from "react";
import { X, Brain, Lightbulb, Link2, Layers, Zap, Copy, Check, Download, Camera } from "lucide-react";
import {
  generateKnowledgeGraph,
  generateConceptMap,
  generateCausalDiagram,
  generateTaxonomy,
  generateCustomDiagram,
} from "./diagram/diagramGenerators";
import NeuralTimelineView from "./diagram/NeuralTimelineView";
import DiagramQuestions from "./diagram/DiagramQuestions";
import { useDownloadDiagram } from "./diagram/useDownloadDiagram";

interface MessageDiagramPanelProps {
  open: boolean;
  content: string;
  conversationHistory?: { role: string; content: string }[];
  onClose: () => void;
}

type DiagramType = "knowledge" | "concepts" | "causal" | "taxonomy" | "neural";

const DIAGRAM_TYPES: { id: DiagramType; label: string; desc: string; icon: typeof Brain }[] = [
  { id: "neural", label: "Neural Timeline", desc: "Brain thinking & reasoning pathway", icon: Zap },
  { id: "knowledge", label: "Knowledge Graph", desc: "Concepts & relationships", icon: Brain },
  { id: "concepts", label: "Concept Map", desc: "Ideas & connections", icon: Lightbulb },
  { id: "causal", label: "Causal Chain", desc: "Cause & effect links", icon: Link2 },
  { id: "taxonomy", label: "Taxonomy", desc: "Categorized knowledge", icon: Layers },
];

const MessageDiagramPanel = ({ open, content, onClose }: MessageDiagramPanelProps) => {
  const [diagramType, setDiagramType] = useState<DiagramType>("neural");
  const [copied, setCopied] = useState(false);
  const [additions, setAdditions] = useState<string[]>([]);
  const diagramRef = useRef<HTMLDivElement>(null);
  const { downloadScreenshot } = useDownloadDiagram(diagramRef);

  const mermaidCode = useMemo(() => {
    if (additions.length > 0 && diagramType !== "neural") {
      return generateCustomDiagram(content, additions, diagramType);
    }
    switch (diagramType) {
      case "knowledge": return generateKnowledgeGraph(content);
      case "concepts": return generateConceptMap(content);
      case "causal": return generateCausalDiagram(content);
      case "taxonomy": return generateTaxonomy(content);
      default: return generateKnowledgeGraph(content);
    }
  }, [content, diagramType, additions]);

  const handleCopy = () => {
    navigator.clipboard.writeText(mermaidCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddNode = (text: string) => {
    setAdditions(prev => [...prev, text]);
  };

  if (!open) return null;

  // Parse mermaid into visual nodes + edges
  const parsedNodes: { id: string; label: string }[] = [];
  const parsedEdges: { from: string; to: string; label?: string }[] = [];

  for (const line of mermaidCode.split("\n")) {
    const roundNode = line.match(/^\s+(\w+)\(\("(.+?)"\)\)/);
    if (roundNode) { parsedNodes.push({ id: roundNode[1], label: roundNode[2] }); continue; }
    const squareNode = line.match(/^\s+(\w+)\["(.+?)"\]/);
    if (squareNode) parsedNodes.push({ id: squareNode[1], label: squareNode[2] });
    const labeledEdge = line.match(/^\s+(\w+)\s*(?:-->|==>|---)\|(.+?)\|\s*(\w+)/);
    if (labeledEdge) { parsedEdges.push({ from: labeledEdge[1], to: labeledEdge[3], label: labeledEdge[2] }); continue; }
    const simpleEdge = line.match(/^\s+(\w+)\s*(?:-->|==>|---)\s*(\w+)/);
    if (simpleEdge) parsedEdges.push({ from: simpleEdge[1], to: simpleEdge[2] });
  }

  const incomingSet = new Set(parsedEdges.map(e => e.to));
  const rootNodes = parsedNodes.filter(n => !incomingSet.has(n.id));
  const childNodes = parsedNodes.filter(n => incomingSet.has(n.id));

  return (
    <div className="mt-3 rounded-2xl border border-border/20 bg-card/30 backdrop-blur-md overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/15">
        <div className="flex items-center gap-2">
          {diagramType === "neural" ? <Zap className="h-3.5 w-3.5 text-accent" /> : <Brain className="h-3.5 w-3.5 text-accent" />}
          <span className="text-[11px] font-light text-foreground tracking-wide">
            {diagramType === "neural" ? "Neural Reasoning Timeline" : "Knowledge Diagram"}
          </span>
          {additions.length > 0 && (
            <span className="text-[8px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
              +{additions.length} added
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={downloadScreenshot}
            className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors"
            title="Download diagram as image"
          >
            <Camera className="h-3 w-3" />
          </button>
          <button onClick={handleCopy} className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors" title="Copy Mermaid code">
            {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
          </button>
          <button onClick={onClose} className="p-1 rounded-md text-muted-foreground/50 hover:text-foreground transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Type selector */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border/10 overflow-x-auto">
        {DIAGRAM_TYPES.map(dt => {
          const Icon = dt.icon;
          return (
            <button
              key={dt.id}
              onClick={() => { setDiagramType(dt.id); setAdditions([]); }}
              title={dt.desc}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-light transition-all whitespace-nowrap ${
                diagramType === dt.id
                  ? "bg-accent/15 text-accent border border-accent/20"
                  : "text-muted-foreground/50 hover:text-foreground hover:bg-foreground/5"
              }`}
            >
              <Icon className="h-3 w-3" />
              {dt.label}
            </button>
          );
        })}
      </div>

      {/* Visual Diagram (capturable area) */}
      <div ref={diagramRef} className="p-4 overflow-x-auto bg-card/20">
        {diagramType === "neural" ? (
          <NeuralTimelineView content={content} />
        ) : (
          <>
            {rootNodes.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center mb-3">
                {rootNodes.map(node => (
                  <div key={node.id} className="rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-[11px] font-medium text-accent text-center max-w-[200px]">
                    {node.label}
                  </div>
                ))}
              </div>
            )}

            {rootNodes.length > 0 && childNodes.length > 0 && (
              <div className="flex justify-center mb-3">
                <div className="h-5 w-px bg-accent/30" />
              </div>
            )}

            {childNodes.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {childNodes.map(node => {
                  const edge = parsedEdges.find(e => e.to === node.id);
                  return (
                    <div key={node.id} className="rounded-xl border border-border/20 bg-card/50 px-3 py-2.5 hover:border-accent/20 hover:bg-card/70 transition-all group">
                      {edge?.label && (
                        <div className="text-[9px] text-accent/60 font-light mb-1 uppercase tracking-wider">{edge.label}</div>
                      )}
                      <div className="text-[11px] font-light text-foreground/90 leading-relaxed">{node.label}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {parsedNodes.length === 0 && (
              <div className="text-center text-[11px] text-muted-foreground/40 py-6">No knowledge structure detected in this message</div>
            )}
          </>
        )}
      </div>

      {/* AI Follow-up Questions */}
      <DiagramQuestions
        content={content}
        diagramType={diagramType}
        onAddNode={handleAddNode}
      />

      {/* User additions list */}
      {additions.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {additions.map((a, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-[9px] bg-accent/10 text-accent/70 px-2 py-0.5 rounded-full border border-accent/15">
              {a.slice(0, 35)}{a.length > 35 ? "…" : ""}
              <button onClick={() => setAdditions(prev => prev.filter((_, j) => j !== i))} className="hover:text-destructive transition-colors">×</button>
            </span>
          ))}
          <button onClick={() => setAdditions([])} className="text-[8px] text-muted-foreground/30 hover:text-destructive/60 transition-colors ml-1">Clear all</button>
        </div>
      )}

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
